#!/usr/bin/env python3
"""按 0830 标尺给每一屏打分（设计册 §1.5）。

先前每一轮都是我看着截图说「这屏成立」——**那不是自查，是印象**。
这一支把尺子里能机械判的那几条落成代码，剩下不能机判的明说不判。

判四条：

  A 沉浸  这一屏有没有村子里的东西在场（一张脸 / 一句谁说的话 / 一处景）
  B 我在哪儿  有没有标题（页面自己画的大字，不算导航栏）
  C 我能干什么  有没有【唯一】的主按钮 —— 两颗同样重的按钮让人挑，算不合格
  D 不是死路  有没有出口（按钮 / 底栏 tab / 分页）

不判的（写清楚，免得当成验过了）：
  · 「离开时带走了什么」—— 那要读内容，机器判不了
  · 好不好看

判据落在 wxml 的结构上，不跑浏览器 —— 这一支要在没有 Postgres 的机器上也能跑。
"""
import re
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
页 = 根 / 'mini/miniprogram/pages'

# tab 屏的出口是底栏，不在页面里 —— 它们不需要自己的「回去」
TAB屏 = {'village', 'home', 'me'}
# 引擎屏:整屏是画面，标题与按钮都在引擎里画
引擎屏 = {'room', 'lighting'}
# 账户类 + 你自己的文档:列表、表单、那一份。没有人在场是合理的 ——
# 「那一份」是【你的】盘，村民不参与;硬摆一张脸反而假
#（设计册 §1.5.2 末尾写明这一条）
账户屏 = {'me', 'settings', 'bind', 'name', 'report', 'orders', 'subs'}

# 「村子里的东西在场」的几种形态
在场 = [
    r'face-\{\{',            # 一张脸（按方向配色）
    r'class="[^"]*say',      # 一句谁说的话（`says-*` 与 `say-*` 两种写法都算）
    r'class="[^"]*intro',    # 村子自己在说
    r'<canvas',              # 一处景
    r'class="[^"]*-art"',    # 空状态与徽章那种圆牌 —— 也是村子的物件
    r'class="[^"]*-face"',   # 商品 / 确认 / 我家那几处的圆牌
]

错, 记 = [], []
文件 = sorted(页.glob('*/index.wxml'))
if not 文件:
    print('✗ 一个页面都没找到 —— 这支门禁够不着要验的东西，不算通过')
    sys.exit(1)

for f in 文件:
    屏 = f.parent.name
    s = re.sub(r'<!--.*?-->', '', f.read_text(encoding='utf-8'), flags=re.S)
    if 屏 in 引擎屏:
        记.append(f'· {屏}　整屏是引擎画面，四条都不由 wxml 说了算 —— 不判')
        continue

    # A 沉浸
    有人 = any(re.search(p, s) for p in 在场)
    if not 有人 and 屏 not in 账户屏:
        错.append(f'{屏} 屏上没有村子里的东西 —— 没有脸、没有谁说的话、没有一处景')

    # B 我在哪儿
    # 标题的几种写法都算 —— `title` / 说话卡的大字 / 入住那屏的 `line1` /
    # 空状态的 `empty-t` / 确认屏那张卡的 `card-name`。
    # **tab 屏不判**:底栏上就写着它叫什么，页面里再写一遍是同一个词出现两次
    # （「我家」正是刻意去掉大标题的，而它吃掉的是罗盘要的空间）。
    if 屏 not in TAB屏 and not re.search(
            r'class="[^"]*\b(title|says-text|line1|empty-t|card-name)\b', s):
        错.append(f'{屏} 没有标题 —— 三秒内答不出「我在哪儿」')

    # C 唯一的主按钮。`class="btn"` 不带 ghost 的就是主按钮
    # 按【互斥分支】切开再数。`<block wx:if>` / `<block wx:elif>` 把一屏分成
    # 几种同时只出现一种的形态（natal 的 summary 与 form 就是两支）——
    # 不切开数的话，两支各一颗主按钮会被算成「一屏两颗」。
    # 条件互斥也算：一颗写 `{{x}}`、另一颗写 `{{… && !x}}`，
    # 结构上它们不会同时出现（一单那一屏的「去扫开它」与「去支付」就是这样）。
    # 这比「靠数据保证不同时为真」硬 —— 数据那种，下一个改后端的人不会知道。
    def 去掉条件互斥(按钮们):
        剩 = list(按钮们)
        for b in 按钮们:
            条件 = re.search(r'wx:if="\{\{([^}]*)\}\}"', b)
            if not 条件:
                continue
            for 名 in re.findall(r'!\s*([A-Za-z_$][\w$.]*)', 条件.group(1)):
                if any(re.search(r'wx:if="\{\{\s*' + re.escape(名) + r'\s*\}\}"', o)
                       for o in 剩 if o is not b):
                    剩.remove(b)
                    break
        return 剩

    段 = re.split(r'<block\s+wx:(?:if|elif|else)', s)
    for 这一段 in 段:
        # 连着父节点上的 `wx:if` 一起看 —— 条件常写在外层 `<view class="cta">` 上，
        # 只看 `<button>` 自己的属性会漏掉那一层（一单那一屏就是）。
        主 = [父 + b for 父, b in re.findall(
            r'(<view[^>]*wx:if="[^"]*"[^>]*>\s*)?(<button[^>]*class="btn(?![^"]*ghost)[^"]*")',
            这一段)]
        主 = 去掉条件互斥(主)
        # 只有 `wx:elif` / `wx:else` 才是**跟前一颗互斥**;`wx:if` 只是
        # 「有条件出现」，它跟旁边那颗可以同时在（村民屏的「问事」与
        # 「她卖的东西」就是这样 —— 把后者提成主按钮，两颗会一起出现，
        # 而我头一版把带 wx:if 的一律算互斥，那条变异就逃掉了）。
        互斥 = sum(1 for b in 主 if 'wx:elif' in b or 'wx:else' in b)
        if len(主) - 互斥 > 1:
            错.append(f'{屏} 同一支里有 {len(主)} 颗主按钮（{互斥} 颗接在前一颗的另一支上）'
                      f'—— 一屏只该有一件要你做的事')
            break

    # D 不是死路
    # 出口 = 任何一下能离开这一屏的点击。`goXxx` 一律算（它们都是跳转），
    # tab 屏的出口是底栏，翻页屏至少翻得动
    出口 = (re.search(r'bindtap="(onBack|go[A-Z]\w*)"', s)
            or 屏 in TAB屏
            or re.search(r'onPrev|onNext', s))
    if not 出口:
        错.append(f'{屏} 找不到出口 —— 进来了出不去')

if 记:
    print('\n'.join(记))
if 错:
    print('\n'.join('✗ ' + e for e in 错))
    print('\n  尺子在 .claude/design/product-0830.html §1.5')
    sys.exit(1)
print(f'✓ {len(文件)} 屏都过了四条（沉浸 · 我在哪儿 · 一件事 · 不是死路）')
print('  · 「离开时带走了什么」与「好不好看」机器判不了 —— 那两条靠人看，不在这一支里')
