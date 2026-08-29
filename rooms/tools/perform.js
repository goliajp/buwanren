const { chromium } = require('playwright')
const ROOMARG = process.argv[3] || ''
const fs = require('fs')
const path = require('path')
;(async () => {
  /* 自带的 chromium，不用装机版 Chrome —— 后者在这台机器上跑二三十秒就挨 SIGKILL
     （08-30 实测，见 docs/FINDING-2026-08-30-chrome-sigkill.md）。
     `regress.js` 是例外:它的基准哈希绑着浏览器，换一个就得重存，
     而那份基准记着 12 处已知漂移与存基准时的 commit，比这点稳定性值钱。 */
  const b = await chromium.launch()
  const p = await b.newPage()
  await p.goto('file://' + require('path').resolve(process.argv[2])); await p.waitForTimeout(3000)

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
    window.setPerform(true)
    const room = window.__R
    const cv = document.createElement('canvas'); cv.width = 1440; cv.height = 2560
    const g = cv.getContext('2d')
    const pa = room.perform.actor
    const acts = [window.placeActor('ayun', pa.x + 40, pa.y + 114, 'divine1', false)]
    window.renderRoom(g, room, 0, acts)
    const c2 = document.createElement('canvas'); c2.width = 560; c2.height = 620
    c2.getContext('2d').drawImage(cv, 460, 700, 560, 620, 0, 0, 560, 620)
    return c2.toDataURL()
  })
  fs.mkdirSync('/tmp/rules', { recursive: true }), fs.writeFileSync('/tmp/rules/PERFORM.png', Buffer.from(d.split(',')[1], 'base64'))
  console.log('✓ /tmp/rules/PERFORM.png')
  await b.close()
})()
