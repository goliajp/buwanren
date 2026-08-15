#!/usr/bin/env bun
/**
 * pathlint —— 行为锚点与路径体检(WORKFLOW S7 的门禁之一)
 *
 * WORKFLOW 从第一版就写着「pathlint 0 处」,文档里连实测数字都在
 * (桃桃 14 处穿模、阿云 4 处),但 tools/ 里【没有这个文件】——
 * 它随那次 137 commit 回退一起没了,门禁于是空写了很久:
 * 要求跑一支跑不了的工具,等于这一关谁都过。这是第六种假绿。
 *
 * 查四件事:
 *   ① 锚点站进家具里 ★ 最常见 —— 挪了家具没挪锚点,他就站到柜子里去了。
 *      `startWalkTo` 会【无条件】把锚点本身 push 进路径末尾,所以哪怕
 *      锚点是障碍格,他也会在最后一段直线走进去。寻路绕得开,这一步绕不开。
 *   ② 锚点够不着 —— 引擎实际把他放下的地方离锚点超过两格,他会停在半路。
 *   ③ 路径穿家具 —— gridPath 返回的折线有拐点落在障碍格上。
 *   ④ 表演锚点 —— perform.actor 的落点同样要查,那是玩家点按钮唯一会去的地方。
 *
 * 锚点语义有两种,不能混:主角的 act.x/y 是 **sprite 左上角**(要加 foot 偏移
 * 才是脚点),宠物的 act.x/y **本身就是脚点**。房间在 ROOM.acts 上用
 * anchorIsFoot 如实标注,与 startWalkTo 的 { foot:[0,0] } 一一对应。
 *
 * ⚠ 这一支报 0 **不等于**走位对了 —— 它建立在 S5 的 `foot` 之上。
 *   碰撞体画错了,烧出来的格就是错的,穿模照样过。先 assetlint + roomaudit D。
 *
 * 用法:bun tools/pathlint.js <design.html 绝对路径> [房间名]
 */
const { chromium } = require('playwright')
const FILE = process.argv[2], ONLY = process.argv[3]
if (!FILE) { console.error('用法: bun tools/pathlint.js <design.html 绝对路径> [房间名]'); process.exit(2) }

;(async () => {
  const b = await chromium.launch(), p = await b.newPage()
  await p.goto('file://' + FILE); await p.waitForTimeout(3000)

  const res = await p.evaluate((only) => {
    const rooms = Object.keys(window)
      .filter(k => /_ROOM$/.test(k) && window[k] && Array.isArray(window[k].plan))
      .filter(k => !only || k.toLowerCase().includes(only.toLowerCase()))
    const out = []
    for (const key of rooms) {
      const room = window[key]
      const g = window.roomGrid(room, true)
      const { G, COLS, ROWS, CELL } = g
      const free = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !G[r * COLS + c]

      // 哪件家具占着这一点 —— 只说「站进家具里」没用,要说清是哪一件
      const A = window.ASSETS || {}
      const whoAt = (x, y) => (room.plan || []).filter(pl => {
        const a = A[pl[0]]
        if (!a || !a.foot || a.walkable) return false
        const [ox, oy, fw, fh] = a.foot
        if (!fw || !fh) return false
        return x >= pl[1] + ox - 8 && x <= pl[1] + ox + fw + 8 &&
               y >= pl[2] + oy - 8 && y <= pl[2] + oy + fh + 8
      }).map(pl => pl[0])

      /* 「他实际会停在离锚点多远的地方」—— 不要自己造可达性判据。
         引擎的 gridPath 在目标不可达时用 near() 退到最近的可达格,所以
         锚点【本来就允许】落在障碍格上:走到桌边坐下、走到床边躺下,锚点
         都在家具的 NAV_PAD(16px)膨胀区里。把那个当穿模是错判。
         自己泛洪也不行 —— 第一版从最下面一排起泛,起点落在房间的延伸带上
         (room.extBand,门外那截),跟房内不连通,于是阿云房 18 个锚点报了 17 个。
         正解:直接问引擎走一趟,看它把人放在哪儿,差多少就是差多少。 */
      const dropDist = (sx, sy, tx, ty) => {
        // 同一格来回:gridPath 返回 null,那不是「走不到」,是「不用走」
        if (Math.abs(sx - tx) < CELL && Math.abs(sy - ty) < CELL) return { d: 0 }
        const path = window.gridPath(room, sx, sy, tx, ty)
        if (!path || !path.length) return { d: 9999 }
        const last = path[path.length - 1]
        // 落点一并带出来 —— 报「够不着」而不说该挪到哪儿,等于把活推回给人
        return { d: Math.max(Math.abs(last[0] - tx), Math.abs(last[1] - ty)), at: last }
      }

      // 站进家具【本体】—— 不含 PAD。这一条才是真的「他站在柜子里」
      const insideBody = (x, y) => (room.plan || []).filter(pl => {
        const a = A[pl[0]]
        if (!a || !a.foot || a.walkable) return false
        const [ox, oy, fw, fh] = a.foot
        if (!fw || !fh) return false
        return x > pl[1] + ox && x < pl[1] + ox + fw && y > pl[2] + oy && y < pl[2] + oy + fh
      }).map(pl => pl[0])

      const groups = room.acts || []
      const bad = [], notes = []
      let anchors = 0, paths = 0

      const check = (label, actorId, anchorIsFoot, list) => {
        const F = anchorIsFoot ? [0, 0] : ((window.ACTORS[actorId] && window.ACTORS[actorId].foot) || [0, 0])
        const pts = []
        for (const a of list) {
          if (typeof a.x !== 'number' || typeof a.y !== 'number') continue
          pts.push([a.x + F[0], a.y + F[1], a.id || '?', a])
        }
        if (!pts.length) return
        const [ox, oy] = pts[0]                      // 出发点:该组第一个锚点
        for (const [fx, fy, id, a] of pts) {
          anchors++
          const body = insideBody(fx, fy)
          const r = fx === ox && fy === oy ? { d: 0 } : dropDist(ox, oy, fx, fy)
          const d = r.d
          if (body.length) {
            bad.push(`${label} 锚点「${id}」脚点(${fx},${fy}) 站进了 ${body.join(' · ')} 【里面】`)
          } else if (d > 80) {
            bad.push(`${label} 锚点「${id}」脚点(${fx},${fy}) 他只能停在 ${d}px 开外 —— 周边: ${whoAt(fx, fy).join(' · ') || '(被围死)'}` +
                     (r.at ? `\n        → 引擎实际把他放在 (${r.at[0]},${r.at[1]})，锚点改成这儿就对上了` : ''))
          } else if (d > 40) {
            notes.push(`${label}「${id}」他会停在 ${d}px 外 —— 走到家具边算正常,再远就该挪锚点了`)
          }
          // 睡觉那类会被 sleepAt 挪到床上,床本身是障碍 —— 那是有意的,单列
          if (a.sleepAt) notes.push(`${label}「${id}」sleepAt(${a.sleepAt}) 落在家具上(睡在床上,正常)`)
        }
        // 两两互走一遍,看折线拐点有没有踩进家具本体
        for (let i = 0; i < pts.length; i++) for (let j = 0; j < pts.length; j++) {
          if (i === j) continue
          const [sx, sy, sid] = pts[i], [tx, ty, tid] = pts[j]
          const path = window.gridPath(room, sx, sy, tx, ty)
          paths++
          if (!path) { bad.push(`${label} ${sid} → ${tid} 找不到路`); continue }
          for (const q of path) {
            const hit = insideBody(q[0], q[1])
            if (hit.length) { bad.push(`${label} ${sid} → ${tid} 路径拐点(${q[0]},${q[1]}) 穿过 ${hit.join(' · ')}`); break }
          }
        }
      }

      for (const grp of groups) check(grp.actor, grp.actor, grp.anchorIsFoot, grp.list || [])

      // 表演锚点:玩家点按钮唯一会去的地方
      const pf = room.perform && room.perform.actor
      if (pf && typeof pf.x === 'number') {
        const main = (groups[0] && groups[0].actor) || null
        const F = (main && window.ACTORS[main] && window.ACTORS[main].foot) || [0, 0]
        const fx = pf.x + F[0], fy = pf.y + F[1]
        anchors++
        const g0 = groups[0] && (groups[0].list || []).find(a => typeof a.x === 'number')
        const body = insideBody(fx, fy)
        const d = g0 ? dropDist(g0.x + F[0], g0.y + F[1], fx, fy).d : 0
        if (body.length) bad.push(`表演锚点 脚点(${fx},${fy}) 站进了 ${body.join(' · ')} 【里面】`)
        else if (d > 80) bad.push(`表演锚点 脚点(${fx},${fy}) 他只能停在 ${d}px 开外 —— 玩家点了按钮却看他停在半路`)
      }
      out.push({ key, groups: groups.length, anchors, paths, bad, notes })
    }
    return out
  }, ONLY)

  let total = 0
  for (const r of res) {
    console.log(`── ${r.key}  行为组 ${r.groups} · 锚点 ${r.anchors} · 走了 ${r.paths} 条路`)
    if (!r.groups) {
      console.log('   ~ 这间房没在 ROOM.acts 上挂行为表 —— 查不了。')
      console.log('     在 loop 的首帧接线处(与 wirePerform 并列)挂:')
      console.log('     window.X_ROOM.acts = [{ actor: \'x\', list: ACTS }]')
      continue
    }
    if (r.bad.length) { total += r.bad.length; r.bad.forEach(m => console.log('   ✗ ' + m)) }
    else console.log('   ✓ 锚点与路径全干净')
    r.notes.forEach(m => console.log('   · ' + m))
  }
  console.log('\n' + (total ? `✗ ${total} 处` : '✓ 0 处'))
  console.log('⚠ 报 0 建立在 S5 的 foot 之上 —— 碰撞体画错了,穿模照样过。先 assetlint + roomaudit D。')
  await b.close()
  if (total) process.exit(1)
})()
