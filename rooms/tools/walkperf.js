const { chromium } = require('playwright')
const ROOMARG = process.argv[3] || ''
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage({ viewport: { width: 1200, height: 1000 } })
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
  await p.click('#ayunCastBtn')
  for (const ms of [200, 2000, 5000, 8000]) {
    await p.waitForTimeout(ms === 200 ? 200 : ms === 2000 ? 1800 : ms === 5000 ? 3000 : 3000)
    const r = await p.evaluate(() => ({
      pending: !!window.__R.performPending,
      performing: !!window.__R.performing,
      dbg: window.__R._dbg,
    }))
    console.log('  +' + String(ms).padStart(4) + 'ms  pending=' + r.pending + '  performing=' + r.performing + '  ' + r.dbg)
  }
  await p.click('#ayunCastBtn')   // 收课
  await p.waitForTimeout(600)
  const off = await p.evaluate(() => ({
    pending: !!window.__R.performPending, performing: !!window.__R.performing,
    label: document.getElementById('ayunCastBtn').textContent }))
  console.log('  收课后  pending=' + off.pending + '  performing=' + off.performing + '  「' + off.label + '」')
  await b.close()
})()
