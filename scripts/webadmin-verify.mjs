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

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=').slice(1).join('=')
const BASE = arg('base', 'http://127.0.0.1:6030').replace(/\/$/, '')
const EMAIL = process.env.ADMIN_EMAIL || 'admin@unmei.local'
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

// 页面清单跟 App.tsx 一致。加一页就加一行 —— 不加的话它就没人走
const ROUTES = ['/', '/products', '/pricing', '/promotions', '/subscriptions', '/orders',
                '/payments', '/refunds', '/shipments', '/reconciliation', '/risk', '/finance',
                '/outbox', '/master', '/users', '/naji', '/quotes', '/feature_flags', '/mingli']

let passed = 0
let failed = 0
const ok = (cond, name, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? '　' + detail : ''}`)
  cond ? passed++ : failed++
}

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const errs = []
page.on('pageerror', (e) => errs.push(String(e.message).split('\n')[0]))
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })

/* 页面自己发的请求,记下每个响应里有多少条。
   `items` 是这套接口统一的分页信封(PageRes<T>);裸数组也认。 */
let seen = []
page.on('response', async (r) => {
  const u = new URL(r.url())
  if (!u.pathname.startsWith('/admin/') || u.pathname === '/admin/auth/login') return
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

// ── 逐页 ──────────────────────────────────────────────────────
console.log('\n── 十九页，每页都开得起来吗 ──')
const 空表 = []
for (const r of ROUTES) {
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
      const 行 = await page.locator('tbody tr').count()
      if (行 > 0) break
      const 拿到 = seen.reduce((a, x) => a + x.n, 0)
      if (拿到 === 0 && Date.now() - 起 > 1200) break
      if (Date.now() - 起 > 10000) break
      await page.waitForTimeout(120)
    }
  }

  const rows = await page.locator('tbody tr').count()
  const hasTable = (await page.locator('tbody').count()) > 0
  const got = seen.reduce((a, s) => a + s.n, 0)

  if (errs.length) {
    ok(false, r, errs[0])
    continue
  }
  ok(true, r, hasTable ? `${got} 条 → ${rows} 行` : '（这一页不是表格）')

  /* 接口给了、页面没渲 —— 字段对不上就长这样。
     反过来(渲得比拿到的多)不算错:有些页会把几个接口的结果并到一张表里。 */
  if (hasTable && got > 0 && rows === 0) 空表.push(`${r}（拿到 ${got} 条,一行都没渲）`)
}

console.log('\n── 接口给了数据，页面渲出来了吗 ──')
ok(空表.length === 0, '没有「有数据却空着」的页', 空表.join(' · ') || '都对得上')

console.log(`\n共验了 ${passed + failed} 条`)
console.log(failed ? `✗ ${failed} 条不过` : '✓ 都通了')
await browser.close()
process.exit(failed ? 1 : 0)
