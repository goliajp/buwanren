#!/usr/bin/env python3
"""开局站位必须等于 ACTS[0] 的站位。

状态里写着 `act: ACTS[0]`，坐标却是另一处——人就会在「做着第一件事」的姿势里
站到别的地方去。白鹭家踩过：差 230 像素，人被工作台挡得一点不剩，
而引擎一切正常（照常放置、照常动画），六张房间截图里只有她那张没有人，
不并排看根本发现不了。
"""
import re, sys, pathlib

房 = sorted(pathlib.Path('rooms/src/rooms').glob('*.js'))
错 = []
查过 = 0
for f in 房:
    s = f.read_text(encoding='utf-8')
    m = re.search(r"mode: 'act', act: ACTS\[0\],\s*x: ([\w\[\]\.]+), y: ([\w\[\]\.]+),", s)
    if not m:
        continue
    x, y = m.group(1), m.group(2)
    查过 += 1
    if x == 'ACTS[0].x' and y == 'ACTS[0].y':
        continue
    a = re.search(r"ACTS = \[(.*?)\n  \]", s, re.S)
    if not a:
        错.append(f'{f.name}：找不到 ACTS 表，没法核对开局站位'); continue
    第一 = re.search(r"\{[^\n]*?x:\s*(\d+),\s*y:\s*(\d+)", a.group(1))
    if not 第一:
        错.append(f'{f.name}：ACTS[0] 读不出坐标'); continue
    ax, ay = 第一.group(1), 第一.group(2)
    if (x, y) != (ax, ay):
        错.append(f'{f.name}：开局站在 ({x}, {y})，ACTS[0] 却在 ({ax}, {ay})'
                  f' —— 差这一截，人可能正好被家具压住')

if 查过 == 0:
    print('✗ 一间房都没查到 —— 检查器自己失效了'); sys.exit(1)
for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'开局站位 · 查了 {查过} 间房')
sys.exit(1 if 错 else 0)
