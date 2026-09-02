#!/usr/bin/env python3
"""代码里读成非 Option 的那几列，库里得有约束撑着。

这个仓禁用了 sqlx 的 `query!` 宏（编译期核对 schema），于是 `Row::get`
读到 NULL 会 panic 这件事，没有任何东西挡着。实际发生过一次:
`payment.rs` 的 SQL 写着 `expires_at IS NULL OR expires_at > NOW()`
（承认 NULL 可能存在），下一行却 `let expires_at: DateTime<Utc> = row.get(...)`
（断定它不为空）。撞上就是一个崩掉的请求 —— 用户点「去付」什么都不发生。

正统改法不是加 Option 防御，是【让类型为真】:把不变量写进库，
SQL 里那句容忍 NULL 的条件跟着删掉。这一支守住第三步 ——
约束哪天被人删掉或改松，读那一行的代码当场失去依据。

每条都写清【谁在依赖它】，那是能不能删的唯一判据。
"""
import os
import subprocess
import sys

不变量 = [
    {
        '约束': 'payment_pending_has_expiry',
        '表': 'payment',
        '说的是': 'pending / processing 的支付一定有到期时间',
        '谁在依赖': [
            'unmei-app/src/payment.rs　复用那一支把 expires_at 读成非 Option',
            'unmei-api/src/workers/payment_sweep.rs　按 expires_at > NOW() 筛，'
            'NULL 不满足任何比较 —— 没有它就是一笔永不过期也永远付不掉的支付',
        ],
        # 反证:真去写一行违规数据，必须被这条约束拒掉。
        # 不比对定义的文本 —— 那种比法挡不住「改松」:实测把 processing
        # 从约束里拿掉之后，`expires_at` / `IS NOT NULL` / `pending`
        # 三个词还都在定义里，文本比对一路报绿，而 sweep 那一支
        # 恰恰是按 `status IN ('pending','processing')` 筛的（2026-09-02）。
        '必须被拒': "UPDATE payment SET status='processing', expires_at=NULL "
                    "WHERE id=(SELECT id FROM payment LIMIT 1)",
    },
    {
        '约束': 'uq_shipment_tracking',
        '表': 'shipment',
        '说的是': '一个承运商的一个单号只对一张运单',
        '谁在依赖': [
            'unmei-app/src/shipment.rs　apply_trace_webhook 按 (carrier_code, tracking_no) '
            '用 `fetch_optional` 取【一条】—— 没有这条约束时它取到的是随机一张，'
            '而那正是承运商回调要改的那张',
        ],
        '必须被拒': "UPDATE shipment SET carrier_code=(SELECT carrier_code FROM shipment "
                    "WHERE tracking_no IS NOT NULL ORDER BY id LIMIT 1), "
                    "tracking_no=(SELECT tracking_no FROM shipment "
                    "WHERE tracking_no IS NOT NULL ORDER BY id LIMIT 1) "
                    "WHERE id=(SELECT id FROM shipment WHERE tracking_no IS NOT NULL "
                    "ORDER BY id OFFSET 1 LIMIT 1)",
    },
    {
        '约束': 'villager_residency_user_id_villager_id_key',
        '表': 'villager_residency',
        '说的是': '一个人一位村民只能住一次',
        '谁在依赖': [
            'unmei-app/src/order.rs　下单前先查「是不是已经住着」——'
            '那是 check-then-act，两个请求同时进来只有这条唯一约束兜得住',
        ],
        '必须被拒': "UPDATE villager_residency SET "
                    "user_id=(SELECT user_id FROM villager_residency ORDER BY id LIMIT 1), "
                    "villager_id=(SELECT villager_id FROM villager_residency ORDER BY id LIMIT 1) "
                    "WHERE id=(SELECT id FROM villager_residency ORDER BY id OFFSET 1 LIMIT 1)",
    },
]


def 问库(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到，这一支没验成：{r.stderr.strip()[:160]}')
        sys.exit(2)
    return [l for l in r.stdout.strip().split('\n') if l]


def 试写(sql):
    """在事务里跑一句必须失败的 SQL，回滚。返回错误文本;真写进去了返回 None。"""
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-v', 'ON_ERROR_STOP=1', '-tAc'] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-v', 'ON_ERROR_STOP=1', '-tAc'])
    r = subprocess.run(cmd + [f'BEGIN; {sql}; ROLLBACK;'], capture_output=True, text=True)
    return (r.stderr.strip() or 'psql 报了错但没说是什么') if r.returncode != 0 else None


# 【约束与索引都要认】。`CREATE UNIQUE INDEX … WHERE …`（部分唯一索引）
# 不进 `pg_constraint` —— 只查那一张表的话，它会报「约束不见了」，
# 而那条索引好端端地在（2026-09-03 加运单号唯一性时踩到）。
现有 = {}
for l in 问库(
        "SELECT c.conname, pg_get_constraintdef(c.oid) FROM pg_constraint c "
        "JOIN pg_class t ON t.oid = c.conrelid "
        "JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname='public' "
        "UNION ALL "
        "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public'"):
    名, _, 定义 = l.partition('|')
    现有[名] = 定义

错 = []
for inv in 不变量:
    名 = inv['约束']
    if 名 not in 现有:
        错.append(f'{inv["表"]} 上的 `{名}` 不见了 —— 它说的是「{inv["说的是"]}」')
        for who in inv['谁在依赖']:
            错.append(f'    依赖它的：{who}')
        continue
    # 在事务里写一行违规数据再回滚。约束还在就会报错，且报的是它的名字 ——
    # 名字对不上说明是【别的东西】把这一行拦下的（外键、非空、类型），
    # 那时这条不变量其实已经没人守了，只是恰好也写不进去。
    r = 试写(inv['必须被拒'])
    if r is None:
        错.append(f'`{名}` 还在，但违规数据【真的写进去了】—— 它被改松了')
        错.append(f'    喂进去的是：{inv["必须被拒"][:100]}')
        for who in inv['谁在依赖']:
            错.append(f'    依赖它的：{who}')
    elif 名 not in r:
        错.append(f'违规数据被拦下了，但拦它的不是 `{名}`：{r[:110]}')
        错.append('    换一条反证，或者确认这条约束还在真的起作用')

for e in 错:
    print(('  ✗ ' if not e.startswith('    ') else '  ') + e)
print(('✗ ' if 错 else '✓ ') + f'代码依赖的库约束都还在 · {len(不变量)} 条')
sys.exit(1 if 错 else 0)
