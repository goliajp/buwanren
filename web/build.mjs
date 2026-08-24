#!/usr/bin/env bun
/* 组装移动网页版 —— 小程序的镜像。
 *
 * 它【不复制】任何页面代码:页面的 .ts / .wxml / .wxss 就是 mini/ 里那些文件本身,
 * 引擎与房间也是同一批产物。这里只做两件事:
 *   ① 把每页的 wxml / wxss 读成字符串,连同页面模块一起交给运行时
 *   ② 用 bun 把 TypeScript 打成一支给浏览器
 *
 * 复制会漂,而漂掉的正好是「在网页版上验过所以放心」的那部分。
 * 所以下面任何一处看起来像「抄一份过来」的地方,都要停下来想清楚。
 *
 * 用法: bun web/build.mjs [--out=web/dist]
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MINI = join(ROOT, 'mini/miniprogram')
const OUT = join(ROOT, (process.argv.find((a) => a.startsWith('--out=')) || '--out=web/dist').slice(6))

// 页面清单从 app.json 读 —— 小程序认哪几页,镜像就认哪几页,不另列一份
const appJson = JSON.parse(readFileSync(join(MINI, 'app.json'), 'utf8'))
const ROUTES = appJson.pages
if (!ROUTES || !ROUTES.length) throw new Error('app.json 里一页都没有')

// 引擎产物:与小程序用的是同一批文件,不重新生成
const ENGINE = join(MINI, 'engine')
if (!existsSync(join(ENGINE, 'engine.js'))) {
  throw new Error('还没产出引擎 —— 先跑 (cd mini && npm run build:engine)')
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
cpSync(ENGINE, join(OUT, 'engine'), { recursive: true })

// ── 入口:注册每一页,再开第一页 ────────────────────────────────
const lines = [
  "import '../runtime/wxml.js'",
  "import '../runtime/page.js'",
  "import '../runtime/wx.js'",
  '',
  '// app.ts 先加载 —— 它调 App(),几个页面在 onLoad 里就 getApp()',
  `await import(${JSON.stringify(join(MINI, 'app.ts'))})`,
  '',
  // 全局样式。小程序里 app.wxss 对每一页都生效,镜像以前【整个没读】——
  // 于是 .page 的左右留白、--ink-* 那几个颜色变量全都不在,
  // 每一页都贴着边渲,而行为检查照样全绿(它们不看外观)。
  // 版式在镜像里因此是不可信的 —— 而「先移动网页版」这个工作法要的正是版式可信。
  `globalThis.__APPWXSS = ${JSON.stringify(
    existsSync(join(MINI, 'app.wxss')) ? readFileSync(join(MINI, 'app.wxss'), 'utf8') : ''
  )}`,
  '',
  // 底部那条 tab 也照 app.json ——「小程序认哪几页」与「小程序底下长什么样」
  // 是同一份声明,镜像不另抄一份
  `globalThis.__TABBAR = ${JSON.stringify(appJson.tabBar || null)}`,
  '',
  '// 页面顺序照 app.json。每一页先告诉运行时「接下来注册的是哪一页」,',
  '// 再 import 它 —— 页面文件顶层就调 Page(),运行时靠这个知道是谁在注册。',
]
for (const r of ROUTES) {
  const wxml = readFileSync(join(MINI, r + '.wxml'), 'utf8')
  const wxss = existsSync(join(MINI, r + '.wxss')) ? readFileSync(join(MINI, r + '.wxss'), 'utf8') : ''
  lines.push(
    `globalThis.__beginPage(${JSON.stringify(r)}, ${JSON.stringify(wxml)}, ${JSON.stringify(wxss)})`,
    `await import(${JSON.stringify(join(MINI, r + '.ts'))})`,
  )
}
lines.push(
  '',
  '// 开哪一页由地址栏定,默认第一页 —— 无头验证要能直接打到某一页',
  "const q = new URLSearchParams(location.search)",
  `const first = q.get('page') || ${JSON.stringify(ROUTES[0])}`,
  "const args = {}",
  "for (const [k, v] of q) if (k !== 'page') args[k] = v",
  'globalThis.__router.open(first, args)',
  "globalThis.__READY = true",
)
mkdirSync(join(ROOT, 'web/.gen'), { recursive: true })
const entry = join(ROOT, 'web/.gen/main.ts')
writeFileSync(entry, lines.join('\n') + '\n')

// ── 打包 ────────────────────────────────────────────────────────
const built = await Bun.build({
  entrypoints: [entry],
  outdir: OUT,
  naming: 'app.js',
  target: 'browser',
  format: 'esm',
})
if (!built.success) {
  for (const m of built.logs) console.error(String(m))
  throw new Error('打包失败')
}

// ── 外壳 ────────────────────────────────────────────────────────
// 引擎那几支挂 globalThis,用 <script> 按顺序加载 —— 与小程序里 require 的顺序一致
const ENGINE_SCRIPTS = [
  'engine/engine.js', 'engine/host.js', 'engine/plots.js',
  'engine/village.js', 'engine/rooms/index.js',
  'engine/rooms/ayun.js', 'engine/rooms/bailu.js', 'engine/rooms/popo.js',
  'engine/rooms/shenyan.js', 'engine/rooms/tao.js', 'engine/rooms/tenz.js',
]
for (const f of ENGINE_SCRIPTS) {
  if (!existsSync(join(OUT, f))) throw new Error('产物里缺 ' + f)
}

writeFileSync(join(OUT, 'index.html'), `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>不完人</title>
<style>
  /* 这里只放【外壳】的样式。页面自己的样式来自它的 .wxss,由运行时注入,
     一个字都不在这里重写 —— 重写了就不是镜像了。 */
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent }
  html, body { margin: 0; background: #efece6; color: #3a352e;
    font: 14px/1.6 -apple-system, "PingFang SC", system-ui, sans-serif }
  #app { min-height: 100vh }
  /* WXML 的 <view> 默认是块级弹性盒的容器,<text> 是行内 —— 与小程序一致 */
  [data-wx="view"] { display: block }
  [data-wx="text"] { display: inline }
  .wx-canvas { display: block }
  #wx-toast, #wx-loading {
    display: none; position: fixed; left: 50%; top: 50%; transform: translate(-50%,-50%);
    background: rgba(30,26,22,.86); color: #f6f2ea; padding: 14px 22px; border-radius: 8px;
    font-size: 15px; z-index: 99; max-width: 70vw; text-align: center; white-space: pre-wrap;
  }
  #wx-err { display: none; position: fixed; inset: 0; background: #2a1a1a; color: #ffd9d9;
    padding: 24px; font: 13px/1.7 ui-monospace, Menlo, monospace; white-space: pre-wrap;
    overflow: auto; z-index: 100 }
  /* 「只有真机有」的那几样：照样说出来，但不吃掉页面 —— 在手机上浏览时
     点一下扫码就得重载，那代价没道理，而且会把人训练成忽视红屏。 */
  #wx-note { display: none; position: fixed; left: 12px; right: 12px; bottom: 12px;
    background: #2b2b2b; color: #f3ead9; border-radius: 10px; padding: 14px 16px;
    font: 14px/1.6 system-ui, -apple-system, sans-serif; z-index: 99;
    box-shadow: 0 6px 24px rgba(0,0,0,.35) }
  #wx-note b { display: block; margin-bottom: 4px; font-weight: 600 }
  #wx-note i { float: right; font-style: normal; opacity: .6; padding: 0 4px; cursor: pointer }
</style>
<style id="app-style"></style>
<style id="page-style"></style>
</head>
<body>
<div id="app"></div>
<div id="wx-toast"></div>
<div id="wx-loading"></div>
<!-- 出错就整屏红。镜像的价值在于「坏了看得见」——
     控制台里的一行红字在手机上没人看得见,而这一屏挡不住。 -->
<div id="wx-err"></div>
<div id="wx-note"></div>
<script>
  (function () {
    function boom(what, e) {
      /* 「只有真机有」的能力被点到是【预期之内】的，跟镜像坏了不是一回事。
         底部提示一条、可关掉，页面照常用；真错误仍旧整屏红。 */
      if (e && e.deviceOnly) {
        var n = document.getElementById('wx-note')
        n.style.display = 'block'
        n.innerHTML = '<i>×</i><b>这一步只有真机有</b>' +
          String(e.message).replace(/[<>]/g, '')
        n.querySelector('i').onclick = function () { n.style.display = 'none' }
        globalThis.__DEVICE_ONLY = (globalThis.__DEVICE_ONLY || []).concat(e.wxApi || '')
        return
      }
      var el = document.getElementById('wx-err')
      el.style.display = 'block'
      el.textContent = (el.textContent ? el.textContent + '\\n\\n' : '') +
        what + '\\n' + (e && (e.stack || e.message) || e)
      globalThis.__ERRORS = (globalThis.__ERRORS || []).concat(String(e && e.message || e))
    }
    addEventListener('error', function (ev) { boom('出错', ev.error || ev.message) })
    addEventListener('unhandledrejection', function (ev) { boom('未处理的 Promise', ev.reason) })
  })()
</script>
${ENGINE_SCRIPTS.map((f) => `<script src="${f}"></script>`).join('\n')}
<script type="module" src="app.js"></script>
</body>
</html>
`)

console.log('✓ 移动网页版已组装到 ' + OUT.replace(ROOT + '/', ''))
console.log('  页面 ' + ROUTES.length + ' 页(照 app.json):' + ROUTES.join(' '))
console.log('  引擎 ' + ENGINE_SCRIPTS.length + ' 支(与小程序同一批产物)')
