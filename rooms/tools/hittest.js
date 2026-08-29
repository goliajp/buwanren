// 验证命中检测:对每个可点素材,统计其包围盒内真正响应的像素占比
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
    const A = window.ASSETS, room = window.__R, out = []
    for (const e of room.plan) {
      const a = A[e[0]]
      if (!a || !a.clickable) continue
      const inst = window.placeAsset(e[0], e[1], e[2], {})
      const d = inst.cv.getContext('2d').getImageData(0, 0, inst.cv.width, inst.cv.height).data
      let on = 0
      for (let i = 3; i < d.length; i += 4) if (d[i] > 24) on++
      const total = inst.cv.width * inst.cv.height
      out.push({ id: e[0], w: a.w, h: a.h, fill: Math.round(on / total * 100) })
    }
    return out.sort((x, y) => x.fill - y.fill)
  })
  console.log('可点素材:包围盒内实际像素占比(越低说明包围盒越虚)')
  r.forEach(x => console.log('  ' + x.id.padEnd(18) + String(x.w).padStart(4) + '×' + String(x.h).padEnd(4) +
    '  实心 ' + String(x.fill).padStart(3) + '%' + (x.fill < 35 ? '   ← 包围盒大量留空,逐像素命中是必需的' : '')))
  await b.close()
})()
