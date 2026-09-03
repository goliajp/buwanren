#!/usr/bin/env python3
"""数据库查询挂了，不许显示成一个数。

【为什么要有这一支】——2026-09-03 在后台看板上抓到:十一个 KPI 每一个都是
`.await.unwrap_or(0)`。查询失败就返回 0，而这一屏的整个读法建立在
「零是好消息」上:左栏不为零才报数、看板只列不为零的待办、
没事的时候它说「都清完了 —— 没有待付的订单、没有等着批的退款」。

于是一次数据库抖动会让运营看到一屏「什么都不用做」——
而那正是这台控制台最不该说错的一句话。

这跟 `pg_value_to_json` 那次是同一种病:**失效长得跟数据一模一样**。
两处都靠肉眼发现，所以补这一支。

判据:一次 `.await` 之后紧跟着 `unwrap_or(` 或 `.ok()`，
落在给前端算数的路径上。真需要默认值的地方在下面【逐条豁免】——
豁免是显式的，一条一句理由。
"""
import pathlib, re, sys

根 = pathlib.Path(__file__).resolve().parent.parent / 'backend'

# 显式豁免。每一条都要说清「这里的默认值为什么是对的」。
放过 = {
    # 汇率取不到时按 1 折算，是 SQL 里的 COALESCE，不是吞错误
    'unmei-admin-api/src/routes/mingli.rs': '排盘服务连不上时回一个空对象 —— 那一屏本来就在报「它还活着吗」',
    'unmei-api/src/routes/naji.rs': '问签计数取不到按 0 —— 它只决定文案说「第几次」，不决定要不要做事',
    'unmei-api/src/routes/incense.rs': '香火数返回的是 Option —— 拿不到时前端显示「没有这个数」，不是 0',
    'unmei-admin-api/src/main.rs': '启动时查默认口令还在不在，查不到就不提醒 —— 它不上屏',
}

坏 = []
查过 = 0
for f in sorted(根.rglob('*.rs')):
    rel = str(f.relative_to(根))
    if '/tests/' in rel or rel.startswith('target'):
        continue
    源 = f.read_text(encoding='utf-8')
    if '.await' not in 源:
        continue
    查过 += 1
    if rel in 放过:
        continue
    行们 = 源.splitlines()
    for i, 行 in enumerate(行们):
        if 行.lstrip().startswith(('//', '*', '/*')):
            continue
        # 同一行:`.fetch_one(&st.db).await.unwrap_or(0)`
        # 跨一行:`.await` 换行之后 `.unwrap_or(0)`
        下 = 行们[i + 1].strip() if i + 1 < len(行们) else ''
        本 = 行.strip()
        命中 = (re.search(r'\.await\s*\.\s*(unwrap_or\(|ok\(\))', 本)
                or ('.await' in 本 and re.match(r'\.\s*(unwrap_or\(|ok\(\))', 下)))
        if not 命中:
            continue
        # 只管数据库那条路 —— HTTP 请求超时给默认值是另一回事
        上下文 = '\n'.join(行们[max(0, i - 6):i + 2])
        if not re.search(r'sqlx::query|fetch_one|fetch_all|fetch_optional|execute\(', 上下文):
            continue
        坏.append(f'{rel}:{i + 1}  {本[:72]}')

# 【一个文件都没扫到就不算数】。路径改过、后缀改过，
# 上面那个循环一条都不会跑，而它跟「全干净」长得一模一样。
if 查过 < 10:
    print(f'✗ 只扫到 {查过} 个含 .await 的 rs 文件 —— 路径多半变了，这一支现在什么都没验到')
    sys.exit(1)

if 坏:
    print(f'✗ {len(坏)} 处把数据库查询的失败吞成了一个数（扫了 {查过} 个文件）:')
    for x in 坏[:20]:
        print('   ' + x)
    if len(坏) > 20:
        print(f'   …… 另有 {len(坏) - 20} 处')
    print('   「取不到」跟「是零」要分得开 —— 上抛让调用方知道，')
    print('   真该有默认值的地方写进脚本里的「放过」，一条一句理由')
    sys.exit(1)
print(f'✓ 查询失败不会显示成数字 · 扫了 {查过} 个文件')
