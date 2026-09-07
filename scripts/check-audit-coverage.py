#!/usr/bin/env python3
"""后台的每个写操作都要留下痕。

【为什么要有这一支】——2026-09-03 查到:`audit_log` 表从建库到当天
一条都没写过（`SELECT COUNT(*)` = 0），而整个仓库里没有一处代码写它。
seed 里还留着四条示例行，说明格式当初想清楚了，只是没人接上去。
与此同时后台有十八个写操作:批退款、取消订单、关账、结对账、结风控案子。

留痕这件事**覆盖不全等于没有**:查不到就只能假设它没发生过。
所以这一支不看「有没有写过」，看的是【每一条写路由打一次，
audit_log 就要多一条】——中间件漏掉哪一类，这里当场红。

要真库 + 起着的 admin-api;没有就明说跳过，不算通过。
"""
import json, os, subprocess, sys, urllib.error, urllib.request

BASE = os.environ.get('ADMIN_BASE', 'http://127.0.0.1:6029')
URL = os.environ.get('DATABASE_URL',
                     'postgres://unmei:unmei_dev_pwd@localhost:6032/unmei')


def http(path, method='GET', body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    if token:
        req.add_header('authorization', 'Bearer ' + token)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header('content-type', 'application/json')
    try:
        with urllib.request.urlopen(req, data, timeout=20) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')
    except Exception as e:
        return 0, str(e)


def psql(sql):
    r = subprocess.run(['psql', URL, '-tAc', sql], capture_output=True, text=True, timeout=20)
    return r.stdout.strip() if r.returncode == 0 else None


码, _ = http('/admin/health')
if 码 != 200:
    print(f'— 跳过：admin-api（{BASE}）没起。这一支【没验】，不是通过')
    sys.exit(0)
if psql('SELECT 1') is None:
    print('— 跳过：连不上库。这一支【没验】，不是通过')
    sys.exit(0)

码, 体 = http('/admin/auth/login', 'POST',
              {'email': 'admin@unmei.local', 'password': 'admin123'})
if 码 != 200:
    print(f'✗ 开发种子那对账号登不进去（HTTP {码}）—— 这一支验不下去')
    sys.exit(1)
token = json.loads(体)['token']

# 每一条都是【真会成功】的写操作。造出对象、打一次、看审计多没多一条。
# 用真对象而不是幽灵 id —— 幽灵 id 会 404，而 404 本来就不该留痕。
用例 = []

# ① 发一张券（POST /coupons）
码, 体 = http('/admin/commerce/coupons', 'POST', {
    'code': f'AUDIT{os.getpid()}{int(__import__("time").time())}',
    'benefit_json': {'pct_off_bps': 1000},
    'expires_at': '2027-01-01T00:00:00Z',
}, token)
用例.append(('coupon.create', 码, 体))

# ② 给一张真订单加备注（POST /orders/:id/annotate）
oid = psql("SELECT id FROM order_record ORDER BY created_at DESC LIMIT 1")
if oid:
    码, 体 = http(f'/admin/commerce/orders/{oid}/annotate', 'POST', {'note': '审计门禁'}, token)
    用例.append(('order.annotate', 码, 体))

# ③ 结一条真的对账差异（POST /recon/records/:id/resolve）
rid = psql("SELECT id FROM recon_record WHERE match_state<>'matched' "
           "AND resolved_at IS NULL LIMIT 1")
if rid:
    码, 体 = http(f'/admin/commerce/recon/records/{rid}/resolve', 'POST',
                  {'action': 'known_fee', 'note': '审计门禁'}, token)
    用例.append(('record.resolve', 码, 体))

# 【三条盖不住十八个写操作】（2026-09-04）。上面三条各打一个域：
# 券、订单、对账。而留痕是中间件按【路径最后三段】认出「域.动作」的 ——
# 三个域都能过，不代表第四个域的路径认得出来。
# 再补四个域：物流、支付、风控、商品。加一条就多守一个域。

# ④ 标一张真运单的物流异常（POST /shipments/:id/mark-exception）
sid = psql("SELECT id FROM shipment WHERE status <> 'delivered' LIMIT 1")
if sid:
    码, 体 = http(f'/admin/commerce/shipments/{sid}/mark-exception', 'POST',
                  {'reason': '审计门禁'}, token)
    用例.append(('shipment.mark-exception', 码, 体))

# ⑤ 商品上下架（POST /products/:id/listing）—— 改回原状，见下面
pid = psql("SELECT id FROM product WHERE status='listed' LIMIT 1")
if pid:
    码, 体 = http(f'/admin/commerce/products/{pid}/listing', 'POST',
                  {'status': 'listed'}, token)   # 原样写回，不改变任何东西
    用例.append(('product.listing', 码, 体))

# ⑥ 风控规则开关（POST /risk/rules/:id/state）—— 同样原样写回
rid2 = psql("SELECT id FROM risk_rule LIMIT 1")
if rid2:
    st = psql(f"SELECT status FROM risk_rule WHERE id='{rid2}'")
    if st:
        码, 体 = http(f'/admin/commerce/risk/rules/{rid2}/state', 'POST',
                      {'status': st}, token)
        用例.append(('rule.state', 码, 体))

成功的 = [(名, 码) for 名, 码, _ in 用例 if 200 <= 码 < 300]
# 【一条都没成就不算数】。库空了、路由改了，上面每一条都会跳过，
# 而那跟「全都留痕了」长得一模一样。
# 【下限跟着探针数走】。原先是 2，而现在有六条 ——
# 只要下限还是 2，掉四条也照样过，那正是「探到的太少却看着像全过」。
if len(成功的) < 4:
    print(f'✗ {len(用例)} 条写操作里只成功了 {len(成功的)} 条 —— 这一支现在什么都没验到：')
    for 名, 码, 体 in 用例:
        print(f'    {名} → HTTP {码}  {体[:80]}')
    sys.exit(1)

坏 = []
for 名, _ in 成功的:
    n = psql(f"SELECT COUNT(*) FROM audit_log WHERE action='{名}' "
             f"AND created_at > NOW() - INTERVAL '2 minutes'")
    if not n or int(n) == 0:
        坏.append(名)

if 坏:
    print(f'✗ 这几个写操作成功了，audit_log 里却没有：{"、".join(坏)}')
    print('  留痕覆盖不全等于没有 —— 查不到就只能假设它没发生过')
    sys.exit(1)
print(f'✓ 后台写操作留痕 · {len(成功的)} 条打过去，审计里都找得到')
