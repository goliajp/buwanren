#!/usr/bin/env python3
"""中文标点全角 —— 存量记账，增量不许涨。

项目第一条规则是「任何中文内容里的标点一律用全角」，而它被用户标为
**「你永远都在犯的错」**。一条全靠人记得的规则守不住，所以做成门禁。

**不做批量重写**：现存 2000 多处分布在 26 个文件里，全是别人写的文档，
一次性改掉是个巨大又低价值的 diff。所以这里用的是【记账】：
每个文件记下当前的欠账数，**只要不涨就算过**。新写的中文必须干净，
旧账看得见、什么时候还是另一次决定。

判据用规则文件自己给的那条正则（汉字紧邻半角标点），不自立标准：

    [一-龥][,?!;:]     汉字后面跟半角
    [,?!;:][一-龥]     半角后面跟汉字

**代码不算**：围栏代码块与行内代码整段跳过 —— 规则明确豁免代码本身
（标识符、字符串键、JSON、URL、命令）。

用法:
  python3 scripts/check-punct.py            查（CI 跑这个）
  python3 scripts/check-punct.py --record   把当前欠账记成新基准（还完债之后用）
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASELINE = ROOT / 'scripts/punct-baseline.json'

# 扫哪些。中文设计文档 / 档案 / 工作法都算「中文内容」。
# 源码注释暂不扫 —— 面太大且噪音高，要扫得单独一轮，不顺手扩。
GLOBS = ['*.md', 'docs/**/*.md', 'rooms/.roomwork/**/*.md', 'backend/**/*.md',
         'mini/**/*.md', 'web/**/*.md', '.claude/*.md',
         # 设计文档是中文正文，同样归这条规矩管。够不着就不该给它打分，
         # 所以宁可扩 glob，也不要「扫了一圈全绿」而其实一个字没读到。
         '.claude/design/*.html']
SKIP = ('node_modules', 'target', '/archive/', 'dist/')

CJK = r'一-龥'
BAD = re.compile(rf'[{CJK}][,?!;:]|[,?!;:][{CJK}]')


def count(path):
    """一份文件里的违规数。围栏代码块与行内代码不算。"""
    n = 0
    inblock = False
    for line in path.read_text(encoding='utf-8', errors='ignore').split('\n'):
        if line.strip().startswith('```'):
            inblock = not inblock
            continue
        if inblock:
            continue
        n += len(BAD.findall(re.sub(r'`[^`]*`', '', line)))
    return n


def scan():
    """返回 (有违规的文件 → 数量, 一共扫了几个文件)。

    两样都要:清干净的文件会从前一个里消失,所以【只看它】分不出
    「债还清了」与「这个文件已经不在扫描范围内了」—— 而后者会让这道门禁
    悄悄少管一片。第一版就是这样,把 GLOBS 改坏之后它对每个文件都报
    「还了 N 处」然后退 0。"""
    out = {}
    seen = set()
    for g in GLOBS:
        for f in ROOT.glob(g):
            r = str(f.relative_to(ROOT))
            if r in seen or any(s in '/' + r for s in SKIP):
                continue
            seen.add(r)
            n = count(f)
            if n:
                out[r] = n
    return out, seen


now, seen = scan()
if not seen:
    print('✗ 一份文档都没扫到 —— GLOBS 对不上了？查不到东西的核对必须失败')
    sys.exit(1)

if '--record' in sys.argv:
    BASELINE.write_text(json.dumps(now, ensure_ascii=False, indent=2, sort_keys=True) + '\n',
                        encoding='utf-8')
    print(f'✓ 记下 {len(now)} 个文件、共 {sum(now.values())} 处欠账')
    sys.exit(0)

if not BASELINE.exists():
    print('✗ 没有基准文件。先跑 python3 scripts/check-punct.py --record')
    sys.exit(1)

base = json.loads(BASELINE.read_text(encoding='utf-8'))
bad = 0

# 基准里的每一份,要么真的扫到了,要么真的从仓库里删了。
# 「文件还在、却没被扫到」= 扫描范围悄悄缩了,而那与「债还清了」长得一模一样。
for f in sorted(base):
    if f in seen:
        continue
    if (ROOT / f).exists():
        print(f'✗ {f} 还在，却没被扫到 —— GLOBS 缩了，这一片现在没人管')
        bad += 1
for f in sorted(set(now) | set(base)):
    before, after = base.get(f, 0), now.get(f, 0)
    if after > before:
        kind = '新文件' if f not in base else f'{before} → {after}'
        print(f'✗ {f}　{kind}　新增 {after - before} 处半角标点')
        bad += 1
    elif after < before:
        print(f'· {f}　{before} → {after}　还了 {before - after} 处（记得跑 --record 更新基准）')

total_b, total_n = sum(base.values()), sum(now.values())
print()
print(f'欠账 {total_n} 处 · {len(now)} 个文件（基准 {total_b} 处）· 共扫 {len(seen)} 份')
if bad:
    print(f'✗ {bad} 个文件涨了 —— 新写的中文标点要用全角，见 .claude/CLAUDE.md 第一条')
    print('  旧账不用在这次还，但不许添新的')
else:
    print('✓ 没有新增')
sys.exit(1 if bad else 0)
