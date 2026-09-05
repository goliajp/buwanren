#!/usr/bin/env python3
"""跑门禁的那个浏览器，版本得是钉死的。

【为什么要有这一支】——2026-09-05 一整轮门禁里十支同时红：

    web verify · 动线（真后端）
    截屏 · 每一屏都要截到
    点得到的东西够 44px 吗 / 渲染后的字都读得出来吗
    钉住的那几块没互相压吗 / 画布都真的铺开了吗
    进屋看得见主人吗
    admin 控制台 · 逐页走 · 阿超 / 阿港 / 阿双

十支的错都是同一句 `Executable doesn't exist at …chromium_headless_shell-1243`。
根因：仓库根【没有 package.json】，而 `web/*.mjs` 与 `scripts/*.mjs` 都
`import { chromium } from 'playwright'` —— bun 在找不到清单的时候
自己装一个最新的，那天它从 1.62.1 漂到了 1.63.0，新版要的浏览器本机没有。

**这种红最坏的地方是它看着像产品坏了。** 十支一起红、错误信息在浏览器那一层，
而这一天真正改的是几行页面代码。这个仓的规矩写着「一支偶尔红的门禁，
比一支常红的更坏 —— 它训练人把每次真红都先当成噪音」。

这一支判两件事：

  一、声明的是【确切版本】，不是范围（`^1.62.1` 明天就换一个浏览器）
  二、所有声明它的 package.json 说的是【同一个版本】

不判「本机装没装那个浏览器」—— 那是环境，装一次就好（`npx playwright install`）；
这一支管的是「版本会不会自己变」。
"""
import json
import pathlib
import re
import sys

根 = pathlib.Path(__file__).resolve().parent.parent

声明 = {}
for f in sorted(根.glob('*/package.json')) + [根 / 'package.json']:
    if 'node_modules' in str(f):
        continue
    if not f.exists():
        continue
    d = json.loads(f.read_text(encoding='utf-8'))
    for 段 in ('dependencies', 'devDependencies'):
        v = (d.get(段) or {}).get('playwright')
        if v:
            声明[str(f.relative_to(根))] = v

# 谁在 import 它 —— 有人用而没人钉，是这一支要抓的第一种情况
用它的 = [
    str(f.relative_to(根))
    for f in sorted(list(根.glob('web/*.mjs')) + list(根.glob('scripts/*.mjs')))
    if re.search(r"from ['\"]playwright['\"]", f.read_text(encoding='utf-8'))
]

坏 = []
if not 用它的:
    print('✗ 一个 import playwright 的脚本都没找到 —— 这一支在空转')
    sys.exit(1)
if not 声明:
    坏.append('✗ 没有任何 package.json 钉住 playwright —— bun 会自己装一个最新的')

for 谁, v in sorted(声明.items()):
    if not re.fullmatch(r'\d+\.\d+\.\d+', v):
        坏.append(f'✗ {谁} 里写的是 `{v}` —— 范围会自己变，要写确切版本')

版本们 = set(声明.values())
if len(版本们) > 1:
    列 = '、'.join(f'{谁}={v}' for 谁, v in sorted(声明.items()))
    坏.append(f'✗ 两处钉的不是同一个版本：{列}')

# 根目录那一份必须在 —— 仓库根的脚本靠它，别处的清单管不到
if 'package.json' not in 声明:
    坏.append('✗ 仓库根没有钉 playwright —— 而 web/ 与 scripts/ 下的脚本是从根跑的')

for l in 坏:
    print('  ' + l)
if 坏:
    print(f'✗ 浏览器版本没钉住 · {len(用它的)} 个脚本用着它')
    sys.exit(1)
print(f'✓ 浏览器版本钉住了 · {版本们.pop()} · {len(声明)} 处声明一致 · {len(用它的)} 个脚本用着它')
