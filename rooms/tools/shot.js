const { chromium } = require('playwright')
// 村子时间 = 帧驱动(50ms/帧, 2000 帧/天)。14-50% 白天, 50-66% 黄昏, 66%+ 夜
const FILE = process.argv[2]
const SEL  = process.argv[3] || '#vilCanvas'
const SHOTS = (process.argv[4] || 'noon:34').split(',').map(s => { const [n, t] = s.split(':'); return { n, t: +t * 1000 } })
;(async () => {
  /* 自带的 chromium，不用装机版 Chrome —— 后者在这台机器上跑二三十秒就挨 SIGKILL
     （08-30 实测，见 docs/FINDING-2026-08-30-chrome-sigkill.md）。
     `regress.js` 是例外:它的基准哈希绑着浏览器，换一个就得重存，
     而那份基准记着 12 处已知漂移与存基准时的 commit，比这点稳定性值钱。 */
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 900, height: 1500 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]))
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
  await p.goto('file://' + require('path').resolve(FILE))
  // 把 canvas 撑到原始像素尺寸截图 —— 否则 CSS 缩放会把细节抹掉
  await p.evaluate(sel => {
    const c = document.querySelector(sel)
    Object.assign(c.style, { width: c.width + 'px', height: c.height + 'px', position: 'fixed',
      left: '0', top: '0', zIndex: '99999', maxWidth: 'none', maxHeight: 'none', imageRendering: 'pixelated' })
  }, SEL)
  let prev = 0
  for (const { n, t } of SHOTS) {
    await p.waitForTimeout(Math.max(0, t - prev)); prev = t
    await (await p.$(SEL)).screenshot({ path: `/tmp/rules/vil-${n}.png` })
    console.log(`✓ vil-${n}.png`)
  }
  console.log(errs.length ? '页面报错:\n' + [...new Set(errs)].slice(0, 6).join('\n') : '无页面报错')
  await b.close()
})()
