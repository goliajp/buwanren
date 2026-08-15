const { chromium } = require('playwright')
const fs = require('fs')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage({ viewport: { width: 1200, height: 1000 } })
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(3000)
  await p.click('#ayunCastBtn')
  await p.waitForTimeout(6000)          // 等他走到并开演
  const seen = []
  for (let i = 0; i < 10; i++) {
    await p.waitForTimeout(700)
    const l = await p.evaluate(() => {
      const c = document.getElementById('ayunCanvas')
      return (c && c.__interaction && c.__interaction.said) ? c.__interaction.said.text : null
    })
    if (l && seen[seen.length - 1] !== l) seen.push(l)
  }
  console.log('起课途中念白序列:')
  seen.forEach(x => console.log('   「' + x + '」'))
  const d = await p.evaluate(() => {
    const src = document.getElementById('ayunCanvas')
    const c = document.createElement('canvas'); c.width = 900; c.height = 700
    c.getContext('2d').drawImage(src, 300, 460, 900, 700, 0, 0, 900, 700)
    return c.toDataURL()
  })
  fs.writeFileSync('/tmp/rules/MUTTER.png', Buffer.from(d.split(',')[1], 'base64'))
  console.log('✓ /tmp/rules/MUTTER.png')
  await b.close()
})()
