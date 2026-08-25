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

WRITE = re.compile(r'\.route\(\s*"([^"]+)"\s*,\s*(post|put|patch|delete)\(([a-z_0-9]+)\)')

unguarded = {}
guarded = {}
for f in sorted(SRC.glob('*.rs')):
    src = f.read_text(encoding='utf-8')
    for path, verb, fn in WRITE.findall(src):
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
