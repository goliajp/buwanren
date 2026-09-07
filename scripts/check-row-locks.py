#!/usr/bin/env python3
"""行锁只有在事务里才算数。

`SELECT … FOR UPDATE` 单独一句跑在连接池上，是【空转】的:
sqlx 走自动提交，语句一结束隐式事务就提交，锁当场释放 ——
而要保护的那段代码是在那之后才跑的。它读起来像「把这批行占住」，
实际什么都没占住。

2026-09-02 在 `workers/outbox.rs` 抓到一处:分发器用
`SELECT … FOR UPDATE SKIP LOCKED` 取待发事件，注释写着「不会双跑」。
实测把同一句连着跑两次，两次拿到的是同一批。没出事只是因为
每个有副作用的处理器自己在事务里锁了聚合行 —— 保护是别人替它做的，
下一个不带自锁的处理器加进来就会双跑。

判据三档:
  · 在事务上跑（`&mut *tx`）—— 成立
  · 在池上跑，但整句是 UPDATE / DELETE / INSERT —— 成立。
    这时 FOR UPDATE 是它的子查询，锁与写在同一个隐式事务里
    （outbox 现在的租约式领取就是这个形状）
  · 在池上跑，整句是 SELECT —— **不成立**，报红

注释里讨论这些是允许的:`subscription_billing.rs` 有一句注释写着
「用例层自己在事务里带 FOR UPDATE 读」，那不该被算进来。
"""
import re
import sys
import pathlib

# `scripts/` 不一定在 sys.path 上 —— 显式加
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _walk import 全找

根 = pathlib.Path(__file__).resolve().parent.parent
# 【不要走进构建产物】(scripts/_walk.py)。原先连结果过滤都没有 ——
# `backend/` 底下挂着 23 GB 的 target，这一支为此跑了四分钟。
源 = list(全找(根 / 'backend', '*.rs'))
if len(源) < 20:
    print(f'✗ 只扫到 {len(源)} 个 .rs —— 目录搬过家而这一支没跟上')
    sys.exit(1)

取 = re.compile(r'\.(fetch_all|fetch_one|fetch_optional|execute)\s*\(([^)]*)\)')
事务 = re.compile(r'&mut\s+\*+\s*\w*tx')


def 挖注释(s):
    """整块注释换成等长空白 —— 行号不漂，里面讨论 FOR UPDATE 也不算数。"""
    s = re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), s, flags=re.S)
    return re.sub(r'//[^\n]*', lambda m: ' ' * len(m.group(0)), s)


def 判一处(净, 位):
    """返回 (成立吗, 怎么跑的, 整句的头一个词)。"""
    头 = 净.rfind('r#"', 0, 位)
    if 头 < 0:
        头 = 净.rfind('"', 0, 位)
    语句 = re.sub(r'^\s*r?#?"', '', 净[头:位]).strip()
    首词 = (语句.split() or ['?'])[0].upper().lstrip('(')
    n = 取.search(净, 位, 位 + 600)
    if not n:
        return None, '找不到 fetch', 首词
    进 = n.group(2).strip()
    if 事务.search(进):
        return True, 进, 首词
    return 首词 in ('UPDATE', 'DELETE', 'INSERT', 'WITH'), 进, 首词


错, 处数 = [], 0
for f in 源:
    净 = 挖注释(f.read_text(encoding='utf-8'))
    for m in re.finditer(r'FOR UPDATE', 净):
        处数 += 1
        行 = 净[:m.start()].count('\n') + 1
        ok, 进, 首词 = 判一处(净, m.start())
        名 = f.relative_to(根)
        if ok is None:
            错.append(f'{名}:{行}　FOR UPDATE 后面 600 字里找不到 fetch —— 这一支读不懂它，先说不懂')
        elif not ok:
            错.append(f'{名}:{行}　{首词} … FOR UPDATE 跑在 `{进}` 上 —— '
                      f'不是事务，锁在语句结束时就没了')

# 自检:两段合成代码，一段必须红、一段必须不红。
# 没有它的话，正则哪天匹配不上任何东西，这一支照样报绿。
自检 = [
    ('SELECT id FROM t WHERE x=1 FOR UPDATE"#,\n    ).fetch_all(&st.db)', True),
    ('UPDATE t SET a=1 WHERE id IN (SELECT id FROM t FOR UPDATE SKIP LOCKED)'
     ' RETURNING id"#,\n    ).fetch_all(&st.db)', False),
    ('SELECT id FROM t FOR UPDATE"#,\n    ).fetch_one(&mut *tx)', False),
]
for 片, 该红 in 自检:
    片 = 'r#"' + 片
    p = 片.find('FOR UPDATE')
    ok, _, _ = 判一处(片, p)
    if (ok is False) != 该红:
        print(f'✗ 自检不成立：{"该红却没红" if 该红 else "不该红却红了"} —— {片[:60]}')
        sys.exit(1)

if 处数 < 8:
    print(f'✗ 全仓只找到 {处数} 处 FOR UPDATE —— 正则多半没匹配上，这一支在空转')
    sys.exit(1)

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'行锁都在事务里 · {len(源)} 个文件 · {处数} 处 FOR UPDATE')
sys.exit(1 if 错 else 0)
