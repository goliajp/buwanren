#!/usr/bin/env python3
"""一个人的颜色，四处要一样。

头像的底色按他劝你的方向（`lack_bias.direction`）挑，而放头像的地方有四处：
名册、村主屏的说话卡片、他自己的主页、扫开御守那一屏。
少接一处，同一个人在那一屏就是另一个颜色 —— 而颜色是翻四十个人时
最快的那条线索，一处不准，整条线索就不能信。

这一支盯两件事：

1. 每个放头像的元素都接了 `face-{{...direction}}`；
2. 页面的 wxss 里【没有】给这些元素写 background 或 color。
   页面样式在 app.wxss 之后加载，写了就把方向色盖掉，
   而症状是「这一屏的方向色像是没做」—— 今天为这个坑丢了四轮。
"""
import re
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
页 = 根 / 'mini/miniprogram/pages'
错 = []

# 元素类名 → 它所在的页面
放脸的 = {
    'says-face': 'village',
    'item-face': 'invite',
    'face': 'villager',
    'glyph': 'moved',
}

app = (根 / 'mini/miniprogram/app.wxss')
if not app.exists():
    print('✗ 找不到 app.wxss —— 这支门禁够不着要验的东西，不算通过')
    sys.exit(1)
app_s = app.read_text(encoding='utf-8')

# app.wxss 里那条共用的默认，四个类名都要在
默认 = re.search(r'^([^\n{]*)\{\s*\n\s*background: linear-gradient\(150deg, var\(--amber-lite\)',
                 app_s, re.M)
if not 默认:
    print('✗ app.wxss 里找不到头像的默认底色那一条 —— 写法变了，先修这支门禁')
    sys.exit(1)
默认里的 = {c.strip().lstrip('.') for c in 默认.group(1).split(',')}
漏 = sorted(set(放脸的) - 默认里的)
if 漏:
    错.append(f'app.wxss 的头像默认色没盖住 {"、".join(漏)} —— '
              f'那几处会各自在页面里写一份底色，迟早走散')

for 类, 页名 in 放脸的.items():
    wxml = 页 / 页名 / 'index.wxml'
    wxss = 页 / 页名 / 'index.wxss'
    if not wxml.exists():
        错.append(f'找不到 {wxml.relative_to(根)} —— 够不着就不算验过')
        continue
    s = wxml.read_text(encoding='utf-8')
    if not re.search(r'class="[^"]*\b' + re.escape(类) + r'\b[^"]*face-\{\{', s):
        错.append(f'{页名} 的 .{类} 没接 face-{{{{…direction}}}} —— '
                  f'这一屏上他会是默认的琥珀，跟别处不是同一个人')
    if wxss.exists():
        t = wxss.read_text(encoding='utf-8')
        块 = re.search(r'^\.' + re.escape(类) + r'\s*\{([^}]*)\}', t, re.M)
        if 块 and re.search(r'^\s*(background|color)\s*:', 块.group(1), re.M):
            错.append(f'{页名}/index.wxss 的 .{类} 里写了 background 或 color —— '
                      f'页面样式在 app.wxss 之后加载，它会把方向色盖掉，'
                      f'而看起来像方向色根本没做')

# ── 还有一类漏网的:页面自己现调一个头像渐变。
#    上面那张表只管【我知道的那几处】，而这个产品里放脸的地方还在长
#    （名字页的两个气泡、香那一屏的一个 —— 三处都自调过，
#    于是同两位村民在那三屏是琥珀与绿，别处是粉的）。
#    所以这里改成盯【写法】而不是盯名单:页面样式里不许出现头像那种渐变。
#    要新加一处脸，就用 app.wxss 的 `.face-<方向>`，不许现调。
头像渐变 = re.compile(r'linear-gradient\(150deg,\s*var\(--(amber|moss|peach|wx-)[a-z-]*\)')
for wxss in sorted(页.glob('*/index.wxss')):
    for n, 行 in enumerate(wxss.read_text(encoding='utf-8').splitlines(), 1):
        if 头像渐变.search(行):
            错.append(f'{wxss.parent.name}/index.wxss:{n} 自调了一个头像渐变 —— '
                      f'用 app.wxss 的 `.face-<方向>`，不然这一屏的人会是另一个颜色')

if 错:
    print('\n'.join('✗ ' + e for e in 错))
    sys.exit(1)
print(f'✓ 四处头像都接了方向色，页面里既没有盖回去的写法、也没有自调的渐变'
      f'（{"、".join(sorted(放脸的))}）')
