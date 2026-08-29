#!/usr/bin/env python3
"""导航栏的标题统一是「不完人」（2026-08-18 用户定）。

真机上每一页都有一条原生导航栏，而 0830 之后每一页自己画了大标题 ——
导航栏再写一遍页面名，同一个词在一屏上出现两次。
空着更糟：那条栏还在，只是没有字，看着像没做完。

所以规则只有一条:那一栏永远写产品名，页面名由页面自己说。
镜像不画这条栏，所以这件事截图上看不见 —— 只能靠这一支。
"""
import json
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent / 'mini/miniprogram/pages'
应为 = '不完人'
错 = []

页 = sorted(根.glob('*/index.json'))
if not 页:
    print('✗ 一个页面配置都没找到 —— 这支门禁够不着要验的东西，不算通过')
    sys.exit(1)

for f in 页:
    try:
        d = json.loads(f.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        错.append(f'{f.parent.name}/index.json 不是合法 JSON：{e}')
        continue
    t = d.get('navigationBarTitleText')
    if t != 应为:
        错.append(f'{f.parent.name} 的导航栏写的是「{t if t else "(空)"}」，'
                  f'应当是「{应为}」—— 页面名由页面自己的大标题说')

if 错:
    print('\n'.join('✗ ' + e for e in 错))
    sys.exit(1)
print(f'✓ {len(页)} 页的导航栏标题都是「{应为}」')
