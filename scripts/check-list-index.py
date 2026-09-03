#!/usr/bin/env python3
"""后台按时间倒序翻页的表，不许全表扫。

【为什么要有这一支】——2026-09-03 量到：`outbox_event`（33,723 行）
按 `ORDER BY created_at DESC` 翻页是 Seq Scan + 落盘排序 12MB。
`refund` / `shipment` / `subscription` 一样。

后台十九页里有一半是「新的在最上面」，SQL 一律是这个形状。
今天 20ms 还看不出来，而这几张表只会往上长 —— 事件是每一笔业务
动作一条。等它慢到有人察觉时，慢的是【后台每一页】，
而不是某一个查询，那时候加索引要停机。

判据用 `EXPLAIN`：问 Postgres 自己怎么执行，而不是查
`pg_indexes` 里有没有那个名字 —— 索引存在跟【被选中】是两回事
（类型不匹配、函数包着列都会让它躺在那儿）。

**这一支验不到的**：列顺序装反（`(created_at, region)` 而不是
`(region, created_at)`）。那种索引 Postgres 照样会选，只是扫得多 ——
`EXPLAIN` 里仍旧是 Index Scan。实测确认过它抓不到。
要验那一层得比对实际读了多少行（`EXPLAIN ANALYZE` 的 rows），
而那个数会随库里的数据量漂 —— 一支会自己翻面的判据比没有更坏
（见 gates.sh 开头 ★ 第一条）。所以这一支只钉「不是全表扫」，
把它守得住的那条守死。

行数太少时 Postgres 会理性地选全表扫，那不是问题 ——
所以小表用 `enable_seqscan=off` 问它「真要用的话用得上吗」。
"""
import os, subprocess, sys

URL = os.environ.get('DATABASE_URL',
                     'postgres://unmei:unmei_dev_pwd@localhost:6032/unmei')

# (表, 要不要按区过滤) —— 后台列表页按时间倒序翻的那些
表们 = [
    ('order_record', True), ('payment', True), ('refund', True),
    ('shipment', True), ('outbox_event', True), ('subscription', True),
    ('audit_log', False),
]
# 【`recon_record` 不在上面那张表里】——它没有 created_at。
# 后台读它是「某一批里的所有差异」，所以单独按它真正的查法验:
# `WHERE batch_id=$1 ORDER BY match_state, channel_txn_id`。
# 照着「按时间翻页」的模子套它，EXPLAIN 会直接跑不动 ——
# 而那种失败读起来像「这张表有问题」，实际是名单写错了。
另查 = [
    ('recon_record',
     "SELECT * FROM recon_record WHERE batch_id="
     "(SELECT id FROM recon_batch LIMIT 1) ORDER BY match_state, channel_txn_id"),
]
# 小表：Postgres 选全表扫是对的，只问「真要用时用得上吗」
小表 = {'audit_log', 'coupon'}


def psql(sql):
    r = subprocess.run(['psql', URL, '-tAc', sql], capture_output=True, text=True, timeout=30)
    return (r.stdout if r.returncode == 0 else None)


if psql('SELECT 1') is None:
    print('— 跳过：连不上库。这一支【没验】，不是通过')
    sys.exit(0)

坏, 查过 = [], 0
for 表, 按区 in 表们:
    有没有 = psql(f"SELECT to_regclass('{表}') IS NOT NULL")
    if not 有没有 or 有没有.strip() != 't':
        坏.append(f'{表}：这张表不在了 —— 名单该改')
        continue
    条件 = "WHERE region='cn' " if 按区 else ''
    前缀 = 'SET enable_seqscan = off; ' if 表 in 小表 else ''
    计划 = psql(f"{前缀}EXPLAIN (COSTS OFF) "
                f"SELECT * FROM {表} {条件}ORDER BY created_at DESC LIMIT 50")
    if 计划 is None:
        坏.append(f'{表}：EXPLAIN 跑不动 —— 多半少了 created_at 或 region 列')
        continue
    查过 += 1
    if 'Index Scan' not in 计划 and 'Index Only Scan' not in 计划:
        坏.append(f'{表}：按时间倒序翻页是全表扫 —— '
                  f'补一个 (region, created_at DESC) 的索引')

for 表, sql in 另查:
    计划 = psql(f'EXPLAIN (COSTS OFF) {sql}')
    if 计划 is None:
        坏.append(f'{表}：EXPLAIN 跑不动 —— 表结构改过了')
        continue
    查过 += 1
    if 'Index Scan' not in 计划 and 'Index Only Scan' not in 计划:
        坏.append(f'{表}：按批次取差异是全表扫 —— 补 (batch_id, match_state) 索引')

# 【一张都没查成就不算数】。表名改过、列改过，上面每一条都会 continue，
# 而那跟「全都走索引」长得一模一样。
if 查过 < len(表们) + len(另查) - 1:
    print(f'✗ {len(表们) + len(另查)} 张表只查成了 {查过} 张 —— 这一支现在什么都没验到：')
    for x in 坏:
        print('   ' + x)
    sys.exit(1)

if 坏:
    print(f'✗ {len(坏)} 张表的列表查询会全表扫：')
    for x in 坏:
        print('   ' + x)
    print('   索引存在跟用得上是两回事 —— 它得让 Postgres 真的选它')
    sys.exit(1)
print(f'✓ 后台列表页 · {查过} 张表按时间翻页都走索引')
