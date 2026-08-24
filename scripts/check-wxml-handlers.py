#!/usr/bin/env python3
"""wxml 里 bind 的处理器，页面的 ts 里必须真有。

绑到一个不存在的处理器上：点下去抛「xxx is not a function」，
而**没有任何检查看得见** —— 页面开得起来、逐页扫也过，
只有真去点那一下才知道。这类洞最容易在搬代码时留下：
处理器搬走了，按钮还在原地（2026-08-23 把起卦搬去我家时，
`reset` 就这么留了一颗绑空的「再问一次」）。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = ROOT / 'mini/miniprogram/pages'
BIND = re.compile(r'\bbind(?:tap|input|blur|focus|change|confirm|submit|chooseavatar|'
                  r'scroll|load|error|longpress|touchstart|touchend)\s*=\s*"([A-Za-z_$][\w$]*)"')

bad = 0
pages = 0
for wxml in sorted(PAGES.glob('*/index.wxml')):
    ts = wxml.with_suffix('.ts')
    if not ts.exists():
        continue
    pages += 1
    src = ts.read_text(encoding='utf-8')
    for h in sorted(set(BIND.findall(wxml.read_text(encoding='utf-8')))):
        # 处理器写法：`  名(` / `  async 名(` / `  名: ` 
        if re.search(r'^\s*(?:async\s+)?' + re.escape(h) + r'\s*[(:]', src, re.M):
            continue
        print(f'✗ {wxml.relative_to(ROOT)}　bind 到了 {h}()，但 index.ts 里没有它',
              file=sys.stderr)
        bad += 1

if bad:
    print('  点下去会抛，而页面开得起来 —— 逐页扫看不出这种洞。', file=sys.stderr)
    sys.exit(1)
print(f'✓ {pages} 个页面，bind 的处理器都真有')
