#!/usr/bin/env python3
"""盘上的角度表，要跟后端真给得出的方位对得上。

2026-09-01:客户端写的是「南 / 西 / 北 / 东」，后端给的是
「南方 / 西方 / 北方 / 东方」—— 四个正方向查不到角度，`?? 0` 兜底，
盘每次都停在正上方。库里三分之一的问签都落在这四个上。

这个错能活下来，是因为盘面上的方位名与八卦符都拿掉了:
八格长得一样，停错跟停对看起来毫无分别 —— 眼睛验不了的东西，
就得机器来验。

判据:
  · 库里 gate_word 的每一个方位，表里都要有
  · 表里不许有库里没有的（写了个用不上的键，跟写错一样是没对上）
  · 八个角度互不相同（两个方位停在同一格 = 少了一格）
"""
import os, re, subprocess, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
源 = 根 / 'mini/miniprogram/pages/home/index.ts'

m = re.search(r'const DIRECTION_ANGLE: Record<string, number> = \{(.*?)\}', 源.read_text(encoding='utf-8'), re.S)
if not m:
    print('✗ 读不出 DIRECTION_ANGLE —— 这一支够不着要验的东西，不算通过')
    sys.exit(1)
表 = {k: int(v) for k, v in re.findall(r'([一-龥]+)\s*:\s*(\d+)', m.group(1))}
if not 表:
    print('✗ 角度表解析出来是空的 —— 空解析长得跟全都对得上一样')
    sys.exit(1)


def 问库(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到，方位没核成：{r.stderr.strip()[:160]}')
        sys.exit(2)
    return [l for l in r.stdout.strip().split('\n') if l]


库里 = set(问库('SELECT DISTINCT direction FROM gate_word'))
if not 库里:
    print('✗ gate_word 里一个方位都没有 —— 够不着要验的东西')
    sys.exit(1)

错 = []
for d in sorted(库里 - set(表)):
    错.append(f'后端给得出「{d}」，角度表里没有 —— 盘会兜底停在正上方，而且看不出来')
for d in sorted(set(表) - 库里):
    错.append(f'角度表里写着「{d}」，库里没有这个方位 —— 这一格永远转不到')
撞 = {}
for k, v in 表.items():
    撞.setdefault(v, []).append(k)
for v, ks in sorted(撞.items()):
    if len(ks) > 1:
        错.append(f'{"、".join(ks)} 都停在 {v}° —— 两个方位一格，盘上就少一格')

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'盘上八格对得上库里的方位 · 表 {len(表)} 项 · 库 {len(库里)} 项')
sys.exit(1 if 错 else 0)
