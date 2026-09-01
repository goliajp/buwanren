#!/usr/bin/env python3
"""收货地址，要发在【发货那一步真读的】那个字段上。

2026-09-01:前端把地址装进 `contact` 发出去，后端存进 `order_meta.contact_json`，
而建运单时收件人快照读的是 `shipping_address_json`，外面还套着
`COALESCE(…, '{}'::jsonb)` —— 于是每一张实物单的面单都是空的:
没有姓名、没有电话、没有地址。买家刚被强制选过一次地址，全程一处不报错。

为什么活了下来:
  · `check-bodies.py` 的判据是单向的 —— 只报「前端发了后端不认的字段」，
    漏发按设计不报
  · 镜像里 `wx.chooseAddress` 是真机专有、会抛（这是对的），
    所以动线永远跑不到这条路

判据:把「发货那一步读哪个列」从 Rust 里读出来，再要求下单请求体里
真有那个名字的字段 —— 两层对着核，不靠记忆。
"""
import re, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
履约 = 根 / 'backend/unmei-app/src/fulfillment.rs'
下单 = 根 / 'mini/miniprogram/services/commerce.ts'

src = 履约.read_text(encoding='utf-8')
# 建 shipment 那一段里，收件人快照取的是哪一列
m = re.search(r'INSERT INTO shipment.*?SELECT.*?\(SELECT\s+(\w+)\s+FROM order_meta', src, re.S)
if not m:
    print('✗ 读不出建运单时收件人快照取哪一列 —— 这一支够不着要验的东西，不算通过')
    sys.exit(1)
列 = m.group(1)                                   # shipping_address_json
字段 = 列[:-5] if 列.endswith('_json') else 列      # shipping_address

体 = 下单.read_text(encoding='utf-8')
m2 = re.search(r"createOrder:.*?api\.post<CreatedOrder>\(\s*'/v1/orders',\s*\{(.*?)\n      \},", 体, re.S)
if not m2:
    print('✗ 读不出下单请求体 —— 这一支在空转')
    sys.exit(1)
请求体 = m2.group(1)

if 字段 not in 请求体:
    print(f'  ✗ 建运单读的是 order_meta.{列}，而下单请求体里没有 `{字段}` ——')
    print(f'     地址收下了、也入库了，只是发货那一步读的是另一列，面单会是空的')
    print(f'✗ 地址落到发货读的那一列')
    sys.exit(1)
print(f'✓ 地址落到发货真读的那一列 · 运单读 {列}，下单发 {字段}')
