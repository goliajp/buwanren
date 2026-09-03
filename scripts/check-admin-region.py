#!/usr/bin/env python3
"""管这个区的管理员，碰不碰得到别的区。

【为什么要有这一支】——2026-09-03 查到：`region_scope` 登录时写进 token、
前端拿它筛区域下拉框，而**后端一处都不校验**。实测：造一个
`region_scope = {hk}` 的管理员，`GET /orders?region=cn` 拿到大陆全部
18,490 笔；`POST /orders/<一张大陆的单>/annotate` 回 200。

跟 `check-cross-user.py` 是同一类：**带着自己的 token 测永远看不出来**——
super 干什么都通，而开发和门禁用的一直是 super。
所以这一支专门造一个只管一个区的管理员，让他去碰别的区。

判据：**2xx 就是红**。
"""
import json, os, subprocess, sys, urllib.error, urllib.request

BASE = os.environ.get('ADMIN_BASE', 'http://127.0.0.1:6029')
URL = os.environ.get('DATABASE_URL',
                     'postgres://unmei:unmei_dev_pwd@localhost:6032/unmei')
# 这个区必须【不是】下面那些对象所在的区
外人区 = 'hk'


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
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def psql(sql):
    r = subprocess.run(['psql', URL, '-tAc', sql], capture_output=True, text=True, timeout=20)
    return r.stdout.strip() if r.returncode == 0 else None


if http('/admin/health') != 200:
    print(f'— 跳过：admin-api（{BASE}）没起。这一支【没验】，不是通过')
    sys.exit(0)
if psql('SELECT 1') is None:
    print('— 跳过：连不上库。这一支【没验】，不是通过')
    sys.exit(0)

# 造一个只管 hk 的管理员（口令跟种子那个一样，直接抄它的 hash）
psql(f"""INSERT INTO admin_user(id,email,password_hash,name,roles,region_scope)
         SELECT 'admin_regionprobe','regionprobe@unmei.local',password_hash,
                '越权探针','["operator","finance","support","content"]'::jsonb,'{{{外人区}}}'
           FROM admin_user WHERE id='admin_root'
         ON CONFLICT (id) DO UPDATE SET region_scope='{{{外人区}}}'""")

try:
    码 = http('/admin/auth/login', 'POST',
              {'email': 'regionprobe@unmei.local', 'password': 'admin123'})
    if 码 != 200:
        print(f'✗ 探针管理员登不进去（HTTP {码}）—— 这一支验不下去')
        sys.exit(1)
    req = urllib.request.Request(BASE + '/admin/auth/login', method='POST')
    req.add_header('content-type', 'application/json')
    with urllib.request.urlopen(
            req, json.dumps({'email': 'regionprobe@unmei.local',
                             'password': 'admin123'}).encode(), timeout=20) as r:
        token = json.loads(r.read())['token']

    # 拿几个【别的区】的真对象。拿不到就跳过那一条 —— 但下面有下限。
    单 = psql("SELECT id FROM order_record WHERE region='cn' LIMIT 1")
    退 = psql("SELECT id FROM refund WHERE region='cn' AND status='requested' LIMIT 1")
    差 = psql("SELECT r.id FROM recon_record r JOIN recon_batch b ON b.id=r.batch_id "
              "WHERE b.region='cn' AND r.match_state<>'matched' AND r.resolved_at IS NULL LIMIT 1")
    运 = psql("SELECT id FROM shipment WHERE region='cn' LIMIT 1")

    探 = [('读 cn 的订单', 'GET', '/admin/commerce/orders?region=cn&size=2', None)]
    if 单:
        探 += [('给 cn 的订单加备注', 'POST', f'/admin/commerce/orders/{单}/annotate', {'note': 'x'}),
               ('取消 cn 的订单', 'POST', f'/admin/commerce/orders/{单}/cancel', {'reason': 'x'})]
    if 退:
        探.append(('批 cn 的退款', 'POST', f'/admin/commerce/refunds/{退}/approve', {}))
    if 差:
        探.append(('结 cn 的对账差异', 'POST', f'/admin/commerce/recon/records/{差}/resolve',
                   {'action': 'known_fee', 'note': 'x'}))
    if 运:
        探.append(('标 cn 的物流异常', 'POST', f'/admin/commerce/shipments/{运}/mark-exception',
                   {'reason': 'x'}))

    # 【探到的太少就不算数】。库空了、字段改了，上面每一条都会跳过，
    # 而那跟「一条都没漏」长得一模一样。
    if len(探) < 4:
        print(f'✗ 只造出 {len(探)} 条探针 —— 库里多半没有 cn 的数据，这一支现在什么都没验到')
        sys.exit(1)

    坏 = []
    for 名, 法, 路, 体 in 探:
        码 = http(路, 法, 体, token)
        if 200 <= 码 < 300:
            坏.append(f'{名} → HTTP {码}')

    if 坏:
        print(f'✗ 只管 {外人区} 的管理员碰得到别的区（{len(坏)}/{len(探)} 条）：')
        for x in 坏:
            print('   ' + x)
        print('   前端挡的东西不算挡 —— 换一个查询参数就绕过去了')
        sys.exit(1)
    print(f'✓ 分区管理员碰不到别的区 · {len(探)} 条都被挡住')
finally:
    psql("DELETE FROM admin_user WHERE id='admin_regionprobe'")
