#!/usr/bin/env python3
"""点得到的东西不许小于 44px。

真机上手指的接触面约 9mm —— 苹果的人机指南写 44pt、谷歌写 48dp，
两家都落在这个数附近。比它小就要【瞄】，而这个产品的人是躺着单手点的。

判据量的是**渲染出来的外接矩形**，不是 wxss 里那个声明值:
padding、行高、flex 拉伸都会改写它，而 `<text>` 是行内元素 ——
`width: 56rpx` 在它身上一行都不起作用（确认页那两个加减号写了这一行，
实测宽度一直是 28px，2026-09-02 才发现）。声明值靠不住，得量。

数据来自镜像的 `web/shots.mjs`:它在真实排版下取每个绑了点击的元素的
`getBoundingClientRect()`，记进 `measure.json` 的 `可点` 一栏。
标记由 `web/runtime/wxml.js` 在绑 click 时打上 —— 那一层是全仓唯一
知道「哪个元素能点」的地方（`.wxml` 里的 `bindtap` 到了 DOM 上什么都不留）。

所以这一支【依赖截屏跑过】。没有 measure.json 就报红说没验，
不报绿 —— 「没量」和「量了没问题」在总账上必须分得开。
"""
import json
import os
import pathlib
import sys

底线 = 44
量 = pathlib.Path(os.environ.get('SHOTS_DIR', '/tmp/shots')) / 'measure.json'

if not 量.exists():
    print(f'✗ 找不到 {量} —— 这一支要先跑截屏（bun web/shots.mjs --out=…），'
          '没量到的东西不能算通过')
    sys.exit(1)

m = json.loads(量.read_text(encoding='utf-8'))
if not m:
    print('✗ measure.json 是空的 —— 截屏那一轮没跑完')
    sys.exit(1)

小, 总 = [], 0
没量到 = [屏 for 屏, d in m.items() if '可点' not in d]
for 屏, d in m.items():
    for e in d.get('可点', []):
        总 += 1
        if e['高'] < 底线 or e['宽'] < 底线:
            小.append(f"{屏}　{e['高']}×{e['宽']}　.{e['类'][:34]}　{e['文'][:14]}")

if 没量到:
    print(f'✗ 这几屏没有「可点」这一栏：{"、".join(没量到[:5])}')
    print('  —— measure.json 是旧的，或 shots.mjs 那一段被拿掉了')
    sys.exit(1)
# 一屏没有可点元素是可能的（政策页），但整轮一个都没有就是记号没打上
if 总 < 40:
    print(f'✗ 全部只量到 {总} 个可点元素 —— 记号多半没打上，这一支在空转')
    sys.exit(1)

for s in 小:
    print('  ✗ ' + s)
print(('✗ ' if 小 else '✓ ') + f'点得到的东西都够 {底线}px · {len(m)} 屏 · {总} 个')
sys.exit(1 if 小 else 0)
