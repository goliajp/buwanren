#!/usr/bin/env python3
"""前端的类型与后端的响应对得上吗 —— 机械核对,不靠人眼。

后端改一个字段名、前端还在读老名字,这种事在浏览器里是 `undefined`,
不抛错、不报警,要到真机上盯着一个空白栏才发现。而两边都是纯文本,
对一遍是几十毫秒的事。

做法:从路由文件里把 `json!({ ... })` 的键抠出来,跟 TS 接口的字段比。
- TS 有、后端没有  → 红。前端在读一个永远是 undefined 的东西
- 后端有、TS 没有  → 只提示。后端多给一点不是错,但值得看一眼是不是漏接了

用法: python3 scripts/check-api-shape.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# 后端函数 → 前端接口。加一条路由就加一行,不加的话它就没人核对。
PAIRS = [
    ('backend/unmei-api/src/routes/village.rs', 'my_village',
     'mini/miniprogram/types/village.ts', 'MyVillage'),
    ('backend/unmei-api/src/routes/village.rs', 'my_village',
     'mini/miniprogram/types/village.ts', 'VillagerInVillage'),
    ('backend/unmei-api/src/routes/village.rs', 'all_villagers',
     'mini/miniprogram/types/village.ts', 'VillagerCard'),
    ('backend/unmei-api/src/routes/village.rs', 'ask_reading',
     'mini/miniprogram/types/village.ts', 'Reading'),
    ('backend/unmei-api/src/routes/village.rs', 'scan',
     'mini/miniprogram/types/village.ts', 'ScanResult'),
]


# 结构体 → 前端接口。大半响应不是 `json!` 拼的,是这些结构体 serde 出来的,
# 所以要另开一张表。同样:加一个响应结构体就加一行,不加就没人核对。
#
# 这三份类型(auth / naji / natal)在 2026-08-18 之前【一条都没核对过】——
# 只有 village 在表里。而前端读一个后端不发的字段,在浏览器里就是 undefined,
# 不抛不报,要到真机上盯着一个空白栏才发现。
STRUCT_PAIRS = [
    ('backend/unmei-domain/src/lib.rs', 'NatalSummary',
     'mini/miniprogram/types/natal.ts', 'NatalSummary'),
    ('backend/unmei-domain/src/lib.rs', 'Natal',
     'mini/miniprogram/types/natal.ts', 'Natal'),
    ('backend/unmei-domain/src/lib.rs', 'NajiResult',
     'mini/miniprogram/types/naji.ts', 'NajiResult'),
    ('backend/unmei-domain/src/lib.rs', 'AuthOut',
     'mini/miniprogram/types/auth.ts', 'AuthOut'),
    ('backend/unmei-domain/src/lib.rs', 'UserPublic',
     'mini/miniprogram/types/auth.ts', 'UserPublic'),
]


# 【请求体】那一层。方向跟上面两张表相反:前端发出去的每个字段,
# 后端都必须认得 —— 否则 **serde 默认把不认识的字段静静丢掉**
# (全仓 0 处 `deny_unknown_fields`,查过)。
# 也就是把 `label` 改个名不会 422,只会让那个值凭空消失,
# 而页面上看起来一切正常。这比响应对不上更难发现。
REQUEST_PAIRS = [
    ('mini/miniprogram/types/natal.ts', 'NatalInput',
     'backend/unmei-domain/src/lib.rs', 'NatalInput'),
    ('mini/miniprogram/types/naji.ts', 'NajiSpinReq',
     'backend/unmei-domain/src/lib.rs', 'NajiSpinReq'),
    ('mini/miniprogram/types/village.ts', 'ScanReq',
     'backend/unmei-api/src/routes/village.rs', 'ScanBody'),
]


def fn_body(src, name):
    """从 `async fn <name>(` 起,到下一个顶层 `async fn` 或文件尾。"""
    m = re.search(r'^async fn ' + re.escape(name) + r'\b', src, re.M)
    if not m:
        return None
    nxt = re.search(r'^async fn ', src[m.end():], re.M)
    return src[m.start(): m.end() + nxt.start()] if nxt else src[m.start():]


def json_keys(body):
    """`json!` 里的 "key": —— 整个函数体一起收,够用:
    一个 handler 里通常只有一个响应形状,嵌套的那层(villagers 里每一项)
    也正是前端要的另一个接口。"""
    return set(re.findall(r'"([a-z_][a-z0-9_]*)"\s*:', body))


def struct_fields(src, name):
    """Rust 结构体的字段 —— 大半响应不是 `json!` 拼的,是结构体 serde 出来的。
    只看 `pub`,私有字段本来就不上线。

    返回 (全部字段, 可能不出现的字段)。第二项是 `skip_serializing_if` 标了的:
    它在某些情况下【整个键都不会出现】,而前端若把它当必有字段读,
    拿到的是 undefined —— 跟字段名写错一模一样,不抛不报。"""
    # `pub` 可有可无:路由模块里的请求体常是私有的（`struct ScanBody`）,
    # 只认 `pub struct` 会把它们当成「不存在」——那跟「改名了」长得一样
    m = re.search(r'(?:pub )?struct ' + re.escape(name) + r'\b[^{]*\{', src)
    if not m:
        return None, None
    depth, i = 1, m.end()
    while i < len(src) and depth:
        if src[i] == '{':
            depth += 1
        elif src[i] == '}':
            depth -= 1
        i += 1
    body = src[m.end(): i - 1]
    fields, maybe = set(), set()
    skip_next = False
    for line in body.split('\n'):
        t = line.strip()
        if 'skip_serializing_if' in t:
            skip_next = True
            continue
        fm = re.match(r'(?:pub )?([a-z_][a-z0-9_]*)\s*:', t)
        if fm:
            fields.add(fm.group(1))
            if skip_next:
                maybe.add(fm.group(1))
        if not t.startswith('#[') and not t.startswith('///') and t:
            skip_next = False
    return fields, maybe


def ts_optional(src, iface):
    """TS 接口里标了 `?` 的字段。"""
    m = re.search(r'export interface ' + re.escape(iface) + r'\b[^{]*\{', src)
    if not m:
        return set()
    depth, i = 1, m.end()
    while i < len(src) and depth:
        if src[i] == '{':
            depth += 1
        elif src[i] == '}':
            depth -= 1
        i += 1
    body = re.sub(r'//[^\n]*', '', src[m.end(): i - 1])
    return set(re.findall(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\?\s*:', body, re.M))


def ts_fields(src, iface):
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
    body = src[m.end(): i - 1]
    body = re.sub(r'/\*[\s\S]*?\*/', '', body)
    body = re.sub(r'//[^\n]*', '', body)
    return set(re.findall(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*[?]?\s*:', body, re.M))


# ── 前端依赖的状态码 ──────────────────────────────────────────────
# 字段名之外,前端还依赖【状态码】。村主屏那一页按 404 判「他还没住进你的村子」——
# 不按错误文案判,因为文案会改而状态码是契约。
# 这条耦合值得钉住:后端哪天把它改成 403(看起来更像「权限」),
# 前端会把它当成登录过期,把人踢去重新登录 —— 而他只是还没请那个人回家。
#
# 这不是权限检查:御守是入住凭证,没住进来的人跟你之间还没有可说话的关系。
STATUS_CONTRACTS = [
    ('backend/unmei-api/src/routes/village.rs', 'ask_reading', 'is_home', 'not_found',
     '没请回家问签必须是 404;前端(pages/village)按这个状态码说「他还没住进你的村子」'),
]


def check_status_contracts():
    n = 0
    for rs_path, fn, guard, want, why in STATUS_CONTRACTS:
        rs = (ROOT / rs_path).read_text(encoding='utf-8')
        body = fn_body(rs, fn)
        if body is None:
            print(f'✗ {rs_path} 里没有 async fn {fn} —— 这条契约核对已经失效')
            n += 1
            continue
        # 取 guard 那一段:从出现 guard 的地方到这个 if 块结束
        i = body.find(guard)
        if i < 0:
            print(f'✗ {fn} 里找不到 {guard} 那道判断 —— 结构变了,这条核对已经失效')
            n += 1
            continue
        seg = body[i: i + 400]
        if want in seg:
            print(f'✓ {fn}：{guard} 不成立时给 {want}')
        else:
            print(f'✗ {fn}：{guard} 不成立时给的不是 {want}')
            print(f'    {why}')
            n += 1
    return n


bad = check_status_contracts()
for rs_path, fn, ts_path, iface in PAIRS:
    rs = (ROOT / rs_path).read_text(encoding='utf-8')
    ts = (ROOT / ts_path).read_text(encoding='utf-8')

    body = fn_body(rs, fn)
    if body is None:
        print(f'✗ {rs_path} 里没有 async fn {fn} —— 改名了?这条核对已经失效')
        bad += 1
        continue
    fields = ts_fields(ts, iface)
    if fields is None:
        print(f'✗ {ts_path} 里没有 interface {iface}')
        bad += 1
        continue
    if not fields:
        print(f'✗ interface {iface} 一个字段都没解析到 —— 解析对不上了')
        bad += 1
        continue

    keys = json_keys(body)
    missing = sorted(fields - keys)
    extra = sorted(keys - fields)
    if missing:
        print(f'✗ {iface} ← {fn}：前端读了后端不给的字段 {" ".join(missing)}')
        bad += 1
    else:
        print(f'✓ {iface} ← {fn}（{len(fields)} 个字段都对得上）')
    if extra:
        print(f'    · 后端还给了 {" ".join(extra)}，前端没接（不算错，看一眼是不是漏了）')

for rs_path, struct, ts_path, iface in STRUCT_PAIRS:
    rs = (ROOT / rs_path).read_text(encoding='utf-8')
    ts = (ROOT / ts_path).read_text(encoding='utf-8')
    got, maybe = struct_fields(rs, struct)
    if got is None:
        print(f'✗ {rs_path} 里没有 pub struct {struct} —— 改名了?这条核对已经失效')
        bad += 1
        continue
    if not got:
        print(f'✗ struct {struct} 一个字段都没解析到 —— 解析对不上了')
        bad += 1
        continue
    want = ts_fields(ts, iface)
    if not want:
        print(f'✗ {ts_path} 里没有 interface {iface}(或一个字段都没解析到)')
        bad += 1
        continue
    missing = sorted(want - got)
    extra = sorted(got - want)
    if missing:
        print(f'✗ {iface} ← struct {struct}：前端读了后端不给的字段 {" ".join(missing)}')
        bad += 1
    else:
        print(f'✓ {iface} ← struct {struct}（{len(want)} 个字段都对得上）')
    # 后端可能整个不发的字段,前端却当必有 —— 拿到 undefined,跟名字写错一个样
    险 = sorted((maybe & want) - ts_optional(ts, iface))
    if 险:
        print(f'✗ {iface}：{" ".join(险)} 后端可能【整个不发】(skip_serializing_if),'
              f'前端却当必有 —— 该标成可选')
        bad += 1
    if extra:
        print(f'    · 后端还给了 {" ".join(extra)}，前端没接（不算错，看一眼是不是漏了）')

for ts_path, iface, rs_path, struct in REQUEST_PAIRS:
    ts = (ROOT / ts_path).read_text(encoding='utf-8')
    rs = (ROOT / rs_path).read_text(encoding='utf-8')
    sends = ts_fields(ts, iface)
    accepts, _ = struct_fields(rs, struct)
    if not sends:
        print(f'✗ {ts_path} 里没有 interface {iface}(或一个字段都没解析到)')
        bad += 1
        continue
    if accepts is None or not accepts:
        print(f'✗ {rs_path} 里没有 pub struct {struct} —— 改名了?这条核对已经失效')
        bad += 1
        continue
    dropped = sorted(sends - accepts)
    if dropped:
        print(f'✗ {iface} → {struct}：前端发的这些后端不认，会被**静静丢掉** {" ".join(dropped)}')
        bad += 1
    else:
        print(f'✓ {iface} → struct {struct}（发出去的 {len(sends)} 个字段后端都认）')

print()
print('✓ 前后端字段对得上' if not bad else f'✗ {bad} 处对不上')
sys.exit(1 if bad else 0)
