#!/usr/bin/env python3
"""前端调的路径，后端都有吗 —— 机械核对，不用把它跑起来。

两对：小程序 → unmei-api，后台控制台 → unmei-admin-api。

2026-08-18 撞见的那个：控制台的 Users 页从初始提交起就挂在侧边栏上，
而它请求的 `/admin/users` 后端**根本没有**。前端拿到 404 当作「没数据」，
页面就那么空着。没有任何一处会红 —— 构建不对着服务器做类型检查，
路由冒烟只打后端**自己声明过**的路由（不存在的那条自然不在名单里），
逐页走也只覆盖每页打开时发的那几个 GET。

**写操作那些接口（取消订单、批退款、下架价格）连打开页面都不会碰。**
而它们最要紧。所以这一支不跑任何东西，两边都是纯文本，对一遍是几十毫秒。

做法：
  · 前端 —— `webadmin/src` 里所有以 `/` 开头的字符串路径，去掉查询串，
    把 `${…}` 换成 `:x`
  · 后端 —— `unmei-admin-api` 里 `.route("…")` 声明的全部路由
  · 拿模式比模式：`/commerce/orders/:x/cancel` 对得上 `/admin/commerce/orders/:id/cancel`

用法: python3 scripts/check-admin-routes.py
"""
import pathlib
import json
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# (名字, 前端目录, 后端目录, 前端路径前面要补的 BASE, 客户端模块的文件名)
#
# 客户端模块那一列：那个文件里【作为参数出现】的路径也算，因为路径都集中在
# 它里面。别的文件只认 `api.get('/x')` 这种直接调用。
PAIRS = [
    ('小程序 → unmei-api', 'mini/miniprogram', 'backend/unmei-api/src', '', None),
    ('后台 → unmei-admin-api', 'webadmin/src', 'backend/unmei-admin-api/src', '/admin', 'api.ts'),
]


def norm(p):
    """`/commerce/orders/${id}/cancel?x=1` → `/commerce/orders/:x/cancel`"""
    p = p.split('?')[0].rstrip('/')
    p = re.sub(r'\$\{[^}]*\}', ':x', p)
    return p or '/'


def first_arg(src, i):
    """从 `(` 之后取第一个实参:数括号、认引号(含模板串),
    到顶层逗号或配对的右括号为止。"""
    depth, q, out = 0, None, []
    while i < len(src):
        c = src[i]
        if q:
            out.append(c)
            if c == '\\':
                if i + 1 < len(src):
                    out.append(src[i + 1]); i += 2; continue
            elif c == q:
                q = None
            i += 1
            continue
        if c in '`\'"':
            q = c; out.append(c); i += 1; continue
        if c in '([{':
            depth += 1
        elif c in ')]}':
            if depth == 0:
                break
            depth -= 1
        elif c == ',' and depth == 0:
            break
        out.append(c)
        i += 1
    return ''.join(out)


def frontend_paths(fe_dir, client_file):
    """前端【真的当接口用】的路径。

    取法要窄。第一版把所有以 / 开头的字符串都收了,于是页面路由(`/master`)
    与前缀常量(`const COMMERCE = '/commerce'`)也进来了 —— 三条全是误报,
    而会误报的门禁很快就没人看。

    现在只认两处:
      · 客户端模块里【作为参数传出去】的字符串(前缀常量是赋值,不算)
      · 任何文件里 `api.get('/x')` / `api.post('/x', …)` 这样的直接调用

    **拼接也要认**:小程序那边写的是 `'/v1/villagers/' + id + '/reading'`,
    只看第一段的话会得出一条 `/v1/villagers/` 的假路径 —— 而假路径跟真缺失
    长得一模一样。所以取整段实参再合并。
    """
    out = {}

    def take(f, path):
        out.setdefault(norm(path), set()).add(str(f.relative_to(ROOT)))

    def join_concat(expr):
        """`'/v1/villagers/' + id + '/reading'` → `/v1/villagers/:x/reading`

        变量【只有在前一段以 / 结尾时】才算一段路径。否则它是接在后面的
        东西 —— `'/commerce/orders' + qs(p)` 拼的是查询串,不是路径段;
        当成路径段的话会得出 `/commerce/orders:x:x` 这种假路径,
        而假路径跟真缺失长得一模一样。"""
        parts, ok = [], False
        for tok in re.finditer(r"[`'\"]([^`'\"]*)[`'\"]|([A-Za-z_$][\w.$]*)", expr):
            if tok.group(1) is not None:
                parts.append(tok.group(1)); ok = True
            elif ok and parts and parts[-1].endswith('/'):
                parts.append(':x')
            elif ok:
                break                      # 查询串之类,路径到此为止
        return ''.join(parts) if ok else None

    for f in sorted(fe_dir.rglob('*.ts')) + sorted(fe_dir.rglob('*.tsx')):
        s = f.read_text(encoding='utf-8')
        s = re.sub(r'//[^\n]*', '', s)
        s = re.sub(r'/\*[\s\S]*?\*/', '', s)
        # api.get<T>(…) —— 第一个实参。要【按括号与引号扫】,
        # 不能用 `[^,)]*` 截:模板串里有 `encodeURIComponent(search)`,
        # 遇到那个右括号就截断,引号不配对,整条路径被静静丢掉 ——
        # 而少取一条跟「后端有这条路由」长得一模一样(变异测试抓到的)。
        for m in re.finditer(r'\bapi\.(?:get|post|put|patch|del|delete)\s*(?:<[^()]*?>)?\s*\(', s):
            joined = join_concat(first_arg(s, m.end()))
            if joined and joined.startswith('/'):
                take(f, joined)
        # 客户端模块里:作为【参数】出现的路径(前缀常量是 `= '/x'`,不匹配)。
        # 但字符串方法的参数不算 —— `path.startsWith('/commerce')` 里那个
        # 是判断用的前缀,不是请求路径(第一版就把它报成了缺失路由)
        if client_file and f.name == client_file:
            for m in re.finditer(r'([A-Za-z]*)\s*[(,]\s*[`\'"](/[^`\'"]*)', s):
                if m.group(1) in ('startsWith', 'endsWith', 'includes', 'indexOf',
                                  'replace', 'split', 'match', 'search'):
                    continue
                take(f, m.group(2))
    return out


def backend_routes(be_dir):
    out = set()
    for f in be_dir.rglob('*.rs'):
        s = f.read_text(encoding='utf-8')
        for m in re.finditer(r'\.route\(\s*"([^"]+)"', s):
            out.add(re.sub(r':[a-z_]+', ':x', m.group(1).rstrip('/')))
    return out


# 调用方【本来就不是我们的前端】的那些，不进「没人调」清单：
# 健康检查给运维和 CI，webhook 给渠道回调。列进去只会淹掉真信号。
NOT_OURS = ('/health', '/webhooks/')


bad = 0
missing_any = 0  # 「前端调了后端没有的」单独记 —— 那句提示只对这一类成立
idle_report = []
for name, fe_rel, be_rel, base, client in PAIRS:
    fe = frontend_paths(ROOT / fe_rel, client)
    be = backend_routes(ROOT / be_rel)
    if not fe or not be:
        print(f'✗ {name}：前端 {len(fe)} 条 / 后端 {len(be)} 条 —— 有一边没解析到,'
              f'查不到东西的核对必须失败')
        bad += 1
        continue

    # 前端路径拼在 BASE 后面才是完整路由，对不上就报。
    #
    # 这里**不再做「同前缀才报」的降噪**。那条判据一度在：它压掉了页面路由的噪音，
    # 但连同真问题一起压掉了 —— 变异测试当场证明:把后端的 `/admin/users` 改名之后
    # 它不报，而那正是这支脚本要抓的那个 bug 本身。
    # 噪音该在【取的时候】收窄（只认真正传给 api.* 的路径），不该在判的时候放过。
    missing = [(base + p, sorted(w)) for p, w in sorted(fe.items()) if base + p not in be]
    for full, where in missing:
        print(f'✗ {full}　后端没有这条路由　←　{" ".join(where)}')
    print(f'{"✗" if missing else "✓"} {name}：前端 {len(fe)} 条 · 后端 {len(be)} 条 · '
          f'对不上 {len(missing)} 条')
    bad += len(missing)
    missing_any += len(missing)

    # 反过来的一半：后端有、前端一处都没调。**只报不判** ——
    # 买御守那条流程还没进小程序，那些接口没人调是正常的。
    # 但这个仓库已经三次栽在「实现完整、零调用方」上（风控 D7、D6 的幂等键、徽章），
    # 每次都是偶然发现的。列出来，至少下次不用靠偶然。
    called = {base + q for q in fe}
    idle = [r for r in sorted(be) if r not in called and not any(k in r for k in NOT_OURS)]
    if idle:
        idle_report.append((name, idle))

if idle_report:
    print()
    print('· 后端有、前端没人调（健康检查与 webhook 已排除）：')
    for name, idle in idle_report:
        print(f'    {name}　{len(idle)} 条')
        for r in idle:
            print(f'      {r}')

# ── 还有更里面的一层：封装写好了，但没有任何页面用它 ──
# 「后端有、前端没人调」那一栏看不见这类 —— 在它眼里前端代码里出现过这个
# 路径就算调过了。而 `villageApi.all()` 这种：函数在、路径在、页面一处不用。
# 2026-08-18 量出来两个（`village.all` 图鉴、`natal.remove` 删本命）。
# 同样【只报不判】：接上还是删掉是产品决定，不是核对脚本能拍的。
svc = {}
for f in sorted((ROOT / 'mini/miniprogram/services').glob('*.ts')):
    src = f.read_text(encoding='utf-8')
    for m in re.finditer(r'^\s{2}([a-zA-Z_]\w*)\s*:\s*\(', src, re.M):
        svc.setdefault(f.stem, []).append(m.group(1))
# `utils/` 也算调用方。页面之间不许互相 import（check-page-imports 守着），
# 所以两页共用的那一下只能住在 utils —— `utils/money.ts` 是先例，
# `utils/omamori.ts`（扫开一枚御守，村子主屏与一单那一屏共用）是第二个。
# 只扫 pages 的话，共用逻辑一搬进去，它调的那条封装当场变成「孤儿」，
# 而它明明有两个调用方。
# **不扫 services**：那是被调方，A 调 B 就算「有人用」会把真孤儿盖住。
pages_src = ''
for f in (list((ROOT / 'mini/miniprogram/pages').rglob('*.ts'))
          + list((ROOT / 'mini/miniprogram/utils').glob('*.ts'))
          + list((ROOT / 'mini/miniprogram').glob('*.ts'))):
    pages_src += f.read_text(encoding='utf-8')
dead = [f'{mod}.{n}' for mod, names in svc.items() for n in names
        if not re.search(r'\b' + re.escape(n) + r'\s*\(', pages_src)]
if dead:
    print()
    print(f'· 封装在、没有页面用：{len(dead)}/{sum(len(v) for v in svc.values())} 个')
    for d in dead:
        print(f'      {d}')

# ── 棘轮 ────────────────────────────────────────────────────────
# 上面两栏原先【只报不判】,理由是「接上还是删掉是产品决定」。那个理由
# 对**已经在册**的那些成立,对**新长出来**的一条不成立 —— 它成立的话,
# 这个仓库第八次「实现完整、零调用方」照样得靠偶然发现。
#
# 所以照标点欠账那套:现状记进台账,新的一条报红,台账上已经不再是孤儿的
# 也报红(该划掉了)。台账本身不判对错,只管不让它悄悄变长。
LEDGER = ROOT / 'scripts' / 'orphan-routes.json'
led = json.loads(LEDGER.read_text(encoding='utf-8'))
drift = []
for name, idle in idle_report:
    known = set(led['后端有前端没人调'].get(name, {}))
    for r in sorted(set(idle) - known):
        drift.append(f'新长出一条没人调的接口：{name}　{r}')
    for r in sorted(known - set(idle)):
        drift.append(f'台账里这条已经有人调了，从 {LEDGER.name} 上划掉：{name}　{r}')
known_dead = set(led['封装在没有页面用'])
for d in sorted(set(dead) - known_dead):
    drift.append(f'新长出一个没有页面用的封装：{d}')
for d in sorted(known_dead - set(dead)):
    drift.append(f'台账里这个封装已经有人用了，从 {LEDGER.name} 上划掉：{d}')
# 每一条都要写理由。「暂时没接」不算理由 —— 那是欠账不是决定；
# 写不出理由就说明它该接上或该删掉。空理由跟没进台账一样红。
for name, entries in led['后端有前端没人调'].items():
    for route, why in entries.items():
        if not str(why).strip():
            drift.append(f'台账里这条没写理由：{name}　{route}')
for wrapper, why in led['封装在没有页面用'].items():
    if not str(why).strip():
        drift.append(f'台账里这个封装没写理由：{wrapper}')

if drift:
    print()
    for d in drift:
        print('✗ ' + d)
    print('  台账在 scripts/orphan-routes.json —— 想清楚是接上、删掉、还是记一笔，')
    print('  三条都行，但别让它悄悄多一条。')
    bad += len(drift)

print()
if bad:
    if missing_any:
        print('✗ 前端在调后端没有的接口 —— 它表现成 404，而前端多半当作「没数据」，')
        print('  于是页面空着、谁也不红')
    sys.exit(1)
print('✓ 两边调的接口后端都有')
