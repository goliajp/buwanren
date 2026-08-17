  /* ══════════════════════════════════════════════════════════════
     表面资源 SURFACES —— 地板 / 墙面也是资源,而不是管线里的硬编码。
     没有这一层,36 间房永远是同一间木屋:玛雅石室、游牧帐篷、赛博公寓
     的地面与墙体材质完全不同,必须可替换。
     ══════════════════════════════════════════════════════════════ */
  const SURF = {}
  window.SURFACES = SURF
  window.defSurface = function (id, spec) { spec.id = id; SURF[id] = spec }

  defSurface('floor_plank', {
    name: '木地板 · 横板', tags: ['木','暖','中式'],
    draw(g, W, H, y0, P) {
      const A = P.floor || '#c9a26a', B = P.floorAlt || '#c2985e'
      for (let y = y0, k = 0; y < H; y += 48, k++) {
        g.fillStyle = k % 2 ? A : B
        g.fillRect(0, y, W, 48)
        g.fillStyle = P.floorSeam || '#a87f48'; g.fillRect(0, y, W, 4)
        g.fillStyle = P.floorNail || '#b08850'
        for (let x = (k % 2) * 140; x < W; x += 280) g.fillRect(x, y, 4, 48)
        g.fillStyle = P.floorGrain || '#bb9058'   // 写死过 —— 换灰木调的房间会被它拉回暖橙
        g.fillRect((k * 106) % W, y + 20, 16, 2)
        g.fillRect((k * 194 + 80) % W, y + 32, 12, 2)
      }
    }
  })
  defSurface('floor_stone', {
    name: '石板地 · 不规则', tags: ['石','冷','古'],
    /* 石板的四色原先写死在数组里,只有底色读 palette —— 换一间房就只能接受那个暖灰。
       改成读 P.slabs(四色数组),不给就用原来那四色 —— 已有房间逐像素不变。
       缝色也一并放出来(P.slabSeam),青砖地的缝比石板地的深。 */
    draw(g, W, H, y0, P) {
      const slabs = P.slabs || ['#98907f', '#8d8578', '#a09784', '#928a7b']
      const seam = P.slabSeam || 'rgba(40,34,26,0.22)'
      g.fillStyle = P.floor || '#8d8578'; g.fillRect(0, y0, W, H)
      for (let r = 0, k = 0; y0 + r * 132 < H; r++)
        for (let c = 0; c < 7; c++, k++) {
          const x = c * 210 + (r % 2) * 66 - 40, y = y0 + r * 132
          g.fillStyle = slabs[k % slabs.length]
          g.fillRect(x + 5, y + 5, 200, 122)
          g.fillStyle = seam; g.fillRect(x + 5, y + 122, 200, 5)
        }
    }
  })
  defSurface('floor_tatami', {
    name: '榻榻米 · 草席', tags: ['草','和风','暖'],
    draw(g, W, H, y0, P) {
      g.fillStyle = P.floor || '#c8bc86'; g.fillRect(0, y0, W, H)
      for (let r = 0; y0 + r * 200 < H; r++)
        for (let c = 0; c < 4; c++) {
          const x = c * 360, y = y0 + r * 200
          g.fillStyle = (r + c) % 2 ? '#c8bc86' : '#bfb27b'
          g.fillRect(x + 4, y + 4, 352, 192)
          g.fillStyle = '#2f4a3a'; g.fillRect(x + 4, y + 4, 352, 7); g.fillRect(x + 4, y + 189, 352, 7)
          g.fillStyle = 'rgba(90,80,40,0.14)'
          for (let n = 0; n < 24; n++) g.fillRect(x + 10, y + 14 + n * 7, 340, 1)
        }
    }
  })
  defSurface('floor_mat_bamboo', {
    name: '竹席地 · 江南', tags: ['竹', '席', '潮', '南方'],
    /* 江南民居的席是【一张张铺】的:比榻榻米宽扁,没有那圈深绿布边,
       席与席之间只有一道接缝和一条素色包边。
       `floor_bamboo` 是桃桃房专用的 —— 颜色、那块窗光多边形、40 个磨损点
       全写死在里面,换一间房就是错的。这一张全部走 palette,可复用。
       读:floor(底) · floorAlt(隔行) · floorGrain(横篾) · floorSeam(接缝) · floorNail(包边) */
    draw(g, W, H, y0, P) {
      const base = P.floor || '#b3a375', alt = P.floorAlt || '#ab9b6e'
      const weft = P.floorGrain || '#9c8d63', seam = P.floorSeam || '#8a7c56'
      const hem = P.floorNail || '#7d7050'
      const ROW = 232
      g.fillStyle = base; g.fillRect(0, y0, W, H - y0)
      for (let r = 0, y = y0; y < H; r++, y += ROW) {
        g.fillStyle = r % 2 ? alt : base
        g.fillRect(0, y, W, Math.min(ROW, H - y))
        // 横篾 —— 细密的一道道,竹席的主纹理
        g.fillStyle = weft
        for (let n = 0; y + 8 + n * 13 < Math.min(y + ROW - 6, H); n++) g.fillRect(0, y + 8 + n * 13, W, 2)
        // 竖向篾条 —— 隔行错位,编织的经纬才看得出来
        g.fillStyle = 'rgba(126,114,78,0.22)'
        for (let x = (r % 2) * 16; x < W; x += 32) g.fillRect(x, y + 5, 3, Math.min(ROW - 10, H - y - 5))
        // 包边与接缝
        g.fillStyle = hem; g.fillRect(0, y, W, 5)
        if (y + ROW < H) { g.fillRect(0, y + ROW - 6, W, 5); g.fillStyle = seam; g.fillRect(0, y + ROW - 2, W, 3) }
      }
      // 走出来的路 —— 席面被踩得发白。坐标由行列推,不写死,换房仍成立
      g.fillStyle = 'rgba(226,216,184,0.16)'
      for (let n = 0; n < 46; n++) {
        const x = ((n * 617) % (W - 120)) + 40, y = y0 + ((n * 439) % (H - y0 - 80)) + 20
        g.fillRect(x, y, 46 + (n % 5) * 14, 3)
      }
      // 墙根与角落发暗 —— 江南的潮气是从下往上的
      g.fillStyle = 'rgba(78,70,50,0.13)'; g.fillRect(0, y0, W, 46)
      g.fillStyle = 'rgba(78,70,50,0.09)'; g.fillRect(0, y0 + 46, 54, H - y0); g.fillRect(W - 54, y0 + 46, 54, H - y0)
    }
  })
  defSurface('floor_concrete', {
    name: '水泥地 · 现代', tags: ['现代','冷','赛博'],
    draw(g, W, H, y0, P) {
      g.fillStyle = P.floor || '#5c5f66'; g.fillRect(0, y0, W, H)
      g.fillStyle = 'rgba(255,255,255,0.03)'
      for (let n = 0; n < 90; n++) g.fillRect((n * 211) % W, y0 + (n * 97) % (H - y0), 3, 3)
      g.fillStyle = 'rgba(20,22,26,0.25)'
      for (let k = 0; k < 5; k++) g.fillRect(0, y0 + k * 430, W, 3)
    }
  })
  defSurface('wall_wood', {
    name: '木墙 + 顶梁', tags: ['木','中式'],
    draw(g, W, hw, P) {
      g.fillStyle = P.wall || '#7e5e40'; g.fillRect(0, 0, W, hw)
      g.fillStyle = P.wallLine || '#6e5236'
      for (let y = 52; y < hw - 30; y += 60) g.fillRect(0, y, W, 6)
      g.fillStyle = P.skirt || '#4a3420'; g.fillRect(0, hw - 6, W, 8)
    }
  })
  defSurface('wall_stone', {
    name: '石墙 · 砌块', tags: ['石','古','冷'],
    draw(g, W, hw, P) {
      g.fillStyle = P.wall || '#6b6559'; g.fillRect(0, 0, W, hw)
      for (let r = 0; r * 74 < hw; r++)
        for (let c = 0; c < 10; c++) {
          const x = c * 150 + (r % 2) * 75 - 40
          g.fillStyle = ['#736c5e','#6b6559','#7b7466'][(r + c) % 3]
          g.fillRect(x + 4, r * 74 + 4, 142, 66)
        }
      g.fillStyle = P.skirt || '#413c34'; g.fillRect(0, hw - 8, W, 10)
    }
  })
  defSurface('wall_plaster', {
    name: '素墙 · 抹灰', tags: ['现代','素','冷'],
    draw(g, W, hw, P) {
      g.fillStyle = P.wall || '#3f434b'; g.fillRect(0, 0, W, hw)
      g.fillStyle = 'rgba(255,255,255,0.025)'
      for (let n = 0; n < 60; n++) g.fillRect((n * 233) % W, (n * 71) % hw, 40, 1)
      g.fillStyle = P.skirt || '#2b2e34'; g.fillRect(0, hw - 8, W, 10)
    }
  })

  // ═══ 桃桃房表面（竹席地板 / 抹灰墙）═══
  defSurface('wall_taohua', {
    name: '抹灰白墙 · 木梁', draw(g, W, hw, P) {
      g.fillStyle='#ece4d6';g.fillRect(0,0,1440,430)
          g.fillStyle='#e2d8c6'
          const SP=[[1173,260],[556,141],[520,70],[727,137],[306,108],[160,359],[558,167],[1050,235],[662,192],[21,89],[141,372],[129,107],[1186,0],[1397,252],[314,303],[1013,156],[1282,149],[440,340],[662,170],[395,92],[226,304],[1192,147],[254,130],[988,332],[1088,165],[1348,150],[835,106],[407,376],[271,358],[31,320]]
          for(let k=0;k<30;k++)g.fillRect(SP[k][0],SP[k][1],14,2)
          g.fillStyle='#8a6844';g.fillRect(0,0,1440,34)
          g.fillStyle='#755838';g.fillRect(0,28,1440,6)
          for(const x of [0,470,940,1408]){
            g.fillStyle='#8a6844';g.fillRect(x,0,32,430)
            g.fillStyle='#755838';g.fillRect(x+26,0,6,430)
          }
          g.fillStyle='#8a6844';g.fillRect(0,408,1440,22)
          g.fillStyle='#6e5236';g.fillRect(0,424,1440,6)
    }
  })
  defSurface('floor_bamboo', {
    name: '竹席地板', draw(g, W, H, hw, P) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      for(let y=430,k=0;y<2160;y+=26,k++){
            g.fillStyle=k%2?'#b8c294':'#aeb88a'
            g.fillRect(0,y,1440,26)
            g.fillStyle='#98a476';g.fillRect(0,y,1440,2)
            const off=k%2*60
            g.fillStyle='#a2ac80'
            for(let x=off;x<1440;x+=120)g.fillRect(x,y+6,3,14)
          }
          g.fillStyle='rgba(150,160,110,0.5)'
          const WR=[[180,1283,24],[1069,1523,12],[326,696,14],[723,717,20],[716,1911,12],[178,1507,22],[112,970,17],[997,1780,19],[20,1064,20],[664,2034,24],[1149,1376,25],[242,606,20],[941,517,20],[540,851,18],[343,1374,17],[285,1081,20],[1116,1867,24],[232,1813,25],[857,926,14],[487,1116,14],[760,1966,17],[1151,721,21],[906,773,13],[1334,1613,18],[1154,1844,19],[562,650,25],[1330,666,15],[656,1638,23],[1100,1009,13],[1232,1531,13],[729,1230,13],[1328,2017,18],[714,1718,16],[24,1802,13],[432,1952,19],[375,885,23],[492,895,15],[530,852,20],[852,1269,15],[177,647,22]]
          for(let k=0;k<40;k++)g.fillRect(WR[k][0],WR[k][1],WR[k][2],1)
          g.fillStyle='rgba(255,200,214,0.12)'
          g.beginPath();g.moveTo(1020,430);g.lineTo(1330,430);g.lineTo(1400,760);g.lineTo(1100,760);g.fill()
          for(let y=2160,k=66;y<2560;y+=26,k++){
            g.fillStyle=k%2?'#b8c294':'#aeb88a'
            g.fillRect(0,y,1440,26)
            g.fillStyle='#98a476';g.fillRect(0,y,1440,2)
            g.fillStyle='#a2ac80'
            for(let x=k%2*60;x<1440;x+=120)g.fillRect(x,y+6,3,14)
          }
    }
  })

  // ═══ 婆婆房表面（紫灰石墙 / 旧深木板）═══
  // 立意：整屋一种光（她不分场合）。墙冷、地暖，光靠烛火与壁炉补，
  // 所以表面本身压得住，不抢陈设。
  defSurface('wall_popo_stone', {
    name: '紫灰石墙 · 砌块', tags: ['石','夜','冷'],
    draw(g, W, hw, P) {
      g.fillStyle = P.wall || '#4a4258'; g.fillRect(0, 0, W, hw)
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 12; c++) {
          const x = c * 124 + (r % 2) * 62 - 30, y = r * 62
          g.fillStyle = (r + c) % 3 ? '#524a62' : '#443c52'
          g.fillRect(x + 2, y + 2, 120, 58)
          g.fillStyle = P.wallLine || '#38324a'
          g.fillRect(x, y, 124, 2); g.fillRect(x, y, 2, 62)
        }
      g.fillStyle = P.skirt || '#38324a'; g.fillRect(0, hw - 26, W, 26)
    }
  })
  defSurface('floor_popo_plank', {
    name: '旧深木板', tags: ['木','旧','暗'],
    draw(g, W, H, y0, P) {
      const rnd = (function (a) { return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      } })(13)
      for (let y = y0, k = 0; y < H; y += 26, k++) {
        g.fillStyle = k % 2 ? (P.floor || '#5a4a3e') : (P.floorAlt || '#544539')
        g.fillRect(0, y, W, 26)
        g.fillStyle = P.floorSeam || '#463a30'; g.fillRect(0, y, W, 2)
        g.fillStyle = P.floorNail || '#4e4034'
        for (let x = (k % 2) * 70; x < W; x += 140) g.fillRect(x, y, 2, 26)
      }
      // 踩了很多年的划痕 —— 她每天都要走这几趟
      g.fillStyle = 'rgba(30,24,20,0.5)'
      for (let k = 0; k < 70; k++)
        g.fillRect((rnd() * (W - 40)) | 0, y0 + ((rnd() * (H - y0 - 20)) | 0), 12 + ((rnd() * 24) | 0), 1)
    }
  })

  /* ══ 调色替换 palette swap —— 像素游戏的标准换装手段 ══
     逐像素把 A 色换成 B 色,任何现有素材都能改配色而不必改 draw()。
     只在光栅化时做一次(结果进 sprite 缓存),运行时零开销。 */
  function swapPalette(cv, map) {
    const c = cv.getContext('2d')
    const im = c.getImageData(0, 0, cv.width, cv.height), d = im.data
    const from = [], to = []
    for (const k in map) {
      from.push([parseInt(k.slice(1, 3), 16), parseInt(k.slice(3, 5), 16), parseInt(k.slice(5, 7), 16)])
      const v = map[k]
      to.push([parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)])
    }
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue
      for (let m = 0; m < from.length; m++)
        if (Math.abs(d[i] - from[m][0]) < 10 && Math.abs(d[i+1] - from[m][1]) < 10 && Math.abs(d[i+2] - from[m][2]) < 10) {
          d[i] = to[m][0]; d[i+1] = to[m][1]; d[i+2] = to[m][2]; break
        }
    }
    c.putImageData(im, 0, 0)
    return cv
  }

  /* ══ 变体:同一素材换配色,避免 36 间房长得一样 ══
     tint = 整体染色(source-atop 保留明暗层次);pal = 交给 draw() 自行解释 */
  function applyVariant(cv, opt) {
    if (!opt || !opt.tint) return cv
    const c = cv.getContext('2d')
    c.save(); c.globalCompositeOperation = 'source-atop'
    c.globalAlpha = opt.tintAmount != null ? opt.tintAmount : 0.35
    c.fillStyle = opt.tint; c.fillRect(0, 0, cv.width, cv.height); c.restore()
    return cv
  }
  // 做旧:把一件 sprite 蒙上尘。像素级降饱和 + 压暗 + 微冷偏(浮尘偏冷),
  // 不用 canvas g.filter —— 小程序 canvas 不保证支持 CSS 滤镜。生成一次即缓存。
  // 这是引擎能力,不是哪间房特化:任何「旧/没人打理」的一侧都能用(丹增的经堂、
  // 婆婆的旧物……),房间只需在素材或摆位上标 patina。
  function makePatina(src) {
    const cv = document.createElement('canvas')
    const W = cv.width = src.width, H = cv.height = src.height
    const c = cv.getContext('2d'); c.drawImage(src, 0, 0)
    const im = c.getImageData(0, 0, W, H), d = im.data
    // 旧 ≠ 颜色统一变灰。底色留着,表面落一层【斑驳、不均匀】的浮尘 ——
    // 顶面凹处积得多,别处少;外加极轻氧化。均匀降饱和是错的做旧模型。
    // 块状确定性噪声:同一块 3px 共一个值,让尘成斑不成点;尺寸掺进种子,
    // 不同物件斑纹不同。灰尘偏暖(206,198,180),不是冷灰。
    const hash = (a, b) => {
      let h = (a * 374761393 + b * 668265263 + W * 2246822519 + H * 3266489917) | 0
      h = Math.imul(h ^ (h >>> 13), 1274126177)
      return ((h ^ (h >>> 16)) >>> 0) / 4294967295
    }
    for (let y = 0; y < H; y++) {
      const topBias = 1 - y / H                        // 越靠上积灰越厚(水平顶面)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        if (d[i + 3] === 0) continue
        const lum = 0.30 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]
        const k = 0.10                                 // 极轻氧化,底色基本留着
        d[i]     = (d[i]     + (lum - d[i])     * k) * 0.97
        d[i + 1] = (d[i + 1] + (lum - d[i + 1]) * k) * 0.97
        d[i + 2] = (d[i + 2] + (lum - d[i + 2]) * k) * 0.96
        // 薄薄一层灰,不是撒盐。大块低频噪声(成斑不成点)、高阈值(稀疏)、
        // 低浓度(淡)。绝大多数像素不落尘,只在少数成片区域淡淡蒙一层。
        const n = hash((x / 6) | 0, (y / 6) | 0)
        const thresh = 0.80 - 0.14 * topBias
        if (n > thresh) {
          const dust = Math.min(0.16, (n - thresh) * (0.5 + 0.7 * topBias))
          d[i]     = d[i]     * (1 - dust) + 206 * dust
          d[i + 1] = d[i + 1] * (1 - dust) + 198 * dust
          d[i + 2] = d[i + 2] * (1 - dust) + 180 * dust
        }
      }
    }
    c.putImageData(im, 0, 0)
    return cv
  }

  // 木头旧化 ≠ 蒙尘。木器旧了是【区域变色 + 裂印】:不均匀的氧化加深(发红褐)
  // 加几道顺纹的裂缝,底色留着。给佛龛、书架这类木器用(patina:'wood')。
  function makeWeathered(src) {
    const cv = document.createElement('canvas')
    const W = cv.width = src.width, H = cv.height = src.height
    const c = cv.getContext('2d'); c.drawImage(src, 0, 0)
    const im = c.getImageData(0, 0, W, H), d = im.data
    const hash = (a, b) => {
      let h = (a * 374761393 + b * 668265263 + W * 2246822519 + H * 3266489917) | 0
      h = Math.imul(h ^ (h >>> 13), 1274126177)
      return ((h ^ (h >>> 16)) >>> 0) / 4294967295
    }
    // 区域变色:大块低频噪声,部分区域氧化加深、偏红褐(蓝掉得最多)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        if (d[i + 3] === 0) continue
        const n = hash((x / 9) | 0, (y / 9) | 0)
        if (n > 0.5) {
          const dk = (n - 0.5) * 0.44          // 0..0.22 加深量
          d[i]     = d[i]     * (1 - dk * 0.55)
          d[i + 1] = d[i + 1] * (1 - dk * 0.90)
          d[i + 2] = d[i + 2] * (1 - dk * 1.15)   // 蓝掉最多 → 暖红褐
        }
      }
    }
    c.putImageData(im, 0, 0)
    // 裂印:几道顺纹(竖向)断续暗线,只落在实体上
    c.globalCompositeOperation = 'source-atop'
    c.strokeStyle = 'rgba(38,24,14,0.34)'; c.lineWidth = 1
    const NC = 3 + (((W * H) >> 8) % 3)        // 3-5 道
    for (let ci = 0; ci < NC; ci++) {
      let x = (hash(ci * 7 + 1, 3) * (W - 4) + 2) | 0
      let y = (hash(ci * 7 + 2, 9) * H * 0.35) | 0
      const end = Math.min(H, y + H * (0.3 + hash(ci, 5) * 0.45))
      c.beginPath(); let drawing = true
      for (; y < end; y++) {
        if (hash(ci, y) < 0.14) { drawing = !drawing; c.moveTo(x + 0.5, y) }  // 断续
        if (hash(ci * 3, y) < 0.22) x += hash(y, ci) < 0.5 ? -1 : 1           // 抖动
        if (drawing) c.lineTo(x + 0.5, y + 1); else c.moveTo(x + 0.5, y + 1)
      }
      c.stroke()
    }
    return cv
  }

  window.placeAsset = function (id, x, y, opt) {
    const a = A[id]
    if (!a) throw new Error('未知素材: ' + id)
    opt = opt || {}
    // sprite 按 (id + 变体) 缓存 —— 同一素材摆 N 次只光栅化一次
    const key = id + '|' + (opt.variant || '') + '|' + (opt.tint || '') + '|' + (opt.pal ? opt.pal.join() : '') + '|' + (opt.swap ? JSON.stringify(opt.swap) : '')
    let cv = SPRITE_CACHE[key]
    if (!cv) {
      cv = document.createElement('canvas')
      cv.width = a.w; cv.height = a.h
      const c = cv.getContext('2d'); c.scale(2, 2)
      a.draw(c, opt)
      applyVariant(cv, opt)
      if (opt.swap) swapPalette(cv, opt.swap)
      SPRITE_CACHE[key] = cv
    }
    const pat = opt.patina || a.patina
    if (pat) {
      const wood = pat === 'wood'
      const pk = key + (wood ? '|weathered' : '|patina')
      cv = SPRITE_CACHE[pk] || (SPRITE_CACHE[pk] = (wood ? makeWeathered : makePatina)(cv))
    }
    return {
      id, x, y, cv, asset: a, opt,
      baseY: y + a.base,
      sortKey: y + a.base + (opt.zBias || 0),   // 附着物用 zBias 抬到宿主之上
      attach: opt.attach || null,
      foot: [x + a.foot[0], y + a.foot[1], a.foot[2], a.foot[3]],
      light: (function (L) {
        // light 可以是函数 —— 灯有开关。补光灯只在开播时亮,不播时房里只剩她自己那盏暖黄。
        if (typeof L === 'function') { try { L = L((opt.room && opt.room.state) || {}) } catch (e) { L = null } }
        return L ? { x: x + L.x, y: y + L.y, r: L.r, color: L.color, flicker: L.flicker } : null
      })(a.light),
      wall: !!a.wall,
    }
  }

