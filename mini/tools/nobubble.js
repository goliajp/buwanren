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
  console.log('点击后逐拍采样(走路途中不应有气泡):')
  for (let i = 0; i < 9; i++) {
    await p.waitForTimeout(600)
    const r = await p.evaluate(() => {
      const c = document.getElementById('ayunCanvas'), R = window.__R
      const said = (c && c.__interaction && c.__interaction.said) ? c.__interaction.said.text : null
      return { performing: !!R.performing, said: said, dbg: R._dbg }
    })
    const flag = (!r.performing && r.said) ? '   ★走路途中却有气泡' : ''
    console.log('  +' + String((i + 1) * 600).padStart(4) + 'ms  performing=' + (r.performing ? 'T' : 'F') +
                '  气泡=' + (r.said ? '「' + r.said + '」' : '无') + flag)
  }
  await b.close()
})()
