#!/usr/bin/env python3
"""页面之间不许互相 import。

构建是「__beginPage(某页) → import 那一页」顺着 app.json 走的。
一个页面 import 另一个页面时，被 import 的那一页里的 `Page()`
会注册到**当前正在注册的那一页**名下、并把注册位清空，
于是当前页自己的 `Page()` 就没主了 —— 整个 app 起不来。

早先 `pages/order` import `pages/orders` 一直没出事，只因为它排在后面：
那时被 import 的那一页已经在模块缓存里，import 是空操作。
也就是说那条依赖靠 app.json 的先后顺序活着，而顺序会被改
（2026-08-23 插入 `pages/confirm` 时就撞上了，症状是 __READY 超时，
跟真实原因看不出关系）。

公共函数放 `miniprogram/utils/`。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = ROOT / 'mini/miniprogram/pages'

bad = []
for f in sorted(PAGES.glob('*/index.ts')):
    src = f.read_text(encoding='utf-8')
    for m in re.finditer(r"from\s+'(\.\./[\w-]+/index)'", src):
        bad.append(f'{f.relative_to(ROOT)} → {m.group(1)}')

if bad:
    print('✗ 页面 import 了别的页面 —— 这会让 app 起不来（看 scripts 里那段注释）：',
          file=sys.stderr)
    for b in bad:
        print('   ' + b, file=sys.stderr)
    print('  公共函数放 mini/miniprogram/utils/，别从页面文件里导出。', file=sys.stderr)
    sys.exit(1)

n = len(list(PAGES.glob('*/index.ts')))
print(f'✓ {n} 个页面，没有互相 import')
