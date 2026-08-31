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

# 人称代词，零容忍。四十位村民里男女都有，而屏上这些话对每一位都会显示 ——
# 写死一个「他」，轮到婆婆、白鹭、千鹤那天就是错的；写死「她」，
# 轮到丹增、沈砚也一样。2026-08-31 一次清掉十一处，村民详情屏占八处。
#
# 不留白名单（哪怕苏合确定是女性）：她那一屏写「苏合缺「暖」」比「她缺「暖」」
# 更清楚，而一开口子，下一处就会拿「这个也确定」当理由。
# 名字（{{who.name}}）或者干脆省掉，两条路都比代词好。
代词 = re.compile(r'[他她](?![们])')
# 注释不算 —— 判的是屏上的字
注释 = re.compile(r'<!--.*?-->', re.S)

错 = []
文件 = sorted(页.glob('*/index.wxml'))
if not 文件:
    print('✗ 一个页面都没找到 —— 这支门禁够不着要验的东西，不算通过')
    sys.exit(1)

人称 = []
for f in 文件:
    # 注释换成等量空行 —— 直接删掉的话行号会跟着漂，报出来的位置指不到地方
    s = 注释.sub(lambda m: '\n' * m.group(0).count('\n'), f.read_text(encoding='utf-8'))
    for m in 坏.finditer(s):
        行 = s[:m.start()].count('\n') + 1
        前后 = s[max(0, m.start() - 26):m.end() + 10].replace('\n', ' ')
        错.append(f'{f.relative_to(根)}:{行}　「{前后.strip()}」')
    for m in 代词.finditer(s):
        行 = s[:m.start()].count('\n') + 1
        前后 = s[max(0, m.start() - 20):m.end() + 14].replace('\n', ' ')
        人称.append(f'{f.relative_to(根)}:{行}　「{前后.strip()}」')

if 错:
    print('✗ 屏上拿指代当名字了 —— 第一次看见的人没有上下文：')
    print('\n'.join('    ' + e for e in 错))
    print('\n  这个产品叫【你的说明书】。')
if 人称:
    print('✗ 屏上写死了人称代词 —— 这句话对四十位都会显示，男女都有：')
    print('\n'.join('    ' + e for e in 人称))
    print('\n  用名字（{{who.name}}），或者干脆省掉。')
if 错 or 人称:
    sys.exit(1)
print(f'✓ {len(文件)} 屏都没有拿指代当名字，也没写死人称')
