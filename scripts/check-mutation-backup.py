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

used = set()
for line in src.splitlines():
    if line.lstrip().startswith('"edit('):
        used |= set(re.findall(r"edit\('([^']+)'", line))

for f in sorted(used - listed):
    print(f)
