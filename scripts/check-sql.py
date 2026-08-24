#!/usr/bin/env python3
"""每一条 SQL，交给 Postgres 自己判 —— 表名、列名、类型。

**为什么非有不可**：这个仓库明确约定「全仓统一走运行期 `sqlx::query()`，
禁用 `query!` 宏」（见 `.github/workflows/backend.yml` 的注释）。那条约定换来了
「编译不需要连库」，代价是**编译期完全不校验 SQL**：表名写错、列名写错、
少一个字段，编译一路绿，到运行期变成 500。2026-08-18 我给后台冒烟做变异测试时
就是这么植入缺陷的——把一处表名改错，编译毫无反应。

这一支把那层校验补回来：不自己写 SQL 解析器（写不对），
而是把每条 SQL 交给真的 Postgres `PREPARE` 一遍。它认得的东西比我多。

**没验到的要说出来**：
  · 用 `format!` 拼出来的 SQL 不是字面量，取不到，逐条报出来
  · 参数类型推不出来的（`$1` 两边都没有类型线索），`PREPARE` 会拒绝，
    这不是 SQL 错，单独计数

用法:
  python3 scripts/check-sql.py                      连本机 docker 里那个库
  DATABASE_URL=postgres://… python3 scripts/check-sql.py    连指定的库
"""
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BE = ROOT / 'backend'
DB_URL = os.environ.get('DATABASE_URL', '')
# 本机那个库在 docker 里、端口 6032（不是默认的 5432）
PG_CONTAINER = os.environ.get('PG_CONTAINER', 'unmei-postgres')

CALL = re.compile(r'sqlx::query(?:_as|_scalar)?(?:::<[^>]*>)?\s*\(\s*')


def literals(src):
    """取 `sqlx::query*(...)` 的第一个实参，只要它是字符串字面量。
    返回 (SQL, 行号) 与 取不到的处数。"""
    out, dynamic = [], 0
    for m in CALL.finditer(src):
        i = m.end()
        line = src.count('\n', 0, i) + 1
        if src.startswith('r#"', i):
            j = src.find('"#', i + 3)
            if j < 0:
                dynamic += 1
                continue
            out.append((src[i + 3:j], line))
        elif src.startswith('"', i):
            j, buf = i + 1, []
            while j < len(src):
                if src[j] == '\\':
                    buf.append(src[j + 1]); j += 2; continue
                if src[j] == '"':
                    break
                buf.append(src[j]); j += 1
            out.append((''.join(buf), line))
        else:
            dynamic += 1        # format! 拼的、变量传进来的 —— 这里验不了
    return out, dynamic


def psql(script):
    if DB_URL:
        cmd = ['psql', DB_URL, '-X', '-q', '-f', '-']
    else:
        cmd = ['docker', 'exec', '-i', PG_CONTAINER, 'psql', '-U', 'unmei', '-d', 'unmei',
               '-X', '-q', '-f', '-']
    # 两个流必须【合起来】。分开取的话记号全在 stdout、报错全在 stderr,
    # 前后一拼,每个错都会归到最后一个记号上 —— 行号就全是错的,
    # 而错的行号比没有行号更糟。
    return subprocess.run(cmd, input=script, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, text=True)


queries, dynamic_total = [], 0
for f in sorted(BE.rglob('*.rs')):
    if '/target/' in str(f):
        continue
    qs, dyn = literals(f.read_text(encoding='utf-8'))
    dynamic_total += dyn
    for sql, line in qs:
        queries.append((str(f.relative_to(ROOT)), line, sql))

if not queries:
    print('✗ 一条 SQL 都没取到 —— 取法对不上了？查不到东西的核对必须失败')
    sys.exit(1)

# 一次会话跑完。每条前面打一个记号，据此把报错认回到具体某条上。
# ON_ERROR_STOP 关掉 —— 要的是【全部】错，不是第一个。
parts = ['\\set ON_ERROR_STOP off']
for n, (_, _, sql) in enumerate(queries):
    # `\warn` 写 stderr,跟报错同一个流 —— `\echo` 写 stdout,
    # 两个流合并时先后不保证,于是错会归到隔壁那条上,行号看着像真的却是错的
    # (第一版就把 natal.rs:124 的错报成了 159)。同一个流才有先后可言。
    parts.append(f'\\warn ⟪{n}⟫')
    parts.append(f'PREPARE _p{n} AS {sql};')
out = psql('\n'.join(parts) + '\n')

# 记号与它后面的报错配对
errs = {}
cur = None
for line in out.stdout.split('\n'):
    m = re.match(r'⟪(\d+)⟫', line.strip())
    if m:
        cur = int(m.group(1))
        continue
    # psql 从标准输入读的时候,报错行前面带 `psql:<stdin>:123:` 前缀,
    # 判 startswith('ERROR:') 永远不匹配 —— 那样这支脚本会以「全过」的样子
    # 存在下去,而它一条也没在看。第一版就是这样,靠变异测试才发现。
    if cur is not None and 'ERROR:' in line:
        errs.setdefault(cur, line[line.index('ERROR:'):].strip())

bad, unverifiable = [], []
for n, (f, line, sql) in enumerate(queries):
    e = errs.get(n)
    if not e:
        continue
    if 'could not determine data type' in e or 'inconsistent types deduced' in e:
        unverifiable.append((f, line, e))
    else:
        bad.append((f, line, sql, e))

for f, line, sql, e in bad:
    print(f'✗ {f}:{line}')
    print(f'    {" ".join(sql.split())[:96]}')
    print(f'    {e}')

print()
print(f'SQL {len(queries)} 条 · 报错 {len(bad)} 条 · 参数类型推不出来 {len(unverifiable)} 条 · '
      f'不是字面量（format! 拼的）{dynamic_total} 条')
if unverifiable:
    print('  推不出类型的（不是 SQL 错，是 $n 两边都没有类型线索）:')
    for f, line, _ in unverifiable:
        print(f'    · {f}:{line}')
if dynamic_total:
    print('  拼出来的那些这里验不了 —— 它们只能靠测试与运行时兜底')
if bad:
    print('✗ 有 SQL 过不了 Postgres 这一关。编译期不会红（本仓禁用 query! 宏），')
    print('  它会在运行期变成 500')
    sys.exit(1)
print('✓ 每一条都过得了 Postgres')
