/* 把四十位的正面像素图导成小程序能直接用的头像。
 *
 * 【为什么要有这一步】界面上的头像原先是「圆底 + 姓名末字」——
 * 四十个占位圆牌。而美术其实早就画好了:四十位的正面 / 侧面 / 背面
 * 都在设计册里（`rooms/src/bible/charsheet.js` 的 CHARSPEC），
 * 只是从来没接到小程序这一侧。缺的不是画，是接线。
 *
 * 【为什么导成 PNG 而不是网格】小程序的列表里会同时出现几十个头像，
 * 每个都开一块 canvas 太重;而 12×16 的 PNG 单张只有一百多字节，
 * 四十位 base64 起来一共 8 KB，比网格数据还小一半。
 * 机检仍然对着设计册那边的网格做（调色板 / 包围盒 / 朝向），
 * 那一侧不受影响。
 *
 * PNG 是手写编码的（IHDR + IDAT + IEND，zlib 是 node 内置）——
 * 为这点事装一个图像库不值得，而且这段代码不会变。
 *
 * 跑法：bun rooms/tools/export-faces.mjs
 */
import { chromium } from 'playwright'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'
import { deflateSync } from 'zlib'

const 根 = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const 出口 = resolve(根, 'mini/miniprogram/engine/faces.js')

/* 颜色写法有 `#rgb` / `#rrggbb` / `rgb(r,g,b)` 三种混着来 —— 统一成 [r,g,b] */
const 拆色 = (c) => {
  const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(c.trim())
  if (m) return m.slice(1).map(Number)
  let s = c.trim().replace(/^#/, '')
  if (s.length === 3) s = [...s].map((ch) => ch + ch).join('')
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16))
}

const crc表 = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc = (buf) => {
  let c = -1
  for (const b of buf) c = crc表[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const 块 = (类型, 数据) => {
  const 长 = Buffer.alloc(4); 长.writeUInt32BE(数据.length)
  const 体 = Buffer.concat([Buffer.from(类型, 'ascii'), 数据])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(体))
  return Buffer.concat([长, 体, c])
}
/* RGBA 逐行，每行前面一个 0 = 不做行间预测。
   图这么小，预测省不下什么，而不预测的代码一眼看得懂。 */
const 成图 = (格) => {
  const h = 格.length, w = 格[0].length
  const raw = Buffer.alloc(h * (1 + w * 4))
  let i = 0
  for (const row of 格) {
    raw[i++] = 0
    for (const c of row) {
      if (c) { const [r, g, b] = 拆色(c); raw[i++] = r; raw[i++] = g; raw[i++] = b; raw[i++] = 255 }
      else i += 4                                   // 透明:留 0
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6                          // 8 位 · RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    块('IHDR', ihdr), 块('IDAT', deflateSync(raw, { level: 9 })), 块('IEND', Buffer.alloc(0)),
  ])
}

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } })
await p.goto('file://' + resolve(根, 'rooms/design.html'))
await p.waitForTimeout(4500)
const 网格 = await p.evaluate(() => {
  const out = {}
  for (const [id, v] of Object.entries(globalThis.CHARSPEC || {})) {
    const g = v.portrait || v.front
    if (g && g.g) out[id] = g.g.map((r) => r.map((c) => c || ''))
  }
  return out
})
await b.close()

const 位数 = Object.keys(网格).length
if (位数 < 40) throw new Error(`只导出了 ${位数} 位 —— 设计册没加载完，别把半份产物写下去`)

const 脸 = {}
for (const [id, 格] of Object.entries(网格))
  脸[id] = 'data:image/png;base64,' + 成图(格).toString('base64')

writeFileSync(出口, `/* 四十位的头像 —— 由 rooms/tools/export-faces.mjs 从设计册导出。
   手改这个文件没有意义:下一次导出就覆盖掉了。要改脸去改设计册
   （rooms/src/bible/charsheet.js 的 FRONT_OVR / 图鉴原生图）。 */
module.exports = ${JSON.stringify(脸)}
`)
const 大小 = Object.values(脸).reduce((n, s) => n + s.length, 0)
console.log(`✓ ${出口.replace(根 + '/', '')}  ${位数} 位 · ${(大小 / 1024).toFixed(1)} KB`)
