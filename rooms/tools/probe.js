const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
  await p.goto('file://' + process.argv[2])
  await p.waitForTimeout(3000)
  const r = await p.evaluate(() => ({
    ASSETS: typeof window.ASSETS, n: window.ASSETS ? Object.keys(window.ASSETS).length : -1,
    renderRoom: typeof window.renderRoom, placeAsset: typeof window.placeAsset,
    lintRoom: typeof window.lintRoom, AYUN_ROOM: typeof window.AYUN_ROOM,
  }))
  console.log(JSON.stringify(r))
  errs.slice(0,6).forEach(e => console.log(e.slice(0,300)))
  await b.close()})()
