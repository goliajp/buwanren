#!/usr/bin/env python3
"""可移植核心里不许出现 window(小程序没有它)。

`portlint` 在运行期查「接口挂没挂在 globalThis 上」,浏览器里 window===globalThis,
所以那一条查不出源码里写的是哪个。这条是静态的,补上那一半。
"""
import pathlib, re, sys
ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'rooms/src')
# 设计页专用的三支不算核心:它们造 div/td、读 canvas 元素,本就不进小程序
SKIP = {'engine/asset-table.js', 'engine/pose-sheet.js', 'engine/village.js'}


def strip_noncode(src):
    """把注释与字符串都挖成等长空白(保长度,行号列位不变)。

    必须【一次扫描同时认】,不能先挖注释再挖字符串,也不能反过来:
      · 先挖注释 → 字符串里的 `http://a` 被当成注释起点,把后面真正的
        `window.zz = 1` 一起吞掉。这是**漏报** —— 门禁说绿,东西是坏的。
      · 先挖字符串 → 注释里一个 don't 的撇号就开出一个假字符串,
        把后面几十行代码挖空,同样漏报。
    两种顺序都试过,前一种在这里当场复现过。
    """
    out, i, n = [], 0, len(src)
    keep = lambda ch: out.append(ch)
    hide = lambda ch: out.append('\n' if ch == '\n' else ' ')
    while i < n:
        c, nx = src[i], src[i + 1] if i + 1 < n else ''
        if c == '/' and nx == '/':
            while i < n and src[i] != '\n': hide(src[i]); i += 1
        elif c == '/' and nx == '*':
            hide(c); hide(nx); i += 2
            while i < n and not (src[i] == '*' and i + 1 < n and src[i + 1] == '/'):
                hide(src[i]); i += 1
            if i < n: hide(src[i]); hide(src[i + 1]); i += 2
        elif c in '\'"`':
            q = c; hide(c); i += 1
            while i < n and src[i] != q:
                if src[i] == '\\' and i + 1 < n: hide(src[i]); hide(src[i + 1]); i += 2; continue
                hide(src[i]); i += 1
            if i < n: hide(src[i]); i += 1
        else:
            keep(c); i += 1
    return ''.join(out)


bad = []
for d in ('engine', 'assets', 'rooms'):
    for p in sorted((ROOT / d).glob('*.js')):
        rel = f'{d}/{p.name}'
        if rel in SKIP:
            continue
        src = strip_noncode(p.read_text(encoding='utf-8'))
        for i, line in enumerate(src.split('\n'), 1):
            if re.search(r'\bwindow\b', line):
                bad.append((rel, i, line.strip()[:80]))
if bad:
    print(f'✗ 可移植核心里有 {len(bad)} 处 window:')
    for f, i, l in bad[:12]:
        print(f'    {f}:{i}  {l}')
    print('  小程序没有 window。改成 globalThis —— 浏览器里两者是同一个对象。')
    sys.exit(1)
print(f'✓ engine/ 与 assets/ 与 rooms/ 里没有 window(设计页专用的 {len(SKIP)} 支除外)')
