#!/usr/bin/env bun
/* 把动线在移动网页版上【跑完】—— 这是这套镜像存在的全部理由。
 *
 * 小程序那几条门禁写的是「真机」,而真机这一环没法机检。镜像把其中
 * 能在浏览器里发生的那部分变成可机检的:点一格空宅基会不会说「等人」、
 * 点住着的那格能不能问出签、进屋进不进得去、房间画不画得出来。
 *
 * ── 关于假服务端 ────────────────────────────────────────────────
 * 后端要 Postgres,本机不一定起着,所以这里【拦掉 HTTP,喂固定响应】。
 * 这件事必须显式写在验证脚本里,不能藏进垫片:
 *   - 走的仍是页面 → services/api.ts → wx.request → fetch 这条真路,
 *     只有最后那一跳被换成固定数据
 *   - 所以这里验的是【前端这一侧】。字段与状态码对不对得上后端,
 *     由 scripts/check-api-shape.py 另外机械核对
 * 带 --api=<base> 就不拦,打真后端。
 *
 * 用法:
 *   bun web/verify.mjs                    用假服务端
 *   bun web/verify.mjs --api=http://127.0.0.1:6028
 *   bun web/verify.mjs --shots=<目录>      顺便留截图
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const arg = (k, d) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '=' + d).split('=').slice(1).join('=')
const BASE = arg('base', 'http://127.0.0.1:6031')
const API = arg('api', '')
// 排盘服务(另一个仓库)。给了就把「建本命」那一段真验到底,不给就明说跳过
const MINGLI = arg('mingli', '')
const SHOTS = arg('shots', '')
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

// ── 假服务端。住着 3 位:阿云(有房间)、白鹭(有房间)、陈九(没房间) ──
const HOME = ['ayun', 'bailu', 'chenjiu']
const NAMES = {
  ayun: '阿云', tao: '桃桃', popo: '婆婆', tenz: '丹增', shenyan: '沈砚', bailu: '白鹭',
  chenjiu: '陈九', suhe: '苏合', jiangya: '姜牙', xuanming: '玄冥',
}
const FAKE = {
  /* 名下的本命,空的 —— 这是「还没建过」的真实回答(真后端给 []),
     不是 404。少了这条的话本命页会认为【取不到】而不是【没有】,
     于是不给表单 —— 那正是产品该有的分寸,却让桩显得像坏了。 */
  '/v1/user/natals': () => [],
  /* 四十位名册（「谁能来」那一页用它）。少了这条它落到兜底的 404，
     那一页就停在「取不到」—— 而错误态只剩一行字，当然放得下，
     于是一屏那一支照报「放得下」，实际上那一页这一趟根本没量到版式。
     2026-08-27 是新加的「错误态不算通过」把它抓出来的。 */
  '/v1/villagers': () => [
    { id: 'ayun', name: '阿云', title: '小道士', art: '大六壬', rarity: '常',
      omamori_product_id: 'prod-oma-ayun' },
    { id: 'popo', name: '婆婆', title: '占卜的老太太', art: '塔罗', rarity: '常',
      omamori_product_id: 'prod-oma-popo' },
    { id: 'aluo', name: '阿罗', title: '听鸟的少年', art: '鸟占', rarity: '珍',
      omamori_product_id: null },
    { id: 'aman', name: '阿曼', title: '画沙的人', art: '沙占', rarity: '珍',
      omamori_product_id: null },
    { id: 'suhe', name: '苏合', title: '香药娘子', art: '八字', rarity: '珍',
      omamori_product_id: null },
  ],
  /* 订着的。空数组是「一个都没订」的真实回答（真后端给 []），不是 404 ——
     而 M5 那一屏的主设计就是这个空状态（设计册 10.7）。
     少了这条它停在错误态，空状态那一支反而永远验不到。 */
  '/v1/subscriptions': () => [],
  /* 目录。「订着的」那一屏空着时要指出「哪儿能有」（设计册 10.8 的 M5），
     而那半边就是从这条来的 —— 少了它，那一屏一半停在「一时取不到能订的」。
     这里不按 category 分：桩只需要让页面走完它的路，
     分类是后端按 query 做的事，前端不过滤。 */
  '/v1/products': () => [
    { id: 'prod-membership-gold', code: 'membership_gold', name: '黄金会员',
      sub_title: '月卡 / 年卡', category: 'service', kind: 'subscription',
      fulfillment_kind: 'instant', hero_image_url: null, tags: ['会员'] },
  ],
  /* 问过的签。少了这条的话它落到兜底的 404，于是我家那一屏【永远】停在
     「近几次取不到」—— 而那正是取不到时该有的样子，所以看着像对的。
     成功那条路一次都没被走过：弹性槽装没装得下、矮屏收不收得起来，
     假服务端这一侧全是空的。（2026-08-23 由 CI 红、本机绿逼出来：
     macOS 字体矮 33px，同一个洞在本机刚好没超线。） */
  '/v1/naji/history': () => ({
    items: [
      { id: 'nj_fake_1', date: '08·22 酉时', asked_at: '2026-08-22T18:10:00+09:00',
        gate: '开', direction: '东北', question: null },
      { id: 'nj_fake_2', date: '08·21 午时', asked_at: '2026-08-21T12:30:00+09:00',
        gate: '休', direction: '正南', question: null },
    ],
  }),
  '/v1/village': () => ({
    found: HOME.length,
    total: 40,
    villagers: Object.keys(NAMES).map((id) => ({
      id, name: NAMES[id], title: null, art: null, lack: '勤', rarity: '常',
      at_home: HOME.indexOf(id) >= 0,
    })),
  }),
  reading: (id) => ({
    villager_id: id, villager_name: NAMES[id] || id, art: 'liuren', lack: '勤',
    verdict: '该动了', suit: ['问路', '会友'], avoid: ['久坐'],
    say: '贫道看你今日该动了，宜问路、会友，忌久坐……说完了',
  }),
}

let failed = 0
let ran = 0
const ok = (cond, what, extra) => {
  ran++
  console.log((cond ? '  ✓ ' : '  ✗ ') + what + (extra ? '　' + extra : ''))
  if (!cond) failed++
  return cond
}

const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

/* 这一趟打到了后端哪些路由。跟处理器覆盖是同一个问法：
   没被打过的那些，坏了也不会有人知道。
   记的是【路径】，最后按后端的路由表归一（`/v1/naji/xxx` → `/v1/naji/:id`）。 */
const 打过 = new Set()
p.on('request', (r) => {
  try {
    const u = new URL(r.url())
    if (u.pathname.startsWith('/v1/')) 打过.add(r.method() + ' ' + u.pathname)
  } catch { /* 不是个正经 URL 就不记 —— 记账失败不该让被测的东西挂掉 */ }
})

/* 数一数每秒排了多少帧。要在【任何页面加载之前】装上 ——
   房间挂载时就把 raf 抓进闭包了,之后再包就包不到。
   用它验「退出房间不再烧帧」:一个没停下来的渲染循环在手机上就是耗电,
   而屏幕上什么都看不出来。 */
await p.addInitScript(() => {
  globalThis.__raf = 0
  const orig = globalThis.requestAnimationFrame.bind(globalThis)
  globalThis.requestAnimationFrame = (cb) => { globalThis.__raf++; return orig(cb) }
})

const errs = []
p.on('pageerror', (e) => errs.push(String(e).split('\n')[0]))

/* 页面自己 `console.error` 出来的话也收着。
   匿名登录失败时 `app.ts` 打的正是这一句（「[app] 登录失败：…」），
   而在这之前没人听 —— 于是「token 没写」这件事只剩下一个空的 localStorage，
   原因烂在浏览器控制台里。2026-08-29 追这个 flaky 追到第四层才想起它。 */
const 控台错 = []
p.on('console', (m) => {
  if (m.type() === 'error') 控台错.push(m.text().replace(/\s+/g, ' ').slice(0, 160))
})
/* 「Failed to load resource」这句话不带 URL —— 而没有 URL 的资源错误
   等于没说。响应这一侧记的是哪一条路、回了什么码。 */
const 坏响应 = []
p.on('response', (r) => {
  if (r.status() >= 400) 坏响应.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`)
})
/* 只看【失败的】请求会漏掉最要紧的一种:**根本没发出去的那条**。
   追登录那个 flaky 时兜了五层圈子,就因为「没有失败」被当成了「都正常」。 */
const 打过的 = []
p.on('request', (r) => {
  const u = r.url()
  if (u.includes('/v1/')) 打过的.push(r.method() + ' ' + u.replace(/^https?:\/\/[^/]+/, ''))
})
p.on('requestfailed', (r) => {
  if (r.url().includes('/v1/')) 坏响应.push('发不出去 ' + r.url().replace(/^https?:\/\/[^/]+/, '')
    + '（' + (r.failure() ? r.failure().errorText : '?') + '）')
})

/** 种下的那两册：状态 → { report, order }。多状态那一段拿它切换 */
const 册们 = {}

/* ── 打真后端时先备一份「住着的人」──────────────────────────────
   走的是【真的入住路径】:在库里发一张御守凭据,再让页面调 /v1/omamori/scan。
   不直接往 villager_residency 插一行 —— 那样绕过了入住这件事本身,
   而入住正是这条链要验的一环。

   凭据得进库,库在 docker 里,所以这一步用 docker exec。
   这是【测试夹具】,写在验证脚本里、看得见,不藏在垫片或产品代码里。 */
/* 怎么连库,两边不一样,所以这里认一个环境变量:
     PSQL_URL 设了 —— 直接用 psql 打它(CI 里 postgres 是服务容器,
                      runner 上有 psql,没有一个叫 unmei-postgres 的容器)
     没设     —— docker exec 进本机那个容器(scripts/setup-dev.sh 起的那个)
   不认这个变量的话,同一支验证脚本在两个地方要写两份夹具,而两份会漂。 */
const { execFileSync } = await import('child_process')
const PSQL_URL = process.env.PSQL_URL || ''
const run = (sql) => PSQL_URL
  ? execFileSync('psql', [PSQL_URL, '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'pipe' })
  : execFileSync('docker', ['exec', 'unmei-postgres', 'psql', '-U', 'unmei', '-d', 'unmei',
                            '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'pipe' })
/** 只要一个值。-tA = 去表头去对齐,拿到的就是那个值本身 */
const sql1 = (q) => String(PSQL_URL
  ? execFileSync('psql', [PSQL_URL, '-tAc', q], { stdio: 'pipe' })
  : execFileSync('docker', ['exec', 'unmei-postgres', 'psql', '-U', 'unmei', '-d', 'unmei',
                            '-tAc', q], { stdio: 'pipe' })).trim()

async function mintCredential(villagerId) {
  const oid = 'oma-verify-' + villagerId
  const cred = 'VERIFY-' + villagerId.toUpperCase()
  /* 幂等插入,【不删】。第一版是先删再插,第二次跑就撞外键:
     上一次的入住记录还引用着那张御守。
     不删也没关系 —— 每次跑都是一个【新的匿名用户】(浏览器上下文是干净的),
     入住记录按用户算,所以「扫完收集数变了」照样成立。 */
  const sql = [
    `INSERT INTO omamori (id, villager_id) VALUES ('${oid}','${villagerId}')`
      + ` ON CONFLICT (id) DO NOTHING`,
    `INSERT INTO omamori_credential (carrier_kind, credential, omamori_id)`
      + ` VALUES ('qr','${cred}','${oid}') ON CONFLICT (carrier_kind, credential) DO NOTHING`,
  ].join('; ')
  run(sql)
  return cred
}

if (!API) {
  await p.route('**/v1/**', async (route) => {
    const u = new URL(route.request().url())
    let body = FAKE[u.pathname]
    if (!body) {
      /* 某一签的详情。「近几次」点进去走的就是这条 —— 少了它，
         列表点得动、点进去却是空的，而列表那一半看着完全正常。 */
      const nj = u.pathname.match(/^\/v1\/naji\/(nj_[a-z0-9_]+)$/)
      if (nj) {
        body = () => ({
          id: nj[1],
          asked_at: '2026-08-22T18:10:00+09:00',
          gate: '开', direction: '东北',
          gate_explain: '开门主动，宜启事',
          suit: ['远见', '文教'], avoid: ['入火'],
          quote: { text: '君子以自强不息', source: '乾·象' },
          question: null,
        })
      }
    }
    if (!body) {
      const m = u.pathname.match(/^\/v1\/villagers\/([a-z_]+)\/reading$/)
      if (m) {
        // 没请回家的问签是 404 —— 这条契约前端在用,假服务端也得照做,
        // 否则「网页版上通了」通的是一条真机上不存在的路
        if (HOME.indexOf(m[1]) < 0) {
          return route.fulfill({ status: 404, contentType: 'application/json',
            body: JSON.stringify({ message: m[1] + ' 还没住进你的村子' }) })
        }
        body = () => FAKE.reading(m[1])
      }
    }
    if (!body) return route.fulfill({ status: 404, body: '{}' })
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body()) })
  })
}

const open = async (route, q) => {
  const qs = new URLSearchParams(Object.assign({ page: route }, q || {}))
  await p.goto(BASE + '/index.html?' + qs, { waitUntil: 'load' })
  await p.waitForFunction(() => globalThis.__READY === true, null, { timeout: 15000 })
  await p.waitForTimeout(2200)
}
const shot = async (name) => { if (SHOTS) await p.screenshot({ path: join(SHOTS, name + '.png') }) }
const text = () => p.evaluate(() => (document.getElementById('app').innerText || '').replace(/\s+/g, ' '))
const errScreen = () => p.evaluate(() => document.getElementById('wx-err').textContent || '')

/* 等某一页取完。固定等待在这个项目里撒过三次谎（建本命 / 入住 / 订单列表），
   这里不再重复：等 `loading` 落下来，等不到就说等不到。 */
const 等取完 = async (route) => {
  await p.waitForFunction((r) => {
    const c = globalThis.__router.current()
    return c && c.__route === r && c.data && c.data.loading === false
  }, route, { timeout: 8000 }).catch(() => {})
}

// 点村子画布上的某一格宅基 —— 坐标由引擎给,不在这里另算一份
const tapPlot = async (id) => {
  /* 先保证【就在村主屏上】。以前卡片不跳页，点完还留在这一屏，所以这个前提
     一直白拿；R2 之后点一格会开一屏，不回来的话下一次 tapPlot 找到的
     canvas 是别人的（或者一个都没有），报出来的是一句 TypeError。 */
  if (await p.evaluate(() => globalThis.__router.current().__route) !== 'pages/village/index') {
    await open('pages/village/index')
    await p.waitForTimeout(700)
  }
  // 再回到顶部才算坐标。页面会滚动，不复位的话算出来的 y 可能是负的，
  // 点击落在视口外 —— 驾具自己不稳，量出来的红就不作数。
  await p.evaluate(() => globalThis.scrollTo(0, 0))
  await p.waitForTimeout(120)
  const at = await p.evaluate((vid) => {
    const q = (globalThis.VILLAGE_PLOTS || []).find((x) => x.id === vid)
    if (!q) return null
    const cv = document.querySelector('canvas')
    const r = cv.getBoundingClientRect()
    const k = r.width / cv.width
    return { x: r.left + (q.x + q.w / 2) * k, y: r.top + (q.gy - 20) * k }
  }, id)
  if (!at) throw new Error('宅基表里没有 ' + id)
  if (at.y < 0 || at.y > 844) throw new Error(id + ' 那一格不在视口里(y=' + Math.round(at.y) + '),点不到')
  await p.mouse.click(at.x, at.y)
  await p.waitForTimeout(400)
}

console.log('══ 移动网页版 · 动线验证 ══')
/* 让【页面】也打这个后端，不只是这个脚本自己。
   页面的基址是 config 算出来的 `http://localhost:6028`；两者恰好同一个地址，
   所以从前没人发现「--api 管不着页面」。点香那一屏要另一个端口上的实例，
   当场撞上（见 web/runtime/wx.js 里 request 那一段）。 */
if (API) await p.addInitScript((b) => { globalThis.__API_BASE = b }, API)
console.log(API ? '打真后端 ' + API : '用假服务端（拦 /v1/**，前端这一侧照真路走）')

/* 打真后端时先热一下它再开跑。
   后端刚起来的头一两个请求要建连接池，慢的时候超过八秒 ——
   而这一趟等 token 的地方只等八秒，等不到就把村民、订单、册子三页
   一起跳过，报出来的是「取不到真数据（目录里没有那个 sku）」。
   看着像后端没数据，其实是它还没热。
   2026-08-29 连着两次撞上，都在重启后端之后的第一跑。 */
if (API) {
  const t0 = Date.now()
  let 热了 = false
  for (let i = 0; i < 20 && !热了; i++) {
    try {
      const r = await fetch(API + '/v1/auth/anonymous', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      })
      热了 = r.ok
    } catch { /* 还没起来,再等 */ }
    if (!热了) await new Promise((r) => setTimeout(r, 500))
  }
  if (!热了) {
    console.log(`✗ 后端热不起来（${API}）—— 这一趟没法验，别当它过了`)
    process.exit(1)
  }
  console.log(`  （后端热好了，用了 ${Date.now() - t0}ms）`)
}

/* ── 冷启动那一下，登录不许被自己人清掉 ───────────────────────
   匿名登录是异步的，页面 onShow 抢在它前面就发了一轮请求，那一轮必然 401。
   而 401 的处理曾经是无条件 `storage.clearAll()` —— 于是：

     ① 页面发 /v1/village（这时还没 token）
     ② 登录回来，写下 token
     ③ ①那一条回 401 → clearAll → 刚写下的 token 没了

   成不成看 ②③ 谁先回来，所以它飘。2026-08-29 量到过：连开两页，
   二十五次里十二次登录完还是没 token —— 而症状是村民、订单、册子
   三页一起「跳过」，报出来像是后端没数据。

   要新开一个上下文才验得到：这一趟跑到这儿早就登录过了，
   而这个 bug 只在【第一次登录】那几百毫秒里存在。 */
if (API) {
  const 新 = await b.newContext({ viewport: { width: 375, height: 667 } })
  const 冷 = await 新.newPage()
  await 冷.addInitScript((base) => { globalThis.__API_BASE = base }, API)
  /* 慢下来的是【页面抢先发的那一轮】，不是登录。**不是伪造** ——
     这个窗口本来就存在（匿名登录是异步的，页面 onShow 抢在它前面），
     慢网络上它每次都会张开。

     方向要对：坏的那一版是「401 回来时把已经写下的 token 清掉」，
     所以得让 401 【晚于】登录。头一版反过来延迟了登录，于是 401 更早、
     那时 token 还没写、清了也没影响 —— 一条永远绿的断言。

     靠自然时序去撞的话命中率约一半，而一半时间说谎的门禁比没有更糟：
     跑到这儿时浏览器已经热了，连撞五次都撞不上。 */
  for (const 路 of ['**/v1/village', '**/v1/incense']) {
    await 冷.route(路, async (r) => {
      await new Promise((res) => setTimeout(res, 600))
      await r.continue()
    })
  }
  try {
    const 去 = (r) => 冷.goto(BASE + '/index.html?' + new URLSearchParams({ page: r }))
    await 去('pages/village/index')
    const 读 = () => 冷.evaluate(() => !!localStorage.getItem('unmei:buwanren:token')).catch(() => false)
    // 先等它【出现】
    let 出现过 = false
    for (let k = 0; k < 25 && !出现过; k++) {
      出现过 = await 读()
      if (!出现过) await 冷.waitForTimeout(200)
    }
    /* 再等那两条被拖住的请求回来。要问的是「它【还在】吗」，不是「它出现过吗」——
       清空发生在 401 回来那一刻，而那在 token 写下之后。
       只等「出现」的话，读到就 break，正好赶在被清掉之前，
       于是一条永远绿的断言。 */
    await 冷.waitForTimeout(1500)
    const 还在 = await 读()
    ok(出现过 && 还在,
       '登录写下的 token，不会被抢在它前面那一轮 401 清掉',
       出现过 ? (还在 ? '' : '它出现过，然后被清掉了')
              : '登录压根没写下 token'
       + '　·　localStorage 里：' + await 冷.evaluate(() => Object.keys(localStorage).join(' ') || '空的').catch(() => '问不到'))
  } finally {
    await 新.close()
  }
}

/* ── 冷启动那一下，页面得【等得到】登录 ─────────────────────────
   同一个窗口的另一半：页面 onLoad/onShow 立刻取数，赶在 token 前面拿 401 ——
   要紧的不是那一次 401，是**之后再也不取**：那一屏就写着「取不到」停在那儿，
   刷新一下又好了，于是用户觉得这 app 时好时坏。

   `app.ts` 登录完会给页面栈广播 `onAuthReady`，页面接住重取一次就对了。
   `scripts/check-auth-ready.py` 核的是「有没有那个处理器」；
   这里跑一遍真的冷启动，看那机制到底转不转。

   拿徽章那一页验：它不要参数，而且空着也说得出话。 */
if (API) {
  const 新2 = await b.newContext({ viewport: { width: 375, height: 667 } })
  const 冷2 = await 新2.newPage()
  await 冷2.addInitScript((base) => { globalThis.__API_BASE = base }, API)
  // 把登录拖慢,保证页面那一次取数【一定】赶在 token 前面
  await 冷2.route('**/v1/auth/anonymous', async (r) => {
    await new Promise((res) => setTimeout(res, 700))
    await r.continue()
  })
  try {
    await 冷2.goto(BASE + '/index.html?' + new URLSearchParams({ page: 'pages/badges/index' }))
    // 等到登录落地之后再看:重取该在这之后发生
    await 冷2.waitForTimeout(2500)
    const 屏 = await 冷2.evaluate(() => {
      const d = globalThis.__router.current().data
      return { err: d.err || '', 还在转: !!d.loading, 有货: (d.items || []).length }
    }).catch((e) => ({ err: '问不到：' + String(e), 还在转: false, 有货: 0 }))
    ok(!屏.err && !屏.还在转,
       '登录慢的时候开一页，它等得到登录再取　—— 不是停在「取不到」',
       屏.err ? `停在错误态：${屏.err}` : (屏.还在转 ? '一直转着，没重取' : ''))
  } finally {
    await 新2.close()
  }
}


/* 打真后端时,用【真的入住路径】把两位请回家:
     发一张御守凭据(库里) → 页面点「扫御守」→ /v1/omamori/scan → 入住
   扫码本身只有真机有,所以这里把 wx.scanCode 桩成「扫到了这串凭据」——
   桩在【验证脚本里】,显式的一行,不是垫片替你默默成功。
   除了这一跳,登录、入住、问签、进屋走的都是真后端与真库。 */
async function moveIn(who) {
  const cred = await mintCredential(who)
  await p.evaluate((c) => {
    globalThis.__wxStub('scanCode', () => Promise.resolve({ result: c }))
  }, cred)
  await p.getByText('扫御守').click()
  /* 等它真的跳过去，不数毫秒。1200ms 在负载高的机器上不够 ——
     报出来的是「没开那一屏」，而实际只是还没到。
     固定等待在这个文件里已经撒过四次谎了。 */
  await p.waitForFunction(
    () => globalThis.__router.current().__route === 'pages/moved/index',
    null, { timeout: 15000 },
  ).catch(() => {})
  /* 扫成功之后开的是「他住进来了」那一屏（R6）—— 原先是一句 toast。
     开完要回村里，后面几步都假设自己站在村主屏上。 */
  const 落到 = await p.evaluate(() => globalThis.__router.current().__route)
  if (落到 === 'pages/moved/index') {
    await p.getByText('回村里', { exact: true }).click()
    await p.waitForTimeout(700)
  }
  return 落到
}

// ① 每一页都开得起来 ────────────────────────────────────────────
/* 页面清单从 app.json 读,跟 build.mjs 同一个来源。
   写死一份的话,新加的页面【既不会被验,也不会有人说一声】——
   而那跟「这几页都好着呢」长得一模一样。覆盖面悄悄缩,是这套门禁最怕的一种坏法。 */
const routes = JSON.parse(readFileSync('mini/miniprogram/app.json', 'utf8')).pages
if (!routes || !routes.length) { console.log('✗ app.json 里一页都没有'); process.exit(1) }

/* ── 一屏不滚动（docs/REDESIGN.md R4 / 设计 10.1）─────────────────
   最矮的机器是 iPhone SE：375 × 667，去掉状态栏 20 与 tabBar 50，
   内容区 597。一屏放不下就得滚，而小程序里「往下还有」没有任何提示。
   量的是最矮那一档 —— 它过了，别的都过。 */
async function 量一屏(route, params) {
  await p.setViewportSize({ width: 375, height: 667 })
  await open(route, params)
  /* 等版式**停下来**再量,不是等一个固定的毫秒数。
     我家那一页会自己量高度、反复收敛罗盘直径 —— 400ms 时它还在中间态,
     量到的高度既不是初值也不是终值,还会随机器快慢漂。
     （跟动线里那六处固定等待同一种毛病:等时间不等状态。） */
  await p.waitForFunction(() => {
    const h = () => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
    const w = window
    if (w.__lastH !== h()) { w.__lastH = h(); w.__same = 0; return false }
    return (w.__same = (w.__same || 0) + 1) >= 3
  }, null, { timeout: 8000, polling: 120 }).catch(() => {})
  await p.evaluate(() => { delete window.__lastH; delete window.__same })
  const m = await p.evaluate(() => {
    const d = document.documentElement, b = document.body
    const tab = document.getElementById('wx-tabbar')
    const tabH = tab && getComputedStyle(tab).display !== 'none' ? tab.offsetHeight : 0
    return {
      内容: Math.max(d.scrollHeight, b.scrollHeight),
      视口: window.innerHeight,
      tab: tabH,
      /* 超了的时候光有一个总数没法动手 —— 一并报出这一屏是谁占的。
         逐块量是我先前手动做过好几轮的事,固化进来省得下次再搭一次架子。 */
      分块: Array.from((document.querySelector('#app .page') || { children: [] }).children)
        .map((el) => `${(el.className || '?').toString().split(' ')[0]}:${Math.round(el.getBoundingClientRect().height)}`)
        .filter((x) => !x.endsWith(':0')),
      /* 顺带报出这一屏在不在错误态 —— 错误态跟正常态不是同一个版式,
         拿错误态量出来的欠账,改正常态是改不掉的。 */
      出错: (document.querySelector('#app .page') || { innerText: '' }).innerText
        .split('\n').filter((l) => /取不到|失败|出错/.test(l)).join(' / '),
    }
  })
  await p.setViewportSize({ width: 390, height: 844 })
  /* 问的就是「这一屏滚不滚」，所以拿文档高度直接比窗口 —— 不再另减 tabBar。
     tabBar 是固定定位的，它占的位已经由 body 的 padding-bottom 让出来、
     算在文档高度里了；再减一次就是同一笔减两遍（tab 页凭空多 50px 的欠账）。
     非 tab 页两种算法本来一样,所以这条对所有页都成立。 */
  return { ...m, 溢出: m.内容 - m.视口 }
}

console.log(`\n── ${routes.length} 页都开得起来吗 ──`)
console.log('  （照 app.json 读的，不是另列的一份）')
/* 顺带一条通用的:渲出来的文字里不该有模板残片。
   `wx:if="{{a.length > 0}}"` 里那个 `>` 曾被当成标签结束符,
   标签从那儿断开,剩下的 `0}}">` 落成了页面上的文字 —— 不抛不报,
   只是屏幕上多出一截乱码。是看截图看见的,没有一条检查会红。
   属性里写比较是常见写法,所以这条对每一页都查。 */
/* 有些页天生要参数（商品要 id）。不给的话它如实报「没说是哪一件」——
   那是对的行为，但逐页扫会把它当成「这一页坏了」。所以这里给它真参数，
   参数从**真后端**取；打假服务端时取不到，就明说跳过这一页，不算通过。 */
const 要参数 = {}
if (API) {
  const 商品 = await p.evaluate(async (base) => {
    const r = await fetch(base + '/v1/products?region=cn&platform=mini&category=report')
    if (!r.ok) return null
    const j = await r.json()
    return Array.isArray(j) && j[0] ? j[0].id : null
  }, API)
  if (商品) 要参数['pages/product/index'] = { id: 商品 }

  /* 村民那一屏也要参数。**从 /v1/village 里挑一位真的**，不写死 ——
     写死的话，seed 换了名单它就指向一个不存在的人，而报出来的是
     「村里没有这一位」，看着像产品坏了。 */
  await open(routes[0])
  /* 等 token 落下来再问。匿名登录是异步的 —— 第一版没等，
     于是这一句在登录之前跑，拿到 null，村民那一页整轮被跳过，
     而报告上写的是「取不到真数据」，看着像后端没给。 */
  /* 自己轮询，不用 `waitForFunction` —— 页面刚导航过去时它会抛
     「execution context was destroyed」，而外面那个 `.catch(() => {})`
     一吞就【立刻返回】：写着等二十秒，实际一秒没等。
     症状是村民那一整页每次都跳过，报出来却是「取不到真数据」。
     2026-08-29 把超时从八秒放宽到二十秒毫无变化，才看出等待本身是假的。 */
  for (let i = 0; i < 40; i++) {
    const 有 = await p.evaluate(() => !!localStorage.getItem('unmei:buwanren:token'))
      .catch(() => false)
    if (有) break
    await p.waitForTimeout(500)
  }
  /* 三种失败长得一模一样(都是 null),而报出来的都是「取不到真数据」——
     于是村民那一整页在真后端这一档【从没验过】,而报告上看着像后端没给。
     2026-08-28 追这件事花了半轮,就因为这一步不说自己卡在哪。 */
  const 某位说法 = await p.evaluate(async (base) => {
    const raw = localStorage.getItem('unmei:buwanren:token')
    if (!raw) {
      // 「没 token」还能再分:localStorage 是空的(登录压根没跑),
      // 还是里头有别的键(登录跑了但键名不是这个)。两种的修法完全不同
      const 键 = Object.keys(localStorage)
      return { id: null, 因为: `localStorage 里有：${键.join(' ') || '什么都没有'}；当前 ${location.href.slice(-40)}` }
    }
    let r
    try {
      r = await fetch(base + '/v1/village', {
        headers: { authorization: 'Bearer ' + JSON.parse(raw) },
      })
    } catch (e) {
      return { id: null, 因为: '请求发不出去：' + String(e).slice(0, 60) }
    }
    if (!r.ok) return { id: null, 因为: `/v1/village 回了 HTTP ${r.status}` }
    const j = await r.json()
    if (!j.villagers || !j.villagers[0]) return { id: null, 因为: 'villagers 是空的' }
    return { id: j.villagers[0].id, 因为: '' }
  }, API)
  const 某位 = 某位说法.id
  if (某位) 要参数['pages/villager/index'] = { id: 某位 }
  /* 打真后端时挑不出人来,那【不是「这一趟没有真数据」】,是这一趟没验成 ——
     村民那一屏加它的两个状态一起落空,而报出来的是三行温和的「跳过」。
     跳过不是通过:让它红,红了才有人去看。 */
  else ok(false, '挑得出村民那一屏要的那一位',
          某位说法.因为
          + (控台错.length ? `\n         页面自己报的错：${控台错.slice(-3).join(' | ')}` : '\n         页面一句错也没报')
          + (坏响应.length ? `\n         回了错的那几条：${坏响应.slice(-5).join(' | ')}` : '\n         没有一条请求回错')
          + `\n         这一趟打过：${打过的.slice(-8).join(' | ') || '一条都没打'}`)
  // 确认那一屏跟商品页要的是同一个 id
  if (商品) 要参数['pages/confirm/index'] = { id: 商品 }

  // 订单页同理，得有一张真单子。用镜像自己已经登录的那个 token 建一张。
  // 先开一页：还没导航时读 localStorage 会 SecurityError（about:blank 上没有）。
  await open(routes[0])
  /* 建【六张】。一张是订单页要的，六张是「我买过的」翻页要的 ——
     设计 10.3 说一页五笔、多了左右翻，而五笔以内那两个翻页处理器
     一次也按不到：那一段就会靠「从不运行」保持绿色。 */
  const 单们 = await p.evaluate(async (base) => {
    const raw = localStorage.getItem('unmei:buwanren:token')
    if (!raw) return []
    const token = JSON.parse(raw)
    const out = []
    for (let i = 0; i < 6; i++) {
      const r = await fetch(base + '/v1/orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + token,
          'idempotency-key': 'mirror-sweep-' + Math.random().toString(36).slice(2),
        },
        body: JSON.stringify({ lines: [{ sku_id: 'sku-naji-deep', qty: 1 }], region: 'cn' }),
      })
      if (!r.ok) break
      const j = await r.json()
      if (j.order_id) out.push(j.order_id)
    }
    return out
  }, API)
  const 单 = 单们[0] || null
  if (单) 要参数['pages/order/index'] = { id: 单 }

  /* ── 那一册（M2「看 ›」）──────────────────────────────────────
     `sku-naji-deep` 的 fulfillment_kind 是 async_compute，所以上面
     那六张单本来就该出册子 —— 但要付了钱才出，而付款【只有真机有】。

     所以这里跟 mintCredential 同一个路子：把册子种进库，页面照样走
     真的 `/v1/reports/:id`。跳过的只有「付钱」这一跳，报告怎么画、
     还差生辰那半屏怎么说，验的都是真的。

     种两册，因为这一页有【两种状态】而它们长得完全不一样：
       ready          —— 六页都在
       awaiting_natal —— 一页都没有，取而代之是「还差你的生辰」+ 去填的路
     只种 ready 的话，后一半会靠从不运行保持绿色，而它是一半买家的实际遭遇。 */
  if (单们.length >= 2) {
    const uid = sql1(`SELECT user_id FROM order_record WHERE id='${单们[0]}'`)
    // 盘用库里现成的真盘 —— 画出来的四柱、用神、大运都是真算出来的
    const 盘 = sql1(`SELECT natal_id FROM natal_summary WHERE raw_chart IS NOT NULL LIMIT 1`)
    if (uid && 盘) {
      for (const [i, st] of ['ready', 'awaiting_natal'].entries()) {
        const oid = 单们[i]
        const line = sql1(`SELECT id FROM order_line WHERE order_id='${oid}' LIMIT 1`)
        if (!line) continue
        const rid = 'rpt-verify-' + Math.random().toString(36).slice(2, 10)
        const 有盘 = st === 'ready'
        run(`INSERT INTO report (id, user_id, order_line_id, kind, status, natal_id,
               natal_snapshot_json, chart_json, mingli_version, ready_at)
             SELECT '${rid}', '${uid}', '${line}', 'bazi_deep', '${st}',
               ${有盘 ? 's.natal_id' : 'NULL'},
               ${有盘 ? `jsonb_build_object('label','验','year',1998,'month',3,'day',5,'hour',14,'minute',30,'birth_city','成都')` : 'NULL'},
               ${有盘 ? 's.raw_chart' : 'NULL'}, ${有盘 ? 's.mingli_version' : 'NULL'},
               ${有盘 ? 'NOW()' : 'NULL'}
             FROM natal_summary s WHERE s.natal_id='${盘}'
             ON CONFLICT (order_line_id) DO NOTHING`)
        const 真 = sql1(`SELECT id FROM report WHERE order_line_id='${line}'`)
        if (真) {
          册们[st] = { report: 真, order: oid }
          // 逐页那一趟开的是 ready 那册 —— 六页都在，版式才量得到
          if (有盘) 要参数['pages/report/index'] = { id: 真 }
        }
      }
    }
  }
}

for (const r of routes) {
  errs.length = 0
  if (['pages/product/index', 'pages/order/index', 'pages/villager/index', 'pages/confirm/index', 'pages/report/index'].includes(r) && !要参数[r]) {
    console.log(`  · 跳过 ${r.replace('pages/', '').replace('/index', '')}：`
      + '取不到真数据（假服务端 / 目录里没有那个 sku）—— 这一页【没验】')
    continue
  }
  await open(r, 要参数[r])
  const scr = await errScreen()
  const t = await text()
  const 残片 = /\{\{|\}\}/.test(t)
  /* 页面自己那一行错误也要看。全屏报错遮罩查的是「抛出来的」,
     而「取不到村子：…」这类是页面【接住之后写在屏上】的 —— 两回事。
     本命页那个冷启动竞态就长这样:遮罩干净,页面上却停着一行取不到。
     只在打真后端时查:假服务端本来就有几条接口不给,那时候有 err 是如实的。 */
  const 页内错 = API ? await p.evaluate(() => {
    const c = globalThis.__router.current()
    return (c && c.data && c.data.err) || ''
  }) : ''
  ok(!scr && !残片 && !页内错, r.replace('pages/', '').replace('/index', ''),
     scr ? scr.split('\n')[1]
         : 残片 ? '页面上渲出了模板残片 {{ 或 }}'
         : 页内错 ? '页面上停着一行:' + 页内错.slice(0, 30) : '')
}

// ② 村主屏 ──────────────────────────────────────────────────────
console.log('\n── 村主屏 ──')
errs.length = 0
await open('pages/village/index')
if (API) {
  console.log('  （打真后端：先用真的入住路径请阿云与陈九回家）')
  const before = await text()
  const 落到 = await moveIn('ayun')
  /* 这一下是整条链上唯一一次实物变成人 —— 它值一屏，不是一句 toast
     （docs/REDESIGN.md R6 / 设计 V6）。 */
  ok(落到 === 'pages/moved/index', '扫开之后开的是「他住进来了」那一屏', 落到)
  await moveIn('chenjiu')
  const after = await text()
  ok(before !== after, '扫御守之后收集数变了', before.match(/收集 \S+/) + ' → ' + after.match(/收集 \S+/))

  /* 那一屏说得对不对：头一回是「住进来了」，重复扫是「早就在了」。
     重复扫不是错误，但话要不一样 —— 这是 types/village.ts 上写着的设定。 */
  await moveIn('ayun')
  await open('pages/moved/index', { name: '阿云', n: '0', id: 'ayun' })
  await p.waitForTimeout(400)
  const 重复 = await text()
  ok(重复.includes('早就在了'), '重复扫说的是「早就在了」，不是同一句', 重复.slice(0, 30))
  /* 「他住进来了」那一屏上的出口。扫完一枚御守之后最想做的就是这一下,
     而它从来没被真按过 —— 按钮在、点了没反应是两回事。 */
  await p.getByText('去看看他', { exact: true }).click()
  await p.waitForFunction(
    () => globalThis.__router.current().__route === 'pages/villager/index',
    null, { timeout: 15000 },
  ).catch(() => {})
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/villager/index',
     '「他住进来了」那一屏上按「去看看他」，真的到得了他那一页',
     await p.evaluate(() => globalThis.__router.current().__route))

  /* ── 「该扫了」（设计册 E2）──────────────────────────────────
     **这一条只在「有单已签收、还没扫」时出现**：常驻的提示会被无视，
     只在该出现时出现的才被点。收货扫码率是整条链上最敏感的一个数 ——
     御守寄到了却没扫，这一单就停在「东西到了」，人一直没住进村子。

     这个状态在开发库里【本来造不出来】：已签收的包裹里一件御守都没有。
     所以这里自己种一条真的（订单 + 御守行 + 已签收的包裹），
     否则这一条永远不会出现，而「没出现」跟「没做」在屏幕上长得一模一样。 */
  const 我是谁 = await p.evaluate(() => {
    const u = getApp().globalData.user
    return u ? u.id : null
  })
  if (!我是谁) {
    ok(false, '「该扫了」这一段验不成', '拿不到当前用户 id')
  } else {
    const 尾 = 我是谁.slice(-12)
    const sku = sql1("SELECT id FROM sku WHERE villager_id='popo' LIMIT 1")
    if (!sku) {
      ok(false, '「该扫了」这一段验不成', '库里没有绑着村民的御守 sku')
    } else {
      /* 挑一位【这一趟没有请回家】的（上面请的是阿云与陈九）——
         挑到已经住下的那位，这一条本该不出现，而它不出现看着就像功能没做。 */
      run([
        `INSERT INTO order_record(id,user_id,channel_origin,currency,`
        + `amount_subtotal_minor,amount_total_minor,amount_paid_minor,status,`
        + `source_kind,region,paid_at) VALUES ('ord-e2-${尾}','${我是谁}','mini','CNY',`
        + `9900,9900,9900,'paid','one_shot','cn',NOW()) ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO order_line(id,order_id,line_no,sku_id,sku_snapshot_json,`
        + `unit_price_minor,qty,line_subtotal_minor) VALUES ('ol-e2-${尾}','ord-e2-${尾}',1,`
        + `'${sku}','{"sku_name":"御守"}'::jsonb,9900,1,9900) ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO shipment(id,order_id,carrier_code,tracking_no,status,delivered_at)`
        + ` VALUES ('shp-e2-${尾}','ord-e2-${尾}','manual','E2-${尾}','delivered',NOW())`
        + ` ON CONFLICT (id) DO NOTHING`,
      ].join('; '))

      await open('pages/village/index')
      await p.waitForFunction(() => globalThis.__router.current().data.toScan === true,
                              null, { timeout: 15000 }).catch(() => {})
      ok(await p.evaluate(() => globalThis.__router.current().data.toScan) === true,
         '有单已签收还没扫时，村子主屏上多一条',
         String(await p.evaluate(() => globalThis.__router.current().data.toScan)))
      const 那一条 = await text()
      ok(那一条.includes('你手上那枚，扫开它'), '那一条说的是「你手上那枚，扫开它」')
      /* **不许说是谁**。「还没请回来的人，名字都不该知道」是这个产品的设定，
         空屋那一屏也照这条走 —— 提示里漏出名字，等于从后门把它破了。 */
      const 那位 = sql1(`SELECT name FROM villager WHERE id='popo'`)
      ok(那位 && !那一条.includes(那位), '那一条不说是谁　—— 还没请回来的人，名字都不该知道', String(那位))
      /* 村子这一屏本来就是刚好放得下的。多一条不能把它顶出去 ——
         画布得跟着让位（`fitCanvas` 按可用空间铺，不是硬按屏宽）。

         **在最矮那一档上量**：iPhone SE 375×667 是这个项目所有版式判断
         对着的那台机器。下面「一屏放得下吗」那一节量的是【没有这一条】的
         常规态（那时是个新的匿名用户），够不着这一刻。 */
      await p.setViewportSize({ width: 375, height: 667 })
      await open('pages/village/index')
      await p.waitForTimeout(1500)
      const 滚了 = await p.evaluate(() => {
        const e = document.documentElement
        return e.scrollHeight > e.clientHeight ? e.scrollHeight - e.clientHeight : 0
      })
      ok(滚了 === 0, '多了这一条，村子那一屏仍然放得下', 滚了 ? `超 ${滚了}px` : '不滚')
      /* 而且是靠【槽收起】放下的，不是靠把画布缩小换来的 ——
         两种都能让这一屏不滚，但它们是两件事：槽的判据是「删掉这一屏
         仍然成立」，画布是这一屏的主体。分不清的话，哪天画布被悄悄缩掉
         一半，上面那条照样绿。 */
      const 槽收了 = await p.evaluate(() => {
        const el = document.querySelector('.manual')
        return !el || getComputedStyle(el).display === 'none'
      })
      ok(槽收了, '矮屏上「手输编号」那一槽是收起的')
      /* 画布【还在画上】。改画布尺寸的代码最容易的坏法就是把画面弄没了,
         而「一片空白」在截图之外没有任何东西会红 —— 上面那条「村子真的
         画上去了」跑在这一段【之前】，够不着这一刻。 */
      const 还在 = await p.evaluate(() => {
        const cv = document.querySelector('canvas')
        if (!cv) return { 有画布: false }
        const g = cv.getContext('2d')
        const d = g.getImageData(0, 0, cv.width, Math.min(400, cv.height)).data
        let ink = 0
        for (let i = 3; i < d.length; i += 4) if (d[i]) ink++
        const r = cv.getBoundingClientRect()
        return { 有画布: true, ink, 像素: cv.width + 'x' + cv.height,
                 屏上: Math.round(r.width) + 'x' + Math.round(r.height) }
      })
      ok(还在.有画布 && 还在.ink > 100000,
         '多了这一条，村子还在画上　—— 不是把画面挤没了',
         还在.有画布 ? `${还在.ink} 个不透明像素 · 像素 ${还在.像素} · 屏上 ${还在.屏上}` : '连画布都没有')
      await shot('09-该扫了')
      await p.setViewportSize({ width: 390, height: 844 })

      /* 弹性槽：手输编号（设计册 E2）。
         **这是网页版上唯一走得通的入住路径** —— 扫码只有真机有，
         而手输走的是同一条接口，凭证从键盘来而已。
         现实里它服务的是码磨花了、相机坏了的人：他们手上真有一枚御守。 */
      await p.setViewportSize({ width: 390, height: 844 })   // 槽在矮屏收起，这里要长屏
      await open('pages/village/index')
      await p.waitForFunction(() => globalThis.__router.current().data.toScan === true,
                              null, { timeout: 15000 }).catch(() => {})
      const 槽 = await text()
      ok(槽.includes('扫不出来？在这儿手输编号'), '长屏上有「手输编号」那一槽')

      /* 先填一串对不上的：话要说清是哪一种情况，不是一句「失败」。 */
      await p.locator('.manual-input').fill('NOT-A-REAL-CODE')
      await p.getByText('唤醒', { exact: true }).click()
      await p.waitForFunction(() => !!globalThis.__router.current().data.codeErr,
                              null, { timeout: 15000 }).catch(() => {})
      const 错话 = await p.evaluate(() => globalThis.__router.current().data.codeErr)
      ok(/对不上任何一枚御守/.test(错话 || ''), '认不出那串字时说得清是哪一种情况', String(错话))

      /* 再填一串真的。这一下把婆婆请回家 —— 也就是把上面那条提示消掉。 */
      const 真码 = await mintCredential('popo')
      await p.locator('.manual-input').fill('')
      await p.locator('.manual-input').fill(真码)
      await p.getByText('唤醒', { exact: true }).click()
      await p.waitForFunction(
        () => globalThis.__router.current().__route === 'pages/moved/index',
        null, { timeout: 15000 },
      ).catch(() => {})
      ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/moved/index',
         '手输编号也开得出「他住进来了」那一屏　—— 跟扫码走同一条路',
         await p.evaluate(() => globalThis.__router.current().__route))
      await p.setViewportSize({ width: 375, height: 667 })

      /* ── 一单那一屏的主按钮（设计册 M3）───────────────────────
         10.8 特别点名的一条：**订单的完成态不是「已签收」，是她住进村里**。
         包裹到了、人没住进来，这一单就停在半路 —— 而催归催，
         点进单子却没有出口的话，这条链还是断的。 */
      /* 自己种一单，用【另一位】：上面手输那一下已经把婆婆请回家了，
         拿同一单来验，`to_scan` 本该是 false —— 而它是 false 看着就像功能没做。 */
      const sku2 = sql1("SELECT id FROM sku WHERE villager_id='tenz' LIMIT 1")
      run([
        `INSERT INTO order_record(id,user_id,channel_origin,currency,`
        + `amount_subtotal_minor,amount_total_minor,amount_paid_minor,status,`
        + `source_kind,region,paid_at) VALUES ('ord-m3-${尾}','${我是谁}','mini','CNY',`
        + `9900,9900,9900,'paid','one_shot','cn',NOW()) ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO order_line(id,order_id,line_no,sku_id,sku_snapshot_json,`
        + `unit_price_minor,qty,line_subtotal_minor) VALUES ('ol-m3-${尾}','ord-m3-${尾}',1,`
        + `'${sku2}','{"sku_name":"御守"}'::jsonb,9900,1,9900) ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO shipment(id,order_id,carrier_code,tracking_no,status,delivered_at)`
        + ` VALUES ('shp-m3-${尾}','ord-m3-${尾}','manual','M3-${尾}','delivered',NOW())`
        + ` ON CONFLICT (id) DO NOTHING`,
      ].join('; '))
      await p.setViewportSize({ width: 390, height: 844 })   // 槽在矮屏收起，先在长屏看它
      await open('pages/order/index', { id: 'ord-m3-' + 尾 })
      await p.waitForFunction(() => globalThis.__router.current().data.toScan === true,
                              null, { timeout: 15000 }).catch(() => {})
      ok(await p.evaluate(() => globalThis.__router.current().data.toScan) === true,
         '这一单里有没扫开的御守时，单子那一屏知道',
         String(await p.evaluate(() => globalThis.__router.current().data.toScan)))
      const 单屏 = await text()
      await shot('12-一单')
      ok(单屏.includes('收到了，去扫开它'), '主按钮是「收到了，去扫开它」')
      /* 标题是买的那个东西，不是状态词（设计册 M3 线框）。
         原先大字写着「已付」，而买的是什么要往下看一块。 */
      const 单头 = await p.evaluate(() => ({
        title: (document.querySelector('.hd .title') || {}).innerText || '',
        sub: (document.querySelector('.hd .sub') || {}).innerText || '',
      }))
      ok(单头.title && !/^(待付|已付|完成|已取消|备着)$/.test(单头.title.trim()),
         '一单的标题是买的那个东西，不是状态词', 单头.title)
      ok(/下单/.test(单头.sub) && /(待付|已付|完成|备着)/.test(单头.sub),
         '金额、日期、状态并成一行', 单头.sub)
      ok(单屏.includes('那才是这单真正完成'), '槽里说清了这一单什么时候才算完')
      /* 主按钮不在槽里 —— 它是这一屏的主按钮，矮屏上也必须在。
         把它放进槽等于说「放不下就算了」，而这一下正是整条链最要紧的一步。 */
      await p.setViewportSize({ width: 375, height: 667 })
      await p.waitForTimeout(400)
      const 矮屏 = await p.evaluate(() => {
        const 有 = (t) => [...document.querySelectorAll('button, view, text')]
          .some((e) => e.innerText && e.innerText.trim() === t)
        const 槽 = document.querySelector('.slot-done')
        return { 主按钮在: 有('收到了，去扫开它'),
                 槽收了: !槽 || getComputedStyle(槽).display === 'none' }
      })
      ok(矮屏.主按钮在, '矮屏上主按钮照样在　—— 它不在槽里')
      ok(矮屏.槽收了, '矮屏上那一句槽收起了')
      await p.setViewportSize({ width: 390, height: 844 })

      /* 从这一屏手输编号也走得通 —— 出口不能只是一句话。
         用的是同一支 `utils/omamori`，所以两屏说的是同一句话。 */
      const 单码 = await mintCredential('tenz')
      await p.locator('.wake-input').fill(单码)
      await p.getByText('唤醒', { exact: true }).click()
      await p.waitForFunction(
        () => globalThis.__router.current().__route === 'pages/moved/index',
        null, { timeout: 15000 },
      ).catch(() => {})
      ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/moved/index',
         '单子那一屏上手输编号，也开得出「他住进来了」',
         await p.evaluate(() => globalThis.__router.current().__route))

      /* 唤醒之后回到那一单：主按钮该没了 —— 这一单到这儿才算真的完成。 */
      await open('pages/order/index', { id: 'ord-m3-' + 尾 })
      await p.waitForFunction(() => globalThis.__router.current().data.toScan === false,
                              null, { timeout: 15000 }).catch(() => {})
      ok(await p.evaluate(() => globalThis.__router.current().data.toScan) === false,
         '扫开之后单子上那颗主按钮就没了',
         String(await p.evaluate(() => globalThis.__router.current().data.toScan)))
      await p.setViewportSize({ width: 375, height: 667 })

      /* ── 不是御守的东西，不许催扫 ─────────────────────────────
         判据里「是御守」那一问不能省。只问「这件东西挂在哪位村民名下」的话，
         **任何一件长在某人身上的商品**都会触发催扫 —— 而「东西长在卖它的人
         身上」正是这个产品要做的事，也就是说这类商品迟早会有。
         2026-08-27 拿一盒「苏合的香」实测过：包裹一签收，村子就催你去扫，
         而香上根本没有码。这里把那个反例钉住。 */
      run([
        `INSERT INTO product(id,code,name,category,kind,status,fulfillment_kind)`
        /* status 用 draft：这一件只是用来验「不是御守的东西不催扫」，
           判据不看 status。上架的话它会混进真目录 —— 2026-08-27 真混过一次，
           村民页上苏合卖的成了「校验·香」。校验用的数据不该长得像真数据。 */
        + ` VALUES ('prod-verify-incense','verify_incense','校验·香','charm','one_shot',`
        + `'draft','shipping') ON CONFLICT (id) DO UPDATE SET status='draft'`,
        `INSERT INTO sku(id,product_id,code,name,villager_id,stock_kind,default_currency)`
        + ` VALUES ('sku-verify-incense','prod-verify-incense','verify_inc','校验香','suhe',`
        + `'unlimited','CNY') ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO order_record(id,user_id,channel_origin,currency,`
        + `amount_subtotal_minor,amount_total_minor,amount_paid_minor,status,`
        + `source_kind,region,paid_at) VALUES ('ord-inc-${尾}','${我是谁}','mini','CNY',`
        + `2900,2900,2900,'paid','one_shot','cn',NOW()) ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO order_line(id,order_id,line_no,sku_id,sku_snapshot_json,`
        + `unit_price_minor,qty,line_subtotal_minor) VALUES ('ol-inc-${尾}','ord-inc-${尾}',1,`
        + `'sku-verify-incense','{"sku_name":"校验香"}'::jsonb,2900,1,2900)`
        + ` ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO shipment(id,order_id,carrier_code,tracking_no,status,delivered_at)`
        + ` VALUES ('shp-inc-${尾}','ord-inc-${尾}','manual','INC-${尾}','delivered',NOW())`
        + ` ON CONFLICT (id) DO NOTHING`,
      ].join('; '))
      await open('pages/order/index', { id: 'ord-inc-' + 尾 })
      await p.waitForTimeout(1500)
      ok(await p.evaluate(() => globalThis.__router.current().data.toScan) === false,
         '买一盒香、包裹到了，单子上不说「去扫开它」　—— 香上没有码',
         String(await p.evaluate(() => globalThis.__router.current().data.toScan)))

      /* 另一半：扫开之后它就该消失。只验「出现」的话，
         一个永远挂着的提示也能全绿 —— 而常驻的提示正是设计要避免的那个。 */
      // 婆婆刚刚被手输那一下请回家了 —— 不用再种 residency，那才是真路径
      await open('pages/village/index')
      await p.waitForFunction(() => globalThis.__router.current().data.toScan === false,
                              null, { timeout: 15000 }).catch(() => {})
      ok(await p.evaluate(() => globalThis.__router.current().data.toScan) === false,
         '扫开之后那一条就没了　—— 只在该出现时出现',
         String(await p.evaluate(() => globalThis.__router.current().data.toScan)))
    }
  }

  /* ── 那一册（设计册 M2「看 ›」的落点）──────────────────────
     ¥199 的报告在这之前是这样的：付了钱，行标 done，`fulfillment_ref`
     写一句 `{"mocked": true}` —— 订单显示「已完成」，而买家手上什么都没有。

     这一段验的是「拿得到」：从单子上点得进去、六页翻得动、每一页写得出
     自己的数是哪儿来的。翻页是这一页的全部，所以**每个翻法都真按一遍** ——
     页签、下一页、上一页各按到，不然那几个处理器会靠从不运行保持绿色。 */
  if (册们.ready) {
    // 一 · 从单子上点进去。册子是这一单的货，不是一行附注
    await open('pages/order/index', { id: 册们.ready.order })
    await p.waitForFunction(() => !!globalThis.__router.current().data.report,
                            null, { timeout: 15000 }).catch(() => {})
    const 单上 = await text()
    ok(单上.includes('读你的那一册'), '买了报告的单子上，主按钮是「读你的那一册」')
    await p.getByText('读你的那一册', { exact: true }).click()
    await p.waitForFunction(() => globalThis.__router.current().__route === 'pages/report/index',
                            null, { timeout: 15000 }).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/report/index',
       '从单子上点得进那一册',
       await p.evaluate(() => globalThis.__router.current().__route))

    // 二 · 头一页是四柱，而且是【真盘】—— 干支不是占位符
    await p.waitForFunction(() => (globalThis.__router.current().data.tabs || []).length > 0,
                            null, { timeout: 15000 }).catch(() => {})
    const 册 = await p.evaluate(() => globalThis.__router.current().data)
    ok((册.tabs || []).length >= 4, '这一册翻得出好几页', String((册.tabs || []).length))
    ok(册.page &&册.page.key === 'pillars', '头一页是四柱', 册.page && 册.page.key)
    const 柱 = (册.page && 册.page.pillars) || []
    ok(柱.length === 4 && 柱.every((x) => /^[\u4e00-\u9fa5]{2}$/.test(x.ganzhi)),
       '四根柱子都是真干支　—— 不是占位',
       柱.map((x) => x.ganzhi).join(' '))
    ok(柱.some((x) => (x.hidden || []).length > 0), '藏干也在　—— 后面几页都从这儿来')

    // 三 · 每一页都写得出自己的数是哪儿来的（设计册 10.8）。
    //      一页没有出处，读的人就没法追 —— 那就跟编的没区别
    let 缺出处 = []
    for (let i = 0; i < 册.tabs.length; i++) {
      await p.evaluate((k) => globalThis.__router.current().show(k), i)
      const pg = await p.evaluate(() => globalThis.__router.current().data.page)
      if (!pg || !pg.source) 缺出处.push(pg ? pg.title : '第' + i + '页')
    }
    ok(缺出处.length === 0, '每一页都写着这一页的数出自哪儿', 缺出处.join(' '))

    // 四 · 翻页三种走法各按一遍
    await p.evaluate(() => globalThis.__router.current().show(0))
    await p.getByText('下一页 ›', { exact: true }).click()
    await p.waitForTimeout(200)
    ok(await p.evaluate(() => globalThis.__router.current().data.at) === 1,
       '「下一页」翻得动', String(await p.evaluate(() => globalThis.__router.current().data.at)))
    await p.getByText('‹ 上一页', { exact: true }).click()
    await p.waitForTimeout(200)
    ok(await p.evaluate(() => globalThis.__router.current().data.at) === 0,
       '「上一页」翻得回来', String(await p.evaluate(() => globalThis.__router.current().data.at)))
    // 页签是这一页的价值所在:想看用神就点用神,不用一路翻过去
    const 末 = 册.tabs.length - 1
    await p.locator('.tab').nth(末).click()
    await p.waitForTimeout(200)
    ok(await p.evaluate(() => globalThis.__router.current().data.at) === 末,
       '点页名直接跳得过去　—— 不用一路翻',
       String(await p.evaluate(() => globalThis.__router.current().data.at)))
    await shot('20-那一册')

    // 五 · 大运那页要标出【现在走到哪一格】。十格干支谁都排得出，
    //      「你在这一格」才是买家要看的那一句
    const 大运 = 册.tabs.indexOf('大运')
    if (大运 >= 0) {
      await p.evaluate((k) => globalThis.__router.current().show(k), 大运)
      const rows = await p.evaluate(() => globalThis.__router.current().data.page.rows || [])
      ok(rows.some((r) => r.now === true), '大运那页标着现在走到哪一格',
         rows.map((r) => r.k + (r.now ? '←' : '')).join(' '))
    }
  }

  /* 另一半:册子还没出的那种。**一半的买家是这样** ——
     量过:async_compute 的行里只有 46% 的买家下单时已经有本命。
     所以这不是错误页,它要说清还差什么、去哪儿填。 */
  if (册们.awaiting_natal) {
    await open('pages/order/index', { id: 册们.awaiting_natal.order })
    await p.waitForFunction(() => !!globalThis.__router.current().data.report,
                            null, { timeout: 15000 }).catch(() => {})
    ok((await text()).includes('还差你的生辰'),
       '册子没出的单子上说得出还差什么　—— 不显示成「已完成」')
    await open('pages/report/index', { id: 册们.awaiting_natal.report })
    await p.waitForFunction(() => globalThis.__router.current().data.status === 'awaiting_natal',
                            null, { timeout: 15000 }).catch(() => {})
    const 等屏 = await text()
    ok(等屏.includes('这一册还差你的生辰'), '还没出的那一册，开出来说的是还差什么')
    ok(!等屏.includes('取不到') && !等屏.includes('出错'),
       '它不是一张错误页　—— 是这一单真实的状态')
    await shot('21-还差生辰')
    // 出路要真走得通:说了「去填」就得真的到得了填生辰那一屏
    await p.getByText('去填生辰', { exact: true }).click()
    await p.waitForFunction(() => globalThis.__router.current().__route === 'pages/natal/index',
                            null, { timeout: 15000 }).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/natal/index',
       '「去填生辰」真的到得了填生辰那一屏',
       await p.evaluate(() => globalThis.__router.current().__route))
  }
  // 收拾现场:上面停在填生辰那一屏,而下一段的 moveIn 要从村子那一屏起手。
  // 不回去的话它会等一颗不在这一屏上的按钮,三十秒后超时 —— 而报出来的
  // 是「点不到扫御守」,跟真的点不到长得一模一样
  await open('pages/village/index')

  /* ── 香在苏合家里卖，不在铺子里（设计册 H5 / 10.8）────────────
     「东西长在卖它的人身上」是这个产品的一条论点。在这之前它只有御守
     一个例证 —— 而御守的 villager_id 是「里面封的是谁」，不是「谁卖的」。
     这是第一个真正的「谁卖的」，所以整条路要真走一遍：
     她那一页 → 她配的那一味 → 三档价 → 确认页。 */
  await moveIn('suhe')                    // 人得先请回家：人没来，摊子不该摆在这儿
  await open('pages/villager/index', { id: 'suhe' })
  await p.waitForFunction(() => globalThis.__router.current().data.sells === true,
                          null, { timeout: 15000 }).catch(() => {})
  ok(await p.evaluate(() => globalThis.__router.current().data.sells) === true,
     '苏合那一页上有她卖的东西',
     String(await p.evaluate(() => globalThis.__router.current().data.sellsLabel)))
  /* 别人那一页不该冒出这颗按钮 —— 「谁卖东西」由后端说，页面不写死名单。 */
  await open('pages/villager/index', { id: 'ayun' })
  await p.waitForTimeout(900)
  ok(await p.evaluate(() => globalThis.__router.current().data.sells) === false,
     '不卖东西的那一位，页上没有这颗按钮')

  await open('pages/villager/index', { id: 'suhe' })
  await p.waitForTimeout(900)
  await p.getByText('苏合配的那一味', { exact: true }).click()
  await p.waitForFunction(
    () => globalThis.__router.current().__route === 'pages/incense/index',
    null, { timeout: 15000 },
  ).catch(() => {})
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/incense/index',
     '从她那一页点得进那一味', await p.evaluate(() => globalThis.__router.current().__route))

  await p.waitForFunction(() => (globalThis.__router.current().data.skus || []).length > 0,
                          null, { timeout: 15000 }).catch(() => {})
  const 香 = await p.evaluate(() => {
    const d = globalThis.__router.current().data
    return { 档: (d.skus || []).map((x) => x.name + ' ' + x.priceText), 那句: d.line }
  })
  ok(香.档.length === 3, '三档都在', 香.档.join(' · '))
  ok(香.档.some((t) => /¥29\b/.test(t)) && 香.档.some((t) => /¥128\b/.test(t))
     && 香.档.some((t) => /¥268\b/.test(t)),
     '价钱是设计册上那三档', 香.档.join(' · '))
  const 香屏 = await text()
  ok(香屏.includes('乳香 · 安息 · 桂'), '配方写着')
  /* 她那一句要按【你缺什么】来。这一趟没建本命，所以她该说不知道，
     **而不是编一句** —— 说错了比不说更伤。 */
  ok(!香.那句, '没建本命时她不编一句', String(香.那句 || '(空)'))
  ok(香屏.includes('先把生辰填了'), '而是说不知道，并给出口')

  await p.locator('.entry').first().click()
  await p.waitForFunction(
    () => globalThis.__router.current().__route === 'pages/confirm/index',
    null, { timeout: 15000 },
  ).catch(() => {})
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/confirm/index',
     '挑一档点得进确认那一屏', await p.evaluate(() => globalThis.__router.current().__route))
  await open('pages/incense/index', { id: 'prod-suhe-incense' })
  await p.waitForTimeout(1200)
  await shot('10-一味香')

  /* ── 同步点香（设计册 E1）─────────────────────────────────────
     这一屏一周只有二十五分钟能碰上，所以后端把「几点点香」做成了可配的
     （UNMEI_INCENSE_WEEKDAY / HOUR / MINUTES）—— 那不是测试后门，
     是运营本来就该能改的东西，顺带让它验得到。

     这里验的是【不到点】那一支：跑验证的这台机器上多半不是周四晚九点，
     而那正是设计册 10.7 说的那一条：**不做「本周还没开始」的占位页**。
     到点那一支要另起一个把时刻设成「现在」的实例，
     `bash scripts/verify-incense-night.sh` 一条命令跑完。 */
  const 今晚 = await p.evaluate(() => globalThis.__router.current().data.tonight)
  const 香屏2 = await text()
  if (今晚) {
    ok(香屏2.includes('一起点一支'), '今晚开着，那一槽是入口')

    /* 到点那一档（`scripts/verify-incense-night.sh` 走的就是这里）。
       它验的是这一屏【真的能用】：点得进、能点上、一人一次不叠加、
       没香的人有出口。 */
    await p.getByText('今晚九点已经开始了，一起点一支', { exact: true }).click()
    await p.waitForFunction(
      () => globalThis.__router.current().__route === 'pages/lighting/index',
      null, { timeout: 15000 },
    ).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/lighting/index',
       '那一槽点得进点香那一屏', await p.evaluate(() => globalThis.__router.current().__route))

    await p.waitForTimeout(1500)
    const 夜 = await text()
    ok(夜.includes('今晚一起点一支'), '这一屏说的是「今晚一起点一支」')
    ok(/已烧 \d\d:\d\d/.test(夜), '烧了多久在走', (夜.match(/已烧 \S+/) || [''])[0])
    /* 没有顶栏没有 tab —— 全屏时刻（设计册 10.2）。
       这一刻给任何导航都是打断。 */
    ok(await p.evaluate(() => {
      const bar = document.getElementById('wx-tabbar')
      return !bar || getComputedStyle(bar).display === 'none'
    }), '这一屏没有 tab 条　—— 全屏时刻')

    const 点前 = await p.evaluate(() => globalThis.__router.current().data.count)
    await p.getByText('我也点了', { exact: true }).click()
    await p.waitForFunction(() => globalThis.__router.current().data.iLit === true,
                            null, { timeout: 15000 }).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().data.iLit) === true,
       '点得上', String(await p.evaluate(() => globalThis.__router.current().data.count)))
    const 点后 = await p.evaluate(() => globalThis.__router.current().data.count)
    ok(点后 === (点前 || 0) + 1, '人数加了一个', `${点前} → ${点后}`)
    /* 一个人一场只算一次。连点十下不该变成十个人 —— 按钮点完就禁着，
       而且后端那一侧也拦（主键 + ON CONFLICT）。 */
    ok(await p.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((e) => /你点上了/.test(e.innerText))
      return !!b && b.disabled
    }), '点过之后那颗按钮就按不动了')

    /* 「我没有香」通到苏合那儿 —— 不推销，只放这一个出口。 */
    await p.getByText('我没有香', { exact: true }).click()
    await p.waitForFunction(
      () => globalThis.__router.current().__route === 'pages/incense/index',
      null, { timeout: 15000 },
    ).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/incense/index',
       '「我没有香」通到苏合那儿', await p.evaluate(() => globalThis.__router.current().__route))
    await open('pages/lighting/index')
    await p.waitForTimeout(1200)
    await shot('11-同步点香')
  } else {
    /* 那一槽在矮屏上是收起的（弹性槽），所以这一条要在长屏上看。
       在矮屏上读它，读到的永远是空 —— 那样这条断言测的是「槽收没收起」，
       不是「它是不是入口」。 */
    await p.setViewportSize({ width: 390, height: 844 })
    await open('pages/incense/index', { id: 'prod-suhe-incense' })
    await p.waitForTimeout(1500)
    const 长屏香 = await text()
    ok(长屏香.includes('周四晚九点'), '不到点时那一槽只是一句话，不是入口')
    await p.setViewportSize({ width: 375, height: 667 })
    /* 直接闯进那一屏也不该看到「大家在点」—— 这一屏不到点就不存在。 */
    await open('pages/lighting/index')
    await p.waitForTimeout(1600)
    ok(await p.evaluate(() => globalThis.__router.current().__route) !== 'pages/lighting/index',
       '不到点直接闯进点香那一屏，它自己退出去　—— 不做「还没开始」的占位页',
       await p.evaluate(() => globalThis.__router.current().__route))
  }

  await open('pages/village/index')
  await p.waitForTimeout(600)
}
const v = await p.evaluate(() => {
  const cv = document.querySelector('canvas')
  const g = cv.getContext('2d')
  const d = g.getImageData(0, 0, cv.width, 400).data
  let ink = 0
  for (let i = 3; i < d.length; i += 4) if (d[i]) ink++
  return { w: cv.width, h: cv.height, ink, plots: (globalThis.VILLAGE_PLOTS || []).length }
})
ok(v.w === 704 && v.h === 960, '画布是村子的尺寸', v.w + 'x' + v.h)
ok(v.ink > 100000, '村子真的画上去了', v.ink + ' 个不透明像素')
ok(v.plots === 40, '四十格宅基都在', String(v.plots))
const head = await text()
/* 收集数从头顶挪进了弹性槽（设计册 V1 就是这么排的），
   而槽在矮屏收起 —— 所以这一条要在长屏上看。
   在矮屏读它读到的永远是空，那样测的是「槽收没收起」，不是「数对不对」。 */
await p.setViewportSize({ width: 390, height: 844 })
await open('pages/village/index')
await p.waitForTimeout(1500)
const 槽文 = await text()
ok(/住着 \d+ 位 · 还空 \d+ 间/.test(槽文), '收集数来自服务端',
   (槽文.match(/住着 \S+ 位 · 还空 \S+ 间/) || ['没找到'])[0])
/* 头一眼是有人在跟你打招呼，而且【知道你现在几点】（设计册 10.8）。 */
ok(/(早上好|上午好|下午好|傍晚好|夜深了)/.test(槽文), '头一眼是一句问候',
   (槽文.match(/(早上好|上午好|下午好|傍晚好|夜深了)/) || [''])[0])
ok(/[一二三四五六七八九十]月[一二三四五六七八九十]+ · 周[一二三四五六日]/.test(槽文),
   '而且写着今天几号', (槽文.match(/[一二三四五六七八九十]月\S+ · 周./) || [''])[0])
await p.setViewportSize({ width: 375, height: 667 })
await shot('01-village')

// ③ 空宅基会说话,且不给问事 ─────────────────────────────────────
console.log('\n── 点一格空着的（桃桃还没请回家）──')
await tapPlot('tao')
await p.waitForTimeout(600)
/* 点中之后开一屏，不再摊卡片（docs/REDESIGN.md R2）。 */
ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/plot/index',
   '点一格空的，开的是空屋那一屏',
   await p.evaluate(() => globalThis.__router.current().__route))
const t1 = await text()
ok(t1.includes('这间空着'), '空屋说「这间空着」')
/* 说了还得【看得见】。这条检查有来由：卡片时代它排在村子图后面，
   而村子图比屏幕高 —— 2026-08-18 之前它永远落在屏幕外，点一格房子
   屏幕上什么都不动，而所有检查照样绿，因为 innerText 里读得到它。
   现在是独立一屏，但这条不能删 —— 换成「那句话真的在视口里」。 */
const 那句位置 = await p.evaluate(() => {
  const all = [...document.querySelectorAll('div')].filter((d) => d.innerText && d.innerText.includes('这间空着'))
  const el = all[all.length - 1]
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight }
})
ok(那句位置 && 那句位置.top < 那句位置.h && 那句位置.bottom > 0,
   '而且看得见　—— 在屏幕外的话，等于什么都没发生',
   那句位置 ? `top ${那句位置.top} / 视口 ${那句位置.h}` : '找不到那句话')
ok(!t1.includes('桃桃'), '空屋不说是谁的　—— 还没请回来的人，名字都不该知道')
ok(!t1.includes('问事'), '空屋不给「问事」　—— 那是设定不是权限')
await shot('02-empty')

/* 空屋说完那一句原先就没了 —— 一条死路。现在它给一个出口：
   「请一位来」→ 御守那一栏。它**不说是谁的**（还没请回来的人连名字都不该
   知道），所以只能把人带到目录去挑，不能直接指向某一位。 */
if (API) {
  await p.getByText('看看谁能来', { exact: true }).click()
  await p.waitForTimeout(1300)
  const 到 = await p.evaluate(() => globalThis.__router.current().__route)
  ok(到 === 'pages/invite/index', '空屋的「请一位来」通到「谁能来」', 到)
  /* 铺没了（docs/REDESIGN.md R3）：不再有「切到御守那一栏」这回事。
     **不断言「有货」** —— CI 的种子库只有 5 件商品、一件御守都没有，
     本机 8000 多件。断言有货等于断言「我这台机器上的数据」，CI 上必红。
     （同一个坑上面那段注释里已经写过一次，我还是踩了。）
     要验的是这一页在【两种数据形状下都说得对】：有货就列出来，
     没货就出空状态并指出哪儿能有。 */
  const 请 = await p.evaluate(() => {
    const c = globalThis.__router.current()
    return { n: c.data.items.length, err: c.data.err, loading: c.data.loading }
  })
  const 请文 = await text()
  ok(!请.loading && !请.err &&
     (请.n > 0 || 请文.includes('一位也没数到')),
     `「谁能来」说得对（${请.n > 0 ? '有 ' + 请.n + ' 位' : '一位没有 · 出空状态'}）`,
     `n=${请.n} err=${请.err}`)

  /* 四十位都在册上，没上架的照实说（设计册 10.8）。
     只列在卖的那几位，读的人会以为世上只有那几位 —— 那是拿别人顶上。
     **不断言「几位在卖」** —— 那是这台机器上的数据；断言的是
     「册上的人比在卖的多」与「多出来的那些写着未上架、按不动」。 */
  if (请.n > 0) {
    const 册 = await p.evaluate(() => {
      const it = globalThis.__router.current().data.items
      return { 共: it.length, 在卖: it.filter((x) => x.onSale).length }
    })
    ok(册.共 >= 册.在卖, '册上的人不比在卖的少', `${册.在卖} 在卖 / 共 ${册.共}`)
    if (册.共 > 册.在卖) {
      /* 翻到有「未上架」的那一页去看。在卖的排在前面，所以往后翻。 */
      const 页数2 = await p.evaluate(() => globalThis.__router.current().data.pageCount)
      let 看到未上架 = false
      for (let i = 0; i < 页数2; i++) {
        await p.evaluate((n) => globalThis.__router.current().gotoPage(n), i)
        await p.waitForTimeout(150)
        if ((await text()).includes('未上架')) { 看到未上架 = true; break }
      }
      ok(看到未上架, '没上架的也在册上，写着「未上架」', `${册.共 - 册.在卖} 位未上架`)
      /* 写着未上架就该按不动 —— 点了再说「买不了」是先答应再反悔。 */
      const 之前 = await p.evaluate(() => globalThis.__router.current().__route)
      const 那行 = p.locator('.item-off').first()
      if (await 那行.count()) {
        await 那行.click()
        await p.waitForTimeout(700)
        ok(await p.evaluate(() => globalThis.__router.current().__route) === 之前,
           '未上架那一行按不动　—— 不是点了再说买不了',
           await p.evaluate(() => globalThis.__router.current().__route))
      }
      await p.evaluate(() => globalThis.__router.current().gotoPage(0))
      await p.waitForTimeout(150)
    }
  }

  /* 空的那一支只有 CI 的种子库才碰得到（本机目录里御守上百件）。
     不改共用的库去造空态 —— 那影响面比预期大（docs/FINDING-2026-08-22-*）。
     直接把 items 清空，验模板确实说得出「哪儿能有」。 */
  await p.evaluate(() => globalThis.__router.current().setData({ items: [], loading: false, err: '' }))
  await p.waitForTimeout(200)
  const 空请 = await text()
  ok(空请.includes('一位也没数到') && 空请.includes('名册取不到'),
     '「谁能来」空的时候也说得出下一步 —— CI 的种子库就是这一支',
     空请.slice(0, 44))
  await open('pages/invite/index')

  /* 翻页：一页五位是「不上下滚动」那条约束的落点（设计 10.3），
     所以它得真的翻得动，不能只是画着两个按钮。 */
  const 页数 = await p.evaluate(() => globalThis.__router.current().data.pageCount)
  if (页数 > 1) {
    const 头一页 = await p.evaluate(() => globalThis.__router.current().data.page.map((x) => x.id).join())
    await p.getByText('下一页 ›', { exact: true }).click()
    await p.waitForTimeout(300)
    const 第二页 = await p.evaluate(() => globalThis.__router.current().data.page.map((x) => x.id).join())
    ok(第二页 !== 头一页 && await p.evaluate(() => globalThis.__router.current().data.pageNo) === 1,
       '「谁能来」翻得动 —— 一页五位，横着翻代替往下滚', `第 1 页 → 第 2 页`)
    await p.getByText('‹ 上一页', { exact: true }).click()
    await p.waitForTimeout(300)
    ok(await p.evaluate(() => globalThis.__router.current().data.pageNo) === 0, '翻得回来')
  } else {
    console.log(`  · 跳过翻页：这个库里只有 ${页数} 页（不计入通过）`)
  }

  /* 两屏的退路。死路是这条链上出现过两次的毛病 ——
     「说完就没了」跟「回不去」是同一种。
     这两条走的正是 `wx.navigateBack` 的 **fail 兜底**：直接开的页没有上一页，
     真机上会走 fail，页面靠它落到某个 tab。垫片原先不看参数、永远 resolve，
     于是这条兜底全 app 一次都没被走过（2026-08-23 修）。 */
  await open('pages/plot/index')
  await p.getByText('回村里', { exact: true }).click()
  await p.waitForTimeout(600)
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/village/index',
     '空屋那一屏回得去村里', await p.evaluate(() => globalThis.__router.current().__route))

  if (要参数['pages/villager/index']) {
    await open('pages/villager/index', 要参数['pages/villager/index'])
    await 等取完('pages/villager/index')
    await p.getByText('回村里', { exact: true }).click()
    await p.waitForTimeout(600)
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/village/index',
       '村民那一屏也回得去', await p.evaluate(() => globalThis.__router.current().__route))
  }

  await open('pages/village/index')
  await p.waitForTimeout(800)

  /* 另一处死路：点到「认识、还没住进来」的那位，原先卡片只写
     「还没住进你的村子」就完了。这一处**知道是谁**，所以直接找他的御守。

     改走真页面（docs/REDESIGN.md R2）：以前是在村主屏上把 `picked`
     摆成真实的形状再点按钮 —— 那验的是按钮的处理器，不是「这一屏长这样」。
     现在直接开那一位的屏，点它上面真的那颗按钮。

     两条都验：**有货的**走到商品详情，**没货的**照实说「还没上架」。
     村里 40 位只有几位有御守在卖，后一条才是常态。 */
  const 试 = async (id, 名) => {
    await open('pages/villager/index', { id })
    await 等取完('pages/villager/index')
    await p.getByText('请他来', { exact: true }).click()
    await p.waitForTimeout(1500)
    return {
      路由: await p.evaluate(() => globalThis.__router.current().__route),
      说: await p.evaluate(() => globalThis.__router.current().data.say || ''),
    }
  }
  /* 谁有货**问后端**，不写死。CI 的种子库只有 5 件商品、一件御守都没有，
     而本机有 500 多件 —— 写死 popo 的话本机绿、CI 红（2026-08-19 真红了一次，
     跟前面切分类那条是同一个坑）。 */
  const 有货的那位 = await p.evaluate(async (base) => {
    /* 还得【没住进来】—— 住进来的那一屏上是「问事／去他家坐坐」，
       根本没有「请他来」这颗按钮。这一趟前面刚把阿云与陈九请回了家，
       所以不能只看有没有货。先问一遍谁还在外面。 */
    const raw = localStorage.getItem('unmei:buwanren:token')
    const vr = await fetch(base + '/v1/village', {
      headers: raw ? { authorization: 'Bearer ' + JSON.parse(raw) } : {},
    })
    const 在外面 = new Set()
    if (vr.ok) {
      const vj = await vr.json()
      for (const x of vj.villagers || []) if (!x.at_home) 在外面.add(x.id)
    }
    for (const v of ['ayun', 'popo', 'shenyan', 'tenz']) {
      if (在外面.size && !在外面.has(v)) continue
      const r = await fetch(`${base}/v1/products?region=cn&platform=mini&category=omamori&villager_id=${v}`)
      if (!r.ok) continue
      const j = await r.json()
      if (Array.isArray(j) && j.length) return v
    }
    return null
  }, API)
  if (有货的那位) {
    const 有货 = await 试(有货的那位, '某位')
    ok(有货.路由 === 'pages/product/index',
       `「请他来」找到了 ${有货的那位} 的御守`, 有货.路由)
  } else {
    console.log('  · 跳过「有货那条」：这个库里没有任何御守在卖（不计入通过）')
  }

  /* 没货那一条任何库都成立：挑一个**确定没有**的。'tao' 在本机与 CI 都没有货，
     但也别假设 —— 先问一句，真有货就换一个说法。 */
  const tao有货 = await p.evaluate(async (base) => {
    const r = await fetch(`${base}/v1/products?region=cn&platform=mini&category=omamori&villager_id=tao`)
    if (!r.ok) return false
    const j = await r.json()
    return Array.isArray(j) && j.length > 0
  }, API)
  if (tao有货) {
    console.log('  · 跳过「没货那条」：桃桃这回真有货（不计入通过）')
  } else {
    const 没货 = await 试('tao', '桃桃')
    ok(没货.路由 === 'pages/villager/index' && 没货.说.includes('还没上架'),
       '没有御守在卖的那位，照实说「还没上架」', `${没货.路由} · ${没货.说}`)
  }
} else {
  console.log('  · 跳过「请一位来」与「请他来」：要真目录（不计入通过）')
}

// ④ 住着的那一格:问事出签 ───────────────────────────────────────
console.log('\n── 点一格住着的（阿云）──')
await tapPlot('ayun')
await 等取完('pages/villager/index')
ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/villager/index',
   '点一格住着的，开的是那一位那一屏',
   await p.evaluate(() => globalThis.__router.current().__route))
const t2 = await text()
ok(t2.includes('阿云'), '认出是谁')
/* 这一屏比原先那张卡片多说的，正是它存在的理由：**他缺什么**。
   「缺」是这个产品的身份字段，塞在两行的卡片里等于没说。 */
ok(t2.includes('他缺的是'), '说得出他缺什么　—— 卡片放不下的正是这一行', t2.slice(0, 40))
ok(t2.includes('问事'), '给「问事」')
ok(t2.includes('去他家坐坐'), '给「去他家坐坐」　—— 阿云那间房搬进来了')

/* 先按一下「回村里」再回来。下面那条同样的检查挂在「目录里有他的 sku」上,
   而这一趟没有 sku 时它整条跳过 —— 于是从村子点进来的这一支,
   回不回得去从来没人问过。这一支不需要 sku。 */
{
  await p.getByText('回村里', { exact: true }).click()
  await p.waitForTimeout(600)
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/village/index',
     '从村子点进那一位，按「回村里」回得去',
     await p.evaluate(() => globalThis.__router.current().__route))
  /* 回来之后等这一屏**真的又能用**,不是等它路由对了就算 ——
     村子那张画布重画要一会儿,点早了这一格还没在。 */
  for (let i = 0; i < 10; i++) {
    await tapPlot('ayun')
    await 等取完('pages/villager/index')
    const 在 = await p.evaluate(() => globalThis.__router.current().__route === 'pages/villager/index'
      && (document.getElementById('app').innerText || '').includes('问事'))
    if (在) break
    await open('pages/village/index')
    await p.waitForTimeout(500)
  }
}

await p.getByText('问事').click()
/* 等签真的落下来，不数毫秒。700ms 在负载高的机器上不够 ——
   报出来的是「出的不是阿云的口气」，而实际只是还没到。 */
await p.waitForFunction(
  () => !!(globalThis.__router.current().data.say || ''),
  null, { timeout: 20000 },
).catch(() => {})
const t3 = await text()
/* 断言签的【形状】,不断言某一句话。
   结论是从池子里按 seed 挑的,假服务端给「该动了」而真后端给「别再等了」——
   第一版照假服务端那句写死,打真后端就红了,而红的是断言不是产品。 */
const said = t3.slice(t3.indexOf('贫道'))
ok(t3.includes('贫道'), '出的是阿云的口气', said.slice(0, 24))
ok(said.includes('宜') && said.includes('忌'), '签里有宜有忌', said.slice(0, 40))
await shot('03-reading')

// ⑤ 住着但房间还没搬进来的 ──────────────────────────────────────
/* 「今天说的一句」那一块的高度，写死在 `village/index.ts` 的 `fitCanvas` 里
   （画布按可用高度铺，得知道上面被占了多少）。写死是刻意的 ——
   量完再改的收敛循环会把版式变成时序问题。

   但**写死的数写错了没人知道**：症状是「多一块就超出去几十像素」，
   而那几十像素正好等于差值。2026-08-28 头一版差 16px，
   村子那一屏超出去，画布被顶得点不准，连带 lighting 也报红。
   所以这里把常量和实测钉在一起。 */
{
  if (await p.evaluate(() => globalThis.__router.current().__route) !== 'pages/village/index') {
    await open('pages/village/index')
    await p.waitForTimeout(700)
  }
  const 实高 = await p.evaluate(() => {
    const e = document.querySelector('.says')
    return e ? Math.round(e.getBoundingClientRect().height) : -1
  })
  if (实高 < 0) {
    console.log('  · 「今天说的一句」这一趟没出现（村里还没人）—— 这一条【没验】')
  } else {
    const 写死的 = Number((readFileSync('mini/miniprogram/pages/village/index.ts', 'utf8')
      .match(/const 说的 = this\.data\.says \? (\d+) : 0/) || [])[1])
    ok(写死的 > 0 && Math.abs(实高 - 写死的) <= 2,
       'fitCanvas 里写死的那个数，跟「今天说的一句」实际占的一样高',
       `代码里 ${写死的}，实测 ${实高}`)
  }
}

console.log('\n── 点一格住着、但屋子还没搬进来的（陈九）──')
await tapPlot('chenjiu')
await 等取完('pages/villager/index')
const t4 = await text()
ok(t4.includes('陈九'), '认出是谁')
ok(t4.includes('屋子还没搬进来'), '明说屋子还没搬进来　—— 不装作能进')

// ⑥ 进屋 ────────────────────────────────────────────────────────
console.log('\n── 进屋 ──')
await tapPlot('ayun')
await 等取完('pages/villager/index')
await p.getByText('去他家坐坐', { exact: true }).click()
await p.waitForTimeout(2500)
const r2 = await p.evaluate(() => {
  const cv = document.querySelector('canvas')
  const g = cv.getContext('2d')
  const d = g.getImageData(0, 0, cv.width, 600).data
  let ink = 0
  for (let i = 3; i < d.length; i += 4) if (d[i]) ink++
  return { w: cv.width, h: cv.height, ink, title: document.title }
})
ok(r2.w === 1440 && r2.h === 2560, '房间画布是房间的尺寸', r2.w + 'x' + r2.h)
ok(r2.ink > 100000, '房间真的画上去了', r2.ink + ' 个不透明像素')
ok((await errScreen()) === '', '进屋没报错')

/* 屋里点物件有没有气泡、追问三次会不会松口 —— 这两条原本列在
   「只有真机能验」那一栏（见 mini/README），其实浏览器里就能验。

   靠的是引擎早就留下的钩子 `canvas.__hitAt`（它自己的注释写着为什么留），
   外加同一处新挂的 `__actorState` —— 气泡状态不外露的话，只能拿像素去猜，
   而屋里每帧都在动，猜不准。 */
const 可点的 = await p.evaluate(() => {
  const cv = document.querySelector('canvas')
  if (!cv.__hitAt) return null
  const out = []
  for (let y = 20; y < cv.height && out.length < 6; y += 20) {
    for (let x = 20; x < cv.width && out.length < 6; x += 20) {
      const h = cv.__hitAt(x, y)
      if (h && !out.some((o) => o.id === h.id)) out.push({ id: h.id, x, y })
    }
  }
  return out
})
ok(可点的 && 可点的.length > 0, '屋里有点得到的物件', 可点的 ? 可点的.length + ' 件（只取前几件）' : '没有 __hitAt 钩子')

/* 画布纵向是裁切的（设计 V5:「长屏往上下各露出更多房间」）,
   所以要问裁掉的那两条里有没有点不到的东西 —— 一件物件整个落在带子外面,
   它就等于不存在,而屋子照样画得出来、动得起来,上面每一条都绿。
   拿最矮的机器问,因为裁得最多的就是它。 */
{
  await p.setViewportSize({ width: 375, height: 667 })
  await p.waitForTimeout(400)
  const 裁 = await p.evaluate(() => {
    const cv = document.querySelector('canvas')
    if (!cv.__hitAt) return null
    const st = cv.parentElement.getBoundingClientRect()
    const cr = cv.getBoundingClientRect()
    // 可见带子换算回画布坐标
    const 顶 = Math.max(0, (st.top - cr.top) * cv.height / cr.height)
    const 底 = Math.min(cv.height, (st.bottom - cr.top) * cv.height / cr.height)
    const 范围 = {}
    for (let y = 8; y < cv.height; y += 16) {
      for (let x = 8; x < cv.width; x += 16) {
        const h = cv.__hitAt(x, y)
        if (!h) continue
        const r = 范围[h.id] || (范围[h.id] = { lo: y, hi: y })
        if (y < r.lo) r.lo = y
        if (y > r.hi) r.hi = y
      }
    }
    const 看不见 = Object.entries(范围)
      .filter(([, r]) => r.hi < 顶 || r.lo > 底)
      .map(([id, r]) => `${id}(${Math.round(r.lo)}~${Math.round(r.hi)})`)
    return { 件数: Object.keys(范围).length, 顶: Math.round(顶), 底: Math.round(底), 看不见 }
  })
  await p.setViewportSize({ width: 390, height: 844 })
  if (!裁) {
    console.log('  · 没有 __hitAt 钩子，裁切这一条验不了（不计入通过）')
  } else {
    ok(裁.看不见.length === 0,
       '最矮的机器上，屋里每件物件都还够得着　—— 裁掉的两条里不能藏东西',
       `${裁.件数} 件 · 可见带 ${裁.顶}~${裁.底} · 落在带外的：${裁.看不见.join(' ') || '没有'}`)
  }
}

/** 在画布坐标 (x,y) 上点一下 —— 画布是 1440 宽，屏幕上不是 */
const tapCanvas = async (x, y) => {
  const at = await p.evaluate(({ x, y }) => {
    const cv = document.querySelector('canvas')
    const r = cv.getBoundingClientRect()
    return { cx: r.left + x * r.width / cv.width, cy: r.top + y * r.height / cv.height }
  }, { x, y })
  await p.mouse.click(at.cx, at.cy)
  await p.waitForTimeout(250)
}
const 气泡 = () => p.evaluate(() => {
  const s = document.querySelector('canvas').__actorState
  return s && s.said ? s.said.text : ''
})

if (可点的 && 可点的.length) {
  await tapCanvas(可点的[0].x, 可点的[0].y)
  const 第一句 = await 气泡()
  ok(第一句.length > 0, '点下去他会说话', 第一句.slice(0, 18) || '(没说)')

  /* 追问：同一件反复点，说不出真话的人问到第三次会松口。
     逐件试，至少有一件肯松口就算数 —— 钉死某一件的话，
     内容一改这条就红，而红的是检查不是产品。 */
  let 松口 = ''
  for (const it of 可点的) {
    await tapCanvas(it.x, it.y)
    const a1 = await 气泡()
    await tapCanvas(it.x, it.y)
    await tapCanvas(it.x, it.y)
    const a3 = await 气泡()
    if (a1 && a3 && a1 !== a3) { 松口 = `${it.id}：${a1.slice(0, 10)}… → ${a3.slice(0, 14)}…`; break }
  }
  ok(!!松口, '追问三次，总有一件肯松口', 松口 || '试过的都没改口')
}
/* 表演按钮的文案会不会变 —— 这条也列在「只有真机能验」那一栏（mini/README），
   同样不是：按钮是页面上的一颗，文案由房间脚本改，两边都在浏览器里跑。
   一来一回都验：只验「变了」的话，变完回不去也算过。 */
const castLabel = () => p.evaluate(() => globalThis.__router.current().data.castLabel)
const 起课前 = await castLabel()
if (起课前) {
  await p.getByText(起课前, { exact: true }).click()
  await p.waitForTimeout(700)
  const 起课后 = await castLabel()
  ok(起课后 && 起课后 !== 起课前, '按下表演按钮，文案跟着变', `${起课前} → ${起课后}`)
  await p.getByText(起课后, { exact: true }).click()
  await p.waitForTimeout(800)
  ok((await castLabel()) === 起课前, '再按一下收得回去', 起课后 + ' → ' + (await castLabel()))
} else {
  ok(false, '按下表演按钮，文案跟着变', '这间房没有表演按钮')
}
/* 退出之后还烧不烧帧。屋里在动是应该的,离开之后还在动就是白耗电 ——
   页面 onUnload 要叫停 mountRoom 给的那个 handle。
   走的是【不动的那一页】(今日),否则村主屏自己的循环会混进来。 */
await p.evaluate(() => { globalThis.__raf = 0 })
await p.waitForTimeout(1000)
const 屋里帧 = await p.evaluate(() => globalThis.__raf)
ok(屋里帧 > 10, '屋里在动', 屋里帧 + ' 次/秒')
await p.evaluate(() => globalThis.__router.open('pages/home/index', {}, 'switchTab'))
await p.waitForTimeout(400)
await p.evaluate(() => { globalThis.__raf = 0 })
await p.waitForTimeout(1200)
const 离开后 = await p.evaluate(() => globalThis.__raf)
ok(离开后 === 0, '退出之后不再烧帧', 离开后 + ' 次（该是 0）')
await open('pages/room/index', { room: 'ayun' })
await shot('04-room')

// ⑦ 冷启动那一下 ───────────────────────────────────────────────
/* 匿名登录是异步的。页面 onShow 立刻取一次,那时 token 还没落地 —— 后端给 401;
   登录一回来 onAuthReady 再叫一次。第二次常常撞在第一次【还没走完 finally】
   的那一瞬,而防重入的闸门会把它直接扔掉,页面从此停在「取不到本命」,
   切一次 tab 才自愈。(实测:78ms 登录 200 → 80ms 请求 401 → 81ms onAuthReady 到。)

   这一条只在打真后端时有意义:假服务端没有匿名登录,也就没有那一下。 */
if (API) {
  console.log('\n── 冷启动：第一次还在飞的时候又叫了一次 ──')
  errs.length = 0
  await open('pages/natal/index')

  /* 直接钉【机制】,不去赌那个时序。

     第一版是「打开页面,看 err 是不是空的」—— 而那条只在两件事撞上的那一瞬才红:
     把修复删掉重跑,它照样绿。**一条只在时序对上时才红的检查比没有更糟**,
     它平时全绿,偶尔为了没人复现得了的理由红一次。

     这里改成:趁第一次请求还没回来再叫一次,数一数总共发了几次。
     被扔掉就是 1 次,补上了就是 2 次。 */
  let 请求数 = 0
  const 数请求 = (r) => { if (r.url().includes('/v1/user/natals')) 请求数++ }
  p.on('request', 数请求)
  await p.evaluate(() => {
    const c = globalThis.__router.current()
    c.loadDefault()          // 第一次,不等它
    c.loadDefault()          // 撞上去
  })
  await p.waitForTimeout(1500)
  p.off('request', 数请求)
  ok(请求数 >= 2, '第二次没被防重入的闸门扔掉', 请求数 + ' 次请求（被扔掉就是 1 次）')
  ok((await p.evaluate(() => globalThis.__router.current().data.err)) === '',
     '页面没停在「取不到本命」',
     (await p.evaluate(() => globalThis.__router.current().data.err)) || '(干净)')
}

// ⑧ 表单填得进去 ───────────────────────────────────────────────
/* 小程序的 setData 键可以是【路径】,本命页与我页一共七处这么写。
   垫片如果直接 Object.assign,会造出一个名字里带点的键,而 {{form.date}}
   读的是嵌套值 —— 于是表单看着没反应,不报错也不告警。
   镜像在这一点上骗人的话,建本命这条核心动线的验证就完全不作数,
   所以这里连着走一遍:点下去 → 页面自己的 handler → setData 路径 → 渲染。 */
console.log('\n── 本命页的表单（setData 用的是路径写法）──')
errs.length = 0
await open('pages/natal/index')
await p.evaluate(() => globalThis.__router.current().setData({ mode: 'form' }))
await p.waitForTimeout(300)

await p.getByText('坤/F').click()
await p.waitForTimeout(200)
const g = await p.evaluate(() => {
  const pg = globalThis.__router.current()
  return { 值: pg.data.form && pg.data.form.gender,
           假键: Object.keys(pg.data).filter((k) => k.includes('.')),
           /* 【哪一个】选中,不是「有没有选中的」—— 乾/M 本来就亮着,
              问后者的话,值根本没写进去时它照样是绿的（变异测过） */
           选中: [...document.querySelectorAll('.seg-item.on')].map((e) => e.textContent.trim()).join(' ') }
})
ok(g.值 === 'F', '点「坤/F」写进了 form.gender', String(g.值))
ok(g.假键.length === 0, '没造出名字里带点的假键', g.假键.join(' ') || '一个都没有')
ok(g.选中 === '坤/F', '亮起来的正是「坤/F」　—— 值写对了但渲染没跟上也是白搭', g.选中 || '一个都没亮')

/* 真填那个选择器,不绕过它调 handler ——
   picker 曾被渲成一个点不动的方块,而绕过去调 handler 的检查照样是绿的。
   这一条现在从「点得动吗」一路验到「页面上看得见吗」。 */
const dp = p.locator('input[data-picker="date"]')
const 有选择器 = await dp.count() === 1
ok(有选择器, 'picker 是真能点的原生选择器,不是个方块', String(await dp.count()))
if (有选择器) {
  await dp.fill('1998-03-05')
  await p.waitForTimeout(200)
  ok((await text()).includes('1998-03-05'), '选了日子,页面上就看得见', '{{form.date}}')
  ok(await p.evaluate(() => globalThis.__router.current().data.form.date) === '1998-03-05',
     '选择器发的是小程序那个形状的事件', 'detail.value → form.date')
} else {
  // 没有选择器就别去填它 —— 那会卡满三十秒再抛一段栈,
  // 门禁失败该看得懂,不该看着像它自己坏了
  ok(false, '选了日子,页面上就看得见', '选择器都不在,没得填')
  ok(false, '选择器发的是小程序那个形状的事件', '同上')
}

/* 时间那个选择器 —— 跟日期是同一个构造，却从来没人点过它。
   2026-08-18 加的：运行时开始记「哪些处理器真被调用过」之后，
   `natal·onTime` 赫然在「一次都没碰过」那一列里，而 picker 这个东西
   在这个镜像里坏过两次（先渲成点不动的方块，后是冒泡把值冲掉）。 */
const tp = p.locator('input[data-picker="time"]')
const 有时间选择器 = await tp.count() === 1
ok(有时间选择器, '时辰也是真能点的选择器', String(await tp.count()))
if (有时间选择器) {
  await tp.fill('07:30')
  await p.waitForTimeout(200)
  ok(await p.evaluate(() => globalThis.__router.current().data.form.time) === '07:30',
     '选了时辰，写进了 form.time', 'detail.value → form.time')
} else {
  ok(false, '选了时辰，写进了 form.time', '选择器都不在，没得填')
}

// 性别那两格：「坤/F」验过了，「乾/M」没有 —— 它们是两个 handler
await p.getByText('乾/M').click()
await p.waitForTimeout(200)
const gm = await p.evaluate(() => ({
  值: globalThis.__router.current().data.form.gender,
  选中: [...document.querySelectorAll('.seg-item.on')].map((e) => e.textContent.trim()).join(' '),
}))
ok(gm.值 === 'M', '点「乾/M」写进了 form.gender', String(gm.值))
ok(gm.选中 === '乾/M', '亮起来的正是「乾/M」', gm.选中 || '一个都没亮')

// 备注那一栏走 bindinput，跟上面几个不是一条路
const lab = p.locator('.field-input').first()
if (await lab.count() === 1) {
  await lab.fill('镜像验的')
  await p.waitForTimeout(200)
  ok(await p.evaluate(() => globalThis.__router.current().data.form.label) === '镜像验的',
     '备注打进了 form.label', 'bindinput → form.label')
}

/* 建本命 —— 填完真的按下去。

   这一段要的不只是真后端,还要【排盘服务】(mingli,在另一个仓库):
   用神是它算的。CI 上没有它,所以那里跑不了这一段。

   不给它做个假的:假服务会按我【以为的】形状回话,
   而 2026-08-18 抓到的那个 bug 恰恰是「我以为的形状」错了
   (性别发 M,它只认 male)—— 假服务会把这种错原封不动地盖住。

   所以:给了 --mingli 就真验,没给就【明说跳过】,不计入通过。 */
if (API && MINGLI) {
  const alive = await fetch(MINGLI).then(() => true).catch(() => false)
  if (!alive) { console.log(`✗ 说了有排盘服务(${MINGLI})却连不上`); process.exit(1) }
}
if (API && !MINGLI) {
  console.log('\n── 建本命 ──')
  console.log('  · 跳过：这台机器上没有排盘服务（用神由它算）。')
  console.log('    本机加 --mingli=http://127.0.0.1:6027 就会真验这一段。')
}
if (API && MINGLI) {
  console.log('\n── 建本命（真的按下「算一算」）──')

  /* 「会得到这些」（设计册 10.8 点名的一条）：填生辰是这条链上最贵的一步，
     先说清换回什么，才有人愿意填。

     **这四行不是文案，是四件真做得到的事** —— 所以这里不只验它写着，
     还要验它没有把做不到的事写上去：
       · 你缺的 / 伤你的  → 算完就在这一屏上（下面那几条断言正是它们）
       · 每天那一句      → 「谁能来」顶上那句「你缺 X，这几位跟你补得上」
       · 苏合配的香      → 她那一屏按你缺的说的那句话
     哪天某一条不成立了，这一行就得删；先答应做不到的事，比不答应更伤。 */
  const 会得到 = await text()
  ok(会得到.includes('会得到这些'), '算之前先说清换回什么')
  for (const 一行 of ['你缺的', '伤你的', '每天那一句', '苏合配的香']) {
    ok(会得到.includes(一行), `「会得到这些」里写着「${一行}」`, 一行)
  }

  await p.getByText('算一算', { exact: true }).click()
  await p.waitForFunction(() => globalThis.__router.current().data.mode === 'summary', null,
                          { timeout: 20000 }).catch(() => {})
  const n = await p.evaluate(() => {
    const d = globalThis.__router.current().data
    return { mode: d.mode, id: d.natal && d.natal.id, ys: d.summary && d.summary.primary_yongshen }
  })
  ok(n.mode === 'summary', '生成完就换到本命那一屏', n.mode)
  ok(!!n.id, '这一份本命有了自己的编号　—— 后端真存下了', n.id || '没有')
  ok(!!n.ys, '排出了用神', n.ys || '空的')
  await shot('06-natal')

  /* 有了本命,再问一签 —— 这一签背后该有【真盘】。
     盘不外露(响应里没有这一栏),只落档,所以这条要查库。

     为什么非查不可:2026-08-18 之前它一直是空的。发给排盘服务的请求带的是
     natal_id,而它只认生辰,于是每次 422、每一签落空盘 —— 库里 84 条问签,
     80 条的盘是 null。前端一切正常,没有任何一处会红。

     先把这个用户今天的阿云签删掉:同一位同一天的签是有缓存的,不删的话
     再点「问事」拿到的是刚才那一条 —— 那时候还没本命,空盘是如实的结果,
     后端根本不会去取盘(日志里连一行都不会有)。删掉才是真的再问一次。
     这是【测试夹具】,跟发御守凭据一样,写在这里、看得见。 */
  const uid = sql1("SELECT user_id FROM villager_reading ORDER BY asked_at DESC LIMIT 1")
  run(`DELETE FROM villager_reading WHERE user_id='${uid}' AND villager_id='ayun'`)
  /* 建完本命，「今」那一页该有内容了 —— 它整页的意义就是「今日与本命对照」，
     而在这之前它只会劝你去建本命。这一段以前没验:那一页开得起来就算过。 */
  await open('pages/home/index')
  const 今 = await text()
  ok(今.includes('主用神'), '今日页出现了「主用神」那一行　—— 对照有内容了', 今.slice(0, 46))
  ok(!今.includes('先输入生辰'), '不再劝你去建本命　—— 你刚建过')


  await open('pages/village/index')
  await tapPlot('ayun')
  await p.getByText('问事').click()
  await p.waitForTimeout(1500)
  const 最近 = sql1("SELECT villager_id || ' | ' || coalesce(chart_json::text,'null') FROM villager_reading ORDER BY asked_at DESC LIMIT 1")
  const 盘 = 最近.split(' | ').slice(1).join(' | ')
  ok(盘 !== 'null' && 盘.length > 20, '有本命之后,签背后是真盘', 最近.slice(0, 40) + '…')
}

// ⑩ 起卦 ───────────────────────────────────────────────────────
/* 产品的核心交互,而验证以前只【打开】这一页就算过。
   摇手机在无头浏览器里发生不了(那台机器不会动),但这一页写的是
   「点击中心 · 或摇手机」—— 点这条路真机与网页版是同一条,验得了。

   打假服务端时只验到「点下去真的开始转」;打真后端时一路验到落卦。 */
/* 今日页那个空状态上的「输入生辰」。它只在没有本命时出现，而跑到这里
   多半已经建过了 —— 所以自己把前提摆出来，再点。
   （不摆前提的话，这一条会在有本命的轮次里静静地什么都没验。） */
await open('pages/home/index')
/* 空状态的条件是【没有 summary 且没有 err】—— 不是 natal 为空。
   我第一版按 natal 摆前提，按钮根本不出现，而失败信息只说「按钮不在」。 */
await p.evaluate(() => globalThis.__router.current().setData({ summary: null, natal: null, loading: false, err: '' }))
await p.waitForTimeout(300)
/* exact 是必须的：旁边那句提示里也含这几个字，
   不加就同时命中两个，然后失败信息写着「按钮不在」—— 它明明在。
   2026-08-23：空态从两块合成一块（两块原先在说同一件事），
   按钮文案随之从「输入生辰」改成「先填生辰」。 */
const 去建 = p.getByText('先填生辰', { exact: true })
if (await 去建.count() === 1) {
  await 去建.click()
  await p.waitForFunction(
    () => globalThis.__router.current().__route === 'pages/natal/index',
    null, { timeout: 15000 },
  ).catch(() => {})
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/natal/index',
     '空的我家上按「先填生辰」，去的是填生辰那一页',
     await p.evaluate(() => globalThis.__router.current().__route))
} else {
  ok(false, '空的我家上按「先填生辰」，去的是填生辰那一页',
     `按钮不在（找到 ${await 去建.count()} 个）`)
}

/* 「重建生辰」——只在【已经有本命】的时候在，所以放在建完之后。
   它把这一页切回表单，而这条路径从没被走过（切表单一直是 setData 塞的）。 */
await open('pages/natal/index')
await p.waitForTimeout(400)
if (await p.getByText('重建生辰').count() === 1) {
  await p.getByText('重建生辰').click()
  await p.waitForTimeout(300)
  ok(await p.evaluate(() => globalThis.__router.current().data.mode) === 'form',
     '按「重建生辰」回到填生辰那一屏',
     await p.evaluate(() => globalThis.__router.current().data.mode))
} else {
  console.log('  · 跳过：这一轮没有本命，「重建生辰」不出现（不计入通过）')
}

console.log('\n── 起卦（点罗盘中心，不是摇手机）──')
errs.length = 0
/* 起卦搬到我家了（REDESIGN.md：起卦归我家 · 罗盘是 H1 上吃掉纵向富余的那一块）。
   转完之后跳去「今天」那一页看结果 —— 落位动画在我家走完再跳。 */
await open('pages/home/index')
/* 罗盘不看有没有本命 —— 起卦本来就不需要它。 */
/* 【记】状态变化,不【采样】状态。
   doSpin 先同步把 mode 设成 spinning 再去请求后端,而假服务端那条 404
   在一个来回里就走完了 —— 等我隔着进程去读的时候,它已经回到 idle。
   采样采不到的东西,不等于没发生过。 */
await p.evaluate(() => {
  const pg = globalThis.__router.current()
  globalThis.__modes = []
  const orig = pg.setData.bind(pg)
  pg.setData = (patch) => { if (patch && patch.mode) globalThis.__modes.push(patch.mode); return orig(patch) }
})
await p.getByText('纳吉', { exact: true }).click()
ok((await p.evaluate(() => globalThis.__modes))[0] === 'spinning',
   '点下去立刻开始转　—— 这一下不等后端,是给人的即时反馈',
   (await p.evaluate(() => globalThis.__modes)).join(' → ') || '一次都没变')
if (API) {
  /* 转完会**跳到「今天」那一页**（起卦在我家、看卦在那一页）。
     等到【要断言的那个状态】稳定 —— 只等路由的话，读到的是签还没取回来那一瞬，
     报出来是「看到的不是刚落的那一卦」，而其实只是还没到。
     落位动画在我家走完才跳，所以这一等要留够时间。 */
  await p.waitForFunction(
    () => globalThis.__router.current().__route === 'pages/ask/index'
      && !!globalThis.__router.current().data.result,
    null, { timeout: 25000 },
  ).catch(() => {})
  const r = await p.evaluate(() => {
    const c = globalThis.__router.current()
    return { 路由: c.__route, mode: c.data.mode, dir: c.data.result && c.data.result.direction }
  })
  ok(r.路由 === 'pages/ask/index', '转完跳去「今天」那一页', r.路由)
  ok(r.mode === 'result', '看到的是刚落的那一卦（不是「翻回去看」那种）', r.mode)
  ok(!!r.dir, '这一卦有方位　—— 后端真算过', r.dir || '空的')
  ok((await text()).includes('再问一次'), '落卦之后可以再问一次')

  /* 「再问一次」真按下去。以前只验了这四个字在不在页面上 ——
     字在、按钮点了没反应，是两回事，而后者从没验过。
     卦搬走之后它把人送回我家的罗盘。 */
  await p.getByText('再问一次').click()
  await p.waitForFunction(() => globalThis.__router.current().__route === 'pages/home/index',
                          null, { timeout: 15000 }).catch(() => {})
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/home/index',
     '按下「再问一次」，回到我家的罗盘',
     await p.evaluate(() => globalThis.__router.current().__route))

  /* 「想问什么」那一栏 2026-08-25 从 H1 上拿掉了（设计 10.8:
     「起卦那颗按钮写『转一下』—— 它就是转一下」）。它原先待在弹性槽里,
     而槽在矮屏上收起 —— 也就是说它在我们对着的那台参照机上根本不存在。
     这里改成钉住【它确实不在了】：哪天有人又把一个输入框摆回主屏,
     这一条会红,那正是该看一眼的时候。 */
  await p.waitForTimeout(400)
  ok(await p.locator('.ask-q-input').count() === 0,
     '主屏上没有输入框 —— 转一下就是转一下',
     String(await p.locator('.ask-q-input').count()))

  /* 再转一签 —— 让「近几次」真有两条。
     转完之后**跳去「今天」那一页**（起卦在我家、看卦在那一页），
     所以这里等的是路由变了，不是这一页的 mode 变成 result。 */
  await open('pages/home/index')
  await p.waitForTimeout(500)
  await p.getByText('纳吉', { exact: true }).click()
  await p.waitForFunction(
    () => globalThis.__router.current().__route === 'pages/ask/index'
      && globalThis.__router.current().data.mode === 'result',
    null, { timeout: 25000 },
  ).catch(() => {})
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/ask/index'
     && await p.evaluate(() => globalThis.__router.current().data.mode) === 'result',
     '转完跳到「今天」那一页，看的是刚落的那一卦',
     `${await p.evaluate(() => globalThis.__router.current().__route)} · ${await p.evaluate(() => globalThis.__router.current().data.mode)}`)

  /* 「看更多」那一段删了：近签整块搬到了我家的弹性槽（REDESIGN.md）。
     两处各留一份就是同一件事写两遍，而且会分头漂。
     这一页从此只干一件事：起一卦、看这一卦。
     翻回去看哪一签，由我家那条「近几次」的动线守着。 */

  /* 「另荐」——落卦之后那张推荐卡。2026-08-19 之前它 bindtap 弹一个
     showModal 就没了：看着像链接，走不通（docs/FLOW.md 的 B1）。
     现在它导航到商品详情，所以这一条验的是**真的走过去了、而且是那一件**。

     【不要捏一个假的 result】——这一页的模板会读 `result.suit.length` 之类，
     捏出来的对象缺字段，垫片会照铁律抛出来（它确实抛过）。
     所以拿刚才真落的那一卦，只给它添一个 recommend；id 用真商品，
     不然点过去那一页会如实报「取不到这一件」。 */
  const 荐商品 = API ? await p.evaluate(async (base) => {
    const r = await fetch(base + '/v1/products?region=cn&platform=mini&category=report')
    if (!r.ok) return null
    const j = await r.json()
    return Array.isArray(j) && j[0] ? { id: j[0].id, name: j[0].name } : null
  }, API) : null
  if (!荐商品) {
    console.log('  · 跳过「另荐」：取不到真商品（假服务端）—— 这一条【没验】')
  } else {
    await p.evaluate((prod) => {
      const c = globalThis.__router.current()
      c.setData({ result: Object.assign({}, c.data.result, { recommend: {
        id: prod.id, name: prod.name, sub_title: '镜像荐的那位', price_display: '¥1.00',
      } }) })
    }, 荐商品)
    await p.waitForTimeout(200)
    const 荐 = p.locator('.recommend')
    ok(await 荐.count() === 1, '有推荐时那张卡在', String(await 荐.count()))
    if (await 荐.count() === 1) {
      await 荐.click()
      await p.waitForTimeout(600)
      const 到了 = await p.evaluate(() => globalThis.__router.current().__route)
      ok(到了 === 'pages/product/index', '点「另荐」真的走到商品详情', 到了)
      const 名字 = await p.evaluate(() => globalThis.__router.current().data.name)
      ok(名字 === 荐商品.name, '商品详情上正是那一件', String(名字) + ' vs ' + 荐商品.name)
      // 进得去还得回得来 —— 每个资源都要有出入口，不能只有入口。
      await p.getByText('回去', { exact: true }).click()
      await p.waitForTimeout(600)
      const 回到 = await p.evaluate(() => globalThis.__router.current().__route)
      ok(回到 === 'pages/ask/index', '从商品详情回得到问签', 回到)
    }
  }

  /* 问过的签能翻回去看 —— 但入口在【我家】的弹性槽里，不在这一页。
     这里验的是这一页那一半：带 id 进来能摊开、关掉能回到罗盘。
     （另一半「从我家点得进去」由前面那条动线守。） */
  const 最近一签 = await p.evaluate(async (base) => {
    const raw = localStorage.getItem('unmei:buwanren:token')
    if (!raw) return null
    const r = await fetch(base + '/v1/naji/history', {
      headers: { authorization: 'Bearer ' + JSON.parse(raw) },
    })
    if (!r.ok) return null
    const j = await r.json()
    const list = Array.isArray(j) ? j : (j.items || [])
    return list[0] ? list[0].id : null
  }, API)
  if (!最近一签) {
    console.log('  · 跳过翻回去看：这个号一签都没有（不计入通过）')
  } else {
    await open('pages/ask/index', { id: 最近一签 })
    await p.waitForFunction(
      () => globalThis.__router.current().data.mode === 'history-detail',
      null, { timeout: 15000 },
    ).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().data.mode) === 'history-detail',
       '带 id 进来，摊开的是那一签', String(await p.evaluate(() => globalThis.__router.current().data.mode)))
    await p.evaluate(() => globalThis.__router.current().closeHist())
    await p.waitForTimeout(400)
    ok(await p.evaluate(() => globalThis.__router.current().data.mode) === 'idle',
       '关掉之后回到罗盘　—— 回不去的话这一页就卡在历史里了')
  }
} else {
  /* 假服务端没有 /v1/naji/spin,给的是 404 —— 于是这里走的是【失败那条路】。
     那条路也该验:落回 idle、弹「起卦失败」,而不是卡在转圈上转到天荒地老。 */
  await p.waitForFunction(() => globalThis.__router.current().data.mode !== 'spinning', null,
                          { timeout: 8000 })
  ok(await p.evaluate(() => globalThis.__router.current().data.mode) === 'idle',
     '后端不给卦时落回原样,不卡在转圈上')
  ok(await p.evaluate(() => document.getElementById('wx-toast').textContent).then((t) => t.includes('起卦失败')),
     '并且说了一声「起卦失败」', await p.evaluate(() => document.getElementById('wx-toast').textContent))
}

// ⑪ 版式对不对 ─────────────────────────────────────────────────
/* 这三条钉的是【外观】,而外观出问题时,行为检查一条都不会红 ——
   镜像照样「动线全通」,只是每一页都长得不对。
   两处都真踩过:app.wxss 从来没被读过(于是全页贴边渲);
   `page` 是小程序的根元素、浏览器里没这个标签(于是整套颜色变量落空,
   而落空的 var() 不报错,页面只是「素了点」)。 */
console.log('\n── 版式（全局样式真的生效了吗）──')
errs.length = 0
await open('pages/home/index')
/* 把这一页摆成空态再看。那颗按钮只在「还没建本命」时才有 ——
   而这一段跑在建本命【之后】，页面已经换成对照了。
   检查该自己把前提摆好，不该指望前面几段留下什么状态。 */
await p.evaluate(() => globalThis.__router.current().setData({ summary: null, err: '' }))
await p.waitForTimeout(300)
const look = await p.evaluate(() => {
  const pg = document.querySelector('.page')
  const btn = document.querySelector('button.btn')
  const cs = pg && getComputedStyle(pg)
  return {
    左留白: cs ? parseFloat(cs.paddingLeft) : 0,
    墨色: getComputedStyle(document.body).getPropertyValue('--ink').trim(),
    按钮底: btn ? getComputedStyle(btn).backgroundColor : '没有按钮',
  }
})
ok(look.左留白 > 10, 'app.wxss 生效了　—— .page 的左右留白来自它', look.左留白 + 'px')
ok(look.墨色 === '#1a1a1c', '`page` 上的颜色变量映到了根元素', look.墨色 || '落空了')
// 钉住设计色本身。只问「透不透明」的话,浏览器默认那个灰底 #efefef
// 照样算过 —— 而那正是 app.wxss 没生效时的样子(变异测出来的)
ok(look.按钮底 === 'rgb(26, 26, 28)', '按钮是设计里那个墨色填底', look.按钮底)

// ⑪-b 一条完整用例 · 我 → 铺 → 一件 ────────────────────────────
/* 「所有资源都要有出入口」：商品详情原先只有问签那张推荐卡一个入口，
   而那得碰巧落到那一卦上。铺这一页是它的常设入口，「我」是铺的入口。
   这一段把这条路整条走一遍，顺便让铺上那几个处理器真的被点到 ——
   没被点过的处理器跟不存在没有区别。 */
console.log('\n── 一条完整用例：我 → 铺 → 一件 ──')
errs.length = 0
if (!API) {
  console.log('  · 跳过：这一段要真目录（假服务端给不出商品）—— 这一条【没验】')
} else {
  /* 「我」上没有铺了 —— 东西长在卖它的人身上（docs/REDESIGN.md R3）。
     挑人这件事从村里的空屋进去，不从账户抽屉进去。 */
  /* 走真实那条路：空屋 → 看看谁能来（docs/REDESIGN.md R2）。
     原先直接调 `goOmamori()` —— 那个处理器随卡片一起删了，
     而且直接调处理器验不出「点得到」，那正是这条动线要证明的事。 */
  await open('pages/plot/index')
  await p.getByText('看看谁能来', { exact: true }).click()
  await p.waitForTimeout(900)
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/invite/index',
     '从村里进得了「谁能来」', await p.evaluate(() => globalThis.__router.current().__route))

  /* 同上：不拿本机的数据量当判据。 */
  const 全部数 = await p.evaluate(() => globalThis.__router.current().data.items.length)
  const 全部文 = await text()
  ok(全部数 > 0 || 全部文.includes('一位也请不来'),
     `「谁能来」两种数据形状都说得对（${全部数 > 0 ? 全部数 + ' 位' : '空状态'}）`,
     String(全部数))

  /* 分类切换那一段删了：铺没了，「谁能来」只列御守，没有分类栏
     （docs/REDESIGN.md R3）。原来那段读 data.cats / data.total / data.shown，
     新页一个都没有 —— 留着会 TypeError，而不是报一句「这一条不适用」。 */
  /* 册上现在是【人】不是【货】（设计册 10.8：四十位都列出来）。
     所以这里记的是「他的那件御守是哪一件」，点进去比 id ——
     比名字的话，比的是村民名与商品名，那两个本来就不该相等。 */
  const 头一件 = await p.evaluate(() => {
    const c = globalThis.__router.current()
    const v = (c.data.items || []).find((x) => x.onSale)
    return v ? { name: v.name, product: v.product } : null
  })
  if (!头一件) {
    console.log('  · 跳过点进详情：一位都请不来（不计入通过）')
  } else {
    await p.locator('.item').first().click()
    await p.waitForTimeout(900)
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/product/index',
       '点一件进得去详情', await p.evaluate(() => globalThis.__router.current().__route))
    ok(await p.evaluate(() => globalThis.__router.current().data.id) === 头一件.product,
       '详情上正是点的那一件', `${头一件.name} → ${头一件.product}`)
  }
  await shot('06-invite-product')
}

/* ── 一屏不滚动 · 逐页量 ────────────────────────────────────────
   先量、先报数，不急着红。要红得等把该改的页改完 —— 一上来就红，
   门禁会被当成噪音跳过去，那比没有门禁更糟。 */
console.log('\n── 一屏放得下吗（iPhone SE · 内容区 597）──')
{
  /* 台账：`web/oversize-pages.json`。每一条写着【为什么还没改】与【当前超多少】。
     规矩三条 ——
       · 不在台账里的页超了 → 红（新写的页必须一屏放得下）
       · 台账里的页超过记着的数 → 红（欠账只许缩）
       · 台账里的页已经放得下了 → 也红（那一条该划掉，否则台账会烂）
     跟孤儿台账同一套办法：允许有例外，但每个例外都得有名有姓、有理由。 */
  const 台账 = JSON.parse(readFileSync('web/oversize-pages.json', 'utf8'))
  const 量到 = {}
  for (const r of routes) {
    if (['pages/product/index', 'pages/order/index', 'pages/villager/index', 'pages/confirm/index', 'pages/report/index'].includes(r) && !要参数[r]) {
      console.log(`  · ${r.replace('pages/', '').replace('/index', '')} 跳过：这一趟没有真数据（不计入通过）`)
      continue
    }
    const m = await 量一屏(r, 要参数[r])
    const 名 = r.replace('pages/', '').replace('/index', '')
    量到[名] = m.溢出
    const 记着 = 台账[名] ? 台账[名].超 : null
    if (m.溢出 > 8) {
      if (记着 === null) {
        ok(false, `${名} 一屏放得下`,
           `超 ${m.溢出}px，而台账里没有这一条 —— 要么改到放得下，要么写明为什么\n         这一屏是谁占的：${m.分块.join(' · ')}${m.出错 ? '\n         而且它停在错误态：' + m.出错 : ''}`)
      } else if (m.溢出 > 记着) {
        ok(false, `${名} 的欠账没有变大`,
           `台账记着 ${记着}，现在 ${m.溢出}\n         这一屏是谁占的：${m.分块.join(' · ')}${m.出错 ? '\n         而且它停在错误态：' + m.出错 : ''}`)
      } else {
        console.log(`  · ${名.padEnd(9)} 超 ${m.溢出}px（台账 ${记着}）—— ${台账[名].为什么.slice(0, 30)}…`)
      }
    } else if (m.出错) {
      /* 没超，但这一屏停在【错误态】—— 那不是它真正的版式。
         错误态往往只剩一行红字，当然放得下；拿它当「放得下」，
         等于给一屏根本没量到的东西打了分。

         `量一屏` 早就把「出错」量出来了，可从前只在【超了】的时候才报 ——
         也就是说这个字段只在坏消息里出现，好消息里不出现。
         2026-08-27 撞上：往建生辰那一屏加了一块「会得到这些」，
         它真实高度超了 46px，而这一支照旧报「放得下（余 0px）」——
         因为那一趟它一直停在「取不到本命：unauthorized」。 */
      ok(false, `${名} 这一趟量到的是真版式`,
         `它停在错误态：${m.出错}\n         错误态只剩一行字，当然放得下 —— 这一屏这一趟【没量到】`)
    } else {
      if (记着 !== null) {
        ok(false, `${名} 已经放得下了，台账那一条该划掉`, `台账还记着 ${记着}`)
      } else {
        console.log(`  ✓ ${名.padEnd(9)} 放得下（余 ${-m.溢出}px）`)
      }
    }
  }
  /* ── 一页有几种形态，就都要量 ──────────────────────────────
     上面那一圈按【页】量，一页只量到当时那一种形态。而好几页在不同数据下
     是完全不同的版式：「命」没建过本命时是表单、建过之后是盘面；
     一单在待付、已付、该扫时给的是三组不同的按钮；一位村民住着与没请回来
     也不是同一屏。

     2026-08-27 撞上一次：往建生辰那一屏加了一块，它真实超了 46px，
     而那一圈照报「放得下」—— 因为那一趟量到的是盘面。
     **一页只量一种形态，等于给没量到的那几种打了分。**

     切形态用的是改这一屏自己的 state，不动库里的数据 ——
     造数据的代价太大，而这里要验的只是「这一组内容排得下吗」。 */
  const 多形态 = [
    { 页: 'pages/home/index', 名: '还没建本命',
      切: () => globalThis.__router.current().setData({ summary: null, err: '' }),
      凭据: '先填生辰',
      为什么: '罗盘灰着、压一句「先填生辰」加一个出口 —— 冷启动第一眼就是它' },
    { 页: 'pages/natal/index', 名: '填生辰',
      切: () => globalThis.__router.current().setData({ mode: 'form', err: '' }),
      凭据: '会得到这些',
      为什么: '第一次来的人看到的是表单，不是盘面' },
    { 页: 'pages/order/index', 名: '待付',
      切: () => globalThis.__router.current().setData({ status: 'unpaid', toScan: false, err: '' }),
      凭据: '去支付',
      为什么: '待付给的是「去支付 / 不要了」，跟已付那组按钮不一样' },
    { 页: 'pages/order/index', 名: '该扫了',
      切: () => globalThis.__router.current().setData({ status: 'paid', toScan: true, err: '' }),
      凭据: '收到了，去扫开它',
      为什么: 'M3 那颗主按钮加一槽话，是这一屏最高的一种形态' },
    { 页: 'pages/order/index', 名: '轨迹很长',
      切: () => {
        /* 塞十二条 —— 比设计定的八条上限多四条。轨迹是承运商推来的，
           条数不归我们定，所以这一屏得对「比预期多」有个交代。 */
        const 条 = Array.from({ length: 12 }, (_, i) => ({
          时间: `08-${String(10 + i).padStart(2, '0')} 09:00`, 说: '到了一站', 在: '某某转运中心',
        }))
        const c = globalThis.__router.current()
        /* 顺便把这一单切成【已付】。一张能有十二条轨迹的单不可能还没付钱 ——
           没付钱不会发货。不切的话「已付≠合计」那一块会一起显示，
           而这一屏量到的就成了一个现实中不存在的组合。 */
        c.setData({ traceOf: 'shp-x', trace: 条.slice(0, 8), traceMore: 条.length - 8,
                    shipments: [{ id: 'shp-x', statusText: '在路上', tracking_no: 'X1' }],
                    status: 'paid', statusText: '已付', paidText: c.data.totalText, err: '' })
      },
      凭据: '更早还有 4 条',
      为什么: '10.3：一屏八条，超了折叠 —— 全渲的话这一屏会被轨迹顶出去' },
    { 页: 'pages/me/index', 名: '一笔都没买过',
      切: () => globalThis.__router.current().setData({
        recent: null, recentEmpty: true, recentNote: '', orderText: '还没有', nextStop: '' }),
      凭据: '还没买过什么',
      为什么: '空状态是这一屏的一半 —— 它要指出「哪儿能有」（设计册 10.7）' },
    { 页: 'pages/orders/index', 名: '一单都没有',
      切: () => globalThis.__router.current().setData({
        loading: false, err: '', total: 0, items: [], page: [], pageCount: 0 }),
      凭据: '还没买过什么',
      为什么: 'M2 的空状态：不说「没有订单」，说东西长在人身上、去村里看看' },
    { 页: 'pages/subs/index', 名: '一个都没订',
      切: () => globalThis.__router.current().setData({ loading: false, err: '', items: [] }),
      凭据: '还没有订着的',
      为什么: '10.7 说得最直白：M5 的空状态【就是这一屏的主设计】' },
    { 页: 'pages/incense/index', 名: '还没建本命',
      切: () => globalThis.__router.current().setData({ line: '' }),
      凭据: '先把生辰填了',
      为什么: '她不知道你缺什么时说的那一句，比配错一味重要' },
    { 页: 'pages/villager/index', 名: '还没请回来',
      切: () => {
        const c = globalThis.__router.current()
        c.setData({ who: Object.assign({}, c.data.who, { at_home: false }),
                    sells: false, canEnter: false, err: '' })
      },
      凭据: '请他来',
      为什么: '没请回来时只有「请他来」，住着时是问事 / 去他家 / 她卖的' },
  ]
  for (const 态 of 多形态) {
    const 名 = 态.页.replace('pages/', '').replace('/index', '')
    if (态.页 === 'pages/order/index' && !要参数[态.页]) {
      console.log(`  · ${名}「${态.名}」跳过：这一趟没有真数据（不计入通过）`)
      continue
    }
    if (态.页 === 'pages/villager/index' && !要参数[态.页]) {
      console.log(`  · ${名}「${态.名}」跳过：这一趟没有真数据（不计入通过）`)
      continue
    }
    await 量一屏(态.页, 要参数[态.页])          // 先正常开一次，让它取完
    await p.setViewportSize({ width: 375, height: 667 })
    const 切了 = await p.evaluate(态.切).then(() => true, () => false)
    if (!切了) {
      ok(false, `${名}「${态.名}」这一态量得到`, '切不过去 —— 页面的字段变了？')
      await p.setViewportSize({ width: 390, height: 844 })
      continue
    }
    await p.waitForTimeout(700)
    /* 切【真的生效了】吗。少了这一问，setData 没落到实处时量的还是上一种形态，
       而那一种本来就放得下 —— 又一次「够不着却打了分」。
       凭据是那一态特有的一句话：它不在，就说明这一态根本没量到。 */
    const 屏文 = await text()
    if (!屏文.includes(态.凭据)) {
      ok(false, `${名}「${态.名}」这一态量得到`,
         `切过去了，但屏上找不到「${态.凭据}」—— 量的多半还是上一种形态`)
      await p.setViewportSize({ width: 390, height: 844 })
      continue
    }
    const 量 = await p.evaluate(() => {
      const d = document.documentElement, b = document.body
      return {
        内容: Math.max(d.scrollHeight, b.scrollHeight),
        视口: window.innerHeight,
        分块: Array.from((document.querySelector('#app .page') || document.querySelector('#app .wrap')
                          || { children: [] }).children)
          .map((el) => `${(el.className || '?').toString().split(' ')[0]}:${Math.round(el.getBoundingClientRect().height)}`)
          .filter((x) => !x.endsWith(':0')),
      }
    })
    await p.setViewportSize({ width: 390, height: 844 })
    const 溢 = 量.内容 - 量.视口
    ok(溢 <= 8, `${名}「${态.名}」这一态也放得下`,
       溢 > 8 ? `超 ${溢}px —— ${态.为什么}\n         这一屏是谁占的：${量.分块.join(' · ')}`
              : `内容 ${量.内容} / 视口 ${量.视口}`)
  }

  const 欠 = Object.keys(台账).filter((k) => k !== '_读法')
  const 没量到 = 欠.filter((k) => !(k in 量到))
  ok(没量到.length === 0, '台账上的页这一趟都量到了',
     没量到.length ? `没量到：${没量到.join(' ')} —— 页没了就把那一条划掉` : '')
  const 量过的 = Object.values(量到)
  const 放得下 = 量过的.filter((v) => v <= 8).length
  /* 别在模板串里写 `keys(量到)` —— 中文标识符紧贴半角括号，
     check-punct-ui 会当成文案里的半角标点报红。先算到变量里。 */
  const 共几页 = 量过的.length
  /* 弹性槽真的会「矮屏收起、长屏出来」吗。
     上面那圈只量矮屏 —— 一条「哪儿都不显示」的规则同样能让它全绿，
     而那等于把近几次悄悄删了。所以两头都要看。 */
  {
    await open('pages/home/index')
    const 看 = async (h) => {
      await p.setViewportSize({ width: 375, height: h })
      await p.waitForTimeout(300)
      return p.evaluate(() => {
        const el = document.querySelector('.flexslot')
        const d = document.documentElement
        return { 有: !!el, 显示: !!el && getComputedStyle(el).display !== 'none',
                 滚: d.scrollHeight > d.clientHeight,
                 超: Math.max(0, d.scrollHeight - d.clientHeight) }
      })
    }
    const 矮 = await 看(667)
    const 高 = await 看(852)
    await p.setViewportSize({ width: 390, height: 844 })
    if (!矮.有) {
      console.log('  · 弹性槽这一趟没有内容可放（不计入通过）')
    } else {
      ok(!矮.显示 && !矮.滚, '弹性槽在矮屏上收起来，而且这一屏不滚',
         `矮屏 ${矮.显示 ? '还显示着' : '收了'}・${矮.滚 ? '超 ' + 矮.超 : '不滚'}`)
      ok(高.显示 && !高.滚, '长屏上它出来了　—— 不是被规则一刀切没了',
         `长屏 ${高.显示 ? '出来了' : '还是收着'}・${高.滚 ? '超 ' + 高.超 : '不滚'}`)
    }
  }

  console.log(`  —— ${放得下}/${共几页} 页放得下 · 台账 ${欠.length} 条`)
}

// ⑪-c 一条完整用例 · 一件 → 买 → 单 → 付 ──────────────────────
/* docs/FLOW.md 的 U3。这一段验的是**到掏钱为止的整条**：
   下单（带幂等键，这是第一个会发它的客户端）、订单页读得出金额与状态、
   「去支付」真的打到后端拿回 prepay 参数。

   最后掏钱那一下 `wx.requestPayment` 在浏览器里【抛】——照镜像第 2 条铁律，
   浏览器里没有微信收银台，空实现会让「已支付」在网页上成立而真机上没发生。
   所以这里断言的是「抛了、而且抛的是那句只有真机才有」，不是「付成功了」。 */
console.log('\n── 一条完整用例：一件 → 买 → 单 → 付 ──')
errs.length = 0
if (!API) {
  console.log('  · 跳过：这一段要真后端（下单要落库）—— 这一条【没验】')
} else {
  const 那件 = 要参数['pages/product/index']
  if (!那件) {
    console.log('  · 跳过：没有可买的商品（不计入通过）')
  } else {
    await open('pages/product/index', 那件)
    const 标价 = await p.evaluate(() => globalThis.__router.current().data.price)
    ok(/^[^0-9]*[0-9]/.test(标价 || ''), '商品页上有价', String(标价))

    /* 「买」现在先去确认那一屏（REDESIGN.md R5 · P2），建单挪到了那里。
       中间这一屏要问三件事：几件、寄到哪、要不要留句话。 */
    await p.getByText('请他来', { exact: true }).click()
    await p.waitForFunction(
      () => globalThis.__router.current().__route === 'pages/confirm/index',
      null, { timeout: 15000 },
    ).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/confirm/index',
       '「请他来」先到确认那一屏', await p.evaluate(() => globalThis.__router.current().__route))

    /* 数量真的会改合计 —— 这一屏若只是摆个加减号，那它白加 */
    /* 等它取完再读。第一版没等，`一件` 读到空串，而空串 ≠ ¥40，
       于是「加一件合计跟着变」**假过了一次** —— 比红更糟。 */
    await p.waitForFunction(
      () => globalThis.__router.current().data.loading === false
        && !!globalThis.__router.current().data.totalText,
      null, { timeout: 15000 },
    ).catch(() => {})
    const 一件 = await p.evaluate(() => globalThis.__router.current().data.totalText)
    await p.getByText('＋', { exact: true }).click()
    await p.waitForTimeout(200)
    const 两件 = await p.evaluate(() => globalThis.__router.current().data.totalText)
    ok(两件 !== 一件 && await p.evaluate(() => globalThis.__router.current().data.qty) === 2,
       '加一件，合计跟着变', `${一件} → ${两件}`)
    await p.getByText('−', { exact: true }).click()
    await p.waitForTimeout(200)
    ok(await p.evaluate(() => globalThis.__router.current().data.qty) === 1, '减得回来')

    /* 留言那一栏。它跟数量一样是「写了要真的带走」的东西 ——
       只看输入框在不在的话，一个绑着却不写状态的 bindinput 也能全绿。 */
    await p.locator('.msg').fill('镜像留一句')
    await p.waitForTimeout(200)
    ok(await p.evaluate(() => globalThis.__router.current().data.message) === '镜像留一句',
       '留言写进去留得住', 'bindinput → message')

    /* 收货地址簿只有真机有 —— 网页版上它抛，这一屏要如实说，不假装填好了 */
    await p.getByText('还没填', { exact: false }).click()
    await p.waitForTimeout(500)
    const 地址话 = await p.evaluate(() => globalThis.__router.current().data.addrNote)
    ok(!!地址话 && !await p.evaluate(() => !!globalThis.__router.current().data.contact),
       '选地址在网页上如实说做不到，不假装填好', String(地址话))

    /* 确认那一屏的「回去」只长在**出错**那一支上 ——
       正常态没有它（真机上有原生返回箭头，所以不是死路）。
       所以要验它就得把这一屏打进出错态：拿一个不存在的商品进去。
       在正常态上找这颗按钮找不到,而那不是 bug,是我找错了地方。 */
    {
      await open('pages/confirm/index', { id: 'p_不存在的商品' })
      await p.waitForFunction(
        () => globalThis.__router.current().data.loading === false,
        null, { timeout: 15000 },
      ).catch(() => {})
      const 说了啥 = await p.evaluate(() => globalThis.__router.current().data.err || '')
      ok(!!说了啥, '确认那一屏取不到商品时说得出话　—— 不是空着一屏', String(说了啥).slice(0, 40))
      await p.getByText('回去', { exact: true }).click()
      await p.waitForTimeout(600)
      ok(await p.evaluate(() => globalThis.__router.current().__route) !== 'pages/confirm/index',
         '出错那一屏上的「回去」真的退得出去',
         await p.evaluate(() => globalThis.__router.current().__route))

      // 回到正常那一屏接着买
      await open('pages/confirm/index', 要参数['pages/confirm/index'])
      await p.waitForFunction(
        () => globalThis.__router.current().data.loading === false
          && !!globalThis.__router.current().data.totalText,
        null, { timeout: 15000 },
      ).catch(() => {})
    }

    await p.getByText('去付', { exact: true }).click()
    await p.waitForFunction(
      () => globalThis.__router.current().__route === 'pages/order/index',
      null, { timeout: 20000 },
    ).catch(() => {})
    const 到了 = await p.evaluate(() => globalThis.__router.current().__route)
    ok(到了 === 'pages/order/index', '「去付」建了单，落到那张单子上', 到了)
    // 单子自己也要取完再读，不然下面几条读的是空壳
    await p.waitForFunction(
      () => (globalThis.__router.current().data.lines || []).length > 0,
      null, { timeout: 20000 },
    ).catch(() => {})

    if (到了 === 'pages/order/index') {
      const 单 = await p.evaluate(() => {
        const d = globalThis.__router.current().data
        return { 状态: d.statusText, 合计: d.totalText, 行数: d.lines.length }
      })
      ok(单.状态 === '待付', '新单子是「待付」', String(单.状态))
      ok(单.合计 === 标价, '单子上的合计跟商品页上的标价是同一个数',
         `商品页 ${标价} · 单子 ${单.合计}`)
      ok(单.行数 === 1, '单子上有一行', String(单.行数))

      /* 「去支付」：打后端拿 prepay 参数（真跑），然后 requestPayment 抛。
         **抛到哪儿去看**：`deviceOnly` 是故意不走整屏红的 —— 「这一步只有真机有」
         跟「镜像坏了」不是一回事，它落在底部那条提示上，并记进 `__DEVICE_ONLY`。
         这条断言原先查的是整屏红那一块，查错了地方:真抛了也看不见，
         而真的没抛（比如哪天被人 catch 掉、悄悄当成功）同样看不见 —— 两头都盲。 */
      await p.getByText('去支付', { exact: true }).click()
      await p.waitForFunction(
        () => (globalThis.__DEVICE_ONLY || []).length > 0
              || (globalThis.__router.current().data.note || '').includes('失败')
              || (globalThis.__router.current().data.note || '').includes('缺'),
        null, { timeout: 20000 },
      ).catch(() => {})
      const 真机才有 = await p.evaluate(() => globalThis.__DEVICE_ONLY || [])
      const 提示条 = await p.evaluate(() => {
        const n = document.getElementById('wx-note')
        return n && n.style.display === 'block' ? n.textContent : ''
      })
      const 页上 = await p.evaluate(() => globalThis.__router.current().data.note || '')
      ok(真机才有.includes('requestPayment') && 提示条.includes('微信支付'),
         '掏钱那一下在网页版上【抛】了，没有假装成功',
         `记下的 ${JSON.stringify(真机才有)} · 提示条「${提示条.slice(0, 24)}」· 页上「${页上}」`)

      /* 抛完之后这张单子**不许**变成已付 —— 「如实抛」的另一半是「别偷偷成功」 */
      await p.evaluate(() => globalThis.__router.current().load())
      await p.waitForTimeout(600)
      ok(await p.evaluate(() => globalThis.__router.current().data.statusText) === '待付',
         '抛了之后单子还是「待付」，没有偷偷变成已付',
         await p.evaluate(() => globalThis.__router.current().data.statusText))

      /* 物流与退款：这一页的正路在浏览器里**走不到** —— 要到 paid 必须真付款，
         而付款只有真机有。所以这里验的是「没有的时候不乱显示」：
         一张刚下的报告单没有包裹、也不该给退款按钮。
         接口那一侧由 `scripts/verify-semantics.sh` 的 O 段用真数据验
         （造一笔成功支付 + 一件包裹 + 一条轨迹，再看用户取不取得到）。 */
      const 物流态 = await p.evaluate(() => {
        const d = globalThis.__router.current().data
        return { 件数: d.shipments.length, 错: d.shipErr || '' }
      })
      ok(物流态.件数 === 0 && 物流态.错 === '',
         '没有实物要寄的单子：不显示包裹那一块，而且不是「取不到」',
         `件数=${物流态.件数} 错=${物流态.错 || '无'}`)
      ok(await p.locator('text=申请退款').count() === 0,
         '还没付的单子不给「申请退款」',
         String(await p.locator('text=申请退款').count()))

      /* 「不要了」—— 待付的单子要退得掉，不然它就是个只能进不能出的东西。 */
      errs.length = 0
      await open('pages/order/index', { id: await p.evaluate(() => globalThis.__router.current().data.id) })
      await p.getByText('不要了', { exact: true }).click()
      await p.waitForTimeout(1200)
      ok(await p.evaluate(() => globalThis.__router.current().data.statusText) === '已取消',
         '「不要了」真的把单子取消了',
         await p.evaluate(() => globalThis.__router.current().data.statusText))
      await p.getByText('回去', { exact: true }).click()
      await p.waitForTimeout(600)
    }
  }

  /* 命：建得了、换不了、删不掉 —— `natal.remove` 封装了很久没有页面用。
     先建第二份，档案那一段才会出现（只有一份时不显示，一份没什么好换的）。 */
  await open('pages/natal/index')
  const 原有 = await p.evaluate(() => globalThis.__router.current().data.archive.length)
  if (原有 < 1) {
    console.log('  · 跳过档案那一段：这个用户还没有本命（不计入通过）')
  } else {
    // 再建一份：重建生辰 → 生成
    await p.getByText('重建生辰', { exact: true }).click()
    await p.waitForTimeout(400)
    await p.getByText('算一算', { exact: true }).click()
    /* 建本命要打排盘服务，慢；固定等几秒会时灵时不灵。轮询到档案变长为止，
       等不到就把页面自己那一行错误读出来 —— 「没变长」和「报错了」不是一回事。 */
    let 现有 = 原有
    for (let i = 0; i < 20; i++) {
      await p.waitForTimeout(700)
      现有 = await p.evaluate(() => globalThis.__router.current().data.archive.length)
      if (现有 > 原有) break
    }
    const 页错 = await p.evaluate(() => {
      const d = globalThis.__router.current().data
      return d.err || d.archNote || `mode=${d.mode} submitting=${d.submitting}`
    })
    ok(现有 > 原有, '再建一份，档案里多了一条', `${原有} → ${现有} · ${页错}`)
    if (现有 > 1) {
      const 在用 = await p.evaluate(() => globalThis.__router.current().data.natal.id)
      /* 顺带钉住垫片的一件事：`wx:if` / `wx:else` 只该渲一支。
         2026-08-19 之前无值属性被属性正则整个丢掉，于是 `wx:else` 形同不存在，
         两支一起渲 —— 在用的那一行同时写着「在用」和「换成它」，
         而所有检查照样绿：页面看着是完整的，只是多了一块。
         全仓 8 个页面 14 处 `wx:else` 当时都是这样。 */
      const 在用行 = await p.evaluate(() => {
        const rows = [...document.querySelectorAll('.arch')].map((e) => e.innerText.replace(/\s+/g, ' '))
        return rows.find((t) => t.includes('在用')) || ''
      })
      ok(在用行.includes('在用') && !在用行.includes('换成它'),
         'wx:if / wx:else 只渲一支（在用那一行不给「换成它」）', 在用行)
      await p.locator('.arch-act').filter({ hasText: '换成它' }).first().click()
      // 换完要重取 summary（打排盘服务），固定等 2.5 秒时灵时不灵 —— 轮询
      let 换后 = 在用
      for (let i = 0; i < 20; i++) {
        await p.waitForTimeout(700)
        换后 = await p.evaluate(() => globalThis.__router.current().data.natal.id)
        if (换后 !== 在用) break
      }
      const 换诊 = await p.evaluate(() => {
        const d = globalThis.__router.current().data
        return `note=${d.archNote || '无'} loading=${d.loading} 档案=${d.archive.map((n) => (n.is_default ? '*' : '') + n.id.slice(0, 8)).join(',')}`
      })
      ok(换后 !== 在用, '「换成它」真的换了在用的那一份',
         `${在用.slice(0, 8)} → ${换后.slice(0, 8)} · ${换诊}`)
      const 删前 = await p.evaluate(() => globalThis.__router.current().data.archive.length)
      await p.locator('.arch-del').first().click()
      for (let i = 0; i < 20; i++) {
        await p.waitForTimeout(700)
        if (await p.evaluate(() => globalThis.__router.current().data.archive.length) < 删前) break
      }
      ok(await p.evaluate(() => globalThis.__router.current().data.archive.length) < 删前,
         '「删」真的删掉了一份',
         `${删前} → ${await p.evaluate(() => globalThis.__router.current().data.archive.length)}`)
    }
  }

  /* 改名：`/v1/user/me` 的 PATCH 一直在，客户端从来没调过 ——
     绑定微信那一刻定下的昵称此后再也改不了。匿名用户也有名字（服务端给「过客」），
     所以这一块对谁都开着，浏览器里验得到。 */
  await open('pages/me/index')
  const 原名 = await p.evaluate(() => globalThis.__router.current().data.nickname)
  ok(!!原名, '「我」上写着名字', String(原名))
  /* 改名搬到自己那一屏了（REDESIGN.md R6 · M6）——
     名字不是账户字段，是村里的人怎么称呼你，所以那一屏要给「叫起来什么样」的预览。
     这里改走真页面。 */
  await p.getByText('名字', { exact: true }).click()
  await p.waitForFunction(
    () => globalThis.__router.current().__route === 'pages/name/index',
    null, { timeout: 15000 },
  ).catch(() => {})
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/name/index',
     '「我的」点得进名字那一屏', await p.evaluate(() => globalThis.__router.current().__route))

  /* 预览是这一屏存在的理由：名字要看得见【别人怎么叫】。
     只验「有个输入框」的话，这一屏跟原来那一行就没差别了。 */
  const 预览 = await text()
  ok(预览.includes('叫起来是这样') && 预览.includes(String(原名)),
     '预览里用的是当前这个名字 —— 那正是它值一屏的理由', 预览.slice(0, 50))

  const 新名 = '镜像改的名字'
  await p.locator('.name-input').fill(新名)
  await p.waitForTimeout(200)
  const 改后预览 = await text()
  ok(改后预览.includes(新名), '边打字边跟着变 —— 预览是活的', 改后预览.slice(0, 46))
  await p.getByText('存下', { exact: true }).click()
  for (let i = 0; i < 20; i++) {
    await p.waitForTimeout(500)
    if (await p.evaluate(() => globalThis.__router.current().data.nickname) === 新名) break
  }
  ok(await p.evaluate(() => globalThis.__router.current().data.nickname) === 新名,
     '改名存下了', String(await p.evaluate(() => globalThis.__router.current().data.nickname)))

  /* 存的是服务端那一份，不是屏上那一份 —— 重开还得是新名字。 */
  await open('pages/me/index')
  await p.waitForTimeout(900)
  ok(await p.evaluate(() => globalThis.__router.current().data.nickname) === 新名,
     '重开还是新名字（不是只改了屏上那一份）',
     String(await p.evaluate(() => globalThis.__router.current().data.nickname)))

  /* 改完名字那一屏的「回去」。改了名之后最自然的下一下就是它,
     而它一直没被真按过。 */
  await open('pages/name/index')
  await p.waitForTimeout(600)
  await p.getByText('回去', { exact: true }).click()
  await p.waitForTimeout(600)
  ok(await p.evaluate(() => globalThis.__router.current().__route) !== 'pages/name/index',
     '名字那一屏上的「回去」真的退得出去',
     await p.evaluate(() => globalThis.__router.current().__route))

  /* 「我」→「徽」：得了徽章要有人告诉你。后端一直在发（库里几百个），
     而 2026-08-19 之前没有任何客户端读它。 */
  await open('pages/me/index')
  const 徽摘要 = await p.evaluate(() => globalThis.__router.current().data.badgeText)
  ok(/^\d+ \/ \d+ 枚徽章$/.test(徽摘要 || ''), '「我」上写着得了几个徽章', String(徽摘要))
  await p.getByText('我得到的', { exact: true }).click()
  await p.waitForTimeout(1200)
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/badges/index',
     '点得进徽章那一页', await p.evaluate(() => globalThis.__router.current().__route))
  const 徽 = await p.evaluate(() => {
    const d = globalThis.__router.current().data
    return { 全: d.all, 得: d.got, 条: d.items.length }
  })
  ok(徽.全 > 0 && 徽.条 === 徽.全, '徽章列出来了', `${徽.得}/${徽.全}`)
  await p.getByText('回去', { exact: true }).click()
  await p.waitForTimeout(800)

  /* 「订」：库里一条订阅都没有，所以这一行显示「还没有订阅」，
     点它去铺 —— **没有的时候，出口就是「去哪儿能有」**。 */
  await open('pages/me/index')
  const 订摘要 = await p.evaluate(() => globalThis.__router.current().data.subText)
  ok(订摘要 === '还没有' || /个订着$/.test(订摘要 || ''),
     '「我」上写着订阅的状况', String(订摘要))
  /* 账号明细搬去「设置」了（M1 只放设计册列的那五条）。
     它是账号的维护面，不是「我」的内容 —— 但**搬走不等于藏起来**：
     从「我的」点得到「设置」，进去展得开，五行还在。 */
  await open('pages/me/index')
  await p.getByText('设置', { exact: true }).click()
  await p.waitForFunction(
    () => globalThis.__router.current().__route === 'pages/settings/index',
    null, { timeout: 15000 },
  ).catch(() => {})
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/settings/index',
     '「我的」点得进「设置」', await p.evaluate(() => globalThis.__router.current().__route))
  /* 折叠没有了：折叠是为了让【「我的」那一屏】放得下,这五行搬走之后
     那个理由就不成立了。它们唯一的用途是被人念给客服听 ——
     多一次「展开」等于给唯一的用途加一道手续。所以这里验的是
     **不点任何东西就看得见**。 */
  await p.waitForTimeout(700)
  const 明细 = await text()
  ok(明细.includes('I D') && 明细.includes('平 台'),
     '账号那五行不用点就在 —— 念给客服听的东西不该再藏一层', 明细.slice(0, 40))
  await open('pages/me/index')

  await p.getByText('订着的', { exact: true }).click()
  await p.waitForTimeout(1200)
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/subs/index',
     '「订」进得了自己那一页', await p.evaluate(() => globalThis.__router.current().__route))
  /* 出口那一条没变，只是搬进了那一页里面：空的时候要说清哪儿能有。 */
  await p.waitForTimeout(900)
  const 空文 = await text()
  ok(空文.includes('还没有订着的') || 空文.includes('订着'),
     '订着的那一页说得出现在的状况', 空文.slice(0, 40))

  /* 光说「哪儿能有」不算数 —— 得真的走得过去。M5 整页就是为这一下存在的。 */
  const 能订几件 = await p.evaluate(() => (globalThis.__router.current().data.offers || []).length)
  if (!能订几件) {
    /* 没有可订的东西时，这一屏【也要验】—— 原先这一支是 console.log 跳过，
       而跳过不是通过。2026-08-28 唯一那件可订的商品下架之后，
       这一屏就长期落在这一支上，等于那一半永远没人看。

       它要说的是「现在就是没有」，**不许**说「下面是哪儿能有」然后
       什么都不摆：指向空白比不指更糟。 */
    const 空屏 = await text()
    ok(!空屏.includes('下面是哪儿能有'),
       '没有可订的东西时，不说一句指向空白的话', 空屏.slice(0, 60))
    ok(空屏.includes('等有了会摆在这儿') || 空屏.includes('没有可以订'),
       '它说得出现在就是没有', 空屏.slice(0, 60))
  } else {
    await p.locator('.offers .item').first().click()
    await p.waitForTimeout(900)
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/product/index',
       '「哪儿能有」真的走得过去 —— 出口不是一句话',
       await p.evaluate(() => globalThis.__router.current().__route))
    await open('pages/subs/index')
  }

  /* 「我」→「单」：花过的钱要能找回来。这是订单这个资源的常设入口 ——
     刚才那条是「刚下完单顺着走」，这条是「过一阵回来找」。 */
  await open('pages/me/index')
  await p.getByText('我买过的', { exact: true }).click()
  await p.waitForTimeout(1200)
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/orders/index',
     '从「我」找得到「单」', await p.evaluate(() => globalThis.__router.current().__route))
  // 列表要打一次后端，固定等一下时灵时不灵 —— 轮询（今天第三次栽在固定等待上）
  let 有几单 = 0
  for (let i = 0; i < 15; i++) {
    有几单 = await p.evaluate(() => globalThis.__router.current().data.total)
    if (有几单 > 0) break
    await p.waitForTimeout(500)
  }
  ok(有几单 > 0, '单子列表里有刚才那几张', String(有几单))
  if (有几单 > 0) {
    /* M2 那一屏本身。它原先一行只写得出状态、金额与**一串订单号** ——
       因为列表接口不返回商品名。读的人认不出自己买了什么。 */
    const 一行 = await p.evaluate(() => {
      const d = globalThis.__router.current().data
      return d.page && d.page[0] ? { 名: d.page[0].title, 钱: d.page[0].totalText,
                                     日: d.page[0].whenText, 状: d.page[0].statusText } : null
    })
    ok(!!一行 && !!一行.名 && !/^单 /.test(一行.名),
       '一行写的是买的那个东西，不是订单号', 一行 ? String(一行.名) : '没有')
    ok(!!一行 && /^\d+\/\d+$/.test(一行.日 || ''), '写着哪天买的', 一行 ? String(一行.日) : '没有')

    /* 一页五笔，多了左右翻（设计 10.3：竖向滚动被翻页替掉）。
       六张单子正是为这一条建的 —— 五笔以内翻页永远按不到。 */
    const 页况 = await p.evaluate(() => {
      const d = globalThis.__router.current().data
      return { 页数: d.pageCount, 这页: d.page.length, 页号: d.pageNo }
    })
    ok(页况.页数 > 1, '超过五笔就分页，而不是往下堆', `${页况.页数} 页`)
    ok(页况.这页 <= 5, '一页最多五笔', String(页况.这页))
    if (页况.页数 > 1) {
      await p.getByText('下一页 ›', { exact: true }).click()
      await p.waitForTimeout(400)
      ok(await p.evaluate(() => globalThis.__router.current().data.pageNo) === 1,
         '「下一页」真的翻过去了',
         String(await p.evaluate(() => globalThis.__router.current().data.pageNo)))
      await p.getByText('‹ 上一页', { exact: true }).click()
      await p.waitForTimeout(400)
      ok(await p.evaluate(() => globalThis.__router.current().data.pageNo) === 0,
         '「上一页」也翻得回来',
         String(await p.evaluate(() => globalThis.__router.current().data.pageNo)))
    }

    await shot('07-orders')
    await p.locator('.item').first().click()
    await p.waitForTimeout(1200)
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/order/index',
       '从列表点得进那一张', await p.evaluate(() => globalThis.__router.current().__route))

    /* 列表末尾那条出口。买过东西的人回到这一屏，下一步多半是再去村里看看 ——
       出口点不动的话，这一屏就是条死路。 */
    await open('pages/orders/index')
    await p.waitForTimeout(1200)
    await p.getByText('去村里看看谁能来', { exact: true }).click()
    await p.waitForTimeout(900)
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/village/index',
       '「我买过的」末尾那条出口真的通到村子',
       await p.evaluate(() => globalThis.__router.current().__route))
  }

  /* M1 那一屏本身。上面几条验的是「从它点得出去」，这几条验的是
     **它自己写着什么** —— 设计册 10.4 的 M1 是五条入口 + 一句话 + 最近一笔。 */
  await open('pages/me/index')
  await p.waitForTimeout(1500)
  const 我屏 = await text()
  for (const 条 of ['名字', '我买过的', '我得到的', '订着的', '设置']) {
    ok(我屏.includes(条), `「我的」上有「${条}」这一条`, 条)
  }
  /* 搬走的三块不该还在这一屏上。留一块在这儿,这一屏就又放不下了 ——
     而「放不下」在真机上的样子是【底下那一截看不见】,不是报错。 */
  for (const 不该有 of ['退出并重新登录', '这台设备上的账号']) {
    ok(!我屏.includes(不该有), `「${不该有}」已经不在这一屏上`, 不该有)
  }

  /* 最近一笔写的是【买的那个东西】,不是订单号。
     后端 my_orders 的 title 取自下单那一刻的 sku 快照 ——
     没有它,这一块只显示得出一串 UUID,读的人认不出自己买了什么。 */
  await shot('08-me')
  const 最近 = await p.evaluate(() => globalThis.__router.current().data.recent)
  ok(!!最近, '「我的」上有「最近一笔」', 最近 ? String(最近.title) : '没有')
  if (最近) {
    ok(!!最近.title && !/^单 /.test(最近.title),
       '最近一笔写的是商品名，不是订单号', String(最近.title))
    ok(/^\d\d\/\d\d 下单$/.test(最近.when || ''), '写着哪天下的单', String(最近.when))
    ok(!!最近.state, '写着这单现在什么状况', String(最近.state))
    /* 它得点得进那一张 —— 「最近一笔」若点不动，就只是一块公告。 */
    await p.getByText('看 ›', { exact: true }).click()
    await p.waitForTimeout(1200)
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/order/index',
       '「最近一笔」点得进那一张单',
       await p.evaluate(() => globalThis.__router.current().__route))
  }
}

// ⑫ 底下那条 tab ─────────────────────────────────────────────
/* app.json 里声明了它,而垫片以前整个忽略 —— 真机上它一直占着底下那一条,
   镜像里既不显示也没人能点。切 tab 这个动作因此完全验不到,
   而页面看着是完整的。 */
console.log('\n── 底下那条 tab ──')
errs.length = 0
await open('pages/home/index')
const tabs = await p.evaluate(() => {
  const bar = document.getElementById('wx-tabbar')
  return bar ? { 显示: getComputedStyle(bar).display, 字: [...bar.children].map((c) => c.textContent) } : null
})
ok(tabs !== null, 'tab 条在')
/* 期望值从 app.json 读,不写死。写死过一次:村加进 tab 那天这一条报红,
   红的是断言不是产品,而报告长得跟产品坏了一模一样。 */
const 期望字 = (JSON.parse(readFileSync('mini/miniprogram/app.json', 'utf8')).tabBar?.list || [])
  .map((t) => t.text)
ok(tabs && tabs.字.join('') === 期望字.join(''),
   `${期望字.length} 个 tab 照 app.json`, tabs ? tabs.字.join(' ') : '没有')
if (tabs) {
  await shot('05-tabbar')
  /* tab 的字同样从 app.json 读。写死过一次:「我」改名叫「我的」那天这一条
     报的是 30 秒超时,长得像产品坏了,其实只是断言没跟着改名。 */
  const 字 = (路径) => (期望字[(JSON.parse(readFileSync('mini/miniprogram/app.json', 'utf8'))
    .tabBar.list).findIndex((t) => t.pagePath === 路径)])
  const 我字 = 字('pages/me/index')
  await p.getByText(我字, { exact: true }).click()
  await p.waitForTimeout(400)
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/me/index',
     `点「${我字}」真的切过去了`, await p.evaluate(() => globalThis.__router.current().__route))
  // 村现在是 tab 页(2026-08-19 之前它谁也进不去,全应用唯一的扫码入口就在上面)。
  // 这里【点过去】而不是直开 —— 直开一直都行,不行的正是「从底下点得到」这件事,
  // 而那才是当时缺的东西。
  const 村字 = 字('pages/village/index')
  await p.getByText(村字, { exact: true }).click()
  await p.waitForTimeout(400)
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/village/index',
     `点「${村字}」真的进得去　—— 缺的一直是这一下`,
     await p.evaluate(() => globalThis.__router.current().__route))
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('wx-tabbar')).display) !== 'none',
     '村主屏有 tab 条　—— 它是 tab 页')

  /* 我家弹性槽里的「近几次」点得进那一签。
     这条链是 2026-08-23 加「近几次」时留下的洞：`pages/ask` 那时没有 `onLoad`、
     收不了 id，点进去看到的是起卦页而不是点的那一签 ——
     而镜像没走过它，所以一路绿着。有了这一条它才守得住。 */
  await open('pages/home/index')
  await p.waitForTimeout(900)
  const 近几次 = await p.evaluate(() => (globalThis.__router.current().data.recent || []).length)
  if (!近几次) {
    console.log('  · 跳过「近几次」：这个号还没转过卦（不计入通过）')
  } else {
    const 头一条 = await p.evaluate(() => globalThis.__router.current().data.recent[0].id)
    await p.locator('.recent-row').first().click()
    await p.waitForFunction(
      () => globalThis.__router.current().__route === 'pages/ask/index'
        && globalThis.__router.current().data.mode === 'history-detail',
      null, { timeout: 15000 },
    ).catch(() => {})
    const 落 = await p.evaluate(() => {
      const c = globalThis.__router.current()
      return { 路由: c.__route, 模式: c.data.mode, 签: c.data.result && c.data.result.id }
    })
    ok(落.路由 === 'pages/ask/index' && 落.模式 === 'history-detail' && 落.签 === 头一条,
       '「近几次」点进去看到的是点的那一签　—— 不是起卦页',
       `${落.路由} · ${落.模式} · ${落.签} vs ${头一条}`)
  }
  /* 回到 tab 页再往下 —— `pages/ask` 不是 tab 页，那里没有 tab 条，
     下一步要点的「我家」根本不在屏上。 */
  await open('pages/village/index')
  await p.waitForTimeout(600)

  /* 「命」与「问」不再是 tab（docs/REDESIGN.md R0），它们从我家进去。
     这两下是 R0 的核心断言：旧功能一个不少，仍然到得了。
     ——放在这里而不是放进 `if (API && MINGLI)` 里：它们只跟导航有关，
     不需要排盘服务。第一版放错了地方，于是那两条从来没跑过，
     而报告里的条数一动不动，看着跟「跑了并通过」一模一样。 */
  const 我家字 = 字('pages/home/index')
  await p.getByText(我家字, { exact: true }).click()
  await p.waitForTimeout(400)
  /* 按状态分支，不硬点一个可能不在的按钮。

     有本命时：罗盘**就在这一屏上**，不用再跳一次 —— 这正是「问不再是一个地方」
     那句话的落点。原先这里点的是「转一下」，那是罗盘还没搬过来时
     我家通往起卦页的入口；罗盘搬进来之后它就不存在了。
     而这一支**只在接上排盘服务时才会走到**，所以它一直没红过 ——
     又一处看着绿、其实没跑过（2026-08-23 接上 6027 当场暴露）。 */
  if (await p.evaluate(() => !!globalThis.__router.current().data.summary)) {
    const 就在这屏 = await p.evaluate(() => {
      const 文 = (document.getElementById('app').innerText || '')
      return { 有罗盘: 文.includes('纳吉'), 还在这页: globalThis.__router.current().__route }
    })
    ok(就在这屏.有罗盘 && 就在这屏.还在这页 === 'pages/home/index',
       '有本命时，罗盘就在我家这一屏上　—— 问不再是一个地方，不用再跳一次',
       `${就在这屏.还在这页} · ${就在这屏.有罗盘 ? '罗盘在' : '没找到罗盘'}`)
  } else {
    /* 没本命时验空态那一支：它也得走得通，而且走的是另一条路。 */
    await p.getByText('先填生辰', { exact: true }).click()
    await p.waitForFunction(
      () => globalThis.__router.current().__route === 'pages/natal/index',
      null, { timeout: 15000 },
    ).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/natal/index',
       '我家空态那颗「先填生辰」是真出口　—— 不是一颗灰着点不动的按钮',
       await p.evaluate(() => globalThis.__router.current().__route))
  }

  await open('pages/home/index')
  /* 通往生辰那一页的入口在两个状态下是两颗不同的东西：
     还没建过 → 「先填生辰」；建过了 → 「展开看盘 ›」。
     守的是同一条性质:命不再是 tab 之后的新路,从我家一下就到。
     原先只点「先填生辰」,而**有本命那一支只在接上排盘服务时才走得到**,
     于是它一直没红过。 */
  const 有盘 = await p.evaluate(() => !!globalThis.__router.current().data.summary)
  const 入口 = 有盘 ? p.getByText('展开看盘', { exact: false }).first()
                    : p.getByText('先填生辰', { exact: true })
  await 入口.click()
  await p.waitForTimeout(400)
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/natal/index',
     `我家「${有盘 ? '展开看盘' : '先填生辰'}」进得去生辰　—— 命不再是 tab 之后的新路`,
     await p.evaluate(() => globalThis.__router.current().__route))
  // 反过来那一半:不在 tab 上的页,底下不该有这条。少了这一条的话,
  // 「tab 条永远显示」这种垫片退化也能全绿。
  await open('pages/room/index')
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('wx-tabbar')).display) === 'none',
     '屋里没有 tab 条　—— 它不是 tab 页,真机上那里也没有')
} else {
  // tab 条都不在,就别去点它 —— 那会卡满三十秒再抛栈,看着像门禁自己坏了
  ok(false, '点「我」真的切过去了', 'tab 条都不在,没得点')
  ok(false, '村主屏有 tab 条', '同上')
  ok(false, '屋里没有 tab 条', '同上')
}

// ⑬ 只有真机才有的那几样，必须【抛】────────────────────────────
/* 镜像的第 2 条铁律：只有真机才有的能力，抛，不给空实现 ——
   空实现会让这一步在网页上「成功」而真机上根本没发生。

   这一条以前只写在文档和垫片的注释里，没有任何东西盯着它。
   谁哪天给 `wx.login` 补一个假的返回，镜像就会开始【假装验过】
   升级微信账号这条只有真机才走得通的动线，而所有检查照样全绿。 */
console.log('\n── 只有真机才有的那几样，抛了吗 ──')
for (const api of ['login', 'scanCode', 'getUserProfile']) {
  const r = await p.evaluate((name) => {
    try { globalThis.wx[name]({}); return '没抛' } catch (e) { return String(e.message || e) }
  }, api)
  ok(r !== '没抛' && /真机|device/i.test(r), `wx.${api} 抛了,而且说清是真机的事`, r.slice(0, 34))
}
/* 顺带验一次它在页面里的样子:点「绑定微信」不该看起来成功了。
   这条与上面互补 —— 上面查垫片,这里查【页面拿到之后没把它糊过去】。 */
/* 表单搬去自己一屏了（M1 上它一块 372px，没有一台机器放得下那一屏）。
   所以这里先按【真实走法】走进去：我的 → 设置 → 绑定微信。 */
await open('pages/me/index')
await p.getByText('设置', { exact: true }).click()
await p.waitForTimeout(900)
await p.getByText('绑定微信', { exact: true }).click()
await p.waitForFunction(
  () => globalThis.__router.current().__route === 'pages/bind/index',
  null, { timeout: 15000 },
).catch(() => {})
ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/bind/index',
   '「设置」点得进「绑定微信」那一屏',
   await p.evaluate(() => globalThis.__router.current().__route))
/* 昵称这一栏以前是 setData 塞进去的 —— 那样验的是「数据放对了没」，
   不是「这一栏能不能打字」。onNickname 从没被调用过。 */
const nk = p.locator('input[type="nickname"], .nick-input').first()
if (await nk.count() >= 1) {
  await nk.fill('试试')
  await p.waitForTimeout(200)
  ok(await p.evaluate(() => globalThis.__router.current().data.draft.nickname) === '试试',
     '昵称打进了 draft.nickname', 'bindinput → draft.nickname')
} else {
  ok(false, '昵称打进了 draft.nickname', '输入框都不在')
  await p.evaluate(() => globalThis.__router.current().setData({ 'draft.nickname': '试试' }))
}
/* 按【按钮】,不是按文字 —— 这一屏的标题也叫「绑定微信」,
   按文字会同时选中标题与按钮,Playwright 直接判违规。 */
await p.getByRole('button', { name: '绑定微信' }).click()
await p.waitForTimeout(800)
ok(await p.evaluate(() => !globalThis.__router.current().data.isWx),
   '点「绑定微信」之后仍然是匿名　—— 这条只有真机走得通')
/* 绑不成之后最自然的下一下就是「回去」，而新开的屏最容易漏掉的也是它。 */
await p.getByText('回去', { exact: true }).click()
await p.waitForTimeout(700)
ok(await p.evaluate(() => globalThis.__router.current().__route) !== 'pages/bind/index',
   '绑定那一屏上的「回去」退得出去',
   await p.evaluate(() => globalThis.__router.current().__route))

/* 只在打真后端时验:假服务端没有 /v1/auth/anonymous,那边根本没有「人」可换。 */
if (API) {
  /* 「退出并重新登录」对匿名用户是【换一个人】：清掉 token 之后 ensureLogin
     拿不到 token 就发一个全新的匿名身份，村子和本命一起没。
     这里【不判断该不该这样】——那是身份策略，写在
     docs/FINDING-2026-08-18-匿名用户三十天后村子回不来.md 里等拍板。
     这条只钉住【现状是什么】：换了人。哪天改成不换了，它会红，那正是该看一眼的时候。 */
  await open('pages/settings/index')
  await p.waitForTimeout(900)
  const 退出前 = await p.evaluate(() => globalThis.__router.current().data.user && globalThis.__router.current().data.user.id)
  await p.getByText('退出并重新登录').click()
  await p.waitForTimeout(2200)
  const 退出后 = await p.evaluate(() => globalThis.__router.current().data.user && globalThis.__router.current().data.user.id)
  ok(!!退出前 && !!退出后 && 退出前 !== 退出后,
     '「退出并重新登录」当场换成另一个匿名身份　—— 现状如此，待拍板',
     `${String(退出前).slice(0, 14)}… → ${String(退出后).slice(0, 14)}…`)

  /* 换成新人之后他一笔单也没有 —— 这一趟里唯一能看到【空状态】的时刻。
     空不是问题，说不清哪儿能有才是：那一块得点得动，且通到村子。 */
  await open('pages/me/index')
  await p.waitForTimeout(1600)
  const 空态 = await p.evaluate(() => globalThis.__router.current().data.recentEmpty)
  ok(空态 === true, '换了人之后「最近一笔」是空状态', String(空态))
  if (空态) {
    await p.getByText('去 ›', { exact: true }).click()
    await p.waitForTimeout(900)
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/village/index',
       '空着的时候那一块指得出「哪儿能有」，而且点得过去',
       await p.evaluate(() => globalThis.__router.current().__route))
  }
}

// ⑭ 后端不响应时，页面说不说得出话 ───────────────────────────────
/* 手机上网络抖一下是常态,而这条从没验过。

   本命页原先把【任何】一次请求失败都渲成建本命的表单 —— 用户明明建过,
   照着填下去就多一条重复记录,起因只是一次网络抖动。
   今日页把「取不到盘」和「你还没建本命」显示成同一件事。
   两处都是 fallback 把「数据不存在」这个信号吃掉了。

   这里把 /v1/** 全打成 500(登录放行,否则连页面都进不去),
   看每一页说不说得出「取不到」,以及【不再】劝你去建一个已经有的东西。 */
console.log('\n── 后端不响应时，页面说不说得出话 ──')
await p.route('**/v1/**', (r) => (r.request().url().includes('/auth/')
  ? r.fulfill({ status: 200, contentType: 'application/json',
                body: JSON.stringify({ token: 't', user: { id: 'u_err', active_natal_id: 'n_x' }, expires_in: 99999 }) })
  : r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal","code":"internal"}' })))

for (const [route, 该说, 不该说] of [
  ['pages/village/index', '取不到村子', null],
  ['pages/home/index', '取不到今天的对照', '先输入生辰'],
  ['pages/natal/index', '取不到本命', '出 生 日'],
  /* 近签那一块从问签页搬到了我家的弹性槽（REDESIGN.md）。
     它要守的性质一点没变、只是换了地方：**取不到**跟**一签都没问过**
     长得不能一样 —— 前者说一句，后者什么都不显示。
     （原先它在问签页上是整块 `wx:if="{{history.length > 0}}"`，
     取不到时整块消失，而 catch 是空的，连一句话都不说。） */
  ['pages/home/index', '近几次取不到', null],
]) {
  await open(route)
  /* 我家那一屏要的前提是「app 认为你有本命,而服务端不给盘」。
     这个前提【不能靠环境凑】:打真后端时那个匿名用户本来就没有本命,
     于是它显示引导是对的,检查却会红 —— 本机绿、CI 红,而红的是检查不是产品。
     所以这里自己把前提摆好,再让它重取一次。 */
  if (route.includes('home')) {
    await p.evaluate(() => {
      getApp().globalData.activeNatalId = 'n_x'
      globalThis.__router.current().refreshSummary()
    })
    await p.waitForTimeout(600)
  }
  const t = await text()
  const 名 = route.replace('pages/', '').replace('/index', '')
  ok(t.includes(该说), `${名}　说得出「${该说}」`, t.slice(0, 40))
  if (不该说) {
    ok(!t.includes(不该说), `${名}　不再劝你去建一个已经有的东西`,
       t.includes(不该说) ? `还在渲「${不该说}」` : '')
  }
}

/* 设计册 10.7 末尾那条【写死的】规则：
   **任何一屏都不许整屏换成错误页。错误只替换取不到的那一段，其余照常可用。**
   理由写在它后面：这个产品的主屏是一幅画 —— 画是本地的，
   不该因为一句话没取到就消失。

   上面那一圈验的是「说不说得出取不到」，那是另一件事：
   一屏可以既说得出「取不到村子」，又把整幅画一起抹掉 —— 两条都得验。 */
for (const [route, 什么, 量] of [
  ['pages/village/index', '村子那幅画',
    () => {
      const c = document.querySelector('canvas')
      if (!c) return 0
      const g = c.getContext('2d')
      const d = g.getImageData(0, 0, c.width, Math.min(400, c.height)).data
      let ink = 0
      for (let i = 3; i < d.length; i += 4) if (d[i]) ink++
      return ink
    }],
  /* 我家那一屏同理：10.7 明说「罗盘先出、用神那三行占位」「罗盘可转，
     结果那块单独报错」—— 也就是取不到盘的时候，罗盘照样在、照样转。 */
  ['pages/home/index', '我家的罗盘',
    () => document.querySelectorAll('.compass-face .ring').length],
]) {
  await open(route)
  await p.waitForTimeout(2500)
  const 还在 = await p.evaluate(量)
  const 说了 = (await text()).includes('取不到')
  ok(还在 > 0, `后端全挂时，${什么}还在　—— 不许整屏换成错误页`,
     `${还在 > 0 ? '还在' : '没了'}（这一屏${说了 ? '同时说了「取不到」' : '连话都没说'}）`)
}
await p.unroute('**/v1/**')

// ⑮ 一帧要多久 ─────────────────────────────────────────────────
/* 第 09 步那条门禁写的是「真机 30fps 以上」。真机进不了 CI,而【一帧的开销】
   在浏览器里量得到,它正是那条门禁真正问的事:画得过来吗。

   量的是什么,说清楚:
     · 这是浏览器,不是手机。真机那条门禁仍然要人拿手机跑
     · 它抓得住「某次改动让某间房慢了十倍」,而那正是最容易溜过去的那种回归

   ── 为什么比【倍数】不比毫秒 ──────────────────────────────────
   第一版用的是绝对阈值(12ms),在开发机上全绿,推上 CI 全红 ——
   CI 的机器慢 10 到 50 倍(这台 popo 3.13ms,CI 上 30.85ms)。
   绝对毫秒是【绑机器】的,这仓库在视觉基准上已经栽过同一种坑:
   基准绑那台笔记本,拿到 CI 全红,所以 CI 改用 selfcheck / compare。同一课重上一遍。

   现在的做法:同一次运行里先量一个【标定负载】(一片同尺寸画布上做定量的
   fillRect + drawImage,与房间走同一套 canvas 2D 路径),再把每间房的开销
   换算成它的倍数。

   ── 倍数并不是恒定的,实测如此,别当成恒定 ──────────────────
   开发机与 CI 各量一遍(CI 慢 7.3 倍:标定 1.77ms vs 12.92ms):

                标定倍数
                本机    CI
       村子      0.6×   0.5×
       bailu     0.1×   1.2×
       shenyan   0.1×   1.1×
       tao       0.1×   1.6×
       ayun      0.2×   1.7×
       tenz      0.2×   1.6×
       popo      1.7×   2.4×

   轻的那几间在慢机器上倍数明显变大 —— 一帧里有一部分是【每次调用的固定开销】,
   它不随机器线性缩放,而标定负载是吞吐主导的。所以倍数只是【有界】,不是相等。

   这决定了这道门禁能抓什么、不能抓什么,说清楚:
     · 能抓:某间房慢一个数量级(最重的 popo 现在 2.4×,阈值 12×)
     · 抓不住:三倍级的退化 —— 那落在两台机器的自然差异里
   要抓更细的,得先把「同一台机器上的历史值」存下来比,那是另一件事。 */
console.log('\n── 一帧要多久（开发机浏览器，不是手机）──')
await open('pages/village/index')
const cost = await p.evaluate(() => {
  const out = {}
  // 房间每帧要那颗表演按钮(引擎的保护)。这里是离开页面单独量开销,给个桩。
  const origBtn = globalThis.ENGINE_HOST.button
  let label = '起卦'
  globalThis.ENGINE_HOST.button = () => ({ onTap() {}, getLabel: () => label, setLabel: (s) => { label = s } })
  const time = (fn, n) => {
    for (let i = 0; i < 8; i++) fn()
    const t0 = performance.now()
    for (let i = 0; i < n; i++) fn()
    return +((performance.now() - t0) / n).toFixed(2)
  }
  /* 标定负载:与房间同尺寸的画布上做定量的 fillRect + drawImage。
     刻意走【同一套 canvas 2D 路径】—— 换成算数或字符串操作的话,
     机器之间的比例关系跟画画不一样,标定就不成立了。
     量级也要跟一帧【差不多】:第一版只画 400 个矩形,本机上 0.07ms,
     于是婆婆房算出 47 倍 —— 分母太小,倍数没有分辨率,也放大了抖动。 */
  const cal = document.createElement('canvas'); cal.width = 1440; cal.height = 2560
  const cg = cal.getContext('2d')
  const stamp = document.createElement('canvas'); stamp.width = 64; stamp.height = 64
  const sg = stamp.getContext('2d'); sg.fillStyle = '#c85a48'; sg.fillRect(0, 0, 64, 64)
  const calib = time(() => {
    for (let i = 0; i < 6000; i++) {
      cg.fillStyle = i % 2 ? '#3a2c20' : '#e8b23d'
      cg.fillRect((i * 37) % 1300, (i * 71) % 2400, 90, 70)
    }
    for (let i = 0; i < 1500; i++) cg.drawImage(stamp, (i * 53) % 1300, (i * 91) % 2400)
  }, 12)
  out.__calib = calib

  const S = globalThis.VILLAGE_SIZE
  const vc = document.createElement('canvas'); vc.width = S.w; vc.height = S.h
  const vg = vc.getContext('2d')
  let t = globalThis.ENGINE_HOST.now()
  out['村子'] = time(() => globalThis.VILLAGE_FRAME(vg, t += 60), 40)
  for (const id of globalThis.ROOM_INDEX) {
    const room = globalThis[id.toUpperCase() + '_ROOM']
    const fr = globalThis[id.toUpperCase() + '_FRAME']
    if (!room || !fr) { out[id] = -1; continue }
    const cv = document.createElement('canvas'); cv.width = room.w; cv.height = room.h
    const g = cv.getContext('2d')
    let tt = globalThis.ENGINE_HOST.now()
    out[id] = time(() => fr(g, tt += 60, cv), 30)
  }
  globalThis.ENGINE_HOST.button = origBtn
  return out
})
/* 阈值 12 倍标定负载。两台机器上最重的都是婆婆房,本机 1.7×、CI 2.4×,
   留五倍余量 —— 够宽,不会因为机器快慢而红;又抓得住数量级的回归。 */
const CAL = cost.__calib
const RATIO = 12
console.log(`  标定负载 ${CAL} ms（这台机器的基准，倍数就是按它算的）`)
if (!(CAL > 0)) {
  ok(false, '标定负载没量到', '倍数无从算起')
} else {
  for (const k of Object.keys(cost)) {
    if (k === '__calib') continue
    const r = +(cost[k] / CAL).toFixed(1)
    ok(cost[k] >= 0 && r < RATIO, k, cost[k] + ' ms = ' + r + '× 标定')
  }
}

/* 断言【这一趟真的验了东西】。
   这仓库已经为 cargo test 装过同一道护栏(backend.yml 的
   「assert the db-backed tests actually ran」)—— 起因是本地出现过
   「15 passed,其实一个没跑」。一支什么都没做也印「动线全通」的脚本,
   比没有脚本更糟。

   条数:六页 + 村主屏 4 + 空屋 3 + 住着 3 + 出签 2 + 没搬进来 2 + 进屋 3
   + 一帧开销 7,再加打真后端时的入住 1。少于 30 说明有整段没跑到。 */
const LEAST = 30

/* 这一趟到底碰了多少交互。页面上用 bindtap 之类声明的处理器是分母，
   运行时记下真被调用过的是分子（web/runtime/page.js 的 markFired）。
   **只报数不拦**：没碰过不等于坏了，但「哪些从没被验证过」以前没人知道，
   而不知道的那部分正是出事的地方。 */
/* 后端路由表 vs 这一趟真打过的。路由表从源码里读 —— 写死一份清单
   过两天就不准了，而不准的覆盖率比没有覆盖率更坏。 */
const 路由 = []
for (const f of readdirSync('backend/unmei-api/src/routes')) {
  if (!f.endsWith('.rs')) continue
  for (const line of readFileSync('backend/unmei-api/src/routes/' + f, 'utf8').split('\n')) {
    const m = line.match(/\.route\(\s*"([^"]+)"\s*,\s*(.+)$/)
    if (!m) continue
    for (const v of m[2].matchAll(/\b(get|post|patch|put|delete)\(/g)) 路由.push(v[1].toUpperCase() + ' ' + m[1])
  }
}
const 归一 = (x) => {
  const [v, path] = x.split(' ')
  for (const r of 路由) {
    const [rv, rp] = r.split(' ')
    if (rv !== v) continue
    const re = new RegExp('^' + rp.replace(/:[a-z_]+/g, '[^/]+') + '$')
    if (re.test(path)) return r
  }
  return null
}
/* 孤儿名单从台账读,不在这里另抄一份。
   **参数名要抹掉再比**:台账里写的是 `/v1/payments/:x`,路由上是 `:id` ——
   两边指同一条路,照字面比就对不上,然后它常驻在「没打过」那一行里。 */
const 抹参 = (path) => path.replace(/:[a-z_]+/g, ':x')
const 孤儿 = new Set(Object.keys(
  JSON.parse(readFileSync('scripts/orphan-routes.json', 'utf8'))['后端有前端没人调']['小程序 → unmei-api'] || {},
).map(抹参))
/* 另一节:封装在、没有页面用它。台账那里按【封装名】记，
   所以这里把它对应的那条路由列出来 —— 一行一条,理由仍旧在台账。
   2026-08-27 起是空的：`village.all` 有了调用方（「谁能来」列四十位）。 */
const 只有封装 = new Set([])
const 命中 = new Set([...打过].map(归一).filter(Boolean))
const 全部 = [...new Set(路由)]
/* 本机打不到的那几条 —— 一条一个理由。
   列出来是为了让分母诚实：不算成「验过了」，也不让它们常驻在「没打过」
   那一行里。一份永远有几条的名单，看的人很快就不看了。 */
const 打不到规则 = [
  [(r) => r.includes('/auth/wx/'), '微信登录要真机'],
  [(r) => r.includes('/webhooks/'), '回调由外部服务打进来'],
  /* `wx.request` 没有 PATCH,所以 `api.patch` 发的是 POST,后端把 POST
     挂在同一个 handler 上（见 services/mine.ts 那段注释）。
     也就是说这条**这个客户端永远发不出**,不是这一趟漏了。 */
  [(r) => r === 'PATCH /v1/user/me', 'wx.request 没有 PATCH，客户端走的是同一 handler 的 POST'],
  /* 孤儿:后端有、没有任何客户端调它。理由不在这里重写一遍 ——
     它们各自记在 `scripts/orphan-routes.json` 里,那份台账自己有门禁守着。
     从那里读,两处才不会分头漂。 */
  [(r) => 孤儿.has(抹参(r.split(' ')[1])), '没有客户端调它（孤儿台账里记着理由）'],
  [(r) => 只有封装.has(r), '封装在、没有页面用它（孤儿台账「封装在没有页面用」那一节）'],
  [(r) => r === 'GET /v1/health', '存活探针，不属于任何页面的动线'],
  /* 这三条要一笔【真付款】。付款只有真机有 —— 跟处理器那一侧
     order·onTrace / order·onRefund 说的是同一件事。 */
  [(r) => r === 'POST /v1/orders/:id/refund'
       || r === 'GET /v1/orders/:id/shipments/:sid/trace',
   '要一张已付的单，而付款只有真机有'],
]
const 打不到 = (r) => 打不到规则.some(([f]) => f(r))
const 该打的 = 全部.filter((r) => !打不到(r))
const 打不到的 = 全部.filter(打不到)
const 漏的 = 该打的.filter((r) => !命中.has(r))
console.log('')
console.log('── 后端路由，这一趟打过几条 ──')
console.log(`  ${该打的.length - 漏的.length}/${该打的.length} 条（另有 ${打不到的.length} 条本机打不到，逐条记着理由）`)
if (漏的.length) console.log('  没打过的：' + 漏的.join(' · '))
for (const r of 打不到的) {
  const why = (打不到规则.find(([f]) => f(r)) || [])[1]
  console.log(`  · ${r} 打不到：${why}`)
}

const declared = []
for (const dir of readdirSync('mini/miniprogram/pages')) {
  const f = `mini/miniprogram/pages/${dir}/index.wxml`
  if (!existsSync(f)) continue
  const src = readFileSync(f, 'utf8')
  const re = /(?:bind|catch):?(?:tap|change|input|confirm|submit|longpress|touchstart|scrolltolower)\s*=\s*"([^"{}]+)"/g
  for (const m of src.matchAll(re)) declared.push(`pages/${dir}/index#${m[1]}`)
}
const fired = new Set(await p.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('__unmei_fired') || '[]') } catch { return [] }
}))
const uniq = [...new Set(declared)]
const missed = uniq.filter(d => !fired.has(d))
console.log('')
console.log('── 页面上的交互，这一趟碰过几个 ──')
console.log(`  ${uniq.length - missed.length}/${uniq.length} 个处理器被真的调用过`)
/* 有几个在浏览器里【本来就碰不到】—— 写清原因，不然「没碰过」看着像漏了。
   规矩：只有「浏览器里没有对应的东西」才配写进这里；
   「还没写动线」不算，那种就该去补动线。 */
const 碰不到 = {
  'pages/order/index#onTrace': '要一张已付、且有包裹的单子；到 paid 必须真付款，付款只有真机有',
  'pages/order/index#onRefund': '同上 —— 退款要一笔真的成功支付',
}
const 真漏的 = missed.filter((m) => !碰不到[m])
if (真漏的.length) {
  console.log('  没碰过的：' + 真漏的.map(m => m.split('/')[1] + '·' + m.split('#')[1]).join(' '))
}
for (const m of missed) {
  if (碰不到[m]) console.log(`  · ${m.split('/')[1]}·${m.split('#')[1]} 碰不到：${碰不到[m]}`)
}
if (真漏的.length === 0 && missed.length) {
  console.log('    （这几条的接口那一侧由 scripts/verify-semantics.sh 的 O 段用真数据验）')
}

console.log('')
console.log(`共验了 ${ran} 条`)
if (ran < LEAST) {
  console.log(`✗ 只验了 ${ran} 条，少于 ${LEAST} —— 有整段没跑到，这时候的「全通」不算数`)
  failed++
}
console.log(failed ? `✗ ${failed} 条不过` : '✓ 动线全通')
if (errs.length) console.log('页面错误：', [...new Set(errs)].slice(0, 5))
await b.close()
process.exit(failed ? 1 : 0)
