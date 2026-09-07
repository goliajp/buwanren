#!/usr/bin/env python3
"""说「按你缺的那一样配」的东西，单子上得记得下配的是什么。

【屏上写着，而订单里一处都不记】（2026-09-07 三路验证 · 准备花钱的那一路）:
  · 玉坠   商品名就叫「和田玉葫芦坠（配你缺的那一样）」，¥398
  · 单配香 SKU 名就叫「按你缺的那味单配」，¥268
  · 按月送 正文写着「按你缺的那一味配」，¥78 每月
而 `product.required_inputs` 全仓零读者，`order_line` / `order_meta` 没有
任何相关列，`yongshen` 在 `order.rs` / `fulfillment.rs` 里一次都没出现过 ——
**下单流程从头到尾没问过买家缺什么，装箱的人也拿不到**。
花 ¥398 买「配我缺的那一样」，收到的只能是默认款。

这一支两个方向都守:

  · 标了 `needs_yongshen` 的 SKU，它的每一张**已付**订单都要记得下用神。
    记不下就是收了钱而不知道该配什么 —— 那正是这条 bug 原来的样子。
  · 屏上写着「按你缺的」而 SKU 没标 —— 也红。
    标记是判据的唯一来源（下单那一步照它拒绝），漏标等于这句话又变回空话。

判据里的「屏上写着」用的是商品名 / SKU 名 / 正文里出现「缺的」二字 ——
那正是买家读到的那句承诺，不另发明一套标记。

用法: python3 scripts/check-yongshen-recorded.py   读 PSQL_URL / DATABASE_URL
"""
import os
import subprocess
import sys


def 问库(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到：{r.stderr.strip()[:160]}')
        sys.exit(2)
    return [l for l in r.stdout.strip().split('\n') if l]


标了的 = set(问库(
    "SELECT id FROM sku WHERE COALESCE(spec_json->>'needs_yongshen','') = 'true'"))
# 【承诺分两层，判据也分两层】。
# ① SKU 自己的名字里写着「缺的」（「按你缺的那味单配」）——
# 那是对**这一档**许的诺，这一档必须标。
# ② 商品那一层的文案里写着（名字 / 副标 / 正文）——
# 那是对**这件东西**许的诺，它下面【至少有一档】要真的是现配的。
# 不能要求每一档都标:苏合那一件三档，只有第三档是现配的，
# 而正文要指得出「想要现配的挑第三档」——那句话里就有「缺的」二字。
# 头一版按①的判据套②，于是它把 ¥29 试香与 ¥88 一盒十支
# 一起报了出来，而那两档本来就不该现配（同日 20260907003 那支迁移
# 正是为此把正文的承诺归到第三档）。
自己说了的 = set(问库(
    """SELECT s.id FROM sku s JOIN product p ON p.id = s.product_id
        WHERE p.status='listed' AND s.status='active' AND s.name LIKE '%缺的%'"""))
商品说了的 = 问库(
    """SELECT p.id FROM product p
        WHERE p.status='listed'
          AND (p.name LIKE '%缺的%' OR p.sub_title LIKE '%缺的%'
               OR p.description_md LIKE '%缺的%')""")
if not 标了的 and not 自己说了的 and not 商品说了的:
    print('✗ 既没有标了的 SKU、也没有一件商品说「按你缺的」—— 这一支在空转')
    sys.exit(1)

错 = []
for sid in sorted(自己说了的 - 标了的):
    错.append(f'{sid} 这一档自己的名字里写着「按你缺的」，而它没标 needs_yongshen —— '
              f'下单不会问用神，装箱的人拿不到，那句话又变回了空话')
for pid in sorted(商品说了的):
    有一档 = 问库(
        f"""SELECT s.id FROM sku s
             WHERE s.product_id = '{pid}' AND s.status='active'
               AND COALESCE(s.spec_json->>'needs_yongshen','') = 'true' LIMIT 1""")
    if not 有一档:
        错.append(f'{pid} 的文案里写着「按你缺的」，而它下面没有一档是真的现配的 —— '
                  f'要么把哪一档现配标出来，要么把那句话改掉')

# 已付的单上必须记着。
#
# 【只判这条链接上之后建的单】。用神是**建单那一刻**写的，
# 而历史存量本来就没有 —— 拿它们判今天的代码，这一支从上线第一天起
# 就永远红着，而永远红着的门禁跟没有一样。
# 时间界线不写死也不用「最近一天」（那种数会随测试数据漂）——
# 用那支迁移【真正装上去的时刻】（`_sqlx_migrations.installed_on`），
# 它就是「这件事从什么时候开始成立」的准确定义。
界线 = 问库(
    "SELECT installed_on FROM _sqlx_migrations WHERE version = 20260907002")
if not 界线:
    print('✗ 20260907002 那支迁移还没装上 —— 这一支的时间界线无从谈起')
    sys.exit(1)
漏了 = 问库(
    f"""SELECT o.id, ol.sku_id
         FROM order_record o
         JOIN order_line ol ON ol.order_id = o.id
         JOIN sku s ON s.id = ol.sku_id
         LEFT JOIN order_meta om ON om.order_id = o.id
        WHERE COALESCE(s.spec_json->>'needs_yongshen','') = 'true'
          AND o.status IN ('paid','fulfilling','done')
          AND o.created_at > '{界线[0]}'::timestamptz
          AND COALESCE(om.extra_json->'yongshen'->>'primary','') = ''
        ORDER BY o.created_at DESC LIMIT 20""")
for l in 漏了:
    oid, sid = (l.split('|') + ['', ''])[:2]
    错.append(f'{oid} 买的是要配的 {sid}，而单子上没有用神 —— '
              f'钱收了，而没有人知道该配哪一味')

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ')
      + f'「按你缺的那一样配」记得下来 · 标了 {len(标了的)} 个 SKU · '
        f'自己名字里说了的 {len(自己说了的)} 个 · 商品文案说了的 {len(商品说了的)} 件')
sys.exit(1 if 错 else 0)
