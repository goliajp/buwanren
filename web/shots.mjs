/* 逐页截屏 —— 0830 版打磨用的眼睛。
 *
 * `verify.mjs` 验的是「对不对」，这一支看的是「好不好看」。
 * 后者没法机检，只能一张一张看过去，所以要快:一条命令截完全部页面。
 *
 * 用法: bun web/shots.mjs [--api=...] [--out=/tmp/shots] [--only=village,invite]
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
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
  /* 【2026-09-01】还没请回来的那一位单独截一张。
     这一屏有两支:住着的看到「问问他」，没住的看到那颗要掏钱的
     「请他回村 · ¥99」。之前只截了住着的一支，于是**全屏唯一的付费
     按钮从来没被看过一眼** —— 五路评审是靠读代码发现它不写价的。
     丹增没种进上面那份住户名单，而他的御守在架上（sku.villager_id='tenz'）。 */
  ['villager-invite', 'pages/villager/index', { id: 'tenz' }],
  /* `dir` 跟真链一样带上 —— 扫开御守那一下 `唤醒()` 就是这么传的。
     不带的话截出来的脸是默认琥珀，而真机上是他自己的颜色:
     照片跟产品对不上，比没照片更误导。 */
  ['moved', 'pages/moved/index', { name: '婆婆', id: 'popo', n: '1', dir: 'near' }],
  ...(册 ? [['report', 'pages/report/index', { id: 册 }]] : []),
  ['confirm', 'pages/confirm/index', { id: 'prod-suhe-incense' }],
  ['product', 'pages/product/index', { id: 'prod-suhe-incense' }],
  /* 【御守那两屏也要截】。上面两条截的是香 —— 而香是【要寄】的那一种，
     它的确认屏有「寄到」「运费」两行，御守没有。只截香等于给御守
     那条主链路打了分（2026-09-01 第二轮评审 · 转化路把地址那道坎去掉了，
     而去掉之后长什么样，没有一张截图看得到）。
     商品 id 由跑的时候查库定，不写死:目录是多区域快照，id 会变。 */
  ['product-oma', 'pages/product/index', { id: '@御守' }],
  /* 玉那一件:它上架着，而 2026-09-02 之前全 app 走不到它。
     现在卢恩卖它（sku.villager_id），从名册点他进去就能到 —— 截一张看看它长什么样。 */
  ['product-jade', 'pages/product/index', { id: 'prod-jade-pendant' }],
  ['confirm-oma', 'pages/confirm/index', { id: '@御守' }],
  ['name', 'pages/name/index'],
  ['bind', 'pages/bind/index'],
  ['lighting', 'pages/lighting/index'],
  /* 六间房各拍一张。参数名是 `room` —— 写成 `id` 的话页面认不出来，
     会静默回落到默认那间(白鹭)，出一张看着完全正常的图：真房间、真人名、
     真按钮，没有任何地方会红。2026-08-31 之前这一屏拍到的一直是白鹭家，
     而我以为它拍的是阿云家。 */
  ['room-ayun', 'pages/room/index', { room: 'ayun' }],
  ['room-bailu', 'pages/room/index', { room: 'bailu' }],
  ['room-popo', 'pages/room/index', { room: 'popo' }],
  ['room-shenyan', 'pages/room/index', { room: 'shenyan' }],
  ['room-tao', 'pages/room/index', { room: 'tao' }],
  ['room-tenz', 'pages/room/index', { room: 'tenz' }],
  ...(单子 ? [['order', 'pages/order/index', { id: 单子 }]] : []),
  /* 两份文件各一张。它们【是唯一允许滚的两屏】—— 政策就是长，
     把它压进一屏等于把字压到读不动。所以下面那一支「一屏放得下」
     对它们不成立，也不该成立;截图仍然要拍，因为要看排版读不读得下去。 */
  ['policy-privacy', 'pages/policy/index', { kind: 'privacy' }],
  ['policy-terms', 'pages/policy/index', { kind: 'terms' }],
]

const 量 = {}
let n = 0
/* `@御守` 这种占位在跑的时候查库换成真 id —— 目录是多区域快照，
   写死 id 会在下一次重建目录之后指向一件不存在的商品，
   而那时截出来的是「取不到」那一屏，看着仍然像一张正常截图。 */
const 真id = (v) => {
  if (v !== '@御守') return v
  const id = sql1("SELECT p.id FROM product p JOIN sku k ON k.product_id=p.id"
    + " WHERE p.fulfillment_kind='residency' AND p.status='listed'"
    + " AND k.villager_id IS NOT NULL ORDER BY p.id LIMIT 1")
  if (!id) throw new Error('库里没有在售的御守商品 —— 御守那两屏截不成')
  return id
}
for (const [名, 路, q0] of 屏) {
  if (ONLY.length && !ONLY.includes(名)) continue
  const q = q0 && Object.fromEntries(Object.entries(q0).map(([k, v]) => [k, 真id(v)]))
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
  /* 【连量数一起留下】。评审读的是截图，而截图是 @2x 的 ——
     照着图上量出来的「115px」其实是 57.5 个 CSS 像素，据此下的结论全错
     （2026-08-31 真发生过:两条最狠的意见就是这么废掉的）。
     所以量在浏览器里做:CSS 像素、真的 innerText、这一屏滚不滚。 */
  量[名] = await p.evaluate((文) => {
    const 取 = (sel) => [...document.querySelectorAll(sel)].map((e) => {
      const r = e.getBoundingClientRect()
      return { 类: e.className, 文: (e.innerText || '').slice(0, 24),
               左: Math.round(r.left), 顶: Math.round(r.top),
               宽: Math.round(r.width), 高: Math.round(r.height) }
    })
    const doc = document.documentElement
    return {
      文,
      视口: { 宽: innerWidth, 高: innerHeight },
      要不要滚: doc.scrollHeight > doc.clientHeight + 1,
      内容高: doc.scrollHeight,
      按钮: 取('button'),
      主块: 取('.page > *, .hd, .acts, .cta, .empty-state'),
      /* 【点得到的东西有多大】。真机上手指的接触面约 9mm ——
         苹果与谷歌两家人机指南都写 44pt / 48dp。比这小就要瞄，
         而这个产品的用户是躺着单手点的。
         量的是【外接矩形】而不是 wxss 里那个声明值:padding、
         行高、flex 拉伸都会改变它，声明 26px 的东西实际可能是 40px，
         反过来也一样。记号由镜像运行时在绑 click 时打，见 wxml.js。 */
      可点: 取('[data-tap]'),
      /* 【字色与它真正压着的底】。解析 wxss 那一支有个够不着的地方:
         底色写在祖先上时，它只能如实报「没量」（实测 7 处）。
         而在这里，底色是【渲染完的事实】—— 往上走到第一个不透明的祖先，
         那就是这段字真正压着的颜色，罗盘中心那颗按钮也量得到。
         只收【自己直接带字】的元素:容器的 color 会被子元素盖掉，
         把它算进来就是在量一段没人看的颜色。 */
      /* 【钉在屏上的那几块，两两不许压着】。`position: fixed` 的块
         各自算各自的位置，谁也不知道谁多高 —— 确认屏上「付完会怎样」
         那一行拿 `bottom: 112rpx` 去躲成交栏，而成交栏实测 66px 高，
         下半截被压掉 10px，就在付款那一屏上（第三轮报过、第四轮两路
         各自又量到一次，靠人是挡不住的）。 */
      /* 【画布真的铺开了吗】。`<canvas>` 的 CSS 尺寸和它的【像素尺寸】
         是两回事:引擎挂上去才会把后者设成村子/屋子的真实大小。
         没挂上时它停在浏览器默认的 300×150 —— 屏上是一整块空白，
         而 `err` 是空的、没有任何东西会红。 */
      画布: [...document.querySelectorAll('canvas')].map((c) => {
        const r = c.getBoundingClientRect()
        return { 类: c.className, 像素: `${c.width}x${c.height}`,
                 屏上: `${Math.round(r.width)}x${Math.round(r.height)}` }
      }),
      钉住的: [...document.querySelectorAll('#app *')]
        .filter((e) => {
          const p = getComputedStyle(e).position
          return p === 'fixed' || p === 'sticky'
        })
        .map((e) => {
          const r = e.getBoundingClientRect()
          return { 类: e.className, 文: (e.innerText || '').slice(0, 18),
                   左: Math.round(r.left), 顶: Math.round(r.top),
                   宽: Math.round(r.width), 高: Math.round(r.height) }
        })
        .filter((x) => x.宽 > 0 && x.高 > 0),
      字: (() => {
        const 不透明 = (c) => c && c !== 'transparent' && !/rgba\(0,\s*0,\s*0,\s*0\)/.test(c)
        const 出 = []
        for (const e of document.querySelectorAll('#app *')) {
          const 直接 = [...e.childNodes]
            .filter((n) => n.nodeType === 3 && n.textContent.trim())
            .map((n) => n.textContent.trim()).join('')
          if (!直接) continue
          const cs = getComputedStyle(e)
          let p = e, 底 = null
          while (p && p !== document.documentElement) {
            const b = getComputedStyle(p).backgroundColor
            if (不透明(b)) { 底 = b; break }
            p = p.parentElement
          }
          const r = e.getBoundingClientRect()
          if (r.width < 1 || r.height < 1) continue
          出.push({ 类: e.className, 文: 直接.slice(0, 18),
                    字色: cs.color, 底色: 底 || 'none',
                    字号: parseFloat(cs.fontSize), 粗细: cs.fontWeight })
        }
        return 出
      })(),
    }
  }, 文)
  const 坏 = /取不到|失败|出错|unauthorized/.test(文)
  console.log(`  ${坏 ? '⚠' : '·'} ${名.padEnd(9)} ${OUT}/${名}.png${坏 ? '　← 停在错误态' : ''}`)
  n++
}
/* 一页索引 —— 截出来的图散在一个目录里，验收的时候得一张张开。
   排成一页就能横着翻，也看得出哪几屏挨在一起是什么感觉。
   写成本地文件，`open` 打开就是（这个项目不产出外链）。 */
writeFileSync(join(OUT, 'measure.json'), JSON.stringify(量, null, 1))
/* 【要滚的屏，每次都说出来】。measure.json 里一直记着这件事，
   可没人会去读它。动线那一支的容差是 8px（给亚像素舍入留的），
   而 2026-09-01 名册超了 6px —— 从那个容差底下溜过去，
   是这一份实测数据翻出来的。数据在没人看等于没量。 */
{
  /* 政策那两屏不进这一账。它们是文件，长是本分 —— 把它们算进来
     只会逼人把条款塞进一屏，而那正是「不想让人读」的做法。
     写成明确的白名单，不是悄悄跳过:名单在这儿，谁都看得见。 */
  const 允许滚 = new Set(['policy-privacy', 'policy-terms'])
  const 滚的 = Object.entries(量).filter(([k, v]) => v.要不要滚 && !允许滚.has(k))
  if (滚的.length) {
    console.log('\n  ⚠ 这几屏一屏放不下（超出多少）：')
    for (const [名, v] of 滚的) console.log(`      ${名}　超 ${v.内容高 - v.视口.高}px`)
  } else {
    /* 【数出来的，不是写死的】。这里原先写死一句「28 屏都一屏放得下」——
       而屏的条数是会变的:同一天加了御守那两屏之后，它照旧报 28，
       等于把新加的两屏算进了一句它没量过的结论
       （2026-09-01 第二轮评审那一轮自己撞上的）。 */
    /* 【减的是这一趟里真出现的那几个，不是白名单全集】。
       `--only=invite,village` 只截两屏，而白名单里有两条 ——
       减完是 0，屏上写着「0 屏都一屏放得下」（2026-09-02）。
       又一处「印出来的数不是数出来的」。 */
    const 这趟豁免 = Object.keys(量).filter((k) => 允许滚.has(k)).length
    const 屏数 = Object.keys(量).length - 这趟豁免
    console.log(`\n  · ${屏数} 屏都一屏放得下`
      + (这趟豁免 ? `（政策那 ${这趟豁免} 屏本就该滚，不计）` : ''))
  }
}
{
  const 图 = readdirSync(OUT).filter((f) => f.endsWith('.png')).sort()
  const 卡 = 图.map((f) => `<figure><img src="./${f}" loading="lazy"><figcaption>${f.replace(/\.png$/, '')}</figcaption></figure>`).join('\n')
  writeFileSync(join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8">
<title>不完人 · ${图.length} 屏</title>
<style>
  body { margin:0; padding:24px; background:#1a1712; color:#e8e0d4;
         font:14px/1.6 -apple-system,"PingFang SC",sans-serif }
  h1 { font-size:20px; font-weight:600; margin:0 0 4px }
  .sub { color:#8a8177; margin-bottom:24px }
  .grid { display:flex; flex-wrap:wrap; gap:20px; align-items:flex-start }
  figure { margin:0; width:250px }
  img { width:100%; border-radius:10px; display:block; background:#fdf9f0;
        box-shadow:0 4px 20px rgba(0,0,0,.4) }
  figcaption { margin-top:8px; color:#b5aa9a; font-size:13px; text-align:center }
</style>
<h1>不完人 · 0830</h1>
<div class="sub">${图.length} 张 · ${new Date().toLocaleString('zh-CN')}${API ? ' · 打的真后端' : ' · 假服务端'}</div>
<div class="grid">
${卡}
</div>`)
  console.log(`\n一页看完：open ${join(OUT, 'index.html')}`)
}

console.log(`截了 ${n} 张 → ${OUT}`)
await b.close()
收工()
