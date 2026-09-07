#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""后台每一页的读操作，失败时屏上要有话说。

【写的那一半修过，读的这一半原样留着】（2026-09-03 五路评审 · 后台产品体验）。
`webadmin/src/lib/feedback.ts` 开头写着「让写操作的失败被看见」——
在那之前 14 个 mutation 全都只有 mutationFn + onSuccess，一个 onError 都没有。
那一半接上了；而读这一侧，21 个页面、78 个 useQuery，
**一个 `isError` 分支都没有**。

查询失败时 `data` 是 undefined，于是：
  · 表体的 `(data?.items ?? []).map(...)` 什么都不渲染
  · 空态那一行的条件是 `data && items.length === 0`，也不渲染
屏上剩一张只有表头的空表 —— 「一条都没有」跟「取不到」长得一模一样。
看板更糟：它落进「都清完了」那一支，
**在后端连不上的时候用肯定句告诉运营今天没有事**。

判据：用了 `useQuery(` 的页面，文件里必须出现 `isError`。
判不出「说得对不对」，判的是「这一页有没有想过读会失败」——
跟 check-admin-roles 判「有没有人想过角色这回事」是同一个层次。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = ROOT / 'webadmin/src/pages'

# 显式豁免：这一页的读失败由别的东西说出来，写清是哪一个。
#
# 【今天一个都没有】。写这一支时我先把 Mingli 放进来豁免了，理由写的是
# 「整页就是一张健康卡，取不到会渲成『连不上』」—— 读了代码才发现不是：
# 它只分「有 data / 没 data」，而请求本身失败时也是「没 data」，
# 于是显示「正在探…」，一个永远转不完的省略号。
# 豁免写起来太容易，而写下的理由没人核 —— 那正是这一支要防的病。
放过: dict[str, str] = {}

页 = sorted(PAGES.glob('*.tsx'))
if len(页) < 15:
    print(f'✗ 只找到 {len(页)} 个页面（该有二十来个）—— 这一支够不着要验的东西，不算通过',
          file=sys.stderr)
    sys.exit(1)

坏, 查过 = [], 0
for f in 页:
    src = f.read_text(encoding='utf-8')
    n = len(re.findall(r'\buseQuery\(', src))
    if n == 0:
        continue
    查过 += 1
    if f.name in 放过:
        continue
    if 'isError' not in src:
        坏.append(f'{f.name}　{n} 个 useQuery，一个 isError 都没有 —— '
                 '取不到时这一页跟「没有数据」长得一模一样')

if 坏:
    print('✗ 这几页的读操作失败时屏上什么都不说：', file=sys.stderr)
    for b in 坏:
        print('    ' + b, file=sys.stderr)
    print('  表里加一行「取不到」，或者在这一支的「放过」里写明由谁来说。',
          file=sys.stderr)
    sys.exit(1)

print(f'✓ 后台 {查过} 个取数的页面，读失败都有话说'
      + (f'（{len(放过)} 页显式豁免）' if 放过 else ''))
