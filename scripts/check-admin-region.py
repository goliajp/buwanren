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
# 这个区必须【不是】下面那些对象所在的区。
# 【名字要出自名册】（2026-09-05）：这里原先写 `hk`，而 `region_registry`
# 里的六格是 cn / jp / kr / sea / na / zh_hant —— hk 不是其中之一。
# 拿一个不存在的区当「外人」，这一支照样跑得过（越权判的是 scope 对不对得上），
# 但它顺手教会了别处「hk 是个区」，而后台顶栏那个下拉框按名册过滤，
# 对一位 scope={hk} 的管理员【一条都不剩】。
外人区 = 'jp'


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

    # 按 id 读的那几条也要探。库里没有就跳过，下限在下面兜着。
    付 = psql("SELECT id FROM payment WHERE region='cn' LIMIT 1")
    批 = psql("SELECT id FROM recon_batch WHERE region='cn' LIMIT 1")
    凭 = psql("SELECT id FROM journal_entry WHERE region='cn' LIMIT 1")

    探 = [('读 cn 的订单列表', 'GET', '/admin/commerce/orders?region=cn&size=2', None),
         # 【`/commerce` 之外那两页 2026-09-06 之前一次都没被探过】。
         # 两条的签名都是 `_: Admin`、SQL 里没有 region —— 实测
         # `region_scope={zh_hant}` 的管理员拿到的审计【与超管逐字相同】,
         # 而问签那一条更要紧:它是用户问的私事，不是台账。
         #
         # 这一支从前只扫 `commerce.rs` 里那几条 list/write，
         # 于是这两页整整两个月落在门禁的视野之外。
         ('读全站的操作记录', 'GET', '/admin/commerce/audit?size=2', None),
         ('读 cn 的问签记录', 'GET', '/admin/naji?region=cn&size=2', None)]

    # 【按 id 读的那一整面，2026-09-03 之前一次都没被探过】。
    # 那一版这里六条:五条写、一条列表。而所有 `get_X(:id)` 的签名是 `_: Admin`，
    # `这个对象归他管吗` 只出现在写路由上 —— 实测 7/7 跨区读全通，
    # **而列表被挡住这件事恰好让人以为读已经守住了**。
    # 九个读路由当天补上了守卫，这里补上对应的探针:
    # 修完不补探针的话，下一次它退化回去仍然没有人会发现。
    if 单:
        探.append(('读 cn 的某一张订单', 'GET', f'/admin/commerce/orders/{单}', None))
    if 付:
        探.append(('读 cn 的某一笔支付', 'GET', f'/admin/commerce/payments/{付}', None))
    if 运:
        探.append(('读 cn 的某一张运单', 'GET', f'/admin/commerce/shipments/{运}', None))
    if 批:
        探.append(('读 cn 的某一批对账', 'GET', f'/admin/commerce/recon/batches/{批}', None))
    if 凭:
        探.append(('读 cn 的某一张凭证', 'GET', f'/admin/commerce/finance/entries/{凭}', None))

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
    # 【读与写各自都要有】。只有下限的话，读那一面整个消失也能过 ——
    # 而那正是 2026-09-03 之前的样子:六条里一条读、五条写。
    读几条 = sum(1 for _, 法, _, _ in 探 if 法 == 'GET')
    if 读几条 < 3:
        print(f'✗ 只造出 {读几条} 条【读】的探针 —— 读那一整面又没被探到了')
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
