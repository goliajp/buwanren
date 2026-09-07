#!/usr/bin/env python3
"""运营台的界面文案必须是中文。

【为什么要有这一支】——这台控制台是给中文运营看的,而它长出来的方式是
先有接口、再照着字段名摆一个表。于是屏幕上写着 `filters` / `all gate` /
`loading…` / `naji_record · JOIN app_user` —— 都不是错误,只是没人翻译,
而没人翻译的地方永远不会自己被发现:它渲染正常、门禁全绿、
只有第一次打开的人看不懂。

判据:JSX 里【直接显示给人看】的文字（元素内容、placeholder、
按钮 title）不能整段是英文。表名、字段名、代号本来就是英文的,
放进 `放过` 里逐条豁免 —— 豁免是显式的,不是靠正则宽松。
"""
import pathlib, re, sys

import sys
# `scripts/` 不一定在 sys.path 上（直接 `python3 scripts/x.py` 时在，
# 被 runpy / 别处 import 时不在）—— 显式加，免得换个跑法就 ModuleNotFound。
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _walk import 全找

根 = pathlib.Path(__file__).resolve().parent.parent / 'webadmin' / 'src'

# 显式豁免：这些就是英文的东西，不是没翻译
放过 = {
    'SKU', 'SPU', 'ID', 'API', 'JSON', 'CNY', 'USD', 'JPY', 'HKD', 'TWD', 'EUR',
    'Apple IAP', 'Google Play', 'Stripe', 'unmei', 'mingli', 'admin',
    'Claude', 'OK', 'A/B', 'iOS', 'Android',
    # 登录页上的字标。产品对外叫「不完人」，代号叫 unmei ——
    # 这一行是标识，不是没翻译的文案（2026-09-03 正则补上 `·` 之后现形的）。
    'unmei · console',
    # 单位与代号:夹缝那一条会扫到它们，而它们本来就是这么写的
    'ms', 'cell',
    # 【事件页那两句真该是英文】（2026-09-04 · 25 计划的后台逐页走）。
    # 这一页是给排查用的:运营在这儿输的就是 `event id`、`aggregate id`,
    # 而事件类别（`OrderPaid` / `RefundCompleted`）是【领域事件的名字】——
    # 它要跟代码里、日志里的那个字对得上，翻成中文就搜不着了。
    # 跟 `util.ts` 里那条取舍同源:编出来的名字比英文原值更难查。
    'event id / aggregate id / kind',
    'OrderPaid / RefundCompleted / …',
}
中文 = re.compile(r'[一-鿿]')
# 整段英文：字母开头，通篇只有字母、空格与常见标点
# 【`·` 也要算进去】（2026-09-03 五路评审 · 门禁审计）。
# 上面那段文档里举的例子是 `naji_record · JOIN app_user` ——
# 而分隔点不在这个字符集里，所以这一支【连自己文档里的例子都匹配不上】。
# 中点是这台控制台里最常见的连接符（`表名 · 用途` 到处都是），
# 漏掉它等于漏掉最像的那一类。
# 【两个字母也算】（2026-09-04 · 25 计划的后台逐页走）。
# 原先是 `{2,40}`，也就是【总长至少三个字符】——
# 于是三页分页条上的「of」一个都没抓到:它只有两个字母。
# 那正是这一支要防的东西:整台控制台说中文，角落里冒出一个英文词。
# 降到两个字母之后全仓多出的命中【只有那一处】,
# 单位与代号（ms / cell / ID / OK）在上面的「放过」里逐条豁免。
纯英 = re.compile(r'^[A-Za-z][A-Za-z0-9 ._/…&+()\'’·,-]{1,40}$')

坏 = []
文件数, 看过 = 0, 0
# 【不要走进构建产物】(scripts/_walk.py)。原先是 `根.rglob('*.tsx')`,
# 一个过滤都没有 —— node_modules 与 target 整棵都在里面。
for f in 全找(根, '*.tsx'):
    文件数 += 1
    源 = f.read_text(encoding='utf-8')
    for i, 行 in enumerate(源.splitlines(), 1):
        if 行.lstrip().startswith(('*', '//', '/*')):
            continue
        # 命令行、代码块里的英文就是英文 —— 「怎么把服务起起来」那一段
        # 印的正是要照抄的命令，翻成中文反而没法用。
        if re.search(r'<(code|pre|kbd)[ >]', 行):
            continue
        候选 = []
        # 元素内容 >…<。
        # 【泛型不是元素内容】——`api.get<PageRes<any>>('/x')` 里的
        # `api.get` 夹在 `>` 与 `<` 之间，长得跟一段界面文字一模一样。
        if not re.search(r'\w<[A-Z{(]', 行):
            候选 += [m.group(1) for m in re.finditer(r'>([^<>{}\n]{3,50})<', 行)]
        # 给人看的属性
        候选 += [m.group(2) for m in re.finditer(r'(placeholder|title)="([^"]{3,50})"', 行)]
        # 【写成对象属性的那些也算】（2026-09-04 · 25 计划的后台逐页走）。
        # 上面那条只认 JSX 属性 `placeholder="…"`,
        # 而这台控制台的筛选条是【数据驱动】的:
        #   { kind: 'text', key: 'keyword', label: '找', placeholder: 'code / name' }
        # 同一个东西两种写法，判据只认一种 —— 于是促销页搜索框里那句
        # `code / name`、事件页的 `event id / aggregate id / kind`
        # 从来没被这一支看见过。
        候选 += [m.group(2) for m in re.finditer(r"(placeholder|label|title):\s*'([^']{3,50})'", 行)]
        # 【夹在两个表达式之间的那些字】（2026-09-04 · 25 计划的后台逐页走）。
        # 上面那条要的是 `>文字<`，而 JSX 里最常见的文案位置是
        # `{从}–{到} of {总}` —— 「of」夹在 `}` 与 `{` 之间，
        # 前后都不是尖括号，那条正则一辈子够不着它。
        # 实测漏掉的正是这一种:三页各手写了一份分页,
        # 印的是「1–30 of 26,631」「page 1 / 888」,
        # 而其余十六页用共用组件、印的是「1-50 / 19,153」。
        # 整台控制台说中文，只有这三个角落说英文。
        #
        # 只在【看着像 JSX 的行】上找，且排开控制流关键字 ——
        # `if (a) {…} else {…}` 里那个 `else` 也夹在两个花括号之间。
        if re.search(r'<[A-Za-z/]', 行):
            候选 += [m.group(1) for m in re.finditer(r'\}([^<>{}\n]{2,40})[\{<]', 行)]
        # 【三元里的文字这一支撤掉了】。`x ? 'online' : 'offline'` 确实是
        # 屏幕上的字，但 `x ? 'listed' : 'delisted'` 是传给接口的枚举值，
        # 两者在正则眼里一模一样。加上它之后 55 条里 40 条是假的 ——
        # 而一支有假阳性的门禁会被学着忽略，那比没有它更糟。
        # 元素内容与 placeholder / title 这两条是准的，留着。
        for 文 in 候选:
            看过 += 1
            文 = 文.strip()
            if not 文 or 中文.search(文) or 文 in 放过:
                continue
            # 控制流关键字不是界面文案
            if 文.lower() in {'else', 'catch', 'finally', 'while', 'return', 'as', 'from'}:
                continue
            if 纯英.match(文):
                坏.append(f'{f.relative_to(根.parent.parent)}:{i}  「{文}」')

if 坏:
    print(f'✗ {len(坏)} 处界面文案还是英文 —— 对着屏幕的人读不懂，而它渲染正常：')
    for x in 坏[:30]:
        print('   ' + x)
    if len(坏) > 30:
        print(f'   …… 另有 {len(坏) - 30} 处')
    print('   （真该是英文的，加进脚本里的「放过」集合，一条一条地豁免）')
    sys.exit(1)
# 【查不到东西的核对必须失败】（2026-09-03 五路评审 · 门禁审计）。
# 上一版零个文件也印 ✓ —— 控制台改个目录名，这一支就此永远绿着。
if 文件数 < 15 or 看过 < 100:
    print(f'✗ 只扫到 {文件数} 个 .tsx、{看过} 段界面文字 —— '
          '路径对不上了？这一支够不着要验的东西，不算通过', file=sys.stderr)
    sys.exit(1)
print(f'✓ 运营台文案 · {文件数} 个页面 · {看过} 段界面文字，没有未翻译的英文')
