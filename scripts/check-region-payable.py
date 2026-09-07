#!/usr/bin/env python3
"""在卖东西的那一格，得有一条真收得了钱的路。

【这一条是「把桩换成真渠道」那天露出来的】（2026-09-07）。
繁中那一格标价 TWD，而全仓**只有微信一个支付适配器，它只收 CNY** ——
也就是说那一格的每一单都付不出去。

在那之前看不出来，是因为查单那个桩无条件说「已支付」：
一笔付不出去的钱在九十秒内被结成已付，货照发。
**那一格的每一单都是白送的**，而屏上一切正常、门禁一片绿。

判据：库里有在售价的每一个区，都要有一个适配器收得了那个区的币种。
收不了就是「卖得出去、收不到钱」——那比不卖更糟。

【为什么不是「把那几个区的价撤掉」】。撤不撤是产品决定：
接一个能收 TWD 的渠道也解得开这一条。这一支只负责让它**说出来**，
不替谁拍板；台账在 scripts/region-payable-gaps.json，
每一条要写清楚打算怎么办。
"""
import json
import os
import pathlib
import re
import subprocess
import sys

根 = pathlib.Path(__file__).resolve().parent.parent
台账 = 根 / 'scripts/region-payable-gaps.json'


def 问库(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到：{r.stderr.strip()[:200]}')
        sys.exit(2)
    return [l for l in r.stdout.strip().split('\n') if l]


# 适配器收得了哪些币种 —— 从源码读，不写死
收得了 = set()
for f in sorted((根 / 'backend').rglob('adapter.rs')):
    src = f.read_text(encoding='utf-8')
    m = re.search(r'fn supported_currencies\(&self\)\s*->\s*&\'static \[&\'static str\]\s*\{\s*&\[(.*?)\]', src, re.S)
    if m:
        收得了 |= set(re.findall(r'"([A-Z]{3})"', m.group(1)))
if not 收得了:
    print('✗ 一个适配器的币种名单都读不出来 —— 这一支够不着要验的东西')
    sys.exit(1)

在卖的 = 问库(
    """SELECT DISTINCT pb.region, pb.currency
         FROM price_book pb
         JOIN sku s ON s.id = pb.sku_id
         JOIN product p ON p.id = s.product_id
        WHERE pb.status='active' AND s.status='active' AND p.status='listed'
          AND pb.effective_from <= NOW()
          AND (pb.effective_to IS NULL OR pb.effective_to > NOW())
        ORDER BY 1, 2""")

记着的 = json.loads(台账.read_text(encoding='utf-8')) if 台账.exists() else {}
错, 记过 = [], []
for 行 in 在卖的:
    区, 币 = (行.split('|') + [''])[:2]
    if 币 in 收得了:
        continue
    键 = f'{区}/{币}'
    if 键 in 记着的:
        记过.append(f'{键} —— {记着的[键]}')
    else:
        错.append(f'{区} 那一格按 {币} 标价在卖，而没有一个适配器收得了 {币}'
                  f'（收得了的只有 {"、".join(sorted(收得了))}）—— '
                  f'卖得出去、收不到钱')

for e in 记过:
    print(f'  · {e}')
if 错:
    print('✗ 有格子卖得出去而收不到钱：')
    print('\n'.join('    ' + e for e in 错))
    print(f'  要么接一条收得了的渠道，要么把那一格的价撤下来；'
          f'真要先这么放着，记进 {台账.name} 并写清打算怎么办')
    sys.exit(1)
print(f'✓ 在卖的每一格都收得了钱 · 适配器收 {"、".join(sorted(收得了))}'
      + (f' · 台账上 {len(记过)} 条' if 记过 else ''))
