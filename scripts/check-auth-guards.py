#!/usr/bin/env python3
"""要登录的接口，不带 token 时真的挡得住吗。

一条忘了加 `AuthedUser` 的路由，是一扇通向别人本命、别人问签记录的开着的门，
而它**一点异样都没有**：带着 token 测，一切正常。

不带 token 打是**安全**的——鉴权在处理函数之前，什么都碰不到。

**哪些该挡，照源码判**，不另列名单：handler 的签名里有 `AuthedUser` 的就该挡。
公开的那些（商品、配置、健康、webhook、登录本身）签名里没有它，自然不在名单上。

★ handler 名字**必须在同一个文件里解析**。`list` / `get` 这种名字好几个模块都有，
  按裸名字匹配的话，一个模块里要登录的 `list` 会把所有叫 `list` 的路由都算进来 ——
  第一版就是这样，差点报出两个不存在的「安全漏洞」（`/v1/badge`、`/v1/activity`
  本来就是公开的）。

用法:
  python3 scripts/check-auth-guards.py [base]     默认 http://127.0.0.1:6028
"""
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'backend/unmei-api/src'
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:6028').rstrip('/')


def guarded_routes():
    """(方法, 路径) —— 签名里有 AuthedUser 的那些。逐文件解析。"""
    out = set()
    for f in SRC.rglob('*.rs'):
        s = f.read_text(encoding='utf-8')
        authed = {m.group(1)
                  for m in re.finditer(r'async fn ([a-z_0-9]+)\s*\((.*?)\)\s*->', s, re.S)
                  if 'AuthedUser' in m.group(2)}
        if not authed:
            continue
        for line in s.split('\n'):
            m = re.search(r'\.route\(\s*"([^"]+)"\s*,\s*(.+)$', line)
            if not m:
                continue
            for hm in re.finditer(r'\b(get|post|patch|put|delete)\(\s*([A-Za-z_0-9:]+)', m.group(2)):
                if hm.group(2).split('::')[-1] in authed:
                    out.add((hm.group(1).upper(), m.group(1)))
    return sorted(out)


def hit(path, method):
    data = None if method == 'GET' else b'{}'
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header('content-type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


try:
    with urllib.request.urlopen(BASE + '/v1/health', timeout=5):
        pass
except Exception:
    print(f'✗ 后端（{BASE}）没起，这一项没法验')
    sys.exit(1)

routes = guarded_routes()
if not routes:
    print('✗ 一条要登录的路由都没数到 —— 取法对不上了？查不到东西的核对必须失败')
    sys.exit(1)

bad = []
for method, path in routes:
    # 路径参数随便填一个：挡在鉴权那一步，根本走不到查库
    code = hit(re.sub(r':[a-z_]+', 'probe', path), method)
    if code not in (401, 403):
        bad.append((method, path, code))
        print(f'✗ {method} {path}　不带 token 也给了 {code} —— 这扇门是开着的')

print()
print(f'要登录的路由 {len(routes)} 条 · 没挡住 {len(bad)} 条')
if bad:
    print('✗ 有接口忘了要 token。带着 token 测是看不出来的')
    sys.exit(1)
print('✓ 都挡住了')
