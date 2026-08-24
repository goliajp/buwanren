const { chromium } = require('playwright')
const ROOMARG = process.argv[3] || ''
const fs = require('fs')
const path = require('path')
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
  const d = await p.evaluate(() => {
    const room = window.__R
    const cv = document.createElement('canvas'); cv.width = 1440; cv.height = 2560
    const g = cv.getContext('2d')
    // 睡姿:与房间 ACTS 的 sleepAt 一致
    const acts = [window.placeActor('ayun', 1208 + 52, 508 + 114, 'sleepv', false,
                                    { attach: 'bed_couch', zBias: 3 })]
    window.renderRoom(g, room, 0, acts)
    const c2 = document.createElement('canvas'); c2.width = 440; c2.height = 460
    c2.getContext('2d').drawImage(cv, 1060, 430, 400, 440, 0, 0, 440, 460)
    return c2.toDataURL()
  })
  fs.mkdirSync('/tmp/rules', { recursive: true }), fs.writeFileSync('/tmp/rules/POSE.png', Buffer.from(d.split(',')[1], 'base64'))
  console.log('✓ /tmp/rules/POSE.png')
  await b.close()
})()
