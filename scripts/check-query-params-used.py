#!/usr/bin/env python3
"""屏上摆出来的筛选框，后端得真的用上。

【为什么要有这一支】——2026-09-06 五路体验走查，一天里撞到同一个形状两次：

  · 退款页四百多条待批，**按订单号搜不到**。后端 `list_refunds` 收的是
    `Query<Pg>`，而 `Pg` 有 `keyword` —— SQL 里一次都没出现。
    实测带不带它都返回 2,538 条
  · 后台商品页筛选栏上摆着「类型」下拉框，而 `Pg` **没有 `kind` 字段**。
    实测 `kind=subscription` 与不带一样返回 13,901 条 ——
    **那个下拉框从建起来就没生效过**

**这一类缺陷两边都不报错。** serde 对不认识的字段是静静丢掉，
前端发了不会 422；后端收下不用也不会崩。屏上唯一的表现是
「我筛了，条数没变」—— 而运营会以为是自己筛错了条件。
这个仓在同一个形状上还栽过第三次（客户端 `category` 与 `kind` 那一回）。

【判据为什么是两侧的】：只判「结构体的字段有没有用上」会淹在噪音里 ——
`Pg` 是十几条路由共用的大结构体，各页各用其中几样，
一跑就是六十多条「没用上」，而它们绝大多数是正常的。
两侧那一版才对得上真正的伤害：**人在屏上看得见、点得动、而它不起作用。**

  屏上那个筛选框（`webadmin/src/pages/*.tsx` 的 `<FilterBar fields={[…]}>`）
    → 它调的那条接口（`webadmin/src/lib/api.ts`）
      → 后端那个 handler（路由表）
        → 那个字段在函数体里被碰过没有

不判「用得对不对」—— 那要读 SQL 的语义。只判「有没有碰过」：
一次都没碰的，一定是收下了不用。
"""
import pathlib
import re
import sys

根 = pathlib.Path(__file__).resolve().parent.parent
后端 = 根 / 'backend/unmei-admin-api/src/routes'
页目录 = 根 / 'webadmin/src/pages'

# 【明说的例外】。名单在这儿，谁都看得见 —— 每条都要写清为什么。
豁免 = {
    # 前端本地筛，不发给后端的那些写在这儿。目前没有。
}


def 函数体(src: str, 起: int) -> str:
    """从 `{` 起按花括号配对切出函数体"""
    深 = 0
    for i in range(起, len(src)):
        if src[i] == '{':
            深 += 1
        elif src[i] == '}':
            深 -= 1
            if 深 == 0:
                return src[起:i + 1]
    return src[起:]


# ── 一 · api.ts：接口名 → 路径 ────────────────────────────
api_src = (根 / 'webadmin/src/lib/api.ts').read_text(encoding='utf-8')
# `api.get<PageRes<any>>(…)` 的泛型是嵌套的，所以不能用 `<[^>]*>` ——
# 那会停在里层那个 `>` 上。吃到第一个 `(` 为止就对了。
接口 = dict(re.findall(r"""(\w+):\s*\([^)]*\)\s*=>\s*api\.get[^(]*\(\s*['"`]([^'"`]+)""", api_src))
if len(接口) < 5:
    print(f'✗ 从 api.ts 只解出 {len(接口)} 条 GET 接口 —— 正则多半没匹配上，这一支在空转')
    sys.exit(1)

# ── 二 · 路由表：路径 → handler ──────────────────────────
路由 = {}
handler源 = {}
for f in sorted(后端.glob('*.rs')):
    src = f.read_text(encoding='utf-8')
    for m in re.finditer(r'\.route\(\s*"([^"]+)"\s*,\s*get\(([a-z_0-9]+)\)', src):
        路由[m.group(1)] = m.group(2)
        handler源[m.group(2)] = (f.name, src)
if len(路由) < 10:
    print(f'✗ 只解出 {len(路由)} 条 GET 路由 —— 正则多半没匹配上，这一支在空转')
    sys.exit(1)

# ── 三 · 每个 handler 碰过哪些字段 ───────────────────────
def 碰过的(名: str):
    if 名 not in handler源:
        return None
    _, src = handler源[名]
    m = re.search(r'async fn ' + re.escape(名) + r'\s*\((.*?)\)\s*->\s*[^{]*\{', src, re.S)
    if not m:
        return None
    q = re.search(r'Query\(\s*([a-z_0-9]+)\s*\)\s*:\s*Query<', m.group(1))
    if not q:
        return set()
    体 = 函数体(src, m.end() - 1)
    return set(re.findall(r'\b' + q.group(1) + r'\s*\.\s*([a-z_]+)', 体))


坏, 查过, 跳过 = [], 0, []
页们 = sorted(页目录.glob('*.tsx'))
if len(页们) < 10:
    print(f'✗ 只找到 {len(页们)} 个后台页面 —— 路径多半不对，这一支在空转')
    sys.exit(1)

for f in 页们:
    src = f.read_text(encoding='utf-8')
    m = re.search(r'<FilterBar\b(.*?)/>', src, re.S)
    if not m:
        continue
    键 = re.findall(r"key:\s*'([a-z_]+)'", m.group(1))
    调 = sorted(set(re.findall(r'commerce\.(list[A-Za-z]+)\(', src)))
    if len(调) != 1:
        # 一页两个列表（促销页有促销与券两张表）—— 说不准筛选框归哪一张，
        # **明说跳过**，不当成通过
        跳过.append(f'{f.name}（{len(调)} 个列表调用，说不准筛选框归哪一个）')
        continue
    路径 = 接口.get(调[0])
    if not 路径:
        跳过.append(f'{f.name}（api.ts 里找不到 {调[0]}）')
        continue
    handler = 路由.get('/admin' + 路径)
    if not handler:
        跳过.append(f'{f.name}（路由表里找不到 /admin{路径}）')
        continue
    用了 = 碰过的(handler)
    if 用了 is None:
        跳过.append(f'{f.name}（读不出 {handler} 的函数体）')
        continue
    查过 += 1
    for k in 键:
        if (f.name, k) in 豁免 or k in 用了:
            continue
        坏.append(f'  ✗ {f.name} 的筛选栏上摆着「{k}」，而 {handler}() 一次都没碰过它\n'
                  f'     —— 人在屏上筛了，条数一点不变；serde 静静丢掉，两边都不报错')

for l in 跳过:
    print(f'  · 跳过 {l}')
for l in 坏:
    print(l)
if 查过 < 5:
    print(f'✗ 只对上了 {查过} 页 —— 这一支现在几乎什么都没验到')
    sys.exit(1)
if 坏:
    print(f'✗ 有 {len(坏)} 个筛选框是摆设 · 对上了 {查过} 页')
    sys.exit(1)
print(f'✓ 屏上的筛选框后端都真的用上了 · 对上了 {查过} 页 · 跳过 {len(跳过)} 页（上面逐条说了）')
