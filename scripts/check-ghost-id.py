#!/usr/bin/env python3
"""不存在的 id，写操作必须报错，不许回 200 ok:true。

后台上 id 打错一个字符，返回 `{"ok": true}`，页面提示「已保存」——
而库里一行没动。这一类在这个仓库里出现过三次，形状每次一样：
**规矩在用例层里守着，绕过那一层直接在路由里写 SQL 的就没守。**

2026-08-19 全量探了 17 条带 :参数 的后台写路由：14 条正确 404（outbox 那条
409，它连状态一起说了），3 条回 200 —— 签词改、签词删、开关改，
正是仅有的三条不走 `unmei-app` 的。

做法：每条路由拿一个不可能存在的 id 打一次，**2xx 就是红**。
路由清单从源码读，探测表里少了哪条也报红 —— 不然新加的路由会静静漏掉，
而这一支照样全绿。

用户侧那 6 条同一天探过，全部正确 404（本命那两条是当天修的）。
两边都在这里守着，因为「后台守住了」跟「用户侧守住了」是两件事。

用法:
  python3 scripts/check-ghost-id.py [admin_base] [api_base]
  默认 http://127.0.0.1:6029 与 http://127.0.0.1:6028
"""
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
ADMIN = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:6029').rstrip('/')
API = (sys.argv[2] if len(sys.argv) > 2 else 'http://127.0.0.1:6028').rstrip('/')
GHOST = 'zzz-ghost-id-that-cannot-exist'

# (方法, 路由模板, 请求体) —— 请求体要合法，否则 422 掉在反序列化上，
# 探的就不是「id 不存在」而是「字段不对」。2026-08-19 我第一遍就这么错了
# 六条，看着像六条都守住了。
ADMIN_PROBES = [
    ('DELETE', '/admin/quotes/:id', {}),
    ('PATCH', '/admin/quotes/:id', {'status': 'published'}),
    ('PATCH', '/admin/feature_flags/:code', {'default_on': True}),
    ('POST', '/admin/commerce/orders/:id/annotate', {'note': 'x'}),
    ('POST', '/admin/commerce/orders/:id/cancel', {'reason': 'x'}),
    ('POST', '/admin/commerce/outbox/:id/retry', {}),
    ('POST', '/admin/commerce/payments/:id/mark-failed', {'code': 'x', 'msg': 'y'}),
    ('POST', '/admin/commerce/pricing/:sku_id/publish', {'currency': 'CNY', 'price_minor': 100}),
    ('POST', '/admin/commerce/pricing/expire/:id', {}),
    ('POST', '/admin/commerce/products/:id/listing', {'status': 'listed'}),
    ('POST', '/admin/commerce/promotions/:id/state', {'status': 'active'}),
    ('POST', '/admin/commerce/refunds/:id/approve', {}),
    ('POST', '/admin/commerce/refunds/:id/deny', {'reason': 'x'}),
    ('POST', '/admin/commerce/risk/rules/:id/state', {'status': 'active'}),
    ('POST', '/admin/commerce/shipments/:id/assign-tracking',
     {'carrier_code': 'sf', 'tracking_no': '1'}),
    ('POST', '/admin/commerce/shipments/:id/mark-exception', {'reason': 'x'}),
    ('POST', '/admin/commerce/subscriptions/:id/cancel', {'immediate': False}),
]


USER_PROBES = [
    ('DELETE', '/v1/user/natals/:id', {}),
    ('POST', '/v1/user/natals/:id/activate', {}),
    ('POST', '/v1/orders/:id/cancel', {}),
    ('POST', '/v1/orders/:id/pay', {'channel': 'wechat_jsapi'}),
    ('POST', '/v1/orders/:id/refund', {'reason_code': 'x'}),
    ('POST', '/v1/villagers/:id/reading', {'question': 'x'}),
]

# 承运商回调不在此列：`:provider` 不是某样东西的 id，是渠道名，
# 而回调的契约本来就是「认不出就别声张」。拿它当资源探等于换了个判据。
USER_SKIP = {('POST', '/v1/webhooks/carrier/:provider')}


def declared_routes(rel):
    out = set()
    for f in (ROOT / rel).rglob('*.rs'):
        src = f.read_text(encoding='utf-8')
        for m in re.finditer(r'\.route\(\s*"([^"]+)"\s*,\s*(.+?)\)\s*$', src, re.M):
            path, handlers = m.group(1), m.group(2)
            if ':' not in path:
                continue
            for verb in re.findall(r'\b(post|patch|put|delete)\(', handlers):
                out.add((verb.upper(), path))
    return out


def call(base, method, path, token, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(base + path, data=data, method=method)
    req.add_header('content-type', 'application/json')
    req.add_header('authorization', 'Bearer ' + token)
    req.add_header('idempotency-key', 'ghost-probe-' + path.replace('/', '-'))
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read(200).decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read(200).decode('utf-8', 'replace')


def login(base, path, body, pick):
    req = urllib.request.Request(base + path, data=json.dumps(body).encode(), method='POST')
    req.add_header('content-type', 'application/json')
    with urllib.request.urlopen(req, timeout=10) as r:
        return pick(json.loads(r.read()))


def suite(name, base, rel, probes, skip, token):
    """返回 (是否通过, 已探条数)。够不到 / 清单对不上都算不通过。"""
    declared = declared_routes(rel) - skip
    if not declared:
        print(f'✗ {name}：一条带参数的写路由都没解析出来 —— 路由的写法变了？这一步没法判。',
              file=sys.stderr)
        return False, 0
    covered = {(m, p) for m, p, _ in probes}
    for label, diff in (('没进探测表 —— 不补上的话它们静静漏过这一支', declared - covered),
                        ('在探测表里但路由已经不存在了，删掉', covered - declared)):
        if diff:
            print(f'✗ {name}：这几条{label}：', file=sys.stderr)
            for m, p in sorted(diff):
                print(f'    {m} {p}', file=sys.stderr)
            return False, 0

    bad = []
    for method, tmpl, body in probes:
        path = re.sub(r':\w+', GHOST, tmpl)
        code, text = call(base, method, path, token, body)
        if 200 <= code < 300:
            bad.append(f'{method} {tmpl}\u3000回了 {code} {text[:60]}')
    if bad:
        print(f'✗ {name}：这几条对着不存在的 id 也说成功了：', file=sys.stderr)
        for b in bad:
            print('    ' + b, file=sys.stderr)
        print('  影响行数为 0 就报 404 —— 页面上「已保存」而库里一行没动，', file=sys.stderr)
        print('  比直接报错糟得多。', file=sys.stderr)
        return False, len(probes)
    return True, len(probes)


def main() -> int:
    try:
        admin_token = login(ADMIN, '/admin/auth/login',
                            {'email': 'admin@unmei.local', 'password': 'admin123'},
                            lambda j: j['token'])
    except Exception as e:  # noqa: BLE001 —— 够不到就说够不到，不去打分
        print(f'✗ 登不进后台（{ADMIN}）：{e}', file=sys.stderr)
        print('  起法见 .claude/CLAUDE.md「打真后端」那一节。这一步【没验】。', file=sys.stderr)
        return 1
    try:
        user_token = login(API, '/v1/auth/anonymous', {'region': 'cn'}, lambda j: j['token'])
    except Exception as e:  # noqa: BLE001
        print(f'✗ 拿不到匿名 token（{API}）：{e}', file=sys.stderr)
        print('  这一步【没验】。', file=sys.stderr)
        return 1

    ok_a, n_a = suite('后台', ADMIN, 'backend/unmei-admin-api/src', ADMIN_PROBES, set(), admin_token)
    ok_u, n_u = suite('用户侧', API, 'backend/unmei-api/src', USER_PROBES, USER_SKIP, user_token)
    if not (ok_a and ok_u):
        return 1
    print(f'✓ 后台 {n_a} 条 + 用户侧 {n_u} 条写路由，对不存在的 id 都不说成功')
    return 0


sys.exit(main())
