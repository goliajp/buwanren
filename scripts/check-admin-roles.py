#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""后台的写操作，哪些没查角色。

`Admin` 提取器只验 token 是不是有效 —— 角色**只在显式调用 `requires_role`
的地方**才查。而角色是已生效的概念：种子管理员带着 super / operator /
content / support / finance 五个，其中 4 处路由真在用它。

也就是说：一个只有 `support` 的管理员，照样批得了退款、标得了支付失败、
取消得了订单。种子管理员五个角色全带，所以谁也不会注意到。

**哪个角色管哪条是产品 / 运营的决定**（谁有权批退款），不是实现方能拍的。
所以这里不判「该不该加」，只判「有没有变」：

  · 台账里记着的那些，现在仍然没查角色 → 照旧（打印，不计失败）
  · 台账里的某条已经查了角色          → 红，那一条该划掉
  · 新出现一条没查角色的写操作        → 红，要么加上，要么写明为什么

判据是「函数体里有没有 requires_role / requires_any_role」。这判不出角色对不对 ——
它判的是「这条路由有没有人想过角色这回事」。
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'backend/unmei-admin-api/src/routes'
LEDGER = ROOT / 'scripts/admin-role-gaps.json'

# 【一条 route 上可能挂好几个方法】（2026-09-03 第四轮评审 · 工程审计）。
# 上一版要求写方法【紧跟逗号】，于是 `get(list).post(create)` 一个都取不到、
# `patch(update).delete(remove)` 只取到第一个 ——
# `POST /admin/quotes` 与 `DELETE /admin/quotes/:id` 从来不在名单里。
# 审计实测:把 `create` 的 `requires_role("content")` 拿掉，
# 这一支仍报「17 条 · 查了角色 16 条」一字不变。
# 改成先切出整条 route，再在里头找【所有】写方法。
ROUTE = re.compile(r'\.route\(\s*"([^"]+)"\s*,\s*(.+?)\)\s*(?=\.route|;|$)', re.S)
VERB = re.compile(r'\b(post|put|patch|delete)\(([a-z_0-9]+)\)')


def 写方法(src):
    """→ [(path, verb, fn), …]，一条 route 上挂几个就出几条。"""
    出 = []
    for path, 体 in ROUTE.findall(src):
        for verb, fn in VERB.findall(体):
            出.append((path, verb, fn))
    return 出

unguarded = {}
guarded = {}
for f in sorted(SRC.glob('*.rs')):
    src = f.read_text(encoding='utf-8')
    for path, verb, fn in 写方法(src):
        m = re.search(r'async fn ' + fn + r'\b(.{0,4000}?)\n}\n', src, re.S)
        body = m.group(1) if m else ''
        key = f'{verb.upper()} {path}'
        # 两个名字都要认。只写 `requires_role` 的话，用 `requires_any_role`
        # 的那几条会被当成「没查角色」—— 而它们查得比单角色那几条还细。
        # 不靠「`requires_any_role` 里含 `requires_role`」这种子串巧合：
        # 那种依赖在有人改名的那天会静静失效。
        checked = any(t in body for t in ('requires_role', 'requires_any_role'))
        (guarded if checked else unguarded)[key] = fn

led = json.loads(LEDGER.read_text(encoding='utf-8'))
known = {k for k in led.get('没查角色的写操作', {})}

bad = 0
for key in sorted(unguarded):
    if key not in known:
        print(f'✗ {key} 是写操作却没查角色，而台账里没有这一条')
        print('   要么加 requires_role，要么把它记进 scripts/admin-role-gaps.json 并写明为什么')
        bad += 1

for key in sorted(known):
    if key in guarded:
        print(f'✗ {key} 现在已经查角色了 —— 台账那一条该划掉，否则台账会烂')
        bad += 1
    elif key not in unguarded:
        print(f'✗ {key} 在台账里，但源码里找不到这条写操作 —— 改名或删了？台账要跟着改')
        bad += 1

print(f'{"✗" if bad else "✓"} 后台写操作 {len(guarded) + len(unguarded)} 条 · '
      f'查了角色 {len(guarded)} 条 · 台账记着 {len(known)} 条')
sys.exit(1 if bad else 0)
