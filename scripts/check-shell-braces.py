#!/usr/bin/env python3
"""shell 里 `$变量` 后面紧跟全角字符，必须加花括号。

【这个仓踩到第三次了】。macOS 自带的是 bash 3.2，它在
`"…（$ord）"` 这种写法里会把后面那个全角字符**算进变量名**，
于是 `set -u` 下当场 `ord）: unbound variable`。

三次的位置一次比一次刁：

  · `$MINGLI_PORT）`   e2e.sh，起服务那一段
  · `$OWNER）`         gates.sh，捡锁那一句
  · `$ord）`           plan25.sh，2026-09-07 新写的付款辅助

它们的共同点是**都在出错的那一支上** —— 也就是说，只有在别的东西
已经坏了的时候才会被执行到，而那时它把一句本来说得清的报错
换成了一句 `unbound variable`。指错方向的失败比失败本身更贵。

判据：`$NAME` 紧跟一个非 ASCII 字符。`${NAME}` 不算，
单引号里的不算（那不展开）。
"""
import pathlib
import re
import sys

根 = pathlib.Path(__file__).resolve().parent.parent
坏 = re.compile(r'\$[A-Za-z_][A-Za-z0-9_]*(?=[^\x00-\x7f])')
错 = []
扫过 = 0

for f in sorted(list((根 / 'scripts').glob('*.sh')) + list((根 / 'web').glob('*.sh'))):
    扫过 += 1
    for n, 行 in enumerate(f.read_text(encoding='utf-8').split('\n'), 1):
        # 注释里讨论这件事是允许的 —— 上面那段文档就在讨论它
        裸 = 行.strip()
        if 裸.startswith('#'):
            continue
        for m in 坏.finditer(行):
            错.append(f'{f.relative_to(根)}:{n}　`{m.group(0)}` 后面紧跟全角字符 —— '
                      f'bash 3.2 会把它算进变量名，写成 `${{{m.group(0)[1:]}}}`')

if 扫过 < 5:
    print(f'✗ 只扫到 {扫过} 个 .sh —— 目录搬过家而这一支没跟上')
    sys.exit(1)
if 错:
    print('✗ shell 变量后面紧跟全角字符：')
    print('\n'.join('    ' + e for e in 错))
    sys.exit(1)
print(f'✓ {扫过} 个 shell 脚本，$变量 后面跟全角的都加了花括号')
