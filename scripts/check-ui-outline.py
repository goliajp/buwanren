#!/usr/bin/env python3
"""圈出一个控件的边框，要看得见。

分隔线和控件轮廓是两件事:
· 分隔线的活儿是「暗示这里分了段」，浅一点正好，浅到看不清也不影响用
· 控件轮廓是「这是一个可点的东西」的**全部信号** —— 性别那两格、
  生辰那几颗、订阅的分类、换头像那个圆框，除了这圈线之外没有别的提示

2026-09-02 第三轮评审量到:`--stone-line`（#E4DACA）在纸上是 1.31:1，
而它同时在给上面那四处画轮廓。WCAG 1.4.11 对控件边界要的是 3:1。
现在分成两支 —— `--stone-line` 继续当分隔线，`--stone-line-ui` 给轮廓。

判据:整圈的 `border:` 声明（不是 `border-top/bottom/left/right`，
那些是分隔线）用的颜色，对它所在的底色要够 3:1。
底色按【最亮与最暗两种纸】各算一遍，都得过 —— 同一个控件会出现在
白卡片上，也会出现在凹槽里。
"""
import re
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
调色板 = (根 / 'mini/miniprogram/app.wxss').read_text(encoding='utf-8')
样式 = sorted((根 / 'mini/miniprogram').rglob('*.wxss'))

底线 = 3.0
# 控件可能落在的两种底:最亮的纸、最暗的凹槽。两种都要过。
纸 = ['#FFFCF6', '#F6F0E6']


def 取色(名):
    m = re.search(r'--' + re.escape(名) + r'\s*:\s*(#[0-9A-Fa-f]{6})', 调色板)
    return m.group(1) if m else None


def 亮(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]


def 比(a, b):
    la, lb = 亮(a), 亮(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + .05) / (lo + .05)


# 【透明与 none 不算轮廓】。`border: none` / `transparent` 是「特意不画」，
# 那时控件靠别的东西表明自己，不归这一支管。
放过 = ('none', 'transparent', '0', 'currentcolor')


def 可点的类(页目录):
    """这一页的 wxml 里，哪些 class 出现在绑了点击的元素上。

    WCAG 1.4.11 要的是【控件】边界 3:1，不是每一圈线 ——
    装饰卡片、标签框浅一点没问题，它们不假装自己能点。
    分得开的唯一办法是去 wxml 里看这个 class 有没有落在
    `bindtap` / `catchtap` 的元素上。"""
    出 = set()
    for w in 页目录.glob('*.wxml'):
        for m in re.finditer(r'<[^>]*>', w.read_text(encoding='utf-8')):
            标 = m.group(0)
            if 'bindtap' not in 标 and 'catchtap' not in 标:
                continue
            c = re.search(r'class="([^"]*)"', 标)
            if c:
                for 词 in re.findall(r'[\w-]+', c.group(1)):
                    出.add(词)
    return 出


def 底够不够(体):
    """这条规则自己有没有一块【看得见的】底色。

    有的话，边框不是它唯一的边界信号，浅一点无妨;
    而 `background: var(--paper-inset)` 这种（对纸 1.11:1）不算 ——
    那块底自己就看不见。"""
    b = re.search(r'(?:^|[;{])\s*background(?:-color)?\s*:\s*([^;}]+)', 体)
    if not b:
        return False
    值 = b.group(1)
    v = re.search(r'var\(\s*--([\w-]+)\s*\)', 值)
    色 = 取色(v.group(1)) if v else (re.search(r'#[0-9A-Fa-f]{6}', 值).group(0)
                                     if re.search(r'#[0-9A-Fa-f]{6}', 值) else None)
    if not 色:
        return True      # 渐变、图片之类 —— 看不出来就当它有底，不误报
    return min(比(色, 底) for 底 in 纸) >= 底线


错, 处数, 跳过 = [], 0, 0
for f in 样式:
    源 = f.read_text(encoding='utf-8')
    净 = re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), 源, flags=re.S)
    可点 = 可点的类(f.parent)
    for m in re.finditer(r'([^{}]*)\{([^}]*)\}', 净):
        选择器, 体 = m.group(1).strip(), m.group(2)
        行 = 净[:m.start()].count('\n') + 1
        bm = re.search(r'(?:^|[;{])\s*border\s*:\s*([^;}]+)', 体)
        if not bm:
            continue
        值 = bm.group(1).strip()
        if any(w in 值.lower() for w in 放过):
            continue
        类们 = set(re.findall(r'\.([\w-]+)', 选择器))
        if not (类们 & 可点):
            跳过 += 1
            continue          # 不可点 —— 装饰边框，浅一点无妨
        if 底够不够(体):
            跳过 += 1
            continue          # 有一块看得见的底，边框不是唯一信号
        v = re.search(r'var\(\s*--([\w-]+)\s*\)', 值)
        if v:
            色 = 取色(v.group(1))
        else:
            h = re.search(r'#[0-9A-Fa-f]{6}', 值)
            色 = h.group(0) if h else None
        if not 色:
            continue
        处数 += 1
        坏 = [(底, round(比(色, 底), 2)) for 底 in 纸 if 比(色, 底) < 底线]
        if 坏:
            名 = v.group(1) if v else 色
            错.append(f'{f.relative_to(根)}:{行}　`{选择器[:26]}` 是可点的，'
                      f'边框 {名}（{色}）在 {坏[0][0]} 上只有 {坏[0][1]}:1 —— '
                      f'这圈线是它唯一的边界，要 {底线}')

# 自检:换算哪天写坏了，这一支会一路报绿。
for a, b, 该过 in [('#E4DACA', '#FFFCF6', False), ('#A68654', '#FFFCF6', True),
                   ('#A68654', '#F6F0E6', True), ('#EFE7DA', '#FFFCF6', False)]:
    if (比(a, b) >= 底线) != 该过:
        print(f'✗ 自检不成立：{a} 对 {b} 算出 {比(a, b):.2f}，与预期相反')
        sys.exit(1)

if 处数 + 跳过 < 8:
    print(f'✗ 只看到 {处数 + 跳过} 处整圈边框 —— 正则多半没匹配上，这一支在空转')
    sys.exit(1)
if 处数 == 0:
    print('✗ 一处可点的轮廓都没判到 —— wxml 里的 bindtap 认不出来了')
    sys.exit(1)

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'控件轮廓看得见 · {len(样式)} 个 wxss · 可点的 {处数} 圈（装饰的 {跳过} 圈不判） · 底线 {底线}:1')
sys.exit(1 if 错 else 0)
