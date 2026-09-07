/* 后台控制台 · 逐页走一遍
 *
 * 两半分别验过了:`npm run build` 说它编得过,`scripts/admin-smoke.py` 说
 * 那 58 条路由答得出话。**没有任何东西验过它们接在一起**。
 *
 * 这中间的缝隙是真的:页面里有七十多处 `any`,后端改一个字段名,
 * 那一列就静静空掉 —— 构建不会红(any 什么都收),冒烟也不会红(接口照样 200)。
 *
 * 所以这里有一条不靠映射表的判据:**接口给了 N 条,页面却一行都没渲**。
 * 页面自己发的请求就在网络里,数一数它拿回多少条、屏幕上出现多少行,
 * 对不上就是红 —— 不需要我另外维护一份「哪一页对哪个接口」,
 * 而那种表是会过时的。
 *
 * 用法: bash scripts/webadmin-verify.sh
 *
 * 放在 scripts/ 而不是 webadmin/ :webadmin 有自己的 node_modules,
 * bun 见了它就不再自动补包,于是 import 'playwright' 找不到。
 * 跨目录的验证脚本本来也都在这儿。
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=').slice(1).join('=')
const BASE = arg('base', 'http://127.0.0.1:6030').replace(/\/$/, '')
/* 【顺手把每一页截下来】（2026-09-04 · 25 计划）。
   这一支验的是「接口给了 N 条、页面渲了几行」——机检管得着的那一半。
   另一半机检管不着:十九个工作台【长什么样】。
   用户那一侧有逐屏走留下的一百九十五张图，后台这一侧【一张都没有】,
   而它是这个产品的另一半。

   不给 `--shots=` 就照旧只跑断言，一张不写 —— 门禁里跑的就是那一档。 */
const SHOTS = arg('shots', '')
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const EMAIL = process.env.ADMIN_EMAIL || 'admin@unmei.local'
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

// 页面清单跟 App.tsx 一致。加一页就加一行 —— 不加的话它就没人走
const ROUTES = ['/', '/products', '/pricing', '/promotions', '/subscriptions', '/orders',
                '/payments', '/refunds', '/shipments', '/reconciliation', '/risk', '/finance',
                '/outbox', '/master', '/users', '/naji', '/quotes', '/feature_flags', '/mingli']
/* 【不是每个人都进得去每一页】（2026-09-06 三路验证 · 运营那一路）。
   「主数据」给的四样东西本身没有区（SPU 目录 / 订阅套餐 / 会计科目 /
   跨区聚合的风控模板），2026-09-06 之前它对分区管理员是敞开的 ——
   实测阿港从那里拿到 13,904 个商品，而他自己那一格只有 4 个。
   补上守卫之后这一页对他就是 403。

   所以这一支对分区管理员【不再走这几页】，改成验另一件事:
   **左栏里也不该摆着它**。一个点进去必然 403 的入口，
   比没有这个入口更糟 —— 它让人以为功能坏了。
   两侧一起验:进不去的页，导航上就不该有。 */
const 只给全区 = new Set(['/master', '/audit'])

let passed = 0
let failed = 0
const ok = (cond, name, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? '　' + detail : ''}`)
  cond ? passed++ : failed++
}

/* 用 Playwright 自带的 chromium，【不要】装机版 Chrome。
   08-30 实测：`channel: 'chrome'` 拉起来的进程活二三十秒就挨 SIGKILL ——
   不是崩（没有崩溃报告）、也不是内存（当时空着 67%）。同一台机器同一份页面，
   自带 chromium 连跑 30 轮 46 秒无事，装机版 22 轮就没。差别只有这一个开关。
   机器上跑着 GoogleUpdater，而它更新时会清掉所有共用那个 app bundle 的实例。
   症状很难认：门禁连着报红，而失败账是空的（一条断言都没红），
   于是「跑不完」跟「动线断了」在总账上长得一模一样。
   验证工具本来就不该押在用户那份浏览器上 —— 自带的这份就是为可复现装的。 */
/* 【占位行不是数据行】（2026-09-04 · 25 计划的后台逐页走）。
   `tbody tr` 会把「加载中…」「本期无分录」「取不到」这些跨列的占位
   一起数进去 —— 而订单页那一行就写在 `Orders.tsx:129`。
   于是:
     · 等待循环第一次就看见 1 行，立刻返回，截图截在「加载中」上
     · `rows` 是 1 而不是 0，**这一支最核心的那条判据被架空**——
       它要抓的正是「接口给了 N 条、页面一行都没渲」,
       而占位行让 `rows === 0` 永远不成立。
   判据:数据行不会跨列。`colspan` 的那些一律不算。 */
const 数据行数 = () => page.locator('tbody tr:not(:has(td[colspan]))').count()

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const errs = []
page.on('pageerror', (e) => errs.push(String(e.message).split('\n')[0]))
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })

/* 页面自己发的请求,记下每个响应里有多少条。
   `items` 是这套接口统一的分页信封(PageRes<T>);裸数组也认。 */
let seen = []
/* 【侧栏发的不算这一页的数据】（2026-09-04 · 25 计划让阿港走了一轮）。
   `/admin/regions` 是侧栏那个区域选择器发的，每一页都发、恒回 6 条。
   把它算进「这一页拿到几条」的话，一个**真的没有数据**的页
   会被判成「拿到 6 条、一行都没渲」——

   阿超那边每页都真有行，所以这条误报从来没露过面；
   分区管理员一走就现形:促销与风控在 hk 区确实是 0 条，
   而判据说它们「拿到 6 条却空着」。
   一个管理员走不出这种东西，这正是 25 计划要两个管理员的理由。 */
const 侧栏发的 = ['/admin/regions', '/admin/commerce/dashboard', '/admin/health']
page.on('response', async (r) => {
  const u = new URL(r.url())
  if (!u.pathname.startsWith('/admin/') || u.pathname === '/admin/auth/login') return
  if (侧栏发的.includes(u.pathname)) return
  try {
    const j = JSON.parse(await r.text())
    const items = Array.isArray(j) ? j : (Array.isArray(j?.items) ? j.items : null)
    if (items) seen.push({ path: u.pathname, n: items.length })
  } catch { /* 不是 JSON 的响应不参与这条判据 */ }
})

console.log('══ 后台控制台 · 逐页走一遍 ══')
console.log(`前端 ${BASE} · 接口由 vite 代理到 :6029`)

// ── 登录 ──────────────────────────────────────────────────────
console.log('\n── 登录 ──')
await page.goto(BASE + '/login', { waitUntil: 'load' })
await page.locator('input[type=email]').fill(EMAIL)
await page.locator('input[type=password]').fill(PASSWORD)
await page.locator('button[type=submit]').click()
await page.waitForTimeout(1500)
const loggedIn = !page.url().includes('/login')
ok(loggedIn, '用开发种子那对账号登得进去', page.url().replace(BASE, '') || '/')
if (!loggedIn) {
  console.log('\n登录都进不去，后面没得走。')
  await browser.close()
  process.exit(1)
}

/* ── 顶栏那个「看的是」，对这个人有得挑吗（2026-09-05）───────────
   下拉框按【名册】过滤（`region_registry` 六格），再按这个人的
   `region_scope` 收窄。两边对不上就一条都不剩 —— 而一个空的
   `<select>` 在屏上跟「只有一个区」长得几乎一样，没人会去数它。

   实测就有这么一位：验收夹具把阿港的 scope 写成 `{hk}`，
   而 hk 不是这个系统里的一格（`docs/ACCEPTANCE-25.md`）——
   他的顶栏从来是空的，走了两轮逐页也没人发现。 */
{
  const 有几格 = await page.locator('header select#region option').count()
  ok(有几格 > 0, '顶栏那个「看的是」有得挑', `${有几格} 格`)
}

/* 这个人是不是不限区。判据跟后端 `主数据归谁看` 一字不差:
   scope 空、或者含 `global`。从 localStorage 里那份登录信息读 —— 
   它就是前端拿来做同一个判断的那一份。 */
const 不限区 = await page.evaluate(() => {
  try {
    const a = JSON.parse(localStorage.getItem('unmei_admin_auth') || 'null')
    const s = (a && a.region_scope) || []
    return s.length === 0 || s.includes('global')
  } catch { return true }
})

/* ── 进不去的页，左栏上也不该摆着 ──────────────────────────
   一个点进去必然 403 的入口，比没有这个入口更糟:它让人以为功能坏了。
   实测阿港点「操作记录」拿 403 —— 那一挡是**有意为之**且写了原因
   （`audit_log` 没有 region 列），问题从来不在守卫，在入口没跟着藏。 */
{
  const 左栏 = await page.locator('aside nav a').evaluateAll(
    (as) => as.map((a) => a.getAttribute('href') || ''))
  const 该藏的 = [...只给全区].filter((r) => 左栏.includes(r))
  if (不限区) {
    ok(该藏的.length === 只给全区.size,
       '管全部区域的人，那几页在左栏上摆着', 该藏的.join(' '))
  } else {
    ok(该藏的.length === 0,
       '只管几格的人，左栏上没有他点进去必然 403 的入口',
       该藏的.length ? `还摆着：${该藏的.join(' ')}` : '一条都没有')
  }
}

// ── 逐页 ──────────────────────────────────────────────────────
console.log('\n── 十九页，每页都开得起来吗 ──')
const 空表 = []
for (const r of ROUTES) {
  if (!不限区 && 只给全区.has(r)) {
    console.log(`  · ${r} 跳过：这一页只给不限区的人（上面已经验过左栏里没有它）`)
    continue
  }
  errs.length = 0
  seen = []
  /* 走【真路径】。第一版用的是 `#/orders` 这种写法,而它是 BrowserRouter ——
     hash 根本不换页,十九次走的都是首屏,十九条全绿且毫无意义。
     露馅的是打印出来的那句「这一页不是表格」:Orders 明明有 <table>。
     细节没打出来的话,我就信了。 */
  await page.goto(BASE + r, { waitUntil: 'load' })
  /* 等【状态】，不等秒数。
     原先是固定 1200ms。单独跑够用，跟别的门禁一起跑时机器忙，
     /products 接口已经回了 6 条、表还没渲完就被数了 —— 于是偶发地红一次，
     而偶发的红比常红更糟：它教人把每一次红都先当成噪音。
     （2026-08-24 真踩到：全套门禁里红，单独重跑 21 条全过。）

     等法要分两种页：有数据的等它真渲出行来；没数据的不能干等 ——
     所以数据一直是 0 就只给一小段宽限，够它把「空表」渲出来即可。 */
  {
    const 起 = Date.now()
    for (;;) {
      const 行 = await 数据行数()
      if (行 > 0) break
      const 拿到 = seen.reduce((a, x) => a + x.n, 0)
      if (拿到 === 0 && Date.now() - 起 > 1200) break
      if (Date.now() - 起 > 10000) break
      await page.waitForTimeout(120)
    }
  }

  const rows = await 数据行数()
  const hasTable = (await page.locator('tbody').count()) > 0
  const got = seen.reduce((a, s) => a + s.n, 0)

  if (errs.length) {
    ok(false, r, errs[0])
    continue
  }
  ok(true, r, hasTable ? `${got} 条 → ${rows} 行` : '（这一页不是表格）')

  /* 截【整页】，不只是视口那一屏 —— 运营台是往下长的，
     只截第一屏等于把表格的大部分裁掉。 */
  if (SHOTS) {
    const 名 = (r === '/' ? 'dashboard' : r.replace(/^\//, '')).replace(/\//g, '-')
    await page.screenshot({ path: join(SHOTS, `${名}.png`), fullPage: true })
  }

  /* 接口给了、页面没渲 —— 字段对不上就长这样。
     反过来(渲得比拿到的多)不算错:有些页会把几个接口的结果并到一张表里。 */
  if (hasTable && got > 0 && rows === 0) 空表.push(`${r}（拿到 ${got} 条,一行都没渲）`)
}

console.log('\n── 接口给了数据，页面渲出来了吗 ──')
ok(空表.length === 0, '没有「有数据却空着」的页', 空表.join(' · ') || '都对得上')

/* 一页看完 —— 跟用户那一侧的逐屏走同一个形式。
   十九张图分开看是十九次开关文件，连在一起才看得出
   「这十九个台子像不像一套东西」。 */
if (SHOTS) {
  const 图 = ROUTES.filter((r) => 不限区 || !只给全区.has(r))
    .map((r) => (r === '/' ? 'dashboard' : r.replace(/^\//, '')).replace(/\//g, '-'))
  writeFileSync(join(SHOTS, 'index.html'),
    '<meta charset="utf-8"><title>后台逐页走 · ' + EMAIL + '</title>' +
    '<style>body{margin:0;background:#f4f1ea;font:14px/1.6 -apple-system,sans-serif}' +
    'h1{font-size:15px;padding:14px 16px;margin:0;position:sticky;top:0;background:#f4f1ea}' +
    'figure{margin:0 0 26px}figcaption{padding:6px 16px;color:#6b6459}' +
    'img{width:100%;display:block;border-top:1px solid #ddd6c8}</style>' +
    `<h1>后台逐页走 · ${EMAIL} · ${图.length} 页</h1>` +
    图.map((n) => `<figure><figcaption>${n}</figcaption><img src="${n}.png"></figure>`).join(''),
    'utf-8')
  console.log(`\n图在 ${SHOTS}/ —— 一页看完：open ${join(SHOTS, 'index.html')}`)
}

console.log(`\n共验了 ${passed + failed} 条`)
console.log(failed ? `✗ ${failed} 条不过` : '✓ 都通了')
await browser.close()
process.exit(failed ? 1 : 0)
