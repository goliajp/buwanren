#!/usr/bin/env bun
/**
 * walklint —— 走路帧二体检(查「滑行」)
 *
 * poselint 查姿态【名字】齐不齐,查不出这个:名字齐全、值却是同一帧,
 * 角色走起来腿不动、整个人平移。丹增房就是这样带着滑行过了所有门禁 ——
 * `codexPoses` 把 SIDE 帧一同时赋给 walkside1 和 walkside3,帧二只有
 * `CODEX.WALK[id]` 提供时才有,而 WALK_OVR 只覆盖了少数角色。
 *
 * 两层都查:
 *   ① 数据层 CODEX —— 哪些角色规范里就没画走路帧二(生产前就该知道)
 *   ② 运行层 ACTORS —— 已注册角色实际会不会滑行(有房间自画帧二的会被救回)
 *
 * 用法:bun tools/walklint.js <design.html 绝对路径>
 */
const { chromium } = require('playwright')
const FILE = process.argv[2]
if (!FILE) { console.error('用法: bun tools/walklint.js <design.html 绝对路径>'); process.exit(2) }
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  await p.goto('file://' + FILE); await p.waitForTimeout(2500)
  const r = await p.evaluate(() => {
    const C = window.CODEX || {}
    const has = (S, id) => !!(S && S[id])
    const ids = new Set()
    for (const S of [C.FRONT, C.SIDE, C.BACK, C.WALK]) for (const k in (S || {})) ids.add(k)
    const codex = [...ids].sort().map(id => ({
      id,
      front: has(C.FRONT, id), side: has(C.SIDE, id), back: has(C.BACK, id),
      walkFront: !!((C.WALK || {})[id] || {}).front,
      walkSide:  !!((C.WALK || {})[id] || {}).side,
      walkBack:  !!((C.WALK || {})[id] || {}).back,
    }))
    // 运行层:已注册角色实际是否滑行
    const AC = window.ACTORS || {}
    const same = (P, a, c) => P[a] && P[c] && JSON.stringify(P[a]) === JSON.stringify(P[c])
    const actors = Object.keys(AC).sort().map(id => {
      const P = (AC[id] || {}).poses || {}
      const walks = Object.keys(P).filter(k => /^walk/.test(k))
      if (!walks.length) return { id, walks: 0 }
      const sideSlide = !P.walkside2 || same(P, 'walkside1', 'walkside2')
      const backSlide = !P.walkback2 || same(P, 'walkback1', 'walkback2')
      const frontSlide = !P.walkfront2 || same(P, 'walkfront1', 'walkfront2')
      return { id, walks: walks.length,
               hasSide: !!P.walkside1, hasBack: !!P.walkback1, hasFront: !!P.walkfront1,
               sideSlide, backSlide, frontSlide }
    })
    return { codex, actors }
  })

  console.log('══ ① 规范层 CODEX —— 走路帧二覆盖 ══')
  const noStride = r.codex.filter(c => (c.side && !c.walkSide) || (c.back && !c.walkBack))
  console.log(`  角色 ${r.codex.length} 个 · 有 side/back 帧一但【缺走路帧二】: ${noStride.length} 个`)
  if (noStride.length) console.log('  ' + noStride.map(c => c.id).join(' '))
  console.log('  ↑ 这些角色的房间若直接用 codex 走姿而不自画帧二,侧/背走【必然滑行】')

  console.log('\n══ ② 运行层 ACTORS —— 实际滑不滑 ══')
  let bad = 0
  for (const a of r.actors) {
    if (!a.walks) { console.log(`  ${a.id.padEnd(10)} 无走姿(静态角色/宠物,跳过)`); continue }
    const f = []
    if (a.hasSide && a.sideSlide) f.push('侧走滑行')
    if (a.hasBack && a.backSlide) f.push('背走滑行')
    if (a.hasFront && a.frontSlide) f.push('正走滑行')
    if (f.length) bad++
    console.log(`  ${a.id.padEnd(10)} 走姿 ${String(a.walks).padStart(2)}  ${f.length ? '✗ ' + f.join(' · ') : '✓ 四向都有真帧二'}`)
  }
  console.log('\n' + (bad ? `✗ ${bad} 个角色在滑行 —— 补 WALK_OVR 帧二(基于 SIDE/BACK 帧一躯干改腿部),或房间自画` : '✓ 已注册角色全部不滑行'))
  await b.close()
  if (bad) process.exit(1)
})()
