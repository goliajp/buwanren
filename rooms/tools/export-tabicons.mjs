/* 底栏那三对图标。
 *
 * 【为什么要有】底栏原先是三个纯文字标签，选中态只是「灰字变黑字」，
 * 而那个黑（#1a1a1c）既不是 --ink 也不是主色 —— 主色在导航里一次都没出现过。
 * 三个文字标签加黑色选中，是「这是个通用小程序」这个印象最直接的来源;
 * 星露谷 / 动森那一档的界面，导航永远是图标先行（2026-09-01 五路评审 · 视觉）。
 *
 * 【为什么是像素画】这个产品全身都是像素:四十位村民、六间屋、一整幅村子。
 * 用线性描边图标会立刻把它打回通用风 —— 图标得跟世界是同一套画法。
 *
 * 【怎么画】16×16 的字符网格，一个字符一个像素，放大 5 倍写成 80×80 的 PNG。
 * PNG 是手写编码的（IHDR + IDAT + IEND），跟 export-faces.mjs 同一套 ——
 * 为这点事装图像库不值得，而这段代码不会变。
 *
 * 跑法：bun rooms/tools/export-tabicons.mjs
 */
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { deflateSync } from 'zlib'

const 根 = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const 出口 = resolve(根, 'mini/miniprogram/images')
mkdirSync(出口, { recursive: true })

/* 三个图标。`.` 是透明，其余字母查下面那张色表。
   村子 —— 地图上那种尖顶小屋，门朝你开着
   今天 —— 转盘:一圈边 + 顶上一个缺口（就是那颗指针指的地方）
   我的 —— 御守:一枚小布袋 + 一根挂绳，这个产品自己的东西 */
const 图 = {
  village: [
    '................',
    '.......RR.......',
    '......RRRR......',
    '.....RRRRRR.....',
    '....RRRRRRRR....',
    '...RRRRRRRRRR...',
    '..RRRRRRRRRRRR..',
    '.WWWWWWWWWWWWWW.',
    '.W..W......W...W',
    '.W..W......W...W',
    '.WDDDW....WWWWW.',
    '.WDDDW....W...W.',
    '.WDDDW....W...W.',
    '.WDDDW....WWWWW.',
    '.WWWWWWWWWWWWWW.',
    '................',
  ],
  /* 今天 —— 一轮太阳。
     先画的是转盘（这一屏的主体就是那个盘），可十六像素下它读成一团 ——
     加厚圈、缩内芯、补指针都试过，仍然像颗蛋或一只口袋。
     图标要的是【一眼认得出】，不是【画得像屏上那个东西】:
     「今天」就是一天，而太阳是这个尺寸下最不会认错的形。 */
  today: [
    '................',
    '.......AA.......',
    '..A....AA....A..',
    '...A...AA...A...',
    '....AAAAAAAA....',
    '...AAALLLLAAA...',
    '..AAALLLLLLAAA..',
    'AA.AALLLLLLAA.AA',
    'AA.AALLLLLLAA.AA',
    '..AAALLLLLLAAA..',
    '...AAALLLLAAA...',
    '....AAAAAAAA....',
    '...A...AA...A...',
    '..A....AA....A..',
    '.......AA.......',
    '................',
  ],
  /* 我的 —— 御守:一枚小布袋加一根挂绳。这是这个产品自己的东西。
     第一版挂绳只有一像素宽、袋口那两点像眼睛;加粗绳、把袋口画成
     一道横缝，就成了一枚荷包。 */
  me: [
    '................',
    '......KKKK......',
    '.....KK..KK.....',
    '.....KK..KK.....',
    '....KKKKKKKK....',
    '...AAAAAAAAAA...',
    '..AAAAAAAAAAAA..',
    '..AAAALLLLAAAA..',
    '..AAAAAAAAAAAA..',
    '..AAAAAAAAAAAA..',
    '..AAAAAAAAAAAA..',
    '..AAAAAAAAAAAA..',
    '...AAAAAAAAAA...',
    '....AAAAAAAA....',
    '................',
    '................',
  ],
}

/* 两档色:没选中是石灰（跟 --ink-faint 同一档，读得出来又不抢），
   选中是琥珀（主色 —— 它在导航里从来没出现过）。 */
const 色板 = {
  off: { R: '#9B9186', W: '#B8AFA3', D: '#857B70', A: '#9B9186', K: '#B8AFA3', L: '#CFC7BC' },
  on:  { R: '#E8791A', W: '#FF9A3C', D: '#C25E0A', A: '#FF9A3C', K: '#E8791A', L: '#FFE7CC' },
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
const 拆色 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

/** 网格 → PNG。`倍` 是放大倍数，整数倍才不会把像素放糊 */
function 成图(网格, 板, 倍) {
  const W = 网格[0].length * 倍, H = 网格.length * 倍
  const raw = Buffer.alloc(H * (1 + W * 4))
  let i = 0
  for (let y = 0; y < H; y++) {
    raw[i++] = 0
    for (let x = 0; x < W; x++) {
      const ch = 网格[(y / 倍) | 0][(x / 倍) | 0]
      const hex = 板[ch]
      if (hex) { const [r, g, b] = 拆色(hex); raw[i++] = r; raw[i++] = g; raw[i++] = b; raw[i++] = 255 }
      else i += 4
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    块('IHDR', ihdr), 块('IDAT', deflateSync(raw, { level: 9 })), 块('IEND', Buffer.alloc(0)),
  ])
}

let n = 0
for (const [名, 网格] of Object.entries(图)) {
  for (const 态 of ['off', 'on']) {
    const buf = 成图(网格, 色板[态], 5)          // 16 × 5 = 80，微信要的是 81 上下
    writeFileSync(resolve(出口, `tab-${名}${态 === 'on' ? '-on' : ''}.png`), buf)
    n++
  }
}
console.log(`✓ mini/miniprogram/images  ${n} 张底栏图标 · 80×80 · 像素画放大 5 倍`)
