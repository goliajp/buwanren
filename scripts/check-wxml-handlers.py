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
# 【`catch` 前缀也算】（2026-09-02 第四轮评审 · 工程审计）。
# 上一版只认 `bind…`，而 `catchtap=` 没有那个前缀 —— 于是
# `pages/village/index.wxml` 那句「谁来住你说了算 · 填出生时间 ›」
# （`catchtap="goNatal"`）从来没被检查过。审计把 `goNatal` 改名之后
# 这一支照样报绿，而村主屏点下去会抛 `is not a function`。
BIND = re.compile(r'\b(?:bind|catch)(?:tap|input|blur|focus|change|confirm|submit|'
                  r'chooseavatar|scroll|load|error|longpress|touchstart|touchend)'
                  r'\s*=\s*"([A-Za-z_$][\w$]*)"')

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

# 【查不到东西的核对必须失败】（2026-09-03 五路评审 · 门禁审计）。
# 判据不是「有没有报错」，是「它够不够得着要验的东西」——
# 路径改了、目录搬了、glob 写错了，这一支都会一个不落地全绿，
# 而它其实一个文件都没看。下限比今天低不少，只挡「塌了」这一档。
if pages < 15:
    print(f'✗ 只扫到 {pages} 个页面（该有二十来个）—— 这一支够不着要验的东西，不算通过',
          file=sys.stderr)
    sys.exit(1)
print(f'✓ {pages} 个页面，bind 的处理器都真有')
