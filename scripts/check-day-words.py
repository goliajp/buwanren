#!/usr/bin/env python3
"""说给人听的日期，只有一种写法。

「八月三十 · 周日」是说给人听的，「2026-08-30」是给系统读的（设计册 0830 §5）。
两种都出现过：村主屏一种、「我家」与「今天」各拼了一份 ISO ——
而这三屏里有两屏是并排的 tab，切过去一种写法，切回来另一种。

所以这一支只盯一件事：**页面里不许再自己拼日期**。
要用就用 `utils/day` 的 `今天几号()`。

台账类的日期（下单、寄出）不在此列：那是记录，数字才对。
它们由后端给字符串，页面不拼 —— 所以「页面里不许拼」这条判据两边都成立。
"""
import re
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent / 'mini/miniprogram'
页 = 根 / 'pages'
共用 = 根 / 'utils/day.ts'
错 = []

if not 共用.exists():
    print('✗ 找不到 utils/day.ts —— 这支门禁够不着要验的东西，不算通过')
    sys.exit(1)

自己拼 = re.compile(r'getFullYear\(\)')
文件 = sorted(页.glob('*/index.ts'))
if not 文件:
    print('✗ 一个页面都没找到 —— 够不着就不算验过')
    sys.exit(1)

for f in 文件:
    for n, 行 in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
        if 自己拼.search(行):
            错.append(f'{f.parent.name}/index.ts:{n} 自己拼了一份日期 —— '
                      f'用 utils/day 的 `今天几号()`，不然这一屏会用另一种写法说同一天')

if 错:
    print('\n'.join('✗ ' + e for e in 错))
    sys.exit(1)
print(f'✓ {len(文件)} 页都没自己拼日期（说给人听的那一种统一走 utils/day）')
