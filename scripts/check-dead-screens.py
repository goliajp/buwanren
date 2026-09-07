#!/usr/bin/env python3
"""注册了的页面，得有路走得到。

`app.json` 里注册一个页面，它就存在了 —— 而「存在」跟「走得到」是两件事。
2026-09-03 第四轮评审报了 `pages/subs`「是一个走不到的页面」:
它的入口挂着 `wx:if="{{hasSubs}}"`，而库里唯一那件订阅商品是草稿，
于是那一行永远不出现。

那一处查下来【是对的】—— 没东西可订就不该摆入口，
入口跟着数据走正是它该有的样子（2026-09-01 专门改过）。
但「有条件的入口」跟「压根没人链接」在 app.json 里长得一模一样，
而后者是真的死页。这一支把两者分开:

  · 有 `navigateTo` / `redirectTo` / `switchTab` 指向它 —— 走得到
  · 是 tabBar 里的一页 —— 走得到
  · 都不是 —— 死页，报出来

条件入口仍然算「走得到」:它有链接，只是不总是显示。
这一支管的是【一条链接都没有】那种。
"""
import json
import pathlib
import re
import sys

根 = pathlib.Path(__file__).resolve().parent.parent
mini = 根 / 'mini/miniprogram'
app = json.loads((mini / 'app.json').read_text(encoding='utf-8'))
页 = app.get('pages', [])
if len(页) < 15:
    print(f'✗ app.json 里只有 {len(页)} 个页面 —— 读错文件了？')
    sys.exit(1)

tab = {t['pagePath'] for t in app.get('tabBar', {}).get('list', [])}

# 全仓所有源码里出现过的跳转目标
指向 = set()
for f in list(mini.rglob('*.ts')) + list(mini.rglob('*.wxml')):
    src = f.read_text(encoding='utf-8')
    for m in re.finditer(r"""url:\s*['"`]/?((?:pages|packageA)/[\w/-]+)""", src):
        指向.add(m.group(1))
    # `goSubs() { wx.navigateTo({ url: '/pages/subs/index' }) }` 之外，
    # 也有把路径拼在常量里的写法
    for m in re.finditer(r"""['"`]/((?:pages|packageA)/[\w/-]+)['"`]""", src):
        指向.add(m.group(1))

# 入口页（app.json 的第一页）本来就走得到
入口 = 页[0] if 页 else None

死 = [p for p in 页 if p not in 指向 and p not in tab and p != 入口]

if len(指向) < 10:
    print(f'✗ 只找到 {len(指向)} 个跳转目标 —— 正则多半没匹配上，这一支在空转')
    sys.exit(1)

for p in 死:
    print(f'  ✗ {p} 注册了，而全仓没有一处链接指向它 —— 它是一个走不到的页面')
    print(f'     要么给它一条路，要么从 app.json 里拿掉')
print(('✗ ' if 死 else '✓ ') + f'注册的页面都走得到 · {len(页)} 页 · '
      f'tab {len(tab)} 页 · 被链接 {len([p for p in 页 if p in 指向])} 页')
sys.exit(1 if 死 else 0)
