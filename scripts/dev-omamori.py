#!/usr/bin/env python3
"""发一张开发用的御守凭据，供真机扫码用。

真机验收（工序单第 11 步）要「扫御守 → 某位不完人入住」，而扫码只有真机有。
这一支在开发库里发一张凭据并把内容打出来——**跟移动网页版验证脚本用的是
同一段 SQL**，不另写一份，免得两份漂。

装了 `qrencode` 就顺手出一张 PNG（`brew install qrencode`）；
没装就把凭据字符串打出来，用任何工具生成二维码都行。

用法:
  python3 scripts/dev-omamori.py            默认阿云
  python3 scripts/dev-omamori.py chenjiu    指定谁
"""
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PG_CONTAINER = os.environ.get('PG_CONTAINER', 'unmei-postgres')
PSQL_URL = os.environ.get('PSQL_URL', '')

villager = sys.argv[1] if len(sys.argv) > 1 else 'ayun'
oid = 'oma-dev-' + villager
cred = 'DEV-' + villager.upper()

def psql(args):
    return subprocess.run(
        (['psql', PSQL_URL] + args if PSQL_URL else
         ['docker', 'exec', '-i', PG_CONTAINER, 'psql', '-U', 'unmei', '-d', 'unmei'] + args),
        capture_output=True, text=True)


# 先问有没有这个人，再发凭据。反过来的话，人不存在时报的是外键冲突，
# 而提示写着「库起着吗」—— 库好好的，提示却把人往错的方向指。
who = psql(['-tAc', f"SELECT name FROM villager WHERE id='{villager}'"])
if who.returncode != 0:
    print('✗ 连不上库：' + (who.stderr.strip().split('\n') or [''])[-1][:160])
    print('  起着吗？docker ps | grep postgres')
    sys.exit(1)
name = who.stdout.strip()
if not name:
    print(f'✗ 村里没有 {villager} 这个人。40 位的 id 见 backend/seed/villagers.sql')
    sys.exit(1)

# 幂等插入，不删。上一次的入住记录还引用着那张御守，删了会撞外键。
sql = (
    f"INSERT INTO omamori (id, villager_id) VALUES ('{oid}','{villager}')"
    f" ON CONFLICT (id) DO NOTHING;"
    f" INSERT INTO omamori_credential (carrier_kind, credential, omamori_id)"
    f" VALUES ('qr','{cred}','{oid}') ON CONFLICT (carrier_kind, credential) DO NOTHING;"
)
r = psql(['-v', 'ON_ERROR_STOP=1', '-c', sql])
if r.returncode != 0:
    print('✗ 发不出来：' + (r.stderr.strip().split('\n') or [''])[-1][:200])
    sys.exit(1)

print(f'✓ {name}（{villager}）的御守凭据：')
print()
print(f'    {cred}')
print()

png = ROOT / f'.dev-omamori-{villager}.png'
if subprocess.run(['which', 'qrencode'], capture_output=True).returncode == 0:
    subprocess.run(['qrencode', '-s', '8', '-o', str(png), cred], check=True)
    print(f'  二维码：{png}')
else:
    print('  没装 qrencode，二维码请自行生成（brew install qrencode 之后重跑就有 PNG）')
print()
# 「同一个人」是关键。库里的不变量是 UNIQUE(user_id, villager_id) ——
# 挡的是同一个人重复扫，挡不住不同的人扫同一张（2026-08-18 实测两个匿名
# 用户扫同一张都住进去了）。写成「同一张扫十次也只有一个他」会让人以为
# 一张御守只能进一个村子，而那件事还没定，见 docs/OPEN.md 第 7 条。
print('  扫完这一张，他就住进你的村子。同一个人扫十次也只有一个他')
