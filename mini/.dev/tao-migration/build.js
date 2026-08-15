// Build the Taotao asset library: slice verbatim code, strip manual contact()
// (renderRoom draws contact shadows itself), measure bbox in headless Chrome,
// emit def() blocks + window.TAO_ROOM.
const fs = require('fs')
const path = require('path')
const { chromium } = require('/Users/doracawl/workspace/goliajp/buwanren/mini/node_modules/playwright')
const { A, SURFACES, PRELUDE, P_RUG, P_ROUND } = require('./spec.js')

const SRC = fs.readFileSync(__dirname + '/tao_furniture.js', 'utf8').split('\n')
const slice = (L) => L.map(([s, e]) => SRC.slice(s - 1, e).join('\n')).join('\n')

// pull contact(x,y,w) out of a code chunk -> {code, contacts:[[x,y,w]]}
function stripContact(code) {
  const contacts = []
  const out = code.replace(/contact\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)\s*;?/g, (m, x, y, w) => {
    if (/^-?[\d.]+$/.test(x) && /^-?[\d.]+$/.test(y) && /^-?[\d.]+$/.test(w))
      contacts.push([+x, +y, +w])
    return ''
  })
  return { code: out, contacts }
}

const built = A.map(a => {
  let raw = a.code != null ? a.code : slice(a.L)
  const { code, contacts } = stripContact(raw)
  let pre = PRELUDE
  if (a.rug) pre += P_RUG
  if (a.round) pre += P_ROUND
  return Object.assign({}, a, { body: code, pre, contacts })
})

;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  await p.goto('file://' + '/Users/doracawl/workspace/goliajp/buwanren/mini/design.html')
  await p.waitForTimeout(2500)

  // Measure on an oversized canvas with a margin: drawing on a bare 1440x2560
  // truncates any piece whose ink runs past the room edge (the light board's
  // glow does), which would bake a too-small bbox into the asset.
  const measured = await p.evaluate((items) => {
    const MG = 400, CW = 1440 + MG * 2, CH = 2560 + MG * 2
    const out = []
    for (const it of items) {
      const c = document.createElement('canvas'); c.width = CW; c.height = CH
      const g = c.getContext('2d')
      let err = null
      g.translate(MG, MG)
      try { new Function('g', it.pre + '\n' + it.body)(g) } catch (e) { err = e.message }
      const d = g.getImageData(0, 0, CW, CH).data
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
      for (let y = 0; y < CH; y++) {
        const row = y * CW * 4
        for (let x = 0; x < CW; x++) {
          if (d[row + x * 4 + 3] !== 0) {
            if (x < x0) x0 = x; if (x > x1) x1 = x
            if (y < y0) y0 = y; if (y > y1) y1 = y
          }
        }
      }
      out.push({
        id: it.id, err, empty: x1 < 0,
        x: x0 - MG, y: y0 - MG, w: x1 - x0 + 1, h: y1 - y0 + 1,
      })
    }
    return out
  }, built.map(x => ({ id: x.id, pre: x.pre, body: x.body })))

  await b.close()

  const bad = measured.filter(m => m.err || m.empty)
  if (bad.length) { console.error('MEASURE FAIL:', JSON.stringify(bad, null, 1)); process.exit(1) }
  const M = {}; measured.forEach(m => M[m.id] = m)

  // ── emit ──────────────────────────────────────────────────────────────
  const ind = s => s.split('\n').map(l => l.trim() ? '      ' + l : l).join('\n')
  let js = '\n  //>>> TAO ASSETS BEGIN (generated)\n'
  js += '  // ═══════════ 桃桃房素材（自 taoCanvas 硬编码迁移）═══════════\n'
  for (const a of built) {
    const m = M[a.id]
    // lint requires even sprite dims (pixel alignment); pad right/bottom so
    // the content keeps its measured origin.
    const W = m.w + (m.w % 2), H = m.h + (m.h % 2)
    // foot: prefer the original hand-placed contact() footprint, else bbox base strip
    let foot
    if (a.contacts.length) {
      const xs = a.contacts.map(c => c[0]), xe = a.contacts.map(c => c[0] + c[2])
      const ys = a.contacts.map(c => c[1])
      let fx = Math.min(...xs) - m.x, fw = Math.max(...xe) - Math.min(...xs)
      let fy = Math.min(...ys) - m.y
      fx = Math.max(0, fx); fy = Math.max(0, Math.min(fy, H - 4))
      fw = Math.min(fw, W - fx)
      foot = [fx, fy, fw, Math.min(Math.max(4, H - fy), H - fy)]
    } else if (a.wall || a.cat === '地面') {
      foot = [0, 0, 0, 0]
    } else {
      foot = [0, Math.max(0, H - 8), W, Math.min(8, H)]
    }
    const meta = []
    meta.push(`name: ${JSON.stringify(a.name)}, cat: ${JSON.stringify(a.cat)}, tags: ${JSON.stringify(a.tags)}`)
    meta.push(`scope: ${JSON.stringify(a.scope)}, fromRoom: 'tao'`)
    meta.push(`w: ${W}, h: ${H}, base: ${a.wall || a.cat === '地面' ? 0 : H}, foot: [${foot.join(', ')}]`)
    if (a.wall) meta.push(`wall: true`)
    if (a.zLayer) meta.push(`zLayer: ${JSON.stringify(a.zLayer)}`)
    if (a.sit) meta.push(`sit: true`)
    if (a.clickable) meta.push(`clickable: true, say: ${JSON.stringify(a.say)}`)
    js += `  def(${JSON.stringify(a.id)}, {\n    ${meta.join(',\n    ')},\n    draw(g) {\n`
    js += ind(a.pre.trim()) + '\n'
    // placeAsset pre-scales the sprite context 2x; the migrated code is authored
    // in full room pixels, so cancel it and shift the bbox origin to 0,0.
    js += `      g.save(); g.scale(0.5, 0.5); g.translate(${-m.x}, ${-m.y})\n`
    js += ind(a.body.trim()) + '\n'
    js += `      g.restore()\n    }\n  })\n`
  }

  // surfaces
  let sjs = '\n  // ═══ 桃桃房表面（竹席地板 / 抹灰墙）═══\n'
  sjs += `  defSurface('wall_taohua', {\n    name: '抹灰白墙 · 木梁', draw(g, W, hw, P) {\n`
    + ind(SURFACES.wall_taohua.trim()) + '\n    }\n  })\n'
  sjs += `  defSurface('floor_bamboo', {\n    name: '竹席地板', draw(g, W, H, hw, P) {\n`
    + ind(PRELUDE.trim()) + '\n' + ind(SURFACES.floor_bamboo.trim()) + '\n    }\n  })\n'

  // plan: each asset lands at its measured bbox origin. Multi-instance pieces
  // get the extra positions offset by the delta from the authored position.
  // Pieces the original drew in a position loop. First entry is the position
  // hardcoded in the asset's draw(); the rest are offset from it.
  const INSTANCES = {
    tao_lantern:      [[60, 34], [1360, 34]],
    tao_fan_round:    [[390, 150], [60, 230]],
    tao_yingluo:      [[300, 34], [660, 34]],
    tao_cushion_pink: [[620, 1310], [830, 1310]],
    tao_vase_peach:   [[430, 1400], [984, 620]],
    tao_orchid_pot:   [[64, 1080], [1380, 1430]],
  }
  // Small pieces that rest ON a larger one. The original painted them after
  // their host; under a pure baseY sort the host swallows them (measured: these
  // 7 rendered 0-47% visible). attach re-pins them above the host, which is
  // what the engine provides for exactly this case.
  const OPTS = {
    tao_blanket:         { attach: 'tao_bed', zBias: 2 },
    tao_headphones:      { attach: 'tao_bed', zBias: 3 },
    tao_swing_cushion:   { attach: 'tao_bed', zBias: 4 },
    tao_chips_cola:      { attach: 'tao_bed', zBias: 5 },
    tao_jewelry_box:     { attach: 'tao_vanity', zBias: 2 },
    tao_cosmetics:       { attach: 'tao_vanity', zBias: 3 },
    tao_candy_jar_glass: { attach: 'tao_table_tea', zBias: 2 },
  }
  const plan = []
  for (const a of built) {
    const m = M[a.id]
    const inst = INSTANCES[a.id]
    if (inst) {
      const [x0, y0] = inst[0]
      for (const [x, y] of inst) plan.push([a.id, m.x + (x - x0), m.y + (y - y0)])
    } else plan.push([a.id, m.x, m.y, OPTS[a.id]])
  }
  const planStr = plan.map(p => `['${p[0]}',${p[1]},${p[2]}${p[3] ? ',' + JSON.stringify(p[3]) : ''}]`)
  let rjs = '\n  window.TAO_ROOM = {\n    w: 1440, h: 2560, wallH: 430, extBand: 2160,\n'
    + "    surfaces: { wall: 'wall_taohua', floor: 'floor_bamboo' },\n"
    + "    palette: { wall:'#ece4d6', wallLine:'#8a6844', floor:'#b8c294', floorLine:'#98a476', skirt:'#6e5236' },\n"
    + "    gradePreset: 'peach',\n    plan: [\n"
  for (let i = 0; i < planStr.length; i += 3) rjs += '      ' + planStr.slice(i, i + 3).join(', ') + ',\n'
  rjs += '    ],\n  }\n'

  js += '  //<<< TAO ASSETS END\n'
  fs.writeFileSync(__dirname + '/out_assets.js', js)
  fs.writeFileSync(__dirname + '/out_surfaces.js', sjs)
  fs.writeFileSync(__dirname + '/out_room.js', rjs)
  console.log('built', built.length, 'assets;  plan entries', plan.length)
  console.log(measured.map(m => `  ${m.id.padEnd(26)} ${String(m.w).padStart(4)}x${String(m.h).padStart(4)} @ ${m.x},${m.y}`).join('\n'))
})()
