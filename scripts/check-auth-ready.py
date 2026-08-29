#!/usr/bin/env python3
"""开屏就取数的页面，都得等得到登录。

匿名登录是 `app.ts` 在 `onLaunch` 里【异步】做的，而页面 `onLoad` / `onShow`
是立刻跑的。所以冷启动那一次，页面发的请求必然赶在 token 之前 —— 401。

401 本身不要紧，要紧的是**之后再也不取了**：那一屏就写着「取不到」
停在那儿，刷新一下又好了。用户看到的是「这个 app 时好时坏」。

仓库里为这件事栽过两次：
  · 2026-08-18 村主屏 —— 冷启动拿 401 之后不重取（已修）
  · 2026-08-29 那一册 —— 我自己上一轮新写的页,又漏了同一处

所以约定是：**在 onLoad / onShow 里取数的页面，必须有 `onAuthReady`**
（`app.ts` 登录完会广播给页面栈里每一页）。这一支就核这条。

判据只看有没有那个处理器，不看它写得对不对 —— 那是 review 的事。
但「压根没有」是机器判得了的，而这正是两次栽跟头的形状。

用法: python3 scripts/check-auth-ready.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = ROOT / 'mini/miniprogram/pages'
LEDGER = ROOT / 'scripts/auth-ready-exempt.json'

# 页面里「调了接口」长什么样：services/ 里那些 xxxApi.yyy(...)，或者直接 api.get/post
调接口 = re.compile(r'\b[A-Za-z_][A-Za-z0-9_]*Api\s*\.\s*[a-zA-Z_]|(?<![A-Za-z0-9_])api\s*\.\s*(get|post|delete)\b')
开屏钩子 = re.compile(r'^\s*(onLoad|onShow)\s*\(', re.M)
有登录钩子 = re.compile(r'^\s*onAuthReady\s*\(', re.M)

led = {}
if LEDGER.exists():
    import json
    led = {k: v for k, v in json.loads(LEDGER.read_text(encoding='utf-8')).items()
           if not k.startswith('_')}

bad = 0
查过 = 0
for d in sorted(PAGES.iterdir()):
    f = d / 'index.ts'
    if not f.is_dir() and not f.exists():
        continue
    src = f.read_text(encoding='utf-8')
    # 注释里的不算
    码 = re.sub(r'/\*[\s\S]*?\*/', '', src)
    码 = re.sub(r'//[^\n]*', '', 码)
    if not (调接口.search(码) and 开屏钩子.search(码)):
        continue
    查过 += 1
    if 有登录钩子.search(码):
        continue
    name = d.name
    if name in led:
        print(f'  · {name} 没有 onAuthReady —— {led[name][:50]}…')
        continue
    print(f'✗ {name} 开屏就取数，却没有 onAuthReady')
    print(f'   冷启动那一次会赶在 token 之前发出去、拿 401，'
          f'而之后再也不取 —— 那一屏就停在「取不到」，刷新一下又好了')
    print('   照 badges 那一页的写法：onShow 里 `if (storage.getToken()) this.load()`，'
          '再加一个 `onAuthReady()`，里面重取一次')
    bad += 1

for name in led:
    if not (PAGES / name / 'index.ts').exists():
        print(f'✗ 台账里记着 {name}，而这一页已经没了 —— 台账要跟着改')
        bad += 1

print()
print(f'开屏取数的页 {查过} 个 · 问题 {bad} 处')
if bad:
    sys.exit(1)
print('✓ 开屏就取数的页面，都等得到登录')
