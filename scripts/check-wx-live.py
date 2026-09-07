#!/usr/bin/env python3
"""跟渠道说话那一整条链，真跑一遍。

【为什么要有这一支】。这个仓里跟微信有关的每一段，在 2026-09-07 之前
都是**桩**：`query_payment` 无条件说「已支付」、`pay_notify_decrypt`
在没配凭据时直接返回 `{"trade_state":"SUCCESS"}`、`paySign` 是字面量
`TODO_paySign_beta`、`refund` 回一个 `WX_REFUND_MOCK_…`、
`pull_settlement` 回空数组、`mp_jscode2session` 编一个 openid。

桩的问题不是「不真」，是**它替我们的代码回答**：签名、验签、
加解密、错误分支一行都没跑过，而那些恰恰是上线那天唯一会错的东西。
这台机器上一切都绿，配上真商户号之后一分钱都收不到。

现在本机跑着 `scripts/fake-wx.sh` 起的假微信 —— 它照 v3 的协议说话：
我方发的每个请求它**真验签**（商户公钥），它回的每条回调**真加密真签名**
（平台私钥 + APIv3 密钥）。我方这一侧没有一行是为测试而写的分支。

它假在两件事上：钱不真的动，人不真的点。
「用户按了付款」由 `POST /_control/pay/<支付号>` 代替 ——
那一下之后的每一步都是真的。

用法：起着假微信与后端（照 `bash scripts/fake-wx.sh env` 配），再跑这一支。
"""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

API = os.environ.get('UNMEI_API', 'http://127.0.0.1:6028')
FAKE = os.environ.get('FAKE_WX', 'http://127.0.0.1:6033')
错 = []
过 = 0


def 请求(method, url, body=None, token=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('content-type', 'application/json')
    if token:
        req.add_header('authorization', f'Bearer {token}')
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw.startswith(('{', '[')) else raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        return e.code, (json.loads(raw) if raw.startswith(('{', '[')) else raw)
    except OSError as e:
        return 0, str(e)


def 问库(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout.strip()


def 说(名, 成, 细=''):
    global 过
    if 成:
        过 += 1
        print(f'  ✓ {名}　{细}')
    else:
        错.append(f'{名}　{细}')
        print(f'  ✗ {名}　{细}')


# ── 前提：两边都得在 ────────────────────────────────────────
if 请求('GET', f'{FAKE}/v3/certificates')[0] == 0:
    print('· 假微信没起（bash scripts/fake-wx.sh up）—— 这一段【没验】，不是通过')
    sys.exit(0)
if 请求('POST', f'{API}/v1/auth/anonymous', {})[0] == 0:
    print('· 6028 上没有后端 —— 这一段【没验】，不是通过')
    sys.exit(0)

序 = str(int(time.time() * 1000))
_, 登录 = 请求('POST', f'{API}/v1/auth/anonymous', {})
TOK = 登录.get('access_token') or 登录.get('token')

# ── ① 下单 → 预下单（真签名，假微信真验签）────────────────
_, 单 = 请求('POST', f'{API}/v1/orders',
             {'lines': [{'sku_id': 'sku-naji-deep', 'qty': 1}], 'region': 'cn'},
             TOK, {'idempotency-key': f'wxlive-{序}'})
ORD = 单.get('order_id', '')
码, 付 = 请求('POST', f'{API}/v1/orders/{ORD}/pay',
              {'channel': 'wechat_jsapi', 'openid': 'ofake_live'},
              TOK, {'idempotency-key': f'wxlivepay-{序}'})
PID = 付.get('payment_id', '') if isinstance(付, dict) else ''
说('预下单过得了渠道的验签', 码 == 200 and bool(PID), f'{码} {PID}')

参数 = (付.get('outcome') or {}).get('params', {}) if isinstance(付, dict) else {}
签 = 参数.get('paySign', '')
说('paySign 是真签出来的', len(签) > 300 and 'TODO' not in 签,
   f'{len(签)} 字符' + ('（还是那个 TODO 字面量）' if 'TODO' in 签 else ''))
说('signType 是 RSA', 参数.get('signType') == 'RSA', str(参数.get('signType')))

# ── ② 用户付款 → 真回调（真加密 + 真签名 → 我方真验签）────
请求('POST', f'{FAKE}/_control/pay/{PID}')
for _ in range(20):
    st = 问库(f"SELECT status FROM payment WHERE id='{PID}'")
    if st == 'success':
        break
    time.sleep(0.5)
说('回调验签 + 解密之后这笔入了账', st == 'success', st)
流水 = 问库(f"SELECT COALESCE(channel_txn_id,'') FROM payment WHERE id='{PID}'")
说('渠道流水号记下来了', 流水.startswith('42000'), 流水 or '(空)')

# ── ③ 伪造的回调必须被挡下 ────────────────────────────────
码2, _ = 请求('POST', f'{API}/v1/webhooks/wechat',
              {'id': 'x', 'create_time': '2026-01-01T00:00:00+08:00',
               'resource_type': 'encrypt-resource', 'event_type': 'TRANSACTION.SUCCESS',
               'summary': 'x',
               'resource': {'algorithm': 'AEAD_AES_256_GCM', 'ciphertext': 'AAAA',
                            'associated_data': 'transaction', 'nonce': '123456789012',
                            'original_type': 'transaction'}})
说('没签名的回调进不来', 码2 >= 400, f'HTTP {码2}')

# ── ④ 关单：渠道那边真的知道 ──────────────────────────────
_, 单2 = 请求('POST', f'{API}/v1/orders',
              {'lines': [{'sku_id': 'sku-naji-deep', 'qty': 1}], 'region': 'cn'},
              TOK, {'idempotency-key': f'wxlive2-{序}'})
ORD2 = 单2.get('order_id', '')
_, 付2 = 请求('POST', f'{API}/v1/orders/{ORD2}/pay',
              {'channel': 'wechat_jsapi', 'openid': 'ofake_live'},
              TOK, {'idempotency-key': f'wxlivepay2-{序}'})
PID2 = 付2.get('payment_id', '') if isinstance(付2, dict) else ''
请求('POST', f'{API}/v1/orders/{ORD2}/cancel', {}, TOK, {'idempotency-key': f'wxc-{序}'})
# 撤单是 I/O，由 `payment_sweep` 每三十秒发一次 —— 不塞进事务里
#   （事务里做 I/O 是这个仓明写的禁忌）。所以这儿要等它一轮。
for _ in range(50):
    if 问库(f"SELECT channel_closed_at IS NOT NULL FROM payment WHERE id='{PID2}'") == 't':
        break
    time.sleep(1)
撤了 = 问库(f"SELECT channel_closed_at IS NOT NULL FROM payment WHERE id='{PID2}'")
说('我们不等了，也去渠道撤了单', 撤了 == 't', 撤了 or '(没撤)')
# 而撤了之后，渠道那边真的不让付了 —— 这才是撤单的意义
码3, _ = 请求('POST', f'{FAKE}/_control/pay/{PID2}')
说('撤过之后渠道不让再付', 码3 >= 400,
   '渠道还让付得出去 —— 那笔钱还会回来' if 码3 < 400 else '渠道说这一单已经关了')

# ── ⑤ 退款：钱真的发给渠道 ────────────────────────────────
码4, 退 = 请求('POST', f'{API}/v1/orders/{ORD}/refund',
               {'reason_code': 'user_request', 'reason_text': '门禁验退款'},
               TOK, {'idempotency-key': f'wxr-{序}'})
RID = 退.get('refund_id', '') if isinstance(退, dict) else ''
if RID:
    问库(f"UPDATE refund SET status='approved', approved_at=NOW() WHERE id='{RID}'")
    for _ in range(40):
        st5 = 问库(f"SELECT status FROM refund WHERE id='{RID}'")
        ch = 问库(f"SELECT COALESCE(channel_refund_id,'') FROM refund WHERE id='{RID}'")
        if st5 in ('processing', 'success') and ch:
            break
        time.sleep(1)
    说('退款真的发给了渠道', ch.startswith('500000'),
       f'{st5} / {ch or "(没号)"}' + ('　—— 还是那个 MOCK_ 前缀' if ch.startswith('MOCK_') else ''))
else:
    说('退款真的发给了渠道', False, f'申请退款没成：{码4} {退}')

# ── ⑥ 平台证书：回调验签的前提 ──────────────────────────
# 账单解析那一段由 `unmei-wx` 的单测钉着（`解交易账单` 三条），
# 拉账单本身一天只在凌晨跑一次，这里够不着 —— 如实不验，不假装。
成了 = 请求('GET', f'{FAKE}/v3/certificates')[0]
说('平台证书这条路通', 成了 in (200, 401),
   f'HTTP {成了}（401 = 它在验我们的签名，也说明这条路是通的）')

# ── ⑦ 小程序登录：真去问，空 code 真被拒 ──────────────────
码6, 登 = 请求('POST', f'{API}/v1/auth/wx/miniprogram', {'code': f'live{序}'})
说('小程序登录换得到 openid', 码6 == 200 and 'token' in (登 if isinstance(登, dict) else {}),
   f'HTTP {码6}')
码7, _ = 请求('POST', f'{API}/v1/auth/wx/miniprogram', {'code': ''})
说('空 code 被拒（不再按名字发号）', 码7 >= 400, f'HTTP {码7}')

print()
if 错:
    print(f'✗ 跟渠道说话那条链 · {len(错)} 处不通')
    sys.exit(1)
print(f'✓ 跟渠道说话那条链 · {过} 处都通（真签名 / 真验签 / 真加解密）')
