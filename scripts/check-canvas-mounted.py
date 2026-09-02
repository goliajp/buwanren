#!/usr/bin/env python3
"""画布得真的铺开，不能停在浏览器默认的 300×150。

`<canvas>` 的 CSS 尺寸和它的【像素尺寸】是两回事:
CSS 那一半由页面排版决定，像素那一半要引擎挂上去才会设成
村子 / 屋子的真实大小（`mountVillage` / `mountRoom` 里那两行 `node.width=`）。

引擎没挂上时，像素尺寸停在 300×150 —— 屏上是一整块空白，
而 `err` 是空的、控制台没有报错、**没有任何东西会红**。
村子那一屏在首屏正中，屋子那一屏是 ¥99 买到的东西。

2026-09-02 追这件事时才发现:全仓没有一处在看这个数。
现在 `shots.mjs` 把它记进 measure.json 的「画布」一栏，这一支照着判。
"""
import json
import os
import pathlib
import sys

默认 = ('300x150', '0x0')
量 = pathlib.Path(os.environ.get('SHOTS_DIR', '/tmp/shots')) / 'measure.json'
if not 量.exists():
    print(f'✗ 找不到 {量} —— 这一支要先跑截屏（bun web/shots.mjs --out=…）')
    sys.exit(1)

m = json.loads(量.read_text(encoding='utf-8'))
没这一栏 = [屏 for 屏, d in m.items() if '画布' not in d]
if 没这一栏:
    print(f'✗ 这几屏没有「画布」这一栏：{"、".join(没这一栏[:5])}')
    print('  —— measure.json 是旧的，或 shots.mjs 那一段被拿掉了')
    sys.exit(1)

错, 张数 = [], 0
for 屏, d in m.items():
    for c in d['画布']:
        张数 += 1
        if c['像素'] in 默认:
            错.append(f'{屏}　.{str(c["类"])[:24]} 的像素尺寸是 {c["像素"]} '
                      f'—— 引擎没挂上，屏上那一块是空的（屏上占 {c["屏上"]}）')
        w, h = (c['屏上'].split('x') + ['0'])[:2]
        if int(w) < 40 or int(h) < 40:
            错.append(f'{屏}　.{str(c["类"])[:24]} 在屏上只有 {c["屏上"]} —— 等于没有')

if 张数 < 2:
    print(f'✗ 只量到 {张数} 块画布 —— 村子与屋子至少两块，这一支多半在空转')
    sys.exit(1)

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'画布都真的铺开了 · {len(m)} 屏 · {张数} 块')
sys.exit(1 if 错 else 0)
