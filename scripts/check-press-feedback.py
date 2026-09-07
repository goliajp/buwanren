#!/usr/bin/env python3
"""点得动的东西，按下去要有回应。

2026-09-02 第四轮评审量到:23 屏里 **12 屏一处按压反馈都没有** ——
点「就要这个」花 ¥398、点「问问婆婆」、点「存下」，屏幕纹丝不动。
而有反馈的那 11 屏用了 13 个类名、6 种效果，其中 `.item-hover`
在名册里是变底色、在订单列表里是缩放:同一个名字两种意思。

判据两条:
  · 每个绑了 `bindtap` / `catchtap` 的元素都要有 `hover-class`
  · 那个类名只许是 app.wxss 里那三种之一（或既有的同义词）——
    不然过一阵又会长出第十四个名字

【两个正当例外】:`<button>` 自带按压态（微信原生），不用挂;
画布点的是画面里的某个东西、不是整块画布，整块变色是错的 ——
那两处用 `data-no-press="为什么"` 显式标出来，**必须写理由**。
例外不写成一张可以往里加名字的表:它是一个属性，改动在 diff 里看得见。
"""
import re
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
页 = sorted((根 / 'mini/miniprogram/pages').glob('*/index.wxml'))
if len(页) < 20:
    print(f'✗ 只扫到 {len(页)} 个页面 —— 目录搬过家而这一支没跟上')
    sys.exit(1)

准用 = {'press-card', 'press-btn', 'press-text',
        # 既有同义词，指向同一批数值（见 app.wxss 那一段）
        'entry-hover', 'says-hover', 'soon-hover', 'recommend-hover',
        'pkg-hover', 'pick-hover', 'nudge-hover', 'bar-hover',
        'badge-hover', 'compass-btn-hover', 'manual-k-hover',
        'manual-go-hover', 'hist-row-hover', 'hist-more-hover'}
# `item-hover` 不在准用名单里 —— 它曾在两个文件里各定义两次、含义相反，
# 已全部改成 press-card。留在名单里等于允许它回来。

错, 可点, 例外 = [], 0, 0
for f in 页:
    净 = re.sub(r'<!--.*?-->', '', f.read_text(encoding='utf-8'), flags=re.S)
    for m in re.finditer(r'<(\w[\w-]*)\b([^>]*)>', 净):
        标, 属 = m.group(1), m.group(2)
        if 'bindtap' not in 属 and 'catchtap' not in 属:
            continue
        if 标 == 'button':
            continue
        可点 += 1
        行 = 净[:m.start()].count('\n') + 1
        c = re.search(r'class="([^"]*)"', 属)
        名 = (c.group(1) if c else '')[:26]
        if 'data-no-press' in 属:
            由 = re.search(r'data-no-press="([^"]*)"', 属)
            if not 由 or len(由.group(1)) < 4:
                错.append(f'{f.parts[-2]}:{行}　{标}.{名} 标了不要按压反馈，'
                          f'却没写为什么 —— 例外必须带理由')
            else:
                例外 += 1
            continue
        h = re.search(r'hover-class="([^"]*)"', 属)
        if not h:
            错.append(f'{f.parts[-2]}:{行}　{标}.{名} 点得动，按下去却没有任何回应')
            continue
        # 里头可能是 `{{cond ? 'badge-hover' : ''}}` —— 有花括号就只认引号里的，
        # 不然会把条件里的变量名（`item.去`）当成类名报出来。
        原 = h.group(1)
        类 = (re.findall(r"'([\w-]+)'", 原) if '{{' in 原
              else [x for x in re.findall(r'[\w-]+', 原) if x not in ('true', 'false')])
        野 = [x for x in 类 if x not in 准用]
        if 野:
            错.append(f'{f.parts[-2]}:{行}　{标}.{名} 的按压类 {"、".join(野)} '
                      f'不在那三种里 —— 别再长出第十四个名字')

# 自检:正则哪天认不出 bindtap 了，这一支会一路报绿。
样 = '<view class="x" bindtap="go">a</view><button bindtap="b">c</button>'
n = sum(1 for m in re.finditer(r'<(\w[\w-]*)\b([^>]*)>', 样)
        if ('bindtap' in m.group(2) or 'catchtap' in m.group(2)) and m.group(1) != 'button')
if n != 1:
    print(f'✗ 自检不成立：合成样本里该数出 1 个可点元素，实际 {n}')
    sys.exit(1)

if 可点 < 40:
    print(f'✗ 只数到 {可点} 个可点元素 —— 23 屏不该这么少，这一支多半在空转')
    sys.exit(1)

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'点得动的都有回应 · {len(页)} 屏 · {可点} 处'
      + (f'（{例外} 处显式说明了为什么不要）' if 例外 else ''))
sys.exit(1 if 错 else 0)
