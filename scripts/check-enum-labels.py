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

# 显式豁免：这些值真出现过，而屏上【不该】给它中文
放过 = {
    ('shipment', 'carrier_code', 'manual'),   # 人工录入的运单，界面另有说法
}


def 表里的键(名: str) -> set:
    """把 util.ts 里那张表的键取出来。

    两种写法都要认:顶层的 `const 枚举名: Record<...> = { ... }`
    与函数里 `return { ... }[ch] ?? ch`。
    """
    if 名 in ('枚举名', '状态名'):
        m = re.search(r'const ' + 名 + r'[^=]*=\s*\{(.*?)\n\};', util, re.S)
    else:
        # 这几个函数的写法不统一:有的 `return { … }` 收尾在自己一行,
        # 有的是 `return { … }[ch] ?? ch;` 挤在末行。取到 `}[` 为止，两种都认。
        m = re.search(r'export function ' + 名 + r'\([^)]*\)[^{]*\{\s*return \{(.*?)\}\[', util, re.S)
    if not m:
        return set()
    # 【一行可以写好几个键】。`instant: '即时', shipping: '寄实物',` 是一行三个,
    # 按行首取只会拿到第一个 —— 头一版就这么放走了 shipping / residency
    # 这几个明明收录了的（自己造出三条假红）。
    # 认「键: '」这个形状:值一定是字符串字面量。
    return set(re.findall(r"([A-Za-z_][A-Za-z0-9_]*)\s*:\s*'", m.group(1)))


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

if 坏:
    print(f'✗ {len(坏)} 个枚举值没有中文说法 —— 它们会照着英文原样上屏：')
    for x in 坏:
        print('   ' + x)
    print('   （补进 webadmin/src/components/util.ts 的对应表；真该是英文的，写进这个脚本的「放过」）')
    sys.exit(1)

print(f'✓ 枚举都有中文说法 · 核了 {len(要核的)} 列 · {核过} 个真出现过的值')
