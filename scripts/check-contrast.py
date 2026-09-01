#!/usr/bin/env python3
"""线的颜色不许当文字色用；次要文字色不许低到看着像禁用。

2026-09-01 五路评审 · 视觉那一路量出来的两条:
  · `--ink-faint` #A69C90 在纸底上只有 2.55:1 —— 连 AA（4.5:1）的一半都不到，
    而它是全 app 的次要文字色。后果不只是读不清:2.55:1 让所有次要信息
    看着像禁用，「我的」那一屏五行值全灰，整张表像是暂不可用。
  · `--stone-line` #E4DACA（1.31:1）是【线】的颜色，却被拿去当前景字色:
    空屋那个「?」、六枚未解锁徽章的字，在手机上基本看不见。

判据两条，都机械:
  · 任何 `color:` 用到线类变量（--stone-line / --stone-line-x）→ 红
  · 拿来当文字的颜色变量，对纸底的对比度不许低于 3.2:1
"""
import re, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
app = 根 / 'mini/miniprogram/app.wxss'
源 = app.read_text(encoding='utf-8')

def 亮(h):
    c = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]

def 比(a, b):
    la, lb = 亮(a), 亮(b)
    la, lb = max(la, lb), min(la, lb)
    return (la + .05) / (lb + .05)

变量 = dict(re.findall(r'(--[\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;', 源))
纸 = 变量.get('--paper-inset') or 变量.get('--paper')
if not 变量 or not 纸:
    print('✗ 从 app.wxss 里读不出颜色变量 —— 这一支够不着要验的东西')
    sys.exit(1)

线类 = {'--stone-line', '--stone-line-x'}
# 当文字用的那几个（其余是底色 / 描边，不在这一条里）
文字类 = ['--ink', '--ink-mid', '--ink-faint', '--stone-label']

错, 查过 = [], 0
样式 = [app] + sorted((根 / 'mini/miniprogram/pages').glob('*/index.wxss'))
for f in 样式:
    s = f.read_text(encoding='utf-8')
    s = re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), s, flags=re.S)
    # 【按这一屏自己的底色算】。点灯那一屏是深色的（#1a1712 —— 它是夜里
    # 那二十五分钟），浅色在那儿正是对的:同一个变量在纸底上看不见，
    # 在深底上却是最清楚的那一档。不看底色就会把它误报成违规，
    # 而误报会让整支门禁失去可信度。
    m底 = re.search(r'\.page\s*\{[^}]*background:\s*(#[0-9A-Fa-f]{6})', s)
    底 = m底.group(1) if m底 else 纸
    深底 = 亮(底) < 亮(纸) / 2
    # 【写死的颜色也要量】。第一版只看 `color: var(…)` —— 于是写死十六进制的
    # `color:` 整条绕过去，而现役就有比这一支立案时抓的那个（2.55:1）
    # 还低的两处:`confirm` 的「还没填 ›」#999 是 2.51:1，落在成交路径上;
    # 点灯那屏唯一的出口「先走一步」#6b6055 压在 #1a1712 上是 2.92:1，
    # 而这一支专门为那屏加了「按本屏底色算」的分支，一次都没落到它头上
    # （2026-09-01 五路评审 · 工程审计）。
    for m in re.finditer(r'color:\s*(#[0-9A-Fa-f]{3,6})\b', s):
        查过 += 1
        c = m.group(1)
        if len(c) == 4:                       # #abc → #aabbcc
            c = '#' + ''.join(ch * 2 for ch in c[1:])
        if len(c) != 7:
            continue
        比值 = 比(c, 底)
        # 白字压在实心按钮上是对的 —— 那时底不是页面底色，是按钮自己的色
        if c.lower() in ('#ffffff', '#fff'):
            continue
        if 比值 < 3.2:
            行 = s[:m.start()].count('\n') + 1
            错.append(f'{f.parent.name}/{f.name}:{行}　写死的 {c} 压在 {底} 上'
                      f'只有 {比值:.2f}:1 —— 低于 3.2 就读成「禁用」')
    for m in re.finditer(r'color:\s*var\((--[\w-]+)\)', s):
        查过 += 1
        名 = m.group(1)
        if 名 in 线类 and not 深底:
            行 = s[:m.start()].count('\n') + 1
            错.append(f'{f.parent.name}/{f.name}:{行}　拿 {名} 当文字色 —— '
                      f'那是线的颜色（{比(变量[名], 纸):.2f}:1），当字用等于看不见')
        if 深底 and 名 in 变量 and 比(变量[名], 底) < 3.2:
            行 = s[:m.start()].count('\n') + 1
            错.append(f'{f.parent.name}/{f.name}:{行}　{名} 压在这一屏的深底 {底} 上'
                      f'只有 {比(变量[名], 底):.2f}:1 —— 读不出来')

for 名 in 文字类:
    if 名 not in 变量:
        错.append(f'app.wxss 里没有 {名} —— 这一支的名单跟色板对不上了')
        continue
    c = 比(变量[名], 纸)
    if c < 3.2:
        错.append(f'{名} = {变量[名]}，对纸底只有 {c:.2f}:1 —— '
                  f'低于 3.2 就读成「禁用」，而它是拿来写字的')

if 查过 < 20:
    print(f'✗ 只扫到 {查过} 处 color: var(...) —— 这一支多半在空转')
    sys.exit(1)
for e in dict.fromkeys(错):
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'文字色读得出来 · 扫了 {查过} 处 · '
      + ' · '.join(f'{n} {比(变量[n], 纸):.2f}:1' for n in 文字类 if n in 变量))
sys.exit(1 if 错 else 0)
