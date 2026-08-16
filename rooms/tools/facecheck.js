const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  await p.goto('file://' + process.argv[2])
  await p.waitForTimeout(2500)
  const r = await p.evaluate(() => {
    const out = []
    for (const flip of [false, true]) {
      const cv = window.actorSprite('ayun', 'standside', flip)
      const g = cv.getContext('2d')
      const d = g.getImageData(0, 0, cv.width, cv.height).data
      let L = 0, R = 0
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4
        // 肤色 #f0c8a0
        if (d[i] > 220 && d[i+1] > 180 && d[i+1] < 215 && d[i+2] > 140 && d[i+2] < 190) {
          if (x < cv.width / 2) L++; else R++
        }
      }
      out.push({ flip, L, R, facing: R > L ? '朝右' : '朝左' })
    }
    return out
  })
  r.forEach(x => console.log(`flip=${String(x.flip).padEnd(5)} 左半肤色 ${String(x.L).padStart(4)} · 右半 ${String(x.R).padStart(4)} → ${x.facing}`))
  console.log('\n判定:向右走(dx>0)应使用 flip=' + (r[0].facing === '朝右' ? 'false' : 'true'))
  await b.close()
})()
