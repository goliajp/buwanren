const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
  await p.goto('file://' + require('path').resolve(process.argv[2]))
  await p.waitForTimeout(3000)
  const r = await p.evaluate(() => ({
    ASSETS: typeof window.ASSETS, n: window.ASSETS ? Object.keys(window.ASSETS).length : -1,
    renderRoom: typeof window.renderRoom, placeAsset: typeof window.placeAsset,
    lintRoom: typeof window.lintRoom,
    // 报【发现到几间房】而不是单点 AYUN_ROOM 在不在 —— 这个探针是用来回答
    // 「页面到底加载起来没有」的,盯着一间房会在别的房塌掉时照样说一切正常
    rooms: Object.keys(window)
      .filter(k => /^[A-Z][A-Z0-9]*_ROOM$/.test(k))
      .filter(k => window[k] && Array.isArray(window[k].plan)),
  }))
  console.log(JSON.stringify(r))
  errs.slice(0,6).forEach(e => console.log(e.slice(0,300)))
  await b.close()})()
