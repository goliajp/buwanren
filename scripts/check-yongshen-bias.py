#!/usr/bin/env python3
"""用神那张映射表，每一条都得真指得着人。

「谁能来」那一页顶上说「你缺『火』，下面这几位跟你补得上」，
凭据是两张表接起来：

    yongshen_bias   你的用神   → 你需要哪个方向
    lack_bias       村民缺什么 → 他反过来劝你哪个方向

写错一个方向名，这条链就断了 —— 而**断了不报错**：匹配不到人，
排序悄悄退回「在卖的排前面、再按 id」，那句话跟着变成假话，
跟它从前一直是假话时长得一模一样。

四条：
  · 木火土金水五个都要有（少一个，那个用神的人排不了）
  · 每个至少一条 rank=1（主方向）
  · 每个 direction 在 `lack_bias` 里真的存在
  · 每个 direction 底下真的有村民（有映射没有人，等于没排）

用法: python3 scripts/check-yongshen-bias.py   读 PSQL_URL / DATABASE_URL，
                                               都没有就退回本机 docker
"""
import os
import subprocess
import sys

五行 = ['木', '火', '土', '金', '水']


def psql(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到：{r.stderr.strip()[:200]}')
        sys.exit(2)
    return [l for l in r.stdout.strip().split('\n') if l]


行 = [l.split('|') for l in psql(
    "SELECT wuxing, direction, rank FROM yongshen_bias ORDER BY wuxing, rank")]
if not 行:
    print('✗ yongshen_bias 一条都没有 —— 那一页那句话就没有依据了')
    sys.exit(1)

有方向 = set(psql("SELECT DISTINCT direction FROM lack_bias"))
有人的 = set(psql(
    "SELECT DISTINCT b.direction FROM villager v JOIN lack_bias b ON b.lack = v.lack"))

bad = 0
for w in 五行:
    我的 = [r for r in 行 if r[0] == w]
    if not 我的:
        print(f'✗ 用神「{w}」没有映射 —— 这个用神的人排不了，而那句话照说不误')
        bad += 1
        continue
    if not any(r[2] == '1' for r in 我的):
        print(f'✗ 用神「{w}」没有主方向（rank=1）')
        bad += 1

for w, d, rank in 行:
    if d not in 有方向:
        print(f'✗ 「{w}」指的方向 `{d}` 在 lack_bias 里不存在 —— 这条链是断的')
        print(f'   断了【不报错】：匹配不到人，排序悄悄退回原样，那句话跟着变成假话')
        bad += 1
    elif d not in 有人的:
        print(f'✗ 「{w}」指的方向 `{d}` 底下一位村民都没有 —— 有映射没有人，等于没排')
        bad += 1

print()
print(f'五行 {len(五行)} 个 · 映射 {len(行)} 条 · 问题 {bad} 处')
if bad:
    sys.exit(1)
print('✓ 每个用神都指得着人')
