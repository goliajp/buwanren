#!/usr/bin/env python3
"""在架的御守，那位得【真的搬得进来】。

御守就是入住凭证:付 ¥99 换的是「他住进你的村子」。而「住进来」这件事
落到代码上是三样东西，缺一样就少一半:

  · 有屋子   `rooms/src/rooms/<id>.js` —— 请回来之后你进得去他家
  · 走得动   `rooms/src/engine/village.js` 里那行 `cast: true` ——
             请回来之后他在村里真的走动。没有这一条，买家换来的是
             一间亮着灯、门口挂着他名字、而永远没人出来的屋子
  · 答得上话 `villager_voice` —— 御守那一屏第三条明写着「有事可以问他」
             （这一条另有 `check-can-answer.py` 单独守着，这里不重复）

两个方向都要守，这是这一支跟别的目录门禁不一样的地方:

  上架了却搬不进来 → 卖了个兑现不了的东西
  素材齐了却没上架 → 屋子画了、走位调了、口气写了，而没有人买得到他

第二个方向不是洁癖:村民屋是这个仓里最贵的东西（一间一间做，见
`rooms/.roomwork/PLAYBOOK.md`），做完不上架等于白做，而这件事
不报错、不掉测试，只是安静地不赚钱。

【为什么判据钉在源码上，不钉在库里】。走动素材与屋子都是源码
（`rooms/src/` 是村民与房间的源码，`design.html` 只是它的拼装产物）。
而上架与否在库里。两侧各说各的正是这一支要接上的那条缝。

用法: python3 scripts/check-can-move-in.py   读 PSQL_URL / DATABASE_URL，
                                             都没有就退回本机 docker
"""
import os
import pathlib
import re
import subprocess
import sys

根 = pathlib.Path(__file__).resolve().parent.parent
屋子目录 = 根 / 'rooms/src/rooms'
村图 = 根 / 'rooms/src/engine/village.js'


def 问库(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到：{r.stderr.strip()[:200]}')
        sys.exit(2)
    return [l for l in r.stdout.strip().split('\n') if l]


# 【有屋子】。一位一个文件。`ayun-plan.js` 那种带横杠的是工序稿，不算屋子。
有屋子 = {p.stem for p in 屋子目录.glob('*.js') if '-' not in p.stem}
if not 有屋子:
    print(f'✗ {屋子目录} 底下一间屋子都没读到 —— 这一支在空转')
    sys.exit(1)

# 【走得动】。`mkV('<id>', …, { … cast: true … })` —— 只认带 cast 的那些。
# 路人（villm）没有 cast，他们不属于四十位，不该被数进来。
src = 村图.read_text(encoding='utf-8')
走得动 = set()
for m in re.finditer(r"mkV\(\s*'([a-z0-9_]+)'\s*,", src):
    尾 = src[m.end():src.find('\n', m.end())]
    if 'cast: true' in 尾:
        走得动.add(m.group(1))
if not 走得动:
    print(f'✗ {村图.name} 里一位带 cast 的村民都没读到 —— 这一支在空转')
    sys.exit(1)

在架 = {}
for 行 in 问库(
        "SELECT DISTINCT k.villager_id, v.name FROM sku k "
        "  JOIN product p ON p.id = k.product_id "
        "  JOIN villager v ON v.id = k.villager_id "
        " WHERE k.status='active' AND p.status='listed' "
        "   AND p.fulfillment_kind='residency' ORDER BY 1"):
    vid, 名 = (行.split('|', 1) + [''])[:2]
    在架[vid] = 名
if not 在架:
    print('✗ 一件在架的御守都没查到 —— 这一支够不着要验的东西，不算通过')
    sys.exit(1)

错 = []
for vid, 名 in 在架.items():
    缺 = []
    if vid not in 有屋子:
        缺.append(f'没有屋子（rooms/src/rooms/{vid}.js 不存在）')
    if vid not in 走得动:
        缺.append('村里走不动（village.js 里没有那一行 cast: true）')
    if 缺:
        错.append(f'{名}（{vid}）的御守在架，而这一位搬不进来：' + '；'.join(缺))
        错.append(f'   买家付 ¥99 换的正是「这一位住进你的村子」。'
                  f'要么把缺的做出来，要么把这件下架。')

for vid in sorted(走得动 - set(在架)):
    if vid in 有屋子:
        错.append(f'{vid} 屋子盖好了、村里也走得动，而这一位的御守没有在架 —— '
                  f'没有人请得回来')
        错.append(f'   村民屋是这个仓里最贵的东西，做完不上架等于白做。'
                  f'上架见 backend/migrations/20260906001_omamori_catalogue.sql。')

for e in 错:
    print(('  ✗ ' if not e.startswith('   ') else '  ') + e)
print(('✗ ' if 错 else '✓ ')
      + f'在架的御守都搬得进来 · 在架 {len(在架)} 位 · '
        f'有屋子 {len(有屋子)} 位 · 走得动 {len(走得动)} 位')
sys.exit(1 if 错 else 0)
