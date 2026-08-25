#!/usr/bin/env python3
"""已经进过仓库的迁移，内容不许再变。

`sqlx::migrate!` 会把每个迁移文件的校验和记进 `_sqlx_migrations`，
启动时逐一比对。改动一个**已经被应用过**的迁移，后果是：

- 全新的库（CI、新同事的机器）**照样绿** —— 那里从头跑一遍，校验和自然一致
- 而任何已经跑过旧版的环境**起不来**，报 previously applied but has been modified

也就是说这类错误**只在部署那天出现**，而且看起来像「服务挂了」。

这个仓库真发生过：`20260817002_villager.sql` 在 `e1c4e28` 进来，
到 `00caf90` 又被追加了两张表（`lack_bias` 等）。当时还没有部署，
所以没人付代价 —— 有部署之后再来一次就是一次事故。

做法是记账：每个迁移的 sha256 记在 `scripts/migrations-manifest.json` 里。
新增迁移 → 用 `--record` 添一行；**改动已有迁移 → 直接红**。
真要改（比如刚写完还没推），也是 `--record` 一下，但那一步会出现在 diff 里，
review 时看得见 —— 这正是重点：让「改了旧迁移」变成一个**需要解释的动作**。

用法:
  python3 scripts/check-migrations.py            查（CI 与门禁跑这个）
  python3 scripts/check-migrations.py --record   把当前状态记成基准
"""
import hashlib
import re
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MIG = ROOT / 'backend/migrations'
MANIFEST = ROOT / 'scripts/migrations-manifest.json'


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


files = {p.name: digest(p) for p in sorted(MIG.glob('*.sql'))}
if not files:
    print('✗ 一个迁移都没扫到 —— 路径对不上了？查不到东西的核对必须失败')
    sys.exit(1)

# 版本号不许撞。sqlx 从文件名【前面那串数字】取版本号,两个迁移同号时
# 它在【启动那一刻】报 `VersionMismatch(2026xxxx)` —— 一句看不出是哪两个文件、
# 也看不出该怎么办的错。2026-08-25 真踩到:同一天写了两个迁移,
# 都以 `20260825_` 开头,整个测试套件 27 条一起挂在这句话上。
# 已有的命名法是给日期加三位后缀(`20260817002_`),这里把它变成一条会红的规矩。
import collections
vers = collections.defaultdict(list)
for n in files:
    m = re.match(r'^(\d+)', n)
    if m:
        vers[m.group(1)].append(n)
dup = {v: ns for v, ns in vers.items() if len(ns) > 1}
if dup:
    for v, ns in sorted(dup.items()):
        print(f'✗ 版本号 {v} 撞了 —— sqlx 启动时会报 VersionMismatch({v})：')
        for n in sorted(ns):
            print(f'    {n}')
    print('  同一天的第二个迁移加三位后缀，照 20260817002_ 那样')
    sys.exit(1)

if '--record' in sys.argv:
    MANIFEST.write_text(json.dumps(files, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    print(f'✓ 记下 {len(files)} 个迁移的校验和 → {MANIFEST.relative_to(ROOT)}')
    sys.exit(0)

if not MANIFEST.exists():
    print(f'✗ 没有基准文件 {MANIFEST.relative_to(ROOT)} —— 先跑一次 --record')
    sys.exit(1)

known = json.loads(MANIFEST.read_text(encoding='utf-8'))
changed = [n for n, h in known.items() if n in files and files[n] != h]
gone = [n for n in known if n not in files]
added = [n for n in files if n not in known]

for n in changed:
    print(f'✗ {n}　内容变了')
    print('    已经应用过它的环境会拒绝启动（previously applied but has been modified）')
    print('    要改就新加一个迁移；确实是刚写完还没推，再跑 --record')
for n in gone:
    print(f'✗ {n}　不见了 —— 迁移只能往后加，不能删')

print()
print(f'迁移 {len(files)} 个 · 改动 {len(changed)} 个 · 消失 {len(gone)} 个 · 新增 {len(added)} 个')
if added:
    print('  新增的（跑 --record 收进基准）：' + ' '.join(added))
if changed or gone:
    sys.exit(1)
print('✓ 已有的迁移一个都没被改过')
