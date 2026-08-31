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

# 屏上的字不只在 wxml 里 —— 商品名、SKU 名、村民台词都在库里，
# 由迁移文件写进去。「她按你八字单配」就是这么漏过去的:
# 界面门禁扫不到它，只有人眼看截图才发现。
迁移 = sorted((根 / 'backend/migrations').glob('*.sql'))
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

# 迁移里的中文字面量:只看单引号里的串，SQL 注释与列名不算。
#
# 【历史迁移不能改】（有「迁移没被改过」那一支盯着），所以一句话
# 写错了只能靠新迁移 UPDATE 掉。也就是说不能盯着历史字面量报错 ——
# 那一行永远在那儿。判据是【这句话后来有没有被改掉】:
# 按文件名顺序往后找，有哪条迁移把这个串换成了别的，就算已经修过。
串 = re.compile(r"'([^']*[一-龥][^']*)'")
坏串 = []                                  # (文件, 行号, 串)
for f in 迁移:
    for i, 行 in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
        if 行.lstrip().startswith('--'):
            continue                      # 注释里讨论代词是允许的
        for m in 串.finditer(行):
            if 代词.search(m.group(1)):
                坏串.append((f, i, m.group(1)))

# 判「这句话今天还在不在库里」：后面有没有哪条迁移把它 UPDATE 掉。
# 判据是【那句话出现在 UPDATE 语句里、且不是作为新值】——
# 也就是说有人明确处理过它。历史迁移改不得，所以这是唯一的修法，
# 门禁必须认得这种修法，否则改完了它还一直红。
处理过 = set()
for f in 迁移:
    文 = f.read_text(encoding='utf-8')
    for 段 in re.findall(r'UPDATE\b.*?;', 文, re.S | re.I):
        for m in 串.finditer(段):
            句 = m.group(1)
            # 出现在 WHERE 里 = 拿它当条件找出来改掉;出现在 SET 里 = 它是新值
            后半 = 段[段.lower().find('set'):]
            if 代词.search(句) and (句 not in 后半 or 'WHERE' in 段.upper()):
                处理过.add(句)
    # 同一条迁移里换掉某个 code 的 name，也算处理过那个位置
    for m in re.finditer(r"UPDATE\s+(\w+)\s+SET\s+name\s*=\s*'([^']*)'\s*WHERE\s+code\s*=\s*'([^']*)'", 文, re.I):
        处理过.add(('code', m.group(3)))

for f, i, 句 in 坏串:
    if 句 in 处理过:
        continue
    # 这句话所在那一行若带着 code，看那个 code 有没有被后来的迁移改过 name
    码 = re.findall(r"'(\w+)'", f.read_text(encoding='utf-8').splitlines()[i - 1])
    if any(('code', c) in 处理过 for c in 码):
        continue
    人称.append(f'{f.relative_to(根)}:{i}　「{句[:30]}」')

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
