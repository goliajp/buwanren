#!/usr/bin/env bun
/**
 * symlint —— 正面 / 背面的【左右对称】体检(规范 B0 数据)
 *
 * 人正对或背对镜头时左右是对称的。规范的 FRONT_OVR / BACK_OVR 里
 * 大量角色的身体几行不对称 —— 常见成因是【身体宽度是奇数】
 * (例如 `KCCCCCK` 占 7 格),在 12 列的偶数画布里根本无法居中,
 * 于是整块身体偏左或偏右一格。渲染出来就是「人是歪的」。
 *
 * ⚠ 不对称【未必是错】——单肩袈裟、扛着的扫帚、张开的翅膀、侧挎的包
 *   本来就不对称。所以本工具只报事实与成因,不判对错:
 *     · 只有身体几行不对称  → 大概率是居中问题,可修
 *     · 从头到脚全不对称    → 大概率是道具/造型,人工看一眼
 *
 * 侧面(SIDE_OVR / WALK.side)不参与 —— 侧影本来就不该对称。
 *
 * 用法:bun tools/symlint.js <design.html 绝对路径> [角色 id]
 */
const fs = require('fs')
const FILE = process.argv[2], ONLY = process.argv[3]
if (!FILE) { console.error('用法: bun tools/symlint.js <design.html 绝对路径> [角色 id]'); process.exit(2) }
const S = fs.readFileSync(FILE, 'utf8')

function tableIds(tag) {
  const i = S.indexOf(`var ${tag}={`)
  if (i < 0) return []
  const j = S.indexOf('\n    };', i)
  return [...S.slice(i, j).matchAll(/(\w+):\{pal:/g)].map(m => m[1])
}
function rowsOf(tag, id) {
  const i = S.indexOf(`var ${tag}={`)
  const k = S.indexOf(id + ':{', i)
  if (k < 0) return null
  const r = S.indexOf('rows:[', k), e = S.indexOf(']}', k)
  if (r < 0 || e < 0 || r > e) return null
  return [...S.slice(r, e).matchAll(/'([^']*)'/g)].map(m => m[1])
}

let bodyOnly = 0, whole = 0, clean = 0
const report = []
for (const tag of ['FRONT_OVR', 'BACK_OVR']) {
  for (const id of tableIds(tag)) {
    if (ONLY && id !== ONLY) continue
    const rows = rowsOf(tag, id)
    if (!rows || !rows.length) continue
    const bad = []
    rows.forEach((r, n) => { if (r !== [...r].reverse().join('')) bad.push(n + 1) })
    if (!bad.length) { clean++; continue }
    // 身体大致在下半 —— 只有下半歪 = 居中问题;上下都歪 = 多半是造型/道具
    const half = Math.ceil(rows.length / 2)
    const upper = bad.filter(n => n <= half).length
    const kind = upper === 0 ? '身体偏移' : (bad.length === rows.length ? '整体造型' : '混合')
    if (kind === '身体偏移') bodyOnly++; else whole++
    // 成因:内容宽度与画布宽度的奇偶不一致时无法居中
    const why = bad.map(n => {
      const r = rows[n - 1]
      const w = r.length, inner = r.replace(/^\.+|\.+$/g, '').length
      return ((w - inner) % 2) ? `第${n}行 内容${inner}/画布${w} 奇偶不同,无法居中` : `第${n}行 内容不镜像`
    })
    report.push({ id, tag: tag.replace('_OVR', ''), n: bad.length, all: rows.length, kind, bad, why })
  }
}
report.sort((a, b) => (a.kind === b.kind ? b.n - a.n : (a.kind === '身体偏移' ? -1 : 1)))
console.log('══ 正/背左右对称体检 ══\n')
for (const r of report) {
  console.log(`${r.id.padEnd(11)} ${r.tag.padEnd(6)} ${String(r.n).padStart(2)}/${r.all} 行  【${r.kind}】`)
  if (ONLY) r.why.forEach(w => console.log('    · ' + w))
}
console.log(`\n对称 ${clean} · 身体偏移 ${bodyOnly} · 造型/混合 ${whole}`)
console.log('⚠ 不对称未必是错 —— 单肩、扫帚、翅膀本来就不对称。')
console.log('  「身体偏移」那一类多半是【内容宽度与画布宽度奇偶不一致】,改宽一格即可居中。')
if (ONLY && !report.length) console.log('✓ ' + ONLY + ' 的正/背完全对称')
