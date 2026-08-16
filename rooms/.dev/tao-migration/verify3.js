// (1) clipping test: redraw each asset with a 6px margin, assert no ink escapes
//     the declared w/h box -> proves no bbox is too small.
// (2) attribute the remaining structural diff to individual plan instances.
const fs = require('fs')
const { chromium } = require('/Users/doracawl/workspace/goliajp/buwanren/mini/node_modules/playwright')
const DIR = __dirname
const SRC = fs.readFileSync(DIR + '/tao_furniture.js', 'utf8').split('\n')
const bodyNoGrade = SRC.slice(6, 931).concat(SRC.slice(939, 956)).join('\n')

;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  await p.goto('file:///Users/doracawl/workspace/goliajp/buwanren/rooms/design.html')
  await p.waitForTimeout(4000)

  const r = await p.evaluate((src) => {
    const M = 6
    // ── clipping test ──
    const clip = []
    for (const id of Object.keys(window.ASSETS)) {
      if (!id.startsWith('tao_')) continue
      const a = window.ASSETS[id]
      const c = document.createElement('canvas'); c.width = a.w + M * 2; c.height = a.h + M * 2
      const g = c.getContext('2d')
      g.translate(M, M); g.scale(2, 2)          // mirror placeAsset's own 2x
      a.draw(g, {})
      const d = g.getImageData(0, 0, c.width, c.height).data
      let esc = 0
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const inBox = x >= M && x < M + a.w && y >= M && y < M + a.h
        if (!inBox && d[(y * c.width + x) * 4 + 3] > 0) esc++
      }
      if (esc) clip.push({ id, escaped: esc })
    }
    // ── per-instance diff attribution (grade neutralised) ──
    const mk = () => { const c = document.createElement('canvas'); c.width = 1440; c.height = 2560; return c }
    const A = mk(); new Function('g', src)(A.getContext('2d'))
    const room = Object.assign({}, window.TAO_ROOM, {
      grade: 'rgba(0,0,0,0)', extBand: 0, dust: false,
      gradeOverride: { tone: '0,0,0', strength: 0, vignette: 0, lift: null },
    })
    const B = mk(); const inst = window.renderRoom(B.getContext('2d'), room, 0, [])
    const da = A.getContext('2d').getImageData(0, 0, 1440, 2560).data
    const db = B.getContext('2d').getImageData(0, 0, 1440, 2560).data
    const bad = new Uint8Array(1440 * 2560)
    let totalBig = 0
    for (let i = 0; i < da.length; i += 4) {
      let dm = 0
      for (let k = 0; k < 3; k++) { const q = Math.abs(da[i + k] - db[i + k]); if (q > dm) dm = q }
      if (dm > 8) { bad[i / 4] = 1; totalBig++ }
    }
    const attr = inst.map(o => {
      let n = 0
      const x1 = Math.min(1440, o.x + o.cv.width), y1 = Math.min(2560, o.y + o.cv.height)
      for (let y = Math.max(0, o.y); y < y1; y++)
        for (let x = Math.max(0, o.x); x < x1; x++) if (bad[y * 1440 + x]) n++
      return { id: o.id, x: o.x, y: o.y, bad: n }
    }).sort((u, v) => v.bad - u.bad)
    return { clip, totalBig, top: attr.slice(0, 14) }
  }, bodyNoGrade)
  await b.close()
  console.log('=== clipping test (ink outside declared w/h) ===')
  console.log(r.clip.length ? JSON.stringify(r.clip) : '  none — every bbox fully contains its drawing')
  console.log('\n=== structural diff attribution (>8/255, grade off) ===')
  console.log('total structural pixels:', r.totalBig)
  r.top.forEach(t => console.log('  ' + t.id.padEnd(24) + ' @' + t.x + ',' + t.y + '  ' + t.bad))
})()
