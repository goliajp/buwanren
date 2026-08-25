#!/usr/bin/env python3
"""宅基表核对 —— 四十位一个不多一个不少，每一格都画得出来、点得到。

2026-08-25 重排之后这道核对换了守的东西。

**原来守的是「两份来源要对得上」**：老村那 20 栋是手摆在 village.js 里的，
plots.js 只是它的一份影子，两边对不上时门牌就挂到空地上。
重排把四十栋全部改成照表画 —— **只剩一份来源**，那条不变式自然消失。

**现在守四条**，每一条都对应一种【不报错的坏法】：

  ① 四十位对得上后端 seed（不重不漏）
     少一位的症状：那个人永远收集不到，而 n/40 的分母照样是 40。

  ② 每格都在画布里
     出界的房子画得出来但看不见 —— 那一位就等于不存在。

  ③ 一格一个人（row/col 不重）
     两个人同一格时，后画的盖住前画的，点下去永远是同一个人。

  ④ 表里每个 kind，画的那一侧都认得
     village.js 的 drawHouse 是 if/else 链，**末尾那个 else 会把不认识的
     kind 默默画成普通民居** —— 塔画成平房，而画面不报错。

用法: python3 scripts/check-plots.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLOTS_JS = ROOT / 'rooms/src/engine/plots.js'
VILLAGE_JS = ROOT / 'rooms/src/engine/village.js'
SEED = ROOT / 'backend/seed/villagers.sql'

WORLD_W, WORLD_H = 704, 960


def table():
    """读 plots.js 的表。坐标由 row/col 算，这里照同一套算法还原。"""
    src = PLOTS_JS.read_text(encoding='utf-8')

    def one(pat, what):
        """读不到就直接判这道核对失效。

           坐标是**这里自己照 plots.js 那套算法还原**的 —— 定义挪走而读不到时,
           四十行照样解析得出来,于是它会报一屏「✓ 40 格」,
           量的却是凭空算出来的坐标,不是画上那四十栋。"""
        m = re.search(pat, src)
        if not m:
            sys.exit(f'✗ plots.js 里找不到 {what} —— 坐标没法还原，这道核对已经失效')
        return m.group(1)

    gy = [int(v) for v in one(r'ROW_GY = \[([^\]]+)\]', 'ROW_GY').split(',')]
    cx = [int(v) for v in one(r'COL_CX = \[([^\]]+)\]', 'COL_CX').split(',')]
    stag = int(one(r'STAGGER = (\d+)', 'STAGGER'))
    out = []
    for m in re.finditer(r"\{ id: '([a-z_]+)', row: (\d+), col: (\d+), w: (\d+), kind: '(\w+)'", src):
        i, r, c, w, k = m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4)), m.group(5)
        x = round(cx[c] + (stag if r % 2 else -stag) - w / 2)
        out.append(dict(id=i, row=r, col=c, w=w, kind=k, x=x, gy=gy[r]))
    return out


def seed_ids():
    """只读 villager 那张表 —— seed 里还有术数等别的表，
       不定位到表头的话会把 bazi / tarot 这些也当成村民（第一版正是这么错的）。"""
    lines = SEED.read_text(encoding='utf-8').split('\n')
    i = next((k for k, l in enumerate(lines) if l.startswith('INSERT INTO villager (id,')), None)
    if i is None:
        sys.exit('✗ seed 里找不到 INSERT INTO villager —— 这道核对已经失效')
    out = []
    for l in lines[i + 1:]:
        m = re.match(r"\s*\('([a-z_]+)',", l)
        if m:
            out.append(m.group(1))
        elif l.strip().startswith('('):
            sys.exit(f'✗ seed 有一行解析不了，别把它当成「没有这一位」：{l.strip()[:60]}')
        elif l.strip().startswith('INSERT INTO'):
            break
    return out


def drawn_kinds():
    """drawHouse 那条 if/else 链认得哪些 kind。"""
    src = VILLAGE_JS.read_text(encoding='utf-8')
    m = re.search(r'function drawHouse\(q\) \{(.*?)\n    \}', src, re.S)
    if not m:
        sys.exit('✗ village.js 里找不到 drawHouse —— 结构变了，这道核对已经失效')
    return set(re.findall(r"q\.kind === '(\w+)'", m.group(1)))


def main():
    T = table()
    bad = 0

    if not T:
        sys.exit('✗ plots.js 里读不出表 —— 结构变了，这道核对已经失效')

    # ① 对后端
    seed = seed_ids()
    tids, sids = {p['id'] for p in T}, set(seed)
    for i in sorted(sids - tids):
        print(f'✗ seed 里有 {i}，表里没有 —— 这一位永远收集不到')
        bad += 1
    for i in sorted(tids - sids):
        print(f'✗ 表里有 {i}，seed 里没有 —— 画得出房子，后端不认这个人')
        bad += 1
    if len(T) != len(seed):
        print(f'✗ 表 {len(T)} 格 vs seed {len(seed)} 位')
        bad += 1

    # ② 在画布里
    for p in T:
        if p['x'] < 0 or p['x'] + p['w'] > WORLD_W or p['gy'] < 40 or p['gy'] > WORLD_H:
            print(f"✗ {p['id']} 出界：x {p['x']}..{p['x'] + p['w']} gy {p['gy']}"
                  f"（画布 {WORLD_W} × {WORLD_H}）")
            bad += 1

    # ③ 一格一个人
    seen = {}
    for p in T:
        k = (p['row'], p['col'])
        if k in seen:
            print(f"✗ 第 {p['row']} 排第 {p['col']} 格住了两个人：{seen[k]} 与 {p['id']}")
            bad += 1
        seen[k] = p['id']

    # ④ 画的那一侧认得每个 kind
    known = drawn_kinds()
    for k in sorted({p['kind'] for p in T}):
        if k == 'bld':
            continue          # 末尾的 else 就是它
        if k not in known:
            who = [p['id'] for p in T if p['kind'] == k]
            print(f"✗ kind '{k}' drawHouse 不认得（{', '.join(who)}）"
                  f" —— 末尾那个 else 会把它默默画成普通民居")
            bad += 1

    print(f"{'✗' if bad else '✓'} 宅基表 {len(T)} 格 · 八排 × 五格 · "
          f"kind {len({p['kind'] for p in T})} 种 · 问题 {bad} 处")
    sys.exit(1 if bad else 0)


main()
