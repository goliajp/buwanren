#!/usr/bin/env python3
"""门禁脚本要的包，都得钉在仓库根的清单里。

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

补上根清单之后又撞到第二种：**清单一旦存在，bun 就只认清单里写的**。
`web/see-host.mjs` 里那句 `import { PNG } from 'pngjs'` 从前靠 bun 顺手装，
清单加上之后当场变成 `Cannot find package 'pngjs'` ——
「进屋看得见主人吗」那一支红了，而那天改的是页面文案。
钉住一件东西的同时，把别的东西挤掉了。

这一支判三件事：

  一、脚本 import 的每个外部包，根清单里都得有
  二、声明的是【确切版本】，不是范围（`^1.62.1` 明天就换一个浏览器）
  三、两处清单里同名的包，说的是【同一个版本】

不判「本机装没装那个浏览器」—— 那是环境，装一次就好（`npx playwright install`）；
这一支管的是「版本会不会自己变」「要的东西在不在清单上」。
"""
import json
import pathlib
import re
import sys

根 = pathlib.Path(__file__).resolve().parent.parent

# node 自带的那些不算外部包
内置 = {'fs', 'path', 'url', 'child_process', 'os', 'crypto', 'http', 'https',
      'net', 'zlib', 'util', 'events', 'stream', 'assert', 'readline'}


def 清单(f):
    if not f.exists():
        return {}
    d = json.loads(f.read_text(encoding='utf-8'))
    out = {}
    for 段 in ('dependencies', 'devDependencies'):
        out.update(d.get(段) or {})
    return out


根清单 = 清单(根 / 'package.json')
别处 = {str(f.relative_to(根)): 清单(f)
      for f in sorted(根.glob('*/package.json')) if 'node_modules' not in str(f)}

# 从根跑的那些脚本 import 了什么
脚本 = sorted(list(根.glob('web/*.mjs')) + list(根.glob('scripts/*.mjs')))
要的 = {}
for f in 脚本:
    src = f.read_text(encoding='utf-8')
    for m in re.finditer(r"""(?:from|import\()\s*['"]([^'".][^'"]*)['"]""", src):
        名 = m.group(1)
        if 名.startswith('.') or 名.startswith('node:'):
            continue
        if 名 in 内置:
            continue
        # `@scope/pkg/sub` 与 `pkg/sub` 都归到包名上
        包 = '/'.join(名.split('/')[:2]) if 名.startswith('@') else 名.split('/')[0]
        要的.setdefault(包, []).append(str(f.relative_to(根)))

坏 = []
if not 脚本:
    print('✗ 一个脚本都没找到 —— 这一支在空转')
    sys.exit(1)
if not 要的:
    print('✗ 一个外部 import 都没解出来 —— 正则多半没匹配上，这一支在空转')
    sys.exit(1)

# 一、要的都在根清单上
for 包, 谁们 in sorted(要的.items()):
    if 包 not in 根清单:
        坏.append(f'✗ `{包}` 没在仓库根的清单里，而 {谁们[0]} 在 import 它 ——'
                  '\n     清单一旦存在，bun 就只认清单里写的:这一条会以'
                  ' `Cannot find package` 的样子红在别的门禁上')

# 二、写的是确切版本
for 包, v in sorted(根清单.items()):
    if not re.fullmatch(r'\d+\.\d+\.\d+', v):
        坏.append(f'✗ 根清单里 `{包}` 写的是 `{v}` —— 范围会自己变，要写确切版本')

# 三、两处清单同名的包不许走散
for 谁, m in sorted(别处.items()):
    for 包, v in sorted(m.items()):
        if 包 in 根清单 and v != 根清单[包]:
            坏.append(f'✗ `{包}` 两处钉的不是同一个版本：package.json={根清单[包]}、{谁}={v}')

for l in 坏:
    print('  ' + l)
if 坏:
    print(f'✗ 门禁脚本要的包没钉齐 · {len(脚本)} 个脚本 · 要 {len(要的)} 个包')
    sys.exit(1)
print(f'✓ 要的包都钉住了 · {len(脚本)} 个脚本 · {len(要的)} 个外部包 · '
      f'根清单 {len(根清单)} 条，写的都是确切版本')
