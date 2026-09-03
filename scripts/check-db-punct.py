#!/usr/bin/env python3
"""库里给人看的中文文案，标点也必须全角。

【为什么文件绿了还要看库】——2026-09-03 抓到:`backend/seed/seed.sql` 里
四条灰度开关的说明早就改成全角了,但那一句是 `ON CONFLICT DO NOTHING`,
于是最早写进去的半角版本原封不动地留在库里,屏幕上显示
「敏感词严格模式(mini 必开)」。

标点门禁扫的是**文件**,文件是对的,所以它一路报绿;
而运营台上是错的。**改对了源文件不等于运行中的系统跟上了** ——
这一支补的正是这段落差。

要有真库才算数;没有就明说跳过,不算通过。
"""
import os, re, subprocess, sys

半角 = re.compile(r'[一-鿿][,?!;:()]|[,?!;:()][一-鿿]')

# (表， 主键列， 文案列) —— 都是会直接出现在运营台或小程序上的字段
查 = [
    ('feature_flag', 'code', 'description'),
    ('product', 'code', 'name'),
    ('product', 'code', 'sub_title'),
    ('account_chart', 'code', 'name'),
    ('quote', 'id', 'text'),
    ('villager', 'id', 'say_line'),
]

url = os.environ.get('DATABASE_URL',
                     'postgres://unmei:unmei_dev_pwd@localhost:6032/unmei')

def 问(sql):
    r = subprocess.run(['psql', url, '-tAc', sql],
                       capture_output=True, text=True, timeout=20)
    return r.returncode, r.stdout, r.stderr

码, _, 错 = 问('SELECT 1')
if 码 != 0:
    print(f'— 跳过：连不上库（{错.strip()[:60]}）。这一支【没验】，不是通过')
    # 【连不上库要退 3，不是退 0】（2026-09-03 五路评审 · 门禁审计）。
    # 上一句话说「这一支没验，不是通过」，而它退的是 0 ——
    # gates.sh 把 0 记成「过」，跳过计数不涨。
    # 话说对了，退出码说的是另一回事，而总账听的是退出码。
    sys.exit(3)

坏, 查过 = [], 0
for 表, 键, 列 in 查:
    码, 出, _ = 问(
        f"SELECT to_regclass('{表}') IS NOT NULL AND EXISTS "
        f"(SELECT 1 FROM information_schema.columns "
        f" WHERE table_name='{表}' AND column_name='{列}')")
    if 码 != 0 or 出.strip() != 't':
        continue
    码, 出, _ = 问(
        f"SELECT {键}||E'\\t'||{列} FROM {表} "
        f"WHERE {列} IS NOT NULL AND {列} ~ '[一-鿿]'")
    if 码 != 0:
        continue
    查过 += 1
    for 行 in 出.splitlines():
        if '\t' not in 行:
            continue
        主, 文 = 行.split('\t', 1)
        if 半角.search(文):
            坏.append(f'{表}.{列} [{主}]  {文[:60]}')

# 【一张表都没查到就不算数】。表名改过、库是空的、连错了库 ——
# 这三种情况下上面那个循环一条都不会跑，而它跟「全都干净」长得一模一样。
if 查过 == 0:
    print('✗ 一张表都没查到 —— 表名多半改过了，这一支现在什么都没验到')
    sys.exit(1)

if 坏:
    print(f'✗ 库里 {len(坏)} 条中文文案用了半角标点（查了 {查过} 张表）:')
    for x in 坏[:20]:
        print('   ' + x)
    if len(坏) > 20:
        print(f'   …… 另有 {len(坏) - 20} 条')
    print('   源文件改对了不算 —— 落库那一句得是 DO UPDATE，不是 DO NOTHING')
    sys.exit(1)
print(f'✓ 库里的中文文案 · {查过} 张表，标点都是全角')
