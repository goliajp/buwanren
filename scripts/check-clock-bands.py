#!/usr/bin/env python3
"""昼夜的边界分散在三个文件里，这一支盯着它们别走散。

三处各自说一天怎么分：

  rooms/src/engine/village.js   天色（几点开始亮、几点全黑）+ 村民语料的四段
  mini/.../pages/village/index.ts  屏幕顶上那句问候
  web/verify.mjs               验问候语用的白名单

走散的样子很好认，也很难抓：屏上写着「傍晚好」而村子已经点起灯；
或者问候语加了一档，验证脚本的白名单没加 —— 那条断言只在
一天里的某几个钟头红，而只在某几个钟头出现的红最容易被当成噪音放过。

所以钉的是【数】不是【文字】：谁改了 19.5，另外两处不跟着改就红。
"""
import re
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
错 = []


def 读(p):
    f = 根 / p
    if not f.exists():
        错.append(f'找不到 {p} —— 这支门禁够不着要验的东西，不算通过')
        return None
    return f.read_text(encoding='utf-8')


引擎 = 读('rooms/src/engine/village.js')
页面 = 读('mini/miniprogram/pages/village/index.ts')
验证 = 读('web/verify.mjs')
if 错:
    print('\n'.join('✗ ' + e for e in 错))
    sys.exit(1)

# ── 天色：if (钟 < 5) dRaw = 1 … else if (钟 < 19.5) …
天色 = [float(x) for x in re.findall(r'钟\s*<\s*([\d.]+)\)\s*dRaw', 引擎)]
if len(天色) != 4:
    错.append(f'读不出天色的四条边界（读到 {天色}）—— 引擎那段的写法变了，先修这支门禁')
else:
    天亮起, 天亮完, 日落起, 夜起 = 天色

# ── 村民语料四段：curTime = (钟 < 5 || 钟 >= 19.5) ? 'night' : …
段 = re.search(r"curTime\s*=\s*\(钟\s*<\s*([\d.]+)\s*\|\|\s*钟\s*>=\s*([\d.]+)\)", 引擎)
if not 段:
    错.append('读不出村民语料的四段边界 —— 引擎那行的写法变了，先修这支门禁')

# ── 问候：const 边界 = [5, 10, …] / const 档 = ['夜深了', …]
边 = re.search(r'const 边界 = \[([^\]]+)\]', 页面)
档 = re.search(r'const 档 = \[([^\]]+)\]', 页面)
问候 = []
if not 边 or not 档:
    错.append('读不出问候语的分档表（边界 / 档）—— 页面那段的写法变了，先修这支门禁')
else:
    数 = [float(x) for x in 边.group(1).replace(' ', '').split(',') if x]
    词 = [w.strip().strip("'") for w in 档.group(1).split(',')]
    if len(词) != len(数) + 1:
        错.append(f'分档表对不上：{len(数)} 条边界该配 {len(数) + 1} 个说法，实际 {len(词)} 个')
    else:
        问候 = list(zip(数, 词))

if not 错:
    夜尽 = 问候[0][0]
    if 夜尽 != 天亮起:
        错.append(f'天亮是 {天亮起} 点，而问候语到 {夜尽} 点才不说「夜深了」')
    if 夜起 not in [h for h, _ in 问候]:
        错.append(f'天全黑是 {夜起} 点，问候语却没有一档在这个点上换 —— '
                  f'那几个钟头屏上会写着傍晚，而村子已经点起灯')
    夜段起 = float(段.group(2))
    夜段尽 = float(段.group(1))
    if 夜段起 != 夜起 or 夜段尽 != 天亮起:
        错.append(f'村民语料的夜是 {夜段尽}–{夜段起}，天色的夜是 {天亮起}–{夜起} —— '
                  f'对不上时会有人在满天星斗下道早安')
    白 = re.search(r'问候档\s*=\s*/\(([^)]+)\)/', 验证)
    if not 白:
        错.append('web/verify.mjs 里找不到 `问候档` 那条白名单 —— 够不着就不算验过')
    else:
        名单 = set(白.group(1).split('|'))
        漏 = [w for _, w in 问候 if w not in 名单]
        if 漏:
            错.append(f'问候语有 {"、".join(sorted(set(漏)))} 这几档，验证脚本的白名单里没有 —— '
                      f'那条断言只在这几个钟头红，最容易被当成偶发噪音')

if 错:
    print('\n'.join('✗ ' + e for e in 错))
    sys.exit(1)
print(f'✓ 昼夜三处对得上（天亮 {天亮起} · 全亮 {天亮完} · 日落 {日落起} · 全黑 {夜起} · '
      f'问候 {len(问候) + 1} 档 · 白名单齐）')
