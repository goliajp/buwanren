#!/usr/bin/env python3
"""界面上不许出现术数行话。

硬要求写着「术数行话只允许出现在【你的说明书】的专业细节页里」，
但名册页至今写着「小道士 · 大六壬」「落第书生 · 梅花易数」——
一个没听说过命理的人一个都不认识。

反证就在产品自己身上:房间里那六颗表演按钮写的是「掐指算算」
「拆个字」「拨拨念珠」，人话早就有了，只是没用到列表页上。

判据分两处：
  · 界面文件（pages/**）里不许出现行话词
  · art 表的每一门都得配一句人话（plain），界面读 plain 不读 name
说明书那一侧不受管 —— 它是行话唯一的家。
"""
import os, re, subprocess, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent

# 一个没听说过命理的人读不懂的词。塔罗、占星、水晶球这些大众词不算。
行话 = ['大六壬', '梅花易数', '藏历密算', '奇门遁甲', '紫微斗数', '太乙神数',
        '六爻', '风水堪舆', '龟甲骨卜', '八字', '八个字', '日主', '用神',
        '格局', '藏干', '纳音', '印星', '比劫', '起局', '起课', '排盘', '本命盘']

注释 = re.compile(r'<!--.*?-->|/\*.*?\*/', re.S)
错 = []
页 = sorted((根 / 'mini/miniprogram/pages').glob('*/index.wxml'))
if not 页:
    print('✗ 一个页面都没扫到 —— 这一支在空转'); sys.exit(1)

for f in 页:
    # 说明书那一屏是行话唯一的家 —— 它整屏豁免
    if f.parent.name == 'report':
        continue
    s = 注释.sub(lambda m: '\n' * m.group(0).count('\n'), f.read_text(encoding='utf-8'))
    for i, 行 in enumerate(s.splitlines(), 1):
        if 行.lstrip().startswith(('//', '*')):
            continue
        for 词 in 行话:
            if 词 in 行:
                错.append(f'{f.parent.name}:{i}　「{词}」—— 行话只能在说明书里')

# art 表:每一门都得有人话

# 【界面上的字不全在 wxml 里】。「按你的八字单配」是 sku.name ——
# 数据库给的，从只扫 wxml 的判据眼皮底下整个过去了，靠截图才看见
# （2026-09-01）。凡是会原样显示给用户的名字，都得一起扫。
#
# 【问库，不读迁移文本】。第一版是去迁移文件里搜 INSERT ——
# 当场报出七条早就被后面的迁移改掉的旧名字:它读的是历史，
# 不是货架上现在挂着的东西。名字改过好几手，只有库知道最后那一版。
def 问库(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到，货架上的名字没验成：{r.stderr.strip()[:160]}')
        sys.exit(2)
    return [l for l in r.stdout.strip().split('\n') if l]

# 【每一门术都要配一句人话】。
# 这一段原先是从迁移文件里 grep `WHEN 'x' THEN`，再拿种子里的 id 反查 ——
# 而那份 id 名单里混着村民，于是判不准，最后写成了一句 `pass`:
# 文件顶上承诺的第二条判据【从来没执行过】，唯一还活着的只有
# 「找不到 *art_plain*.sql」（2026-09-01 五路评审 · 工程审计抓到）。
#
# 直接问库就没有这个问题:art 表自己知道有哪些门、哪一门配了 plain。
缺人话 = 问库("SELECT key, name FROM art WHERE plain IS NULL OR plain = '' ORDER BY key")
for 行 in 缺人话:
    键, 名 = (行.split('|', 1) + [''])[:2]
    错.append(f'术「{名}」（{键}）没配人话 —— 界面会退回显示行话')

货架 = 问库(
    "SELECT 'product', id, name || ' / ' || COALESCE(sub_title,'') FROM product WHERE status='listed'"
    " UNION ALL "
    "SELECT 'sku', id, name FROM sku WHERE status='active'")
if not 货架:
    print('✗ 货架上一件都没有 —— 这一支够不着要验的东西，不算通过')
    sys.exit(1)
for 行 in 货架:
    表, 编号, 名 = (行.split('|', 2) + ['', ''])[:3]
    for 词 in 行话:
        if 词 in 名:
            错.append(f'{表} {编号} 在售，名字里有「{词}」：{名.strip()}')

# 后端界面查询必须读 plain
for f in (根 / 'backend/unmei-api/src/routes').glob('*.rs'):
    s = f.read_text(encoding='utf-8')
    for m in re.finditer(r'a\.name AS art_name', s):
        行号 = s[:m.start()].count('\n') + 1
        错.append(f'{f.name}:{行号}　界面查询直接取了 a.name —— 该取 COALESCE(a.plain, a.name)')

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'界面上没有行话 · 扫了 {len(页)-1} 屏 + 货架 {len(货架)} 件'
      '（说明书那屏是行话的家，豁免）')
sys.exit(1 if 错 else 0)
