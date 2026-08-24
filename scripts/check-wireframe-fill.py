#!/usr/bin/env python3
"""线框每一屏都要填满它的视口。

「一屏就是一屏，不上下滚动」是产品设计文档 10.1 定下的硬约束。
它倒逼的不是删内容，是每屏都得有足够内容填满最长的机器 ——
所以画到一半、底下留一大片白的屏，等于承认这一屏本来就该滚动。

这道检查直接读 SVG 坐标：每个手机框（rect.w-shell）里，
核心内容的底缘离弹性槽上缘不许超过 THRESH。
量到框底是没用的 —— tabBar 与槽里的字永远贴在最下面。
纯文本解析，不起浏览器 —— 数值是画布尺度，不是设备像素。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DESIGN = ROOT / '.claude/design'
THRESH = 30          # 画布尺度。tabBar 文字基线本身就占 33，留一点余量

FIG = re.compile(r'<svg[^>]*aria-label="线框图">(.*?)</svg>', re.S)
SHELL = re.compile(r'<rect class="w-shell" x="([\d.]+)" y="([\d.]+)" '
                   r'width="([\d.]+)" height="([\d.]+)"')
ELEM = re.compile(r'<(text|rect|line|circle)\b([^>]*)/?>')


def attrs(s):
    return {k: v for k, v in re.findall(r'([\w-]+)="([^"]*)"', s)}


def low_y(tag, a):
    """元素底缘（近似）。text 用基线，够用。"""
    try:
        if tag == 'text':
            return float(a['y'])
        if tag == 'rect':
            return float(a['y']) + float(a.get('height', 0))
        if tag == 'line':
            return max(float(a['y1']), float(a['y2']))
        if tag == 'circle':
            return float(a['cy']) + float(a.get('r', 0))
    except (KeyError, ValueError):
        return None
    return None


def x_of(tag, a):
    try:
        if tag == 'circle':
            return float(a['cx'])
        if tag == 'line':
            return float(a['x1'])
        return float(a['x'])
    except (KeyError, ValueError):
        return None


bad = 0
screens = 0
docs = sorted(DESIGN.glob('*.html'))
if not docs:
    print('✗ .claude/design/ 下没有 html —— 这道检查够不着它要管的东西')
    sys.exit(1)

for d in docs:
    src = d.read_text(encoding='utf-8')
    for fi, body in enumerate(FIG.findall(src)):
        els = [(t, attrs(a)) for t, a in ELEM.findall(body)]
        for sx, sy, sw, sh in SHELL.findall(body):
            sx, sy, sw, sh = map(float, (sx, sy, sw, sh))
            screens += 1

            def inside(tag, a):
                ex, ey = x_of(tag, a), low_y(tag, a)
                return (ex is not None and ey is not None
                        and sx - 2 <= ex <= sx + sw + 2 and sy <= ey <= sy + sh + 2)

            # 底线 = 弹性槽上缘；没有槽（全屏时刻）就用框底。
            # 量到框底是量不出东西的 —— tabBar 与槽里的字永远贴在最下面，
            # 于是「这一屏画没画完」被它们盖住，检查会对每一屏都报绿。
            floor = sy + sh
            for tag, a in els:
                if a.get('class') == 'w-flex-edge' and inside(tag, a):
                    floor = min(floor, low_y(tag, a))

            # 只忽略框本身与那条界线。别按类名忽略内容 ——
            # 第一版把 w-tiny 也忽略了，而翻页提示正是这个类，
            # 于是「有内容」被当成了「没内容」。槽以下的东西由位置过滤掉，够了。
            SKIP = {'w-shell', 'w-flex-edge'}
            low = sy
            for tag, a in els:
                cls = a.get('class', '')
                if cls in SKIP or not inside(tag, a):
                    continue
                ey = low_y(tag, a)
                if ey <= floor + 1:
                    low = max(low, ey)

            gap = floor - low
            if gap > THRESH:
                print(f'✗ {d.name}　第 {fi+1} 张线框图 x={sx:.0f} 那一屏：'
                      f'核心内容离弹性槽上缘还差 {gap:.0f}px（上限 {THRESH}）'
                      f' —— 这一屏没画完')
                bad += 1

print(f'{"✗" if bad else "✓"} {len(docs)} 份文档 · {screens} 屏 · 核心区没填满 {bad} 屏')
sys.exit(1 if bad else 0)
