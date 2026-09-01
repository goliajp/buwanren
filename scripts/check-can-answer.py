#!/usr/bin/env python3
"""在卖御守的那几位，必须答得上话。

御守那一屏（¥99）明写着三条，第三条是「有事可以问 X · 一天一次」。
而问签走的是 `villager_voice` 的口气模板 —— 没有模板的那位，
后端会明确报错「还没有说话模板，不能问签」（这是诚实的，不编一句），
可买家已经付过钱了:他买的三条里有一条兑现不了。

今天不触发:四十位里只有四位在卖御守，四位都有模板。
但这是个【等着被踩的坑】—— 第五枚御守上架那天，谁会想起来先写模板？
所以判据钉在源头:凡是有 active 御守 sku 的村民，都要有口气模板。

顺带盯住另一头:有模板却没人能请回家的，只是还没上架，不算错。
"""
import os, re, subprocess, sys, pathlib


def 问库(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到：{r.stderr.strip()[:160]}')
        sys.exit(2)
    return [l for l in r.stdout.strip().split('\n') if l]


在卖 = 问库(
    "SELECT DISTINCT v.id, v.name FROM sku s "
    "  JOIN product p ON p.id = s.product_id "
    "  JOIN villager v ON v.id = s.villager_id "
    " WHERE s.status='active' AND p.status='listed' "
    "   AND p.fulfillment_kind='residency' ORDER BY 1")
if not 在卖:
    print('✗ 一位在卖御守的都没有 —— 这一支够不着要验的东西，不算通过')
    sys.exit(1)

有模板 = set(问库("SELECT villager_id FROM villager_voice"))
错 = []
for 行 in 在卖:
    vid, 名 = (行.split('|', 1) + [''])[:2]
    if vid not in 有模板:
        错.append(f'{名}（{vid}）的御守在卖，却没有口气模板 —— '
                  f'那一屏写着「有事可以问{名}」，而问签会直接报错')

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'在卖御守的都答得上话 · {len(在卖)} 位在卖 · {len(有模板)} 位有模板')
sys.exit(1 if 错 else 0)
