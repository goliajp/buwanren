#!/usr/bin/env python3
"""前端类型里声明的字段，真响应里到底有没有 —— 打真后端问一遍。

`check-api-shape.py` 是【静态】比对：从路由里把 `json!({ … })` 的键抠出来，
跟 TS 接口比。它抓得住手写响应体的那些，抓不住 `map_rows(rows)` ——
那一路的键来自 SQL 的列，源码里根本没有键名。

而钱那条链（订单、支付、物流、退款）整片走的都是 `map_rows`。
2026-08-28 就在那儿吃了一次：`types/commerce.ts` 的 `OrderLine` 声明了
顶层 `sku_name`，后端只在 `sku_snapshot_json` 里有它 ——
**每一单的商品名都显示成 sku_id**（`sku-oma-t46166-13`），
不报错、不留白，就是一串编号，从截图上才看见。

所以这一支换个问法:不猜 SQL，直接打真后端，看响应里键在不在。

判据是【键在不在】，不看值：`"paid_at": null` 是键在值为空，那是正常的；
键根本不在，才是「前端在读一个永远 undefined 的东西」。

  · TS 有、响应没有 → 红（除非台账里记着理由）
  · 响应有、TS 没有 → 只提示（后端多给一点不是错，但值得看一眼是不是漏接了）

用法: python3 scripts/check-api-shape-live.py [--base=http://127.0.0.1:6028]
"""
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
LEDGER = ROOT / 'scripts/api-shape-live-gaps.json'

BASE = 'http://127.0.0.1:6028'
for a in sys.argv[1:]:
    if a.startswith('--base='):
        BASE = a.split('=', 1)[1].rstrip('/')


def ts_body(src, iface):
    m = re.search(r'export interface ' + re.escape(iface) + r'\b[^{]*\{', src)
    if not m:
        return None
    depth, i = 1, m.end()
    while i < len(src) and depth:
        if src[i] == '{':
            depth += 1
        elif src[i] == '}':
            depth -= 1
        i += 1
    return re.sub(r'//[^\n]*', '', src[m.end(): i - 1])


def ts_fields(path, iface):
    """接口里【第一层】的字段名。嵌套对象里的不算 —— 那是另一个形状的事。"""
    src = (ROOT / path).read_text(encoding='utf-8')
    body = ts_body(src, iface)
    if body is None:
        return None
    # 去掉嵌套的 { … }，免得把内层字段当成第一层
    flat, depth = [], 0
    for ch in body:
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
        elif depth == 0:
            flat.append(ch)
    return set(re.findall(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\??\s*:', ''.join(flat), re.M))


def http(path, method='GET', body=None, token=None, extra=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header('content-type', 'application/json')
    if token:
        req.add_header('authorization', 'Bearer ' + token)
    for k, v in (extra or {}).items():
        req.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=15) as r:
            return r.status, json.loads(r.read().decode() or 'null')
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return 0, None


code, _ = http('/v1/health')
if code != 200:
    # 【不返回 0】。没跑成不是通过 —— 报绿的话，后端一没起这一支就
    # 天天「绿」，而它一个形状都没比。判「跑不跑得成」是 gates.sh 的事
    # （它探完端口再决定 gate 还是 skip），这里只负责不冒充。
    print(f'· 后端（{BASE}）没起 —— 这一支【没验】，不是通过')
    sys.exit(2)

code, body = http('/v1/auth/anonymous', 'POST', {})
if code != 200 or not body or not body.get('token'):
    print(f'✗ 登不上（HTTP {code}）—— 这一支验不成')
    sys.exit(1)
TOKEN = body['token']

# 建一张真订单：钱那条链的形状要有数据才问得出来
_, prods = http('/v1/products?region=cn&platform=mini&category=report', token=TOKEN)
sku = None
if isinstance(prods, list) and prods:
    _, detail = http(f'/v1/products/{prods[0]["id"]}?region=cn&platform=mini', token=TOKEN)
    skus = (detail or {}).get('skus') or []
    if skus:
        sku = skus[0]['id']
ORDER = None
if sku:
    code, made = http('/v1/orders', 'POST',
                      {'lines': [{'sku_id': sku, 'qty': 1}], 'region': 'cn'},
                      token=TOKEN, extra={'idempotency-key': 'shapelive-probe'})
    if code == 200 and made:
        ORDER = made.get('order_id')

# (说明, 取响应里的哪一块, TS 文件, 接口名)
def 取(d, *ks):
    for k in ks:
        if d is None:
            return None
        d = d.get(k) if isinstance(d, dict) else None
    return d

CASES = [
    ('GET /v1/user/me', lambda: http('/v1/user/me', token=TOKEN)[1],
     'mini/miniprogram/types/auth.ts', 'UserPublic'),
    ('GET /v1/village', lambda: http('/v1/village', token=TOKEN)[1],
     'mini/miniprogram/types/village.ts', 'MyVillage'),
    ('GET /v1/village → villagers[]', lambda: (取(http('/v1/village', token=TOKEN)[1], 'villagers') or [None])[0],
     'mini/miniprogram/types/village.ts', 'VillagerInVillage'),
    ('GET /v1/villagers → []', lambda: (http('/v1/villagers', token=TOKEN)[1] or [None])[0],
     'mini/miniprogram/types/village.ts', 'VillagerCard'),
    ('GET /v1/orders', lambda: http('/v1/orders', token=TOKEN)[1],
     'mini/miniprogram/types/commerce.ts', 'OrderPage'),
    ('GET /v1/orders → items[]', lambda: (取(http('/v1/orders', token=TOKEN)[1], 'items') or [None])[0],
     'mini/miniprogram/types/commerce.ts', 'OrderCard'),
    ('GET /v1/orders/:id', lambda: http(f'/v1/orders/{ORDER}', token=TOKEN)[1] if ORDER else None,
     'mini/miniprogram/types/commerce.ts', 'OrderDetail'),
    ('GET /v1/orders/:id → lines[]',
     lambda: (取(http(f'/v1/orders/{ORDER}', token=TOKEN)[1], 'lines') or [None])[0] if ORDER else None,
     'mini/miniprogram/types/commerce.ts', 'OrderLine'),
]

led = json.loads(LEDGER.read_text(encoding='utf-8')) if LEDGER.exists() else {}
记着 = {k: v for k, v in led.items() if not k.startswith('_')}

bad = 0
比过 = 0
for 说明, 取响应, ts_path, iface in CASES:
    want = ts_fields(ts_path, iface)
    if want is None:
        print(f'✗ {ts_path} 里没有 interface {iface} —— 这道核对已经失效')
        bad += 1
        continue
    if not want:
        print(f'✗ interface {iface} 一个字段都没解析到 —— 解析对不上了')
        bad += 1
        continue
    got = 取响应()
    if got is None:
        print(f'  · {说明} 取不到样本（{iface}）—— 这一条【没验】')
        continue
    if not isinstance(got, dict):
        print(f'✗ {说明} 拿到的不是对象（{type(got).__name__}）—— 取的地方不对')
        bad += 1
        continue
    比过 += 1
    有 = set(got.keys())
    缺 = sorted(want - 有)
    多 = sorted(有 - want)
    for f in 缺:
        key = f'{iface}.{f}'
        if key in 记着:
            print(f'  · {key} 响应里没有 —— {记着[key][:42]}…')
        else:
            print(f'✗ {说明}　`{iface}.{f}` 前端声明了，真响应里【没有这个键】')
            print(f'   前端读它永远是 undefined。要么后端补上，要么删掉这个声明，')
            print(f'   要么记进 scripts/api-shape-live-gaps.json 并写明为什么')
            bad += 1
    if 多:
        print(f'  · {说明} 后端多给了：{" ".join(多[:6])}')

for key in 记着:
    iface = key.split('.')[0]
    if not any(c[3] == iface for c in CASES):
        print(f'✗ 台账里记着 {key}，但没有一条用例比对 {iface} —— 台账要跟着改')
        bad += 1

print()
print(f'比过 {比过} 个形状 · 问题 {bad} 处')
if bad:
    sys.exit(1)
print('✓ 前端声明的字段，真响应里都有')
