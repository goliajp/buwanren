  //<<< TAO ASSETS END

  //>>> POPO ASSETS BEGIN (generated)

    // ═══════════ 婆婆房素材（自 popoCanvas 硬编码迁移 + S1 立意新绘）═══════════
    // 立意：她给所有人当亲人，自己没有亲人。
    // 分界线不切空间，走【成对物件】—— 每件「给别人的」旁边有一件「她自己的」，
    // 后者永远更旧、更少、更破，两件落在同一视野内。

  // ── 墙面带 ─────────────────────────────────────────────────
  def("popo_cobweb", {
    clickable: true, say: '那边我不扫哦，有位小客人住着呢',
    name: "蜘蛛网", cat: "墙面", tags: ["网","角落"],
    scope: "character", fromRoom: 'popo',
    w: 200, h: 190, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.strokeStyle = 'rgba(220,220,235,0.35)'; g.lineWidth = 2
      for (let k = 0; k < 5; k++) {
        g.beginPath(); g.moveTo(0, 0)
        g.lineTo(Math.cos(k * 0.34 + 0.08) * 196, Math.sin(k * 0.34 + 0.08) * 196); g.stroke()
      }
      g.strokeStyle = 'rgba(220,220,235,0.26)'
      for (let rr = 48; rr < 196; rr += 42) { g.beginPath(); g.arc(0, 0, rr, 0.05, 1.42); g.stroke() }
      g.fillStyle = '#2a2430'
      g.fillRect(112, 106, 14, 10)
      g.fillRect(108, 100, 6, 4); g.fillRect(124, 100, 6, 4)
      g.fillRect(104, 112, 8, 3); g.fillRect(126, 112, 8, 3)
      g.restore()
    }
  })
  def("popo_fireplace", {
    light: { x: 150, y: 210, r: 210, color: '#ffb464', flicker: 0.5 },
    fx(g, t, X, Y) {
      // 火苗：三层焰心，慢呼吸。整屋一种光 —— 她不分场合，火一直烧着。
      const b = 0.86 + Math.sin(t / 420) * 0.14
      g.fillStyle = 'rgba(232,140,48,0.85)'
      g.fillRect(X + 96, Y + 158 - 14 * b, 108, 82 * b)
      g.fillStyle = 'rgba(255,190,90,0.9)'
      g.fillRect(X + 118, Y + 148 - 10 * b, 64, 88 * b)
      g.fillStyle = 'rgba(255,240,190,0.95)'
      g.fillRect(X + 140, Y + 170 - 6 * b, 22, 58 * b)
      for (let k = 0; k < 3; k++) {
        const p = ((t / 1400) + k / 3) % 1
        g.fillStyle = 'rgba(255,180,90,' + (0.5 * (1 - p)) + ')'
        g.fillRect(X + 116 + k * 32, Y + 150 - p * 96, 5, 5)
      }
    },
    clickable: true, say: '火我不熄的呀，夜里冷，它们要进来',
    name: "壁炉", cat: "墙面", tags: ["火","暖"],
    scope: "character", fromRoom: 'popo',
    w: 300, h: 250, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#38324a'; g.fillRect(0, 0, 300, 250)
      g.fillStyle = '#4a4258'
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++) g.fillRect(8 + c * 72 + (r % 2) * 36, 8 + r * 62, 66, 56)
      g.fillStyle = '#141018'; g.fillRect(50, 80, 200, 170)
      g.fillStyle = '#2e2838'; g.fillRect(40, 70, 220, 14)
      g.fillStyle = '#3a2418'
      g.fillRect(88, 214, 130, 14); g.fillRect(106, 202, 96, 12)
      g.fillStyle = '#5a3a20'; g.fillRect(88, 214, 130, 4); g.fillRect(106, 202, 96, 4)
      g.fillStyle = '#2e2838'; g.fillRect(56, 236, 190, 14)
      g.restore()
    }
  })
  def("popo_photo_wall", {
    clickable: true, say: '这是第一只，后来的都没拍，来不及',
    name: "动物照片墙", cat: "墙面", tags: ["照片","动物"],
    scope: "character", fromRoom: 'popo',
    w: 270, h: 104, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      for (const [px5, inner] of [[8, 'cat'], [96, 'dog'], [184, 'bear']]) {
        g.fillStyle = '#e8b23d'; g.fillRect(px5, 14, 72, 84)
        g.fillStyle = '#38324a'; g.fillRect(px5 + 7, 21, 58, 70)
        if (inner === 'cat') {
          pxC(px5 + 36, 58, 15, '#e89040')
          g.fillStyle = '#e89040'
          g.fillRect(px5 + 23, 38, 9, 11); g.fillRect(px5 + 41, 38, 9, 11)
          g.fillStyle = '#1a1620'; g.fillRect(px5 + 29, 54, 5, 5); g.fillRect(px5 + 38, 54, 5, 5)
        } else if (inner === 'dog') {
          pxC(px5 + 36, 58, 15, '#f2d288')
          g.fillStyle = '#b07e3c'
          g.fillRect(px5 + 18, 42, 9, 18); g.fillRect(px5 + 45, 42, 9, 18)
          g.fillStyle = '#1a1620'; g.fillRect(px5 + 29, 54, 5, 5); g.fillRect(px5 + 38, 54, 5, 5)
          g.fillRect(px5 + 32, 63, 7, 4)
        } else {
          pxC(px5 + 24, 62, 13, '#a06a40')
          pxC(px5 + 47, 54, 16, '#6a4a30')
          pxC(px5 + 24, 66, 7, '#e8c8a8')
          g.fillStyle = '#1a1620'; g.fillRect(px5 + 43, 50, 4, 4); g.fillRect(px5 + 52, 50, 4, 4)
        }
        g.fillStyle = '#d86aa0'
        g.fillRect(px5 + 52, 24, 6, 6); g.fillRect(px5 + 59, 24, 6, 6); g.fillRect(px5 + 54, 30, 9, 6)
      }
      g.restore()
    }
  })
  def("popo_window_night", {
    light: { x: 122, y: 122, r: 190, color: '#7890dc', flicker: 0 },
    clickable: true, say: '黑森林那边，树太高了，天很小哦',
    name: "圆窗 · 夜空", cat: "墙面", tags: ["窗","夜"],
    scope: "generic", fromRoom: 'popo',
    w: 244, h: 244, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const rnd=(function(a){return function(){a|=0;a=(a+0x6D2B79F5)|0
        let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t
        return((t^(t>>>14))>>>0)/4294967296}})(13)
      g.save(); g.scale(0.5, 0.5)
      pxC(122, 122, 122, '#2e2838')
      pxC(122, 122, 110, '#141c36')
      g.fillStyle = '#f6efdc'
      for (let k = 0; k < 12; k++) {
        const a = rnd() * 6.28, rr = rnd() * 94
        g.fillRect(122 + Math.cos(a) * rr, 122 + Math.sin(a) * rr, 3, 3)
      }
      pxC(152, 92, 26, '#ffd76a')
      pxC(164, 84, 22, '#141c36')
      g.fillStyle = '#2e2838'; g.fillRect(6, 118, 232, 6)
      g.fillRect(118, 8, 6, 228)
      g.restore()
    }
  })
  def("popo_window_small", {
    clickable: true, say: '窗留一条缝呀，夜里有小家伙要回来',
    name: "小圆窗", cat: "墙面", tags: ["窗","夜"],
    scope: "generic", fromRoom: 'popo',
    w: 190, h: 190, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const rnd=(function(a){return function(){a|=0;a=(a+0x6D2B79F5)|0
        let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t
        return((t^(t>>>14))>>>0)/4294967296}})(29)
      g.save(); g.scale(0.5, 0.5)
      pxC(95, 95, 95, '#2e2838')
      pxC(95, 95, 84, '#141c36')
      g.fillStyle = '#f6efdc'
      for (let k = 0; k < 9; k++) {
        const a = rnd() * 6.28, rr = rnd() * 70
        g.fillRect(95 + Math.cos(a) * rr, 95 + Math.sin(a) * rr, 3, 3)
      }
      g.fillStyle = '#2e2838'; g.fillRect(4, 91, 182, 6)
      g.restore()
    }
  })
  def("popo_birthday_board", {
    clickable: true, say: '这个月有四个呢，得先备起来',
    sayDeep: '没人告诉过我这些日子，我自己记的',
    name: "生日日历", cat: "墙面", tags: ["日历","记事"],
    scope: "character", fromRoom: 'popo',
    w: 186, h: 206, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2e2838'; g.fillRect(0, 0, 186, 206)
      g.fillStyle = '#e8ddc4'; g.fillRect(8, 8, 170, 190)
      g.fillStyle = '#c04888'; g.fillRect(8, 8, 170, 26)
      g.fillStyle = '#f6efdc'; g.fillRect(20, 17, 46, 8); g.fillRect(76, 17, 30, 8)
      // 日格 6×5，圈红的是生日
      const MARK = [3, 7, 12, 18, 21, 26]
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 6; c++) {
          const k = r * 6 + c, x = 16 + c * 27, y = 44 + r * 30
          g.fillStyle = '#d8cdb4'; g.fillRect(x, y, 23, 25)
          g.fillStyle = '#8a8070'; g.fillRect(x + 5, y + 6, 12, 3)
          if (MARK.indexOf(k) >= 0) {
            g.strokeStyle = '#d84a34'; g.lineWidth = 3
            g.beginPath(); g.arc(x + 12, y + 13, 11, 0, 7); g.stroke()
            g.fillStyle = '#d84a34'; g.fillRect(x + 8, y + 16, 9, 3)
          }
        }
      // 别在板上的小纸条
      g.fillStyle = '#f6efdc'; g.fillRect(122, 150, 52, 40)
      g.fillStyle = '#8a8070'; g.fillRect(128, 158, 38, 3); g.fillRect(128, 166, 30, 3); g.fillRect(128, 174, 34, 3)
      g.fillStyle = '#e8b23d'; g.fillRect(144, 146, 9, 9)
      g.restore()
    }
  })
  def("popo_knit_pattern", {
    clickable: true, say: '照着这个织的，人的款式，改小就行了呀',
    sayDeep: '这本来是给孩子的图样',
    name: "织毛衣图样", cat: "墙面", tags: ["图样","毛线"],
    scope: "character", fromRoom: 'popo',
    w: 200, h: 230, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2e2838'; g.fillRect(0, 0, 200, 230)
      g.fillStyle = '#f2ead6'; g.fillRect(7, 7, 186, 216)
      // 网格纸
      g.fillStyle = 'rgba(120,150,190,0.30)'
      for (let x = 15; x < 190; x += 11) g.fillRect(x, 14, 1, 202)
      for (let y = 14; y < 218; y += 11) g.fillRect(14, y, 176, 1)
      // 毛衣轮廓（人的款式）
      g.fillStyle = '#d86aa0'
      g.fillRect(70, 48, 62, 84)          // 身
      g.fillRect(37, 56, 33, 26); g.fillRect(132, 56, 33, 26)   // 两袖
      g.fillStyle = '#c04888'
      g.fillRect(70, 48, 62, 10); g.fillRect(70, 124, 62, 8)
      g.fillRect(37, 74, 33, 8); g.fillRect(132, 74, 33, 8)
      // 花纹格
      g.fillStyle = '#f2c4dc'
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g.fillRect(78 + c * 14, 66 + r * 16, 8, 8)
      // 尺寸标注 + 划掉重写的痕迹
      g.fillStyle = '#5a5040'
      g.fillRect(60, 148, 80, 3); g.fillRect(60, 158, 56, 3); g.fillRect(60, 168, 68, 3)
      g.strokeStyle = '#d84a34'; g.lineWidth = 3
      g.beginPath(); g.moveTo(56, 152); g.lineTo(144, 144); g.stroke()
      g.fillStyle = '#d84a34'; g.fillRect(60, 182, 46, 3); g.fillRect(60, 192, 62, 3)
      g.restore()
    }
  })
  def("popo_herb_hang", {
    clickable: true, say: '这个煮水喝，咳嗽就好啦',
    name: "草药束", cat: "墙面", tags: ["草药","倒挂"],
    scope: "generic", fromRoom: 'popo',
    w: 120, h: 130, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      for (const [hx2, hcol, hd] of [[10, '#c04888', 0], [46, '#68c048', 14], [82, '#e8a030', 6]]) {
        g.fillStyle = '#1a1620'; g.fillRect(hx2 + 12, 0, 3, 26 + hd)
        g.fillStyle = '#6a5a3a'
        g.beginPath(); g.moveTo(hx2 + 13, 26 + hd); g.lineTo(hx2 - 2, 74 + hd); g.lineTo(hx2 + 28, 74 + hd); g.fill()
        pxE(hx2 + 13, 82 + hd, 15, 12, hcol)
        g.fillStyle = '#e8e0d0'; g.fillRect(hx2 + 8, 88 + hd, 9, 16)
        g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(hx2 + 4, 76 + hd, 5, 5)
      }
      g.restore()
    }
  })
  def("popo_shelf_potions", {
    light: { x: 150, y: 92, r: 130, color: '#b48ce0', flicker: 0.12 },
    clickable: true, say: '这排是给别人配的，哪一瓶给谁，我都记着',
    name: "药瓶架", cat: "墙面", tags: ["药","瓶"],
    scope: "character", fromRoom: 'popo',
    w: 300, h: 138, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const POT = ['#c04888', '#48a0c0', '#68c048', '#e8a030', '#8a5ac8', '#d84a34']
      for (let s = 0; s < 2; s++) {
        const sy = 4 + s * 62
        g.fillStyle = '#2e2838'; g.fillRect(0, sy + 42, 296, 10)
        for (let k = 0; k < 6; k++) {
          const bx = 16 + k * 45, col = POT[(k + s * 3) % 6]
          g.fillStyle = '#2e2838'; g.fillRect(bx + 8, sy, 12, 10)
          g.fillStyle = col; g.fillRect(bx, sy + 10, 28, 32)
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(bx + 4, sy + 14, 6, 14)
          g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(bx, sy + 10, 28, 4)
          // 贴的小标签 —— 每瓶写着一个人的名字
          g.fillStyle = '#f2ead6'; g.fillRect(bx + 5, sy + 30, 18, 8)
          g.fillStyle = '#5a5040'; g.fillRect(bx + 7, sy + 33, 13, 2)
        }
      }
      g.restore()
    }
  })
  def("popo_hat_stand", {
    clickable: true, say: '备用的，万一有人要借呀',
    name: "帽架 + 尖帽", cat: "墙面", tags: ["帽","架"],
    scope: "character", fromRoom: 'popo',
    w: 130, h: 200, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2e2838'; g.fillRect(96, 0, 8, 200)
      g.fillRect(66, 30, 62, 6); g.fillRect(76, 100, 46, 6)
      g.fillStyle = '#7a5a9a'
      g.beginPath(); g.moveTo(48, 0); g.lineTo(80, 62); g.lineTo(16, 62); g.fill()
      pxE(48, 64, 44, 12, '#6a4a8a')
      pxE(48, 62, 44, 10, '#8a6aaa')
      g.fillStyle = '#e8b23d'; g.fillRect(34, 48, 28, 8)
      g.fillStyle = '#ffd76a'; g.fillRect(40, 50, 8, 4)
      // 挂在下面那根的围巾（织废的）
      g.fillStyle = '#d86aa0'; g.fillRect(84, 106, 20, 76)
      g.fillStyle = '#c04888'; g.fillRect(84, 122, 20, 6); g.fillRect(84, 146, 20, 6)
      g.restore()
    }
  })
  // ── ★ 分界线：成对物件 ───────────────────────────────────────
  // 每一对的两件都落在同一视野内。给别人的那件永远新、多、满；
  // 她自己那件永远旧、少、破。玩家不必走到房间另一头才看见对比。

  def("popo_table_read", {
    clickable: true, say: '坐呀，要问什么，慢慢说',
    name: "读牌桌", cat: "桌案", tags: ["桌","占卜"],
    scope: "character", fromRoom: 'popo',
    w: 340, h: 250, base: 250, foot: [0, 112, 340, 138], zLayer: 'sort',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      // 台面（略带梯形，桌沿在前）
      g.fillStyle = '#5a3a7a'
      g.beginPath(); g.moveTo(40, 106); g.lineTo(300, 106); g.lineTo(340, 232); g.lineTo(0, 232); g.fill()
      g.fillStyle = '#6a4a8a'
      g.beginPath(); g.moveTo(40, 106); g.lineTo(300, 106); g.lineTo(312, 138); g.lineTo(28, 138); g.fill()
      pxE(170, 104, 132, 26, '#7a5a9a')
      pxE(170, 100, 132, 22, '#8a6aaa')
      // 桌沿刻的一圈符文
      g.fillStyle = '#a87820'
      for (let k = 0; k < 9; k++) g.fillRect(24 + k * 34, 146, 14, 4)
      // 桌腿与前挡板（抽屉将落在这块板上）
      g.fillStyle = '#4a2e64'; g.fillRect(0, 232, 340, 18)
      g.fillStyle = '#3a2450'; g.fillRect(14, 160, 312, 74)
      // 桌布一角搭下来
      g.fillStyle = '#7a3040'
      g.beginPath(); g.moveTo(300, 118); g.lineTo(340, 118); g.lineTo(334, 196); g.lineTo(306, 178); g.fill()
      g.fillStyle = '#8a4050'; g.fillRect(302, 120, 34, 8)
      g.restore()
    }
  })
  def("popo_cards_new", {
    clickable: true, say: '这副天天用，牌是会认人的哦',
    name: "新的那副牌", cat: "器物", tags: ["塔罗","牌"],
    scope: "character", fromRoom: 'popo',
    w: 150, h: 76, base: 76, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 摊开三张 + 一摞
      for (let k = 0; k < 3; k++) {
        const tx = k * 34, ty = 10 + (k % 2) * 7
        g.fillStyle = '#1a1620'; g.fillRect(tx, ty, 40, 58)
        g.fillStyle = '#f0e4c8'; g.fillRect(tx + 3, ty + 3, 34, 52)
        g.fillStyle = ['#c04888', '#48a0c0', '#e8a030'][k]
        g.fillRect(tx + 9, ty + 11, 22, 28)
        g.fillStyle = '#e8b23d'; g.fillRect(tx + 14, ty + 43, 12, 5)
      }
      // 一摞（牌背朝上，边角还很齐）
      g.fillStyle = '#1a1620'; g.fillRect(106, 6, 42, 62)
      g.fillStyle = '#3a1e5e'; g.fillRect(109, 9, 36, 56)
      g.fillStyle = '#e8b23d'
      g.fillRect(115, 16, 24, 3); g.fillRect(115, 54, 24, 3)
      g.fillRect(124, 26, 6, 22); g.fillRect(118, 33, 18, 6)
      g.restore()
    }
  })
  def("popo_drawer", {
    // ★★ 本房核心物件 · 唯一的有状态家具
    // 她只给自己算过一次，之后把那副牌收进抽屉，换了新的一副。
    // 抽屉平时关着，点一下开；开着才看得见里面那副旧牌。
    variant(state) { return state.drawerOpen ? 'open' : 'shut' },
    clickable: true,
    say: '这个呀……里头没什么',
    sayDeep: '算过一次，就那一次，结果我没跟人说过',
    name: "抽屉 · 旧牌", cat: "桌案", tags: ["抽屉","牌","核心"],
    scope: "character", fromRoom: 'popo',
    w: 280, h: 96, base: 96, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g, opt) {
      const open = !!(opt && opt.variant === 'open')
      g.save(); g.scale(0.5, 0.5)
      if (!open) {
        // 关着：只是一道抽屉面，一个铜拉手，缝里透出一点点
        g.fillStyle = '#3a2450'; g.fillRect(0, 0, 280, 62)
        g.fillStyle = '#4a2e64'; g.fillRect(5, 5, 270, 52)
        g.fillStyle = '#2a1840'; g.fillRect(5, 5, 270, 4)
        g.fillStyle = '#c9a26a'; g.fillRect(118, 26, 44, 11)
        g.fillStyle = '#e8b23d'; g.fillRect(118, 26, 44, 4)
        g.fillStyle = 'rgba(255,215,106,0.16)'; g.fillRect(5, 55, 270, 3)
      } else {
        // 开着：抽屉拉出来，里面一副旧牌 —— 牌背磨白，边角起毛，
        // 用一根褪色的布条捆着，没散开过。
        g.fillStyle = '#241636'; g.fillRect(0, 0, 280, 34)      // 柜内暗处
        g.fillStyle = '#3a2450'; g.fillRect(0, 26, 280, 66)     // 拉出的抽屉体
        g.fillStyle = '#4a2e64'; g.fillRect(6, 32, 268, 56)
        g.fillStyle = '#5a3a7a'; g.fillRect(6, 32, 268, 6)
        // 旧牌一摞（比新牌矮、白、歪）
        g.fillStyle = '#1a1620'; g.fillRect(104, 34, 46, 44)
        g.fillStyle = '#cfc3a6'; g.fillRect(107, 37, 40, 38)
        g.fillStyle = '#bdb094'; g.fillRect(107, 37, 40, 5); g.fillRect(107, 58, 40, 3)
        g.fillStyle = '#a89878'; g.fillRect(110, 44, 34, 2); g.fillRect(110, 68, 30, 2)
        // 捆着的布条（褪色的红）
        g.fillStyle = '#8a4a4a'; g.fillRect(118, 34, 12, 44)
        g.fillStyle = '#a05a5a'; g.fillRect(118, 34, 12, 4)
        // 压在下面翻出来的一张 —— 只露一角，看不清是哪张
        g.fillStyle = '#cfc3a6'; g.fillRect(154, 60, 34, 20)
        g.fillStyle = '#8a7a5c'; g.fillRect(158, 66, 18, 3)
        // 抽屉里另外只有一样东西：一枚旧顶针
        g.fillStyle = '#a89060'; g.fillRect(66, 60, 16, 16)
        g.fillStyle = '#c9a26a'; g.fillRect(66, 60, 16, 5)
        g.fillStyle = '#c9a26a'; g.fillRect(118, 96, 44, 11)
      }
      g.restore()
    }
  })
  def("popo_table_guest", {
    clickable: true, say: '坐坐坐，婆婆给你倒茶',
    name: "待客桌", cat: "桌案", tags: ["桌","待客"],
    scope: "character", fromRoom: 'popo',
    w: 340, h: 230, base: 230, foot: [0, 104, 340, 126], zLayer: 'sort',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      pxE(170, 104, 168, 32, '#3a2c1e')
      pxE(170, 98, 168, 30, '#6a4a30')
      pxE(170, 92, 160, 26, '#8a5e3c')
      pxE(170, 88, 150, 22, '#a06a40')
      // 木纹
      g.fillStyle = '#8a5e3c'
      g.fillRect(40, 82, 90, 3); g.fillRect(160, 92, 120, 3); g.fillRect(70, 100, 70, 3)
      // 桌腿 ×3
      g.fillStyle = '#4a3220'
      g.fillRect(40, 118, 20, 96); g.fillRect(160, 126, 20, 89); g.fillRect(276, 118, 20, 96)
      g.fillStyle = '#5a3e28'
      g.fillRect(40, 118, 6, 96); g.fillRect(276, 118, 6, 96)
      // 横撑
      g.fillStyle = '#4a3220'; g.fillRect(48, 176, 240, 10)
      g.restore()
    }
  })
  def("popo_tea_set", {
    clickable: true, say: '这套是待客的呀，一直凑得齐齐的',
    name: "待客茶具 · 成套", cat: "器物", tags: ["茶","成套"],
    scope: "character", fromRoom: 'popo',
    w: 150, h: 86, base: 86, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      // 托盘
      pxE(75, 76, 72, 12, '#4a3220')
      pxE(75, 72, 68, 10, '#6a4a30')
      // 壶（釉色一致，成套的关键）
      pxE(40, 48, 26, 20, '#3a3448')
      pxE(40, 44, 24, 18, '#a8c8e0')
      pxE(40, 38, 20, 12, '#c8dcec')
      g.fillStyle = '#a8c8e0'; g.fillRect(62, 36, 14, 6)      // 壶嘴
      g.fillStyle = '#8ab0cc'; g.fillRect(14, 34, 6, 16)      // 把
      g.fillStyle = '#e8b23d'; g.fillRect(34, 24, 12, 6)      // 盖钮
      // 四只杯，一模一样，摆得整整齐齐
      for (let k = 0; k < 4; k++) {
        const cx = 92 + (k % 2) * 30, cy = 40 + ((k / 2) | 0) * 26
        pxE(cx, cy + 8, 13, 6, '#3a3448')
        pxE(cx, cy, 13, 9, '#a8c8e0')
        pxE(cx, cy - 3, 11, 6, '#c8dcec')
        g.fillStyle = '#8ab0cc'; g.fillRect(cx - 11, cy - 2, 22, 2)
      }
      g.restore()
    }
  })
  def("popo_own_cup", {
    clickable: true, say: '我的这只？缺了一小块，不碍事的呀',
    sayDeep: '用惯了，换新的，手就不知道往哪儿放了',
    name: "她的杯子 · 缺口", cat: "器物", tags: ["杯","她自己的"],
    scope: "character", fromRoom: 'popo',
    w: 62, h: 62, base: 62, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      // 粗陶，比那套茶具土，釉不匀，颜色也不是一路的。
      // 提亮到跟木桌拉得开 —— 原本同色系，缩到 62px 就糊成一块木头。
      pxE(31, 54, 20, 7, '#2a2430')
      g.fillStyle = '#1f1a26'; g.fillRect(12, 16, 38, 38)      // 深轮廓
      g.fillStyle = '#c4b294'; g.fillRect(14, 18, 34, 34)
      g.fillStyle = '#d8c8ac'; g.fillRect(14, 18, 34, 9)       // 杯沿高光
      g.fillStyle = '#a89478'; g.fillRect(14, 44, 34, 8)
      // 釉裂
      g.fillStyle = '#8a7458'; g.fillRect(22, 28, 2, 14); g.fillRect(36, 34, 2, 10)
      // ★缺口 —— 杯沿右上豁掉一块，直接切到轮廓外，看得出是「破的」
      g.fillStyle = '#1f1a26'; g.fillRect(38, 16, 12, 4)
      g.fillStyle = '#8a7458'; g.fillRect(38, 20, 10, 5)
      g.fillStyle = '#a89478'; g.fillRect(40, 25, 6, 3)
      // 把手（补过，用铜丝箍着）
      g.fillStyle = '#1f1a26'; g.fillRect(48, 26, 8, 18)
      g.fillStyle = '#c4b294'; g.fillRect(49, 28, 5, 14)
      g.fillStyle = '#c9a26a'; g.fillRect(47, 33, 9, 3)
      g.restore()
    }
  })
  def("popo_candy_jar", {
    clickable: true, say: '来，吃颗糖，不吃不许走哦',
    name: "糖罐 · 满出来", cat: "器物", tags: ["糖","给别人的"],
    scope: "generic", fromRoom: 'popo',
    w: 76, h: 96, base: 96, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      pxE(38, 84, 30, 8, '#2e2838')
      // 玻璃罐身
      g.fillStyle = 'rgba(226,236,240,0.55)'; g.fillRect(10, 24, 56, 62)
      g.fillStyle = 'rgba(255,255,255,0.30)'; g.fillRect(16, 30, 8, 40)
      // 塞得满满的糖（彩色，堆到罐口以上）
      const CC = ['#e8556a', '#e8b23d', '#68c048', '#48a0c0', '#c884e0', '#e8874a']
      for (let k = 0; k < 22; k++) {
        const cx = 15 + (k * 37 % 46), cy = 36 + ((k * 23) % 46)
        g.fillStyle = CC[k % 6]; g.fillRect(cx, cy, 9, 9)
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(cx, cy, 9, 3)
      }
      // 盖子歪着盖不上 —— 因为太满了
      g.fillStyle = '#c9a26a'
      g.save(); g.translate(38, 20); g.rotate(0.20); g.fillRect(-30, -9, 60, 14); g.restore()
      g.fillStyle = '#e8b23d'
      g.save(); g.translate(38, 20); g.rotate(0.20); g.fillRect(-30, -9, 60, 5); g.restore()
      // 溢到桌上的两颗
      g.fillStyle = '#e8556a'; g.fillRect(2, 80, 9, 9)
      g.fillStyle = '#68c048'; g.fillRect(66, 82, 9, 9)
      g.restore()
    }
  })
  def("popo_own_bowl", {
    clickable: true, say: '碗？一只就够啦',
    sayDeep: '煮多了就分给它们，反正也吃不完呀',
    name: "她的碗 · 一只", cat: "器物", tags: ["碗","她自己的"],
    scope: "character", fromRoom: 'popo',
    w: 68, h: 50, base: 50, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      // 一只碗，扣着 —— 洗过了，收着，没人来吃
      pxE(34, 44, 27, 6, '#2e2838')
      pxE(34, 34, 27, 12, '#8a7458')
      pxE(34, 28, 25, 11, '#a08a6c')
      pxE(34, 22, 20, 8, '#b09a7c')
      // 碗底那圈
      g.fillStyle = '#7a6448'; g.fillRect(24, 14, 20, 4)
      // 一道补过的锔钉
      g.fillStyle = '#a89060'; g.fillRect(18, 26, 3, 8); g.fillRect(46, 28, 3, 7)
      // 旁边一双筷子，也只有一双
      g.fillStyle = '#6a4a30'
      g.save(); g.translate(56, 30); g.rotate(-0.25)
      g.fillRect(0, 0, 3, 22); g.fillRect(6, 0, 3, 22); g.restore()
      g.restore()
    }
  })
  def("popo_rocking_chair", {
    clickable: true, say: '坐这个的时候，它们都会围过来的呀',
    name: "摇椅", cat: "坐卧", tags: ["椅","摇"],
    scope: "generic", fromRoom: 'popo',
    w: 220, h: 220, base: 220, foot: [6, 140, 208, 74], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 弧形摇脚
      g.strokeStyle = '#2e2838'; g.lineWidth = 11
      g.beginPath(); g.moveTo(6, 194); g.quadraticCurveTo(110, 218, 214, 190); g.stroke()
      g.strokeStyle = '#3a3040'; g.lineWidth = 5
      g.beginPath(); g.moveTo(8, 190); g.quadraticCurveTo(110, 212, 212, 186); g.stroke()
      // 立柱与椅背
      g.fillStyle = '#3a3040'
      g.fillRect(20, 26, 16, 168); g.fillRect(184, 26, 16, 168)
      g.fillRect(20, 16, 180, 18)
      g.fillStyle = '#2e2838'
      for (let k = 0; k < 5; k++) g.fillRect(28, 44 + k * 30, 164, 12)
      // 座面
      g.fillStyle = '#4a3f52'; g.fillRect(16, 148, 188, 20)
      g.fillStyle = '#5a4f62'; g.fillRect(16, 148, 188, 6)
      // 扶手
      g.fillStyle = '#3a3040'; g.fillRect(6, 132, 30, 12); g.fillRect(184, 132, 30, 12)
      g.restore()
    }
  })
  def("popo_own_shawl", {
    clickable: true, say: '披肩？还能用呀，破的地方在背后，看不见的',
    sayDeep: '给它们织的时候顺手就织完了，轮到自己……就忘了',
    name: "她的披肩 · 磨破", cat: "布艺", tags: ["披肩","她自己的"],
    scope: "character", fromRoom: 'popo',
    w: 180, h: 128, base: 128, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 搭在椅背上，一面垂下来。灰紫，洗到发白
      g.fillStyle = '#6a5f74'
      g.beginPath(); g.moveTo(6, 6); g.lineTo(174, 6); g.lineTo(166, 84); g.lineTo(14, 84); g.fill()
      g.fillStyle = '#7a6f84'
      g.beginPath(); g.moveTo(6, 6); g.lineTo(174, 6); g.lineTo(172, 26); g.lineTo(8, 26); g.fill()
      // 织纹（起伏的横棱）
      g.fillStyle = '#5c5266'
      for (let k = 0; k < 5; k++) g.fillRect(12 + k, 32 + k * 11, 158 - k * 2, 4)
      // ★磨破的两处 —— 边缘散线、露出底
      g.fillStyle = '#4a4054'; g.fillRect(120, 52, 26, 18)
      g.fillStyle = '#3a3244'; g.fillRect(126, 58, 13, 8)
      g.fillStyle = '#4a4054'; g.fillRect(30, 68, 18, 12)
      // 散出来的线头
      g.strokeStyle = '#8a7f94'; g.lineWidth = 2
      g.beginPath(); g.moveTo(146, 62); g.quadraticCurveTo(158, 72, 152, 88); g.stroke()
      g.beginPath(); g.moveTo(34, 80); g.quadraticCurveTo(28, 92, 36, 102); g.stroke()
      // 下摆流苏，缺了几根
      g.fillStyle = '#6a5f74'
      for (let k = 0; k < 11; k++) { if (k === 3 || k === 8) continue
        g.fillRect(18 + k * 14, 84, 5, 18) }
      g.restore()
    }
  })
  def("popo_sweater_pile", {
    clickable: true, say: '这些都织好了，等天冷就给它们穿上',
    name: "毛衣 · 堆成山", cat: "布艺", tags: ["毛衣","给别人的"],
    scope: "character", fromRoom: 'popo',
    w: 132, h: 126, base: 126, foot: [0, 62, 132, 60], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 一摞叠好的小毛衣，颜色各不一样 —— 每只一件
      const CO = [['#d86aa0','#c04888'], ['#68a8d8','#4888b8'], ['#e8b23d','#c89020'],
                  ['#78c078','#58a058'], ['#c884e0','#a464c0'], ['#e8874a','#c86828']]
      for (let k = 5; k >= 0; k--) {
        const y = 100 - k * 15, w = 116 - (5 - k) * 4, x = 8 + (5 - k) * 2 + (k % 2) * 4
        g.fillStyle = CO[k][1]; g.fillRect(x, y, w, 16)
        g.fillStyle = CO[k][0]; g.fillRect(x, y, w, 11)
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, w, 3)
        // 折起来的袖口
        g.fillStyle = CO[k][1]; g.fillRect(x + 6, y + 4, 8, 10); g.fillRect(x + w - 14, y + 4, 8, 10)
      }
      // 最上面一件摊着，能看出是件小毛衣（有袖）
      g.fillStyle = '#f2c4dc'
      g.fillRect(30, 6, 44, 22)
      g.fillRect(14, 10, 18, 11); g.fillRect(72, 10, 18, 11)
      g.fillStyle = '#d86aa0'; g.fillRect(30, 6, 44, 5); g.fillRect(30, 24, 44, 4)
      g.restore()
    }
  })
  def("popo_yarn_basket", {
    fx(g, t, X, Y) {
      // 织了一半的活计，针一下一下地动 —— 她一坐下就织
      const s = Math.sin(t / 620) * 3
      g.fillStyle = '#d8ccb4'
      g.fillRect(X + 96 + s, Y + 6 - s, 5, 44); g.fillRect(X + 112 + s * 0.7, Y + 2, 5, 46)
    },
    clickable: true, say: '还差两只袖子呢',
    name: "毛线筐", cat: "器物", tags: ["毛线","织"],
    scope: "generic", fromRoom: 'popo',
    w: 148, h: 116, base: 116, foot: [0, 50, 148, 62], zLayer: 'low',
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      // 藤筐
      pxE(74, 88, 62, 24, '#7a4a28')
      pxE(74, 80, 58, 22, '#a06a40')
      pxE(74, 70, 52, 16, '#8a5430')
      g.fillStyle = '#8a5430'
      for (let k = 0; k < 7; k++) g.fillRect(18 + k * 16, 72, 4, 26)
      // 毛线球三只
      pxC(40, 58, 18, '#e858a0'); pxC(36, 54, 7, '#ff8ac0')
      pxC(76, 50, 15, '#68a8d8'); pxC(73, 47, 6, '#98c8e8')
      pxC(108, 58, 13, '#e8b23d'); pxC(105, 55, 5, '#ffd76a')
      // 织了一半的活计搭在筐沿上
      g.fillStyle = '#e858a0'; g.fillRect(96, 48, 34, 34)
      g.fillStyle = '#ff8ac0'; g.fillRect(96, 54, 34, 4); g.fillRect(96, 66, 34, 4)
      g.fillStyle = '#c04080'; g.fillRect(96, 78, 34, 4)
      g.restore()
    }
  })
  def("popo_omamori_door", {
    // ★★ 第四对：挂满的御守 ↔ 一枚空钩。对照做在同一件素材内部 ——
    // 「她自己没有」画不出实物，空钩就是那件实物。
    light: { x: 88, y: 96, r: 118, color: '#ffcf80', flicker: 0.18 },
    clickable: true, say: '这枚是送错的哦，婆婆说——送对了',
    sayDeep: '给我自己求的？……哎呀，我不兴那个',
    name: "门边御守架", cat: "结构", tags: ["御守","门","核心"],
    scope: "character", fromRoom: 'popo',
    w: 176, h: 210, base: 210, foot: [34, 178, 96, 28], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 立杆与横木
      g.fillStyle = '#5a3a20'; g.fillRect(74, 22, 20, 178)
      g.fillStyle = '#6a4a30'; g.fillRect(74, 22, 7, 178)
      g.fillStyle = '#5a3a20'; g.fillRect(10, 22, 156, 16)
      g.fillStyle = '#7e5230'; g.fillRect(10, 22, 156, 5)
      // 底座
      g.fillStyle = '#4a3220'; g.fillRect(48, 190, 72, 20)
      // 挂钩一排（7 个），前 6 个挂满，第 7 个空着
      const OM = [['#d84a34','#f0a89c'], ['#e8b23d','#f6dfa8'], ['#48a0c0','#a8dcec'],
                  ['#68c048','#b8e8b0'], ['#c884e0','#e8ccf6'], ['#e8874a','#f6c4a0']]
      for (let k = 0; k < 7; k++) {
        const hx = 16 + k * 22
        g.fillStyle = '#c9a26a'; g.fillRect(hx + 3, 38, 4, 10)
        if (k === 6) {
          // ★空钩 —— 这一枚是她自己的位置。钩子在，绳圈还系着，
          // 绳子下面什么都没有。「她自己没有」画不出实物，空钩就是那件实物。
          // 原先只画了个 4px 的浅印子，缩到实际尺寸根本看不见 —— 这间房的
          // 立意全压在这一格上，得让它读得出来。
          g.fillStyle = '#8a7040'; g.fillRect(hx, 44, 10, 5)       // 钩座
          g.fillStyle = '#c9a26a'; g.fillRect(hx + 1, 44, 8, 2)
          // 空绳圈：系上去了，下面是空的
          g.fillStyle = '#c8b48a'
          g.fillRect(hx + 2, 49, 2, 9); g.fillRect(hx + 7, 49, 2, 9)
          g.fillRect(hx + 2, 58, 7, 2)
          // 木牌一枚，没写字（别人的都写了名字，这枚是空白的）
          g.fillStyle = '#5a4632'; g.fillRect(hx - 1, 62, 13, 16)
          g.fillStyle = '#7a6248'; g.fillRect(hx, 63, 11, 14)
          continue
        }
        // 挂绳
        g.fillStyle = '#c8b48a'; g.fillRect(hx + 4, 46, 3, 16)
        // 御守本体：锦布小袋 + 束口绳 + 一道金线
        g.fillStyle = '#2e2838'; g.fillRect(hx - 2, 60, 17, 30)
        g.fillStyle = OM[k][0]; g.fillRect(hx - 1, 61, 15, 28)
        g.fillStyle = OM[k][1]; g.fillRect(hx - 1, 61, 15, 7)
        g.fillStyle = '#e8b23d'; g.fillRect(hx + 1, 72, 11, 3)
        g.fillStyle = '#f6efdc'; g.fillRect(hx + 4, 78, 5, 7)
      }
      // 下面一层挂得更乱 —— 后来的都随手挂上去了
      for (let k = 0; k < 5; k++) {
        const hx = 26 + k * 26, d = (k % 2) * 6
        g.fillStyle = '#c8b48a'; g.fillRect(hx + 5, 96 + d, 3, 12)
        g.fillStyle = '#2e2838'; g.fillRect(hx, 106 + d, 15, 26)
        g.fillStyle = ['#d86aa0','#48a0c0','#e8b23d','#68c048','#c884e0'][k]
        g.fillRect(hx + 1, 107 + d, 13, 24)
        g.fillStyle = '#e8b23d'; g.fillRect(hx + 3, 116 + d, 9, 3)
      }
      // 一枚小铃铛（她自己唯一挂上去的东西，是别人给的）
      g.fillStyle = '#e8b23d'; g.fillRect(128, 140, 12, 12)
      g.fillStyle = '#a87820'; g.fillRect(130, 148, 8, 4)
      g.restore()
    }
  })
  def("popo_slippers_guest", {
    clickable: true, say: '拖鞋随便穿呀，哪双都行',
    name: "给客人的拖鞋", cat: "器物", tags: ["鞋","给别人的"],
    scope: "character", fromRoom: 'popo',
    w: 180, h: 60, base: 60, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      // 三双，摆得整整齐齐，毛绒的，还很新
      const CO = [['#7a5a9a','#8a6aaa'], ['#c04888','#d86aa0'], ['#48a0c0','#68b8d8']]
      for (let k = 0; k < 3; k++) {
        const x = 4 + k * 30
        pxE(x + 10, 22, 11, 6, CO[k][0]); pxC(x + 6, 17, 6, CO[k][1])
        pxE(x + 10, 34, 11, 6, CO[k][0]); pxC(x + 6, 29, 6, CO[k][1])
        g.fillStyle = 'rgba(255,255,255,0.22)'
        g.fillRect(x + 3, 15, 6, 2); g.fillRect(x + 3, 27, 6, 2)
      }
      g.restore()
    }
  })
  def("popo_slippers_own", {
    clickable: true, say: '我这双？穿了好些年啦，可舒服',
    name: "她那双 · 磨平了", cat: "器物", tags: ["鞋","她自己的"],
    scope: "character", fromRoom: 'popo',
    w: 76, h: 52, base: 52, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      // 一双，毛都秃了，底磨薄，颜色也说不上是什么颜色了
      pxE(15, 20, 12, 6, '#6a6070')
      pxE(15, 32, 12, 6, '#6a6070')
      pxE(15, 18, 11, 5, '#7a7080')
      pxE(15, 30, 11, 5, '#7a7080')
      // 秃掉的毛边（只剩零星几撮）
      g.fillStyle = '#8a8090'
      g.fillRect(6, 13, 4, 2); g.fillRect(18, 12, 3, 2); g.fillRect(9, 25, 3, 2)
      // 磨穿的一处，露出里衬
      g.fillStyle = '#4a4250'; g.fillRect(22, 30, 7, 4)
      // 后跟踩塌了
      g.fillStyle = '#5a5260'; g.fillRect(24, 16, 6, 6); g.fillRect(24, 28, 6, 6)
      g.restore()
    }
  })
  def("popo_bowl_shelf", {
    clickable: true, say: '碗要多备几只呀，谁来了都得吃口热的',
    name: "碗架", cat: "收纳", tags: ["碗","架"],
    scope: "character", fromRoom: 'popo',
    w: 210, h: 130, base: 130, foot: [0, 74, 210, 56], zLayer: 'sort',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      // 木架
      g.fillStyle = '#4a3220'; g.fillRect(0, 54, 210, 12)
      g.fillRect(4, 66, 14, 60); g.fillRect(192, 66, 14, 60)
      g.fillStyle = '#5a3e28'; g.fillRect(0, 54, 210, 4)
      g.fillStyle = '#4a3220'; g.fillRect(0, 116, 210, 12)
      // ★给别人的：一摞碗，八九只，摞得高高的
      for (let k = 0; k < 8; k++) {
        const y = 48 - k * 6
        pxE(56, y, 40, 6, k % 2 ? '#c8bca0' : '#d8ccb0')
        g.fillStyle = '#a89878'; g.fillRect(20, y - 1, 72, 1)
      }
      pxE(56, 0, 34, 7, '#e8dcc0')
      // 旁边第二摞（还是给别人的）
      for (let k = 0; k < 5; k++) {
        const y = 50 - k * 6
        pxE(140, y, 32, 5, k % 2 ? '#c8bca0' : '#d8ccb0')
      }
      // 架子下层：她自己那只，单独扣着，跟上面不是一套
      pxE(170, 108, 22, 9, '#8a7458')
      pxE(170, 104, 20, 8, '#a08a6c')
      g.restore()
    }
  })
  def("popo_stove", {
    light: { x: 150, y: 236, r: 150, color: '#ff9e4a', flicker: 0.4 },
    fx(g, t, X, Y) {
      // 蒸汽与灶火都走引擎原语 —— 此前是「方块往上飘」加「橙色矩形上下缩放」
      globalThis.fxSmoke(g, X + 128, Y + 96, { t, n: 5, rise: 92, r: 6, spread: 16, speed: 2600, alpha: 0.26 })
      // 灶膛里烧着一【堆】火:五簇挨在一起、高低错落，合起来是一团而不是三根蜡烛。
      // 底下垫一层宽而矮的橙红，把几簇焊成一堆，火根才不会各烧各的。
      globalThis.fxFlame(g, X + 150, Y + 272, { t, w: 58, h: 78, seed: 0 })
    },
    clickable: true, say: '今天煮多了呢……哎呀，每天都多',
    sayDeep: '一个人的量我早忘了怎么算啦',
    name: "灶台 + 大锅", cat: "器物", tags: ["灶","锅","饭"],
    scope: "character", fromRoom: 'popo',
    w: 300, h: 300, base: 300, foot: [16, 196, 268, 104], zLayer: 'sort',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      // 砖砌灶身
      g.fillStyle = '#4a4050'; g.fillRect(16, 108, 268, 192)
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 4; c++) {
          g.fillStyle = (r + c) % 2 ? '#544a5e' : '#4a4050'
          g.fillRect(22 + c * 66 + (r % 2) * 33, 114 + r * 38, 60, 32)
        }
      // 灶口
      g.fillStyle = '#141018'; g.fillRect(96, 216, 112, 72)
      g.fillStyle = '#2e2838'; g.fillRect(88, 208, 128, 12)
      // 柴
      g.fillStyle = '#3a2418'
      g.fillRect(104, 266, 70, 12); g.fillRect(128, 256, 62, 11)
      // 灶台面
      g.fillStyle = '#38304a'; g.fillRect(6, 92, 288, 20)
      g.fillStyle = '#4a4258'; g.fillRect(6, 92, 288, 7)
      // 大锅（黑铁，比一个人该用的大一圈）
      pxE(150, 76, 104, 40, '#1a1620')
      pxE(150, 66, 98, 34, '#2a2430')
      pxE(150, 48, 92, 20, '#141018')
      // 锅盖，盖不严，歪着
      g.fillStyle = '#3a3444'
      g.save(); g.translate(150, 44); g.rotate(0.06); g.fillRect(-84, -10, 168, 18); g.restore()
      g.fillStyle = '#4a4458'
      g.save(); g.translate(150, 44); g.rotate(0.06); g.fillRect(-84, -10, 168, 6); g.restore()
      g.fillStyle = '#c9a26a'
      g.save(); g.translate(150, 44); g.rotate(0.06); g.fillRect(-12, -20, 24, 12); g.restore()
      // 锅耳
      g.fillStyle = '#2a2430'; g.fillRect(42, 56, 16, 22); g.fillRect(242, 56, 16, 22)
      g.restore()
    }
  })
  // ── 占卜与器物 ───────────────────────────────────────────────
  def("popo_crystal_ball", {
    fx(g, t, X, Y, o, room) {
      // 待机时球里只是慢慢转的雾。点了「请婆婆看水晶球」才真的醒过来 ——
      // 这个动作的主角是球，不是她走过去这一段路。球不亮，玩家就会觉得
      // 按钮没反应（她其实每次都走到了，是没有东西告诉玩家「开始了」）。
      const R = room
      const on = !!(R && R.state && R.state.casting)
      const b = 0.5 + Math.sin(t / 900) * 0.22
      const heat = on ? 1 : 0

      // 醒着时球里起能量波动 —— 变化全在【球内】，不改屋子的亮度。
      // 先前做成开关式的爆亮加光锥，在小屏上就是闪一下，看着难受;
      // 有机的、持续的流动比一次性的亮更像「里头有东西在动」。
      if (heat) {
        // 几缕能量沿弧线缓慢流动，各自聚散，互不同步
        for (let k = 0; k < 5; k++) {
          const rr = 11 + Math.sin(t / 950 + k * 2.1) * 9
          const a0 = t / 1500 + k * 1.26
          for (let j = 0; j < 4; j++) {
            const aa = a0 + j * 0.17
            const al = 0.34 - j * 0.06 + Math.sin(t / 330 + k) * 0.10
            if (al <= 0) continue
            g.fillStyle = 'rgba(206,242,255,' + al.toFixed(3) + ')'
            g.fillRect(X + 58 + Math.cos(aa) * rr, Y + 50 + Math.sin(aa) * rr * 0.86, 5, 5)
          }
        }
        // 球心一点很轻的呼吸，幅度压住 —— 让球「活着」，不是「亮起来」
        const br = 0.16 + Math.sin(t / 640) * 0.07
        const gl = g.createRadialGradient(X + 58, Y + 50, 1, X + 58, Y + 50, 34)
        gl.addColorStop(0, 'rgba(226,248,255,' + (br + 0.14).toFixed(3) + ')')
        gl.addColorStop(1, 'rgba(180,230,250,0)')
        g.fillStyle = gl; g.fillRect(X + 18, Y + 10, 80, 80)

        // 球面缓慢转的符文刻度 —— 呼应地毯上的五芒星，说明这是【她在做法】，
        // 不是球自己在发光。用暖金而不是冷白:屋子的色温一格都不许动。
        for (let k = 0; k < 14; k++) {
          const aa = t / 2900 + k * (6.283 / 14)
          const al = 0.16 + Math.sin(t / 520 + k * 0.8) * 0.13
          if (al <= 0) continue
          g.fillStyle = 'rgba(255,214,120,' + al.toFixed(3) + ')'
          g.fillRect(X + 58 + Math.cos(aa) * 31, Y + 50 + Math.sin(aa) * 27, 3, 3)
        }

        // 缓慢升起的星火:稀疏、慢、各自淡出 —— 持续的动比一次的亮更有看头，
        // 而且不会在小屏上「闪一下」
        for (let k = 0; k < 7; k++) {
          const ph = ((t / 2400 + k * 0.143) % 1)
          const al = 0.46 * (1 - ph) * (ph < 0.12 ? ph / 0.12 : 1)
          if (al <= 0.02) continue
          g.fillStyle = 'rgba(255,228,156,' + al.toFixed(3) + ')'
          g.fillRect(X + 30 + k * 8 + Math.sin(ph * 5.2 + k) * 9, Y + 42 - ph * 92, 3, 3)
        }

        // 她与球之间的一线牵引 —— 读牌的人和被读的东西连着
        const pull = 0.20 + Math.sin(t / 430) * 0.10
        g.fillStyle = 'rgba(255,222,150,' + pull.toFixed(3) + ')'
        for (let j = 0; j < 5; j++) g.fillRect(X + 56, Y + 6 - j * 11 - (t / 90 % 11), 3, 5)
      }
      g.fillStyle = 'rgba(160,220,245,' + (0.20 * b + heat * 0.16) + ')'
      g.fillRect(X + 8, Y + 8, 100, 100)

      // 雾:待机三缕慢转，醒着时翻涌、加快、散得开
      const n = on ? 7 : 3
      for (let k = 0; k < n; k++) {
        const sp = on ? 900 : 1800
        const a = t / sp + k * (6.28 / n)
        const rr = on ? 15 + Math.sin(t / 420 + k * 1.7) * 13 : 22
        g.fillStyle = 'rgba(220,245,255,' + (0.26 + Math.sin(t / 700 + k) * 0.12 + heat * 0.2) + ')'
        g.fillRect(X + 58 + Math.cos(a) * rr, Y + 52 + Math.sin(a) * rr * 0.74, on ? 8 : 7, on ? 8 : 7)
      }

    },
    clickable: true, say: '球里说……嗯，这是秘密哦',
    name: "水晶球", cat: "器物", tags: ["水晶球","占卜"],
    scope: "generic", fromRoom: 'popo',
    w: 116, h: 116, base: 116, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      pxE(58, 102, 40, 12, '#2e2838')
      pxE(58, 96, 34, 10, '#4a4258')
      g.fillStyle = '#c9a26a'; g.fillRect(34, 88, 48, 6)
      pxC(58, 50, 46, '#6a9cc0')
      pxC(58, 50, 42, '#8ac8e8')
      pxC(46, 38, 14, '#d8f0f8')
      pxC(70, 62, 9, '#68a8d0')
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(40, 30, 8, 8)
      g.restore()
    }
  })
  def("popo_candles", {
    light: { x: 46, y: 20, r: 130, color: '#ffc864', flicker: 0.35 },
    fx(g, t, X, Y) {
      const hs = [26, 48, 16]
      for (let k = 0; k < 3; k++) {
        const b = 0.8 + Math.sin(t / 260 + k * 2.2) * 0.2
        g.fillStyle = 'rgba(255,215,106,0.92)'
        g.fillRect(X + 8 + k * 26, Y + 44 - hs[k] - 12 * b, 8, 14 * b)
        g.fillStyle = 'rgba(255,255,230,0.95)'
        g.fillRect(X + 10 + k * 26, Y + 44 - hs[k] - 7 * b, 4, 7 * b)
      }
    },
    clickable: true, say: '蜡烛要一直点着的呀，回来的时候看得见门',
    name: "烛台组", cat: "灯火", tags: ["蜡烛","光"],
    scope: "generic", fromRoom: 'popo',
    w: 92, h: 70, base: 70, foot: [0, 44, 92, 24], zLayer: 'low',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      pxE(46, 64, 42, 8, '#2e2838')
      pxE(46, 60, 38, 7, '#4a4258')
      const hs = [26, 48, 16]
      for (let k = 0; k < 3; k++) {
        const cx2 = 8 + k * 26, h2 = hs[k]
        g.fillStyle = '#e8e0d0'; g.fillRect(cx2, 58 - h2, 16, h2)
        g.fillStyle = '#f6efdc'; g.fillRect(cx2, 58 - h2, 6, h2)
        g.fillStyle = '#d0c8b8'; g.fillRect(cx2 + 12, 58 - h2 + 6, 4, 12)
        g.fillStyle = '#1a1620'; g.fillRect(cx2 + 6, 54 - h2, 3, 5)
      }
      g.restore()
    }
  })
  def("popo_floating_candles", {
    fx(g, t, X, Y) {
      // 半空的蜡烛，无影，缓缓上下
      for (let k = 0; k < 3; k++) {
        const yy = Math.sin(t / 1500 + k * 2) * 7
        const b = 0.8 + Math.sin(t / 300 + k * 1.7) * 0.2
        g.fillStyle = 'rgba(255,215,106,0.9)'
        g.fillRect(X + 26 + k * 100, Y + 30 + yy - 12 * b, 8, 14 * b)
        g.fillStyle = 'rgba(255,255,230,0.95)'
        g.fillRect(X + 28 + k * 100, Y + 30 + yy - 7 * b, 4, 7 * b)
      }
    },
    clickable: true, say: '这几支不用管的，它们自己会飘',
    name: "浮空蜡烛", cat: "灯火", tags: ["蜡烛","漂浮"],
    scope: "character", fromRoom: 'popo',
    w: 300, h: 130, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      for (let k = 0; k < 3; k++) {
        const cx2 = 22 + k * 100, cy2 = 30 + (k % 2) * 22, h2 = [40, 52, 34][k]
        g.fillStyle = '#e8e0d0'; g.fillRect(cx2, cy2, 16, h2)
        g.fillStyle = '#f6efdc'; g.fillRect(cx2, cy2, 6, h2)
        g.fillStyle = '#d0c8b8'; g.fillRect(cx2 + 12, cy2 + 6, 4, 12)
        g.fillStyle = '#1a1620'; g.fillRect(cx2 + 6, cy2 - 5, 3, 6)
      }
      g.restore()
    }
  })
  def("popo_rug_star", {
    // 她做法时，阵图跟着醒 —— 这块地毯 580×560，是屋里最大的图形。
    // 表演的看头必须落在【大东西】上:先前把符文与星火画成 3px 小方块，
    // 缩到真机就全没了，玩家的判断是「几乎没有特效」。
    // 用暖金而非冷白:屋子的色温一格都不动（冷白光源曾把蜡烛洗成白的）。
    fx(g, t, X, Y, o, room) {
      const R = room
      if (!(R && R.state && R.state.casting)) return
      const cx = X + 290, cy = Y + 280
      g.save()
      g.globalCompositeOperation = 'lighter'      // 叠加发光 —— 金线在原图上亮起来
      const breath = 0.5 + 0.5 * Math.sin(t / 380) // 整阵呼吸

      // 六芒星六顶点(与 draw 一致:半径 226/218)
      const V = []
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 3
        V.push([cx + Math.cos(a) * 226, cy + Math.sin(a) * 218])
      }
      const triA = [0, 2, 4, 0], triB = [1, 3, 5, 1]   // 双三角

      // ① 双金环脉动发光(沿 draw 的 262/252 与 236/226)
      for (const [rx, ry, w, base] of [[262, 252, 6, 0.20], [236, 226, 3, 0.26]]) {
        g.strokeStyle = 'rgba(255,220,120,' + (base + 0.24 * breath).toFixed(3) + ')'
        g.lineWidth = w
        g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.stroke()
      }

      // ② 双三角金线常亮发光(脉动)—— 这是「金色都金光闪闪」的主体
      g.lineJoin = 'round'
      for (const tri of [triA, triB]) {
        g.strokeStyle = 'rgba(255,232,158,' + (0.16 + 0.22 * breath).toFixed(3) + ')'
        g.lineWidth = 7
        g.beginPath()
        tri.forEach((vi, i) => i ? g.lineTo(V[vi][0], V[vi][1]) : g.moveTo(V[vi][0], V[vi][1]))
        g.stroke()
      }

      // ③ 一段更亮的流光沿六芒星边跑 —— 说明「阵在走」
      const edges = []
      for (const tri of [triA, triB])
        for (let i = 0; i < 3; i++) edges.push([V[tri[i]], V[tri[i + 1]]])
      const nE = edges.length, head = (t / 1500) % nE
      edges.forEach(([A, B], ei) => {
        for (let u = 0; u < 22; u++) {
          const f = u / 21, pos = ei + f
          let d = Math.abs(pos - head); d = Math.min(d, nE - d)
          const al = Math.max(0, 0.62 - d * 1.3)
          if (al <= 0.02) continue
          g.fillStyle = 'rgba(255,246,206,' + al.toFixed(3) + ')'
          g.fillRect(A[0] + (B[0] - A[0]) * f - 4, A[1] + (B[1] - A[1]) * f - 4, 8, 8)
        }
      })

      // ④ 六顶点脉冲闪烁 —— 金光一闪一闪
      V.forEach(([x, y], k) => {
        const al = 0.30 + 0.42 * (0.5 + 0.5 * Math.sin(t / 300 + k * 1.05))
        const r = 15 + 5 * Math.sin(t / 250 + k)
        const gr = g.createRadialGradient(x, y, 1, x, y, r)
        gr.addColorStop(0, 'rgba(255,240,180,' + al.toFixed(3) + ')')
        gr.addColorStop(1, 'rgba(255,210,100,0)')
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2)
      })

      // ⑤ 沐浴圣光:密集光尘从法阵满盘升起，各自向上飘、明灭、忽左忽右。
      // 用黄金比派生每颗的相位/寿命/起点，t 驱动 —— 确定性但看着是自由飘动。
      // 越往中轴越密（她站在那儿），营造被光尘裹住的感觉。
      const N = 96
      for (let k = 0; k < N; k++) {
        const s = (k * 0.6180339887) % 1
        const s2 = (k * 0.3183098861) % 1
        const s3 = (k * 0.7548776662) % 1
        const s4 = (k * 0.4655712319) % 1
        const period = 1900 + s * 1900
        const ph = (((t + s * 1e5) % period) / period)      // 0..1 一生
        // 起点向中轴聚拢:s4 平方拉近中心
        const spread = (s - 0.5) * 2                          // -1..1
        const startX = cx + Math.sign(spread) * (spread * spread) * 226
        const x = startX + Math.sin(ph * 6.283 + k * 1.7) * (14 + s2 * 22)
        const y = (cy + 140) - ph * (300 + s3 * 190)         // 从盘底升起
        const al = Math.sin(ph * Math.PI) * (0.5 + s2 * 0.45) // 抛物线明灭
        if (al <= 0.03) continue
        const sz = 2 + (s3 * 3 | 0)
        const col = s4 < 0.4 ? '255,247,212' : s4 < 0.74 ? '255,224,144' : '255,242,255'
        // 光晕(方块近似，省掉每帧 createRadialGradient)
        if (s2 > 0.5) {
          g.fillStyle = 'rgba(' + col + ',' + (al * 0.30).toFixed(3) + ')'
          g.fillRect(x - sz - 3, y - sz - 3, sz * 2 + 6, sz * 2 + 6)
        }
        g.fillStyle = 'rgba(' + col + ',' + al.toFixed(3) + ')'
        g.fillRect(x - sz / 2, y - sz / 2, sz, sz)
      }
      g.restore()
    },
    clickable: true, say: '毯子是给它们趴的呀，我坐凳子就行',
    name: "星纹圆毯", cat: "地面", tags: ["毯","星"],
    scope: "character", fromRoom: 'popo',
    w: 580, h: 560, base: 0, foot: [0, 0, 0, 0],
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      pxE(290, 280, 288, 278, '#2e2440')
      pxE(290, 280, 274, 264, '#38304e')
      pxE(290, 280, 248, 238, '#3e3556')
      // 金边双环
      for (const [rx, ry, lw, col] of [[262, 252, 9, '#a87820'], [262, 252, 4, '#e8b23d'],
                                        [236, 226, 5, '#a87820'], [236, 226, 2, '#ffd76a']]) {
        g.strokeStyle = col; g.lineWidth = lw
        g.beginPath(); g.ellipse(290, 280, rx, ry, 0, 0, 7); g.stroke()
      }
      // 六芒星（双三角）
      for (const [lw, col] of [[13, '#a87820'], [8, '#ffd76a'], [3, 'rgba(255,250,220,0.7)']]) {
        g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'miter'
        for (const off of [0, Math.PI]) {
          g.beginPath()
          for (let k = 0; k <= 3; k++) {
            const a = -Math.PI / 2 + off + k * 2 * Math.PI / 3
            const x = 290 + Math.cos(a) * 226, y = 280 + Math.sin(a) * 218
            k ? g.lineTo(x, y) : g.moveTo(x, y)
          }
          g.closePath(); g.stroke()
        }
      }
      // 六顶点
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 3
        const x = 290 + Math.cos(a) * 226, y = 280 + Math.sin(a) * 218
        pxE(x, y, 11, 10, '#ffd76a'); pxE(x, y, 5, 5, '#8a5aba')
      }
      // 外圈符文 12 枚
      g.fillStyle = '#c8a0e8'
      for (let k = 0; k < 12; k++) {
        const a = k * 0.524
        const rx2 = 290 + Math.cos(a) * 246, ry2 = 280 + Math.sin(a) * 238
        if (k % 3 === 0) { g.fillRect(rx2 - 7, ry2 - 7, 14, 3); g.fillRect(rx2 - 2, ry2 - 7, 3, 14) }
        else if (k % 3 === 1) { g.fillRect(rx2 - 2, ry2 - 8, 3, 16); g.fillRect(rx2 - 7, ry2 - 2, 14, 3) }
        else { g.fillRect(rx2 - 6, ry2 - 7, 12, 3); g.fillRect(rx2 - 6, ry2 + 4, 12, 3) }
      }
      // 磨损（走得最多的一圈已经起毛）
      g.fillStyle = 'rgba(90,80,110,0.30)'
      for (let k = 0; k < 22; k++) {
        const a = k * 0.285
        g.fillRect(290 + Math.cos(a) * 190 - 5, 280 + Math.sin(a) * 182 - 5, 12, 6)
      }
      g.restore()
    }
  })
  def("popo_bed", {
    clickable: true, say: '床边留半边呀，夜里有小家伙要上来',
    name: "铁架床", cat: "坐卧", tags: ["床","星纹"],
    scope: "character", fromRoom: 'popo',
    w: 340, h: 430, base: 430, foot: [8, 296, 324, 134], zLayer: 'sort',
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const rnd=(function(a){return function(){a|=0;a=(a+0x6D2B79F5)|0
        let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t
        return((t^(t>>>14))>>>0)/4294967296}})(7)
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#1a1620'; g.fillRect(0, 18, 340, 412)
      g.fillStyle = '#2a2430'; g.fillRect(8, 26, 324, 396)
      g.fillStyle = '#38304e'; g.fillRect(16, 78, 308, 330)
      // 星纹被
      g.fillStyle = '#f6efdc'
      for (let k = 0; k < 16; k++) g.fillRect(36 + ((rnd() * 262) | 0), 96 + ((rnd() * 286) | 0), 5, 5)
      pxC(252, 138, 20, '#ffd76a'); pxC(264, 130, 17, '#38304e')
      // 枕头（两个：一个她的，一个给蹭过来的）
      g.fillStyle = '#e8e0d0'; g.fillRect(22, 34, 96, 40)
      g.fillStyle = '#d8d0c0'; g.fillRect(22, 62, 96, 12)
      g.fillStyle = '#c8bca8'; g.fillRect(128, 40, 74, 32)
      // 铁艺床头尖
      g.fillStyle = '#1a1620'
      for (let k = 0; k < 5; k++) g.fillRect(16 + k * 70, 0, 10, 26)
      // 被角掀开一块 —— 她起来后没铺
      g.fillStyle = '#4a4260'
      g.beginPath(); g.moveTo(240, 330); g.lineTo(324, 330); g.lineTo(324, 408); g.lineTo(262, 396); g.fill()
      g.restore()
    }
  })
  def("popo_laptop", {
    // 不给它光源：S1 定的是「整屋一种光」——她不分场合，屋里只有烛火那一种暖。
    // 冷蓝的屏幕光会把这条读法当场打断。
    clickable: true, say: '在线占卜，好评返现哦～',
    name: "笔记本 · 接单中", cat: "电器", tags: ["电脑","网店"],
    scope: "generic", fromRoom: 'popo',
    w: 132, h: 112, base: 112, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2e2a34'; g.fillRect(4, 0, 118, 68)
      g.fillStyle = '#8ac8e8'; g.fillRect(10, 6, 106, 56)
      g.fillStyle = '#c8a0e8'
      g.fillRect(18, 14, 42, 5); g.fillRect(18, 26, 68, 4); g.fillRect(18, 36, 54, 4)
      pxC(96, 34, 12, '#e8b23d')
      g.fillStyle = '#2e2a34'; g.fillRect(0, 68, 132, 42)
      g.fillStyle = '#3a3644'; g.fillRect(6, 72, 120, 32)
      g.fillStyle = '#4a4654'
      for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) g.fillRect(12 + c * 13, 76 + r * 9, 10, 6)
      g.restore()
    }
  })
  def("popo_coffee_cup", {
    clickable: true, say: '年轻人送的，说这个提神呀',
    name: "外卖咖啡杯", cat: "器物", tags: ["杯","外卖"],
    scope: "generic", fromRoom: 'popo',
    w: 48, h: 58, base: 58, foot: [0, 44, 48, 14], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#d8d0c0'; g.fillRect(4, 12, 40, 46)
      g.fillStyle = '#e8e0d0'; g.fillRect(4, 12, 14, 46)
      g.fillStyle = '#7a5a9a'; g.fillRect(4, 26, 40, 12)
      g.fillStyle = '#8a6aaa'; g.fillRect(4, 26, 40, 4)
      g.fillStyle = '#4a3a2a'; g.fillRect(0, 4, 48, 10)
      g.fillStyle = '#5a4a3a'; g.fillRect(0, 4, 48, 3)
      g.fillStyle = '#d8d0c0'; g.fillRect(18, 0, 10, 6)
      g.restore()
    }
  })
  def("popo_cauldron", {
    fx(g, t, X, Y) {
      // 药汤在滚，泡一个个破
      for (let k = 0; k < 5; k++) {
        const p = ((t / 1700) + k * 0.2) % 1
        const r = 3 + p * 7
        g.fillStyle = 'rgba(140,220,150,' + (0.5 * (1 - p)) + ')'
        g.fillRect(X + 70 + ((k * 47) % 120) - r, Y + 108 - p * 16 - r, r * 2, r * 2)
      }
      // 三足锅下的柴火:也是一堆，比灶膛略小
      globalThis.fxFlame(g, X + 126, Y + 290, { t, w: 50, h: 68, seed: 1.4 })
    },
    clickable: true, say: '这锅是给隔壁熬的，咳嗽了好些天啦',
    name: "药锅 · 三足", cat: "器物", tags: ["锅","药"],
    scope: "character", fromRoom: 'popo',
    w: 260, h: 300, base: 300, foot: [16, 196, 228, 104], zLayer: 'sort',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      // 锅体
      pxE(130, 176, 114, 84, '#1a1620')
      pxE(130, 166, 104, 76, '#2a2430')
      pxE(130, 156, 96, 62, '#332d3c')
      pxE(130, 112, 88, 26, '#141018')
      pxE(130, 112, 80, 20, '#2a5a3a')     // 药汤面
      // 三足
      g.fillStyle = '#2a2430'
      g.fillRect(24, 252, 22, 34); g.fillRect(214, 252, 22, 34); g.fillRect(118, 262, 22, 34)
      // 柴
      g.fillStyle = '#3a2418'
      g.fillRect(66, 274, 66, 10); g.fillRect(116, 266, 60, 10); g.fillRect(88, 260, 50, 9)
      g.fillStyle = '#5a3a20'; g.fillRect(66, 274, 66, 3); g.fillRect(116, 266, 60, 3)
      // 长柄搅棒
      g.strokeStyle = '#6a4a30'; g.lineWidth = 9
      g.beginPath(); g.moveTo(160, 108); g.lineTo(250, 4); g.stroke()
      g.strokeStyle = '#8a6a48'; g.lineWidth = 3
      g.beginPath(); g.moveTo(162, 106); g.lineTo(250, 6); g.stroke()
      pxC(252, 2, 10, '#4a3a2a')
      // 锅边小瓶三只
      for (const [bx, bc] of [[6, '#c8a0e8'], [26, '#e8b23d'], [46, '#68c048']]) {
        g.fillStyle = '#2e2838'; g.fillRect(bx, 200, 14, 22)
        g.fillStyle = bc; g.fillRect(bx + 2, 206, 10, 14)
        g.fillStyle = '#e8e0d0'; g.fillRect(bx + 4, 194, 6, 7)
      }
      g.restore()
    }
  })
  def("popo_distiller", {
    clickable: true, say: '滴得慢一点才好呀，急不来的',
    name: "蒸馏器", cat: "器物", tags: ["炼","器械"],
    scope: "character", fromRoom: 'popo',
    w: 160, h: 120, base: 120, foot: [0, 60, 160, 60], zLayer: 'sort',
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2e2838'; g.fillRect(0, 58, 160, 62)
      g.fillStyle = '#5a4a3e'; g.fillRect(6, 64, 148, 50)
      g.fillStyle = '#6a5a4a'; g.fillRect(6, 64, 148, 6)
      pxC(40, 40, 26, '#7aa0b0')
      pxC(40, 40, 22, '#a8d0e0')
      pxC(34, 32, 10, '#d8f0f8')
      g.fillStyle = '#48c068'; g.fillRect(28, 46, 24, 12)
      g.fillStyle = '#a8d0e0'
      g.fillRect(62, 28, 44, 6); g.fillRect(100, 28, 6, 34)
      pxC(112, 72, 16, '#7a4a70')
      pxC(112, 72, 12, '#c04888')
      g.fillStyle = '#e8b23d'; g.fillRect(104, 56, 16, 6)
      g.restore()
    }
  })
  def("popo_book_stand", {
    clickable: true, say: '这页符文，认了半辈子还打怵呀',
    name: "魔法书台", cat: "桌案", tags: ["书","符文"],
    scope: "character", fromRoom: 'popo',
    w: 216, h: 148, base: 148, foot: [0, 64, 216, 84], zLayer: 'sort',
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2e2838'; g.fillRect(0, 62, 216, 86)
      g.fillStyle = '#5a4a3e'; g.fillRect(6, 68, 204, 74)
      g.fillStyle = '#6a5a4a'; g.fillRect(6, 68, 204, 6)
      g.fillStyle = '#3a3040'; g.fillRect(22, 40, 174, 30)
      g.fillStyle = '#f0e4c8'
      g.fillRect(26, 18, 82, 28); g.fillRect(110, 18, 82, 28)
      g.fillStyle = '#8a5ac8'
      g.fillRect(36, 26, 24, 4); g.fillRect(36, 34, 30, 4)
      g.fillRect(120, 26, 28, 4); g.fillRect(120, 34, 22, 4)
      pxC(156, 30, 8, '#c8a0e8')
      // 羽毛笔 + 墨水
      g.fillStyle = '#f6efdc'
      g.beginPath(); g.moveTo(42, 90); g.lineTo(72, 128); g.lineTo(56, 134); g.fill()
      g.fillStyle = '#2e2838'; g.fillRect(70, 130, 8, 10)
      g.fillRect(92, 118, 30, 24)
      g.fillStyle = '#141018'; g.fillRect(98, 124, 18, 12)
      // 沙漏
      g.fillStyle = '#2e2838'; g.fillRect(144, 88, 44, 8); g.fillRect(144, 134, 44, 8)
      g.fillStyle = '#a8d0e0'
      g.beginPath(); g.moveTo(150, 96); g.lineTo(182, 96); g.lineTo(166, 118); g.fill()
      g.beginPath(); g.moveTo(150, 134); g.lineTo(182, 134); g.lineTo(166, 114); g.fill()
      g.fillStyle = '#e8b23d'; g.fillRect(160, 122, 12, 10)
      g.restore()
    }
  })
  def("popo_astrolabe", {
    clickable: true, say: '这个我不太会看，人家送的呀',
    name: "星盘仪", cat: "器物", tags: ["黄铜","星"],
    scope: "generic", fromRoom: 'popo',
    w: 70, h: 76, base: 76, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2e2838'; g.fillRect(20, 62, 30, 10)
      pxC(35, 38, 30, '#2e2838')
      pxC(35, 38, 26, '#c9a26a')
      pxC(35, 38, 22, '#d8b478')
      g.strokeStyle = '#e8b23d'; g.lineWidth = 2
      g.beginPath(); g.arc(35, 38, 18, 0, 7); g.stroke()
      g.beginPath(); g.arc(35, 38, 10, 0, 7); g.stroke()
      g.fillStyle = '#e8b23d'; g.fillRect(33, 12, 4, 50)
      g.fillStyle = '#a87820'; g.fillRect(16, 36, 38, 3)
      g.restore()
    }
  })
  def("popo_balance", {
    clickable: true, say: '不收钱的哦，一颗糖、一句话，都算数',
    name: "黄铜天平", cat: "器物", tags: ["天平","黄铜"],
    scope: "generic", fromRoom: 'popo',
    w: 100, h: 100, base: 100, foot: [0, 80, 100, 20], zLayer: 'low',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#c9a26a'
      g.fillRect(46, 8, 6, 76); g.fillRect(2, 6, 94, 5); g.fillRect(24, 84, 52, 8)
      g.fillStyle = '#d8b478'; g.fillRect(2, 6, 94, 2)
      g.fillStyle = '#2e2838'; g.fillRect(8, 10, 2, 22); g.fillRect(88, 10, 2, 30)
      pxE(9, 36, 18, 7, '#c9a26a'); pxE(89, 44, 18, 7, '#c9a26a')
      pxE(9, 34, 16, 5, '#d8b478'); pxE(89, 42, 16, 5, '#d8b478')
      // 左盘里放着一颗糖，右盘空着
      g.fillStyle = '#e8556a'; g.fillRect(5, 28, 8, 8)
      g.restore()
    }
  })
  def("popo_mandrake", {
    clickable: true, say: '它会叫的哦，不过只对我叫',
    name: "曼德拉草", cat: "植物", tags: ["盆栽","怪"],
    scope: "generic", fromRoom: 'popo',
    w: 90, h: 60, base: 60, foot: [0, 26, 90, 34], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#7a3040'; g.fillRect(4, 26, 82, 34)
      g.fillStyle = '#8a4050'; g.fillRect(4, 26, 82, 9)
      g.fillStyle = '#6a2838'; g.fillRect(4, 52, 82, 8)
      g.fillStyle = '#c8a080'
      g.fillRect(32, 2, 22, 26)
      g.fillRect(24, 14, 10, 14); g.fillRect(52, 14, 10, 14)
      g.fillStyle = '#1a1620'
      g.fillRect(36, 10, 4, 4); g.fillRect(46, 10, 4, 4); g.fillRect(38, 19, 10, 3)
      g.fillStyle = '#4a7c3e'
      g.fillRect(36, 0, 5, 12); g.fillRect(45, 0, 5, 14)
      g.restore()
    }
  })
  def("popo_specimen_jars", {
    clickable: true, say: '别怕呀，它们都乖着呢',
    name: "标本瓶排", cat: "器物", tags: ["瓶","标本"],
    scope: "character", fromRoom: 'popo',
    w: 250, h: 100, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      const KIND = ['eye', 'firefly', 'eye2', 'bat']
      for (let i = 0; i < 4; i++) {
        const x = i * 62, kind = KIND[i]
        g.fillStyle = '#2e2838'; g.fillRect(x + 14, 0, 24, 10)
        g.fillStyle = 'rgba(168,208,224,0.5)'; g.fillRect(x, 10, 52, 76)
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 6, 16, 8, 30)
        if (kind === 'eye') {
          pxC(x + 26, 50, 15, '#e8e0d0'); pxC(x + 26, 50, 8, '#48a0c0'); pxC(x + 26, 50, 4, '#1a1620')
        } else if (kind === 'eye2') {
          pxC(x + 20, 56, 11, '#e8e0d0'); pxC(x + 20, 56, 5, '#68c048')
          pxC(x + 36, 44, 9, '#e8e0d0'); pxC(x + 36, 44, 4, '#c04888')
        } else if (kind === 'firefly') {
          g.fillStyle = 'rgba(30,40,30,0.6)'; g.fillRect(x + 4, 14, 44, 68)
          for (const [fx2, fy2] of [[14, 34], [30, 54], [22, 70], [38, 28]]) {
            g.fillStyle = '#c8e858'; g.fillRect(x + fx2, fy2, 5, 5)
          }
        } else {
          g.fillStyle = '#2a2a30'; g.fillRect(x + 16, 38, 20, 14)
          g.beginPath(); g.moveTo(x + 16, 44); g.lineTo(x + 4, 32); g.lineTo(x + 16, 38); g.fill()
          g.beginPath(); g.moveTo(x + 36, 44); g.lineTo(x + 48, 32); g.lineTo(x + 36, 38); g.fill()
          g.fillStyle = '#e89040'; g.fillRect(x + 22, 42, 2, 2); g.fillRect(x + 28, 42, 2, 2)
        }
        g.fillStyle = '#f2ead6'; g.fillRect(x + 12, 70, 24, 10)
        g.fillStyle = '#5a5040'; g.fillRect(x + 15, 74, 18, 2)
      }
      g.restore()
    }
  })
  def("popo_dream_catcher", {
    clickable: true, say: '挂着好看嘛，做梦这种事，管不住的呀',
    name: "捕梦网", cat: "墙面", tags: ["网","羽毛"],
    scope: "generic", fromRoom: 'popo',
    w: 100, h: 150, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      pxC(50, 44, 40, '#a06a40')
      pxC(50, 44, 35, '#38324a')
      g.strokeStyle = '#c8a0e8'; g.lineWidth = 2
      for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(50, 44, 12 + k * 11, 0, 7); g.stroke() }
      g.fillStyle = '#e8e0d0'
      g.fillRect(30, 84, 3, 26); g.fillRect(48, 84, 3, 34); g.fillRect(66, 84, 3, 22)
      g.fillStyle = '#c8a0e8'
      g.fillRect(28, 110, 7, 8); g.fillRect(46, 118, 7, 8); g.fillRect(64, 106, 7, 8)
      g.fillStyle = '#8a6aaa'
      g.fillRect(28, 118, 7, 12); g.fillRect(46, 126, 7, 12); g.fillRect(64, 114, 7, 12)
      g.restore()
    }
  })
  def("popo_palm_chart", {
    clickable: true, say: '手相我也看的，不过我更爱看牌呀',
    name: "掌纹图", cat: "墙面", tags: ["图","手相"],
    scope: "generic", fromRoom: 'popo',
    w: 96, h: 122, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2e2838'; g.fillRect(0, 0, 96, 122)
      g.fillStyle = '#e8d8b0'; g.fillRect(6, 6, 84, 110)
      g.fillStyle = '#c8a080'
      g.beginPath(); g.moveTo(26, 106); g.lineTo(26, 54); g.lineTo(36, 26)
      g.lineTo(46, 22); g.lineTo(56, 26); g.lineTo(66, 54); g.lineTo(66, 106); g.fill()
      g.strokeStyle = '#7a3040'; g.lineWidth = 2
      g.beginPath(); g.moveTo(31, 96); g.quadraticCurveTo(46, 66, 61, 76); g.stroke()
      g.beginPath(); g.moveTo(31, 84); g.quadraticCurveTo(43, 58, 59, 62); g.stroke()
      g.strokeStyle = '#a05060'
      g.beginPath(); g.moveTo(33, 70); g.quadraticCurveTo(48, 52, 62, 50); g.stroke()
      g.restore()
    }
  })
  def("popo_sweater_hang", {
    clickable: true, say: '晾着呢，这几件是给小的那几只的',
    name: "晾着的小毛衣", cat: "布艺", tags: ["毛衣","晾"],
    scope: "character", fromRoom: 'popo',
    w: 240, h: 110, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 麻绳
      g.strokeStyle = '#c8b48a'; g.lineWidth = 3
      g.beginPath(); g.moveTo(0, 8); g.quadraticCurveTo(120, 22, 240, 6); g.stroke()
      const CO = [['#d86aa0','#c04888'], ['#68a8d8','#4888b8'], ['#e8b23d','#c89020'], ['#78c078','#58a058']]
      for (let k = 0; k < 4; k++) {
        const x = 14 + k * 58, y = 14 + Math.abs(k - 1.5) * -2 + 6
        // 木夹
        g.fillStyle = '#a06a40'; g.fillRect(x + 16, y - 6, 5, 12); g.fillRect(x + 30, y - 6, 5, 12)
        // 小毛衣：身 + 两袖
        g.fillStyle = CO[k][1]; g.fillRect(x + 10, y + 4, 32, 40)
        g.fillStyle = CO[k][0]; g.fillRect(x + 10, y + 4, 32, 30)
        g.fillStyle = CO[k][1]; g.fillRect(x, y + 8, 12, 14); g.fillRect(x + 40, y + 8, 12, 14)
        g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(x + 10, y + 4, 32, 3)
        g.fillStyle = CO[k][1]; g.fillRect(x + 10, y + 40, 32, 6)
      }
      g.restore()
    }
  })
  def("popo_mirror_veiled", {
    clickable: true, say: '蒙着好呀，照久了会看见不该看的',
    name: "蒙布镜", cat: "墙面", tags: ["镜","布"],
    scope: "character", fromRoom: 'popo',
    w: 132, h: 330, base: 330, foot: [0, 286, 132, 44], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2e2838'; g.fillRect(0, 0, 132, 330)
      g.fillStyle = '#38324a'; g.fillRect(14, 140, 104, 172)
      g.fillStyle = 'rgba(140,200,230,0.12)'; g.fillRect(24, 160, 30, 100)
      g.fillStyle = 'rgba(140,200,230,0.06)'; g.fillRect(62, 178, 20, 76)
      // 蒙布
      g.fillStyle = '#e8e0d0'
      g.beginPath(); g.moveTo(0, 0); g.lineTo(132, 0); g.lineTo(124, 112)
      g.lineTo(94, 74); g.lineTo(52, 132); g.lineTo(12, 82); g.fill()
      g.fillStyle = '#d0c8b8'; g.fillRect(0, 0, 132, 12)
      g.fillStyle = '#c0b8a8'
      g.fillRect(22, 20, 4, 78); g.fillRect(70, 20, 4, 62); g.fillRect(104, 20, 4, 70)
      g.fillStyle = '#2e2838'; g.fillRect(10, 312, 112, 18)
      g.restore()
    }
  })
  def("popo_book_tower", {
    clickable: true, say: '看不完的呀，买的时候总觉得看得完',
    name: "魔法书塔", cat: "书卷", tags: ["书","叠"],
    scope: "generic", fromRoom: 'popo',
    w: 140, h: 230, base: 230, foot: [0, 186, 140, 44], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const CO = ['#5a3a7a', '#2a5a4a', '#7a3040', '#3a4a6a', '#6a5a2a', '#4a3a5a', '#5a4a2a']
      for (let k = 0; k < 7; k++) {
        const bw = 132 - k * 7, bx = 2 + k * 3 + (k % 2) * 6, by = 200 - k * 28
        g.fillStyle = '#1a1620'; g.fillRect(bx, by, bw, 26)
        g.fillStyle = CO[k]; g.fillRect(bx + 3, by + 3, bw - 6, 20)
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(bx + 3, by + 3, bw - 6, 5)
        g.fillStyle = '#e8b23d'; g.fillRect(bx + 10, by + 10, 16, 5)
        g.fillStyle = '#f0e4c8'; g.fillRect(bx + bw - 12, by + 4, 6, 18)
      }
      g.restore()
    }
  })
  def("popo_pumpkins", {
    clickable: true, say: '南瓜熬粥最好啦，熬一大锅',
    name: "南瓜 ×2", cat: "器物", tags: ["南瓜","食"],
    scope: "generic", fromRoom: 'popo',
    w: 130, h: 92, base: 92, foot: [0, 40, 130, 52], zLayer: 'low',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      for (const [px2, py2, pr] of [[36, 56, 34], [94, 66, 24]]) {
        pxE(px2, py2, pr, pr - 6, '#1a1620')
        pxE(px2, py2, pr - 3, pr - 9, '#e89040')
        pxE(px2 - 8, py2 - 6, pr - 14, pr - 18, '#f0a860')
        g.fillStyle = '#c87028'
        g.fillRect(px2 - 2, py2 - pr + 9, 4, (pr - 9) * 2)
        g.fillRect(px2 - pr + 12, py2 - pr + 14, 3, (pr - 12) * 2)
        g.fillRect(px2 + pr - 15, py2 - pr + 14, 3, (pr - 12) * 2)
        g.fillStyle = '#4a7c3e'; g.fillRect(px2 - 3, py2 - pr - 2, 7, 10)
      }
      g.restore()
    }
  })
  def("popo_owl_perch", {
    clickable: true, say: '它白天睡，夜里陪我，挺好的呀',
    name: "猫头鹰栖架", cat: "器物", tags: ["架","鸟"],
    scope: "character", fromRoom: 'popo',
    w: 176, h: 320, base: 320, foot: [44, 268, 88, 52], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2e2838'; g.fillRect(82, 12, 12, 288)
      g.fillStyle = '#3a3040'; g.fillRect(82, 12, 5, 288)
      g.fillStyle = '#2e2838'; g.fillRect(16, 0, 144, 12)
      g.fillStyle = '#3a3040'; g.fillRect(16, 0, 144, 4)
      // 底座
      g.fillStyle = '#3a3040'; g.fillRect(44, 296, 88, 20)
      g.fillStyle = '#2e2838'; g.fillRect(50, 302, 76, 8)
      // 挂在架上的小铃 + 一撮羽毛
      g.fillStyle = '#e8b23d'; g.fillRect(138, 12, 8, 8); g.fillRect(139, 20, 6, 4)
      g.fillStyle = '#c8bca0'; g.fillRect(30, 12, 4, 22); g.fillRect(38, 12, 4, 16)
      // 架下接的托盘
      g.fillStyle = '#4a3f52'; g.fillRect(52, 244, 72, 12)
      g.restore()
    }
  })
  def("popo_nest_wicker", { walkable: true,
    clickable: true, say: '窝要多备几个呀，谁来了都有地方睡',
    name: "藤编窝", cat: "坐卧", tags: ["窝","动物"],
    scope: "generic", fromRoom: 'popo',
    w: 104, h: 82, base: 82, foot: [0, 26, 104, 52], zLayer: 'low',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      pxE(52, 56, 50, 24, '#7a4a28')
      pxE(52, 50, 46, 22, '#a06a40')
      pxE(52, 42, 40, 17, '#8a5430')
      // 藤条纹
      g.fillStyle = '#8a5430'
      for (let k = 0; k < 6; k++) g.fillRect(8 + k * 15, 44, 4, 24)
      // 里面的小毯（格子）
      g.fillStyle = '#c8a0e8'; g.fillRect(28, 30, 48, 20)
      g.fillStyle = '#8a6aaa'
      for (let k = 0; k < 3; k++) { g.fillRect(28 + k * 17, 30, 4, 20); g.fillRect(28, 34 + k * 7, 48, 3) }
      g.restore()
    }
  })
  def("popo_nest_bird", { walkable: true,
    clickable: true, say: '这个是给会飞的呀，高一点它们才安心',
    name: "鸟架窝", cat: "坐卧", tags: ["窝","鸟"],
    scope: "generic", fromRoom: 'popo',
    w: 120, h: 150, base: 150, foot: [10, 120, 100, 30], zLayer: 'sort',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#5a3a20'; g.fillRect(52, 40, 16, 92)
      g.fillStyle = '#6a4a30'; g.fillRect(52, 40, 6, 92)
      g.fillStyle = '#4a3220'; g.fillRect(20, 126, 80, 20)
      pxE(60, 34, 54, 22, '#7a4a28')
      pxE(60, 28, 48, 19, '#a06a40')
      pxE(60, 22, 40, 13, '#6a4020')
      // 干草
      g.fillStyle = '#c8a860'
      for (let k = 0; k < 9; k++) g.fillRect(24 + k * 8, 12 + (k % 3) * 4, 12, 3)
      // 两枚蛋壳（早搬走了，她留着）
      g.fillStyle = '#e8e0d0'; g.fillRect(48, 14, 10, 8); g.fillRect(62, 16, 9, 7)
      g.restore()
    }
  })
  def("popo_food_bowls", { walkable: true,
    clickable: true, say: '开饭啦，小可爱们～',
    name: "食盆排", cat: "器物", tags: ["食盆","动物"],
    scope: "generic", fromRoom: 'popo',
    w: 250, h: 70, base: 70, foot: [0, 26, 250, 40], zLayer: 'low',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      for (const [bx3, bc2, fc] of [[32, '#c83848', '#e8b23d'], [124, '#3868b8', '#c8c4bc'], [216, '#e8b23d', '#e89040']]) {
        pxE(bx3, 46, 28, 13, '#2e2838')
        pxE(bx3, 42, 26, 12, bc2)
        pxE(bx3, 38, 21, 9, '#2e2838')
        g.fillStyle = fc
        g.fillRect(bx3 - 10, 32, 7, 5); g.fillRect(bx3, 34, 7, 5); g.fillRect(bx3 - 4, 28, 6, 5)
      }
      // 撒出来的粮
      g.fillStyle = '#e8b23d'
      g.fillRect(8, 56, 5, 4); g.fillRect(88, 60, 5, 4); g.fillRect(172, 54, 5, 4); g.fillRect(240, 58, 5, 4)
      g.restore()
    }
  })
  def("popo_snack_jar", {
    clickable: true, say: '小鱼干，它们最吃这个啦',
    name: "零食罐", cat: "器物", tags: ["罐","鱼干"],
    scope: "generic", fromRoom: 'popo',
    w: 56, h: 70, base: 70, foot: [0, 44, 56, 26], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(230,225,215,0.75)'; g.fillRect(4, 14, 48, 56)
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(9, 20, 8, 30)
      g.fillStyle = '#8a6aaa'; g.fillRect(2, 6, 52, 12)
      g.fillStyle = '#9a7aba'; g.fillRect(2, 6, 52, 4)
      g.fillStyle = '#c8c4bc'
      g.fillRect(11, 40, 30, 6); g.fillRect(15, 52, 22, 6); g.fillRect(13, 60, 26, 5)
      g.restore()
    }
  })
  def("popo_biscuit_tin", {
    clickable: true, say: '饼干呀，你要不要也来一块',
    name: "饼干罐", cat: "器物", tags: ["罐","饼干"],
    scope: "generic", fromRoom: 'popo',
    w: 80, h: 80, base: 80, foot: [0, 56, 80, 24], zLayer: 'low',
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2e2838'; g.fillRect(0, 4, 80, 76)
      g.fillStyle = '#c04888'; g.fillRect(5, 9, 70, 66)
      g.fillStyle = '#d86aa0'; g.fillRect(5, 9, 70, 16)
      g.fillStyle = '#a03868'; g.fillRect(5, 66, 70, 9)
      pxC(40, 46, 12, '#ffd76a')
      g.fillStyle = '#e8b23d'; g.fillRect(16, 42, 10, 4); g.fillRect(56, 42, 10, 4)
      g.restore()
    }
  })
  def("popo_cat_bowl", { walkable: true,
    clickable: true, say: '它挑食的哦，只吃这个牌子',
    name: "猫粮碗 + 鱼骨", cat: "器物", tags: ["碗","猫"],
    scope: "generic", fromRoom: 'popo',
    w: 80, h: 100, base: 100, foot: [0, 66, 80, 34], zLayer: 'low',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      // 鱼骨
      g.fillStyle = '#e8e0d0'
      g.fillRect(8, 6, 30, 4)
      g.fillRect(20, 0, 4, 18); g.fillRect(30, 2, 4, 14)
      pxC(6, 8, 5, '#e8e0d0')
      // 碗
      pxE(40, 78, 32, 15, '#2e2838')
      pxE(40, 72, 28, 13, '#48a0c0')
      pxE(40, 68, 22, 9, '#2e6a88')
      g.fillStyle = '#c89058'
      g.fillRect(30, 62, 6, 5); g.fillRect(40, 64, 6, 5); g.fillRect(48, 61, 6, 5)
      g.restore()
    }
  })
  def("popo_cat_toy", { walkable: true,
    clickable: true, say: '逗猫棒，我一拿它就跑，真是的',
    name: "逗猫棒", cat: "玩具", tags: ["猫","玩具"],
    scope: "generic", fromRoom: 'popo',
    w: 90, h: 70, base: 70, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#a06a40'
      g.save(); g.translate(4, 2); g.rotate(0.4); g.fillRect(0, 0, 5, 58); g.restore()
      g.strokeStyle = '#8a7a5c'; g.lineWidth = 2
      g.beginPath(); g.moveTo(26, 46); g.quadraticCurveTo(46, 58, 58, 52); g.stroke()
      pxC(62, 50, 9, '#e858a0')
      pxC(60, 48, 4, '#ff8ac0')
      g.fillStyle = '#e858a0'
      g.fillRect(68, 42, 12, 3); g.fillRect(68, 56, 12, 3)
      g.restore()
    }
  })
  def("popo_yarn_ball", { walkable: true,
    clickable: true, say: '又滚出来了，它半夜玩的呀',
    name: "毛线球 + 散线", cat: "玩具", tags: ["毛线","猫"],
    scope: "generic", fromRoom: 'popo',
    w: 90, h: 70, base: 70, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      pxC(30, 24, 20, '#7a3040')
      pxC(26, 20, 9, '#9a4050')
      g.strokeStyle = '#8a4050'; g.lineWidth = 2
      g.beginPath(); g.moveTo(12, 18); g.quadraticCurveTo(30, 34, 48, 20); g.stroke()
      g.beginPath(); g.moveTo(14, 30); g.quadraticCurveTo(32, 16, 46, 30); g.stroke()
      g.beginPath(); g.moveTo(48, 26); g.quadraticCurveTo(70, 46, 88, 34); g.stroke()
      g.restore()
    }
  })
  def("popo_gift_stack", {
    clickable: true, say: '这几个是包好的，明天就有人过生日啦',
    name: "包好的生日礼物", cat: "器物", tags: ["礼物","生日"],
    scope: "character", fromRoom: 'popo',
    w: 130, h: 130, base: 130, foot: [0, 70, 130, 60], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const BX = [[6, 84, 118, 42, '#7a3040', '#e8b23d'],
                  [16, 48, 92, 38, '#2a5a4a', '#d86aa0'],
                  [30, 18, 66, 32, '#3a4a6a', '#ffd76a']]
      for (const [x, y, w, h, c, rb] of BX) {
        g.fillStyle = '#1a1620'; g.fillRect(x - 2, y - 2, w + 4, h + 4)
        g.fillStyle = c; g.fillRect(x, y, w, h)
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y, w, 6)
        g.fillStyle = rb
        g.fillRect(x + w / 2 - 4, y, 8, h)      // 竖丝带
        g.fillRect(x, y + h / 2 - 4, w, 8)      // 横丝带
      }
      // 最上面那个的蝴蝶结
      g.fillStyle = '#ffd76a'
      g.fillRect(52, 6, 10, 10); g.fillRect(66, 6, 10, 10); g.fillRect(60, 10, 8, 8)
      // 挂在礼物上的小卡片（写着名字）
      g.fillStyle = '#f2ead6'; g.fillRect(96, 90, 26, 20)
      g.fillStyle = '#5a5040'; g.fillRect(100, 96, 16, 3); g.fillRect(100, 102, 12, 3)
      g.restore()
    }
  })
  def("popo_qr_stand", {
    clickable: true, say: '扫这个就能问事啦，年轻人教我的呀',
    name: "扫码问事立牌", cat: "器物", tags: ["二维码","网店"],
    scope: "generic", fromRoom: 'popo',
    w: 100, h: 130, base: 130, foot: [14, 96, 72, 34], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2e2838'; g.fillRect(42, 96, 12, 26)
      g.fillStyle = '#3a3040'; g.fillRect(20, 118, 60, 12)
      g.fillStyle = '#2e2838'; g.fillRect(2, 0, 96, 102)
      g.fillStyle = '#f6f2ea'; g.fillRect(6, 4, 88, 94)
      g.fillStyle = '#1a1620'
      for (let r = 0; r < 6; r++)
        for (let c = 0; c < 6; c++)
          if ((r * 7 + c * 3 + r * c) % 3 !== 1) g.fillRect(16 + c * 11, 14 + r * 11, 9, 9)
      g.fillStyle = '#7a5a9a'; g.fillRect(6, 84, 88, 14)
      g.fillStyle = '#c8a0e8'; g.fillRect(24, 88, 22, 5); g.fillRect(52, 88, 18, 5)
      g.restore()
    }
  })
  def("popo_phone", {
    clickable: true, say: '语音条发过去就行啦，打字？我不学的',
    name: "智能机", cat: "电器", tags: ["手机","语音"],
    scope: "generic", fromRoom: 'popo',
    w: 36, h: 62, base: 62, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#1a1a20'; g.fillRect(0, 0, 36, 62)
      g.fillStyle = '#e858a0'; g.fillRect(3, 3, 30, 56)
      g.fillStyle = '#2a2a34'; g.fillRect(6, 8, 24, 42)
      // 一条一条的语音条（都是 60 秒）
      g.fillStyle = '#68c048'
      g.fillRect(9, 12, 18, 5); g.fillRect(9, 20, 18, 5); g.fillRect(9, 28, 18, 5); g.fillRect(9, 36, 14, 5)
      g.fillStyle = '#ffd0e8'; g.fillRect(11, 52, 14, 4)
      g.restore()
    }
  })
  def("popo_amethyst", {
    clickable: true, say: '紫的最养人啦，你也拿一块去呀',
    name: "紫水晶簇", cat: "器物", tags: ["水晶","紫"],
    scope: "generic", fromRoom: 'popo',
    w: 62, h: 46, base: 46, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#4a2a6a'
      g.beginPath(); g.moveTo(0, 44); g.lineTo(14, 2); g.lineTo(28, 44); g.fill()
      g.fillStyle = '#5a3a7a'
      g.beginPath(); g.moveTo(2, 44); g.lineTo(14, 6); g.lineTo(22, 44); g.fill()
      g.fillStyle = '#8a5ac8'
      g.beginPath(); g.moveTo(20, 44); g.lineTo(34, 14); g.lineTo(46, 44); g.fill()
      g.fillStyle = '#c8a0e8'
      g.beginPath(); g.moveTo(36, 44); g.lineTo(46, 22); g.lineTo(58, 44); g.fill()
      g.fillStyle = 'rgba(240,220,255,0.55)'
      g.fillRect(12, 12, 3, 26); g.fillRect(32, 22, 3, 18)
      g.restore()
    }
  })
  def("popo_rune_stones", {
    clickable: true, say: '石头也会说话的呀，要多听',
    name: "符文石", cat: "器物", tags: ["符文","石"],
    scope: "generic", fromRoom: 'popo',
    w: 140, h: 56, base: 56, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      const S = [[14, 30, '#c8a0e8'], [40, 38, '#8ac8e8'], [30, 14, '#e8b23d'],
                 [62, 32, '#c8a0e8'], [92, 20, '#8ac8e8']]
      for (const [rx, ry, rc] of S) {
        pxE(rx, ry, 14, 10, '#3a3448')
        pxE(rx, ry - 2, 12, 8, '#524a62')
        pxE(rx - 2, ry - 4, 7, 4, '#5e5670')
        g.fillStyle = rc
        g.fillRect(rx - 4, ry - 6, 3, 8); g.fillRect(rx - 1, ry - 3, 6, 3)
      }
      g.restore()
    }
  })
  def("popo_rune_floor", {
    name: "地板符文刻痕", cat: "地面", tags: ["符文","刻"],
    scope: "generic", fromRoom: 'popo',
    w: 160, h: 60, base: 0, foot: [0, 0, 0, 0],
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(200,160,232,0.30)'
      g.fillRect(0, 12, 30, 4); g.fillRect(12, 0, 4, 28)
      g.strokeStyle = 'rgba(200,160,232,0.30)'; g.lineWidth = 3
      g.beginPath(); g.arc(66, 16, 13, 0, 7); g.stroke()
      g.fillStyle = 'rgba(200,160,232,0.30)'
      g.fillRect(102, 8, 22, 4); g.fillRect(110, 0, 4, 22)
      g.fillRect(134, 14, 24, 4)
      g.restore()
    }
  })
  def("popo_crystal_grid", {
    clickable: true, say: '这个阵是给远行的人摆的呀',
    name: "水晶阵", cat: "器物", tags: ["水晶","阵"],
    scope: "generic", fromRoom: 'popo',
    w: 150, h: 110, base: 110, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      for (let k = 0; k < 6; k++) {
        const a = k * 1.047
        const wx = 75 + Math.cos(a) * 58, wy = 56 + Math.sin(a) * 40
        g.fillStyle = '#6a3a9a'
        g.beginPath(); g.moveTo(wx - 9, wy + 8); g.lineTo(wx, wy - 16); g.lineTo(wx + 9, wy + 8); g.fill()
        g.fillStyle = '#8a5aba'
        g.beginPath(); g.moveTo(wx - 6, wy + 8); g.lineTo(wx, wy - 13); g.lineTo(wx + 6, wy + 8); g.fill()
        g.fillStyle = '#c8a0e8'; g.fillRect(wx - 2, wy - 10, 4, 12)
      }
      g.fillStyle = '#a87820'
      g.beginPath(); g.moveTo(63, 64); g.lineTo(75, 24); g.lineTo(87, 64); g.fill()
      g.fillStyle = '#e8b23d'
      g.beginPath(); g.moveTo(67, 64); g.lineTo(75, 30); g.lineTo(83, 64); g.fill()
      g.restore()
    }
  })
  def("popo_tarot_spread", {
    clickable: true, say: '摊着呢，给别人摊的，不给自己',
    name: "凯尔特十字牌阵", cat: "地面", tags: ["塔罗","牌阵"],
    scope: "character", fromRoom: 'popo',
    w: 250, h: 190, base: 0, foot: [0, 0, 0, 0],
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const P = [[60, 92, 0], [60, 92, 1], [60, 46, 0], [60, 140, 0], [20, 92, 0],
                 [102, 92, 0], [166, 32, 0], [166, 74, 0], [166, 116, 0], [166, 158, 0]]
      for (const [kx, ky, rot] of P) {
        g.save(); g.translate(kx, ky); if (rot) g.rotate(1.57)
        g.fillStyle = '#1a1620'; g.fillRect(-19, -26, 38, 52)
        g.fillStyle = '#3a1e5e'; g.fillRect(-15, -22, 30, 44)
        g.fillStyle = '#e8b23d'
        g.fillRect(-9, -14, 18, 3); g.fillRect(-9, 11, 18, 3)
        g.fillStyle = '#c8a0e8'; g.fillRect(-3, -5, 7, 10)
        g.restore()
      }
      g.restore()
    }
  })
  def("popo_wand", {
    clickable: true, say: '这个不太灵的，摆着好看呀',
    name: "魔杖 · 星尖", cat: "器物", tags: ["杖","星"],
    scope: "generic", fromRoom: 'popo',
    w: 84, h: 30, base: 30, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#4a2e64'; g.fillRect(0, 10, 64, 8)
      g.fillStyle = '#5a3a7a'; g.fillRect(0, 10, 64, 3)
      g.fillStyle = '#e8b23d'
      g.fillRect(60, 8, 12, 12)
      g.fillRect(64, 2, 4, 24); g.fillRect(56, 12, 24, 4)
      g.fillStyle = '#ffd76a'; g.fillRect(63, 11, 6, 6)
      g.restore()
    }
  })
  def("popo_scroll_pile", {
    clickable: true, say: '写好的方子，谁来取都行呀',
    name: "卷轴堆", cat: "书卷", tags: ["卷轴","方子"],
    scope: "generic", fromRoom: 'popo',
    w: 70, h: 46, base: 46, foot: [0, 20, 70, 24], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#b0894e'; g.fillRect(0, 34, 66, 11)
      g.fillStyle = '#c9a26a'; g.fillRect(0, 34, 66, 5)
      g.fillStyle = '#b0894e'; g.fillRect(6, 22, 54, 11)
      g.fillStyle = '#c9a26a'; g.fillRect(6, 22, 54, 5)
      g.fillStyle = '#b0894e'; g.fillRect(14, 10, 40, 11)
      g.fillStyle = '#d8b478'; g.fillRect(14, 10, 40, 5)
      g.fillStyle = '#7a3040'; g.fillRect(28, 8, 5, 38)
      g.restore()
    }
  })
  def("popo_bell_pole", {
    clickable: true, say: '有人进门它就响，我耳朵不好使啦',
    name: "铃铛串立杆", cat: "器物", tags: ["铃","门"],
    scope: "generic", fromRoom: 'popo',
    w: 50, h: 190, base: 190, foot: [14, 160, 26, 28], zLayer: 'sort',
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
        for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2e2838'; g.fillRect(18, 0, 10, 172)
      g.fillStyle = '#3a3040'; g.fillRect(18, 0, 4, 172)
      g.fillStyle = '#3a3040'; g.fillRect(7, 164, 32, 16)
      for (let k = 0; k < 3; k++) {
        pxC(23, 24 + k * 40, 11, '#c9a26a')
        pxC(21, 21 + k * 40, 5, '#e8b23d')
        g.fillStyle = '#a87820'; g.fillRect(19, 31 + k * 40, 8, 5)
      }
      g.restore()
    }
  })
  def("popo_door_mat", {
    clickable: true, say: '进来吧进来吧，鞋不用脱的',
    name: "门垫 · 星纹", cat: "地面", tags: ["门垫","星"],
    scope: "generic", fromRoom: 'popo',
    w: 230, h: 76, base: 0, foot: [0, 0, 0, 0], walkable: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2e2838'; g.fillRect(0, 0, 230, 76)
      g.fillStyle = '#38304e'; g.fillRect(6, 6, 218, 64)
      g.fillStyle = '#42395c'; g.fillRect(6, 6, 218, 8)
      g.fillStyle = '#e8b23d'
      g.fillRect(72, 24, 11, 11); g.fillRect(122, 34, 9, 9); g.fillRect(164, 20, 10, 10)
      g.fillRect(44, 44, 8, 8); g.fillRect(190, 46, 8, 8)
      // 磨秃的中间
      g.fillStyle = 'rgba(90,80,110,0.35)'; g.fillRect(70, 30, 100, 26)
      g.restore()
    }
  })
  def("popo_shoes", {
    clickable: true, say: '出门的鞋，不常穿的呀',
    name: "尖头鞋", cat: "器物", tags: ["鞋"],
    scope: "generic", fromRoom: 'popo',
    w: 70, h: 52, base: 52, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      for (const x of [0, 34]) {
        g.fillStyle = '#2a2430'; g.fillRect(x + 6, 12, 26, 26)
        g.beginPath(); g.moveTo(x + 6, 38); g.lineTo(x - 8, 30); g.lineTo(x + 6, 24); g.fill()
        g.fillStyle = '#3a3444'; g.fillRect(x + 6, 12, 26, 6)
        g.fillStyle = '#e8b23d'; g.fillRect(x + 12, 18, 9, 6)
      }
      g.restore()
    }
  })
  def("popo_portal", {
    fx(g, t, X, Y) {
      const cx = X + 100, cy = Y + 200
      g.save()

      // ① 暗底:旋涡要发光，得先有暗的东西衬。没有这层，亮部就浮不出来
      const bg = g.createRadialGradient(cx, cy, 6, cx, cy, 150)
      bg.addColorStop(0, 'rgba(20,5,40,0.95)')
      bg.addColorStop(0.62, 'rgba(14,4,30,0.86)')
      bg.addColorStop(1, 'rgba(16,4,34,0)')
      g.fillStyle = bg
      g.save(); g.translate(cx, cy); g.scale(1, 1.66); g.translate(-cx, -cy)
      g.fillRect(cx - 160, cy - 160, 320, 320); g.restore()

      // ② 螺旋流带:四条，从核心甩出。沿螺旋线连续铺重叠的圆 —— 这样是「流」，
      //    点阵是「虚线」。臂宽从根部到梢部收细，亮度同步衰减。
      const spin = t / 2600
      const band = (arm, phase, col, wid, alpha) => {
        for (let k = 0; k < 90; k++) {
          const f = k / 90
          const ang = spin * (1.0 + phase) + arm * (Math.PI / 2) + f * 3.9
                    + Math.sin(f * 9 + t / 700 + arm * 2) * 0.05 * f
          const rad = 10 + f * 128 + Math.sin(f * 7 + t / 850 + arm) * 6 * f
          const px = cx + Math.cos(ang) * rad
          const py = cy + Math.sin(ang) * rad * 1.62
          const rr = wid * (1 - f * 0.72) * (0.9 + Math.sin(t / 520 + k * 0.4 + arm) * 0.1)
          if (rr < 0.6) continue
          const a = alpha * (1 - f * 0.62) * (0.82 + Math.sin(t / 640 + k * 0.3) * 0.18)
          if (a <= 0.015) continue
          g.fillStyle = `rgba(${col},${a.toFixed(3)})`
          for (let dy = -rr; dy <= rr; dy++) {
            const dx = Math.sqrt(rr * rr - dy * dy) | 0
            if (dx > 0) g.fillRect(px - dx, py + dy, dx * 2, 1)
          }
        }
      }
      for (let arm = 0; arm < 4; arm++) {
        for (let strand = 0; strand < 7; strand++) {
          const sf = strand / 7
          const ph = 0.10 * sf + (strand % 2 ? 0.03 : -0.03)   // 每股错开，束才会散
          const wid = 2.2 + (strand % 3) * 2.6 - sf * 1.2      // 粗细不一
          const al = (0.30 - sf * 0.10) * (strand % 3 === 0 ? 2.4 : strand % 3 === 1 ? 1.5 : 0.7)
          const col = strand % 3 === 0 ? '250,228,255'          // 亮丝:近乎白，是它在发光
                    : strand % 3 === 1 ? '198,132,252'          // 中紫
                    : '128,58,206'                              // 暗紫:只作陪衬
          band(arm, ph, col, wid, al)
        }
      }

      // ③ 亮核:能量从这里甩出去，所以中心是最亮的地方
      const pulse = 0.86 + Math.sin(t / 480) * 0.14
      const core = g.createRadialGradient(cx, cy, 1, cx, cy, 44 * pulse)
      core.addColorStop(0,    'rgba(255,252,255,0.98)')
      core.addColorStop(0.22, 'rgba(238,206,255,0.88)')
      core.addColorStop(0.5,  'rgba(186,116,250,0.55)')
      core.addColorStop(1,    'rgba(150,70,230,0)')
      g.fillStyle = core
      g.save(); g.translate(cx, cy); g.scale(1, 1.5); g.translate(-cx, -cy)
      g.fillRect(cx - 60, cy - 60, 120, 120); g.restore()

      // ④ 外圈碎屑:被甩出去的一圈亮点，给旋涡一个边而不画边
      for (let k = 0; k < 22; k++) {
        const sd = k * 1.7
        const ang = -spin * 1.6 + sd
        const wob = 0.86 + Math.sin(t / 900 + sd) * 0.14
        const px = cx + Math.cos(ang) * 122 * wob
        const py = cy + Math.sin(ang) * 200 * wob
        const a = 0.30 + Math.sin(t / 700 + sd * 2) * 0.22
        if (a <= 0.03) continue
        const sz = 2 + (k % 3)
        g.fillStyle = `rgba(232,200,255,${a.toFixed(3)})`
        g.fillRect(px - sz / 2, py - sz / 2, sz, sz)
      }
      // 门柱画在能量【之上】—— 柱子是实物，被雾盖住门框就散了。
      // ⚠ fx 的 X,Y 是素材左上角，坐标与声明的 w/h(200×400)同尺度 —— 不要再折半。
      // 左柱退后:落点更高、更矮、更暗
      g.fillStyle = '#2c2740'; g.fillRect(X - 1, Y + 276, 48, 12)
      // 右柱靠前:落点更低、更粗高、更亮
      g.fillStyle = '#40384f'; g.fillRect(X + 145, Y + 304, 66, 16)
      // 门柱压在能量之上 —— 柱子是实物，被雾盖住门框就散了。
      // 斜切由【两柱错位】本身说明:左柱退后偏上、右柱靠前偏下。
      // 不需要横梁与符石:横梁会横穿门洞挡住旋涡，支撑只需要这两根柱子。
      g.fillStyle = '#2c2740'; g.fillRect(X - 1, Y + 276, 48, 12)     // 左柱顶
      g.fillStyle = '#40384f'; g.fillRect(X + 145, Y + 304, 66, 16)   // 右柱顶
      g.restore()
    },
    clickable: true, say: '它们自己会来的呀，我从来不拦',
    sayDeep: '……来的时候都是一个，走的时候也是',
    name: "动物传送门", cat: "结构", tags: ["门","旋涡"],
    scope: "character", fromRoom: 'popo',
    w: 200, h: 400, base: 400, foot: [4, 325, 196, 74], zLayer: 'sort',
    light: { x: 100, y: 200, r: 300, color: '#b070ff', flicker: 0.22 },
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 静态层只画【实物】:两根柱子的本体。能量与斜楣由 fx 生成 ——
      // 那是虚的，而且要压在能量之上，只能在 fx 里画。
      // 素材本体不许是空的:draw 画不出像素时 verify 会报「画不出像素」，
      // 那通常意味着这件东西根本不存在，只是恰好有动效盖着。
      g.fillStyle = '#241f2e'; g.fillRect(4, 286, 38, 108)     // 左柱:退后
      g.fillStyle = '#3c364c'; g.fillRect(9, 293, 11, 92)
      g.fillStyle = '#332c40'; g.fillRect(152, 318, 52, 104)   // 右柱:靠前
      g.fillStyle = '#554c66'; g.fillRect(159, 326, 16, 88)
      g.restore()
    }
  })
  def("popo_mouse_hole", {
    clickable: true, say: '那家也住着人呢，我给它留着口粮呀',
    name: "老鼠洞", cat: "墙面", tags: ["洞","老鼠"],
    scope: "generic", fromRoom: 'popo',
    w: 60, h: 44, base: 0, foot: [0, 0, 0, 0], wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#141018'
      g.beginPath(); g.arc(30, 40, 26, Math.PI, 0); g.fill()
      g.fillRect(4, 40, 52, 4)
      g.fillStyle = '#2e2838'
      g.beginPath(); g.arc(30, 40, 30, Math.PI, 0); g.fill()
      g.fillStyle = '#141018'
      g.beginPath(); g.arc(30, 40, 25, Math.PI, 0); g.fill()
      g.fillStyle = '#e8b23d'
      g.fillRect(20, 24, 4, 4); g.fillRect(32, 24, 4, 4)
      g.restore()
    }
  })
  def("popo_ext_rug", {
    name: "前景毯", cat: "地面", tags: ["毯","前景"],
    scope: "generic", fromRoom: 'popo',
    w: 250, h: 120, base: 0, foot: [0, 0, 0, 0],
    draw(g) {
      const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
        for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      g.save(); g.scale(0.5, 0.5)
      pxE(125, 60, 125, 56, '#3a2450')
      pxE(125, 56, 108, 46, '#4a2e64')
      g.strokeStyle = '#a87820'; g.lineWidth = 5
      g.beginPath(); g.ellipse(125, 56, 62, 28, 0, 0, 7); g.stroke()
      g.strokeStyle = '#e8b23d'; g.lineWidth = 2
      g.beginPath(); g.ellipse(125, 56, 62, 28, 0, 0, 7); g.stroke()
      g.restore()
    }
  })
