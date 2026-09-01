#!/usr/bin/env python3
"""通向掏钱那一步的按钮，自己必须写着价钱。

村民屏那颗「请婆婆回村」是全屏唯一要花钱的地方，而它一直只写这五个字。
一个没用过的人不知道按下去是马上扣钱、还是先看看 —— 于是不按。
五路评审里三路各自把这条列成第一个不敢按的理由。

判据是机械的:
  找出 index.ts 里会跳到 product / confirm（掏钱那一路）的处理器，
  再回到 wxml 里确认:这一屏上【有价】—— 一处取自数据的
  `{{...价...}}` / `{{...price...}}`。
写死一个数字不算数:价在 price_book 上按区域生效，写死的那天就开始骗人。

要的是「同一屏上看得见」，不是「非写进按钮不可」——
商品页把 ¥29 排成整屏最大的一块，按钮写「就要这个」完全够;
村民屏之前是整屏一个数字都没有，那才是问题。
"""
import re, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
页目 = 根 / 'mini/miniprogram/pages'
掏钱 = re.compile(r"/pages/(product|confirm)/index")
错, 查过 = [], 0

for ts in sorted(页目.glob('*/index.ts')):
    源 = ts.read_text(encoding='utf-8')
    wxml = ts.with_suffix('.wxml')
    if not wxml.exists():
        continue
    页 = wxml.read_text(encoding='utf-8')
    # 处理器:`名(` 开头到下一个同级 `},` —— 取它的函数体
    for m in re.finditer(r'^  (\w+)\((?:[^)]*)\)\s*\{', 源, re.M):
        名 = m.group(1)
        体 = 源[m.end(): m.end() + 1200]
        体 = 体.split('\n  },')[0]
        if not 掏钱.search(体):
            continue
        # 【不只是 <button>】。六个掏钱入口里只有两个用 <button>，
        # 另外四个（名册一行、推荐卡、三档香、订阅一条）用的是
        # `<view bindtap>` —— 原先的正则只认 button，于是它们静默不查，
        # 而那三屏确实一个价都没有:正是这支门禁立案要防的形状，
        # 只是上移了一层（2026-09-01 五路评审 · 工程审计抓到）。
        标签 = r'(?:button|view)'
        for b in re.finditer(r'<' + 标签 + r'\b[^>]*bindtap="' + 名 + r'"[^>]*>(.*?)</' + 标签 + r'>', 页, re.S):
            查过 += 1
            # 【只认渲染出来的文字】。整页搜的话，`wx:if="{{价 && !没货}}"`
            # 这种【条件】里的价也会算数 —— 变异测试当场抓到:
            # 把按钮上的价拆了，它靠一个看不见的条件继续报绿。
            # 所以先把所有标签（连同属性）挖掉，只留文本节点。
            文本 = re.sub(r'<[^>]*>', '\u0001', 页)
            有价 = bool(re.search(r'\{\{[^}]*(价|price)[^}]*\}\}', 文本))
            if not 有价:
                行 = 页[:b.start()].count('\n') + 1
                错.append(f'{wxml.parent.name}:{行}　「{名}」这颗按钮通向掏钱那一步，'
                          f'这一屏上却一个价都没有 —— 不知道多少钱就没人敢按')

if not 查过:
    print('✗ 一颗掏钱按钮都没找到 —— 这一支在空转（跳转路径改名了？）')
    sys.exit(1)
for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'掏钱那一屏上都看得见价 · 查了 {查过} 颗按钮')
sys.exit(1 if 错 else 0)
