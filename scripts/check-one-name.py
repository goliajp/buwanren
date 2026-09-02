#!/usr/bin/env python3
"""同一件事，屏上只许有一个名字。

这个仓里反复栽在这上面。已经修过的:
  · 御守 / 护身符   —— 同一枚东西，村主屏叫护身符、确认屏叫御守
  · 回去 / 返回     —— 同一个手势，三十一处对一处
  · 请回村 / 请回家 —— 商品页的眉标压着按钮，两个词
  · 去付 / 去支付   —— 确认屏与列表对订单屏
  · 说明书 / 册子   —— 全 app 叫说明书，退款条款里叫册子
  · 配香 / 调香     —— 同一屏标题「配」副标「调」

每一次都是【改了一处、漏了另一处】，而两个名字读的人得停下来想一想
它们是不是同一件东西 —— 尤其在成交路上（上面六组有四组在那条路上）。

判据:下面每一组里，屏上只许出现【定下来的那一个】。
表要小而准 —— 只放真正指同一件事的，不做近义词猜测:
误报会让人学会忽略这一支，而那比没有这一支更糟。

扫的范围跟别的文案门禁一致 —— wxml 文本 + ts/js 里的中文字面量，
注释不算（注释里讨论旧名字是应该的，这个文件自己就在这么做）。
"""
import re
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
页 = 根 / 'mini/miniprogram/pages'

# （定下来的那个, [不许出现的], 为什么是它）
组 = [
    ('护身符', ['御守'], '中文里现成的词，不用先学一个和风外来词'),
    ('回去',   ['返回'], '三十一处对一处'),
    ('请回村', ['请回家'], '名册、村民页、商品页眉标三处都写「回村」'),
    ('去付',   ['去支付'], '确认屏、订单列表、我的·最近一笔三处都写「去付」'),
    ('说明书', ['册子'],  '商品名就叫「你的说明书」'),
    ('配香',   ['调香'],  '库里她的身份是「配香的姑娘」，商品是「苏合配的那一味」'),
]

注释 = re.compile(r'<!--.*?-->', re.S)
ts注释 = re.compile(r'/\*.*?\*/|//[^\n]*', re.S)

def 屏上的字(f):
    s = f.read_text(encoding='utf-8')
    if f.suffix == '.wxml':
        s = 注释.sub(lambda m: '\n' * m.group(0).count('\n'), s)
        # 只取文本节点与插值之外的字 —— 属性值（class、style）不是屏上的字
        return re.sub(r'<[^>]*>', '\n', s)
    s = ts注释.sub(lambda m: re.sub(r'[^\n]', ' ', m.group(0)), s)
    return '\n'.join(m.group(1) or m.group(2) or ''
                     for m in re.finditer(r"'([^'\n]*)'|\"([^\"\n]*)\"", s))

文件 = sorted(页.glob('*/index.wxml')) + sorted(页.glob('*/index.ts')) \
     + sorted((根 / 'mini/miniprogram/utils').glob('*.ts'))
if len(文件) < 20:
    print(f'✗ 只扫到 {len(文件)} 个文件 —— 这一支够不着要验的东西')
    sys.exit(1)

错, 查过 = [], 0
for f in 文件:
    文 = 屏上的字(f)
    for i, 行 in enumerate(文.split('\n'), 1):
        for 定名, 别名们, 理由 in 组:
            for 别名 in 别名们:
                if 别名 in 行:
                    错.append(f'{f.parent.name}/{f.name} 屏上有「{别名}」—— '
                              f'这件事叫「{定名}」（{理由}）：{行.strip()[:34]}')
    for 定名, _, _ in 组:
        查过 += 文.count(定名)

if 查过 < 10:
    print(f'✗ 定下来的那几个名字一共只出现 {查过} 次 —— 这一支多半在空转')
    sys.exit(1)
for e in dict.fromkeys(错):
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'一件事一个名字 · {len(组)} 组 · 定名共出现 {查过} 次')
sys.exit(1 if 错 else 0)
