const { chromium } = require('playwright')
const ROOMARG = process.argv[3] || ''
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  await p.goto('file://' + require('path').resolve(process.argv[2])); await p.waitForTimeout(2800)

  // 房间可选:第三个参数给房间名(ayun/tao/popo/tenz…),不给则用发现到的第一间。
  // 从前这些诊断工具全部写死 AYUN_ROOM,拿它们查别的房会得到误导性结果。
  await p.evaluate((want) => {
    const keys = Object.keys(window)
      .filter(k => /^[A-Z][A-Z0-9]*_ROOM$/.test(k))
      .filter(k => window[k] && Array.isArray(window[k].plan)).sort()
    const key = want && keys.includes(want) ? want : keys[0]
    window.__R = window[key]; window.__RK = key
    window.__RBASE = key.replace(/_ROOM$/, '').toLowerCase()
  }, (ROOMARG || '').toUpperCase().replace(/(_ROOM)?$/, '_ROOM'))
  const r = await p.evaluate(() => {
    const room = window.__R
    const out = {}
    for (const perf of [false, true]) {
      room.performing = perf
      // 统计 L6 实际调用了几个 fx
      let called = 0
      const orig = {}
      for (const e of room.plan) {
        const a = window.ASSETS[e[0]]
        if (a && a.fx && !orig[e[0]]) { orig[e[0]] = a.fx; a.fx = function(){ called++; return orig[e[0]].apply(this, arguments) } }
      }
      const cv = document.createElement('canvas'); cv.width = 1440; cv.height = 2560
      window.renderRoom(cv.getContext('2d'), room, 1000, [])
      for (const k in orig) window.ASSETS[k].fx = orig[k]
      out[perf ? 'performing' : 'idle'] = called
    }
    room.performing = false
    return out
  })
  console.log('L6 每帧实际调用的 fx 数:')
  console.log('  平时      ' + r.idle)
  console.log('  起课时    ' + r.performing + (r.performing < r.idle ? '   ★起课时更少' : ''))
  await b.close()
})()
