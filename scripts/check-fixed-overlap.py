#!/usr/bin/env python3
"""钉在屏上的那几块，两两不许压着。

`position: fixed` 的块各自算各自的位置，谁也不知道谁多高。
确认屏上「付完之后就等它到」那一行拿 `bottom: 112rpx` 去躲成交栏 ——
而成交栏实测 66px 高（132rpx），于是那行字的下半截被压掉 10px，
就在**付款**那一屏上。

这个错第三轮报过、第四轮两路各自又量到一次，中间还修过一版 ——
靠人盯是挡不住的:两个数字写在两个文件里，改了一个不会有人想起另一个。
（真正的修法是把两块放进同一个容器，让它们自己堆叠;
这一支守的是「哪天又有人开一块新的固定层」。）

数据来自镜像 `web/shots.mjs` 的 `钉住的` 一栏 —— 真实排版下的外接矩形。
"""
import json
import os
import pathlib
import sys

量 = pathlib.Path(os.environ.get('SHOTS_DIR', '/tmp/shots')) / 'measure.json'
if not 量.exists():
    print(f'✗ 找不到 {量} —— 这一支要先跑截屏（bun web/shots.mjs --out=…），'
          '没量到的东西不能算通过')
    sys.exit(1)

m = json.loads(量.read_text(encoding='utf-8'))
没这一栏 = [屏 for 屏, d in m.items() if '钉住的' not in d]
if 没这一栏:
    print(f'✗ 这几屏没有「钉住的」这一栏：{"、".join(没这一栏[:5])}')
    print('  —— measure.json 是旧的，或 shots.mjs 那一段被拿掉了')
    sys.exit(1)


def 压着吗(a, b):
    """两个矩形有没有交叠。容差 1px —— 亚像素舍入不算数。"""
    return not (a['左'] + a['宽'] <= b['左'] + 1 or b['左'] + b['宽'] <= a['左'] + 1
                or a['顶'] + a['高'] <= b['顶'] + 1 or b['顶'] + b['高'] <= a['顶'] + 1)


错, 块数 = [], 0
for 屏, d in m.items():
    块 = d['钉住的']
    块数 += len(块)
    for i in range(len(块)):
        for j in range(i + 1, len(块)):
            a, b = 块[i], 块[j]
            # 嵌套的那种不算 —— 一块整个装在另一块里是正常的父子关系
            if (a['左'] <= b['左'] and a['顶'] <= b['顶']
                    and a['左'] + a['宽'] >= b['左'] + b['宽']
                    and a['顶'] + a['高'] >= b['顶'] + b['高']):
                continue
            if (b['左'] <= a['左'] and b['顶'] <= a['顶']
                    and b['左'] + b['宽'] >= a['左'] + a['宽']
                    and b['顶'] + b['高'] >= a['顶'] + a['高']):
                continue
            if 压着吗(a, b):
                盖 = min(a['顶'] + a['高'], b['顶'] + b['高']) - max(a['顶'], b['顶'])
                错.append(f'{屏}　.{str(a["类"])[:20]}（顶 {a["顶"]} 高 {a["高"]}）'
                          f'与 .{str(b["类"])[:20]}（顶 {b["顶"]} 高 {b["高"]}）'
                          f'压着 {盖}px　「{a["文"][:12]}」')

# 自检:压没压着这件事哪天算错了，这一支会一路报绿。
甲 = {'左': 0, '顶': 587, '宽': 375, '高': 24}
乙 = {'左': 0, '顶': 601, '宽': 375, '高': 66}     # 真出过的那一对
丙 = {'左': 0, '顶': 611, '宽': 375, '高': 56}     # 刚好挨着，不算压
if not 压着吗(甲, 乙) or 压着吗(甲, 丙):
    print('✗ 自检不成立：交叠判断算错了')
    sys.exit(1)

if 块数 < 1:
    print('✗ 一块钉住的都没量到 —— 这一支在空转')
    sys.exit(1)

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'钉住的那几块没互相压 · {len(m)} 屏 · {块数} 块')
sys.exit(1 if 错 else 0)
