// Definitive "nothing is lost" test: drop each plan entry in turn and see how
// many pixels of the final render change. 0 => that piece is fully hidden.
const { chromium } = require('/Users/doracawl/workspace/goliajp/buwanren/mini/node_modules/playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  await p.goto('file:///Users/doracawl/workspace/goliajp/buwanren/mini/design.html')
  await p.waitForTimeout(4000)
  const r = await p.evaluate(() => {
    const room = window.TAO_ROOM
    const mk = () => { const c = document.createElement('canvas'); c.width = 1440; c.height = 2560; return c }
    const render = (plan) => {
      const c = mk()
      window.renderRoom(c.getContext('2d'), Object.assign({}, room, { plan }), 0, [])
      return c.getContext('2d').getImageData(0, 0, 1440, 2560).data
    }
    const full = render(room.plan)
    const out = []
    for (let i = 0; i < room.plan.length; i++) {
      const without = render(room.plan.filter((_, k) => k !== i))
      let n = 0
      for (let q = 0; q < full.length; q += 4)
        if (full[q] !== without[q] || full[q + 1] !== without[q + 1] || full[q + 2] !== without[q + 2]) n++
      out.push({ id: room.plan[i][0], x: room.plan[i][1], y: room.plan[i][2], visible: n })
    }
    return out.sort((u, v) => u.visible - v.visible)
  })
  await b.close()
  const hidden = r.filter(x => x.visible === 0)
  const faint = r.filter(x => x.visible > 0 && x.visible < 400)
  console.log('plan entries:', r.length)
  console.log('FULLY HIDDEN:', hidden.length ? hidden.map(h => h.id + '@' + h.x + ',' + h.y).join(', ') : 'none')
  console.log('barely visible (<400px):')
  faint.forEach(f => console.log('   ' + f.id.padEnd(24) + '@' + f.x + ',' + f.y + '  ' + f.visible + 'px'))
})()
