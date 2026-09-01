#!/usr/bin/env python3
"""说明书里不许原样转发排盘写的推理。

排盘（mingli）给的 `reasoning` 是文言:
  「日主辛偏弱（综合 36），宜以助身五行扶之；印星土双重作用（生身+化杀）
   优先，比劫金副选。忌官杀火克身、财木损印。」
行话在这一册里是允许的 —— 这是它唯一的家;**文言不是**。
而 2026-09-01 之前，用神那一页正是把这句原样渲上屏的:
一册六页，隔壁「格局」「大运」都是自己写的，唯独这一页转发上游，
而它恰恰是整个产品挂在上面的那句答案。

判据:report.rs 里给渲染字段（quote / lead / v / title）赋值时，
不许直接取 `reasoning`。要用它就自己改写一段（照 `用神怎么读` 那样）。
"""
import re, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
f = 根 / 'backend/unmei-api/src/routes/report.rs'
if not f.exists():
    print('✗ 找不到 report.rs —— 这一支够不着要验的东西')
    sys.exit(1)
s = f.read_text(encoding='utf-8')
净 = re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), s, flags=re.S)
净 = re.sub(r'//[^\n]*', lambda m: ' ' * len(m.group(0)), 净)

# 页面上会渲出来的字段
渲染字段 = ('quote', 'lead', 'title', 'v', 'k', 'note')
错, 查过 = [], 0
for m in re.finditer(r'"(\w+)"\s*:\s*([^,\n]*(?:\n[^,\n]*)?)', 净):
    键, 值 = m.group(1), m.group(2)
    if 键 not in 渲染字段:
        continue
    查过 += 1
    if 'reasoning' in 值:
        行 = 净[:m.start()].count('\n') + 1
        错.append(f'report.rs:{行}　"{键}" 直接取了排盘的 reasoning —— '
                  f'那是文言，这一册只许留行话：{值.strip()[:50]}')
if 查过 < 5:
    print(f'✗ 只找到 {查过} 处渲染字段赋值 —— 这一支多半在空转')
    sys.exit(1)
for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'说明书没有原样转发排盘的推理 · 查了 {查过} 处渲染字段')
sys.exit(1 if 错 else 0)
