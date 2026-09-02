#!/usr/bin/env python3
"""一位村民的四条台词，不许全是同一个句式。

村主屏一天只显示一条，从住着的那位的四条里等概率挑。
所以「整批台词里某个形状占几成」不是最要紧的数 ——
**一个人身上的密度**才是:四条同形，你连着四天听到同一个节奏。

2026-09-02 复核实测:`短陈述。展开`（`^[^。？！]{2,12}。[^。]+$`）
在 160 条里占 107 条 = 66.9%，其中 8 位村民【四条全是】，19 位四中之三。
（第二轮评审报的 113/160 是对的；我当时量错了语料也量错了形状，
把它判成不成立，那条错误结论在 `rooms/src/engine/village.js` 里留了半天。）

判据:任一村民、任一句式，四条里不超过两条。
句式表只放【真的会撞车】的那几种，不做穷举 ——
穷举出来的形状会把「四条都是陈述句」这种无害的事也算成违规。
"""
import os
import re
import subprocess
import sys
import collections

上限 = 2
句式 = {
    '短陈述。展开': r'^[^。？！]{2,12}。[^。]+$',
    '两拍逗号句':   r'^[^，。？！]+，[^，。？！]+$',
    '省略号收尾':   r'……[^。？！]{0,8}$',
}


def 问库(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAF', '|', '-c', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAF', '|', '-c', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到，这一支没验成：{r.stderr.strip()[:160]}')
        sys.exit(2)
    return [l.split('|', 2) for l in r.stdout.strip().split('\n') if l]


行 = 问库("SELECT l.villager_id, v.name, l.text FROM villager_line l "
         "JOIN villager v ON v.id = l.villager_id ORDER BY l.villager_id, l.seq")
if len(行) < 120:
    print(f'✗ 只读到 {len(行)} 条台词 —— 四十位每人四条，这一支多半在空转')
    sys.exit(1)

按人 = collections.defaultdict(list)
名字 = {}
for vid, name, text in 行:
    按人[vid].append(text)
    名字[vid] = name

错 = []
for vid, 四条 in sorted(按人.items()):
    for 名, 式 in 句式.items():
        n = sum(1 for t in 四条 if re.search(式, t))
        if n > 上限:
            错.append(f'{名字[vid]}（{vid}）四条里有 {n} 条是「{名}」—— '
                      f'一天一条，连着 {n} 天是同一个节奏')
            for t in 四条:
                if re.search(式, t):
                    错.append(f'      {t}')

# 自检:句式表哪天写坏了（正则匹配不上任何东西），这一支会一路报绿。
# 拿四条一定同形的合成台词喂进去，必须报出来。
合成 = ['甲乙。丙丁戊', '己庚。辛壬癸', '子丑。寅卯辰', '巳午。未申酉']
if sum(1 for t in 合成 if re.search(句式['短陈述。展开'], t)) != 4:
    print('✗ 自检不成立：「短陈述。展开」这条正则认不出它自己的例子 —— 先修它')
    sys.exit(1)

for e in 错:
    print(('  ✗ ' if not e.startswith('    ') else '  ') + e)
print(('✗ ' if 错 else '✓ ') + f'没人四条一个调 · {len(按人)} 位 · {len(行)} 条 · '
      f'上限 {上限}/4')
sys.exit(1 if 错 else 0)
