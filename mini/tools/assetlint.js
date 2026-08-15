const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  await p.goto('file://' + process.argv[2])
  await p.waitForTimeout(2500)
  const r = await p.evaluate(() => {
    const A = window.ASSETS || {}
    const byCat = {}
    for (const id of Object.keys(A)) { const c = A[id].cat || '?' ; byCat[c] = (byCat[c]||0)+1 }
    // 布局校验【逐房】跑 —— 从前只看 AYUN_ROOM,另三房的布局问题门禁根本够不着
    const keys = Object.keys(window)
      .filter(k => /^[A-Z][A-Z0-9]*_ROOM$/.test(k))
      .filter(k => window[k] && Array.isArray(window[k].plan)).sort()
    // 可达性:从最下方的空闲格 BFS,数有没有【走不到的孤岛】。
    // WORKFLOW S3 一直写着这条判据,却从来没有工具在查 —— 角色去不了的区域,
    // 摆在那里的家具和台词就等于不存在。
    const reach = (room) => {
      const G = window.roomGrid(room), CELL = 40
      const COLS = Math.ceil(room.w / CELL), ROWS = Math.ceil((room.extBand || room.h) / CELL)
      const free = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && !G[y * COLS + x]
      let start = null
      for (let y = ROWS - 1; y >= 0 && !start; y--) for (let x = 0; x < COLS; x++)
        if (free(x, y)) { start = [x, y]; break }
      if (!start) return { total: 0, seen: 0 }
      const seen = new Set([start[1] * COLS + start[0]]), q = [start]
      while (q.length) {
        const [x, y] = q.shift()
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, k = ny * COLS + nx
          if (free(nx, ny) && !seen.has(k)) { seen.add(k); q.push([nx, ny]) }
        }
      }
      let total = 0
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (free(x, y)) total++
      return { total, seen: seen.size }
    }
    const rooms = keys.map(k => ({
      key: k, plan: window[k].plan.length,
      lint: window.lintRoom ? window.lintRoom(window[k]) : null,
      tight: (window.layout ? window.layout.tightSpots(window[k], 80) : null),
      reach: reach(window[k]),
    }))
    return { total: Object.keys(A).length, byCat, lint: (window.lintAssets ? window.lintAssets() : null),
             actors: Object.keys(window.ACTORS||{}), rooms,
             scopes: (function(){ const A=window.ASSETS||{}, o={}; for(const k in A){ const v=A[k].scope||'?'; o[v]=(o[v]||0)+1 } return o })() }
  })
  console.log('素材总数:', r.total, '| 角色资源:', r.actors.join(', '))
  console.log('分类:', Object.entries(r.byCat).map(([k,v])=>k+' '+v).join(' · '))
  if (!r.lint) console.log('校验器未加载')
  else if (!r.lint.length) console.log('✓ 规范校验全部通过')
  else { console.log('✗ ' + r.lint.length + ' 件不合规:'); r.lint.forEach(x => console.log('   ' + x.id + ': ' + x.errs.join(', '))) }
  if (r.scopes) console.log('作用域:', Object.entries(r.scopes).map(([k,v])=>k+' '+v).join(' · '))
  console.log('\n══ 逐房布局 (' + r.rooms.length + ' 间) ══')
  let bad = 0
  for (const R of r.rooms) {
    console.log('── ' + R.key + '  实例 ' + R.plan)
    const LE = (R.lint && R.lint.errs) || [], LN = (R.lint && R.lint.notes) || []
    if (LE.length) { bad += LE.length; console.log('   ✗ 布局问题 ' + LE.length + ' 处:'); LE.forEach(e => console.log('     ' + e)) }
    else if (R.lint) console.log('   ✓ 布局校验通过')
    if (LN.length) { console.log('   · 提示 ' + LN.length + ' 处:'); LN.forEach(e => console.log('     ' + e)) }
    if (R.tight && R.tight.length) {
      console.log('   通道偏窄 ' + R.tight.length + ' 处(<80px,人工判断):')
      R.tight.slice(0, 4).forEach(x => console.log('     ' + x.a + ' ↔ ' + x.b + '  ' + x.gap + 'px'))
    } else if (R.tight) console.log('   ✓ 无过窄通道')
    const RE = R.reach || {}
    const island = (RE.total || 0) - (RE.seen || 0)
    if (island > 0) { bad += 1; console.log('   ✗ 有 ' + island + ' 格【走不到的孤岛】(空闲 ' + RE.total + ' / 可达 ' + RE.seen + ')') }
    else console.log('   ✓ 空闲格全可达(' + RE.total + ' 格,无孤岛)')
  }
  await b.close()
  if (bad) process.exit(1)
})()
