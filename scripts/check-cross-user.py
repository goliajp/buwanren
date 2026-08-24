#!/usr/bin/env python3
"""甲的东西，乙碰不碰得到。

登录挡住的是「谁都能进」，挡不住「进来之后串门」。这一类叫越权，
而它**带着自己的 token 测永远看不出来**——每条接口对自己人都工作正常。

2026-08-18 就是这么撞出一个真的：`POST /v1/user/natals/:id/activate`
的三条 UPDATE 里，前两条带 `user_id`、第三条没有。乙拿甲的 natal_id 调一次，
乙的 `active_natal_id` 就指到了甲那份上——此后乙的签用甲的生辰算，
甲的盘落进乙的档里（村里取盘那条 SQL 也不校验归属）。

做法：开两个匿名用户，甲建东西、乙去碰。**2xx 就是红**。

用法:
  python3 scripts/check-cross-user.py [base]     默认 http://127.0.0.1:6028
"""
import json
import sys
import urllib.error
import urllib.request
import uuid

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:6028').rstrip('/')


def call(path, method='GET', token=None, body=None, idem=None):
    data = json.dumps(body).encode() if body is not None else (b'{}' if method != 'GET' else None)
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header('content-type', 'application/json')
    if token:
        req.add_header('authorization', 'Bearer ' + token)
    if idem:
        req.add_header('idempotency-key', idem)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')
    except Exception as e:
        return 0, str(e)


def anon():
    code, body = call('/v1/auth/anonymous', 'POST', body={})
    if code != 200:
        print(f'✗ 匿名登录失败（HTTP {code}），后面没得验')
        sys.exit(1)
    return json.loads(body)['token']


code, _ = call('/v1/health')
if code != 200:
    print(f'✗ 后端（{BASE}）没起，这一项没法验')
    sys.exit(1)

甲, 乙 = anon(), anon()

# 甲建一份本命、起一卦
code, body = call('/v1/user/natals', 'POST', 甲, {
    'label': '甲的', 'year': 1990, 'month': 3, 'day': 4, 'hour': 5, 'minute': 6,
    'tz': 8.0, 'gender': 'M', 'subject_type': 'person',
}, idem='xuser-' + uuid.uuid4().hex[:12])
if code != 200:
    print(f'✗ 甲建本命失败（HTTP {code}）：{body[:140]}')
    sys.exit(1)
natal_id = json.loads(body)['id']

code, body = call('/v1/naji/spin', 'POST', 甲, {})
naji_id = json.loads(body).get('id') if code == 200 else None

# 甲再下一单 —— 钱那一片最值得探。sku 从公开接口取，不写死种子里的 id
order_id = None
code, body = call('/v1/products')
if code == 200 and json.loads(body):
    pid = json.loads(body)[0]['id']
    code, body = call(f'/v1/products/{pid}')
    skus = json.loads(body).get('skus') if code == 200 else None
    if skus:
        code, body = call('/v1/orders', 'POST', 甲,
                          {'lines': [{'sku_id': skus[0]['id'], 'qty': 1}]},
                          idem='xuser-ord-' + uuid.uuid4().hex[:12])
        if code == 200:
            order_id = json.loads(body).get('order_id')

# (说明, 方法, 路径) —— 乙来碰，全都该被挡
probes = [
    ('读甲的本命简介', 'GET', f'/v1/natal/{natal_id}/summary'),
    ('把甲的本命设成自己的默认', 'POST', f'/v1/user/natals/{natal_id}/activate'),
    ('删掉甲的本命', 'DELETE', f'/v1/user/natals/{natal_id}'),
]
if naji_id:
    probes.append(('读甲的那一卦', 'GET', f'/v1/naji/{naji_id}'))
if order_id:
    probes += [
        ('读甲的订单', 'GET', f'/v1/orders/{order_id}'),
        ('看甲订单的物流', 'GET', f'/v1/orders/{order_id}/shipments'),
        ('取消甲的订单', 'POST', f'/v1/orders/{order_id}/cancel'),
    ]
else:
    print('  · 建不出订单，钱那一片这次没探到（sku 取不到？）')

print('══ 甲的东西，乙碰得到吗 ══')
bad = 0
for what, method, path in probes:
    code, body = call(path, method, 乙)
    # 删除是幂等的：带着归属条件删 0 行，返回 200 也没碰到东西 —— 单独核实
    if method == 'DELETE' and code == 200:
        still, _ = call(f'/v1/natal/{natal_id}/summary', 'GET', 甲)
        if still in (200, 404):     # 甲还看得见它（404 = 盘没算出来，本命仍在）
            print(f'  ✓ {what}　{code}（删了 0 行，甲那份还在）')
            continue
    if code < 300:
        print(f'  ✗ {what}　{code} —— 碰到了')
        bad += 1
    else:
        print(f'  ✓ {what}　{code}')

print()
print(f'探了 {len(probes)} 处 · 碰到了 {bad} 处')
if bad:
    print('✗ 有越权。带着自己的 token 测是看不出来的')
    sys.exit(1)
print('✓ 都碰不到')
