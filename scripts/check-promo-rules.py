#!/usr/bin/env python3
"""活动上写着的每一条规则，代码里都得真的执行。

【这一支立案的理由】（2026-09-07 三路验证 · 准备花钱的那一路）。
`promotion` 表从建库起就有 `rule_json` / `match_json` / `stackable` /
`per_user_cap` / `total_cap` / `daily_cap`，后台详情页也把它们一条条摆出来
给人看 —— 而 `unmei-app` 与 `unmei-api` 里 grep 它们是**零命中**。
种子里唯一一个真活动 `NEWUSER20`（新人首单立减 20%）写着
「满 ¥49」「仅新客」「不可叠加」，三条一条都不生效:
一个老客拿它减 ¥29 的东西，照样减得下来。

这跟「护身符 / 御守」那种同物异名不同 —— 它没有任何一处会说出来:
后台照常显示，下单照常成功，只是规则不算数。**只有人去读代码才发现。**

判据两条，方向相反:

  · 活动里出现一个**代码不认识的键** → 红。
    「配了却不生效」从此不可能悄悄发生 —— 要么把它实现了，
    要么把它从这张表里拿掉。
  · 代码认识、而库里一个活动都没在用的键 → 只打一行 `·`。
    先写实现后上规则是对的顺序，不算错。

【不实现没人用的键】。凭空给一个没人用的键发明语义，跟它不生效一样糟，
只是错得更晚 —— 那时已经有活动挂在上面了。

用法: python3 scripts/check-promo-rules.py   读 PSQL_URL / DATABASE_URL，
                                             都没有就退回本机 docker
"""
import json
import os
import pathlib
import re
import subprocess
import sys

根 = pathlib.Path(__file__).resolve().parent.parent
券 = 根 / 'backend/unmei-app/src/coupon.rs'

# ── 代码认得哪几个键 ──────────────────────────────────────
# 从 `这一单过得了这张券吗` 那个函数体里抠 —— 写一份清单在这儿的话，
# 它跟代码会各自漂，而漂了之后这一支报的绿是假的。
源 = 券.read_text(encoding='utf-8')
m = re.search(r'async fn 这一单过得了这张券吗\(.*?\n\}\n', 源, re.S)
if not m:
    print('✗ coupon.rs 里找不到 `这一单过得了这张券吗` —— '
          '这一支的判据够不着它要验的东西了（是不是改名了？）')
    sys.exit(1)
函数体 = m.group(0)
认得 = set(re.findall(r'\.get\("(\w+)"\)', 函数体))
# `stackable` 是列不是 JSON 键，单独认
if 'promo_stackable' in 函数体:
    认得.add('stackable')
if not 认得:
    print('✗ 从那个函数里读不出任何一个规则键 —— 解析对不上了')
    sys.exit(1)

# 【这几列同样是「配得出来而不生效」】。它们不在 JSON 里，是 promotion 上的列，
# 所以 JSON 那一半的判据够不着它们 —— 单独列出来一起判。
列规则 = {'stackable', 'per_user_cap', 'total_cap', 'daily_cap'}


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


行 = 问库(
    "SELECT code, COALESCE(rule_json,'{}')::text, COALESCE(match_json,'{}')::text, "
    "       per_user_cap, total_cap, daily_cap, stackable "
    "  FROM promotion WHERE status='active' ORDER BY code")
if not 行:
    print('✗ 一个在架的活动都没有 —— 这一支够不着要验的东西，不算通过')
    sys.exit(1)

错, 用到的 = [], set()
for l in 行:
    code, rule_s, match_s, pu, tc, dc, stk = (l.split('|') + [''] * 7)[:7]
    # `stackable` 是 NOT NULL 的布尔列，每个活动都有值 ——
    # **`false` 才是「用了这条规则」**（`true` = 不限制，跟没写一样）。
    # 头一版拿「非空」当判据，于是它永远算不上「在用」,
    # 而屏上打的是「代码认得 stackable，没有活动在用它」—— 那是假话。
    if stk == 'f':
        用到的.add('stackable')
    for 哪一栏, s in (('rule_json', rule_s), ('match_json', match_s)):
        try:
            d = json.loads(s or '{}')
        except json.JSONDecodeError:
            错.append(f'{code} 的 {哪一栏} 不是合法 JSON —— 那它写的东西谁也读不了')
            continue
        for k in d:
            用到的.add(k)
            if k not in 认得:
                错.append(f'{code} 的 {哪一栏} 里写着「{k}」，而代码里没有一处读它 —— '
                          f'这条规则不生效，后台却把它摆出来给人看。'
                          f'要么在 coupon.rs 的 `这一单过得了这张券吗` 里实现它，'
                          f'要么把它从这个活动上拿掉')
    for 名, v in (('per_user_cap', pu), ('total_cap', tc), ('daily_cap', dc)):
        if v.strip():
            用到的.add(名)
            if 名 not in 认得:
                错.append(f'{code} 的 {名} 填着 {v}，而代码里没有一处读它 —— '
                          f'同上:实现它，或者清空它')

for k in sorted(认得 - 用到的):
    print(f'  · 代码认得「{k}」，而没有一个在架活动在用它 —— 先写实现后上规则是对的顺序')
# 【还没实现的那几列也说一句】。它们不在上面那份「认得」里，
# 所以一旦有活动填了就会红 —— 这一行只是让人知道它们存在、目前是空的。
没实现的列 = sorted(列规则 - 认得)
if 没实现的列:
    print(f'  · 这几列代码还不读，填了会红：{"、".join(没实现的列)}')

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ')
      + f'活动上写着的规则代码都真的执行 · 在架 {len(行)} 个 · '
        f'代码认得 {"、".join(sorted(认得))}')
sys.exit(1 if 错 else 0)
