#!/usr/bin/env python3
"""村民的「缺」和偏向表的键，两边必须一一对上。

参照数据的源头是 `backend/seed/*.sql`，不是迁移。2026-08-31 把「勤」
改成「勤快」时只补了一条 UPDATE 迁移、没动种子 —— 于是任何一次灌种子
都照着旧词把「勤」原样插回来，偏向表变成 42 行，
而测试里那句「应有 41 行」在合并之后才红。

这一支在种子文件上直接核对，不连库:
  · 每位村民的 lack，偏向表里都得有一行
  · 偏向表里的每个 lack，都得有村民在用（没人用的行是改键留下的尸体）
"""
import re, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
偏向源 = 根 / 'backend/seed/lack_bias.sql'
村民源 = 根 / 'backend/seed/villagers.sql'
for f in (偏向源, 村民源):
    if not f.exists():
        print(f'✗ 找不到 {f.relative_to(根)} —— 这一支够不着要验的东西'); sys.exit(1)

偏向文 = 偏向源.read_text(encoding='utf-8')
偏向 = set(re.findall(r"^\s*\('([^']+)',\s*'(?:move|still|keep|let_go|ask|near|wait)'",
                     偏向文, re.M))
# 行尾注明「保留」的是有意留的占位（例:「放下」——等哪位村民缺它），
# 不是改键留下的尸体。占位要在种子里写清楚，不写就当尸体报。
占位 = set(re.findall(r"^\s*\('([^']+)',[^\n]*保留", 偏向文, re.M))
# lack 是第几列，从 INSERT 的列名单里读 —— 数引号会被 `NULL`
# 这种不带引号的值顶偏一位（第一版就是这么错的，报出来的「缺」是人物简介）。
村民文 = 村民源.read_text(encoding='utf-8')
列 = re.search(r'INSERT INTO villager \(([^)]*)\) VALUES', 村民文)
if not 列:
    print('✗ 读不出 villager 的列名单 —— 这一支够不着要验的东西'); sys.exit(1)
列名 = [c.strip() for c in 列.group(1).split(',')]
第几 = 列名.index('lack')

村民 = {}
for 行 in 村民文.splitlines():
    if not re.match(r"\s*\('[a-z_]+',", 行):
        continue
    # 按逗号切顶层字段:引号里的逗号不算
    字段, 当前, 引号中 = [], '', False
    for i, ch in enumerate(行.strip().lstrip('(').rstrip(',').rstrip(')')):
        if ch == "'":
            引号中 = not 引号中
        if ch == ',' and not 引号中:
            字段.append(当前.strip()); 当前 = ''
        else:
            当前 += ch
    字段.append(当前.strip())
    if len(字段) > 第几:
        村民[字段[0].strip("'")] = 字段[第几].strip().strip("'")

if not 偏向 or not 村民:
    print(f'✗ 解析空转:偏向 {len(偏向)} 个、村民 {len(村民)} 位 —— 这一支在空转'); sys.exit(1)

错 = []
for who, lack in sorted(村民.items()):
    if lack not in 偏向:
        错.append(f'{who} 缺「{lack}」，偏向表里没有这一行 —— 他的签会退回通用口气')
用着 = set(村民.values())
for lack in sorted(偏向 - 用着 - 占位):
    错.append(f'偏向表里的「{lack}」没有村民在用 —— 多半是改键时留下的旧行')

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'缺与偏向对得上 · {len(村民)} 位 · {len(偏向)} 个方向'
      + (f'（其中 {len(占位)} 个是写明保留的占位）' if 占位 else ''))
sys.exit(1 if 错 else 0)
