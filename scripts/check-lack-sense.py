#!/usr/bin/env python3
"""「缺 X」说的是村民自己缺 X，不是他能补你什么。

这是「不完人」这个名字的来处，也是 `lack_bias` 表写着的事：
  勤 → 「缺勤的人最懂拖延的代价，所以催你起身」
  急 → 「缺的是急不来的那份耐性，反过来劝你缓一缓」

请人回来那一屏曾经把它说成「右边两个字是他补你哪一样」——
一句话就把村民从「也缺着一样东西的人」变成了「补你短板的工具」，
产品最好的那个想法当场没了。而两屏各说各的，谁也不会红。
"""
import re, sys, pathlib

# 把村民写成「给你补短板的工具」的各种说法。
# 「补你哪一样」是第一次抓到的写法；「跟你补得上」躲过了它 ——
# 同一个意思换个语序就漏了，所以判的是「补」跟「你」在一句话里凑到一起。
反向 = re.compile(r'补你|补上你|补齐你|填补你|把你补|跟你补|与你补|你补得|补得上你')
界面 = list(pathlib.Path('mini/miniprogram').rglob('*.wxml')) \
      + list(pathlib.Path('mini/miniprogram').rglob('*.ts'))
错 = []
块注释 = re.compile(r'<!--.*?-->|/\*.*?\*/', re.S)
for f in 界面:
    # 跨行注释整段抹掉（换成等量空行，行号才不漂）——
    # 这几处正是在注释里【讨论】这个错误说法本身，不该报它们
    源 = 块注释.sub(lambda m: '\n' * m.group(0).count('\n'), f.read_text(encoding='utf-8'))
    for i, 行 in enumerate(源.splitlines(), 1):
        if 行.lstrip().startswith(('*', '//', '<!--')):
            continue                      # 单行注释同理
        m = 反向.search(行)
        if m:
            错.append(f'{f}:{i}　「{m.group(0)}」—— 村民缺的是他自己的，不是拿来补你的')

if not 界面:
    print('✗ 一个界面文件都没扫到 —— 检查器自己失效了'); sys.exit(1)
for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'「缺」说的是谁 · 扫了 {len(界面)} 个界面文件')
sys.exit(1 if 错 else 0)
