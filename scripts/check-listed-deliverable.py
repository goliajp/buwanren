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

  御守类（`fulfillment_kind='residency'`）
    履约那一支要拿 `sku.villager_id` 才知道搬谁进来;为空就只能把行留在
    pending，于是单子永远停在 `fulfilling`、钱已经收了。
    2026-09-02 第四轮评审实测:883 件在架的居住 SKU 里 **45 件没挂人**，
    拿其中一件建单回 200、收 ¥99。这一支原先只看报告与订阅两类，
    第三类是它自己文档里那句「上架了、履约那一头是空的」的同一种病。

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

# ── 实物:寄到家的东西要有商品图 ────────────────────────────
# 「¥398 的和田玉葫芦坠，整页唯一的图是店主头像」——
# 电商漏斗里最该有图的地方是空的，比任何排版问题都更像「没做完」
# （2026-09-02 第四轮评审，第一次来的人与视觉两路各自报了同一条）。
# 判据只管【实物】:数字内容配张图反而是在暗示会寄东西给你。
没图 = psql(
    "SELECT id FROM product WHERE status='listed' AND fulfillment_kind='shipping' "
    "  AND (hero_image_url IS NULL OR hero_image_url='') ORDER BY id")
for pid in 没图:
    print(f'✗ {pid} 是寄到家的实物且在架，而它没有商品图（hero_image_url 空）')
    print(f'   买家看不见自己要买的东西长什么样。图画在')
    print(f'   rooms/tools/export-tabicons.mjs 的「商品」那一段，跟徽章一处。')
    bad += 1
实物在架 = psql(
    "SELECT count(*) FROM product WHERE status='listed' AND fulfillment_kind='shipping'")
n实物 = int(实物在架[0]) if 实物在架 else 0

# ── 御守:在架的居住 SKU 都得说出搬谁进来 ────────────────────
没挂人 = psql(
    "SELECT s.id FROM sku s JOIN product p ON p.id = s.product_id "
    "WHERE p.status='listed' AND p.fulfillment_kind='residency' "
    "  AND s.villager_id IS NULL ORDER BY s.id")
for sid in 没挂人:
    print(f'✗ {sid} 在架，而它没说搬谁进来（sku.villager_id 为空）')
    print(f'   付了钱履约拿不到人，行留在 pending、单子永远停在 fulfilling。')
    print(f'   要么把 villager_id 补上，要么把它下架。')
    bad += 1
居住在架 = psql(
    "SELECT count(*) FROM sku s JOIN product p ON p.id = s.product_id "
    "WHERE p.status='listed' AND p.fulfillment_kind='residency'")
n居住 = int(居住在架[0]) if 居住在架 else 0
if n居住 == 0:
    print('✗ 一件在架的居住商品都没查到 —— 这一支多半在空转')
    sys.exit(1)

print()
print(f'在售 · 报告 {len(在售)} 件、订阅 {len(订阅在售)} 件、御守 {n居住} 件、'
      f'实物 {n实物} 件 · '
      f'做得出来的册子 {len(认识的)} 种 · 问题 {bad} 处')
if bad:
    sys.exit(1)
print('✓ 在售的东西，付了钱都给得出来')
