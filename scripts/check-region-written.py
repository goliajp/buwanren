#!/usr/bin/env python3
"""往带 region 的表里插行，要显式写 region。

`region` 这一列在库里有默认值 `'cn'` —— 不写它【永远不会报错】，
而后台每一条按区过滤的查询、11 个 KPI、月报都会永远只看得见 cn。
2026-09-03 第四轮评审实测:`payment` / `refund` / `shipment` /
`order_record` 四张表的 region 全库都只有一个值，
而写它们的七个模块里六个一次都没提过这个字段。

一个「不写也对、写了才对」的字段，只能靠这种检查守住 ——
它不会报错，只会安静地把四个区的账都算到一个区头上。

判据:源码里每一条 `INSERT INTO <带 region 的表>`，
列清单里要出现 region（`SELECT` 形式的插入也算，它同样列出列名）。

【例外】写在这里，各自说清为什么:有些表的 region 不是从订单继承的，
它本来就该由别处决定。例外是一个个列出来的，不是一张可以往里加名字的表。
"""
import os
import pathlib
import re
import subprocess
import sys

# `scripts/` 不一定在 sys.path 上 —— 显式加
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _walk import 全找

根 = pathlib.Path(__file__).resolve().parent.parent

# 这几张表插行时不要求写 region，各自的理由:
例外 = {
    'app_user':          '注册时按端与地区判定，不继承自任何单据',
    'accounting_period': '期间是按区开的，建期间那一句自己就在决定 region',
    'outbox_event':      '事件的 region 由 outbox::write 从聚合根带，不在 INSERT 字面量里',
    'price_book':        '价目本身就是按区定的，region 是它的主键成分',
    'sku':               '同上，货是按区上架的',
    'plan':              '同上',
    'coupon':            '同上',
    'promotion':         '同上',
    'risk_rule':         '风控规则按区配',
}


def 问库(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到，这一支没验成：{r.stderr.strip()[:160]}')
        sys.exit(2)
    return [l for l in r.stdout.strip().split('\n') if l]


带region = set(问库(
    "SELECT table_name FROM information_schema.columns "
    "WHERE column_name='region' AND table_schema='public'"))
if len(带region) < 10:
    print(f'✗ 只查到 {len(带region)} 张带 region 的表 —— 库多半连错了，这一支在空转')
    sys.exit(1)

# 【不要走进构建产物】(scripts/_walk.py)。过滤原先写在结果上。
源 = list(全找(根 / 'backend', '*.rs'))
if len(源) < 20:
    print(f'✗ 只扫到 {len(源)} 个 .rs —— 目录搬过家而这一支没跟上')
    sys.exit(1)

插 = re.compile(r'INSERT\s+INTO\s+(\w+)\s*\(([^)]*)\)', re.I | re.S)
错, 查过 = [], 0
for f in 源:
    净 = re.sub(r'//[^\n]*', '', f.read_text(encoding='utf-8'))
    for m in 插.finditer(净):
        表, 列 = m.group(1).lower(), m.group(2).lower()
        if 表 not in 带region or 表 in 例外:
            continue
        查过 += 1
        if not re.search(r'\bregion\b', 列):
            行 = 净[:m.start()].count('\n') + 1
            错.append(f'{f.relative_to(根)}:{行}　往 `{表}` 插行没写 region —— '
                      f'那一列有默认值 cn，不写永远不报错，而后台按区分的账全是空的')

# 自检:正则哪天认不出 INSERT 了，这一支会一路报绿。
样 = "INSERT INTO payment(id, region) VALUES ($1,$2)"
样2 = "INSERT INTO payment(id, currency) VALUES ($1,$2)"
if not 插.search(样) or 插.search(样).group(1).lower() != 'payment':
    print('✗ 自检不成立：认不出 INSERT 语句')
    sys.exit(1)
if re.search(r'\bregion\b', 插.search(样2).group(2)):
    print('✗ 自检不成立：把没写 region 的当成写了')
    sys.exit(1)

if 查过 < 5:
    print(f'✗ 只查到 {查过} 条相关的 INSERT —— 正则多半没匹配上，这一支在空转')
    sys.exit(1)

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'插行都写了 region · {查过} 条 INSERT · '
      f'{len(例外)} 张表按各自的理由不要求')
sys.exit(1 if 错 else 0)
