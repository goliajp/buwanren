#!/usr/bin/env python3
"""房间里那颗按钮写的动作，得是这个人真会的那一门。

上一轮把行话（「起一课」「排个盘」）换成「看得见的动作」时对错了人：
婆婆的术是塔罗，按钮却写「看水晶球」；桃桃是奇门遁甲，写的是「翻张牌」——
翻牌是塔罗的动作。两个人的活儿串了，而两边都能跑、都不会红。

判据：每一门术有它自己的动作词，按钮里必须出现其中之一。
词表按「这一门在屏幕上做什么」写，不写行话本身 ——
行话不许上按钮，那是另一支门禁管的事。
"""
import re, sys, pathlib, subprocess

根 = pathlib.Path(__file__).resolve().parent.parent

# 一门术 → 它在屏幕上的动作（按钮里出现任意一个就算对上）
动作 = {
    '塔罗':     ['翻牌', '翻张牌', '抽牌'],
    '奇门遁甲': ['摆盘', '摆个盘', '起局', '排局'],
    '大六壬':   ['掐指', '掐指算'],
    '紫微斗数': ['看星', '星星', '看看星'],
    '梅花易数': ['拆字', '拆个字'],
    '藏历密算': ['念珠', '拨念珠', '拨拨念珠'],
    '水晶球':   ['看水晶球', '水晶球'],
}

# 谁会哪一门 —— 从种子读，不连库
种 = (根 / 'backend/seed/villagers.sql').read_text(encoding='utf-8')
段 = re.search(r'INSERT INTO villager \((.*?)\) VALUES(.*?);', 种, re.S)
if not 段:
    print('✗ 读不出 villager 那一段'); sys.exit(1)
列名 = [c.strip() for c in 段.group(1).split(',')]
i名, i术 = 列名.index('name'), 列名.index('art_key')
术表 = {}
for 行 in 段.group(2).splitlines():
    if not re.match(r"\s*\('[a-z_]+',", 行):
        continue
    值, 当前, 引 = [], '', False
    for ch in 行.strip().lstrip('(').rstrip(',').rstrip(')'):
        if ch == "'": 引 = not 引
        if ch == ',' and not 引: 值.append(当前.strip()); 当前 = ''
        else: 当前 += ch
    值.append(当前.strip())
    if len(值) > max(i名, i术):
        术表[值[i名].strip("'")] = 值[i术].strip("'")

# art_key → 中文名
艺 = dict(re.findall(r"\('([a-z_]+)',\s*'([^']+)'", 
        (根 / 'backend/seed/villagers.sql').read_text(encoding='utf-8')))

错, 查过 = [], 0
for f in sorted((根 / 'rooms/src/rooms').glob('*.js')):
    源 = f.read_text(encoding='utf-8')
    for m in re.finditer(r"labels: \['(请[^']+)'", 源):
        按钮 = m.group(1)
        # 「请婆婆翻张牌」→ 名字是紧跟「请」后面的那一段
        名 = next((n for n in 术表 if 按钮.startswith('请' + n)), None)
        if not 名:
            continue
        术键 = 术表[名]
        术名 = 艺.get(术键, 术键)
        查过 += 1
        词 = 动作.get(术名)
        if 词 is None:
            错.append(f'{名} 的术「{术名}」没写进动作词表 —— 补上，或者说清它的动作是什么')
        elif not any(w in 按钮 for w in 词):
            错.append(f'{名} 会的是「{术名}」，按钮却写「{按钮}」'
                      f' —— 那不是这一门的动作（该是 {" / ".join(词[:2])}）')

if 查过 == 0:
    print('✗ 一颗表演按钮都没查到 —— 这一支在空转'); sys.exit(1)
for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'按钮上的动作对得上那个人的术 · 查了 {查过} 颗')
sys.exit(1 if 错 else 0)
