#!/usr/bin/env python3
"""`str_enum!` 声明的取值，跟库里的 CHECK 约束必须一模一样。

`commerce/mod.rs` 写着「状态字段一律 TEXT + CHECK；enum 只提供 as_str() /
from_str_lax()」，`enums.rs` 开头也写着「与 PG TEXT + CHECK 约束保持一致」。
写着，但没有任何东西在核。

2026-08-19 全量对了一遍 42 个枚举：41 个完全一致，1 个漂了 ——
`FulfillmentKind` 少一项 `residency`，而开发库里 448 个商品正是这种
（御守 → 村民入住那一路）。今天没炸，只因为 domain 的 `Product` 结构体
没有人从库里构造；`from_str_lax("residency")` 一直回 None。

两个方向都要报：
  · 枚举多出来的 —— 写进去会被 CHECK 挡掉，表现成 500
  · 库里多出来的 —— 读出来 `from_str_lax` 回 None，看调用方怎么写，
    轻则当缺省重则报错，而两种都不是本意

映射写死在下面，不猜。每个枚举都得在表里出现，漏一个就报红 ——
不然新加的枚举会静静漏过去，而这一支照样全绿。

用法:
  python3 scripts/check-enum-check.py      读 PSQL_URL / DATABASE_URL，
                                           都没有就退回本机 docker
"""
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENUMS = ROOT / 'backend/unmei-domain/src/commerce/enums.rs'

# 枚举 → 「表.列」。None = 库里这一列没有 CHECK，后面是原因。
MAP = {
    'AccountKind': 'account_chart.kind',
    'BillingPeriod': 'plan.billing_period',
    'CancelActor': 'refund.actor_kind',
    'CancelPolicy': 'plan.cancel_policy',
    'CouponState': 'coupon.state',
    'FulfillmentKind': 'product.fulfillment_kind',
    'InvoiceStatus': 'subscription_invoice.status',
    'JournalEntryStatus': 'journal_entry.status',
    'JournalPostedBy': 'journal_entry.posted_by_kind',
    'LineFulfillmentStatus': 'order_line.fulfillment_status',
    'OrderEventActor': 'order_event.actor_kind',
    'OrderSourceKind': 'order_record.source_kind',
    'OrderStatus': 'order_record.status',
    'OutboxStatus': 'outbox_event.status',
    'PaymentStatus': 'payment.status',
    'PeriodKind': 'accounting_period.kind',
    'PeriodState': 'accounting_period.state',
    'PlanStatus': 'plan.status',
    'PriceStatus': 'price_book.status',
    'PriceTierKind': 'price_book.tier_kind',
    'ProductKind': 'product.kind',
    'ProductStatus': 'product.status',
    'PromotionKind': 'promotion.kind',
    'PromotionStatus': 'promotion.status',
    'ReceiptKind': 'order_record.receipt_kind',
    'ReconBatchStatus': 'recon_batch.status',
    'ReconRecordState': 'recon_record.match_state',
    'ReconSource': 'recon_batch.source',
    'RefundActor': 'refund.actor_kind',
    'RefundStatus': 'refund.status',
    'RiskAction': 'risk_rule.action',
    'RiskCaseSeverity': 'risk_case.severity',
    'RiskCaseState': 'risk_case.state',
    'RiskKind': 'risk_rule.kind',
    'RiskRuleStatus': 'risk_rule.status',
    'ShipmentStatus': 'shipment.status',
    'ShippingMethod': 'shipment.shipping_method',
    'SkuStatus': 'sku.status',
    'StockKind': 'sku.stock_kind',
    'SubscriptionStatus': 'subscription.status',
}



def psql(sql: str) -> str:
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL') or ''
    cmd = (['psql', url, '-tA', '-c', sql] if url else
           ['docker', 'exec', '-i', 'unmei-postgres', 'psql', '-U', 'unmei', '-d', 'unmei',
            '-tA', '-c', sql])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError((r.stderr.strip().split('\n') or [''])[-1][:200])
    return r.stdout


def main() -> int:
    src = ENUMS.read_text(encoding='utf-8')
    enums = {m.group(1): set(re.findall(r'=>\s*"([^"]+)"', m.group(2)))
             for m in re.finditer(r'str_enum!\((\w+)\s*\{(.*?)\}\);', src, re.S)}
    if not enums:
        print(f'✗ 一个 str_enum 都没解析出来（{ENUMS.name}）—— 它的写法变了？这一步没法判。',
              file=sys.stderr)
        return 2

    try:
        out = psql("SELECT conrelid::regclass||'|'||pg_get_constraintdef(oid) "
                   "FROM pg_constraint WHERE contype='c' "
                   "AND pg_get_constraintdef(oid) LIKE '%ANY%';")
    except RuntimeError as e:
        print(f'✗ 连不上库：{e}', file=sys.stderr)
        print('  这一步【没验】。起法见 .claude/CLAUDE.md「打真后端」那一节。', file=sys.stderr)
        return 1
    checks = {}
    for line in out.strip().split('\n'):
        if '|' not in line:
            continue
        tbl, defn = line.split('|', 1)
        col = re.match(r'CHECK \(\((\w+) = ANY', defn)
        if col:
            checks[f'{tbl}.{col.group(1)}'] = set(re.findall(r"'([^']+)'::text", defn))
    if not checks:
        print('✗ 一条 CHECK 都没读出来 —— 库是空的？这一步没法判，不去指控枚举。',
              file=sys.stderr)
        return 2

    unmapped = sorted(set(enums) - set(MAP) - NO_CHECK.keys())
    if unmapped:
        print('✗ 这几个枚举没写进映射表 —— 不写的话它们静静漏过这一支：', file=sys.stderr)
        for n in unmapped:
            print(f'    {n}', file=sys.stderr)
        print('  对得上 CHECK 就写「表.列」，没有 CHECK 就写进 NO_CHECK 并说明为什么。',
              file=sys.stderr)
        return 1
    gone = sorted(set(MAP) - set(enums))
    if gone:
        print('✗ 映射表里这几个枚举已经不存在了，删掉：' + '、'.join(gone), file=sys.stderr)
        return 1

    bad = []
    for name, col in sorted(MAP.items()):
        if col not in checks:
            bad.append(f'{name}　映射到 {col}，而库里没有这条 CHECK')
            continue
        vals, allowed = enums[name], checks[col]
        if vals - allowed:
            bad.append(f'{name}　枚举多出 {sorted(vals - allowed)}（写进去会被 {col} 的 CHECK 挡掉）')
        if allowed - vals:
            bad.append(f'{name}　{col} 的 CHECK 多出 {sorted(allowed - vals)}'
                       f'（读出来 from_str_lax 回 None）')
    if bad:
        print('✗ 枚举与库里的 CHECK 对不上：', file=sys.stderr)
        for b in bad:
            print('    ' + b, file=sys.stderr)
        return 1
    print(f'✓ {len(MAP)} 个枚举跟库里的 CHECK 一字不差'
          f'（另有 {len(NO_CHECK)} 个这一列没有 CHECK，各自记着原因）')
    return 0


# 这几列库里没有 CHECK，各自的原因写在这里 —— 空着的话，将来有人加了 CHECK
# 也不会有人发现这里该跟着改。
NO_CHECK = {
    'ChannelOrigin': 'app_user.platform 等处用它，但那些列没有 CHECK',
    'PaymentChannel': 'payment.channel 没有 CHECK —— 渠道是运行期注册的，见 payment_adapters',
}

sys.exit(main())
