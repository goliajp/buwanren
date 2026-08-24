#!/usr/bin/env bun
/**
 * verify —— 房间完整验收
 *
 * 门禁工具各查一面（裸绘制 / 穿模 / 素材元数据 / 视觉回归），这支查【活的】：
 * 引擎装没装上、行为跑不跑得动、姿态查不查得到、交互点不点得到。
 *
 * 静默失败是这个项目最贵的错：姿态名写错会回退成 stand 而不报错、
 * 素材 draw 抛异常会被吞掉、交互没接上则所有 clickable 都是死的。
 * 所以每一项都【取回真值】比对，不看「有没有报错」。
 *
 * 用法：bun tools/verify.js <design.html 绝对路径>
 */
const { chromium } = require('playwright')

const FILE = process.argv[2]
if (!FILE) { console.error('用法: bun tools/verify.js <design.html 绝对路径>'); process.exit(2) }

;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage({ viewport: { width: 1200, height: 1000 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)))
  await p.goto('file://' + require('path').resolve(FILE))
  await p.waitForTimeout(6000)

  const r = await p.evaluate(async () => {
    const out = { engine: {}, rooms: {}, problems: [] }

    // ① 引擎装载
    const API = ['renderRoom', 'placeActor', 'placeProp', 'placeAsset', 'gridPath', 'roomGrid',
                 'pickAct', 'startWalkTo', 'stepWalk', 'walkPose', 'stepPursuit', 'resolveTarget',
                 'drawSay', 'drawEmote', 'drawLink', 'roomState', 'actorAnchor',
                 'attachRoomInteraction', 'drawInteraction', 'defineEmote']
    for (const k of API) {
      out.engine[k] = typeof window[k] === 'function'
      if (!out.engine[k]) out.problems.push('引擎缺失: ' + k)
    }

    const A = window.ASSETS || {}, AC = window.ACTORS || {}

    // ② 角色:姿态取得回真图吗（写错名字会静默回退 stand）
    out.actors = {}
    for (const id of Object.keys(AC)) {
      const a = AC[id], poses = a.poses || {}
      const names = Object.keys(poses)
      let bad = 0
      for (const n of names) if (!poses[n] || !poses[n].length) bad++
      out.actors[id] = { scale: a.scale, poses: names.length, empty: bad,
                         baseFacing: a.baseFacing || 'right' }
      if (bad) out.problems.push(`${id} 有 ${bad} 个空姿态`)
      if (a.scale !== 8) out.problems.push(`${id} scale=${a.scale}，规范是 8`)
    }

    // ③ 逐房检查 —— 房间【自动发现】,不写死清单。
    // 写死过一次的代价:丹增房整间从未被 verify 看过,而门禁天天报「全部通过」。
    const FOUND = Object.keys(window)
      .filter(k => /^[A-Z][A-Z0-9]*_ROOM$/.test(k))
      .filter(k => window[k] && Array.isArray(window[k].plan))
      .map(k => [k, k.replace(/_ROOM$/, '').toLowerCase() + 'Canvas'])
      .sort((a, b) => a[0] < b[0] ? -1 : 1)
    out.discovered = FOUND.map(f => f[0])
    if (!FOUND.length) out.problems.push('没发现任何房间(window.<NAME>_ROOM 带 plan)')
    for (const [key, cv] of FOUND) {
      const room = window[key], canvas = document.getElementById(cv)
      if (!room || !canvas) { out.problems.push(key + ' 或画布缺失'); continue }
      const plan = room.plan || []
      const R = { plan: plan.length, missing: [], emptyDraw: [], clickable: 0, lines: 0 }

      // plan 引用的素材都在库、都画得出像素
      const seen = new Set()
      for (const e of plan) {
        const id = e[0]
        if (seen.has(id)) continue
        seen.add(id)
        if (!A[id]) { R.missing.push(id); continue }
        try {
          const spr = window.placeAsset(id, 0, 0, {}).cv
          const d = spr.getContext('2d').getImageData(0, 0, spr.width, spr.height).data
          let ink = 0
          for (let i = 3; i < d.length; i += 4) if (d[i] > 8) { ink++; break }
          if (!ink) R.emptyDraw.push(id)
        } catch (e) { R.emptyDraw.push(id + '(抛异常)') }
        if (A[id].clickable) { R.clickable++; if (A[id].say) R.lines++ }
      }
      R.kinds = seen.size
      if (R.missing.length) out.problems.push(key + ' plan 引用了库中没有的素材: ' + R.missing.join(','))
      if (R.emptyDraw.length) out.problems.push(key + ' 这些素材画不出像素: ' + R.emptyDraw.join(','))

      // 交互接上了吗
      R.interactive = !!canvas.__interaction
      if (!R.interactive) out.problems.push(key + ' 交互未接（clickable 全部点不到）')

      // 寻路可用吗
      try {
        const g = window.roomGrid(room)
        let blocked = 0
        for (let i = 0; i < g.G.length; i++) if (g.G[i]) blocked++
        R.grid = `${g.COLS}x${g.ROWS} 阻挡${blocked}`
        const path = window.gridPath(room, 300, 1200, 1100, 800)
        R.pathOk = Array.isArray(path)
        if (!R.pathOk) out.problems.push(key + ' 寻路返回空')
      } catch (e) { out.problems.push(key + ' 寻路抛异常: ' + e.message) }

      out.rooms[key] = R
    }

    // ⑥ 房间主按钮 —— 「请XX做某事」那颗。婆婆那颗曾【连 id 都没有】，
    // 点了什么都不会发生，而七道门禁与十二项指标全绿：没有一道在看它。
    // 只查存在性不够（有 id 也可能没接监听），所以点一下看文案变不变。
    out.buttons = {}
    for (const [bid, room] of FOUND.map(([k]) => [k.replace(/_ROOM$/, '').toLowerCase() + 'CastBtn', k])) {
      const el = document.getElementById(bid)
      if (!el) { out.problems.push(room + ' 主按钮缺失: #' + bid); out.buttons[bid] = '缺失'; continue }
      const settle = () => new Promise(r => setTimeout(r, 500))
      const before = el.textContent
      el.click(); await settle()
      const changed = el.textContent !== before
      el.click(); await settle()
      out.buttons[bid] = changed ? '✓' : '✗ 点了没反应'
      if (!changed) out.problems.push(room + ' 主按钮 #' + bid + ' 点击无反应（没接监听）')
    }
    return out
  })

  // ④ 运行一段时间，看有没有静默异常
  await p.waitForTimeout(25000)
  const after = await p.evaluate(() => {
    const st = {}
    for (const k of Object.keys(window).filter(k => /^[A-Z][A-Z0-9]*_ROOM$/.test(k)))
      if (window[k] && Array.isArray(window[k].plan)) st[k] = !!window[k].state
    return { states: st }
  })

  console.log('══ 引擎 ══')
  const miss = Object.entries(r.engine).filter(([, v]) => !v).map(([k]) => k)
  console.log('  API', Object.keys(r.engine).length, '支 →', miss.length ? '✗ 缺 ' + miss.join(',') : '✓ 全部装载')

  console.log('\n══ 角色 ══')
  for (const [id, a] of Object.entries(r.actors))
    console.log(`  ${id.padEnd(8)} scale ${a.scale}  姿态 ${String(a.poses).padStart(3)}  空 ${a.empty}  基准朝向 ${a.baseFacing}`)

  console.log('\n══ 房间 ══')
  for (const [k, R] of Object.entries(r.rooms))
    console.log(`  ${k.padEnd(11)} plan ${R.plan} / ${R.kinds} 种  可点 ${R.clickable}  台词 ${R.lines}  交互 ${R.interactive ? '✓' : '✗'}  网格 ${R.grid}  寻路 ${R.pathOk ? '✓' : '✗'}`)

  console.log('\n══ 主按钮 ══')
  for (const [k, v] of Object.entries(r.buttons || {})) console.log(`  ${k.padEnd(14)} ${v}`)

  console.log('\n══ 运行 ══')
  console.log('  发现房间', (r.discovered || []).length, '间:', (r.discovered || []).join(' '))
  console.log('  房间状态', Object.entries(after.states).map(([k, v]) => k.replace(/_ROOM$/, '').toLowerCase() + (v ? ' ✓' : ' ✗')).join(' | '))
  console.log('  31 秒内页面错误:', errs.length ? '✗ ' + [...new Set(errs)].slice(0, 3).join(' | ') : '✓ 无')

  const bad = r.problems.length + errs.length
  console.log('\n' + (bad ? '✗ ' + r.problems.length + ' 项问题:\n  ' + r.problems.join('\n  ') : '✓ 全部通过'))
  await b.close()
  process.exit(bad ? 1 : 0)
})()
