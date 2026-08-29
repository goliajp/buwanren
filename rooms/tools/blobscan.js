#!/usr/bin/env bun
/**
 * blobscan —— 扫「一个 sprite 画了多件东西」(引擎缺口 B5)
 *
 * 症状:一张素材里画着离得很远的好几坨实体,却共用一个 foot、一句台词、一次点击。
 * 后果是三重的 —— 角色会从其中一坨上穿过去(foot 只圈得住其中一部分)、
 * 点哪一坨都弹同一句话、想单独挪动其中一件做不到。
 *
 * `roomaudit D` 也报这个,但它只看【摆进房里】的素材;工序单第 03 步要的是**全库**。
 * 库里 399 件,没摆的那些迟早会摆,现在不扫,摆进去那天就是「明明查过」。
 *
 * 判据两条,分开报:
 *   ① foot 比实际墨迹宽 >130%   —— 工序单第 03 步的硬门禁
 *   ② 墨迹分成 ≥2 坨且坨间空隙大 —— 该拆的候选(成组本身合法:一对雪狮、两根门柱,
 *      所以这条只列出来给人看,不判失败)
 *
 * 用法:bun tools/blobscan.js <design.html> [--gate-only]
 */
const { chromium } = require('playwright')
const path = require('path')

const FILE = process.argv[2]
const GATE_ONLY = process.argv.includes('--gate-only')
if (!FILE) { console.error('用法: bun tools/blobscan.js <design.html> [--gate-only]'); process.exit(2) }

;(async () => {
  /* 自带的 chromium，不用装机版 Chrome —— 后者在这台机器上跑二三十秒就挨 SIGKILL
     （08-30 实测，见 docs/FINDING-2026-08-30-chrome-sigkill.md）。
     `regress.js` 是例外:它的基准哈希绑着浏览器，换一个就得重存，
     而那份基准记着 12 处已知漂移与存基准时的 commit，比这点稳定性值钱。 */
  const b = await chromium.launch()
  const p = await b.newPage()
  const pageErrs = []
  p.on('pageerror', e => pageErrs.push(String(e).slice(0, 200)))
  await p.goto('file://' + path.resolve(FILE))
  await p.waitForTimeout(3500)

  const res = await p.evaluate(() => {
    const A = window.ASSETS || {}
    const ids = Object.keys(A)
    const out = []
    for (const id of ids) {
      const a = A[id]
      let cv
      try { cv = window.placeAsset(id, 0, 0, {}).cv } catch (e) { out.push({ id, err: String(e).slice(0, 80) }); continue }
      const W = cv.width, H = cv.height
      if (!W || !H) { out.push({ id, err: '画布是空的' }); continue }
      const d = cv.getContext('2d').getImageData(0, 0, W, H).data

      // 两个阈值,各有各的用处 —— 混用会得出互相矛盾的结论:
      //   看得见(alpha>8):玩家眼里这件东西占多宽。判 foot 宽窄要用它 ——
      //     白鹭房的白布是半透明的,按实体阈值量,盖着的家具会缩水成布底下露出的一角。
      //   实体(alpha>200):分坨要用它 —— 辉光 / 阴影 / 光晕会把两坨连成一片。
      const solid = new Uint8Array(W * H)
      let ink = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1     // 实体
      let vis = 0, vx0 = 1e9, vy0 = 1e9, vx1 = -1, vy1 = -1  // 看得见
      for (let i = 3, px = 0; i < d.length; i += 4, px++) {
        const cx = px % W, cy = (px / W) | 0
        if (d[i] > 8) {
          vis++
          if (cx < vx0) vx0 = cx; if (cx > vx1) vx1 = cx
          if (cy < vy0) vy0 = cy; if (cy > vy1) vy1 = cy
        }
        if (d[i] > 200) {
          solid[px] = 1; ink++
          if (cx < x0) x0 = cx; if (cx > x1) x1 = cx
          if (cy < y0) y0 = cy; if (cy > y1) y1 = cy
        }
      }
      if (!vis) { out.push({ id, err: '整张空白 —— 一个像素都没画' }); continue }
      // 只有半透明像素:光斑 / 杯痕 / 垂帘这类本来就该是虚的,不是缺陷
      if (!ink) { out.push({ id, translucentOnly: true, vis, visW: vx1 - vx0 + 1, cat: A[id].cat || '?' }); continue }

      // 连通块(4 邻域,显式栈,不用递归 —— 大素材会爆栈)
      const lab = new Int32Array(W * H).fill(-1)
      const blobs = []
      const st = []
      for (let s = 0; s < W * H; s++) {
        if (!solid[s] || lab[s] >= 0) continue
        const n = blobs.length
        let area = 0, bx0 = W, by0 = H, bx1 = -1, by1 = -1
        lab[s] = n; st.push(s)
        while (st.length) {
          const q = st.pop()
          const qx = q % W, qy = (q / W) | 0
          area++
          if (qx < bx0) bx0 = qx; if (qx > bx1) bx1 = qx
          if (qy < by0) by0 = qy; if (qy > by1) by1 = qy
          if (qx > 0     && solid[q - 1] && lab[q - 1] < 0) { lab[q - 1] = n; st.push(q - 1) }
          if (qx < W - 1 && solid[q + 1] && lab[q + 1] < 0) { lab[q + 1] = n; st.push(q + 1) }
          if (qy > 0     && solid[q - W] && lab[q - W] < 0) { lab[q - W] = n; st.push(q - W) }
          if (qy < H - 1 && solid[q + W] && lab[q + W] < 0) { lab[q + W] = n; st.push(q + W) }
        }
        blobs.push({ idx: n, area, x0: bx0, y0: by0, x1: bx1, y1: by1 })
      }
      // 碎屑不算一坨:小于总墨迹 4% 的丢掉(高光点、缝线、铆钉)
      const big = blobs.filter(bl => bl.area >= ink * 0.04).sort((m, n) => n.area - m.area)

      // 坨间最大空隙:两两之间在 x / y 上的最短间隔,取最大的那个
      let maxGap = 0, gapPair = null
      for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) {
        const m = big[i], n = big[j]
        const gx = Math.max(m.x0, n.x0) - Math.min(m.x1, n.x1)
        const gy = Math.max(m.y0, n.y0) - Math.min(m.y1, n.y1)
        const g = Math.max(gx, gy)     // 两轴都不重叠时取大的那个作分离度
        if (g > maxGap) { maxGap = g; gapPair = [i, j] }
      }

      const f = a.foot
      const inkW = x1 - x0 + 1, inkH = y1 - y0 + 1
      const visW = vx1 - vx0 + 1

      // ★ 真正的缺陷判据:一坨【落在地上】却没被 foot 圈住 —— 角色会从它身上穿过去。
      //   2.5D 下高处的一坨(锅肚、香炉肩)探出 foot 是正常的,foot 圈的是【底座】;
      //   所以只看底边贴近素材底部的那些坨。这一条比「空隙有多大」准得多:
      //   一对雪狮空隙 257px 但两只都在 foot 里 —— 那是成组,不是缺陷。
      const uncovered = []
      if (f && f[2] > 0 && f[3] > 0 && !a.wall) {
        const fx0 = f[0], fx1 = f[0] + f[2]
        const ymax = y1                       // 整张素材实体墨迹的最低点 = 地面线
        for (const bl of big) {
          // 站在地上 = 这坨的底边贴着整张图的地面线。拿 foot 的上沿当基准是错的:
          // 阿云门框里那两本书底边 y115、地面线 y149,差 34px —— 它们在搁板上,不在地上。
          if (bl.y1 < ymax - 6) continue
          // 比的是【这一坨贴地那几行】的横向范围,不是整坨的包围盒 ——
          // 丹增棍架的横梁与斜靠的棍子在高处外探到 x2–143,真正着地的只有两根立柱 x30–98。
          // 按 lab 认坨(不能只看 solid,否则会把紧挨着的另一坨算进来)。
          let cx0 = W, cx1 = -1
          for (let yy = Math.max(0, bl.y1 - 6); yy <= bl.y1; yy++)
            for (let xx = bl.x0; xx <= bl.x1; xx++)
              if (lab[yy * W + xx] === bl.idx) { if (xx < cx0) cx0 = xx; if (xx > cx1) cx1 = xx }
          if (cx1 < 0) continue
          const cover = Math.min(cx1 + 1, fx1) - Math.max(cx0, fx0)
          const frac = cover / (cx1 - cx0 + 1)
          if (frac < 0.5)
            uncovered.push({ box: [bl.x0, bl.y0, bl.x1, bl.y1], contact: [cx0, cx1],
                             area: bl.area, cover: +Math.max(0, frac).toFixed(2) })
        }
      }
      out.push({
        id, cat: a.cat || '?', scope: a.scope || '?', w: W, h: H,
        ink, inkW, inkH, visW, inkBox: [x0, y0, x1, y1],
        foot: f || null,
        wall: !!a.wall,
        // 只有【真占地】的件才谈得上 foot 宽窄:墙上挂件写的是 foot:[0,H,W,0],
        // 高度 0 = 不占地板,lintRoom 也明确跳过它们。拿零高度的 foot 比宽度,
        // 会把好端端的蒙布立轴报成 282% 超宽。
        // 比的是【看得见】的宽度 —— foot 该圈住玩家看到的那件东西
        footRatio: (f && f[2] > 0 && f[3] > 0 && !a.wall && visW > 0) ? +(f[2] / visW).toFixed(2) : null,
        footOut: f ? (f[0] + f[2] > a.w || f[1] + f[3] > a.h + (a.wall ? 0 : 0)) : false,
        blobs: big.length, blobAreas: big.slice(0, 4).map(bl => bl.area),
        maxGap, gapPair, uncovered,
      })
    }
    return out
  })
  await p.close(); await b.close()

  const errs = res.filter(r => r.err)
  const soft = res.filter(r => r.translucentOnly)
  const ok = res.filter(r => !r.err && !r.translucentOnly)
  console.log(`══ 全库扫描 ${res.length} 件素材 ══`)
  if (pageErrs.length) { console.log('页面报错:'); pageErrs.slice(0, 3).forEach(e => console.log('  ' + e)) }
  if (errs.length) {
    console.log(`\n渲染不出来 ${errs.length} 件:`)
    errs.slice(0, 10).forEach(r => console.log(`  ${r.id.padEnd(28)} ${r.err}`))
  }
  if (soft.length) {
    console.log(`\n只有半透明像素 ${soft.length} 件(光斑 / 杯痕 / 垂帘这类本来就虚,不判失败):`)
    console.log('   ' + soft.map(r => r.id).join(' · '))
  }

  // ── ① 门禁:foot 比实际墨迹宽 >130%
  const wide = ok.filter(r => r.footRatio !== null && r.footRatio > 1.30)
    .sort((a, b) => b.footRatio - a.footRatio)
  console.log(`\n① foot 比实际墨迹宽 >130%(工序单第 03 步门禁)`)
  if (!wide.length) console.log(`   ✓ ${ok.filter(r => r.footRatio !== null).length} 件带 foot 的素材全部达标`)
  else {
    console.log(`   ✗ ${wide.length} 件:`)
    for (const r of wide) console.log(`     ${r.id.padEnd(30)} foot 宽 ${String(r.foot[2]).padStart(4)}  看得见的宽 ${String(r.visW).padStart(4)}  = ${(r.footRatio * 100) | 0}%` +
      (r.ink && r.visW !== r.inkW ? `  (实体部分只有 ${r.inkW})` : ''))
  }

  const out = ok.filter(r => r.footOut)
  console.log(`\n② foot 探出素材边界`)
  if (!out.length) console.log(`   ✓ 无`)
  else for (const r of out) console.log(`     ${r.id.padEnd(30)} foot ${JSON.stringify(r.foot)} vs 素材 ${r.w}×${r.h}`)

  // ── ③ 落地却没被 foot 圈住的坨 —— 角色会从它身上穿过去
  const walkthru = ok.filter(r => r.uncovered && r.uncovered.length)
    .sort((a, b) => b.uncovered[0].area - a.uncovered[0].area)
  console.log(`\n③ 有一坨落在地上却没被 foot 圈住(角色会穿过去)`)
  if (!walkthru.length) console.log('   ✓ 无')
  else {
    console.log(`   ✗ ${walkthru.length} 件:`)
    for (const r of walkthru) {
      console.log(`     ${r.id.padEnd(30)} foot ${JSON.stringify(r.foot)}  素材 ${r.w}×${r.h}`)
      for (const u of r.uncovered)
        console.log(`        漏掉一坨 x ${u.box[0]}–${u.box[2]} y ${u.box[1]}–${u.box[3]}  着地段 x ${u.contact[0]}–${u.contact[1]}  只被圈住 ${(u.cover * 100) | 0}%`)
    }
  }

  if (!GATE_ONLY) {
    // ── ④ 多坨候选(不判失败:一对雪狮、两根门柱这类成组本身合法)
    const multi = ok.filter(r => r.blobs >= 2 && r.maxGap >= 8).sort((a, b) => b.maxGap - a.maxGap)
    console.log(`\n④ 一个 sprite 画了多坨(空隙 ≥8px)—— ${multi.length} 件,人工判断该不该拆`)
    console.log(`   成组本身合法(一对雪狮、两根门柱);要拆的是「几件不相干的东西挤在一张图里」。`)
    for (const r of multi.slice(0, 40))
      console.log(`     ${r.id.padEnd(30)} ${String(r.blobs).padStart(2)} 坨  最大空隙 ${String(r.maxGap).padStart(3)}px  ` +
                  `面积 ${r.blobAreas.join('/')}  foot ${r.foot ? JSON.stringify(r.foot) : '无'}`)
    if (multi.length > 40) console.log(`     …另有 ${multi.length - 40} 件`)
  }

  const bad = wide.length + out.length + errs.length + walkthru.length
  console.log(`\n${bad ? `✗ 门禁 ${bad} 项要改` : '✓ 门禁通过'}`)
  process.exit(bad ? 1 : 0)
})()
