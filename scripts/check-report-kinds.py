#!/usr/bin/env python3
"""在售的报告商品，履约都得真出得了那一种册子。

2026-08-28 出册子那一版把种类写死成 `bazi_deep`，于是三个在售的
`async_compute` 商品里只有一个对得上 —— 买「合婚双盘报告」和
「问事一卦」的人都拿到一份自己的八字册子。**答非所问比什么都不给更糟**：
什么都不给，买家知道东西没到；给了个不对的，他会以为这就是他买的东西。

库里那道 CHECK（`product_listed_report_kind`）拦的是「上架了却没说出哪一种」。
这一支管另一半：**说了的那一种，代码里真做得出来吗**。

两个方向都报：
  · 商品标了、代码不认识 → 红（买家会付钱买一个出不来的东西）
  · 代码认识、没有任何在售商品用 → 只提示（先写实现后上架是对的顺序）

用法: python3 scripts/check-report-kinds.py   读 PSQL_URL / DATABASE_URL，
                                              都没有就退回本机 docker
"""
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPORT_RS = ROOT / 'backend/unmei-app/src/report.rs'


def psql(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到：{r.stderr.strip()[:200]}')
        sys.exit(2)
    return [l for l in r.stdout.strip().split('\n') if l]


src = REPORT_RS.read_text(encoding='utf-8')
m = re.search(r'出得了的册子:\s*&\[&str\]\s*=\s*&\[(.*?)\]', src, re.S)
if not m:
    print('✗ report.rs 里读不出那张白名单 —— 这道核对已经够不着它要管的东西')
    sys.exit(1)
认识的 = set(re.findall(r'"([^"]+)"', m.group(1)))
if not 认识的:
    print('✗ 白名单是空的 —— 解析对不上了')
    sys.exit(1)

# 库里那道 CHECK 也要在。它管的是另一半（上架却没说出哪一种），
# 被人删掉的话这一支照样全绿，而漏进来的商品谁也拦不住
有约束 = psql("SELECT 1 FROM pg_constraint WHERE conname='product_listed_report_kind'")
if not 有约束:
    print('✗ 库里没有 product_listed_report_kind 这道 CHECK —— 「上架却没说出哪一种」就没人拦了')
    sys.exit(1)

在售 = [tuple(l.split('|')) for l in psql(
    "SELECT id, COALESCE(report_kind,'') FROM product "
    "WHERE fulfillment_kind='async_compute' AND status='listed' ORDER BY id")]

bad = 0
for pid, kind in 在售:
    if not kind:
        # CHECK 本该拦住,能走到这儿说明约束被绕过了(直连改库 / 约束没生效)
        print(f'✗ {pid} 在售，却没说出哪一种册子')
        bad += 1
    elif kind not in 认识的:
        print(f'✗ {pid} 在售，标的是 `{kind}` —— 而履约做不出这一种')
        print(f'   买家会付钱买一个出不来的东西。要么把它实现了（'
              f'report.rs 的白名单 + 排页），要么把这件商品下架')
        bad += 1

用着的 = {k for _, k in 在售 if k}
for k in sorted(认识的 - 用着的):
    print(f'  · `{k}` 做得出来，但没有在售商品用它 —— 先写实现后上架是对的顺序')

print()
print(f'在售的报告商品 {len(在售)} 件 · 做得出来的册子 {len(认识的)} 种 · 问题 {bad} 处')
if bad:
    sys.exit(1)
print('✓ 在售的报告，履约都出得了')
