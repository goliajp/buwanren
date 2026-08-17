  //>>> TAO ASSETS BEGIN (generated)

    // ═══════════ 桃桃房素材（自 taoCanvas 硬编码迁移）═══════════
  def("tao_moon_window", {
    // 月洞窗透进来的月光。冷蓝 —— 与补光灯的冷白不同，这是外面的光
    light: { x: 168, y: 200, r: 230, color: '#a8c0e0', flicker: 0 },
    clickable: true, say: '像岛上那扇……不像，一点都不像', sayDeep: '岛上那扇朝东，早上有光',
    name: "月洞窗", cat: "墙面", tags: ["窗","景"],
    scope: "generic", fromRoom: 'tao',
    w: 336, h: 336, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-1002, -53)
      // 月洞窗(右 · 桃枝入画)
        pxC(1170, 220, 168, '#8a6844')
        pxC(1170, 220, 152, '#b8dcec')
        // 云×2(柔和团云)
        g.fillStyle = '#e8f4fa'
        pxE(1090, 140, 38, 14, '#e8f4fa'); pxE(1118, 132, 26, 10, '#f2f9fc')
        pxE(1240, 170, 30, 11, '#e8f4fa'); pxE(1262, 164, 20, 8, '#f2f9fc')
        // 远山(青 · 两重)
        pxE(1120, 330, 90, 30, '#9ec4b4'); pxE(1250, 340, 70, 24, '#aecfc0')
        g.fillStyle = 'rgba(255,255,255,0.35)'
        g.fillRect(1080, 312, 40, 4); g.fillRect(1230, 324, 30, 4)
        // 桃枝(从右上弯入 · 带花簇)
        g.strokeStyle = '#6e5236'; g.lineWidth = 7
        g.beginPath(); g.moveTo(1322, 92); g.quadraticCurveTo(1250, 120, 1180, 150); g.stroke()
        g.strokeStyle = '#7e5e40'; g.lineWidth = 4
        g.beginPath(); g.moveTo(1262, 116); g.quadraticCurveTo(1235, 150, 1225, 180); g.stroke()
        g.beginPath(); g.moveTo(1205, 140); g.lineTo(1160, 160); g.stroke()
        // 花簇(五瓣 · 大小错落)
        for (const [px, py, s] of [[1195, 128, 6], [1160, 158, 5], [1230, 182, 6], [1252, 112, 5], [1148, 172, 4], [1216, 152, 4]]) {
          g.fillStyle = '#f0a8bc'
          g.fillRect(px - s - 1, py - 1, s, s); g.fillRect(px + 2, py - 1, s, s)
          g.fillRect(px - 1, py - s - 1, s, s); g.fillRect(px - s + 1, py + s - 2, s - 1, s - 1); g.fillRect(px + 1, py + s - 2, s - 1, s - 1)
          g.fillStyle = '#e8b23d'; g.fillRect(px - 1, py - 1, 3, 3)
        }
        // 花苞×2 + 绿叶
        g.fillStyle = '#e87a98'; g.fillRect(1176, 142, 6, 8); g.fillRect(1243, 166, 6, 8)
        g.fillStyle = '#5a9438'; g.fillRect(1170, 150, 8, 5); g.fillRect(1236, 174, 8, 5)
      g.restore()
    }
  })
  def("tao_sword_glow", {
    fx(g, t, X, Y) {
      // 剑光:呼吸辉光 + 剑身流光 + 尖端星闪。是光,会洗过挡在前面的人。
      const q = g.createRadialGradient(X + 144, Y + 34, 8, X + 144, Y + 34, 150)
      q.addColorStop(0, 'rgba(170,240,230,' + (0.16 + Math.sin(t / 800) * 0.10) + ')')
      q.addColorStop(1, 'rgba(170,240,230,0)')
      g.fillStyle = q; g.fillRect(X - 6, Y - 88, 300, 272)
      const gp = X + 28 + ((t / 1500) % 1) * 204
      g.fillStyle = 'rgba(255,255,255,0.9)';  g.fillRect(gp, Y + 26, 12, 10)
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(gp - 15, Y + 28, 13, 6)
      const sph = (t / 1300) % 1, s = Math.sin(sph * Math.PI) * 12
      if (s > 1.5) {
        g.fillStyle = 'rgba(220,255,250,' + (0.9 * Math.sin(sph * Math.PI)) + ')'
        g.fillRect(X + 6 - s, Y + 29, s * 2, 4); g.fillRect(X + 4, Y + 31 - s, 4, s * 2)
      }
    },
    name: "桃夭宝剑", cat: "墙面", tags: ["剑","发光"],
    scope: "character", fromRoom: 'tao',
    w: 304, h: 68, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-56, -88)
      g.fillStyle = '#6e5236'
        g.fillRect(112, 88, 12, 34); g.fillRect(296, 88, 12, 34)
        g.fillStyle = '#3a2c20'; g.fillRect(80, 112, 250, 14)
        g.beginPath(); g.moveTo(80, 112); g.lineTo(56, 119); g.lineTo(80, 126); g.fill()
        g.fillStyle = '#b8e4e0'; g.fillRect(84, 115, 218, 8)
        g.fillStyle = '#e8fffc'; g.fillRect(84, 115, 218, 3)
        g.fillStyle = '#8ecac4'; g.fillRect(84, 121, 218, 2)
        // 护手(金)+ 柄(红缠绳)+ 穗
        g.fillStyle = '#e8b23d'; g.fillRect(300, 104, 12, 30)
        g.fillStyle = '#c8384a'; g.fillRect(312, 113, 34, 12)
        g.fillStyle = '#a82c3c'
        g.fillRect(318, 113, 4, 12); g.fillRect(328, 113, 4, 12); g.fillRect(338, 113, 4, 12)
        g.fillStyle = '#e8b23d'; g.fillRect(346, 110, 8, 18)
        g.fillStyle = '#e87a98'
        g.fillRect(350, 128, 4, 26); g.fillRect(344, 136, 4, 20); g.fillRect(356, 136, 4, 20)
      g.restore()
    }
  })
  def("tao_scroll_luoshu", {
    clickable: true, say: '洛书，九宫的底子 —— 你看得懂吗',
    name: "洛书九宫挂轴", cat: "墙面", tags: ["卷轴","术数"],
    scope: "generic", fromRoom: 'tao',
    w: 320, h: 308, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-560, -60)
      g.fillStyle = '#3a2c20'; g.fillRect(560, 60, 320, 8)
        g.fillStyle = '#f6eedd'; g.fillRect(572, 68, 296, 290)
        g.fillStyle = '#c9a26a'; g.fillRect(566, 358, 308, 10)
        g.strokeStyle = '#8a6844'; g.lineWidth = 3
        for (let i = 0; i <= 3; i++) {
          g.beginPath(); g.moveTo(608 + i * 76, 100); g.lineTo(608 + i * 76, 328); g.stroke()
          g.beginPath(); g.moveTo(608, 100 + i * 76); g.lineTo(836, 100 + i * 76); g.stroke()
        }
        const lo = [[4, 9, 2], [3, 5, 7], [8, 1, 6]]
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < 3; c++) {
            const n = lo[r][c]
            g.fillStyle = (r + c) % 2 ? '#c85a78' : '#4a6a88'
            for (let d = 0; d < n; d++) {
              const dx = 620 + c * 76 + (d % 3) * 18, dy = 112 + r * 76 + ((d / 3) | 0) * 18
              g.fillRect(dx, dy, 9, 9)
            }
          }
      g.restore()
    }
  })
  def("tao_sword_rack", {
    clickable: true, say: '师父的那把在上面，我的在下面',
    name: "剑架双剑", cat: "墙面", tags: ["剑","架"],
    scope: "generic", fromRoom: 'tao',
    w: 242, h: 92, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-218, -178)
      g.fillStyle = '#3a2c20'
        g.fillRect(250, 180, 8, 90); g.fillRect(430, 180, 8, 90)
        g.fillRect(240, 196, 208, 8); g.fillRect(240, 240, 208, 8)
        // 长剑
        g.fillStyle = '#b8c4d4'; g.fillRect(226, 182, 232, 8)
        g.fillStyle = '#8a9ab0'; g.fillRect(226, 187, 232, 3)
        g.fillStyle = '#c85a78'; g.fillRect(444, 178, 16, 16)
        g.fillStyle = '#e8b23d'; g.fillRect(218, 180, 10, 12)
        // 短剑
        g.fillStyle = '#b8c4d4'; g.fillRect(268, 226, 160, 7)
        g.fillStyle = '#c85a78'; g.fillRect(420, 222, 14, 14)
      g.restore()
    }
  })
  def("tao_dart_target", {
    clickable: true, say: '练准头，跟起局一个道理',
    name: "飞镖靶", cat: "墙面", tags: ["靶","练"],
    scope: "generic", fromRoom: 'tao',
    w: 112, h: 112, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-864, -195)
      pxC(920, 250, 56, '#3a2c20')
        pxC(920, 250, 50, '#f0e4c8')
        pxC(920, 250, 34, '#e87a98')
        pxC(920, 250, 16, '#c8384a')
        g.fillStyle = '#3a2c20'
        g.fillRect(902, 226, 5, 20); g.fillRect(934, 260, 5, 20)
      g.restore()
    }
  })
  def("tao_drape_wide", {
    fx(g, t, X, Y) {
      // 纱幔底摆的轻飘。参照海报那次的克制：只动最下面几行
      for (let i = 0; i < 5; i++) {
        const y = 300 - i * 7
        const dx = Math.sin(t / 1300 + i * 0.5) * (1.6 - i * 0.25)
        g.fillStyle = 'rgba(246,214,228,' + (0.16 - i * 0.02).toFixed(3) + ')'
        g.fillRect(X + 4 + dx, Y + y, 56, 6)
      }
    },
    name: "粉纱幔（宽）", cat: "墙面", tags: ["纱","垂"],
    scope: "character", fromRoom: 'tao',
    w: 64, h: 330, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-470, -34)
      g.fillStyle='rgba(240,168,188,0.4)'
          g.fillRect(470,34,44,330)
          g.fillStyle='rgba(240,168,188,0.25)'
          g.fillRect(514,34,20,260)
      g.restore()
    }
  })
  def("tao_drape_narrow", {
    name: "粉纱幔（窄）", cat: "墙面", tags: ["纱","垂"],
    scope: "character", fromRoom: 'tao',
    w: 44, h: 300, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-940, -34)
      g.fillStyle='rgba(240,168,188,0.4)'
          g.fillRect(940,34,44,300)
      g.restore()
    }
  })
  def("tao_lantern", {
    name: "粉灯笼", cat: "墙面", tags: ["灯","发光"],
    scope: "character", fromRoom: 'tao',
    w: 22, h: 48, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-60, -34)
      const lx=60
          g.fillStyle='#3a2c20';g.fillRect(lx+9,34,3,20)
          g.fillStyle='#e87a98';g.fillRect(lx,54,22,28)
          g.fillStyle='#f0a8bc';g.fillRect(lx+4,58,14,20)
          g.fillStyle='#ffd76a';g.fillRect(lx+8,62,6,12)
          g.fillStyle='#3a2c20';g.fillRect(lx,54,22,3);g.fillRect(lx,79,22,3)
      g.restore()
    }
  })
  def("tao_fan_round", {
    name: "团扇", cat: "墙面", tags: ["扇","雅"],
    scope: "generic", fromRoom: 'tao',
    w: 80, h: 100, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-350, -111)
      const fx=390,fy=150
          pxC(fx,fy,40,'#3a2c20')
          pxC(fx,fy,35,'#f6efdc')
          g.fillStyle='#f0a8bc'
          g.fillRect(fx-12,fy-10,10,10);g.fillRect(fx+4,fy-4,10,10)
          g.fillStyle='#5a8a44';g.fillRect(fx-4,fy+8,12,4)
          g.fillStyle='#a06a40';g.fillRect(fx-3,fy+35,6,26)
      g.restore()
    }
  })
  def("tao_birdcage", {
    clickable: true, say: '空的，它自己飞走的……挺好', sayDeep: '我没关门……是我放它走的',
    name: "鸟笼", cat: "墙面", tags: ["笼","雀"],
    scope: "generic", fromRoom: 'tao',
    w: 56, h: 112, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-876, -430)
      g.fillStyle = '#3a2c20'
        g.fillRect(902, 430, 3, 36)
        g.fillRect(876, 466, 56, 5)
        for (let k = 0; k < 6; k++) g.fillRect(878 + k * 10, 471, 2, 64)
        g.fillRect(876, 535, 56, 6)
        g.fillStyle = '#e87a98'
        g.fillRect(892, 508, 16, 10); g.fillRect(904, 502, 8, 8)
        g.fillStyle = '#e8b23d'; g.fillRect(912, 505, 5, 3)
      g.restore()
    }
  })
    def("tao_chart_wall", {
    clickable: true, say: '看什么看，不会用表格软件怎么了，哼', sayDeep: '上个月准了七成……我想让您看见',
    name: "准确率折线图", cat: "墙面", tags: ["纸","手绘","数据"],
    scope: "character", fromRoom: 'tao',
    w: 150, h: 272, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 她把每局的准确率手画成折线贴墙上 —— 不会用表格软件，又不肯问人。
      // 关键在「手画」：打印的图表说的是专业，红笔、用力、有涂改说的是在乎。
      // 竖排四张，左墙只剩这一条窄面。
      const sheet = (x, y, w, h, tilt) => {
        g.fillStyle = 'rgba(40,30,20,0.13)'; g.fillRect(x + 2, y + 3, w, h)
        g.fillStyle = '#f4f1e6'; g.fillRect(x, y, w, h)
        g.fillStyle = 'rgba(120,150,180,0.30)'
        for (let gy = y + 6; gy < y + h - 3; gy += 8) g.fillRect(x + 3, gy, w - 6, 1)
        for (let gx = x + 6; gx < x + w - 3; gx += 8) g.fillRect(gx, y + 3, 1, h - 6)
        g.fillStyle = 'rgba(214,196,120,0.72)'
        g.fillRect(x + w / 2 - 11, y - 4 + tilt, 22, 6)
      }
      sheet(6, 10, 62, 58, 0); sheet(76, 6, 62, 58, 2)
      sheet(6, 78, 62, 56, 1); sheet(76, 76, 62, 58, 0)

      const line = (ox, oy, pts) => {
        g.fillStyle = '#c0392b'
        for (let i = 0; i < pts.length - 1; i++) {
          const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]
          const st = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))
          for (let k = 0; k <= st; k++)
            g.fillRect(ox + x1 + ((x2 - x1) * k / st | 0), oy + y1 + ((y2 - y1) * k / st | 0), 2, 2)
          g.fillRect(ox + x1 - 1, oy + y1 - 1, 3, 3)
        }
      }
      // 纵轴刻度歪斜、间距不均 —— 尺子没对齐，肉眼估的
      g.fillStyle = '#4a4038'; g.fillRect(14, 18, 1, 44)
      for (const [ty, tw] of [[24, 4], [35, 3], [45, 5], [56, 3]]) g.fillRect(15, ty, tw, 1)
      line(18, 14, [[0, 40], [12, 33], [24, 36], [36, 22], [46, 26]])
      line(88, 12, [[0, 34], [11, 38], [22, 24], [34, 28], [44, 16]])
      line(18, 82, [[0, 30], [12, 34], [23, 20], [35, 24], [45, 12]])
      line(88, 80, [[0, 36], [10, 26], [21, 30], [33, 16], [45, 8]])
      g.fillStyle = '#a93226'                                    // 末页向上，画了个箭头
      g.fillRect(131, 86, 6, 2); g.fillRect(133, 84, 2, 6)
      g.fillStyle = 'rgba(70,60,50,0.55)'                        // 小到认不出的日期，只留笔画密度
      for (const [dx, dy] of [[20, 60], [90, 56], [20, 128], [90, 126]]) {
        g.fillRect(dx, dy, 6, 1); g.fillRect(dx, dy + 2, 4, 1)
      }
      g.fillStyle = 'rgba(90,80,70,0.30)'; g.fillRect(108, 118, 20, 8)   // 涂改，底下透出旧数字
      g.fillStyle = '#c0392b'; g.fillRect(106, 121, 24, 2)
      g.restore()
    }
  })

  def("tao_shrine", {
    clickable: true, say: '还愿，就是还愿……您别多想', sayDeep: '……对不起，我把您守了一辈子的规矩，讲成了段子',
    name: "师父的香位", cat: "供奉", tags: ["木","香","念"],
    scope: "character", fromRoom: 'tao',
    w: 160, h: 200, base: 200, foot: [10, 176, 140, 24],
    zLayer: 'sort',
    fx(g, t) {
      // 一缕极轻的香烟。幅度参照阿云房的香炉 —— 是「看得出在燃」，不是要动给人看
      const puff = (bx, by, seed) => {
        for (let i = 0; i < 5; i++) {
          const k = (t / 1000 + seed + i * 0.7) % 3
          g.globalAlpha = 0.16 * (1 - k / 3)
          g.fillStyle = '#d8d2c4'
          g.fillRect(bx + Math.sin(k * 2.1 + seed) * 3, by - k * 15, 2, 3)
        }
        g.globalAlpha = 1
      }
      puff(66, 116, 0); puff(80, 116, 1.4)
    },
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 嘴上说来还愿，其实是道歉 —— 她把师父守了一辈子的规矩，讲成了段子。
      g.fillStyle = 'rgba(40,30,20,0.16)'; g.fillRect(14, 188, 132, 10)   // ① 龛底落影
      g.fillStyle = '#3a2a1c'; g.fillRect(12, 26, 136, 164)               // ② 龛体描边
      g.fillStyle = '#6e4d30'; g.fillRect(18, 32, 124, 152)               // ③ 木色，朴素无雕饰
      g.fillStyle = '#5a3d26'; g.fillRect(18, 32, 124, 10)                //    顶板
      g.fillStyle = '#4a3220'; g.fillRect(24, 44, 112, 108)               //    内龛，暗
      g.fillStyle = '#8a6440'; g.fillRect(12, 20, 136, 12)                //    出檐
      g.fillStyle = '#3a2a1c'; g.fillRect(10, 16, 140, 6)
      // ④ 牌位 —— 没有字。她不敢写
      g.fillStyle = '#2e2118'; g.fillRect(58, 56, 44, 74)
      g.fillStyle = '#d8cdb8'; g.fillRect(62, 60, 36, 66)
      g.fillStyle = '#c4b89e'; g.fillRect(62, 60, 36, 5)
      g.fillStyle = '#2e2118'; g.fillRect(54, 126, 52, 8)                 //    牌座
      // ⑤ 香炉与三炷香，长短不一 —— 不是同时点的
      g.fillStyle = '#2e2118'; g.fillRect(52, 138, 56, 20)
      g.fillStyle = '#7a7068'; g.fillRect(56, 142, 48, 14)
      g.fillStyle = '#5e564e'; g.fillRect(56, 142, 48, 4)
      g.fillStyle = '#8a7a5c'
      g.fillRect(65, 116, 2, 26); g.fillRect(79, 110, 2, 32); g.fillRect(93, 122, 2, 20)
      g.fillStyle = '#c0503a'                                             //    香头，燃着
      g.fillRect(65, 114, 2, 3); g.fillRect(79, 108, 2, 3); g.fillRect(93, 120, 2, 3)
      // ⑥ 一枝干桃花，与窗边那枝同源
      g.fillStyle = '#6e5236'; g.fillRect(120, 96, 3, 44)
      g.fillStyle = '#5a4228'; g.fillRect(114, 108, 7, 2); g.fillRect(123, 118, 6, 2)
      g.fillStyle = '#d9a0ae'
      g.fillRect(112, 104, 5, 5); g.fillRect(126, 114, 5, 5); g.fillRect(118, 92, 5, 5)
      // ⑦ 供一杯奶茶 —— 她唯一能给的、属于她自己的东西
      g.fillStyle = '#2e2118'; g.fillRect(28, 146, 20, 26)
      g.fillStyle = '#e8dcc8'; g.fillRect(31, 149, 14, 20)
      g.fillStyle = '#b98a5e'; g.fillRect(31, 156, 14, 13)                //    奶茶色
      g.fillStyle = '#5a4632'; g.fillRect(34, 160, 3, 3); g.fillRect(39, 163, 3, 3)  // 珍珠
      g.fillStyle = '#c8bca8'; g.fillRect(31, 149, 14, 3)
      // ⑧ 龛前一小块地面，跪得发亮
      g.fillStyle = 'rgba(240,232,214,0.20)'; g.fillRect(40, 176, 78, 14)
      g.restore()
    }
  })

  def("tao_cup_shelf", {
    clickable: true, say: '攒着……攒着卖钱不行吗？第一只？第一只怎么了', sayDeep: '……九块九，第一笔，行了吧',
    name: "奶茶空杯架", cat: "收纳", tags: ["杯","攒","纪念"],
    scope: "character", fromRoom: 'tao',
    w: 120, h: 168, base: 168, foot: [6, 150, 108, 18],
    zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 第一笔打赏九块九买的那杯，洗干净留到现在；后面的陆续摆成一排。
      // 关键在【最下层最左那只单独隔开一个身位】—— 位置本身就是纪念，不用写字。
      g.fillStyle = 'rgba(40,30,20,0.15)'; g.fillRect(4, 158, 112, 8)
      g.fillStyle = '#3a2a1c'; g.fillRect(6, 8, 108, 152)                 // ① 架子描边
      g.fillStyle = '#8a6a48'; g.fillRect(10, 12, 100, 144)               // ② 自己钉的，木色浅
      g.fillStyle = '#6a4f34'                                             // ③ 三层层板，不太平
      g.fillRect(10, 56, 100, 5); g.fillRect(10, 105, 100, 5)
      g.fillRect(12, 152, 96, 5)
      const cup = (x, y, w, h, tint, straw) => {                          // ④ 空杯，洗得发亮
        g.fillStyle = '#2e2118'                                            //    杯身上宽下窄
        g.fillRect(x, y, w, h); g.fillRect(x + 1, y + h - 3, w - 2, 3)
        g.fillStyle = '#eae4d6'; g.fillRect(x + 2, y + 2, w - 4, h - 4)
        g.fillStyle = '#ded7c6'; g.fillRect(x + 3, y + h - 7, w - 6, 4)   //    底部略收
        g.fillStyle = tint; g.fillRect(x + 1, y + 1, w - 2, 4)            //    封口膜
        g.fillStyle = '#2e2118'; g.fillRect(x + 1, y + 5, w - 2, 1)
        if (straw !== 0) {                                                 //    吸管 —— 没有它就不是奶茶杯
          const sx = x + (w >> 1) + (straw || 0)
          g.fillStyle = '#2e2118'; g.fillRect(sx - 1, y - 9, 4, 11)
          g.fillStyle = straw > 0 ? '#d98aa0' : '#8ab0c8'; g.fillRect(sx, y - 8, 2, 10)
        }
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x + 3, y + 7, 2, h - 12)
      }
      cup(20, 34, 17, 22, '#d9a0ae', 1); cup(42, 30, 19, 26, '#c8b48e', -1)   //  上层，大小不一
      cup(66, 34, 16, 22, '#a8c0b0', 0); cup(86, 32, 17, 24, '#d9a0ae', 1)
      cup(20, 84, 18, 21, '#c8b48e', -1); cup(44, 82, 17, 23, '#a8c0b0', 1)   //  中层
      cup(70, 84, 19, 21, '#d9a0ae', 0)
      // ⑤ 第一只：单独放在最下层最左，和其他隔开一个身位
      cup(18, 128, 20, 24, '#e2c4a0', 1)
      g.fillStyle = 'rgba(150,130,100,0.45)'                              //    褪色的手写标签，字已看不清
      g.fillRect(21, 136, 13, 7)
      g.fillStyle = 'rgba(110,95,72,0.5)'; g.fillRect(23, 139, 8, 1)
      g.fillStyle = 'rgba(190,205,200,0.28)'; g.fillRect(84, 150, 22, 6)  // ⑥ 架边一小片水渍
      g.restore()
    }
  })

  def("tao_paper_bin", {
    clickable: true, say: '……谁半夜练字了，这是废纸，收着卖的', sayDeep: '练了两年，还是丑',
    name: "练字纸篓", cat: "收纳", tags: ["竹","纸","练"],
    scope: "generic", fromRoom: 'tao',
    w: 140, h: 140, base: 140, foot: [12, 120, 116, 20],
    zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 她的招牌字很丑。有人说难看，她说「这叫风格」，然后半夜偷偷练。
      // 关键在【纸团有新旧】：上层白、底层泛黄 —— 一晚上的挫败和长年的坚持是两回事。
      g.fillStyle = 'rgba(40,30,20,0.15)'; g.fillRect(10, 126, 116, 8)
      g.fillStyle = '#3a2a1c'; g.fillRect(14, 56, 112, 74)                // ① 竹篓描边
      g.fillStyle = '#b89058'; g.fillRect(18, 60, 104, 66)                // ② 竹色
      g.fillStyle = 'rgba(90,66,38,0.42)'                                 // ③ 编纹，交错
      for (let x = 22; x < 120; x += 9) g.fillRect(x, 62, 2, 62)
      for (let y = 66; y < 124; y += 10) g.fillRect(20, y, 100, 2)
      g.fillStyle = '#8a6a3c'; g.fillRect(16, 56, 108, 6)                 //    篓口
      const ball = (x, y, r, c) => {                                      // ④ 纸团
        g.fillStyle = '#2e2118'
        for (let dy = -r; dy <= r; dy++) { const dx = Math.sqrt(r*r - dy*dy)|0; g.fillRect(x-dx, y+dy, dx*2, 1) }
        g.fillStyle = c
        for (let dy = -r+1; dy <= r-1; dy++) { const dx = Math.sqrt((r-1)*(r-1) - dy*dy)|0; g.fillRect(x-dx, y+dy, dx*2, 1) }
        g.fillStyle = 'rgba(120,105,80,0.30)'; g.fillRect(x-r+3, y-1, r, 1); g.fillRect(x-2, y+2, r-1, 1)
      }
      ball(38, 108, 11, '#b9a878'); ball(64, 112, 12, '#ad9c६e'.replace('६','6'))   // ⑤ 底层泛黄
      ball(94, 110, 10, '#b3a273')                                        //    —— 色差要拉开，
      ball(46, 74, 12, '#f4f1e6'); ball(74, 70, 13, '#faf8f0')            //    否则「练了很久」读不出来
      ball(102, 78, 11, '#f0ece0')
      g.fillStyle = '#f6f2e6'                                             // ⑥ 最上一团半展开，露出毛笔字一角
      g.fillRect(84, 44, 26, 20)
      g.fillStyle = '#2e2118'; g.fillRect(86, 46, 22, 2)
      g.fillStyle = 'rgba(46,33,24,0.75)'; g.fillRect(90, 50, 12, 3); g.fillRect(94, 53, 3, 8)
      ball(20, 132, 9, '#e8e2d0'); ball(126, 128, 8, '#e4ddc8')           // ⑦ 扔偏了没捡的两团
      g.restore()
    }
  })

  def("tao_notebook", {
    clickable: true, say: '记一下而已，又不是……又不是记得住每一个', sayDeep: '三千两百个……我数过',
    name: "手账 · 观众名册", cat: "文具", tags: ["纸","记","名字"],
    scope: "character", fromRoom: 'tao',
    w: 260, h: 150, base: 150, foot: [10, 128, 240, 22],
    zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 有人在弹幕说今天很难过，她回「关我什么事」，然后把那条抄下来了。
      // 关键在【下面压着更多本】—— 一本是习惯，一摞是执念。
      g.fillStyle = 'rgba(40,30,20,0.15)'; g.fillRect(12, 136, 236, 8)
      // ① 底下压着的几本，只露书脊
      g.fillStyle = '#2e2118'; g.fillRect(16, 112, 228, 26)
      g.fillStyle = '#8a5a6a'; g.fillRect(19, 115, 222, 6)
      g.fillStyle = '#5a7a8a'; g.fillRect(19, 122, 222, 6)
      g.fillStyle = '#7a6a4a'; g.fillRect(19, 129, 222, 6)
      // ② 摊开的本子，左右两页
      g.fillStyle = '#2e2118'; g.fillRect(14, 14, 232, 100)
      g.fillStyle = '#f6f2e6'; g.fillRect(18, 18, 108, 92)
      g.fillStyle = '#f2eee0'; g.fillRect(134, 18, 108, 92)
      g.fillStyle = '#d8d0bc'; g.fillRect(126, 14, 8, 100)               //    装订线
      g.fillStyle = 'rgba(120,110,90,0.20)'; g.fillRect(18, 18, 108, 4); g.fillRect(134, 18, 108, 4)
      // ③ 密密麻麻的短行 —— 不是句子，是一行一个 ID
      g.fillStyle = 'rgba(58,48,38,0.72)'
      for (let i = 0; i < 11; i++) {
        const w1 = 30 + ((i * 17) % 34)
        g.fillRect(24, 26 + i * 7, w1, 2)
        const w2 = 26 + ((i * 23) % 38)
        g.fillRect(140, 26 + i * 7, w2, 2)
      }
      // ④ 有些 ID 后面跟一小段更小更挤的字
      g.fillStyle = 'rgba(58,48,38,0.42)'
      for (const [x, y, w2] of [[24,68,52],[24,75,44],[140,54,48],[140,61,56],[140,96,40]])
        g.fillRect(x, y, w2, 1)
      // ⑤ 几行被红笔圈起来
      g.strokeStyle = '#c0392b'; g.lineWidth = 1
      g.strokeRect(22.5, 39.5, 62, 8); g.strokeRect(138.5, 74.5, 58, 8)
      // ⑥ 页边贴的彩色小标签，分类用
      for (const [x, y, c] of [[240,30,'#d98aa0'],[240,52,'#8ab0c8'],[240,74,'#c8b46a'],[240,96,'#9ac08a']]) {
        g.fillStyle = '#2e2118'; g.fillRect(x, y, 8, 14)
        g.fillStyle = c; g.fillRect(x + 1, y + 1, 6, 12)
      }
      // ⑦ 一支笔，笔帽没盖
      g.fillStyle = '#2e2118'; g.fillRect(150, 118, 76, 8)
      g.fillStyle = '#c0392b'; g.fillRect(152, 120, 58, 4)
      g.fillStyle = '#e8e2d0'; g.fillRect(210, 120, 14, 4)
      g.fillStyle = '#2e2118'; g.fillRect(228, 116, 16, 10)              //    笔帽，扔在一边
      g.fillStyle = '#a0342a'; g.fillRect(230, 118, 12, 6)
      g.restore()
    }
  })

  def("tao_lamp_desk", {
    clickable: true, say: '灯还亮着……又不是特意等谁',
    name: "夹子台灯", cat: "灯具", tags: ["灯","暖","夜"],
    scope: "generic", fromRoom: 'tao',
    w: 84, h: 138, base: 138, foot: [16, 118, 52, 20],
    zLayer: 'sort',
    // 证据区的光：暖黄。她昼伏夜出，这盏灯亮的时候镜头早关了
    light: { x: 42, y: 44, r: 150, color: '#f0c878', flicker: 0.12 },
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(40,30,20,0.16)'; g.fillRect(14, 128, 56, 8)
      g.fillStyle = '#2e2118'; g.fillRect(24, 118, 36, 14)              // ① 夹座
      g.fillStyle = '#6a5a4a'; g.fillRect(27, 121, 30, 8)
      g.fillStyle = '#2e2118'; g.fillRect(38, 54, 8, 66)                // ② 灯杆，略歪
      g.fillStyle = '#7a6a58'; g.fillRect(40, 56, 4, 62)
      g.fillStyle = '#2e2118'                                            // ③ 灯罩
      g.beginPath(); g.moveTo(14, 54); g.lineTo(70, 54); g.lineTo(58, 22); g.lineTo(26, 22); g.closePath(); g.fill()
      g.fillStyle = '#c8a860'
      g.beginPath(); g.moveTo(19, 51); g.lineTo(65, 51); g.lineTo(55, 26); g.lineTo(29, 26); g.closePath(); g.fill()
      g.fillStyle = '#e0c084'                                            // ④ 罩面受光
      g.beginPath(); g.moveTo(19, 51); g.lineTo(42, 51); g.lineTo(38, 26); g.lineTo(29, 26); g.closePath(); g.fill()
      g.fillStyle = '#fff0c8'; g.fillRect(22, 48, 40, 5)                // ⑤ 灯口，亮
      g.fillStyle = 'rgba(255,232,180,0.45)'; g.fillRect(16, 53, 52, 4)
      g.fillStyle = 'rgba(255,224,160,0.16)'                             // ⑥ 罩下一小片落光
      g.fillRect(10, 57, 64, 10); g.fillRect(18, 67, 48, 8)
      g.restore()
    }
  })

  def("tao_ball", {
    name: "小皮球", cat: "玩具", tags: ["球","狗"],
    scope: "generic", fromRoom: 'tao',
    w: 40, h: 40, base: 40, foot: [4, 32, 32, 8],
    zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 道具而非角色 —— 它进 placeProp，和狗在同一个排序空间里，
      // 于是狗能从球【前面或后面】经过，而不是永远压着它。
      g.fillStyle = '#2e2118'
      for (let dy = -18; dy <= 18; dy++) { const dx = Math.sqrt(324 - dy*dy)|0; g.fillRect(20-dx, 20+dy, dx*2, 1) }
      g.fillStyle = '#d94a4a'
      for (let dy = -15; dy <= 15; dy++) { const dx = Math.sqrt(225 - dy*dy)|0; g.fillRect(20-dx, 20+dy, dx*2, 1) }
      g.fillStyle = '#f6efdc'; g.fillRect(6, 16, 28, 7)              // 白色横带
      g.fillStyle = '#e8c84a'; g.fillRect(6, 19, 28, 2)              // 黄色细线
      g.fillStyle = 'rgba(255,255,255,0.55)'                          // 高光
      g.fillRect(11, 9, 6, 4); g.fillRect(10, 13, 4, 3)
      g.restore()
    }
  })

  def("tao_beam", {
    name: "承重横梁", cat: "结构", tags: ["木","梁","承重"],
    scope: "generic", fromRoom: 'tao',
    w: 460, h: 34, base: 0, foot: [0, 0, 0, 0],
    // wall:true —— 梁是结构件,挂在房间上方,不参与地面 y-sort。
    // 只写 zLayer:'above' 不够:床边地毯(y868-986)与梁(y856-890)重叠且画在其后,
    // 会把梁盖掉。月洞窗、灯笼这类挂件用的也是 wall:true。
    wall: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 尺度约定:draw 内的 scale(0.5) 与 placeAsset 的 2x 预缩放相抵,
      // 所以这里的坐标数值 = 最终屏幕像素。参照 tao_bed:draw 画 310 宽、声明 w:348。
      // 从右墙伸出的一根圆木,左端是断面(看得见年轮),右端没入墙里。
      g.fillStyle = '#2e2118'; g.fillRect(0, 0, 460, 34)            // ① 描边
      g.fillStyle = '#8a6038'; g.fillRect(3, 3, 454, 28)            // ② 木身
      g.fillStyle = '#a67a4a'; g.fillRect(3, 3, 454, 9)             // ③ 上沿受光
      g.fillStyle = '#6a4526'; g.fillRect(3, 25, 454, 6)            // ④ 下沿背光
      g.fillStyle = 'rgba(60,40,22,0.32)'                           // ⑤ 顺纹,长短不一
      for (const [x, w2, y] of [[35,75,14],[130,45,17],[200,90,13],[310,60,18],[395,50,15]])
        g.fillRect(x, y, w2, 2)
      g.fillStyle = '#3a2a1c'; g.fillRect(0, 0, 13, 34)             // ⑥ 左端断面
      g.fillStyle = '#7a5230'; g.fillRect(2, 4, 9, 26)
      g.fillStyle = 'rgba(58,42,28,0.55)'
      g.fillRect(4, 10, 5, 2); g.fillRect(4, 20, 5, 2)              //    年轮
      // ⑦ 两处捆绳:位置对齐秋千的两根吊绳(sprite 内 x70-75 / x138-143,
      //   秋千置于 1020 → 房间 x1090 / x1158;梁起于 980,故此处 108 / 176)
      for (const bx of [108, 176]) {
        g.fillStyle = '#5a3f24'; g.fillRect(bx, 1, 8, 32)
        g.fillStyle = '#8a6a44'; g.fillRect(bx + 2, 1, 2, 32); g.fillRect(bx + 5, 1, 2, 32)
      }
      g.restore()
    }
  })

  def("tao_windchime", {
    fx(g, t, X, Y) {
      // 风铃轻摆。幅度 2px —— 「显示得是挂着的」，不是要动给人看
      const dx = Math.sin(t / 1100) * 2
      g.fillStyle = 'rgba(200,220,235,0.55)'
      g.fillRect(X + 6 + dx, Y + 44, 6, 14)
      g.fillStyle = 'rgba(255,255,255,0.30)'
      g.fillRect(X + 7 + dx, Y + 46, 2, 9)
    },
    name: "风铃", cat: "墙面", tags: ["铃","垂"],
    scope: "generic", fromRoom: 'tao',
    w: 18, h: 64, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-982, -60)
      g.fillStyle = '#3a2c20'; g.fillRect(990, 60, 2, 24)
        g.fillStyle = '#c9a26a'; g.fillRect(982, 84, 18, 6); g.fillRect(985, 90, 12, 10)
        g.fillStyle = '#3a2c20'; g.fillRect(990, 100, 1, 12)
        g.fillStyle = '#f0a8bc'; g.fillRect(986, 112, 9, 11)
      g.restore()
    }
  })
  def("tao_sword_tassel", {
    name: "剑穗挂件", cat: "墙面", tags: ["穗","挂"],
    scope: "generic", fromRoom: 'tao',
    w: 12, h: 56, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-458, -120)
      g.fillStyle = '#c8384a'
        g.fillRect(462, 120, 5, 5)
        g.fillRect(460, 125, 9, 30)
        for (let k = 0; k < 3; k++) g.fillRect(458 + k * 5, 155, 2, 20)
      g.restore()
    }
  })
  def("tao_yingluo", {
    name: "璎珞流苏", cat: "墙面", tags: ["流苏","挂"],
    scope: "generic", fromRoom: 'tao',
    w: 16, h: 62, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-293, -34)
      const yx=300
          g.fillStyle='#e8b23d';g.fillRect(yx,34,3,26)
          pxC(yx+1,66,8,'#5a9a8a')
          g.fillStyle='#e87a98'
          g.fillRect(yx-4,76,2,16);g.fillRect(yx+1,76,2,20);g.fillRect(yx+6,76,2,16)
      g.restore()
    }
  })
  def("tao_dart_pouch", {
    name: "镖囊", cat: "墙面", tags: ["囊","镖"],
    scope: "generic", fromRoom: 'tao',
    w: 48, h: 76, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-480, -284)
      g.fillStyle = '#3a2c20'; g.fillRect(500, 296, 5, 5)
        g.fillStyle = '#8a5c34'
        g.beginPath(); g.moveTo(480, 300); g.lineTo(528, 300); g.lineTo(520, 360); g.lineTo(488, 360); g.fill()
        g.fillStyle = '#b8c4d4'
        g.fillRect(490, 288, 4, 16); g.fillRect(500, 284, 4, 20); g.fillRect(510, 288, 4, 16)
      g.restore()
    }
  })
  def("tao_bagua_mirror", {
    clickable: true, say: '照妖的，防谁？防你',
    name: "八卦镜", cat: "墙面", tags: ["镜","术数"],
    scope: "generic", fromRoom: 'tao',
    w: 104, h: 104, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-514, -152)
      g.fillStyle = '#3a2c20'
        g.beginPath(); g.moveTo(530, 168); g.lineTo(566, 152); g.lineTo(602, 168); g.lineTo(618, 204); g.lineTo(602, 240); g.lineTo(566, 256); g.lineTo(530, 240); g.lineTo(514, 204); g.fill()
        g.fillStyle = '#c9a26a'
        g.beginPath(); g.moveTo(536, 174); g.lineTo(566, 160); g.lineTo(596, 174); g.lineTo(610, 204); g.lineTo(596, 234); g.lineTo(566, 248); g.lineTo(536, 234); g.lineTo(522, 204); g.fill()
        pxC(566, 204, 22, '#e8ddd0')
        g.fillStyle = '#3a2c20'
        for (let k = 0; k < 8; k++) {
          const a = k * 0.785
          g.fillRect(566 + Math.cos(a) * 32 - 5, 204 + Math.sin(a) * 32 - 2, 10, 4)
        }
      g.restore()
    }
  })
  def("tao_peach_sword", {
    clickable: true, say: '岛上带下来的，不许摸',
    name: "桃木剑", cat: "墙面", tags: ["剑","法器"],
    scope: "generic", fromRoom: 'tao',
    w: 276, h: 46, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-596, -322)
      g.fillStyle = '#3a2c20'; g.fillRect(640, 322, 10, 20); g.fillRect(830, 322, 10, 20)
        g.fillStyle = '#b58a5c'
        g.beginPath(); g.moveTo(620, 336); g.lineTo(850, 330); g.lineTo(872, 336); g.lineTo(850, 342); g.fill()
        g.fillStyle = '#a0764a'; g.fillRect(636, 340, 180, 3)
        g.fillStyle = '#8a5c34'; g.fillRect(614, 326, 14, 22); g.fillRect(596, 332, 20, 10)
        g.fillStyle = '#c8384a'; g.fillRect(600, 342, 5, 26); g.fillRect(607, 342, 5, 22)
      g.restore()
    }
  })
  def("tao_polaroid_string", {
    clickable: true, say: '随手拍的，谁会一张张挂起来啊，哼',
    name: "拍立得照片串", cat: "墙面", tags: ["照片","串"],
    scope: "character", fromRoom: 'tao',
    w: 58, h: 302, base: 0, foot: [0, 0, 0, 0],
    wall: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-910, -48)
      g.strokeStyle = '#8a7a5c'; g.lineWidth = 3
        g.beginPath(); g.moveTo(934, 56); g.lineTo(938, 348); g.stroke()
        g.fillStyle = '#6e5236'; g.fillRect(928, 48, 14, 10)
        for (let k = 0; k < 4; k++) {
          const fx = 910 + (k % 2) * 14, fy = 76 + k * 68
          g.fillStyle = '#3a2c20'; g.fillRect(fx + 16, fy - 7, 8, 9)
          g.fillStyle = '#f6f2ea'; g.fillRect(fx, fy, 44, 52)
          g.fillStyle = ['#e8a0b4', '#8ab8d8', '#a8c890', '#e8c890'][k]
          g.fillRect(fx + 4, fy + 4, 36, 32)
          g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(fx + 7, fy + 7, 10, 6)
        }
      g.restore()
    }
  })
  def("tao_rug_center", {
    name: "中央方毯", cat: "地面", tags: ["毯","布"],
    scope: "character", fromRoom: 'tao',
    w: 606, h: 638, base: 0, foot: [0, 0, 0, 0],
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}

          const zoneRug=(x,y,w2,h2,base,edge,deco)=>{
            g.fillStyle='rgba(60,44,32,0.18)';g.fillRect(x+6,y+h2,w2,8)
            g.fillStyle=edge;g.fillRect(x,y,w2,h2)
            g.fillStyle=base;g.fillRect(x+10,y+10,w2-20,h2-20)
            g.fillStyle='rgba(120,150,140,0.16)'
            for(let yy=y+16;yy<y+h2-14;yy+=10)g.fillRect(x+12,yy,w2-24,2)
            g.fillStyle='rgba(255,255,255,0.55)'
            for(let k=x+18;k<x+w2-16;k+=24){g.fillRect(k,y+3,5,4);g.fillRect(k,y+h2-7,5,4)}
            for(let k=y+18;k<y+h2-16;k+=24){g.fillRect(x+3,k,4,5);g.fillRect(x+w2-7,k,4,5)}
            g.strokeStyle=edge;g.lineWidth=3
            g.strokeRect(x+26,y+26,w2-52,h2-52)
            for(const [qx,qy] of [[x+26,y+26],[x+w2-26,y+26],[x+26,y+h2-26],[x+w2-26,y+h2-26]]){
              g.fillStyle=edge
              g.fillRect(qx-8,qy-2,16,5);g.fillRect(qx-2,qy-8,5,16)
              g.fillStyle='rgba(255,255,255,0.65)';g.fillRect(qx-2,qy-2,5,5)
            }
            if(deco==='tassel'){
              for(let k=0;k<((w2/36)|0);k++){
                g.fillStyle=edge
                g.fillRect(x+10+k*36,y-9,5,9);g.fillRect(x+10+k*36,y+h2,5,9)
                g.fillStyle='rgba(255,255,255,0.55)'
                g.fillRect(x+10+k*36,y-4,5,2);g.fillRect(x+10+k*36,y+h2+6,5,2)
              }
            } else if(deco==='dots'){
              g.fillStyle=edge
              for(const [qx,qy] of [[x+46,y+46],[x+w2-52,y+46],[x+46,y+h2-52],[x+w2-52,y+h2-52]]){
                g.fillRect(qx,qy-5,5,15);g.fillRect(qx-5,qy,15,5)
              }
            }
          }
      g.save(); g.scale(0.5, 0.5); g.translate(-420, -721)
      zoneRug(420,730,600,620,'#cfdfd8','#a8c4b8','tassel')
          g.strokeStyle='#a8c4b8';g.lineWidth=3
          for(const [ccx,ccy,fx2] of [[478,792,1],[962,792,-1],[478,1288,1],[962,1288,-1]]){
            g.beginPath();g.arc(ccx,ccy,16,0.4,4.6);g.stroke()
            g.beginPath();g.arc(ccx+18*fx2,ccy+6,10,1,5.6);g.stroke()
            g.beginPath();g.arc(ccx-14*fx2,ccy+8,7,0,4.2);g.stroke()
          }
      g.restore()
    }
  })
  def("tao_rug_round", {
    name: "梳妆圆毯", cat: "地面", tags: ["毯","圆"],
    scope: "generic", fromRoom: 'tao',
    w: 472, h: 196, base: 0, foot: [0, 0, 0, 0],
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}

          const zoneRound=(cx,cy,r,base,edge)=>{
            g.fillStyle='rgba(60,44,32,0.15)'
            for(let dy=-6;dy<=6;dy++){
              const dxs=(r*Math.sqrt(1-(dy/6)*(dy/6)))|0
              g.fillRect(cx-dxs+8,cy+(r*0.42|0)+dy-4,dxs*2,1)
            }
            for(const [rr,col] of [[r,edge],[r-10,base]]){
              for(let dy=-rr*0.42|0;dy<=rr*0.42;dy++){
                const dxs=(rr*Math.sqrt(1-(dy/(rr*0.42))*(dy/(rr*0.42))))|0
                g.fillRect(cx-dxs,cy+dy,dxs*2,1)
              }
            }
            g.save();g.translate(cx,cy);g.scale(1,0.42)
            g.strokeStyle='rgba(120,150,140,0.22)';g.lineWidth=2
            for(let k=0;k<12;k++){
              const a2=k*Math.PI/6
              g.beginPath();g.moveTo(Math.cos(a2)*40,Math.sin(a2)*40)
              g.lineTo(Math.cos(a2)*(r-26),Math.sin(a2)*(r-26));g.stroke()
            }
            g.strokeStyle=edge;g.lineWidth=3
            g.beginPath();g.arc(0,0,r-24,0,7);g.stroke()
            g.strokeStyle='rgba(168,196,184,0.6)';g.lineWidth=2
            g.beginPath();g.arc(0,0,r-44,0,7);g.stroke()
            g.fillStyle=edge
            for(let k=0;k<8;k++){
              const a2=k*Math.PI/4
              const fx=Math.cos(a2)*66,fy=Math.sin(a2)*66
              g.fillRect(fx-6,fy-6,12,12)
            }
            g.fillStyle='rgba(255,255,255,0.6)'
            g.beginPath();g.arc(0,0,22,0,7);g.fill()
            g.fillStyle=edge
            g.beginPath();g.arc(0,0,12,0,7);g.fill()
            g.restore()
          }
      g.save(); g.scale(0.5, 0.5); g.translate(-14, -523)
      zoneRound(246,620,232,'#cfdfd8','#a8c4b8')
      g.restore()
    }
  })
  def("tao_rug_bedside", {
    name: "床边长毯", cat: "地面", tags: ["毯","条"],
    scope: "generic", fromRoom: 'tao',
    w: 306, h: 118, base: 0, foot: [0, 0, 0, 0],
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}

          const zoneRug=(x,y,w2,h2,base,edge,deco)=>{
            g.fillStyle='rgba(60,44,32,0.18)';g.fillRect(x+6,y+h2,w2,8)
            g.fillStyle=edge;g.fillRect(x,y,w2,h2)
            g.fillStyle=base;g.fillRect(x+10,y+10,w2-20,h2-20)
            g.fillStyle='rgba(120,150,140,0.16)'
            for(let yy=y+16;yy<y+h2-14;yy+=10)g.fillRect(x+12,yy,w2-24,2)
            g.fillStyle='rgba(255,255,255,0.55)'
            for(let k=x+18;k<x+w2-16;k+=24){g.fillRect(k,y+3,5,4);g.fillRect(k,y+h2-7,5,4)}
            for(let k=y+18;k<y+h2-16;k+=24){g.fillRect(x+3,k,4,5);g.fillRect(x+w2-7,k,4,5)}
            g.strokeStyle=edge;g.lineWidth=3
            g.strokeRect(x+26,y+26,w2-52,h2-52)
            for(const [qx,qy] of [[x+26,y+26],[x+w2-26,y+26],[x+26,y+h2-26],[x+w2-26,y+h2-26]]){
              g.fillStyle=edge
              g.fillRect(qx-8,qy-2,16,5);g.fillRect(qx-2,qy-8,5,16)
              g.fillStyle='rgba(255,255,255,0.65)';g.fillRect(qx-2,qy-2,5,5)
            }
            if(deco==='tassel'){
              for(let k=0;k<((w2/36)|0);k++){
                g.fillStyle=edge
                g.fillRect(x+10+k*36,y-9,5,9);g.fillRect(x+10+k*36,y+h2,5,9)
                g.fillStyle='rgba(255,255,255,0.55)'
                g.fillRect(x+10+k*36,y-4,5,2);g.fillRect(x+10+k*36,y+h2+6,5,2)
              }
            } else if(deco==='dots'){
              g.fillStyle=edge
              for(const [qx,qy] of [[x+46,y+46],[x+w2-52,y+46],[x+46,y+h2-52],[x+w2-52,y+h2-52]]){
                g.fillRect(qx,qy-5,5,15);g.fillRect(qx-5,qy,15,5)
              }
            }
          }
      g.save(); g.scale(0.5, 0.5); g.translate(-1096, -868)
      zoneRug(1096,868,300,110,'#e8f1ee','#a8c4b8','dots')
          g.fillStyle='#cfdfd8'
          for(let k=0;k<5;k++)g.fillRect(1122+k*56,884,28,78)
      g.restore()
    }
  })
  def("tao_rug_tea", {
    name: "茶点方毯", cat: "地面", tags: ["毯","方"],
    scope: "generic", fromRoom: 'tao',
    w: 336, h: 248, base: 0, foot: [0, 0, 0, 0],
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}

          const zoneRug=(x,y,w2,h2,base,edge,deco)=>{
            g.fillStyle='rgba(60,44,32,0.18)';g.fillRect(x+6,y+h2,w2,8)
            g.fillStyle=edge;g.fillRect(x,y,w2,h2)
            g.fillStyle=base;g.fillRect(x+10,y+10,w2-20,h2-20)
            g.fillStyle='rgba(120,150,140,0.16)'
            for(let yy=y+16;yy<y+h2-14;yy+=10)g.fillRect(x+12,yy,w2-24,2)
            g.fillStyle='rgba(255,255,255,0.55)'
            for(let k=x+18;k<x+w2-16;k+=24){g.fillRect(k,y+3,5,4);g.fillRect(k,y+h2-7,5,4)}
            for(let k=y+18;k<y+h2-16;k+=24){g.fillRect(x+3,k,4,5);g.fillRect(x+w2-7,k,4,5)}
            g.strokeStyle=edge;g.lineWidth=3
            g.strokeRect(x+26,y+26,w2-52,h2-52)
            for(const [qx,qy] of [[x+26,y+26],[x+w2-26,y+26],[x+26,y+h2-26],[x+w2-26,y+h2-26]]){
              g.fillStyle=edge
              g.fillRect(qx-8,qy-2,16,5);g.fillRect(qx-2,qy-8,5,16)
              g.fillStyle='rgba(255,255,255,0.65)';g.fillRect(qx-2,qy-2,5,5)
            }
            if(deco==='tassel'){
              for(let k=0;k<((w2/36)|0);k++){
                g.fillStyle=edge
                g.fillRect(x+10+k*36,y-9,5,9);g.fillRect(x+10+k*36,y+h2,5,9)
                g.fillStyle='rgba(255,255,255,0.55)'
                g.fillRect(x+10+k*36,y-4,5,2);g.fillRect(x+10+k*36,y+h2+6,5,2)
              }
            } else if(deco==='dots'){
              g.fillStyle=edge
              for(const [qx,qy] of [[x+46,y+46],[x+w2-52,y+46],[x+46,y+h2-52],[x+w2-52,y+h2-52]]){
                g.fillRect(qx,qy-5,5,15);g.fillRect(qx-5,qy,15,5)
              }
            }
          }
      g.save(); g.scale(0.5, 0.5); g.translate(-48, -1370)
      zoneRug(48,1370,330,240,'#cfdfd8','#a8c4b8','dots')
      g.restore()
    }
  })
  def("tao_rug_study", {
    name: "书房方毯", cat: "地面", tags: ["毯","方"],
    scope: "generic", fromRoom: 'tao',
    w: 336, h: 258, base: 0, foot: [0, 0, 0, 0],
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}

          const zoneRug=(x,y,w2,h2,base,edge,deco)=>{
            g.fillStyle='rgba(60,44,32,0.18)';g.fillRect(x+6,y+h2,w2,8)
            g.fillStyle=edge;g.fillRect(x,y,w2,h2)
            g.fillStyle=base;g.fillRect(x+10,y+10,w2-20,h2-20)
            g.fillStyle='rgba(120,150,140,0.16)'
            for(let yy=y+16;yy<y+h2-14;yy+=10)g.fillRect(x+12,yy,w2-24,2)
            g.fillStyle='rgba(255,255,255,0.55)'
            for(let k=x+18;k<x+w2-16;k+=24){g.fillRect(k,y+3,5,4);g.fillRect(k,y+h2-7,5,4)}
            for(let k=y+18;k<y+h2-16;k+=24){g.fillRect(x+3,k,4,5);g.fillRect(x+w2-7,k,4,5)}
            g.strokeStyle=edge;g.lineWidth=3
            g.strokeRect(x+26,y+26,w2-52,h2-52)
            for(const [qx,qy] of [[x+26,y+26],[x+w2-26,y+26],[x+26,y+h2-26],[x+w2-26,y+h2-26]]){
              g.fillStyle=edge
              g.fillRect(qx-8,qy-2,16,5);g.fillRect(qx-2,qy-8,5,16)
              g.fillStyle='rgba(255,255,255,0.65)';g.fillRect(qx-2,qy-2,5,5)
            }
            if(deco==='tassel'){
              for(let k=0;k<((w2/36)|0);k++){
                g.fillStyle=edge
                g.fillRect(x+10+k*36,y-9,5,9);g.fillRect(x+10+k*36,y+h2,5,9)
                g.fillStyle='rgba(255,255,255,0.55)'
                g.fillRect(x+10+k*36,y-4,5,2);g.fillRect(x+10+k*36,y+h2+6,5,2)
              }
            } else if(deco==='dots'){
              g.fillStyle=edge
              for(const [qx,qy] of [[x+46,y+46],[x+w2-52,y+46],[x+46,y+h2-52],[x+w2-52,y+h2-52]]){
                g.fillRect(qx,qy-5,5,15);g.fillRect(qx-5,qy,15,5)
              }
            }
          }
      g.save(); g.scale(0.5, 0.5); g.translate(-1104, -1756)
      zoneRug(1104,1756,330,250,'#cfdfd8','#a8c4b8','dots')
      g.restore()
    }
  })
  def("tao_petals", {
    name: "散落花瓣", cat: "地面", tags: ["花瓣","装饰"],
    scope: "character", fromRoom: 'tao',
    w: 1210, h: 1350, base: 0, foot: [0, 0, 0, 0],
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-136, -624)
      const P14=[[1002,1968],[425,1967],[1130,1658],[421,956],[962,1151],[371,1899],[1265,1917],[572,1295],[136,1701],[1249,1715],[810,1838],[821,741],[1261,627],[1045,1274]],P10=[[234,636],[317,1258],[688,1517],[423,1458],[1337,656],[326,1103],[803,796],[936,669],[1340,1194],[426,1093]]
          for(let k=0;k<14;k++){const px=P14[k][0],py=P14[k][1]
            g.fillStyle=k%3?'#f0a8bc':'#e8a0b4'
            g.fillRect(px,py,7,5);g.fillRect(px+3,py-3,5,4)}
          for(let k=0;k<10;k++){const px=P10[k][0],py=P10[k][1]
            g.fillStyle=k%2?'#f0a8bc':'#f6ccd8'
            g.fillRect(px,py,6,4);g.fillRect(px+2,py-3,4,4)}
      g.restore()
    }
  })
  def("tao_door_mat", {
    walkable: true,   // 能踩的:坐垫/蒲团/门垫不是障碍，烧格时跳过
    clickable: true, say: '鞋擦干净，我这儿是要见镜头的',
    name: "门垫绣鞋", cat: "地面", tags: ["垫","鞋"],
    scope: "character", fromRoom: 'tao',
    w: 302, h: 70, base: 0, foot: [0, 0, 0, 0],
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-600, -1960)
      g.fillStyle = '#3a2c20'; g.fillRect(600, 1960, 240, 70)
        g.fillStyle = '#e8a0b4'; g.fillRect(606, 1966, 228, 58)
        g.fillStyle = '#f0b8c8'
        g.fillRect(620, 1980, 200, 3); g.fillRect(620, 2008, 200, 3)
        g.fillStyle = '#c8384a'
        g.fillRect(864, 1980, 16, 30); g.fillRect(886, 1980, 16, 30)
        g.fillStyle = '#e8b23d'; g.fillRect(868, 1984, 8, 6); g.fillRect(890, 1984, 8, 6)
      g.restore()
    }
  })
  def("tao_poem_papers", {
    clickable: true, say: '写着玩的，写得难看，别捡',
    name: "诗笺散落", cat: "地面", tags: ["纸","诗"],
    scope: "generic", fromRoom: 'tao',
    w: 170, h: 122, base: 0, foot: [0, 0, 0, 0],
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-706, -1560)
      for (const [sx, sy, rot] of [[750, 1560, 0], [822, 1608, 1], [706, 1630, 0]]) {
          g.fillStyle = '#f6efdc'
          g.fillRect(sx, sy, rot ? 54 : 40, rot ? 36 : 52)
          g.fillStyle = 'rgba(90,80,60,0.55)'
          for (let k = 0; k < 3; k++) g.fillRect(sx + 8, sy + 8 + k * 10, rot ? 36 : 24, 2)
          g.fillStyle = '#c8384a'; g.fillRect(sx + (rot ? 42 : 28), sy + (rot ? 24 : 40), 6, 6)
        }
      g.restore()
    }
  })
  def("tao_ext_slippers", {
    name: "绣鞋（前景）", cat: "地面", tags: ["鞋","粉"],
    scope: "character", fromRoom: 'tao',
    w: 108, h: 30, base: 0, foot: [0, 0, 0, 0],
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-514, -2284)
      pxE(540, 2296, 26, 12, '#a0764a'); pxE(596, 2302, 26, 12, '#a0764a')
        g.fillStyle = '#e87a98'; g.fillRect(528, 2284, 20, 8); g.fillRect(584, 2290, 20, 8)
      g.restore()
    }
  })
  def("tao_table_qimen", {
    clickable: true, say: '起局要静，你站远点，哼',
    fx(g, t, X, Y, o, room) {
      // 局桌星芒(粉金)。是光,不被站在桌前的人遮挡。room 由引擎传入 —— 素材不绑房间。
      const cast = !!((room && room.state || {}).casting)
      if (cast) {
        // ── 起局：奇门排盘 ────────────────────────────────────
        // 局盘【本身】就是九宫，所以不再叠一层格线（第一版画了，纯属重复）。
        // 做三件事：天盘旋转、八门按次序点亮盘上真正的格子、中宫脉动。
        const cx = X + 200, cy = Y + 203
        const CELL = [[105,108],[200,108],[295,108],[295,203],[295,298],[200,298],[105,298],[105,203]]
        g.save()
        const step = Math.floor(t / 560) % 8                      // ① 八门按次序走
        for (let k = 0; k < 8; k++) {
          const [ox, oy] = CELL[k], px = X + ox, py = Y + oy
          const age = (k - step + 8) % 8
          if (age > 2) continue                                   //    只留亮起的与两格余辉
          const a = age === 0 ? 0.42 : age === 1 ? 0.20 : 0.09
          g.fillStyle = 'rgba(255,228,242,' + a + ')'
          g.fillRect(px - 46, py - 46, 92, 92)                    //    照亮整格，不是画小方块
          if (age === 0) {
            const q2 = g.createRadialGradient(px, py, 4, px, py, 78)
            q2.addColorStop(0, 'rgba(255,196,226,0.50)'); q2.addColorStop(1, 'rgba(255,196,226,0)')
            g.fillStyle = q2; g.fillRect(px - 78, py - 78, 156, 156)
          }
        }
        const spin = t / 1500                                     // ② 天盘：两道反向旋转的弧
        g.strokeStyle = 'rgba(255,170,210,0.85)'; g.lineWidth = 4
        g.beginPath(); g.arc(cx, cy, 168, spin, spin + Math.PI * 1.35); g.stroke()
        g.strokeStyle = 'rgba(255,214,236,0.70)'; g.lineWidth = 3
        g.beginPath(); g.arc(cx, cy, 132, -spin * 1.7, -spin * 1.7 + Math.PI * 0.9); g.stroke()
        const pulse = 0.30 + Math.sin(t / 420) * 0.16             // ③ 中宫脉动
        const q3 = g.createRadialGradient(cx, cy, 6, cx, cy, 62)
        q3.addColorStop(0, 'rgba(255,236,180,' + pulse + ')'); q3.addColorStop(1, 'rgba(255,236,180,0)')
        g.fillStyle = q3; g.fillRect(cx - 62, cy - 62, 124, 124)
        g.globalAlpha = 1; g.restore()
      }
      const q = g.createRadialGradient(X + 200, Y + 200, 20, X + 200, Y + 200, 240)
      q.addColorStop(0, 'rgba(255,180,210,' + (0.12 + Math.sin(t / 850) * 0.07) + ')')
      q.addColorStop(1, 'rgba(255,180,210,0)')
      g.fillStyle = q; g.fillRect(X - 40, Y - 40, 480, 480)
      for (let k = 0; k < 4; k++) {
        const ph = (t / 1400 + k * 0.29) % 1, s = Math.sin(ph * Math.PI) * 10
        if (s <= 1.5) continue
        const sx = X + 200 + [-160, 130, -70, 150][k], sy = Y + 200 + [-130, -90, 160, 130][k]
        g.fillStyle = 'rgba(255,200,225,' + (0.9 * Math.sin(ph * Math.PI)) + ')'
        g.fillRect(sx - s, sy - 2, s * 2, 4)
        g.fillRect(sx - 2, sy - s, 4, s * 2)
        g.fillRect(sx - 4, sy - 4, 8, 8)
      }
    },
    name: "奇门局桌", cat: "桌案", tags: ["木","术数"],
    scope: "character", fromRoom: 'tao',
    w: 400, h: 406, base: 406, foot: [8, 20, 384, 380],
    zLayer: "low",
    clickable: true, say: "奇门遁甲，九宫八门",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-520, -810)
      g.fillStyle = 'rgba(40,30,20,0.28)'; g.fillRect(530, 830, 390, 386)
        g.fillStyle = '#3a2c20'; g.fillRect(520, 810, 400, 396)
        g.fillStyle = '#a06a40'; g.fillRect(530, 820, 380, 376)
        g.fillStyle = '#8a5c34'; g.fillRect(544, 834, 352, 348)
        // 九宫格牌(3×3 · 八门 + 中宫 · 精饰)
        const GATE_C = ['#5a8a44', '#c8384a', '#4a6a88', '#e8b23d', '#c9a26a', '#8a72a0', '#5a9a8a', '#c87028', '#e87a98']
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < 3; c++) {
            const gx = 566 + c * 108, gy = 856 + r * 108
            const mid = r === 1 && c === 1
            g.fillStyle = '#3a2c20'; g.fillRect(gx, gy, 96, 96)
            g.fillStyle = mid ? '#e8b23d' : '#f0e4c8'
            g.fillRect(gx + 4, gy + 4, 88, 88)
            g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(gx + 4, gy + 4, 88, 5)
            g.fillStyle = 'rgba(58,44,32,0.25)'; g.fillRect(gx + 4, gy + 87, 88, 5)
            g.fillStyle = '#c9a26a'
            g.fillRect(gx + 8, gy + 8, 6, 6); g.fillRect(gx + 82, gy + 8, 6, 6)
            g.fillRect(gx + 8, gy + 82, 6, 6); g.fillRect(gx + 82, gy + 82, 6, 6)
            g.fillStyle = GATE_C[r * 3 + c]
            g.fillRect(gx + 24, gy + 20, 48, 48)
            g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(gx + 24, gy + 20, 48, 4)
            g.strokeStyle = '#3a2c20'; g.lineWidth = 2
            g.strokeRect(gx + 24, gy + 20, 48, 48)
            if (mid) {
              g.fillStyle = '#3a2c20'
              for (const [qx, qy] of [[34, 30], [58, 30], [46, 42], [34, 54], [58, 54]]) g.fillRect(gx + qx, gy + qy, 8, 8)
            } else {
              g.fillStyle = '#f0e4c8'
              g.fillRect(gx + 36, gy + 30, 24, 5)
              g.fillRect(gx + 38, gy + 35, 5, 24); g.fillRect(gx + 53, gy + 35, 5, 24)
            }
            g.fillStyle = 'rgba(58,44,32,0.5)'
            g.fillRect(gx + 26, gy + 76, 44, 6)
          }
        // 宫间金线
        g.fillStyle = '#c9a26a'
        for (let k = 1; k < 3; k++) {
          g.fillRect(566 + k * 108 - 9, 858, 3, 300)
          g.fillRect(568, 856 + k * 108 - 9, 300, 3)
        }
        // 桌沿描金回纹点
        g.fillStyle = '#e8b23d'
        for (let k = 0; k < 12; k++) {
          g.fillRect(540 + k * 31, 826, 8, 4); g.fillRect(540 + k * 31, 1186, 8, 4)
        }
        for (let k = 0; k < 11; k++) {
          g.fillRect(536, 832 + k * 32, 4, 8); g.fillRect(900, 832 + k * 32, 4, 8)
        }
        // 桌上:罗盘小件 + 桃花糕碟
        pxC(880, 860, 22, '#3a2c20'); pxC(880, 860, 18, '#c9a26a'); pxC(880, 860, 10, '#f6efdc')
        g.fillStyle = '#c8384a'; g.fillRect(878, 850, 4, 12)
      g.restore()
    }
  })
  def("tao_cushion_pink", {
    walkable: true,   // 能踩的:坐垫/蒲团/门垫不是障碍，烧格时跳过
    name: "粉蒲团", cat: "坐卧", tags: ["布","可坐"],
    scope: "generic", fromRoom: 'tao',
    w: 68, h: 70, base: 70, foot: [0, 62, 68, 8],
    zLayer: "low",
    sit: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-586, -1277)
      const x=620,y=1310
          pxC(x,y+3,34,'rgba(40,30,20,0.2)')
          pxC(x,y,34,'#3a2c20')
          pxC(x,y,30,'#e8a0b4')
          pxC(x,y,20,'#f0b8c8')
          pxC(x,y,8,'#c86a88')
      g.restore()
    }
  })
  def("tao_vanity", {
    name: "梳妆台", cat: "桌案", tags: ["木","镜"],
    scope: "character", fromRoom: 'tao',
    w: 250, h: 290, base: 290, foot: [0, 282, 250, 8],
    zLayer: "sort",
    clickable: true, say: "照镜子怎么了。上镜是要看脸的，哼",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-60, -407)
      g.fillStyle = '#3a2c20'; g.fillRect(60, 520, 250, 176)
        g.fillStyle = '#b58a5c'; g.fillRect(66, 526, 238, 164)
        g.fillStyle = '#a0764a'; g.fillRect(66, 600, 238, 8)
        // 铜镜(椭圆)
        pxE(185, 480, 62, 74, '#3a2c20')
        pxE(185, 480, 55, 66, '#c9a26a')
        pxE(185, 478, 42, 52, '#e8ddd0')
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(158, 442, 18, 4); g.fillRect(150, 452, 6, 8)
        // 胭脂盒×2 + 木梳
        g.fillStyle = '#c8384a'; g.fillRect(92, 560, 32, 20)
        g.fillStyle = '#e87a98'; g.fillRect(96, 552, 24, 8)
        g.fillStyle = '#4a6a88'; g.fillRect(136, 562, 26, 18)
        g.fillStyle = '#a06a40'; g.fillRect(238, 560, 44, 8)
        g.fillStyle = '#8a5c34'
        for (let k = 0; k < 6; k++) g.fillRect(240 + k * 7, 568, 3, 10)
      g.restore()
    }
  })
  def("tao_vanity_stool", {
    clickable: true, say: '坐久了腰疼，谁让直播要三个钟头',
    name: "妆凳", cat: "坐卧", tags: ["凳","可坐"],
    scope: "generic", fromRoom: 'tao',
    w: 68, h: 68, base: 68, foot: [0, 60, 68, 8],
    zLayer: "low",
    sit: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-146, -707)
      pxC(180, 740, 34, '#3a2c20'); pxC(180, 738, 30, '#e8a0b4'); pxC(180, 738, 12, '#c86a88')
      g.restore()
    }
  })
  def("tao_bed", {
    name: "幔帐床", cat: "坐卧", tags: ["床","纱","可卧"],
    scope: "character", fromRoom: 'tao',
    w: 348, h: 376, base: 376, foot: [0, 368, 348, 8],
    zLayer: "sort",
    clickable: true, say: "白天睡觉犯法吗",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-1072, -488)
      g.fillStyle = '#3a2c20'; g.fillRect(1080, 500, 330, 364)
        g.fillStyle = '#b58a5c'; g.fillRect(1088, 508, 314, 348)
        // 床单(粉底 · 白宽边 + 角部桃枝刺绣)
        g.fillStyle = '#f0b8c8'; g.fillRect(1098, 550, 294, 290)
        g.fillStyle = '#fff4f6'
        g.fillRect(1098, 550, 294, 10); g.fillRect(1098, 550, 10, 290); g.fillRect(1382, 550, 10, 290)
        g.strokeStyle = 'rgba(255,244,246,0.85)'; g.lineWidth = 3
        g.strokeRect(1122, 574, 246, 244)
        // 角部桃枝刺绣(右上)
        g.strokeStyle = '#a06a40'; g.lineWidth = 3
        g.beginPath(); g.moveTo(1368, 566); g.quadraticCurveTo(1330, 590, 1300, 636); g.stroke()
        g.beginPath(); g.moveTo(1336, 592); g.lineTo(1312, 584); g.stroke()
        for (const [bx4, by4] of [[1344, 588], [1306, 632], [1312, 580]]) {
          g.fillStyle = '#e87a98'
          g.fillRect(bx4 - 6, by4 - 2, 5, 5); g.fillRect(bx4 + 2, by4 - 2, 5, 5)
          g.fillRect(bx4 - 2, by4 - 6, 5, 5); g.fillRect(bx4 - 4, by4 + 3, 4, 4); g.fillRect(bx4 + 1, by4 + 3, 4, 4)
          g.fillStyle = '#e8b23d'; g.fillRect(bx4 - 1, by4 - 1, 3, 3)
        }
        g.fillStyle = '#5a9438'; g.fillRect(1322, 606, 5, 8); g.fillRect(1330, 614, 5, 8)
        // 被子(下半 · 白翻边 + 素条纹 + 浅褶)
        g.fillStyle = '#e8a0b4'; g.fillRect(1098, 700, 294, 140)
        g.fillStyle = '#fff4f6'; g.fillRect(1098, 700, 294, 24)
        g.fillStyle = '#f0b8c8'
        g.fillRect(1098, 748, 294, 8); g.fillRect(1098, 788, 294, 8)
        g.strokeStyle = 'rgba(200,120,144,0.4)'; g.lineWidth = 3
        g.beginPath(); g.moveTo(1160, 726); g.quadraticCurveTo(1178, 780, 1164, 836); g.stroke()
        g.beginPath(); g.moveTo(1310, 726); g.quadraticCurveTo(1294, 782, 1308, 836); g.stroke()
        // 绣花枕(七层 · 横跨床头居中)。原来 100px 宽缩在左角、只占床宽三成,
        // 头躺上去会压在枕头旁边而不是枕上 —— 与阿云那次是同一个毛病。
        // 现以床心 1245 居中、240 宽,比睡姿 sprite(144)两侧各宽出 48。
        g.fillStyle = 'rgba(60,44,32,0.18)'; g.fillRect(1129, 578, 232, 8)
        g.fillStyle = '#3a2c20'; g.fillRect(1125, 505, 240, 76)
        g.fillStyle = '#fff4f6'; g.fillRect(1129, 509, 232, 68)
        g.fillStyle = '#ffffff'; g.fillRect(1129, 509, 232, 8)
        g.fillStyle = '#f0dce2'; g.fillRect(1129, 566, 232, 11)
        g.fillStyle = '#f0b8c8'
        g.fillRect(1129, 521, 232, 5); g.fillRect(1129, 558, 232, 5)
        g.strokeStyle = '#a06a40'; g.lineWidth = 2
        g.beginPath(); g.moveTo(1180, 548); g.quadraticCurveTo(1230, 528, 1300, 536); g.stroke()
        g.fillStyle = '#e87a98'
        g.fillRect(1216, 532, 6, 6); g.fillRect(1252, 526, 6, 6); g.fillRect(1288, 534, 6, 6)
        // 纱幔
        g.fillStyle = '#3a2c20'; g.fillRect(1072, 488, 348, 8)
        g.fillStyle = 'rgba(246,204,216,0.55)'
        g.fillRect(1076, 496, 30, 260); g.fillRect(1382, 496, 30, 240)
      g.restore()
    }
  })
  def("tao_training_post", {
    clickable: true, say: '这个不上镜，练给自己看的',
    name: "练功桩", cat: "器械", tags: ["木","红布"],
    scope: "generic", fromRoom: 'tao',
    w: 70, h: 232, base: 232, foot: [0, 224, 70, 8],
    zLayer: "sort",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-150, -860)
      g.fillStyle = '#3a2c20'; g.fillRect(150, 860, 70, 232)
        g.fillStyle = '#a06a40'; g.fillRect(156, 866, 58, 220)
        g.fillStyle = '#8a5c34'
        g.fillRect(156, 900, 58, 6); g.fillRect(156, 980, 58, 6)
        g.fillStyle = '#c8384a'
        g.fillRect(150, 910, 70, 30); g.fillRect(150, 1010, 70, 24)
        g.fillStyle = '#a82c3c'; g.fillRect(150, 934, 70, 6)
      g.restore()
    }
  })
  def("tao_swing", {
    clickable: true, say: '下播了才坐……就坐一会儿',
    name: '吊篮秋千', cat: '坐卧', tags: ["藤","吊","可坐"],
    scope: 'generic', fromRoom: 'tao',
    w: 216, h: 446, base: 446, foot: [0, 0, 0, 0],
    zLayer: 'sort', sit: true,
    // 摆动量化成 12 档 → 12 张 sprite,之后全部走缓存。
    // 幅度极小:有人时 14px,空着 4px —— 要的是「看得出是吊着的」,
    // 不是荡给人看。参照海报飘动那次的克制。
    // 摆动量化成 12 相位 × 2 幅度 = 24 张 sprite,之后全部命中缓存。
    // 幅度极小:有人时 14px,空着 4px —— 要的是「看得出是吊着的」,
    // 不是荡给人看。参照海报飘动那次的克制。
    PH: 12,
    ampOf(state) { return state.swinging ? 14 : 4 },
    phaseOf(t) { return (((t / 110) | 0) % 12 + 12) % 12 },
    swayAt(state, t) {
      return Math.round(Math.sin(this.phaseOf(t) / 12 * Math.PI * 2) * this.ampOf(state))
    },
    variant(state, t) { return 'a' + this.ampOf(state) + 'p' + this.phaseOf(t) },
    draw(g, opt) {
      const m = /^a(\d+)p(\d+)$/.exec((opt && opt.variant) || 'a4p0')
      const amp = m ? +m[1] : 4, ph = m ? +m[2] : 0
      const dx = Math.round(Math.sin(ph / 12 * Math.PI * 2) * amp)
      g.save(); g.scale(0.5, 0.5); g.translate(-1118, -432)
      g.strokeStyle = '#3a2c20'; g.lineWidth = 6
      g.beginPath(); g.moveTo(1191, 432); g.lineTo(1191 + dx, 728); g.stroke()
      g.beginPath(); g.moveTo(1259, 432); g.lineTo(1259 + dx, 728); g.stroke()
      g.fillStyle = '#3a2c20'; g.fillRect(1176 + dx, 726, 96, 8)
      for (const [rx3, ry3, col3] of [[88, 74, '#3a2c20'], [80, 66, '#c9a26a'], [64, 46, '#8a6844'], [56, 38, '#f0b8c8']]) {
        g.fillStyle = col3
        for (let dy = -ry3; dy <= ry3; dy++) {
          const dxw = (rx3 * Math.sqrt(1 - (dy / ry3) * (dy / ry3))) | 0
          g.fillRect(1224 + dx - dxw, (ry3 === 74 ? 800 : ry3 === 66 ? 796 : ry3 === 46 ? 780 : 776) + dy, dxw * 2, 1)
        }
      }
      g.fillStyle = '#a0764a'
      for (let k = 0; k < 5; k++) g.fillRect(1152 + k * 36 + dx, 830, 4, 26)
      g.restore()
    }
  })

  def("tao_swing_cushion", {
    name: "桃子坐垫", cat: "坐卧", tags: ["垫","桃"],
    scope: "character", fromRoom: 'tao',
    w: 116, h: 136, base: 136, foot: [0, 128, 116, 8],
    zLayer: "sort",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-1284, -626)
      pxC(1326, 690, 42, '#3a2c20'); pxC(1360, 694, 40, '#3a2c20')
        g.fillStyle = '#3a2c20'
        g.beginPath(); g.moveTo(1300, 710); g.lineTo(1344, 762); g.lineTo(1392, 712); g.fill()
        pxC(1326, 690, 38, '#f0a8bc'); pxC(1360, 694, 36, '#e88aa0')
        g.fillStyle = '#f0a8bc'
        g.beginPath(); g.moveTo(1306, 710); g.lineTo(1342, 754); g.lineTo(1360, 730); g.fill()
        g.fillStyle = '#e88aa0'
        g.beginPath(); g.moveTo(1360, 730); g.lineTo(1342, 754); g.lineTo(1386, 712); g.fill()
        g.strokeStyle = '#c86a80'; g.lineWidth = 3
        g.beginPath(); g.moveTo(1338, 652); g.quadraticCurveTo(1330, 700, 1342, 750); g.stroke()
        g.fillStyle = '#8a5c34'; g.fillRect(1340, 636, 6, 18)
        pxE(1326, 636, 16, 8, '#5a9438'); pxE(1358, 632, 14, 7, '#48a048')
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(1310, 668, 14, 8)
      g.restore()
    }
  })
  def("tao_table_tea", {
    clickable: true, say: '凌晨吃的，别看',
    fx(g, t, X, Y) {
      // 茶壶蒸汽
      const f = (t / 50) | 0
      for (let k = 0; k < 3; k++) {
        const ph = (f * 1.5 + k * 14) % 44
        g.fillStyle = 'rgba(255,255,255,' + Math.max(0, 0.72 - ph / 85) + ')'
        g.fillRect(X + 73 + k * 7 + Math.sin((f + k * 5) / 5) * 3, Y + 24 - ph * 1.6, 6, 6)
      }
    },
    name: "茶点桌", cat: "桌案", tags: ["木","茶点"],
    scope: "character", fromRoom: 'tao',
    w: 342, h: 130, base: 130, foot: [0, 122, 342, 8],
    zLayer: "low",
    clickable: true, say: "珍珠奶茶，三分糖",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-90, -1414)
      g.fillStyle = '#3a2c20'; g.fillRect(90, 1420, 240, 124)
        g.fillStyle = '#a06a40'; g.fillRect(96, 1426, 228, 112)
        g.fillStyle = '#8a5c34'; g.fillRect(96, 1520, 228, 18)
        // 粉瓷壶 + 杯
        g.fillStyle = '#f0b8c8'; g.fillRect(120, 1448, 44, 34)
        g.fillStyle = '#e8a0b4'; g.fillRect(160, 1456, 14, 10)
        g.fillStyle = '#3a2c20'; g.fillRect(130, 1440, 22, 8)
        // 珍珠奶茶(现代甜分)
        g.fillStyle = 'rgba(240,225,210,0.85)'; g.fillRect(206, 1436, 34, 50)
        g.fillStyle = '#c8a878'; g.fillRect(210, 1452, 26, 30)
        g.fillStyle = '#3a2c20'
        for (const [px3, py3] of [[214, 1474], [224, 1478], [232, 1472]]) g.fillRect(px3, py3, 6, 6)
        g.fillStyle = '#e87a98'; g.fillRect(218, 1414, 8, 26)
        g.fillStyle = '#fff4f6'; g.fillRect(190, 1462, 18, 16); g.fillRect(214, 1462, 18, 16)
        // 桃花糕碟(三块粉糕)
        pxE(272, 1480, 34, 14, '#f6efdc')
        g.fillStyle = '#f0a8bc'
        g.fillRect(252, 1462, 18, 14); g.fillRect(274, 1458, 18, 14); g.fillRect(264, 1470, 18, 12)
        g.fillStyle = '#c86a88'
        g.fillRect(258, 1466, 6, 5); g.fillRect(280, 1462, 6, 5)
        // 零食罐×2
        g.fillStyle = '#3a2c20'; g.fillRect(348, 1470, 40, 62)
        g.fillStyle = '#8a72a0'; g.fillRect(352, 1474, 32, 54)
        g.fillStyle = '#a88ab8'; g.fillRect(352, 1474, 32, 12)
        g.fillStyle = '#3a2c20'; g.fillRect(398, 1488, 34, 46)
        g.fillStyle = '#5a9a8a'; g.fillRect(402, 1492, 26, 38)
      g.restore()
    }
  })
  def("tao_rabbit_nest", {
    clickable: true, say: '它自己跑来的，赶不走而已',
    name: "兔窝", cat: "杂物", tags: ["草","兔"],
    scope: "character", fromRoom: 'tao',
    w: 220, h: 122, base: 122, foot: [0, 114, 220, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-1120, -1555)
      pxE(1240, 1610, 100, 56, '#3a2c20')
        pxE(1240, 1606, 92, 48, '#c9a26a')
        pxE(1240, 1602, 72, 34, '#a87f48')
        g.fillStyle = '#e8d8a0'
        for (let k = 0; k < 10; k++) {
          const a = k * 0.63
          g.fillRect(1240 + Math.cos(a) * 80 - 4, 1604 + Math.sin(a) * 40 - 2, 9, 4)
        }
        g.fillStyle = '#5a8a44'
        g.fillRect(1120, 1660, 26, 16); g.fillRect(1140, 1652, 22, 14)
        g.fillStyle = '#4a7c3e'; g.fillRect(1128, 1664, 10, 6)
      g.restore()
    }
  })
  def("tao_vase_peach", {
    clickable: true, say: '岛上折的，早干了，扔不掉而已',
    name: "桃枝花瓶", cat: "器物", tags: ["瓶","花"],
    scope: "generic", fromRoom: 'tao',
    w: 44, h: 122, base: 122, foot: [0, 114, 44, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-430, -1344)
      const x=430,y=1400,sc=1
          g.fillStyle='#3a2c20';g.fillRect(x,y,44*sc,66*sc)
          g.fillStyle='#f6efdc';g.fillRect(x+4*sc,y+4*sc,36*sc,58*sc)
          g.fillStyle='#4a6a88'
          g.fillRect(x+8*sc,y+22*sc,28*sc,5*sc);g.fillRect(x+8*sc,y+40*sc,28*sc,5*sc)
          g.fillStyle='#6e5236'
          g.fillRect(x+18*sc,y-46*sc,5*sc,50*sc)
          g.fillRect(x+8*sc,y-30*sc,4*sc,24*sc)
          for(const [dx,dy] of [[14,-56],[2,-38],[26,-44],[8,-18]]){
            g.fillStyle='#f0a8bc'
            g.fillRect(x+dx*sc,y+dy*sc,10*sc,10*sc)
            g.fillStyle='#e87a98'
            g.fillRect(x+(dx+3)*sc,y+(dy+3)*sc,4*sc,4*sc)
          }
      g.restore()
    }
  })
  def("tao_guqin_table", {
    name: "古琴桌", cat: "桌案", tags: ["木","琴"],
    scope: "character", fromRoom: 'tao',
    w: 320, h: 146, base: 146, foot: [0, 138, 320, 8],
    zLayer: "low",
    clickable: true, say: "桃花岛的曲子，弹给你听",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-60, -1150)
      g.fillStyle = '#3a2c20'; g.fillRect(60, 1150, 320, 146)
        g.fillStyle = '#8a5c34'; g.fillRect(68, 1158, 304, 130)
        g.fillStyle = '#2a2018'
        g.beginPath(); g.moveTo(90, 1180); g.lineTo(350, 1172); g.lineTo(354, 1252); g.lineTo(86, 1262); g.fill()
        g.fillStyle = '#3d3028'
        g.beginPath(); g.moveTo(96, 1186); g.lineTo(344, 1179); g.lineTo(347, 1246); g.lineTo(93, 1255); g.fill()
        g.fillStyle = '#e8d8a0'
        for (let k = 0; k < 7; k++) {
          g.fillRect(100, 1192 + k * 8, 240, 2)
        }
        g.fillStyle = '#e8b23d'
        for (let k = 0; k < 13; k++) g.fillRect(110 + k * 18, 1188, 3, 3)
      g.restore()
    }
  })
  def("tao_go_table", {
    name: "围棋小桌", cat: "桌案", tags: ["木","棋"],
    scope: "generic", fromRoom: 'tao',
    w: 292, h: 126, base: 126, foot: [0, 118, 292, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-500, -1560)
      g.fillStyle = '#3a2c20'; g.fillRect(500, 1560, 200, 126)
        g.fillStyle = '#c9a26a'; g.fillRect(508, 1568, 184, 110)
        g.strokeStyle = '#8a6844'; g.lineWidth = 2
        for (let k = 0; k <= 6; k++) {
          g.beginPath(); g.moveTo(524 + k * 26, 1580); g.lineTo(524 + k * 26, 1664); g.stroke()
          g.beginPath(); g.moveTo(524, 1580 + k * 14); g.lineTo(680, 1580 + k * 14); g.stroke()
        }
        g.fillStyle = '#1a1a20'
        pxC(550, 1608, 8, '#1a1a20'); pxC(602, 1622, 8, '#1a1a20'); pxC(576, 1594, 8, '#1a1a20')
        g.fillStyle = '#f6efdc'
        pxC(628, 1608, 8, '#f6efdc'); pxC(576, 1636, 8, '#f6efdc')
        pxC(720, 1600, 24, '#2a2018'); pxC(720, 1596, 20, '#3d3028')
        pxC(770, 1610, 22, '#f0e4c8'); pxC(770, 1606, 18, '#f8f2e2')
      g.restore()
    }
  })
  def("tao_embroidery_hoop", {
    name: "绣绷", cat: "器物", tags: ["绣","布"],
    scope: "generic", fromRoom: 'tao',
    w: 116, h: 116, base: 116, foot: [0, 108, 116, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-952, -1343)
      pxC(1010, 1400, 58, '#3a2c20')
        pxC(1010, 1400, 52, '#a06a40')
        pxC(1010, 1400, 44, '#f6efdc')
        g.fillStyle = '#f0a8bc'
        g.fillRect(990, 1382, 12, 12); g.fillRect(1006, 1376, 12, 12); g.fillRect(1018, 1390, 12, 12)
        g.fillStyle = '#e87a98'; g.fillRect(1002, 1388, 8, 8)
        g.fillStyle = '#5a8a44'; g.fillRect(996, 1408, 20, 4)
        g.fillStyle = 'rgba(90,140,70,0.4)'; g.fillRect(1004, 1416, 26, 3)
      g.restore()
    }
  })
  def("tao_thread_basket", {
    name: "线笸箩", cat: "器物", tags: ["笸箩","线"],
    scope: "generic", fromRoom: 'tao',
    w: 80, h: 52, base: 52, foot: [0, 44, 80, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-1050, -1445)
      pxE(1090, 1470, 40, 26, '#3a2c20')
        pxE(1090, 1466, 34, 22, '#c9a26a')
        pxC(1078, 1456, 12, '#e87a98'); pxC(1102, 1460, 10, '#4a6a88')
      g.restore()
    }
  })
  def("tao_jewelry_box", {
    name: "首饰盒", cat: "器物", tags: ["盒","珠"],
    scope: "generic", fromRoom: 'tao',
    w: 56, h: 60, base: 60, foot: [0, 52, 56, 8],
    zLayer: "sort",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-200, -536)
      g.fillStyle = '#3a2c20'; g.fillRect(200, 548, 56, 40)
        g.fillStyle = '#c8384a'; g.fillRect(204, 552, 48, 32)
        g.fillStyle = '#e87a98'; g.fillRect(204, 536, 48, 16)
        g.fillStyle = '#ffd76a'
        pxC(216, 580, 5, '#ffd76a'); pxC(228, 586, 5, '#ffd76a'); pxC(242, 590, 5, '#ffd76a')
      g.restore()
    }
  })
  def("tao_cosmetics", {
    name: "胭脂水粉", cat: "器物", tags: ["妆","瓶"],
    scope: "character", fromRoom: 'tao',
    w: 18, h: 32, base: 32, foot: [0, 24, 18, 8],
    zLayer: "sort",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-70, -524)
      g.fillStyle = '#7cb8d4'; g.fillRect(70, 542, 18, 14)
        g.fillStyle = '#8a72a0'; g.fillRect(70, 524, 14, 16)
      g.restore()
    }
  })
  def("tao_umbrella", {
    name: "纸伞", cat: "器物", tags: ["伞","纸"],
    scope: "generic", fromRoom: 'tao',
    w: 180, h: 124, base: 124, foot: [0, 116, 180, 8],
    zLayer: "sort",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-330, -1767)
      pxE(420, 1800, 90, 30, '#e87a98')
        pxE(420, 1794, 90, 28, '#f0a8bc')
        g.fillStyle = '#c8384a'
        for (let k = 0; k < 7; k++) {
          const a = k * 0.45 + 0.25
          g.fillRect(420 + Math.cos(a) * 78 - 2, 1794 - Math.sin(a) * 20, 4, 4)
        }
        g.fillStyle = '#a06a40'; g.fillRect(416, 1794, 7, 96)
      g.restore()
    }
  })
  def("tao_clothes_rack", {
    clickable: true, say: '明天穿哪件，随便挑的',
    name: "衣桁", cat: "收纳", tags: ["木","衣"],
    scope: "character", fromRoom: 'tao',
    w: 226, h: 352, base: 352, foot: [0, 344, 226, 8],
    zLayer: "sort",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-48, -1552)
      g.fillStyle = '#3a2c20'
        g.fillRect(60, 1560, 10, 344); g.fillRect(250, 1560, 10, 344)
        g.fillRect(48, 1552, 226, 12)
        g.fillStyle = '#f0b8c8'
        g.fillRect(84, 1564, 64, 12); g.fillRect(78, 1576, 76, 190)
        g.fillStyle = '#e8a0b4'
        for (let k = 0; k < 3; k++) g.fillRect(86 + k * 22, 1576, 3, 190)
        g.fillStyle = '#a8d4c8'
        g.fillRect(170, 1564, 60, 12); g.fillRect(164, 1576, 72, 160)
        g.fillStyle = '#8ec4b4'
        for (let k = 0; k < 3; k++) g.fillRect(172 + k * 22, 1576, 3, 160)
      g.restore()
    }
  })
  def("tao_dart_case", {
    clickable: true, say: '岛上的规矩，出门带着，防身而已',
    name: "暗器匣", cat: "收纳", tags: ["匣","镖"],
    scope: "generic", fromRoom: 'tao',
    w: 150, h: 104, base: 104, foot: [0, 96, 150, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-250, -1640)
      g.fillStyle = '#3a2c20'; g.fillRect(250, 1660, 150, 84)
        g.fillStyle = '#8a5c34'; g.fillRect(256, 1666, 138, 72)
        g.fillStyle = '#6e4a28'; g.fillRect(256, 1640, 138, 26)
        g.fillStyle = '#b8c4d4'
        for (let k = 0; k < 4; k++) {
          const dx = 272 + k * 30
          g.beginPath(); g.moveTo(dx, 1700); g.lineTo(dx + 8, 1682); g.lineTo(dx + 16, 1700); g.lineTo(dx + 8, 1692); g.fill()
        }
        g.fillStyle = '#c8384a'; g.fillRect(270, 1712, 110, 6)
      g.restore()
    }
  })
  def("tao_wine_table", {
    clickable: true, say: '桃花酿，一个人喝没什么意思',
    name: "酒壶小几", cat: "桌案", tags: ["木","酒"],
    scope: "character", fromRoom: 'tao',
    w: 130, h: 160, base: 160, foot: [0, 152, 130, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-680, -1604)
      g.fillStyle = '#3a2c20'; g.fillRect(680, 1680, 130, 84)
        g.fillStyle = '#a06a40'; g.fillRect(686, 1686, 118, 72)
        pxE(725, 1660, 26, 30, '#3a2c20')
        pxE(725, 1658, 22, 26, '#f6efdc')
        g.fillStyle = '#e87a98'; g.fillRect(716, 1646, 18, 8)
        g.fillStyle = '#3a2c20'; g.fillRect(744, 1650, 12, 6)
        g.fillStyle = '#f6efdc'
        g.fillRect(766, 1662, 14, 14); g.fillRect(784, 1666, 14, 12)
        g.fillStyle = '#c8384a'
        g.font = '600 22px "Songti SC", serif'
        g.textAlign = 'center'
        g.fillText('酿', 725, 1622)
      g.restore()
    }
  })
  def("tao_incense_burner", {
    clickable: true, say: '熏一下……直播间里闻不到，我知道',
    fx(g, t, X, Y) {
      // 香薰粉烟(摇曳)。帧号由 t 推得 —— fx 只拿得到 t,房间循环是 20fps。
      const f = (t / 50) | 0
      for (let k = 0; k < 6; k++) {
        const ph = (f * 1.3 + k * 16) % 96
        g.fillStyle = 'rgba(248,214,228,' + Math.max(0, 0.82 - ph / 150) + ')'
        const w = 6 + ph / 12
        g.fillRect(X + 22 + Math.sin((f + k * 12) / 8) * (8 + ph / 10), Y + 1 - ph * 2, w, w)
      }
    },
    name: "香薰炉", cat: "器物", tags: ["炉","香"],
    scope: "generic", fromRoom: 'tao',
    w: 60, h: 66, base: 66, foot: [0, 58, 60, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-914, -1491)
      pxC(944, 1520, 30, '#3a2c20')
        pxC(944, 1516, 25, '#c9a26a')
        pxRingT(944, 1516, 25, 4, '#e8b23d')
        g.fillStyle = '#3a2c20'
        g.fillRect(928, 1544, 8, 12); g.fillRect(952, 1544, 8, 12)
      g.restore()
    }
  })
  def("tao_pillow_pile", {
    clickable: true, say: '入镜好看，压着舒服是顺便的',
    name: "抱枕堆", cat: "坐卧", tags: ["枕","软"],
    scope: "character", fromRoom: 'tao',
    w: 154, h: 112, base: 112, foot: [0, 104, 154, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-916, -1663)
      pxE(1000, 1740, 52, 34, '#3a2c20')
        pxE(1000, 1736, 46, 30, '#f0b8c8')
        pxE(960, 1700, 44, 30, '#3a2c20')
        pxE(960, 1696, 38, 26, '#a8d4c8')
        pxE(1030, 1690, 40, 28, '#3a2c20')
        pxE(1030, 1686, 34, 24, '#e8b23d')
      g.restore()
    }
  })
  def("tao_orchid_pot", {
    clickable: true, say: '兰花……我知道它快死了',
    name: "兰花盆栽", cat: "植物", tags: ["花","盆"],
    scope: "generic", fromRoom: 'tao',
    w: 48, h: 84, base: 84, foot: [0, 76, 48, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-64, -1032)
      const bx=64,by=1080
          g.fillStyle='#3a2c20';g.fillRect(bx,by,48,36)
          g.fillStyle='#4a6a88';g.fillRect(bx+4,by+4,40,28)
          g.fillStyle='#5a8a44'
          g.fillRect(bx+20,by-40,4,44)
          g.fillRect(bx+8,by-28,4,32);g.fillRect(bx+34,by-30,4,34)
          g.fillStyle='#f0a8bc';g.fillRect(bx+18,by-48,8,8)
      g.restore()
    }
  })
  def("tao_candy_jar_amber", {
    clickable: true, say: '这罐也是她的……还没吃完而已',
    name: "蜜饯罐", cat: "器物", tags: ["罐","食"],
    scope: "generic", fromRoom: 'tao',
    w: 44, h: 58, base: 58, foot: [0, 50, 44, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-430, -1560)
      g.fillStyle = '#3a2c20'; g.fillRect(430, 1560, 44, 58)
        g.fillStyle = '#e8a030'; g.fillRect(434, 1564, 36, 50)
        g.fillStyle = '#f0b850'; g.fillRect(434, 1564, 36, 12)
      g.restore()
    }
  })
  def("tao_copper_pot", {
    clickable: true, say: '烧水，一个人的宵夜，讲究不起来',
    name: "铜壶", cat: "器物", tags: ["壶","铜"],
    scope: "generic", fromRoom: 'tao',
    w: 56, h: 44, base: 44, foot: [0, 36, 56, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-464, -1579)
      pxE(490, 1600, 26, 22, '#3a2c20')
        pxE(490, 1598, 22, 18, '#c9a26a')
        g.fillStyle = '#3a2c20'; g.fillRect(508, 1584, 12, 5)
      g.restore()
    }
  })
  def("tao_lamp_gauze", {
    // 纱罩灯台：她夜里留的另一盏
    light: { x: 24, y: 40, r: 130, color: '#f0d0a0', flicker: 0.10 },
    clickable: true, say: '晚上留一盏，省得回来太黑',
    name: "纱罩灯台", cat: "灯具", tags: ["灯","纱"],
    scope: "generic", fromRoom: 'tao',
    w: 48, h: 152, base: 152, foot: [0, 144, 48, 8],
    zLayer: "sort",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-1054, -1740)
      g.fillStyle = '#3a2c20'; g.fillRect(1074, 1790, 6, 100); g.fillRect(1058, 1886, 40, 6)
        g.fillStyle = '#f6d8e0'; g.fillRect(1054, 1740, 48, 52)
        g.fillStyle = '#3a2c20'; g.fillRect(1054, 1740, 48, 3); g.fillRect(1054, 1789, 48, 3)
        g.fillStyle = '#ffd76a'; g.fillRect(1070, 1756, 16, 22)
      g.restore()
    }
  })
  def("tao_blanket", {
    name: "床尾毛毯", cat: "布艺", tags: ["毯","软"],
    scope: "generic", fromRoom: 'tao',
    w: 160, h: 40, base: 40, foot: [0, 32, 160, 8],
    zLayer: "sort",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-1098, -800)
      g.fillStyle = '#a8d4c8'; g.fillRect(1098, 800, 160, 40)
        g.fillStyle = '#8ec4b4'
        g.fillRect(1098, 812, 160, 4); g.fillRect(1098, 826, 160, 4)
      g.restore()
    }
  })
  def("tao_wardrobe", {
    name: "粉双门衣柜", cat: "收纳", tags: ["木","衣"],
    scope: "character", fromRoom: 'tao',
    w: 158, h: 344, base: 344, foot: [0, 336, 158, 8],
    zLayer: "sort",
    clickable: true, say: "上镜的衣服。平时才不穿",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-36, -716)
      g.fillStyle = '#3a2c20'; g.fillRect(36, 716, 158, 344)
        g.fillStyle = '#e8a0b4'; g.fillRect(44, 724, 142, 328)
        g.fillStyle = '#d88aa0'; g.fillRect(44, 724, 142, 16)
        g.fillStyle = '#c87890'; g.fillRect(112, 740, 4, 300)
        g.fillStyle = '#f0c0cc'
        g.fillRect(56, 748, 44, 130); g.fillRect(128, 748, 44, 130)
        g.fillRect(56, 896, 44, 130); g.fillRect(128, 896, 44, 130)
        g.fillStyle = '#e8b23d'
        pxC(104, 888, 6, '#e8b23d'); pxC(124, 888, 6, '#e8b23d')
        g.fillStyle = '#e87a98'
        g.fillRect(66, 780, 24, 8); g.fillRect(138, 780, 24, 8)
      g.restore()
    }
  })
  def("tao_curio_shelf", {
    clickable: true, say: '别动，摆了很久才这样的',
    name: "多宝格", cat: "收纳", tags: ["木","陈列"],
    scope: "generic", fromRoom: 'tao',
    w: 92, h: 290, base: 290, foot: [0, 282, 92, 8],
    zLayer: "sort",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-1344, -1090)
      g.fillStyle = '#3a2c20'; g.fillRect(1344, 1090, 92, 290)
        g.fillStyle = '#b58a5c'; g.fillRect(1350, 1096, 80, 278)
        g.fillStyle = '#8a5c34'
        g.fillRect(1350, 1160, 80, 5); g.fillRect(1350, 1234, 80, 5); g.fillRect(1350, 1306, 80, 5)
        pxE(1390, 1140, 15, 9, '#c8384a')
        g.fillStyle = '#4a6a88'; g.fillRect(1372, 1188, 18, 40)
        pxC(1408, 1206, 11, '#e8b23d')
        g.fillStyle = '#5a9438'; g.fillRect(1364, 1268, 14, 32)
        pxE(1406, 1284, 12, 14, '#e87a98')
        g.fillStyle = '#c9a26a'; g.fillRect(1366, 1330, 46, 36)
      g.restore()
    }
  })
  def("tao_screen_peach", {
    clickable: true, say: '拉上就是下班了',
    name: "桃花屏风", cat: "屏隔", tags: ["屏","桃"],
    scope: "character", fromRoom: 'tao',
    w: 316, h: 270, base: 270, foot: [0, 262, 316, 8],
    zLayer: "sort",
    // ─────────────────────────────────────────────────────────────
    // 这间房唯一一件【有状态】的家具，也是它的核心隐喻。
    // 开播时展开当入镜背景，收工时折起把证据那半挡回去 ——
    // 「她拼命要被看见，而最真的话全在镜头拍不到的地方」落在一件家具上。
    // 状态可查询（room.state.streaming），所以台词、灯光都能读到这件事。
    variant(state) { return state.streaming ? 'open' : 'shut' },
    draw(g, opt) {
      // 折起：三扇叠成一摞 —— 只看得见最外那扇的正面，后面两扇露出侧边厚度。
      // 第一版用 g.scale(0.34,1) 横向压缩，那不是折叠是【压扁】：桃花枝跟着失真，
      // 读起来像家具坏了。改用裁剪，比例就不动。
      const shut = !!(opt && opt.variant === 'shut')
      if (shut) {
        g.save()
        g.beginPath(); g.rect(0, 0, 53, 140); g.clip()      // 只露最外一扇(×2 后 ≈106px)
      }
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-730, -1782)
      for (let k = 0; k < 3; k++) {
          const px6 = 730 + k * 106, oy = (k % 2) * 16
          g.fillStyle = '#3a2c20'; g.fillRect(px6, 1782 + oy, 104, 250)
          g.fillStyle = '#c9a26a'; g.fillRect(px6 + 5, 1787 + oy, 94, 240)
          g.fillStyle = '#f6e8ea'; g.fillRect(px6 + 10, 1792 + oy, 84, 230)
          g.fillStyle = '#a06a40'
          for (let q = 0; q < 4; q++) g.fillRect(px6 + 14 + q * 20, 1797 + oy, 15, 4)
          for (let q = 0; q < 5; q++) g.fillRect(px6 + 12 + q * 18, 1797 + oy, 4, 20)
          g.fillRect(px6 + 10, 1817 + oy, 84, 4)
          g.strokeStyle = '#a06a40'; g.lineWidth = 4
          g.beginPath()
          g.moveTo(px6 + 22, 2016 + oy)
          g.quadraticCurveTo(px6 + 38, 1940 + oy, px6 + 56, 1900 + oy)
          g.quadraticCurveTo(px6 + 74, 1862 + oy, px6 + 66, 1836 + oy)
          g.stroke()
          g.beginPath(); g.moveTo(px6 + 46, 1924 + oy); g.lineTo(px6 + 28, 1898 + oy); g.stroke()
          g.beginPath(); g.moveTo(px6 + 60, 1880 + oy); g.lineTo(px6 + 78, 1866 + oy); g.stroke()
          for (const [bx4, by4] of [[px6 + 66, 1838 + oy], [px6 + 30, 1894 + oy], [px6 + 80, 1864 + oy]]) {
            g.fillStyle = '#e87a98'
            g.fillRect(bx4 - 7, by4 - 3, 6, 6); g.fillRect(bx4 + 3, by4 - 3, 6, 6)
            g.fillRect(bx4 - 2, by4 - 8, 6, 6); g.fillRect(bx4 - 5, by4 + 4, 5, 5); g.fillRect(bx4 + 2, by4 + 4, 5, 5)
            g.fillStyle = '#e8b23d'; g.fillRect(bx4 - 1, by4 - 1, 4, 4)
          }
          g.fillStyle = '#f0a8bc'; g.fillRect(px6 + 52, 1912 + oy, 8, 10)
          g.fillStyle = '#5a9438'; g.fillRect(px6 + 54, 1922 + oy, 5, 8)
          g.fillStyle = '#f0b8c8'
          g.fillRect(px6 + 76, 1946 + oy, 6, 5); g.fillRect(px6 + 20, 1976 + oy, 6, 5)
          g.fillStyle = '#3a2c20'; g.fillRect(px6 + 20, 2026 + oy, 16, 10); g.fillRect(px6 + 68, 2026 + oy, 16, 10)
          g.fillStyle = '#e8b23d'; g.fillRect(px6 + 44, 2020 + oy, 16, 5)
        }
      g.restore()
      if (shut) {
        g.restore()
        // 后面两扇的侧边：越靠后越暗越窄，读作「还叠着两扇」
        g.fillStyle = '#6a4a30'; g.fillRect(53, 10, 7, 128)
        g.fillStyle = '#2e2118'; g.fillRect(53, 10, 2, 128)
        g.fillStyle = '#573c26'; g.fillRect(60, 14, 5, 120)
        g.fillStyle = '#2e2118'; g.fillRect(60, 14, 2, 120); g.fillRect(65, 14, 1, 120)
        g.fillStyle = 'rgba(46,33,24,0.22)'; g.fillRect(51, 10, 3, 128)    // 折缝
      }
    }
  })
  def("tao_desk_qimen", {
    name: "奇门书桌", cat: "桌案", tags: ["木","灯"],
    scope: "character", fromRoom: 'tao',
    w: 220, h: 200, base: 200, foot: [0, 192, 220, 8],
    zLayer: "low",
    clickable: true, say: "课业？早做完了。……第三遍而已",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-1164, -1740)
      g.fillStyle = '#3a2c20'; g.fillRect(1164, 1810, 220, 130)
        g.fillStyle = '#b58a5c'; g.fillRect(1170, 1816, 208, 112)
        g.fillStyle = '#a0764a'; g.fillRect(1170, 1868, 208, 6)
        g.fillStyle = '#f6efdc'; g.fillRect(1188, 1830, 66, 44)
        g.fillStyle = '#8a5c34'
        g.fillRect(1196, 1840, 50, 3); g.fillRect(1196, 1850, 50, 3); g.fillRect(1196, 1860, 34, 3)
        g.fillStyle = '#c8384a'; g.fillRect(1240, 1826, 5, 22)
        g.fillStyle = '#3a3a40'; g.fillRect(1300, 1798, 10, 36)
        g.fillStyle = '#e87a98'
        g.beginPath(); g.moveTo(1284, 1800); g.lineTo(1330, 1800); g.lineTo(1320, 1776); g.lineTo(1294, 1776); g.fill()
        const dlg = g.createRadialGradient(1306, 1800, 4, 1306, 1800, 60)
        dlg.addColorStop(0, 'rgba(255,200,220,0.4)'); dlg.addColorStop(1, 'rgba(255,200,220,0)')
        g.fillStyle = dlg; g.fillRect(1246, 1740, 120, 120)
      g.restore()
    }
  })
  def("tao_stool_embroidered", {
    name: "绣凳", cat: "坐卧", tags: ["凳","可坐"],
    scope: "generic", fromRoom: 'tao',
    w: 68, h: 30, base: 30, foot: [0, 22, 68, 8],
    zLayer: "low",
    sit: true,
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-1238, -1959)
      pxE(1272, 1974, 34, 14, '#3a2c20')
        pxE(1272, 1968, 28, 10, '#e8a0b4')
      g.restore()
    }
  })
  def("tao_flower_stand", {
    clickable: true, say: '养不活，这是第三盆了',
    name: "花架", cat: "植物", tags: ["架","花"],
    scope: "generic", fromRoom: 'tao',
    w: 100, h: 158, base: 158, foot: [0, 150, 100, 8],
    zLayer: "sort",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-950, -442)
      g.fillStyle = '#3a2c20'
        g.fillRect(950, 470, 100, 10); g.fillRect(966, 540, 84, 10)
        g.fillRect(954, 470, 8, 130); g.fillRect(1040, 470, 8, 130)
        for (const [fx3, fy3, fc2] of [[974, 446, '#e87a98'], [1014, 446, '#c8a0d8'], [994, 516, '#e8b23d']]) {
          g.fillStyle = '#8a4050'; g.fillRect(fx3, fy3 + 14, 26, 14)
          g.fillStyle = '#5a9438'; g.fillRect(fx3 + 10, fy3 + 4, 6, 12)
          g.fillStyle = fc2
          g.fillRect(fx3 + 2, fy3, 9, 9); g.fillRect(fx3 + 15, fy3 - 4, 9, 9)
        }
      g.restore()
    }
  })
  def("tao_light_board", {
    // 应援灯牌本来就是灯 —— 此前它不发光，是漏了不是设计
    light: { x: 90, y: 100, r: 170, color: '#f0a8c8', flicker: 0.15 },
    fx(g, t, X, Y) {
      // 灯牌呼吸：粉光一涨一落，像 LED 的慢闪
      const a = 0.10 + Math.sin(t / 900) * 0.06
      const q = g.createRadialGradient(X + 90, Y + 100, 8, X + 90, Y + 100, 130)
      q.addColorStop(0, 'rgba(255,180,220,' + a.toFixed(3) + ')')
      q.addColorStop(1, 'rgba(255,180,220,0)')
      g.fillStyle = q; g.fillRect(X - 40, Y - 30, 260, 260)
    },
    clickable: true, say: '粉丝做的，丑是丑了点……我留着而已',
    name: "应援灯牌「桃」", cat: "灯具", tags: ["灯","发光"],
    scope: "character", fromRoom: 'tao',
    w: 180, h: 202, base: 202, foot: [48, 198, 90, 4],
    zLayer: "sort",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-1306, -863)
      g.fillStyle = '#3a2c20'; g.fillRect(1390, 980, 12, 84)
        g.fillStyle = '#e87a98'; g.fillRect(1348, 920, 96, 66)
        g.fillStyle = '#ffd8e4'; g.fillRect(1356, 928, 80, 50)
        g.fillStyle = '#c8384a'
        g.fillRect(1382, 936, 28, 6); g.fillRect(1392, 936, 8, 34)
        g.fillRect(1374, 950, 44, 5); g.fillRect(1378, 960, 36, 4)
        const lg2 = g.createRadialGradient(1396, 953, 8, 1396, 953, 90)
        lg2.addColorStop(0, 'rgba(255,180,210,0.5)'); lg2.addColorStop(1, 'rgba(255,180,210,0)')
        g.fillStyle = lg2; g.fillRect(1306, 863, 180, 180)
      g.restore()
    }
  })
  def("tao_luopan", {
    name: "罗盘", cat: "器物", tags: ["盘","术数"],
    scope: "generic", fromRoom: 'tao',
    w: 92, h: 92, base: 92, foot: [0, 84, 92, 8],
    zLayer: "low",
    clickable: true, say: "天盘地盘的，说了你也不懂",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-474, -1143)
      pxC(520, 1188, 46, '#3a2c20')
        pxC(520, 1188, 40, '#c9a26a')
        pxC(520, 1188, 30, '#e8ddd0')
        g.strokeStyle = '#8a5c34'; g.lineWidth = 2
        g.beginPath(); g.arc(520, 1188, 22, 0, 7); g.stroke()
        g.beginPath(); g.arc(520, 1188, 14, 0, 7); g.stroke()
        g.fillStyle = '#c8384a'; g.fillRect(518, 1170, 4, 18)
        g.fillStyle = '#3a2c20'; g.fillRect(518, 1188, 4, 14)
      g.restore()
    }
  })
  def("tao_flag_holder", {
    clickable: true, say: '师父传的，就一套，弄丢了我……算了',
    name: "令旗筒", cat: "器物", tags: ["旗","筒"],
    scope: "character", fromRoom: 'tao',
    w: 78, h: 128, base: 128, foot: [0, 120, 78, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-924, -1120)
      g.fillStyle = '#7a5c38'; g.fillRect(924, 1190, 64, 58)
        g.fillStyle = '#8a6c44'; g.fillRect(930, 1190, 14, 58)
        for (let k = 0; k < 5; k++) {
          g.fillStyle = '#3a2c20'; g.fillRect(932 + k * 11, 1120 + (k % 2) * 10, 3, 74)
          g.fillStyle = ['#c8384a', '#e8b23d', '#4a6a88', '#5a9438', '#e87a98'][k]
          g.beginPath(); g.moveTo(935 + k * 11, 1122 + (k % 2) * 10); g.lineTo(957 + k * 11, 1130 + (k % 2) * 10); g.lineTo(935 + k * 11, 1140 + (k % 2) * 10); g.fill()
        }
      g.restore()
    }
  })
  def("tao_book_stack", {
    clickable: true, say: '翻烂了，不是我勤，是记性差',
    name: "遁甲书堆", cat: "书卷", tags: ["书","术数"],
    scope: "generic", fromRoom: 'tao',
    w: 130, h: 66, base: 66, foot: [0, 58, 130, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-544, -1274)
      for (let k = 0; k < 3; k++) {
          g.fillStyle = '#3a2c20'; g.fillRect(544 + k * 6, 1318 - k * 22, 118, 22)
          g.fillStyle = ['#4a6a88', '#8a5c34', '#c8384a'][k]; g.fillRect(548 + k * 6, 1321 - k * 22, 110, 16)
          g.fillStyle = '#e8ddd0'; g.fillRect(556 + k * 6, 1325 - k * 22, 28, 8)
        }
      g.restore()
    }
  })
  def("tao_nightstand", {
    clickable: true, say: '手机搁这儿，半夜也要看数据的',
    name: "床头小几", cat: "桌案", tags: ["木","妆"],
    scope: "character", fromRoom: 'tao',
    w: 128, h: 130, base: 130, foot: [0, 122, 128, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-960, -726)
      g.fillStyle = '#3a2c20'; g.fillRect(960, 760, 128, 96)
        g.fillStyle = '#b58a5c'; g.fillRect(966, 766, 116, 84)
        g.fillStyle = '#a0764a'; g.fillRect(966, 806, 116, 6)
        for (let k = 0; k < 3; k++) {
          g.fillStyle = ['#c8384a', '#e87a98', '#a04858'][k]
          g.fillRect(976 + k * 18, 742, 10, 24)
          g.fillStyle = '#3a3a40'; g.fillRect(976 + k * 18, 758, 10, 10)
        }
        g.fillStyle = '#3a2c20'; g.fillRect(1034, 734, 22, 34)
        g.fillStyle = '#8ab8d8'; g.fillRect(1037, 737, 16, 28)
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(1040, 741, 4, 12)
        g.fillStyle = '#e8b23d'; g.fillRect(1040, 726, 10, 10)
        g.fillStyle = '#3a2c20'; g.fillRect(1058, 740, 18, 28)
        g.fillStyle = '#f0b8c8'; g.fillRect(1061, 743, 12, 22)
        g.fillStyle = '#e8b23d'; g.fillRect(1062, 732, 8, 10)
        pxC(1010, 786, 16, '#c9a26a'); pxC(1010, 786, 11, '#e8ddd0')
      g.restore()
    }
  })
  def("tao_headphones", {
    clickable: true, say: '粉丝送的，戴上显得……算了',
    name: "猫耳耳机", cat: "器物", tags: ["耳机","粉"],
    scope: "character", fromRoom: 'tao',
    w: 60, h: 62, base: 62, foot: [0, 54, 60, 8],
    zLayer: "sort",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-1062, -534)
      g.strokeStyle = '#e87a98'; g.lineWidth = 8
        g.beginPath(); g.arc(1092, 574, 26, 3.3, 6.1); g.stroke()
        g.fillStyle = '#e87a98'
        g.fillRect(1062, 570, 14, 26); g.fillRect(1106, 570, 14, 26)
        g.beginPath(); g.moveTo(1064, 552); g.lineTo(1076, 534); g.lineTo(1084, 556); g.fill()
        g.beginPath(); g.moveTo(1100, 556); g.lineTo(1108, 534); g.lineTo(1120, 552); g.fill()
      g.restore()
    }
  })
  def("tao_candy_jar_glass", {
    clickable: true, say: '婆婆塞的，我又不爱吃甜',
    name: "糖果罐", cat: "器物", tags: ["罐","糖"],
    scope: "generic", fromRoom: 'tao',
    w: 36, h: 52, base: 52, foot: [0, 44, 36, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-266, -1434)
      g.fillStyle = 'rgba(230,220,235,0.8)'; g.fillRect(266, 1442, 36, 44)
        g.fillStyle = '#e8a0b4'; g.fillRect(270, 1434, 28, 10)
        for (const [cx3, cy3, cc] of [[274, 1456, '#c8384a'], [286, 1466, '#e8b23d'], [280, 1476, '#5a9438']]) {
          g.fillStyle = cc; g.fillRect(cx3, cy3, 9, 7)
        }
      g.restore()
    }
  })
  def("tao_chips_cola", {
    clickable: true, say: '凌晨吃这个怎么了，又没人看见',
    name: "薯片可乐", cat: "器物", tags: ["零食","现代"],
    scope: "character", fromRoom: 'tao',
    w: 82, h: 62, base: 62, foot: [0, 54, 82, 8],
    zLayer: "sort",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-1322, -826)
      g.fillStyle = '#e8b23d'; g.fillRect(1322, 826, 46, 62)
        g.fillStyle = '#c8384a'; pxE(1345, 846, 16, 10, '#c8384a')
        g.fillStyle = '#f6f2ea'; g.fillRect(1330, 862, 30, 8)
        g.fillStyle = '#c8384a'; g.fillRect(1380, 838, 24, 50)
        g.fillStyle = '#f6f2ea'; g.fillRect(1380, 854, 24, 12)
        g.fillStyle = '#8a8578'; g.fillRect(1382, 832, 20, 6)
      g.restore()
    }
  })
  def("tao_selfie_stick", {
    clickable: true, say: '举着累，可不用它拍不全',
    name: "自拍杆", cat: "器物", tags: ["杆","现代"],
    scope: "character", fromRoom: 'tao',
    w: 156, h: 154, base: 154, foot: [0, 146, 156, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-248, -546)
      g.fillStyle = '#3a3a40'
        g.save(); g.translate(320, 700); g.rotate(-0.5); g.fillRect(0, -150, 8, 150); g.restore()
        g.fillStyle = '#1a1a20'; g.fillRect(382, 546, 22, 40)
      g.restore()
    }
  })
  def("tao_ring_light", {
    clickable: true, say: '打光不好看是要被说的……我才不在乎',
    name: "环形补光灯", cat: "灯具", tags: ["灯","直播"],
    scope: "character", fromRoom: 'tao',
    w: 260, h: 370, base: 370, foot: [86, 362, 84, 8],
    zLayer: "sort",
    clickable: true, say: "开播啦——今天算奇门！",
        // 舞台侧的光：冷白，【只在开播时亮】—— 补光灯是设备，不播的时候不会开着。
    // 于是平时房里只剩她自己那盏暖黄台灯，一开播冷白压上来：两种光就是两个她。
    light: state => state.streaming
      ? { x: 130, y: 150, r: 200, color: '#dce8f5', flicker: 0 }
      : null,
    // 灯管本身也跟着灭：亮/灭两个变体，各栅格化一次走 sprite 缓存
    variant(state) { return state.streaming ? 'on' : 'off' },
    draw(g, opt) {
      // 灭灯:整体压暗并去掉发光圈 —— 关着的补光灯不该还在放光
      const on = !(opt && opt.variant === 'off')
      if (!on) g.globalAlpha = 0.55
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-266, -336)
      g.fillStyle = '#3a3a40'
        g.beginPath(); g.moveTo(390, 560); g.lineTo(352, 706); g.lineTo(366, 706); g.lineTo(396, 574); g.fill()
        g.beginPath(); g.moveTo(400, 560); g.lineTo(438, 706); g.lineTo(424, 706); g.lineTo(394, 574); g.fill()
        g.fillRect(390, 540, 12, 60)
        // 粉金环 + 发光内圈
        for (let dy = -74; dy <= 74; dy++) {
          const dxo = Math.sqrt(74 * 74 - dy * dy) | 0
          const dxi = dy > -58 && dy < 58 ? Math.sqrt(58 * 58 - dy * dy) | 0 : 0
          g.fillStyle = '#e8a0b4'
          g.fillRect(396 - dxo, 466 + dy, dxo - dxi, 1); g.fillRect(396 + dxi, 466 + dy, dxo - dxi, 1)
        }
        for (let dy = -58; dy <= 58; dy++) {
          const dxo = Math.sqrt(58 * 58 - dy * dy) | 0
          const dxi = dy > -48 && dy < 48 ? Math.sqrt(48 * 48 - dy * dy) | 0 : 0
          g.fillStyle = '#fff2f6'
          g.fillRect(396 - dxo, 466 + dy, dxo - dxi, 1); g.fillRect(396 + dxi, 466 + dy, dxo - dxi, 1)
        }
        const rg2 = g.createRadialGradient(396, 466, 30, 396, 466, 130)
        rg2.addColorStop(0, 'rgba(255,235,240,0.5)'); rg2.addColorStop(1, 'rgba(255,235,240,0)')
        g.fillStyle = rg2; g.fillRect(266, 336, 260, 260)
        // 手机(夹中央 · 亮屏)
        g.fillStyle = '#1a1a20'; g.fillRect(378, 428, 36, 74)
        g.fillStyle = '#ffd8e4'; g.fillRect(382, 434, 28, 58)
        g.fillStyle = '#e87a98'; g.fillRect(388, 448, 16, 3); g.fillRect(388, 458, 16, 3)
      g.restore()
    }
  })
  def("tao_ext_crate", {
    name: "前景木箱", cat: "收纳", tags: ["木","箱"],
    scope: "generic", fromRoom: 'tao',
    w: 88, h: 130, base: 130, foot: [0, 122, 88, 8],
    zLayer: "low",
    draw(g) {
      const pxC=(cx,cy,r,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
            for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
          const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
            for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
              const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
              g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
      g.save(); g.scale(0.5, 0.5); g.translate(-906, -2228)
      g.fillStyle = '#8a5c34'; g.fillRect(906, 2290, 88, 68)
        g.fillStyle = '#a0764a'; g.fillRect(906, 2290, 88, 12)
        g.fillStyle = '#5a9438'
        g.fillRect(936, 2240, 10, 52); g.fillRect(916, 2256, 14, 12); g.fillRect(966, 2250, 16, 12)
        g.fillStyle = '#e87a98'; g.fillRect(944, 2228, 10, 12)
      g.restore()
    }
  })
