#!/usr/bin/env python3
"""后台 API 的冒烟 —— 每条路由真打一遍，看它答不答得出话。

后台有 58 条路由，管的是订单、退款、定价、订阅这些跟钱有关的事，
而 CI 此前只知道它**编得过**。一条查询写错在编译期是看不出来的，
它表现成运行期 500 —— 而运营那边看到的是一张空表格。

**路由从源码里数出来**，不另列一份：另列的那份会漏掉新加的路由，
而漏掉的样子跟「全都验过了」一模一样。

带 `:参数` 的路由这里不打（没有现成的 id 可填），但**会报出来跳过了几条**——
默默少验一片比少验本身更糟。

用法:
  python3 scripts/admin-smoke.py                       打本机 :6029
  python3 scripts/admin-smoke.py --base=http://…       打别处
  ADMIN_EMAIL / ADMIN_PASSWORD 可覆盖（默认是开发种子那一对）
"""
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'backend/unmei-admin-api/src'

BASE = 'http://127.0.0.1:6029'
for a in sys.argv[1:]:
    if a.startswith('--base='):
        BASE = a.split('=', 1)[1].rstrip('/')

EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@unmei.local')
PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')


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
    except Exception as e:                      # 连不上也是结论,不是异常
        return 0, str(e)


def routes():
    """从源码里数路由。`.route("/x", get(..))` —— 只要 GET 的那些。"""
    out = set()
    for f in SRC.rglob('*.rs'):
        s = f.read_text(encoding='utf-8')
        for m in re.finditer(r'\.route\(\s*"([^"]+)"\s*,\s*([^)]*)', s):
            path, handlers = m.group(1), m.group(2)
            if 'get(' in handlers:
                out.add(path)
    return sorted(out)


def write_routes():
    """写操作那些，连同它【真正收】的方法。

    方法要照源码取,不能一律当成 POST:`/admin/quotes/:id` 收的是 patch 与 delete,
    用 POST 打它得到 405 —— 那说明请求根本没到处理函数,
    既证明不了有鉴权,也不是开着的门。按错的方法打会报出一条假的。"""
    out = {}
    for f in SRC.rglob('*.rs'):
        s = f.read_text(encoding='utf-8')
        for m in re.finditer(r'\.route\(\s*"([^"]+)"\s*,\s*([^;]*?)\)\s*(?:\.|;|$)', s, re.S):
            for verb in ('post', 'patch', 'put', 'delete'):
                if re.search(r'\b' + verb + r'\(', m.group(2)):
                    out.setdefault(m.group(1), verb.upper())
                    break
    return out


all_routes = routes()
if not all_routes:
    print('✗ 一条路由都没数到 —— 源码结构变了？数不出东西的核对必须失败')
    sys.exit(1)

code, body = http('/admin/auth/login', 'POST', {'email': EMAIL, 'password': PASSWORD})
if code != 200:
    print(f'✗ 登录不上（HTTP {code}）: {body[:160]}')
    sys.exit(1)
token = json.loads(body).get('token', '')
if not token:
    print(f'✗ 登录给了 200 却没有 token: {body[:160]}')
    sys.exit(1)

def first_id(list_path):
    """从列表端点拿第一条的 id。拿不到就返回 None —— 不编一个。"""
    code, body = http(list_path, token=token)
    if code != 200:
        return None
    try:
        j = json.loads(body)
    except Exception:
        return None
    items = j.get('items') if isinstance(j, dict) else j
    if not isinstance(items, list) or not items:
        return None
    row = items[0]
    if not isinstance(row, dict):
        return None
    for k in ('id', 'sku_id', 'period_id'):
        if row.get(k):
            return str(row[k])
    return None


plain = [r for r in all_routes if ':' not in r]
withid = [r for r in all_routes if ':' in r]

bad = 0
for r in plain:
    code, body = http(r, token=token)
    if code == 200:
        print(f'  ✓ {r}')
    else:
        print(f'  ✗ {r}　HTTP {code}　{body[:100]}')
        bad += 1

print()
skipped = []
# 带 :参数的,去对应的列表端点借一个真 id 来填。
# 借不到就跳过并【报出来】—— 库里没有这类数据是实话,默默少验一片才是问题。
for r in withid:
    prefix = r[:r.index('/:')]
    rid = first_id(prefix)
    if rid is None:
        skipped.append(r)
        continue
    real = re.sub(r':[a-z_]+', rid, r, count=1)
    code, body = http(real, token=token)
    if code == 200:
        print(f'  ✓ {r}　（借了一个真 id）')
    else:
        print(f'  ✗ {r} → {real}　HTTP {code}　{body[:100]}')
        bad += 1

# ── 不带 token 的时候，挡不挡得住 ────────────────────────────────
#
# 忘了给某条路由加鉴权，是一扇开着的门通向订单、退款、定价。
# 而它平时一点异样都没有：带着 token 测，一切正常。
#
# 不带 token 打是【安全】的：挡在鉴权那一步，根本到不了处理函数，
# 所以写操作那几条也可以照打不误。
#
# 两条例外：健康检查本就不该要鉴权；登录接口自己就是鉴权入口。
print()
print('── 不带 token 时挡不挡得住 ──')
FREE = ('/admin/health', '/admin/auth/login')
guarded = 0
WRITES = write_routes()
for r in sorted(set(all_routes) | set(WRITES)):
    if r in FREE:
        continue
    real = r
    if ':' in r:
        rid = first_id(r[:r.index('/:')])
        if rid is None:
            continue                      # 借不到 id，前面已经报过跳过了
        real = re.sub(r':[a-z_]+', rid, r, count=1)
    method = WRITES.get(r, 'GET')
    code, _ = http(real, method)          # 不带 token
    if code in (401, 403):
        guarded += 1
    else:
        print(f'  ✗ {method} {r}　不带 token 也给了 {code} —— 这扇门是开着的')
        bad += 1
print(f'  ✓ {guarded} 条都要 token（放行的只有 {" ".join(FREE)}）')

print()
print('── 角色守卫真挡得住吗 ──')
"""种子管理员 super / operator / content / support / finance 五个全带 ——
也就是说【守卫坏掉了它也照样通过】。所以这里另起一个只有 support 的管理员，
拿他去撞一条 finance 的路由。

密码哈希直接抄种子那一条（admin123），不另生成 —— 生成要 argon2，
而这支脚本只有标准库。用完就删。"""
import subprocess

PROBE_EMAIL = 'roleprobe@unmei.local'
SEED_HASH = ('$argon2id$v=19$m=19456,t=2,p=1$dW5tZWlfYWRtaW5fc2FsdA'
             '$vW0Ahrk4kBiBhOpompP8SV+teWYWoJJ/IXIj3z/H1b8')


def psql(sql):
    """本机 docker 里那台 Postgres。连不上就返回 None —— 不假装验过。"""
    try:
        name = subprocess.run(
            ['docker', 'ps', '--filter', 'publish=6032', '--format', '{{.Names}}'],
            capture_output=True, text=True, timeout=10).stdout.strip().splitlines()
        if not name:
            return None
        return subprocess.run(
            ['docker', 'exec', '-i', name[0], 'psql', '-U', 'unmei', '-d', 'unmei', '-tAc', sql],
            capture_output=True, text=True, timeout=20).stdout.strip()
    except Exception:
        return None


made = psql(
    "INSERT INTO admin_user(id,email,password_hash,name,roles) VALUES "
    f"('admin_roleprobe','{PROBE_EMAIL}','{SEED_HASH}','只会客服的那位',"
    "'[\"support\"]'::jsonb) ON CONFLICT (id) DO UPDATE SET roles='[\"support\"]'::jsonb "
    "RETURNING id")
if made is None:
    print('  · 连不上本机 Postgres，这一段【没验】—— 建不出只有 support 的管理员')
else:
    code, body = http('/admin/auth/login', 'POST', {'email': PROBE_EMAIL, 'password': PASSWORD})
    if code != 200:
        print(f'  ✗ 只有 support 的那位登录不上（HTTP {code}）—— 这一段验不成')
        bad += 1
    else:
        ptoken = json.loads(body).get('token', '')
        # 财务的活儿：定价发布。他不该做得了
        code, _ = http('/admin/commerce/pricing/sku-any/publish', 'POST',
                       {'currency': 'CNY', 'price_minor': 1}, token=ptoken)
        if code == 403:
            print('  ✓ 只有 support 的管理员，发布定价被拒（403）')
        else:
            print(f'  ✗ 只有 support 的管理员居然能发布定价（HTTP {code}）—— 守卫没生效')
            bad += 1
        # 他自己的活儿不该被角色挡掉。用一个不存在的 id：不该是 403
        code, _ = http('/admin/commerce/orders/ord-nonexistent/annotate', 'POST',
                       {'note': 'roleprobe'}, token=ptoken)
        if code == 403:
            print('  ✗ 只有 support 的管理员连订单备注都做不了（403）—— 分工表把他挡在了自己的活儿外面')
            bad += 1
        else:
            print(f'  ✓ 他自己的活儿（订单备注）没被角色挡掉（HTTP {code}）')
    psql("DELETE FROM admin_user WHERE id='admin_roleprobe'")

print()
print(f'GET 路由 {len(plain) + len(withid) - len(skipped)} 条真打过 · 挂 {bad} 条 · '
      f'跳过 {len(skipped)} 条')
if skipped:
    print('  跳过的（列表端点里没有可借的 id，库里就没有这类数据）:')
    print('  ' + ' '.join(skipped))
sys.exit(1 if bad else 0)
