#!/usr/bin/env python3
"""写操作的请求体，两边字段名对得上吗。

`check-routes.py` 管的是**路径存不存在**；`check-api-shape.py` 管的是**响应**字段。
中间还剩一块没人管：**请求体**。

后端把 `reason` 改成 `note`，前端照旧发 `reason` —— 路径还在、响应结构没变，
运行期一个 422，而在此之前没有任何一处会红。后台那些写操作又正是
取消订单、拒退款、标记异常这类**做一次就有后果**的动作。

做法：从 `webadmin/src/lib/api.ts` 取每个 `api.post/patch/put(路径, { … })`
的对象键，找到那条路径的 Rust handler、它收的 `Json<XxxBody>`，比字段名。

**只报「前端发了后端不认的字段」**。反过来（后端有、前端没发）不报：
那多半是可选字段，`serde` 有默认值，报了就是噪音。

**查询参数那一层没做，是权衡不是遗漏**（2026-08-18 量过）：
后端认得 25 个查询字段，后台页面用到的键**一个不认的都没有**。
而要做成门禁得维护「页面 → 端点 → Filter 结构体」的三跳映射
——筛选键散在各页的 JSX 里，不像请求体那样集中在 `lib/api.ts`——
比这一支脆弱得多，而它挡的是「筛选悄悄不生效」。哪天真出过一次，再回来做。

用法: python3 scripts/check-bodies.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FE = ROOT / 'webadmin/src/lib/api.ts'
BE = ROOT / 'backend/unmei-admin-api/src'
BASE = '/admin'


def frontend_bodies():
    """路径 → 前端发的字段名。路径里的 `${…}` 归一成 `:x`。"""
    s = FE.read_text(encoding='utf-8')
    s = re.sub(r'//[^\n]*', '', s)
    out = {}
    for m in re.finditer(r'api\.(?:post|patch|put)\s*(?:<[^>]*>)?\s*\(\s*[`\'"]([^`\'"]+)[`\'"]\s*,\s*\{([^}]*)\}', s):
        path = re.sub(r'\$\{[^}]*\}', ':x', m.group(1)).split('?')[0]
        keys = set()
        for kv in m.group(2).split(','):
            kv = kv.strip()
            if not kv:
                continue
            # `{ note }` 与 `{ note: x }` 两种写法
            keys.add(kv.split(':')[0].strip())
        if keys:
            out[BASE + path] = keys
    return out


def backend_bodies():
    """路径 → 后端 Json<XxxBody> 里的字段名。"""
    routes, structs, handlers = {}, {}, {}
    for f in BE.rglob('*.rs'):
        s = f.read_text(encoding='utf-8')
        for line in s.split('\n'):
            m = re.search(r'\.route\(\s*"([^"]+)"\s*,\s*(.+)$', line)
            if not m:
                continue
            for hm in re.finditer(r'\b(?:post|patch|put)\(\s*([A-Za-z_0-9:]+)', m.group(2)):
                routes[re.sub(r':[a-z_]+', ':x', m.group(1))] = hm.group(1).split('::')[-1]
        for m in re.finditer(r'struct\s+([A-Za-z0-9_]+)\s*\{([^}]*)\}', s):
            fields = set(re.findall(r'(?:pub\s+)?([a-z_][a-z0-9_]*)\s*:', m.group(2)))
            if fields:
                structs[m.group(1)] = fields
        for m in re.finditer(r'async fn ([a-z_0-9]+)\s*\((.*?)\)\s*->', s, re.S):
            jm = re.search(r'Json\(\s*\w+\s*\)\s*:\s*Json<([A-Za-z0-9_]+)>', m.group(2))
            if jm:
                handlers[m.group(1)] = jm.group(1)
    return {p: structs.get(handlers.get(h), None) for p, h in routes.items()}


fe, be = frontend_bodies(), backend_bodies()
if not fe or not be:
    print(f'✗ 前端 {len(fe)} 处 / 后端 {len(be)} 条 —— 有一边没解析到，'
          f'查不到东西的核对必须失败')
    sys.exit(1)

bad = 0
checked = 0
skipped = []
for path, keys in sorted(fe.items()):
    want = be.get(path)
    if want is None:
        skipped.append(path)         # 那条路由不收 Json（或者取不到），比不了
        continue
    checked += 1
    extra = sorted(keys - want)
    if extra:
        print(f'✗ {path}　前端发了后端不认的字段：{" ".join(extra)}')
        print(f'    后端收的是：{" ".join(sorted(want))}')
        bad += 1

print()
print(f'写操作 {len(fe)} 处 · 比对了 {checked} 处 · 对不上 {bad} 处 · 比不了 {len(skipped)} 处')
if skipped:
    print('  比不了的（那条路由不收 Json 体）：' + ' '.join(skipped))
if bad:
    print('✗ 请求体对不上。路径还在、响应结构也没变，只有运行期一个 422')
    sys.exit(1)
print('✓ 发出去的字段后端都认')
