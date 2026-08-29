// 对比平时 / 起课时,炉口上方烟粒的像素量是否一致
const { chromium } = require('playwright')
const ROOMARG = process.argv[3] || ''
;(async () => {
  /* 自带的 chromium，不用装机版 Chrome —— 后者在这台机器上跑二三十秒就挨 SIGKILL
     （08-30 实测，见 docs/FINDING-2026-08-30-chrome-sigkill.md）。
     `regress.js` 是例外:它的基准哈希绑着浏览器，换一个就得重存，
     而那份基准记着 12 处已知漂移与存基准时的 commit，比这点稳定性值钱。 */
  const b = await chromium.launch()
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
    const room = window.__R, out = {}
    for (const perf of [false, true]) {
      room.performing = perf
      let tot = 0
      for (const tt of [400, 1200, 2000, 2800]) {
        const cv = document.createElement('canvas'); cv.width = 1440; cv.height = 2560
        const g = cv.getContext('2d')
        window.renderRoom(g, room, tt, [])
        // 丹炉上方烟柱区域
        const d = g.getImageData(430, 1480, 120, 230).data
        for (let i = 0; i < d.length; i += 4)
          if (d[i] > 212 && d[i+2] > 150 && d[i+2] > d[i] - 70) tot++   // 比地板浅、偏中性
      }
      out[perf ? 'performing' : 'idle'] = tot
    }
    room.performing = false
    return out
  })
  console.log('丹炉上方烟粒像素量(4 个时刻合计):')
  console.log('  平时    ' + r.idle)
  console.log('  起课时  ' + r.performing)
  const diff = Math.abs(r.idle - r.performing) / Math.max(1, r.idle)
  console.log(diff < 0.15 ? '✓ 两态一致,起课不再丢烟' : '✗ 仍有差异 ' + Math.round(diff * 100) + '%')
  await b.close()
})()
