#!/usr/bin/env python3
"""前端那张「状态怎么说」的表，要跟后端的枚举对得上。

2026-09-01:订单屏的 `物流说法` 里写着 `pending`（后端根本没有这一档），
却缺了 `preparing` —— 而建运单时状态是写死的 'preparing'，
也就是【每一单的第一档】。落点是 `表[status] || status`，
兜底把原始英文原样显示，于是屏上直接印着 `preparing`。
库里当时 744 单落在这一档，占三成一。

跟转盘那个「南 vs 南方」是同一个形状:写死的键跟真值差一个词，
`||` 兜底，错的跟对的看着一样 —— 眼睛验不了，只能机检。

判据:枚举里的每一个值，表里都要有;表里也不许有枚举里没有的
（写了个用不上的键，跟写错一样是没对上）。
"""
import re, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
错, 查过 = [], 0

对 = [
    ('ShipmentStatus', 'mini/miniprogram/pages/order/index.ts', '物流说法',
     # 轨迹里承运商推来的那几种不在枚举里，表里允许多出来
     {'departed', 'arrived_at_sort_facility', 'failed_delivery', 'unknown'}),
]
枚举源 = (根 / 'backend/unmei-domain/src/commerce/enums.rs').read_text(encoding='utf-8')

for 枚举名, 前端路径, 表名, 额外 in 对:
    m = re.search(r'str_enum!\(' + 枚举名 + r'\s*\{(.*?)\}\)', 枚举源, re.S)
    if not m:
        print(f'✗ 读不出后端枚举 {枚举名} —— 这一支够不着要验的东西')
        sys.exit(1)
    真值 = set(re.findall(r'=>\s*"([\w.]+)"', m.group(1)))
    f = 根 / 前端路径
    s = f.read_text(encoding='utf-8')
    m2 = re.search(表名 + r'[^=]*=\s*\{(.*?)\n\}', s, re.S)
    if not m2:
        print(f'✗ 读不出前端的 {表名} —— 这一支在空转')
        sys.exit(1)
    表键 = set(re.findall(r'(\w+)\s*:', m2.group(1)))
    查过 += 1
    for k in sorted(真值 - 表键):
        错.append(f'{f.name} 的 {表名} 里没有「{k}」—— 后端给得出它，'
                  f'屏上会原样印出这个英文单词')
    for k in sorted(表键 - 真值 - 额外):
        错.append(f'{f.name} 的 {表名} 里写着「{k}」，而 {枚举名} 里没有这一档 —— '
                  f'这个键永远用不上，多半是拼错了')

if 查过 == 0:
    print('✗ 一张表都没核到 —— 这一支在空转')
    sys.exit(1)
for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'状态说法跟后端枚举对得上 · 查了 {查过} 张表')
sys.exit(1 if 错 else 0)
