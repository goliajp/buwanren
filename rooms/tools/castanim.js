const { chromium } = require('playwright')
const ROOMARG = process.argv[3] || ''
const fs = require('fs')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(3000)

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
  // 抓起课动画四拍
  const frames = await p.evaluate(() => {
    const room = window.__R
    room.performing = true
    const cv = document.createElement('canvas'); cv.width = 1440; cv.height = 2560
    const g = cv.getContext('2d')
    const pa = room.perform.actor
    const out = []
    for (const T of [0.18, 0.48, 0.74, 0.92]) {
      g.clearRect(0, 0, 1440, 2560)
      const acts = [window.placeActor('ayun', pa.x + 40, pa.y + 114, 'divine1', false)]
      window.renderRoom(g, room, T * 6400, acts)
      const c2 = document.createElement('canvas'); c2.width = 300; c2.height = 300
      c2.getContext('2d').drawImage(cv, 560, 940, 300, 300, 0, 0, 300, 300)
      out.push(c2.toDataURL())
    }
    room.performing = false
    return out
  })
  // 四拍拼成一张
  const { createCanvas, loadImage } = { createCanvas: null, loadImage: null }
  frames.forEach((f, i) => fs.writeFileSync('/tmp/rules/CAST' + i + '.png', Buffer.from(f.split(',')[1], 'base64')))
  console.log('✓ 四拍已导出 CAST0..3 (月将加时 / 四课 / 三传 / 定局)')
  await b.close()
})()
