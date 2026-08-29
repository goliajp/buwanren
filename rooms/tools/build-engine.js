#!/usr/bin/env bun
/**
 * build-engine —— 产出**不含设计页**的引擎,给小程序 / H5 用(台账 D2)
 *
 * `design.html` 是给人看的设计册,里面有 B0–B12 正文、角色表、村子俯瞰图。
 * 小程序只要引擎与素材,不要那 1.6MB 的册子。
 *
 * 产物 `rooms/dist/engine.js`:
 *   - 素材库(401 件)+ 角色 + 渲染管线 + 校验 + 布局辅助
 *   - 挂在 `globalThis` 上,不碰 `window`、不碰 `document`
 *   - 唯一的宿主依赖是 `ENGINE_HOST.createCanvas(w, h)`,默认实现给浏览器,
 *     小程序侧覆盖成 `wx.createOffscreenCanvas({ type:'2d', width:w, height:h })`
 *
 * **不含**:房间数据与页面驱动。房间脚本里那 3 行 DOM/rAF 是宿主的事,
 * 剩下的(plan / acts / perform)是数据与逻辑,由调用方按宿主的方式加载。
 *
 * 判据不是「能构建出来」,是**在没有浏览器的环境里渲得一模一样**:
 * 设计页渲一遍,产物在 **Web Worker** 里渲一遍,像素必须逐字节相同。
 *
 * 为什么是 Worker 而不是普通页面 —— 页面里 document 与 window 都在,产物渲染时
 * 顺手摸一下也照样绿,而小程序里它们一个都没有。Worker 没有 document、
 * 没有 window,有 globalThis 与 OffscreenCanvas,是手边最接近小程序的环境。
 * 见 `verify` 模式。
 *
 * 用法:bun tools/build-engine.js            产出 dist/engine.js
 *      bun tools/build-engine.js verify     产出并验证渲染一致
 *      ... verify --page=<html>              比对指定的设计页(变异测试用)
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto')

/* 关 GPU。**GPU 光栅化本身不确定** —— 同一串绘制指令出来的像素会在几个值之间跳
   (2026-08-17 在村子静态层上实测定位,详见 .roomwork/ENGINE-GAPS.md)。
   这支工具的判据就是「两边的像素一模一样」,后端飘一点它就废了。
   --allow-file-access-from-files:村子的贴图是 file:// 来的真 PNG,不加这条
   画过它的画布算被跨源污染,getImageData 直接抛。 */
const LAUNCH_ARGS = ['--allow-file-access-from-files', '--disable-gpu']

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')
const OUT = path.join(ROOT, 'dist', 'engine.js')
const MODE = process.argv[2] || 'build'
// 拿来比对的设计页。默认是仓库里那份;变异测试要指向被植入缺陷的副本,
// 否则这支工具自己没法被验证「报不报得出红」。
const PAGE = (process.argv.find(a => a.startsWith('--page=')) || '').slice(7)
  || path.join(ROOT, 'design.html')

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'))

// 引擎那一段就是 manifest 里文件最多的那个 part(素材库 + 引擎同处一个 IIFE)。
// 按「文件数最多」认而不是按下标认 —— 下标会随 manifest 变,文件数不会。
const part = manifest.parts
  .filter(p => p.files && p.files.length > 1)
  .sort((a, b) => b.files.length - a.files.length)[0]
if (!part) { console.error('✗ manifest 里找不到引擎那个 part'); process.exit(1) }

// 设计页专用的三支不进产物:它们造 div/td、读 canvas 元素
const PAGE_ONLY = new Set(['engine/asset-table.js', 'engine/pose-sheet.js', 'engine/village.js'])

// 已经拆干净、能离开浏览器的房间。**这份清单就是账本** ——
// 一间房只有在这里出现、并且在 Worker 里渲得与设计页一模一样,才算真的能上小程序。
// 拆一间加一行,不拆的不许加(加了当场红,因为它的脚本一加载就去摸 document)。
const PORTABLE_ROOMS = [
  { id: 'BAILU_ROOM', srcs: ['rooms/bailu.js'] },
  { id: 'TENZ_ROOM', srcs: ['rooms/tenz.js'] },
  { id: 'SHENYAN_ROOM', srcs: ['rooms/shenyan.js'] },
  { id: 'POPO_ROOM', srcs: ['rooms/popo.js'] },
  { id: 'TAO_ROOM', srcs: ['rooms/tao.js'] },
  // 阿云的布局单独在 ayun-plan.js 里,一间房不止一支源文件
  { id: 'AYUN_ROOM', srcs: ['rooms/ayun-plan.js', 'rooms/ayun.js'] },
]
const files = part.files.filter(f => !PAGE_ONLY.has(f))

// ── 烘焙角色精灵 ───────────────────────────────────────────────────
// 角色的四向图存在设计页的 `CODEX` 里(`bible/charsheet.js`),而引擎的
// `defineActor` 在加载时就要用它 —— 没有它会直接抛「规范里没有这个角色的图」。
//
// 所以产物必须自带一份。做法照 `scripts/export-cast.py`:**单一来源仍是设计册**,
// 产物是从它派生出来的,不另抄一份会漂移的。66KB,对包体无压力。
async function bakeCodex() {
  const { chromium } = require('playwright')
  /* 自带的 chromium，不用装机版 Chrome —— 后者在这台机器上跑二三十秒就挨 SIGKILL
     （08-30 实测，见 docs/FINDING-2026-08-30-chrome-sigkill.md）。
     `regress.js` 是例外:它的基准哈希绑着浏览器，换一个就得重存，
     而那份基准记着 12 处已知漂移与存基准时的 commit，比这点稳定性值钱。 */
  const b = await chromium.launch({ args: LAUNCH_ARGS })
  const p = await b.newPage()
  await p.goto('file://' + path.resolve(PAGE))
  await p.waitForTimeout(3500)
  const codex = await p.evaluate(() => globalThis.CODEX || null)
  await b.close()
  if (!codex) throw new Error('设计页里没有 CODEX —— 烘不出角色图')
  const n = Object.values(codex).reduce((t, v) => t + Object.keys(v || {}).length, 0)
  console.log(`  烘焙角色图:${Object.keys(codex).join(' / ')} 共 ${n} 条`)
  return codex
}

// 宿主适配:共用那一支 + 两个平台各一支,拼成一个文件。
// 两支平台各自带守卫(小程序里没有 document,浏览器里没有 wx.createOffscreenCanvas),
// 所以同一个文件在两边都能加载,各认各的 —— 页面因此不必分两种写法,
// 而「两边跑的是同一个宿主文件」正是这套镜像的立足点。
const hostJs = ['mount.js', 'wx.js', 'web.js']
  .map((f) => fs.readFileSync(path.join(ROOT, 'host', f), 'utf8'))
  .join('\n;\n')

const banner = `/* 由 rooms/tools/build-engine.js 生成,不要手改。
   源码在 rooms/src/,改完重新生成。

   宿主只需提供一件事 —— 怎么造一张离屏画布:
     ENGINE_HOST.createCanvas = (w, h) =>
       wx.createOffscreenCanvas({ type: '2d', width: w, height: h })

   其余一律标准 Canvas2D。不含 window、不含 document、不含房间数据。 */
`
const h = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16)

;(async () => {
const codex = await bakeCodex()
// 平台缝是【引导】,自己一支、排在最前(见 engine/seam.js 顶部的说明)。
// 它不在引擎那个 part 里,所以这里显式拼在最前面,而不是靠 part 的文件表带出来。
const SEAM = 'engine/seam.js'
if (files.includes(SEAM)) { console.error('✗ seam 不该在引擎 part 里'); process.exit(1) }
const body = [SEAM].concat(files).map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n;\n')
// CODEX 要在引擎体之前 —— defineActor 在加载时就取它。
// 末尾那个分号不能省:引擎体是 `(function(){...})()`,少了分号就成了
// `{...}(function...)` —— 拿对象当函数调,整支产物一行都不执行。
const out = banner + '\nglobalThis.CODEX = ' + JSON.stringify(codex) + ';\n' + body

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, out)
console.log(`✓ ${path.relative(process.cwd(), OUT)}  ${out.length} 字节 · ${files.length + 1} 个源文件 · sha256 ${h(out)}`)

// --emit=<目录>:把小程序要的三样一起放过去(引擎 / 宿主适配 / 房间脚本)。
// 都是生成物,不入版本库 —— 单一来源仍是 rooms/src,改完重新生成。
const EMIT = (process.argv.find((a2) => a2.startsWith('--emit=')) || '').slice(7)
if (EMIT) {
  const dir = path.resolve(EMIT)
  // 这一步会自己建目录、铺一堆文件。写错一个 `..` 就在仓库外面铺 ——
  // 第一次跑就是这样,在 goliajp/mini/ 底下建了整套(和本仓库的 mini/ 同名,
  // 更难发现)。所以先钉死在仓库内。
  const REPO = path.resolve(ROOT, '..')
  if (!(dir + path.sep).startsWith(REPO + path.sep)) {
    console.error(`✗ --emit 指到了仓库外面:${dir}`)
    console.error(`   仓库是 ${REPO} —— 路径是相对当前目录算的,是不是多写了一个 ..?`)
    process.exit(2)
  }
  fs.mkdirSync(path.join(dir, 'rooms'), { recursive: true })
  const wrote = []
  const put = (rel, body) => {
    fs.writeFileSync(path.join(dir, rel), body)
    wrote.push(`${rel} ${body.length}`)
  }
  put('engine.js', out)
  put('host.js', hostJs)
  for (const r of PORTABLE_ROOMS) {
    // 一间房可能不止一支源文件(阿云的布局单独在 ayun-plan.js 里),
    // 按 srcs 的顺序拼成一支,中间垫分号 —— 理由同 Worker 那边。
    const body = r.srcs.map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n;\n')
    put(path.join('rooms', r.id.replace(/_ROOM$/, '').toLowerCase() + '.js'), body)
  }
  /* 有哪几间房 —— 由 PORTABLE_ROOMS 生成,不让页面手写一份。
     村主屏要靠它决定「进屋」这颗按钮出不出现,房间页要靠它认参数。
     手写的话:加一间房而忘了改页面,那间房永远进不去,而且不报错。
     很小,两个页面都 require 得起(不像六支房间脚本共 130KB)。 */
  const idx = PORTABLE_ROOMS.map((r) => r.id.replace(/_ROOM$/, '').toLowerCase())
  put('rooms/index.js',
    '/* 由 rooms/tools/build-engine.js 生成,不要手改 */\n' +
    'globalThis.ROOM_INDEX = ' + JSON.stringify(idx) + '\n')

  // 村子那一屏:单独一支(不进 engine.js —— 房间页用不到它,小程序有包体上限),
  // 外加它要的那张贴图。
  // plots.js 是宅基【数据】,village.js 加载时就要用 —— 顺序不能换
  put('plots.js', fs.readFileSync(path.join(SRC, 'engine', 'plots.js'), 'utf8'))
  put('village.js', fs.readFileSync(path.join(SRC, 'engine', 'village.js'), 'utf8'))
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true })
  const tiles = fs.readFileSync(path.join(ROOT, 'assets', 'tilemap_packed.png'))
  fs.writeFileSync(path.join(dir, 'assets', 'tilemap_packed.png'), tiles)
  wrote.push(`assets/tilemap_packed.png ${tiles.length}`)

  console.log(`✓ 已产出到 ${path.relative(process.cwd(), dir)}/`)
  wrote.forEach((w) => console.log(`    ${w} 字节`))
}

if (MODE !== 'verify') process.exit(0)

// ── 验证:同一个房间,产物渲一遍 vs 设计页渲一遍,像素必须相同 ──
  const { chromium } = require('playwright')
  const b = await chromium.launch({ args: LAUNCH_ARGS })

  // 造一个合成房间。用真房间要连房间脚本一起搬,那是宿主的事;
  // 合成房间同样走完 L0..L7 整条管线,足以证明产物与设计页是同一个引擎。
  const ROOM = {
    w: 720, h: 1280, wallH: 300, extBand: 1100, gradePreset: 'warm', state: {},
    surfaces: { floor: 'ayun_floor', wall: 'ayun_wall' },
    plan: [],
  }

  // 渲一遍,返回 [原始像素, 计数串]。
  // 两边都走这段【同一份】代码 —— 抄成两份的话,哪天改了一边就在比不同的东西。
  const DRAW = `(input) => {
      const room = input.room
      // 素材库里前若干件,按 id 排序取,保证两边取到的是同一批
      const ids = Object.keys(globalThis.ASSETS).sort().slice(0, 24)
      room.plan = ids.map((id, i) => [id, 40 + (i % 6) * 110, 340 + Math.floor(i / 6) * 170])

      // 角色也要渲 —— 这才是烘焙进去的 CODEX 的下游。
      // 只渲素材的话,产物里角色图缺一半也照样绿:那正是这仓库反复栽的假绿。
      //
      // 只挑【声明了 codex】的那几位:其余角色(阿云、陶、狮猫)的图整套在房间
      // 脚本里,产物里本来就没有,两边可比的只有规范这一路。
      // 姿势也从规范里取,不从「poses」取 —— 设计页那边合并了房间自画的姿态,
      // 两边键集不同,各自 sort()[0] 会挑到不同的姿势,比的就不是同一件事了。
      const who = Object.keys(globalThis.ACTORS).filter(id => globalThis.ACTORS[id].codex).sort()
      const ents = who.map((id, i) => {
        const cx = globalThis.codexPoses(globalThis.ACTORS[id].codex)
        // 避开 stand* —— 站姿的规则是「房间自画了就用房间的」,设计页那边
        // 画的是房间版、产物这边只有规范版,本来就该不同。移动姿态才是
        // 两边都由规范说了算的那一路,拿它比才比得出「是不是同一个引擎」。
        const pose = Object.keys(cx.poses).filter(k => !/^stand/.test(k)).sort()[0]
        return globalThis.placeActor(id, 60 + i * 150, 900, pose, i % 2 === 1, {})
      })

      const cv = globalThis.ENGINE_HOST.createCanvas(room.w, room.h)
      const g = cv.getContext('2d')
      globalThis.renderRoom(g, room, 0, ents)
      // 在浏览器里就把像素压成一个指纹。
      // 把 720x1280x4 = 370 万个数搬出去的话,光序列化就跑不完 ——
      // 第一版就是这么挂住的,不是渲染慢。
      //
      // 手写而不用 crypto.subtle:它只在安全上下文里有,而这里两边都不是
      // (设计页走 file://,产物走 blob: worker)。两个不同乘数各滚一遍,
      // 合起来 64 位 —— 拿来判「一不一样」够了。
      const fp = (data) => {
        const px = new Uint32Array(data.buffer)
        // 空缓冲会让下面的循环一次都不跑,函数照样返回两个初始常数 ——
        // 两边都返回同一个常数,于是「一致」,于是全绿。
        // 这不是假设:把 ImageData 而不是 ImageData.data 传进来就是这样,
        // 而且当场就这么绿过一次。指纹函数必须拒绝对空数据出指纹。
        if (!px.length) throw new Error('指纹拿到的是空缓冲 —— 传的是 ImageData 而不是它的 data?')
        let x = 0x811c9dc5, y = 0x1000193
        for (let i = 0; i < px.length; i++) {
          x = Math.imul(x ^ px[i], 0x01000193) >>> 0
          y = Math.imul(y + px[i] + i, 0x85ebca6b) >>> 0
        }
        return (x >>> 0).toString(16).padStart(8, '0') + (y >>> 0).toString(16).padStart(8, '0')
      }
      const both = fp(g.getImageData(0, 0, room.w, room.h).data).match(/.{8}/g)
      const a = parseInt(both[0], 16), b2 = parseInt(both[1], 16)
      const hex = (n) => n.toString(16).padStart(8, '0')

      // 每间【已拆干净】的房间也单独渲一遍。上面那张合成图证明的是引擎一致,
      // 证明不了房间脚本离得开浏览器 —— 房间脚本是另外一支文件,不在产物里。
      // 村子的两张烘好的层。指纹用同一支 fp,与 worker 那边逐字节可比。
      const V = globalThis.VILLAGE_LAYERS
      const vlayers = {}
      if (V) for (const k of ['bg', 'fg']) {
        const g2 = V[k].getContext('2d')
        vlayers[k] = fp(g2.getImageData(0, 0, V[k].width, V[k].height).data)
      }

      const rooms = {}
      for (const rid of input.roomIds) {
        const r = globalThis[rid]
        if (!r) { rooms[rid] = '房间没加载出来' ; continue }
        // 复位到声明态再渲。房间自己的循环一直在改 state,不复位就成了
        // 「页面活了多久」的快照 —— regress 在 CI 上栽过这一次。
        if (globalThis.resetRoomState) globalThis.resetRoomState(r)
        const c2 = globalThis.ENGINE_HOST.createCanvas(r.w, r.h)
        globalThis.renderRoom(c2.getContext('2d'), r, 0, [])
        rooms[rid] = fp(c2.getContext('2d').getImageData(0, 0, r.w, r.h).data)
      }
      return [hex(a) + hex(b2), ids.length + ':' + who.length + ':' + ents.filter(Boolean).length, rooms, vlayers]
    }`

  // ① 设计页那边:正常开页面渲
  const pageTab = await b.newPage()
  await pageTab.goto('file://' + path.resolve(PAGE))
  await pageTab.waitForTimeout(3500)
  const INPUT = { room: ROOM, roomIds: PORTABLE_ROOMS.map((r) => r.id) }
  const fromPage = await pageTab.evaluate(`(${DRAW})(${JSON.stringify(INPUT)})`)
  await pageTab.close()

  // ② 产物那边:塞进 **Web Worker** 里渲,不是塞进页面。
  //    页面里 document 与 window 都在,产物渲染时顺手摸一下也照样绿 ——
  //    而小程序里它们一个都没有。Worker 是手边最接近小程序的环境:
  //    没有 document、没有 window,有 globalThis,有 OffscreenCanvas。
  //    产物只要在加载或渲染时碰了浏览器专属的东西,这里就会当场抛出来。
  const workerTab = await b.newPage()
  await workerTab.goto('about:blank')
  const fromDist = await workerTab.evaluate(async ({ code, draw, room, rooms, host, plots, village, tiles }) => {
    // 每一段之间垫分号。这些源文件大多以 `})()` 收尾、以 `(function(){` 开头,
    // 直接拼起来就成了「拿返回值当函数调」,整批一行都不执行,
    // 报的还是一长串 (intermediate value) is not a function,指不到是谁。
    // 这个坑在婆婆那支、村子那支上各栽过一次 —— 拼接方兜住,不要求每支自己写。
    const src = `
      ${code}
      ;
      // 假的 wx:只实现引擎真正用到的那一个方法。
      // 这样底下加载的是【真的那支宿主适配】(rooms/host/wx.js),
      // 而不是在测试里手写一个 createCanvas —— 手写的话,发出去的适配一行都没被验过。
      globalThis.wx = {
        createOffscreenCanvas: (o) => new OffscreenCanvas(o.width, o.height),
      }
      ${host}
      ;
      ${plots}
      ;
      ${village}
      ;
      ${rooms}
      ;
      // ── 顺带验 mountRoom ──────────────────────────────────────
      // 上面那段只用到适配的 createCanvas。mountRoom 才是页面真正要调的那个:
      // 它负责取 2d 上下文、按房间声明设画布尺寸、把每帧交给 <ID>_FRAME。
      // 不验的话,适配「能造画布」但「驱动不起来」照样全绿。
      globalThis.__mountCheck = function () {
        const q = []
        const node = {
          width: 0, height: 0, ctx: null,
          getContext(k) {
            this.cv = new OffscreenCanvas(this.width, this.height)
            this.ctx = this.cv.getContext(k)
            return this.ctx
          },
          requestAnimationFrame(cb) { q.push(cb) },
        }
        // 假按钮:白鹭房声明了表演态按钮,不给就该抛「找不到按钮」——
        // 那道保护在小程序侧也必须还在,所以下面单独试一次不给的情形。
        let label = '起卦'
        const btn = { onTap() {}, getLabel: () => label, setLabel: (s) => { label = s } }
        const bid = (globalThis.BAILU_ROOM.perform || {}).button
        const R = globalThis.mountRoom(node, 'BAILU_ROOM', { buttons: { [bid]: btn } })
        // 驱动若干帧。房间自己有 20fps 节流,t 要跨得开才画得到东西。
        // 每帧留一张指纹,用来看画面动没动。
        const shots = []
        const fpOf = () => {
          const d = new Uint32Array(node.ctx.getImageData(0, 0, node.width, node.height).data.buffer)
          let x = 0x811c9dc5
          for (let i = 0; i < d.length; i += 7) x = Math.imul(x ^ d[i], 0x01000193) >>> 0
          return x >>> 0
        }
        const shot = (i) => shots[i]
        // 数「换了几次动作」。这才是真正依赖时钟的东西:
        // 「呆到什么时候」到点了才换下一个动作。姿势帧是靠 st.frame 自己转的,
        // 房间冻在第一个动作上,画面照样在变 —— 所以不能用「画面动没动」当判据,
        // 这一点是实测出来的:把适配改回用 rAF 的时间戳(那正是要防的 bug),
        // 「画面在动」照样报绿。
        // 阈值取 1 就够判别:时钟不同源时「到点了没」永远不成立,一次都不会换。
        // 要看到第二次得渲上百帧(换动作只在到点那一刻,之后是逐帧走路),
        // 而每帧渲的是 1440x2560,不值当。
        let acts = 0
        const origWalk = globalThis.startWalkTo
        globalThis.startWalkTo = function () { acts++; return origWalk.apply(this, arguments) }

        // 时钟由【宿主】给,所以测试就是宿主:接管 now(),每帧推进 500ms。
        // 推 500 而不是一帧的 50 —— 一个动作要呆好几秒,按真实帧长推的话
        // 得渲上千帧才看得到第二次换动作,而渲的是 1440x2560,太慢。
        // 房间自己的节流是 50ms,推得再大也只是「跳着走」,每次照样整帧算。
        // 从当前值起步 —— 房间加载时已经用真实时钟记下了「呆到什么时候」,
        // 把钟拨回 0 的话它会永远等下去。
        let fake = globalThis.ENGINE_HOST.now()
        globalThis.ENGINE_HOST.now = () => fake
        let n = 0
        // 传给 rAF 的时间戳故意给一个荒唐值:适配【不该】看它。
        // 平台的 rAF 原点是什么,由平台定;房间的时间必须只来自 now()。
        for (let k = 0; k < 67 && q.length; k++) {
          fake += 500
          const cb = q.shift(); cb(1e9 + k * 7); n++; shots.push(fpOf())
        }
        const px = node.ctx.getImageData(0, 0, node.width, node.height).data
        let ink = 0
        for (let i = 3; i < px.length; i += 4) if (px[i]) { ink++; if (ink > 1000) break }
        // 画上了东西 ≠ 动起来了。房间的每个「呆到什么时候」是用一个时钟算的,
        // 而帧时刻是另一个来源 —— 两者不同源的话人物会停在第一个动作上,
        // 画面照样有内容,ink 照样过。所以这里比【早一帧与晚一帧】。
        const moved = shot(3) !== shot(10)
        globalThis.startWalkTo = origWalk
        // 点一下画布上有东西的地方 —— 交互层也得能在这个平台上收到事件
        let tapped = false
        try { R.tap(node.width / 2, node.height * 0.7, node.width); tapped = true } catch (e) { tapped = String(e) }
        R.stop()
        const before = q.length
        while (q.length) q.shift()(9999)
        // 不给按钮时必须抛。这条不验的话,小程序侧「房间声明了按钮却没接」
        // 会静静地跑下去,而设计页那边是会抛的 —— 两个平台保护不一样最难查。
        let guarded = false
        try {
          delete globalThis.__B
          const bad = { width: 0, height: 0, getContext: () => ({}), requestAnimationFrame() {} }
          globalThis.ENGINE_HOST.button = () => null
          globalThis.wirePerform(globalThis.BAILU_ROOM)
        } catch (e) { guarded = /找不到按钮/.test(String(e)) }

        return { w: node.width, h: node.height, frames: n, ink, guarded, tapped, moved, acts,
                 stopped: q.length === 0 && before > 0 }
      }

      self.onmessage = (e) => {
        // 村子:worker 里没有 <img>,用 createImageBitmap 从 data URI 解一张出来。
        // 这就是「拿到一张图」的第三种实现(浏览器 <img> / 小程序 createImage / 这里),
        // 而引擎那边只认「已经加载好的一张图」—— 三边共用同一个 VILLAGE_INIT。
        const vil = fetch(e.data.tiles).then((r2) => r2.blob())
          // colorSpaceConversion / premultiplyAlpha 都要显式关掉。默认值会对
          // 解出来的位图做色彩空间转换,于是同一张 PNG 经 <img> 与经
          // createImageBitmap 拿到的像素【不一样】—— 实测:用贴图画的那层
          // (bg)对不上,不用贴图的那层(fg)完全一致,正好指到这里。
          .then((b2) => createImageBitmap(b2, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }))
          .then((bm) => {
            globalThis.VILLAGE_INIT(bm)
            // 点选也在这里验:判定是纯几何,没有 DOM,worker 里跑得动。
            // 逐个村民按【他自己所在的位置】点一遍,点到的必须是他自己 ——
            // 「声明了可点」跟「点得到」是两件事,房间那边吃过这个亏。
            const cen = globalThis.VILLAGE_CENSUS()
            let hitSelf = 0
            for (const v of globalThis.VILLAGE_VILLAGERS_FOR_TEST || []) {
              const h = globalThis.VILLAGE_HIT(v.x, v.y)
              if (h && h.kind === 'villager' && h.at === v.at) hitSelf++
            }
            /* 宅基:每一格【有没有任何一处】点得到自己。
               不是只点门心 —— 村民会站在门口,而村民优先于房子(他就画在房子前面),
               那时门心点到的是人,这是对的行为。第一版按门心判,20 格里报 19,
               差的那一格正是有人站着。判据照 roomaudit 查素材可达性那一条:
               「露出来的部分能点中它自己」就算可达。 */
            let plotSelf = 0
            const PL = globalThis.VILLAGE_PLOTS || []
            const unreach = []
            for (const q of PL) {
              let ok = false
              for (let dy = 10; dy <= 90 && !ok; dy += 16) {
                for (let fx = 0.25; fx <= 0.75 && !ok; fx += 0.25) {
                  const h = globalThis.VILLAGE_HIT(q.x + q.w * fx, q.gy - dy)
                  if (h && h.kind === 'plot' && h.at === q.id) ok = true
                }
              }
              if (ok) plotSelf++; else unreach.push(q.id)
            }
            globalThis.__VIL = { census: cen, hitSelf, plots: PL.length, plotSelf, unreach }
            const L = globalThis.VILLAGE_LAYERS
            const out = {}
            for (const k of ['bg', 'fg']) {
              const g2 = L[k].getContext('2d')
              const d = new Uint32Array(g2.getImageData(0, 0, L[k].width, L[k].height).data.buffer)
              let x = 0x811c9dc5, y = 0x1000193
              for (let i = 0; i < d.length; i++) {
                x = Math.imul(x ^ d[i], 0x01000193) >>> 0
                y = Math.imul(y + d[i] + i, 0x85ebca6b) >>> 0
              }
              out[k] = (x >>> 0).toString(16).padStart(8, '0') + (y >>> 0).toString(16).padStart(8, '0')
            }
            out.__vil = globalThis.__VIL
            return out
          })
        Promise.all([Promise.resolve().then(() => (${draw})(e.data)), vil])
          .then(([ok, vlayers]) => self.postMessage({ ok, vlayers, mount: globalThis.__mountCheck() }))
          .catch((err) => self.postMessage({ err: String(err && err.stack || err) }))
      }`
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })))
    const r = await new Promise((res) => {
      w.onmessage = (e) => res(e.data)
      w.onerror = (e) => res({ err: '加载就失败了: ' + (e.message || e) })
      w.postMessage({ ...room, tiles })
    })
    w.terminate()
    return r
  }, { code: out, draw: DRAW, room: INPUT,
       host: hostJs,
       plots: fs.readFileSync(path.join(SRC, 'engine', 'plots.js'), 'utf8'),
       village: fs.readFileSync(path.join(SRC, 'engine', 'village.js'), 'utf8'),
       // 贴图 5KB,内联成 data URI 送进 worker —— worker 里没有 <img>,
       // 用 createImageBitmap 解出来,正是「宿主自己想办法拿到一张图」的另一种实现
       tiles: 'data:image/png;base64,' +
         fs.readFileSync(path.join(ROOT, 'assets', 'tilemap_packed.png')).toString('base64'),
       // 每支之间垫一个分号。房间脚本大多以 `})()` 收尾、以 `(function(){` 开头,
       // 直接拼起来就成了 `})()(function(){...})` —— 拿返回值当函数调,整批不执行。
       // 设计页里每间房各占一个 <script> 所以碰不到;这里是拼接方的责任,
       // 不该要求每支源文件自己在开头写防御性分号(婆婆那支就没写)。
       rooms: PORTABLE_ROOMS.flatMap((r) => r.srcs)
         .map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n;\n') })
  await workerTab.close()
  await b.close()

  if (fromDist.err) {
    console.log(`\n✗ 产物在没有 document / window 的环境里跑不起来`)
    console.log('   ' + fromDist.err.split('\n').slice(0, 4).join('\n   '))
    console.log('   小程序就是这样的环境。修到这里不抛为止,别等上真机才发现')
    process.exit(1)
  }

  // 「两边渲的都是空画面」也会逐字节相同。所以数量单独断言 ——
  // 相同只说明两边一致,不说明两边**渲了东西**。
  const [nAsset, nWho, nEnt] = fromDist.ok[1].split(':').map(Number)
  if (!(nAsset >= 24 && nWho >= 4 && nEnt === nWho)) {
    console.log(`\n✗ 验证本身没渲到东西:素材 ${nAsset} / 角色 ${nWho} / 摆上去 ${nEnt}`)
    console.log('   这时候的「一致」是空对空,不能当通过')
    process.exit(1)
  }
  console.log(`  验证渲了 ${nAsset} 件素材 + ${nWho} 位角色`)

  // 宿主适配的驱动那一半
  const M = fromDist.mount
  if (!(M && M.w > 0 && M.h > 0 && M.frames >= 5 && M.ink > 1000 && M.stopped && M.guarded && M.tapped === true && M.moved && M.acts >= 1)) {
    console.log('\n✗ 宿主适配挂不起一间房')
    console.log(`   画布 ${M && M.w}x${M && M.h} · 驱动了 ${M && M.frames} 帧 · 画上了 ${M && M.ink} 个不透明像素`)
    console.log(`   stop 生效 ${M && M.stopped} · 缺按钮时抛错 ${M && M.guarded} · 点得进去 ${M && M.tapped}`)
    console.log(`   画面在动 ${M && M.moved} · 换了 ${M && M.acts} 次动作`)
    console.log('   换动作次数为 0 = 【时钟不同源】:房间的「呆到什么时候」和帧时刻')
    console.log('   不是同一个来源,人物会停在第一个动作上 —— 而画面仍然在动(姿势帧照转),')
    console.log('   所以这条不能靠「画面动没动」判。见 rooms/host/wx.js 里的时钟那一节')
    console.log('   能造画布不等于驱动得起来 —— 页面调的是 mountRoom,不是 createCanvas')
    process.exit(1)
  }
  console.log(`  宿主适配挂上白鹭:${M.w}x${M.h} · ${M.frames} 帧 · 换了 ${M.acts} 次动作 · 点得进去 · stop 生效`)

  /* 村子。这一路证明的是【拿到一张图】三边可以各写各的(浏览器 <img> /
     小程序 createImage / worker createImageBitmap),而引擎那边只认「已经加载好的图」。

     判据不是逐字节 —— 那对村子达不到,而且原因不在代码:
     页面画布与 worker 的 OffscreenCanvas 在这条绘制路径上有亚像素微差。
     实测过 fg 逐字节相同、bg 不同,而 bg 的差是 32x32 块均值最大 0.432/255、
     平均 0.0053(内容变化会让整块挪几十)。贴图本身也排除过:同一张 PNG 经
     <img> 与经 createImageBitmap 解出来、1:1 与 2x 放大画出来,都逐字节相同。

     所以这里断言能成立的那几条:两层都烘出来了、fg 逐字节相同。
     bg 的像素由 regress 在【设计页那一侧】钉住(VILLAGE bg 场景)。 */
  {
    const A2 = fromPage[3] || {}, B2 = fromDist.vlayers || {}
    const bad2 = []
    if (!A2.bg || !A2.fg) bad2.push('  ✗ 设计页没烘出村子的图层')
    if (!B2.bg || !B2.fg) bad2.push('  ✗ 产物在无浏览器环境里没烘出村子的图层')
    if (A2.fg && B2.fg && A2.fg !== B2.fg)
      bad2.push(`  ✗ 村子 fg  设计页 ${A2.fg} / 产物 ${B2.fg}`)
    if (bad2.length) {
      console.log('\n✗ 村子没能离开浏览器')
      bad2.forEach((l) => console.log(l))
      process.exit(1)
    }
    console.log(`  村子在无浏览器环境里烘出两层,fg 逐字节相同(${A2.fg})`)

    // 点选。判定是纯几何、没有 DOM,所以这里跑得动 ——
    // 而「声明了可点」与「点得到」是两件事,房间那边吃过这个亏(附着件曾 1/7 可达)。
    const V = (B2.__vil) || {}
    const cen = V.census || {}
    if (!(cen.村民 > 0 && V.hitSelf === cen.村民)) {
      console.log('\n✗ 村子点不准')
      console.log(`   ${cen.村民 || 0} 位村民,按他自己的位置点,点到自己的只有 ${V.hitSelf || 0} 位`)
      process.exit(1)
    }
    if (!(V.plots > 0 && V.plotSelf === V.plots)) {
      console.log('\n✗ 宅基点不准')
      console.log(`   ${V.plots || 0} 格,${V.plotSelf || 0} 格点得到自己`)
      console.log(`   整格都点不到的: ${(V.unreach || []).join(' ') || '(没解析到)'}`)
      process.exit(1)
    }
    console.log(`  点选:${cen.村民} 位村民 + ${V.plots} 格宅基逐个点过,点到的都是自己`)
    console.log(`        宅基已落位 ${cen.已落位} · 待落位 ${cen.待落位}`)
  }

  // 每间可移植房间:产物侧要真的把它加载出来,而且渲得与设计页一样
  const bad = []
  for (const { id } of PORTABLE_ROOMS) {
    const a = fromPage[2][id], b2 = fromDist.ok[2][id]
    if (a === b2) { console.log(`  ${id} 在无浏览器环境里渲得一样(${a})`); continue }
    bad.push(`  ✗ ${id}  设计页 ${a} / 产物 ${b2}`)
  }
  if (bad.length) {
    console.log('\n✗ 房间脚本没能离开浏览器')
    bad.forEach((l) => console.log(l))
    console.log('   这间房还没从「宿主那一段」里拆干净,或者拆完渲得不一样了')
    process.exit(1)
  }

  const [pageHash] = fromPage, [distHash] = fromDist.ok
  if (pageHash === distHash) {
    console.log(`\n✓ 产物在 Worker 里(无 document / 无 window)渲出的像素`)
    console.log(`  与设计页逐字节相同(${pageHash})`)
    console.log('  也就是说:小程序里跑的会是同一个引擎,不是「差不多的那个」')
    process.exit(0)
  }
  console.log(`\n✗ 产物与设计页渲得不一样`)
  console.log(`   设计页 ${pageHash} / 产物 ${distHash}`)
  console.log('   产物少收了东西,或者收进来的顺序不对')
  process.exit(1)
})()
