#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把设计册里的村民表与术数表导成后端 seed。

40 位不完人的「流派 / 缺 / 说话风格」这些数据,单一来源是 `rooms/design.html`
里那两张表 —— 那是设计的地方,也该是唯一改它的地方。后端要用,就从那里导,
**不要在库里另抄一份**:抄了就有两份会漂移的真相,而这个项目已经在
「同一物体两份绘制」上栽过。

产出 `backend/seed/villagers.sql`,幂等(ON CONFLICT DO UPDATE),可反复跑。

用法:python3 scripts/export-cast.py [design.html] [输出.sql]
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'rooms' / 'design.html'
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'backend' / 'seed' / 'villagers.sql'


def rows_of_table_containing(html, needle, raw=False):
    """取包含 needle 的那张表的所有行。raw=True 保留格内标签。

    名号那一格是 `<b>米拉</b><span>拉琴的吉普赛人</span>` —— 先去标签就粘成
    「米拉拉琴的吉普赛人」,再也切不开了。要切的调用方拿 raw。
    """
    i = html.index(needle)
    tb = html.rindex('<table', 0, i)
    te = html.index('</table>', i)
    out = []
    for m in re.finditer(r'<tr[^>]*>(.*?)</tr>', html[tb:te], re.S):
        cells = [c if raw else re.sub(r'<[^>]+>', '', c).strip()
                 for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', m.group(1), re.S)]
        if cells:
            out.append(cells)
    return out


def split_name(cell_html):
    """`<b>米拉</b><span>拉琴的吉普赛人</span>` → ('米拉', '拉琴的吉普赛人')"""
    b = re.search(r'<b[^>]*>(.*?)</b>', cell_html, re.S)
    sp = re.search(r'<span[^>]*>(.*?)</span>', cell_html, re.S)
    strip = lambda x: re.sub(r'<[^>]+>', '', x).strip() if x else None
    name = strip(b.group(1)) if b else re.sub(r'<[^>]+>', '', cell_html).strip()
    return name, strip(sp.group(1)) if sp else None


def sq(v):
    """SQL 字符串字面量。None → NULL。"""
    if v is None or v == '':
        return 'NULL'
    return "'" + str(v).replace("'", "''") + "'"


def main():
    html = SRC.read_text(encoding='utf-8')

    # ── 术数表:修习 | 流派 | 要义 | 修习者 | KEY
    arts = rows_of_table_containing(html, '大小阿卡纳')
    assert arts[0][4] == 'KEY', f'术数表表头变了:{arts[0]}'
    arts = [r for r in arts[1:] if len(r) == 5 and re.fullmatch(r'[a-z][a-z0-9_]*', r[4])]

    # ── 村民表:ID | 名·号 | 流派 | 出身 | 性格 | 缺 | 背景 | 关键经历 | 说话风格 | 稀有 | 状态
    cast = rows_of_table_containing(html, '>mira<', raw=True)
    head = [re.sub(r'<[^>]+>', '', c).strip() for c in cast[0]]
    want = ['ID', '名 · 号', '流派', '出身', '性格', '缺', '背景', '关键经历', '说话风格', '稀有', '状态']
    assert head == want, f'村民表表头变了:\n  期望 {want}\n  实际 {head}'
    cast = [[re.sub(r'<[^>]+>', '', c).strip() if n != 1 else c for n, c in enumerate(r)]
            for r in cast[1:]]
    cast = [r for r in cast if len(r) == 11 and re.fullmatch(r'[a-z][a-z0-9_]*', r[0])]

    # 表头对得上不等于内容对得上 —— 数量掉了要立刻知道,不能静静导出一半
    assert len(cast) == 40, f'村民应有 40 位,实际 {len(cast)}'
    assert len(arts) == 35, f'术数应有 35 门,实际 {len(arts)}'

    key_of = {a[1]: a[4] for a in arts}          # 流派中文名 → key

    lines = [
        '-- 由 scripts/export-cast.py 从 rooms/design.html 生成,不要手改。',
        '-- 改村民数据请改设计册那两张表,然后重跑导出。',
        f'-- 村民 {len(cast)} 位 · 术数 {len(arts)} 门',
        '',
        'INSERT INTO art (key, name, essence) VALUES',
    ]
    lines.append(',\n'.join(
        f'  ({sq(a[4])}, {sq(a[1])}, {sq(a[2])})' for a in arts
    ) + '\nON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, essence = EXCLUDED.essence;')
    lines.append('')
    lines.append('INSERT INTO villager (id, name, title, art_key, arts_extra, origin, personality, lack, background, milestone, voice, rarity) VALUES')

    vals, unmapped = [], []
    for r in cast:
        vid, name_cell, art_raw, origin, personality, lack, background, milestone, voice, rarity, _status = r
        name, title = split_name(name_cell)
        # 「塔罗　水晶球」这种一人多门:第一门算主修,其余原样留档
        parts = [p for p in re.split(r'[　\s、/]+', art_raw) if p]
        primary = parts[0] if parts else ''
        # 「—」是无名的设定:他没有术数。村里永远留着空屋,等还没被找回的人 ——
        # 这一位就是那间空屋本身,不该被当成数据缺失。
        key = None if primary in ('—', '-', '') else key_of.get(primary)
        if key is None and primary not in ('—', '-', ''):
            unmapped.append((vid, art_raw))
        extra = '、'.join(parts[1:]) if len(parts) > 1 else None
        vals.append(
            f'  ({sq(vid)}, {sq(name)}, {sq(title)}, {sq(key)}, {sq(extra)}, {sq(origin)}, {sq(personality)}, '
            f'{sq(lack)}, {sq(background)}, {sq(milestone)}, {sq(voice)}, {sq(rarity)})'
        )

    if unmapped:
        print('✗ 这些村民的流派在术数表里查不到 key:', file=sys.stderr)
        for vid, a in unmapped:
            print(f'    {vid}: {a!r}', file=sys.stderr)
        sys.exit(1)

    lines.append(',\n'.join(vals) + '''
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, title = EXCLUDED.title, art_key = EXCLUDED.art_key, arts_extra = EXCLUDED.arts_extra,
  origin = EXCLUDED.origin, personality = EXCLUDED.personality, lack = EXCLUDED.lack,
  background = EXCLUDED.background, milestone = EXCLUDED.milestone,
  voice = EXCLUDED.voice, rarity = EXCLUDED.rarity;''')

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'✓ {OUT.relative_to(ROOT)}  村民 {len(cast)} 位 · 术数 {len(arts)} 门')

    # 同门不同人是这套设计的核心(「术数会重叠,但缺不同,说的话就不同」),
    # 报一下有多少门被多人同修 —— 掉到 0 说明导出或设计出了问题
    from collections import Counter
    c = Counter(r[2].split('　')[0] for r in cast)
    shared = {k: n for k, n in c.items() if n > 1}
    print(f'  被多人同修的门:{len(shared)} —— ' + '、'.join(f'{k}×{n}' for k, n in sorted(shared.items(), key=lambda x: -x[1])[:6]))


if __name__ == '__main__':
    main()
