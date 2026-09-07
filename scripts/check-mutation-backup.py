#!/usr/bin/env python3
"""被变异改到的文件，都必须在 mutationtest-checks.sh 的 FILES 备份名单里。

不在的话，变异改完【还原还不到它】—— 那处改动就永久烙进源码。
2026-08-23 真发生过：「去他家坐坐」搬到 pages/villager 之后锚点跟着搬了，
文件却没加进名单，`roomz` 留在了工作区，下一条变异在「干净」源码上报红 ——
而红的原因是上一条没还原，失败信息指错了方向。

单独一支而不是内联进那个 shell：两边都要从同一份文本里解析，
用 shell 拼容易把自己那行 sed 也匹配进去（第一版就是），
而 heredoc 又会把 stdin 占掉（第二版就是）。
"""
import pathlib
import re
import sys

SH = pathlib.Path(__file__).resolve().parent / 'mutationtest-checks.sh'
src = SH.read_text(encoding='utf-8')

m = re.search(r'^FILES=\((.*?)^\)', src, re.S | re.M)
if not m:
    print('✗ 找不到 FILES 名单', file=sys.stderr)
    sys.exit(2)
listed = {l.strip() for l in m.group(1).splitlines()
          if l.strip() and not l.strip().startswith('#')}

# 【`sub(…)` 碰的文件也要备份】（2026-09-03 第四轮评审 · 工程审计）。
# 上一版只认行首的 `"edit(` —— 而变异脚本里还有 `sub('…')` 这一路，
# 它同样会改源码。今天 `sub` 只碰 `pages/name/index.ts`（恰好在 FILES 里），
# 所以没出事;下一条 `sub` 指向别的文件，就是「变异永久写进源码」重演 ——
# 而这支脚本存在的全部理由就是防这件事。
#
# 也不再要求它出现在行首:`mutate "…" gate \` 换行之后，
# 下一行的缩进里同样可能是 `edit(`。
used = set()
for line in src.splitlines():
    if line.lstrip().startswith('#'):
        continue
    used |= set(re.findall(r"\b(?:edit|sub)\('([^']+)'", line))

# 【覆盖下限 + 说出自己查了什么】。
# 调用方（mutationtest-checks.sh:104）是靠【stdout 非空】判红的，
# 所以统计只能进 stderr —— 写进 stdout 会被当成「有文件没备份」。
#
# 下限按【实数】定，不拍一个小数。解析一旦坏掉，`used` 会变小，
# 而空集减任何东西都是空集 —— 这一支照样什么都不打印、照样通过，
# 那正是它自己要防的那种失效。
#
# 第一版下限写的是 8，而实数是 36 —— 把 `sub(` 改个名只掉 1 个（36→35），
# 从 8 底下轻松走过去（2026-09-03 变异测试当场量到）。
# 一个远低于实数的下限跟没有下限一样。
# 数会长，所以留一成余量;真长上去了就把这个数改掉 —— 它是账，不是魔法数。
下限 = 33
if len(used) < 下限:
    print(f'只解析出 {len(used)} 处变异目标，少于下限 {下限}'
          f' —— 解析多半坏了，而这一支防的正是「变异永久写进源码」')
    sys.exit(1)

# 【两种写法各自都要还认得出】。总数下限拦不住「少数派那一种坏了」——
# `sub(` 全脚本只有一处，把它改个名只掉 1 个（36→35），
# 从任何按总数定的下限底下都走得过去（2026-09-03 变异测试量到）。
# 所以按【种类】各自设一条最小值:哪一路认不出来了，当场说是哪一路。
for 名, 至少 in (('edit', 20), ('sub', 1)):
    n = len({m for line in src.splitlines() if not line.lstrip().startswith('#')
             for m in re.findall(r'\b' + 名 + r"\('([^']+)'", line)})
    if n < 至少:
        print(f'`{名}(` 这一路只解析出 {n} 处（至少该有 {至少}）'
              f' —— 那一路的写法变了，而它改到的文件从此不进备份名单')
        sys.exit(1)

for f in sorted(used - listed):
    print(f)

print(f'· 变异会改到 {len(used)} 个文件，备份名单里有 {len(listed)} 个',
      file=sys.stderr)
