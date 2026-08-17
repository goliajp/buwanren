// 起课途中的念白序列 —— 点「起课」,每 700ms 取一次气泡文字,去重成序列。
//
// 从前整个文件写死 ayunCanvas / ayunCastBtn,拿它看别的房只会得到阿云的念白。
// 房间可选:第三个参数给房间名(tenz / bailu / …),不给则用发现到的第一间。
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const ROOMARG = process.argv[3] || ''
const OUT = process.argv[4] || '/tmp/rules/MUTTER.png'
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage({ viewport: { width: 1200, height: 1000 } })
  await p.goto('file://' + require('path').resolve(process.argv[2])); await p.waitForTimeout(3000)

  const base = await p.evaluate((want) => {
    const keys = Object.keys(window)
      .filter(k => /^[A-Z][A-Z0-9]*_ROOM$/.test(k))
      .filter(k => window[k] && Array.isArray(window[k].plan)).sort()
    if (!keys.length) return null
    const key = want && keys.includes(want) ? want : keys[0]
    return key.replace(/_ROOM$/, '').toLowerCase()
  }, (ROOMARG || '').toUpperCase().replace(/(_ROOM)?$/, '_ROOM'))
  if (!base) { console.error('✗ 一间房都没发现'); await b.close(); process.exit(2) }
  console.log(`房间:${base}`)

  await p.click(`#${base}CastBtn`)
  await p.waitForTimeout(6000)          // 等他走到并开演
  const seen = []
  for (let i = 0; i < 10; i++) {
    await p.waitForTimeout(700)
    const l = await p.evaluate((id) => {
      const c = document.getElementById(id)
      return (c && c.__interaction && c.__interaction.said) ? c.__interaction.said.text : null
    }, base + 'Canvas')
    if (l && seen[seen.length - 1] !== l) seen.push(l)
  }
  console.log('起课途中念白序列:')
  seen.forEach(x => console.log('   「' + x + '」'))
  const d = await p.evaluate((id) => {
    const src = document.getElementById(id)
    const c = document.createElement('canvas'); c.width = 900; c.height = 700
    c.getContext('2d').drawImage(src, 300, 460, 900, 700, 0, 0, 900, 700)
    return c.toDataURL()
  }, base + 'Canvas')
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, Buffer.from(d.split(',')[1], 'base64'))
  console.log('✓ ' + OUT)
  await b.close()
})()
