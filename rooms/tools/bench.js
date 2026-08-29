const { chromium } = require('playwright')
const ROOMARG = process.argv[3] || ''
;(async () => {
  /* 自带的 chromium，不用装机版 Chrome —— 后者在这台机器上跑二三十秒就挨 SIGKILL
     （08-30 实测，见 docs/FINDING-2026-08-30-chrome-sigkill.md）。
     `regress.js` 是例外:它的基准哈希绑着浏览器，换一个就得重存，
     而那份基准记着 12 处已知漂移与存基准时的 commit，比这点稳定性值钱。 */
  const b = await chromium.launch()
  const p = await b.newPage()
  await p.goto('file://' + require('path').resolve(process.argv[2])); await p.waitForTimeout(3000)

  // 房间可选:第三个参数给房间名(ayun/tao/popo/tenz…),不给则用发现到的第一间。
  // 从前这些诊断工具全部写死 AYUN_ROOM,拿它们查别的房会得到误导性结果。
  await p.evaluate((want) => {
    const keys = Object.keys(window)
      .filter(k => /^[A-Z][A-Z0-9]*_ROOM$/.test(k))
      .filter(k => window[k] && Array.isArray(window[k].plan)).sort()
    const key = want && keys.includes(want) ? want : keys[0]
    window.__R = window[key]; window.__RK = key
    window.__RBASE = key.replace(/_ROOM$/, '').toLowerCase()
  }, (ROOMARG || '').toUpperCase().replace(/(_ROOM)?$/, '_ROOM'))
  const r = await p.evaluate(() => {
    const room = window.__R
    const cv = document.createElement('canvas'); cv.width = 1440; cv.height = 2560
    const g = cv.getContext('2d')
    const actors = [window.placeActor('ayun', 700, 1500, 'stand', false),
                    window.placeActor('cat', 700, 900, 'csit', false)]
    // 预热(触发烘焙与 sprite 缓存)
    for (let i = 0; i < 5; i++) window.renderRoom(g, room, i * 16, actors)
    const N = 120, t0 = performance.now()
    for (let i = 0; i < N; i++) window.renderRoom(g, room, i * 16, actors)
    const warm = (performance.now() - t0) / N
    // 冷启动:清烘焙缓存
    window.invalidateRoomBake(room)
    const t1 = performance.now(); window.renderRoom(g, room, 0, actors)
    const cold = performance.now() - t1
    return { warm: +warm.toFixed(3), cold: +cold.toFixed(3), instances: room.plan.length }
  })
  console.log('实例 ' + r.instances + ' 件')
  console.log('冷帧(重新烘焙 L0): ' + r.cold + ' ms')
  console.log('热帧(平均 120 帧): ' + r.warm + ' ms  →  ' + Math.round(1000 / r.warm) + ' fps 上限')
  console.log(r.warm < 16.7 ? '✓ 满足 60fps 预算(16.7ms)' : (r.warm < 50 ? '✓ 满足 20fps 预算(50ms)' : '✗ 超出预算'))
  await b.close()
})()
