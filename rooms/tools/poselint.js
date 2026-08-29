#!/usr/bin/env bun
/**
 * poselint —— 角色姿态 vs 设计规范 B0
 *
 * B0 写着「此表为单一数据源，游戏 sprite 与之对齐」，但一直没有任何机制
 * 在检查这句话 —— 规范与引擎之间没有接缝，全靠人记得。
 *
 * 规范要点：
 *   · 四向 = 正 / 左 / 右 / 背，其中左右靠 flip 共用 side
 *   · 命名 {动作}{方向}{帧号}，方向只用 side / front / back
 *   · 侧走三帧 1→2→3→2，正走 / 背走各两帧
 *   · 不留别名：walk1 / walkmid / walkdown1 一律换掉
 *   · 有载具的角色，载具与骑乘姿态同样四向俱全
 */
const { chromium } = require('playwright')
const FILE = process.argv[2]
if (!FILE) { console.error('用法: bun tools/poselint.js <design.html 绝对路径>'); process.exit(2) }

;(async () => {
  /* 自带的 chromium，不用装机版 Chrome —— 后者在这台机器上跑二三十秒就挨 SIGKILL
     （08-30 实测，见 docs/FINDING-2026-08-30-chrome-sigkill.md）。
     `regress.js` 是例外:它的基准哈希绑着浏览器，换一个就得重存，
     而那份基准记着 12 处已知漂移与存基准时的 commit，比这点稳定性值钱。 */
  const b = await chromium.launch()
  const p = await b.newPage()
  await p.goto('file://' + require('path').resolve(FILE)); await p.waitForTimeout(5000)

  const r = await p.evaluate(() => {
    const AC = window.ACTORS || {}
    const WALK = ['walkside1', 'walkside2', 'walkside3', 'walkfront1', 'walkfront2',
                  'walkback1', 'walkback2', 'standside', 'standback', 'stand']
    const RIDE = ['rideside', 'ridefront', 'rideback']
    const ALIAS = /^(walkmid|walk\d|walkdown\d|walkup\d|walkleft\d|walkright\d)$/
    const out = []
    for (const id of Object.keys(AC)) {
      const a = AC[id], keys = Object.keys(a.poses || {})
      const has = n => keys.includes(n)
      // 会走动的角色 = 有任一 walk 姿态；只坐着的宠物不强求四向
      const mobile = keys.some(k => k.startsWith('walk'))
      const rec = { id, name: a.name, poses: keys.length, mobile, mount: !!a.mount,
                    missWalk: [], missRide: [], alias: [], vehicle: null }
      if (mobile) rec.missWalk = WALK.filter(n => !has(n))
      if (a.mount) {
        rec.missRide = RIDE.filter(n => !has(n))
        const V = window.__vehicleSpec ? window.__vehicleSpec(a.mount.vehicle) : null
        rec.vehicle = V ? { id: a.mount.vehicle, faces: Object.keys(V.poses || {}) } : { id: a.mount.vehicle, faces: null }
      }
      rec.alias = keys.filter(k => ALIAS.test(k))
      out.push(rec)
    }
    return out
  })

  let bad = 0
  console.log('角色                姿态  会走  载具  规范缺口')
  for (const c of r) {
    const problems = []
    if (c.missWalk.length) problems.push('缺行走姿态 ' + c.missWalk.join(','))
    if (c.missRide.length) problems.push('缺骑乘姿态 ' + c.missRide.join(','))
    if (c.alias.length)    problems.push('别名未换 ' + c.alias.join(','))
    if (c.vehicle && c.vehicle.faces && c.vehicle.faces.length < 3)
      problems.push('载具朝向不全 ' + c.vehicle.faces.join(','))
    if (problems.length) bad += problems.length
    console.log(`  ${(c.name || c.id).padEnd(8)} ${(c.id).padEnd(9)} ${String(c.poses).padStart(3)}  ` +
                `${c.mobile ? '是' : '否'}   ${c.mount ? c.vehicle.id : '—'}    ` +
                (problems.length ? '✗ ' + problems.join(' | ') : '✓'))
  }
  console.log('\n' + (bad ? `✗ ${bad} 项不符 B0` : '✓ 全部符合 B0'))
  await b.close(); process.exit(bad ? 1 : 0)
})()
