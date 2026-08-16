const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage({ viewport: { width: 1200, height: 1000 } })
  await p.goto('file://' + process.argv[2])
  await p.waitForTimeout(3000)
  const r = await p.evaluate(() => {
    const ds = document.querySelector('.doc-stage')
    const box = ds.getBoundingClientRect()
    const out = { docStage: {x:box.x, y:box.y, w:box.width, h:box.height}, children: [], overlappers: [] }
    for (const c of ds.children) {
      const b = c.getBoundingClientRect()
      out.children.push({ cls: c.className, tag: c.tagName, y: Math.round(b.y), h: Math.round(b.height), w: Math.round(b.width) })
    }
    // 找与 doc-stage 区域重叠、但不在其内部的元素
    document.querySelectorAll('canvas, .phone, .slot').forEach(el => {
      if (ds.contains(el)) return
      const b = el.getBoundingClientRect()
      if (b.bottom > box.top && b.top < box.bottom && b.width > 0)
        out.overlappers.push({ cls: el.className, tag: el.tagName, y: Math.round(b.y), h: Math.round(b.height) })
    })
    return out
  })
  console.log(JSON.stringify(r, null, 1).slice(0, 2600))
  await b.close()
})()
