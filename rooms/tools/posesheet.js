// 卧姿一览:仰卧 / 侧卧(左右)三向并排
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(2800)
  const d = await p.evaluate(() => {
    const specs = [['sleepv', false, '仰卧'], ['sleepside', false, '侧卧·面左'], ['sleepside', true, '侧卧·面右']]
    const pad = 40, cw = 140
    const cv = document.createElement('canvas')
    cv.width = pad + specs.length * (cw + pad); cv.height = 300
    const g = cv.getContext('2d')
    g.fillStyle = '#8a9ab8'; g.fillRect(0, 0, cv.width, cv.height)
    specs.forEach((sp, i) => {
      const spr = window.actorSprite('ayun', sp[0], sp[1])
      g.drawImage(spr, pad + i * (cw + pad) + (cw - spr.width) / 2, 24)
    })
    return cv.toDataURL()
  })
  fs.mkdirSync('/tmp/rules', { recursive: true }), fs.writeFileSync('/tmp/rules/POSESHEET.png', Buffer.from(d.split(',')[1], 'base64'))
  console.log('✓ /tmp/rules/POSESHEET.png')
  await b.close()
})()
