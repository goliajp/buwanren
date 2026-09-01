#!/usr/bin/env python3
"""底色被 `background-image` 顶掉 —— 一天里踩两次的那个坑。

CSS 的 `background:` 是【简写】:写 `background: linear-gradient(...)` 时，
浏览器把渐变放进 `background-image`，同时把 `background-color` 置成
transparent。于是后面任何一条 `background-image:` 都会把那个渐变整个换掉，
而不是叠上去 —— 底就没了，只剩下 box-shadow 围出来的一个空圈。

2026-09-01 一天里同一个坑踩了两次:
  · `.face-*` 四十个头像的肤色底盘（上午发现、修好）
  · `.empty-art.pix` 四屏空态的琥珀圆牌（下午又写了一遍同样的形状）
两次都是「注释写着底是对的，而它一次都没渲染出来」。截图看不出来 ——
圆圈还在（那是阴影），只是里头变成了纸色。

判据（机械）:一条规则只写了 `background-image` 而没写 `background-color`，
同时另有一条规则的选择器是它的【基类】并用简写 `background:` 铺了底 ——
那么这条 image 会把那块底顶掉。要么把两层一起写进 background-image，
要么补一个 background-color。
"""
import re, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
样式 = [根 / 'mini/miniprogram/app.wxss'] + \
       sorted((根 / 'mini/miniprogram/pages').glob('*/index.wxss'))

def 拆块(s):
    s = re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), s, flags=re.S)
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', s):
        选 = m.group(1).strip().split('\n')[-1].strip()
        yield 选, m.group(2), s[:m.start(2)].count('\n') + 1

def 类名(选):
    """`.empty-art.pix` → {'.empty-art', '.pix'}；只看最后一段（后代选择器取末端）"""
    末 = 选.split(',')[0].strip().split()[-1] if 选.split(',')[0].strip() else ''
    return set(re.findall(r'\.[\w-]+', 末))

错, 查过 = [], 0
for f in 样式:
    s = f.read_text(encoding='utf-8')
    块 = list(拆块(s))
    # 谁用简写铺了底
    铺底 = {}
    for 选, 体, 行 in 块:
        for d in re.finditer(r'(?<![-\w])background:\s*([^;]+)', 体):
            值 = d.group(1)
            if 'none' in 值 or 'transparent' in 值:
                continue
            if re.search(r'gradient|url\(|var\(|#[0-9A-Fa-f]{3,6}', 值):
                for c in 类名(选):
                    铺底.setdefault(c, (选, 行))
    for 选, 体, 行 in 块:
        if not re.search(r'(?<![-\w])background-image:', 体):
            continue
        查过 += 1
        if re.search(r'(?<![-\w])background(?:-color)?:', 体):
            continue                       # 自己补了底色 / 自己也写了简写
        撞 = [铺底[c] for c in 类名(选) if c in 铺底 and 铺底[c][0] != 选]
        if 撞:
            源选, 源行 = 撞[0]
            错.append(f'{f.parent.name}/{f.name}:{行}　`{选}` 只写了 background-image，'
                      f'会把 `{源选}`（第 {源行} 行）用简写铺的那块底整个顶掉 —— '
                      f'补一个 background-color，或者把两层一起写进 background-image')

if 查过 < 3:
    print(f'✗ 只找到 {查过} 条 background-image —— 这一支多半没扫到东西')
    sys.exit(1)
for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'底色没被图顶掉 · 查了 {查过} 条 background-image')
sys.exit(1 if 错 else 0)
