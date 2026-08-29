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
import { execFileSync } from 'child_process'

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=').slice(1).join('=')
const API = arg('api', '')
const OUT = arg('out', '/tmp/shots')
const ONLY = arg('only', '').split(',').filter(Boolean)
const BASE = arg('base', 'http://127.0.0.1:6031')
mkdirSync(OUT, { recursive: true })

const sql1 = (q) => String(execFileSync('docker',
  ['exec', 'unmei-postgres', 'psql', '-U', 'unmei', '-d', 'unmei', '-tAc', q], { stdio: 'pipe' })).trim()

const b = await chromium.launch({ channel: 'chrome' })
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
  ...(单子 ? [['order', 'pages/order/index', { id: 单子 }]] : []),
]

let n = 0
for (const [名, 路, q] of 屏) {
  if (ONLY.length && !ONLY.includes(名)) continue
  await 去(路, q)
  await p.screenshot({ path: join(OUT, `${名}.png`) })
  const 文 = await p.evaluate(() => (document.querySelector('#app') || {}).innerText || '')
  const 坏 = /取不到|失败|出错|unauthorized/.test(文)
  console.log(`  ${坏 ? '⚠' : '·'} ${名.padEnd(9)} ${OUT}/${名}.png${坏 ? '　← 停在错误态' : ''}`)
  n++
}
console.log(`\n截了 ${n} 张 → ${OUT}`)
await b.close()
