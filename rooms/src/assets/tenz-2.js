







  def("tenz_cloak_hook", {
    clickable: true, say: '这件披风，下次法会穿',
    name: "斗篷钩", cat: "墙面", tags: ["僧袍","挂钩"],
    scope: "character", fromRoom: 'tenz',
    w: 64, h: 192, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-34, -470)
  g.fillStyle = '#48301c'; g.fillRect(34, 470, 60, 10)
  g.fillStyle = '#9a3830'
  g.beginPath(); g.moveTo(44, 480); g.lineTo(88, 480); g.lineTo(96, 660); g.lineTo(36, 660); g.fill()
  g.fillStyle = '#7a2c26'; g.fillRect(52, 480, 10, 176)
  g.fillStyle = '#e8b23d'; g.fillRect(38, 640, 56, 8)
      g.restore()
    }
  })
  def("tenz_torma", { patina: true,
    clickable: true, say: '捏酥油花的时候，手是静的',
    name: "朵玛供品", cat: "供奉", tags: ["朵玛","酥油","小几"],
    scope: "character", fromRoom: 'tenz',
    w: 98, h: 120, base: 118, foot: [0, 108, 96, 10], zLayer: 'low',
    fx(g, t, X, Y) {
      const al = 0.2 + 0.15 * Math.sin(t / 500)
      const gr = g.createRadialGradient(X + 49, Y + 40, 2, X + 49, Y + 40, 30)
      gr.addColorStop(0, 'rgba(255,236,180,' + al.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,236,180,0)')
      g.fillStyle = gr; g.fillRect(X + 19, Y + 10, 60, 60)
    },
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-936, -470)
  g.fillStyle = '#5a3a24'; g.fillRect(936, 520, 96, 68)
  for (const dx of [958, 1000]) {
    g.fillStyle = '#ece4d0'
    g.beginPath(); g.moveTo(dx - 14, 520); g.lineTo(dx, 470); g.lineTo(dx + 14, 520); g.fill()
    g.fillStyle = '#c83828'; pxC(dx, 486, 6, '#c83828')
    g.fillStyle = '#e8b23d'; g.fillRect(dx - 8, 504, 16, 4)
  }
      g.restore()
    }
  })
  def("tenz_sutra_shelf", { patina: 'wood',
    clickable: true, say: '经刻在骨头上，不靠天天翻',
    name: "经书架", cat: "收纳", tags: ["经书","格架","铜锣","靠墙"],
    scope: "character", fromRoom: 'tenz',
    w: 242, h: 398, base: 396, foot: [0, 388, 240, 8], zLayer: 'sort',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-60, -1560)
  g.fillStyle = '#48301c'; g.fillRect(60, 1640, 240, 316)
  g.fillStyle = '#5a3a24'; g.fillRect(68, 1648, 224, 300)
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 3; c++) {
      const gx = 76 + c * 72, gy = 1656 + r * 72
      g.fillStyle = '#38281a'; g.fillRect(gx, gy, 64, 64)
      // 经书端面(布包色)
      g.fillStyle = ['#e8b23d', '#8a3038', '#3868b8', '#48a048', '#c83828', '#7a2c26'][(r * 3 + c) % 6]
      g.fillRect(gx + 6, gy + 14, 52, 44)
      g.fillStyle = '#ece4d0'; g.fillRect(gx + 6, gy + 30, 52, 5)
    }
  // 架顶:铜锣 + 锣槌
  pxC(150, 1600, 40, '#8a6a30')
  pxC(150, 1600, 32, '#c9a26a')
  pxC(150, 1600, 10, '#8a6a30')
  g.fillStyle = '#6a4a30'; g.fillRect(210, 1590, 44, 8); pxC(256, 1594, 9, '#ece4d0')
      g.restore()
    }
  })
  def("tenz_sutra_desk", {
    clickable: true, say: '算日子我在行，算命我不碰',
    name: "经桌", cat: "供奉", tags: ["矮桌","法器","念珠"],
    scope: "character", fromRoom: 'tenz',
    w: 232, h: 172, base: 170, foot: [0, 30, 230, 140], zLayer: 'low',
    variant(st) { return (st && st.divining) ? 'open' : 'shut' },
    fx(g, t, X, Y, o, room) {
      if (!(room && room.state && room.state.divining)) return
      // 指点迷津:历书摊开的微光（他还在用的东西，不落灰）
      const al = 0.25 + 0.12 * Math.sin(t / 400)
      const gr = g.createRadialGradient(X + 116, Y + 40, 2, X + 116, Y + 40, 90)
      gr.addColorStop(0, 'rgba(255,228,150,' + al.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,228,150,0)')
      g.fillStyle = gr; g.fillRect(X + 26, Y - 50, 180, 180)
    },
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-1104, -1150)
  g.fillStyle = '#5a3a24'; g.fillRect(1104, 1180, 230, 140)
  g.fillStyle = '#6a4a30'; g.fillRect(1104, 1180, 230, 16)
  g.fillStyle = '#48301c'; g.fillRect(1112, 1306, 20, 14); g.fillRect(1306, 1306, 20, 14)
  // 长条藏经(布包 + 展开的一叶)
  g.fillStyle = '#e8b23d'; g.fillRect(1124, 1150, 130, 34)
  g.fillStyle = '#c99426'; g.fillRect(1124, 1160, 130, 5)
  g.fillStyle = '#8a3038'; g.fillRect(1176, 1150, 16, 34)
  g.fillStyle = '#ece4d0'; g.fillRect(1140, 1196, 160, 44)
  g.fillStyle = '#8a7a5c'
  for (let k = 0; k < 4; k++) g.fillRect(1150, 1206 + k * 9, 140, 3)
  // 金刚铃 + 金刚杵
  g.fillStyle = '#c9a26a'
  g.beginPath(); g.moveTo(1286, 1226); g.lineTo(1310, 1226); g.lineTo(1314, 1252); g.lineTo(1282, 1252); g.fill()
  g.fillRect(1294, 1212, 8, 16)
  g.fillRect(1250, 1268, 44, 8)
  pxC(1250, 1272, 7, '#c9a26a'); pxC(1294, 1272, 7, '#c9a26a')
  // 念珠(散开一圈)
  g.fillStyle = '#7a2c26'
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * 6.28
    g.fillRect(1180 + Math.cos(a) * 34, 1272 + Math.sin(a) * 18, 7, 7)
  }
  // 手鼓 damaru
  g.fillStyle = '#8a3038'
  g.fillRect(1120, 1256, 34, 14); g.fillRect(1124, 1270, 26, 6); g.fillRect(1120, 1276, 34, 14)
  g.fillStyle = '#ece4d0'; g.fillRect(1152, 1262, 18, 3); pxC(1172, 1264, 4, '#ece4d0')
      g.restore()
    }
  })
  def("tenz_dungchen", { patina: true,
    clickable: true, say: '一口气吹到底，杂念跟着跑光', sayDeep: '这声音能上山，总有天我吹给他们听',
    name: "大法号", cat: "藏味", tags: ["法号","横放"],
    scope: "character", fromRoom: 'tenz',
    w: 456, h: 103, base: 101, foot: [0, 33, 454, 60], zLayer: 'low',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-780, -1829)
  g.fillStyle = '#c9a26a'
  g.beginPath(); g.moveTo(780, 1878); g.lineTo(1150, 1862); g.lineTo(1150, 1898); g.lineTo(780, 1892); g.fill()
  g.beginPath(); g.moveTo(1150, 1848); g.lineTo(1224, 1830); g.lineTo(1224, 1920); g.lineTo(1150, 1908); g.fill()
  g.fillStyle = '#e8b23d'
  g.fillRect(900, 1868, 14, 26); g.fillRect(1040, 1864, 14, 30); g.fillRect(1150, 1848, 10, 60)
  g.fillStyle = '#8a6a30'; g.fillRect(780, 1878, 12, 14)
  pxE(1224, 1875, 10, 46, '#8a6a30')
  // 号架(小木叉)
  g.fillStyle = '#48301c'; g.fillRect(1000, 1892, 10, 34); g.fillRect(980, 1922, 50, 8)
      g.restore()
    }
  })
  def("tenz_amp", {
    light: { x: 100, y: 130, r: 180, color: '#ff9a50', flicker: 'screen' },
    clickable: true, say: '开到最大，经堂那头听不见才对',
    name: "音箱", cat: "摇滚", tags: ["音箱","摇滚"],
    scope: "character", fromRoom: 'tenz',
    w: 202, h: 270, base: 180, foot: [0, 172, 200, 8], zLayer: 'sort',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-1086, -950)
  g.fillStyle = '#241a12'; g.fillRect(1086, 950, 200, 180)
  g.fillStyle = '#3a3028'; g.fillRect(1094, 958, 184, 60)
  g.fillStyle = '#e8b23d'; g.fillRect(1102, 966, 70, 12)
  g.fillStyle = '#1a1410'; g.fillRect(1094, 1026, 184, 96)
  g.fillStyle = '#4a4038'
  for (let k = 0; k < 8; k++) g.fillRect(1100 + k * 22, 1026, 3, 96)
  for (let k = 0; k < 4; k++) g.fillRect(1094, 1034 + k * 22, 184, 3)
  pxC(1106, 1012, 7, '#8a8578'); pxC(1266, 1012, 7, '#8a8578')
  g.fillStyle = '#e858a0'; g.fillRect(1094, 1122, 184, 6)
  glow(1186, 1128, 90, 'rgba(232,88,160,0.22)')
      g.restore()
    }
  })
  def("tenz_guitar", {
    clickable: true, say: '骚粉的，师兄看了要还俗',
    name: "电吉他", cat: "摇滚", tags: ["电吉他","立架","粉"],
    scope: "character", fromRoom: 'tenz',
    w: 222, h: 282, base: 274, foot: [54, 266, 118, 10], zLayer: 'sort',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-1258, -900)
  g.fillStyle = '#241a12'
  g.beginPath(); g.moveTo(1352, 1044); g.lineTo(1322, 1170); g.lineTo(1338, 1170); g.lineTo(1364, 1052); g.fill()
  g.beginPath(); g.moveTo(1390, 1044); g.lineTo(1420, 1170); g.lineTo(1404, 1170); g.lineTo(1378, 1052); g.fill()
  g.fillRect(1312, 1162, 118, 12)
  // 琴身(双瓣 · 粗黑描边)
  pxE(1368, 1078, 52, 60, '#0e0a08')
  pxE(1394, 1024, 36, 40, '#0e0a08')
  pxE(1368, 1078, 44, 52, '#e858a0')
  pxE(1394, 1024, 28, 32, '#e858a0')
  pxE(1352, 1062, 20, 28, '#ff8ac0')
  // 琴颈 + 琴头(粉头 · 白弦钮)
  g.fillStyle = '#241a12'; g.fillRect(1362, 936, 16, 100)
  g.fillStyle = '#e858a0'; g.fillRect(1352, 900, 38, 40)
  g.fillStyle = '#0e0a08'; g.fillRect(1352, 900, 38, 5)
  g.fillStyle = '#ece4d0'
  for (let k = 0; k < 3; k++) { g.fillRect(1344, 908 + k * 11, 7, 6); g.fillRect(1391, 908 + k * 11, 7, 6) }
  // 弦 + 拾音器 + 旋钮
  g.fillStyle = '#ece4d0'; g.fillRect(1366, 940, 2, 168); g.fillRect(1371, 940, 2, 168); g.fillRect(1376, 940, 2, 168)
  g.fillStyle = '#0e0a08'; g.fillRect(1346, 1058, 46, 12); g.fillRect(1346, 1092, 46, 10)
  pxC(1404, 1104, 7, '#ffd0e8'); pxC(1420, 1090, 6, '#ffd0e8')
  g.fillStyle = '#c8c4bc'; g.fillRect(1410, 1050, 24, 5)
  glow(1368, 1070, 110, 'rgba(232,88,160,0.32)')
      g.restore()
    }
  })
  def("tenz_sunglasses", {
    clickable: true, say: '打鼓的人，得有打鼓的样子',
    name: "墨镜", cat: "摇滚", tags: ["墨镜"],
    scope: "generic", fromRoom: 'tenz',
    w: 78, h: 14, base: 12, foot: [0, 4, 76, 8], zLayer: 'low',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-1142, -936)
  g.fillStyle = '#241a12'
  g.fillRect(1150, 936, 26, 12); g.fillRect(1184, 936, 26, 12); g.fillRect(1176, 940, 8, 4)
  g.fillRect(1142, 938, 8, 4); g.fillRect(1210, 938, 8, 4)
      g.restore()
    }
  })
  def("tenz_drumkit", {
    light: { x: 186, y: 150, r: 220, color: '#ffb060', flicker: 0.2 },
    clickable: true, say: '哦耶——今晚有摇滚法会！', sayDeep: '打鼓的时候心是静的，这话我没跟寺里说过',
    name: "架子鼓", cat: "摇滚", tags: ["架子鼓","黑鼓毯","粉"],
    scope: "character", fromRoom: 'tenz',
    w: 372, h: 304, base: 288, foot: [12, 0, 354, 288], zLayer: 'sort',
    fx(g, t, X, Y) {
      const ph = (t / 1400) % 1, al = 0.5 * Math.sin(ph * Math.PI)
      if (al <= 0.02) return
      g.fillStyle = 'rgba(255,250,230,' + al.toFixed(3) + ')'
      g.fillRect(X + 260 + ph * 60, Y + 30, 4, 24)
    },
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-1066, -1338)
  g.fillStyle = '#100c08'; g.fillRect(1078, 1338, 354, 288)
  g.fillStyle = '#221812'; g.fillRect(1086, 1346, 338, 272)
  g.fillStyle = '#e858a0'; g.fillRect(1086, 1346, 338, 5)
  // hi-hat(左上 · 双片金镲)
  g.fillStyle = '#4a4540'; g.fillRect(1106, 1368, 8, 90)
  pxE(1110, 1366, 44, 10, '#0e0a08')
  pxE(1110, 1362, 40, 8, '#ffd76a')
  pxE(1110, 1352, 40, 8, '#e8b23d')
  // crash(右上)
  g.fillStyle = '#4a4540'; g.fillRect(1392, 1380, 8, 120)
  pxE(1396, 1376, 40, 10, '#0e0a08')
  pxE(1396, 1372, 36, 8, '#ffd76a')
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(1378, 1368, 18, 3)
  // 嗵鼓×2(粉桶 · 白顶面)
  for (const [tx2, ty2, tr] of [[1200, 1400, 40], [1302, 1394, 44]]) {
    pxE(tx2, ty2 + 30, tr + 6, 18, '#0e0a08')
    g.fillStyle = '#0e0a08'; g.fillRect(tx2 - tr - 3, ty2 - 3, tr * 2 + 6, 52)
    g.fillStyle = '#e858a0'; g.fillRect(tx2 - tr, ty2, tr * 2, 46)
    g.fillStyle = '#ff8ac0'; g.fillRect(tx2 - tr + 6, ty2, 16, 46)
    pxE(tx2, ty2, tr + 2, 15, '#0e0a08')
    pxE(tx2, ty2 - 2, tr - 2, 11, '#ffffff')
  }
  // 底鼓(大正圆 · 白皮粉圈黑边 + 金鼓耳)
  pxC(1280, 1512, 96, '#0e0a08')
  pxC(1280, 1512, 88, '#e858a0')
  pxC(1280, 1512, 64, '#f6f2ea')
  pxC(1280, 1512, 56, '#ffffff')
  g.fillStyle = '#c04080'; g.fillRect(1250, 1500, 60, 24)
  for (let k = 0; k < 8; k++) {
    const ka = k / 8 * 6.283
    g.fillStyle = '#e8b23d'
    g.fillRect(1280 + Math.cos(ka) * 92 - 5, 1512 + Math.sin(ka) * 92 - 5, 10, 10)
  }
  g.fillStyle = '#4a4540'; g.fillRect(1196, 1596, 22, 16); g.fillRect(1346, 1596, 22, 16)
  // 军鼓(左中 · 白桶粉带 + 鼓棒×2)
  g.fillStyle = '#0e0a08'; g.fillRect(1088, 1478, 96, 42)
  g.fillStyle = '#f6f2ea'; g.fillRect(1092, 1482, 88, 34)
  g.fillStyle = '#e858a0'; g.fillRect(1092, 1494, 88, 7)
  pxE(1136, 1478, 48, 14, '#0e0a08')
  pxE(1136, 1476, 44, 11, '#ffffff')
  g.fillStyle = '#4a4540'; g.fillRect(1130, 1520, 10, 84); g.fillRect(1102, 1600, 66, 8)
  g.fillStyle = '#d8b878'
  g.fillRect(1098, 1460, 64, 6); g.fillRect(1112, 1448, 64, 6)
  glow(1255, 1490, 150, 'rgba(232,88,160,0.16)')
      g.restore()
    }
  })
  def("tenz_tea", {
    clickable: true, say: '酥油茶，一碗压不住',
    name: "茶角", cat: "藏味", tags: ["酥油茶","茶桶","糌粑"],
    scope: "character", fromRoom: 'tenz',
    w: 310, h: 212, base: 210, foot: [0, 42, 308, 168], zLayer: 'low',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-1124, -1654)
  g.fillStyle = '#5a3a24'; g.fillRect(1124, 1696, 220, 140)
  g.fillStyle = '#6a4a30'; g.fillRect(1124, 1696, 220, 14)
  pxE(1190, 1684, 30, 22, '#c9a26a')
  g.fillStyle = '#8a6a30'; g.fillRect(1216, 1664, 18, 8); g.fillRect(1176, 1654, 28, 6)
  pxE(1190, 1664, 12, 5, '#8a6a30')
  pxE(1268, 1720, 18, 9, '#7a5a3c'); pxE(1268, 1716, 14, 6, '#48301c')
  pxE(1310, 1726, 18, 9, '#7a5a3c'); pxE(1310, 1722, 14, 6, '#48301c')
  pxE(1170, 1756, 24, 11, '#7a5a3c')
  pxC(1170, 1744, 14, '#d8c8a0')
  g.fillStyle = '#6a4a30'; g.fillRect(1376, 1706, 56, 158)
  g.fillStyle = '#7a5a3c'; g.fillRect(1382, 1706, 14, 158)
  g.fillStyle = '#c9a26a'
  g.fillRect(1376, 1726, 56, 8); g.fillRect(1376, 1786, 56, 8); g.fillRect(1376, 1842, 56, 8)
  g.fillStyle = '#48301c'; g.fillRect(1398, 1656, 10, 56); pxE(1403, 1654, 14, 5, '#5a3a24')
      g.restore()
    }
  })
    def("tenz_counter", {
    clickable: true, say: '别问练到第几式',
    sayDeep: '差最后几式，怎么练完我清楚——就是练完了，得回去说',
    name: "一百零八式记数牌", cat: "器械", tags: ["木","记数","核心"],
    scope: "character", fromRoom: 'tenz',
    w: 140, h: 180, base: 176, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const bx = (a,b,c,d,e,f) => PRIM.bx(g, a,b,c,d,e,f)
      g.save(); g.scale(0.5, 0.5)
      // 木牌 + 框
      bx(4, 4, 132, 172, '#3a2c20', '#8a6844')
      g.fillStyle = '#6e5236'; g.fillRect(12, 12, 116, 26)      // 标题槽
      // 标题槽里两个金点（"108"的暗示，不写字）
      g.fillStyle = '#e8b23d'; g.fillRect(24, 22, 8, 8); g.fillRect(40, 22, 8, 8); g.fillRect(56, 22, 8, 8)
      // 108 道刻痕：6 行 × 18；前 103 划掉（暗铜），末 5 未划（亮金）
      let n = 0
      for (let r = 0; r < 6; r++)
        for (let c = 0; c < 18; c++) {
          const x = 16 + c * 6, y = 48 + r * 20
          const done = n < 103
          g.fillStyle = done ? '#5a4632' : '#ffd76a'   // 划掉=暗 / 未划=亮金
          g.fillRect(x, y, 3, 14)
          if (done) { g.fillStyle = '#8a3a2c'; g.fillRect(x - 1, y + 6, 5, 2) }  // 划掉的横杠
          n++
        }
      // 红游标停在第 103 道（差最后 5）
      g.fillStyle = '#c04838'; g.fillRect(16 + 12 * 6 - 2, 88, 8, 20)
      g.fillStyle = '#e0485f'; g.fillRect(16 + 12 * 6 - 1, 90, 6, 6)
      g.restore()
    }
  })
  // ═══ 欠账补充:供奉 × 藏味 × 硬汉 × 摇滚(第二批 21 件)═══
  def("tenz_poster", {
    clickable: true, say: '骚是骚了点，撕不下手',
    name: "摇滚海报", cat: "墙面", tags: ["纸","摇滚","爱好"],
    scope: "character", fromRoom: 'tenz',
    w: 116, h: 252, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5); g.translate(-920, -138)
  g.fillStyle = '#241a12'; g.fillRect(920, 138, 116, 252)
  g.fillStyle = '#e858a0'; g.fillRect(928, 146, 100, 236)
  g.fillStyle = '#241a12'
  g.beginPath(); g.moveTo(966, 170); g.lineTo(994, 218); g.lineTo(974, 218); g.lineTo(1002, 274); g.lineTo(958, 226); g.lineTo(978, 226); g.fill()
  g.fillStyle = '#ffd0e8'
  g.fillRect(938, 300, 80, 14); g.fillRect(950, 324, 56, 10)
  g.fillStyle = '#241a12'; g.fillRect(938, 348, 34, 8); g.fillRect(986, 348, 34, 8)
      g.restore()
    }
  })
  def("tenz_seven_bowls", { patina: true,
    clickable: true, say: '七碗水天天换，这个我没落下',
    name: "七供水碗条案", cat: "供奉", tags: ["藏传","供水","条案"],
    scope: "character", fromRoom: 'tenz',
    w: 322, h: 48, base: 48, foot: [0, 0, 322, 48], zLayer: 'low',
    draw(g) {
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-560, -608)
  g.fillStyle = '#5a3a24'; g.fillRect(560, 608, 322, 48)
  g.fillStyle = '#6a4a30'; g.fillRect(560, 608, 322, 10)
  for (let k = 0; k < 7; k++) {
    const wx3 = 590 + k * 40
    pxE(wx3, 616, 15, 7, '#c9a26a')
    pxE(wx3, 613, 11, 4, '#8ac8e8')
  }
      g.restore()
    }
  })
  def("tenz_kneel_mat", {
    walkable: true,
    clickable: true, say: '跪下来，人就静了',
    name: "跪垫", cat: "供奉", tags: ["红金","布","跪拜"],
    scope: "character", fromRoom: 'tenz',
    w: 240, h: 64, base: 64, foot: [0, 0, 240, 64], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5); g.translate(-600, -680)
  g.fillStyle = '#722630'; g.fillRect(600, 680, 240, 64)
  g.fillStyle = '#8a3038'; g.fillRect(608, 688, 224, 48)
  g.fillStyle = '#e8b23d'; g.fillRect(608, 688, 224, 5); g.fillRect(608, 731, 224, 5)
      g.restore()
    }
  })
  def("tenz_dharma_wheel", { patina: true,
    clickable: true, say: '转它的人，得先信它',
    name: "法轮", cat: "供奉", tags: ["金","法轮","佛顶"],
    scope: "character", fromRoom: 'tenz',
    w: 52, h: 52, base: 52, foot: [0, 44, 52, 8], zLayer: 'sort',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-694, -40)
  pxC(720, 66, 26, '#c99426')
  pxC(720, 66, 20, '#e8b23d')
  pxC(720, 66, 6, '#c99426')
  g.fillStyle = '#c99426'
  for (let k = 0; k < 4; k++) {
    const wa = k * 0.785
    g.fillRect(720 + Math.cos(wa) * 12 - 2, 66 + Math.sin(wa) * 12 - 2, 4, 4)
    g.fillRect(720 - Math.cos(wa) * 12 - 2, 66 - Math.sin(wa) * 12 - 2, 4, 4)
  }
      g.restore()
    }
  })
  def("tenz_snow_lions", { patina: true,
    clickable: true, say: '让它们守佛龛，我守鼓',
    name: "雪狮×2", cat: "供奉", tags: ["守护","藏传","一对"],
    scope: "character", fromRoom: 'tenz',
    w: 370, h: 59, base: 59, foot: [0, 49, 370, 10], zLayer: 'sort',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-544, -527)
  for (const [sx3, sfl] of [[548, 0], [864, 1]]) {
    pxE(sx3 + 20, 570, 24, 16, '#ece4d0')
    pxC(sx3 + (sfl ? 4 : 36), 548, 14, '#ece4d0')
    g.fillStyle = '#68c0a8'
    pxC(sx3 + (sfl ? 4 : 36), 536, 9, '#68c0a8')
    g.fillRect(sx3 + (sfl ? 14 : 20), 548, 8, 12)
    g.fillStyle = '#241a12'
    g.fillRect(sx3 + (sfl ? 0 : 32), 546, 3, 3); g.fillRect(sx3 + (sfl ? 8 : 40), 546, 3, 3)
    g.fillStyle = '#ece4d0'; g.fillRect(sx3 + (sfl ? 40 : -4), 560, 10, 6)
  }
      g.restore()
    }
  })
  def("tenz_khata_rod", { patina: 'wood',
    clickable: true, say: '白哈达，献给谁都行，就是没献给自己',
    name: "哈达挂杆", cat: "供奉", tags: ["哈达","白","挂杆"],
    scope: "character", fromRoom: 'tenz',
    w: 182, h: 124, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5); g.translate(-376, -448)
  g.fillStyle = '#48301c'; g.fillRect(376, 448, 182, 8)
  for (const hx5 of [396, 452, 508]) {
    g.fillStyle = '#ece4d0'
    g.fillRect(hx5, 456, 14, 116)
    g.fillRect(hx5 + 14, 456, 8, 90)
    g.fillStyle = '#d8ccb4'; g.fillRect(hx5 + 4, 456, 4, 116)
  }
      g.restore()
    }
  })
  def("tenz_butter_flower", { patina: true,
    clickable: true, say: '供佛的手艺，我到今天还留着',
    name: "酥油花树", cat: "供奉", tags: ["酥油花","塔供","彩色"],
    scope: "character", fromRoom: 'tenz',
    w: 56, h: 118, base: 118, foot: [0, 108, 56, 10], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5); g.translate(-958, -404)
  g.fillStyle = '#c99426'; g.fillRect(976, 500, 20, 22)
  for (let k = 0; k < 4; k++) {
    g.fillStyle = ['#c83828', '#e8b23d', '#3868b8', '#e88aa0'][k]
    const tw3 = 56 - k * 12
    g.fillRect(986 - tw3 / 2, 488 - k * 18, tw3, 16)
  }
  g.fillStyle = '#ece4d0'
  g.beginPath(); g.moveTo(980, 424); g.lineTo(986, 404); g.lineTo(992, 424); g.fill()
      g.restore()
    }
  })
  def("tenz_vajra_knots", { patina: true,
    clickable: true, say: '结打得再牢，也系不住走的人',
    name: "金刚结×2", cat: "供奉", tags: ["金刚结","护符","一对"],
    scope: "character", fromRoom: 'tenz',
    w: 32, h: 142, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5); g.translate(-1350, -138)
  for (const gy3 of [150, 230]) {
    g.fillStyle = '#241a12'; g.fillRect(1364, gy3 - 12, 4, 12)
    g.fillStyle = '#c83828'
    g.beginPath(); g.moveTo(1366, gy3); g.lineTo(1382, gy3 + 18); g.lineTo(1366, gy3 + 36); g.lineTo(1350, gy3 + 18); g.fill()
    g.fillStyle = '#e8b23d'
    g.beginPath(); g.moveTo(1366, gy3 + 8); g.lineTo(1376, gy3 + 18); g.lineTo(1366, gy3 + 28); g.lineTo(1356, gy3 + 18); g.fill()
    g.fillStyle = '#c83828'; g.fillRect(1362, gy3 + 36, 4, 14); g.fillRect(1368, gy3 + 36, 4, 14)
  }
      g.restore()
    }
  })
  def("tenz_stand_drum", {
    clickable: true, say: '这鼓我还擂得响，经嘛……',
    name: "立式法鼓", cat: "供奉", tags: ["法鼓","长柄","立式"],
    scope: "character", fromRoom: 'tenz',
    w: 161, h: 192, base: 192, foot: [10, 180, 146, 12], zLayer: 'sort',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-46, -1180)
  g.fillStyle = '#48301c'
  g.fillRect(56, 1360, 100, 12); g.fillRect(98, 1180, 12, 190)
  pxC(104, 1258, 58, '#241a12')
  pxC(104, 1258, 52, '#8a3038')
  pxC(104, 1258, 42, '#c9a26a')
  g.fillStyle = '#e8b23d'
  for (let k = 0; k < 6; k++) {
    const da = k * 1.047
    g.fillRect(104 + Math.cos(da) * 47 - 3, 1258 + Math.sin(da) * 47 - 3, 6, 6)
  }
  g.fillStyle = '#6a4a30'; g.fillRect(150, 1300, 46, 8); pxC(198, 1304, 9, '#ece4d0')
      g.restore()
    }
  })
  def("tenz_mic_stand", {
    clickable: true, say: '吼一嗓子，比念一卷经痛快',
    name: "麦克风架", cat: "摇滚", tags: ["麦克风","三脚架","摇滚"],
    scope: "character", fromRoom: 'tenz',
    w: 58, h: 192, base: 192, foot: [0, 168, 58, 24], zLayer: 'sort',
    draw(g) {
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-1038, -1142)
  g.fillStyle = '#241a12'
  g.fillRect(1064, 1180, 8, 138)
  g.beginPath(); g.moveTo(1068, 1310); g.lineTo(1038, 1330); g.lineTo(1048, 1334); g.lineTo(1070, 1318); g.fill()
  g.beginPath(); g.moveTo(1068, 1310); g.lineTo(1096, 1330); g.lineTo(1086, 1334); g.lineTo(1066, 1318); g.fill()
  g.fillStyle = '#3a3028'; g.fillRect(1058, 1156, 20, 30)
  pxE(1068, 1152, 14, 10, '#4a4038')
  g.fillStyle = '#e858a0'; g.fillRect(1060, 1176, 16, 5)
      g.restore()
    }
  })
  def("tenz_kettlebells", {
    clickable: true, say: '甩起来，肩比钟还沉',
    name: "壶铃×2", cat: "器械", tags: ["壶铃","力量","一对"],
    scope: "character", fromRoom: 'tenz',
    w: 98, h: 58, base: 58, foot: [0, 48, 98, 10], zLayer: 'low',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-692, -772)
  for (const [kx2, kr] of [[716, 24], [772, 18]]) {
    pxC(kx2, 806, kr, '#3a3634')
    pxC(kx2 - 6, 800, kr - 10, '#4a4540')
    g.fillStyle = '#241a12'
    g.fillRect(kx2 - 14, 772, 28, 8); g.fillRect(kx2 - 14, 772, 8, 16); g.fillRect(kx2 + 6, 772, 8, 16)
  }
      g.restore()
    }
  })
  def("tenz_dice_tray", {
    clickable: true, say: '骰子问吉凶？我信手上的劲',
    name: "骰卦盘", cat: "藏味", tags: ["sho","骰卦","小毯"],
    scope: "character", fromRoom: 'tenz',
    w: 140, h: 78, base: 78, foot: [0, 0, 140, 78], zLayer: 'low',
    draw(g) {
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-916, -1256)
  g.fillStyle = '#722630'; g.fillRect(916, 1256, 140, 78)
  g.fillStyle = '#8a3038'; g.fillRect(924, 1264, 124, 62)
  pxE(960, 1296, 26, 14, '#6a4a30')
  pxE(960, 1290, 21, 10, '#48301c')
  for (const [dx2, dy2] of [[996, 1284], [1016, 1296], [1002, 1308]]) {
    g.fillStyle = '#ece4d0'; g.fillRect(dx2, dy2, 16, 16)
    g.fillStyle = '#241a12'; g.fillRect(dx2 + 4, dy2 + 4, 4, 4); g.fillRect(dx2 + 10, dy2 + 9, 4, 4)
  }
      g.restore()
    }
  })
  def("tenz_gau_boxes", { patina: true,
    clickable: true, say: '护身的盒子，里头空了',
    name: "嘎乌盒×2", cat: "供奉", tags: ["嘎乌","护身","一对"],
    scope: "character", fromRoom: 'tenz',
    w: 30, h: 128, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-58, -138)
  for (const gy2 of [150, 230]) {
    g.fillStyle = '#241a12'; g.fillRect(70, gy2 - 12, 4, 14)
    g.fillStyle = '#e8b23d'; g.fillRect(58, gy2, 30, 36)
    g.fillStyle = '#c99426'; g.fillRect(64, gy2 + 6, 18, 24)
    pxC(73, gy2 + 18, 6, '#c83828')
  }
      g.restore()
    }
  })
  def("tenz_hand_wheel", { patina: true,
    clickable: true, say: '转着转着，就忘了在求什么',
    name: "手持转经轮", cat: "藏味", tags: ["转经轮","手持","法器"],
    scope: "character", fromRoom: 'tenz',
    w: 38, h: 72, base: 72, foot: [0, 62, 38, 10], zLayer: 'low',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-1232, -1684)
  g.fillStyle = '#48301c'; g.fillRect(1246, 1716, 8, 40)
  g.fillStyle = '#c9a26a'; g.fillRect(1232, 1700, 36, 22)
  g.fillStyle = '#e8b23d'; g.fillRect(1238, 1704, 10, 14)
  g.fillStyle = '#8a6a30'; g.fillRect(1264, 1690, 3, 14); pxC(1266, 1688, 4, '#c83828')
      g.restore()
    }
  })
  def("tenz_protein", {
    clickable: true, say: '这一勺，顶三碗糌粑',
    name: "蛋白粉罐", cat: "器械", tags: ["蛋白粉","补给","硬汉"],
    scope: "character", fromRoom: 'tenz',
    w: 66, h: 84, base: 84, foot: [0, 74, 66, 10], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5); g.translate(-620, -748)
  g.fillStyle = '#ece4d0'; g.fillRect(620, 756, 66, 76)
  g.fillStyle = '#e8b23d'; g.fillRect(620, 748, 66, 14)
  g.fillStyle = '#c83828'; g.fillRect(628, 776, 50, 30)
  g.fillStyle = '#ece4d0'; g.fillRect(636, 784, 34, 6); g.fillRect(636, 794, 24, 5)
      g.restore()
    }
  })
  def("tenz_trophies", {
    clickable: true, say: '打回来的，比供出去的实在',
    name: "奖杯×2", cat: "器械", tags: ["奖杯","武术","一对"],
    scope: "character", fromRoom: 'tenz',
    w: 78, h: 68, base: 68, foot: [0, 58, 78, 10], zLayer: 'low',
    draw(g) {
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-198, -1528)
  for (const [tx3, th] of [[216, 46], [258, 34]]) {
    g.fillStyle = '#e8b23d'
    pxE(tx3, 1586 - th, 16, 12, '#e8b23d')
    g.fillRect(tx3 - 4, 1586 - th, 8, th)
    g.fillRect(tx3 - 14, 1588, 28, 8)
    g.fillStyle = '#c99426'; g.fillRect(tx3 - 18, 1580 - th, 8, 10); g.fillRect(tx3 + 10, 1580 - th, 8, 10)
  }
      g.restore()
    }
  })
  def("tenz_pedals", {
    clickable: true, say: '踩一脚，声浪能掀屋顶',
    name: "效果器踏板×3", cat: "摇滚", tags: ["效果器","踏板","摇滚"],
    scope: "character", fromRoom: 'tenz',
    w: 212, h: 54, base: 54, foot: [0, 18, 210, 36], zLayer: 'low',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-1100, -1122)
  for (let k = 0; k < 3; k++) {
    const ex2 = 1100 + k * 66
    g.fillStyle = '#241a12'; g.fillRect(ex2, 1140, 52, 34)
    g.fillStyle = ['#c83828', '#3868b8', '#e858a0'][k]; g.fillRect(ex2 + 4, 1144, 44, 22)
    pxC(ex2 + 26, 1152, 6, '#ece4d0')
  }
  g.strokeStyle = '#241a12'; g.lineWidth = 4
  g.beginPath(); g.moveTo(1126, 1140); g.quadraticCurveTo(1150, 1120, 1186, 1136); g.stroke()
  g.beginPath(); g.moveTo(1252, 1136); g.quadraticCurveTo(1290, 1150, 1310, 1132); g.stroke()
      g.restore()
    }
  })
  def("tenz_pick_jar", {
    clickable: true, say: '拨片比念珠顺手',
    name: "拨片罐", cat: "摇滚", tags: ["拨片","罐","摇滚"],
    scope: "character", fromRoom: 'tenz',
    w: 26, h: 26, base: 26, foot: [0, 16, 26, 10], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5); g.translate(-1236, -924)
  g.fillStyle = 'rgba(230,225,215,0.8)'; g.fillRect(1236, 924, 26, 26)
  g.fillStyle = '#e858a0'
  g.beginPath(); g.moveTo(1242, 932); g.lineTo(1254, 932); g.lineTo(1248, 944); g.fill()
      g.restore()
    }
  })
  def("tenz_wrist_guards", {
    clickable: true, say: '缠紧了，拳头才敢豁出去',
    name: "护腕×2", cat: "器械", tags: ["护腕","缠手","一对"],
    scope: "character", fromRoom: 'tenz',
    w: 68, h: 24, base: 24, foot: [0, 14, 68, 10], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5); g.translate(-146, -1682)
  g.fillStyle = '#241a12'
  g.fillRect(146, 1682, 30, 18); g.fillRect(184, 1688, 30, 18)
  g.fillStyle = '#c83828'; g.fillRect(146, 1688, 30, 5); g.fillRect(184, 1694, 30, 5)
      g.restore()
    }
  })
  def("tenz_bandage", {
    clickable: true, say: '血是血，缠上接着打',
    name: "绷带卷", cat: "器械", tags: ["绷带","护具","硬汉"],
    scope: "character", fromRoom: 'tenz',
    w: 24, h: 24, base: 24, foot: [0, 14, 24, 10], zLayer: 'low',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-454, -640)
  pxC(466, 652, 12, '#ece4d0'); pxC(466, 652, 5, '#d8ccb4')
      g.restore()
    }
  })
  def("tenz_barley", {
    clickable: true, say: '喂牦牛的，也喂我，别嫌',
    name: "青稞捆", cat: "藏味", tags: ["青稞","牦牛粮","捆"],
    scope: "character", fromRoom: 'tenz',
    w: 58, h: 92, base: 92, foot: [0, 60, 58, 32], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5); g.translate(-1176, -2188)
  g.fillStyle = '#c8a850'
  for (let k = 0; k < 5; k++) g.fillRect(1180 + k * 10, 2210 - (k % 2) * 8, 7, 70)
  g.fillStyle = '#8a6a30'; g.fillRect(1176, 2242, 58, 10)
  g.fillStyle = '#e8d890'
  for (let k = 0; k < 5; k++) g.fillRect(1180 + k * 10, 2196 - (k % 2) * 8, 7, 16)
      g.restore()
    }
  })
    def("tenz_cape", {
    clickable: true, say: '下次法会，就穿这个去',
    sayDeep: '怪盗基德……别笑，摇滚和尚也能有偶像',
    name: "基德披风", cat: "杂物", tags: ["cosplay","白披风","彩蛋"],
    scope: "character", fromRoom: 'tenz',
    w: 170, h: 310, base: 300, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.lineCap = 'round'
      // 木衣架
      g.strokeStyle = '#8a6844'; g.lineWidth = 6
      g.beginPath(); g.arc(85, 40, 11, Math.PI * 0.25, Math.PI * 1.7); g.stroke()
      g.strokeStyle = '#6e5236'; g.lineWidth = 6
      g.beginPath(); g.moveTo(85, 51); g.lineTo(85, 80); g.stroke()
      g.fillStyle = '#6e5236'
      g.beginPath(); g.moveTo(85, 78); g.lineTo(28, 100); g.lineTo(32, 108); g.lineTo(85, 88); g.lineTo(138, 108); g.lineTo(142, 100); g.closePath(); g.fill()
      g.fillStyle = '#5a4028'; g.fillRect(24, 96, 12, 14); g.fillRect(134, 96, 12, 14)
      // 静态披风身（可点命中区）—— fx 在其上叠摆动
      g.fillStyle = '#e8e8ee'
      g.beginPath(); g.moveTo(34, 90); g.lineTo(134, 90); g.lineTo(154, 300); g.lineTo(14, 300); g.closePath(); g.fill()
      g.fillStyle = '#d8d8e2'; g.fillRect(14, 296, 140, 8)   // 下摆
      // 领口 + 领结
      g.fillStyle = '#4a78c0'; g.fillRect(84, 90, 20, 60)
      g.fillStyle = '#c83828'; g.fillRect(90, 94, 8, 48)
      // 礼帽 + 单片眼镜
      g.fillStyle = '#f4f4f8'; g.fillRect(66, 6, 56, 40); g.fillRect(50, 42, 88, 10)
      g.fillStyle = '#4a78c0'; g.fillRect(66, 30, 56, 12)
      g.strokeStyle = '#e8b23d'; g.lineWidth = 3
      g.beginPath(); g.arc(132, 76, 13, 0, 7); g.stroke()
      g.restore()
    },
    fx(g, t, X, Y) {
      // 怪盗基德:随风摆的白披风 + 领结 + 礼帽 + 单片眼镜。dx=40 dy=710
      const DX = X - 40, DY = Y - 710
      const CX = 124 + DX, TOPY = 800 + DY, BOTY = 1010 + DY, H = 210
      for (let k = 0; k < H; k++) {
        const yy = TOPY + k, f = k / H
        const off = Math.sin(t / 700 + f * 2.4) * (2 + f * f * 16) + Math.sin(t / 260 + f * 5.0) * (f * f * 4)
        const halfW = 50 + f * 20, x0 = CX - halfW + off * (0.5 + f * 0.6), w = halfW * 2
        g.fillStyle = '#e8e8ee'; g.fillRect(x0, yy, w, 1)
        g.fillStyle = '#d0d0da'; g.fillRect(x0, yy, 10, 1)
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x0 + w - 8, yy, 5, 1)
        const w1 = x0 + w * 0.34 + Math.sin(t / 620 + f * 3.2) * (f * 8)
        const w2 = x0 + w * 0.66 + Math.sin(t / 540 + f * 2.6 + 1.7) * (f * 7)
        g.fillStyle = 'rgba(150,150,166,0.35)'; g.fillRect(w1, yy, 3, 1); g.fillRect(w2, yy, 3, 1)
      }
      for (let k = 0; k < 12; k++) {
        const sway = Math.sin(t / 700 + 2.4) * 18 + Math.sin(t / 260 + 5) * 4
        const x0 = CX - 70 + sway * 1.1, seg = 140 / 12, dip = 3 + Math.sin(t / 300 + k * 0.9) * 3
        g.fillStyle = '#e0e0e8'; g.fillRect(x0 + k * seg, BOTY, seg - 1, dip)
      }
      g.fillStyle = '#f4f4f8'
      g.beginPath(); g.moveTo(102+DX, 796+DY); g.lineTo(124+DX, 796+DY); g.lineTo(114+DX, 850+DY); g.fill()
      g.beginPath(); g.moveTo(166+DX, 796+DY); g.lineTo(144+DX, 796+DY); g.lineTo(154+DX, 850+DY); g.fill()
      g.fillStyle = '#4a78c0'; g.fillRect(124+DX, 800+DY, 20, 60)
      g.fillStyle = '#c83828'; g.fillRect(130+DX, 804+DY, 8, 48)
      g.fillStyle = '#f4f4f8'; g.fillRect(106+DX, 716+DY, 56, 40); g.fillRect(90+DX, 752+DY, 88, 10)
      g.fillStyle = '#4a78c0'; g.fillRect(106+DX, 740+DY, 56, 12)
      g.strokeStyle = '#e8b23d'; g.lineWidth = 3
      g.beginPath(); g.arc(172+DX, 786+DY, 13, 0, 7); g.stroke()
      g.fillStyle = '#e8b23d'; g.fillRect(183+DX, 762+DY, 3, 18)
    }
  })
    def("tenz_stone_locks", {
    clickable: true, say: '举的是石头，练的是那口气',
    name: "石锁×2", cat: "器械", tags: ["石","练武"],
    scope: "character", fromRoom: 'tenz', w: 200, h: 116, base: 116, foot: [0, 40, 200, 76], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5); g.translate(-118, -1548)
      g.fillStyle = '#8a8578'; g.fillRect(118, 1572, 82, 56)
      g.fillStyle = '#9a9588'; g.fillRect(118, 1572, 82, 12)
      g.fillStyle = '#6a655a'; g.fillRect(136, 1548, 46, 12); g.fillRect(136, 1548, 10, 28); g.fillRect(172, 1548, 10, 28)
      g.fillStyle = '#8a8578'; g.fillRect(244, 1606, 66, 46)
      g.fillStyle = '#6a655a'; g.fillRect(258, 1588, 38, 10); g.fillRect(258, 1588, 8, 22); g.fillRect(288, 1588, 8, 22)
      g.restore()
    }
  })
  def("tenz_lift_stone", {
    clickable: true, say: '山里的和尚，都这么练',
    name: "举重大圆石", cat: "器械", tags: ["石","练武"],
    scope: "character", fromRoom: 'tenz', w: 76, h: 80, base: 80, foot: [4, 40, 68, 36], zLayer: 'low',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-346, -1556)
      pxC(382, 1592, 36, '#8a8578'); pxC(374, 1584, 30, '#9a9588')
      g.fillStyle = '#6a655a'; g.fillRect(366, 1576, 12, 6); g.fillRect(390, 1596, 10, 5)
      g.restore()
    }
  })
  def("tenz_staff_rack", {
    clickable: true, say: '三根棍长短不一，趁手就行',
    name: "练功棍架", cat: "器械", tags: ["棍","靠墙"],
    scope: "character", fromRoom: 'tenz', w: 152, h: 220, base: 218, foot: [30, 199, 68, 12], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5); g.translate(-118, -700)
      g.fillStyle = '#48301c'; g.fillRect(130, 700, 14, 160); g.fillRect(238, 700, 14, 160)
      g.fillStyle = '#5a3a24'; g.fillRect(120, 700, 142, 12)
      for (let k = 0; k < 3; k++) { g.fillStyle = ['#6a4a30', '#7a5a3c', '#5a3a24'][k]; g.fillRect(148 + k * 30, 712, 9, 200) }
      g.restore()
    }
  })
    def("tenz_cobweb", {
    clickable: true, say: '尘归尘，佛看心不看这些',
    name: "蛛网", cat: "杂物", tags: ["尘","经堂","蒙尘"],
    scope: "generic", fromRoom: 'tenz', w: 60, h: 60, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.strokeStyle = 'rgba(220,220,210,0.4)'; g.lineWidth = 1.5
      // 角落放射蛛网（左上角）
      for (let k = 0; k < 5; k++) {
        const a = k * (Math.PI / 2) / 5
        g.beginPath(); g.moveTo(2, 2); g.lineTo(2 + Math.cos(a) * 110, 2 + Math.sin(a) * 110); g.stroke()
      }
      for (let r = 20; r <= 100; r += 24) {
        g.beginPath()
        for (let k = 0; k <= 5; k++) {
          const a = k * (Math.PI / 2) / 5, x = 2 + Math.cos(a) * r, y = 2 + Math.sin(a) * r
          k ? g.lineTo(x, y) : g.moveTo(x, y)
        }
        g.stroke()
      }
      g.restore()
    }
  })
