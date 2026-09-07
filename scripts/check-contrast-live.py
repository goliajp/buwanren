#!/usr/bin/env python3
"""屏上每一段字，对它【真正压着的】底色都得读得出来。

`check-contrast.py` 解析 wxss，够得着大多数地方，但有一处够不着:
底色写在祖先上时，它只能如实报「没量」（实测 7 处）。
罗盘中心那颗按钮就在这 7 处里 —— 而那是一屏的主按钮。

这一支量的是【渲染完的事实】:字色、往上走到第一个不透明祖先的底色、
字号、字重，都由浏览器算好。够不着的问题不存在了。

判据按 WCAG 1.4.3:
· 大字（≥18.66px 且粗体，或 ≥24px）要 3:1
· 其余要 4.5:1
两支并存不是重复 —— 解析那一支能在【没跑浏览器】时挡住明显错误，
这一支要截屏才跑得起来。两个都留着，谁先红都算数。
"""
import json
import os
import pathlib
import re
import sys

量 = pathlib.Path(os.environ.get('SHOTS_DIR', '/tmp/shots')) / 'measure.json'
if not 量.exists():
    print(f'✗ 找不到 {量} —— 这一支要先跑截屏（bun web/shots.mjs --out=…），'
          '没量到的东西不能算通过')
    sys.exit(1)


def 拆(c):
    m = re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)', c or '')
    return tuple(int(m.group(i)) for i in (1, 2, 3)) if m else None


def 亮(rgb):
    c = [x / 255 for x in rgb]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]


def 比(a, b):
    la, lb = 亮(a), 亮(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + .05) / (lo + .05)


m = json.loads(量.read_text(encoding='utf-8'))
没这一栏 = [屏 for 屏, d in m.items() if '字' not in d]
if 没这一栏:
    print(f'✗ 这几屏没有「字」这一栏：{"、".join(没这一栏[:5])}')
    print('  —— measure.json 是旧的，或 shots.mjs 那一段被拿掉了')
    sys.exit(1)

错, 查过, 没底 = [], 0, 0
for 屏, d in m.items():
    for e in d['字']:
        字, 底 = 拆(e['字色']), 拆(e['底色'])
        if not 字:
            continue
        if not 底:
            没底 += 1        # 一路到根都是透明 —— 浏览器给的兜底，罕见
            continue
        查过 += 1
        粗 = e['粗细'] in ('600', '700', '800', '900', 'bold', 'bolder')
        大 = e['字号'] >= 24 or (e['字号'] >= 18.66 and 粗)
        底线 = 3.0 if 大 else 4.5
        r = 比(字, 底)
        if r + 1e-9 < 底线:
            错.append(f'{屏}　.{str(e["类"])[:26]}　{e["文"][:14]}　'
                      f'{e["字号"]:g}px{"粗" if 粗 else ""}　{r:.2f}:1，要 {底线}')

# 自检:换算写坏了就一路报绿。黑字压白纸 21:1，白字压白纸 1:1。
for a, b, 该过 in [((0, 0, 0), (255, 255, 255), True),
                   ((255, 255, 255), (255, 255, 255), False)]:
    if (比(a, b) >= 4.5) != 该过:
        print('✗ 自检不成立：对比度换算算错了')
        sys.exit(1)

if 查过 < 200:
    print(f'✗ 只判到 {查过} 段字 —— 33 屏不该这么少，这一支多半在空转')
    sys.exit(1)

for e in dict.fromkeys(错):
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'渲染后的字都读得出来 · {len(m)} 屏 · {查过} 段'
      + (f'（{没底} 段一路透明，量不到底）' if 没底 else ''))
sys.exit(1 if 错 else 0)
