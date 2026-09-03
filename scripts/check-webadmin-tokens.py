#!/usr/bin/env python3
"""运营台的 className 只许引用真实存在的设计令牌。

【为什么要有这一支】——Tailwind 对不认识的类【不报错】,它只是不生成规则。
于是 `text-ink-5`（墨只有四档）、`bg-jade`（配色改名后不存在了）这些
渲染成【完全没有样式】,而页面看起来是「渲染成功」的:有字、有行、有表。
一次改配色留下的 267 处死类,靠肉眼一页页看是看不出来的 —— 它们不缺东西,
只是没上色。这跟镜像垫片「遇到不认识的就跳过」是同一种病:
失效长得跟正常一模一样。

判据:源码里出现的每一个 `(bg|text|border|…)-<令牌>`,
<令牌> 必须在 tailwind.config.js 的 colors 里,或是 Tailwind 自带的调色板。
"""
import json, pathlib, re, subprocess, sys

根 = pathlib.Path(__file__).resolve().parent.parent / 'webadmin'
配置 = 根 / 'tailwind.config.js'
if not 配置.exists():
    print('✗ 找不到 webadmin/tailwind.config.js'); sys.exit(1)

源 = 配置.read_text(encoding='utf-8')
# 自定义色名 —— 从 colors: { … } 那一段里抠出来
段 = re.search(r'colors:\s*\{(.*?)\n      \},', 源, re.S)
if not 段:
    print('✗ tailwind.config.js 里读不到 colors 段 —— 检查脚本是不是跟配置结构脱节了')
    sys.exit(1)
自定义 = set(re.findall(r"^\s*'?([a-z][a-z0-9-]*)'?:", 段.group(1), re.M))
if len(自定义) < 8:
    print(f'✗ 只抠出 {len(自定义)} 个色名，配置里明明更多 —— 正则跟配置脱节了')
    sys.exit(1)

# Tailwind 自带的、这台控制台允许直接用的
自带 = {
    'white', 'black', 'transparent', 'current', 'inherit', 'none', 'auto',
    'red', 'green', 'blue', 'gray', 'slate', 'zinc', 'neutral', 'stone',
}
NON_COLOR = re.compile(r'''(?x)
      xs|sm|base|lg|xl|\dxl                        # 字号
    | [trblxyse]|\d+                                # 边框方向与粗细：border-t / border-2
    | left|right|center|justify|start|end            # 对齐
    | top|bottom|middle|baseline
    | solid|dashed|dotted|double|hidden|none         # 线型
    | wrap|nowrap|balance|pretty|ellipsis|clip       # 换行与截断
    | collapse|separate|spacing|fixed|auto           # 表格
    | current|inherit|transparent
    | \w*mono|\w*sans|\w*serif                      # 字族
    | thin|extralight|light|normal|medium|semibold|bold|extrabold|black
    | opacity-\d+|offset-\d+|inset|reverse
    | \[.*                                          # 任意值 text-[11px]
''').fullmatch
前缀 = r'(?:bg|text|border|ring|fill|stroke|divide|decoration|outline|shadow|from|to|via|accent|caret|placeholder)'

坏 = []
for f in sorted((根 / 'src').rglob('*.tsx')) + sorted((根 / 'src').rglob('*.ts')):
    for i, 行 in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
        for m in re.finditer(rf'\b{前缀}-([a-z][a-z0-9]*(?:-[a-z0-9]+)*)', 行):
            令牌 = m.group(1)
            # 带斜杠透明度 / 方括号任意值先剥掉；数字档（-500）交给自带调色板
            根名 = 令牌.split('/')[0]
            if 根名 in 自定义 or 根名 in 自带:
                continue
            # 【同一个前缀既管颜色也管别的】——`border-b` 是「下边框」，
            # `border-rule` 才是颜色；`divide-y` 是「行间分隔」不是色。
            # 这些非颜色的用法要放过，否则门禁全是假阳性，没人会去读它。
            if NON_COLOR(根名):
                continue
            # 【兜底只给自带调色板的数字档】。上一版这里写的是
            # 「取主名再试一次」，本意是让 `text-ink` 过 ——
            # 结果 `text-ink-9`（墨只有四档）也跟着过了：主名 `ink` 在表里。
            # 自定义色是平铺的名字，没有数字档，必须整名相等；
            # 只有 Tailwind 自带的 `red-500` 这种才允许拆开看。
            主, _, 档 = 根名.partition('-')
            if 主 in 自带 and 档.isdigit():
                continue
            坏.append(f'{f.relative_to(根.parent)}:{i}  {m.group(0)}')

if 坏:
    print(f'✗ {len(坏)} 处 className 引用了不存在的令牌 —— 它们渲染成【没有样式】，不报错：')
    for x in 坏[:40]:
        print('   ' + x)
    if len(坏) > 40:
        print(f'   …… 另有 {len(坏) - 40} 处')
    sys.exit(1)
print(f'✓ 运营台令牌 · {len(自定义)} 个色名，className 无死引用')

# ── 用户明确提的两条约束 ────────────────────────────────────────
# 写成门禁而不是写在文档里：文档挡不住下一次顺手加一个 11px。

违 = []

# ① 不用 webfont。系统栈本来就是为界面调过的；拉外部字体的代价是
#    首屏先渲成别的字再跳一下，网络不通时整台控制台的字重全变。
for f in list((根 / 'src').rglob('*.css')) + [根 / 'index.html']:
    if not f.exists():
        continue
    for i, 行 in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
        # 注释里【提到】某个字体站不算拉它 —— 解释「为什么不用」的那段话
        # 被自己的门禁判违规，只会逼人把解释删掉。
        if 行.lstrip().startswith(('*', '//', '<!--', '/*')):
            continue
        if re.search(r'@import\s+url\(|fonts\.googleapis|fonts\.gstatic|rsms\.me|@font-face|typekit|fontshare', 行):
            违.append(f'{f.relative_to(根.parent)}:{i}  拉了外部字体 —— {行.strip()[:70]}')

# ② 12px 是地板。小到读不出来的字不是克制，是把信息藏起来 ——
#    而它们占的往往正是「这一列是什么」这种要紧位置。
# 【只看字号语境】。上一版这条正则抓任何 `'4px'`，于是
# borderRadius 的 4px 被报成「字号太小」—— 假阳性会让人学会忽略这支门禁，
# 而一支被忽略的门禁比没有还糟。
字号 = re.compile(r'text-\[(\d+(?:\.\d+)?)px|font-size:\s*(\d+(?:\.\d+)?)px')
for f in sorted((根 / 'src').rglob('*.ts*')) + sorted((根 / 'src').rglob('*.css')):
    if not f.exists():
        continue
    for i, 行 in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
        for m in 字号.finditer(行):
            值 = float(m.group(1) or m.group(2))
            if 值 < 12:
                违.append(f'{f.relative_to(根.parent)}:{i}  {值:g}px 低于 12px 地板 —— {行.strip()[:60]}')

if 违:
    print(f'✗ {len(违)} 处违反运营台的排版约束：')
    for x in 违:
        print('   ' + x)
    sys.exit(1)
print('✓ 运营台排版 · 无 webfont，字号不低于 12px')
