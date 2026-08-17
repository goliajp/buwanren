  /* ══════════ 沈砚 · 落第斋 ══════════
     分界线是【层积】:每一处平面都是「表层给人看的 + 压在下面他自己的」,
     靠每一叠露出的边角颜色读出来 —— 发黄的卷子边、彩票的花边、刮刮乐的银灰。 */

  def("shenyan_desk_zi", {
    clickable: true, say: '案上这方寸，来的人问的都是同一件事',
    sayDeep: ['问功名的最多', '……我从不给人算功名', '我算过。算得太准了'],
    name: "测字案", cat: "桌案", tags: ["木", "矮案", "测字"],
    scope: "character", fromRoom: 'shenyan',
    w: 480, h: 250, base: 250, foot: [0, 0, 480, 250], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      // ── 案体 ──
      g.fillStyle = '#3a2718'; g.fillRect(0, 0, 480, 250)
      g.fillStyle = '#7d5a3c'; g.fillRect(5, 5, 470, 222)
      g.fillStyle = '#8e6a48'; g.fillRect(10, 10, 460, 32)
      g.fillStyle = 'rgba(74,48,30,0.24)'
      for (let i = 0; i < 5; i++) g.fillRect(20, 54 + i * 34, 440, 3)
      g.fillStyle = '#4a3320'; g.fillRect(5, 226, 470, 18)
      g.fillStyle = '#2f2015'; g.fillRect(0, 240, 480, 10)
      g.fillStyle = '#3a2718'; g.fillRect(24, 240, 30, 10); g.fillRect(426, 240, 30, 10)
      // ── 左:镇纸压着白纸沓(表层)+ 底下露出的黄卷子边(底层) ──
      g.fillStyle = '#efe9db'; g.fillRect(44, 74, 132, 74)
      g.fillStyle = '#e0d8c4'; g.fillRect(44, 74, 132, 8)
      g.fillStyle = '#d2c8ae'; g.fillRect(44, 138, 132, 5)
      g.fillStyle = '#5a5f66'; g.fillRect(52, 62, 116, 20)
      g.fillStyle = '#727881'; g.fillRect(52, 62, 116, 6)
      g.fillStyle = '#454a50'; g.fillRect(52, 78, 116, 4)
      g.fillStyle = '#c9b579'; g.fillRect(48, 140, 128, 10)
      g.fillStyle = '#b08a4a'; g.fillRect(48, 146, 82, 4)
      // ── 中:砚 · 墨 · 笔 ──
      pxE(252, 106, 36, 23, '#2f2a26')
      pxE(252, 102, 29, 17, '#4a443e')
      pxE(252, 106, 18, 11, '#15120f')
      g.fillStyle = '#1b1714'; g.fillRect(282, 74, 14, 36)
      g.fillStyle = '#3a332c'; g.fillRect(282, 74, 14, 7)
      g.fillStyle = '#8a7a5c'; g.fillRect(322, 62, 7, 74)
      g.fillStyle = '#6b5c42'; g.fillRect(322, 62, 7, 12)
      g.fillStyle = '#2f2a22'; g.fillRect(320, 134, 11, 19)
      // ── 案前:今天替人测的那个字(表层 · 墨迹还新) ──
      g.fillStyle = '#f4efe2'; g.fillRect(196, 172, 100, 52)
      g.fillStyle = '#e6ddc9'; g.fillRect(196, 172, 100, 6)
      if (window.CALLI) window.CALLI(g, '时', 218, 180, 40, '#2b2318', { weight: 1.3 })
      // ── 右上:客人递来待测的字条(还没看的那几张) ──
      for (let k = 0; k < 4; k++) {
        const ox = 352 + k * 5, oy = 44 + k * 6
        g.fillStyle = k === 3 ? '#f2ecdd' : '#e7dfcb'
        g.fillRect(ox, oy, 96, 22)
        g.fillStyle = '#d5cbb2'; g.fillRect(ox, oy + 18, 96, 4)
      }
      g.fillStyle = '#3b3226'
      g.fillRect(378, 72, 4, 9); g.fillRect(386, 70, 3, 11); g.fillRect(396, 73, 5, 8)
      g.fillStyle = '#8b6b3e'; g.fillRect(344, 40, 12, 46)      // 压条的铜尺
      g.fillStyle = '#a8874f'; g.fillRect(344, 40, 12, 5)
      // ── 右下:他的茶盏。喝了半天,早凉了 ──
      pxE(420, 190, 26, 17, '#7d6a4e')
      pxE(420, 186, 21, 13, '#cbc0a6')
      pxE(420, 189, 13, 8, '#5c6355')                            // 凉透的茶汤
      g.fillStyle = '#b7ab8f'; g.fillRect(400, 199, 41, 4)
      // ── 案沿:写好待取的字条(黄纸,与上面那沓白纸分得开),拿铜镇压着 ──
      g.fillStyle = '#dfd1a6'; g.fillRect(52, 172, 106, 44)
      g.fillStyle = '#e8dcb6'; g.fillRect(52, 172, 106, 6)
      g.fillStyle = '#cfbf92'; g.fillRect(52, 210, 106, 6)
      g.fillStyle = '#d7c99e'; g.fillRect(57, 179, 96, 32)
      g.fillStyle = '#2e2820'
      g.fillRect(72, 188, 15, 3); g.fillRect(78, 184, 3, 14); g.fillRect(70, 202, 19, 3)
      g.fillRect(110, 190, 13, 3); g.fillRect(115, 186, 3, 15)
      g.fillStyle = '#6b5f4a'; g.fillRect(60, 166, 90, 12)
      g.fillStyle = '#87795e'; g.fillRect(60, 166, 90, 4)
      // ── 用了很多年的墨渍 ──
      g.fillStyle = 'rgba(28,22,18,0.24)'
      g.fillRect(310, 100, 34, 20); g.fillRect(338, 118, 19, 11); g.fillRect(300, 124, 13, 8)
      g.restore()
    },
    /* ── 他替人测字的那一刻 ────────────────────────────────────────
       玩家点了按钮,画面必须有变化 —— 婆婆的水晶球会亮、丹增的坛城会转,
       沈砚这里变的是【案前那张纸】:客人写的字一笔一笔落下去,
       写完停一息,再洗掉重来。案面同时泛起一点纸反的光,像他俯下身。
       表演态两种读法都算数:引擎通用的 room.performing,或房间自定的
       state[stateKey]。这里读 cezi —— 与 perform.stateKey 同名。 */
    fx(g, t, x, y, o, room) {
      const on = !!(room && (room.performing || (room.state && room.state.cezi)))
      if (!on) return
      // ⚠ fx 的 ctx 是 1440 系 —— 它【没有】被 scale(2,2),draw 才有。
      //   在这儿再写一次 g.scale(0.5,0.5) 会把整块东西画到四分之一的位置上去。
      g.save(); g.translate(x, y)
      // 案前摊开的白纸(盖住 draw 里那张写着「时」的)
      g.fillStyle = '#f7f3e8'; g.fillRect(196, 172, 100, 52)
      g.fillStyle = '#e9e0cc'; g.fillRect(196, 172, 100, 6)
      // 一笔一笔写。CALLI 是逐字的,这里靠遮罩把它从左往右揭开 ——
      // 笔画顺序做不到,但「正在写」这件事读得出来
      const CY = 7200, k = (t % CY) / CY
      const write = Math.min(1, k / 0.62)              // 前六成时间在写
      const fade = k > 0.88 ? (k - 0.88) / 0.12 : 0    // 最后洗掉重来
      if (window.CALLI) {
        g.save()
        g.beginPath(); g.rect(214, 176, 66 * write, 46); g.clip()
        window.CALLI(g, '運', 216, 178, 42, '#241d14', { weight: 1.35 })
        g.restore()
      }
      if (fade) { g.fillStyle = 'rgba(247,243,232,' + fade.toFixed(2) + ')'; g.fillRect(196, 172, 100, 52) }
      // 纸面反的那点光 —— 极淡,这间房的调子是阴天,不许在这儿开灯
      const gd = g.createRadialGradient(246, 196, 0, 246, 196, 132)
      gd.addColorStop(0, 'rgba(250,244,226,0.16)'); gd.addColorStop(1, 'rgba(250,244,226,0)')
      g.fillStyle = gd; g.fillRect(114, 64, 264, 264)
      g.restore()
    }
  })



  def("shenyan_rack_paper", {
    clickable: true, say: '架上都是纸。书早卖了',
    sayDeep: ['哪一层?哪一层都别翻', '……上面那两层可以看，下面的算了',
              '下面压着的是我抄了七年的东西。抄得越好，越说明没用'],
    name: "纸架", cat: "收纳", tags: ["木", "纸", "层积"],
    scope: "character", fromRoom: 'shenyan',
    w: 216, h: 400, base: 400, foot: [0, 352, 216, 48], zLayer: 'sort',
    draw(g) {
      // 素材是【半分辨率】创作的:placeAsset 预缩放 2×,所以用最终像素写的坐标
      // 必须补这一行,否则整件画成两倍大、右下半被自己的包围盒裁掉。
      g.save(); g.scale(0.5, 0.5)
      // ── 架体:描边 + 立柱 + 顶板 ──
      g.fillStyle = '#33220f'; g.fillRect(0, 0, 216, 400)
      g.fillStyle = '#63472e'; g.fillRect(6, 6, 204, 388)
      g.fillStyle = '#4a3320'; g.fillRect(6, 6, 10, 388)                   // 左立柱
      g.fillRect(200, 6, 10, 388)                                          // 右立柱
      g.fillStyle = '#77593a'; g.fillRect(6, 6, 204, 12)                   // 顶板高光
      // ── 四层,每层塞的东西不同,而且都压着一层露出边角的旧纸 ──
      const SHELF = [
        { y: 26,  表: '#efe6d2', 表2: '#e2d7bd', 底: '#c9b579', 底2: '#b08a4a', 说: 'scroll' },
        { y: 118, 表: '#f2ece0', 表2: '#e4dccb', 底: '#d8bfa0', 底2: '#bfa07e', 说: 'book'   },
        { y: 210, 表: '#e8e2d4', 表2: '#dad2c0', 底: '#e8b8c0', 底2: '#cf94a0', 说: 'ticket' },
        { y: 302, 表: '#efe9db', 表2: '#e0d8c4', 底: '#b9bcbf', 底2: '#9aa0a4', 说: 'scratch'},
      ]
      for (const S of SHELF) {
        g.fillStyle = '#3a2718'; g.fillRect(16, S.y + 62, 184, 9)          // 层板
        g.fillStyle = '#55402a'; g.fillRect(16, S.y + 62, 184, 3)
        g.fillStyle = S.表;  g.fillRect(22, S.y + 8, 172, 46)              // 表层:干净的纸
        g.fillStyle = S.表2; g.fillRect(22, S.y + 8, 172, 7)
        // 塞进去的东西各有形状
        if (S.说 === 'scroll') {                                           // 卷起来的抄本
          g.fillStyle = '#d8cdb4'
          for (let k = 0; k < 4; k++) g.fillRect(28 + k * 42, S.y + 14, 34, 34)
          g.fillStyle = '#bfae8e'
          for (let k = 0; k < 4; k++) g.fillRect(28 + k * 42, S.y + 26, 34, 4)
        } else if (S.说 === 'book') {                                      // 侧立的册子
          const C = ['#8a6a4a', '#6f5540', '#95765a', '#7d5f46', '#8a6a4a']
          for (let k = 0; k < 5; k++) { g.fillStyle = C[k]; g.fillRect(28 + k * 33, S.y + 12, 26, 42) }
          g.fillStyle = 'rgba(240,232,210,0.7)'
          for (let k = 0; k < 5; k++) g.fillRect(30 + k * 33, S.y + 12, 22, 3)
        } else if (S.说 === 'ticket') {                                    // 一沓彩票
          const C = ['#e8b8c0', '#e8d8a0', '#a8c8e0', '#d8c0e0']
          for (let k = 0; k < 4; k++) { g.fillStyle = C[k]; g.fillRect(26 + k * 42, S.y + 16 + (k % 2) * 4, 36, 30) }
        } else {                                                           // 刮完的刮刮乐
          for (let k = 0; k < 3; k++) {
            g.fillStyle = '#cfd3d6'; g.fillRect(30 + k * 56, S.y + 14, 46, 36)
            g.fillStyle = '#9aa0a4'; g.fillRect(34 + k * 56, S.y + 22, 38, 12)   // 刮开的银层
            g.fillStyle = '#6f7478'; g.fillRect(36 + k * 56, S.y + 26, 12, 4)
          }
        }
        // ★ 压在下面的 —— 只露出边角,颜色各不同(分界线本身)
        g.fillStyle = S.底;  g.fillRect(22, S.y + 50, 172, 10)
        g.fillStyle = S.底2; g.fillRect(22, S.y + 56, 98, 4)
      }
      g.fillStyle = 'rgba(20,14,10,0.20)'; g.fillRect(16, 18, 184, 10)     // 顶部投影
      g.fillStyle = '#3a2718'; g.fillRect(6, 380, 204, 14)                 // 底座
      g.restore()
    }
  })


  def("shenyan_wall_numbers", {
    clickable: true, say: '这几期的规律，就快出来了',
    sayDeep: ['规律是有的，只是还没算到', '……算了十一年了', '我算得出别人的运。算不出自己的'],
    name: "推号墙", cat: "墙面", tags: ["彩票", "推算", "红笔"],
    scope: "character", fromRoom: 'shenyan', wall: true,
    w: 480, h: 300, base: 300, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      // 素材是【半分辨率】创作的:placeAsset 预缩放 2×,所以用最终像素写的坐标
      // 必须补这一行,否则整件画成两倍大、右下半被自己的包围盒裁掉。
      g.save(); g.scale(0.5, 0.5)
      // ── 底下压着的旧推算:三层,各露一条边(层积)──
      g.fillStyle = '#cdbe93'; g.fillRect(14, 16, 462, 282)
      g.fillStyle = '#d8cba6'; g.fillRect(9,  11, 466, 286)
      g.fillStyle = '#c2b184'; g.fillRect(9,  11, 466, 6)
      // ── 表层:本期的推算图 ──
      g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 462, 278)
      g.fillStyle = '#e8e1cf'; g.fillRect(0, 0, 462, 9)
      g.fillStyle = '#ddd4bd'; g.fillRect(0, 269, 462, 9)
      // 网格
      g.fillStyle = 'rgba(92,82,64,0.34)'
      for (let c = 0; c <= 8; c++) g.fillRect(22 + c * 52, 26, 2, 226)
      for (let r = 0; r <= 6; r++) g.fillRect(22, 26 + r * 38, 418, 2)
      // 抄上去的号码 —— 每格两位数,密
      g.fillStyle = '#332c22'
      for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) {
        if (((r * 7 + c * 3) % 5) === 0) continue
        const x = 30 + c * 52, y = 36 + r * 38
        g.fillRect(x, y, 8, 14); g.fillRect(x + 12, y, 8, 14)
        g.fillStyle = 'rgba(51,44,34,0.45)'; g.fillRect(x, y + 16, 20, 3)
        g.fillStyle = '#332c22'
      }
      // 红笔:圈出「应验」的那几期 + 连线 + 批注
      g.fillStyle = '#b03a2e'
      for (const [c, r] of [[1, 1], [4, 2], [2, 4], [6, 3], [5, 5]]) {
        const x = 26 + c * 52, y = 30 + r * 38
        g.fillRect(x, y, 36, 3); g.fillRect(x, y + 25, 36, 3)
        g.fillRect(x, y, 3, 28); g.fillRect(x + 33, y, 3, 28)
      }
      g.fillStyle = 'rgba(176,58,46,0.75)'                                  // 页边批注
      for (let k = 0; k < 5; k++) g.fillRect(446, 40 + k * 44, 12, 3)
      // 折角 + 图钉(纸是钉上去的)
      g.fillStyle = '#e0d6bd'; g.fillRect(438, 0, 24, 22)
      g.fillStyle = '#cfc3a5'; g.fillRect(438, 0, 24, 4)
      g.fillStyle = '#8a2f24'; g.fillRect(16, 6, 9, 9); g.fillRect(438, 6, 9, 9)
      g.fillRect(16, 262, 9, 9); g.fillRect(438, 262, 9, 9)
      g.restore()
    }
  })


  def("shenyan_screen_draw", {
    clickable: true, say: '看一眼。就看一眼',
    sayDeep: ['开奖是九点半', '……我八点就坐这儿了', '这屋里就它一个是亮的。我知道这话难听'],
    name: "开奖屏", cat: "电器", tags: ["开奖", "唯一的光"],
    scope: "character", fromRoom: 'shenyan',
    w: 268, h: 208, base: 208, foot: [16, 172, 236, 36], zLayer: 'sort',
    // ★ 全屋唯一主动发光的东西 —— 一个读书人的屋子里,亮着的是彩票。
    //   半径给足:它要照到墙、照到地、照亮半个推号区,不然「唯一的光」只是句话。
    light: { x: 134, y: 92, r: 240, color: '#6fa0e0', flicker: 'screen' },
    variant(st, t) { return (t && ((t / 460) | 0) % 2) ? 'b' : 'a' },
    // 引擎 L5 那层的辉光 alpha 是写死的 0.33,蓝光叠在灰地板上提不亮。
    // 「全屋唯一发亮的东西」是这间房的立意,得自己画 ——
    // 而且尺度要【远大于物件本身】,贴着屏描边的光在 402 缩图上等于没有。
    fx(g, t, X, Y) {
      const cx = X + 134, cy = Y + 96
      const pulse = 0.74 + 0.26 * Math.sin(t / 240)      // 屏在换画面
      g.save(); g.globalCompositeOperation = 'lighter'
      // ① 大范围冷光晕 —— 洒到墙、洒到地
      const gr = g.createRadialGradient(cx, cy + 20, 16, cx, cy + 20, 300)
      gr.addColorStop(0,    'rgba(122,180,255,' + (0.11 * pulse).toFixed(3) + ')')
      gr.addColorStop(0.45, 'rgba(96,152,232,'  + (0.05 * pulse).toFixed(3) + ')')
      gr.addColorStop(1,    'rgba(60,110,190,0)')
      g.fillStyle = gr; g.fillRect(cx - 300, cy - 260, 600, 620)
      // ② 屏前的光锥 —— 往下前方洒,落在地上
      const cone = g.createLinearGradient(cx, cy + 60, cx, cy + 300)
      cone.addColorStop(0, 'rgba(140,195,255,' + (0.09 * pulse).toFixed(3) + ')')
      cone.addColorStop(1, 'rgba(140,195,255,0)')
      g.fillStyle = cone
      g.beginPath()
      g.moveTo(cx - 72, cy + 60); g.lineTo(cx + 72, cy + 60)
      g.lineTo(cx + 170, cy + 300); g.lineTo(cx - 170, cy + 300)
      g.closePath(); g.fill()
      // ③ 屏面自身的高光块(换画面时一闪)
      g.fillStyle = 'rgba(190,225,255,' + (0.05 + 0.05 * pulse).toFixed(3) + ')'
      g.fillRect(X + 18, Y + 18, 232, 142)
      g.restore()
    },
    draw(g, o) {
      g.save(); g.scale(0.5, 0.5)
      const alt = (o && o.variant) === 'b'
      g.fillStyle = '#23232a'; g.fillRect(0, 0, 268, 182)                 // 机壳
      g.fillStyle = '#33333c'; g.fillRect(6, 6, 256, 170)
      g.fillStyle = '#15151a'; g.fillRect(14, 14, 240, 150)               // 屏框
      // 屏面:上深下亮的荧光渐变
      g.fillStyle = '#1e4470'; g.fillRect(18, 18, 232, 142)
      g.fillStyle = '#2a5c96'; g.fillRect(18, 60, 232, 100)
      g.fillStyle = '#3a74b4'; g.fillRect(18, 120, 232, 40)
      // 台标与字幕条
      g.fillStyle = '#e8663c'; g.fillRect(26, 24, 58, 16)
      g.fillStyle = '#ffd9a0'; g.fillRect(30, 28, 40, 6)
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(18, 138, 232, 22)
      g.fillStyle = '#cfe6ff'
      for (let k = 0; k < 7; k++) g.fillRect(26 + k * 30, 145, 20, 6)
      // ★ 滚动的号码球 —— 彩色,这是全屋唯一一处高饱和
      const BALL = ['#e8544c', '#f0a83c', '#4cc06a', '#4c9ce8', '#c060d0', '#f0d040']
      for (let k = 0; k < 6; k++) {
        const bx = 28 + k * 36 + (alt ? 4 : 0), by = 64 + (alt ? (k % 2) * 6 : ((k + 1) % 2) * 6)
        g.fillStyle = '#0f2038'; g.fillRect(bx - 2, by - 2, 32, 32)
        g.fillStyle = BALL[k]; g.fillRect(bx, by, 28, 28)
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(bx + 3, by + 3, 10, 6)
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(bx + 8, by + 12, 12, 10)
      }
      // 扫描线 + 玻璃反光
      g.fillStyle = 'rgba(190,225,255,0.13)'
      for (let k = 0; k < 12; k++) g.fillRect(18, 20 + k * 12, 232, 2)
      g.fillStyle = 'rgba(255,255,255,0.10)'
      g.beginPath(); g.moveTo(30, 160); g.lineTo(96, 18); g.lineTo(140, 18); g.lineTo(74, 160); g.fill()
      // 底座
      g.fillStyle = '#2b2b33'; g.fillRect(92, 176, 84, 18)
      g.fillStyle = '#1b1b22'; g.fillRect(56, 192, 156, 12)
      g.restore()
    }
  })
