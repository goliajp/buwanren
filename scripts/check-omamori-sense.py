#!/usr/bin/env python3
"""挂着人 ≠ 是御守。

香也挂着苏合（`sku.villager_id`），但买香是寄一盒香给你，不是请她搬进来。
判据是商品的 `fulfillment_kind === 'residency'` —— 会不会有人住进村里。

这个等价错过三次，每次都是各自在前端推断「有 villager 就是御守」：
  · 商品页的眉标写「请回家」，而那是买香
  · 下单页的卡片写「苏合的御守」，底下明细却写「苏合配的那一味」
  · 订单详情的明细与标题同样

判据：拼「X 的御守」这句话的附近（前后三行）必须出现 residency 的判断 ——
三元表达式与 wx:if 都会把条件写在上一行，只看当行的话每一处正确的写法都会误报。
"""
import re, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
文件 = sorted((根 / 'mini/miniprogram').rglob('*.ts')) \
     + sorted((根 / 'mini/miniprogram').rglob('*.wxml'))
错 = []
查过 = 0
# 「……的御守」这句话是怎么拼出来的:取它所在的那一整条语句
拼 = re.compile(r"[^\n;]{0,200}的御守[^\n;]{0,80}")
守住 = re.compile(r"becomes_resident|residency|住进来")

for f in 文件:
    行们 = f.read_text(encoding='utf-8').splitlines()
    for i, 行 in enumerate(行们, 1):
        裸 = 行.strip()
        if 裸.startswith(('*', '//', '<!--', '/*')):
            continue                      # 注释里讨论这件事是允许的
        for m in 拼.finditer(行):
            片 = m.group(0)
            # 写死的整句（「一时找不到御守」这类）不是按人名拼的，放过
            if '+' not in 片 and '{{' not in 片:
                continue
            查过 += 1
            # 条件常常写在上一行（三元的 `? :`、wx:if），所以看一个小窗口
            窗 = '\n'.join(行们[max(0, i - 4):i + 2])
            if not 守住.search(窗):
                错.append(f'{f.relative_to(根)}:{i}　拼「的御守」却没判会不会住进来 —— 香也挂着人')

if not 文件:
    print('✗ 一个文件都没扫到 —— 检查器自己失效了'); sys.exit(1)
for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'挂着人不等于是御守 · 查了 {查过} 处拼名')
sys.exit(1 if 错 else 0)
