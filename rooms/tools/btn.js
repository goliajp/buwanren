const { chromium } = require('playwright')
const ROOMARG = process.argv[3] || ''
const fs = require('fs')
const path = require('path')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage({ viewport: { width: 1200, height: 1000 } })
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
  // 同 nobubble:选了房还按阿云的按钮,报出来的是两间房拌在一起的状态
  const base = await p.evaluate(() => window.__RBASE)
  console.log('房间:' + base)
  const before = await p.evaluate(() => !!(window.__R && window.__R.performing))
  await p.click(`#${base}CastBtn`)
  await p.waitForTimeout(1200)
  const after = await p.evaluate(() => ({
    performing: !!window.__R.performing,
    label: document.getElementById(window.__RBASE + 'CastBtn').textContent
  }))
  console.log('点击前 performing=' + before)
  console.log('点击后 performing=' + after.performing + ' · 按钮文字「' + after.label + '」')
  const d = await p.evaluate(() => {
    const src = document.getElementById(window.__RBASE + 'Canvas')
    const c = document.createElement('canvas'); c.width = 560; c.height = 620
    c.getContext('2d').drawImage(src, 460, 700, 560, 620, 0, 0, 560, 620)
    return c.toDataURL()
  })
  fs.mkdirSync('/tmp/rules', { recursive: true }), fs.writeFileSync('/tmp/rules/BTN.png', Buffer.from(d.split(',')[1], 'base64'))
  console.log('✓ /tmp/rules/BTN.png')
  await b.close()
})()
