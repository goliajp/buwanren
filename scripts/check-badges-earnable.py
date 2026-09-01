#!/usr/bin/env python3
"""在架的每一枚徽章，代码里都得真有地方发它。

2026-09-01:六枚里四枚永远发不出来。全仓只有一处发徽章
（unmei-api/src/routes/naji.rs），而它只认 `type=count AND action=naji.spin`;
「七天没断」「一个月」是 streak，「闻过香」是 order.paid，
「到过场」是 activity.checkin —— 一个都没有落点。
库里的账:b_first 发出去 1314 次，其余五枚全是 0。
而「我得到的」那一屏还给每一枚配了 CTA，其中一枚直接把人推去掏钱。

收了钱不兑现一条明写的承诺，是最伤信任的一种 bug，而它在屏上
长得跟「你还没拿到」一模一样 —— 所以只能机检。

判据:把发徽章的代码里认得的 (type, action) 组合抠出来，
再要求库里每一枚 active 徽章的规则都落在这张表里。
"""
import os, re, subprocess, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent

# ── 代码里发得出哪几种 ────────────────────────────────────
认得 = set()
naji = (根 / 'backend/unmei-api/src/routes/naji.rs').read_text(encoding='utf-8')
# match (typ, action) { ("count", "naji.spin") => …, ("streak", "naji.spin") => … }
for t, a in re.findall(r'\("(\w+)",\s*"([\w.]+)"\)\s*=>', naji):
    认得.add((t, a))
ful = (根 / 'backend/unmei-app/src/fulfillment.rs').read_text(encoding='utf-8')
# 履约那一侧:发的是 order.paid + count
if 'Some("order.paid")' in ful and 'Some("count")' in ful:
    认得.add(('count', 'order.paid'))

if not 认得:
    print('✗ 从代码里读不出发得出哪几种徽章 —— 这一支够不着要验的东西，不算通过')
    sys.exit(1)


def 问库(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到，徽章没核成：{r.stderr.strip()[:160]}')
        sys.exit(2)
    return [l for l in r.stdout.strip().split('\n') if l]


行 = 问库("SELECT id, name, COALESCE(rule_dsl->>'type',''), COALESCE(rule_dsl->>'action','') "
          "FROM badge WHERE status='active' ORDER BY id")
if not 行:
    print('✗ 一枚在架徽章都没有 —— 够不着要验的东西')
    sys.exit(1)

错 = []
for l in 行:
    bid, 名, t, a = (l.split('|') + ['', '', '', ''])[:4]
    if (t, a) not in 认得:
        错.append(f'{bid}（{名}）的规则是 {t}/{a}，而代码里没有一处发得出它 —— '
                  f'这一枚永远拿不到，而屏上还给它配了一条路')

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'在架徽章都发得出来 · {len(行)} 枚 · 代码认得 '
      + '、'.join(f'{t}/{a}' for t, a in sorted(认得)))
sys.exit(1 if 错 else 0)
