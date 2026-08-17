#!/usr/bin/env node
/**
 * assetprobe —— 单个素材的栅格化探针
 *
 * 起因：新加的横梁在房间里怎么都不出现，plan 有它、素材也定义了、页面不报错。
 * 根因是 draw() 里写了 g.scale(0.5) —— Canvas 的 scale 要两个参数。draw 抛异常，
 * 引擎吞掉，那一件就静默不画，其余照常。肉眼看就像「层序不对」，查错方向全歪。
 *
 * 所以：素材没出现时，先用这个确认它到底有没有画出像素，再谈层序和坐标。
 *
 * 用法：node tools/assetprobe.js <design.html 绝对路径> <素材id> [房间canvas]
 *   报告：是否在库、是否在 plan、sprite 尺寸、墨迹像素数、draw 抛的异常、
 *         以及顶部/底部若干行的着墨列（用来对齐吊绳、支腿这类锚点）
 */
const { chromium } = require('playwright')
const [FILE, ID, CID] = [process.argv[2], process.argv[3], process.argv[4] || 'taoCanvas']
if (!FILE || !ID) { console.error('用法: node assetprobe.js <design.html 绝对路径> <素材id> [canvas]'); process.exit(2) }

;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(String(e).slice(0, 240)))
  await p.goto('file://' + require('path').resolve(FILE))
  await p.waitForTimeout(6000)
  const r = await p.evaluate(([id, cid]) => {
    const A = window.ASSETS || {}
    const out = { inLibrary: !!A[id] }
    if (!A[id]) return out
    const a = A[id]
    out.meta = { w: a.w, h: a.h, zLayer: a.zLayer || '(默认)', wall: !!a.wall, foot: a.foot }
    // 房间清单不许写死 —— 漏掉的那间会安静地报「不在任何 plan 里」，
    // 看起来像素材没摆上去，其实是工具没在看那间房。（PLAYBOOK §4.7）
    // 这行从前就写死成四间，沈砚白鹭两间的素材因此一直被报成「没摆上去」。
    // 约定同 tools/rooms.js：window.<NAME>_ROOM 且带 plan 数组。
    const rooms = Object.keys(window)
      .filter(k => /^[A-Z][A-Z0-9]*_ROOM$/.test(k))
      .map(k => window[k])
      .filter(r => r && Array.isArray(r.plan))
    out.inPlan = rooms.flatMap(r => (r.plan || []).filter(e => e[0] === id))
    try {
      const cv = window.placeAsset(id, 0, 0, {}).cv
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
      let ink = 0
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) ink++
      const colsIn = (y0, y1) => {
        const c = []
        for (let x = 0; x < cv.width; x++) {
          for (let y = y0; y < y1; y++) if (d[((y * cv.width) + x) * 4 + 3] > 8) { c.push(x); break }
        }
        return c
      }
      out.sprite = { w: cv.width, h: cv.height, ink }
      out.topCols = colsIn(0, Math.min(6, cv.height))
      out.bottomCols = colsIn(Math.max(0, cv.height - 6), cv.height)
    } catch (e) { out.drawError = String(e).slice(0, 240) }
    return out
  }, [ID, CID])
  console.log(JSON.stringify(r, null, 1))
  if (errs.length) console.log('\n页面错误:\n  ' + errs.slice(0, 3).join('\n  '))
  if (r.sprite && r.sprite.ink === 0) console.log('\n✗ sprite 无墨迹 —— 素材画了个空,查 draw 的坐标是否落在包围盒外')
  if (r.drawError) console.log('\n✗ draw 抛异常 —— 这一件会静默不画,而页面不报错')
  await b.close()
})()
