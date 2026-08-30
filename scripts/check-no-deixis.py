#!/usr/bin/env python3
"""屏上不许用【指代】当名字。

「那一份」曾经是这个付费产品在屏上的全部说法：「看完整的那一份」
「读你的那一份」。术语清干净之后留下的这个空位，用一个指代填上了 ——
而指代要有上下文才成立，第一次看见它的人没有上下文，于是它什么都没说。
（2026-08-31 用户指出：「那一份是什么鬼，这么晦涩的名字肯定有问题」。）

它有名字：**你的说明书**。

判据：界面文案里，这几个指代不许单独充当一件东西的名字。
带上下文的指代是好中文，所以只查【它后面没有紧跟着名词】的那种：
  「在用的那一份生辰」  ✓ 有上下文
  「读你的那一份」      ✗ 指代当名字使
"""
import re
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
页 = 根 / 'mini/miniprogram/pages'

# 「那一份 / 这一份」后面若不是名词而是标点、引号、行尾，就是拿它当名字。
坏 = re.compile(r'[那这]一份(?![一-龥])')
# 注释不算 —— 判的是屏上的字
注释 = re.compile(r'<!--.*?-->', re.S)

错 = []
文件 = sorted(页.glob('*/index.wxml'))
if not 文件:
    print('✗ 一个页面都没找到 —— 这支门禁够不着要验的东西，不算通过')
    sys.exit(1)

for f in 文件:
    s = 注释.sub('', f.read_text(encoding='utf-8'))
    for m in 坏.finditer(s):
        行 = s[:m.start()].count('\n') + 1
        前后 = s[max(0, m.start() - 26):m.end() + 10].replace('\n', ' ')
        错.append(f'{f.relative_to(根)}:{行}　「{前后.strip()}」')

if 错:
    print('✗ 屏上拿指代当名字了 —— 第一次看见的人没有上下文：')
    print('\n'.join('    ' + e for e in 错))
    print('\n  这个产品叫【你的说明书】。')
    sys.exit(1)
print(f'✓ {len(文件)} 屏都没有拿指代当名字')
