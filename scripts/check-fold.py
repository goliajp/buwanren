#!/usr/bin/env python3
"""截屏那一趟量到的高度，拿台账核一遍。

**数据一直在，只是没人读**。`web/shots.mjs` 每一轮都量 36 屏的内容高度、
写进 `measure.json`，还在收尾打一行「⚠ 这几屏一屏放不下」——
而 `gates.sh` 把它的标准输出丢进 `/dev/null`。于是 2026-09-06 这一天：

  · `product`（苏合香那一屏）超 95px
  · `product-oma`（御守那一屏）超 64px

两屏都是【买家真正落脚的那一屏】，两屏都没有任何东西红。

动线那一支（`web/verify.mjs`）确实照着 `web/oversize-pages.json` 判，
但它每一屏只开【一个】商品 —— 这一趟挑中哪一件由数据说了算。
挑中的是纳吉深报（放得下），于是它一直报「product 放得下（余 0px）」，
跟截屏那一趟的「超 95px」并排存在，说的是同一个页面模板的两件商品。
**一个模板量一件商品，等于没量。**

判据跟动线那一支一字不差（同一份台账，同三条规矩）：

  · 不在台账里的屏超了      → 红（新写的屏必须一屏放得下）
  · 台账里的屏超过记着的数  → 红（欠账只许缩）
  · 台账里的屏已经放得下了  → 红（那一条该划掉，否则台账会烂）

用法: SHOTS_DIR=<截屏目录> python3 scripts/check-fold.py
"""
import json
import os
import pathlib
import sys

根 = pathlib.Path(__file__).resolve().parent.parent
量文件 = pathlib.Path(os.environ.get('SHOTS_DIR', '/tmp/shots')) / 'measure.json'
台账文件 = 根 / 'web/oversize-pages.json'

if not 量文件.exists():
    print(f'✗ 读不到 {量文件} —— 这一支要先跑截屏那一趟')
    sys.exit(1)
量 = json.loads(量文件.read_text(encoding='utf-8'))
台账 = {k: v for k, v in json.loads(台账文件.read_text(encoding='utf-8')).items()
        if not k.startswith('_')}

# 政策那两屏是文件，长是本分 —— 它们在台账里以 `policy` 一条记着,
# 而截屏那一趟把它们截成两屏（隐私 / 协议）。名字对上。
别名 = {'policy-privacy': 'policy', 'policy-terms': 'policy'}

错 = []
超了 = {}
for 名, v in sorted(量.items()):
    高 = v.get('内容高')
    视 = (v.get('视口') or {}).get('高')
    if 高 is None or 视 is None:
        print(f'✗ {名} 那一条没有内容高 / 视口 —— measure.json 是旧的，'
              f'或 shots.mjs 那一段被拿掉了')
        sys.exit(1)
    if 高 > 视:
        超了[别名.get(名, 名)] = max(超了.get(别名.get(名, 名), 0), 高 - 视)

for 名, 溢 in sorted(超了.items()):
    记 = 台账.get(名)
    if 记 is None:
        错.append(f'{名} 一屏放不下（超 {溢}px），而台账里没有这一条 —— '
                 f'新写的屏必须一屏放得下；真改不了就记进 '
                 f'web/oversize-pages.json 并写清为什么')
    elif 溢 > 记['超']:
        错.append(f'{名} 超 {溢}px，台账记的是 {记["超"]}px —— 欠账只许缩')

for 名, 记 in sorted(台账.items()):
    if 名 not in 超了:
        错.append(f'台账里记着 {名} 超 {记["超"]}px，而这一趟它一屏放得下 —— '
                 f'把这一条划掉，否则台账会烂')

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ')
      + f'截屏量到的 {len(量)} 屏跟台账对得上 · 超出的 {len(超了)} 屏都记着')
sys.exit(1 if 错 else 0)
