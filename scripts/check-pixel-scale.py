#!/usr/bin/env python3
"""像素画的显示尺寸必须是源图格数的整数倍。

`image-rendering: pixelated` 不补间 —— 它把每一格【取整】到整数个
设备像素。尺寸不是整数倍时，相邻两格就一宽一窄:源图左右对称，
屏上却歪。2026-09-02 放大对比过 29px 与 28px 两版的头像，
29px 那版一侧的肩比另一侧宽一格，一眼看得出来。

判据:凡是声明了 `image-rendering: pixelated` 的规则，
它的尺寸声明（`width` / `background-size`）都要是那张源图格数的整数倍。
· 头像 14×16 —— 宽度按 14 算
· 徽章 16×16、空态道具 16×16 —— 按 16 算

【单位】。rpx 是设计稿像素，真机上 2rpx = 1 CSS px（750rpx 屏宽基准）。
所以 rpx 值要先减半再判。判 CSS 像素而不是设备像素，是因为 DPR
有 2 也有 3:CSS 宽度是 14 的整数倍时，两种 DPR 下每格都是整数个设备像素。

【不许用百分比】。同一条 68% 落在十一种容器上就是十一个不同的非整数倍 ——
最小的那个（22px 的小圆牌）等于十四列里有一列双宽。所以百分比直接报红。
"""
import re
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
样式 = sorted((根 / 'mini/miniprogram').rglob('*.wxss'))
if len(样式) < 15:
    print(f'✗ 只扫到 {len(样式)} 个 wxss —— 目录搬过家而这一支没跟上')
    sys.exit(1)

# 选择器 → 源图横向格数。新增一种像素图要在这里报到，
# 不然下面那道「表里没有」的检查会拦下来。
# 【按选择器认，不按 `pixelated` 认】。第一版只看「同一条规则里写了
# pixelated」的那几条 —— 而尺寸覆盖是分开写的（`.peek-face.face-art`
# 那一批就不重复声明 pixelated），于是只判到两处，自检当场说它在空转。
判 = [
    ('face-art', 'background-size', 14),   # 头像 14×16，按宽算
    ('badge-img', 'width', 16),
    ('badge-img', 'height', 16),
    ('empty-art', 'background-size', 16),    # 四张空态道具，源图 80×80 = 16 格 ×5
    ('goods-img', 'width', 24),              # 商品图，源图 24 格 ×5 = 120×120
    ('goods-img', 'height', 24),
]
声明 = {}   # (属性) → 正则
for 属性 in ('width', 'height', 'background-size'):
    声明[属性] = re.compile(r'(?:^|[;{\s])' + 属性 + r'\s*:\s*([^;}]+)')

错, 处数 = [], 0
见过 = set()
for f in 样式:
    源 = f.read_text(encoding='utf-8')
    净 = re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), 源, flags=re.S)
    for m in re.finditer(r'([^{}]+)\{([^}]*)\}', 净):
        选择器, 体 = m.group(1).strip(), m.group(2)
        行 = 净[:m.start()].count('\n') + 1
        if 'image-rendering' in 体 and 'pixelated' in 体:
            见过.add(选择器)
            if not any(k in 选择器 for k in [t[0] for t in 判]):
                错.append(f'{f.name}:{行}　`{选择器[:40]}` 声明了 pixelated，'
                          f'而这一支的表里没有它 —— 先报到再上屏')
        for 名, 属性, g in 判:
            if 名 not in 选择器:
                continue
            v = 声明[属性].search(体)
            if not v:
                continue
            处数 += 1
            值 = v.group(1).split(',')[0].strip()
            if '%' in 值:
                错.append(f'{f.name}:{行}　`{选择器[:28]}` 的 {属性} 用了百分比 {值} —— '
                          f'落在不同容器上就是不同的非整数倍，直接写 {g} 的整数倍 rpx')
                continue
            r = re.match(r'([0-9.]+)rpx', 值)
            if not r:
                continue
            css = float(r.group(1)) / 2
            if abs(css / g - round(css / g)) > 1e-9 or round(css / g) < 1:
                错.append(f'{f.name}:{行}　`{选择器[:28]}` 的 {属性} 是 {值} = {css:g}px，'
                          f'一格 {css/g:.2f}px —— 不是 {g} 的整数倍，格子会一宽一窄')

# 自检:上面那张表哪天被清空、或者正则匹配不上，这一支会一路报绿。
for 值, g, 该红 in [('56rpx', 16, True), ('64rpx', 16, False),
                    ('29rpx', 14, True), ('56rpx', 14, False)]:
    css = float(re.match(r'([0-9.]+)rpx', 值).group(1)) / 2
    if (abs(css / g - round(css / g)) > 1e-9) != 该红:
        print(f'✗ 自检不成立：{值} 对 {g} 格{"该红却没红" if 该红 else "不该红却红了"}')
        sys.exit(1)

if 处数 < 6:
    print(f'✗ 只判到 {处数} 处尺寸 —— 正则多半没匹配上，这一支在空转')
    sys.exit(1)

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'像素画都是整数倍 · {len(样式)} 个 wxss · {处数} 处尺寸')
sys.exit(1 if 错 else 0)
