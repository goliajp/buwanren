#!/usr/bin/env bun
/**
 * portlint —— 渲染路径能不能离开浏览器(台账 D2 · 工序单第 09 步的前置)
 *
 * 「引擎不许直接 import wx API,渲染只依赖标准 Canvas2D」。这条要成立,
 * 前提是渲染路径上**没有 document**:小程序里没有它。
 *
 * 读代码数 `document.` 出现几次是不作数的 —— 出现在注释里、出现在守卫后面、
 * 出现在设计页专用的函数里,都不影响渲染。所以这里换个查法:
 *
 *   1. 把 `ENGINE_HOST.createCanvas` 换成一个【不经过 document】的实现,
 *      模拟另一个宿主(小程序那边是 wx.createOffscreenCanvas)
 *   2. 把 `document.createElement` 换成一个**会抛错**的桩
 *   3. 逐件重新光栅化 + 整屋重渲一遍
 *
 * 渲染路径上但凡还有一处绕过平台缝直接摸 document,第 3 步立刻抛错。
 * 全渲完还活着,说明所有离屏画布都是从平台缝里出来的 —— 换个宿主就能跑。
 *
 * 第 3 步用一个固定 tint 顶开 sprite 缓存 —— 不这么做的话第二次渲染
 * 一张画布都不造,这个检查会以「全绿」的样子什么都没查。
 *
 * 用法:bun tools/portlint.js <design.html>
 */
const { chromium } = require('playwright')
const path = require('path')

const FILE = process.argv[2]
if (!FILE) { console.error('用法: bun tools/portlint.js <design.html>'); process.exit(2) }

;(async () => {
  /* 自带的 chromium，不用装机版 Chrome —— 后者在这台机器上跑二三十秒就挨 SIGKILL
     （08-30 实测，见 docs/FINDING-2026-08-30-chrome-sigkill.md）。
     `regress.js` 是例外:它的基准哈希绑着浏览器，换一个就得重存，
     而那份基准记着 12 处已知漂移与存基准时的 commit，比这点稳定性值钱。 */
  const b = await chromium.launch()
  const p = await b.newPage()
  await p.goto('file://' + path.resolve(FILE))
  await p.waitForTimeout(3500)

  const res = await p.evaluate(() => {
    const rooms = Object.keys(window)
      .filter(k => /^[A-Z][A-Z0-9]*_ROOM$/.test(k))
      .filter(k => window[k] && Array.isArray(window[k].plan)).sort()
    if (!rooms.length) return { err: '一间房都没发现' }
    if (!window.ENGINE_HOST) return { err: '没有 ENGINE_HOST —— 平台缝不在' }

    const realCreate = document.createElement.bind(document)

    // 模拟另一个宿主:它用【自己的办法】造画布,不经过 document。
    // 小程序那边这一行会是 wx.createOffscreenCanvas({type:'2d',width:w,height:h})。
    let viaHost = 0
    const hostOrig = window.ENGINE_HOST.createCanvas
    const mk = (w, h) => { const cv = realCreate('canvas'); cv.width = w; cv.height = h; return cv }
    window.ENGINE_HOST.createCanvas = (w, h) => { viaHost++; return mk(w, h) }

    // 渲染用的目标画布也得先造好 —— 装上桩之后就造不出来了
    const targets = rooms.map(key => {
      const room = window[key]
      return { key, room, cv: mk(room.w || 1440, room.h || 2560) }
    })

    // 从这一刻起,绕过平台缝直接摸 document 的代码会当场炸
    const bad = []
    document.createElement = (tag) => {
      bad.push(tag)
      throw new Error('渲染路径直接调了 document.createElement("' + tag + '")')
    }

    // 小程序里没有 window。可移植的核心必须只认 globalThis ——
    // 浏览器里两者是同一个对象,所以这条在这里是白测?不是:
    // 它测的是【源码里写没写 window】,而那正是换宿主时唯一会炸的地方。
    const winRefs = []
    for (const name of ['renderRoom', 'placeAsset', 'placeActor', 'ACTORS', 'ASSETS', 'roomState']) {
      if (typeof globalThis[name] === 'undefined') winRefs.push(name)
    }

    const out = { rooms: [], viaHost: 0, assets: 0, bad, winRefs, err: null }
    try {
      // ① 逐件重新光栅化。用一个独一无二的 tint 顶开 sprite 缓存 ——
      //    不这么做的话第二次渲染一张画布都不造,这个检查就等于没跑。
      const ids = Object.keys(window.ASSETS || {})
      for (const id of ids) {
        window.placeAsset(id, 0, 0, { tint: 'portlint' })
        out.assets++
      }
      // ② 再整屋渲一遍,覆盖渲染管线自己造的那些画布
      for (const t of targets) {
        const g = t.cv.getContext('2d')
        const actor = t.key.replace(/_ROOM$/, '').toLowerCase()
        const A = (window.ACTORS || {})[actor]
        const ents = A ? [window.placeActor(actor, ((t.room.w || 1440) * 0.5) | 0, ((t.room.h || 2560) * 0.6) | 0, 'stand', false)] : []
        window.renderRoom(g, t.room, 0, ents)
        out.rooms.push(t.key)
      }
    } catch (e) {
      out.err = String(e && e.message || e)
    } finally {
      document.createElement = realCreate
      window.ENGINE_HOST.createCanvas = hostOrig
    }
    out.viaHost = viaHost
    return out
  })
  await b.close()

  if (res.err && !res.rooms) { console.log('✗ ' + res.err); process.exit(1) }

  console.log(`重新光栅化 ${res.assets} 件素材,重新渲染 ${res.rooms.length} 间房`)
  console.log(`经平台缝造出的画布:${res.viaHost} 张`)

  if (res.err) {
    console.log(`\n✗ 渲染路径还离不开浏览器:${res.err}`)
    console.log(`  直接造过的元素:${[...new Set(res.bad)].join(', ')}`)
    console.log('  把它改成 HOST.createCanvas(w, h) —— 见 assets/_head.js 的平台缝')
    process.exit(1)
  }
  if (res.winRefs && res.winRefs.length) {
    console.log(`\n✗ 这些引擎接口不在 globalThis 上:${res.winRefs.join(', ')}`)
    console.log('  小程序里没有 window —— 可移植的核心只能挂 globalThis')
    process.exit(1)
  }
  if (res.viaHost === 0) {
    console.log('\n✗ 一张画布都没经过平台缝 —— 这个检查等于没跑')
    process.exit(1)
  }
  console.log(`\n✓ ${res.rooms.length} 间房全部渲完,期间没有一次直接摸 document`)
  console.log('  所有离屏画布都从 ENGINE_HOST.createCanvas 出来 —— 换宿主只需换这一个方法')
})()
