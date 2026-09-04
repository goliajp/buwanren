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

# 【每一张这种表都要在名单里】。第一版只列了 `物流说法`，
# 而同一个形状的第二张 —— `状态说法`（utils/money.ts，对 OrderStatus）——
# 铺在订单页、订单列表、「我的」三块屏上，同样是 `表[status] || status`
# 兜底，一支门禁都没核过。今天九个键恰好对得上，所以看不出来;
# OrderStatus 加一档，三块屏同时开始印英文原文，而这一支照样打 ✓
# 并说「查了 1 张表」——「1」这个数没人会去对
# （2026-09-01 五路评审 · 工程审计）。
对 = [
    ('ShipmentStatus', 'mini/miniprogram/utils/ship.ts', '物流说法',
     # 轨迹里承运商推来的那几种不在枚举里，表里允许多出来
     {'departed', 'arrived_at_sort_facility', 'failed_delivery', 'unknown'}),
    ('OrderStatus', 'mini/miniprogram/utils/money.ts', '状态说法', set()),
    # 订着的那一屏（2026-09-05）。七种状态原先一档中文都没有 ——
    # 那一支从来没有一位真的订着的人走过，于是屏上打的是 `active`
    ('SubscriptionStatus', 'mini/miniprogram/pages/subs/index.ts', '状态说法', set()),
    # 承运商代号。它不是枚举 —— 按区列在 region.rs 的 `carriers:` 里
    ('carriers@region', 'mini/miniprogram/pages/order/index.ts', '快递说法',
     # 后台手填单号、没挑承运商的那一档，不属于任何一个区
     {'manual'}),
]
枚举源 = (根 / 'backend/unmei-domain/src/commerce/enums.rs').read_text(encoding='utf-8')


def 后端真值(名: str) -> set:
    """这一列的真值从哪儿来。

    多数是 `enums.rs` 里的 `str_enum!`。承运商代号是例外:
    它不是枚举，按区列在 `region.rs` 的 `carriers:` 里，六个区各一串。
    """
    if 名 == 'carriers@region':
        src = (根 / 'backend/unmei-domain/src/commerce/region.rs').read_text(encoding='utf-8')
        出 = set()
        for 一串 in re.findall(r'carriers:\s*&\[(.*?)\]', src, re.S):
            出 |= set(re.findall(r'"([\w.]+)"', 一串))
        return 出
    m = re.search(r'str_enum!\(' + 名 + r'\s*\{(.*?)\}\)', 枚举源, re.S)
    return set(re.findall(r'=>\s*"([\w.]+)"', m.group(1))) if m else set()

for 枚举名, 前端路径, 表名, 额外 in 对:
    真值 = 后端真值(枚举名)
    if not 真值:
        print(f'✗ 读不出后端的 {枚举名} —— 这一支够不着要验的东西')
        sys.exit(1)
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
# 【别漏表】。判据是:凡是「中文说法表 + `表[x] || x` 兜底」这个形状的，
# 都得在上面的名单里。靠 grep 找出所有 `Record<string, string>` 的说法表，
# 名单少了就报 —— 计数「查了 N 张」读起来像满覆盖，那是这一支的老毛病。
候选 = set()
for f in sorted((根 / 'mini/miniprogram').rglob('*.ts')):
    src = f.read_text(encoding='utf-8')
    for 名 in re.findall(r'(?:const|export const)\s+([\u4e00-\u9fa5\w]+)\s*:\s*Record<string,\s*string>', src):
        if 名.endswith('说法'):
            候选.add((str(f.relative_to(根)), 名))
名单 = {(路, 名) for _, 路, 名, _ in 对}
漏 = 候选 - 名单
if 漏:
    for 路, 名 in sorted(漏):
        print(f'  ✗ {路} 里的 `{名}` 是同一个形状的说法表，却不在这一支的名单里')
    print(f'✗ 说法表漏了 {len(漏)} 张 —— 「查了 {查过} 张」读起来像满覆盖')
    sys.exit(1)
for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'状态说法跟后端枚举对得上 · 查了 {查过} 张表')
sys.exit(1 if 错 else 0)
