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

根 = pathlib.Path(__file__).resolve().parent.parent / 'webadmin' / 'src'

# 显式豁免：这些就是英文的东西，不是没翻译
放过 = {
    'SKU', 'SPU', 'ID', 'API', 'JSON', 'CNY', 'USD', 'JPY', 'HKD', 'TWD', 'EUR',
    'Apple IAP', 'Google Play', 'Stripe', 'unmei', 'mingli', 'admin',
    'Claude', 'OK', 'A/B', 'iOS', 'Android',
}
中文 = re.compile(r'[一-鿿]')
# 整段英文：字母开头，通篇只有字母、空格与常见标点
纯英 = re.compile(r'^[A-Za-z][A-Za-z0-9 ._/…&+()\'’-]{2,40}$')

坏 = []
for f in sorted(根.rglob('*.tsx')):
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
        # 【三元里的文字这一支撤掉了】。`x ? 'online' : 'offline'` 确实是
        # 屏幕上的字，但 `x ? 'listed' : 'delisted'` 是传给接口的枚举值，
        # 两者在正则眼里一模一样。加上它之后 55 条里 40 条是假的 ——
        # 而一支有假阳性的门禁会被学着忽略，那比没有它更糟。
        # 元素内容与 placeholder / title 这两条是准的，留着。
        for 文 in 候选:
            文 = 文.strip()
            if not 文 or 中文.search(文) or 文 in 放过:
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
print('✓ 运营台文案 · 界面上没有未翻译的英文')
