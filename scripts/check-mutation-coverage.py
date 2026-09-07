#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""挂在 gates.sh 上的门禁，有几支是有变异守着的。

【一支永远报绿的核对，比没有核对更糟：它让人以为这件事有人管】——
那句话写在 `mutationtest-checks.sh` 的开头，作为它自己存在的理由。
而它自己覆盖的是八十一支里的三十支（2026-09-03 五路评审 · 门禁审计
数出来的原数是 20/81），剩下五十一支【只在写它们的那一天手动验过一次】，
而那种验证只存在于当时那次会话里。

判据不是「覆盖率要多高」——那是产品决定不了的事，写一条变异有时贵有时便宜。
判的是【不许悄悄变低】：
  · 台账里的某支有了变异 → 红，那一条该划掉
  · 新挂一支门禁而没有变异、也没进台账 → 红
  · 台账里记着一支已经不挂在 gates.sh 上了 → 红，该删掉

也就是说：加门禁的时候必须当场想一次「怎么验它报得出红」，
想不出就写清它靠什么才验得动。这跟 check-admin-roles 的规矩是同一条。
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEDGER = ROOT / 'scripts/mutation-coverage-gaps.json'
# 变异测试分三支：界面/跨目录那一批、SQL 那一支、房间那一批
变异脚本 = [
    'scripts/mutationtest-checks.sh',
    'scripts/mutationtest-sql.sh',
    'rooms/tools/mutationtest.sh',
]


def 挂着的门禁() -> set[str]:
    s = (ROOT / 'scripts/gates.sh').read_text(encoding='utf-8')
    return set(re.findall(r'scripts/(check-[a-z-]+)\.py', s))


def 有变异的() -> set[str]:
    """→ 真有变异守着的那些门禁名。

    只认 `mutate "说明" <被测的门禁>` 这一种形态。
    【不许广谱扫脚本里出现过的门禁名】（2026-09-03 当场踩到）：
    第一版为了照顾 `mutationtest-sql.sh`（整支脚本对着一支门禁来的）
    顺手加了一条 `re.findall(r'check-[a-z-]+')`，而变异的**代码串里**
    也会出现门禁名 —— 给这一支自己写变异时，那条变异要改的
    正是台账里 `check-faces` 那一行，于是 `check-faces` 被算成「有变异」，
    这一支当场报「它有了变异，该划掉」。数错了东西。

    `mutationtest-sql.sh` 那一支单独列出来（它没有 `mutate` 这个形态）。"""
    出 = set()
    for rel in 变异脚本:
        f = ROOT / rel
        if not f.exists():
            continue
        出 |= set(re.findall(r'mutate "[^"]*"\s+([a-zA-Z-]+)', f.read_text(encoding='utf-8')))
    # 整支脚本对着一支门禁来的，写死在这儿 —— 加一支这样的脚本就加一行
    if (ROOT / 'scripts/mutationtest-sql.sh').exists():
        出.add('check-sql')
    return 出


挂着 = 挂着的门禁()
if len(挂着) < 50:
    print(f'✗ 只从 gates.sh 里读出 {len(挂着)} 支门禁（该有八十来支）—— '
          '判据的形状变了？这一支够不着要验的东西', file=sys.stderr)
    sys.exit(1)

有变异 = 有变异的()
if len(有变异) < 10:
    print(f'✗ 变异脚本里只读出 {len(有变异)} 支被测门禁 —— '
          '`mutate` 的写法变了？这一支够不着要验的东西', file=sys.stderr)
    sys.exit(1)

台账 = json.loads(LEDGER.read_text(encoding='utf-8'))
记着的 = 台账['没有变异守着']

缺 = sorted(挂着 - 有变异)
新出现 = [g for g in 缺 if g not in 记着的]
该划掉 = sorted(g for g in 记着的 if g in 有变异)
已下架 = sorted(g for g in 记着的 if g not in 挂着)
没写理由 = sorted(g for g, why in 记着的.items() if not str(why).strip())

坏 = []
for g in 新出现:
    坏.append(f'{g}　挂在门禁上，而没有一条变异守着它 —— '
              '写一条，或者记进台账并写清它靠什么才验得动')
for g in 该划掉:
    坏.append(f'{g}　台账说它没有变异，而现在有了 —— 把这一条划掉')
for g in 已下架:
    坏.append(f'{g}　台账里记着，而 gates.sh 上已经没有它 —— 台账要跟着改')
for g in 没写理由:
    坏.append(f'{g}　台账里没写理由 —— 「暂时没写」不算理由，那是欠账不是决定')

if 坏:
    print('✗ 变异覆盖的账对不上：', file=sys.stderr)
    for b in 坏:
        print('    ' + b, file=sys.stderr)
    print(f'  台账在 {LEDGER.name}。', file=sys.stderr)
    sys.exit(1)

print(f'✓ 门禁 {len(挂着)} 支 · 有变异守着 {len(挂着) - len(缺)} 支 · '
      f'其余 {len(缺)} 支都在台账上')
