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

# 两种写法都算「自己造日期」：
#   · `getFullYear()` 拼一个 —— 头一版只盯这个
#   · 把服务端的 ISO 串切一刀（`.slice(0, 10)`）—— 徽章那一屏就是这么
#     把「2026-08-30」摆到纪念日上的，而全产品别处说的是「八月三十」。
#     后者门禁够不着，是从截图上看见的。
自己拼 = re.compile(r'getFullYear\(\)|\.slice\(0,\s*10\)')
# 第四种：**切 ISO 串取月日**（`.slice(5, 10)`）。这一种更隐蔽 ——
# 它连格式都是对的，错的是【时区】:后端给的是 UTC
# （实测 `2026-09-01T22:55:08+00:00`），切串得到「09-01」，
# 而东八区那一刻已经是 9 月 2 日早上。
# 也就是说午夜到早八点之间下的单，屏上一律显示成昨天，
# 而白天测永远看不出来（2026-09-02 第三轮评审 · 第一次打开的人）。
#
# 台账类的日期本来不在这一支的管辖里（上面 docstring 说「那是记录，
# 数字才对」）—— 但那说的是【长什么样】，不是【算得对不对】。
# 日期怎么算，两类是同一条规矩:按本地时区，别切串。
切串取月日 = re.compile(r'\.slice\(\s*5\s*,\s*10\s*\)')
# 第三种：**自己抄一份实现**。村主屏就留着一份本地的 `今天几号` ——
# 抽成共用的那次改动被一次 `git checkout` 撤掉了，而这一支当时只盯前两种，
# 于是它一直用着自己那一份，跟别处说着不同的日期。
# 判据：页面里不许再定义这几个名字，用 utils/day 的。
自己抄 = re.compile(r'^\s*(?:const|function)\s+(今天几号|那一天|那天几点|汉日|汉数)\b', re.M)
文件 = sorted(页.glob('*/index.ts'))
if not 文件:
    print('✗ 一个页面都没找到 —— 够不着就不算验过')
    sys.exit(1)

# `utils/day` 自己也不许切串 —— 它是那条规矩的所在地
共用源 = 共用.read_text(encoding='utf-8')
共用无注释 = re.sub(r'/\*[\s\S]*?\*/|//[^\n]*', '', 共用源)
if 切串取月日.search(共用无注释) or re.search(r'\.slice\(0,\s*10\)', 共用无注释):
    错.append('utils/day.ts 自己在切 ISO 串 —— 那正是它存在要挡的事')

for f in 文件:
    源 = f.read_text(encoding='utf-8')
    for m in 自己抄.finditer(源):
        错.append(f'{f.parent.name}/index.ts 自己抄了一份 `{m.group(1)}` —— '
                  f'用 utils/day 里的那一支，抄一份迟早两处说不同的日期')
    for n, 行 in enumerate(源.splitlines(), 1):
        if 自己拼.search(行):
            错.append(f'{f.parent.name}/index.ts:{n} 自己造了一份日期 —— '
                      f'用 utils/day 里的写法，不然这一屏会用另一种说法讲同一天')
        if 切串取月日.search(行):
            错.append(f'{f.parent.name}/index.ts:{n} 切 ISO 串取月日 —— '
                      f'后端给的是 UTC，切串会让东八区午夜到早八点之间的一切'
                      f'显示成昨天。走 utils/day 的 `台账那天()`')

if 错:
    print('\n'.join('✗ ' + e for e in 错))
    sys.exit(1)
print(f'✓ {len(文件)} 页都没自己拼日期（说给人听的那一种统一走 utils/day）')
