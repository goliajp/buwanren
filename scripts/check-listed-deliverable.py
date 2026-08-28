#!/usr/bin/env python3
"""在售的东西，付了钱都得真给得出来。

这个仓库栽在这件事上三次，形状一模一样：**商品上架了，履约那一头是空的**。

  · 报告（`async_compute`）—— 付完钱标 done、`fulfillment_ref` 写
    `{"mocked": true}`，客户端连一条读它的路都没有（2026-08-28 补上）
  · 合婚 / 问事一卦 —— 出册子那版把种类写死成 `bazi_deep`，
    于是这两件的买家都拿到一份自己的八字册子（同日下架）
  · 黄金会员 —— 实测走完整条链：订单 `done`，而 `subscription` 表一条没多。
    `unmei_app::subscription` 根本没有 create（同日下架）

三次都是**人读代码才发现的**。所以这一支把「上架了给不出」变成机器判得了的。

**答非所问比什么都不给更糟**：什么都不给，买家知道东西没到；
给了个不对的，他会以为这就是他买的东西。

管两类：

  报告类（`fulfillment_kind='async_compute'`）
    库里那道 CHECK（`product_listed_report_kind`）拦「上架了却没说出哪一种」，
    这里拦另一半：**说了的那一种，代码里真做得出来吗**

  订阅类（`product.kind='subscription'`）
    履约按 `fulfillment_kind` 分支，而它没有一支会开通订阅 ——
    所以在售的订阅商品一律红，直到那一支存在

用法: python3 scripts/check-listed-deliverable.py   读 PSQL_URL / DATABASE_URL，
                                                    都没有就退回本机 docker
"""
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPORT_RS = ROOT / 'backend/unmei-app/src/report.rs'
FULFILLMENT_RS = ROOT / 'backend/unmei-app/src/fulfillment.rs'
SUBSCRIPTION_RS = ROOT / 'backend/unmei-app/src/subscription.rs'


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

# ── 订阅类 ────────────────────────────────────────────────────────
#
# 履约按 `fulfillment_kind` 分支。会员卡的是 `instant`，于是它跟别的即时
# 商品走同一支：标 done，完事 —— `subscription` 表一条不多。
# 2026-08-28 实测走完整条链证过一遍，不是读代码猜的。
#
# 判据看的是【履约里有没有一支会开通订阅】。有了再放行,
# 而不是等哪天有人上架会员卡、买家付完钱才发现。
#
# 两个条件都要:履约里有那一支,且用例层真有开通这个动作。
# 只看前者的话,一个空分支就骗得过它（实测过 —— 塞一句
# `"subscription" => { unreachable!() }` 它就放行了）。
#
# 判据的限度写在这儿:它拦得住「压根没做」,拦不住「做了个空壳」。
# 后者要靠 unmei-app 的集成测试 —— 而那正是开通做出来时该一起写的。
有分支 = '"subscription" =>' in FULFILLMENT_RS.read_text(encoding='utf-8')
有开通 = bool(re.search(r'pub async fn create\b', SUBSCRIPTION_RS.read_text(encoding='utf-8')))
开得通 = 有分支 and 有开通
订阅在售 = psql("SELECT id FROM product WHERE kind='subscription' AND status='listed'")
if not 开得通:
    for pid in 订阅在售:
        print(f'✗ {pid} 是订阅商品且在售，而履约里没有开通订阅那一支')
        print(f'   买家付完钱订单会翻 done，而 subscription 表一条不多。')
        print(f'   要么把开通做出来（unmei_app::subscription 现在只有 cancel /')
        print(f'   renew_due / record_renewal_failure，没有 create），要么下架它')
        bad += 1
elif not 订阅在售:
    print('  · 履约开得通订阅，但没有在售的订阅商品')

print()
print(f'在售 · 报告 {len(在售)} 件、订阅 {len(订阅在售)} 件 · '
      f'做得出来的册子 {len(认识的)} 种 · 问题 {bad} 处')
if bad:
    sys.exit(1)
print('✓ 在售的东西，付了钱都给得出来')
