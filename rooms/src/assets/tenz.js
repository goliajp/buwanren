
  //<<< POPO ASSETS END

  //>>> TENZ ASSETS BEGIN (extracted from tenzCanvas naked draw)
  def("tenz_window", {
    light: { x: 160, y: 300, r: 260, color: '#bcd4e8', flicker: 0 },
    clickable: true, say: '雪山在那头，我在这头',
    name: "藏窗", cat: "墙面", tags: ["窗","雪山"],
    scope: "character", fromRoom: 'tenz',
    w: 320, h: 632, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      const cx = 240
      g.save(); g.scale(0.5, 0.5); g.translate(-50, -130)
    // 梯形黑框(上宽下窄的藏式窗套)
    g.fillStyle = '#241a12'
    g.beginPath()
    g.moveTo(cx - 128, 130); g.lineTo(cx + 128, 130)
    g.lineTo(cx + 104, 386); g.lineTo(cx - 104, 386)
    g.fill()
    // 窗洞:蓝天
    g.fillStyle = '#88b8e0'; g.fillRect(cx - 88, 158, 176, 200)
    // 雪山两座
    g.fillStyle = '#c8d8ea'
    g.beginPath(); g.moveTo(cx - 88, 340); g.lineTo(cx - 30, 210); g.lineTo(cx + 30, 340); g.fill()
    g.beginPath(); g.moveTo(cx - 12, 340); g.lineTo(cx + 52, 238); g.lineTo(cx + 88, 340); g.fill()
    g.fillStyle = '#f2f6fa'
    g.beginPath(); g.moveTo(cx - 52, 260); g.lineTo(cx - 30, 210); g.lineTo(cx - 8, 260); g.lineTo(cx - 22, 252); g.lineTo(cx - 36, 262); g.fill()
    g.beginPath(); g.moveTo(cx + 36, 264); g.lineTo(cx + 52, 238); g.lineTo(cx + 70, 268); g.lineTo(cx + 56, 260); g.fill()
    // 云
    g.fillStyle = '#f6fafd'
    g.fillRect(cx - 70, 184, 44, 10); g.fillRect(cx - 60, 176, 24, 8)
    g.fillRect(cx + 28, 200, 36, 9)
    // 草甸接地
    g.fillStyle = '#7aa060'; g.fillRect(cx - 88, 340, 176, 18)
    // 窗棂
    g.fillStyle = '#241a12'
    g.fillRect(cx - 4, 158, 8, 200); g.fillRect(cx - 88, 250, 176, 8)
    // 白檐短帘(藏窗特色小帷)
    g.fillStyle = '#ece4d0'
    for (let k = 0; k < 6; k++) g.fillRect(cx - 120 + k * 42, 130, 34, 22)
    // 日光斜带落进屋
    const lg = g.createLinearGradient(cx, 380, cx - 120, 720)
    lg.addColorStop(0, 'rgba(200,225,255,0.16)'); lg.addColorStop(1, 'rgba(200,225,255,0)')
    g.fillStyle = lg
    g.beginPath()
    g.moveTo(cx - 88, 380); g.lineTo(cx + 88, 380)
    g.lineTo(cx + 10, 760); g.lineTo(cx - 190, 760)
    g.fill()
      g.restore()
    }
  })
  def("tenz_altar", { patina: 'wood',
    light: { x: 181, y: 180, r: 150, color: '#e8b23d', flicker: 0.3 },
    clickable: true, say: '佛祖，我这副样子，您担待', sayDeep: '不是不信，是信得跟他们不一样',
    name: "佛龛", cat: "供奉", tags: ["佛","金顶","嵌墙"],
    scope: "character", fromRoom: 'tenz',
    w: 362, h: 390, base: 0, foot: [0, 0, 0, 0], wall: true,
    fx(g, t, X, Y) {
      // 金佛佛光：脉动金晕 + 金粒上升（核心道具的金光闪闪，place=540,52）
      const f = t / 50   // 近似原 st.frame（丹增 20fps）
      // ① 脉动金晕（提亮：基础 0.34 + 脉动，补偿引擎 L7 分级的压暗）
      const bgw = g.createRadialGradient(X + 180, Y + 192, 20, X + 180, Y + 192, 190)
      bgw.addColorStop(0, 'rgba(255,210,100,' + (0.34 + Math.sin(t / 1000) * 0.14).toFixed(3) + ')')
      bgw.addColorStop(0.5, 'rgba(255,205,90,' + (0.18 + Math.sin(t / 1000) * 0.08).toFixed(3) + ')')
      bgw.addColorStop(1, 'rgba(255,205,90,0)')
      g.fillStyle = bgw; g.fillRect(X - 20, Y - 8, 400, 400)
      // ② 金粒上升
      for (let k = 0; k < 4; k++) {
        const ph = (f * 1.5 + k * 22) % 90
        g.fillStyle = 'rgba(255,215,106,' + (0.8 - ph / 140).toFixed(3) + ')'
        g.fillRect(X + 120 + k * 40 + Math.sin((f + k * 12) / 10) * 8, Y + 328 - ph * 2.6, 7, 7)
      }
      // ③ 星芒×3（十字闪芒张缩 —— 「闪」的关键，之前漏了这层）
      for (let k = 0; k < 3; k++) {
        const ph = (t / 1600 + k * 0.37) % 1
        const ss = Math.sin(ph * Math.PI) * 14
        if (ss <= 1.5) continue
        const sx = X + 180 + [-110, 96, 20][k], sy = Y + 192 + [-60, -90, 120][k]
        const al = (0.95 * Math.sin(ph * Math.PI)).toFixed(3)
        g.fillStyle = 'rgba(255,232,155,' + al + ')'
        g.fillRect(sx - ss, sy - 2, ss * 2, 4)
        g.fillRect(sx - 2, sy - ss, 4, ss * 2)
        g.fillRect(sx - 4, sy - 4, 8, 8)
      }
      // 酥油灯火苗（佛龛前，微弱的暖）
      globalThis.fxFlame(g, X + 150, Y + 356, { t, w: 12, h: 20, seed: 0 })
      globalThis.fxFlame(g, X + 212, Y + 356, { t, w: 12, h: 20, seed: 1.3 })
    },
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-540, -52)
  g.fillStyle = '#48301c'; g.fillRect(552, 96, 336, 344)
  g.fillStyle = '#5a3a24'; g.fillRect(560, 104, 320, 328)
  // 金顶
  g.fillStyle = '#e8b23d'
  g.beginPath(); g.moveTo(540, 104); g.lineTo(720, 52); g.lineTo(900, 104); g.fill()
  g.fillStyle = '#c99426'; g.fillRect(540, 98, 360, 10)
  // 龛内暗红
  g.fillStyle = '#4a1e20'; g.fillRect(584, 128, 272, 288)
  // 背光(金身光背)
  glow(720, 250, 130, 'rgba(255,205,90,0.5)')
  pxC(720, 244, 92, '#c99426')
  pxC(720, 244, 84, '#8a3038')
  // 佛像:释迦牟尼(立体明暗 · 光源左上)
  g.strokeStyle = '#ffd76a'; g.lineWidth = 5
  g.beginPath(); g.arc(720, 190, 50, 0, 7); g.stroke()
  // 莲花座(后排暗瓣 + 前排亮瓣 + 瓣尖高光 + 金台)
  g.fillStyle = '#a84a60'
  for (let k = 0; k < 7; k++) {
    const lx = 648 + k * 22
    g.beginPath(); g.moveTo(lx, 322); g.lineTo(lx + 10, 294); g.lineTo(lx + 20, 322); g.fill()
  }
  g.fillStyle = '#e88aa0'
  for (let k = 0; k < 6; k++) {
    const lx = 660 + k * 22
    g.beginPath(); g.moveTo(lx, 326); g.lineTo(lx + 10, 300); g.lineTo(lx + 20, 326); g.fill()
  }
  g.fillStyle = '#f6c2cc'
  for (let k = 0; k < 6; k++) g.fillRect(668 + k * 22, 306, 4, 10)
  g.fillStyle = '#a87820'; g.fillRect(644, 322, 152, 12)
  g.fillStyle = '#c99426'; g.fillRect(644, 322, 152, 5)
  g.fillStyle = '#e8b23d'; g.fillRect(652, 334, 136, 8)
  g.fillStyle = '#ffd76a'; g.fillRect(652, 334, 60, 3)
  // 盘腿(弧形 · 左亮右暗 · 双膝)
  g.fillStyle = '#c99426'
  g.beginPath(); g.moveTo(646, 320); g.quadraticCurveTo(720, 276, 794, 320); g.fill()
  g.fillStyle = '#e8b23d'
  g.beginPath(); g.moveTo(646, 320); g.quadraticCurveTo(700, 278, 730, 296); g.lineTo(700, 320); g.fill()
  pxE(668, 306, 16, 10, '#f2c14e')
  pxE(776, 308, 14, 9, '#a87820')
  // 躯干(梯形 · 三档明暗)
  g.fillStyle = '#c99426'
  g.beginPath(); g.moveTo(682, 222); g.lineTo(758, 222); g.lineTo(768, 292); g.lineTo(672, 292); g.fill()
  g.fillStyle = '#e8b23d'
  g.beginPath(); g.moveTo(682, 222); g.lineTo(740, 222); g.lineTo(746, 292); g.lineTo(672, 292); g.fill()
  g.fillStyle = '#f2c14e'
  g.beginPath(); g.moveTo(682, 222); g.lineTo(696, 222); g.lineTo(688, 292); g.lineTo(676, 292); g.fill()
  pxC(690, 228, 12, '#e8b23d'); pxC(750, 228, 12, '#c99426')
  // 双臂(垂弧 · 暗线与躯干分离)
  g.fillStyle = '#d8a52e'
  g.fillRect(668, 234, 12, 52); g.fillRect(760, 234, 12, 52)
  g.fillStyle = 'rgba(138,96,32,0.55)'
  g.fillRect(680, 234, 3, 52); g.fillRect(757, 234, 3, 52)
  // 袈裟斜带(红 · 双褶线 + 金缘)
  g.fillStyle = '#8a3038'
  g.beginPath(); g.moveTo(682, 222); g.lineTo(712, 222); g.lineTo(766, 280); g.lineTo(766, 292); g.lineTo(748, 292); g.fill()
  g.strokeStyle = '#6e2028'; g.lineWidth = 3
  g.beginPath(); g.moveTo(694, 226); g.lineTo(744, 278); g.stroke()
  g.beginPath(); g.moveTo(704, 224); g.lineTo(756, 276); g.stroke()
  g.save(); g.translate(712, 219); g.rotate(0.82)
  g.fillStyle = '#e8b23d'; g.fillRect(0, 0, 78, 4)
  g.restore()
  // 禅定印(叠手托钵 · 手部明暗)
  pxE(718, 274, 27, 9, '#d8a878')
  pxE(714, 271, 22, 6, '#e8c890')
  g.fillStyle = '#8a6a30'; g.fillRect(706, 262, 28, 7)
  g.fillStyle = '#c99426'; g.fillRect(706, 262, 28, 3)
  // 颈影
  g.fillStyle = '#c99426'; g.fillRect(706, 216, 28, 8)
  // 头(三层偏移圆 = 球面)
  pxC(720, 192, 32, '#d8a878')
  pxC(714, 186, 28, '#e8c890')
  pxC(708, 180, 15, '#f2d9a8')
  // 长垂耳(左亮右暗 + 耳孔)
  g.fillStyle = '#e8c890'; g.fillRect(684, 186, 8, 28)
  g.fillStyle = '#d8a878'; g.fillRect(748, 186, 8, 28)
  g.fillStyle = '#c8a05e'; g.fillRect(690, 208, 3, 6); g.fillRect(754, 208, 3, 6)
  // 螺发(青蓝球冠 + 顶髻 + 深浅螺点)
  g.fillStyle = '#2a3a5a'
  g.beginPath(); g.arc(720, 184, 33, Math.PI, 0); g.fill()
  g.fillRect(687, 176, 66, 12)
  pxC(720, 148, 12, '#2a3a5a')
  pxC(716, 145, 6, '#3d5074')
  g.fillStyle = '#3d5074'
  for (const [hx4, hy4] of [[700, 168], [716, 162], [732, 168], [708, 176], [726, 176], [740, 174], [696, 178]]) g.fillRect(hx4, hy4, 4, 4)
  g.fillStyle = '#4d6084'
  g.fillRect(704, 164, 4, 4); g.fillRect(712, 158, 4, 4)
  // 白毫 · 垂目 · 鼻影 · 唇
  g.fillStyle = '#f6efdc'; g.fillRect(717, 180, 6, 6)
  g.fillStyle = '#241a12'
  g.fillRect(704, 194, 10, 3); g.fillRect(726, 194, 10, 3)
  g.fillStyle = '#c8a05e'; g.fillRect(717, 198, 6, 6)
  g.fillStyle = '#c06a50'; g.fillRect(714, 210, 12, 3)
  // 哈达(白绸挂龛口)
  g.fillStyle = '#ece4d0'
  g.fillRect(584, 128, 14, 180); g.fillRect(842, 128, 14, 200)
  g.fillRect(584, 300, 20, 12); g.fillRect(836, 320, 20, 12)
  // 帷幔(红)
  g.fillStyle = '#8a3038'
  for (let k = 0; k < 7; k++) g.fillRect(586 + k * 40, 128, 32, 26 + (k % 2) * 10)
      g.restore()
    }
  })
  def("tenz_flags", {
    name: "经幡串", cat: "墙面", tags: ["经幡","五色"],
    scope: "character", fromRoom: 'tenz',
    w: 1234, h: 76, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-104, -56)
  const FLAG = ['#3868b8', '#ece4d0', '#c83828', '#48a048', '#e8b23d']
  function flags(x0, y0, x1, y1) {
    g.strokeStyle = '#8a7a5c'; g.lineWidth = 3
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + 30, x1, y1); g.stroke()
    for (let k = 0; k < 6; k++) {
      const tt = (k + 0.5) / 6
      const fx = x0 + (x1 - x0) * tt
      const fy = (1 - tt) * (1 - tt) * y0 + 2 * (1 - tt) * tt * (Math.max(y0, y1) + 30) + tt * tt * y1
      g.fillStyle = FLAG[k % 5]
      g.beginPath(); g.moveTo(fx - 16, fy); g.lineTo(fx + 16, fy); g.lineTo(fx, fy + 34); g.fill()
      g.fillStyle = 'rgba(36,26,18,0.5)'
      g.fillRect(fx - 6, fy + 8, 12, 2); g.fillRect(fx - 8, fy + 14, 16, 2)
    }
  }
  flags(104, 60, 540, 78)
  flags(900, 78, 1336, 60)
      g.restore()
    }
  })
  def("tenz_thangka", { patina: true,
    clickable: true, say: '师父的唐卡，褪了色也还是佛',
    name: "唐卡", cat: "墙面", tags: ["唐卡","挂轴"],
    scope: "character", fromRoom: 'tenz',
    w: 118, h: 258, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-404, -138)
  function thangka(x, hue1, hue2) {
    g.fillStyle = '#48301c'; g.fillRect(x, 138, 116, 252)
    g.fillStyle = '#e8b23d'; g.fillRect(x + 4, 142, 108, 12)
    g.fillStyle = hue1; g.fillRect(x + 10, 158, 96, 210)
    g.fillStyle = hue2
    pxC(x + 58, 232, 34, hue2)
    g.fillStyle = '#e8b23d'
    pxC(x + 58, 232, 22, '#e8b23d')
    g.fillStyle = hue1; pxC(x + 58, 232, 12, hue1)
    g.fillStyle = hue2
    g.fillRect(x + 22, 300, 72, 6); g.fillRect(x + 34, 314, 48, 6)
    g.fillStyle = '#48301c'; g.fillRect(x + 50, 368, 16, 26)   // 卷轴轴头
    g.fillRect(x + 2, 386, 112, 8)
  }
  thangka(404, '#2a4a7a', '#c83828')
      g.restore()
    }
  })
  def("tenz_mandala", { patina: true,
    clickable: true, say: '画完就扫，别心疼——无常嘛', sayDeep: '师父说画了再扫是修行，我现在信了',
    name: "坛城沙画", cat: "地面", tags: ["坛城","沙画","平放"],
    scope: "character", fromRoom: 'tenz',
    w: 630, h: 630, base: 0, foot: [0, 0, 0, 0],
    fx(g, t, X, Y, o, room) {
      // 常亮:沙画微光
      for (let k = 0; k < 6; k++) {
        const px = X + 120 + ((k * 397) % 400), py = Y + 120 + ((k * 271) % 400)
        const al = 0.3 * (0.5 + 0.5 * Math.sin(t / 700 + k * 1.3))
        g.fillStyle = 'rgba(255,240,180,' + al.toFixed(3) + ')'
        g.fillRect(px, py, 3, 3)
      }
      // 指点迷津:坛城醒来 —— 藏历时轮的鲜明特效
      if (!(room && room.state && room.state.divining)) return
      const cx = X + 315, cy = Y + 315
      g.save(); g.globalCompositeOperation = 'lighter'
      const breath = 0.5 + 0.5 * Math.sin(t / 420)
      // ① 金晕脉动（整块坛城醒）
      const gr = g.createRadialGradient(cx, cy, 30, cx, cy, 300)
      gr.addColorStop(0, 'rgba(255,214,120,' + (0.16 + 0.12 * breath).toFixed(3) + ')')
      gr.addColorStop(0.55, 'rgba(255,205,90,' + (0.08 + 0.06 * breath).toFixed(3) + ')')
      gr.addColorStop(1, 'rgba(255,205,90,0)')
      g.fillStyle = gr; g.fillRect(cx - 300, cy - 300, 600, 600)
      // ② 外圈旋转法轮光环（12 道金光沿圆周转）
      for (let k = 0; k < 12; k++) {
        const a = t / 2200 + k * (6.283 / 12)
        const al = 0.24 + Math.sin(t / 500 + k * 0.7) * 0.18
        if (al <= 0) continue
        g.fillStyle = 'rgba(255,224,140,' + al.toFixed(3) + ')'
        g.fillRect(cx + Math.cos(a) * 258 - 4, cy + Math.sin(a) * 258 - 4, 9, 9)
      }
      // ③ 内圈一段亮带绕行（说明「阵在走」）
      const head = (t / 1500) % 1
      for (let u = 0; u < 40; u++) {
        const f = u / 40, d = Math.abs(f - head); const dd = Math.min(d, 1 - d)
        const al = Math.max(0, 0.5 - dd * 4)
        if (al <= 0.02) continue
        const a = f * 6.283 - 1.5708
        g.fillStyle = 'rgba(255,244,200,' + al.toFixed(3) + ')'
        g.fillRect(cx + Math.cos(a) * 190 - 3, cy + Math.sin(a) * 190 - 3, 7, 7)
      }
      // ④ 上升金粒（从坛城升起，藏历的「气」）
      for (let k = 0; k < 10; k++) {
        const ph = ((t / 2600 + k * 0.1) % 1)
        const al = 0.5 * (1 - ph) * (ph < 0.12 ? ph / 0.12 : 1)
        if (al <= 0.02) continue
        g.fillStyle = 'rgba(255,228,150,' + al.toFixed(3) + ')'
        g.fillRect(cx - 150 + k * 34 + Math.sin(ph * 5 + k) * 14, cy + 120 - ph * 300, 6, 6)
      }
      g.restore()
    },
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      const rnd = (function (a) { return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      } })(27)
      g.save(); g.scale(0.5, 0.5); g.translate(-406, -836)
  const MX = 720, MY = 1150
  g.fillStyle = '#3a2c20'; g.fillRect(MX - 314, MY - 314, 628, 628)
  g.fillStyle = '#2a1e14'; g.fillRect(MX - 306, MY - 306, 612, 612)
  // 火焰纹环(红金三角齿)
  g.fillStyle = '#e8dcc0'; g.fillRect(MX - 298, MY - 298, 596, 596)
  for (let k = 0; k < 23; k++) {
    const p = -286 + k * 25
    g.fillStyle = k % 2 ? '#c83828' : '#e8b23d'
    g.beginPath(); g.moveTo(MX + p, MY - 298); g.lineTo(MX + p + 12, MY - 270); g.lineTo(MX + p + 24, MY - 298); g.fill()
    g.beginPath(); g.moveTo(MX + p, MY + 298); g.lineTo(MX + p + 12, MY + 270); g.lineTo(MX + p + 24, MY + 298); g.fill()
    g.beginPath(); g.moveTo(MX - 298, MY + p); g.lineTo(MX - 270, MY + p + 12); g.lineTo(MX - 298, MY + p + 24); g.fill()
    g.beginPath(); g.moveTo(MX + 298, MY + p); g.lineTo(MX + 270, MY + p + 12); g.lineTo(MX + 298, MY + p + 24); g.fill()
  }
  // 金刚链环(白底黑珠)
  g.fillStyle = '#e8dcc0'; g.fillRect(MX - 262, MY - 262, 524, 524)
  g.fillStyle = '#3a2c20'
  for (let k = 0; k < 20; k++) {
    const p = -250 + k * 26
    g.fillRect(MX + p, MY - 256, 10, 10); g.fillRect(MX + p, MY + 246, 10, 10)
    g.fillRect(MX - 256, MY + p, 10, 10); g.fillRect(MX + 246, MY + p, 10, 10)
  }
  // 五色条纹框
  const RINGC = ['#ece4d0', '#3868b8', '#c83828', '#48a048', '#e8b23d']
  for (let k = 0; k < 5; k++) {
    const r = 240 - k * 9
    g.fillStyle = RINGC[k]
    g.fillRect(MX - r, MY - r, r * 2, r * 2)
  }
  // 莲瓣环(深红底 · 粉白瓣)
  const LR = 195
  g.fillStyle = '#7a2c26'; g.fillRect(MX - LR, MY - LR, LR * 2, LR * 2)
  for (let k = 0; k < 9; k++) {
    const p = -180 + k * 40
    for (const s of [-1, 1]) {
      g.fillStyle = k % 2 ? '#e88aa0' : '#ece4d0'
      g.beginPath(); g.moveTo(MX + p, MY + s * LR); g.lineTo(MX + p + 20, MY + s * (LR - 26)); g.lineTo(MX + p + 40, MY + s * LR); g.fill()
      g.beginPath(); g.moveTo(MX + s * LR, MY + p); g.lineTo(MX + s * (LR - 26), MY + p + 20); g.lineTo(MX + s * LR, MY + p + 40); g.fill()
    }
  }
  // 城墙(金双线)+ 内庭蓝
  g.fillStyle = '#c99426'; g.fillRect(MX - 160, MY - 160, 320, 320)
  g.fillStyle = '#e8b23d'; g.fillRect(MX - 152, MY - 152, 304, 304)
  g.fillStyle = '#2a4a7a'; g.fillRect(MX - 142, MY - 142, 284, 284)
  g.fillStyle = '#3868b8'; g.fillRect(MX - 134, MY - 134, 268, 268)
  // 内城 45° 双层
  g.fillStyle = '#c83828'
  g.beginPath(); g.moveTo(MX, MY - 118); g.lineTo(MX + 118, MY); g.lineTo(MX, MY + 118); g.lineTo(MX - 118, MY); g.fill()
  g.fillStyle = '#e8b23d'
  g.beginPath(); g.moveTo(MX, MY - 86); g.lineTo(MX + 86, MY); g.lineTo(MX, MY + 86); g.lineTo(MX - 86, MY); g.fill()
  // 八瓣莲心
  for (let k = 0; k < 8; k++) {
    const la = k * 0.785
    pxE(MX + Math.cos(la) * 44, MY + Math.sin(la) * 44, 16, 16, k % 2 ? '#e88aa0' : '#ece4d0')
  }
  pxC(MX, MY, 30, '#c99426')
  pxC(MX, MY, 24, '#e8b23d')
  // 中心金刚杵(横)
  g.fillStyle = '#8a3038'
  g.fillRect(MX - 16, MY - 3, 32, 6)
  pxC(MX - 18, MY, 6, '#8a3038'); pxC(MX + 18, MY, 6, '#8a3038')
  pxC(MX, MY, 5, '#8a3038')
  // 四门 T 形门楼
  for (const [dx3, dy3] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const gx2 = MX + dx3 * 160, gy2 = MY + dy3 * 160
    for (let L = 0; L < 3; L++) {
      const w3 = 76 - L * 20, h3 = 14
      g.fillStyle = ['#c83828', '#e8b23d', '#3868b8'][L]
      if (dy3) g.fillRect(gx2 - w3 / 2, gy2 + dy3 * (L * h3) - (dy3 < 0 ? h3 : 0), w3, h3)
      else g.fillRect(gx2 + dx3 * (L * h3) - (dx3 < 0 ? h3 : 0), gy2 - w3 / 2, h3, w3)
    }
    g.fillStyle = '#2a1e14'
    if (dy3) g.fillRect(gx2 - 10, gy2 - 12, 20, 24)
    else g.fillRect(gx2 - 12, gy2 - 10, 24, 20)
  }
  // 四隅法轮
  for (const [sx4, sy4] of [[-200, -200], [200, -200], [-200, 200], [200, 200]]) {
    pxC(MX + sx4, MY + sy4, 22, '#e8b23d')
    pxC(MX + sx4, MY + sy4, 16, '#7a2c26')
    g.fillStyle = '#e8b23d'
    for (let k = 0; k < 4; k++) {
      const la = k * 0.785
      g.fillRect(MX + sx4 + Math.cos(la) * 10 - 2, MY + sy4 + Math.sin(la) * 10 - 2, 4, 4)
      g.fillRect(MX + sx4 - Math.cos(la) * 10 - 2, MY + sy4 - Math.sin(la) * 10 - 2, 4, 4)
    }
    pxC(MX + sx4, MY + sy4, 4, '#e8b23d')
  }
  // 沙粒噪点
  for (let k = 0; k < 400; k++) {
    const sx = (rnd() - 0.5) * 600, sy = (rnd() - 0.5) * 600
    g.fillStyle = ['#ece4d0', '#c83828', '#e8b23d', '#3868b8', '#48a048'][(rnd() * 5) | 0]
    g.fillRect(MX + sx, MY + sy, 2, 2)
  }
      g.restore()
    }
  })
  def("tenz_offering_table", { patina: 'wood',
    clickable: true, say: '供佛的水糊弄不得，糊弄的是自己',
    name: "供桌", cat: "供奉", tags: ["桌","酥油灯","靠墙"],
    scope: "character", fromRoom: 'tenz',
    w: 288, h: 182, base: 180, foot: [0, 170, 258, 10], zLayer: 'low',
    fx(g, t, X, Y) {
      globalThis.fxSmoke(g, X + 60, Y + 30, { t, n: 3, rise: 90, r: 6, spread: 14, speed: 1, color: '200,196,188', alpha: 0.3 })
    },
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-592, -408)
  g.fillStyle = '#5a3a24'; g.fillRect(592, 460, 258, 128)
  g.fillStyle = '#6a4a30'; g.fillRect(592, 460, 258, 14)
  g.fillStyle = '#8a3038'; g.fillRect(600, 480, 242, 8)
  // 酥油灯×3(铜碗,火苗在动画层)
  for (const lx of [636, 716, 796]) {
    pxE(lx, 470, 18, 9, '#c9a26a')
    pxE(lx, 466, 14, 6, '#8a6a30')
    glow(lx, 452, 44, 'rgba(255,190,80,0.35)')
  }
  // 供果盘(橘子堆)
  pxE(680, 508, 30, 10, '#c9a26a')
  for (const [ox, oy] of [[666, 496], [692, 496], [679, 484]]) pxC(ox, oy, 12, '#e88828')
  g.fillStyle = '#48a048'; g.fillRect(676, 470, 5, 6)
  // 海螺(白)
  pxE(772, 506, 20, 12, '#ece4d0')
  g.fillStyle = '#d8ccb4'; g.fillRect(788, 498, 14, 8)
  g.fillStyle = '#c8b898'; g.fillRect(760, 500, 16, 3)
  // 香炉(铜 · 三足,烟在动画层)
  pxE(852, 560, 26, 14, '#8a6a30')
  pxE(852, 552, 22, 10, '#c9a26a')
  g.fillStyle = '#8a6a30'
  g.fillRect(834, 570, 6, 10); g.fillRect(864, 570, 6, 10)
  g.fillStyle = '#c83828'; g.fillRect(848, 540, 3, 14); g.fillRect(856, 544, 3, 10)
      g.restore()
    }
  })
  def("tenz_prayer_wheels", { patina: true,
    clickable: true, say: '转一圈一句经，手比嘴诚',
    name: "转经筒排", cat: "供奉", tags: ["转经筒","金","靠墙"],
    scope: "character", fromRoom: 'tenz',
    w: 332, h: 152, base: 150, foot: [0, 140, 330, 10], zLayer: 'sort',
    fx(g, t, X, Y) {
      for (let k = 0; k < 5; k++) {
        const gx = X + 22 + k * 64, ph = (t / 900 + k * 0.2) % 1
        const al = 0.3 * Math.sin(ph * Math.PI)
        if (al <= 0.02) continue
        g.fillStyle = 'rgba(255,232,150,' + al.toFixed(3) + ')'
        g.fillRect(gx, Y + 30 + ph * 80, 24, 6)
      }
    },
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-1084, -452)
  g.fillStyle = '#5a3a24'; g.fillRect(1084, 452, 330, 22)
  g.fillStyle = '#5a3a24'; g.fillRect(1084, 580, 330, 22)
  g.fillStyle = '#48301c'; g.fillRect(1092, 452, 10, 150); g.fillRect(1396, 452, 10, 150)
  for (let k = 0; k < 5; k++) {
    const wx = 1112 + k * 60
    g.fillStyle = '#c99426'; g.fillRect(wx, 474, 48, 106)
    g.fillStyle = '#e8b23d'; g.fillRect(wx + 4, 474, 14, 106)
    g.fillStyle = '#8a3038'; g.fillRect(wx, 516, 48, 20)   // 中带红箍(咒文带)
    g.fillStyle = '#e8b23d'; g.fillRect(wx + 20, 452, 8, 22) // 轴
  }
      g.restore()
    }
  })
  def("tenz_cushion", {
    clickable: true, say: '坐得住的时候，我还是坐',
    name: "蒲团", cat: "坐卧", tags: ["布","可坐","打坐"],
    scope: "generic", fromRoom: 'tenz',
    w: 158, h: 102, base: 100, foot: [0, 80, 156, 12], zLayer: 'low', walkable: true, sit: true,
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-642, -932)
  pxE(720, 990, 78, 30, '#722630')
  pxE(720, 982, 70, 24, '#8a3038')
  g.fillStyle = '#e8b23d'
  g.beginPath(); g.arc(720, 982, 48, 0, 7); g.lineWidth = 4; g.strokeStyle = '#e8b23d'; g.stroke()
      g.restore()
    }
  })
  def("tenz_bed", {
    clickable: true, say: '睡硬板，软了拳头就软了',
    name: "木板床", cat: "坐卧", tags: ["床","红毯","可卧"],
    scope: "character", fromRoom: 'tenz',
    w: 342, h: 266, base: 264, foot: [0, 0, 340, 264], zLayer: 'sort',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-1078, -640)
  g.fillStyle = '#5a3a24'; g.fillRect(1078, 640, 340, 264)
  g.fillStyle = '#6a4a30'; g.fillRect(1078, 640, 340, 16)
  g.fillStyle = '#8a3038'; g.fillRect(1090, 668, 316, 200)
  g.fillStyle = '#9a4048'
  for (let k = 0; k < 5; k++) g.fillRect(1090, 690 + k * 38, 316, 8)
  g.fillStyle = '#e8b23d'; g.fillRect(1090, 668, 316, 8)
  // 枕(木枕)
  g.fillStyle = '#6a4a30'; g.fillRect(1108, 690, 74, 34)
  g.fillStyle = '#7a5a3c'; g.fillRect(1108, 690, 74, 8)
  // 叠好的僧袍
  g.fillStyle = '#9a3830'; g.fillRect(1300, 780, 90, 40)
  g.fillStyle = '#7a2c26'; g.fillRect(1300, 796, 90, 6)
  g.fillStyle = '#e8b23d'; g.fillRect(1300, 812, 90, 6)
      g.restore()
    }
  })
  def("tenz_mat", {
    clickable: true, say: '一百零八式，就在这毯上', sayDeep: '差最后几式，练完就得回去，所以我不练',
    name: "训练毯", cat: "地面", tags: ["毯","拼色","平放"],
    scope: "generic", fromRoom: 'tenz',
    w: 370, h: 460, base: 0, foot: [0, 0, 0, 0], walkable: true,
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      const rnd = (function (a) { return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      } })(53)
      g.save(); g.scale(0.5, 0.5); g.translate(-84, -1250)
  g.fillStyle = '#722630'; g.fillRect(84, 1250, 216, 208)
  g.fillStyle = '#8a3038'; g.fillRect(96, 1262, 192, 184)
  g.fillStyle = '#e8b23d'; g.fillRect(96, 1262, 192, 6); g.fillRect(96, 1440, 192, 6)
  g.fillStyle = '#2a4a7a'; g.fillRect(268, 1310, 176, 236)
  g.fillStyle = '#3868b8'; g.fillRect(280, 1322, 152, 212)
  g.fillStyle = '#ece4d0'; g.fillRect(280, 1322, 152, 5); g.fillRect(280, 1529, 152, 5)
  g.fillStyle = '#c04080'; g.fillRect(112, 1478, 208, 190)
  g.fillStyle = '#e858a0'; g.fillRect(124, 1490, 184, 166)
  g.fillStyle = '#ffd0e8'; g.fillRect(124, 1490, 184, 5); g.fillRect(124, 1651, 184, 5)
  g.fillStyle = '#c99426'; g.fillRect(330, 1580, 122, 128)
  g.fillStyle = '#e8b23d'; g.fillRect(338, 1588, 106, 112)
  for (let k = 0; k < 40; k++) {
    g.fillStyle = 'rgba(30,20,10,0.12)'
    g.fillRect(100 + rnd() * 330, 1260 + rnd() * 430, 8, 3)
  }
      g.restore()
    }
  })
  def("tenz_wooden_dummy", {
    clickable: true, say: '它不还手，最好',
    // 被打时转:房间把 state.dummy 置起来,这里按时间取角度帧
    variant(st, t) { return (st && st.dummy) ? ("r" + (((t / 110) | 0) % 6)) : null },
    name: "咏春木人桩", cat: "武术", tags: ["木桩","咏春"],
    scope: "character", fromRoom: 'tenz',
    w: 182, h: 240, base: 238, foot: [26, 196, 130, 22], zLayer: 'sort',
    draw(g, o) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-124, -1242)
  g.fillStyle = '#48301c'; g.fillRect(150, 1440, 130, 18)
  g.fillStyle = '#6a4a30'; g.fillRect(188, 1260, 50, 220)
  g.fillStyle = '#7a5a3c'; g.fillRect(194, 1260, 14, 220)
  pxE(213, 1256, 28, 14, '#6a4a30')
  pxE(213, 1252, 24, 10, '#7a5a3c')
  // ── 三根桩臂 ──
  // 挨打时桩身会转。臂绕主干竖轴旋转,2D 上表现为【水平投影收放 + 过零换边】:
  // 伸长 → 缩短 → 正对观者(只剩端头) → 从另一侧长出来。
  // variant 为空(没人打)时 ang=0,画出来与静止版逐像素一致。
  const _v = (o && o.variant) || ''
  const _ang = (_v ? +_v.slice(1) : 0) * Math.PI / 3
  const ARM_L = 190, ARM_R = 236                 // 臂根:主干左右两侧
  g.fillStyle = '#5a3a24'
  for (const [ay, L0, d0, th] of [[1296, 62, -1, 14], [1316, 62, 1, 14], [1362, 66, -1, 13]]) {
    const c = Math.cos(_ang) * d0
    const L = Math.max(9, L0 * Math.abs(c))      // 正对观者时留个端头,不要凭空消失
    const tipX = c >= 0 ? ARM_R + L - 2 : ARM_L - L   // 右伸时端头圆心回 2px,与静止版原画对齐
    g.fillStyle = '#5a3a24'
    g.fillRect(c >= 0 ? ARM_R : ARM_L - L, ay, L, th)
    pxC(tipX, ay + ((th / 2) | 0), 8, '#48301c')
  }
  g.fillStyle = '#5a3a24'
  g.fillRect(214, 1400, 16, 40); g.fillRect(214, 1432, 56, 14)
  // 粉拳套挂在桩臂上
  pxE(280, 1352, 15, 17, '#e858a0'); pxE(272, 1344, 7, 8, '#c04080')
  g.fillStyle = '#ffd0e8'; g.fillRect(272, 1364, 18, 6)
  // 粉毛巾搭底座
  g.fillStyle = '#ffd0e8'; g.fillRect(236, 1436, 60, 16)
  g.fillStyle = '#e858a0'; g.fillRect(236, 1443, 60, 3)
      g.restore()
    }
  })
  def("tenz_punchbag", {
    clickable: true, say: '气都打给它，它比人经打',
    name: "拳击沙包", cat: "武术", tags: ["沙包","铁链"],
    scope: "character", fromRoom: 'tenz',
    w: 76, h: 342, base: 340, foot: [0, 330, 74, 10], zLayer: 'sort',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-316, -442)
  g.fillStyle = '#8a8578'
  for (let k = 0; k < 9; k++) g.fillRect(348 + (k % 2) * 4, 442 + k * 18, 6, 12)
  g.fillStyle = '#241a12'
  g.beginPath(); g.moveTo(330, 630); g.lineTo(352, 598); g.lineTo(376, 630); g.fill()
  g.fillStyle = '#a82838'; g.fillRect(316, 630, 74, 152)
  g.fillStyle = '#c83848'; g.fillRect(324, 630, 18, 152)
  g.fillStyle = '#ece4d0'; g.fillRect(316, 688, 74, 22)
  g.fillStyle = '#241a12'; g.fillRect(316, 624, 74, 12); g.fillRect(316, 774, 74, 12)
      g.restore()
    }
  })
  def("tenz_speedball", {
    clickable: true, say: '快，比准要紧',
    name: "速度球", cat: "武术", tags: ["速度球","平台"],
    scope: "character", fromRoom: 'tenz',
    w: 98, h: 74, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-392, -660)
  g.fillStyle = '#48301c'; g.fillRect(392, 660, 96, 14)
  g.fillStyle = '#5a3a24'; g.fillRect(430, 674, 14, 10)
  pxE(437, 708, 20, 24, '#a82838')
  pxE(431, 700, 9, 12, '#c83848')
  g.fillStyle = '#8a8578'; g.fillRect(434, 674, 6, 12)
      g.restore()
    }
  })
  def("tenz_dumbbells", {
    clickable: true, say: '一百零八……一百零九……',
    name: "哑铃排", cat: "武术", tags: ["哑铃","缠手带"],
    scope: "generic", fromRoom: 'tenz',
    w: 207, h: 30, base: 28, foot: [0, 8, 205, 20], zLayer: 'low',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-416, -792)
  for (let k = 0; k < 3; k++) {
    const dx = 416 + k * 60
    g.fillStyle = '#4a4540'; g.fillRect(dx, 792, 12, 28); g.fillRect(dx + 34, 792, 12, 28)
    g.fillStyle = '#6a655a'; g.fillRect(dx + 10, 800, 26, 10)
  }
  g.fillStyle = '#ece4d0'; pxC(608, 806, 13, '#ece4d0'); pxC(608, 806, 5, '#c8b898')
      g.restore()
    }
  })
  def("tenz_jumprope", {
    clickable: true, say: '粉的，怎么了',
    name: "跳绳", cat: "武术", tags: ["跳绳","挂墙"],
    scope: "generic", fromRoom: 'tenz',
    w: 55, h: 98, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-170, -458)
  g.fillStyle = '#48301c'; g.fillRect(196, 458, 10, 12)
  g.strokeStyle = '#e858a0'; g.lineWidth = 5
  g.beginPath(); g.arc(200, 508, 30, 0.5, 5.8); g.stroke()
  g.fillStyle = '#48301c'; g.fillRect(176, 528, 9, 24); g.fillRect(214, 530, 9, 24)
      g.restore()
    }
  })
  def("tenz_yoga", {
    clickable: true, say: '和尚也拉筋，别笑',
    name: "瑜伽垫", cat: "武术", tags: ["瑜伽垫","粉"],
    scope: "generic", fromRoom: 'tenz',
    w: 48, h: 88, base: 86, foot: [0, 76, 48, 10], zLayer: 'low',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-448, -1230)
  g.fillStyle = '#c04080'; g.fillRect(448, 1240, 46, 74)
  g.fillStyle = '#e858a0'; g.fillRect(454, 1240, 16, 74)
  pxE(471, 1238, 23, 8, '#ffd0e8'); pxC(471, 1238, 8, '#c04080')
      g.restore()
    }
  })

  // 水壶 —— 原本和瑜伽垫画在同一个 sprite 里(中间隔着 330px 空白),
  // 于是 foot 这个【单个矩形】只圈得住其中一件,另一件完全没有碰撞。
  // 一个素材一件物,拆开各自落地。
  def("tenz_bottle", {
    clickable: true, say: '练完这瓶，一口气',
    name: "水壶", cat: "武术", tags: ["水壶","粉"],
    scope: "generic", fromRoom: 'tenz',
    w: 28, h: 64, base: 62, foot: [0, 52, 28, 10], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5); g.translate(-388, -1646)
  g.fillStyle = '#e858a0'; g.fillRect(388, 1662, 26, 44)
  g.fillStyle = '#ffd0e8'; g.fillRect(392, 1654, 18, 10)
  g.fillStyle = '#c04080'; g.fillRect(394, 1646, 14, 8)
      g.restore()
    }
  })

  def("tenz_plum_posts", {
    clickable: true, say: '站上去，心如止水……别晃',
    name: "梅花桩阵", cat: "武术", tags: ["梅花桩","可站"],
    scope: "character", fromRoom: 'tenz',
    w: 170, h: 204, base: 202, foot: [0, 0, 0, 0], zLayer: 'low', walkable: true,
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-562, -1510)
  for (const [px2, py2] of [[588, 1548], [704, 1548], [646, 1608], [588, 1672], [704, 1672]]) {
    g.fillStyle = '#48301c'; g.fillRect(px2 - 24, py2 - 20, 48, 60)
    g.fillStyle = '#6a4a30'; g.fillRect(px2 - 18, py2 - 20, 12, 60)
    pxE(px2, py2 - 24, 26, 12, '#7a5a3c')
    pxE(px2, py2 - 26, 20, 8, '#8a6a48')
  }
      g.restore()
    }
  })
  def("tenz_mani_stones", { patina: true,
    clickable: true, say: '一石一咒，刻的时候人就空了',
    name: "玛尼石堆", cat: "供奉", tags: ["玛尼石","刻字"],
    scope: "character", fromRoom: 'tenz',
    w: 112, h: 114, base: 112, foot: [0, 72, 110, 40], zLayer: 'low',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-450, -1738)
  for (const [sx, sy, sw, sh, sc2] of [[450, 1810, 110, 40, '#8a8578'], [464, 1780, 84, 36, '#9a9588'], [480, 1756, 56, 30, '#a8a498'], [494, 1738, 30, 22, '#8a8578']]) {
    pxE(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, sc2)
  }
  g.fillStyle = '#c83828'; g.fillRect(486, 1788, 30, 5); g.fillRect(494, 1780, 5, 20)
  g.fillStyle = '#3868b8'; g.fillRect(470, 1818, 26, 4)
      g.restore()
    }
  })
  def("tenz_hay", {
    clickable: true, say: '山下没牦牛，我还是留一堆',
    name: "干草堆", cat: "藏味", tags: ["干草","牦牛粮"],
    scope: "character", fromRoom: 'tenz',
    w: 130, h: 72, base: 70, foot: [0, 40, 128, 30], zLayer: 'low',
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-316, -1718)
  pxE(378, 1756, 62, 32, '#c8a850')
  pxE(370, 1742, 50, 24, '#d8bc60')
  g.fillStyle = '#b09040'
  for (let k = 0; k < 10; k++) g.fillRect(330 + (k * 37) % 100, 1728 + (k * 23) % 50, 14, 3)
      g.restore()
    }
  })
  def("tenz_doormat", {
    clickable: true, say: '进门脱鞋，佛前也是这规矩',
    name: "门垫", cat: "地面", tags: ["门垫","僧鞋"],
    scope: "generic", fromRoom: 'tenz',
    w: 336, h: 72, base: 0, foot: [0, 0, 0, 0], walkable: true,
    draw(g) {
      const pxC = (...a) => PRIM.pxC(g, ...a), pxE = (...a) => PRIM.pxE(g, ...a), glow = (...a) => PRIM.glow(g, ...a)
      g.save(); g.scale(0.5, 0.5); g.translate(-618, -1998)
  g.fillStyle = '#722630'; g.fillRect(618, 1998, 224, 70)
  g.fillStyle = '#8a3038'; g.fillRect(626, 2006, 208, 54)
  g.fillStyle = '#e8b23d'; g.fillRect(626, 2006, 208, 6); g.fillRect(626, 2054, 208, 6)
  pxE(886, 2036, 20, 11, '#7a2c26'); pxE(932, 2036, 20, 11, '#7a2c26')
  g.fillStyle = '#e8b23d'; g.fillRect(872, 2028, 12, 6); g.fillRect(918, 2028, 12, 6)
      g.restore()
    }
  })
