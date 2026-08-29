const { chromium } = require('playwright')
const [FILE, X, Y, W, H, WAIT, CID, OUT] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5], +process.argv[6], +(process.argv[7]||34)*1000, process.argv[8]||'vilCanvas', process.argv[9]||'zoom']
;(async () => {
  /* 自带的 chromium，不用装机版 Chrome —— 后者在这台机器上跑二三十秒就挨 SIGKILL
     （08-30 实测，见 docs/FINDING-2026-08-30-chrome-sigkill.md）。
     `regress.js` 是例外:它的基准哈希绑着浏览器，换一个就得重存，
     而那份基准记着 12 处已知漂移与存基准时的 commit，比这点稳定性值钱。 */
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1200, height: 1000 } })
  await p.goto('file://' + require('path').resolve(FILE))
  await p.waitForTimeout(WAIT)
  // 从 canvas 原始像素里裁一块,再整数放大 3 倍(不插值,保持像素)
  const dataUrl = await p.evaluate(([x, y, w, h, cid]) => {
    const src = document.getElementById(cid)
    const c = document.createElement('canvas'); c.width = w * 3; c.height = h * 3
    const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false
    cx.drawImage(src, x, y, w, h, 0, 0, w * 3, h * 3)
    return c.toDataURL()
  }, [X, Y, W, H, CID])
  const fs = require('fs')
const path = require('path')
  fs.writeFileSync('/tmp/rules/'+OUT+'.png', Buffer.from(dataUrl.split(',')[1], 'base64'))
  console.log('✓ /tmp/rules/'+OUT+'.png')
  await b.close()
})()
