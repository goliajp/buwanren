/* 逐步走一遍，每一步都截图 —— 「体验」而不是「看页面」。
 *
 * `shots.mjs` 是【每一屏各来一张】，它先把两位村民种进去再截 ——
 * 于是最要紧的那一屏（第一次打开、村里一个人都没有）从来没被看过。
 * 这一支反过来:从一个【全新的匿名用户】起步，照真实动线一步一步走，
 * 每按一下就截一张，文件名带序号，看的时候顺着号就是那个人的经历。
 *
 * 用法: bun web/walk.mjs [--api=...] [--out=/tmp/walk]
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { execFile, execFileSync, spawn } from 'child_process'

const 根 = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=').slice(1).join('=')
const API = arg('api', 'http://127.0.0.1:6028')
const OUT = arg('out', '/tmp/walk')
mkdirSync(OUT, { recursive: true })

const 空口 = () => {
  for (const p of [6061, 6062, 6063, 6064, 6065]) {
    try { execFileSync('lsof', ['-nP', `-iTCP:${p}`, '-sTCP:LISTEN'], { stdio: 'ignore' }) } catch { return p }
  }
  throw new Error('6061-6065 全被占着')
}
await new Promise((r, j) => execFile('bun', ['web/build.mjs'], { cwd: 根 }, (e, so, se) => (e ? j(new Error(String(se || so))) : r())))
const 口 = 空口()
const 服务 = spawn('python3', ['-m', 'http.server', String(口), '--directory', 'web/dist'], { stdio: 'ignore', cwd: 根 })
const BASE = `http://127.0.0.1:${口}`
for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/index.html')).ok) break } catch {} await new Promise((r) => setTimeout(r, 250)) }

const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 })
const p = await c.newPage()
await p.addInitScript((x) => { globalThis.__API_BASE = x }, API)

let n = 0
const 账 = []
/** 截一张，并把屏上的字记下来 —— 图看气质，字看有没有说人话 */
const 拍 = async (说明) => {
  n++
  const 号 = String(n).padStart(2, '0')
  const 名 = `${号}-${说明.replace(/[^一-龥A-Za-z0-9]+/g, '-')}`
  await p.screenshot({ path: join(OUT, 名 + '.png') })
  const 文 = (await p.evaluate(() => (document.getElementById('app') || {}).innerText || '')).replace(/\s+/g, ' ').trim()
  const 路 = await p.evaluate(() => (globalThis.__router && globalThis.__router.current() || {}).__route || '')
  const 坏 = /取不到|失败|出错|unauthorized|not found|Error/.test(文)
  账.push({ 号, 说明, 路, 坏, 文: 文.slice(0, 200) })
  console.log(`  ${坏 ? '⚠' : '·'} ${号} ${说明.padEnd(16)} ${路}`)
  if (坏) console.log(`       ← ${文.slice(0, 90)}`)
}
const 开 = async (route, q) => {
  await p.goto(BASE + '/index.html?' + new URLSearchParams(Object.assign({ page: route }, q || {})))
  await p.waitForFunction(() => globalThis.__READY === true, null, { timeout: 15000 }).catch(() => {})
  await p.waitForTimeout(1800)
}
/* 按字找，不要求逐字相同 —— 屏上那一条常带着「›」，
   而写死带箭头的字符串会让这支走查跟着文案一起脆。 */
const 点 = async (字) => {
  await p.getByText(字, { exact: false }).first().click({ timeout: 8000 })
  await p.waitForTimeout(1500)
}

console.log('\n── 一个新来的人，从零开始 ──')
await 开('pages/village/index')
await 拍('第一次打开')
await 点('看看谁能来');            await 拍('看看谁能来')
await 开('pages/village/index'); await 点('填出生时间'); await 拍('先填生辰')
await 开('pages/natal/index');   await 拍('生辰这一屏')
/* 真的填一遍再按下去。picker 在浏览器里是 <input type=date/time>，
   直接 fill 会触发 change，跟真机上选完一样。
   不走这一步的话，后面全部「有本命」的分支都验不到 —— 而真实用户
   在「还没建本命」那个状态里只待一分钟。 */
await p.locator('input[type=date]').first().fill('1998-03-05')
await p.locator('input[type=time]').first().fill('14:30')
await 点('女')
await 拍('填好了')
await 点('算一算')
await p.waitForTimeout(3000)
await 拍('算完')
await 开('pages/home/index');    await 拍('我家')
await 开('pages/me/index');      await 拍('我的')

/* 核心那一圈:转一下 → 看结果。这是这个产品每天要用的那条路，
   而它的落点（问出来的那一段话）此前一次都没被看过。 */
await 开('pages/home/index')
await 点('问一件事')
await p.waitForTimeout(4000)
await 拍('转完了')
await 开('pages/ask/index'); await 拍('今天这一次')
await 开('pages/invite/index');  await 拍('名册·填过生辰之后')
/* 这一页一位都请不动时的出路。它只在真卡住时出现 ——
   出现了就按下去，因为那正是这个人此刻唯一按得动的东西。 */
if (await p.getByText('只看现在能请的').count()) {
  await 点('只看现在能请的'); await 拍('只看能请的')
}
await 点('请回家');             await 拍('点一位能请的')

/* 买下去那一段。走到「去付」为止 —— 掏钱只有真机有（垫片会抛），
   而在那之前的每一步都是网页版验得了的。 */
/* 点【按钮】而不是眉标。`点()` 用的是子串匹配，写「请」会先命中
   顶上那行眉标「请回家」—— 于是这一步看着走过了，其实原地没动。 */
await p.locator('button.btn').filter({ hasText: '回家' }).first().click()
await p.waitForTimeout(1200); await 拍('确认这一单')
if (await p.getByText('去付').count()) { await 点('去付'); await p.waitForTimeout(1500); await 拍('一单') }

/* 剩下几屏各来一张 —— 这几屏没有前置状态，直接开。 */
for (const [名, 路, q] of [
  ['我得到的', 'pages/badges/index', null],
  ['订着的', 'pages/subs/index', null],
  ['我买过的', 'pages/orders/index', null],
  ['设置', 'pages/settings/index', null],
  ['绑定微信', 'pages/bind/index', null],
  ['名字', 'pages/name/index', null],
  ['一味香', 'pages/incense/index', { id: 'prod-suhe-incense' }],
  ['空屋', 'pages/plot/index', { plot: 'p12' }],
]) { await 开(路, q); await 拍(名) }

writeFileSync(join(OUT, '账.json'), JSON.stringify(账, null, 2))
const 坏 = 账.filter((x) => x.坏)
console.log(`\n走了 ${n} 步 → ${OUT}` + (坏.length ? `\n⚠ ${坏.length} 步停在错误态：` + 坏.map((x) => x.号).join(' ') : '\n没有一步停在错误态'))
await b.close(); 服务.kill()
