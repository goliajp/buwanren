/* 进屋看得见主人吗 —— 把主人整体染成品红重渲一次，数画面上还剩多少品红像素。
   剩下的就是没被家具挡住的那部分。开局那一瞬是进屋的第一印象，
   六间房里曾有三间在这一瞬看不见人，而三间的成因各不相同。 */
import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { PNG } from 'pngjs'
const 房 = { ayun:'阿云', bailu:'白鹭', popo:'婆婆', shenyan:'沈砚', tao:'桃桃', tenz:'丹增' }
/* 底线 80%：五间房实测都是 86%（那 14% 是脚下的影子盖掉的，各房一样）。
   丹增单列 —— 他盘坐在蒲团里，下半身本来就该陷进去，65% 是对的样子，
   不是被挡住。豁免写在这儿而不是把底线拉到 60%：
   底线一低，下一个真被家具压住 30% 的人就混过去了。 */
const 底线 = 0.80
const 豁免 = { tenz: [0.60, '盘坐在蒲团里，下半身本就该陷进去'] }
const 口 = 6098
const 服务 = spawn('python3', ['-m','http.server',String(口),'--directory','web/dist'], { stdio:'ignore' })
await new Promise(r => setTimeout(r, 900))
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:375,height:667}, deviceScaleFactor:2 })
await p.addInitScript(() => {
  globalThis.__area = 0
  const 装 = () => {
    if (!globalThis.placeActor || globalThis.placeActor.__dyed) return
    const 原 = globalThis.placeActor
    const 包 = function (id, ...rest) {
      const e = 原.call(this, id, ...rest)
      if (id !== globalThis.__host) return e
      const w = e.cv.width, h = e.cv.height
      const cv = globalThis.ENGINE_HOST.createCanvas(w, h), c = cv.getContext('2d')
      c.drawImage(e.cv, 0, 0)
      const d = c.getImageData(0, 0, w, h)
      let n = 0
      for (let i = 0; i < d.data.length; i += 4) {
        if (d.data[i+3] < 8) continue
        d.data[i] = 255; d.data[i+1] = 0; d.data[i+2] = 255; d.data[i+3] = 255; n++
      }
      c.putImageData(d, 0, 0)
      globalThis.__area = n
      return Object.assign(e, { cv })
    }
    包.__dyed = true
    globalThis.placeActor = 包
  }
  setInterval(装, 20)
})
let 错 = 0, 查 = 0
for (const [id, 名] of Object.entries(房)) {
  await p.addInitScript(`globalThis.__host = ${JSON.stringify(id)}`)
  await p.goto(`http://127.0.0.1:${口}/index.html?page=pages/room/index&room=${id}`)
  await p.waitForTimeout(2500)
  const 面积 = await p.evaluate(() => globalThis.__area)
  const buf = await p.screenshot()
  const png = PNG.sync.read(buf)
  let 见 = 0
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, bl] = [png.data[i], png.data[i+1], png.data[i+2]]
    if (r > 200 && g < 60 && bl > 200) 见++
  }
  见 /= 4                                   // deviceScaleFactor 2 → 面积四倍
  const 屏缩 = 375 / 1440                    // 画布 1440 宽铺到 375
  const 应见 = 面积 * 屏缩 * 屏缩
  const 率 = 应见 > 0 ? 见 / 应见 : 0
  查++
  const [线, 因] = 豁免[id] || [底线, '']
  const 过 = 率 >= 线
  if (!过) 错++
  const 百分 = Math.round(率 * 100)
  const 括注 = `（${Math.round(见)}/${Math.round(应见)} 像素）`
  console.log(`  ${过 ? '·' : '✗'} ${名}　露出 ${百分}%${括注}${因 ? '　— ' + 因 : ''}`)
}
await b.close(); 服务.kill()
if (查 !== 6) { console.log(`✗ 只查到 ${查} 间房`); process.exit(1) }
console.log((错 ? '✗ ' : '✓ ') + `进屋看得见主人 · 查了 ${查} 间房，底线 ${底线*100}%`)
process.exit(错 ? 1 : 0)
