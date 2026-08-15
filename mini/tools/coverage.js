const { chromium } = require('playwright')
const ROOMARG = process.argv[3] || ''
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(2500)

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
    const M = window.assetManifest(), A = window.ASSETS
    const inRoom = new Set((window.__R.plan || []).map(e => e[0]))
    return M.filter(m => inRoom.has(m.id)).map(m => ({
      id: m.id, cat: m.cat, scope: m.scope, fx: m.fx, light: m.light,
      click: m.clickable, say: !!A[m.id].say
    }))
  })
  const F = r.filter(x => x.fx), L = r.filter(x => x.light), C = r.filter(x => x.click)
  console.log('房间内素材 ' + r.length + ' 件')
  console.log('  带动效 fx  ' + F.length + ': ' + F.map(x=>x.id).join(' '))
  console.log('  带光源     ' + L.length + ': ' + L.map(x=>x.id).join(' '))
  console.log('  可交互     ' + C.length + ': ' + C.map(x=>x.id).join(' '))
  console.log('  可交互但无台词: ' + (C.filter(x=>!x.say).map(x=>x.id).join(' ') || '无'))
  await b.close()
})()
