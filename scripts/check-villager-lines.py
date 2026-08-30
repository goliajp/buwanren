#!/usr/bin/env python3
"""村民台词的规格。

四十位里只有几位开口说话，剩下的在自己屋里一言不发 —— 而「居民是主角」
是这一版的主线。台词一位一位地写（`20260828004_villager_line.sql` 开头
就交代了这条：一次写四十位，写出来的是四十句一个味儿的话）。

这一支守的是【写出来的那几条合不合规格】，不是「写了几位」：

  · 每位恰好四条，seq 是 1..4 —— 少一条会在轮播里露出空当
  · 短。超过 30 个字的不是台词是独白
  · 中文标点全角（项目规则第一条）
  · 结尾不加句号（非正式文本；问号叹号省略号照留）
  · 不许出现术语 —— 台词是这个人在说话，不是在报盘

判据落在迁移文件上，不连库：门禁要在没有 Postgres 的机器上也跑得动。
"""
import re
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
迁移 = 根 / 'backend' / 'migrations'

术语 = ['日主', '用神', '格局', '藏干', '纳音', '印星', '比劫', '身强', '身弱',
        '流年', '大运', '十神', '旺衰']

条 = re.compile(r"\(\s*'([a-z_]+)'\s*,\s*(\d+)\s*,\s*'((?:[^']|'')*)'\s*\)")
错, 人 = [], {}

文件 = sorted(迁移.glob('*villager_line*.sql')) + sorted(迁移.glob('*_lines.sql'))
if not 文件:
    print('✗ 找不到台词迁移 —— 这一支够不着要验的东西，不算通过')
    sys.exit(1)

for f in 文件:
    s = f.read_text(encoding='utf-8')
    # 只看 INSERT 进 villager_line 的那些段
    for 段 in re.findall(r'INSERT INTO villager_line[^;]+;', s, re.S):
        for who, seq, text in 条.findall(段):
            t = text.replace("''", "'")
            人.setdefault(who, {})[int(seq)] = t
            标 = f'{f.name} · {who}#{seq}'
            if len(t) > 30:
                错.append(f'{标} 太长（{len(t)} 字）—— 台词不是独白：{t[:20]}…')
            if re.search(r'[一-龥][,?!;:]|[,?!;:][一-龥]', t):
                错.append(f'{标} 半角标点：{t}')
            if t.endswith('。'):
                错.append(f'{标} 结尾带句号 —— 非正式文本不加：{t}')
            for 词 in 术语:
                if 词 in t:
                    错.append(f'{标} 出现术语「{词}」—— 台词是他在说话，不是报盘：{t}')

for who, 条们 in sorted(人.items()):
    if sorted(条们) != [1, 2, 3, 4]:
        错.append(f'{who} 的 seq 不是 1..4，是 {sorted(条们)} —— 轮播会露空当')

if 错:
    print('\n'.join('✗ ' + e for e in 错))
    sys.exit(1)
print(f'✓ {len(人)} 位的台词都合规格（各四条 · 短 · 全角 · 不报盘）')
