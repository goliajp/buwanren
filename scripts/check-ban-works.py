#!/usr/bin/env python3
"""封了的人，真的进不来吗。

【为什么要有这一支】——2026-09-03 查到：`app_user.is_banned` 这一列
从建库起就在，而**没有任何地方写它，也没有任何地方读它**。
后台看着能封，封完那个人照常下单 —— 而客服会以为自己处理完了。

一个建好了却不生效的开关比没有更糟。所以这一支不看「有没有这个接口」，
看的是【封完之后他真的进不来、放开之后又能进】。

要真库 + 两个服务都起着；缺一个就明说跳过，不算通过。
"""
import json, os, subprocess, sys, urllib.error, urllib.request

API = os.environ.get('API_BASE', 'http://127.0.0.1:6028')
ADMIN = os.environ.get('ADMIN_BASE', 'http://127.0.0.1:6029')
URL = os.environ.get('DATABASE_URL',
                     'postgres://unmei:unmei_dev_pwd@localhost:6032/unmei')


def http(base, path, method='GET', body=None, token=None, idem=None):
    req = urllib.request.Request(base + path, method=method)
    if token:
        req.add_header('authorization', 'Bearer ' + token)
    if idem:
        req.add_header('idempotency-key', idem)
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


if http(API, '/v1/health')[0] != 200 or http(ADMIN, '/admin/health')[0] != 200:
    print('— 跳过：两个服务没都起着。这一支【没验】，不是通过')
    sys.exit(0)
if psql('SELECT 1') is None:
    print('— 跳过：连不上库。这一支【没验】，不是通过')
    sys.exit(0)

码, 体 = http(API, '/v1/auth/anonymous', 'POST', {'platform': 'web', 'region': 'cn'})
if 码 != 200:
    print(f'✗ 匿名登录拿不到 token（HTTP {码}）—— 这一支验不下去')
    sys.exit(1)
用户token = json.loads(体)['token']
用户 = psql("SELECT id FROM app_user ORDER BY created_at DESC LIMIT 1")

码, 体 = http(ADMIN, '/admin/auth/login', 'POST',
              {'email': 'admin@unmei.local', 'password': 'admin123'})
if 码 != 200:
    print(f'✗ 后台登不进去（HTTP {码}）')
    sys.exit(1)
后台token = json.loads(体)['token']

import time
def 下单(n):
    return http(API, '/v1/orders', 'POST',
                {'lines': [{'sku_id': 'sku-naji-deep', 'qty': 1}], 'channel_origin': 'web'},
                用户token, idem=f'ban-probe-{time.time_ns()}-{n}')[0]

坏 = []
try:
    if not (200 <= 下单(1) < 300):
        print('✗ 封之前就下不了单 —— 这一支的前提不成立，后面的结论不算数')
        sys.exit(1)

    # 【理由是空的要拒】。只有一个布尔值的话，三个月后没人说得出为什么封
    码, _ = http(ADMIN, f'/admin/users/{用户}/ban', 'POST',
                 {'banned': True, 'reason': '   '}, 后台token)
    if 200 <= 码 < 300:
        坏.append(f'空理由也能封（HTTP {码}）')

    码, _ = http(ADMIN, f'/admin/users/{用户}/ban', 'POST',
                 {'banned': True, 'reason': '门禁探针'}, 后台token)
    if not (200 <= 码 < 300):
        print(f'✗ 封不掉（HTTP {码}）—— 后面的结论不算数')
        sys.exit(1)

    # 【这一条是整支门禁的理由】。在它之前，封完那个人照常下单
    码 = 下单(2)
    if 200 <= 码 < 300:
        坏.append(f'封了还能下单（HTTP {码}）—— 那个开关不生效')
    码 = http(API, '/v1/orders', 'GET', None, 用户token)[0]
    if 200 <= 码 < 300:
        坏.append(f'封了还读得到自己的单（HTTP {码}）')

    码, _ = http(ADMIN, f'/admin/users/{用户}/ban', 'POST',
                 {'banned': False, 'reason': '门禁探针收尾'}, 后台token)
    if not (200 <= 码 < 300):
        坏.append(f'放不回来（HTTP {码}）')
    elif not (200 <= 下单(3) < 300):
        坏.append('放回来之后还是下不了单')
finally:
    # 【无论如何把他放回来】。断言挂了也要收拾干净 ——
    # 留一个封着的用户在开发库里，下一轮别的门禁会撞上它
    if 用户:
        psql(f"UPDATE app_user SET is_banned=FALSE WHERE id='{用户}'")

if 坏:
    print(f'✗ 封禁这条链有 {len(坏)} 处不成立：')
    for x in 坏:
        print('   ' + x)
    print('   一个建好了却不生效的开关比没有更糟 —— 客服会以为自己处理完了')
    sys.exit(1)
print('✓ 封了真的进不来，放开又能进，理由不许空')
