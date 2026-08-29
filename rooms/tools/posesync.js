// 验证:角色资源确实【引用】而非拷贝 POSES —— 运行时新增姿态应立刻可见
const { chromium } = require('playwright')
;(async () => {
  /* 自带的 chromium，不用装机版 Chrome —— 后者在这台机器上跑二三十秒就挨 SIGKILL
     （08-30 实测，见 docs/FINDING-2026-08-30-chrome-sigkill.md）。
     `regress.js` 是例外:它的基准哈希绑着浏览器，换一个就得重存，
     而那份基准记着 12 处已知漂移与存基准时的 commit，比这点稳定性值钱。 */
  const b = await chromium.launch()
  const p = await b.newPage()
  await p.goto('file://' + require('path').resolve(process.argv[2])); await p.waitForTimeout(2800)
  const r = await p.evaluate(() => {
    const before = Object.keys(window.ACTORS.ayun.poses).length
    // 只往 POSES 写,不碰 ACTORS
    window.AYUN_POSES.__probe = ['KK', 'KK']
    const after = Object.keys(window.ACTORS.ayun.poses).length
    const visible = !!window.ACTORS.ayun.poses.__probe
    delete window.AYUN_POSES.__probe
    return { before, after, visible, catCount: Object.keys(window.ACTORS.cat.poses).length }
  })
  console.log('ayun 姿态数 ' + r.before + ' → 写入 POSES 后 ' + r.after)
  console.log('新姿态在 ACTORS 中可见: ' + r.visible + (r.visible ? '  ✓ 引用生效,不再需要双写' : '  ✗ 仍是拷贝'))
  console.log('cat 姿态数 ' + r.catCount)
  await b.close()
})()
