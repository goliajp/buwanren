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
# 【没参与检查的要点名】。目录里 7 个文件只查了 6 个，那第 7 个是什么？
# 报出来才不用下一个人再去查一遍（2026-09-01 五路评审 · 工程审计问到）。
不适用 = []
查过 = 0
for f in 房:
    s = f.read_text(encoding='utf-8')
    m = re.search(r"mode: 'act', act: ACTS\[0\],\s*x: ([\w\[\]\.]+), y: ([\w\[\]\.]+),", s)
    if not m:
        # 【匹配不上要说出来，不能静默跳过】。7 间房里 ayun-plan.js 的主角起手
        # 写法是 `actor: { x: …, y: … }`，跟这条正则对不上 —— 于是它不参与检查，
        # 而报出来的是「查了 6 间房」，看着跟通过一模一样。
        # 这正是这个仓库栽过的那个形状（那次是文件名，这次是写法）。
        # 只有【真的没有 ACTS】才算不适用;有 ACTS 却读不出起手位置，就是漏。
        if 'const ACTS' in s:
            错.append(f'{f.name} 有 ACTS，却读不出开局站位 —— 它没参与检查，'
                      f'而这一支照样报绿。起手位置的写法变了？')
        else:
            不适用.append(f.name)
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
尾 = f'（{"、".join(不适用)} 是布局文件，没有 ACTS，不适用）' if 不适用 else ''
print(('✗ ' if 错 else '✓ ') + f'开局站位 · 查了 {查过} 间房' + 尾)
sys.exit(1 if 错 else 0)
