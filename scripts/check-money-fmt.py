#!/usr/bin/env python3
"""金额只许有一支格式化。

商品屏自己抄了一份 `money()`，于是同一个 9900 在商品屏上写作「¥99.00」、
在确认屏上写作「¥99」—— 改了 utils 那一份只动了后者，两屏当场说两种话。
抄一份的代价不是多十行，是它会漂，而且漂在标价上。

判据：`mini/miniprogram/` 里除了 `utils/money.ts`，不许再出现
把「分」拼成货币串的那套写法（`Math.floor(x / 100) + '.'` 之类）。
后端同一件事在 `ai_compose::money_display`，两边规矩要一样 ——
这一支顺带核对它俩对整数金额的处理没有分家。
"""
import re
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
前端 = 根 / 'mini/miniprogram'
唯一 = 前端 / 'utils/money.ts'

错 = []

if not 唯一.is_file():
    print('✗ 找不到 utils/money.ts —— 这一支够不着要验的东西，不算通过')
    sys.exit(1)

# 分 → 元的拼法。只认这一种形状：除以 100 之后拼小数点。
拼法 = re.compile(r'/\s*100\s*\)?\s*\+\s*[\'"]\.')
for f in sorted(前端.rglob('*.ts')):
    if f == 唯一:
        continue
    s = f.read_text(encoding='utf-8')
    if 拼法.search(s):
        错.append(f'{f.relative_to(根)} 自己拼了一份金额格式 —— 用 utils/money.ts 那支')

# 两边对【整数金额】的处理要一致：都不挂零头
前 = 唯一.read_text(encoding='utf-8')
后端 = 根 / 'backend/unmei-api/src/ai_compose.rs'
if 后端.is_file():
    后 = 后端.read_text(encoding='utf-8')
    前不挂 = '分 === 0' in 前
    后不挂 = 'frac == 0' in 后
    if 前不挂 != 后不挂:
        错.append(f'前后端对整数金额说法不一致（前端不挂零头={前不挂} / 后端={后不挂}）')

if 错:
    print('\n'.join('✗ ' + e for e in 错))
    sys.exit(1)
print('✓ 金额只有一支格式化，前后端说法一致')
