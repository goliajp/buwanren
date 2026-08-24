#!/usr/bin/env python3
"""宅基表核对 —— 表里的每一格都真的对着村子里那栋房子,而且 40 位一个不多一个不少。

这张表有两头要钉:
  ① 对着【画法】—— `rooms/src/engine/plots.js` 里每格的 (x, gy, w) 必须与
     `rooms/src/engine/village.js` 里画那栋房子的那一行是同一组数。
     对不上的症状:门牌挂在空地上、点房子点不到 —— 画面上不报错,人眼也未必看得出。
  ② 对着【后端】—— 已落位 + 未落位 = seed 里那 40 位,不重不漏。
     少一位的症状:那个人永远收集不到,而 n/40 的分母照样是 40。

用法: python3 scripts/check-plots.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLOTS_JS = ROOT / 'rooms/src/engine/plots.js'
VILLAGE_JS = ROOT / 'rooms/src/engine/village.js'
SEED = ROOT / 'backend/seed/villagers.sql'

# 村子里画一栋住宅的那几个函数,以及【怎么把它的参数换算成地面线与宽度】。
#
# 这几个函数的第二个参数含义【不一样】,是这道核对存在的主要理由:
#   building / buildingL  第二参就是地面线
#   houseDome             第二参是墙顶,地面 = y + 52
#   towerRound            第二参是墙顶,地面 = y + 96;而且第三参是【半径】不是宽
#   barn                  第二参是屋顶,地面 = y + 46 + 54
# 第一版表里我照原样抄了参数,结果谷仓的门牌挂到了屋顶上 —— 画面不报错,
# 是渲出来用眼睛看才发现的。所以语义写在这里一处,表里存换算之后的数。
#
# 加了新的画法函数要记得加进来,否则它画出来的房子这道核对看不见。
HOUSE_FNS = {
    'building': dict(dy=0, radius=False),
    'buildingL': dict(dy=0, radius=False),
    'houseDome': dict(dy=52, radius=False),
    'towerRound': dict(dy=96, radius=True),
    'barn': dict(dy=100, radius=False),
}


def village_houses():
    src = VILLAGE_JS.read_text(encoding='utf-8')
    # 只看 renderStatic 里的 —— 别处(比如工具函数的默认值)不是真画在图上
    m = re.search(r'^  function renderStatic\(\)', src, re.M)
    if not m:
        sys.exit('✗ village.js 里找不到 renderStatic —— 结构变了,这道核对已经失效')
    body = src[m.end():]
    nxt = re.search(r'^  function ', body, re.M)
    if nxt:
        body = body[:nxt.start()]
    out = []
    for fn, how in HOUSE_FNS.items():
        for mm in re.finditer(
            r'^\s*' + fn + r'\((-?\d+),\s*(-?\d+),\s*(-?\d+)', body, re.M
        ):
            x, a2_, a3 = (int(mm.group(i)) for i in (1, 2, 3))
            out.append((x, a2_ + how['dy'], a3 * 2 if how['radius'] else a3))
    return out


def block(src, name):
    """取 `const <name> = [ ... ]` 那一段。两段分开解析 ——
    PLOTS 是【绑到手摆的房子上】的,坐标要跟画那一行对得住;
    DISTRICT 是【照表画的】,画法就是照它循环,天然一致,反过来要查的是别的
    (互不重叠、别出画布)。混成一段查,新区那 20 格会被当成「找不到对应的房子」。"""
    m = re.search(r'const ' + name + r' = \[([\s\S]*?)\n  \]', src)
    if not m:
        sys.exit(f'✗ plots.js 里找不到 const {name} —— 这道核对已经失效')
    return m.group(1)


def rows_of(seg):
    return [
        (m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4)))
        for m in re.finditer(
            r"\{\s*id:\s*'([a-z_]+)',\s*x:\s*(-?\d+),\s*gy:\s*(-?\d+),\s*w:\s*(-?\d+)", seg
        )
    ]


def plots():
    src = PLOTS_JS.read_text(encoding='utf-8')
    sited = rows_of(block(src, 'PLOTS'))
    district = rows_of(block(src, 'DISTRICT'))
    return sited, district


def seed_ids():
    lines = SEED.read_text(encoding='utf-8').split('\n')
    i = next((k for k, l in enumerate(lines) if l.startswith('INSERT INTO villager (id,')), None)
    if i is None:
        sys.exit('✗ seed 里找不到 INSERT INTO villager —— 这道核对已经失效')
    out = []
    for l in lines[i + 1:]:
        mm = re.match(r"\s*\('([a-z_]+)',", l)
        if mm:
            out.append(mm.group(1))
        elif l.strip().startswith('('):
            sys.exit(f'✗ seed 有一行解析不了,别把它当成「没有这一位」: {l.strip()[:60]}')
    return out


bad = 0
sited, district = plots()
houses = village_houses()
ids = seed_ids()

if not sited or not district or not houses or not ids:
    print(f'✗ 有一边一条都没解析到（老村 {len(sited)} · 新区 {len(district)} · 房子 {len(houses)} · seed {len(ids)}）')
    print('  查不到东西的核对必须失败，不能报全绿')
    sys.exit(1)

# ① 每一格都对着一栋真房子,且一栋房子只归一格
hset = {}
for h in houses:
    hset[h] = hset.get(h, 0) + 1
for vid, x, gy, w in sited:
    if (x, gy, w) not in hset:
        print(f'✗ {vid} 的宅基 ({x},{gy},{w}) 在村子里没有对应的房子')
        print('   ——门牌会挂在空地上，而画面不会报错')
        bad += 1
taken = {(x, gy, w) for _, x, gy, w in sited}
for h in houses:
    if h not in taken:
        print(f'· 村子里 ({h[0]},{h[1]},{h[2]}) 这栋还没有人住（不算错,但值得看一眼）')

seen = {}
for vid, x, gy, w in sited:
    seen.setdefault((x, gy, w), []).append(vid)
for k, v in seen.items():
    if len(v) > 1:
        print(f'✗ {k} 这栋被 {" ".join(v)} 同时占了')
        bad += 1

# ② 已落位 + 未落位 = seed 的 40 位,不重不漏
table = [v for v, _, _, _ in sited] + [v for v, _, _, _ in district]
dup = {x for x in table if table.count(x) > 1}
if dup:
    print(f'✗ 表里重复: {" ".join(sorted(dup))}')
    bad += 1
missing = [x for x in ids if x not in table]
extra = [x for x in table if x not in ids]
if missing:
    print(f'✗ seed 里有而表里没有（这些人永远收集不到,而分母照样是 {len(ids)}）: {" ".join(missing)}')
    bad += 1
if extra:
    print(f'✗ 表里有而 seed 里没有: {" ".join(extra)}')
    bad += 1

# ③ 新住区那些格互不重叠。老村那 20 栋是手摆的、有意成簇(有一对本来就叠着),
# 不套这条;新区是照表画的,叠了就是表写错了 —— 而画面上只是「两栋挨得近」,
# 点选也还能点到(按门心近的那个算),不查是发现不了的。实际叠过一次:
# kdata 与 xiaoman 叠了 12px,是渲出来放大看才发现的。
byrow = {}
for vid, x, gy, w in district:
    byrow.setdefault(gy // 100, []).append((x, w, vid))
for k in sorted(byrow):
    r = sorted(byrow[k])
    for (x1, w1, v1), (x2, _, v2) in zip(r, r[1:]):
        gap = x2 - (x1 + w1)
        if gap < 8:
            print(f'✗ 新住区 {v1} 与 {v2} 间距 {gap}px' + ('（重叠）' if gap < 0 else '（太挤）'))
            bad += 1
over = [v for v, x, _, w in district if x + w > 704]
if over:
    print(f'✗ 新住区这几格超出画布右边: {" ".join(over)}')
    bad += 1

print()
print(f'老村 {len(sited)} 格(绑到手摆的房子) · 新住区 {len(district)} 格(照表画) · '
      f'合计 {len(sited) + len(district)} · seed {len(ids)} 位')
print('✓ 宅基表对得上' if not bad else f'✗ {bad} 处对不上')
sys.exit(1 if bad else 0)
