#!/usr/bin/env python3
"""库里真出现的枚举值，运营台都得有中文说法。

【为什么要有这一支】——运营台的每一列都是「拿后端给的值，查一张表，
渲中文」。查不到的原样显示,而那句「原样显示」在 `util.ts` 里是
写明的取舍:编一个好听的名字比英文原值更难查。取舍没错,
错的是【没人知道哪些值没收录】——它渲染正常、门禁全绿,
只有把那一页真的打开、并且那一行恰好在第一屏，才看得见。

25 计划的后台逐页走一天里撞见四次:
  · 财务页「业务」列里 `sale` 跟「退款」并排（库里 11,391 条）
  · 商品页「怎么交付」列里 `async_compute` 夹在「入住」「寄实物」中间
  · 订阅页「渠道」列里 `wechat` 跟「微信小程序」隔行交替（1,179 条）
  · 商品页状态下拉直接把 `listed` 摆上屏
每一次都是同一个形状:**库里有这个值，标签表里没有**。
那是机器查得出来的。

判据:对下面每一对（库里的列 → util.ts 里的表），
把该列出现过的值取出来，逐个查表;查不到就是红。
豁免走 `放过` —— 跟别的门禁一样，例外要有名有姓。
"""
import os
import re
import pathlib
import subprocess
import sys

根 = pathlib.Path(__file__).resolve().parent.parent
util = (根 / 'webadmin' / 'src' / 'components' / 'util.ts').read_text(encoding='utf-8')

# 库里的列 → util.ts 里那张表的名字（用于报错时指路）
要核的 = [
    ('journal_entry', 'business_kind', '枚举名'),
    ('product',       'fulfillment_kind', '枚举名'),
    ('product',       'kind', '枚举名'),
    ('subscription',  'source_channel', 'channelLabel'),
    ('payment',       'channel', 'channelLabel'),
    ('shipment',      'carrier_code', 'carrierLabel'),
    # 区名。真出现过的有 cn / hk / p25 / verify —— 后两个是这个仓库
    # 自己造的区（校验商品、25 计划的验收商品），它们不进真目录，
    # 更要在屏上一眼认得出来。
    ('order_record',  'region', 'regionLabel'),
    ('app_user',      'region', 'regionLabel'),
]

# 【客人那一侧也要核】（2026-09-05 · 25 计划的用户逐屏走）。
#
# 上面八列核的都是运营台。而同一个病在小程序里更贵：对着运营台的人
# 至少知道 `sf` 是个代号，对着订单页的买家不知道。
# 这一天在客人那一侧撞见两处，都在已经照过三轮相的屏上:
#   · 订单页物流卡的单号那一行写着「sf · P25ADMIN0001」——
#     `{{item.carrier_code}}` 原样上屏，而后台早有 `carrierLabel`
#   · 「订着的」那一屏把 `plan-mg-month` / `active` / ISO 时间戳
#     三样原样打出来 —— 那一支从来没有一位真的订着的人来过
#
# 小程序没有一张总表（各页自己写一张），所以这里点名到页。
要核的小程序 = [
    ('shipment',     'carrier_code', 'pages/order/index.ts', '快递说法'),
    ('shipment',     'status',       'pages/order/index.ts', '物流说法'),
    ('subscription', 'status',       'pages/subs/index.ts',  '状态说法'),
    ('activity',     'category',     'pages/activity/index.ts', '类别名'),
    # 设置页那一行「平台 · 区域 · 语言」——出了问题它是念给客服听的
    ('app_user',     'region',       'pages/settings/index.ts', '区'),
    ('app_user',     'platform',     'pages/settings/index.ts', '端'),
    ('app_user',     'locale',       'pages/settings/index.ts', '语'),
]

# 显式豁免：这些值真出现过，而屏上【不该】给它中文
放过 = {
    ('shipment', 'carrier_code', 'manual'),   # 人工录入的运单，界面另有说法
    # 后端测试跑出来的假值(396 行)。产品不会产生它 ——
    # 给它一个中文说法，等于把测试垃圾当成一档真状态供着
    ('app_user', 'locale', 'xx-TEST'),
}


def 键们(体: str) -> set:
    """表体里的键。

    【一行可以写好几个键】。`instant: '即时', shipping: '寄实物',` 是一行三个,
    按行首取只会拿到第一个 —— 头一版就这么放走了 shipping / residency
    这几个明明收录了的（自己造出三条假红）。
    认「键: '」这个形状:值一定是字符串字面量。

    【键本身可能带引号】。`'zh-CN': '简体中文'` 里的键不是合法标识符，
    必须写成带引号的 —— 不认引号的话，`zh-CN` 会被读成 `CN`
    （从破折号后面起手，后面正好跟着 `': '`），于是这张表看着有键、
    每一个都对不上号。
    """
    return set(re.findall(r"['\"]?([A-Za-z_][A-Za-z0-9_.\-]*)['\"]?\s*:\s*'", 体))


def 表里的键(名: str, 源: str = None) -> set:
    """把那张表的键取出来。

    三种写法都要认:顶层的 `const 枚举名: Record<...> = { ... };`（运营台）、
    函数里 `return { ... }[ch] ?? ch`（运营台）、
    以及小程序页里 `const 物流说法: Record<...> = { ... }`（收尾没有分号）。
    """
    if 源 is not None:
        # 小程序那一档。这几张表里没有嵌套花括号，所以取到第一个 `}` 为止 ——
        # 【不能按行首那个 `}` 找】:`区` 那张表缩在函数里、`语` 写在一行上，
        # 两种都够不着行首。头一版就是这么把设置页那两张表整个漏掉的。
        m = re.search(r'const ' + 名 + r'[^=]*=\s*\{([^{}]*)\}', 源, re.S)
        return 键们(m.group(1)) if m else set()
    if 名 in ('枚举名', '状态名'):
        m = re.search(r'const ' + 名 + r'[^=]*=\s*\{(.*?)\n\};', util, re.S)
    else:
        # 这几个函数的写法不统一:有的 `return { … }` 收尾在自己一行,
        # 有的是 `return { … }[ch] ?? ch;` 挤在末行。取到 `}[` 为止，两种都认。
        # 【函数体开头可能先有一段块注释】——`carrierLabel` 2026-09-05 加了一段,
        # 而 `\{\s*return` 跨不过它:这一支当场报「找不到那张表」。
        # 报得对（它确实够不着），但判据不该被一条注释挡住。
        m = re.search(r'export function ' + 名 + r'\([^)]*\)[^{]*\{\s*(?:/\*.*?\*/\s*)?return \{(.*?)\}\[',
                      util, re.S)
    if not m:
        return set()
    # 【一行可以写好几个键】。`instant: '即时', shipping: '寄实物',` 是一行三个,
    # 按行首取只会拿到第一个 —— 头一版就这么放走了 shipping / residency
    # 这几个明明收录了的（自己造出三条假红）。
    # 认「键: '」这个形状:值一定是字符串字面量。
    return 键们(m.group(1))


def 库里的值(表: str, 列: str) -> list:
    url = os.environ.get('PSQL_URL', 'postgres://unmei:unmei_dev_pwd@localhost:6032/unmei')
    r = subprocess.run(
        ['psql', url, '-tAc', f'SELECT DISTINCT {列} FROM {表} WHERE {列} IS NOT NULL'],
        capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 读不到 {表}.{列} —— 这一支够不着要验的东西，不算通过\n   {r.stderr.strip()[:200]}')
        sys.exit(1)
    return [x for x in r.stdout.split('\n') if x.strip()]


坏, 核过 = [], 0
for 表, 列, 表名 in 要核的:
    键 = 表里的键(表名)
    if not 键:
        print(f'✗ 在 util.ts 里找不到 `{表名}` 那张表 —— 判据够不着，不算通过')
        sys.exit(1)
    for v in 库里的值(表, 列):
        核过 += 1
        if (表, 列, v) in 放过 or v in 键:
            continue
        坏.append(f'{表}.{列} = 「{v}」　—— `{表名}` 里没有它，屏上会原样显示')

for 表, 列, 页, 表名 in 要核的小程序:
    路 = 根 / 'mini' / 'miniprogram' / 页
    if not 路.exists():
        print(f'✗ 找不到 {页} —— 判据够不着，不算通过')
        sys.exit(1)
    键 = 表里的键(表名, 路.read_text(encoding='utf-8'))
    if not 键:
        print(f'✗ 在 {页} 里找不到 `{表名}` 那张表 —— 判据够不着，不算通过')
        sys.exit(1)
    for v in 库里的值(表, 列):
        核过 += 1
        # 豁免跟运营台那一档共用一张表 —— 上一版这里漏了它，
        # 写好的例外一条也没生效（自己造出一条假红）
        if (表, 列, v) in 放过 or v in 键:
            continue
        坏.append(f'{表}.{列} = 「{v}」　—— {页} 的 `{表名}` 里没有它，客人那一屏会看见英文')

if 坏:
    print(f'✗ {len(坏)} 个枚举值没有中文说法 —— 它们会照着英文原样上屏：')
    for x in 坏:
        print('   ' + x)
    print('   （补进 webadmin/src/components/util.ts 或对应的小程序页；真该是英文的，写进这个脚本的「放过」）')
    sys.exit(1)

print(f'✓ 枚举都有中文说法 · 核了 {len(要核的) + len(要核的小程序)} 列 · {核过} 个真出现过的值'
      f'（其中 {len(要核的小程序)} 列在客人那一侧）')
