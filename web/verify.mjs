#!/usr/bin/env bun
/* 把动线在移动网页版上【跑完】—— 这是这套镜像存在的全部理由。
 *
 * 小程序那几条门禁写的是「真机」,而真机这一环没法机检。镜像把其中
 * 能在浏览器里发生的那部分变成可机检的：点一格空宅基会不会说「等人」、
 * 点住着的那格能不能问出签、进屋进不进得去、房间画不画得出来。
 *
 * ── 关于假服务端 ────────────────────────────────────────────────
 * 后端要 Postgres,本机不一定起着，所以这里【拦掉 HTTP,喂固定响应】。
 * 这件事必须显式写在验证脚本里，不能藏进垫片：
 *   - 走的仍是页面 → services/api.ts → wx.request → fetch 这条真路，
 *     只有最后那一跳被换成固定数据
 *   - 所以这里验的是【前端这一侧】。字段与状态码对不对得上后端，
 *     由 scripts/check-api-shape.py 另外机械核对
 * 带 --api=<base> 就不拦，打真后端。
 *
 * 用法：
 *   bun web/verify.mjs                    用假服务端
 *   bun web/verify.mjs --api=http://127.0.0.1:6028
 *   bun web/verify.mjs --shots=<目录>      顺便留截图
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'

const arg = (k, d) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '=' + d).split('=').slice(1).join('=')
const BASE = arg('base', 'http://127.0.0.1:6031')
const API = arg('api', '')
// 排盘服务(另一个仓库)。给了就把「建本命」那一段真验到底，不给就明说跳过
const MINGLI = arg('mingli', '')
const SHOTS = arg('shots', '')
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

// ── 假服务端。住着 3 位：阿云(有房间)、白鹭(有房间)、陈九(没房间) ──
const HOME = ['ayun', 'bailu', 'chenjiu']
const NAMES = {
  ayun: '阿云', tao: '桃桃', popo: '婆婆', tenz: '丹增', shenyan: '沈砚', bailu: '白鹭',
  chenjiu: '陈九', suhe: '苏合', jiangya: '姜牙', xuanming: '玄冥',
}
const FAKE = {
  /* 名下的本命，空的 —— 这是「还没建过」的真实回答(真后端给 []),
     不是 404。少了这条的话本命页会认为【取不到】而不是【没有】,
     于是不给表单 —— 那正是产品该有的分寸，却让桩显得像坏了。 */
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
    { id: 'suhe', name: '苏合', title: '调香的', art: '八字', rarity: '珍',
      omamori_product_id: null },
  ],
  /* 订着的。空数组是「一个都没订」的真实回答（真后端给 []），不是 404 ——
     而 M5 那一屏的主设计就是这个空状态（设计册 10.7）。
     少了这条它停在错误态，空状态那一支反而永远验不到。 */
  '/v1/subscriptions': () => [],
  /* 点香是几点。少了这条，不到点那一句话整条不摆（屏上那句是按它生成的），
     于是「不到点时那一槽只是一句话」那条断言就落在一片空白上。
     数照后端的默认值来:周四（0=周一，故 3）晚九点、二十五分钟。 */
  '/v1/incense/schedule': () => ({ weekday: 3, hour: 21, minutes: 25 }),
  /* 线下活动（2026-09-03 报名这条链接上之后才有这一屏）。
     少了这两条它停在错误态 —— 而错误态只剩一行字，一屏那一支照报
     「放得下」，实际那一页这一趟根本没量到版式（跟上面名册那条同一个坑）。
     两场：一场还差人、一场满了 —— 满场那颗按钮按不动，
     而「按不动的按钮长什么样」只有真有一场满了才量得到。 */
  '/v1/activity': () => ({
    items: [
      { id: 'a_gw', title: '古物市集·夏至专场', sub_title: '匠心手作 · 古物古玩',
        category: 'market', banner_url: null, city: '杭州',
        start_at: new Date(Date.now() + 86400000 * 10).toISOString(),
        max_participants: 100, current_count: 48, price_display: '免费', status: 'open' },
      { id: 'a_xd', title: '香道入门课', sub_title: '三日浸修 · 从识香到调香',
        category: 'course', banner_url: null, city: '上海',
        start_at: new Date(Date.now() + 86400000 * 35).toISOString(),
        max_participants: 20, current_count: 20, price_display: '¥980.00', status: 'open' },
    ],
  }),
  '/v1/activity/mine': () => ({ activity_ids: [] }),
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
    /* 【2026-09-01 跟真后端拼出来的形状对齐】。
       原先写的是「贫道看你今日该动了，宜问路、会友，忌久坐」——
       文言（贫道 / 今日）加黄历行话（宜 / 忌），而这两样都改掉了。
       假服务端的响应要照着真后端【现在】拼出来的样子写，不然
       在这一档上验的是一份早就不存在的输出。 */
    say: '眯着眼看了一眼……该动了。眼下呢，今天适合问路、会友；先别久坐……就这样。别问了，困',
  }),
}

let failed = 0
let ran = 0
/* 失败【立刻落盘】。
   这一支跑几百个断言、几十秒，中途浏览器要是被拖垮（机器负载高时会），
   进程直接抛异常退出 —— 而 gates.sh 只留最后六行输出，
   于是「有一条断言失败了」这件事有，「是哪一条」却拿不到。
   2026-08-30 就卡在这儿：知道假服务端档挂了一条，三次重跑都没跑到那一步。

   写文件是【追加】的：崩在第几条，前面失败过的就都还在。 */
const 失败册 = process.env.VERIFY_FAILLOG || '/tmp/verify-failures.txt'
try { writeFileSync(失败册, '') } catch { /* 写不了就算了，控制台照旧 */ }
const ok = (cond, what, extra) => {
  ran++
  console.log((cond ? '  ✓ ' : '  ✗ ') + what + (extra ? '　' + extra : ''))
  if (!cond) {
    failed++
    try { appendFileSync(失败册, `✗ ${what}${extra ? '　' + extra : ''}\n`) } catch { /* 同上 */ }
  }
  return cond
}

/* 用 Playwright 自带的 chromium，【不要】装机版 Chrome。
   08-30 实测：`channel: 'chrome'` 拉起来的进程活二三十秒就挨 SIGKILL ——
   不是崩（没有崩溃报告）、也不是内存（当时空着 67%）。同一台机器同一份页面，
   自带 chromium 连跑 30 轮 46 秒无事，装机版 22 轮就没。差别只有这一个开关。
   机器上跑着 GoogleUpdater，而它更新时会清掉所有共用那个 app bundle 的实例。
   症状很难认：门禁连着报红，而失败账是空的（一条断言都没红），
   于是「跑不完」跟「动线断了」在总账上长得一模一样。
   验证工具本来就不该押在用户那份浏览器上 —— 自带的这份就是为可复现装的。 */
const b = await chromium.launch()
/* 主页面走【自己的 context】，不用 `browser.newPage()` 的那个临时 context ——
   下面几段冷启动检查各开一个 context 再关掉，而临时 context 会被那几下
   连带清理掉，主流程随后第一个 `open()` 就报「browser has been closed」。
   报出来的位置在 open 里，看着像页面的问题，其实是这一行的。 */
const 主场 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const p = await 主场.newPage()

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
   房间挂载时就把 raf 抓进闭包了，之后再包就包不到。
   用它验「退出房间不再烧帧」:一个没停下来的渲染循环在手机上就是耗电，
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
/* 只看【失败的】请求会漏掉最要紧的一种：**根本没发出去的那条**。
   追登录那个 flaky 时兜了五层圈子，就因为「没有失败」被当成了「都正常」。 */
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
   走的是【真的入住路径】:在库里发一张御守凭据，再让页面调 /v1/omamori/scan。
   不直接往 villager_residency 插一行 —— 那样绕过了入住这件事本身，
   而入住正是这条链要验的一环。

   凭据得进库，库在 docker 里，所以这一步用 docker exec。
   这是【测试夹具】,写在验证脚本里、看得见，不藏在垫片或产品代码里。 */
/* 怎么连库，两边不一样，所以这里认一个环境变量：
     PSQL_URL 设了 —— 直接用 psql 打它(CI 里 postgres 是服务容器，
                      runner 上有 psql,没有一个叫 unmei-postgres 的容器)
     没设     —— docker exec 进本机那个容器(scripts/setup-dev.sh 起的那个)
   不认这个变量的话，同一支验证脚本在两个地方要写两份夹具，而两份会漂。 */
const { execFileSync } = await import('child_process')
const PSQL_URL = process.env.PSQL_URL || ''
const run = (sql) => PSQL_URL
  ? execFileSync('psql', [PSQL_URL, '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'pipe' })
  : execFileSync('docker', ['exec', 'unmei-postgres', 'psql', '-U', 'unmei', '-d', 'unmei',
                            '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'pipe' })
/** 只要一个值。-tA = 去表头去对齐，拿到的就是那个值本身 */
const sql1 = (q) => String(PSQL_URL
  ? execFileSync('psql', [PSQL_URL, '-tAc', q], { stdio: 'pipe' })
  : execFileSync('docker', ['exec', 'unmei-postgres', 'psql', '-U', 'unmei', '-d', 'unmei',
                            '-tAc', q], { stdio: 'pipe' })).trim()

async function mintCredential(villagerId) {
  const oid = 'oma-verify-' + villagerId
  const cred = 'VERIFY-' + villagerId.toUpperCase()
  /* 幂等插入，【不删】。第一版是先删再插，第二次跑就撞外键：
     上一次的入住记录还引用着那张御守。
     不删也没关系 —— 每次跑都是一个【新的匿名用户】(浏览器上下文是干净的),
     入住记录按用户算，所以「扫完收集数变了」照样成立。 */
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
        // 没请回家的问签是 404 —— 这条契约前端在用，假服务端也得照做，
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

// 点村子画布上的某一格宅基 —— 坐标由引擎给，不在这里另算一份
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
    } catch { /* 还没起来，再等 */ }
    if (!热了) await new Promise((r) => setTimeout(r, 500))
  }
  if (!热了) {
    console.log(`✗ 后端热不起来（${API}）—— 这一趟没法验，别当它过了`)
    process.exit(1)
  }
  console.log(`  （后端热好了，用了 ${Date.now() - t0}ms）`)
}



/* 【取不到村子的时候，屏上不许说「还都空着」】（2026-09-02 第三轮评审）。
   那张开场白卡原先只看 `!lived`，而取不到时 `lived` 停在 0 ——
   断网冷启动看到的是一个「正常的空村子」，然后被引去花 ¥99;
   已经有村民的人断网重进，屏上写的跟他昨天看到的正好相反。
   真话被挤到画布下面、字号最小、还没有重试。 */
async function 断网那一下() {
  await p.route('**/v1/village*', (r) => r.abort())
  try {
    await open('pages/village/index')
    await p.waitForTimeout(2200)
    const 屏 = await text()
    ok(!/还都空着/.test(屏), '取不到村子时，屏上不说「还都空着」—— 那是把不知道说成空的',
       屏.slice(0, 50))
    ok(/没连上|看不到/.test(屏), '而是说得出「一时看不到」', 屏.slice(0, 50))
    ok(/再试一次/.test(屏), '并且给得出一颗重试 —— 不是一行读不见的小字', 屏.slice(0, 50))
    /* 【重试真的能把村子带回来】。上面三条验的是「说了实话」，
       这一条验的是「那颗按钮不是摆设」—— 放开拦截再点一次，
       画布要重新挂上。不验这一条的话，一个永远点不动的重试
       也能让上面三条全绿。 */
    await p.unroute('**/v1/village*')
    await p.getByText('再试一次', { exact: false }).click().catch(() => {})
    await p.waitForFunction(() => globalThis.__router.current().data.取到过 === true,
                            null, { timeout: 15000 }).catch(() => {})
    const 回来了 = await p.evaluate(() => globalThis.__router.current().data.取到过)
    ok(回来了 === true, '点那颗「再试一次」，村子真的回来了', String(回来了))
  } finally {
    await p.unroute('**/v1/village*').catch(() => {})
  }
}

/* 【没有待扫单子的人，扫失败之后屏上有话吗】。
   这是第一屏第一个按钮，而新用户的 `toScan` 是 false ——
   而屏上唯一渲染 `codeErr` 的地方曾经挂在 `wx:if="{{toScan}}"` 里：
   点一下、扫一个不认识的码，**什么都不发生，也没有第二条路**
   （2026-09-02 第三轮评审 · 第一次打开的人）。

   下面那一段「该扫了」走的是 toScan 为真的路径，够不着这个形状。 */
async function 扫不出来那一下() {
  await open('pages/village/index')
  await p.waitForTimeout(1200)
  const 有待扫 = await p.evaluate(() => globalThis.__router.current().data.toScan)
  if (有待扫) {
    console.log('    · 跳过「新用户扫失败」：这一趟这个用户手上有待扫的单子（不计入通过）')
    return
  }
  /* 【村子这一块，对什么都没有的人也得画上】（2026-09-04 · 25 计划）。
     底下那条「村子真的画上去了」跑在动线后段 —— 那时人已经买过御守、
     村里住着人了。而**村子被画上去，靠的正是那件事**：`reload` 里
     「开场白 → 说话卡」让 `变了` 为真，顺带把画布重挂了一次。
     新用户没有那一跳，他的每个字段都不变，画布就停在 `setData`
     换上来的那块空节点上，像素退回默认 300×150、一个像素都没画。

     屏幕上他读到的是「四十间屋子，还都空着」，底下一间屋子也没有。
     那不是空态 —— 空态是四十间空屋子，这是坏了，
     而两者在截图之外没有任何东西分得开。

     25 计划的逐屏走把它量了出来:同一屏、同样的 CSS 尺寸 292×398，
     空村那位的画布是 300×150／0 个像素，住了两位的是 704×960／全画。 */
  const 空村画布 = await p.evaluate(() => {
    const cv = document.querySelector('canvas')
    if (!cv) return { 有画布: false }
    const g = cv.getContext('2d')
    const d = g.getImageData(0, 0, cv.width, Math.min(400, cv.height)).data
    let ink = 0
    for (let i = 3; i < d.length; i += 4) if (d[i]) ink++
    return { 有画布: true, ink, 像素: cv.width + 'x' + cv.height }
  })
  ok(空村画布.有画布 && 空村画布.ink > 100000,
     '一个人都没有的时候，村子也画在那儿　—— 四十间空屋子，不是一片空白',
     空村画布.有画布 ? `${空村画布.ink} 个不透明像素 · 像素 ${空村画布.像素}` : '连画布都没有')
  await p.evaluate(() => {
    globalThis.__wxStub('scanCode', () => Promise.resolve({ result: 'NOT-A-REAL-CODE-XYZ' }))
  })
  await p.getByText('扫御守', { exact: true }).click()
  await p.waitForFunction(() => !!globalThis.__router.current().data.codeErr,
                          null, { timeout: 15000 }).catch(() => {})
  const 屏 = await text()
  ok(屏.includes('对不上任何一枚御守'),
     '没有待扫单子的人扫失败，屏上也说得出是哪一种情况',
     屏.slice(0, 60))
  ok(屏.includes('扫不出来'),
     '而且给得出第二条路（手输编号）—— 扫不出来的人正是最需要它的人',
     屏.slice(0, 60))
  await p.evaluate(() => globalThis.__router.current().setData({ codeErr: '' }))
}

/* 打真后端时，用【真的入住路径】把两位请回家：
     发一张御守凭据(库里) → 页面点「扫御守」→ /v1/omamori/scan → 入住
   扫码本身只有真机有，所以这里把 wx.scanCode 桩成「扫到了这串凭据」——
   桩在【验证脚本里】,显式的一行，不是垫片替你默默成功。
   除了这一跳，登录、入住、问签、进屋走的都是真后端与真库。 */
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
/* 页面清单从 app.json 读，跟 build.mjs 同一个来源。
   写死一份的话，新加的页面【既不会被验，也不会有人说一声】——
   而那跟「这几页都好着呢」长得一模一样。覆盖面悄悄缩，是这套门禁最怕的一种坏法。 */
const routes = JSON.parse(readFileSync('mini/miniprogram/app.json', 'utf8')).pages
if (!routes || !routes.length) { console.log('✗ app.json 里一页都没有'); process.exit(1) }

/* ── 一屏不滚动（docs/REDESIGN.md R4 / 设计 10.1）─────────────────
   最矮的机器是 iPhone SE：375 × 667，去掉状态栏 20 与 tabBar 50，
   内容区 597。一屏放不下就得滚，而小程序里「往下还有」没有任何提示。
   量的是最矮那一档 —— 它过了，别的都过。 */
/* 【在浏览器里量对比度，不靠读 CSS】。

   `scripts/check-contrast.py` 读的是 CSS 文本 —— 它算得出「这条规则的字色
   压在这条规则自己的底上」是多少，算不出「底写在祖先节点上」的那些，
   于是给自己开了一个免检口子（未量），而那个口子当场放走了
   「今天」屏罗盘中心那颗按钮：白字压琥珀 2.15:1，全屏唯一的控件。

   浏览器知道答案。这一支在真实渲染出来的页面上，对每一个有文字的元素：
     · 取 getComputedStyle 的 color
     · 往上找第一个不透明的底（transparent 就继续往上）
     · 底是渐变的话，取渐变里【最不利】的那一站
   够不着的（背景图 / canvas / 半透明叠加）单独计数，如实报出来，不算过。 */
function 量对比度() {
  const 解 = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const v = m[1].split(',').map((x) => parseFloat(x))
    return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }
  }
  const 亮 = (c) => {
    const f = [c.r, c.g, c.b].map((x) => {
      x = x / 255
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]
  }
  const 比 = (a, b) => {
    const [x, y] = [亮(a), 亮(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  // 渐变串里的所有颜色站 —— 字要在整条渐变上都读得出来，所以逐站都算
  const 站 = (s) => {
    const out = []
    const re = /rgba?\([^)]+\)/g
    let m
    while ((m = re.exec(s))) { const c = 解(m[0]); if (c && c.a > 0.9) out.push(c) }
    return out
  }

  const 说不准 = []
  const 错 = []
  let 量过 = 0

  for (const el of document.querySelectorAll('*')) {
    // 只看【自己直接带文字】的元素 —— 容器的 innerText 是子孙的，字色不一定是它的
    let 字 = ''
    for (const n of el.childNodes) if (n.nodeType === 3) 字 += n.textContent
    字 = 字.trim()
    if (!字) continue

    const st = getComputedStyle(el)
    if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity) === 0) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    // 屏外的不算 —— 收起来的槽、还没翻到的那一页
    if (r.bottom < 0 || r.top > (window.innerHeight + document.documentElement.scrollHeight)) continue

    const 前 = 解(st.color)
    if (!前 || 前.a < 0.9) continue        // 半透明的字另说，这一支不判

    // 往上找底
    let p = el, 底 = null, 糊 = ''
    while (p && p !== document.documentElement.parentNode) {
      const s2 = getComputedStyle(p)
      const img = s2.backgroundImage
      if (img && img !== 'none') {
        if (/gradient/.test(img)) { const zs = 站(img); if (zs.length) { 底 = zs; break } }
        糊 = '背景图'; break
      }
      const bg = 解(s2.backgroundColor)
      if (bg && bg.a > 0.9) { 底 = [bg]; break }
      if (p.tagName === 'CANVAS') { 糊 = 'canvas'; break }
      p = p.parentElement
    }
    if (!底) { 说不准.push({ 文: 字.slice(0, 14), 类: String(el.className).slice(0, 24), 因: 糊 || '一路透明到顶' }); continue }

    量过++
    let 差 = 21, 站色 = ''
    for (const b of 底) { const c = 比(前, b); if (c < 差) { 差 = c; 站色 = `rgb(${b.r},${b.g},${b.b})` } }
    if (差 < 3.2) {
      错.push({ 文: 字.slice(0, 16), 类: String(el.className).slice(0, 28), 比: +差.toFixed(2), 底: 站色 })
    }
  }
  return { 错, 说不准: 说不准.length, 说不准样本: 说不准.slice(0, 4), 量过 }
}

async function 量一屏(route, params) {
  await p.setViewportSize({ width: 375, height: 667 })
  await open(route, params)
  /* 等版式**停下来**再量，不是等一个固定的毫秒数。
     我家那一页会自己量高度、反复收敛罗盘直径 —— 400ms 时它还在中间态，
     量到的高度既不是初值也不是终值，还会随机器快慢漂。
     （跟动线里那六处固定等待同一种毛病：等时间不等状态。） */
  await p.waitForFunction(() => {
    const h = () => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
    const w = window
    if (w.__lastH !== h()) { w.__lastH = h(); w.__same = 0; return false }
    return (w.__same = (w.__same || 0) + 1) >= 3
  }, null, { timeout: 8000, polling: 120 }).catch(() => {})
  await p.evaluate(() => { delete window.__lastH; delete window.__same })
  /* 顺路量一遍对比度 —— 每一屏都量，不靠我记得手动量哪几屏。
     这一支跟 `scripts/check-contrast.py` 不重复：那一支读 CSS 文本，
     够不着「底写在祖先节点上」的那些（罗盘中心那颗按钮就是这么漏的）;
     这一支在真实渲染出来的页面上问浏览器，问得到就没有够不着的。 */
  const 色 = await p.evaluate(量对比度)
  const m = await p.evaluate(() => {
    const d = document.documentElement, b = document.body
    const tab = document.getElementById('wx-tabbar')
    const tabH = tab && getComputedStyle(tab).display !== 'none' ? tab.offsetHeight : 0
    return {
      内容: Math.max(d.scrollHeight, b.scrollHeight),
      视口: window.innerHeight,
      tab: tabH,
      /* 超了的时候光有一个总数没法动手 —— 一并报出这一屏是谁占的。
         逐块量是我先前手动做过好几轮的事，固化进来省得下次再搭一次架子。 */
      分块: Array.from((document.querySelector('#app .page') || { children: [] }).children)
        .map((el) => `${(el.className || '?').toString().split(' ')[0]}:${Math.round(el.getBoundingClientRect().height)}`)
        .filter((x) => !x.endsWith(':0')),
      /* 顺带报出这一屏在不在错误态 —— 错误态跟正常态不是同一个版式，
         拿错误态量出来的欠账，改正常态是改不掉的。 */
      出错: (document.querySelector('#app .page') || { innerText: '' }).innerText
        .split('\n').filter((l) => /取不到|失败|出错/.test(l)).join(' / '),
    }
  })
  await p.setViewportSize({ width: 390, height: 844 })
  /* 问的就是「这一屏滚不滚」，所以拿文档高度直接比窗口 —— 不再另减 tabBar。
     tabBar 是固定定位的，它占的位已经由 body 的 padding-bottom 让出来、
     算在文档高度里了；再减一次就是同一笔减两遍（tab 页凭空多 50px 的欠账）。
     非 tab 页两种算法本来一样，所以这条对所有页都成立。 */
  return { ...m, 溢出: m.内容 - m.视口, 色 }
}

/* 【横着不许出界】（2026-09-04 · 25 计划的逐屏走量出来的）。
   竖着的欠账有台账管着（上面那一段），横着的一条都没管过 ——
   而横向溢出比纵向糟:竖着看不见的往下滑就有，
   横着看不见的【多数人根本不知道能滑】。

   25 计划把五个人各三十九屏的几何数据存下来之后，一次扫描
   出来一处:说明书那一行页签在 375 宽的屏上是 376px，
   最后一页「三宫」的「宫」被切掉一角。就一处，就 1px ——
   正因为只有一处，把这条钉成【零】才有意义:
   往后但凡多出一处，它就是新长出来的。

   量的是「谁的右边越过了视口」，不是 `scrollWidth`：
   后者被任何一个 `overflow:hidden` 的祖先吃掉，
   而被吃掉的溢出照样是屏幕上看不全的字。

   【允许表】。跟竖向欠账同一个办法:可以有例外，每个都得有名有姓、
   写明为什么。现在只有一条 —— 说明书那一行页签是【故意】比屏宽的:
   七个页签每个要够 44px 才按得准（苹果人机指南那条线），
   而 375 宽的屏放不下七个 44。两件事真的冲突，
   于是那一行 `overflow-x: auto`，横着出界是它的工作方式。
   我一度反过来收窄内距让它放下，触达面积当场掉到 42 ——
   为了 1px 的观感牺牲手指按得准，主次反了。 */
const 横向允许 = {
  report: { 类: 'tab', 为什么: '页签条本来就横滑：七个够 44px 的页签在 375 宽上放不下' },
}
const 横着出界的 = (屏) => p.evaluate((准) => {
  const 宽 = document.documentElement.clientWidth
  const 出 = []
  for (const el of document.querySelectorAll('#app .page *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.right <= 宽 + 0.5) continue
    const 类 = (el.className || el.tagName).toString().split(' ')[0]
    if (准 && 类 === 准.类) continue
    出.push(`${类}:${Math.round(r.right - 宽)}px「${(el.textContent || '').trim().slice(0, 10)}」`)
  }
  return 出.slice(0, 6)
}, 横向允许[屏] || null)

/* 【集齐那一句】。40/40 是这个产品情感最高的一刻，而原先屏上说的是
   「还差 0 位就集齐了」—— 语法没错，意思荒谬。
   这一态靠真数据【永远走不到】（开发库里最多住着几位，而请回四十位
   要四十次真扫码），所以只能造。夹具写在明处：只动 `lived`，
   验的是这一屏在那个数上说什么。 */
if (API) {
  await open('pages/village/index')
  await p.waitForTimeout(2200)
  const 说 = async (n) => {
    await p.evaluate((v) => globalThis.__router.current().setData({ lived: v, total: 40 }), n)
    await p.waitForTimeout(350)
    return p.evaluate(() => {
      const e = [...document.querySelectorAll('.tally-n')].filter((x) => x.offsetParent !== null)
      return e.length ? e[0].innerText : ''
    })
  }
  const 差一 = await 说(39)
  const 齐了 = await 说(40)
  ok(/还差 1 位/.test(差一), '差一位时说得出还差几位', 差一)
  ok(齐了 !== '' && !/还差 0/.test(齐了),
     '集齐那一刻不说「还差 0 位就集齐了」', 齐了)
  await 说(0)
}

/* 顶上那张卡与底下那一槽【不许说同一件事】。
   卡上写「四十间屋子，还都空着」，槽里再写一句「现在都空着」——
   一字之差的同一句（标尺 §1.5.5 第 4 条）。矮屏上看不出来：那一槽是
   收起的；长屏（14 / ProMax）上两句一起摆着，而多数人用的是长屏。
   一直只在最矮那一档看，就一直看不见它。 */
if (API) {
  await p.setViewportSize({ width: 430, height: 932 })
  await open('pages/village/index')
  await p.waitForTimeout(2400)
  const 长屏文 = await text()
  const 空着几次 = (长屏文.match(/都空着/g) || []).length
  ok(空着几次 <= 1, '长屏上「都空着」只说一遍　—— 卡片说过了，槽里不再说',
     `出现 ${空着几次} 次`)
  await p.setViewportSize({ width: 375, height: 667 })
}

/* 【没请回来的人不该在你的村子里走动】。
   卡片上写着「四十间屋子，还都空着 · 0/40」，而画面里阿云、桃桃、婆婆、
   丹增在溜达、还冒着台词气泡 —— 新用户第一眼看见的是一个已经很热闹的村子，
   那「请人回家」的动机就没了。这也正是「还没请回来的人连名字都不该知道」
   那条设定，而这儿是从正门破的。
   路人（villm）不受此限：村子的生气归他们。 */
if (API) {
  await open('pages/village/index')
  await p.waitForTimeout(2600)
  const 场 = await p.evaluate(() => {
    const c = globalThis.VILLAGE_CENSUS ? globalThis.VILLAGE_CENSUS() : null
    const 名单 = globalThis.VILLAGE_VILLAGERS_FOR_TEST || []
    return { 住着: c && c.住着, 在场: 名单.length, 卡: globalThis.__router.current().data.found }
  })
  /* 问引擎「此刻谁在场」，不去屏上找台词气泡 ——
     气泡是间歇冒的，碰不上就成了一条永远绿的断言。 */
  const 台上 = await p.evaluate(() =>
    globalThis.VILLAGE_CAST_ON_STAGE ? globalThis.VILLAGE_CAST_ON_STAGE() : null)
  if (台上 === null) {
    ok(false, '引擎说得出此刻谁在场', '没有 VILLAGE_CAST_ON_STAGE')
  } else if (场.住着 === 0) {
    ok(台上.length === 0,
       '一个人都没请回来时，四十位里的谁都不在村里走动　—— 卡上写着「还都空着」',
       `住着=${场.住着} · 台上=${JSON.stringify(台上)}`)
  } else {
    ok(台上.length === 场.住着,
       '在村里走动的，正好是请回来的那几位',
       `住着=${场.住着} · 台上=${JSON.stringify(台上)}`)
  }
}

console.log(`\n── ${routes.length} 页都开得起来吗 ──`)
console.log('  （照 app.json 读的，不是另列的一份）')
/* 顺带一条通用的：渲出来的文字里不该有模板残片。
   `wx:if="{{a.length > 0}}"` 里那个 `>` 曾被当成标签结束符，
   标签从那儿断开，剩下的 `0}}">` 落成了页面上的文字 —— 不抛不报，
   只是屏幕上多出一截乱码。是看截图看见的，没有一条检查会红。
   属性里写比较是常见写法，所以这条对每一页都查。 */
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
     2026-08-28 追这件事花了半轮，就因为这一步不说自己卡在哪。 */
  const 某位说法 = await p.evaluate(async (base) => {
    const raw = localStorage.getItem('unmei:buwanren:token')
    if (!raw) {
      // 「没 token」还能再分：localStorage 是空的(登录压根没跑),
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
  /* 打真后端时挑不出人来，那【不是「这一趟没有真数据」】,是这一趟没验成 ——
     村民那一屏加它的两个状态一起落空，而报出来的是三行温和的「跳过」。
     跳过不是通过：让它红，红了才有人去看。 */
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
     一次也按不到：那一段就会靠「从不运行」保持绿色。

     【每张换一件商品】。2026-09-01 起「同一个人、同一件东西、
     已经有一笔没付的」会把那一笔原样还回来（退回上一页再进来
     不该再建一张，库里为此攒过同一个 sku 的四笔待付）——
     六次一模一样的请求只会得到同一张单，夹具就造不出六张了。

     【2026-09-02 从「换数量」改成「换商品」】。上一版是拿同一个
     `sku-naji-deep` 下 qty=1..6。而说明书是【一条行出一册】
     （report.rs 的 `ensure_for_line` 从不读 qty），所以建单那一层
     现在拒绝 async_compute 的 qty≠1 —— 收两份钱出一册那件事，
     是第三轮评审实跑出来的。夹具跟着改：换商品，数量恒为 1。
     六个 sku 从库里现取，不写死 —— 写死的 id 会在目录重建之后
     指向一件不存在的东西，而那时截出来的是「取不到」那一屏。 */
  /* 【要几件，看货架上真有几件】（2026-09-02）。
     原先写死「六件」，而那个数是夹具方便，不是产品事实 ——
     货架清掉一万三千件测试残留之后，非居住类的在架商品就是这几件，
     于是这一条报「只挑到 5 件」，看着像动线坏了。
     下面只用第一张单（`单们[0]`），多建几张是为了让订单列表不空；
     所以判据改成【至少能建一张】，这才是它真正依赖的东西。 */
  /* 【只挑 cn 真买得到的】（2026-09-03）。上一版只看 `p.status='listed'`——
     而「上架」跟「这个区买得到」是两件事:`verify-semantics.sh` 的那件
     校验商品正是「上架、但只在 verify 区上架」（它自己也是这一天
     从 draft 换过来的，因为 draft 现在下不了单）。
     它的 sort_weight 是默认 100，于是排在头一位；下面那个循环拿
     `region:'cn'` 建单，第一件就 404，`break` 掉，六张单一张都没建出来。
     报出来的是「超过五笔就分页」那一条，读起来像订单列表坏了。 */
  const 六件 = sql1(
    "SELECT string_agg(id, ',') FROM ("
    + " SELECT s.id FROM sku s JOIN product p ON p.id = s.product_id"
    + "  WHERE s.status='active' AND p.status='listed'"
    + "    AND ('cn' = ANY(p.available_regions) OR 'global' = ANY(p.available_regions))"
    + "    AND p.fulfillment_kind <> 'residency'"   // 御守要挑没住过的人，另一套判据
    + "  ORDER BY p.sort_weight DESC, s.id LIMIT 6) t").split(',').filter(Boolean)
  ok(六件.length >= 1, '夹具：货架上挑得出在售商品来建单', `挑到 ${六件.length} 件`)
  const 单们 = await p.evaluate(async ([base, 六件]) => {
    const raw = localStorage.getItem('unmei:buwanren:token')
    if (!raw) return []
    const token = JSON.parse(raw)
    const out = []
    for (const sku of 六件) {
      const r = await fetch(base + '/v1/orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + token,
          'idempotency-key': 'mirror-sweep-' + Math.random().toString(36).slice(2),
        },
        body: JSON.stringify({ lines: [{ sku_id: sku, qty: 1 }], region: 'cn' }),
      })
      if (!r.ok) break
      const j = await r.json()
      if (j.order_id) out.push(j.order_id)
    }
    return out
  }, [API, 六件])
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
        /* 【种册子的那一单也要标成已付】。
           册子是【付款履约时】才建的（unmei-app/src/fulfillment.rs）——
           一张 unpaid 的单子上不可能有一册 ready 的报告。
           2026-09-01 订单屏把「读你的说明书」收进 `status !== 'unpaid'`
           之后（待付时那颗按下去只会失望，而且它压在「去支付」上面），
           这份只种报告、不动订单状态的夹具就跟现实对不上了：
           断言点不到那颗按钮，而产品是对的。夹具要照着真链造。 */
        /* 【标已付就要连钱一起标】。只改 status 会造出一个真链路
           永远造不出的状态：已付、amount_paid_minor=0、没有任何支付记录。
           这种单子攒在库里会让财务与看板的数对不上，
           更要紧的是——拿这种夹具跑出来的绿灯，说的不是真链路的事。
           `scripts/verify-semantics.sh` 里同类的两处一直是这么写的。 */
        run(`UPDATE order_record SET status='paid',
                    amount_paid_minor=amount_total_minor,
                    paid_at=COALESCE(paid_at, NOW())
             WHERE id='${oid}'`)
        /* 【连那笔钱本身也要有】（2026-09-03 第二次修这里）。
           上一次补的是金额 —— 订单从「已付 0 元」变成「已付 199 元」，
           而支付表里仍旧一条记录都没有。库里因此攒着 1262 笔
           「收到了钱、却查不到是哪一笔」的订单，从 08-16 到今天。

           真实链路里订单转 paid 必然经过一笔 success 的 payment
           （`payment.rs` 的 settle 是唯一那条路），所以夹具也要有。
           少了它，退款、对账、财务这三条路径在夹具上全都走不通 ——
           而它们正是这一轮补起来的东西。 */
        run(`INSERT INTO payment(id, order_id, user_id, channel, amount_minor,
                                 currency, status, paid_at, region)
             SELECT 'pay-fx-' || substring(o.id from 5), o.id, o.user_id, 'wechat_mp',
                    o.amount_total_minor, o.currency, 'success', NOW(), o.region
               FROM order_record o WHERE o.id='${oid}'
             ON CONFLICT (id) DO NOTHING`)
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
     本命页那个冷启动竞态就长这样：遮罩干净，页面上却停着一行取不到。
     只在打真后端时查：假服务端本来就有几条接口不给，那时候有 err 是如实的。 */
  const 页内错 = API ? await p.evaluate(() => {
    const c = globalThis.__router.current()
    return (c && c.data && c.data.err) || ''
  }) : ''
  ok(!scr && !残片 && !页内错, r.replace('pages/', '').replace('/index', ''),
     scr ? scr.split('\n')[1]
         : 残片 ? '页面上渲出了模板残片 {{ 或 }}'
         : 页内错 ? '页面上停着一行：' + 页内错.slice(0, 30) : '')
}

// ② 村主屏 ──────────────────────────────────────────────────────
console.log('\n── 村主屏 ──')
errs.length = 0
await open('pages/village/index')
if (API) {
  console.log('  （打真后端：先用真的入住路径请阿云与陈九回家）')
  /* 先验「扫不出来」那一下 —— 要趁这个用户手上还没有任何待扫的单子，
     那正是第一次打开的人所处的状态。 */
  await 断网那一下()
  await 扫不出来那一下()
  await open('pages/village/index')
  const before = await text()
  const 落到 = await moveIn('ayun')
  /* 这一下是整条链上唯一一次实物变成人 —— 它值一屏，不是一句 toast
     （docs/REDESIGN.md R6 / 设计 V6）。 */
  ok(落到 === 'pages/moved/index', '扫开之后开的是「他住进来了」那一屏', 落到)
  await moveIn('chenjiu')
  const after = await text()
  /* 断的是【那个数真的涨了】，不是「屏上某处文本变了」。
     后者太松：村民今天说的那一句会自己轮换，轮到了就算收集数纹丝不动也能过。
     取数用的正则要跟 index.wxml 的 `{{lived}} / {{total}}` 对上 ——
     0830 把「收集 x/40」改成了进度条，而这里原先 grep 的是旧写法，
     于是证据栏印出 `null → null`，一条真的通过看着像根本没验到。 */
  const 收集数 = (t) => { const m = t.match(/(\d+)\s*\/\s*(\d+)/); return m ? Number(m[1]) : null }
  const 前数 = 收集数(before), 后数 = 收集数(after)
  ok(前数 !== null && 后数 !== null && 后数 > 前数,
     '扫御守之后收集数真的涨了', `${前数} → ${后数}`)

  /* 那一屏说得对不对：头一回是「住进来了」，重复扫是「早就在了」。
     重复扫不是错误，但话要不一样 —— 这是 types/village.ts 上写着的设定。 */
  await moveIn('ayun')
  await open('pages/moved/index', { name: '阿云', n: '0', id: 'ayun' })
  await p.waitForTimeout(400)
  const 重复 = await text()
  ok(重复.includes('早就在了'), '重复扫说的是「早就在了」，不是同一句', 重复.slice(0, 30))
  /* 两句【不能同时在】。`wx:else` 必须紧跟着 `wx:if` —— 中间插一个元素
     那一对就散了，两句一起显示，而屏上看着只是「话多了一行」。
     2026-08-31 加那句开场白时正好插在中间，真踩到。 */
  await open('pages/moved/index', { name: '某位', id: 'nobody' })
  await p.waitForTimeout(900)
  const 头一回文 = await text()
  ok(!(头一回文.includes('住进了村里那一格') && 头一回文.includes('你已经扫过')),
     '「搬进来了」和「早就在了」不会同时出现', 头一回文.slice(0, 52))

  /* 【他搬进来说的第一句】。这一屏是整条链上唯一一次「实物变成人」，
     在此之前他是一张不出声的脸 —— 不说话就还只是一件商品。
     只给写过台词的人：婆婆有，随手编的 id 没有。 */
  await open('pages/moved/index', { name: '婆婆', id: 'popo', say: '吃了没？没吃先去吃' })
  await p.waitForTimeout(1200)
  ok(await p.evaluate(() => !!document.querySelector('.firstsay')),
     '搬进来那一刻他开口说了一句', await p.evaluate(() =>
       (document.querySelector('.firstsay') || {}).textContent || '（没有气泡）'))
  await open('pages/moved/index', { name: '某位', id: 'nobody' })
  await p.waitForTimeout(800)
  ok(!(await p.evaluate(() => !!document.querySelector('.firstsay'))),
     '没写过台词的人不编一句顶上　—— 四十位共用一句会当场露馅')
  /* 「他住进来了」那一屏上的出口。扫完一枚御守之后最想做的就是这一下，
     而它从来没被真按过 —— 按钮在、点了没反应是两回事。 */
  await p.getByText('去看看', { exact: true }).click()
  await p.waitForFunction(
    () => globalThis.__router.current().__route === 'pages/villager/index',
    null, { timeout: 15000 },
  ).catch(() => {})
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/villager/index',
     '「他住进来了」那一屏上按「去看看」，真的到得了他那一页',
     await p.evaluate(() => globalThis.__router.current().__route))

  /* 【还没请来】那一支：这是决定要花九十九块的地方，而它原先屏上
     只有四个标签，中间三百多像素空着（标尺 §1.5.4 第二问）。
     挑一位这一趟没请回家的看。 */
  {
    const 谁 = sql1("SELECT id FROM villager WHERE id NOT IN (SELECT villager_id FROM villager_residency"
                    + " WHERE villager_id IS NOT NULL) ORDER BY id LIMIT 1")
    if (谁) {
      await open('pages/villager/index', { id: 谁 })
      await p.waitForFunction(() => globalThis.__router.current().data.loading === false,
                              null, { timeout: 15000 }).catch(() => {})
      const 没请 = await p.evaluate(() => {
        const d = globalThis.__router.current().data
        return { 住着: !!(d.who && d.who.at_home), 文: (document.querySelector('#app') || {}).innerText || '' }
      })
      if (!没请.住着) {
        // 屏上写的是「请 X 回村之后」——「回家」是更早的说法，
        // 术语统一那一轮改成了「回村」（全屏只留一个说法），断言当时没跟上。
        ok(/回村之后/.test(没请.文) && /住进村里那一间/.test(没请.文),
           '还没请来的那一屏说得出「请他回村之后会怎样」　—— 不是四个标签加一片空白',
           没请.文.replace(/\n/g, ' ').slice(0, 60))
        /* 稀有度（「常」「稀」「珍」）是运营的分档 —— 屏上摆一个「常」字，
           读的人只会当成错别字。 */
        const 档 = sql1(`SELECT rarity FROM villager WHERE id='${谁}'`)
        ok(!档 || !new RegExp(`^\\s*${档}\\s*$`, 'm').test(没请.文),
           '屏上不摆稀有度　—— 那是运营的分档，不是给买的人看的词', String(档))
      } else {
        ok(false, '验得到「还没请来」那一支', `${谁} 已经住下了`)
      }
    } else {
      ok(false, '验得到「还没请来」那一支', '库里每一位都住下了')
    }
  }

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
        /* 【标了已付就要有那笔钱】（2026-09-03）。
           上一版只插订单，不插 payment —— 造出来的是一个真实链路
           永远造不出的状态:订单说收到 9900 分，支付表里一条记录都没有。
           每跑一轮攒一批，库里因此攒了三千多笔;而拿一个不可能的状态
           跑出来的绿，说的不是真链路的事。
           `check-money-consistency` 那一支盯着这个数。 */
        `INSERT INTO payment(id,order_id,user_id,channel,amount_minor,currency,`
        + `status,paid_at,region) VALUES ('pay-e2-${尾}','ord-e2-${尾}',`
        + `'${我是谁}','wechat_mp',9900,'CNY','success',NOW(),'cn')`
        + ` ON CONFLICT (id) DO NOTHING`,
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
      /* 【2026-09-01 这一条反过来了】。
         原先「手输编号」整块放在弹性槽里，靠矮屏收起来腾地方，而这一条
         验的正是「它收起了」。可槽在 ≤699px 上整块隐藏，参照机 iPhone SE
         正好在那以下 —— 也就是说【扫码失败之后唯一那条出路，在最需要它的
         那台机器上不存在】。槽的判据是「删掉这一屏仍然成立」，它不满足。
         现在它是一行入口、点开才展开：路一直在，代价是一行。
         所以这里验的是【那一行在】而【输入框默认不占地方】。 */
      const 手输 = await p.evaluate(() => {
        const 块 = document.querySelector('.manual')
        const 行 = document.querySelector('.manual-k')
        const 框 = document.querySelector('.manual-input')
        return {
          在: !!块 && getComputedStyle(块).display !== 'none',
          入口: 行 ? (行.innerText || '').slice(0, 12) : '',
          默认展开: !!框,
        }
      })
      ok(手输.在 && /手输编号/.test(手输.入口),
         '矮屏上「扫不出来？手输编号」那一行还在　—— 扫码失败之后唯一的出路，不能被收起来',
         `在=${手输.在} 文=${手输.入口}`)
      ok(!手输.默认展开, '而输入框默认不摊开　—— 一行的代价，不是整块')
      /* 画布【还在画上】。改画布尺寸的代码最容易的坏法就是把画面弄没了，
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
      ok(槽.includes('扫不出来？在这儿手输编号'), '有「手输编号」那一行')

      /* 【它现在是折叠的】。整块常驻会把村主屏在 iPhone SE 上挤出屏，
         而放回弹性槽等于在最需要它的机器上把它藏起来 —— 所以是
         一行入口、点开才展开。先点开。 */
      await p.getByText('扫不出来？在这儿手输编号', { exact: false }).first().click()
      await p.waitForTimeout(300)
      ok(await p.locator('.manual-input').count() === 1,
         '点那一行，输入框就展开了', String(await p.locator('.manual-input').count()))

      /* 先填一串对不上的：话要说清是哪一种情况，不是一句「失败」。 */
      await p.locator('.manual-input').fill('NOT-A-REAL-CODE')
      await p.locator('.manual-go').click()
      await p.waitForFunction(() => !!globalThis.__router.current().data.codeErr,
                              null, { timeout: 15000 }).catch(() => {})
      const 错话 = await p.evaluate(() => globalThis.__router.current().data.codeErr)
      ok(/对不上任何一枚御守/.test(错话 || ''), '认不出那串字时说得清是哪一种情况', String(错话))
      /* 【说出来了不等于看得见】（2026-09-02 第三轮评审 · 第一次打开的人）。
         上面这一条读的是 `data.codeErr` —— 而屏上唯一渲染它的地方
         曾经挂在 `wx:if="{{toScan}}"` 里，新用户为 false:
         话生成了、一个字都没上屏，点第一屏第一个按钮什么都不发生。
         所以这一条看【屏上的字】，不看 data。 */
      ok((await text()).includes('对不上任何一枚御守'),
         '而且那句话真的在屏上 —— 不是只在 data 里',
         (await text()).slice(0, 40))

      /* 再填一串真的。这一下把婆婆请回家 —— 也就是把上面那条提示消掉。 */
      const 真码 = await mintCredential('popo')
      await p.locator('.manual-input').fill('')
      await p.locator('.manual-input').fill(真码)
      await p.locator('.manual-go').click()
      await p.waitForFunction(
        () => globalThis.__router.current().__route === 'pages/moved/index',
        null, { timeout: 15000 },
      ).catch(() => {})
      ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/moved/index',
         '手输编号也开得出「他住进来了」那一屏　—— 跟扫码走同一条路',
         await p.evaluate(() => globalThis.__router.current().__route))
      await p.setViewportSize({ width: 375, height: 667 })

      /* ── 一单那一屏的主按钮（设计册 M3）───────────────────────
         10.8 说的是：**订单的完成态不是「已付」，是他住进村里**。这条仍然成立，
         只是「住进村里」这件事今天发生在【付款那一刻】——
         后端 residency 分支直接 move_in，既不建运单也不发凭据
         （2026-09-01 第二轮评审 · 转化路）。

         所以这段 fixture 也跟着改。它原先直插一条 `delivered` 的运单，
         造出「包裹到了、人还没住进来」——而那个状态真链路产生不了：
         买御守从来不寄东西。拿一个不存在的状态验出来的绿，是假的绿。
         现在种的是【付款之后真会有的样子】:单子 paid、行 done、人已入住。 */
      const sku2 = sql1("SELECT id FROM sku WHERE villager_id='tenz' LIMIT 1")
      run([
        `INSERT INTO order_record(id,user_id,channel_origin,currency,`
        + `amount_subtotal_minor,amount_total_minor,amount_paid_minor,status,`
        + `source_kind,region,paid_at) VALUES ('ord-m3-${尾}','${我是谁}','mini','CNY',`
        + `9900,9900,9900,'paid','one_shot','cn',NOW()) ON CONFLICT (id) DO NOTHING`,
        /* 【标了已付就要有那笔钱】（2026-09-03）。
           上一版只插订单，不插 payment —— 造出来的是一个真实链路
           永远造不出的状态:订单说收到 9900 分，支付表里一条记录都没有。
           每跑一轮攒一批，库里因此攒了三千多笔;而拿一个不可能的状态
           跑出来的绿，说的不是真链路的事。
           `check-money-consistency` 那一支盯着这个数。 */
        `INSERT INTO payment(id,order_id,user_id,channel,amount_minor,currency,`
        + `status,paid_at,region) VALUES ('pay-m3-${尾}','ord-m3-${尾}',`
        + `'${我是谁}','wechat_mp',9900,'CNY','success',NOW(),'cn')`
        + ` ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO order_line(id,order_id,line_no,sku_id,sku_snapshot_json,`
        + `unit_price_minor,qty,line_subtotal_minor,fulfillment_status) VALUES `
        + `('ol-m3-${尾}','ord-m3-${尾}',1,'${sku2}','{"sku_name":"御守"}'::jsonb,`
        + `9900,1,9900,'done') ON CONFLICT (id) DO UPDATE SET fulfillment_status='done'`,
        /* 列名与 source_kind 跟真代码对齐（residency.rs 的 `move_in_from_line`
           走的是 `insert_residency(…, None, "purchase", Some(order_line_id))`）——
           种一个跟真路径长得不一样的行，验出来的绿说明不了真路径。 */
        `INSERT INTO villager_residency(id,user_id,villager_id,source_kind,source_ref,moved_in_at)`
        + ` VALUES ('res-m3-${尾}','${我是谁}','tenz','purchase','ol-m3-${尾}',NOW())`
        + ` ON CONFLICT DO NOTHING`,
      ].join('; '))
      await p.setViewportSize({ width: 390, height: 844 })   // 槽在矮屏收起，先在长屏看它
      await open('pages/order/index', { id: 'ord-m3-' + 尾 })
      await p.waitForFunction(() => globalThis.__router.current().data.住下了 === true,
                              null, { timeout: 15000 }).catch(() => {})
      ok(await p.evaluate(() => globalThis.__router.current().data.住下了) === true,
         '御守那一单付完之后，单子那一屏知道他已经住下了',
         String(await p.evaluate(() => globalThis.__router.current().data.住下了)))
      const 单屏 = await text()
      await shot('12-一单')
      /* 主按钮是【真去得了的那个地方】。原先这里是「收到了，去扫一下」——
         而这一单没有东西可扫，那颗按钮按下去只会失败。 */
      ok(/去.+屋里看看/.test(单屏), '主按钮是「去他屋里看看」', 单屏.slice(0, 40))

      /* 【走到哪儿】这一条路。这一单是御守、已付、已寄、还没扫 ——
         所以四步应该是「下单·付款走过 / 寄出走过 / 住进来正等着」。
         这一页原先在最常见的情况下整屏七百多像素全空，人看不出
         这单现在怎么样；而步骤要是各判各的，会出现「没付款但算好亮着」。 */
      /* 【下一步等什么】+【单号】。进度线说得出「在哪儿」，说不出
         「接下来会怎样」，而人点进订单就是想知道这两件；出了事还得有个
         能念给客服的东西 —— 这一屏原先一样都没有。 */
      const 下步 = await p.evaluate(() => globalThis.__router.current().data.下一步)
      ok(!!下步 && 下步.length > 6, '这一单说得出下一步等什么', String(下步))
      const 单文 = await text()
      /* 【只露前八位】（2026-09-02 第四轮评审 · 第一次来的人）。
         整串是 `ord-` 加一个 uuid，四十个字符；原样摆在屏上，
         人读到的是「开发者的东西漏出来了」，而这一屏是催他付钱的。
         八位十六进制够客服定位到唯一一单，长按复制的仍然是整串 ——
         所以这一条验的是「有一个念得出口的短号」，不再要求 `ord-`。 */
      /* 别把它写死成十六进制 —— 种子里的单 id 是 `ord-t79678-24` 这种，
         短号取出来是 `t7967824`，带字母。这一条要验的是「短且念得出口」，
         不是「长得像 uuid」。 */
      const 短号 = (单文.match(/单号\s*([0-9a-z]{6,12})(?![0-9a-z-])/) || [])[1]
      ok(单文.includes('单号') && !!短号, '屏上有能念给客服的单号', 短号 || '（没有）')
      ok(!/ord-[0-9a-f]{8}-/.test(单文), '整串 uuid 不上屏',
         (单文.match(/ord-\S+/) || ['（没有，对）'])[0])

      const 路 = await p.evaluate(() => globalThis.__router.current().data.走到哪儿)
      ok(Array.isArray(路) && 路.length === 3 && 路[2].t === '住进来',
         '御守那一单是三步「下单 · 付款 · 住进来」　—— 中间没有「寄出」，因为不寄',
         Array.isArray(路) ? 路.map((x) => x.t).join(' · ') : String(路))
      if (Array.isArray(路) && 路.length === 4) {
        const 亮 = 路.findIndex((x) => x.s === 'now')
        ok(亮 === 3, '已付已寄没扫的单子，亮着的是最后那一步',
           路.map((x) => x.t + ':' + x.s).join(' '))
        // 走过的必须连成一段 —— 中间断开就是各判各的
        const 连 = 路.every((x, i) => i >= 亮 || x.s === 'past')
        ok(连, '亮着那一步之前的每一步都走过了，中间不许断',
           路.map((x) => x.s).join(' '))
      }
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
      ok(单屏.includes('这单到此为止'), '槽里说清了这一单什么时候才算完')
      /* 主按钮不在槽里 —— 它是这一屏的主按钮，矮屏上也必须在。
         把它放进槽等于说「放不下就算了」，而这一下正是整条链最要紧的一步。 */
      await p.setViewportSize({ width: 375, height: 667 })
      await p.waitForTimeout(400)
      const 矮屏 = await p.evaluate(() => {
        const 槽 = document.querySelector('.slot-done')
        return { 主按钮在: [...document.querySelectorAll('button')]
                             .some((e) => /去.+屋里看看/.test(e.innerText || '')),
                 槽收了: !槽 || getComputedStyle(槽).display === 'none' }
      })
      ok(矮屏.主按钮在, '矮屏上主按钮照样在　—— 它不在槽里')
      ok(矮屏.槽收了, '矮屏上那一句槽收起了')
      await p.setViewportSize({ width: 390, height: 844 })

      /* 【单子那一屏不许出现「扫」】（2026-09-01 第二轮评审 · 转化路）。
         这里原先验的是「在这一屏手输编号也开得出『他住进来了』」——
         而买御守从来不发凭据，那个输入框在真实的单子上永远填不出东西来。
         手输那条路仍然验（在村子主屏那一段，同一支 `utils/omamori`），
         那是线下拿到实体御守的人走的路，跟这一单无关。
         这条断言反过来钉：这一屏不该再教人去扫任何东西。 */
      const 单面 = await text()
      ok(!/扫一下|扫开|扫不出来|背面那串字/.test(单面),
         '单子那一屏不教人去扫 —— 这一单没有可扫的东西',
         (单面.match(/扫[^\n]{0,12}/) || ['（干净）'])[0])
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
        /* 【标了已付就要有那笔钱】（2026-09-03）。
           上一版只插订单，不插 payment —— 造出来的是一个真实链路
           永远造不出的状态:订单说收到 2900 分，支付表里一条记录都没有。
           每跑一轮攒一批，库里因此攒了三千多笔;而拿一个不可能的状态
           跑出来的绿，说的不是真链路的事。
           `check-money-consistency` 那一支盯着这个数。 */
        `INSERT INTO payment(id,order_id,user_id,channel,amount_minor,currency,`
        + `status,paid_at,region) VALUES ('pay-inc-${尾}','ord-inc-${尾}',`
        + `'${我是谁}','wechat_mp',2900,'CNY','success',NOW(),'cn')`
        + ` ON CONFLICT (id) DO NOTHING`,
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
      ok(await p.evaluate(() => globalThis.__router.current().data.住下了) === false,
         '买一盒香、包裹到了，单子上不说「他住进来了」　—— 香不封人',
         String(await p.evaluate(() => globalThis.__router.current().data.住下了)))

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
    /* 这个产品有名字：【你的说明书】。原先屏上叫它「那一份」——
       一个指代，第一次看见它的人没有上下文（2026-08-31 用户指出）。 */
    ok(单上.includes('读你的说明书'), '买了说明书的单子上，主按钮是「读你的说明书」')
    await p.getByText('读你的说明书', { exact: true }).click()
    await p.waitForFunction(() => globalThis.__router.current().__route === 'pages/report/index',
                            null, { timeout: 15000 }).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/report/index',
       '从单子上点得进你的说明书',
       await p.evaluate(() => globalThis.__router.current().__route))

    /* 二 · 头一页是【结论】,四柱在后面 —— 而且是真盘，干支不是占位符。
       原先头一页就是四柱：花钱买的说明书，开篇甩给人一张排盘图，
       一句话都没有。0830 改成先说结论（key: lead），术语页往后排。
       这三条断言原来钉着「头一页是四柱」，改完之后它们红了三轮 ——
       红得对：产品变了，断言就该跟着说新的话，而不是删掉。 */
    await p.waitForFunction(() => (globalThis.__router.current().data.tabs || []).length > 0,
                            null, { timeout: 15000 }).catch(() => {})
    const 册 = await p.evaluate(() => globalThis.__router.current().data)
    ok((册.tabs || []).length >= 4, '这一份翻得出好几页', String((册.tabs || []).length))
    ok(册.page && 册.page.key === 'lead',
       '头一页是给人看的那句话，不是排盘图', 册.page && 册.page.key)
    /* 四柱那一页仍要在，且要是真盘 —— 它只是不再打头。
       翻到它去验，不是假设它排第几。 */
    /* `tabs` 是 title 的字符串数组，不是对象 —— 头一版这里写 `t.key`，
       拿到 -1，报出来是「四柱那一页不在了」，而它好端端在第二页。
       又一次：测量装置坏了，长得跟真失败一模一样。
       所以按 key 找要问页面自己存的那份 `pages`。 */
    const 柱页 = await p.evaluate(() =>
      (globalThis.__router.current().pages || []).findIndex((x) => x.key === 'pillars'))
    ok(柱页 >= 0, '四柱那一页还在，只是不再打头', String(柱页))
    let 柱 = []
    if (柱页 >= 0) {
      await p.evaluate((i) => globalThis.__router.current().show(i), 柱页)
      await p.waitForTimeout(200)
      柱 = await p.evaluate(() => (globalThis.__router.current().data.page || {}).pillars || [])
    }
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
    // 页签是这一页的价值所在：想看用神就点用神，不用一路翻过去
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

  /* 另一半：册子还没出的那种。**一半的买家是这样** ——
     量过：async_compute 的行里只有 46% 的买家下单时已经有本命。
     所以这不是错误页，它要说清还差什么、去哪儿填。 */
  if (册们.awaiting_natal) {
    await open('pages/order/index', { id: 册们.awaiting_natal.order })
    await p.waitForFunction(() => !!globalThis.__router.current().data.report,
                            null, { timeout: 15000 }).catch(() => {})
    ok((await text()).includes('还差你的出生时间'),
       '册子没出的单子上说得出还差什么　—— 不显示成「已完成」')
    await open('pages/report/index', { id: 册们.awaiting_natal.report })
    await p.waitForFunction(() => globalThis.__router.current().data.status === 'awaiting_natal',
                            null, { timeout: 15000 }).catch(() => {})
    const 等屏 = await text()
    ok(等屏.includes('这份说明书还差你的出生时间'), '还没出的那一份，开出来说的是还差什么')
    ok(!等屏.includes('取不到') && !等屏.includes('出错'),
       '它不是一张错误页　—— 是这一单真实的状态')
    await shot('21-还差生辰')
    // 出路要真走得通：说了「去填」就得真的到得了填生辰那一屏
    await p.getByText('去填出生时间', { exact: true }).click()
    await p.waitForFunction(() => globalThis.__router.current().__route === 'pages/natal/index',
                            null, { timeout: 15000 }).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/natal/index',
       '「去填出生时间」真的到得了填生辰那一屏',
       await p.evaluate(() => globalThis.__router.current().__route))
  }
  // 收拾现场：上面停在填生辰那一屏，而下一段的 moveIn 要从村子那一屏起手。
  // 不回去的话它会等一颗不在这一屏上的按钮，三十秒后超时 —— 而报出来的
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
  /* 【别钉死具体数字】。原先钉的是 29 / 128 / 268 —— 而 ¥128 那一档
     2026-09-01 改成了 ¥88:三支 ¥29 是每支 9.67，十支 ¥128 是每支 12.80，
     买得多反而单价更贵，而同屏还写着「十支约够一个月」。
     钉数字的断言只能挡住「改了没同步」，挡不住「阶梯是反的」——
     后者才是真问题。所以这里验的是【单价递减】。 */
  const 单价 = 香.档.map((t) => {
    const 支 = /三支/.test(t) ? 3 : /十支/.test(t) ? 10 : 1
    const 元 = Number((t.match(/¥(\d+(?:\.\d+)?)/) || [0, 0])[1])
    return { t, 每支: 元 / 支 }
  }).filter((x) => /三支|十支/.test(x.t))
  ok(单价.length === 2 && 单价[0].每支 > 单价[1].每支,
     '买得多，每支更便宜　—— 价格阶梯不是反的',
     单价.map((x) => `${x.t} = 每支 ¥${x.每支.toFixed(2)}`).join(' · '))
  const 香屏 = await text()
  /* 【2026-09-01 方子只在算过之后才给】。同一屏上半苏合刚说完
     「你缺什么，我还不知道 —— 先把出生时间填了，我才配得准」，
     往下一行却写着一个写死的方子：填不填都是它。两行自相矛盾，
     而底下还挂着一档 ¥268 的「按你缺的那味单配」。
     所以现在验的是【这两件事对得上】:她说得出话时才有方子。
     另外「安息」写全成「安息香」—— 单独两个字第一眼像丧仪用语。 */
  const 说了话 = await p.evaluate(() => !!globalThis.__router.current().data.line)
  ok(说了话 ? 香屏.includes('乳香 · 安息香 · 桂') : !香屏.includes('乳香'),
     '方子跟「我还不知道你缺什么」对得上　—— 说得出话才给方子',
     `说了话=${说了话}`)
  /* 她那一句要按【你缺什么】来。这一趟没建本命，所以她该说不知道，
     **而不是编一句** —— 说错了比不说更伤。 */
  ok(!香.那句, '没建本命时她不编一句', String(香.那句 || '(空)'))
  ok(香屏.includes('先把出生时间填了'), '而是说不知道，并给出口')

  /* 选中一档。类名跟 index.wxml 对上 —— 0830 把三档改成了牌（`.pick`），
     而这里还写着旧的 `.entry`：点不到的选择器不会当场红，它先挂满三十秒再抛，
     把整趟后面的断言一起带走。所以先确认它真在，再点；
     不在就报一条说得出名字的红，而不是让整轮停在这儿。 */
  const 档牌 = p.locator('.pick')
  if (!ok(await 档牌.count() > 0, '三档点得着（.pick）', `数到 ${await 档牌.count()} 张`)) {
    console.log('    ← 类名对不上就没法往下点，这一段跳过')
  } else {
  await 档牌.first().click()
  await p.waitForFunction(
    () => globalThis.__router.current().__route === 'pages/confirm/index',
    null, { timeout: 15000 },
  ).catch(() => {})
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/confirm/index',
     '挑一档点得进确认那一屏', await p.evaluate(() => globalThis.__router.current().__route))

  /* ── 券码那一格（2026-09-03）──────────────────────────────
     后端的优惠券这条链早就通了（锁定 → 核销 → 释放），
     而**用户这一侧一直没有输码的地方** —— 券发得出去，没人用得上。
     现在确认屏上有了，这一段验它真的能用。

     只在打真后端时验:假服务端不认券码，它会把任何码都放过去，
     那样「用上了」这三个字说的不是真事。 */
  if (API) {
    const 券码 = 'MIRROR' + Date.now()
    run(`INSERT INTO coupon(id, code, benefit_json, state, issued_at, expires_at, audit_note, region)
         VALUES ('cpn-mir-${Date.now()}', '${券码}',
                 '{"pct_off_bps":2000}'::jsonb, 'issued', NOW(),
                 NOW() + INTERVAL '30 days', '镜像验证', 'cn')`)

    const 原价 = await p.evaluate(() => globalThis.__router.current().data.totalText)
    await p.locator('.coupon-in').fill(券码)
    await p.locator('.coupon-try').click()
    await p.waitForFunction(
      () => globalThis.__router.current().data.券状态 !== '在算'
            && globalThis.__router.current().data.券状态 !== '',
      null, { timeout: 15000 },
    ).catch(() => {})
    const 券状态 = await p.evaluate(() => globalThis.__router.current().data.券状态)
    ok(券状态 === '用上了', '输一张真券，服务端认', 券状态 + '｜' + await p.evaluate(
      () => globalThis.__router.current().data.券说))

    /* 【减了多少要看得见】。这一格的全部意义就是让人在按付款之前
       知道自己少付了多少 —— 状态对而屏幕上没数，等于没做。 */
    const 屏 = await text()
    ok(/− ¥/.test(屏), '屏幕上写着减了多少', (屏.match(/− ¥\S+/) || [''])[0])
    const 实付 = await p.evaluate(() => globalThis.__router.current().data.实付文本)
    ok(!!实付 && 实付 !== 原价, '「一共」跟着变成实付', `原价 ${原价} → 实付 ${实付}`)

    /* 【试算不许动库】。它是「先算一遍」，锁券是下单那一步的事 ——
       试完就锁的话，人只是看了一眼价，券就挂在一张不存在的单上了。 */
    const 券态 = sql1(`SELECT state FROM coupon WHERE code='${券码}'`)
    ok(券态 === 'issued', '试算不锁券', 券态)

    // 编不出来的码要当场说清，而不是默默不动
    await p.locator('.coupon-in').fill('NOSUCHCODE' + Date.now())
    await p.locator('.coupon-try').click()
    await p.waitForFunction(
      () => globalThis.__router.current().data.券状态 === '不行',
      null, { timeout: 15000 },
    ).catch(() => {})
    const 坏说 = await p.evaluate(() => globalThis.__router.current().data.券说)
    ok(/没有这张券/.test(坏说 || ''), '编的码说得出为什么不行', 坏说)

    // 清掉，别让它影响后面那一段
    await p.locator('.coupon-in').fill('')
    await p.locator('.coupon-try').click()
    await p.waitForTimeout(300)
  }
  }
  await open('pages/incense/index', { id: 'prod-suhe-incense' })
  await p.waitForTimeout(1200)
  await shot('10-一味香')

  /* 【按月送】（2026-09-05）。这一屏上三档都是买一次，而香是会烧完的 ——
     那句注脚「十支约够一个月」本来就在说这件事，只是从前没有一条路
     通向「每月一盒」。
     它取不到价就整块不摆（不编一个价出来），所以这里先问它在不在。 */
  const 按月 = await p.evaluate(() => globalThis.__router.current().data.按月)
  ok(!!按月 && !!按月.priceText, '一味香那一屏有「按月送」这一条', JSON.stringify(按月))
  if (按月) {
    const 香屏 = await text()
    ok(/按月送/.test(香屏) && /随时能停/.test(香屏),
       '它说得出这是每月一盒、而且停得掉', (香屏.match(/按月送[^·]*·[^›]*/) || [''])[0].slice(0, 40))
    await p.locator('.monthly').click()
    await p.waitForTimeout(1200)
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/confirm/index',
       '点它去的是确认那一屏 —— 掏钱那一路',
       await p.evaluate(() => globalThis.__router.current().__route))
    /* 【它是实物，所以要问地址】。确认屏认的是 `fulfillment_kind === 'shipping'`,
       而按月送正是走这一支开通的（见 fulfillment.rs）——
       要是哪天它被改成 instant，这一条当场红:那时订阅照旧开得起来,
       而每月那一盒**没有地址可寄**。 */
    ok(await p.evaluate(() => globalThis.__router.current().data.要寄) === true,
       '确认那一屏知道它要寄东西 —— 会问地址',
       String(await p.evaluate(() => globalThis.__router.current().data.要寄)))
    await open('pages/incense/index', { id: 'prod-suhe-incense' })
    await p.waitForTimeout(900)
  }

  /* ── 同步点香（设计册 E1）─────────────────────────────────────
     这一屏一周只有二十五分钟能碰上，所以后端把「几点点香」做成了可配的
     （UNMEI_INCENSE_WEEKDAY / HOUR / MINUTES）—— 那不是测试后门，
     是运营本来就该能改的东西，顺带让它验得到。

     这里验的是【不到点】那一支：跑验证的这台机器上多半不是周四晚九点，
     而那正是设计册 10.7 说的那一条：**不做「本周还没开始」的占位页**。
     到点那一支要另起一个把时刻设成「现在」的实例，
     `bash scripts/verify-incense-night.sh` 一条命令跑完。 */
  /* 【屏上那个时刻要跟后端那份排期对得上】（2026-09-05）。
     几点点香在后端是配置（`UNMEI_INCENSE_WEEKDAY` / `HOUR`），
     而屏上那四句话曾经写死是「周四晚九点」。这一支自己就撞见过：
     它跑在一个把窗口挪到凌晨的实例上，屏上照旧写着「今晚九点已经开始了」，
     断言却绿着 —— 因为它对的是自己那份一模一样写死的字。

     这里只取【那一天】跟【那个钟点】两个词来对。整句照抄一遍等于把
     同一份规则写第二遍，而两份规则会各自漂。 */
  const 周几那一词 = (w) => ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][w]
  const 钟点那一词 = (h) =>
    ['十二', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十', '十一'][h % 12] + '点'
  const 排期 = await p.evaluate(async (base) => {
    const raw = localStorage.getItem('unmei:buwanren:token')
    const r = await fetch(base + '/v1/incense/schedule',
                          raw ? { headers: { authorization: 'Bearer ' + JSON.parse(raw) } } : {})
    return await r.json()
  }, API || '')
  const 今晚 = await p.evaluate(() => globalThis.__router.current().data.tonight)
  const 香屏2 = await text()
  if (今晚) {
    ok(香屏2.includes('一起点一支'), '今晚开着，那一槽是入口')
    ok(香屏2.includes(钟点那一词(排期.hour)),
       '那一槽说的钟点就是配置里那个', 香屏2.slice(0, 40))

    /* 到点那一档（`scripts/verify-incense-night.sh` 走的就是这里）。
       它验的是这一屏【真的能用】：点得进、能点上、一人一次不叠加、
       没香的人有出口。 */
    /* 点它靠的是【它是那一槽】，不是它写着哪几个字 ——
       那几个字现在按排期生成，写死在这儿等于又造一份会漂的规则。 */
    await p.locator('.flexslot.slot-e1.slot-on').click()
    await p.waitForFunction(
      () => globalThis.__router.current().__route === 'pages/lighting/index',
      null, { timeout: 15000 },
    ).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/lighting/index',
       '那一槽点得进点香那一屏', await p.evaluate(() => globalThis.__router.current().__route))

    await p.waitForTimeout(1500)
    const 夜 = await text()
    ok(夜.includes('今晚一起点一支'), '这一屏说的是「今晚一起点一支」')
    /* 【分钟不一定是两位】（2026-09-05）。原先写的是 `\d\d:\d\d` ——
       而烧多久是配置（`UNMEI_INCENSE_MINUTES`，后端 clamp 到 1–240）。
       把窗口设成两小时以上，屏上就是「已烧 127:34」，三位数，
       这一条当场红，而那一屏一个字都没错。
       判据比它要守的东西窄:守的是「这个数在走」，不是「它有几位」。 */
    ok(/已烧 \d+:\d\d/.test(夜), '烧了多久在走', (夜.match(/已烧 \S+/) || [''])[0])
    /* 没有顶栏没有 tab —— 全屏时刻（设计册 10.2）。
       这一刻给任何导航都是打断。 */
    ok(await p.evaluate(() => {
      const bar = document.getElementById('wx-tabbar')
      return !bar || getComputedStyle(bar).display === 'none'
    }), '这一屏没有 tab 条　—— 全屏时刻')

    /* 没点的时候那支香【不该在烧】。头一版无论点没点，屏上都有火星和烟，
       于是「我也点了」按下去画面上什么都没发生 —— 逐帧拍才看出来
       （100ms 与 1600ms 两帧只有按钮变灰，而按钮是从橙变灰：
        那一下的回报是【负】的）。尺子 §1.5.35 第三条。 */
    ok(await p.evaluate(() => !document.querySelector('.ember')),
       '还没点的时候香是冷的　—— 没点着的香不该冒烟')
    ok(await p.evaluate(() => document.querySelectorAll('.smoke').length === 0),
       '还没点的时候没有烟')

    /* 「我没有香」通到苏合那儿 —— 不推销，只放这一个出口。
       **点香【之前】验**：点上之后这颗按钮就不在了（你已经有香了），
       原先这一段排在点香之后，那时它会点空。 */
    await p.getByText('我没有香', { exact: true }).click()
    await p.waitForFunction(
      () => globalThis.__router.current().__route === 'pages/incense/index',
      null, { timeout: 15000 },
    ).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/incense/index',
       '「我没有香」通到苏合那儿', await p.evaluate(() => globalThis.__router.current().__route))
    await open('pages/lighting/index')
    await p.waitForTimeout(1400)

    const 点前 = await p.evaluate(() => globalThis.__router.current().data.count)
    await p.getByText('我也点了', { exact: true }).click()
    /* 窜火只烧那一下（0.9s），所以要【立刻】看 —— 等 iLit 落定再看就晚了。
       这一条盯的是「这一下屏上真的发生了什么」。 */
    const 窜过火 = await p.waitForFunction(() => !!document.querySelector('.flare'),
                                          null, { timeout: 4000 }).then(() => true, () => false)
    ok(窜过火, '点下去有一下窜火　—— 每周只有这一下，屏上不能什么都不发生')
    await p.waitForFunction(() => globalThis.__router.current().data.iLit === true,
                            null, { timeout: 15000 }).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().data.iLit) === true,
       '点得上', String(await p.evaluate(() => globalThis.__router.current().data.count)))
    const 点后 = await p.evaluate(() => globalThis.__router.current().data.count)
    ok(点后 === (点前 || 0) + 1, '人数加了一个', `${点前} → ${点后}`)
    ok(await p.evaluate(() => !!document.querySelector('.ember')),
       '点上之后火星亮着')
    await p.waitForTimeout(600)
    ok(await p.evaluate(() => document.querySelectorAll('.smoke').length > 0),
       '烟也起来了')
    /* 一个人一场只算一次。连点十下不该变成十个人 ——
       现在那颗按钮点完就【不在了】（灰掉的大按钮会把屏上最重的一块地方
       留给一个按不动的东西，而此刻该被看的是那支香），
       后端那一侧也拦（主键 + ON CONFLICT）。 */
    ok(await p.evaluate(() =>
         ![...document.querySelectorAll('button')].some((e) => /我也点了|你点上了/.test(e.innerText))),
       '点过之后那颗按钮就不在了　—— 再点不出第二个人')
    ok((await text()).includes('你点上了'), '点上之后屏上说得出这件事已经成了')

    await shot('11-同步点香')
  } else {
    /* 那一槽在矮屏上是收起的（弹性槽），所以这一条要在长屏上看。
       在矮屏上读它，读到的永远是空 —— 那样这条断言测的是「槽收没收起」，
       不是「它是不是入口」。 */
    await p.setViewportSize({ width: 390, height: 844 })
    await open('pages/incense/index', { id: 'prod-suhe-incense' })
    await p.waitForTimeout(1500)
    const 长屏香 = await text()
    ok(长屏香.includes(周几那一词(排期.weekday)) && 长屏香.includes(钟点那一词(排期.hour)),
       '不到点时那一槽只是一句话，而且说的是配置里那个时刻',
       长屏香.slice(0, 60))
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
/* 0830:那一行运营口径（「住着 N 位 · 还空 M 间」）换成了进度条 + 「N / 40」。
   要验的东西没变 —— 这个数来自服务端而不是画面里数出来的。 */
ok(/\d+\s*\/\s*\d+/.test(槽文), '收集数来自服务端',
   (槽文.match(/住着 \S+ 位 · 还空 \S+ 间/) || ['没找到'])[0])
/* 头一眼是有人在跟你打招呼，而且【知道你现在几点】（设计册 10.8）。 */
/* 六档穷举 —— 跟 pages/village/index.ts 的 `问候()` 一一对上。
   它是白名单，所以那边加一档、这边不加，就会在一天里的某几个钟头误红，
   而误红只在那几个钟头出现，最容易被当成偶发噪音放过去。 */
const 问候档 = /(早上好|上午好|下午好|傍晚好|晚上好|夜深了)/
ok(问候档.test(槽文), '头一眼是一句问候', (槽文.match(问候档) || [''])[0])
/* 「8月30日 · 周日」。原先钉的是汉字数字（「八月三十」）——
   用户 2026-08-30 指出那个写法读起来像农历，而这个产品正在把玄学味去掉。
   现在钉阿拉伯数字那一种，跟 utils/day 的 `今天几号()` 对上。 */
ok(/\d{1,2}月\d{1,2}日 · 周[一二三四五六日]/.test(槽文),
   '而且写着今天几号', (槽文.match(/\d{1,2}月\d{1,2}日 · 周./) || [''])[0])
await p.setViewportSize({ width: 375, height: 667 })
await shot('01-village')

// ③ 空宅基会说话，且不给「问」的入口 ─────────────────────────────
console.log('\n── 点一格空着的（桃桃还没请回家）──')
await tapPlot('tao')
await p.waitForTimeout(600)
/* 点中之后开一屏，不再摊卡片（docs/REDESIGN.md R2）。 */
ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/plot/index',
   '点一格空的，开的是空屋那一屏',
   await p.evaluate(() => globalThis.__router.current().__route))
const t1 = await text()
ok(t1.includes('空着'), '空屋说它空着')
/* **说得出是哪一间**。四十格原先点进去长得一模一样（都是「这间空着」），
   而人是从图上点着某一格进来的 —— 那一屏答不上「我在哪儿」（标尺 §1.5.4）。
   桃桃在第三排第一列 = 进村口、西头。位置由村子那边按 row/col 传过来。 */
ok(/进村口，西头那间空着/.test(t1),
   '空屋说得出是哪一间　—— 四十格不再长得一模一样',
   (t1.match(/\S*那间空着|这间空着/) || [''])[0])
/* 而且【仍然不说是谁】。传的是 row/col 不是 at —— 位置不是新信息
   （他刚在图上看见那一格），名字才是。 */
ok(!/桃桃|tao/i.test(t1), '仍旧不说是谁的　—— 还没请回来的人连名字都不该知道',
   t1.slice(0, 40))
ok(!/\bid=|at=/.test(await p.evaluate(() => location.search + JSON.stringify(globalThis.__router.current().options || {}))),
   '空屋那一屏拿不到住户的编号　—— 传的是位置，不是人')
/* 说了还得【看得见】。这条检查有来由：卡片时代它排在村子图后面，
   而村子图比屏幕高 —— 2026-08-18 之前它永远落在屏幕外，点一格房子
   屏幕上什么都不动，而所有检查照样绿，因为 innerText 里读得到它。
   现在是独立一屏，但这条不能删 —— 换成「那句话真的在视口里」。 */
const 那句位置 = await p.evaluate(() => {
  // 按 class 找，不按文案找 —— 文案会变（现在它说的是「进村口，西头那间空着」）
  const all = [...document.querySelectorAll('.empty-t')]
  const el = all[all.length - 1]
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight }
})
ok(那句位置 && 那句位置.top < 那句位置.h && 那句位置.bottom > 0,
   '而且看得见　—— 在屏幕外的话，等于什么都没发生',
   那句位置 ? `top ${那句位置.top} / 视口 ${那句位置.h}` : '找不到那句话')
ok(!t1.includes('桃桃'), '空屋不说是谁的　—— 还没请回来的人，名字都不该知道')
ok(!/问问|问一件/.test(t1), '空屋不给「问」的入口　—— 那是设定不是权限', t1.slice(0, 40))
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
    return { n: c.data.能请.length + c.data.没来.length, err: c.data.err, loading: c.data.loading }
  })
  const 请文 = await text()
  ok(!请.loading && !请.err &&
     (请.n > 0 || 请文.includes('一位也没数到')),
     `「谁能来」说得对（${请.n > 0 ? '有 ' + 请.n + ' 位' : '一位没有 · 出空状态'}）`,
     `n=${请.n} err=${请.err}`)

  /* 四十位都在册上，没上架的照实说（设计册 10.8）。
     只列在卖的那几位，读的人会以为世上只有那几位 —— 那是拿别人顶上。
     **不断言「几位在卖」** —— 那是这台机器上的数据；断言的是
     「册上的人比在卖的多」与「多出来的那些收在『还在路上』里、按不动」。

     0830 改了结构：原先四十位平级混排、五位一页翻，而在卖的只有几位 ——
     往后整整七页全是灰的「还没来」。现在能请的摆在前面，没来的收成一行，
     所以这里验的从「翻到有未上架的那一页」变成「摊开看得见他们」。 */
  if (请.n > 0) {
    const 册 = await p.evaluate(() => {
      const d = globalThis.__router.current().data
      return { 共: d.能请.length + d.没来.length, 在卖: d.能请.length, 展开: d.展开 }
    })
    ok(册.共 >= 册.在卖, '册上的人不比在卖的少', `${册.在卖} 在卖 / 共 ${册.共}`)
    if (册.共 > 册.在卖) {
      /* 收着的时候他们不该占地方 —— 这正是改结构要买的东西。
         `展开` 在「一位都请不动」时默认是开的，那一支下面单独验。 */
      if (!册.展开) {
        ok(await p.evaluate(() => document.querySelectorAll('.soon-item').length) === 0,
           '收着的时候没来的那些一行都不占 —— 改结构买的就是这个')
        /* 【这一行要说清为什么请不了】（2026-09-02 第三轮评审）。
           「还没请」的意思是「你还没请」，读起来像点一下就能请；
           而这 36 位是真的请不了 —— 没有在架的居住商品，因为屋子还没盖。
           人看到一个点不动的货架而不知道为什么，只会以为这 app 坏了。
           （更早那一版写的是「还在路上」，听着像明天就到，同样不行。） */
        ok((await text()).includes(`另外 ${册.共 - 册.在卖} 位，还搬不进来`),
           '没来的那些收成一行，数目照实报，并说清为什么请不了', `${册.共 - 册.在卖} 位`)
        await p.getByText('还搬不进来', { exact: false }).first().click()
        await p.waitForTimeout(500)
      }
      const 摊开后 = await p.evaluate(() => ({
        展开: globalThis.__router.current().data.展开,
        行: document.querySelectorAll('.soon-item').length,
      }))
      ok(摊开后.展开 && 摊开后.行 === 册.共 - 册.在卖,
         '摊开之后没来的那些一位不少 —— 不是把他们永远藏起来',
         `摊开 ${摊开后.行} 行 / 应有 ${册.共 - 册.在卖}`)
      /* 摊开之后还要说清【齐了会怎样】—— 上面那一行只够说「还搬不进来」。
         不说的话，人的下一个问题（那我要不要等）没有答案。 */
      ok((await text()).includes('走得动了'),
         '摊开之后说得出什么时候请得回来 —— 不是只留一个「搬不进来」')
      // 0830:「未上架」是运营词，买家那一侧说的是「还没来」
      /* 没来的那些按不动 —— 点了再说「买不了」是先答应再反悔。
         它们连 bindtap 都没有，所以这一条验的是「真的没接」。 */
      const 之前 = await p.evaluate(() => globalThis.__router.current().__route)
      const 那行 = p.locator('.soon-item').first()
      if (await 那行.count()) {
        await 那行.click()
        await p.waitForTimeout(700)
        ok(await p.evaluate(() => globalThis.__router.current().__route) === 之前,
           '还没来的那一行按不动　—— 不是点了再说买不了',
           await p.evaluate(() => globalThis.__router.current().__route))
      }
      /* 收回去 —— 后面几条验的是默认那一屏 */
      if (!册.展开) {
        await p.getByText('收起', { exact: false }).first().click()
        await p.waitForTimeout(400)
        ok(await p.evaluate(() => globalThis.__router.current().data.展开) === false,
           '收得回去 —— 摊开与收起是同一个开关的两面')
      }
    }
  }

  /* 空的那一支只有 CI 的种子库才碰得到（本机目录里御守上百件）。
     不改共用的库去造空态 —— 那影响面比预期大（docs/FINDING-2026-08-22-*）。
     直接把 items 清空，验模板确实说得出「哪儿能有」。 */
  await p.evaluate(() => globalThis.__router.current().setData({ 能请: [], 没来: [], 预告: [], loading: false, err: '' }))
  await p.waitForTimeout(200)
  const 空请 = await text()
  ok(空请.includes('一位也没数到') && 空请.includes('这份名单没取到'),
     '「谁能来」空的时候也说得出下一步 —— CI 的种子库就是这一支',
     空请.slice(0, 44))
  await open('pages/invite/index')

  /* 「一屏放得下」那条约束(设计 10.3)在 0830 的落点从翻页换成了折叠：
     默认那一屏只摆能请的几位，一屏放得下；没来的收成一行。
     翻页是旧落点 —— 它把四位能请的摊成八页，后七页全是灰的。
     摊开／收起两头在上面那段已经验过，这里只钉住【默认态不摊开】——
     默认就摊开的话，这一屏又会滚，那条约束就白立了。 */
  await open('pages/invite/index')
  {
    const d = await p.evaluate(() => {
      const x = globalThis.__router.current().data
      return { 展开: x.展开, 能请: x.能请.length, 没来: x.没来.length }
    })
    if (d.能请 > 0) {
      ok(d.展开 === false, '默认那一屏不摊开 —— 摊开就滚了', `能请 ${d.能请} / 没来 ${d.没来}`)
    } else {
      /* 一位都请不动的时候收着才是错的：那是一屏空白。 */
      ok(d.展开 === true, '一位都请不动时默认摊开 —— 收着的话这一屏是空的')
    }
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
    await p.locator('button.btn').filter({ hasText: '回村' }).first().click()
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
    /* 还得【没住进来】—— 住进来的那一屏上是「问问她／去屋里坐坐」，
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
    /* 【候选跟着真目录走】（2026-09-06）。这张名单原先写着 shenyan ——
       他那时「有货」靠的是库里的测试夹具，而夹具随每一轮门禁长出来、
       又被下一支下架。真目录建起来之后在架的是阿云、桃桃、婆婆、丹增
       （见 20260906001_omamori_catalogue.sql）。
       名单跟不上目录时这一条不报错,它只是【安静地跳过】—— 而跳过
       在这个脚本里不计入通过,于是一条从来没跑过的断言看着跟绿的一样。 */
    for (const v of ['ayun', 'tao', 'popo', 'tenz']) {
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
       `「请回家」找到了 ${有货的那位} 的御守`, 有货.路由)
  } else {
    console.log('  · 跳过「有货那条」：这个库里没有任何御守在卖（不计入通过）')
  }

  /* 没货那一条任何库都成立：挑一个**确定没有**的。
     【原先挑的是桃桃】,而 2026-09-06 她上架了 —— 于是这一条从那天起
     一直在跳过,而跳过不计入通过。换成白鹭:她的屋子盖好了、口气也写了,
     但村里没有她走动的那副像素,所以她【按定义】不上架
     （`scripts/check-can-move-in.py` 守着这条,她一上架那一支就红）。
     照旧先问一句,不假设。 */
  const 白鹭有货 = await p.evaluate(async (base) => {
    const r = await fetch(`${base}/v1/products?region=cn&platform=mini&category=omamori&villager_id=bailu`)
    if (!r.ok) return false
    const j = await r.json()
    return Array.isArray(j) && j.length > 0
  }, API)
  if (白鹭有货) {
    console.log('  · 跳过「没货那条」：白鹭这回真有货（不计入通过）')
  } else {
    /* 【话挪到按钮上了】。原先要【点一下】才说「他的御守还没上架」——
       等于让人白点一趟。现在这句直接写在按钮上，而且按钮是灰的：
       没上架这件事在按之前就看得见。
       所以这一条现在验两样：按钮说了这句话、并且按不动。 */
    await open('pages/villager/index', { id: 'bailu' })
    await 等取完('pages/villager/index')
    await p.waitForTimeout(800)
    const 桃 = await p.evaluate(() => {
      const b = [...document.querySelectorAll('button.btn')]
        .find((x) => /还没做出来|回村/.test(x.innerText))
      return { 文: b ? b.innerText : '（没找到那颗按钮）', 灰: b ? b.disabled : false }
    })
    ok(桃.文.includes('还没做出来') && 桃.灰,
       '没有御守在卖的那位，按钮上直说「还没做出来」并且按不动　—— 不让人白点一趟',
       `${桃.文} · disabled=${桃.灰}`)
  }
} else {
  console.log('  · 跳过「请一位来」与「请他来」：要真目录（不计入通过）')
}

// ④ 住着的那一格：问一句出签 ─────────────────────────────────────
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
/* 0830:属性从三行横线表格（「缺的是 / 会这一门 / 稀有度」）改成了一排标签，
   所以这一行现在长成「缺 勤」。要验的东西没变 —— 这一屏说得出他缺什么。 */
ok(/缺\s*\S/.test(t2), '说得出缺什么　—— 卡片放不下的正是这一行', t2.slice(0, 40))
ok(/问问[^\s]/.test(t2), '住着的那位给得出「问问她」的入口', t2.slice(0, 30))
ok(t2.includes('去屋里看看'), '给「去屋里看看」　—— 阿云那间房搬进来了', t2.slice(0, 40))

/* 先按一下「回村里」再回来。下面那条同样的检查挂在「目录里有他的 sku」上，
   而这一趟没有 sku 时它整条跳过 —— 于是从村子点进来的这一支，
   回不回得去从来没人问过。这一支不需要 sku。 */
{
  await p.getByText('回村里', { exact: true }).click()
  await p.waitForTimeout(600)
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/village/index',
     '从村子点进那一位，按「回村里」回得去',
     await p.evaluate(() => globalThis.__router.current().__route))
  /* 回来之后等这一屏**真的又能用**,不是等它路由对了就算 ——
     村子那张画布重画要一会儿，点早了这一格还没在。 */
  for (let i = 0; i < 10; i++) {
    await tapPlot('ayun')
    await 等取完('pages/villager/index')
    const 在 = await p.evaluate(() => globalThis.__router.current().__route === 'pages/villager/index'
      && /问问/.test(document.getElementById('app').innerText || ''))
    if (在) break
    await open('pages/village/index')
    await p.waitForTimeout(500)
  }
}

await p.locator('button.btn').filter({ hasText: '问问' }).first().click()
/* 等签真的落下来，不数毫秒。700ms 在负载高的机器上不够 ——
   报出来的是「出的不是阿云的口气」，而实际只是还没到。 */
await p.waitForFunction(
  () => !!(globalThis.__router.current().data.say || ''),
  null, { timeout: 20000 },
).catch(() => {})
const t3 = await text()
/* 断言签的【形状】,不断言某一句话。
   结论是从池子里按 seed 挑的，假服务端给「该动了」而真后端给「别再等了」——
   第一版照假服务端那句写死，打真后端就红了，而红的是断言不是产品。 */
/* 【2026-09-01 两条都跟着文案改了】。
   原先钉的是「贫道」——「贫道」是文言，硬要求明令不许，改成
   「眯着眼看了一眼……」之后这条断言就红了。
   第二条更值得记一笔：它断言的是「签里有宜有忌」—— 也就是说
   这条断言在【要求那句行话存在】。同一批词在罗盘那一屏早就改成了
   「今天适合 / 先别」，而这里的断言把村民问签那一侧钉死在黄历腔上。
   护栏钉在要被淘汰的东西上，就会替它挡住改动。 */
const 开场 = '眯着眼看了一眼'
/* 【找不到时别 slice(-1)】。`indexOf` 找不到返回 -1，
   `slice(-1)` 取的是最后一个字符 —— 于是失败信息是「里」这么一个字，
   看着像页面上真的只有那一个字，而实际是整段都不在。
   报信错了，查起来会走到完全错的方向（2026-09-03 真花了一轮）。 */
const 位 = t3.indexOf(开场)
const said = 位 >= 0 ? t3.slice(位) : ''
ok(位 >= 0, '出的是阿云的口气',
   位 >= 0 ? said.slice(0, 24) : `没找到「${开场}」；屏上是：${t3.slice(0, 60).replace(/\s+/g, ' ')}`)
ok(said.includes('今天适合') && said.includes('先别'),
   '签里说得出今天适合什么、先别什么　—— 而且是人话，不是「宜/忌」', said.slice(0, 40))
/* 【问签也算「问过一件事」】（2026-09-06 五路评审 · §七）。
   在这之前徽章只由转盘触发、只数 `naji_record` —— 天天来村民屋里问的人，
   「一百次」与「七天没断」永远停在 0，而屏上那几枚灰徽章底下
   写着「去问一件事」，指的正是这件事。
   判据钉在【数】上，不钉在某一枚：刚问过的这个人，
   「一百次」那一枚的进度必须 ≥ 1。 */
if (API) {
  const 进度 = await p.evaluate(async (base) => {
    const raw = localStorage.getItem('unmei:buwanren:token')
    const r = await fetch(base + '/v1/user/me/badges', {
      headers: raw ? { authorization: 'Bearer ' + JSON.parse(raw) } : {},
    })
    if (!r.ok) return null
    const j = await r.json()
    const b = (j || []).find((x) => x.code === 'hundred_naji')
    return b ? (b.progress || null) : null
  }, API)
  ok(进度 && 进度.have >= 1,
     '问了一签之后，「问过一百件事」那一枚的进度真的动了　—— 问签也算数',
     进度 ? `${进度.have} / ${进度.need}` : '（后端没给 progress）')
}
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
      .match(/const 说话那格高 = (\d+)/) || [])[1])
    /* 这个常量的语义是「为那一格【留够】多少」，不是「它正好多高」——
       那一格一行 90、两行 115，看签文有多长。写死一个数再要求相等，
       就成了「内容短的时候绿、长的时候红」的断言（2026-08-31 撞到：
       实测 115 / 写死 90，村主屏超 22px，重跑又绿，因为签文换了）。
       留够就行，多留一点只是画布小一点点。 */
    ok(写死的 > 0 && 写死的 >= 实高,
       'fitCanvas 那个数给「今天说的一句」留够了高度',
       `代码里 ${写死的}，实测 ${实高}`)
  }
}

console.log('\n── 点一格住着、但屋子还没搬进来的（陈九）──')
await tapPlot('chenjiu')
await 等取完('pages/villager/index')
const t4 = await text()
ok(t4.includes('陈九'), '认出是谁')
// 原先屏上写「屋子还没搬进来」—— 搬进来的是人不是屋子，而且它说的其实是
// 「我们还没把这一间做出来」。改成「X 的屋子还在盖」，断言跟着改。
ok(/屋子还在盖/.test(t4), '明说这一间还没做出来　—— 不装作能进')

// ⑥ 进屋 ────────────────────────────────────────────────────────
console.log('\n── 进屋 ──')
await tapPlot('ayun')
await 等取完('pages/villager/index')
await p.getByText('去屋里看看', { exact: true }).click()
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
   所以要问裁掉的那两条里有没有点不到的东西 —— 一件物件整个落在带子外面，
   它就等于不存在，而屋子照样画得出来、动得起来，上面每一条都绿。
   拿最矮的机器问，因为裁得最多的就是它。 */
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
/* 退出之后还烧不烧帧。屋里在动是应该的，离开之后还在动就是白耗电 ——
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
/* 匿名登录是异步的。页面 onShow 立刻取一次，那时 token 还没落地 —— 后端给 401;
   登录一回来 onAuthReady 再叫一次。第二次常常撞在第一次【还没走完 finally】
   的那一瞬，而防重入的闸门会把它直接扔掉，页面从此停在「取不到本命」,
   切一次 tab 才自愈。(实测：78ms 登录 200 → 80ms 请求 401 → 81ms onAuthReady 到。)

   这一条只在打真后端时有意义：假服务端没有匿名登录，也就没有那一下。 */
if (API) {
  console.log('\n── 冷启动：第一次还在飞的时候又叫了一次 ──')
  errs.length = 0
  await open('pages/natal/index')

  /* 直接钉【机制】,不去赌那个时序。

     第一版是「打开页面，看 err 是不是空的」—— 而那条只在两件事撞上的那一瞬才红：
     把修复删掉重跑，它照样绿。**一条只在时序对上时才红的检查比没有更糟**,
     它平时全绿，偶尔为了没人复现得了的理由红一次。

     这里改成：趁第一次请求还没回来再叫一次，数一数总共发了几次。
     被扔掉就是 1 次，补上了就是 2 次。 */
  let 请求数 = 0
  const 数请求 = (r) => { if (r.url().includes('/v1/user/natals')) 请求数++ }
  p.on('request', 数请求)
  await p.evaluate(() => {
    const c = globalThis.__router.current()
    c.loadDefault()          // 第一次，不等它
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
   垫片如果直接 Object.assign,会造出一个名字里带点的键，而 {{form.date}}
   读的是嵌套值 —— 于是表单看着没反应，不报错也不告警。
   镜像在这一点上骗人的话，建本命这条核心动线的验证就完全不作数，
   所以这里连着走一遍：点下去 → 页面自己的 handler → setData 路径 → 渲染。 */
console.log('\n── 本命页的表单（setData 用的是路径写法）──')
errs.length = 0
await open('pages/natal/index')
await p.evaluate(() => globalThis.__router.current().setData({ mode: 'form' }))
await p.waitForTimeout(300)

await p.getByText('女').click()
await p.waitForTimeout(200)
const g = await p.evaluate(() => {
  const pg = globalThis.__router.current()
  return { 值: pg.data.form && pg.data.form.gender,
           假键: Object.keys(pg.data).filter((k) => k.includes('.')),
           /* 【哪一个】选中，不是「有没有选中的」—— 乾/M 本来就亮着，
              问后者的话，值根本没写进去时它照样是绿的（变异测过） */
           选中: [...document.querySelectorAll('.seg-item.on')].map((e) => e.textContent.trim()).join(' ') }
})
ok(g.值 === 'F', '点「坤/F」写进了 form.gender', String(g.值))
ok(g.假键.length === 0, '没造出名字里带点的假键', g.假键.join(' ') || '一个都没有')
ok(g.选中 === '女', '亮起来的正是「坤/F」　—— 值写对了但渲染没跟上也是白搭', g.选中 || '一个都没亮')

/* 真填那个选择器，不绕过它调 handler ——
   picker 曾被渲成一个点不动的方块，而绕过去调 handler 的检查照样是绿的。
   这一条现在从「点得动吗」一路验到「页面上看得见吗」。 */
const dp = p.locator('input[data-picker="date"]')
const 有选择器 = await dp.count() === 1
ok(有选择器, 'picker 是真能点的原生选择器，不是个方块', String(await dp.count()))
if (有选择器) {
  await dp.fill('1998-03-05')
  await p.waitForTimeout(200)
  ok((await text()).includes('1998-03-05'), '选了日子，页面上就看得见', '{{form.date}}')
  ok(await p.evaluate(() => globalThis.__router.current().data.form.date) === '1998-03-05',
     '选择器发的是小程序那个形状的事件', 'detail.value → form.date')
} else {
  // 没有选择器就别去填它 —— 那会卡满三十秒再抛一段栈，
  // 门禁失败该看得懂，不该看着像它自己坏了
  ok(false, '选了日子，页面上就看得见', '选择器都不在，没得填')
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
await p.getByText('男').click()
await p.waitForTimeout(200)
const gm = await p.evaluate(() => ({
  值: globalThis.__router.current().data.form.gender,
  选中: [...document.querySelectorAll('.seg-item.on')].map((e) => e.textContent.trim()).join(' '),
}))
ok(gm.值 === 'M', '点「男」写进了 form.gender', String(gm.值))
ok(gm.选中 === '男', '亮起来的正是「男」', gm.选中 || '一个都没亮')

// 备注那一栏走 bindinput，跟上面几个不是一条路
const lab = p.locator('.field-input').first()
if (await lab.count() === 1) {
  await lab.fill('镜像验的')
  await p.waitForTimeout(200)
  ok(await p.evaluate(() => globalThis.__router.current().data.form.label) === '镜像验的',
     '备注打进了 form.label', 'bindinput → form.label')
}

/* 建本命 —— 填完真的按下去。

   这一段要的不只是真后端，还要【排盘服务】(mingli,在另一个仓库):
   用神是它算的。CI 上没有它，所以那里跑不了这一段。

   不给它做个假的：假服务会按我【以为的】形状回话，
   而 2026-08-18 抓到的那个 bug 恰恰是「我以为的形状」错了
   (性别发 M,它只认 male)—— 假服务会把这种错原封不动地盖住。

   所以：给了 --mingli 就真验，没给就【明说跳过】,不计入通过。 */
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

     **这几行不是文案，是几件真做得到的事** —— 所以这里不只验它写着，
     还要验它没有把做不到的事写上去：
       · 你缺的     → 算完就在这一屏上（下面那几条断言正是它）
       · 每天那一句 → 「谁能来」顶上那句「你缺 X，这几位跟你补得上」
       · 苏合配的香 → 她那一屏按你缺的说的那句话
     哪天某一条不成立了，这一行就得删；先答应做不到的事，比不答应更伤。

     「伤你的 两个字」就是这么删掉的：结果屏上那两个五行字块撤了
     （人话里已经说过同一件事，再列一次是同一件事说两遍），
     而预告还在答应它 —— 所以这里连它【不在】也一并钉住。 */
  const 会得到 = await text()
  ok(会得到.includes('会得到这些'), '算之前先说清换回什么')
  for (const 一行 of ['你缺的', '每天那一句', '苏合配的香']) {
    ok(会得到.includes(一行), `「会得到这些」里写着「${一行}」`, 一行)
  }
  ok(!会得到.includes('伤你的'),
     '不再答应「伤你的」　—— 结果屏上早就不给它了')

  /* 三样没填齐时按一下。这一条钉住两件事：
       · 表单【留在原地】—— 原先这句写进 `err`，而表单整块挂在
         `wx:elif="{{!err}}"` 上，于是按一下整屏只剩一行粉字，
         连回去填的地方都没有（逐帧拍才看见：那一帧是张空白页）
       · 差哪几样就地指出来 */
  {
    /* 走到这里时前面的动线可能已经填过 —— 那就先清空。
       这是【夹具】，跟删签一样写在明处：要验的是「没填齐时按下去会怎样」,
       而不是「这一趟碰巧有没有填过」。 */
    await p.evaluate(() => {
      const c = globalThis.__router.current()
      c.setData({ 填了: { date: false, time: false, gender: false },
                  齐了: false, 缺提示: '', 缺了: { date: false, time: false, gender: false } })
    })
    await p.waitForTimeout(250)
    const 空 = await p.evaluate(() => {
      const c = globalThis.__router.current()
      return { 齐了: c.data.齐了, 填了: c.data.填了 }
    })
    if (!空.齐了) {
      /* 【2026-09-01 改了表现】。原先这颗按钮在没填齐时是灰的（btn-wait）、
         点了在下面冒一句「还差……」。意图对（不禁掉让人猜），
         但灰色 + 棕字看着就是坏掉的按钮，人不会去按它，那句解释也就
         永远读不到。现在把话写在按钮上，颜色照常 —— 它一直能按。
         所以这里验的是【按钮自己说出还差什么】，然后按下去仍然指出栏位。 */
      const 钮文 = await p.evaluate(() => {
        const b = [...document.querySelectorAll('button.btn')]
          .find((x) => /还差|算一算/.test(x.innerText))
        return b ? b.innerText.trim() : '（没找到那颗按钮）'
      })
      ok(/^还差/.test(钮文), '没填齐时，按钮自己说出还差什么　—— 不是灰着让人猜', 钮文)
      await p.getByText(钮文, { exact: true }).click()
      await p.waitForTimeout(500)
      const 按后 = await text()
      ok(按后.includes('还差'), '按下去也说得出还差什么', (按后.match(/还差[^—]*/) || [''])[0])
      ok(按后.includes('你是哪天出生的'), '而且表单还在　—— 不是整屏只剩一句话')
      ok(await p.evaluate(() => document.querySelectorAll('.field-miss').length > 0),
         '差的那几栏自己指出来　—— 不必回去数哪一栏是哪一栏')
    } else {
      ok(false, '验得到「没填齐」那一支', '进来时三样已经齐了')
    }
    // 填齐它
    await p.evaluate(() => {
      const c = globalThis.__router.current()
      c.setData({ form: { ...c.data.form, date: '1995-06-15', time: '14:30', gender: 'M' },
                  填了: { date: true, time: true, gender: true }, 齐了: true, 缺提示: '' })
    })
    await p.waitForTimeout(300)
    ok(await p.evaluate(() => {
         const b = [...document.querySelectorAll('button.btn')]
           .find((x) => /还差|算一算/.test(x.innerText))
         return !!b && b.innerText.trim() === '算一算'
       }), '填齐之后按钮就说「算一算」　—— 不再报缺哪一样')
  }

  await p.getByText('算一算', { exact: true }).click()
  /* 【这一步比别处慢，余量要给够】。建本命是这条链上最重的一次：
     写 natal → 调排盘服务 → 存 summary → 出一册报告，四件事串着。
     本机上门禁（cargo 构建）跟镜像常常同时在跑，实测这一步整段
     花过十几秒（API 日志里单条 UPDATE 就 10.1s）——
     20 秒的余量于是偶发地不够，屏上停在表单，四条断言一起红。
     而【偶发的红比常红更糟】:它教人把每一次真红都当成噪音。
     45 秒对一次真排盘仍然是「不该超过」的量级，超了就是真慢。 */
  await p.waitForFunction(() => globalThis.__router.current().data.mode === 'summary', null,
                          { timeout: 45000 }).catch(() => {})
  const n = await p.evaluate(() => {
    const d = globalThis.__router.current().data
    return { mode: d.mode, id: d.natal && d.natal.id, ys: d.summary && d.summary.primary_yongshen }
  })
  ok(n.mode === 'summary', '生成完就换到本命那一屏', n.mode)
  /* 屏幕从表单变成结果，那本身就是回执 —— 不再弹一个黑框宣布「已生成」。
     逐帧拍看见的：那个黑框正压在结果中间那句人话上。 */
  ok(!(await text()).includes('已生成'),
     '不再弹「已生成」　—— 屏上已经变了，同一件事不说两遍')
  /* 章跟着五行走。原先边框恒为橙色，而「金」那个大字是冷灰蓝 ——
     两套颜色在同一张卡上打架。 */
  ok(await p.evaluate(() => {
    const el = document.querySelector('.stamp-card')
    return !!el && /stamp-(mu|huo|tu|jin|shui)/.test(el.className)
  }), '那一枚章跟着你缺的那一行走　—— 每个人的结果各有其色')
  ok(!!n.id, '这一份本命有了自己的编号　—— 后端真存下了', n.id || '没有')
  ok(!!n.ys, '排出了用神', n.ys || '空的')
  await shot('06-natal')

  /* 有了本命，再问一签 —— 这一签背后该有【真盘】。
     盘不外露(响应里没有这一栏),只落档，所以这条要查库。

     为什么非查不可：2026-08-18 之前它一直是空的。发给排盘服务的请求带的是
     natal_id,而它只认生辰，于是每次 422、每一签落空盘 —— 库里 84 条问签，
     80 条的盘是 null。前端一切正常，没有任何一处会红。

     先把这个用户今天的阿云签删掉：同一位同一天的签是有缓存的，不删的话
     再问一次拿到的是刚才那一条 —— 那时候还没本命，空盘是如实的结果，
     后端根本不会去取盘(日志里连一行都不会有)。删掉才是真的再问一次。
     这是【测试夹具】,跟发御守凭据一样，写在这里、看得见。 */
  const uid = sql1("SELECT user_id FROM villager_reading ORDER BY asked_at DESC LIMIT 1")
  run(`DELETE FROM villager_reading WHERE user_id='${uid}' AND villager_id='ayun'`)
  /* 建完本命，「今」那一页该有内容了 —— 它整页的意义就是「今日与本命对照」，
     而在这之前它只会劝你去建本命。这一段以前没验：那一页开得起来就算过。 */
  await open('pages/home/index')
  const 今 = await text()
  /* 「主用神」是术语，0830 已经从日常几屏上清掉了(专业细节只留在「那一份」)。
     今日页现在说的是「你缺的是「金」」—— 断言要跟着说新的话，
     而不是继续钉一个已经不该出现的词。 */
  ok(/你缺的是「.」/.test(今), '今日页说得出你缺的是什么　—— 对照有内容了', 今.slice(0, 46))
  ok(!今.includes('先输入生辰'), '不再劝你去建本命　—— 你刚建过')


  await open('pages/village/index')
  await tapPlot('ayun')
  await p.locator('button.btn').filter({ hasText: '问问' }).first().click()
  await p.waitForTimeout(1500)
  const 最近 = sql1("SELECT villager_id || ' | ' || coalesce(chart_json::text,'null') FROM villager_reading ORDER BY asked_at DESC LIMIT 1")
  const 盘 = 最近.split(' | ').slice(1).join(' | ')
  ok(盘 !== 'null' && 盘.length > 20, '有本命之后，签背后是真盘', 最近.slice(0, 40) + '…')
}

// ⑩ 起卦 ───────────────────────────────────────────────────────
/* 产品的核心交互，而验证以前只【打开】这一页就算过。
   摇手机在无头浏览器里发生不了(那台机器不会动),但这一页写的是
   「点击中心 · 或摇手机」—— 点这条路真机与网页版是同一条，验得了。

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
   按钮文案随之从「输入生辰」改成「填出生时间」（0830 语言清扫）。 */
const 去建 = p.getByText('填出生时间', { exact: true })
if (await 去建.count() === 1) {
  await 去建.click()
  await p.waitForFunction(
    () => globalThis.__router.current().__route === 'pages/natal/index',
    null, { timeout: 15000 },
  ).catch(() => {})
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/natal/index',
     '空的我家上按「填出生时间」，去的是填出生时间那一页',
     await p.evaluate(() => globalThis.__router.current().__route))
} else {
  ok(false, '空的我家上按「填出生时间」，去的是填出生时间那一页',
     `按钮不在（找到 ${await 去建.count()} 个）`)
}

/* 「再填一份」——只在【已经有本命】的时候在，所以放在建完之后。
   它把这一页切回表单，而这条路径从没被走过（切表单一直是 setData 塞的）。 */
await open('pages/natal/index')
await p.waitForTimeout(400)
if (await p.getByText('再填一份').count() === 1) {
  await p.getByText('再填一份').click()
  await p.waitForTimeout(300)
  ok(await p.evaluate(() => globalThis.__router.current().data.mode) === 'form',
     '按「再填一份」回到填出生时间那一屏',
     await p.evaluate(() => globalThis.__router.current().data.mode))
} else {
  console.log('  · 跳过：这一轮没有本命，「再填一份」不出现（不计入通过）')
}

console.log('\n── 起卦（点罗盘中心，不是摇手机）──')
errs.length = 0
/* 起卦搬到我家了（REDESIGN.md：起卦归我家 · 罗盘是 H1 上吃掉纵向富余的那一块）。
   转完之后跳去「今天」那一页看结果 —— 落位动画在我家走完再跳。 */
await open('pages/home/index')
/* 罗盘不看有没有本命 —— 起卦本来就不需要它。 */
/* 【记】状态变化，不【采样】状态。
   doSpin 先同步把 mode 设成 spinning 再去请求后端，而假服务端那条 404
   在一个来回里就走完了 —— 等我隔着进程去读的时候，它已经回到 idle。
   采样采不到的东西，不等于没发生过。 */
await p.evaluate(() => {
  const pg = globalThis.__router.current()
  globalThis.__modes = []
  const orig = pg.setData.bind(pg)
  pg.setData = (patch) => { if (patch && patch.mode) globalThis.__modes.push(patch.mode); return orig(patch) }
})
await p.getByText('问一件事', { exact: true }).click()
ok((await p.evaluate(() => globalThis.__modes))[0] === 'spinning',
   '点下去立刻开始转　—— 这一下不等后端，是给人的即时反馈',
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

  /* 【那张推荐卡真的在屏上】（2026-09-02 第三轮评审 · 第一次打开的人）。
     起卦那一刻后端确实回了推荐，但结果屏拿到 id 之后会用 `detail(id)`
     把整条记录【重取一遍】（ask/index.ts 的 `showWanted`）——
     而 detail 一直没把 `recommended_product_id` 放进响应体。
     于是那一瞬间有、页面一渲染就没了，
     `wx:if="{{result.recommend}}"` 永远不成立。

     后果是 ¥199 的「你的说明书」【全 app 没有一条路走得到】:
     另外三个入口指向御守与订阅，而订阅那屏说「村里现在没有可以订的东西」。

     所以这一条不看接口，看【屏上渲出来没有】—— 那才是它当初漏掉的地方。 */
  const 荐 = await p.evaluate(() => {
    const d = globalThis.__router.current().data
    const el = document.querySelector('.recommend')
    return { 有数据: !!(d.result && d.result.recommend),
             上屏: !!el, 文: el ? (el.innerText || '').replace(/\n/g, ' ').slice(0, 40) : '' }
  })
  ok(荐.有数据 && 荐.上屏, '一卦之后那张「也可以问问」真的渲在屏上',
     `数据 ${荐.有数据} · 元素 ${荐.上屏} · ${荐.文}`)
  ok(/[¥￥]\d/.test(荐.文), '那张卡上有价 —— 它是通往掏钱那一步的路', 荐.文)

  /* 【问的那件事得影响答案】（2026-09-02 第四轮评审 · 产品完整性）。
     起卦的种子原先只有「谁 + 哪一天 + 哪一小时」，问题只落库、
     不参与任何一次挑选 —— 同一小时里问「我该结婚吗」「明天会下雨吗」
     「这只股票能买吗」，返回的是【逐字相同】的一签。
     而这个产品卖的正是「替你看一件事」，起卦又没有日限，
     所以用户问第二件事就看得见。

     两头都要验：不同的事给不同的答案，同一件事再问还是同一句
     （后者是「不能反复摇到满意为止」那条，不能为了前者丢掉）。
     这里直接打后端 —— 页面上一次只问得了一件事，而要比的是三件。 */
  if (API) {
    const 问 = async (q) => await p.evaluate(async ([base, q]) => {
      // token 存在 localStorage 的 `unmei:buwanren:token`（跟这一支别处一致）
      const raw = localStorage.getItem('unmei:buwanren:token')
      if (!raw) return 'NO_TOKEN'
      const r = await fetch(base + '/v1/naji/spin', {
        method: 'POST',
        headers: { 'content-type': 'application/json',
                   authorization: 'Bearer ' + JSON.parse(raw) },   // 存的是 JSON 串
        body: JSON.stringify({ question: q }),
      })
      if (!r.ok) return 'HTTP_' + r.status
      const d = await r.json()
      return [d.gate, d.direction, (d.quote && (d.quote.text || d.quote)) || ''].join('|')
    }, [API, q])
    const 甲 = await 问('我该结婚吗')
    const 甲又 = await 问('我该结婚吗')

    /* 【两个问题不够判】（2026-09-03 五路评审收尾时红了一次）。
       这一条原先是「甲 !== 乙」两个问题比一次 —— 而没有本命的用户
       白天那一支的门只有七个候选（ai_compose.rs 的 `pool`），
       两件事撞上同一门就是【七分之一】的事，而门一样时那一门下的
       金句往往也只有两三条。也就是说它每跑二十来次就会红一次，
       而红的那一次跟「问题没进种子」长得一模一样。

       **偶发的红比常红更糟**：它让每一次真红都能被当成噪音
       （docs/FINDING-2026-08-22 那条记的就是这件事）。

       改成五个问题看有几种结果。问题真进了种子，五个至少出两种
       —— 全撞在一起是 7^-4，两千四百分之一；
       问题【没】进种子的话，五个必然全同，一次就红。 */
    const 几种 = new Set([甲])
    for (const q of ['明天会下雨吗', '换个工作好不好', '要不要搬家', '这笔钱该投吗']) {
      几种.add(await 问(q))
    }
    ok(几种.size >= 2, '几件不同的事，给的不是同一签　—— 问题要进种子',
       `五个问题只得到 ${几种.size} 种结果：${[...几种].map((x) => x.slice(0, 24)).join(' / ')}`)
    ok(甲 === 甲又, '同一件事再问，还是同一句　—— 不能反复摇到满意为止',
       `${甲.slice(0, 30)} / ${甲又.slice(0, 30)}`)
  }

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
     「起卦那颗按钮写『转一下』—— 它就是转一下」）。它原先待在弹性槽里，
     而槽在矮屏上收起 —— 也就是说它在我们对着的那台参照机上根本不存在。
     这里改成钉住【它确实不在了】：哪天有人又把一个输入框摆回主屏，
     这一条会红，那正是该看一眼的时候。 */
  await p.waitForTimeout(400)
  ok(await p.locator('.ask-q-input').count() === 0,
     '主屏上没有输入框 —— 转一下就是转一下',
     String(await p.locator('.ask-q-input').count()))

  /* 再转一签 —— 让「近几次」真有两条。
     转完之后**跳去「今天」那一页**（起卦在我家、看卦在那一页），
     所以这里等的是路由变了，不是这一页的 mode 变成 result。 */
  await open('pages/home/index')
  await p.waitForTimeout(500)
  await p.getByText('问一件事', { exact: true }).click()
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
     那条路也该验：落回 idle、弹「没转成」,而不是卡在转圈上转到天荒地老。 */
  await p.waitForFunction(() => globalThis.__router.current().data.mode !== 'spinning', null,
                          { timeout: 8000 })
  ok(await p.evaluate(() => globalThis.__router.current().data.mode) === 'idle',
     '后端不给卦时落回原样，不卡在转圈上')
  ok(await p.evaluate(() => document.getElementById('wx-toast').textContent).then((t) => t.includes('没转成')),
     '并且说了一声「没转成」', await p.evaluate(() => document.getElementById('wx-toast').textContent))
}

// ⑪ 版式对不对 ─────────────────────────────────────────────────
/* 这三条钉的是【外观】,而外观出问题时，行为检查一条都不会红 ——
   镜像照样「动线全通」,只是每一页都长得不对。
   两处都真踩过：app.wxss 从来没被读过(于是全页贴边渲);
   `page` 是小程序的根元素、浏览器里没这个标签(于是整套颜色变量落空，
   而落空的 var() 不报错，页面只是「素了点」)。 */
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
  /* 【要取【主】按钮，不是屏上第一颗按钮】。
     2026-09-01 这一屏的主次调过来了：主动作是盘中心那颗（每天要做的事），
     「填出生时间」降成了 ghost —— 而 `button.btn` 选到的正是后者，
     于是这条断言开始报「主按钮不是琥珀」，而它其实是对的。
     `:not(.ghost)` 选不到（这一屏没有实心 .btn）就退回盘中心那颗，
     它才是这一屏的主按钮。 */
  const btn = document.querySelector('button.btn:not(.ghost)')
             || document.querySelector('button.compass-btn')
  const cs = pg && getComputedStyle(pg)
  return {
    左留白: cs ? parseFloat(cs.paddingLeft) : 0,
    墨色: getComputedStyle(document.body).getPropertyValue('--ink').trim(),
    // 盘中心那颗的琥珀在渐变里（backgroundImage），实心按钮在 backgroundColor 上
    按钮底: btn
      ? (getComputedStyle(btn).backgroundColor + ' ' + getComputedStyle(btn).backgroundImage)
      : '没有按钮',
  }
})
ok(look.左留白 > 10, 'app.wxss 生效了　—— .page 的左右留白来自它', look.左留白 + 'px')
/* 0830 版换了整套色板 —— 这两条钉的是【当前设计色】，改设计就要改这里。
   它们钉的东西没变：样式真的生效了。落空的 `var()` 不报错，
   页面只是「素了点」，而那种失效长得跟设计一模一样。 */
ok(look.墨色 === '#2B2620', '`page` 上的颜色变量映到了根元素', look.墨色 || '落空了')
// 只问「透不透明」的话，浏览器默认那个灰底 #efefef 照样算过 ——
// 而那正是 app.wxss 没生效时的样子(变异测出来的)
ok(/rgb\(255,\s*154,\s*60\)/.test(look.按钮底), '主按钮是 0830 的琥珀', look.按钮底.slice(0, 70))

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
  const 全部数 = await p.evaluate(() => {
    const d = globalThis.__router.current().data
    return d.能请.length + d.没来.length
  })
  const 全部文 = await text()
  /* 「一位也请不来」是旧文案 —— 页面上写的是「一位也没数到」。
     这一条是 `||`，有数据时永远短路，于是那半边错了三个月没人知道。 */
  ok(全部数 > 0 || 全部文.includes('一位也没数到'),
     `「谁能来」两种数据形状都说得对（${全部数 > 0 ? 全部数 + ' 位' : '空状态'}）`,
     String(全部数))

  /* 分类切换那一段删了：铺没了，「谁能来」只列御守，没有分类栏
     （docs/REDESIGN.md R3）。原来那段读 data.cats / data.total / data.shown，
     新页一个都没有 —— 留着会 TypeError，而不是报一句「这一条不适用」。 */
  /* 册上现在是【人】不是【货】（设计册 10.8：四十位都列出来）。
     所以这里记的是「他的那件御守是哪一件」，点进去比 id ——
     比名字的话，比的是村民名与商品名，那两个本来就不该相等。 */
  /* 找第一个【在卖的】,还要知道它排第几 —— 按用神排之后头一位不一定在卖
     （缺金的人头三位都还没上架）,而点一个「未上架」的行本来就该按不动。
     原先这里点的是 `.item` 的第一个，那是在假设「第一位一定在卖」。 */
  /* 「只看在卖的」那条弹性槽 0830 撤了 —— 它是为「四十位平级混排八页」
     打的补丁，而那个结构已经换成「能请的在前、没来的折叠」。
     它当初要验的「不是把没上架的永远藏起来」,现在由上面折叠那段验。 */

  /* 【还要「没住进来」】（2026-09-03）。上一版只挑 `onSale` 的第一位 ——
     而已经住进来的那一位点下去去的是【他本人那一屏】，不是商品页
     （invite/index.ts 的 onTap 第一支，那是对的:他已经在你村里了）。
     于是断言拿到 `pages/villager/index`，报「点一件进不去详情」，
     读起来像页面坏了，实际是这一条挑错了行。

     这一支只在【没有排盘服务】那一档露面 —— 有本命时按用神排，
     住进来的那位排不到头里。而那一档在这台机器上从来自动接着，
     所以它一直没被跑到（同一天把三档基准拆开时才露出来）。 */
  const 头一件 = await p.evaluate(() => {
    const c = globalThis.__router.current()
    const i = (c.data.能请 || []).findIndex((x) => x.onSale && !x.住着)
    const v = i >= 0 ? c.data.能请[i] : null
    return v ? { name: v.name, product: v.product, 第几: i } : null
  })
  if (!头一件) {
    console.log('  · 跳过点进详情：一位都请不来（不计入通过）')
  } else {
    await p.locator('.item').nth(头一件.第几).click()
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
    /* 横着出界的，一处都不许有 —— 见上面 `横着出界的` 那段。
       这一条在 390 宽上量（`量一屏` 收尾时把视口设回 390）,
       比 375 宽松一点;375 那一档由逐屏走的几何数据兜着。 */
    const 出界 = await 横着出界的(名)
    ok(出界.length === 0,
       `${名} 横着没出界${横向允许[名] ? '（除了记着的那一处）' : ''}`,
       出界.join(' · '))
    /* 【每一屏的字都要读得出来】。判据 3.2:1 跟 `check-contrast.py` 同一条。
       这一支量的是【真实渲染】:底写在祖先上、写在渐变里、写在按钮上的，
       它一律问得到浏览器。2026-09-02 接线当天它抓到三处，
       其中两处是读 CSS 那一支的免检口子放走的：
       罗盘中心那颗按钮（1.76:1，「今天」屏唯一的控件）、
       以及 tabBar 选中态那个色（2.86:1，真机上告诉你「你在哪儿」的那行字）。 */
    if (m.色) {
      const 坏 = m.色.错
      ok(坏.length === 0, `${名} 上的字都读得出来（浏览器实测 ${m.色.量过} 处）`,
         坏.length
           ? 坏.map((e) => `${e.比}:1 「${e.文}」 .${e.类} 压在 ${e.底}`).join('\n         ')
           : (m.色.说不准 ? `另有 ${m.色.说不准} 处底够不着（背景图/canvas），没量` : '一处都不欠'))
      if (m.色.说不准 > 0) {
        console.log(`    · ${名} 有 ${m.色.说不准} 处底够不着没量：`
          + m.色.说不准样本.map((x) => `「${x.文}」(${x.因})`).join(' '))
      }
    }
    /* 【多页的那一屏，每一页都要量】。说明书有六页，而这里只开了第一页
       （说在前面）—— 它放得下，最后一页（三宫）却超出去 80px，
       翻页那一整行落在折线之外：读到最后的人屏上没有出口。
       全 app 只有它要滚，而且滚得静默，靠人翻截图才发现
       （2026-09-01 五路评审）。一页放得下不等于六页都放得下。 */
    if (r === 'pages/report/index') {
      const 页数 = await p.evaluate(() => (globalThis.__router.current().data.tabs || []).length)
      for (let i = 1; i < 页数; i++) {
        await p.evaluate((k) => globalThis.__router.current().show(k), i)
        await p.waitForTimeout(350)
        const 这一页 = await p.evaluate(() => {
          const d = document.documentElement, b = document.body
          return Math.max(d.scrollHeight, b.scrollHeight) - window.innerHeight
        })
        const 页名 = await p.evaluate(() => (globalThis.__router.current().data.page || {}).title || '?')
        if (这一页 > 8) 量到[名] = Math.max(量到[名], 这一页)
        /* 【收了钱的那一册也要有免责】（2026-09-02 第三轮评审 · 文案）。
           免费的三屏都挂着「仅供研究与娱乐 · 不构成人生建议」，而这一册
           —— 全 app 唯一真下判断的地方（「身强是持家有方，身弱容易被
           事情推着走」）—— 一个字都没有。逐页验：它该整册都在。 */
        ok((await text()).includes('仅供研究与娱乐'),
           `说明书第 ${i + 1} 页也挂着免责 —— 这是全 app 唯一真下判断的地方`,
           (await text()).slice(-40))
        ok(这一页 <= 8, `说明书第 ${i + 1} 页「${页名}」也放得下`,
           这一页 > 8 ? `超 ${这一页}px —— 翻页那一行会掉到折线外` : '放得下')
      }
    }
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
      凭据: '填出生时间',
      为什么: '罗盘灰着、压一句「填出生时间」加一个出口 —— 冷启动第一眼就是它' },
    { 页: 'pages/natal/index', 名: '填生辰',
      切: () => globalThis.__router.current().setData({ mode: 'form', err: '' }),
      凭据: '会得到这些',
      为什么: '第一次来的人看到的是表单，不是盘面' },
    { 页: 'pages/order/index', 名: '待付',
      切: () => globalThis.__router.current().setData({ status: 'unpaid', 住下了: false, err: '' }),
      凭据: '去付',
      为什么: '待付给的是「去付」加一行「不要这一单了」，跟已付那组按钮不一样' },
    { 页: 'pages/order/index', 名: '住下了',
      切: () => globalThis.__router.current().setData({
        status: 'paid', 住下了: true, err: '',
        who: { name: '丹增', face: '增', direction: 'ne', id: 'tenz', 脸样: '' },
      }),
      凭据: '屋里看看',
      为什么: '付完之后那颗主按钮加一槽话，是这一屏最高的一种形态' },
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
        /* 【造出来的那一态得是真实存在的一种】（2026-09-06）。
           上一版只切 status 与 shipments —— 而这一趟拿到的那一单是
           【说明书】那一单（`report` 非空）。于是量到的是
           「一张报告单挂着十二条物流轨迹」:报告是算出来的，从不发货,
           这个组合真实链路造不出来。它凭空多出一颗「读你的说明书」的
           主按钮（`.cta-read`，49px）和一整块用不上的高度。
           这个仓在这一屏上栽过同一件事:上一版直插一条 `delivered` 的运单
           造出「包裹到了、人还没住进来」，而买御守从来不寄东西 ——
           那段注释就写在这个文件里，「拿一个不存在的状态验出来的绿，是假的绿」。

           十二条轨迹属于【实物那一单】。所以一并把它切成实物的样子:
           没有册子、能申请退款（实物签收前可以退，协议这么写的）。 */
        c.setData({ traceOf: 'shp-x', trace: 条.slice(0, 8), traceMore: 条.length - 8,
                    shipments: [{ id: 'shp-x', statusText: '在路上', tracking_no: 'X1' }],
                    status: 'paid', statusText: '已付', paidText: c.data.totalText, err: '',
                    report: null, 能退: true, 退不了: '' })
      },
      凭据: '更早还有 4 条',
      为什么: '10.3：一屏八条，超了折叠 —— 全渲的话这一屏会被轨迹顶出去' },
    { 页: 'pages/me/index', 名: '一笔都没买过',
      切: () => globalThis.__router.current().setData({
        recent: null, recentEmpty: true, recentNote: '', orderText: '还没有', nextStop: '' }),
      /* 0830：空的时候不再摆一个粗虚线框写「还没买过什么」——
         上面菜单里已经写着「我买过的 · 还没有」，同一件事一屏说三遍，
         而且最重的位置给了「什么都没有」。现在只留这一行指出哪儿能有。 */
      凭据: '村里每位都带着自己的东西',
      为什么: '空状态是这一屏的一半 —— 它要指出「哪儿能有」（设计册 10.7）' },
    { 页: 'pages/orders/index', 名: '一单都没有',
      切: () => globalThis.__router.current().setData({
        loading: false, err: '', total: 0, items: [], page: [], pageCount: 0 }),
      // 0830:这一屏的空状态从「还没买过什么」（一句陈述）改成了「钱包还是满的呢」
      凭据: '钱包还是满的',
      为什么: 'M2 的空状态：不说「没有订单」，指出东西在谁那儿、去村里看看' },
    { 页: 'pages/subs/index', 名: '一个都没订',
      切: () => globalThis.__router.current().setData({ loading: false, err: '', items: [] }),
      凭据: '还没有订着的',
      为什么: '10.7 说得最直白：M5 的空状态【就是这一屏的主设计】' },
    { 页: 'pages/incense/index', 名: '还没建本命',
      切: () => globalThis.__router.current().setData({ line: '' }),
      凭据: '先把出生时间填了',
      为什么: '她不知道你缺什么时说的那一句，比配错一味重要' },
    { 页: 'pages/villager/index', 名: '还没请回来',
      切: () => {
        const c = globalThis.__router.current()
        c.setData({ who: Object.assign({}, c.data.who, { at_home: false }),
                    sells: false, canEnter: false, err: '' })
      },
      凭据: '回村',
      为什么: '没请回来时只有「请X回村」，住着时是问问 / 去屋里 / 卖的东西' },
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
       中间这一屏要问三件事：几件、寄到哪、要不要留句话。

       按钮上写什么由卖的东西决定（`买法`：御守「请回家」、报告「就要这份」、
       其余「就要这个」），所以【问页面它写的是什么】再点，不写死一个。
       原先写死「请回家」，而这一趟挑中的是一支 ¥20 的香 ——
       点不着的选择器不当场红，它先挂满三十秒再抛，把后面全带走。 */
    const 买法 = await p.evaluate(() => globalThis.__router.current().data.买法)
    if (!ok(!!买法, '商品页的主按钮有话说', String(买法))) {
      console.log('    ← 读不到按钮文案就没法往下点，这一段跳过')
    } else {
    await p.getByText(买法, { exact: true }).click()
    await p.waitForFunction(
      () => globalThis.__router.current().__route === 'pages/confirm/index',
      null, { timeout: 15000 },
    ).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/confirm/index',
       `「${买法}」先到确认那一屏`, await p.evaluate(() => globalThis.__router.current().__route))

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

    /* 【地址只在真要寄的那一件上问】（2026-09-01 第二轮评审 · 转化路）。
       这一趟挑中的是香还是御守由目录决定，所以问页面它自己是哪一种，
       不写死一支 —— 写死的那一支会在挑中另一种时挂满三十秒再抛。
       两种都验：寄的那种要问地址（且在网页上如实说做不到），
       不寄的那种连「寄到」两个字都不该有。 */
    const 要寄 = await p.evaluate(() => globalThis.__router.current().data.要寄)
    if (要寄) {
      await p.getByText('还没填', { exact: false }).click()
      await p.waitForTimeout(500)
      const 地址话 = await p.evaluate(() => globalThis.__router.current().data.addrNote)
      ok(!!地址话 && !await p.evaluate(() => !!globalThis.__router.current().data.contact),
         '选地址在网页上如实说做不到，不假装填好', String(地址话))
    } else {
      const 这屏 = await text()
      ok(!这屏.includes('寄到'), '不寄的那一件不问地址　—— 御守付完人就搬进来，没有包裹',
         (这屏.match(/寄到[^\n]{0,10}/) || ['（没问）'])[0])
    }

    /* 另一半单独验：【御守那一屏】不问地址、按钮直接是「去付」。
       上面那一支只走到目录当天挑中的那一种，而这条是转化路上最贵的一处，
       不能靠「刚好挑中了」来覆盖。 */
    {
      const 御守商品 = sql1(
        "SELECT p.id FROM product p WHERE p.fulfillment_kind='residency'"
        + " AND p.status='listed' LIMIT 1")
      if (御守商品) {
        await open('pages/confirm/index', { id: 御守商品 })
        await p.waitForFunction(
          () => globalThis.__router.current().data.loading === false,
          null, { timeout: 15000 },
        ).catch(() => {})
        const 御守屏 = await text()
        ok(await p.evaluate(() => globalThis.__router.current().data.要寄) === false,
           '御守那一屏知道自己不用寄',
           String(await p.evaluate(() => globalThis.__router.current().data.要寄)))
        ok(!御守屏.includes('寄到') && !御守屏.includes('先填寄到哪儿'),
           '御守那一屏不问地址、按钮不是「先填寄到哪儿」',
           (御守屏.match(/寄到[^\n]{0,10}/) || ['（没问）'])[0])
        ok(御守屏.includes('去付'), '御守那一屏的主按钮直接就是「去付」')
        ok(/搬进|住下/.test(御守屏), '底下那句说的是付完会发生什么',
           (御守屏.match(/付完[^\n]{0,20}/) || ['（没说）'])[0])
        await open('pages/confirm/index', 要参数['pages/confirm/index'])
        await p.waitForFunction(
          () => globalThis.__router.current().data.loading === false,
          null, { timeout: 15000 },
        ).catch(() => {})
      } else {
        ok(false, '库里找不到一件 residency 的在售商品 —— 这一段验不成')
      }
    }

    /* 确认那一屏的「回去」只长在**出错**那一支上 ——
       正常态没有它（真机上有原生返回箭头，所以不是死路）。
       所以要验它就得把这一屏打进出错态：拿一个不存在的商品进去。
       在正常态上找这颗按钮找不到，而那不是 bug,是我找错了地方。 */
    {
      await open('pages/confirm/index', { id: 'p_不存在的商品' })
      await p.waitForFunction(
        () => globalThis.__router.current().data.loading === false,
        null, { timeout: 15000 },
      ).catch(() => {})
      const 说了啥 = await p.evaluate(() => globalThis.__router.current().data.err || '')
      ok(!!说了啥, '确认那一屏取不到商品时说得出话　—— 不是空着一屏', String(说了啥).slice(0, 40))
      /* 【技术原文不许上屏】（2026-09-02）。
         `utils/say.ts` 原先的判据是「有汉字就是写给人看的，原样显示」——
         而用户自己输的字被回显进错误串时它当场失效：
         上面这一屏开的是 `p_不存在的商品`，后端回的是
         `{"error":"not found: product","code":"not_found"}`;
         把 id 换成中文的（真实用户输的名字、地址、问的那句话全是中文），
         回的就是 `not found: sku 没这个` —— 整句推到屏上。
         判据换成后端明确给的 `code`。这条断言钉住结果：
         屏上那一句里不许出现英文技术词。 */
      ok(!/not found|unauthorized|forbidden|validation|conflict|internal|[a-z_]{4,}:/i
           .test(String(说了啥)),
         '出错那一句是人话，不是后端原文', String(说了啥))
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

    /* 没填【寄到哪】的时候「去付」是按不出单的 —— 这是实物，
       没有地址寄不出去，而订单那一屏也没有补填的地方。先验这一条。
       【只对真要寄的那一件成立】:御守 / 说明书没有包裹，它们的按钮
       从一开始就该是「去付」（2026-09-01 第二轮评审 · 转化路）。 */
    if (!要寄) {
      const 钮文 = await p.evaluate(() => {
        const b = [...document.querySelectorAll('button.btn')]
          .find((x) => /去付|寄到哪/.test(x.innerText))
        return b ? b.innerText.trim() : '（没找到那颗按钮）'
      })
      ok(钮文 === '去付', '不寄的那一件，按钮一上来就是「去付」　—— 不横一道地址', 钮文)
    } else {
      const 有 = await p.evaluate(() => globalThis.__router.current().data.有地址)
      if (!有) {
        /* 【2026-09-01 这颗按钮改成直接做那件该做的事】。
           原先没地址时它写「去付」、是灰的（btn-wait），按下去在下面
           冒一句「还差寄到哪」—— 而整屏唯一的成交按钮长得跟禁用一样、
           只有 87px 宽，人会按几次然后退出去。
           现在它写着「先填寄到哪儿」，按下去直接弹地址簿。 */
        const 钮文 = await p.evaluate(() => {
          const b = [...document.querySelectorAll('button.btn')]
            .find((x) => /去付|寄到哪/.test(x.innerText))
          return b ? b.innerText.trim() : '（没找到那颗按钮）'
        })
        ok(钮文 === '先填寄到哪儿',
           '没填【寄到哪】时，成交那颗按钮自己说出下一步　—— 不是灰着让人猜', 钮文)
        ok(await p.evaluate(() => {
             const b = [...document.querySelectorAll('button.btn')]
               .find((x) => /寄到哪/.test(x.innerText))
             return !!b && !b.disabled
           }), '而且它是能按的　—— 按下去弹地址簿，不是按了没反应')
      } else {
        ok(false, '验得到「没填寄到哪」那一支', '进来时地址已经有了')
      }
    }

    /* 地址簿只有真机有（`wx.chooseAddress`，垫片会抛）。
       所以这里【显式桩掉那一跳】—— 跟扫御守那一步同一个做法：
       夹具写在明处，验的仍是这一屏自己的逻辑（拿到地址之后按钮亮起、
       建单带着 contact 走）。
       不寄的那一件没有这一行，整段跳过。 */
    if (要寄) {
      await p.evaluate(() => {
        globalThis.__wxStub('chooseAddress', () => Promise.resolve({
          userName: '镜像', telNumber: '13000000000',
          provinceName: '浙江省', cityName: '杭州市', countyName: '西湖区',
          detailInfo: '某条路 1 号',
        }))
      })
      await p.getByText('还没填', { exact: false }).first().click()
      await p.waitForFunction(() => globalThis.__router.current().data.有地址 === true,
                              null, { timeout: 8000 }).catch(() => {})
      ok(await p.evaluate(() => globalThis.__router.current().data.有地址) === true,
         '选完地址，这一屏记下了它')
      ok(await p.evaluate(() => !document.querySelector('button.btn-wait')),
         '有了地址，「去付」才亮起来')
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

      /* 【这一单有三十分钟的时限，屏上要说】（2026-09-02）。
         建单时后端写 `expires_at = NOW() + 30 分钟`，到点 payment_sweep
         把它取消掉。屏上原先一个字都没说 —— 而「不要这一单了」那条
         文字链就在旁边，过期之后状态变「已取消」，买家最容易的理解是
         「我手滑点了它」。 */
      const 时限 = await p.evaluate(() => globalThis.__router.current().data.还有多久)
      ok(/分钟/.test(String(时限)), '待付的单子说得出还有多久会自己取消', String(时限))

      /* 另一半：【超时取消要说清是超时】。都写「已取消」的话，
         买家会以为是自己点的。判据是后端给的 `cancel_reason`。
         这一态造不出来（要等三十分钟），所以直接改库 —— 夹具写在明处。 */
      {
        const 单号 = await p.evaluate(() => globalThis.__router.current().data.id)
        run(`UPDATE order_record SET status='cancelled', cancel_reason='expired',`
          + ` cancel_actor='system', cancelled_at=NOW() WHERE id='${单号}'`)
        await p.evaluate(() => globalThis.__router.current().load())
        await p.waitForFunction(() => globalThis.__router.current().data.status === 'cancelled',
                                null, { timeout: 15000 }).catch(() => {})
        const 说的 = await p.evaluate(() => globalThis.__router.current().data.下一步)
        ok(/超过三十分钟没付/.test(String(说的)),
           '超时取消的单子说得出是超时，不是「你取消了」', String(说的))
        ok(!/你取消|已取消这一单/.test(String(说的)),
           '而且不把它说成买家自己做的', String(说的))
        run(`UPDATE order_record SET status='unpaid', cancel_reason=NULL,`
          + ` cancel_actor=NULL, cancelled_at=NULL WHERE id='${单号}'`)
        await p.evaluate(() => globalThis.__router.current().load())
        await p.waitForTimeout(600)
      }

      /* 「去支付」：打后端拿 prepay 参数（真跑），然后 requestPayment 抛。
         **抛到哪儿去看**：`deviceOnly` 是故意不走整屏红的 —— 「这一步只有真机有」
         跟「镜像坏了」不是一回事，它落在底部那条提示上，并记进 `__DEVICE_ONLY`。
         这条断言原先查的是整屏红那一块，查错了地方：真抛了也看不见，
         而真的没抛（比如哪天被人 catch 掉、悄悄当成功）同样看不见 —— 两头都盲。 */
      await p.getByText('去付', { exact: true }).click()
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

      /* 「不要这一单了」—— 待付的单子要退得掉，不然它就是个只能进不能出的东西。
         【2026-09-01 加了二次确认】。取消是不可逆的，而它原先跟旁边的
         「回去」同色同宽同高，并排摆着，一次误触没掉一张单
         （同一个仓库里「退出」是有确认的，只有这一处漏了）。
         所以先验【说「再想想」时它不取消】—— 那才是二次确认的全部意义；
         再验点确认之后真取消得掉。
         镜像里 wx.showModal 走的是浏览器 confirm（web/runtime/wx.js），
         playwright 默认自动关掉它，所以两次都要显式接管。 */
      errs.length = 0
      await open('pages/order/index', { id: await p.evaluate(() => globalThis.__router.current().data.id) })

      const 关掉 = (d) => d.dismiss()
      p.on('dialog', 关掉)
      await p.getByText('不要这一单了', { exact: true }).click()
      await p.waitForTimeout(900)
      ok(await p.evaluate(() => globalThis.__router.current().data.statusText) !== '已取消',
         '在确认框上说「再想想」，单子还在　—— 取消是不可逆的，不该一按就没',
         await p.evaluate(() => globalThis.__router.current().data.statusText))
      p.off('dialog', 关掉)

      const 点头 = (d) => d.accept()
      p.on('dialog', 点头)
      await p.getByText('不要这一单了', { exact: true }).click()
      await p.waitForTimeout(1200)
      ok(await p.evaluate(() => globalThis.__router.current().data.statusText) === '已取消',
         '确认之后真的把单子取消了',
         await p.evaluate(() => globalThis.__router.current().data.statusText))
      p.off('dialog', 点头)

      await p.getByText('回去', { exact: true }).click()
      await p.waitForTimeout(600)
    }
    }
  }

  /* 命：建得了、换不了、删不掉 —— `natal.remove` 封装了很久没有页面用。
     先建第二份，档案那一段才会出现（只有一份时不显示，一份没什么好换的）。 */
  await open('pages/natal/index')
  const 原有 = await p.evaluate(() => globalThis.__router.current().data.archive.length)
  if (原有 < 1) {
    console.log('  · 跳过档案那一段：这个用户还没有本命（不计入通过）')
  } else {
    /* 再建一份：按「再填一份」→ 三样都填 → 算一算。
       **三样是必须真填的** —— 表单原先预填 1995-06-15 / 14:30 / 男，
       谁不改就直接按下去，算出来的是别人的命而且一路不报错（0830 修掉）。
       这一段原先正是靠那份预填过的：它按完「再填一份」直接点「算一算」，
       也就是说它验的是「不填也能建」，而那正是要修掉的行为。 */
    await p.getByText('再填一份', { exact: true }).click()
    await p.waitForTimeout(400)
    await p.locator('input[type=date]').first().fill('1990-07-12')
    await p.locator('input[type=time]').first().fill('09:15')
    await p.getByText('女', { exact: true }).first().click()
    await p.waitForTimeout(200)
    /* 【三样填齐了，按钮才写「算一算」】。2026-09-01 起没填齐时它写的是
       「还差哪一天出生」这类 —— 所以这里【先断言它已经变成「算一算」】:
       如果 fill() 没让页面记下「填过了」，从前这一步是静默点不到、
       整段动线在这儿卡死；现在它会红在一条说得清的断言上。 */
    const 建钮 = await p.evaluate(() => {
      const b = [...document.querySelectorAll('button.btn')]
        .find((x) => /还差|算一算/.test(x.innerText))
      return b ? b.innerText.trim() : '（没找到那颗按钮）'
    })
    ok(建钮 === '算一算', '三样真填过之后，那颗按钮才写「算一算」', 建钮)
    await p.getByText(建钮, { exact: true }).click()
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

    /* 三样没填全就不许建。原先表单预填了日期、时刻与性别 ——
       谁不改就直接按「算一算」，算出来的是别人的命，一路不报错。
       这一条验的是【不填不给建】，而且报错要说清差哪几样。 */
    await open('pages/natal/index')
    await p.getByText('再填一份', { exact: true }).click()
    await p.waitForTimeout(300)
    const 建之前 = await p.evaluate(() => globalThis.__router.current().data.archive.length)
    /* 一个字都没填时按钮上写的是「还差哪一天出生」—— 那本身就是这一条
       要验的一半：不填不给建，而且【在按之前】就说得出差什么。
       按下去仍然指出栏位，档案也不该变长。 */
    const 空钮 = await p.evaluate(() => {
      const b = [...document.querySelectorAll('button.btn')]
        .find((x) => /还差|算一算/.test(x.innerText))
      return b ? b.innerText.trim() : '（没找到那颗按钮）'
    })
    ok(/^还差/.test(空钮), '一个字没填时，按钮就写着还差什么', 空钮)
    await p.getByText(空钮, { exact: true }).click()
    await p.waitForTimeout(800)
    /* 读的是 `缺提示` 不是 `err`：校验错误搬了家 ——
       `err` 会把表单整块顶掉（`wx:elif="{{!err}}"`），而「你回去填」
       这件事必须留着表单。 */
    const 拦住 = await p.evaluate(() => {
      const d = globalThis.__router.current().data
      return { err: d.缺提示 || '', mode: d.mode, n: d.archive.length,
               表单还在: (document.querySelector('#app') || {}).innerText.includes('你是哪天出生的') }
    })
    ok(拦住.mode === 'form' && /还差/.test(拦住.err) && 拦住.n === 建之前 && 拦住.表单还在,
       '一样都没填就按「算一算」，它拦住并说清差哪几样　—— 不许替人答',
       `mode=${拦住.mode} err=「${拦住.err.slice(0, 30)}」 档案 ${建之前} → ${拦住.n}`)
    /* 上面那一条把页面留在【表单】上（它验的就是「拦住了」）。
       后面几条要在档案列表上点「换成它」，那只在 summary 模式下才有 ——
       所以这里退回去。不退的话下一条会挂在「找不到换成它」上，
       而那句失败信息指的是一个不存在的毛病。 */
    await open('pages/natal/index')
    await 等取完('pages/natal/index')
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

  /* 改完名字那一屏的「回去」。改了名之后最自然的下一下就是它，
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
  /* 还没拿到的那几枚要【点得动】—— 通到能拿到它的地方。
     原先六枚全灰、一个都点不动，这一屏唯一能做的事是「回去」
     （标尺 §1.5.4 第二问「我能干什么」答不上）。 */
  {
    const 没拿到 = await p.evaluate(() =>
      (globalThis.__router.current().data.items || []).filter((x) => !x.earned).length)
    if (没拿到 > 0) {
      const 有去处 = await p.evaluate(() =>
        (globalThis.__router.current().data.items || []).filter((x) => !x.earned && x.去).length)
      /* 【至少有一条路走得动】，不要求每一枚都写。
         六枚里有四枚指的是同一件事（问一件事），四张卡都写同一句的话，
         屏上就是四行一样的橙字，看不出先做哪个 —— 那不是「说得出去哪儿拿」，
         是把一句话说了四遍。后面那几枚留着各自的解锁条件当目录，本来就够。
         这条要守的是原来那件事：这一屏不能是点不动的清单。 */
      ok(有去处 >= 1 && 有去处 <= 没拿到,
         '还没拿到的里头有走得动的路　—— 不是一张点不动的清单',
         `${有去处}/${没拿到} 枚给了去处`)
      const 之前 = await p.evaluate(() => globalThis.__router.current().__route)
      /* 点【没拿到的】那一枚。拿到过的是纪念不是待办，本来就不跳 ——
         头一版点 `.badge` 的第一个，而这个库里第一枚恰好已经拿到了，
         于是断言报「走不到那儿」，看着像功能坏了。 */
      const 第几 = await p.evaluate(() =>
        (globalThis.__router.current().data.items || []).findIndex((x) => !x.earned && x.去))
      await p.locator('.badge').nth(第几).click()
      await p.waitForTimeout(1200)
      const 之后 = await p.evaluate(() => globalThis.__router.current().__route)
      ok(之后 !== 之前, '点一枚没拿到的，真的走得到那儿', `${之前} → ${之后}`)
      await open('pages/badges/index')
      await p.waitForTimeout(900)
      /* 【差多少也要说】（2026-09-06 五路评审 · §七）。原先只有「拿到了 /
         没拿到」两态 ——「连着三十天」这一枚，第 29 天看到的跟第 1 天一样。 */
      const 有进度 = await p.evaluate(() =>
        (globalThis.__router.current().data.items || []).filter((x) => x.进度).length)
      ok(有进度 >= 1, '还没拿到的那几枚，屏上写得出还差多少',
         `${有进度} 枚写着进度`)
      /* 【那条路指的是最容易的那一枚】。六枚里四枚指同一件事，页面
         「同一条路只留最近的那一枚」，取的是后端返回的顺序 ——
         而在 20260906002 之前六枚 points 全是 10，也就是没有定序，
         实测那条「去问一件事 ›」指给了「一个月 · 连着三十天」，
         而一次都没问过的人，一步之遥的「头一回」什么出口都没有。 */
      const 指给谁 = await p.evaluate(() => {
        const xs = (globalThis.__router.current().data.items || []).filter((x) => !x.earned && x.去)
        return xs.length ? xs[0].points : null
      })
      const 最容易 = await p.evaluate(() => {
        const xs = (globalThis.__router.current().data.items || []).filter((x) => !x.earned)
        return xs.length ? Math.min(...xs.map((x) => x.points)) : null
      })
      ok(指给谁 !== null && 指给谁 === 最容易,
         '那条「去哪儿拿」指的是还没拿到里最容易的那一枚',
         `指的是 ${指给谁} 分那枚 · 最容易的是 ${最容易} 分`)
    } else {
      ok(false, '验得到「还没拿到」那一支', '这个库里六枚全拿到了')
    }
  }
  await p.getByText('回去', { exact: true }).click()
  await p.waitForTimeout(800)

  /* 「订」这一行【村里有可订的东西时才在】。
     2026-09-01 之前它的门闩是「你订过没有」—— 而「订着的」那一屏的
     空状态正是唯一在卖订阅的地方，两个条件互为反面，
     卖订阅那一半永远到不了（五路评审 · 工程审计）。
     现在看的是「有没有可订的」:一件都没上架时这一行整个不出现，
     那是「需要的东西在，不需要的东西不在」，不是缺口。 */
  await open('pages/me/index')
  const 订 = await p.evaluate(() => ({
    文: globalThis.__router.current().data.subText,
    在: globalThis.__router.current().data.hasSubs,
  }))
  ok(订.在 ? (订.文 === '还没有' || /个订着$/.test(订.文 || '')) : 订.文 === '',
     '「订着的」那一行：有可订的才摆，摆出来就说得清状况',
     `在=${订.在} 文=${JSON.stringify(订.文)}`)
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
  /* 折叠没有了：折叠是为了让【「我的」那一屏】放得下，这五行搬走之后
     那个理由就不成立了。它们唯一的用途是被人念给客服听 ——
     多一次「展开」等于给唯一的用途加一道手续。所以这里验的是
     **不点任何东西就看得见**。 */
  await p.waitForTimeout(700)
  const 明细 = await text()
  // 0830:标签里的疏排空格收掉了（「I D」「平 台」是 v1 的排版手法）
  ok(明细.includes('ID') && 明细.includes('平台'),
     '账号那几行不用点就在 —— 念给客服听的东西不该再藏一层', 明细.slice(0, 40))

  /* ── 客服与两份文件（2026-09-02 加）─────────────────────────
     这三样原先一处都没有：出了事没人可找，收了钱没有交代，
     而小程序过审这三样是硬门槛。 */
  ok(明细.includes('联系我们') && 明细.includes('隐私政策') && 明细.includes('用户协议'),
     '设置里找得到客服、隐私政策、用户协议', 明细.slice(-60))

  /* 【客服那颗按钮在网页版上必须抛】。它靠的是微信的 `open-type="contact"`，
     浏览器里没有对应物 —— 静默无反应就是「空实现」，而三条铁律的第二条
     写着：只有真机才有的能力，抛，不给空实现。
     上一版垫片不认 `open-type`，属性原样落到 DOM 上，浏览器当没有，
     于是那是一颗【长得完全正常、点了什么都不发生】的按钮。 */
  {
    const 之前 = await p.evaluate(() => (globalThis.__DEVICE_ONLY || []).length)
    await p.getByText('联系我们', { exact: true }).click().catch(() => {})
    await p.waitForTimeout(400)
    const 记下 = await p.evaluate(() => globalThis.__DEVICE_ONLY || [])
    const 提示 = await p.evaluate(() => {
      const n = document.getElementById('wx-note')
      return n && n.style.display === 'block' ? n.textContent : ''
    })
    ok(记下.length > 之前 || /真机/.test(提示),
       '「联系我们」在网页版上如实抛 —— 不是一颗点了没反应的按钮',
       `记下的 ${JSON.stringify(记下.slice(-2))} · 提示条「${提示.slice(0, 30)}」`)
  }

  /* 两份文件真的打得开、真的有内容、也走得出去。
     一个「点进去是空白页」的隐私政策比没有更糟 —— 它看着像有。 */
  for (const [叫, 参, 要有] of [['隐私政策', 'privacy', '我们收什么'],
                                 ['用户协议', 'terms', '退款']]) {
    await open('pages/settings/index')
    await p.waitForTimeout(500)
    await p.getByText(叫, { exact: true }).click()
    await p.waitForFunction(
      () => globalThis.__router.current().__route === 'pages/policy/index',
      null, { timeout: 15000 },
    ).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/policy/index',
       `设置里点得开「${叫}」`, await p.evaluate(() => globalThis.__router.current().__route))
    const 文 = await text()
    ok(文.includes(叫) && 文.includes(要有),
       `「${叫}」里真的有内容 —— 不是一页空白`, 文.slice(0, 40))
    ok(await p.evaluate(() => globalThis.__router.current().data.kind) === 参,
       `「${叫}」开的是它自己那一份，不是另一份`,
       String(await p.evaluate(() => globalThis.__router.current().data.kind)))
    await p.getByText('回去', { exact: true }).click()
    await p.waitForTimeout(600)
    ok(await p.evaluate(() => globalThis.__router.current().__route) !== 'pages/policy/index',
       `「${叫}」不是死路 —— 退得出去`,
       await p.evaluate(() => globalThis.__router.current().__route))
  }

  /* ── 收钱那一屏不许瞒着自动续费（2026-09-06）───────────────
     一味香按月送的 `fulfillment_kind` 是 `shipping`（迁移注释写着
     「这样确认屏问地址那一路一个字都不用改」），而确认屏**从不读 `kind`**
     （实测 grep 计数 0）—— 于是它把每月扣一次的东西画成了买一盒香：
     合计写「一共 ¥78」没有「/ 月」、底下是一次性买卖的话术、
     还摆着一个数量加减器（订阅填 2 是什么意思？屏上答不了）。

     一个怕被套牢的人在那一屏上找不到一个字告诉他这是自动续费。 */
  {
    await open('pages/confirm/index', { id: 'prod-incense-monthly' })
    await p.waitForTimeout(1600)
    const 订文 = await text()
    ok(await p.evaluate(() => globalThis.__router.current().data.订阅) === true,
       '确认屏认得出这是一件订阅', String(await p.evaluate(() => globalThis.__router.current().data.订阅)))
    ok(/一共\s*¥?\d+(\.\d+)?\s*\/\s*月/.test(订文),
       '合计带着「/ 月」—— 少了这两个字，那个数看起来就是这一单的全部代价',
       (订文.match(/一共[^·]{0,14}/) || [''])[0])
    ok(/每月扣一次/.test(订文), '底下说的是「每月扣一次」，不是一次性买卖那套话',
       (订文.match(/每月[^·]{0,30}/) || [''])[0])
    /* 【订阅不摆数量】。填 2 是每月两盒还是订两份 —— 这个问题屏上答不了，
       而后端 `renew_due` 每期就发一件。 */
    ok(await p.locator('.stepper').count() === 0,
       '订阅那一档不摆数量加减器', String(await p.locator('.stepper').count()))
    /* 【「随时能停」得说准】。`plan.cancel_policy` 是 `end_of_period` ——
       真实语义是「按得下不再续，但这一期照走完」。 */
    await open('pages/incense/index')
    await p.waitForTimeout(1400)
    const 香文 = await text()
    ok(!/随时能停(?!，)/.test(香文.replace('到期前随时能停，这一期照走完', '')),
       '卖它的那一屏不写光秃秃的「随时能停」', (香文.match(/[^·]{0,10}随时能停[^·]{0,10}/) || [''])[0])
    ok(/这一期照走完/.test(香文),
       '把退订那一屏那句准的话搬到了决定要不要订的这一屏',
       (香文.match(/每月扣一次[^·]{0,24}/) || [''])[0])
  }

  /* ── 一件东西有几档就摆几档（2026-09-06）───────────────────
     香有三档（试香三支 ¥29 / 一盒十支 ¥88 / 单配 ¥268）。商品页原先只挑
     「第一个有价的」、`onBuy` 跳确认屏又不带 sku，确认屏再挑一次 ——
     于是屏上永远是 ¥29，而正文写着「一支烧二三十分钟，十支约够一个月」。
     **¥29 买到的是三支**，而「试香 · 三支」这五个字整条掏钱的路上
     一次都没出现过（两屏显示的都是 `product.name`）。 */
  {
    const 档数 = Number(sql1(
      `SELECT count(*) FROM sku s JOIN price_book pb ON pb.sku_id=s.id`
      + ` AND pb.status='active' AND pb.region='cn'`
      + ` WHERE s.product_id='prod-suhe-incense'`))
    await open('pages/product/index', { id: 'prod-suhe-incense' })
    await p.waitForTimeout(1500)
    ok(await p.locator('.pick').count() === 档数,
       '几档就摆几档', `屏上 ${await p.locator('.pick').count()} 张 · 库里 ${档数} 档`)
    /* 【多档的时候屏顶那个大价钱撤了】（2026-09-06 当天改了两回）。
       上一版的判据是「标价旁边要说清这是哪一档」（`档名`），
       为的是不让一个光秃秃的 ¥29 被读成整件东西的价。
       同一天量出这一屏超出一屏 95px，回头看才发现:
       那一排牌本身就已经把三档三个价都摆出来了，选中的那张描着墨边、
       价是主色 —— 屏顶再摆一个「¥29 试香 · 三支」是同样两条信息隔着
       300px 出现第二次。所以撤的是重复的那一份，判据跟着换成:
       多档时【没有】那个大价钱，而选中的那张牌上名与价都在。 */
    ok(await p.locator('.price-row').count() === 0,
       '多档的时候屏顶不再摆一个大价钱 —— 那一排牌就是价钱',
       `.price-row ${await p.locator('.price-row').count()} 个`)
    const 选中 = (await p.locator('.pick-on').first().innerText()).replace(/\n/g, ' ')
    const 头一张 = await p.evaluate(() => (globalThis.__router.current().data.档 || [])[0])
    ok(头一张 && 选中.includes(头一张.name) && 选中.includes(头一张.priceText),
       '选中那一张牌上，名与价都在 —— 一个光秃秃的 ¥29 说不清买到的是什么',
       选中)
    /* 【挑了哪一档就带哪一档过去】。原先不带 sku —— 人挑的那一档
       在跳转的那一下丢了，确认屏自己又挑回「第一个有价的」。 */
    const 第二档 = await p.evaluate(() => (globalThis.__router.current().data.档 || [])[1])
    if (第二档) {
      await p.locator('.pick').nth(1).click()
      await p.waitForTimeout(500)
      ok(await p.evaluate(() => globalThis.__router.current().data.skuId) === 第二档.id,
         '挑第二档，标价跟着变', await p.evaluate(() => globalThis.__router.current().data.price))
      await p.getByText('就要这个', { exact: true }).click()
      await p.waitForTimeout(1600)
      ok(await p.evaluate(() => globalThis.__router.current().data.skuId) === 第二档.id,
         '跳到确认屏，挑的还是那一档 —— 不是又挑回第一个有价的',
         第二档.name)
      ok((await text()).includes(第二档.name),
         '明细写的是这一档的名字，不是商品名', 第二档.name)
    }
  }

  /* ── 要去一场活动的人（2026-09-06）─────────────────────────
     【这一屏此前一条断言都没有】。它在 `app.json` 里、在截屏名单里、
     一屏放得下那一支也量过它 —— 而这一趟从没打开过它，
     `activity·onSignUp` 一直挂在末尾那份「没碰过的」清单上。

     报名是【线下真会发生的事】：报上了就有人在某个城市某一天等你。
     它不是买东西，撤销也不退钱 —— 正因为不涉及钱，它更容易被漏掉，
     而漏掉的后果是有人白跑一趟。 */
  {
    await open('pages/activity/index')
    await p.waitForTimeout(1500)
    const 场次 = await p.evaluate(() => globalThis.__router.current().data.场次 || [])
    ok(场次.length > 0, '活动那一屏列得出场次', `${场次.length} 场`)
    if (场次.length > 0) {
      const 活文 = await text()
      /* 【库里那些字段的原文一个都不许上屏】——`open` / `full` / ISO 时间戳。
         这一屏此前没人验过，而它跟「订着的」是同一个形状:
         后端把人话 join 出来了，屏那一头读不读是另一回事。 */
      ok(!/\bopen\b|\bfull\b|\d{4}-\d{2}-\d{2}T/.test(活文),
         '场次说的是人话，不是库里那个字段',
         (活文.match(/\bopen\b|\bfull\b|\d{4}-\d{2}-\d{2}T\S*/) || [''])[0])
      ok(/还剩|满了|位/.test(活文), '说得出还剩几位 —— 报名前最要紧的那个数',
         (活文.match(/[^·]{0,12}位[^·]{0,6}/) || [''])[0])

      const 我 = await p.evaluate(() => JSON.parse(localStorage.getItem('unmei:buwanren:user') || '{}').id)
      const 报了几场 = () => sql1(`SELECT count(*) FROM activity_registration WHERE user_id='${我}' AND status='registered'`)
      const 之前 = Number(报了几场())
      const 能报的 = await p.locator('button.btn:not(.ghost):not([disabled])').filter({ hasText: '报名' })
      if (await 能报的.count() > 0) {
        await 能报的.first().click()
        for (let i = 0; i < 20; i++) {
          if (Number(报了几场()) > 之前) break
          await p.waitForTimeout(400)
        }
        ok(Number(报了几场()) === 之前 + 1, '按「报名」真的报上了', 报了几场() + ' 场')
        await p.waitForTimeout(800)
        ok((await text()).includes('不去了'),
           '报上之后那颗按钮改口说「不去了」—— 「已报名」是状态不是动作',
           (await text()).slice(0, 60))
        /* 【撤得掉】。报名是线下的事，去不了是常态 ——
           一个报得上、撤不掉的名额比没有更麻烦:它占着别人的位子。 */
        await p.getByText('不去了', { exact: true }).first().click()
        for (let i = 0; i < 20; i++) {
          if (Number(报了几场()) === 之前) break
          await p.waitForTimeout(400)
        }
        ok(Number(报了几场()) === 之前, '按「不去了」真的撤了 —— 名额还给别人',
           报了几场() + ' 场')
      }
    }
  }

  /* ── 要退款的人（2026-09-05）───────────────────────────────
     用户协议上写着：「任何一单都能在「我的 › 我买过的」里申请，我们逐单看」。
     那颗按钮在订单屏上（`status` 是 paid / fulfilling / done 时才摆），
     **而它从来没有被按过一次** —— 这一趟末尾那份处理器清单里，
     `order·onRefund` 一直在「没碰过的」那一行上，理由写着
     「要一笔真的成功支付」。

     那个理由对【走 UI 付款】成立（浏览器里没有微信收银台，垫片如实抛），
     对这一段不成立:上面几段已经种过两张真的已付单（`ord-m3-*` / `ord-inc-*`,
     订单、支付两张表都齐）。拿其中一张按那颗真按钮就是了。

     退款这条是【钱往回走】的路 —— 全 app 最不该只有接口有人验的地方。
     申请完把那一行删掉，下一轮跟这一轮看到的库是同一个。 */
  {
    const 我 = await p.evaluate(() => JSON.parse(localStorage.getItem('unmei:buwanren:user') || '{}').id)
    const 已付的 = 我 ? sql1(
      `SELECT id FROM order_record WHERE user_id='${我}' AND status='paid'`
      + ` AND amount_paid_minor > 0 ORDER BY created_at DESC LIMIT 1`) : ''
    if (已付的) {
      await open('pages/order/index', { id: 已付的 })
      await p.waitForTimeout(1200)
      ok((await text()).includes('申请退款'),
         '已付的那一单上摆得出「申请退款」', (await text()).slice(0, 60))
      await p.getByText('申请退款', { exact: true }).click()
      let 说 = ''
      for (let i = 0; i < 20; i++) {
        说 = await p.evaluate(() => globalThis.__router.current().data.note || '')
        if (说) break
        await p.waitForTimeout(400)
      }
      /* 【说的是「等审核」，不是「已退款」】。协议上写的是「我们逐单看」——
         按完就说「已退款」的话，人会去银行卡上等一笔今天不会到的钱。 */
      ok(/等审核/.test(说), '按完说的是「已申请，等审核」，不是「已退款」', 说)
      const 落了 = sql1(`SELECT status FROM refund WHERE order_id='${已付的}' ORDER BY created_at DESC LIMIT 1`)
      ok(落了 === 'requested', '库里真多了一张待审的退款单', 落了 || '（一条都没有）')
      /* 【申请完这一屏要看得见】（2026-09-06）。此前按完一个字都不变:
         那句提示被紧接着的 `load()` 清掉，而订单详情接口不返退款单。
         人这时只会做一件事 —— 再按一次。 */
      await p.waitForTimeout(1200)
      const 退后 = await text()
      ok(/退款 · 审核中/.test(退后), '屏上摆得出「退款 · 审核中」',
         (退后.match(/退款[^·]{0,8}·[^·]{0,10}/) || [''])[0])
      ok(/单号 [0-9a-z]{6,10}/.test(退后), '给得出一个念得给客服听的退款单号',
         (退后.match(/单号 \S+/) || [''])[0])
      /* 【在途的时候不给第二颗按钮】。后端的在途检查会拒，
         而屏上此刻已经写着「审核中」—— 按第二次的唯一结果是一句错话。 */
      ok(await p.getByText('申请退款', { exact: true }).count() === 0,
         '已经在审核里的时候，不再摆一颗按了必被拒的按钮',
         String(await p.getByText('申请退款', { exact: true }).count()))
      const 几张 = sql1(`SELECT count(*) FROM refund WHERE order_id='${已付的}'`)
      ok(几张 === '1', '只建了一张退款单', 几张 + ' 张')
      run(`DELETE FROM refund WHERE order_id='${已付的}'`)

      /* 【数字内容交付之后不给这颗按钮，给一句话】。用户协议写着
         「数字内容一经交付（住进来了、说明书出好了）不支持退款」,
         而那颗按钮此前的条件是 `paid || fulfilling || done`——不看买的是什么。
         买家的体验是:按了 → 屏上什么都没变 → 若干天后被拒。 */
      const 住下的单 = sql1(
        `SELECT o.id FROM order_record o JOIN order_line ol ON ol.order_id=o.id`
        + ` JOIN sku k ON k.id=ol.sku_id JOIN product pr ON pr.id=k.product_id`
        + ` WHERE o.user_id='${我}' AND o.status IN ('paid','fulfilling','done')`
        + ` AND pr.fulfillment_kind='residency' AND ol.fulfillment_status='done' LIMIT 1`)
      if (住下的单) {
        await open('pages/order/index', { id: 住下的单 })
        await p.waitForTimeout(1400)
        const 住文 = await text()
        ok(await p.getByText('申请退款', { exact: true }).count() === 0,
           '已经住进来的那一单不摆「申请退款」—— 协议说它退不了',
           String(await p.getByText('申请退款', { exact: true }).count()))
        ok(/这一单不退/.test(住文),
           '而是说清为什么退不了 —— 不是按钮消失了没人知道',
           (住文.match(/[^·]{0,12}这一单不退[^·]{0,4}/) || [''])[0])
      }
    }
  }

  /* ── 买过很多东西的人（2026-09-05）─────────────────────────
     「我买过的」那一屏原先是【取一次，本地切片】：`commerceApi.orders()`
     不带参数，后端默认给 20 条，而这一屏把拿到的东西按每页五笔切成四页,
     `pageCount` 也是按【拿到几条】算的。

     于是买过 30 单的人看到标题写着「30 笔」，翻到第四页就到头了 ——
     剩下十笔他一辈子也够不着，而屏上没有一处说得出为什么。
     四页翻得干干净净、内部完全自洽:**这种缺口不会自己喊**。
     库里单子最多的人只有十单，所以谁也没撞上过。

     这一段自己造够二十笔，把那条边界走过去。造完就删。 */
  {
    const uid = await p.evaluate(() => JSON.parse(localStorage.getItem('unmei:buwanren:user') || '{}').id)
    if (uid) {
      const 有几单 = Number(sql1(`SELECT count(*) FROM order_record WHERE user_id='${uid}'`))
      // 凑到二十五单 —— 后端一页默认二十，这个数必须真的越过它
      const 还差 = Math.max(0, 25 - 有几单)
      for (let i = 0; i < 还差; i++) {
        run(`INSERT INTO order_record(id, user_id, channel_origin, currency,
               amount_subtotal_minor, amount_total_minor, status, region, created_at)
             VALUES('vord-${i}','${uid}','web','CNY',100,100,'done','cn',
                    NOW() - INTERVAL '${i + 1} hours')
             ON CONFLICT (id) DO NOTHING`)
      }
      await open('pages/orders/index')
      await p.waitForTimeout(1600)
      const 账 = await p.evaluate(() => {
        const d = globalThis.__router.current().data
        return { total: d.total, pageCount: d.pageCount, 本页: d.page.length }
      })
      ok(账.total >= 25, '造够了二十五单', JSON.stringify(账))
      /* 【翻得到的页数要按「一共几笔」算】。按「这一次拿到几条」算的话，
         它永远是四页 —— 而标题上写的是二十五笔。 */
      ok(账.pageCount === Math.ceil(账.total / 5),
         '页数按「一共几笔」算，不是按「这一次拿到几条」', JSON.stringify(账))
      /* 【最后一页真的翻得到，而且上面有东西】。这是那条缺口的判据本身:
         第五页在旧代码里根本不存在。 */
      const 头一页 = await p.evaluate(() => globalThis.__router.current().data.page.map((r) => r.id).join(','))
      for (let i = 0; i < 4; i++) {
        await p.getByText('下一页 ›', { exact: true }).click().catch(() => {})
        await p.waitForTimeout(700)
      }
      const 末页 = await p.evaluate(() => {
        const d = globalThis.__router.current().data
        return { pageNo: d.pageNo, 本页: d.page.length, ids: d.page.map((r) => r.id).join(',') }
      })
      ok(末页.pageNo === 4 && 末页.本页 > 0,
         '第五页翻得到，而且上面真的有单子', JSON.stringify(末页))
      ok(末页.ids !== 头一页, '第五页上的不是第一页那几笔', 末页.ids.slice(0, 40))
      run(`DELETE FROM order_record WHERE id LIKE 'vord-%'`)
    }
  }

  /* ── 注销账号（2026-09-05）───────────────────────────────────
     隐私政策上写了两遍「在「设置」里退出并删除账号」：

       「存多久：账号在，数据就在。你退出并删除账号，出生时间与盘会一起
         删掉；订单与支付记录按法律要求保留，那部分只留金额与时间」

     而「设置」上此前只有一颗「退出」—— 它是本机的 `logout()`，
     清掉这台手机上的 token，服务端一行数据都不动。绑了微信的人下次
     登录回来东西全在；匿名的人只是再也够不着自己那个号。
     **屏上那两句话对谁都不成立。**

     这一段验两件事：那一屏说得清楚（先看清楚再按），以及那一下
     真的删得掉（拿一个【用完就丢的身份】走，不能拿这一趟的主用户）。 */
  {
    await open('pages/settings/index')
    await p.waitForTimeout(600)
    ok((await text()).includes('注销账号'), '设置那一屏上找得到「注销账号」',
       (await text()).slice(-90))
    await p.getByText('注销账号', { exact: true }).click()
    await p.waitForTimeout(1000)
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/leave/index',
       '点得进注销那一屏', await p.evaluate(() => globalThis.__router.current().__route))
    const 注销文 = await text()
    /* 【删什么、留什么、之后怎样 —— 三样都要说】。少说一样，
       人是在信息不全的情况下按下一个不可逆的按钮。 */
    ok(注销文.includes('会删掉') && 注销文.includes('会留下') && 注销文.includes('之后'),
       '那一屏说清了删什么、留什么、之后怎样', 注销文.slice(0, 80))
    ok(注销文.includes('出生时间') && 注销文.includes('再也进不来'),
       '删的那一条跟隐私政策上写的是同一句', 注销文.slice(0, 120))
    ok(注销文.includes('金额与时间'),
       '留下的那一半也照政策说清 —— 不是含糊一句「部分数据保留」',
       (注销文.match(/[^·]{0,20}金额与时间[^·]{0,10}/) || [''])[0])
    await shot('leave')
    /* 【这一屏不许自己就把人注销了】。垫片的 `showModal` 走浏览器
       confirm，Playwright 默认 dismiss —— 也就是说这一下【等于点了「先不」】。
       它仍然是有意义的一条:按下去之后如果什么都没发生，说明那道
       二次确认真的挡在前面（挡不住的话这一趟的主用户当场就没了）。 */
    await p.getByText('注销这个账号', { exact: true }).click()
    await p.waitForTimeout(1200)
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/leave/index',
       '不确认就什么都不发生 —— 二次确认真的挡在前面',
       await p.evaluate(() => globalThis.__router.current().__route))

    /* 那一下真做起来是什么样 —— 用一个【用完就丢】的身份走。
       不能拿这一趟的主用户:他后面还有一百多条断言要跑。 */
    if (API) {
      const 结果 = await p.evaluate(async (base) => {
        const 登 = await fetch(base + '/v1/auth/anonymous', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
        })
        if (!登.ok) return { 步: '登录', 码: 登.status }
        const { token } = await 登.json()
        const 头 = { authorization: 'Bearer ' + token, 'content-type': 'application/json' }
        const 我 = await (await fetch(base + '/v1/user/me', { headers: 头 })).json()
        const 删 = await fetch(base + '/v1/user/me/delete', { method: 'POST', headers: 头, body: '{}' })
        const 再问 = await fetch(base + '/v1/user/me', { headers: 头 })
        // 幂等:手抖点两下不该报错
        const 再删 = await fetch(base + '/v1/user/me/delete', { method: 'POST', headers: 头, body: '{}' })
        return { id: 我.id, 删: 删.status, 再问: 再问.status, 再删: 再删.status }
      }, API)
      ok(结果.删 === 200, '注销那一下真的成了', JSON.stringify(结果))
      /* 【401 不是 403】。403 是「你不能做这件事」，而注销之后这个号
         已经不存在 —— 而且客户端对 401 的处置是清掉 token 重新匿名登录，
         那正是一个刚注销完的人该落到的地方。 */
      ok(结果.再问 === 401, '注销之后旧 token 一律 401 —— 这个号真的进不来了',
         JSON.stringify(结果))
      /* 【这一条挡住过一次真缺口】。守卫按 `deleted_at` 把注销过的 token
         一律打成 401，于是应用层那份幂等（再调一次各项都是 0）
         **在 HTTP 上一次都到不了** —— 网络超时之后人再点一次，
         那一下其实已经成了，屏上却报「没登录」。现在注销那一条自己放行。 */
      ok(结果.再删 === 200, '再点一次不报错 —— 报错会让人以为头一次没成',
         JSON.stringify(结果))
      if (结果.id) {
        ok(sql1(`SELECT count(*) FROM app_user WHERE id='${结果.id}' AND deleted_at IS NOT NULL`) === '1',
           '库里那一行落了注销时间',
           sql1(`SELECT nickname, deleted_at FROM app_user WHERE id='${结果.id}'`))
        ok(sql1(`SELECT nickname FROM app_user WHERE id='${结果.id}'`) === '已注销',
           '名字换成「已注销」—— 后台那张表上一个空名字读起来像数据坏了',
           sql1(`SELECT nickname FROM app_user WHERE id='${结果.id}'`))
      }
    }
  }

  await open('pages/me/index')

  /* 【有货那天，那一行自己回来】（2026-09-05 · 一味香按月送上架）。
     这一条原先反着写:「一个都没订就不摆那一行」—— 那时村里一件可订的
     东西都没有，点进去只会说「等有了会摆在这儿」，一句「产品没做完」
     挂在另外四行旁边，会把那四行的可信度一起拉低。
     而那段注释自己写着「有货那天 `hasSubs` 自己就把它带回来」——
     今天就是那天，所以断言跟着翻面。

     判据仍然是一句话:**这一行只在它通向某个东西的时候才摆**。
     变的不是规矩，是货架上有没有东西。 */
  const 我屏文 = await text()
  const 有订 = await p.evaluate(() => globalThis.__router.current().data.hasSubs)
  ok(有订 === true && 我屏文.includes('订着的'),
     '有可订的东西了，「我的」上那一行就摆出来', `hasSubs=${有订}`)

  /* 【从入口走进去，不直接开那一页】。这一段原先是 `open('pages/subs/index')` ——
     那时入口是收起来的，只能绕过它。现在入口在了，就该走它:
     「那一页打得开」跟「从我的点得进那一页」是两件事，
     而后者才是人真的会做的动作。 */
  await p.getByText('订着的', { exact: true }).click()
  await p.waitForFunction(
    () => globalThis.__router.current().__route === 'pages/subs/index',
    null, { timeout: 15000 },
  ).catch(() => {})
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/subs/index',
     '从「我的」点得进「订着的」', await p.evaluate(() => globalThis.__router.current().__route))
  await p.waitForTimeout(1200)
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

  /* ── 真的订着的时候，这一屏长什么样（2026-09-05）────────────────
     上面那几条验的全是【一个都没订】那一支 —— 而这一趟走的是一个
     刚建的匿名用户，他永远一份都没有。也就是说 `subs.length > 0`
     那一支在这支门禁里**从来没有渲染过**，页面注释里也是这么写的：
     「这一屏从来没有一位真的订着的人来过」。

     它藏住过三样：套餐名打的是 `plan-mg-month`、状态打的是 `active`、
     日子打的是带微秒的时间戳。这三样是这一轮才修的，而修完之后
     仍然没有任何东西盯着它们 —— 所以这里自己造两份订阅。

     两份都是【死的】（到期 / 退了），为的是同时验第二件事：
     一份都不在续的时候，这一屏不能是几张读不动的卡片加一颗「回去」。
     造完就删，后面那一段照旧走在「一个都没订」上。 */
  {
    const uid = await p.evaluate(() => JSON.parse(localStorage.getItem('unmei:buwanren:user') || '{}').id)
    if (uid) {
      const 两份 = ['vsub-dead-y', 'vsub-dead-m']
      run(`INSERT INTO subscription(id, user_id, plan_id, status, source_channel,
             current_period_start, current_period_end, cancel_at_period_end, region)
           VALUES('${两份[0]}','${uid}','plan-mg-year','expired','wechat_jsapi',
                  NOW() - INTERVAL '400 days', NOW() - INTERVAL '35 days', false, 'cn'),
                 ('${两份[1]}','${uid}','plan-mg-month','cancelled','wechat_jsapi',
                  NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days', true, 'cn')
           ON CONFLICT (id) DO NOTHING`)
      await open('pages/subs/index')
      await p.waitForTimeout(1400)
      const 订文 = await text()
      ok(await p.evaluate(() => (globalThis.__router.current().data.subs || []).length) === 2,
         '订着的那一屏这次真渲了列表那一支', 订文.slice(0, 40))
      /* 【库里那个字段的原文一个都不许上屏】。名、状态、日子三样
         原先打的就是 `plan-mg-year` / `expired` / 带微秒的时间戳。 */
      ok(!/plan-mg-|expired|cancelled/.test(订文),
         '套餐名与状态都是人话，不是库里那个字段', (订文.match(/plan-mg-\S+|expired|cancelled/) || [''])[0])
      ok(订文.includes('已经到期') && 订文.includes('已经退了'),
         '两份的状况各说各的', 订文.slice(0, 80))
      /* 【一份都不在续，这一屏不能是死路】。它长得像「有东西」，
         其实跟空的一样 —— 而空状态早就说清了去处，这一态没人管过。 */
      const 有出路 = 订文.includes('可以订') || 订文.includes('等有了会摆在这儿')
        || await p.evaluate(() => (globalThis.__router.current().data.offers || []).length > 0)
      ok(有出路, '一份都不在续的时候，它说得出下一步去哪儿', 订文.slice(-60))
      /* 【还在续的那一份，卡上要有一个按得动的东西】（2026-09-05）。
         上面两份是死的，死的不给动作是对的;而活着的那一份从前也一样
         什么都不给 —— 后端 `cancel` 一直在，用户没有任何办法用到它。
         这里只验「屏上给不给得出」;那颗按钮真按下去会发生什么，
         由 25 计划打真接口验（`scripts/plan25.sh` 的 U4）。 */
      run(`INSERT INTO subscription(id, user_id, plan_id, status, source_channel,
             current_period_start, current_period_end, cancel_at_period_end, region)
           VALUES('vsub-alive','${uid}','plan-incense-monthly','active','wechat_mp',
                  NOW() - INTERVAL '2 days', NOW() + INTERVAL '28 days', false, 'cn')
           ON CONFLICT (id) DO NOTHING`)
      await open('pages/subs/index')
      await p.waitForTimeout(1400)
      const 活文 = await text()
      ok(活文.includes('不再续了'), '还在续的那一份给得出「不再续了」', 活文.slice(0, 70))
      ok(await p.locator('.item-do').count() === 1,
         '一张卡上只给一个动作 —— 死的那两份不给',
         String(await p.locator('.item-do').count()))
      /* 【会寄东西的那一档说的是东西】。`plan.entitlements_json` 里写着
         每期发什么;有它的时候屏上该是「下一盒 X 发」，不是「续到 X」。 */
      ok(/下一盒 .* 发/.test(活文), '它说的是「下一盒几号发」，不是「续到几号」',
         (活文.match(/下一盒[^·]{0,16}/) || [''])[0])

      /* 【那颗按钮真按下去会怎样】（2026-09-06）。上面那一条只验了
         「屏上给不给得出」，而注释里写着「真按下去由 25 计划打真接口验」——
         也就是说 `subs·onStop` 这个处理器【一次都没被按过】，
         它一直挂在这一趟末尾那份「没碰过的」清单上。

         退订是「花钱的反面」，按错了要等一个月才发现，所以它有二次确认;
         镜像里 `wx.showModal` 走浏览器 confirm，playwright 默认关掉它 ——
         两边都要显式接管，跟上面取消订单那一段同一个手法。 */
      const 还续着 = () => sql1(`SELECT cancel_at_period_end FROM subscription WHERE id='vsub-alive'`)
      const 关掉退订 = (d) => d.dismiss()
      p.on('dialog', 关掉退订)
      await p.getByText('不再续了', { exact: true }).click()
      await p.waitForTimeout(900)
      ok(还续着() === 'f', '在确认框上说「再想想」，它还续着 —— 不该一按就停',
         还续着())
      p.off('dialog', 关掉退订)

      const 点头退订 = (d) => d.accept()
      p.on('dialog', 点头退订)
      await p.getByText('不再续了', { exact: true }).click()
      await p.waitForTimeout(1400)
      ok(还续着() === 't', '确认之后真的不再续了', 还续着())
      p.off('dialog', 点头退订)

      /* 【标记打上之后，屏上要跟着改口】。`cancel_at_period_end` 为 true 时
         状态仍然是 `active` —— 而这一屏原先只打状态，
         一位已经点过「到期不续」的人，看到的跟没退的人一个字不差
         （docs/ACCEPTANCE-25.md 先决条件五里记着这件事）。 */
      await open('pages/subs/index')
      await p.waitForTimeout(1400)
      const 退后文 = await text()
      ok(/不再续/.test(退后文), '点完之后那一屏跟着改口 —— 不是仍旧写着「订着」',
         (退后文.match(/一味香[^·]{0,40}/) || [''])[0])
      run(`DELETE FROM subscription WHERE id IN ('${两份[0]}','${两份[1]}','vsub-alive')`)
    }
  }

  /* ── 发到手的券，他自己看得见吗（2026-09-05）───────────────────
     `docs/ACCEPTANCE-25.md` 第六条：后台发得出绑人的券，库里
     `coupon.owner_user_id` 从建库起就是为「这一张是谁的」留的 ——
     而用户那一侧【没有一个「我的券」】。客户端唯一跟券有关的东西是
     确认页上那个「有券码就填这儿」的格子，也就是**他得先知道那串码**。
     运营给一位用户补一张，用户打开 app 什么都看不到。

     跟上面订阅那一段同一个手法：造三张（能用 / 过期 / 用过），
     验完就删，后面几段照旧走在「手里一张都没有」上。 */
  {
    const uid = await p.evaluate(() => JSON.parse(localStorage.getItem('unmei:buwanren:user') || '{}').id)
    if (uid) {
      const 码 = 'VCPN' + String(Date.now()).slice(-6)
      /* 四张:两张能用（先到期的排前面）、一张过期、一张用过。
         两张能用是为了让「换一张」那一支【真的渲染出来】——
         这个仓栽过一次同样的事:「订着的」那一屏 `subs.length > 0`
         那一支从来没有一位真订着的人来过，于是它把库里的字段原文
         打了三样上屏而没人发现。红着的分支不会自己喊。 */
      run(`INSERT INTO coupon(id, code, owner_user_id, benefit_json, state,
             issued_at, expires_at, audit_note, region)
           VALUES('vcpn-ok','${码}','${uid}','{"pct_off_bps":2000,"max_off_minor":10000}'::jsonb,
                  'issued', NOW(), NOW() + INTERVAL '10 days', '镜像验证', 'cn'),
                 ('vcpn-ok2','${码}Z','${uid}','{"amount_off_minor":1000}'::jsonb,
                  'issued', NOW(), NOW() + INTERVAL '30 days', '镜像验证', 'cn'),
                 ('vcpn-old','${码}X','${uid}','{"amount_off_minor":2000}'::jsonb,
                  'issued', NOW() - INTERVAL '9 days', NOW() - INTERVAL '1 day', '镜像验证', 'cn'),
                 ('vcpn-used','${码}Y','${uid}','{"pct_off_bps":1000}'::jsonb,
                  'redeemed', NOW() - INTERVAL '9 days', NOW() + INTERVAL '9 days', '镜像验证', 'cn')
           ON CONFLICT (id) DO NOTHING`)

      await open('pages/coupons/index')
      await p.waitForTimeout(1400)
      const 券文 = await text()
      ok(await p.evaluate(() => (globalThis.__router.current().data.券 || []).length) === 4,
         '手里的券那一屏渲得出列表', 券文.slice(0, 50))
      /* 【库里那几个字段的原文一个都不许上屏】。券面在库里是
         `{"pct_off_bps":2000}`，状态是 `issued` / `redeemed` ——
         照打的话这一屏是四行读不懂的 JSON。 */
      ok(!/pct_off_bps|amount_off_minor|issued|redeemed/.test(券文),
         '券面与状态都是人话，不是库里那个字段',
         (券文.match(/pct_off_bps|amount_off_minor|issued|redeemed/) || [''])[0])
      ok(券文.includes('八折') && 券文.includes('最多减 ¥100'),
         '券面说的是「八折 · 最多减 ¥100」', 券文.slice(0, 60))
      /* 【能不能用是后端算的，屏上要照实说】。过期那张与用过那张
         都得说出自己为什么用不了 —— 不说的话它们跟能用的长得一样。 */
      ok(券文.includes('已经过期') && 券文.includes('用过了'),
         '用不了的两张各说各的理由', 券文.slice(0, 90))
      ok(券文.includes('4 张') && 券文.includes('2 张能用'),
         '副标题分得清「有几张」与「能用几张」',
         (券文.match(/\d+ 张[^·]{0,12}/) || [''])[0])
      /* 【能用的排前面，先到期的又排在前】。人点进来找的是
         「我现在有什么能花」，而该先花掉的是快过期那张。 */
      ok(await p.evaluate(() => (globalThis.__router.current().data.券 || [])
           .slice(0, 2).map((x) => x.id).join(',')) === 'vcpn-ok,vcpn-ok2',
         '能用的排前面，先到期的又排在最前',
         await p.evaluate(() => (globalThis.__router.current().data.券 || []).map((x) => x.id).join(',')))
      /* 【一张卡上只给一个动作】——跟「订着的」同一条规矩。
         能用的指向哪儿能花掉它;过期、用过的什么都不给（确实无事可做）。 */
      ok(await p.locator('.item-do').count() === 2,
         '两张能用的各给一个动作，用不了的不给', String(await p.locator('.item-do').count()))
      await shot('coupons')

      /* 【「我的」上那一行要摆出来】。它挂着 `wx:if="{{hasCoupons}}"`，
         跟「订着的」「去得了的」同一条规矩：一行要么通向一件真事，要么不在。 */
      await open('pages/me/index')
      await p.waitForTimeout(1400)
      ok((await text()).includes('手里的券'), '手里有券的时候，「我的」上那一行摆出来',
         (await text()).slice(0, 120))
      await p.getByText('手里的券', { exact: true }).click()
      await p.waitForTimeout(1200)
      ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/coupons/index',
         '从「我的」点得进「手里的券」',
         await p.evaluate(() => globalThis.__router.current().__route))

      /* 【结账那一格得让他点得到自己的券】。这一格原先只收码 ——
         而运营发的券绑在他账号上，系统一直知道有哪几张，只是从没说过。
         这一条验的是那半截缺口：不只「看得见」，还要「用得上」。

         【券条占的是输入框那个位子，不另起一块】。这一屏的纵向是满的:
         实测内容 633px、一屏 667px，用上券之后那一行「这张券减」
         就已经把它顶出去 11px（那 11px 这一轮一并修了:下留白
         220rpx → 196rpx）。另起一块要 69px，一块都放不下。 */
      if (要参数['pages/confirm/index']) {
        await open('pages/confirm/index', 要参数['pages/confirm/index'])
        await p.waitForTimeout(1400)
        ok(await p.locator('.coupon-pick').count() === 1,
           '结账那一格摆的是他手里那张券，不是一个空输入框',
           String(await p.locator('.coupon-pick').count()))
        ok((await text()).includes('八折'), '摆出来的是先到期那张的券面',
           (await text()).slice(0, 80))
        await p.locator('.coupon-pick').first().click()
        const 等减 = async () => {
          for (let i = 0; i < 20; i++) {
            const v = await p.evaluate(() => globalThis.__router.current().data.减了)
            if (v > 0) return v
            await p.waitForTimeout(500)
          }
          return 0
        }
        const 头一张减 = await 等减()
        ok(头一张减 > 0, '点一下就当场算出减了多少 —— 不用他再按一次「试试」',
           String(头一张减) + ' · ' + (await text()).slice(0, 60))
        /* 【不止一张时换得动，而且换完那个数跟着变】。换一张而屏上
           那个数不动的话，人不知道换过去到底是多少，还得再按一次。 */
        await p.getByText('换一张').click()
        await p.waitForTimeout(300)
        let 第二张减 = 0
        for (let i = 0; i < 20; i++) {
          第二张减 = await p.evaluate(() => globalThis.__router.current().data.减了)
          if (第二张减 > 0 && 第二张减 !== 头一张减) break
          await p.waitForTimeout(500)
        }
        ok(第二张减 > 0 && 第二张减 !== 头一张减,
           '「换一张」换过去之后，减的那个数跟着变',
           `头一张 ${头一张减} → 第二张 ${第二张减}`)
        /* 【别处拿到的码还得填得进来】。券条占了输入框那个位子，
           所以必须留一条切回去的路;切过去【不切回来】—— 切回来会把
           他打了一半的字吃掉。 */
        await p.getByText('填码').click()
        await p.waitForTimeout(600)
        ok(await p.locator('.coupon-in').count() === 1,
           '点「填码」换回那个输入框 —— 别处拿到的码还填得进来',
           String(await p.locator('.coupon-in').count()))
        ok(await p.evaluate(() => globalThis.__router.current().data.减了) === 0,
           '换回输入框时把上一张的折扣一起撤掉 —— 屏上不留一个算不出来的数',
           String(await p.evaluate(() => globalThis.__router.current().data.减了)))
        /* 【手里只剩一张时不摆「换一张」】—— 一颗按下去什么都不变的按钮，
           比没有更糟。删掉一张再开一次，验的是这条判断真跟着数据走。 */
        run(`DELETE FROM coupon WHERE id='vcpn-ok2'`)
        await open('pages/confirm/index', 要参数['pages/confirm/index'])
        await p.waitForTimeout(1400)
        ok(await p.getByText('换一张').count() === 0,
           '只剩一张的时候不摆「换一张」', String(await p.getByText('换一张').count()))
      }

      run(`DELETE FROM coupon WHERE id IN ('vcpn-ok','vcpn-ok2','vcpn-old','vcpn-used')`)
    }
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
  for (const 条 of ['名字', '我买过的', '我得到的', '设置']) {
    ok(我屏.includes(条), `「我的」上有「${条}」这一条`, 条)
  }
  /* 搬走的三块不该还在这一屏上。留一块在这儿，这一屏就又放不下了 ——
     而「放不下」在真机上的样子是【底下那一截看不见】,不是报错。 */
  for (const 不该有 of ['退出', '这台设备上的账号']) {
    ok(!我屏.includes(不该有), `「${不该有}」已经不在这一屏上`, 不该有)
  }

  /* 最近一笔写的是【买的那个东西】,不是订单号。
     后端 my_orders 的 title 取自下单那一刻的 sku 快照 ——
     没有它，这一块只显示得出一串 UUID,读的人认不出自己买了什么。 */
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
/* app.json 里声明了它，而垫片以前整个忽略 —— 真机上它一直占着底下那一条，
   镜像里既不显示也没人能点。切 tab 这个动作因此完全验不到，
   而页面看着是完整的。 */
console.log('\n── 底下那条 tab ──')
errs.length = 0
await open('pages/home/index')
const tabs = await p.evaluate(() => {
  const bar = document.getElementById('wx-tabbar')
  return bar ? { 显示: getComputedStyle(bar).display, 字: [...bar.children].map((c) => c.textContent) } : null
})
ok(tabs !== null, 'tab 条在')
/* 期望值从 app.json 读，不写死。写死过一次：村加进 tab 那天这一条报红，
   红的是断言不是产品，而报告长得跟产品坏了一模一样。 */
const 期望字 = (JSON.parse(readFileSync('mini/miniprogram/app.json', 'utf8')).tabBar?.list || [])
  .map((t) => t.text)
ok(tabs && tabs.字.join('') === 期望字.join(''),
   `${期望字.length} 个 tab 照 app.json`, tabs ? tabs.字.join(' ') : '没有')
if (tabs) {
  await shot('05-tabbar')
  /* tab 的字同样从 app.json 读。写死过一次：「我」改名叫「我的」那天这一条
     报的是 30 秒超时，长得像产品坏了，其实只是断言没跟着改名。 */
  const 字 = (路径) => (期望字[(JSON.parse(readFileSync('mini/miniprogram/app.json', 'utf8'))
    .tabBar.list).findIndex((t) => t.pagePath === 路径)])
  const 我字 = 字('pages/me/index')
  await p.getByText(我字, { exact: true }).click()
  await p.waitForTimeout(400)
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/me/index',
     `点「${我字}」真的切过去了`, await p.evaluate(() => globalThis.__router.current().__route))
  // 村现在是 tab 页(2026-08-19 之前它谁也进不去，全应用唯一的扫码入口就在上面)。
  // 这里【点过去】而不是直开 —— 直开一直都行，不行的正是「从底下点得到」这件事，
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
      return { 有罗盘: 文.includes('问一件事'), 还在这页: globalThis.__router.current().__route }
    })
    ok(就在这屏.有罗盘 && 就在这屏.还在这页 === 'pages/home/index',
       '有本命时，罗盘就在我家这一屏上　—— 问不再是一个地方，不用再跳一次',
       `${就在这屏.还在这页} · ${就在这屏.有罗盘 ? '罗盘在' : '没找到罗盘'}`)
  } else {
    /* 没本命时验空态那一支：它也得走得通，而且走的是另一条路。 */
    await p.getByText('填出生时间', { exact: true }).click()
    await p.waitForFunction(
      () => globalThis.__router.current().__route === 'pages/natal/index',
      null, { timeout: 15000 },
    ).catch(() => {})
    ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/natal/index',
       '我家空态那颗「填出生时间」是真出口　—— 不是一颗灰着点不动的按钮',
       await p.evaluate(() => globalThis.__router.current().__route))
  }

  await open('pages/home/index')
  /* 通往生辰那一页的入口在两个状态下是两颗不同的东西：
     还没建过 → 「填出生时间」；建过了 → 「看完整的那一份 ›」。
     守的是同一条性质：命不再是 tab 之后的新路，从我家一下就到。
     原先只点「填出生时间」,而**有本命那一支只在接上排盘服务时才走得到**,
     于是它一直没红过。 */
  /* 一屏只该有一件要你做的事（标尺 §1.5.4 第二问）。
     还没填出生时间的时候，屏上写着「转出来的还不算你的」，
     而中心那颗和底下那颗曾经【同样满橙】—— 人不知道该按哪颗。
     此刻该做的是填，所以中心那颗让位（仍点得动，只是不抢主色）。 */
  {
    const 态 = await p.evaluate(() => ({
      有盘: !!globalThis.__router.current().data.summary,
      让位: !!document.querySelector('.compass-btn-quiet'),
    }))
    ok(态.有盘 ? !态.让位 : 态.让位,
       态.有盘 ? '有本命时，中心那颗是这一屏的主动作'
              : '还没填出生时间时，中心那颗让位给「填出生时间」　—— 一屏不摆两颗同样重的按钮',
       `有盘=${态.有盘} 让位=${态.让位}`)
  }

  const 有盘 = await p.evaluate(() => !!globalThis.__router.current().data.summary)
  /* 文案从页面上读，不写死 —— 这条断言此前钉着「展开看盘」,
     而那个说法早就改成了「看完整的那一份」；它只在接上排盘服务时才执行，
     所以钉着一个不存在的东西活了很久。 */
  const 入口 = 有盘 ? p.locator('.delta-role').first()
                    : p.getByText('填出生时间', { exact: true })
  await 入口.click()
  await p.waitForTimeout(400)
  ok(await p.evaluate(() => globalThis.__router.current().__route) === 'pages/natal/index',
     `我家「${有盘 ? '展开看盘' : '填出生时间'}」进得去生辰　—— 命不再是 tab 之后的新路`,
     await p.evaluate(() => globalThis.__router.current().__route))
  // 反过来那一半：不在 tab 上的页，底下不该有这条。少了这一条的话，
  // 「tab 条永远显示」这种垫片退化也能全绿。
  await open('pages/room/index')
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('wx-tabbar')).display) === 'none',
     '屋里没有 tab 条　—— 它不是 tab 页，真机上那里也没有')
} else {
  // tab 条都不在，就别去点它 —— 那会卡满三十秒再抛栈，看着像门禁自己坏了
  ok(false, '点「我」真的切过去了', 'tab 条都不在，没得点')
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
  ok(r !== '没抛' && /真机|device/i.test(r), `wx.${api} 抛了，而且说清是真机的事`, r.slice(0, 34))
}
/* 顺带验一次它在页面里的样子：点「绑定微信」不该看起来成功了。
   这条与上面互补 —— 上面查垫片，这里查【页面拿到之后没把它糊过去】。 */
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
   按文字会同时选中标题与按钮，Playwright 直接判违规。 */
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

/* 只在打真后端时验：假服务端没有 /v1/auth/anonymous,那边根本没有「人」可换。 */
if (API) {
  /* 「退出并重新登录」对匿名用户是【换一个人】：清掉 token 之后 ensureLogin
     拿不到 token 就发一个全新的匿名身份，村子和本命一起没。
     这里【不判断该不该这样】——那是身份策略，写在
     docs/FINDING-2026-08-18-匿名用户三十天后村子回不来.md 里等拍板。
     这条只钉住【现状是什么】：换了人。哪天改成不换了，它会红，那正是该看一眼的时候。 */
  await open('pages/settings/index')
  await p.waitForTimeout(900)
  const 退出前 = await p.evaluate(() => globalThis.__router.current().data.user && globalThis.__router.current().data.user.id)

  /* 【先验它拦不拦】。这颗按钮对没绑微信的人是不可逆的：换一个新的匿名号，
     村里的人和买过的东西都留在旧号里。所以按下去必须先问一句。

     危险的那一头故意放在 confirm(而不是 cancel):浏览器的 confirm 显示不出
     按钮文字，Playwright 又默认 dismiss —— 放 cancel 的话每跑一次验证
     就真的退一次账号，而且看着像通过。 */
  let 问过 = ''
  const 听 = (d) => { 问过 = d.message(); d.dismiss() }
  p.on('dialog', 听)
  await p.getByText('退出', { exact: true }).click()
  await p.waitForTimeout(700)
  p.off('dialog', 听)
  ok(/找不回来|留在旧账号/.test(问过), '退出之前先说清楚会丢什么', 问过 || '（一句都没问就退了）')
  const 没点也没退 = await p.evaluate(() => globalThis.__router.current().data.user && globalThis.__router.current().data.user.id)
  ok(没点也没退 === 退出前, '在那句问话上按「先不退」，人就还是原来那个', String(没点也没退).slice(0, 14) + '…')

  // 再点一次，这回答应下去 —— 下面钉的是【答应之后现状是什么】
  const 答应 = (d) => d.accept()
  p.on('dialog', 答应)
  await p.getByText('退出', { exact: true }).click()
  /* 【等到位再判，不按秒数猜】。原先是固定等 2.2 秒 ——
     而「退出之后重新匿名登录」是一趟网络往返，机器忙一点就还没回来，
     读到的是 null，报出来像「退出后没有身份」。
     实测偶发红过一次（2026-09-02）。而偶发的红比常红更糟：
     它让每一次真红都能被当成噪音。等【有了新身份】或者超时，
     超时也如实说是超时，不混进结论里。 */
  await p.waitForFunction(
    () => { const u = globalThis.__router.current().data.user; return !!(u && u.id) },
    null, { timeout: 12000 },
  ).catch(() => {})
  p.off('dialog', 答应)
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
/* 手机上网络抖一下是常态，而这条从没验过。

   本命页原先把【任何】一次请求失败都渲成建本命的表单 —— 用户明明建过，
   照着填下去就多一条重复记录，起因只是一次网络抖动。
   今日页把「取不到盘」和「你还没建本命」显示成同一件事。
   两处都是 fallback 把「数据不存在」这个信号吃掉了。

   这里把 /v1/** 全打成 500(登录放行，否则连页面都进不去),
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
  /* 我家那一屏要的前提是「app 认为你有本命，而服务端不给盘」。
     这个前提【不能靠环境凑】:打真后端时那个匿名用户本来就没有本命，
     于是它显示引导是对的，检查却会红 —— 本机绿、CI 红，而红的是检查不是产品。
     所以这里自己把前提摆好，再让它重取一次。 */
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
   在浏览器里量得到，它正是那条门禁真正问的事：画得过来吗。

   量的是什么，说清楚：
     · 这是浏览器，不是手机。真机那条门禁仍然要人拿手机跑
     · 它抓得住「某次改动让某间房慢了十倍」,而那正是最容易溜过去的那种回归

   ── 为什么比【倍数】不比毫秒 ──────────────────────────────────
   第一版用的是绝对阈值(12ms),在开发机上全绿，推上 CI 全红 ——
   CI 的机器慢 10 到 50 倍(这台 popo 3.13ms,CI 上 30.85ms)。
   绝对毫秒是【绑机器】的，这仓库在视觉基准上已经栽过同一种坑：
   基准绑那台笔记本，拿到 CI 全红，所以 CI 改用 selfcheck / compare。同一课重上一遍。

   现在的做法：同一次运行里先量一个【标定负载】(一片同尺寸画布上做定量的
   fillRect + drawImage,与房间走同一套 canvas 2D 路径),再把每间房的开销
   换算成它的倍数。

   ── 倍数并不是恒定的，实测如此，别当成恒定 ──────────────────
   开发机与 CI 各量一遍(CI 慢 7.3 倍：标定 1.77ms vs 12.92ms):

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
   它不随机器线性缩放，而标定负载是吞吐主导的。所以倍数只是【有界】,不是相等。

   这决定了这道门禁能抓什么、不能抓什么，说清楚：
     · 能抓：某间房慢一个数量级(最重的 popo 现在 2.4×,阈值 12×)
     · 抓不住：三倍级的退化 —— 那落在两台机器的自然差异里
   要抓更细的，得先把「同一台机器上的历史值」存下来比，那是另一件事。 */
console.log('\n── 一帧要多久（开发机浏览器，不是手机）──')
await open('pages/village/index')
const cost = await p.evaluate(() => {
  const out = {}
  // 房间每帧要那颗表演按钮(引擎的保护)。这里是离开页面单独量开销，给个桩。
  const origBtn = globalThis.ENGINE_HOST.button
  let label = '起卦'
  globalThis.ENGINE_HOST.button = () => ({ onTap() {}, getLabel: () => label, setLabel: (s) => { label = s } })
  const time = (fn, n) => {
    for (let i = 0; i < 8; i++) fn()
    const t0 = performance.now()
    for (let i = 0; i < n; i++) fn()
    return +((performance.now() - t0) / n).toFixed(2)
  }
  /* 标定负载：与房间同尺寸的画布上做定量的 fillRect + drawImage。
     刻意走【同一套 canvas 2D 路径】—— 换成算数或字符串操作的话，
     机器之间的比例关系跟画画不一样，标定就不成立了。
     量级也要跟一帧【差不多】:第一版只画 400 个矩形，本机上 0.07ms,
     于是婆婆房算出 47 倍 —— 分母太小，倍数没有分辨率，也放大了抖动。 */
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
/* 阈值 12 倍标定负载。两台机器上最重的都是婆婆房，本机 1.7×、CI 2.4×,
   留五倍余量 —— 够宽，不会因为机器快慢而红；又抓得住数量级的回归。 */
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
   「15 passed,其实一个没跑」。一支什么都没做也印「动线全通」的脚本，
   比没有脚本更糟。

   【2026-09-01 抬门槛】。这个数原先是 30，而文件里 `ok(` 有三百多处 ——
   实测：假服务端那一档跑 111 条，打真后端跑 312 条。也就是说整段整段
   没跑到（比如「谁能来 → 商品 → 确认 → 下单」十几条一起丢），
   剩下的仍然远超 30，照样印「✓ 动线全通」。
   这是全仓唯一防「验证脚本自己没跑」的护栏，而它的倍率差了十倍。

   门槛跟着【这一档实际该跑多少】走，各留一成余量：
     · 假服务端：整条真链挂在「有真后端」上，只跑得到前端那一侧
     · 真后端：匿名登录 → 扫御守入住 → 问签 → 进屋，全链
   改断言数的时候这两个数要跟着改 —— 它们是账，不是魔法数。

   【但「要人记得改」本身就是个洞】（2026-09-02 第四轮评审 · 工程审计）。
   这两个数自从写下就没动过：实跑已经是 130 / 379，而账上还是 111 / 323。
   也就是说两档各能凭空少掉 31 条（24%）和 85 条（23%）仍然印「动线全通」——
   护栏的量级已经回到了它当初要防的那次事故的水平。

   所以除了对账，再加一条【反向】的：实跑数比账高出一成以上时也报出来，
   要求把账更新。它不拦（多验不是错），但它让账不会再悄悄过期。 */
/* 【三档，不是两档】（2026-09-03 五路评审 · 门禁审计）。

   上一版只分「假服务端 / 真后端」两档，而真后端那一档的账（385）
   是【带排盘服务】跑出来的数 —— 建本命那一段有十七条断言全挂在
   `if (API && MINGLI)` 里。没有排盘服务时那十七条一条都不跑，
   实跑 368，而下限是 floor(385×0.9)=346：**整整一段静静地没跑，
   而屏上印的是「动线全通」**。

   十七比三百八十五小，所以它藏在一成松量底下 —— 这正是「按总数判」
   的通病：一整段消失，总数只掉了一点点。
   分成三档之后，每一档的账对的是【那一档实际该跑的条数】。 */
// 三档的数都是【实测】的，不是从另一档减出来的：
// 2026-09-03 同一台机器上分别跑了三趟 —— 假 130 / 真 358 / 真带排盘 384。
// 建本命那一段是 26 条，不是当初以为的 17 条。
/* 「真带排盘」这一档 2026-09-06 第十次改，502 → 505（实跑）——
   徽章那一路加了三条（问签也算数 / 屏上写得出还差多少 / 那条路指最容易的一枚）。 */
/* 「真带排盘」这一档 2026-09-06 第九次改，501 → 502（实跑）——
   商品屏多档那一段的一条判据换成了两条（大价钱撤了 / 牌上名价都在）。 */
/* 「真带排盘」这一档 2026-09-06 第八次改，496 → 501（实跑）——
   退款那一路加了 5 条（申请完看得见 / 有单号 / 不给第二颗按钮 /
   只建一张 / 数字内容说清为什么退不了）。 */
/* 「真带排盘」这一档 2026-09-06 第七次改，485 → 496（实跑）——
   「收钱那一屏不许瞒着自动续费」5 条、「一件东西有几档就摆几档」6 条。 */
/* 「真带排盘」这一档 2026-09-06 第六次改，476 → 485（实跑）——
   「要去一场活动的人」（整屏此前一条断言都没有）加 6 条，
   「不再续了」那颗按钮真按一次加 3 条。 */
/* 「真带排盘」这一档 2026-09-06 第五次改，472 → 476（实跑）——
   「要退款的人」那一段加了 4 条（那颗按钮此前一次都没被按过）。 */
/* 「真带排盘」这一档 2026-09-05 第四次改，468 → 472（实跑）——
   「买过很多东西的人」那一段加了 4 条（翻页翻不翻得到第五页）。 */
/* 「真带排盘」这一档 2026-09-05 第三次改，454 → 468（实跑）——
   注销账号那一屏与它那一段 API 走查加了 14 条。 */
/* 「真带排盘」这一档 2026-09-05 再从 429 改成 454（实跑）——
   「手里的券」那一屏与结账页那格券条加了 25 条断言，
   上一版记的 429 是加它们之前那一趟量的。
   下面这段讲的是 386 → 429 那一次，道理一样。 */
/* 「真带排盘」这一档 2026-09-05 从 386 改成 429（实跑）。
   下限是 `该有 × 0.9`，所以账落后的时候下限跟着失效 ——
   386 那个账对应的下限是 347，而这一档真实规模已经是 429:
   凭空少掉八十条仍然报「全通」。
   另外两档没有在这一轮实测过，不动 —— 改一个没量过的数，
   等于把「下限」变成「我猜的数」。 */
const 基准 = { 假: 132, 真: 360, 真带排盘: 505 }
// 名字不叫 `档`：978 行有个同名的局部变量（村民稀有度），
// 两个都在这个文件里，读起来会以为是同一个东西
const 这一档 = !API ? '假' : (MINGLI ? '真带排盘' : '真')
const 该有 = 基准[这一档]
const LEAST = Math.floor(该有 * 0.9)

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
/* 孤儿名单从台账读，不在这里另抄一份。
   **参数名要抹掉再比**:台账里写的是 `/v1/payments/:x`,路由上是 `:id` ——
   两边指同一条路，照字面比就对不上，然后它常驻在「没打过」那一行里。 */
const 抹参 = (path) => path.replace(/:[a-z_]+/g, ':x')
const 孤儿 = new Set(Object.keys(
  JSON.parse(readFileSync('scripts/orphan-routes.json', 'utf8'))['后端有前端没人调']['小程序 → unmei-api'] || {},
).map(抹参))
/* 另一节：封装在、没有页面用它。台账那里按【封装名】记，
   所以这里把它对应的那条路由列出来 —— 一行一条，理由仍旧在台账。
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
  /* 孤儿：后端有、没有任何客户端调它。理由不在这里重写一遍 ——
     它们各自记在 `scripts/orphan-routes.json` 里，那份台账自己有门禁守着。
     从那里读，两处才不会分头漂。 */
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


/* ── 冷启动那两条，放在最后 ─────────────────────────────────────
   它们各开一个 context 且【不 close】(close 会把主页面一起带走),
   而不 close 的 context 会拖垮后面的主流程 —— 实测：放在开头时
   主流程跑 28 条就崩，旁路掉能跑 203 条。放到最后，两个毛病都躲开。

   放最后不影响它们要验的东西：窗口是【注入延迟】造出来的，
   不靠「浏览器还冷」。 */
/* ── 冷启动那一下，登录不许被自己人清掉 ───────────────────────
   （SKIP_COLD=1 可临时旁路 —— 用来定位它跟主流程的相互影响） 
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
if (API && !process.env.SKIP_COLD) {
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
    /* **不 close 这个 context。** 关它会把主页面一起带走 ——
       随后主流程第一个 open() 报「browser has been closed」，
       而报出来的位置在 open 里，看着像那一页的问题。
       脚本结束时 browser.close() 会一并收走，泄漏不了多久。 */
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
if (API && !process.env.SKIP_COLD) {
  const 新2 = await b.newContext({ viewport: { width: 375, height: 667 } })
  const 冷2 = await 新2.newPage()
  await 冷2.addInitScript((base) => { globalThis.__API_BASE = base }, API)
  // 把登录拖慢，保证页面那一次取数【一定】赶在 token 前面
  await 冷2.route('**/v1/auth/anonymous', async (r) => {
    await new Promise((res) => setTimeout(res, 700))
    await r.continue()
  })
  try {
    await 冷2.goto(BASE + '/index.html?' + new URLSearchParams({ page: 'pages/badges/index' }))
    // 等到登录落地之后再看：重取该在这之后发生
    await 冷2.waitForTimeout(2500)
    const 屏 = await 冷2.evaluate(() => {
      const d = globalThis.__router.current().data
      return { err: d.err || '', 还在转: !!d.loading, 有货: (d.items || []).length }
    }).catch((e) => ({ err: '问不到：' + String(e), 还在转: false, 有货: 0 }))
    ok(!屏.err && !屏.还在转,
       '登录慢的时候开一页，它等得到登录再取　—— 不是停在「取不到」',
       屏.err ? `停在错误态：${屏.err}` : (屏.还在转 ? '一直转着，没重取' : ''))
  } finally {
    // 同上：不 close，否则主页面跟着没
  }
}

console.log('')
console.log(`共验了 ${ran} 条`)
if (ran < LEAST) {
  console.log(`✗ 只验了 ${ran} 条，少于 ${LEAST}（${这一档} 这一档该有 ${该有}）`
    + ` —— 有整段没跑到，这时候的「全通」不算数`)
  failed++
}
/* 【账过期了也要说】。上限这一侧不拦 —— 多验不是错；
   但账一旦落后，下限就跟着失效，而那正是它悄悄发生过的事：
   账上 111/323，实跑 130/379，两档各能凭空少掉两成多仍报「全通」。 */
if (ran > Math.ceil(该有 * 1.1)) {
  console.log(`⚠ 实跑 ${ran} 条，而账上记的是 ${该有}（${这一档} 这一档）—— 把 verify.mjs 里的`
    + ` \`基准.${这一档}\` 改成 ${ran}，不然下限跟着一起过期`)
}
console.log(failed ? `✗ ${failed} 条不过` : '✓ 动线全通')
if (errs.length) console.log('页面错误：', [...new Set(errs)].slice(0, 5))
await b.close()
process.exit(failed ? 1 : 0)
