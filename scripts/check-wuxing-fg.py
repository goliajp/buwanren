#!/usr/bin/env python3
"""五行色：文字用 -fg，底色用 -bg，别混。

设计里每一行五行色有两个版本：`--wx-jin` 这类是【底色】，
`--wx-jin-fg` 是同一色系里给【文字】用的深色。金 #8FA4C4、水 #4FA8E8
摆在纸色底上对比度只有 2.5:1 上下 —— 而「你缺的是「金」」里那个字
是那一屏最重要的一个字，看不清就等于没说。

药丸（`.pill.*`）一直用的是 -fg；`.wx-*` 那一套却落在底色版上，
于是同一个「金」在药丸里看得清、在标题里看不清。

判据：`color:` 后面不许直接跟 `var(--wx-<行>)`（不带 -fg）。
`background:` 与 `border-color:` 用底色版是对的，不管 —— 那是面和线，不是字。
"""
import re
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
行 = ('mu', 'huo', 'tu', 'jin', 'shui')

# color: var(--wx-jin)  ✗      color: var(--wx-jin-fg)  ✓
# 前面必须【不是】别的属性的一部分 —— `border-color` / `outline-color`
# 用底色版是对的（那是线，不是字）。头一版没排除它，一上来报了 5 处
# 假阳性，而假阳性会让人开始无视门禁。
坏 = re.compile(r'(?<![-\w])color\s*:\s*var\(\s*--wx-(' + '|'.join(行) + r')\s*\)')

错 = []
文件 = sorted((根 / 'mini/miniprogram').rglob('*.wxss'))
if not 文件:
    print('✗ 一个 wxss 都没找到 —— 这支门禁够不着要验的东西，不算通过')
    sys.exit(1)

for f in 文件:
    s = f.read_text(encoding='utf-8')
    for m in 坏.finditer(s):
        行号 = s[:m.start()].count('\n') + 1
        错.append(f'{f.relative_to(根)}:{行号}　{m.group(0)} —— 文字要用 --wx-{m.group(1)}-fg')

if 错:
    print('✗ 五行色用错了版本（底色版当文字色）：')
    print('\n'.join('    ' + e for e in 错))
    sys.exit(1)
print(f'✓ {len(文件)} 个 wxss 里，五行色文字都用的 -fg')
