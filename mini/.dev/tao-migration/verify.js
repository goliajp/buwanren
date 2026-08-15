// Render the migrated Taotao room, diff against baseline.png, emit
// side-by-side + heatmap, and report per-asset presence/placement.
const fs = require('fs')
const { chromium } = require('/Users/doracawl/workspace/goliajp/buwanren/mini/node_modules/playwright')
const DIR = __dirname

;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message))
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()) })
  await p.goto('file:///Users/doracawl/workspace/goliajp/buwanren/mini/design.html')
  await p.waitForTimeout(4000)

  const base64 = fs.readFileSync(DIR + '/baseline.png').toString('base64')

  const r = await p.evaluate(async (bs) => {
    const room = window.TAO_ROOM
    if (!room) return { fatal: 'window.TAO_ROOM missing' }
    // rebuilt static layer
    const nw = document.createElement('canvas'); nw.width = 1440; nw.height = 2560
    const inst = window.renderRoom(nw.getContext('2d'), room, 0, [])
    // baseline image
    const img = new Image()
    await new Promise(res => { img.onload = res; img.src = 'data:image/png;base64,' + bs })
    const ol = document.createElement('canvas'); ol.width = 1440; ol.height = 2560
    ol.getContext('2d').drawImage(img, 0, 0)

    const da = ol.getContext('2d').getImageData(0, 0, 1440, 2560).data
    const db = nw.getContext('2d').getImageData(0, 0, 1440, 2560).data
    // heatmap
    const hm = document.createElement('canvas'); hm.width = 1440; hm.height = 2560
    const hd = hm.getContext('2d').createImageData(1440, 2560)
    let diff = 0, big = 0
    for (let i = 0; i < da.length; i += 4) {
      let dm = 0
      for (let k = 0; k < 3; k++) { const d = Math.abs(da[i + k] - db[i + k]); if (d > dm) dm = d }
      if (dm) diff++
      if (dm > 8) big++
      const v = Math.min(255, dm * 6)
      hd.data[i] = v; hd.data[i + 1] = dm > 8 ? 0 : v; hd.data[i + 2] = dm > 24 ? 0 : v
      hd.data[i + 3] = 255
    }
    hm.getContext('2d').putImageData(hd, 0, 0)
    // side by side
    const sbs = document.createElement('canvas'); sbs.width = 1440 * 3 + 40; sbs.height = 2560
    const sg = sbs.getContext('2d')
    sg.fillStyle = '#222'; sg.fillRect(0, 0, sbs.width, sbs.height)
    sg.drawImage(ol, 0, 0); sg.drawImage(nw, 1460, 0); sg.drawImage(hm, 2920, 0)

    const total = 1440 * 2560
    // per-instance placement audit
    const audit = inst.map(o => {
      const c = o.cv.getContext('2d').getImageData(0, 0, o.cv.width, o.cv.height).data
      let on = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1
      for (let y = 0; y < o.cv.height; y++) for (let x = 0; x < o.cv.width; x++) {
        if (c[(y * o.cv.width + x) * 4 + 3] > 0) {
          on++
          if (x < minx) minx = x; if (x > maxx) maxx = x
          if (y < miny) miny = y; if (y > maxy) maxy = y
        }
      }
      return {
        id: o.id, x: o.x, y: o.y, w: o.cv.width, h: o.cv.height, on,
        // touching the sprite edge => content may be clipped by a too-small bbox
        clipL: minx === 0, clipT: miny === 0, clipR: maxx === o.cv.width - 1, clipB: maxy === o.cv.height - 1,
        offCanvas: o.x < 0 || o.y < 0 || o.x + o.cv.width > 1440 || o.y + o.cv.height > 2560,
      }
    })
    return {
      count: inst.length, diff, big, total,
      pct: (diff / total * 100).toFixed(2), bigPct: (big / total * 100).toFixed(2),
      sbs: sbs.toDataURL('image/png'), hm: hm.toDataURL('image/png'), nw: nw.toDataURL('image/png'),
      empty: audit.filter(a => a.on === 0).map(a => a.id),
      off: audit.filter(a => a.offCanvas).map(a => a.id + '@' + a.x + ',' + a.y),
      audit,
    }
  }, base64)

  await b.close()
  if (r.fatal) { console.error(r.fatal); process.exit(1) }
  const wr = (n, d) => fs.writeFileSync(DIR + '/' + n, Buffer.from(d.split(',')[1], 'base64'))
  wr('sidebyside.png', r.sbs); wr('heatmap.png', r.hm); wr('rebuilt.png', r.nw)
  fs.writeFileSync(DIR + '/audit.json', JSON.stringify(r.audit, null, 1))
  console.log('instances placed :', r.count)
  console.log('pixels differing :', r.diff, '=', r.pct + '%')
  console.log('  of which >8/255:', r.big, '=', r.bigPct + '%   (<-- structural, not alpha rounding)')
  console.log('empty sprites    :', r.empty.length ? r.empty.join(', ') : 'none')
  console.log('off-canvas       :', r.off.length ? r.off.join(', ') : 'none')
  const clipped = r.audit.filter(a => (a.clipL || a.clipT || a.clipR || a.clipB))
  console.log('edge-touching    :', clipped.length ? clipped.map(a => a.id).join(', ') : 'none')
  if (errs.length) console.log('page errors:\n  ' + errs.slice(0, 12).join('\n  '))
})()
