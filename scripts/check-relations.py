#!/usr/bin/env python3
"""关系网与碰面对白对得上吗（工序单第 41 步）。

设计册 B10 定了 33 条关系；村子里的碰面对白(`CONVOS`)是「两人走近说的话」。
工序单那一句是：**有关系的人才有专属对白，没关系的只出通用 bark**。
这道核对把那句话变成可查的：

  ① 【硬判】有对白、B10 里却查无此关系 —— 红。
     那等于这段对白自己发明了一段设定，而设定的单一来源是设计册。
     两个人凭空熟络起来，画面上看不出任何异样。

  ② 【只报不判】有关系、还没有对白 —— 印出来。
     台词跟着房间一间一间做，一次凑齐 33 对等于把最要紧的东西做成填空题。
     所以这一栏是【账】不是【红灯】；它的用处是「还差哪些」一眼看得见。

名字→id 走 `backend/seed/villagers.sql`（它由 `scripts/export-cast.py` 从
同一本设计册导出，与 B10 同源）。

用法: python3 scripts/check-relations.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BIBLE = ROOT / 'rooms/src/bible/glue-04.html'
VILLAGE = ROOT / 'rooms/src/engine/village.js'
SEED = ROOT / 'backend/seed/villagers.sql'


def name_to_id():
    out = {}
    lines = SEED.read_text(encoding='utf-8').split('\n')
    i = next((k for k, l in enumerate(lines) if l.startswith('INSERT INTO villager (id,')), None)
    if i is None:
        sys.exit('✗ seed 里找不到 INSERT INTO villager —— 这道核对已经失效')
    for l in lines[i + 1:]:
        m = re.match(r"\s*\('([a-z_]+)',\s*'([^']+)'", l)
        if m:
            out[m.group(2)] = m.group(1)
    return out


def relations():
    """B10 那张 33 行的表：类型 / 双方 / 强度 / 关系描述。"""
    s = BIBLE.read_text(encoding='utf-8')
    # 找不到就明说「已失效」,别让 index() 抛一个 ValueError ——
    # 那种堆栈看不出是核对本身过时了还是设计册坏了
    if 'B10 · 关系网' not in s:
        sys.exit('✗ 设计册里找不到「B10 · 关系网」这一节 —— 改名或搬走了?这道核对已经失效')
    i = s.index('B10 · 关系网')
    best = None
    for m in re.finditer(r'<table[^>]*>(.*?)</table>', s[i:], re.S):
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', m.group(1), re.S)
        head = [re.sub(r'<[^>]+>', '', c).strip()
                for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', rows[0], re.S)]
        if head[:2] == ['类型', '双方'] and len(rows) - 1 > 20:
            best = rows
            break
    if not best:
        sys.exit('✗ 设计册里找不到 B10 那张关系表（类型 / 双方 …，20 行以上）—— 结构变了，这道核对已经失效')
    out = []
    for r in best[1:]:
        cells = [re.sub(r'<[^>]+>', '', c).strip()
                 for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S)]
        if len(cells) < 2:
            continue
        pair = re.split(r'[→↔←]', cells[1])
        if len(pair) != 2:
            continue
        out.append((cells[0], pair[0].strip(), pair[1].strip()))
    return out


def convo_pairs():
    s = VILLAGE.read_text(encoding='utf-8')
    i = s.index('const CONVOS')
    seg = s[i:s.index('\n  ]', i)]
    out = []
    for m in re.finditer(r"\{\s*a:\s*'([a-z_]+)',\s*b:\s*'([a-z_]+)'", seg):
        out.append((m.group(1), m.group(2)))
    return out


n2i = name_to_id()
rels = relations()
convos = convo_pairs()
if not rels or not convos or not n2i:
    print(f'✗ 有一边一条都没解析到（关系 {len(rels)} · 对白 {len(convos)} · 名册 {len(n2i)}）')
    print('  查不到东西的核对必须失败，不能报全绿')
    sys.exit(1)

# 关系是【无向】的:对白里谁先开口不重要,B10 的箭头表示的是方向不是限制
rel_set = set()
unknown_names = []
for kind, a, b in rels:
    ia, ib = n2i.get(a), n2i.get(b)
    if not ia or not ib:
        unknown_names.append((a if not ia else b))
        continue
    rel_set.add(frozenset((ia, ib)))

bad = 0
if unknown_names:
    print(f'✗ B10 里这些名字在名册里查无此人: {" ".join(sorted(set(unknown_names)))}')
    print('  名字写错了，还是名册没导出？两边同源，不该对不上')
    bad += 1

# 背景村民不在此列。村子里走动的除了不完人,还有一批通用贴图的路人(villm 之类),
# 他们之间、以及他们与不完人的闲聊【本来就不该】出现在 B10 里 ——
# B10 记的是四十位不完人之间的关系,不是村里所有人的社交图。
# 但也不能默默滤掉:滤掉的话,哪天真把一位不完人的 id 写错成路人贴图,
# 这道核对会把它当路人放过去。所以单独报一行数。
CAST = set(n2i.values())
extras = [(a, b) for a, b in convos if a not in CAST or b not in CAST]
named = [(a, b) for a, b in convos if a in CAST and b in CAST]

# ① 硬判:两位【不完人】之间有对白、B10 里却没这条关系
orphan = {}
for a, b in named:
    if a == b:
        orphan[(a, b)] = orphan.get((a, b), 0) + 1
        continue
    if frozenset((a, b)) not in rel_set:
        orphan[tuple(sorted((a, b)))] = orphan.get(tuple(sorted((a, b))), 0) + 1
if orphan:
    i2n = {v: k for k, v in n2i.items()}
    print('✗ 这些不完人之间有专属对白，B10 里却查无关系：')
    for (a, b), n in orphan.items():
        same = '（跟自己？）' if a == b else ''
        print(f'    {i2n.get(a, a)} × {i2n.get(b, b)}{same}　{n} 段')
    print('  「有关系的人才有专属对白」—— 没关系却熟络起来，等于对白自己发明了设定，')
    print('  而设定的单一来源是设计册。要么补进 B10，要么这几段不该存在')
    bad += 1

# ② 只报不判:有关系、还没有对白
have = {frozenset(p) for p in named}
todo = [(k, a, b) for k, a, b in rels
        if n2i.get(a) and n2i.get(b) and frozenset((n2i[a], n2i[b])) not in have]
covered = len(rels) - len(todo) - len(unknown_names)

print()
print(f'B10 关系 {len(rels)} 条 · 已有专属对白 {covered} 条 · 还没有 {len(todo)} 条')
print(f'碰面对白 {len(convos)} 段：不完人之间 {len(named)} 段 · 与背景村民 {len(extras)} 段')
if todo:
    print('  还没有对白的（不算错 —— 台词跟着房间一间一间做，不一次凑齐）：')
    for kind, a, b in todo[:40]:
        print(f'    {kind}　{a} × {b}')

print()
print('✓ 对白都长在真实关系上' if not bad else f'✗ {bad} 处对不上')
sys.exit(1 if bad else 0)
