#!/usr/bin/env bun
/**
 * plancheck —— S3 平面图校验(素材还没画的时候用)
 *
 * S3 是硬规则:纯坐标先于任何绘制。跳过它直接画,换来过 137 个 commit 全线回退。
 * 但那时素材还没画、没有真 `foot`,所以按 `kind` 推占地:
 *   wall / attach / decal / walkable → 不占地
 *   flat  平放家具(桌/床/垫/箱)      → 整个 w×h(俯视看得到整个顶面)
 *   upright 立式家具(架/柜/灯/屏)    → 底边一条(下 28%)
 *
 * ⚠ 主角房**不能**用 `planlint.py` —— 它只解析村民房的 `FULLROOMS.<name>={obs:[]}`,
 *   对主角房会打印「0/36 间违规」这种干净的假绿。
 * ⚠ 这一步过了**不等于**布局对了。S5 画完素材必须【回头】跑 `assetlint`(真 foot)
 *   和 `roomaudit D`(foot vs 实体像素) —— 见 WORKFLOW S3 的依赖环。
 *
 * 用法:bun tools/plancheck.js <plan-xxx.js 路径>
 */
const path = require('path')
const FILE = process.argv[2]
if (!FILE) { console.error('用法: bun tools/plancheck.js <plan-xxx.js 路径>'); process.exit(2) }
const P = require(path.resolve(FILE))

const CELL = 40, PAD = 8
const W = P.w || 1440, H = P.h || 2560, WALLH = P.wallH || 440

// ── 占地推导 ──
function foot(it) {
  const k = it.kind || 'flat'
  if (k === 'wall' || k === 'attach' || k === 'decal' || k === 'walkable') return null
  if (k === 'upright') {
    const fh = Math.max(12, Math.round(it.h * 0.28))
    return { x: it.x, y: it.y + it.h - fh, w: it.w, h: fh }
  }
  return { x: it.x, y: it.y, w: it.w, h: it.h }   // flat
}

let bad = 0, note = 0
console.log(`══ ${path.basename(FILE)} · 平面图体检 ══`)
console.log(`   画布 ${W}×${H} · 墙高 ${WALLH} · 件数 ${P.items.length}\n`)

// ── ① 越界 ──
console.log('① 越界')
let n1 = 0
for (const it of P.items) {
  const over = []
  if (it.x < 0) over.push(`左 ${-it.x}px`)
  if (it.y < 0) over.push(`上 ${-it.y}px`)
  if (it.x + it.w > W) over.push(`右 ${it.x + it.w - W}px`)
  if (it.y + it.h > H) over.push(`下 ${it.y + it.h - H}px`)
  if (over.length) { bad++; n1++; console.log(`   ✗ ${it.id} 超出画布: ${over.join(' · ')}`) }
}
if (!n1) console.log('   ✓ 无越界')

// ── ② 墙面件必须在墙上,地面件不许上墙 ──
console.log('\n② 墙面 / 地面归属')
let n2 = 0
for (const it of P.items) {
  if (it.kind === 'wall' && it.y + it.h > WALLH + 90) {
    note++; n2++; console.log(`   · ${it.id} 标了 wall 却挂到 y${it.y + it.h}(墙底 ${WALLH})—— 确认是有意的`)
  }
  if (it.kind !== 'wall' && it.kind !== 'attach' && it.y + it.h < WALLH) {
    bad++; n2++; console.log(`   ✗ ${it.id} 整件在墙里(y${it.y}–${it.y + it.h})却不是 wall 件`)
  }
}
if (!n2) console.log('   ✓ 归属正确')

// ── ③ 实体占地重叠 ──
console.log('\n③ 占地重叠')
const solid = P.items.map(it => ({ it, f: foot(it) })).filter(o => o.f)
let n3 = 0
for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
  const a = solid[i].f, b = solid[j].f
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (ox > 12 && oy > 12) {
    n3++; note++
    console.log(`   · ${solid[i].it.id} ↔ ${solid[j].it.id}  ${ox}×${oy}px（2.5D 下大件上部探出属正常,人工看一眼）`)
  }
}
if (!n3) console.log('   ✓ 无重叠')

// ── ④ 通道宽度 ──
console.log('\n④ 通道(NAV 格 40px,窄于此角色过不去)')
let n4 = 0
for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
  const a = solid[i].f, b = solid[j].f
  const gx = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)
  const gy = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)
  const vOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 20
  const hOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 20
  if (vOverlap && gx > 0 && gx < CELL) { n4++; note++; console.log(`   · ${solid[i].it.id} ↔ ${solid[j].it.id} 横向仅 ${gx}px`) }
  if (hOverlap && gy > 0 && gy < CELL) { n4++; note++; console.log(`   · ${solid[i].it.id} ↔ ${solid[j].it.id} 纵向仅 ${gy}px`) }
}
if (!n4) console.log('   ✓ 无过窄通道')

// ── ⑤ 可达性:从门口 BFS,不许有孤岛 ──
console.log('\n⑤ 可达性(从门口 BFS)')
const COLS = Math.ceil(W / CELL), ROWS = Math.ceil(H / CELL)
const G = new Uint8Array(COLS * ROWS)
for (let r = 0; r < Math.floor(WALLH / CELL); r++) for (let c = 0; c < COLS; c++) G[r * COLS + c] = 1
for (const { f } of solid) {
  const c0 = Math.max(0, ((f.x - PAD) / CELL) | 0), c1 = Math.min(COLS - 1, ((f.x + f.w + PAD) / CELL) | 0)
  const r0 = Math.max(0, ((f.y - PAD) / CELL) | 0), r1 = Math.min(ROWS - 1, ((f.y + f.h + PAD) / CELL) | 0)
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) G[r * COLS + c] = 1
}
const free = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !G[r * COLS + c]
const [dx, dy] = P.door || [W / 2, H - 120]
let start = [(dx / CELL) | 0, (dy / CELL) | 0]
if (!free(start[0], start[1])) {
  outer: for (let r = ROWS - 1; r >= 0; r--) for (let c = 0; c < COLS; c++) if (free(c, r)) { start = [c, r]; break outer }
}
const seen = new Set([start[1] * COLS + start[0]]), q = [start]
while (q.length) {
  const [c, r] = q.shift()
  for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nc = c + ddx, nr = r + ddy, k = nr * COLS + nc
    if (free(nc, nr) && !seen.has(k)) { seen.add(k); q.push([nc, nr]) }
  }
}
let total = 0
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (free(c, r)) total++
const island = total - seen.size
if (island > 0) {
  bad++
  console.log(`   ✗ ${island} 格走不到(空闲 ${total} / 可达 ${seen.size})`)
  // 报出孤岛【在哪】+ 被谁围住 —— 只说有几格没法修
  const spots = []
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    if (free(c, r) && !seen.has(r * COLS + c)) spots.push([c * CELL, r * CELL])
  const nearby = (x, y) => solid.filter(o => {
    const f = o.f
    return x > f.x - 60 && x < f.x + f.w + 60 && y > f.y - 60 && y < f.y + f.h + 60
  }).map(o => o.it.id)
  const shown = spots.slice(0, 6)
  for (const [x, y] of shown) {
    const who = [...new Set(nearby(x, y))]
    console.log(`      (${x},${y}) 被围住 —— 周边: ${who.join(' · ') || '(墙角)'}`)
  }
  if (spots.length > shown.length) console.log(`      …另有 ${spots.length - shown.length} 格`)
} else console.log(`   ✓ 空闲格全可达(${total} 格,无孤岛)`)

/* ── ⑥ 分界线对账 ──────────────────────────────────────────────
   每间房的分界线维度不同,`层` 字段填什么由那间房的立意决定:
     沈砚 = 表 / 底(层积)   白鹭 = 盖 / 露(白布覆盖)
   原先这里写死了「表/底」,换一间房就静静地什么都不查 —— 那是又一种假绿。
   改成:统计除 '—' 外的所有取值,**至少两类且每类都不止一件**才算立得住。
   分界线靠【重复】成为语言:只有一两件的那一侧,玩家读不出来。 */
const tally = {}
for (const it of P.items) {
  const v = it.层
  if (!v || v === '—' || v === '-') continue
  tally[v] = (tally[v] || 0) + 1
}
const kinds = Object.keys(tally)
if (kinds.length) {
  console.log('\n⑥ 分界线对账  ' + kinds.map(k => `${k} ${tally[k]}`).join(' · '))
  if (kinds.length < 2) { bad++; console.log('   ✗ 只有一侧,分界线立不住 —— 两侧都要有物件') }
  else {
    const thin = kinds.filter(k => tally[k] < 3)
    if (thin.length) { note++; console.log(`   · ${thin.join(' / ')} 这一侧只有 ${thin.map(k => tally[k]).join('/')} 件 —— 分界线靠重复成为语言,太少读不出来`) }
    else console.log('   ✓ 两侧都够厚')
  }
}

console.log('\n' + (bad ? `✗ ${bad} 项要改` : `✓ 结构全过` + (note ? ` · ${note} 处提示待人工看` : '')))
console.log('⚠ 这一步只验坐标。S5 画完素材必须【回头】跑 assetlint + roomaudit D 复查真 foot。')
if (bad) process.exit(1)
