#!/usr/bin/env python3
"""现在重启一次，库里的东西会不会被写回去？

API 每次启动都跑一遍 `backend/seed/*.sql`（main.rs 里 include_str! 编进二进制），
其中几份写的是 `ON CONFLICT … DO UPDATE SET 某列 = EXCLUDED.某列` ——
那几列的【源头是种子，不是迁移】。

2026-09-01 真踩到:问签的口气模板（贫道 / 在下 / 起局）在迁移里改干净了，
库里也确实变了，重启一次全被写回去 —— 而且不报错，
只有去问库才看得出来。跟仓库里记着的另外两次是同一个形状:
「改的是导出、不是源头」。

判据不去解析 SQL，直接问库:
  开一个事务 → 量一遍这张表的指纹 → 把种子跑一遍 → 再量一遍 → 回滚。
  指纹变了，就说明【下一次重启会改动这张表】—— 也就是说库里现在
  有一份活不过重启的东西。
回滚保证这一支自己不写库。
"""
import os, re, subprocess, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
种子目 = 根 / 'backend/seed'
# 开机真正会跑的那几份 —— 名单从 main.rs 里读，不在这儿手抄
主 = (根 / 'backend/unmei-api/src/main.rs').read_text(encoding='utf-8')
开机跑 = re.findall(r'\("([\w.]+\.sql)",\s*include_str!', 主)
if not 开机跑:
    print('✗ 从 main.rs 里读不出开机跑哪几份种子 —— 这一支够不着要验的东西')
    sys.exit(1)

URL = (os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
       or 'postgres://unmei:unmei_dev_pwd@localhost:6032/unmei')


def 跑(sql):
    r = subprocess.run(['psql', URL, '-v', 'ON_ERROR_STOP=1', '-tAc', sql],
                       capture_output=True, text=True)
    return r


错, 查过 = [], 0
for 名 in 开机跑:
    f = 种子目 / 名
    if not f.exists():
        错.append(f'main.rs 说开机要跑 {名}，而 backend/seed/ 下没有这个文件')
        continue
    s = f.read_text(encoding='utf-8')
    # 【先把注释挖掉再匹配】。`[^;]*?` 会被注释里的分号截断 ——
    # 2026-09-01 我往 lack_bias.sql 里加了一段中文注释、里面有个半角分号，
    # 这张表当场从「查了 4 张」掉成 3 张，而门禁照样报绿。
    # 这跟 check-villager-lines 栽过的那次是同一个形状（那次是全角分号）。
    净 = re.sub(r'--[^\n]*', '', s)
    表们 = sorted({t.lower() for t in re.findall(
        r'INSERT INTO\s+(\w+)\b[^;]*?ON CONFLICT[^;]*?DO UPDATE', 净, re.S | re.I)})
    if not 表们:
        continue                      # DO NOTHING 的种子写不回去，不用管
    for 表 in 表们:
        查过 += 1
        指纹 = f"SELECT md5(COALESCE(string_agg(t::text, '|' ORDER BY t::text), '')) FROM {表} t"
        # 事务里:量 → 跑种子 → 再量 → 回滚
        脚本 = f"BEGIN;\n\\o /dev/null\nSELECT 1;\n\\o\n"
        r = subprocess.run(
            ['psql', URL, '-v', 'ON_ERROR_STOP=1', '-tA'],
            input=f"BEGIN;\n{指纹};\n\\i {f}\n{指纹};\nROLLBACK;\n",
            capture_output=True, text=True)
        if r.returncode != 0:
            print(f'✗ 跑不动（{名} / {表}）：{r.stderr.strip()[:200]}')
            sys.exit(2)
        行 = [l for l in r.stdout.strip().split('\n') if re.fullmatch(r'[0-9a-f]{32}', l)]
        if len(行) != 2:
            print(f'✗ 量不到指纹（{名} / {表}）—— 这一支在空转')
            sys.exit(1)
        if 行[0] != 行[1]:
            错.append(f'{表}：库里现在的内容跟 {名} 不一样 —— '
                      f'下一次重启会被它写回去（改这张表要改 backend/seed/{名}）')

# 【查了几张，得跟数得出来的一样】。
# 「查了 4 张」变成「查了 3 张」而门禁照样绿 —— 这是这个仓库栽过好几次的
# 那种失效:少查一张跟全对长得一模一样。
# 2026-09-01 真发生:我往 lack_bias.sql 的注释里写了个半角分号，
# 上面那条 `[^;]*?` 被截断，那张表整个不参与检查。
# 旁证:开机跑的那几份种子里，写着 `DO UPDATE` 的文件数应当 ≤ 查过的表数。
应有文件 = [n for n in 开机跑
            if (种子目 / n).exists()
            and 'DO UPDATE' in re.sub(r'--[^\n]*', '', (种子目 / n).read_text(encoding='utf-8'))]
if 查过 < len(应有文件):
    print(f'✗ 有 {len(应有文件)} 份开机种子写着 DO UPDATE（{"、".join(应有文件)}），'
          f'却只查了 {查过} 张表 —— 有表没被扫到，这一支在少报')
    sys.exit(1)

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'重启不会把库里的东西写回去 · 查了 {查过} 张开机会覆盖的表')
sys.exit(1 if 错 else 0)
