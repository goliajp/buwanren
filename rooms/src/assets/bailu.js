
  /* ══ 白鹭家 · 观舍 —— S4 骨架的四件定调大件 ══
     北窗(唯一的光)· 排盘长案(本业)· 多肉架(反差爱好)· 白布客座(分界线核心)。
     全部自画,scope:'character' —— 家具承载身份,不从库里取。 */
  def("bailu_window_north", {
    clickable: true, say: '北窗。光是冷的，正好',
    sayDeep: ['朝南的屋子我住不惯', '……南光晃眼，看不清盘', '而且暖。暖了就容易多说话'],
    name: "北窗", cat: "墙面", tags: ["朝北", "冷光", "全屋唯一自然光"],
    scope: "character", fromRoom: 'bailu', wall: true,
    w: 288, h: 300, base: 300, foot: [0, 300, 288, 0], zLayer: 'sort',
    light: { x: 144, y: 170, r: 300, color: '#b8c8d8', flicker: 0 },
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#4a4438'; g.fillRect(0, 0, 288, 300)          // 窗框
      g.fillStyle = '#6b6152'; g.fillRect(8, 8, 272, 284)
      g.fillStyle = '#cdd8e0'; g.fillRect(18, 18, 252, 264)        // 窗外的冷白
      g.fillStyle = '#dae3e9'; g.fillRect(18, 18, 252, 120)
      // 窗棂 —— 方格,间距一致。她连窗格都是量过的
      g.fillStyle = '#5c5445'
      for (let k = 0; k <= 4; k++) g.fillRect(18 + k * 63, 18, 7, 264)
      for (let k = 0; k <= 4; k++) g.fillRect(18, 18 + k * 66, 252, 7)
      g.fillStyle = '#7d7361'
      for (let k = 0; k <= 4; k++) g.fillRect(18 + k * 63, 18, 3, 264)
      g.fillStyle = '#4a4438'; g.fillRect(0, 286, 288, 14)          // 窗台
      g.fillStyle = '#6b6152'; g.fillRect(6, 286, 276, 6)
      g.restore()
    }
  })

  def("bailu_desk_chart", {
    clickable: true, say: '排盘的案。东西的位置不动',
    sayDeep: ['尺在左，笔在右，纸居中', '……不为讲究，为快', '手不用找，眼睛就能一直在盘上'],
    name: "排盘长案", cat: "桌案", tags: ["长案", "一切对齐", "紫微斗数"],
    scope: "character", fromRoom: 'bailu',
    w: 540, h: 224, base: 224, foot: [0, 0, 540, 224], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 长条画案 —— 明式,素。要点:案面木纹 + 三层棱、牙板起线、腿有侧脚、包浆。左上来光。
      const D1='#4a4032', D2='#5c5142', D3='#6e6252', D4='#7e7160', DK='#332c22'
      // 接触阴影
      g.fillStyle='rgba(38,34,26,0.22)'; g.fillRect(8, 214, 524, 10)
      // ── 案面 ──
      g.fillStyle=DK; g.fillRect(0, 0, 540, 44)                       // 案面侧厚(暗)
      g.fillStyle=D3; g.fillRect(0, 0, 540, 34)                       // 案面
      g.fillStyle=D4; g.fillRect(0, 0, 540, 8)                        // 顶棱受光
      g.fillStyle='rgba(126,113,96,0.5)'; g.fillRect(0, 8, 540, 3)
      // 木纹:长向细纹,深浅交替
      g.strokeStyle='rgba(52,44,34,0.16)'; g.lineWidth=1
      for (let k=0;k<6;k++){ g.beginPath(); const y=6+k*5; g.moveTo(8,y); g.bezierCurveTo(180,y+ (k%2?2:-2),360,y+(k%2?-2:2),532,y); g.stroke() }
      g.fillStyle='rgba(140,126,104,0.3)'; g.fillRect(0,0,540,2)      // 前棱高光
      g.fillStyle='rgba(40,34,26,0.3)'; g.fillRect(0,40,540,4)        // 案面下沿暗
      // ── 牙板(案面下的横档,起阳线)──
      g.fillStyle=D1; g.fillRect(24, 44, 492, 34)
      g.fillStyle=D2; g.fillRect(24, 46, 492, 28)
      g.fillStyle=D3; g.fillRect(24, 48, 492, 4)                      // 牙板上受光
      g.fillStyle='rgba(50,42,32,0.4)'; g.fillRect(28, 66, 484, 3)    // 起线阴影
      g.fillStyle=D4; g.fillRect(28, 68, 484, 2)                      // 阳线高光
      // 牙头(两端的卷云)
      g.fillStyle=D2; g.fillRect(24, 44, 20, 44); g.fillRect(496, 44, 20, 44)
      g.fillStyle='rgba(50,42,32,0.35)'; g.fillRect(40, 60, 8, 20); g.fillRect(492, 60, 8, 20)
      // ── 两腿(有侧脚,上窄下宽)──
      for (const lx of [40, 460]) {
        g.fillStyle=DK; g.fillRect(lx, 78, 40, 138)
        g.fillStyle=D2; g.fillRect(lx+2, 80, 34, 134)
        g.fillStyle=D3; g.fillRect(lx+2, 80, 8, 134)                  // 腿受光棱
        g.fillStyle='rgba(126,113,96,0.4)'; g.fillRect(lx+2, 80, 3, 134)
        g.fillStyle='rgba(48,40,30,0.35)'; g.fillRect(lx+30, 80, 6, 134)  // 腿背光棱
        g.fillStyle=D1; g.fillRect(lx-2, 208, 44, 12)                 // 足
        g.fillStyle=DK; g.fillRect(lx-2, 216, 44, 6)
      }
      // 横枨(两腿间)
      g.fillStyle=D2; g.fillRect(76, 176, 388, 14)
      g.fillStyle=D3; g.fillRect(76, 176, 388, 4)
      g.fillStyle='rgba(48,40,30,0.3)'; g.fillRect(76, 186, 388, 4)
      // ── 案面正中一道极浅的中线(她照着摆东西)──
      g.fillStyle='rgba(230,232,228,0.14)'; g.fillRect(268, 6, 2, 34)
      // 用久了的包浆:案面几处深亮
      g.fillStyle='rgba(150,134,110,0.16)'; g.fillRect(120, 14, 60, 12); g.fillRect(360, 16, 50, 10)
      g.restore()
    }
  })

  def("bailu_rack_plants", {
    clickable: true, say: '上层。这一层是去年入盆的',
    sayDeep: ['一共四十一盆', '……编号到四十二,少的那一盆枯了', '牌子我没拔。拔了就对不上账'],
    name: "多肉架 · 上层", cat: "收纳", tags: ["多肉", "命盘小牌", "编号"],
    scope: "character", fromRoom: 'bailu',
    w: 296, h: 152, base: 152, foot: [0, 108, 296, 44], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.20)'; g.fillRect(10, 140, 276, 9)
      // ── 层板:木,前沿受光 + 木纹 + 下沿暗 ──
      g.fillStyle = '#4a4336'; g.fillRect(0, 104, 296, 22)
      g.fillStyle = '#6e6558'; g.fillRect(0, 104, 296, 16)
      g.fillStyle = '#7e7568'; g.fillRect(0, 104, 296, 5)           // 前棱受光
      g.strokeStyle = 'rgba(52,48,40,0.2)'; g.lineWidth = 1
      for (let k=0;k<3;k++){ g.beginPath(); g.moveTo(4,110+k*4); g.lineTo(292,110+k*4); g.stroke() }
      g.fillStyle = '#3a352c'; g.fillRect(0, 120, 296, 6)          // 板下暗
      g.fillStyle = '#4a4336'; g.fillRect(8, 124, 14, 26); g.fillRect(274, 124, 14, 26)   // 立柱
      g.fillStyle = '#5c5548'; g.fillRect(8, 124, 5, 26); g.fillRect(274, 124, 5, 26)
      // ── 六盆:素陶,釉光 + 形阴影 + 层叠肉质 + 命盘牌 ──
      const POT = [[38, 96, 20], [86, 100, 22], [140, 94, 19], [190, 100, 22], [238, 96, 20], [278, 92, 17]]
      const LEAF = [['#5f7857','#78916e','#9fb593'], ['#6d8763','#86a07c','#a8bc9d'], ['#5a7050','#728a66','#93aa86']]
      POT.forEach(([cx, by, r], i) => {
        const h = r + 8
        // 盆:侧壁渐变(左受光右暗)
        const pgd = g.createLinearGradient(cx-r, 0, cx+r, 0)
        pgd.addColorStop(0, '#9c9080'); pgd.addColorStop(0.5, '#8a7f6d'); pgd.addColorStop(1, '#6f6555')
        g.fillStyle = pgd; g.fillRect(cx-r, by-h, r*2, h)
        g.fillStyle = '#a89c8a'; g.fillRect(cx-r, by-h, r*2, 4)     // 盆口沿受光
        g.fillStyle = '#5e5445'; g.fillRect(cx-r, by-4, r*2, 4)     // 盆底暗
        g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(cx-r+3, by-h+5, 3, h-9)   // 釉高光
        // 土:深褐 + 颗粒
        pxE(cx, by-h+2, r-2, 5, '#463f30')
        g.fillStyle = '#5a5240'; for(let q=0;q<5;q++) g.fillRect(cx-r+5+q*(r*2-10)/5|0, by-h, 2, 2)
        // 肉质:三层叠,左上受光
        const c = LEAF[i%3]
        pxE(cx, by-h-3, r+2, 12, c[0])
        pxE(cx, by-h-6, r-3, 9, c[1])
        pxE(cx-2, by-h-9, r-8, 6, c[2])
        pxE(cx-r*0.3|0, by-h-8, 3, 3, 'rgba(210,224,200,0.5)')      // 叶尖高光点
        // 命盘小牌:牌面 + 细字 + 插进土的一截
        const tx = cx + r - 7
        g.fillStyle = '#cbc8bd'; g.fillRect(tx, by-h-22, 14, 22)    // 牌暗边
        g.fillStyle = '#ece9dd'; g.fillRect(tx+1, by-h-21, 12, 18)
        g.fillStyle = '#eef4e0'; g.fillRect(tx+1, by-h-21, 12, 4)   // 牌顶受光
        g.fillStyle = '#5a5648'; g.fillRect(tx+3, by-h-17, 8, 1); g.fillRect(tx+3, by-h-14, 6, 1); g.fillRect(tx+3, by-h-11, 7, 1)
        g.fillStyle = '#9a9078'; g.fillRect(tx+5, by-h-4, 3, 5)     // 插土
      })
      g.restore()
    }
  })

  def("bailu_seat_covered", {
    clickable: true, say: '那是客位',
    sayDeep: ['……很久没人坐了', '有人坐过。他求我改命，我说我只念不改', '第二年他就没了'],
    name: "白布客座", cat: "坐卧", tags: ["蒙着白布", "客位", "★ 核心物件"],
    scope: "character", fromRoom: 'bailu',
    w: 232, h: 268, base: 268, foot: [16, 200, 200, 68], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,48,46,0.20)'; g.fillRect(24, 250, 184, 12)
      /* 一把木客椅,布只搭在【座面】上垂下来 —— 椅背、扶手、四腿全露在外,
         一眼是椅子。「不敢面对」用「盖着坐的地方」表达:没人坐,连坐处都蒙着。 */
      const W1='#6e6252', W2='#5c5344', W3='#7e7160', W4='#4a4234'
      // 后腿 + 前腿
      g.fillStyle=W4; g.fillRect(48,150,16,104); g.fillRect(168,150,16,104)
      g.fillStyle=W2; g.fillRect(44,238,20,16); g.fillRect(164,238,20,16)
      // 椅背:两立柱 + 顶搭脑 + 靠板
      g.fillStyle=W2; g.fillRect(52,24,18,132); g.fillRect(162,24,18,132)
      g.fillStyle=W3; g.fillRect(52,24,6,132); g.fillRect(162,24,6,132)
      pxE(116,30,72,14,W1); pxE(116,26,66,10,W3)                    // 搭脑(圆)
      g.fillStyle=W2; g.fillRect(70,52,92,68)                        // 靠板
      g.fillStyle=W1; g.fillRect(76,58,80,56)
      g.fillStyle='rgba(60,52,40,0.3)'; g.fillRect(90,58,4,56); g.fillRect(138,58,4,56)
      // 扶手
      g.fillStyle=W2; g.fillRect(40,120,20,12); g.fillRect(172,120,20,12)
      g.fillStyle=W1; g.fillRect(40,120,20,4); g.fillRect(172,120,20,4)
      // 座框
      g.fillStyle=W4; g.fillRect(44,150,144,16)
      // ── 白布:只搭在座面,前沿垂下一段,参差 ──
      g.fillStyle='#c9c9c2'; g.fillRect(46,132,140,26)              // 布顶暗
      g.fillStyle='#e6e6de'; g.fillRect(50,128,132,26)              // 布顶亮
      g.fillStyle='#f2f2ea'; g.fillRect(56,130,70,10)
      const HEM=[26,34,22,38,28,32,24,30]
      for(let k=0;k<HEM.length;k++){ g.fillStyle=k%2?'#dcdcd4':'#e4e4dc'; g.fillRect(48+k*17,152,17,HEM[k]) }
      g.fillStyle='rgba(120,124,120,0.3)'; g.fillRect(52,142,132,3)
      g.restore()
    },
    /* 排盘时 —— 布的右下角轻轻掀起一线又落回,像有客要来,终究没来。
       这是分界线的表演视觉:玩家点了排盘,与【人】有关的那件白布起了一下反应。
       只在 divining 时动;静止时与骨架逐像素一致(regress 用 t=0,而 divining 恒 false)。
       ⚠ fx 的 ctx 是 1440 系,不 scale(0.5)。 */
    fx(g, t, X, Y, o, room) {
      if (!(room && room.state && room.state.divining)) return
      // 3.2 秒一个来回:掀起 → 悬一息 → 落回
      const cy = 3200, k = (t % cy) / cy
      const lift = k < 0.5 ? (k / 0.5) : (1 - (k - 0.5) / 0.5)   // 0→1→0
      const h = (lift * 40) | 0
      if (h < 2) return
      g.save(); g.translate(X, Y)
      // 掀起座面布的右前沿一角,露出底下木座的暗影 —— 像有客要坐,又没坐
      g.fillStyle = '#eeeee6'
      g.beginPath()
      g.moveTo(130, 176); g.lineTo(182, 176 - h); g.lineTo(182, 196 - h); g.lineTo(130, 196)
      g.closePath(); g.fill()
      g.fillStyle = 'rgba(74,66,52,0.4)'; g.fillRect(140, 176, 42, 5)     // 露出的木座
      g.fillStyle = 'rgba(200,202,198,0.5)'; g.fillRect(130, 176 - h + 2, 52, 2)
      g.restore()
    }
  })

  def("bailu_dial_star", {
    clickable: true, say: '紫微在午。今年',
    sayDeep: ['盘不会错', '……错的是读盘的人', '所以我只念。念完就收'],
    name: "星盘", cat: "法器", tags: ["紫微斗数", "十二宫", "有状态件"],
    scope: "character", fromRoom: 'bailu',
    w: 168, h: 168, base: 168, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      const CX = 84, CY = 86
      // 接触阴影(椭圆,压在案上)
      g.fillStyle = 'rgba(40,38,30,0.22)'; pxE(CX, 158, 66, 12, 'rgba(40,38,30,0.22)')
      // ── 外圈铜边:深底 + 一圈受光 ──
      pxE(CX, 84, 80, 80, '#2c281f')
      pxE(CX, 84, 77, 77, '#6b5f42')                 // 铜环
      // 铜环顶部受光弧(左上来光)
      g.save(); g.beginPath(); g.arc(CX, 84, 77, Math.PI*1.05, Math.PI*1.75); g.arc(CX, 84, 70, Math.PI*1.75, Math.PI*1.05, true); g.closePath()
      g.fillStyle = '#9a8a5c'; g.fill(); g.restore()
      // ── 盘体:径向渐变给形(左上亮、右下暗)──
      const gd = g.createRadialGradient(CX-22, 84-22, 8, CX, 84, 70)
      gd.addColorStop(0, '#cfc9b8'); gd.addColorStop(0.6, '#b3ad9a'); gd.addColorStop(1, '#8f8a76')
      g.fillStyle = gd; pxE(CX, 84, 70, 70, gd)
      // 木盘细木纹(同心细线)
      g.strokeStyle = 'rgba(90,84,66,0.18)'; g.lineWidth = 1
      for (const r of [64, 58]) { g.beginPath(); g.arc(CX, 84, r, 0, Math.PI*2); g.stroke() }
      // ── 十二宫:凹格 + 阴影 + 淡金字 ──
      for (let k = 0; k < 12; k++) {
        const a2 = k * Math.PI / 6 - Math.PI/2
        const x = CX + Math.cos(a2)*61, y = 84 + Math.sin(a2)*61
        g.fillStyle = 'rgba(54,48,36,0.55)'; g.fillRect(x-4|0, y-4|0, 9, 9)     // 凹格阴影
        g.fillStyle = '#d8d2c0'; g.fillRect(x-3|0, y-3|0, 6, 6)                 // 格底
        g.fillStyle = '#7a6f4e'; g.fillRect(x-2|0, y-2|0, 4, 4)                 // 宫名(淡)
        // 分格线
        const bx = CX + Math.cos(a2+Math.PI/12)*68, by = 84 + Math.sin(a2+Math.PI/12)*68
        g.strokeStyle = 'rgba(70,62,46,0.35)'; g.beginPath(); g.moveTo(CX+Math.cos(a2+Math.PI/12)*52, 84+Math.sin(a2+Math.PI/12)*52); g.lineTo(bx, by); g.stroke()
      }
      // ── 中环:淡盘 + 二十八宿细刻 ──
      pxE(CX, 84, 50, 50, '#342f24')
      const gd2 = g.createRadialGradient(CX-14, 84-14, 4, CX, 84, 46)
      gd2.addColorStop(0, '#e2dccc'); gd2.addColorStop(1, '#c2bca8')
      pxE(CX, 84, 46, 46, gd2)
      g.fillStyle = 'rgba(74,68,52,0.6)'
      for (let k = 0; k < 28; k++) { const a2 = k*Math.PI/14; g.fillRect(CX+Math.cos(a2)*40-1|0, 84+Math.sin(a2)*40-1|0, 2, 3) }
      // ── 内盘 ──
      pxE(CX, 84, 26, 26, '#342f24')
      const gd3 = g.createRadialGradient(CX-8, 84-8, 2, CX, 84, 24)
      gd3.addColorStop(0, '#eee8d8'); gd3.addColorStop(1, '#d0cab8')
      pxE(CX, 84, 24, 24, gd3)
      // ── 指针:铜针指午,带高光,在盘上投影 ──
      g.fillStyle = 'rgba(50,44,32,0.28)'; g.fillRect(84, 42, 6, 46)            // 投影
      g.fillStyle = '#4a4032'; g.fillRect(81, 40, 5, 46)
      g.fillStyle = '#a2946e'; g.fillRect(81, 40, 2, 46)                        // 针受光棱
      g.fillStyle = '#c8bc90'; g.fillRect(80, 40, 7, 5)                         // 针尖
      // ── 中心轴珠 ──
      pxE(CX, 84, 9, 9, '#2c281f')
      pxE(CX, 84, 6, 6, '#8a7f5c')
      pxE(CX-2, 82, 3, 3, '#d8cca0')                                            // 珠高光
      g.restore()
    }
  })

  def("bailu_dial_shi", {
    clickable: true, say: '式盘。唐制，仿的',
    name: "式盘", cat: "法器", tags: ["天圆地方", "唐制", "仿"],
    scope: "character", fromRoom: 'bailu',
    w: 132, h: 132, base: 132, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(40,38,30,0.2)'; g.fillRect(8, 120, 118, 8)
      // ── 地盘(方):漆木,四层界格,左上受光 ──
      g.fillStyle = '#2c281f'; g.fillRect(4, 8, 124, 118)
      const bgd = g.createLinearGradient(10, 14, 122, 122)
      bgd.addColorStop(0, '#8a8270'); bgd.addColorStop(1, '#63594860'.slice(0,7))
      g.fillStyle = '#7d7462'; g.fillRect(10, 14, 112, 108)
      g.fillStyle = '#8e8672'; g.fillRect(10, 14, 112, 6)               // 顶棱受光
      g.fillStyle = 'rgba(40,36,28,0.3)'; g.fillRect(10, 116, 112, 6)   // 底暗
      // 界格线(阴刻)
      g.fillStyle = 'rgba(52,46,34,0.5)'
      for (let k=1;k<4;k++){ g.fillRect(10+k*28, 14, 2, 108); g.fillRect(10, 14+k*27, 112, 2) }
      g.fillStyle = 'rgba(150,140,116,0.3)'
      for (let k=1;k<4;k++){ g.fillRect(10+k*28+2, 14, 1, 108); g.fillRect(10, 14+k*27+2, 112, 1) }  // 界格高光边
      // 四角淡干支字
      g.fillStyle = '#544a34'; for (const [x,y] of [[18,22],[100,22],[18,106],[100,106]]) g.fillRect(x,y,6,6)
      // ── 天盘(圆):铜,径向渐变 + 边光 ──
      pxE(66, 68, 40, 40, '#2c281f')
      const tgd = g.createRadialGradient(66-12, 68-12, 4, 66, 68, 37)
      tgd.addColorStop(0, '#c6bfae'); tgd.addColorStop(0.6, '#a8a08c'); tgd.addColorStop(1, '#847a64')
      pxE(66, 68, 37, 37, tgd)
      g.save(); g.beginPath(); g.arc(66,68,37,Math.PI*1.1,Math.PI*1.7); g.arc(66,68,32,Math.PI*1.7,Math.PI*1.1,true); g.closePath()
      g.fillStyle='#c8c0a8'; g.fill(); g.restore()
      // 北斗七星(天盘上)
      g.fillStyle = '#3a3428'
      for (const [dx,dy] of [[-18,-8],[-10,-14],[-2,-16],[6,-12],[10,-4],[14,4],[8,12]]) g.fillRect(66+dx|0,68+dy|0,3,3)
      g.strokeStyle='rgba(58,52,40,0.4)'; g.lineWidth=1; g.beginPath(); g.moveTo(48,60); g.lineTo(56,54); g.lineTo(64,52); g.lineTo(72,56); g.lineTo(76,64); g.lineTo(80,72); g.lineTo(74,80); g.stroke()
      pxE(66, 68, 9, 9, '#2c281f')
      pxE(66, 68, 6, 6, '#8a7f5c')
      pxE(64, 66, 3, 3, '#d0c498')
      g.restore()
    }
  })

  def("bailu_paper_charts", {
    clickable: true, say: '四十张。够一个月',
    name: "空白命盘纸", cat: "书卷", tags: ["十二宫格", "四十张", "裁得一样齐"],
    scope: "character", fromRoom: 'bailu',
    w: 100, h: 132, base: 132, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 一摞纸:侧面分层 + 顶纸
      g.fillStyle = '#b8b6ac'; g.fillRect(4, 106, 92, 22)
      for (let k = 0; k < 6; k++) { g.fillStyle = k%2?'#eae8de':'#f2f0e6'; g.fillRect(4, 100-k*5, 92, 6) }
      g.fillStyle = '#f6f4ea'; g.fillRect(4, 6, 92, 96)
      g.fillStyle = '#e4e2d8'; g.fillRect(4, 6, 92, 5)             // 顶纸受光
      g.fillStyle = 'rgba(180,176,164,0.4)'; g.fillRect(4, 100, 92, 2)
      // 十二宫格线(阴影 + 线)
      g.fillStyle = 'rgba(120,116,104,0.2)'; g.fillRect(13, 17, 78, 78)
      g.fillStyle = '#8e8a7c'
      for (let k=0;k<=4;k++) g.fillRect(12+k*19, 16, 2, 78)
      for (let k=0;k<=4;k++) g.fillRect(12, 16+k*19, 78, 2)
      g.fillStyle = 'rgba(120,116,104,0.28)'; g.fillRect(31, 35, 40, 40)   // 中宫
      g.fillStyle = '#a03a30'; g.fillRect(48, 12, 3, 3)           // 一点朱
      g.restore()
    }
  })

  def("bailu_tools_align", {
    clickable: true, say: '左尺右笔。不换',
    sayDeep: ['换了要多找两息', '……一天排六盘,就是十二息', '一年下来是一个时辰'],
    name: "笔尺镇纸", cat: "器物", tags: ["对齐", "位置不换", "省下的都是息"],
    scope: "character", fromRoom: 'bailu',
    w: 152, h: 44, base: 44, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 三样并排,间距一样,端头对齐 —— 这一件的重点是【齐】
      g.fillStyle = '#4a4438'; g.fillRect(4, 10, 44, 12)          // 尺
      g.fillStyle = '#6e6656'; g.fillRect(4, 10, 44, 5)
      g.fillStyle = '#8a8272'
      for (let k = 1; k < 5; k++) g.fillRect(4 + k * 9, 15, 2, 5)
      g.fillStyle = '#2f2a22'; g.fillRect(56, 12, 40, 8)          // 笔
      g.fillStyle = '#4e463a'; g.fillRect(56, 12, 40, 3)
      g.fillStyle = '#8a7f68'; g.fillRect(88, 12, 10, 8)
      g.fillStyle = '#5a5f66'; g.fillRect(104, 8, 42, 16)         // 镇纸
      g.fillStyle = '#727881'; g.fillRect(104, 8, 42, 5)
      g.fillStyle = '#454a50'; g.fillRect(104, 20, 42, 4)
      g.fillStyle = 'rgba(226,230,232,0.14)'; g.fillRect(4, 26, 142, 2)   // 对齐线
      g.restore()
    }
  })

  def("bailu_ruler_jade", {
    clickable: true, say: '量星度用的',
    name: "白玉尺", cat: "器物", tags: ["白玉", "量星度"],
    scope: "character", fromRoom: 'bailu',
    w: 132, h: 28, base: 28, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 白玉尺:玉,渐变 + 高光 + 刻度分级 + 一端玉色深
      const jgd = g.createLinearGradient(0, 8, 0, 22)
      jgd.addColorStop(0, '#e2e6de'); jgd.addColorStop(0.5, '#c8cec4'); jgd.addColorStop(1, '#a8b0a6')
      g.fillStyle = '#8e948c'; g.fillRect(2, 6, 128, 18)
      g.fillStyle = jgd; g.fillRect(2, 8, 128, 14)
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(2, 8, 128, 2)
      g.fillStyle = 'rgba(140,150,140,0.4)'; g.fillRect(2, 20, 128, 2)
      g.fillStyle = '#7e867c'
      for (let k=1;k<13;k++) g.fillRect(2+k*10, 8, 1, k%4===0?12:6)
      g.fillStyle = 'rgba(120,140,130,0.3)'; g.fillRect(112, 8, 18, 14)   // 一端玉色深(沁)
      g.restore()
    }
  })

  def("bailu_almanac", {
    clickable: true, say: '万年历。到二一〇〇年',
    sayDeep: ['后面的我推过', '……推到二三〇〇', '没写下来。写下来就有人要看'],
    name: "万年历", cat: "书卷", tags: ["推到二三〇〇", "没写下来"],
    scope: "character", fromRoom: 'bailu',
    w: 132, h: 168, base: 168, foot: [0, 120, 132, 48], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,44,38,0.2)'; g.fillRect(8, 156, 116, 8)
      // 函套:布面,四角包铜
      g.fillStyle = '#332c22'; g.fillRect(10, 6, 112, 152)
      const bgd = g.createLinearGradient(15, 0, 117, 0)
      bgd.addColorStop(0, '#7d7462'); bgd.addColorStop(1, '#5c5344')
      g.fillStyle = bgd; g.fillRect(15, 11, 102, 142)
      g.fillStyle = '#8a8170'; g.fillRect(15, 11, 102, 7)          // 顶受光
      g.fillStyle = '#8a7a58'                                       // 四角铜
      g.fillRect(15, 11, 14, 14); g.fillRect(103, 11, 14, 14); g.fillRect(15, 139, 14, 14); g.fillRect(103, 139, 14, 14)
      g.fillStyle = '#a08a5c'; g.fillRect(15, 11, 14, 4); g.fillRect(103, 11, 14, 4)
      // 书口:一叠册子侧面
      g.fillStyle = '#ded9c8'; g.fillRect(30, 24, 72, 118)
      g.fillStyle = '#c9c3ae'
      for (let k = 0; k < 10; k++) g.fillRect(30, 28 + k*12, 72, 3)
      g.fillStyle = 'rgba(160,150,124,0.4)'; g.fillRect(30, 24, 72, 2)
      // 签条:细字
      g.fillStyle = '#c8c4b6'; g.fillRect(36, 32, 30, 78)
      g.fillStyle = '#f2f0e6'; g.fillRect(37, 33, 28, 76)
      g.fillStyle = '#5a5648'
      for (let k = 0; k < 7; k++) g.fillRect(44, 40 + k*11, 14, 2)
      g.fillStyle = '#a03a30'; g.fillRect(44, 40, 14, 2)          // 顶行朱笔
      g.restore()
    }
  })

  def("bailu_rack_plants2", {
    clickable: true, say: '中层。今年四月十一入的，卯时',
    name: "多肉架 · 中层", cat: "收纳", tags: ["今年新入", "盆小而齐"],
    scope: "character", fromRoom: 'bailu',
    w: 296, h: 152, base: 152, foot: [0, 108, 296, 44], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.20)'; g.fillRect(10, 140, 276, 9)
      g.fillStyle = '#4a4336'; g.fillRect(0, 104, 296, 22)
      g.fillStyle = '#6e6558'; g.fillRect(0, 104, 296, 16)
      g.fillStyle = '#7e7568'; g.fillRect(0, 104, 296, 5)
      g.strokeStyle = 'rgba(52,48,40,0.2)'; g.lineWidth = 1
      for (let k=0;k<3;k++){ g.beginPath(); g.moveTo(4,110+k*4); g.lineTo(292,110+k*4); g.stroke() }
      g.fillStyle = '#3a352c'; g.fillRect(0, 120, 296, 6)
      g.fillStyle = '#4a4336'; g.fillRect(8, 124, 14, 26); g.fillRect(274, 124, 14, 26)
      g.fillStyle = '#5c5548'; g.fillRect(8, 124, 5, 26); g.fillRect(274, 124, 5, 26)
      const POTS = [[26,94,14],[61,94,14],[96,94,14],[131,94,14],[166,94,14],[201,94,14],[236,94,14],[271,94,14]], LEAF = [['#5f7857','#78916e','#9fb593'], ['#6d8763','#86a07c','#a8bc9d'], ['#5a7050','#728a66','#93aa86']]
      POTS.forEach(([cx, by, r], i) => {
        const h = r + 6
        const pgd = g.createLinearGradient(cx-r, 0, cx+r, 0)
        pgd.addColorStop(0, '#9c9080'); pgd.addColorStop(0.5, '#8a7f6d'); pgd.addColorStop(1, '#6f6555')
        g.fillStyle = pgd; g.fillRect(cx-r, by-h, r*2, h)
        g.fillStyle = '#a89c8a'; g.fillRect(cx-r, by-h, r*2, 4)
        g.fillStyle = '#5e5445'; g.fillRect(cx-r, by-4, r*2, 4)
        g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(cx-r+3, by-h+5, 3, h-9)
        pxE(cx, by-h+2, r-2, 5, '#463f30')
        g.fillStyle = '#5a5240'; for(let q=0;q<4;q++) g.fillRect(cx-r+5+q*(r*2-10)/4|0, by-h, 2, 2)
        const c = LEAF[i%3]
        pxE(cx, by-h-2, r+1, 8, c[0]); pxE(cx, by-h-4, r-3, 6, c[1]); pxE(cx-1, by-h-6, r-7, 4, c[2]); pxE(cx-r*0.3|0, by-h-5, 2, 2, 'rgba(210,224,200,0.5)')
        const tx = cx + r - 7
        g.fillStyle = '#cbc8bd'; g.fillRect(tx, by-h-20, 13, 20)
        g.fillStyle = '#ece9dd'; g.fillRect(tx+1, by-h-19, 11, 16)
        g.fillStyle = '#eef4e0'; g.fillRect(tx+1, by-h-19, 11, 4)
        g.fillStyle = '#5a5648'; g.fillRect(tx+3, by-h-15, 7, 1); g.fillRect(tx+3, by-h-12, 5, 1); g.fillRect(tx+3, by-h-9, 6, 1)
        g.fillStyle = '#9a9078'; g.fillRect(tx+4, by-h-4, 3, 5)
      })
      g.restore()
    }
  })

  def("bailu_rack_plants3", {
    clickable: true, say: '下层这几盆，五年了',
    sayDeep: ['养久了不用天天看', '……看一眼就知道缺不缺水', '人也是。可惜人不肯让我看那么久'],
    name: "多肉架 · 下层", cat: "收纳", tags: ["五年", "长得开", "看一眼就知道"],
    scope: "character", fromRoom: 'bailu',
    w: 296, h: 152, base: 152, foot: [0, 108, 296, 44], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.20)'; g.fillRect(10, 140, 276, 9)
      g.fillStyle = '#4a4336'; g.fillRect(0, 104, 296, 22)
      g.fillStyle = '#6e6558'; g.fillRect(0, 104, 296, 16)
      g.fillStyle = '#7e7568'; g.fillRect(0, 104, 296, 5)
      g.strokeStyle = 'rgba(52,48,40,0.2)'; g.lineWidth = 1
      for (let k=0;k<3;k++){ g.beginPath(); g.moveTo(4,110+k*4); g.lineTo(292,110+k*4); g.stroke() }
      g.fillStyle = '#3a352c'; g.fillRect(0, 120, 296, 6)
      g.fillStyle = '#4a4336'; g.fillRect(8, 124, 14, 26); g.fillRect(274, 124, 14, 26)
      g.fillStyle = '#5c5548'; g.fillRect(8, 124, 5, 26); g.fillRect(274, 124, 5, 26)
      const POTS = [[52,96,28],[118,98,24],[186,96,28],[250,94,22]], LEAF = [['#5f7857','#78916e','#9fb593'], ['#6d8763','#86a07c','#a8bc9d'], ['#5a7050','#728a66','#93aa86']]
      POTS.forEach(([cx, by, r], i) => {
        const h = r + 10
        const pgd = g.createLinearGradient(cx-r, 0, cx+r, 0)
        pgd.addColorStop(0, '#9c9080'); pgd.addColorStop(0.5, '#8a7f6d'); pgd.addColorStop(1, '#6f6555')
        g.fillStyle = pgd; g.fillRect(cx-r, by-h, r*2, h)
        g.fillStyle = '#a89c8a'; g.fillRect(cx-r, by-h, r*2, 4)
        g.fillStyle = '#5e5445'; g.fillRect(cx-r, by-4, r*2, 4)
        g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(cx-r+3, by-h+5, 3, h-9)
        pxE(cx, by-h+2, r-2, 5, '#463f30')
        g.fillStyle = '#5a5240'; for(let q=0;q<4;q++) g.fillRect(cx-r+5+q*(r*2-10)/4|0, by-h, 2, 2)
        const c = LEAF[i%3]
        pxE(cx, by-h-4, r+6, 14, c[0]); pxE(cx, by-h-9, r, 11, c[1]); pxE(cx-2, by-h-13, r-8, 8, c[2]); pxE(cx-r*0.3|0, by-h-11, 3, 3, 'rgba(210,224,200,0.55)'); pxE(cx+r*0.35|0, by-h-6, 3, 3, 'rgba(180,200,170,0.4)')
        const tx = cx + r - 7
        g.fillStyle = '#cbc8bd'; g.fillRect(tx, by-h-20, 13, 20)
        g.fillStyle = '#ece9dd'; g.fillRect(tx+1, by-h-19, 11, 16)
        g.fillStyle = '#eef4e0'; g.fillRect(tx+1, by-h-19, 11, 4)
        g.fillStyle = '#5a5648'; g.fillRect(tx+3, by-h-15, 7, 1); g.fillRect(tx+3, by-h-12, 5, 1); g.fillRect(tx+3, by-h-9, 6, 1)
        g.fillStyle = '#9a9078'; g.fillRect(tx+4, by-h-4, 3, 5)
      })
      g.restore()
    }
  })

  def("bailu_tags_row", {
    clickable: true, say: '编号。到四十二',
    name: "命盘小牌", cat: "书卷", tags: ["每盆一块", "入盆时辰", "流年宜忌"],
    scope: "character", fromRoom: 'bailu',
    w: 296, h: 40, base: 40, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 一排命盘小牌:高低错,牌面受光 + 细字 + 插土截
      for (let i = 0; i < 9; i++) {
        const x = 12 + i*32, dy = (i%3)*3
        g.fillStyle = '#bcb9ad'; g.fillRect(x, 6+dy, 20, 30)
        g.fillStyle = '#eceade'; g.fillRect(x+1, 7+dy, 18, 26)
        g.fillStyle = '#f4f2e6'; g.fillRect(x+1, 7+dy, 18, 4)      // 牌顶受光
        g.fillStyle = '#5a5648'
        g.fillRect(x+4, 12+dy, 12, 1); g.fillRect(x+4, 16+dy, 9, 1); g.fillRect(x+4, 20+dy, 11, 1); g.fillRect(x+4, 24+dy, 7, 1)
        g.fillStyle = '#a03a30'; g.fillRect(x+4, 12+dy, 12, 1)     // 顶行朱
        g.fillStyle = '#9a9078'; g.fillRect(x+7, 33+dy, 6, 5)
      }
      g.restore()
    }
  })

  def("bailu_log_water", {
    clickable: true, say: '卯时三刻，十二毫升',
    sayDeep: ['记了六年', '……多一毫升少一毫升，它自己知道', '我只是替它记着'],
    name: "浇水记录册", cat: "书卷", tags: ["精确到分", "六年", "十二毫升"],
    scope: "character", fromRoom: 'bailu',
    w: 148, h: 104, base: 104, foot: [0, 20, 148, 84], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,44,38,0.18)'; g.fillRect(8, 94, 132, 7)
      g.fillStyle = '#6b6252'; g.fillRect(6, 14, 136, 82)          // 摊开的册子
      g.fillStyle = '#f2f0e6'; g.fillRect(10, 18, 128, 74)
      g.fillStyle = '#dedbcd'; g.fillRect(72, 18, 4, 74)           // 中缝
      g.fillStyle = '#8e8a7c'                                       // 表格线
      for (let k = 0; k < 7; k++) { g.fillRect(14, 24 + k * 10, 54, 1); g.fillRect(80, 24 + k * 10, 54, 1) }
      g.fillStyle = '#4a4638'                                       // 字:极小极密
      for (let k = 0; k < 6; k++) {
        g.fillRect(16, 26 + k * 10, 14, 3); g.fillRect(34, 26 + k * 10, 9, 3); g.fillRect(48, 26 + k * 10, 16, 3)
        g.fillRect(82, 26 + k * 10, 14, 3); g.fillRect(100, 26 + k * 10, 9, 3); g.fillRect(114, 26 + k * 10, 16, 3)
      }
      g.fillStyle = '#a03a30'; g.fillRect(48, 66, 16, 3)           // 红笔标的那一行
      g.restore()
    }
  })

  def("bailu_tweezers", {
    clickable: true, say: '镊子是拔枯叶的',
    name: "铜镊子与喷壶", cat: "器物", tags: ["铜", "拔枯叶", "喷雾"],
    scope: "character", fromRoom: 'bailu',
    w: 120, h: 88, base: 88, foot: [0, 20, 120, 68], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.18)'; g.fillRect(8, 78, 104, 7)
      // 喷壶:小,铜,擦得亮
      pxE(76, 58, 26, 20, '#6b5a38')
      pxE(76, 54, 22, 16, '#9c8552')
      pxE(76, 50, 14, 9, '#b8a068')
      g.fillStyle = '#6b5a38'; g.fillRect(96, 40, 18, 6); g.fillRect(108, 34, 6, 12)
      g.fillStyle = '#8a7444'; g.fillRect(60, 34, 8, 16)
      // 镊子:两条铜片,并着放
      g.fillStyle = '#8a7444'; g.fillRect(8, 46, 42, 5); g.fillRect(8, 54, 42, 5)
      g.fillStyle = '#b8a068'; g.fillRect(8, 46, 42, 2); g.fillRect(8, 54, 42, 2)
      g.fillStyle = '#6b5a38'; g.fillRect(44, 46, 8, 13)
      g.restore()
    }
  })

  def("bailu_jars_soil", {
    clickable: true, say: '土三成，石七成',
    name: "土与石子分装罐", cat: "器物", tags: ["分装", "三七开", "配比不变"],
    scope: "character", fromRoom: 'bailu',
    w: 180, h: 108, base: 108, foot: [0, 24, 180, 84], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.18)'; g.fillRect(10, 96, 160, 8)
      const JAR = [[40, 96, 30], [96, 96, 26], [146, 96, 22]]
      const FILL = ['#5a4a36', '#8e948f', '#7d7466']
      JAR.forEach(([cx, by, r], i) => {
        g.fillStyle = '#3e3a30'; g.fillRect(cx - r, by - 62, r * 2, 62)
        g.fillStyle = '#cdd2cd'; g.fillRect(cx - r + 3, by - 59, r * 2 - 6, 56)   // 玻璃
        g.fillStyle = FILL[i]; g.fillRect(cx - r + 3, by - 30 + i * 6, r * 2 - 6, 27 - i * 6)
        g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(cx - r + 6, by - 56, 5, 48)
        pxE(cx, by - 62, r, 6, '#5e5647')                                        // 木塞
        g.fillStyle = '#e8e6dc'; g.fillRect(cx - 10, by - 44, 20, 12)            // 标签
        g.fillStyle = '#5a5648'; g.fillRect(cx - 7, by - 40, 14, 2); g.fillRect(cx - 7, by - 36, 10, 2)
      })
      g.restore()
    }
  })

  def("bailu_book_years", {
    clickable: true, say: '我自己编的。只这一本',
    sayDeep: ['盆植的流年,书上没有', '……我推了三年才推明白', '也没打算给别人看'],
    name: "《盆植流年》", cat: "书卷", tags: ["手抄", "只一本", "推了三年"],
    scope: "character", fromRoom: 'bailu',
    w: 104, h: 96, base: 96, foot: [0, 22, 104, 74], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,44,38,0.18)'; g.fillRect(8, 86, 88, 7)
      // 素青封皮:渐变 + 订线 + 签
      const bgd = g.createLinearGradient(0, 20, 0, 88)
      bgd.addColorStop(0, '#5d6a5b'); bgd.addColorStop(1, '#3a443a')
      g.fillStyle = '#2f382f'; g.fillRect(6, 20, 92, 68)
      g.fillStyle = bgd; g.fillRect(10, 22, 84, 64)
      g.fillStyle = '#68765f'; g.fillRect(10, 22, 84, 6)
      g.fillStyle = '#2f382f'; for (let k = 0; k < 4; k++) g.fillRect(15, 28+k*14, 3, 9)   // 订线
      g.fillStyle = 'rgba(120,134,116,0.3)'; for (let k=0;k<4;k++) g.fillRect(16, 28+k*14, 1, 9)
      g.fillStyle = '#eceade'; g.fillRect(30, 32, 40, 44)         // 签
      g.fillStyle = '#f4f2e6'; g.fillRect(30, 32, 40, 5)
      g.fillStyle = '#4a4638'; for (let k = 0; k < 4; k++) g.fillRect(42, 40+k*10, 16, 2)
      g.restore()
    }
  })

  def("bailu_pot_dead", {
    clickable: true, say: '四十二号',
    sayDeep: ['去年冬天没的', '……我算过它那年不利。没移', '牌子我没拔。拔了就对不上账'],
    name: "枯死的那盆", cat: "陈设", tags: ["★ 核心钩子", "算准了没做", "牌子还插着"],
    scope: "character", fromRoom: 'bailu',
    w: 104, h: 128, base: 128, foot: [0, 40, 104, 88], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.20)'; g.fillRect(10, 116, 84, 8)
      g.fillStyle = '#8a7f6d'; g.fillRect(16, 76, 72, 44)          // 盆:和别的一样干净
      g.fillStyle = '#9c9080'; g.fillRect(16, 76, 72, 10)
      g.fillStyle = '#6f6555'; g.fillRect(16, 114, 72, 6)
      pxE(52, 76, 34, 8, '#4e4a3c')                                // 土:干了,发白
      pxE(52, 74, 28, 5, '#6b6659')
      // 残株:干缩、褐、倒伏。叶片还在,但全部塌下去了
      g.fillStyle = '#6b5a44'; g.fillRect(44, 58, 8, 18)
      g.fillStyle = '#7d6a50'
      g.fillRect(30, 62, 18, 5); g.fillRect(54, 60, 16, 5); g.fillRect(36, 54, 14, 4); g.fillRect(56, 52, 12, 4)
      g.fillStyle = '#5c4c38'; g.fillRect(30, 66, 18, 3); g.fillRect(54, 64, 16, 3)
      // 牌子 —— 和活着的那些一模一样,还插着
      g.fillStyle = '#cfcdc2'; g.fillRect(70, 34, 22, 34)
      g.fillStyle = '#eceade'; g.fillRect(71, 35, 20, 30)
      g.fillStyle = '#5a5648'
      g.fillRect(75, 40, 12, 2); g.fillRect(75, 45, 9, 2); g.fillRect(75, 50, 11, 2); g.fillRect(75, 55, 7, 2)
      g.restore()
    }
  })

  def("bailu_pots_spare", {
    clickable: true, say: '空盆。备着',
    name: "备用素盆一摞", cat: "器物", tags: ["素陶", "摞着", "备着"],
    scope: "character", fromRoom: 'bailu',
    w: 116, h: 112, base: 112, foot: [0, 26, 116, 86], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.18)'; g.fillRect(10, 100, 96, 8)
      for (let k = 0; k < 4; k++) {
        const y = 96 - k * 20, r = 40 - k * 2
        g.fillStyle = '#8a7f6d'; g.fillRect(58 - r, y - 24, r * 2, 24)
        g.fillStyle = '#9c9080'; g.fillRect(58 - r, y - 24, r * 2, 7)
        g.fillStyle = '#6f6555'; g.fillRect(58 - r, y - 4, r * 2, 4)
      }
      pxE(58, 24, 34, 8, '#4e4a3c')                                 // 最上那只朝上,空的
      pxE(58, 26, 28, 5, '#8a7f6d')
      g.restore()
    }
  })

  /* ══ 白布区 —— 分界线主体 ══
     与【人】有关的一律蒙白布。共用一套画法:布的暗面 + 受光面 + 参差下摆 + 折痕,
     底下透出被盖物的轮廓。轮廓不同(镜子扁、琴长、书箱方),但"盖着"这件事重复出现,
     从上到下连成右墙一条白 —— 这才让分界线成为语言(沈砚层积的同一条教训)。
     helper 抽出来:draw 里只描各自的轮廓,布的通用部分调 cloth()。 */
  /* 盖布通用画法。要点(白鹭房交付时用户看不出是什么才补强的):
     真机 402px 下,平铺的白方块 + 0.22 透明度的轮廓会全糊成一片白 ——
     读不出「底下是件家具」。所以:① 布有体积(顶随物隆起、两侧落布加深褶),
     ② 顶肩收窄一格,不是平齐的横边(盖住的东西有顶),
     ③ 轮廓透出的对比统一在 0.40+,缩小后仍看得见。 */
  function _cloth(g, w, h, opt) {
    opt = opt || {}
    const hemN = opt.hemN || (w / 24 | 0), hemBase = opt.hemBase || h - 44
    const topPad = opt.topPad != null ? opt.topPad : 8   // 顶肩收窄:盖住的东西不是齐平方块
    // 暗面 —— 整体轮廓,顶肩内收
    g.fillStyle = '#bcbcb4'; g.fillRect(4 + topPad, 2, w - 8 - topPad * 2, 10)
    g.fillStyle = '#c4c4bc'; g.fillRect(4, 12, w - 8, h - 20)
    // 受光面
    g.fillStyle = '#e6e6de'; g.fillRect(8 + topPad, 6, w - 16 - topPad * 2, 8)
    g.fillStyle = '#e2e2da'; g.fillRect(8, 14, w - 16, h - 26)
    g.fillStyle = '#f2f2ea'; g.fillRect(12, 16, (w - 24) * 0.52 | 0, (h - 28) * 0.44 | 0)  // 高光
    // 两侧落布的深褶 —— 布搭过物体棱角垂下来,这两道竖影让它有体积
    g.fillStyle = 'rgba(120,122,118,0.34)'
    g.fillRect(10 + topPad, 14, 4, h - 30); g.fillRect(w - 14 - topPad, 14, 4, h - 30)
    // 顶肩到侧身的斜折
    g.fillStyle = 'rgba(140,142,138,0.28)'
    g.fillRect(6, 12, topPad + 6, 5); g.fillRect(w - 12 - topPad, 12, topPad + 6, 5)
    // 参差下摆
    const HEM = [16, 22, 14, 26, 18, 24, 12, 20, 15, 23, 13, 21]
    const hw = ((w - 8) / hemN) | 0
    for (let k = 0; k < hemN; k++) {
      g.fillStyle = k % 2 ? '#d6d6d0' : '#e0e0d8'
      g.fillRect(4 + k * hw, hemBase, hw, (h - hemBase) + HEM[k % HEM.length] - 4)
      g.fillStyle = 'rgba(120,122,118,0.20)'; g.fillRect(4 + k * hw, hemBase, 2, (h - hemBase) + HEM[k % HEM.length] - 4)
    }
    // 横向折痕
    g.fillStyle = 'rgba(130,132,128,0.30)'
    g.fillRect(12, h * 0.34 | 0, w - 24, 3); g.fillRect(16, h * 0.64 | 0, w - 32, 3)
    g.fillStyle = 'rgba(46,48,46,0.18)'; g.fillRect(8, h - 14, w - 16, 8)   // 触地阴影
  }

  def("bailu_qin_covered", {
    clickable: true, say: '琴。带下来的',
    sayDeep: ['终南山上会弹', '……下山就没解开过', '弦大概断了。我没看'],
    name: "蒙白布的琴", cat: "陈设", tags: ["蒙白布", "终南山带下来", "没解开过"],
    scope: "character", fromRoom: 'bailu',
    w: 104, h: 260, base: 260, foot: [30, 232, 44, 28], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle='rgba(46,48,46,0.20)'; g.fillRect(14,244,76,10)
      /* 古琴立靠着,布只搭在【中段】—— 琴头(上,有轸)、琴弦、琴尾全露出,一眼是琴。 */
      const D1='#5c4a38', D2='#6e5a44', D3='#4a3a2c'
      g.fillStyle=D3; g.fillRect(38,16,30,232)                       // 琴身(立)
      g.fillStyle=D1; g.fillRect(41,18,24,228)
      g.fillStyle=D2; g.fillRect(41,18,24,10)                        // 琴头亮
      // 琴轸(头部四个小钮)
      g.fillStyle='#3a2c20'; for(let k=0;k<4;k++) g.fillRect(44+k*5,10,3,8)
      // 七弦(细竖线)
      g.fillStyle='rgba(230,224,208,0.5)'; for(let k=0;k<7;k++) g.fillRect(43+k*3,26,1,220)
      // 徽点
      g.fillStyle='#c9bd94'; for(let k=0;k<5;k++) g.fillRect(51,50+k*40,4,4)
      // ── 白布:搭在琴中段,横过来一块,垂两边 ──
      g.fillStyle='#c9c9c2'; g.fillRect(28,110,52,20)
      g.fillStyle='#e6e6de'; g.fillRect(30,106,48,22)
      g.fillStyle='#f2f2ea'; g.fillRect(34,108,24,8)
      g.fillStyle='#dcdcd4'; g.fillRect(28,128,16,40); g.fillRect(64,128,16,44)  // 两边垂
      g.fillStyle='#e4e4dc'; g.fillRect(30,128,12,36); g.fillRect(66,128,12,40)
      g.fillStyle='rgba(120,124,120,0.3)'; g.fillRect(30,118,48,3)
      g.restore()
    }
  })

  def("bailu_portrait_covered", {
    clickable: true, say: '师父',
    sayDeep: ['她说我念得准', '……可念的时候眼里没有人', '这话我认。所以盖着'],
    name: "蒙白布的画像", cat: "墙面", tags: ["蒙白布", "师父", "她认那句话"],
    scope: "character", fromRoom: 'bailu',
    w: 120, h: 180, base: 180, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      /* 一幅装框的画,布只搭在【右上角】斜垂 —— 画框、画面露大半,一眼是画像。
         画面朝里蒙着,她不看师父那句话里的自己。 */
      const F1='#4a4438', F2='#5e564a', F3='#3a352c'
      g.fillStyle=F3; g.fillRect(20,24,80,148)                       // 外框
      g.fillStyle=F2; g.fillRect(20,24,80,6)
      g.fillStyle='#2a2c30'; g.fillRect(28,32,64,132)                // 画心(暗,看不清)
      g.fillStyle='#37393e'; g.fillRect(28,32,64,44)
      // 隐约一个人影(极淡)
      g.fillStyle='rgba(120,124,130,0.22)'; g.fillRect(46,60,28,50); g.fillRect(52,48,16,16)
      // ── 白布:斜搭右上角,垂下一三角 ──
      g.fillStyle='#e6e6de'
      g.beginPath(); g.moveTo(58,18); g.lineTo(108,18); g.lineTo(108,96); g.lineTo(58,40); g.closePath(); g.fill()
      g.fillStyle='#f2f2ea'
      g.beginPath(); g.moveTo(62,20); g.lineTo(100,20); g.lineTo(100,60); g.closePath(); g.fill()
      g.fillStyle='#dcdcd4'; g.fillRect(90,90,18,26); g.fillRect(78,96,14,20)  // 垂角参差
      g.fillStyle='rgba(120,124,120,0.28)'; g.fillRect(64,26,40,3)
      g.restore()
    }
  })

  def("bailu_chest_covered", {
    clickable: true, say: '经书。师父给的',
    name: "蒙白布的书箱", cat: "收纳", tags: ["蒙白布", "师父给的经书"],
    scope: "character", fromRoom: 'bailu',
    w: 148, h: 164, base: 164, foot: [0, 24, 148, 88], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle='rgba(46,48,46,0.20)'; g.fillRect(12,150,124,10)
      /* 木书箱,布只搭在【箱盖】—— 箱体、铜面叶、箱脚全露,一眼是箱子。 */
      const W1='#5c5344',W2='#6e6252',W3='#4a4234'
      g.fillStyle=W3; g.fillRect(14,50,120,98)
      g.fillStyle=W2; g.fillRect(18,54,112,90)
      g.fillStyle=W1; g.fillRect(18,54,112,10)
      g.fillStyle=W3; g.fillRect(18,96,112,4)                        // 箱盖缝
      g.fillStyle='#8a7a58'; g.fillRect(60,88,28,20)                 // 铜面叶
      g.fillStyle='#a08a5c'; g.fillRect(60,88,28,5)
      g.fillStyle=W3; g.fillRect(20,144,16,12); g.fillRect(112,144,16,12)  // 脚
      // 布搭箱盖,垂前一段
      g.fillStyle='#c9c9c2'; g.fillRect(16,44,116,20)
      g.fillStyle='#e6e6de'; g.fillRect(20,40,108,22)
      g.fillStyle='#f2f2ea'; g.fillRect(26,42,54,8)
      const HEM=[20,28,18,30,22,26,16]
      for(let k=0;k<HEM.length;k++){ g.fillStyle=k%2?'#dcdcd4':'#e4e4dc'; g.fillRect(20+k*16,62,16,HEM[k]) }
      g.restore()
    }
  })

  def("bailu_tea_covered", {
    clickable: true, say: '来客用的。收着',
    sayDeep: ['一套六只', '……上回用是三年前', '洗过了才盖上。不然落灰'],
    name: "白布茶具", cat: "器物", tags: ["蒙白布", "来客用", "三年没动"],
    scope: "character", fromRoom: 'bailu',
    w: 188, h: 128, base: 128, foot: [0, 20, 188, 88], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle='rgba(46,48,46,0.18)'; g.fillRect(12,116,164,8)
      /* 一盘茶具:一壶几杯搁在木托盘上,布只搭在【壶】上 —— 杯子、托盘全露。 */
      const W1='#5c5344',W2='#6e6252'
      g.fillStyle=W1; g.fillRect(10,96,168,22)                       // 木托盘
      g.fillStyle=W2; g.fillRect(10,96,168,7)
      // 三只杯(露着)
      const pxE=(...a)=>PRIM.pxE(g,...a)
      pxE(112,90,16,10,'#a8a49a'); pxE(112,86,12,7,'#cfccc2')
      pxE(140,90,16,10,'#a8a49a'); pxE(140,86,12,7,'#cfccc2')
      pxE(166,90,14,9,'#a8a49a')
      // 壶(蒙布)
      g.fillStyle='#c9c9c2'; g.fillRect(24,44,58,50)
      g.fillStyle='#e6e6de'; g.fillRect(28,40,52,52)
      g.fillStyle='#f2f2ea'; g.fillRect(32,42,26,18)
      g.fillStyle='#dcdcd4'; g.fillRect(30,86,48,14)                 // 布垂到盘
      g.fillStyle='rgba(120,124,120,0.28)'; g.fillRect(30,62,50,3)
      g.restore()
    }
  })

  def("bailu_letter_unopened", {
    clickable: true, say: '信',
    sayDeep: ['终南山寄来的', '……师妹的字', '拆了就要回。回什么呢'],
    name: "没拆的信", cat: "书卷", tags: ["蒙白布", "师妹寄来", "没拆"],
    scope: "character", fromRoom: 'bailu',
    w: 124, h: 84, base: 84, foot: [0, 16, 124, 68], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle='rgba(46,48,46,0.16)'; g.fillRect(10,74,104,6)
      /* 一封没拆的信,搁着 —— 露着(信封本就是纸,不必蒙)。压着一角白布提示归这一侧。 */
      g.fillStyle='#e2ddcd'; g.fillRect(16,30,92,44)                 // 信封
      g.fillStyle='#eee9d8'; g.fillRect(16,30,92,8)
      g.fillStyle='#d2ccb8'; g.fillRect(16,66,92,8)
      g.fillStyle='#cfc8b2'                                          // 封口三角
      g.beginPath(); g.moveTo(16,30); g.lineTo(62,54); g.lineTo(108,30); g.closePath(); g.fill()
      g.fillStyle='#b84a3c'; g.fillRect(56,44,12,10)                 // 火漆印
      g.fillStyle='#3d332a'; g.fillRect(28,40,28,3); g.fillRect(28,46,20,3)  // 收件字
      // 压角的一小块白布
      g.fillStyle='#e6e6de'; g.fillRect(92,26,22,18); g.fillStyle='#dcdcd4'; g.fillRect(96,40,14,12)
      g.restore()
    }
  })

  def("bailu_photo_covered", {
    clickable: true, say: '合影',
    sayDeep: ['下山那年照的', '……一共九个人', '现在剩几个，我算得出。不算'],
    name: "蒙着的合影", cat: "墙面", tags: ["蒙白布", "下山那年", "九个人"],
    scope: "character", fromRoom: 'bailu',
    w: 152, h: 172, base: 172, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      /* 一张合影,面朝下扣在案上(不是蒙布)—— 露出相框的背板、支架、一角相纸。
         她不看下山那年的九个人:干脆扣过来。 */
      const F='#4a4438',F2='#5e564a',B='#8a8578'
      g.fillStyle='rgba(46,48,46,0.18)'; g.fillRect(20,120,116,8)
      // 相框背板(扣着,所以看到的是背面)
      g.fillStyle=F; g.fillRect(24,40,104,84)
      g.fillStyle=F2; g.fillRect(24,40,104,7)
      g.fillStyle=B; g.fillRect(34,50,84,64)                         // 背板牛皮纸
      g.fillStyle='#7a756a'; g.fillRect(34,50,84,4)
      // 支架(翻出来的)
      g.fillStyle=F; g.fillRect(70,44,12,40)
      g.fillStyle=F2; g.fillRect(70,44,4,40)
      // 压着的一角相纸露白边
      g.fillStyle='#e8e4d6'; g.fillRect(26,110,40,10)
      g.fillStyle='#cfcbbc'; g.fillRect(26,116,40,4)
      g.restore()
    }
  })

  def("bailu_stool_covered", {
    clickable: true, say: '凳。多的一把',
    sayDeep: ['本是给客人的', '……没客人', '盖着不占眼'],
    name: "蒙白布的第二把凳", cat: "坐卧", tags: ["蒙白布", "从没用过"],
    scope: "character", fromRoom: 'bailu',
    w: 132, h: 148, base: 148, foot: [24, 100, 84, 48], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle='rgba(46,48,46,0.18)'; g.fillRect(12,134,108,8)
      /* 多的一把凳,布只搭在【凳面】—— 四腿、横枨露着,一眼是凳子。「从没用过」。 */
      const W='#5c5344',W2='#6e6252',W3='#4a4234'
      g.fillStyle=W3; g.fillRect(28,78,14,58); g.fillRect(90,78,14,58)  // 前两腿
      g.fillStyle=W3; g.fillRect(44,74,12,54); g.fillRect(76,74,12,54)  // 后两腿
      g.fillStyle=W; g.fillRect(30,104,72,8)                         // 横枨
      g.fillStyle=W2; g.fillRect(26,66,80,16)                        // 凳面框
      g.fillStyle=W; g.fillRect(26,66,80,6)
      // 布搭凳面,垂前
      g.fillStyle='#c9c9c2'; g.fillRect(24,58,84,18)
      g.fillStyle='#e6e6de'; g.fillRect(28,54,76,20)
      g.fillStyle='#f2f2ea'; g.fillRect(32,56,38,8)
      const HEM=[18,26,16,28,20,24]
      for(let k=0;k<HEM.length;k++){ g.fillStyle=k%2?'#dcdcd4':'#e4e4dc'; g.fillRect(28+k*13,72,13,HEM[k]) }
      g.restore()
    }
  })

  def("bailu_rack_covered", {
    clickable: true, say: '俗家的衣裳',
    sayDeep: ['一件月白的裙', '……下山前穿的', '再穿不上了。留着'],
    name: "蒙白布的衣桁", cat: "收纳", tags: ["蒙白布", "俗家衣裳", "再穿不上"],
    scope: "character", fromRoom: 'bailu',
    w: 84, h: 304, base: 304, foot: [8, 276, 68, 28], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle='rgba(46,48,46,0.20)'; g.fillRect(12,288,60,10)
      /* 衣桁上挂一件俗家衣裳,布只搭在【肩】—— 横杆、垂下的衣身露着,一眼是挂着的衣。 */
      const W='#5c5344',W2='#6e6252'
      g.fillStyle=W; g.fillRect(10,14,64,8); g.fillStyle=W2; g.fillRect(10,14,64,3)  // 横杆
      g.fillStyle=W; g.fillRect(38,8,8,14)                           // 立柱顶
      // 衣裳(月白,垂下)—— 露着,不是蒙布
      g.fillStyle='#c8ccd2'; g.fillRect(22,30,42,220)
      g.fillStyle='#d6dae0'; g.fillRect(26,30,34,220)
      g.fillStyle='#b8bcc4'; g.fillRect(22,30,42,8)                  // 肩线
      g.fillStyle='rgba(120,130,140,0.2)'; g.fillRect(41,40,4,210)   // 中缝
      // 布搭在肩上一小块(她连衣裳的领口都盖着)
      g.fillStyle='#e6e6de'; g.fillRect(24,26,40,18)
      g.fillStyle='#f2f2ea'; g.fillRect(28,28,18,7)
      g.fillStyle='#dcdcd4'; g.fillRect(26,42,14,20)
      g.restore()
    }
  })

  def("bailu_box_covered", {
    clickable: true, say: '匣子',
    sayDeep: ['里面是什么，不说', '……', '你问第三遍我也不说'],
    name: "蒙白布的木匣", cat: "收纳", tags: ["蒙白布", "装什么不说"],
    scope: "character", fromRoom: 'bailu',
    w: 120, h: 96, base: 96, foot: [0, 18, 120, 78], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle='rgba(46,48,46,0.16)'; g.fillRect(10,84,100,7)
      /* 一只木匣,布只搭在【盖】一角 —— 匣身、铜锁扣露着,一眼是匣子。「装什么不说」。 */
      const W='#5c4a38',W2='#6e5a44',W3='#4a3a2c'
      g.fillStyle=W3; g.fillRect(14,40,92,48)
      g.fillStyle=W2; g.fillRect(18,44,84,40)
      g.fillStyle=W; g.fillRect(18,44,84,8)
      g.fillStyle=W3; g.fillRect(18,60,84,3)                         // 盖缝
      g.fillStyle='#8a7a58'; g.fillRect(54,56,16,12)                 // 铜锁扣
      g.fillStyle='#a08a5c'; g.fillRect(54,56,16,4)
      // 布搭盖右角,斜垂
      g.fillStyle='#e6e6de'
      g.beginPath(); g.moveTo(60,36); g.lineTo(108,36); g.lineTo(108,72); g.lineTo(60,50); g.closePath(); g.fill()
      g.fillStyle='#f2f2ea'; g.beginPath(); g.moveTo(64,38); g.lineTo(100,38); g.lineTo(100,56); g.closePath(); g.fill()
      g.fillStyle='#dcdcd4'; g.fillRect(92,68,16,16)
      g.restore()
    }
  })

  def("bailu_scroll_covered", {
    clickable: true, say: '别人送的字',
    sayDeep: ['「上善若水」', '……写得好', '可我不挂。挂了像在标榜'],
    name: "蒙白布的立轴", cat: "墙面", tags: ["蒙白布", "别人送的", "没挂出来"],
    scope: "character", fromRoom: 'bailu', wall: true,
    w: 124, h: 168, base: 168, foot: [0, 168, 124, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      /* 一幅立轴卷着挂,布只搭在【上轴】—— 轴头、垂下的卷身露着,一眼是画轴。 */
      const D='#6b5a3c', D2='#8a7454', P='#d8d2c0'
      g.fillStyle=D; g.fillRect(46,20,32,8)                          // 上轴
      g.fillStyle=D2; g.fillRect(46,20,32,3)
      g.fillStyle=P; g.fillRect(52,28,20,116)                        // 卷身(素绢)
      g.fillStyle='#c6bfaa'; g.fillRect(52,28,20,4)
      g.fillStyle=D; g.fillRect(46,144,32,10)                        // 下轴
      g.fillStyle=D2; g.fillRect(46,144,32,3)
      // 布搭上轴,垂一小段
      g.fillStyle='#e6e6de'; g.fillRect(40,12,44,20)
      g.fillStyle='#f2f2ea'; g.fillRect(44,14,20,8)
      g.fillStyle='#dcdcd4'; g.fillRect(42,30,14,26); g.fillRect(68,30,14,22)
      g.restore()
    }
  })

  def("bailu_cloth_spare", {
    clickable: true, say: '还有的是',
    name: "备用白布一叠", cat: "器物", tags: ["白布", "叠着", "还有的是"],
    scope: "character", fromRoom: 'bailu',
    w: 116, h: 88, base: 88, foot: [0, 20, 116, 68], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle='rgba(46,48,46,0.16)'; g.fillRect(8,78,100,7)
      /* 备用的白布,叠成方正一摞 —— 一层层错开的边、布纹让它读成「一叠布」,不是白块。 */
      for(let k=0;k<5;k++){
        const y=60-k*10, x=10+k*3, w=96-k*6
        g.fillStyle=k%2?'#e0e0d8':'#eaeae2'; g.fillRect(x,y,w,14)
        g.fillStyle='#cfcfc7'; g.fillRect(x,y+11,w,3)               // 每层的暗边
        g.fillStyle='rgba(120,124,120,0.18)'; g.fillRect(x,y+2,w,1)  // 布纹
      }
      g.fillStyle='#f2f2ea'; g.fillRect(14,52,88,4)                 // 顶层高光
      g.restore()
    }
  })

  def("bailu_screen", {
    clickable: true, say: '围屏。五扇，三横两竖',
    sayDeep: ['睡处该挡一挡', '……不为怕人看,屋里也没人', '为的是,醒来先看见画,不是看见门'],
    name: "五扇围屏", cat: "陈设", tags: ["围屏", "三横两竖", "挡在床后"],
    scope: "character", fromRoom: 'bailu',
    w: 456, h: 220, base: 300, foot: [12, 186, 420, 30], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      /* L 形围屏,挡在床【前】(进门这侧):
         三横 —— 三扇正对观者,横在床前;两竖 —— 两扇竖折,沿床左侧向后收。
         排在床之后绘制,盖住床的前下部;床头露在屏上方。 */
      function leaf(pts, lit, painted) {
        // pts:四角[左上,右上,右下,左下]
        const fr = lit ? '#5c5344' : '#443f34', fr2 = lit ? '#6e6558' : '#544d40'
        const silk = lit ? '#dcd6c4' : '#c6c0ae', silk2 = lit ? '#e8e2d0' : '#d0cab8'
        const [a,b,c,d] = pts
        g.fillStyle = '#2a2620'
        g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.lineTo(c[0],c[1]); g.lineTo(d[0],d[1]); g.closePath(); g.fill()
        // 绢面(内缩)
        const ins=(p,q,t)=>[p[0]+(q[0]-p[0])*t, p[1]+(q[1]-p[1])*t]
        const A=ins(ins(a,b,.06),ins(d,c,.06)[0]!==undefined?ins(a,d,.05):a,.05)
        g.fillStyle = silk
        g.beginPath()
        g.moveTo(a[0]+(b[0]-a[0])*.06+(d[0]-a[0])*.05, a[1]+(b[1]-a[1])*.06+(d[1]-a[1])*.05)
        g.lineTo(b[0]+(a[0]-b[0])*.06+(c[0]-b[0])*.05, b[1]+(a[1]-b[1])*.06+(c[1]-b[1])*.05)
        g.lineTo(c[0]+(d[0]-c[0])*.06+(b[0]-c[0])*.05, c[1]+(d[1]-c[1])*.06+(b[1]-c[1])*.05)
        g.lineTo(d[0]+(c[0]-d[0])*.06+(a[0]-d[0])*.05, d[1]+(c[1]-d[1])*.06+(a[1]-d[1])*.05)
        g.closePath(); g.fill()
        g.fillStyle = fr2   // 顶框受光
        g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.lineTo(b[0]+(c[0]-b[0])*.06,b[1]+(c[1]-b[1])*.06); g.lineTo(a[0]+(d[0]-a[0])*.06,a[1]+(d[1]-a[1])*.06); g.closePath(); g.fill()
        if (painted) {
          // 淡墨远山 + 朱印
          const cx=(a[0]+b[0]+c[0]+d[0])/4, botY=(c[1]+d[1])/2, topY=(a[1]+b[1])/2
          const my = topY+(botY-topY)*0.62, ww=(b[0]-a[0])
          g.fillStyle='rgba(80,92,104,0.24)'
          g.beginPath(); g.moveTo(a[0]+8,my+16); g.lineTo(cx-6,my-20); g.lineTo(cx+4,my-6); g.lineTo(cx+16,my-24); g.lineTo(b[0]-8,my+16); g.closePath(); g.fill()
          g.fillStyle='rgba(64,76,88,0.28)'
          g.beginPath(); g.moveTo(a[0]+8,my+26); g.lineTo(cx,my-2); g.lineTo(cx+12,my-12); g.lineTo(b[0]-8,my+26); g.closePath(); g.fill()
          g.fillStyle='rgba(150,60,50,0.42)'; g.fillRect(b[0]-16, topY+12, 6, 6)
        }
      }
      const TOP=18, BOT=196   // 屏面上下(前排)
      // ── 两竖:沿床左侧向后收(远端小、近端大)──
      // 远端(靠床头/后):x40,窄;近端(前左角):x86
      leaf([[24,66],[64,54],[70,168],[30,190]], false, true)    // 后一扇(远)
      leaf([[64,54],[96,TOP+22],[100,BOT-2],[70,168]], false, true)  // 前一扇(接前左角)
      // ── 三横:正对,横在床前 ──
      leaf([[96,TOP+22],[212,TOP+14],[214,BOT-6],[100,BOT-2]], true, true)
      leaf([[212,TOP+14],[330,TOP+14],[330,BOT-6],[214,BOT-6]], true, true)
      leaf([[330,TOP+14],[430,TOP+20],[428,BOT-2],[330,BOT-6]], true, true)
      // 屏脚
      g.fillStyle='#2e2a22'
      for (const [fx,fy] of [[40,186],[80,190],[150,196],[268,196],[386,196]]) g.fillRect(fx, fy, 20, 12)
      g.restore()
    }
  })

  def("bailu_bed_wood", {
    clickable: true, say: '榻。够睡',
    sayDeep: ['被叠成方块', '……起来就叠，睡前才拆', '床看着像没人睡过。我喜欢这样'],
    name: "素木榻", cat: "坐卧", tags: ["素木", "够睡", "像没人睡过"],
    scope: "character", fromRoom: 'bailu', sleep: true,
    w: 348, h: 300, base: 300, foot: [0, 0, 348, 300], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,44,38,0.20)'; g.fillRect(10, 288, 328, 10)
      g.fillStyle = '#4a4234'; g.fillRect(0, 40, 348, 250)         // 榻身
      g.fillStyle = '#6e6252'; g.fillRect(6, 46, 336, 210)
      g.fillStyle = '#7e7160'; g.fillRect(6, 46, 336, 20)
      g.fillStyle = 'rgba(52,44,34,0.16)'
      for (let k = 0; k < 5; k++) g.fillRect(20, 80 + k * 34, 308, 3)
      g.fillStyle = '#4a4234'; g.fillRect(6, 256, 336, 34)         // 榻沿
      g.fillStyle = '#2f2820'; g.fillRect(0, 280, 348, 12)
      g.fillStyle = '#4a4234'; g.fillRect(20, 280, 30, 12); g.fillRect(298, 280, 30, 12)
      // 榻头一道素木栏
      g.fillStyle = '#5c5344'; g.fillRect(0, 40, 12, 240); g.fillRect(336, 40, 12, 240)
      g.fillStyle = '#6e6252'; g.fillRect(0, 40, 348, 12)
      g.restore()
    }
  })

  def("bailu_quilt_folded", {
    clickable: true, say: '被。叠了三折',
    name: "叠成方块的被", cat: "坐卧", tags: ["方块", "棱角对齐"],
    scope: "character", fromRoom: 'bailu',
    w: 156, h: 132, base: 132, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 叠得方正、棱角分明的一床被 —— 像块豆腐
      g.fillStyle = '#8a8578'; g.fillRect(10, 30, 140, 96)         // 侧面暗
      g.fillStyle = '#b0ac9e'; g.fillRect(10, 24, 140, 84)        // 顶面
      g.fillStyle = '#c2beb0'; g.fillRect(10, 24, 140, 20)
      g.fillStyle = '#9c988a'                                       // 三折的层缝
      g.fillRect(10, 52, 140, 3); g.fillRect(10, 78, 140, 3)
      g.fillStyle = 'rgba(70,66,58,0.28)'; g.fillRect(10, 108, 140, 3)   // 底棱
      g.fillStyle = '#a8a496'; g.fillRect(10, 24, 4, 84); g.fillRect(146, 24, 4, 84)   // 竖棱高光
      g.restore()
    }
  })

  def("bailu_pillow", {
    clickable: true, say: '枕。素布',
    name: "素布枕", cat: "坐卧", tags: ["素布", "方"],
    scope: "character", fromRoom: 'bailu',
    w: 96, h: 76, base: 76, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 素布枕:方,布,渐变 + 中缝 + 布纹
      g.fillStyle = '#8a8578'; g.fillRect(6, 30, 84, 38)
      const pgd = g.createLinearGradient(0, 20, 0, 60)
      pgd.addColorStop(0, '#d0ccbe'); pgd.addColorStop(1, '#b0ac9e')
      g.fillStyle = pgd; g.fillRect(6, 20, 84, 40)
      g.fillStyle = '#dcd8ca'; g.fillRect(6, 20, 84, 6)
      g.fillStyle = 'rgba(110,106,94,0.3)'; g.fillRect(44, 22, 3, 40)     // 中缝
      g.fillStyle = 'rgba(150,146,132,0.2)'
      for (let k=0;k<6;k++) g.fillRect(12, 28+k*6, 76, 1)                 // 布纹
      g.fillStyle = '#9c988a'; g.fillRect(10, 56, 76, 4)
      g.restore()
    }
  })

  def("bailu_basin_stand", {
    clickable: true, say: '铜盆。晨昏各一次',
    sayDeep: ['水凉', '……凉水洗脸，人清醒', '清醒了才好念盘'],
    name: "铜盆架", cat: "器物", tags: ["铜盆", "凉水", "晨昏各一次"],
    scope: "character", fromRoom: 'bailu',
    w: 208, h: 268, base: 268, foot: [16, 232, 176, 36], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.2)'; g.fillRect(20, 248, 168, 9)
      // 三足木架:每足有受光/背光棱
      for (const lx of [28, 166, 97]) {
        g.fillStyle = '#3e3a30'; g.fillRect(lx, 110, 14, 140)
        g.fillStyle = '#5c5344'; g.fillRect(lx+1, 112, 11, 138)
        g.fillStyle = '#6e6558'; g.fillRect(lx+1, 112, 4, 138)
      }
      g.fillStyle = '#4a4438'; g.fillRect(24, 150, 160, 12); g.fillRect(24, 210, 160, 12)   // 横枨
      g.fillStyle = '#5c5548'; g.fillRect(24, 150, 160, 4); g.fillRect(24, 210, 160, 4)
      // 铜盆:径向渐变 + 口沿受光 + 水
      pxE(104, 106, 84, 32, '#4a3d24')
      const bgd = g.createRadialGradient(104-20, 100-8, 6, 104, 104, 78)
      bgd.addColorStop(0, '#b8a068'); bgd.addColorStop(0.6, '#9c8552'); bgd.addColorStop(1, '#6b5a38')
      pxE(104, 100, 76, 26, bgd)
      g.save(); g.beginPath(); g.ellipse(104,100,76,26,0,Math.PI*1.1,Math.PI*1.7); g.ellipse(104,100,64,20,0,Math.PI*1.7,Math.PI*1.1,true); g.closePath()
      g.fillStyle='#c2ac74'; g.fill(); g.restore()
      pxE(104, 100, 54, 15, '#7d6a44')                             // 盆内
      pxE(104, 98, 46, 11, '#98a4a2')                              // 凉水
      pxE(104-14, 96, 12, 3, 'rgba(220,230,228,0.5)')              // 水面反光
      g.restore()
    }
  })

  def("bailu_towel", {
    clickable: true, say: '巾。对折三次',
    name: "对折三次的毛巾", cat: "器物", tags: ["对折三次", "边对齐"],
    scope: "character", fromRoom: 'bailu',
    w: 88, h: 96, base: 96, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 搭在横杆上,对折三次,边缘齐
      g.fillStyle = '#5c5344'; g.fillRect(4, 8, 80, 6)             // 杆
      g.fillStyle = '#d0ccbe'; g.fillRect(18, 12, 52, 74)
      g.fillStyle = '#dcd8ca'; g.fillRect(18, 12, 52, 8)
      g.fillStyle = '#b8b4a6'
      g.fillRect(18, 34, 52, 2); g.fillRect(18, 56, 52, 2)         // 折缝
      g.fillStyle = '#c2beb0'; g.fillRect(18, 12, 4, 74); g.fillRect(66, 12, 4, 74)
      g.fillStyle = '#a8a496'; g.fillRect(18, 82, 52, 4)           // 下沿齐
      g.restore()
    }
  })

  def("bailu_soap", {
    clickable: true, say: '皂角',
    name: "皂角碟", cat: "器物", tags: ["皂角", "小碟"],
    scope: "character", fromRoom: 'bailu',
    w: 72, h: 52, base: 52, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(36, 38, 32, 12, '#4a4638')
      pxE(36, 35, 27, 9, '#9a968a')                               // 碟
      pxE(36, 34, 20, 6, '#6e6a5c')                               // 碟凹
      pxE(36, 34, 14, 4, '#5a5648')
      // 皂角:褐,不规则,受光
      g.fillStyle = '#5a4a30'; g.fillRect(24, 22, 24, 14)
      g.fillStyle = '#7d6a48'; g.fillRect(26, 22, 18, 6)
      g.fillStyle = '#4a3d24'; g.fillRect(28, 30, 16, 4)
      g.fillStyle = 'rgba(160,140,100,0.3)'; g.fillRect(26, 22, 12, 2)
      g.restore()
    }
  })

  def("bailu_jar_rice", {
    clickable: true, say: '米。够一个月',
    sayDeep: ['一人吃不了多少', '……称过，一天二两', '一个月六斤。多买无益'],
    name: "米瓮", cat: "器物", tags: ["一个月六斤", "称过", "多买无益"],
    scope: "character", fromRoom: 'bailu',
    w: 184, h: 232, base: 232, foot: [8, 188, 168, 44], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.22)'; g.fillRect(14, 208, 156, 10)
      // 瓮身:侧壁渐变(左受光右暗)+ 鼓腹
      const wgd = g.createLinearGradient(20, 0, 164, 0)
      wgd.addColorStop(0, '#847a68'); wgd.addColorStop(0.45, '#6e6656'); wgd.addColorStop(1, '#4e483a')
      g.fillStyle = '#3e3a30'; g.fillRect(18, 58, 148, 154)
      g.fillStyle = wgd; g.fillRect(22, 62, 140, 146)
      g.fillStyle = '#8a8070'; g.fillRect(22, 62, 140, 8)          // 肩受光
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(34, 70, 6, 130)   // 釉竖高光
      // 肩部与腹部的旋纹
      g.fillStyle = 'rgba(40,36,28,0.3)'
      for (const y of [92, 120, 150, 178]) g.fillRect(22, y, 140, 3)
      g.fillStyle = 'rgba(150,140,120,0.16)'
      for (const y of [90, 118, 148]) g.fillRect(22, y, 140, 1)    // 旋纹高光边
      g.fillStyle = 'rgba(40,36,28,0.28)'; g.fillRect(120, 90, 24, 90)   // 右侧暗
      g.fillStyle = '#3e3a30'; g.fillRect(18, 200, 148, 12)        // 底圈
      pxE(92, 60, 66, 13, '#332f26')                               // 瓮口(暗)
      pxE(92, 56, 56, 10, '#4e483a')
      // 木盖:木纹 + 盖钮
      pxE(92, 50, 52, 9, '#5a4a30')
      pxE(92, 47, 44, 6, '#7d6a44')
      g.fillStyle = 'rgba(74,58,36,0.4)'; g.fillRect(56, 48, 72, 1)
      g.fillStyle = '#5c4c34'; g.fillRect(84, 38, 16, 12); g.fillStyle = '#7d6a44'; g.fillRect(84, 38, 16, 4)
      g.restore()
    }
  })

  def("bailu_bowl_upturned", {
    clickable: true, say: '碗。一只',
    sayDeep: ['一人一只够了', '……多一只要多洗一只', '洗净倒扣,不落灰'],
    name: "倒扣的碗与筷", cat: "器物", tags: ["一只碗", "倒扣", "不落灰"],
    scope: "character", fromRoom: 'bailu',
    w: 152, h: 84, base: 84, foot: [0, 20, 152, 64], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.16)'; g.fillRect(10, 74, 132, 6)
      // 碗(扣着):瓷,渐变 + 圈足
      pxE(52, 62, 44, 12, '#a8a496')
      const wgd = g.createRadialGradient(52-10, 48-4, 3, 52, 50, 40)
      wgd.addColorStop(0, '#eae6d8'); wgd.addColorStop(0.6, '#dcd8ca'); wgd.addColorStop(1, '#b8b4a6')
      pxE(52, 50, 40, 22, wgd)
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(28, 44, 10, 10)   // 釉高光
      pxE(52, 60, 40, 6, '#9a9688')                               // 碗口(朝下,暗)
      pxE(52, 42, 16, 5, '#a8a496')                               // 圈足(朝上)
      pxE(52, 42, 11, 3, '#c2beb0')
      // 一双筷:并齐,竹,端头受光
      g.fillStyle = '#6b5a3c'; g.fillRect(100, 40, 46, 5); g.fillRect(100, 48, 46, 5)
      g.fillStyle = '#8a7454'; g.fillRect(100, 40, 46, 2); g.fillRect(100, 48, 46, 2)
      g.fillStyle = '#4a3d24'; g.fillRect(140, 40, 6, 13)         // 筷头
      g.restore()
    }
  })

  def("bailu_pickle", {
    clickable: true, say: '咸菜。一碟',
    name: "咸菜小碟", cat: "器物", tags: ["咸菜", "一碟", "自己腌的"],
    scope: "character", fromRoom: 'bailu',
    w: 96, h: 60, base: 60, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(48, 42, 42, 14, '#5a5648')
      pxE(48, 38, 36, 11, '#8e8a7c')
      pxE(48, 37, 28, 8, '#6e6a5c')
      g.fillStyle = '#4a5a30'; g.fillRect(30, 26, 36, 12)          // 咸菜:墨绿
      g.fillStyle = '#5c6e3c'; g.fillRect(32, 26, 14, 5); g.fillRect(50, 28, 12, 5)
      g.fillStyle = '#3a4826'; g.fillRect(36, 32, 24, 4)
      g.restore()
    }
  })

  def("bailu_food_box", {
    clickable: true, say: '斋。观里送的',
    sayDeep: ['初一十五送一回', '……我推了盘，送来的日子从没错过', '这世上准的东西不多。斋算一样'],
    name: "素斋提盒", cat: "器物", tags: ["观里送", "初一十五", "从没错过"],
    scope: "character", fromRoom: 'bailu',
    w: 156, h: 128, base: 128, foot: [0, 20, 156, 88], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,44,38,0.18)'; g.fillRect(12, 114, 132, 8)
      // 提梁(弯木)
      g.fillStyle = '#4a3d24'; g.fillRect(28, 8, 10, 28); g.fillRect(118, 8, 10, 28)
      g.fillStyle = '#5c4c34'; g.fillRect(28, 8, 100, 10)
      g.fillStyle = '#7d6a44'; g.fillRect(28, 8, 100, 3)
      // 三层盒:每层受光/层缝
      const cgd = g.createLinearGradient(14, 0, 142, 0)
      cgd.addColorStop(0, '#7d7462'); cgd.addColorStop(1, '#5c5344')
      for (let k = 0; k < 3; k++) {
        const y = 34 + k*28
        g.fillStyle = '#332c22'; g.fillRect(14, y, 128, 28)
        g.fillStyle = cgd; g.fillRect(18, y+2, 120, 24)
        g.fillStyle = '#8a8170'; g.fillRect(18, y+2, 120, 4)       // 层顶受光
        g.fillStyle = 'rgba(40,36,28,0.3)'; g.fillRect(18, y+22, 120, 4)
      }
      // 竹篾横纹
      g.strokeStyle = 'rgba(52,46,34,0.2)'; g.lineWidth = 1
      for (let k = 0; k < 5; k++){ g.beginPath(); g.moveTo(20, 40+k*16); g.lineTo(136, 40+k*16); g.stroke() }
      // 素签
      g.fillStyle = '#eae6d8'; g.fillRect(62, 42, 30, 58)
      g.fillStyle = '#f2eee0'; g.fillRect(62, 42, 30, 5)
      g.fillStyle = '#5a5648'; g.fillRect(70, 50, 16, 2); g.fillRect(70, 58, 12, 2); g.fillRect(70, 66, 14, 2)
      g.restore()
    }
  })

  def("bailu_incense", {
    clickable: true, say: '香。子时一炷',
    sayDeep: ['不为拜', '……为计时。一炷香半个时辰', '排盘要掐着时候'],
    name: "香炉", cat: "法器", tags: ["计时", "一炷香半时辰", "不为拜"],
    scope: "character", fromRoom: 'bailu',
    w: 108, h: 124, base: 124, foot: [0, 88, 108, 36], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.2)'; g.fillRect(10, 108, 88, 7)
      // 三足
      g.fillStyle = '#3a3020'; g.fillRect(22, 100, 9, 16); g.fillRect(54, 104, 9, 12); g.fillRect(78, 100, 9, 16)
      // 炉身:铜,渐变
      pxE(54, 92, 44, 22, '#3a3020')
      const cgd = g.createLinearGradient(30, 0, 78, 0)
      cgd.addColorStop(0, '#a08a52'); cgd.addColorStop(0.5, '#8a7444'); cgd.addColorStop(1, '#5a4a30')
      pxE(54, 88, 40, 18, cgd)
      pxE(54, 82, 34, 11, '#b0985c')                               // 炉肩受光
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(34, 82, 3, 20)
      // 双耳
      g.fillStyle = '#8a7444'; g.fillRect(12, 78, 8, 14); g.fillRect(88, 78, 8, 14)
      g.fillStyle = '#a08a52'; g.fillRect(12, 78, 3, 14); g.fillRect(88, 78, 3, 14)
      // 香灰 + 香
      pxE(54, 72, 30, 6, '#c8c2b4')
      pxE(54, 71, 24, 4, '#dad4c6')
      g.fillStyle = '#8a7a5c'; g.fillRect(52, 32, 4, 40)
      g.fillStyle = '#a89a78'; g.fillRect(52, 32, 2, 40)
      g.fillStyle = '#d84a30'; g.fillRect(52, 28, 4, 6)            // 香头火
      g.fillStyle = 'rgba(216,74,48,0.4)'; g.fillRect(51, 26, 6, 3)
      // 烟(渐淡)
      g.fillStyle = 'rgba(200,200,196,0.34)'; g.fillRect(53, 20, 2, 8)
      g.fillStyle = 'rgba(200,200,196,0.2)'; g.fillRect(52, 12, 2, 8); g.fillRect(54, 8, 2, 6)
      g.restore()
    }
  })

  def("bailu_scroll_star", {
    clickable: true, say: '紫微垣。我照它排',
    name: "星图挂轴", cat: "墙面", tags: ["紫微垣", "三垣二十八宿"], scope: "character", fromRoom: 'bailu', wall: true,
    w: 120, h: 284, base: 284, foot: [0, 284, 120, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 轴头:木,受光 + 描金
      g.fillStyle = '#4a4234'; g.fillRect(4, 4, 112, 14); g.fillRect(4, 258, 112, 14)
      g.fillStyle = '#63594a'; g.fillRect(4, 4, 112, 5); g.fillRect(4, 258, 112, 5)
      g.fillStyle = '#8a7f5c'; g.fillRect(2, 8, 6, 8); g.fillRect(108, 8, 6, 8); g.fillRect(2, 262, 6, 8); g.fillRect(108, 262, 6, 8)  // 轴头铜帽
      // 绢边 + 深底
      g.fillStyle = '#3a3a30'; g.fillRect(12, 18, 96, 240)
      g.fillStyle = '#242630'; g.fillRect(16, 22, 88, 232)          // 夜空底
      const ngd = g.createLinearGradient(0, 22, 0, 254)
      ngd.addColorStop(0, '#2a2d3a'); ngd.addColorStop(1, '#1e2029')
      g.fillStyle = ngd; g.fillRect(16, 22, 88, 232)
      // 星点(大小分级)+ 连线
      const STAR = [[34,44,2],[60,56,3],[80,40,2],[48,88,2],[72,96,3],[40,130,2],[66,140,3],[86,120,2],[52,170,2],[76,182,3],[44,214,2],[70,224,2],[58,60,2],[90,200,2],[30,160,2]]
      g.strokeStyle = 'rgba(150,164,190,0.4)'; g.lineWidth = 1
      g.beginPath(); g.moveTo(35,45); g.lineTo(61,57); g.lineTo(81,41); g.moveTo(49,89); g.lineTo(73,97); g.lineTo(87,121); g.moveTo(41,131); g.lineTo(67,141); g.lineTo(53,171); g.lineTo(77,183); g.stroke()
      for (const [x,y,sz] of STAR) {
        g.fillStyle = 'rgba(200,212,230,0.35)'; g.fillRect(x-1, y-1, sz+2, sz+2)   // 星晕
        g.fillStyle = '#e2e8f2'; g.fillRect(x, y, sz, sz)
      }
      g.fillStyle = '#c8a24a'; g.fillRect(56,58,4,4)               // 一颗主星(紫微),描金
      g.restore()
    }
  })

  def("bailu_chart_28", {
    clickable: true, say: '二十八宿。角亢氐房',
    sayDeep: ['背得出', '……闭着眼也排得出', '排得出,不代表看得见'],
    name: "二十八宿图", cat: "墙面", tags: ["二十八宿", "背得出"], scope: "character", fromRoom: 'bailu', wall: true,
    w: 420, h: 296, base: 296, foot: [0, 296, 420, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const CX = 210, CY = 148
      // ── 木框:三层棱 + 内圈线脚 + 四角搭接 ──
      g.fillStyle = '#2a2620'; g.fillRect(0, 0, 420, 296)
      g.fillStyle = '#4a4438'; g.fillRect(6, 6, 408, 284)
      g.fillStyle = '#5e5648'; g.fillRect(6, 6, 408, 6); g.fillStyle = '#6e6558'; g.fillRect(6, 6, 408, 3)  // 顶棱受光
      g.fillStyle = '#332c22'; g.fillRect(6, 284, 408, 6)
      g.fillStyle = '#3a342a'; g.fillRect(20, 20, 380, 256)        // 内框凹
      g.fillStyle = '#5a5344'; g.fillRect(20, 20, 380, 2); g.fillRect(20, 20, 2, 256)   // 线脚
      // ── 夜空:径向渐变 + 暗角 ──
      const sky = g.createRadialGradient(CX, CY, 20, CX, CY, 210)
      sky.addColorStop(0, '#2e3446'); sky.addColorStop(0.55, '#232838'); sky.addColorStop(1, '#161a26')
      g.fillStyle = sky; g.fillRect(22, 22, 376, 252)
      // 绢丝斜纹(极淡)
      g.strokeStyle = 'rgba(120,130,160,0.04)'; g.lineWidth = 1
      for (let k = -20; k < 30; k++) { g.beginPath(); g.moveTo(22+k*16, 22); g.lineTo(22+k*16+120, 274); g.stroke() }
      // ── 四象:淡墨兽形(极淡青,占四方)──
      g.fillStyle = 'rgba(120,150,170,0.06)'
      // 东青龙(左):蜿蜒
      g.beginPath(); g.moveTo(40,148); g.bezierCurveTo(70,110,60,180,95,150); g.bezierCurveTo(120,128,110,170,140,150); g.lineTo(140,158); g.bezierCurveTo(110,178,120,138,95,160); g.bezierCurveTo(60,192,70,120,40,158); g.closePath(); g.fill()
      // 西白虎(右)
      g.fillStyle = 'rgba(150,160,175,0.055)'
      g.beginPath(); g.ellipse(340,148,42,26,0,0,Math.PI*2); g.fill()
      // 南朱雀(下):展翅
      g.fillStyle = 'rgba(160,140,150,0.05)'
      g.beginPath(); g.moveTo(210,238); g.bezierCurveTo(160,220,150,250,140,240); g.bezierCurveTo(180,236,190,214,210,222); g.bezierCurveTo(230,214,240,236,280,240); g.bezierCurveTo(270,250,260,220,210,238); g.closePath(); g.fill()
      // 北玄武(上):龟蛇
      g.fillStyle = 'rgba(130,150,160,0.05)'
      g.beginPath(); g.ellipse(210,64,34,20,0,0,Math.PI*2); g.fill()
      // ── 同心度圈 ──
      g.strokeStyle = 'rgba(150,164,192,0.32)'; g.lineWidth = 1
      for (const r of [124, 86, 46]) { g.beginPath(); g.arc(CX, CY, r, 0, Math.PI*2); g.stroke() }
      g.strokeStyle = 'rgba(150,164,192,0.16)'
      g.beginPath(); g.arc(CX, CY, 118, 0, Math.PI*2); g.stroke()   // 度圈内线
      // ── 外环:细刻度(每宿 + 宿间小刻)──
      for (let k = 0; k < 28; k++) {
        const a2 = k * Math.PI / 14
        const c = Math.cos(a2), sn = Math.sin(a2)
        g.strokeStyle = 'rgba(180,196,224,0.4)'; g.beginPath()
        g.moveTo(CX+c*118, CY+sn*118); g.lineTo(CX+c*128, CY+sn*128); g.stroke()
        for (let m = 1; m < 4; m++) { const am = a2 + m*Math.PI/56; g.strokeStyle='rgba(150,164,192,0.2)'; g.beginPath(); g.moveTo(CX+Math.cos(am)*122, CY+Math.sin(am)*122); g.lineTo(CX+Math.cos(am)*128, CY+Math.sin(am)*128); g.stroke() }
      }
      // ── 二十八宿:每宿一小星团(2-4 星 + 连线),宿名标一点 ──
      const seed = [3,1,4,1,5,9,2,6,5,3,5,8,9,7,9,3,2,3,8,4,6,2,6,4,3,3,8,3]
      for (let k = 0; k < 28; k++) {
        const a2 = k * Math.PI / 14 - Math.PI/2
        const bx = CX + Math.cos(a2)*106, by = CY + Math.sin(a2)*106
        const n = 2 + seed[k]%3
        const pts = []
        for (let i = 0; i < n; i++) {
          const off = (seed[(k+i)%28]) - 4
          const px = bx + Math.cos(a2+Math.PI/2)*(i*7-7) + off*2
          const py = by + Math.sin(a2+Math.PI/2)*(i*7-7) + (seed[(k*i)%28]-4)
          pts.push([px, py])
        }
        // 宿内连线
        g.strokeStyle = 'rgba(160,176,206,0.3)'; g.lineWidth = 1
        g.beginPath(); pts.forEach((pp,i)=> i?g.lineTo(pp[0],pp[1]):g.moveTo(pp[0],pp[1])); g.stroke()
        // 星点(带晕,主星大)
        pts.forEach(([px,py],i) => {
          const big = i===0
          g.fillStyle = 'rgba(200,214,238,0.3)'; g.fillRect(px-2|0, py-2|0, big?6:4, big?6:4)
          g.fillStyle = big?'#e8eef8':'#c8d4e8'; g.fillRect(px|0, py|0, big?3:2, big?3:2)
        })
      }
      // ── 宿间连成一环的淡线(黄道感)──
      g.strokeStyle = 'rgba(140,156,188,0.18)'; g.beginPath()
      for (let k = 0; k <= 28; k++) { const a2 = k*Math.PI/14 - Math.PI/2; const x=CX+Math.cos(a2)*106, y=CY+Math.sin(a2)*106; k?g.lineTo(x,y):g.moveTo(x,y) } g.stroke()
      // ── 中圈:十二辰点 ──
      for (let k = 0; k < 12; k++) { const a2 = k*Math.PI/6; g.fillStyle='rgba(190,202,222,0.6)'; g.fillRect(CX+Math.cos(a2)*86-1|0, CY+Math.sin(a2)*86-1|0, 3, 3) }
      // ── 中心:北斗七星(勺形,连线)+ 北极星金 ──
      const dip = [[-30,10],[-18,4],[-8,2],[2,4],[8,-4],[16,-12],[6,-16]]
      g.strokeStyle = 'rgba(200,212,236,0.5)'; g.lineWidth = 1
      g.beginPath(); dip.forEach((d,i)=> i?g.lineTo(CX+d[0],CY+d[1]):g.moveTo(CX+d[0],CY+d[1])); g.stroke()
      dip.forEach(([dx,dy],i) => {
        g.fillStyle='rgba(210,222,244,0.35)'; g.fillRect(CX+dx-2|0, CY+dy-2|0, 6, 6)
        g.fillStyle='#eef2fc'; g.fillRect(CX+dx|0, CY+dy|0, 3, 3)
      })
      // 北极星:金,带光
      g.fillStyle = 'rgba(210,170,80,0.35)'; g.fillRect(CX-3, CY-3, 8, 8)
      g.fillStyle = '#e8c464'; g.fillRect(CX-1, CY-1, 4, 4)
      g.fillStyle = '#f6e6a8'; g.fillRect(CX, CY, 2, 2)
      // 另两颗主星描金
      g.fillStyle = '#d8b45a'; g.fillRect(CX+Math.cos(-Math.PI/2)*106-1|0, CY+Math.sin(-Math.PI/2)*106-1|0, 4, 4)
      // ── 角落一方朱印 + 做旧斑 ──
      g.fillStyle = 'rgba(150,60,50,0.55)'; g.fillRect(360, 236, 22, 22)
      g.fillStyle = 'rgba(180,80,66,0.5)'; g.fillRect(363, 239, 16, 16)
      g.fillStyle = 'rgba(30,34,46,0.6)'; g.fillRect(366, 242, 3, 10); g.fillRect(372, 242, 3, 10)
      g.fillStyle = 'rgba(120,110,90,0.08)'; g.fillRect(60, 60, 30, 20); g.fillRect(300, 90, 24, 16)   // 霉斑
      g.restore()
    }
  })

  def("bailu_scroll_star2", {
    clickable: true, say: '副本。这张旧些',
    name: "星图副卷", cat: "墙面", tags: ["副本", "旧"], scope: "character", fromRoom: 'bailu',
    w: 100, h: 184, base: 184, foot: [0, 148, 100, 36], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,44,38,0.18)'; g.fillRect(8, 168, 84, 8)
      g.fillStyle = '#4a4234'; g.fillRect(6, 8, 88, 12)           // 上轴
      g.fillStyle = '#63594a'; g.fillRect(6, 8, 88, 4)
      g.fillStyle = '#8a7f5c'; g.fillRect(4, 10, 5, 8); g.fillRect(85, 10, 5, 8)  // 轴帽
      g.fillStyle = '#3a3a30'; g.fillRect(14, 20, 72, 148)
      const ngd = g.createLinearGradient(0, 20, 0, 168)
      ngd.addColorStop(0, '#2a2d38'); ngd.addColorStop(1, '#1e2028')
      g.fillStyle = ngd; g.fillRect(18, 24, 64, 140)
      g.strokeStyle = 'rgba(140,152,178,0.35)'; g.lineWidth=1
      g.beginPath(); g.moveTo(30,40); g.lineTo(46,54); g.lineTo(60,44); g.moveTo(38,90); g.lineTo(56,104); g.stroke()
      for (let k = 0; k < 9; k++) {
        const x = 28+(k*29)%48, y = 34+k*13
        g.fillStyle = 'rgba(200,212,230,0.3)'; g.fillRect(x-1, y-1, 4, 4)
        g.fillStyle = '#dae0ee'; g.fillRect(x, y, 2, 2)
      }
      g.fillStyle = '#4a4234'; g.fillRect(14, 160, 72, 8)
      g.fillStyle = '#63594a'; g.fillRect(14, 160, 72, 3)
      g.restore()
    }
  })

  def("bailu_compass", {
    clickable: true, say: '罗盘。定方位',
    name: "罗盘", cat: "法器", tags: ["二十四山", "定方位"], scope: "character", fromRoom: 'bailu',
    w: 116, h: 116, base: 116, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.2)'; g.fillRect(16, 108, 84, 8)
      pxE(58, 58, 56, 56, '#2c281f')
      // 盘面:径向渐变
      const gd = g.createRadialGradient(58-14, 58-14, 4, 58, 58, 52)
      gd.addColorStop(0, '#b4ac98'); gd.addColorStop(0.6, '#9a9080'); gd.addColorStop(1, '#7a7060')
      pxE(58, 58, 52, 52, gd)
      // 外环受光弧
      g.save(); g.beginPath(); g.arc(58,58,52,Math.PI*1.1,Math.PI*1.7); g.arc(58,58,46,Math.PI*1.7,Math.PI*1.1,true); g.closePath(); g.fillStyle='#b8b09c'; g.fill(); g.restore()
      // 二十四山
      g.fillStyle = '#463c28'
      for (let k = 0; k < 24; k++) { const a2 = k*Math.PI/12; g.fillRect(58+Math.cos(a2)*44-1|0, 58+Math.sin(a2)*44-1|0, 3, 3) }
      // 内层格线
      g.strokeStyle = 'rgba(70,60,42,0.4)'; g.lineWidth=1
      for (const r of [40, 30, 20]) { g.beginPath(); g.arc(58, 58, r, 0, Math.PI*2); g.stroke() }
      g.fillStyle = '#5a5548'
      for (let k = 0; k < 8; k++) { const a2 = k*Math.PI/4; g.fillRect(58+Math.cos(a2)*24-1|0, 58+Math.sin(a2)*24-1|0, 3, 3) }
      // 天池:红,磁针
      pxE(58, 58, 12, 12, '#2c281f')
      pxE(58, 58, 9, 9, '#c8bca0')
      g.fillStyle = '#a03a30'; g.fillRect(56, 50, 4, 8)            // 红针N
      g.fillStyle = '#3a3428'; g.fillRect(56, 58, 4, 8)            // 针S
      pxE(58, 58, 2, 2, '#e0d8c0')
      g.restore()
    }
  })

  def("bailu_counting_rods", {
    clickable: true, say: '算筹。竹的',
    name: "算筹筒", cat: "器物", tags: ["竹筹", "一筒"], scope: "character", fromRoom: 'bailu',
    w: 76, h: 124, base: 124, foot: [0, 88, 76, 36], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,44,38,0.18)'; g.fillRect(6, 108, 64, 7)
      // 竹筒:渐变 + 两道竹节 + 高光
      const bgd = g.createLinearGradient(10, 0, 66, 0)
      bgd.addColorStop(0, '#8e7a50'); bgd.addColorStop(0.5, '#7d6a44'); bgd.addColorStop(1, '#5a4a30')
      g.fillStyle = '#3e3220'; g.fillRect(10, 46, 56, 66)
      g.fillStyle = bgd; g.fillRect(13, 48, 50, 62)
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(18, 50, 4, 58)
      g.fillStyle = 'rgba(58,48,28,0.5)'; g.fillRect(13, 62, 50, 4); g.fillRect(13, 90, 50, 4)   // 竹节
      g.fillStyle = 'rgba(150,132,88,0.3)'; g.fillRect(13, 60, 50, 1); g.fillRect(13, 88, 50, 1)
      // 露出的算筹:细竹条,长短参差,顶受光
      const R = [[20,16],[27,10],[34,20],[41,12],[48,17],[55,13]]
      for (const [x,dy] of R) {
        g.fillStyle = '#c9bd94'; g.fillRect(x, 46-dy-14, 4, dy+16)
        g.fillStyle = '#e0d6ac'; g.fillRect(x, 46-dy-14, 2, dy+16)
        g.fillStyle = '#a89a6c'; g.fillRect(x, 46-dy-14, 4, 2)
      }
      g.restore()
    }
  })

  def("bailu_ink_stone", {
    clickable: true, say: '墨与砚',
    name: "墨与砚", cat: "器物", tags: ["端砚", "松烟墨"], scope: "character", fromRoom: 'bailu',
    w: 92, h: 44, base: 44, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      // 端砚:石,渐变 + 墨池 + 墨条
      pxE(30, 30, 26, 14, '#2f2a26')
      const sgd = g.createRadialGradient(30-8, 27-4, 2, 30, 30, 24)
      sgd.addColorStop(0, '#54504a'); sgd.addColorStop(1, '#38332e')
      pxE(30, 27, 20, 10, sgd)
      pxE(30, 30, 12, 6, '#15120f')                               // 墨池(深)
      pxE(28, 28, 6, 3, 'rgba(90,110,120,0.3)')                   // 墨池残墨反光
      // 墨条:立,渐变 + 描金
      const mgd = g.createLinearGradient(58, 0, 70, 0)
      mgd.addColorStop(0, '#3a332c'); mgd.addColorStop(1, '#15120f')
      g.fillStyle = mgd; g.fillRect(58, 12, 12, 30)
      g.fillStyle = '#4a443c'; g.fillRect(58, 12, 12, 4)
      g.fillStyle = '#8a7f5c'; g.fillRect(60, 8, 8, 6)            // 墨顶描金
      g.restore()
    }
  })

  def("bailu_compass_set", {
    clickable: true, say: '规。画圆用',
    name: "尺规一套", cat: "器物", tags: ["圆规", "分度"], scope: "character", fromRoom: 'bailu',
    w: 60, h: 40, base: 40, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 圆规:铜,两脚 + 顶铰 + 针尖高光
      g.fillStyle = '#5a4a30'; g.fillRect(20, 6, 5, 30)
      g.save(); g.translate(24, 8); g.rotate(0.5); g.fillStyle = '#5a4a30'; g.fillRect(0, 0, 5, 30)
      g.fillStyle = '#7d6a44'; g.fillRect(0, 0, 2, 30); g.restore()
      g.fillStyle = '#7d6a44'; g.fillRect(20, 6, 2, 30)
      g.fillStyle = '#8a7454'; g.fillRect(17, 3, 14, 9)                   // 顶铰
      g.fillStyle = '#a2946e'; g.fillRect(17, 3, 14, 3)
      g.fillStyle = '#c8bca0'; g.fillRect(20, 33, 4, 5); g.fillRect(37, 33, 4, 5)  // 针尖
      g.restore()
    }
  })

  def("bailu_mat_square", {
    clickable: true, say: '打坐。一个人',
    sayDeep: ['方垫，不是圆蒲团', '……道门的规矩，方', '一个人坐，坐得正'],
    name: "素面方垫", cat: "坐卧", tags: ["方", "带布边", "一个人"], scope: "character", fromRoom: 'bailu',
    w: 208, h: 208, base: 208, foot: [0, 0, 0, 0], zLayer: 'low', walkable: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#6e6656'; g.fillRect(4, 4, 200, 200)         // 布边
      g.fillStyle = '#8a8272'; g.fillRect(14, 14, 180, 180)
      g.fillStyle = '#948b79'; g.fillRect(20, 20, 168, 168)       // 垫面
      // 织纹:细密的横线,方
      g.fillStyle = 'rgba(70,66,58,0.14)'
      for (let k = 0; k < 20; k++) g.fillRect(20, 24 + k*8, 168, 2)
      g.fillStyle = 'rgba(70,66,58,0.10)'
      for (let k = 0; k < 20; k++) g.fillRect(24 + k*8, 20, 2, 168)
      g.fillStyle = 'rgba(120,116,104,0.24)'; g.fillRect(78, 84, 52, 44)   // 中间坐塌的浅痕
      g.fillStyle = '#5c5548'; g.fillRect(4, 4, 200, 4); g.fillRect(4, 200, 200, 4); g.fillRect(4, 4, 4, 200); g.fillRect(200, 4, 4, 200)   // 包边深线
      g.restore()
    }
  })

  def("bailu_lamp_desk", {
    clickable: true, say: '灯。只排盘时点',
    sayDeep: ['天光够就不点', '……灯油要钱,也要人添', '一个人的屋子,越少要打理越好'],
    name: "排盘灯", cat: "灯火", tags: ["只排盘时点", "唯一会点的灯"], scope: "character", fromRoom: 'bailu',
    w: 76, h: 148, base: 148, foot: [8, 120, 60, 28], zLayer: 'sort',
    light: (st) => st.divining ? { x: 30, y: 30, r: 200, color: '#e8d29a', flicker: 0.5 } : null,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.2)'; g.fillRect(10, 128, 56, 8)
      // 底座:三层,铜
      pxE(38, 128, 30, 9, '#3a3020')
      pxE(38, 124, 26, 8, '#7d6a44')
      pxE(38, 122, 18, 5, '#9c8552')
      // 灯杆:渐变铜 + 高光
      const sgd = g.createLinearGradient(30, 0, 42, 0)
      sgd.addColorStop(0, '#8a7444'); sgd.addColorStop(0.5, '#6b5a3c'); sgd.addColorStop(1, '#4a3d24')
      g.fillStyle = sgd; g.fillRect(30, 42, 12, 88)
      g.fillStyle = '#a2946e'; g.fillRect(31, 42, 3, 88)
      // 一道节
      g.fillStyle = '#8a7454'; g.fillRect(28, 82, 16, 6); g.fillStyle = '#a2946e'; g.fillRect(28, 82, 16, 2)
      // 灯碗:铜,渐变 + 灯油 + 灯芯
      pxE(38, 42, 28, 13, '#3a3020')
      const bgd = g.createRadialGradient(38-8, 38-4, 3, 38, 40, 24)
      bgd.addColorStop(0, '#a08a52'); bgd.addColorStop(1, '#6b5a3c')
      pxE(38, 38, 24, 10, bgd)
      pxE(38, 38, 16, 6, '#4a3d24')                                // 灯油池
      pxE(38, 37, 10, 4, '#5a4a30')
      g.fillStyle = '#e8dcaa'; g.fillRect(36, 26, 4, 12)           // 灯芯
      g.fillStyle = '#c8a24a'; g.fillRect(36, 24, 4, 4)
      // 挑杆
      g.fillStyle = '#5a5344'; g.fillRect(34, 18, 8, 8)
      g.restore()
    }
  })

  def("bailu_whisk", {
    clickable: true, say: '拂尘',
    name: "拂尘", cat: "法器", tags: ["马尾", "道门"], scope: "character", fromRoom: 'bailu',
    // foot 原为 [48,176,24,28]:右缘 72 越出 w=68,而且整块在拂尘右边的空处 ——
    // 实测着地段是 x28–35、实体底边 y189,原 foot 覆盖率 0%,角色直接从拂尘身上穿过去。
    w: 68, h: 204, base: 204, foot: [24, 170, 16, 20], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,44,38,0.16)'; g.fillRect(8, 190, 52, 7)
      // 柄:渐变木 + 缠丝
      const hgd = g.createLinearGradient(26, 0, 38, 0)
      hgd.addColorStop(0, '#7d6a44'); hgd.addColorStop(1, '#4a3d24')
      g.fillStyle = hgd; g.fillRect(28, 60, 8, 130)
      g.fillStyle = '#a2946e'; g.fillRect(28, 60, 2, 130)
      g.fillStyle = '#8a7454'; g.fillRect(24, 54, 16, 10); g.fillStyle = '#a2946e'; g.fillRect(24, 54, 16, 3)  // 柄头
      g.fillStyle = '#5a4a30'; for (let k=0;k<3;k++) g.fillRect(26, 66+k*8, 12, 2)   // 缠丝
      // 白马尾:分缕,受光/背光
      for (let k = 0; k < 9; k++) {
        const x = 16 + k*4, len = 26 + (k%3)*8
        g.fillStyle = k%2?'#d0ccbe':'#e4e4dc'; g.fillRect(x, 44, 3, len)
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x, 44, 1, len)
      }
      g.restore()
    }
  })

  def("bailu_lamp_oil_jug", {
    clickable: true, say: '灯油',
    name: "灯油壶", cat: "器物", tags: ["灯油", "省着用"], scope: "character", fromRoom: 'bailu',
    w: 88, h: 112, base: 112, foot: [0, 20, 88, 88], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.18)'; g.fillRect(8, 98, 72, 7)
      pxE(44, 80, 34, 22, '#4e483a')                              // 壶身
      pxE(44, 74, 30, 18, '#6e6656')
      pxE(44, 70, 22, 12, '#7e7565')
      g.fillStyle = '#4e483a'; g.fillRect(28, 40, 10, 30)         // 颈
      g.fillStyle = '#6e6656'; g.fillRect(28, 40, 4, 30)
      pxE(33, 38, 12, 5, '#5a5344')                               // 口
      g.fillStyle = '#5a5344'; g.fillRect(58, 56, 14, 6); g.fillRect(66, 56, 6, 18)   // 把
      g.restore()
    }
  })

  def("bailu_flint", {
    clickable: true, say: '火折。烛剪',
    name: "火折与烛剪", cat: "器物", tags: ["火折", "烛剪"], scope: "character", fromRoom: 'bailu',
    w: 104, h: 64, base: 64, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = '#6b5a3c'; g.fillRect(8, 30, 40, 12)          // 火折竹管
      g.fillStyle = '#8a7454'; g.fillRect(8, 30, 40, 4)
      g.fillStyle = '#4a3d24'; g.fillRect(44, 32, 8, 8)
      g.fillStyle = '#5a5548'; g.fillRect(60, 22, 6, 26); g.fillRect(66, 22, 6, 26)   // 烛剪双股
      g.fillStyle = '#727881'; g.fillRect(60, 22, 6, 6); g.fillRect(66, 22, 6, 6)
      pxE(69, 46, 12, 8, '#454a50')                               // 剪的铰
      g.restore()
    }
  })

  def("bailu_mirror_covered", {
    clickable: true, say: '镜子。蒙着',
    sayDeep: ['照人的东西', '……我不爱照', '看得清别人就够了。自己不必'],
    name: "蒙白布的镜子", cat: "墙面", tags: ["蒙白布", "照人", "自己不照"], scope: "character", fromRoom: 'bailu', wall: true,
    w: 152, h: 268, base: 268, foot: [0, 268, 152, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      /* 立镜,布只搭在【上缘】垂下一段 —— 镜框、镜面(暗)露大半,一眼是镜子。
         镜子朝外,但她拿布把「照见」那一处遮了:不照人,也不被照。 */
      const F1='#5c5344', F2='#6e6252', F3='#4a4234'
      // 底座
      g.fillStyle=F3; g.fillRect(44,236,64,18); g.fillStyle=F2; g.fillRect(44,236,64,6)
      // 镜框(立长方)
      g.fillStyle=F3; g.fillRect(30,20,92,220)
      g.fillStyle=F2; g.fillRect(36,26,80,208)
      // 镜面:暗青,一道斜高光
      g.fillStyle='#3f484c'; g.fillRect(42,32,68,196)
      g.fillStyle='#4e585c'; g.fillRect(42,32,68,60)
      g.fillStyle='rgba(180,196,200,0.18)'; g.fillRect(54,40,10,180)
      // ── 白布:搭在镜顶,垂下前面一段,参差 ──
      g.fillStyle='#c9c9c2'; g.fillRect(24,16,104,22)
      g.fillStyle='#e6e6de'; g.fillRect(28,12,96,24)
      g.fillStyle='#f2f2ea'; g.fillRect(34,14,50,9)
      const HEM=[30,40,26,44,32,38,28]
      for(let k=0;k<HEM.length;k++){ g.fillStyle=k%2?'#dcdcd4':'#e4e4dc'; g.fillRect(30+k*14,36,14,HEM[k]) }
      g.fillStyle='rgba(120,124,120,0.3)'; g.fillRect(30,28,92,3)
      g.restore()
    }
  })

  def("bailu_retreat_tag", {
    clickable: true, say: '闭关。翻过来就是',
    sayDeep: ['上回翻是三年前', '……有人求我改命', '我说我只念不改，然后翻了牌'],
    name: "闭关木牌", cat: "墙面", tags: ["翻面", "三年前", "只念不改"], scope: "character", fromRoom: 'bailu', wall: true,
    w: 104, h: 72, base: 72, foot: [0, 72, 104, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#3e3a30'; g.fillRect(6, 8, 92, 56)
      g.fillStyle = '#6b6152'; g.fillRect(10, 12, 84, 48)
      g.fillStyle = '#7d7462'; g.fillRect(10, 12, 84, 8)
      g.fillStyle = '#e8e4d6'; g.fillRect(24, 24, 56, 26)          // 面朝外:空白(此刻不闭关)
      g.fillStyle = '#8a8578'; g.fillRect(30, 30, 44, 3); g.fillRect(30, 38, 30, 3)
      g.fillStyle = '#5a5344'; g.fillRect(48, 4, 8, 8)             // 挂钉
      g.restore()
    }
  })

  def("bailu_door_bar", {
    clickable: true, say: '闩。从里插',
    name: "门闩", cat: "墙面", tags: ["内插", "一个人"], scope: "character", fromRoom: 'bailu', wall: true,
    w: 88, h: 56, base: 56, foot: [0, 56, 88, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#4a3d24'; g.fillRect(4, 20, 80, 16)          // 闩
      g.fillStyle = '#6b5a3c'; g.fillRect(4, 20, 80, 6)
      g.fillStyle = '#3e3226'; g.fillRect(8, 12, 12, 32); g.fillRect(68, 12, 12, 32)   // 两个闩座
      g.fillStyle = '#5a4a30'; g.fillRect(8, 12, 12, 6); g.fillRect(68, 12, 12, 6)
      g.restore()
    }
  })

  def("bailu_sutra", {
    clickable: true, say: '道经。一函',
    name: "素经卷一函", cat: "书卷", tags: ["道经", "一函"], scope: "character", fromRoom: 'bailu',
    w: 148, h: 112, base: 112, foot: [0, 24, 148, 88], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,44,38,0.18)'; g.fillRect(10, 98, 128, 7)
      // 蓝布函套:渐变
      const bgd = g.createLinearGradient(0, 20, 0, 98)
      bgd.addColorStop(0, '#5d6a5b'); bgd.addColorStop(1, '#3f4a3e')
      g.fillStyle = '#2f382f'; g.fillRect(8, 20, 132, 78)
      g.fillStyle = bgd; g.fillRect(12, 24, 124, 70)
      g.fillStyle = '#68765f'; g.fillRect(12, 24, 124, 6)         // 顶受光
      // 卷轴头:一排,木/象牙
      g.fillStyle = '#d8d2c0'; g.fillRect(20, 34, 108, 13)
      g.fillStyle = '#e8e2d0'; g.fillRect(20, 34, 108, 4)
      for (const x of [24,48,72,96]) { g.fillStyle = '#6b5a3c'; g.fillRect(x, 34, 8, 13); g.fillStyle = '#8a7454'; g.fillRect(x, 34, 8, 4) }
      // 签
      g.fillStyle = '#eceade'; g.fillRect(54, 56, 38, 32)
      g.fillStyle = '#f2f0e6'; g.fillRect(54, 56, 38, 5)
      g.fillStyle = '#4a4638'; g.fillRect(62, 63, 22, 2); g.fillRect(62, 70, 16, 2); g.fillRect(62, 77, 19, 2)
      g.restore()
    }
  })

  def("bailu_vase_pure", {
    clickable: true, say: '净瓶',
    name: "净瓶", cat: "器物", tags: ["净水", "杨枝"], scope: "character", fromRoom: 'bailu',
    w: 80, h: 148, base: 148, foot: [0, 120, 80, 28], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.16)'; g.fillRect(8, 128, 64, 7)
      // 瓶腹:瓷,径向渐变
      pxE(40, 108, 32, 24, '#6f7c78')
      const vgd = g.createRadialGradient(40-8, 100-6, 3, 40, 106, 30)
      vgd.addColorStop(0, '#b6bec0'); vgd.addColorStop(0.6, '#96a09c'); vgd.addColorStop(1, '#6f7c78')
      pxE(40, 104, 28, 20, vgd)
      g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(26, 96, 4, 24)   // 釉高光
      // 长颈:渐变
      const ngd = g.createLinearGradient(30, 0, 48, 0)
      ngd.addColorStop(0, '#a8b0ab'); ngd.addColorStop(1, '#78827d')
      g.fillStyle = ngd; g.fillRect(32, 50, 16, 50)
      pxE(40, 46, 13, 6, '#8a9490')                               // 盘口
      pxE(40, 44, 9, 4, '#a8b0ab')
      // 杨枝
      g.fillStyle = '#4a5548'; g.fillRect(38, 18, 4, 30)
      g.fillStyle = '#5d6a5b'; g.fillRect(33, 20, 6, 3); g.fillRect(34, 26, 5, 3); g.fillRect(42, 24, 5, 3)
      g.restore()
    }
  })

  def("bailu_broom", {
    clickable: true, say: '扫帚。每日一遍',
    sayDeep: ['地上不该有灰', '……有灰,人就知道有人住', '扫干净,像没人来过'],
    name: "扫帚与簸箕", cat: "器物", tags: ["每日一遍", "像没人来过"], scope: "character", fromRoom: 'bailu',
    w: 132, h: 176, base: 176, foot: [8, 148, 116, 28], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,44,38,0.16)'; g.fillRect(12, 162, 100, 7)
      // 扫帚:竖靠
      g.fillStyle = '#5a4a30'; g.fillRect(30, 20, 8, 120)
      g.fillStyle = '#7d6a44'; g.fillRect(30, 20, 3, 120)
      g.fillStyle = '#a89a6c'                                      // 扎的糜草
      for (let k = 0; k < 9; k++) g.fillRect(18 + k*4, 138, 3, 28 + (k%3)*6)
      g.fillStyle = '#8a7c50'; g.fillRect(20, 134, 30, 8)
      // 簸箕
      g.fillStyle = '#6b5a3c'; g.fillRect(66, 120, 56, 40)
      g.fillStyle = '#8a7454'; g.fillRect(66, 120, 56, 8)
      g.fillStyle = '#4a3d24'; g.fillRect(66, 152, 56, 8)
      g.fillStyle = '#5a4a30'; g.fillRect(112, 108, 6, 24)         // 柄
      g.restore()
    }
  })

  def("bailu_shoes", {
    clickable: true, say: '履。出门穿',
    name: "素履一双", cat: "器物", tags: ["素履", "摆正"], scope: "character", fromRoom: 'bailu',
    w: 116, h: 64, base: 64, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,44,38,0.14)'; g.fillRect(6, 48, 104, 6)
      // 一双素履,并齐,布面渐变 + 底
      for (const dx of [4, 60]) {
        pxE(dx+26, 42, 26, 11, '#3e3a30')                         // 底(暗)
        const sgd = g.createLinearGradient(0, 22, 0, 40)
        sgd.addColorStop(0, '#a0998a'); sgd.addColorStop(1, '#7a7466')
        g.fillStyle = sgd; g.fillRect(dx+8, 24, 36, 12)           // 鞋面
        g.fillStyle = '#b0a99a'; g.fillRect(dx+8, 24, 36, 3)
        g.fillStyle = '#5a5548'; g.fillRect(dx+4, 44, 44, 4)      // 底沿
        g.fillStyle = 'rgba(60,56,48,0.3)'; g.fillRect(dx+18, 26, 8, 8)  // 鞋口暗
      }
      g.restore()
    }
  })

  def("bailu_doormat", {
    clickable: true, say: '门垫',
    name: "门垫", cat: "地面", tags: ["棕", "进门"], scope: "character", fromRoom: 'bailu', walkable: true,
    w: 200, h: 72, base: 72, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#5a5040'; g.fillRect(4, 4, 192, 64)
      g.fillStyle = '#6e6252'; g.fillRect(10, 10, 180, 52)
      g.fillStyle = '#5a5040'
      for (let k = 0; k < 12; k++) g.fillRect(16 + k*14, 10, 3, 52)
      for (let k = 0; k < 3; k++) g.fillRect(10, 20 + k*13, 180, 3)
      g.restore()
    }
  })

  def("bailu_wall_mark", {
    name: "地面的一道刻痕", cat: "地面", tags: ["她量过的线"], scope: "character", fromRoom: 'bailu',
    clickable: true, say: '这条线，量正南',
    sayDeep: ['刻在地上，不会动', '……罗盘会偏，刻痕不偏', '定了南，别的方位都定了'],
    w: 240, h: 24, base: 0, foot: [0, 0, 0, 0], zLayer: 'low', walkable: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(40,44,42,0.32)'; g.fillRect(0, 8, 240, 4)   // 刻痕
      g.fillStyle = 'rgba(60,64,62,0.18)'; g.fillRect(0, 12, 240, 2)
      g.fillStyle = 'rgba(40,44,42,0.28)'; g.fillRect(0, 4, 6, 12); g.fillRect(234, 4, 6, 12)   // 两端的定点
      g.restore()
    }
  })

  def("bailu_light_patch", {
    name: "北窗下的光斑", cat: "地面", tags: ["冷光", "唯一落地的光"], scope: "character", fromRoom: 'bailu',
    w: 248, h: 128, base: 0, foot: [0, 0, 0, 0], zLayer: 'low', walkable: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 窗格投影:冷白,方格,落在石地上
      g.fillStyle = 'rgba(200,212,224,0.14)'; g.fillRect(0, 0, 248, 128)
      g.fillStyle = 'rgba(210,222,232,0.10)'
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) g.fillRect(6 + c*62, 6 + r*30, 54, 22)
      g.restore()
    }
  })

  def("bailu_cup_ring", {
    name: "案角的杯痕", cat: "桌案", tags: ["唯一的痕", "六年一个位置"], scope: "character", fromRoom: 'bailu',
    clickable: true, say: '杯放这儿。六年',
    sayDeep: ['印子擦不掉了', '……这屋里唯一的痕', '别的我都不留。这个留着，提醒我也是活人'],
    w: 68, h: 48, base: 0, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(34, 24, 26, 16, 'rgba(90,80,60,0.20)')                  // 一圈茶渍
      pxE(34, 24, 20, 12, 'rgba(110,100,78,0.12)')
      pxE(34, 24, 13, 8, 'rgba(90,80,60,0.16)')
      g.restore()
    }
  })

  def("bailu_table_ledger", {
    clickable: true, say: '算表。逐年的',
    sayDeep: ['流年干支，推好列成表', '……查一眼就行，不必重推', '省下的时间，还是排盘'],
    name: "算表卷", cat: "书卷", tags: ["流年", "列成表", "查一眼"], scope: "character", fromRoom: 'bailu',
    w: 128, h: 92, base: 92, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 摊开的算表:纸 + 格 + 密数 + 朱标
      g.fillStyle = '#4a4438'; g.fillRect(4, 6, 120, 80)
      g.fillStyle = '#f2f0e6'; g.fillRect(8, 10, 112, 72)
      g.fillStyle = '#e4e2d6'; g.fillRect(8, 10, 112, 5)
      g.fillStyle = '#8e8a7c'
      for (let k = 0; k <= 8; k++) g.fillRect(14+k*12, 14, 1, 64)
      for (let k = 0; k <= 5; k++) g.fillRect(12, 16+k*12, 104, 1)
      g.fillStyle = '#4a4638'
      for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) if ((r*c)%3) g.fillRect(16+c*12, 18+r*12, 7, 3)
      g.fillStyle = '#a03a30'; g.fillRect(16, 66, 7, 3); g.fillRect(40, 66, 7, 3)
      g.fillStyle = 'rgba(180,176,164,0.4)'; g.fillRect(8, 80, 112, 2)
      g.restore()
    }
  })
