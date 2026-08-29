/* 逐页截屏 —— 0830 版打磨用的眼睛。
 *
 * `verify.mjs` 验的是「对不对」，这一支看的是「好不好看」。
 * 后者没法机检，只能一张一张看过去，所以要快:一条命令截完全部页面。
 *
 * 用法: bun web/shots.mjs [--api=...] [--out=/tmp/shots] [--only=village,invite]
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { execFileSync, execFile, spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
const 根 = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=').slice(1).join('=')
const API = arg('api', '')
const OUT = arg('out', '/tmp/shots')
const ONLY = arg('only', '').split(',').filter(Boolean)
mkdirSync(OUT, { recursive: true })

/* 服务器自己起、自己收。
   原先是「先在别处起一个 6031，再跑这一支」—— 于是那个服务留在那儿，
   而 `web/run-verify.sh` 要的也是 6031。它看见口被占着就整支退出，
   在总账上跟「动线真的断了」长得一模一样：连着报红，失败账却是空的
   （一条断言都没跑到）。08-30 为这个丢了一轮，去查了机器负载。
   一次性的东西就不该留在世界上过夜。 */
const 空口 = () => {
  for (const p of [6051, 6052, 6053, 6054, 6055]) {
    try { execFileSync('lsof', ['-nP', `-iTCP:${p}`, '-sTCP:LISTEN'], { stdio: 'ignore' }) } catch { return p }
  }
  throw new Error('6051-6055 全被占着 —— 腾一个出来，或者 --base= 指一个现成的')
}
let 服务 = null
let BASE = arg('base', '')
if (!BASE) {
  /* 仓库根按【这个文件在哪】算，不按调用方的工作目录 ——
     从 rooms/ 跑的时候 cwd 是 rooms，`web/build.mjs` 根本不在那儿。
     错也原样抛出去：包一句「组装失败」而把真因吞掉，等于把线索删了。 */
  await new Promise((r, j) => execFile('bun', ['web/build.mjs'], { cwd: 根 },
    (e, so, se) => (e ? j(new Error('组装失败：\n' + (se || so || e.message))) : r())))
  const 口 = 空口()
  服务 = spawn('python3', ['-m', 'http.server', String(口), '--directory', 'web/dist'],
    { stdio: 'ignore', detached: false, cwd: 根 })
  BASE = `http://127.0.0.1:${口}`
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(BASE + '/index.html')).ok) break } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
}
const 收工 = () => { if (服务) { try { 服务.kill() } catch {} 服务 = null } }
process.on('exit', 收工)
process.on('SIGINT', () => { 收工(); process.exit(130) })

const sql1 = (q) => String(execFileSync('docker',
  ['exec', 'unmei-postgres', 'psql', '-U', 'unmei', '-d', 'unmei', '-tAc', q], { stdio: 'pipe' })).trim()

/* 用 Playwright 自带的 chromium，【不要】装机版 Chrome。
   08-30 实测：`channel: 'chrome'` 拉起来的进程活二三十秒就挨 SIGKILL ——
   不是崩（没有崩溃报告）、也不是内存（当时空着 67%）。同一台机器同一份页面，
   自带 chromium 连跑 30 轮 46 秒无事，装机版 22 轮就没。差别只有这一个开关。
   机器上跑着 GoogleUpdater，而它更新时会清掉所有共用那个 app bundle 的实例。
   症状很难认：门禁连着报红，而失败账是空的（一条断言都没红），
   于是「跑不完」跟「动线断了」在总账上长得一模一样。
   验证工具本来就不该押在用户那份浏览器上 —— 自带的这份就是为可复现装的。 */
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 })
if (API) await p.addInitScript((x) => { globalThis.__API_BASE = x }, API)

const 去 = async (route, q) => {
  await p.goto(BASE + '/index.html?' + new URLSearchParams(Object.assign({ page: route }, q || {})))
  await p.waitForFunction(() => globalThis.__READY === true, null, { timeout: 15000 }).catch(() => {})
  await p.waitForTimeout(2000)
}

// 打真后端时先热一下、拿到 token，否则截出来全是「取不到」
if (API) {
  for (let i = 0; i < 20; i++) {
    try { if ((await fetch(API + '/v1/auth/anonymous', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).ok) break } catch {}
    await new Promise((r) => setTimeout(r, 400))
  }
  await 去('pages/village/index')
  for (let i = 0; i < 40; i++) {
    if (await p.evaluate(() => !!localStorage.getItem('unmei:buwanren:token')).catch(() => false)) break
    await p.waitForTimeout(300)
  }
  // 种几位住着的 + 一张单，好让屏上有真东西
  const uid = await p.evaluate(() => JSON.parse(localStorage.getItem('unmei:buwanren:user') || '{}').id)
  if (uid) {
    for (const who of ['popo', 'ayun', 'shenyan']) {
      try { sql1(`INSERT INTO villager_residency(id,user_id,villager_id,source_kind) VALUES ('res-shot-${uid.slice(-6)}-${who}','${uid}','${who}','grant') ON CONFLICT DO NOTHING`) } catch {}
    }
  }
}

const 单子 = API ? await p.evaluate(async (base) => {
  const t = JSON.parse(localStorage.getItem('unmei:buwanren:token') || 'null')
  if (!t) return null
  const r = await fetch(base + '/v1/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t, 'idempotency-key': 'shot-' + Math.random() },
    body: JSON.stringify({ lines: [{ sku_id: 'sku-naji-deep', qty: 1 }], region: 'cn' }),
  })
  return r.ok ? (await r.json()).order_id : null
}, API) : null

/* 那一册要有真内容才看得出好坏 —— 六页盘面是这一屏的全部。
   跟 verify 同一个路子:把册子种进库，页面照样走真的 /v1/reports/:id，
   跳过的只有「付钱」那一跳（那只有真机有）。 */
let 册 = null
if (API && 单子) {
  try {
    const uid = sql1(`SELECT user_id FROM order_record WHERE id='${单子}'`)
    const 盘 = sql1(`SELECT natal_id FROM natal_summary WHERE raw_chart IS NOT NULL LIMIT 1`)
    const line = sql1(`SELECT id FROM order_line WHERE order_id='${单子}' LIMIT 1`)
    if (uid && 盘 && line) {
      const rid = 'rpt-shot-' + Math.random().toString(36).slice(2, 10)
      sql1(`INSERT INTO report (id,user_id,order_line_id,kind,status,natal_id,
              natal_snapshot_json,chart_json,mingli_version,ready_at)
            SELECT '${rid}','${uid}','${line}','bazi_deep','ready',s.natal_id,
              jsonb_build_object('label','我','year',1998,'month',3,'day',5,'hour',14,'minute',30,'birth_city','成都'),
              s.raw_chart, s.mingli_version, NOW()
            FROM natal_summary s WHERE s.natal_id='${盘}'
            ON CONFLICT (order_line_id) DO NOTHING`)
      册 = sql1(`SELECT id FROM report WHERE order_line_id='${line}'`) || null
    }
  } catch (e) { console.log('  · 种不出册子：', String(e).slice(0, 60)) }
}

const 屏 = [
  ['village', 'pages/village/index'],
  ['home', 'pages/home/index'],
  ['me', 'pages/me/index'],
  ['invite', 'pages/invite/index'],
  ['ask', 'pages/ask/index'],
  ['natal', 'pages/natal/index'],
  ['orders', 'pages/orders/index'],
  ['badges', 'pages/badges/index'],
  ['subs', 'pages/subs/index'],
  ['incense', 'pages/incense/index'],
  ['settings', 'pages/settings/index'],
  ['plot', 'pages/plot/index', { id: '7' }],
  ['villager', 'pages/villager/index', { id: 'popo' }],
  /* `dir` 跟真链一样带上 —— 扫开御守那一下 `唤醒()` 就是这么传的。
     不带的话截出来的脸是默认琥珀，而真机上是他自己的颜色:
     照片跟产品对不上，比没照片更误导。 */
  ['moved', 'pages/moved/index', { name: '婆婆', id: 'popo', n: '1', dir: 'near' }],
  ...(册 ? [['report', 'pages/report/index', { id: 册 }]] : []),
  ['confirm', 'pages/confirm/index', { id: 'prod-suhe-incense' }],
  ['product', 'pages/product/index', { id: 'prod-suhe-incense' }],
  ['name', 'pages/name/index'],
  ['bind', 'pages/bind/index'],
  ['lighting', 'pages/lighting/index'],
  ['room', 'pages/room/index', { id: 'ayun' }],
  ...(单子 ? [['order', 'pages/order/index', { id: 单子 }]] : []),
]

let n = 0
for (const [名, 路, q] of 屏) {
  if (ONLY.length && !ONLY.includes(名)) continue
  await 去(路, q)
  await p.screenshot({ path: join(OUT, `${名}.png`) })
  /* 那一册有六页，一张截图只看得到第一页 —— 而用神与大运在后面。
     翻过去各截一张:看不到的地方等于没打磨过。 */
  if (名 === 'report') {
    const 页数 = await p.evaluate(() => (globalThis.__router.current().data.tabs || []).length).catch(() => 0)
    for (let i = 1; i < 页数; i++) {
      await p.evaluate((k) => globalThis.__router.current().show(k), i)
      await p.waitForTimeout(400)
      const 名字 = await p.evaluate(() => (globalThis.__router.current().data.page || {}).key || 'p')
      await p.screenshot({ path: join(OUT, `report-${i}-${名字}.png`) })
    }
  }
  const 文 = await p.evaluate(() => (document.querySelector('#app') || {}).innerText || '')
  const 坏 = /取不到|失败|出错|unauthorized/.test(文)
  console.log(`  ${坏 ? '⚠' : '·'} ${名.padEnd(9)} ${OUT}/${名}.png${坏 ? '　← 停在错误态' : ''}`)
  n++
}
console.log(`\n截了 ${n} 张 → ${OUT}`)
await b.close()
收工()
