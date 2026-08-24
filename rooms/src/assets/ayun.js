  def("ayun_shelf_books", {
    clickable: true, say: '师父罚抄的，一本没敢丢',
    scope: 'generic', fromRoom: 'ayun',
    name: '书架 · 四层满架', cat: '收纳', tags: ['木', '书', '靠墙'],
    w: 200, h: 352, base: 352, foot: [0, 292, 200, 60],
    zLayer: 'sort',
    draw(g, o) {
      const P = (o && o.pal) || ['#3a2c20', '#8a6844', '#6e5236']
      g.fillStyle = P[0]; g.fillRect(0, 0, 100, 176)
      g.fillStyle = P[1]; g.fillRect(5, 5, 90, 166)
      const SP = ['#e8d8a0', '#c9a26a', '#a8b8d0', '#c04838', '#5a8a44', '#e8d8a0']
      for (let s = 0; s < 4; s++) {
        g.fillStyle = P[2]; g.fillRect(5, 42 + s * 40, 90, 5)
        for (let k = 0; k < 6; k++) {
          g.fillStyle = SP[(k + s) % 6]
          g.fillRect(9 + k * 14, 10 + s * 40, 12, 28)
          g.fillStyle = P[0]
          g.fillRect(9 + k * 14, 10 + s * 40, 1, 28)
          g.fillRect(20 + k * 14, 10 + s * 40, 1, 28)
          if ((k + s) % 3 === 0) { g.fillStyle = '#f6efdc'; g.fillRect(12 + k * 14, 16 + s * 40, 7, 3) }
        }
      }
    }
  })

  def("ayun_cabinet_herb", {
    scope: 'character', fromRoom: 'ayun',
    name: '药柜 · 六列七行', cat: '收纳', tags: ['木', '抽屉', '靠墙', '中药'],
    w: 316, h: 448, base: 448, foot: [0, 388, 316, 60],
    zLayer: 'sort',
    draw(g) {
      g.fillStyle = '#3a2c20'; g.fillRect(0, 0, 158, 224)
      g.fillStyle = '#7e5230'; g.fillRect(4, 4, 150, 216)
      for (let r = 0; r < 7; r++) for (let c = 0; c < 6; c++) {
        const dx = 8 + c * 24, dy = 8 + r * 30
        g.fillStyle = '#8a6844'; g.fillRect(dx, dy, 22, 28)
        g.fillStyle = '#6e5236'; g.fillRect(dx, dy + 26, 22, 2)
        g.fillStyle = '#e8b23d'; g.fillRect(dx + 9, dy + 12, 5, 4)
        if ((r + c) % 4 === 0) { g.fillStyle = '#f6efdc'; g.fillRect(dx + 3, dy + 4, 16, 5) }
      }
    }
  })

  /* ────────── 桌案类 ────────── */
  def("ayun_desk_low", {
    scope: 'generic', fromRoom: 'ayun',
    name: '书案 · 矮几', cat: '桌案', tags: ['木', '工作面'],
    w: 288, h: 168, base: 168, foot: [0, 0, 288, 168],
    zLayer: 'low', draw(g) {
      g.fillStyle = 'rgba(50,35,18,0.25)'; g.fillRect(4, 74, 140, 10)
      g.fillStyle = '#3a2c20'; g.fillRect(0, 0, 144, 78)
      g.fillStyle = '#a06a40'; g.fillRect(4, 4, 136, 66)
      g.fillStyle = '#8a5c34'; g.fillRect(4, 4, 136, 8)
      g.fillStyle = '#3a2c20'; g.fillRect(10, 78, 10, 6); g.fillRect(124, 78, 10, 6)
    }
  })

  /* ────────── 坐卧类 ────────── */
  def("ayun_cushion_round", {
    walkable: true,   // 能踩的:坐垫/蒲团/门垫不是障碍，烧格时跳过
    clickable: true, say: '打坐用的，睡觉也行', sayDeep: '坐上去就困……以前不这样的',
    scope: 'generic', fromRoom: 'ayun',
    name: '蒲团 · 圆坐垫', cat: '坐卧', tags: ['布', '可坐', '道门'],
    w: 124, h: 136, base: 128, foot: [12, 68, 100, 56], sit: true,
    zLayer: 'low', draw(g) {
      pxC(g, 31, 38, 30, 'rgba(50,35,18,0.22)')
      pxC(g, 31, 34, 30, '#3a2c20')
      pxC(g, 31, 34, 26, '#8a9ab8')
      pxR(g, 31, 34, 26, 4, '#a8b8d0')
      pxR(g, 31, 34, 16, 2, '#5a6a88')
      pxC(g, 31, 34, 8, '#5a6a88')
      g.fillStyle = '#3a2c20'
      for (let a = 0; a < 8; a++)
        g.fillRect(31 + Math.cos(a * 0.785) * 21, 34 + Math.sin(a * 0.785) * 21, 2, 2)
    }
  })

  def("ayun_screen_panel", {
    clickable: true, say: '挡什么？挡贫道不想见的人',
    scope: 'generic', fromRoom: 'ayun',
    name: '屏风 · 单扇绘竹', cat: '隔断', tags: ['木', '纸', '可拼接'],
    w: 108, h: 352, base: 352, foot: [0, 292, 108, 60], repeat: true,
    zLayer: 'sort',
    draw(g) {
      g.fillStyle = '#3a2c20'; g.fillRect(0, 0, 54, 176)
      g.fillStyle = '#e8d8a0'; g.fillRect(4, 4, 46, 168)
      g.fillStyle = '#5a8a44'
      g.fillRect(9, 102, 17, 6); g.fillRect(13, 93, 9, 9)
      g.fillRect(27, 111, 17, 6); g.fillRect(31, 102, 9, 9)
      g.fillStyle = '#5a6a88'; g.fillRect(9, 132, 36, 5)
      pxC(g, 36, 24, 6, '#e89040')
      g.fillStyle = '#f6efdc'; g.fillRect(10, 34, 12, 3); g.fillRect(18, 40, 12, 3)
      g.fillStyle = '#c04838'; g.fillRect(36, 150, 9, 11)
    }
  })

  /* ────────── 灯火类 ────────── */
  def("ayun_lamp_floor", {
    clickable: true, say: '留一盏，半夜起来不摔跤',
    scope: 'generic', fromRoom: 'ayun',
    name: '高灯台 · 落地', cat: '灯火', tags: ['木', '发光'],
    w: 84, h: 264, base: 264, foot: [0, 204, 84, 60], light: { x: 42, y: 44, r: 80, color: '#ffd76a', flicker: 0.3 },
    zLayer: 'sort',
    fx(g, t, X, Y) {
      const f = 0.5 + 0.5 * Math.sin(t / 130)
      g.fillStyle = 'rgba(255,215,106,' + (0.85 - f * 0.2) + ')'
      g.fillRect(X + 24, Y + 26 - f * 3, 14, 20 + f * 4)
      g.fillStyle = 'rgba(255,246,214,0.95)'
      g.fillRect(X + 28, Y + 32 - f * 2, 6, 9)
    },
    draw(g) {
      g.fillStyle = '#3a2c20'; g.fillRect(16, 42, 6, 84)
      g.fillRect(0, 122, 38, 6)
      g.fillStyle = '#f0e4c0'; g.fillRect(0, 0, 38, 44)
      g.fillStyle = '#3a2c20'; g.fillRect(0, 0, 38, 3); g.fillRect(0, 41, 38, 3)
      g.fillStyle = '#ffd76a'; g.fillRect(12, 14, 14, 18)
    }
  })

  def("ayun_brazier", {
    scope: 'generic', fromRoom: 'ayun',
    name: '丹炉 · 三足', cat: '灯火', tags: ['陶', '火', '烟'],
    w: 104, h: 116, base: 116, foot: [0, 56, 104, 60], light: { x: 52, y: 34, r: 60, color: '#e89040', flicker: 0.8 },
    zLayer: 'low', draw(g) {
      g.fillStyle = 'rgba(50,35,18,0.25)'; g.fillRect(2, 50, 48, 8)
      pxC(g, 26, 26, 24, '#3a2c20')
      pxC(g, 26, 26, 20, '#6e675e')
      pxC(g, 26, 24, 15, '#9a938a')
      pxC(g, 26, 24, 10, '#3a2c20')
      g.fillStyle = '#e89040'; g.fillRect(21, 20, 10, 5)
      g.fillStyle = '#ffd76a'; g.fillRect(23, 21, 5, 3)
      g.fillStyle = '#3a2c20'
      g.fillRect(6, 44, 5, 14); g.fillRect(41, 44, 5, 14); g.fillRect(23, 48, 5, 10)
    }
  })

  /* ────────── 器物类(桌面小件 · 可拼接到桌案上)────────── */
  def("ayun_censer_small", {
    scope: 'generic', fromRoom: 'ayun',
    name: '小香炉', cat: '器物', tags: ['铜', '烟', '桌面'],
    w: 48, h: 40, base: 40, foot: [0, 24, 48, 16],
    zLayer: 'sort',
    fx(g, t, X, Y) {
      const f = 0.5 + 0.5 * Math.sin(t / 105)
      g.fillStyle = 'rgba(232,144,64,' + (0.8 - f * 0.25) + ')'
      g.fillRect(X + 42, Y + 38 - f * 3, 20, 12 + f * 4)
      g.fillStyle = 'rgba(255,215,106,0.9)'
      g.fillRect(X + 47, Y + 42 - f * 2, 9, 6)
      for (let n = 0; n < 3; n++) {
        const ph = (t / 18 + n * 44) % 130
        g.fillStyle = 'rgba(190,180,168,' + (0.24 - ph / 560) + ')'
        g.fillRect(X + 50 + Math.sin((ph + n * 26) / 28) * 8, Y + 30 - ph * 0.6, 5, 5)
      }
    },
    draw(g) {
      g.fillStyle = '#6e675e'; g.fillRect(0, 4, 24, 13)
      g.fillStyle = '#3a2c20'
      g.fillRect(-3, 15, 30, 3); g.fillRect(3, -2, 3, 7); g.fillRect(18, -2, 3, 7)
    }
  })

  def("ayun_teapot", {
    scope: 'generic', fromRoom: 'ayun',
    name: '茶壶 + 杯', cat: '器物', tags: ['陶', '桌面', '生活'],
    w: 72, h: 48, base: 48, foot: [0, 28, 72, 20],
    zLayer: 'sort',
    draw(g) {
      g.fillStyle = '#5a6a88'; g.fillRect(0, 6, 26, 20); g.fillRect(26, 11, 9, 8)
      g.fillStyle = '#3a2c20'; g.fillRect(6, 0, 14, 5)
      g.fillStyle = '#f6efdc'; g.fillRect(28, 16, 11, 11)
    }
  })

  /* ────────── 自阿云房提取(原绘制代码原样搬运,仅平移原点)────────── */
  def("ayun_rug_cloud", {
    walkable: true,   // 能踩的:坐垫/蒲团/门垫不是障碍，烧格时跳过
    clickable: true, say: '躺这儿比床舒服，别问',
    scope: 'generic',
    name: '地毯 · 云纹方毯', cat: '地面', tags: ["布", "平铺", "不阻挡"],
    w: 696, h: 688, base: 0, foot: [0,688,696,0], layer:'decal', zLayer: 'low', fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-186, -396)
  // ═══════════ 3. 大毯 + 式盘桌 ═══════════
  g.fillStyle = '#3a2c20'; g.fillRect(186, 396, 348, 344)
  g.fillStyle = '#5a6a88'; g.fillRect(190, 400, 340, 336)
  g.fillStyle = '#7a8ca8'; g.fillRect(204, 414, 312, 308)
  g.fillStyle = '#5a6a88'
  g.fillRect(218, 428, 284, 3); g.fillRect(218, 705, 284, 3)
  g.fillRect(218, 428, 3, 280); g.fillRect(499, 428, 3, 280)
  g.fillStyle = '#8a9ab8'
  for (let k = 0; k < 6; k++) {
    g.fillRect(238 + k * 50, 438, 5, 5); g.fillRect(238 + k * 50, 692, 5, 5)
  }
  g.fillStyle = '#e8b23d'
  g.fillRect(196, 406, 9, 9); g.fillRect(515, 406, 9, 9)
  g.fillRect(196, 721, 9, 9); g.fillRect(515, 721, 9, 9)
      g.restore()
      // ── 细节 pass(1440 系 1:1,资源自包含,不再依赖房间的全局细节层)── %s
      g.save(); g.setTransform(1,0,0,1,0,0)
      g.fillStyle = 'rgba(90,106,136,0.5)'
      for (let y = 78; y < 638; y += 14)
        for (let x = 78 + (((y / 14) | 0) % 2) * 7; x < 628; x += 14) {
          if (x > 188 && x < 508 && y > 98 && y < 538) continue
          g.fillRect(x, y, 2, 2)
        }
      g.restore()
      // ── 细节 pass(1440 系 1:1,资源自包含,不再依赖房间的全局细节层)── %s
      g.save(); g.setTransform(1,0,0,1,0,0)
      g.fillStyle = 'rgba(58,44,32,0.5)'
      for (let sv = 0; sv < 4; sv++)
        for (let k = 0; k < 6; k += 2) {
          const x = 18 + k * 28, y = 20 + sv * 80
          g.fillRect(x + 2, y + 8, 20, 1); g.fillRect(x + 2, y + 44, 20, 1)
        }
      g.restore()
    }
  })

  def("ayun_desk_study", {
    clickable: true, say: '抄经，抄一半睡着的那种', sayDeep: '抄了七遍，第八遍还在抄',
    scope: 'generic',
    name: '书案 · 文房', cat: '桌案', tags: ["木", "工作面", "文房"],
    w: 288, h: 256, base: 168, foot: [0,0,288,168], zLayer: 'low', fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-44, -444)
  // ═══════════ 4. 书案(左中)═══════════
  g.fillStyle = 'rgba(50,35,18,0.25)'; g.fillRect(48, 452, 140, 76)
  g.fillStyle = '#3a2c20'; g.fillRect(44, 444, 144, 78)
  g.fillStyle = '#8a5c34'; g.fillRect(48, 448, 136, 70)
  g.fillStyle = '#754c28'; g.fillRect(48, 448, 136, 8)
  // 砚台 + 墨
  g.fillStyle = '#1a1a20'; g.fillRect(60, 466, 30, 22)
  g.fillStyle = '#3d3d46'; g.fillRect(63, 469, 24, 16)
  pxCircle(75, 477, 6, '#1a1a20')
  // 笔架(山形 + 垂笔×2)
  g.fillStyle = '#3a2c20'
  g.fillRect(104, 458, 4, 18); g.fillRect(120, 452, 4, 24); g.fillRect(136, 458, 4, 18)
  g.fillRect(104, 456, 36, 4)
  g.fillStyle = '#a06a40'; g.fillRect(110, 460, 3, 14); g.fillRect(128, 460, 3, 14)
  g.fillStyle = '#1a1a20'; g.fillRect(110, 474, 3, 5); g.fillRect(128, 474, 3, 5)
  // 纸卷 + 镇纸
  g.fillStyle = '#f6efdc'; g.fillRect(148, 464, 28, 40)
  g.fillStyle = '#3a2c20'; g.fillRect(147, 463, 30, 1); g.fillRect(147, 504, 30, 1)
  g.fillStyle = '#c9a26a'; g.fillRect(150, 468, 22, 4)
  g.fillStyle = '#6e675e'; g.fillRect(152, 494, 20, 6)
  // 案下坐垫
  pxCircle(116, 548, 24, '#3a2c20')
  pxCircle(116, 548, 21, '#c04838')
  pxRing(116, 548, 21, 3, '#d86a58')
      g.restore()
    }
  })

  def("ayun_basket_scroll", {
    clickable: true, say: '都是要读的……总有一天',
    scope: 'generic',
    name: '卷轴筐 + 竹简堆', cat: '收纳', tags: ["竹", "矮", "散置"],
    w: 296, h: 144, base: 144, foot: [0,84,296,60], zLayer: 'low', fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-26, -548)
  // 卷轴筐 + 竹简堆
  pxCircle(56, 590, 30, '#3a2c20')
  pxCircle(56, 588, 26, '#a06a40')
  pxCircle(56, 584, 20, '#754c28')
  g.fillStyle = '#e8d8a0'
  g.fillRect(40, 554, 8, 32); g.fillRect(52, 548, 8, 38); g.fillRect(66, 556, 8, 30)
  g.fillStyle = '#c04838'
  g.fillRect(40, 554, 8, 4); g.fillRect(52, 548, 8, 4); g.fillRect(66, 556, 8, 4)
  g.fillStyle = '#c9a26a'
  g.fillRect(122, 588, 52, 9); g.fillRect(128, 578, 42, 9); g.fillRect(134, 568, 30, 9)
  g.fillStyle = '#3a2c20'
  g.fillRect(122, 588, 52, 2); g.fillRect(128, 578, 42, 2); g.fillRect(134, 568, 30, 2)
      g.restore()
    }
  })

  def("ayun_cabinet_herb2", {
    clickable: true, say: '抓药的时候，手比起课稳',
    scope: 'character',
    name: '药柜 · 六列七行（原件）', cat: '收纳', tags: ["木", "抽屉", "靠墙", "中药"],
    w: 316, h: 524, base: 524, foot: [0,464,316,60], fromRoom: 'ayun',
    zLayer: 'sort',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-14, -678)
  // ═══════════ 6. 药柜(6×7)+ 顶部 ═══════════
  g.fillStyle = '#3a2c20'; g.fillRect(14, 716, 158, 224)
  g.fillStyle = '#8a6844'; g.fillRect(20, 722, 146, 212)
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 6; c++) {
      g.fillStyle = '#754c28'
      g.fillRect(24 + c * 24, 726 + r * 29, 21, 26)
      g.fillStyle = '#3a2c20'
      g.fillRect(24 + c * 24, 726 + r * 29, 21, 2)
      g.fillStyle = '#e8b23d'
      g.fillRect(32 + c * 24, 737 + r * 29, 5, 5)
      if ((r + c) % 4 === 0) { g.fillStyle = '#e8d8a0'; g.fillRect(28 + c * 24, 729 + r * 29, 13, 4) }
    }
  // 柜顶:研钵 · 戥秤 · 药包×2
  pxCircle(52, 706, 15, '#3a2c20')
  pxCircle(52, 704, 12, '#6e675e')
  pxCircle(52, 702, 7, '#4a453e')
  g.fillStyle = '#a06a40'; g.fillRect(60, 682, 5, 20)
  // 戥秤(立杆 + 横梁 + 吊盘 + 秤砣)
  g.fillStyle = '#3a2c20'
  g.fillRect(112, 678, 4, 34); g.fillRect(94, 678, 40, 3)
  g.fillRect(97, 681, 2, 8); g.fillRect(129, 681, 2, 8)
  pxCircle(98, 693, 6, '#c9a26a')
  pxCircle(98, 691, 4, '#e8b23d')
  g.fillStyle = '#6e675e'; g.fillRect(127, 689, 6, 7)
  // 药包×2(布包 · 扎绳 · 褶线)
  g.fillStyle = '#f6efdc'; g.fillRect(144, 696, 20, 16)
  g.fillStyle = '#e8d8a0'; g.fillRect(144, 702, 20, 2)
  g.fillStyle = '#c04838'; g.fillRect(151, 692, 6, 6)
  g.fillStyle = '#d8ccb4'; g.fillRect(148, 706, 3, 6); g.fillRect(157, 704, 3, 8)
      g.restore()
      // ── 细节 pass(1440 系 1:1,资源自包含,不再依赖房间的全局细节层)── %s
      g.save(); g.setTransform(1,0,0,1,0,0)
      g.fillStyle = 'rgba(58,44,32,0.6)'
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 6; c++) {
          if ((r + c) % 4 !== 0) continue
          const x = 30 + c * 48, y = 104 + r * 58
          g.fillRect(x, y, 8, 1); g.fillRect(x + 2, y + 3, 5, 1)
        }
      g.restore()
    }
  })

  def("ayun_bed_couch", {
    clickable: true, say: '贫道昨夜观星，（其实在打游戏）',
    scope: 'generic',
    name: '睡榻', cat: '坐卧', tags: ["木", "布", "可卧"],
    w: 328, h: 384, base: 384, foot: [0,0,328,384], sleep:true,fromRoom: 'ayun',
    zLayer: 'sort',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-546, -228)
  // ═══════════ 8. 睡榻区 ═══════════
  g.fillStyle = 'rgba(50,35,18,0.25)'; g.fillRect(556, 246, 152, 174)
  g.fillStyle = '#3a2c20'; g.fillRect(550, 236, 156, 180)
  g.fillStyle = '#a06a40'; g.fillRect(556, 242, 144, 168)
  g.fillStyle = '#8a9ab8'; g.fillRect(565, 278, 126, 123)
  g.fillStyle = '#a8b8d0'; g.fillRect(565, 278, 126, 20)
  g.fillStyle = '#5a6a88'
  for (let k = 0; k < 5; k++) g.fillRect(574 + k * 25, 338, 18, 3)
  // 枕头:原本是一块纯色矩形加两条线,看着像贴纸。按分层重绘,并加宽到
  // 接近床内宽、横跨床头居中 —— 枕头本来就该横着占满床头,而不是缩在左角。
  g.fillStyle = '#3a2c20'; g.fillRect(564, 244, 128, 30)          // ① 描边
  g.fillStyle = '#e4dcc4'; g.fillRect(566, 246, 124, 26)          // ② 主体(偏暗米色)
  g.fillStyle = '#f6efdc'; g.fillRect(566, 246, 124, 9)           // ③ 上沿受光
  g.fillStyle = '#d2cab0'; g.fillRect(566, 268, 124, 4)           // ④ 下沿背光
  g.fillStyle = '#d8d0b6'; g.fillRect(604, 252, 48, 16)           // ⑤ 头压出的凹陷
  g.fillStyle = 'rgba(150,140,118,0.45)'                          // ⑥ 缝线
  g.fillRect(568, 249, 120, 1); g.fillRect(568, 269, 120, 1)
  g.fillStyle = 'rgba(150,140,118,0.30)'                          // ⑦ 两端褶
  g.fillRect(572, 252, 2, 16); g.fillRect(682, 252, 2, 16)

      g.restore()
    }
  })

  def("ayun_table_night", {
    clickable: true, say: '茶凉了……三天前的',
    scope: 'generic',
    name: '床头几 · 茶具', cat: '桌案', tags: ["木", "桌面", "生活"],
    w: 156, h: 112, base: 112, foot: [0,0,156,112], zLayer: 'low', fromRoom: 'ayun',
    fx(g, t, X, Y) {
      for (let n = 0; n < 4; n++) {
        const ph = (t / 26 + n * 36) % 130
        g.fillStyle = 'rgba(240,238,230,' + (0.55 - ph / 330) + ')'
        g.fillRect(X + 26 + Math.sin((ph + n * 33) / 26) * 7, Y + 14 - ph * 0.55, 7, 7)
      }
    },
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-556, -436)
  // 床头几:茶壶+杯×2+一炷香
  g.fillStyle = '#3a2c20'; g.fillRect(556, 436, 78, 56)
  g.fillStyle = '#8a6844'; g.fillRect(561, 441, 68, 46)
  g.fillStyle = '#6e5236'; g.fillRect(561, 479, 68, 8)
  g.fillStyle = '#5a6a88'
  g.fillRect(570, 450, 26, 20); g.fillRect(596, 455, 9, 8)
  g.fillStyle = '#3a2c20'; g.fillRect(576, 444, 14, 5)
  g.fillStyle = '#f6efdc'
  g.fillRect(610, 460, 11, 11); g.fillRect(610, 445, 11, 11)
  g.fillStyle = '#c9a26a'; g.fillRect(566, 470, 2, 12)
  g.fillStyle = 'rgba(248,244,232,0.4)'; g.fillRect(566, 458, 2, 3); g.fillRect(568, 450, 2, 3)
      g.restore()
    }
  })

  def("ayun_bonsai_pine", {
    clickable: true, say: '养了两年，它比贫道勤快',
    scope: 'generic',
    name: '盆景 · 松', cat: '装饰', tags: ["陶", "绿植"],
    w: 104, h: 186, base: 186, foot: [0,126,104,60], fromRoom: 'ayun',
    zLayer: 'low',   // 盆景连盆约 0.6m
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-644, -538)
  // 盆景
  g.fillStyle = '#c04838'; g.fillRect(648, 606, 44, 24)
  g.fillStyle = '#3a2c20'; g.fillRect(644, 626, 52, 5)
  g.fillStyle = '#a06a40'; g.fillRect(666, 584, 7, 24)
  pxCircle(660, 572, 15, '#4a7c3e')
  pxCircle(680, 560, 12, '#5a8a44')
  pxCircle(668, 548, 10, '#4a7c3e')
  g.fillStyle = '#8ec858'
  g.fillRect(654, 564, 4, 4); g.fillRect(676, 552, 4, 4)
      g.restore()
    }
  })

  def("ayun_rack_umbrella", {
    clickable: true, say: '下雨就不出门了，正好',
    scope: 'generic',
    name: '伞架 + 纸伞', cat: '收纳', tags: ["木", "纸伞", "靠墙"],
    w: 60, h: 164, base: 164, foot: [0,104,60,60], fromRoom: 'ayun',
    zLayer: 'low',   // 伞架约 0.9m
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-680, -664)
  // 伞架 + 纸伞×2
  g.fillStyle = '#3a2c20'; g.fillRect(680, 706, 30, 40)
  g.fillStyle = '#a06a40'; g.fillRect(684, 710, 22, 32)
  g.fillStyle = '#c04838'; g.fillRect(688, 668, 6, 44)
  g.fillStyle = '#e86a50'; g.fillRect(686, 664, 10, 8)
  g.fillStyle = '#5a6a88'; g.fillRect(698, 674, 5, 38)
      g.restore()
    }
  })

  def("ayun_table_shipan", {
    clickable: true, say: '天盘一转，人事就动了', sayDeep: '十六岁那年……断准了，可贫道自己不信',
    say: '师父留下的那面盘',
    scope: 'character',
    name: '式盘桌 · 大六壬', cat: '桌案', tags: ["木", "法器", "英雄件"],
    w: 416, h: 428, base: 428, foot: [40,40,336,348], hero:true,zLayer: 'low', fromRoom: 'ayun',
    fx(g, t, X, Y, inst, room) {
      // 环境光晕 + 四点星闪。原先画在房间循环里,是这件家具的第二份绘制;
      // 挪进来后房间不再碰画笔。坐标转成素材本地系。
      const ax = X + 208, ay = Y + 220
      const ag = g.createRadialGradient(ax, ay, 20, ax, ay, 230)
      ag.addColorStop(0, 'rgba(255,215,106,' + (0.10 + Math.sin(t / 900) * 0.06) + ')')
      ag.addColorStop(1, 'rgba(255,215,106,0)')
      g.fillStyle = ag; g.fillRect(ax - 230, ay - 230, 460, 460)
      for (let k = 0; k < 4; k++) {
        const ph = (t / 1500 + k * 0.31) % 1
        const ss = Math.sin(ph * Math.PI) * 11
        if (ss <= 1.5) continue
        const sx = ax + [-150, 120, -60, 170][k], sy = ay + [-120, -160, 150, 90][k]
        g.fillStyle = 'rgba(255,225,140,' + (0.85 * Math.sin(ph * Math.PI)) + ')'
        g.fillRect(sx - ss, sy - 2, ss * 2, 4)
        g.fillRect(sx - 2, sy - ss, 4, ss * 2)
        g.fillRect(sx - 4, sy - 4, 8, 8)
      }
      const cx = X + 208, cy = Y + 204
      const perform = !!(room && room.performing)
      // ── 平时:呼吸光晕 + 淡四芒 ──
      if (!perform) {
        const b = 0.5 + 0.5 * Math.sin(t / 520)
        const q = g.createRadialGradient(cx, cy, 4, cx, cy, 74)
        q.addColorStop(0, 'rgba(255,215,106,' + (0.16 + 0.10 * b) + ')')
        q.addColorStop(1, 'rgba(255,215,106,0)')
        g.fillStyle = q; g.fillRect(cx - 74, cy - 74, 148, 148)
        g.fillStyle = 'rgba(255,215,106,' + (0.55 + 0.35 * b) + ')'
        const L = 13 + 5 * b
        g.fillRect(cx - 1, cy - L, 3, L * 2); g.fillRect(cx - L, cy - 1, L * 2, 3)
        return
      }
      // ══ 起课动画:按大六壬的实际步骤分四拍(总 6.4s 循环)══
      //   ① 月将加时:天盘急转后减速定位
      //   ② 四课:东西南北四象依次点亮(青龙/白虎/朱雀/玄武)
      //   ③ 三传:初/中/末三传自内向外依次立起光柱
      //   ④ 定局:全盘一次亮起后回落
      const T = (t % 19200) / 19200   // 起课要从容,一轮 19.2s
      const ease = u => 1 - Math.pow(1 - u, 3)
      // ① 天盘转动(0 → 0.35)
      let ang
      if (T < 0.35) {
        const u = ease(T / 0.35)
        ang = -Math.PI / 2 + u * Math.PI * 6.0
      } else ang = -Math.PI / 2 + Math.PI * 6.0
      g.fillStyle = 'rgba(255,215,106,0.92)'
      for (let r = 16; r < 86; r += 7) {
        const px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * r
        g.fillRect((px | 0) - 2, (py | 0) - 2, 5, 5)
      }
      // 转动时的拖影
      if (T < 0.35) for (let s2 = 1; s2 <= 3; s2++) {
        g.fillStyle = 'rgba(255,215,106,' + (0.26 - s2 * 0.07) + ')'
        for (let r = 20; r < 84; r += 12) {
          const a2 = ang - s2 * 0.22
          g.fillRect((cx + Math.cos(a2) * r) | 0, (cy + Math.sin(a2) * r) | 0, 4, 4)
        }
      }
      // ② 四课:四象依次点亮(0.35 → 0.62)
      const FOUR = [[0, -1, '#e8e4d8'], [1, 0, '#5a8a44'], [0, 1, '#c04838'], [-1, 0, '#2c3a54']]
      for (let n = 0; n < 4; n++) {
        const at = 0.35 + n * 0.068
        if (T < at) continue
        const life = Math.min(1, (T - at) / 0.09)
        const [dx, dy, col] = FOUR[n]
        const px = cx + dx * 96, py = cy + dy * 96
        const rr = 9 + 5 * Math.sin(life * Math.PI)
        g.fillStyle = col
        g.fillRect((px - rr) | 0, (py - rr) | 0, rr * 2, rr * 2)
        g.fillStyle = 'rgba(255,240,190,' + (0.5 * (1 - life)) + ')'
        g.fillRect((px - rr - 4) | 0, (py - rr - 4) | 0, rr * 2 + 8, rr * 2 + 8)
      }
      // ③ 三传:初中末自内向外立起(0.62 → 0.86)
      for (let n = 0; n < 3; n++) {
        const at = 0.62 + n * 0.075
        if (T < at) continue
        const life = Math.min(1, (T - at) / 0.10)
        const r = 34 + n * 26, h = 26 * life
        const px = cx + Math.cos(-Math.PI / 2 + n * 2.094) * r
        const py = cy + Math.sin(-Math.PI / 2 + n * 2.094) * r
        g.fillStyle = 'rgba(255,215,106,' + (0.85 * life) + ')'
        g.fillRect((px | 0) - 2, (py - h) | 0, 5, h)
        g.fillStyle = 'rgba(255,240,190,' + (0.9 * life) + ')'
        g.fillRect((px | 0) - 4, (py - h - 4) | 0, 9, 6)
      }
      // ④ 定局:全盘亮起后回落(0.86 → 1)
      if (T > 0.86) {
        const u = (T - 0.86) / 0.14, k2 = Math.sin(u * Math.PI)
        const q = g.createRadialGradient(cx, cy, 6, cx, cy, 150)
        q.addColorStop(0, 'rgba(255,236,170,' + (0.42 * k2) + ')')
        q.addColorStop(1, 'rgba(255,236,170,0)')
        g.fillStyle = q; g.fillRect(cx - 150, cy - 150, 300, 300)
      }
    },
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-256, -446)
  // 式盘桌(r100 · 高细节)
  pxCircle(360, 556, 104, 'rgba(50,35,18,0.3)')
  pxCircle(360, 548, 102, '#3a2c20')
  pxCircle(360, 548, 97, '#a06a40')
  pxRing(360, 548, 97, 4, '#b57c4c')
  pxCircle(360, 548, 89, '#8a5c34')
  g.fillStyle = '#754c28'; g.fillRect(288, 476, 144, 144)
  g.strokeStyle = '#e8b23d'; g.lineWidth = 2
  g.strokeRect(296, 484, 128, 128)
  g.strokeRect(314, 502, 92, 92)
  g.fillStyle = '#e8b23d'
  g.fillRect(292, 480, 8, 8); g.fillRect(420, 480, 8, 8)
  g.fillRect(292, 608, 8, 8); g.fillRect(420, 608, 8, 8)
  pxCircle(360, 548, 57, '#3a2c20')
  pxCircle(360, 548, 52, '#2c3a54')
  pxRing(360, 548, 52, 4, '#3d5070')
  pxRing(360, 548, 40, 2, '#3d5070')
  g.fillStyle = '#ffd76a'
  for (let a = 0; a < 12; a++) {
    const x = 360 + Math.cos(a * 0.5236) * 38, y = 548 + Math.sin(a * 0.5236) * 38
    g.fillRect(x - 2, y - 2, 4, 4)
  }
  g.fillStyle = '#8a9ab8'
  for (let a = 0; a < 24; a++) {
    const x = 360 + Math.cos(a * 0.2618) * 47, y = 548 + Math.sin(a * 0.2618) * 47
    g.fillRect(x, y, 2, 2)
  }
  // 四象色点(N玄武黑 · S朱雀红 · E青龙青 · W白虎白)
  g.fillStyle = '#1a1a20'; g.fillRect(357, 500, 6, 6)
  g.fillStyle = '#c04838'; g.fillRect(357, 590, 6, 6)
  g.fillStyle = '#5a8a44'; g.fillRect(405, 545, 6, 6)
  g.fillStyle = '#f6efdc'; g.fillRect(309, 545, 6, 6)
  g.fillStyle = '#c04838'; g.fillRect(352, 541, 16, 16)
  // (指针由动画层绘制 · 算命时旋转)
  // 桌面小件:签筒 · 罗盘 · 朱砂碟+笔 · 铜钱×3
  g.fillStyle = '#3a2c20'; g.fillRect(428, 486, 24, 30)
  g.fillStyle = '#a06a40'; g.fillRect(431, 489, 18, 24)
  g.fillStyle = '#e8d8a0'
  g.fillRect(434, 474, 3, 18); g.fillRect(440, 471, 3, 21); g.fillRect(446, 477, 3, 15)
  g.fillStyle = '#c04838'
  g.fillRect(434, 474, 3, 4); g.fillRect(440, 471, 3, 4); g.fillRect(446, 477, 3, 4)
  pxCircle(285, 620, 16, '#3a2c20')
  pxCircle(285, 620, 13, '#c9a26a')
  pxCircle(285, 620, 8, '#f6efdc')
  g.fillStyle = '#c04838'; g.fillRect(284, 613, 2, 8)
  pxCircle(440, 630, 12, '#3a2c20')
  pxCircle(440, 630, 10, '#e8d8b8')
  pxCircle(440, 630, 5, '#c04838')
  g.fillStyle = '#a06a40'; g.fillRect(452, 618, 3, 18)
  g.fillStyle = '#1a1a20'; g.fillRect(452, 634, 3, 4)
  function coin(x, y) {
    pxCircle(x, y, 7, '#e8b23d')
    pxRing(x, y, 7, 1, '#a87820')
    g.fillStyle = '#a87820'; g.fillRect(x - 2, y - 2, 4, 4)
  }
  coin(300, 640); coin(316, 648); coin(290, 654)


      g.restore()
      // ── 细节 pass(1440 系 1:1,资源自包含,不再依赖房间的全局细节层)── %s
      g.save(); g.setTransform(1,0,0,1,0,0)
      g.fillStyle = '#c8d4ec'
      for (let a = 0; a < 28; a++)
        g.fillRect((208 + Math.cos(a * 0.2244) * 84) | 0, (204 + Math.sin(a * 0.2244) * 84) | 0, 2, 2)
      g.fillStyle = 'rgba(58,44,32,0.55)'
      for (let a = 0; a < 48; a++)
        g.fillRect((208 + Math.cos(a * 0.1309) * 190) | 0, (204 + Math.sin(a * 0.1309) * 190) | 0, 2, 2)
      g.restore()
    }
  })

def("ayun_qing_bowl", {
    say: '（铮——）',
    scope: 'character',
    name: '铜磬 + 磬槌', cat: '器物', tags: ["铜", "法器", "可敲"],
    w: 110, h: 94, base: 94, foot: [0,54,110,40], clickable:true,zLayer: 'low', fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-512, -737)
  // 铜磬 + 磬槌(道门法器 · 朱布垫)
  pxCircle(528, 768, 16, '#3a2c20')
  pxCircle(528, 767, 14, '#c04838')
  g.fillStyle = '#3a2c20'; g.fillRect(513, 748, 30, 3)
  g.fillStyle = '#c9a26a'
  g.fillRect(515, 751, 26, 5); g.fillRect(517, 756, 22, 4); g.fillRect(520, 760, 16, 4)
  g.fillStyle = '#a87820'; g.fillRect(520, 762, 16, 2)
  g.fillStyle = '#e8d8a0'; g.fillRect(518, 752, 7, 2)
  g.fillStyle = '#8a6844'; g.fillRect(546, 740, 16, 3)
  pxCircle(563, 741, 4, '#a06a40')
      g.restore()
    }
  })
  def("ayun_shelf_topset", {
    clickable: true, say: '香炉别动，昨天刚点的',
    scope: 'generic',
    name: '架顶组 · 香炉/函套/盆栽', cat: '器物', tags: ["组合", "架顶"],
    w: 322, h: 44, base: 44, foot: [0,24,322,20], zLayer: 'low', fromRoom: 'ayun',
    fx(g, t, X, Y) {
      for (let k = 0; k < 3; k++) {
        const ph = (t / 42 + k * 22) % 70
        g.fillStyle = 'rgba(244,242,232,' + Math.max(0, 0.68 - ph / 140) + ')'
        g.fillRect(X + 26 + Math.sin((t / 500 + k * 9) / 7) * 5, Y + 8 - ph * 1.6, 6, 6)
      }
    },
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-37, -214)
  // 架顶:香炉 · 函套书 · 小盆栽
  g.fillStyle = '#6e675e'; g.fillRect(40, 222, 24, 13)
  g.fillStyle = '#3a2c20'
  g.fillRect(37, 233, 30, 3); g.fillRect(43, 216, 3, 7); g.fillRect(58, 216, 3, 7)
  g.fillStyle = '#2c5a8c'; g.fillRect(136, 222, 36, 13)
  g.fillStyle = '#3a2c20'; g.fillRect(136, 222, 36, 2)
  g.fillStyle = '#e8d8a0'; g.fillRect(140, 225, 3, 9); g.fillRect(150, 225, 3, 9); g.fillRect(160, 225, 3, 9)
  g.fillStyle = '#c04838'; g.fillRect(184, 224, 14, 11)
  g.fillStyle = '#5a8a44'; g.fillRect(187, 214, 4, 10); g.fillRect(192, 217, 4, 7)
      g.restore()
    }
  })
  def("ayun_furnace_alch", {
    clickable: true, say: '炼丹？炼过，炸过两次',
    scope: 'character',
    name: '丹炉 · 炼丹', cat: '灯火', tags: ["陶", "火", "烟"],
    w: 152, h: 172, base: 172, foot: [0,112,152,60], light:{x:76,y:60,r:70,color:'#e89040',flicker:0.8},zLayer: 'low', fromRoom: 'ayun',
    fx(g, t, X, Y) {
      // 炉口火光 + 上升青烟
      const q = g.createRadialGradient(X+76, Y+60, 2, X+76, Y+60, 46)
      q.addColorStop(0, 'rgba(232,144,64,' + (0.42 + 0.14*Math.sin(t/170)) + ')')
      q.addColorStop(1, 'rgba(232,144,64,0)')
      g.fillStyle = q; g.fillRect(X+30, Y+14, 92, 92)
      // 参数取自原房间那份烟:偏亮、粒子随上升变大,升得也更高
      for (let k = 0; k < 6; k++) {
        const ph = (t / 36 + k * 15) % 90
        g.fillStyle = 'rgba(244,242,232,' + Math.max(0, 0.82 - ph / 140) + ')'
        const sw = 7 + ph / 10
        g.fillRect(X + 68 + Math.sin((t / 450 + k * 14) / 9) * (6 + ph / 8), Y - 16 - ph * 2.2, sw, sw)
      }
    },
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-194, -858)
  // ═══════════ 7. 丹炉区:炉+风箱+火盆+柴堆 ═══════════
  pxCircle(232, 906, 38, 'rgba(50,35,18,0.25)')
  pxCircle(232, 894, 36, '#3a2c20')
  pxCircle(232, 894, 30, '#6e675e')
  pxRing(232, 894, 30, 6, '#82796e')
  pxRing(232, 894, 18, 3, '#4a453e')
  g.fillStyle = '#3a2c20'
  g.fillRect(206, 922, 10, 18); g.fillRect(248, 922, 10, 18); g.fillRect(227, 926, 10, 18)
  g.fillStyle = '#c04838'; g.fillRect(220, 886, 24, 7)
  g.fillStyle = '#ffd76a'; g.fillRect(227, 888, 10, 4)
  glow(232, 890, 30, 'rgba(255,150,80,0.15)')
      g.restore()
    }
  })
  def("ayun_bellows_set", {
    clickable: true, say: '拉两下火就旺，道理跟起课一样',
    scope: 'character',
    name: '风箱 + 炉台', cat: '器物', tags: ["木", "鼓风"],
    w: 384, h: 140, base: 140, foot: [0,80,384,60], zLayer: 'low', fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-160, -908)
  // 风箱
  g.fillStyle = '#3a2c20'; g.fillRect(286, 908, 56, 34)
  g.fillStyle = '#a06a40'; g.fillRect(290, 912, 48, 26)
  g.fillStyle = '#6e5236'; g.fillRect(290, 922, 48, 3)
  g.fillStyle = '#3a2c20'; g.fillRect(338, 917, 14, 6)
  // 火盆(炭红)
  pxCircle(180, 958, 20, '#3a2c20')
  pxCircle(180, 955, 17, '#6e675e')
  pxCircle(180, 953, 11, '#c04838')
  g.fillStyle = '#ffd76a'; g.fillRect(176, 950, 4, 3); g.fillRect(182, 953, 3, 2)
  glow(180, 952, 24, 'rgba(255,130,60,0.18)')
      g.restore()
    }
  })
  def("ayun_firewood", {
    clickable: true, say: '够烧到开春，再说吧',
    scope: 'generic',
    name: '柴堆', cat: '器物', tags: ["木", "燃料", "矮"],
    w: 80, h: 40, base: 40, foot: [0,0,80,40], zLayer: 'low', fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-316, -940)
  // 柴堆
  g.fillStyle = '#a06a40'
  g.fillRect(316, 954, 40, 6); g.fillRect(320, 947, 36, 6); g.fillRect(326, 940, 26, 6)
  g.fillStyle = '#7e5230'
  g.fillRect(316, 954, 6, 6); g.fillRect(320, 947, 6, 6); g.fillRect(326, 940, 6, 6)
      g.restore()
    }
  })
  def("ayun_door_frame", {
    clickable: true, say: '出门？看情况',
    scope: 'generic',
    name: '门 + 门槛', cat: '结构', tags: ["木", "出入口"],
    w: 484, h: 150, base: 150, foot: [212,120,272,30], zLayer: 'low', fromRoom: 'ayun',   // 拆出书与盒后内容只到 x484
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-186, -967)
  // ═══════════ 10. 门区 ═══════════
  g.fillStyle = '#3a2c20'; g.fillRect(292, 984, 136, 58)
  g.fillStyle = '#a87f48'; g.fillRect(296, 988, 128, 50)
  g.fillStyle = '#c9a26a'
  g.fillRect(305, 997, 110, 3); g.fillRect(305, 1024, 110, 3)
  // 两本书 + 两只红盒【已移出】—— 它们本来画在这里,跟门共用一个 foot、一句台词:
  // 点书弹的是「出门?看情况」,而门的 foot 只圈得住门槛(x212–484),
  // 书与盒(x524–666)一格没占,角色径直从它们身上走过去。
  // 现在各自成件:ayun_books_unread / ayun_gift_boxes,各自落地、各自能点、各自说话。
  // 同 §3.5「同一物体两份绘制」那次:水缸曾在这里被画第二遍,盖住独立的 ayun_water_vat,
  // 于是那件永远点不到、它的台词从来没人听过。
      g.restore()
    }
  })

  // 门口那两本书 —— 从 ayun_door_frame 里拆出来的。阿云缺「勤」,书搁在最显眼的地方,
  // 每天出门都路过,也就每天都没读。
  def("ayun_books_unread", {
    clickable: true, say: '师父让读的书',
    sayDeep: ['《壬学琐记》上下两册', '……去年就该读完', '搁门口是为了天天看见。看见归看见'],
    name: "没读的书 ×2", cat: "书卷", tags: ["师父给的", "搁着"],
    scope: "character", fromRoom: 'ayun',
    w: 64, h: 54, base: 54, foot: [0, 40, 64, 14], zLayer: 'low',
    draw(g) {
      g.fillStyle = '#3a2c20'; g.fillRect(0, 0, 14, 27); g.fillRect(18, 0, 14, 27)
      g.fillStyle = '#5a7a96'; g.fillRect(2, 3, 10, 13); g.fillRect(20, 3, 10, 13)
    }
  })

  def("ayun_gift_boxes", {
    clickable: true, say: '两只红漆盒',
    sayDeep: ['谢仪。算准了的人送来的', '……我没拆', '拆了就得记着这份人情。我记不住'],
    name: "红漆盒 ×2", cat: "杂物", tags: ["谢仪", "没拆"],
    scope: "character", fromRoom: 'ayun',
    w: 54, h: 40, base: 40, foot: [0, 28, 54, 12], zLayer: 'low',
    draw(g) {
      g.fillStyle = '#c04838'; g.fillRect(0, 0, 12, 20); g.fillRect(15, 0, 12, 20)
    }
  })
  def("ayun_crates_stack", {
    clickable: true, say: '里头什么都有，就是找不着',
    occludeH: 96,   // 两只木箱叠放约齐胸
    scope: 'generic',
    name: '储物箱 ×2 叠放', cat: '收纳', tags: ["木", "铜扣", "可叠"],
    w: 148, h: 176, base: 176, foot: [0,116,148,60], fromRoom: 'ayun',
    zLayer: 'low',   // 两只木箱叠放约 0.8m
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-596, -916)
  // 储物箱×2(叠放 铜扣)
  g.fillStyle = '#3a2c20'; g.fillRect(596, 952, 74, 52)
  g.fillStyle = '#8a5c34'; g.fillRect(600, 956, 66, 44)
  g.fillStyle = '#6e4a28'; g.fillRect(600, 974, 66, 4)
  g.fillStyle = '#e8b23d'; g.fillRect(628, 968, 10, 12)
  g.fillStyle = '#3a2c20'; g.fillRect(612, 916, 52, 40)
  g.fillStyle = '#a06a40'; g.fillRect(616, 920, 44, 32)
  g.fillStyle = '#e8b23d'; g.fillRect(632, 930, 9, 10)
  // 酒坛×2(红纸封)
  function jar(x, y, r) {
    pxCircle(x, y, r, '#3a2c20')
    pxCircle(x, y, r - 3, '#754c28')
    pxRing(x, y, r - 3, 4, '#8a5c34')
    g.fillStyle = '#3a2c20'; g.fillRect(x - 8, y - r - 6, 16, 8)
    g.fillStyle = '#c04838'; g.fillRect(x - 6, y - r - 4, 12, 5)
  }
  jar(100, 1000, 26)
  jar(146, 1014, 20)
      g.restore()
    }
  })
  def("ayun_broom", {
    clickable: true, say: '扫过的，上个月',
    scope: 'generic',
    name: '扫帚', cat: '器物', tags: ["竹", "靠墙", "细长"],
    w: 52, h: 196, base: 196, foot: [0,166,52,30], fromRoom: 'ayun',
    zLayer: 'sort',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-684, -860)
  // 扫帚
  g.fillStyle = '#a06a40'; g.fillRect(694, 860, 6, 76)
  g.fillStyle = '#c9a26a'; g.fillRect(684, 928, 26, 30)
  g.fillStyle = '#a87f48'
  g.fillRect(688, 932, 3, 22); g.fillRect(696, 932, 3, 22); g.fillRect(704, 932, 3, 22)
      g.restore()
    }
  })
  def("ayun_censer_floor", {
    clickable: true, say: '香是给客人点的，不是给神',
    light: { x: 108, y: 34, r: 46, color: '#e8b23d', flicker: 0.25 },
    scope: 'character',
    name: '立式香炉 + 散卷', cat: '器物', tags: ["铜", "烟", "高"],
    w: 226, h: 602, base: 602, foot: [0,542,226,60], fromRoom: 'ayun',
    zLayer: 'low',   // 立式香炉约 1m,矮于人
    fx(g, t, X, Y) {
      for (let k = 0; k < 2; k++)
        for (let n = 0; n < 4; n++) {
          const ph = (t / 20 + n * 44 + k * 30) % 190
          g.fillStyle = 'rgba(214,208,198,' + (0.52 - ph / 480) + ')'
          g.fillRect(X + 96 + k * 26 + Math.sin((ph + n * 24) / 32) * 9, Y + 30 - ph * 0.7, 8, 8)
        }
    },
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-398, -621)
  // 散卷+香炉立式
  g.fillStyle = '#e8d8a0'; g.fillRect(400, 908, 34, 12)
  g.fillStyle = '#c04838'; g.fillRect(400, 908, 6, 12)
  g.fillStyle = '#3a2c20'; g.fillRect(398, 906, 38, 2); g.fillRect(398, 920, 38, 2)
  pxCircle(494, 646, 17, '#3a2c20')
  pxCircle(494, 643, 14, '#82796e')
  g.fillStyle = '#3a2c20'
  g.fillRect(482, 658, 6, 12); g.fillRect(502, 658, 6, 12)
  g.fillStyle = '#c9a26a'; g.fillRect(490, 624, 2, 14); g.fillRect(496, 621, 2, 17)
      g.restore()
    }
  })

  def("ayun_plaque_hall", {
    clickable: true, say: '贫道亲笔……写了三天', sayDeep: '师父说贫道缺的不是本事……他说对了',
    scope: 'character',
    name: '匾额 · 六壬堂', cat: '墙面', tags: ["木", "金字", "招牌"],
    w: 312, h: 116, base: 0, foot: [0,116,312,0], wall:true,fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-282, -46)
  // 匾「六壬堂」
  g.fillStyle = '#3a2c20'; g.fillRect(282, 46, 156, 58)
  g.fillStyle = '#2a2018'; g.fillRect(288, 52, 144, 46)
  g.strokeStyle = '#e8b23d'; g.lineWidth = 2
  g.strokeRect(292, 56, 136, 38)
  g.fillStyle = '#e8b23d'
  // 匾字改用【书法字系统】:笔画骨架 + 粗细包络,而非宋体像素化。
  // 切到 1:1 变换,否则 glyph sprite 会被外层 scale(2,2) 放大糊掉。
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0)
  if (globalThis.CALLI) {
    const fs = 58, gp = 10, tw = fs * 3 + gp * 2
    globalThis.CALLI(g, '六壬堂', (312 - tw) / 2, (116 - fs) / 2 - 1, fs, '#e8b23d', { weight: 1.5, gap: gp })
  }
  g.restore()
  g.fillStyle = '#c04838'; g.fillRect(424, 88, 8, 8)   // 落款印
      g.restore()
    }
  })
  def("ayun_scroll_starchart", {
    clickable: true, say: '天盘星图，越看越困，贫道承认',
    scope: 'character',
    name: '挂轴 · 天盘星图', cat: '墙面', tags: ["纸", "术数", "可换字"],
    w: 168, h: 198, base: 0, foot: [0,198,168,0], wall:true,fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-320, -112)
  // 挂轴(匾下 · 天盘星图)
  g.fillStyle = '#3a2c20'; g.fillRect(320, 112, 84, 6)
  g.fillStyle = '#e8d8a0'; g.fillRect(324, 118, 76, 88)
  g.fillStyle = '#c9a26a'; g.fillRect(320, 206, 84, 5)
  g.fillStyle = '#3a2c20'
  g.fillRect(324, 118, 2, 88); g.fillRect(398, 118, 2, 88)
  pxCircle(362, 152, 22, '#2c3a54')
  g.fillStyle = '#ffd76a'
  for (let a = 0; a < 12; a++) {
    const px2 = 362 + Math.cos(a * 0.5236) * 15, py = 152 + Math.sin(a * 0.5236) * 15
    g.fillRect(px2 - 1, py - 1, 3, 3)
  }
  g.fillStyle = '#c04838'
  g.fillRect(344, 184, 36, 5); g.fillRect(350, 194, 24, 5)
      g.restore()
    }
  })
  def("ayun_wall_mirror_sword", {
    clickable: true, say: '剑？摆着的，真出事贫道跑得比谁都快',
    scope: 'character',
    name: '铜镜 + 剑架桃木剑', cat: '墙面', tags: ["铜", "木", "法器", "组合件"],
    w: 814, h: 104, base: 0, foot: [0,104,814,0], wall:true,composite:true,fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-172, -104)
  // 铜镜(左)· 剑架+桃木剑(右)
  pxCircle(198, 130, 26, '#3a2c20')
  pxCircle(198, 130, 22, '#c9a26a')
  pxCircle(198, 128, 16, '#e8d8b8')
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(188, 118, 8, 3)
  g.fillStyle = '#3a2c20'
  g.fillRect(496, 120, 76, 4); g.fillRect(500, 124, 5, 12); g.fillRect(562, 124, 5, 12)
  g.fillStyle = '#a05838'; g.fillRect(492, 108, 84, 6)       // 桃木剑
  g.fillStyle = '#c87858'; g.fillRect(492, 108, 84, 2)
  g.fillStyle = '#3a2c20'; g.fillRect(486, 106, 8, 10)
  g.fillStyle = '#e8b23d'; g.fillRect(572, 107, 6, 8)
  g.fillStyle = '#c04838'; g.fillRect(576, 114, 3, 10)       // 剑穗
      g.restore()
    }
  })
  def("ayun_wall_daoist_set", {
    clickable: true, say: '师父留下的，拂尘他忘带走了',
    light: { x: 60, y: 150, r: 120, color: '#ffd76a', flicker: 0.2 },
    scope: 'character',
    name: '墙面组 · 灯笼/拂尘/斗笠/箫/晾药', cat: '墙面', tags: ["组合件", "道门", "可拆"],
    w: 1414, h: 296, base: 0, foot: [0,296,1414,0], wall:true,composite:true,fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(2, -46)
  // 灯笼×2 · 拂尘 · 斗笠 · 箫 · 晾药束×3 · 壁烛台×2
  function lantern2(x) {
    g.fillStyle = '#3a2c20'; g.fillRect(x + 9, 40, 3, 18)
    g.fillStyle = '#c04838'; g.fillRect(x, 58, 22, 28)
    g.fillStyle = '#e86a50'; g.fillRect(x + 4, 62, 14, 20)
    g.fillStyle = '#ffd76a'; g.fillRect(x + 8, 66, 6, 12)
    g.fillStyle = '#3a2c20'
    g.fillRect(x, 58, 22, 3); g.fillRect(x, 83, 22, 3)
    g.fillStyle = '#ffd76a'; g.fillRect(x + 8, 86, 5, 8)
    glow(x + 11, 72, 26, 'rgba(255,215,106,0.16)')
  }
  lantern2(8); lantern2(690)
  g.fillStyle = '#a06a40'; g.fillRect(700, 130, 5, 42)
  g.fillStyle = '#f6efdc'
  for (let k = 0; k < 7; k++) g.fillRect(694 + k * 3, 172, 2, 26 + (k % 2) * 7)
  pxCircle(20, 172, 22, '#3a2c20')
  pxCircle(20, 172, 19, '#c9a26a')
  pxCircle(20, 172, 8, '#a87f48')
  g.fillStyle = '#5a8a44'; g.fillRect(530, 46, 4, 48)
  g.fillStyle = '#3a2c20'
  g.fillRect(530, 56, 4, 2); g.fillRect(530, 68, 4, 2); g.fillRect(530, 80, 4, 2)
  // 晾药束(左墙 · 倒挂)
  function herb(x, col) {
    g.fillStyle = '#3a2c20'; g.fillRect(x + 3, 140, 1, 8)
    g.fillStyle = col
    g.fillRect(x, 148, 7, 14); g.fillRect(x + 1, 162, 5, 4)
    g.fillStyle = '#e8b23d'; g.fillRect(x + 1, 146, 5, 3)
  }
  herb(142, '#5a8a44'); herb(158, '#4a7c3e'); herb(174, '#6a9a52')
  // 壁烛台×2(带光晕)
  function sconce(x) {
    g.fillStyle = '#3a2c20'; g.fillRect(x, 158, 5, 20)
    g.fillStyle = '#c9a26a'; g.fillRect(x - 4, 176, 13, 5)
    g.fillStyle = '#f6efdc'; g.fillRect(x - 1, 148, 7, 12)
    g.fillStyle = '#ffd76a'; g.fillRect(x, 140, 5, 9)
    glow(x + 2, 144, 22, 'rgba(255,215,106,0.18)')
  }
  sconce(226); sconce(490)
      g.restore()
    }
  })
  def("ayun_water_vat", {
    clickable: true, say: '接雨水的，天给的水，贫道乐得省事',
    scope: 'generic',
    name: '水缸 + 瓢', cat: '器物', tags: ["陶", "水", "生活"],
    w: 144, h: 144, base: 144, foot: [0,104,144,40], zLayer: 'low', fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.translate(-186, -970)
  // 水缸+瓢
  pxCircle(222, 1006, 36, '#3a2c20')
  pxCircle(222, 1002, 32, '#5a6a88')
  pxCircle(222, 998, 24, '#2c3a54')
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(208, 990, 16, 3)
      g.restore()
    }
  })
  def("ayun_tv_stand", {
    clickable: true, say: '贫道也是要看番的',
    scope: 'generic',
    name: '电视柜', cat: '桌案', tags: ["木", "现代"],
    w: 152, h: 36, base: 36, foot: [0,16,152,20], zLayer: 'low', fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.setTransform(1,0,0,1,-1128,-1118)
  // 电视柜
  g.fillStyle = '#3a2c20'; g.fillRect(1128, 1118, 152, 36)
  g.fillStyle = '#8a6844'; g.fillRect(1132, 1122, 144, 28)
  g.fillStyle = '#6e5236'; g.fillRect(1132, 1134, 144, 3)
  g.fillStyle = '#e8b23d'; g.fillRect(1158, 1140, 5, 5); g.fillRect(1238, 1140, 5, 5)
      g.restore()
    }
  })
  def("ayun_tv_flat", {
    // 有状态家具:他打游戏时屏幕亮着，不打时是待机的暗屏。
    // 状态本来就在(room.state.gaming)，只是此前没让 sprite 跟着变。
    variant(state) { return state.gaming ? 'on' : 'idle' },
    say: '看新闻用的，真的',
    scope: 'generic',
    name: '电视 · 平板', cat: '电器', tags: ["现代", "屏幕", "可亮屏"],
    w: 130, h: 96, base: 96, foot: [0,76,130,20], clickable:true,light:{x:130,y:80,r:70,color:'#7ab8e8',flicker:'screen'},fromRoom: 'ayun',
    anchors: { port: [110, 84] },      // 手柄线的插口,供 drawLink 引用
    fx(g, t, X, Y, o, room) {
      const st = (room && room.state) || {}
      if (!st.gaming) {
        // 屏幕待机微闪
        g.fillStyle = 'rgba(122,184,232,' + (0.12 + 0.10*Math.sin(t/95)) + ')'
        g.fillRect(X+10, Y+10, 110, 66)
        return
      }
      // 开机画面:滚动的小人 + 进度条 + 偶发白闪
      const f = (t / 50) | 0
      g.fillStyle = '#2a4a7a'; g.fillRect(X+8, Y+8, 114, 68)
      g.fillStyle = '#5a8a44'; g.fillRect(X+8, Y+56, 114, 20)
      g.fillStyle = '#e8b23d'; g.fillRect(X + 20 + ((f * 3) % 90), Y+42, 10, 10)
      g.fillStyle = '#f6efdc'; g.fillRect(X+30, Y+20, 8, 8)
      g.fillStyle = '#c04838'; g.fillRect(X+12, Y+12, 40 + (f % 20), 4)
      if ((f >> 3) % 4 === 0) {
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(X+8, Y+8, 114, 68)
      }
      g.fillStyle = '#4a9ae8'; g.fillRect(X+62, Y+82, 4, 3)
    },
    zLayer: 'sort',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.setTransform(1,0,0,1,-1138,-1026)
  // 电视(黑框 · 屏幕朝南 · 暗屏待机)
  g.fillStyle = '#1a1a20'; g.fillRect(1138, 1026, 130, 92)
  g.fillStyle = '#2a2a32'; g.fillRect(1146, 1034, 114, 68)
  g.fillStyle = 'rgba(255,255,255,0.06)'
  g.beginPath(); g.moveTo(1150, 1034); g.lineTo(1178, 1034); g.lineTo(1156, 1102); g.lineTo(1146, 1102); g.fill()
  g.fillStyle = '#5a8a44'; g.fillRect(1200, 1108, 4, 3)
  g.fillStyle = '#1a1a20'; g.fillRect(1193, 1118, 20, 4)
      g.restore()
    }
  })
  def("ayun_console_ps5", {
    say: '就打一把，就一把',
    scope: 'character',
    name: '游戏主机 + 手柄', cat: '电器', tags: ["现代", "爱好", "宅"],
    w: 116, h: 50, base: 50, foot: [0,30,116,20], clickable:true,fromRoom: 'ayun',
    zLayer: 'sort',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.setTransform(1,0,0,1,-1146,-1072)
  // PS5 主机(柜面右 · 显眼)
  g.fillStyle = '#3a2c20'; g.fillRect(1236, 1072, 26, 50)
  g.fillStyle = '#f6efdc'; g.fillRect(1239, 1075, 9, 44)
  g.fillStyle = '#e0d8c4'; g.fillRect(1249, 1075, 10, 44)
  g.fillStyle = '#1a1a20'; g.fillRect(1248, 1075, 2, 44)
  g.fillStyle = '#4a9ae8'; g.fillRect(1248, 1078, 2, 12)
  // 手柄(柜面左)
  g.fillStyle = '#3a2c20'; g.fillRect(1146, 1092, 26, 14)
  g.fillStyle = '#f6efdc'; g.fillRect(1148, 1094, 9, 10); g.fillRect(1161, 1094, 9, 10)
  g.fillStyle = '#4a9ae8'; g.fillRect(1157, 1096, 4, 3)
  contact(1132, 1152, 144)
      g.restore()
    }
  })
  def("ayun_poster_idol", {
    clickable: true, say: '星海铃……你懂什么', sayDeep: '她唱的时候，贫道不困',
    fx(g, t, X, Y, inst) {
      // 纸张感:下 40% 逐行横向摆动,越接近下缘幅度越大(上缘被钉住)
      const cv = inst.cv, h = cv.height, w = cv.width, top = Math.round(h * 0.6)
      g.clearRect(X, Y + top, w, h - top)
      for (let i = top; i < h; i++) {
        const u = (i - top) / (h - top)
        const dx = Math.sin(t / 900 + i * 0.06 + X) * 2.2 * u * u
        g.drawImage(cv, 0, i, w, 1, X + dx, Y + i, w, 1)
      }
    },
    say: '星海铃新卡池，贫道算过了',
    scope: 'character',
    name: '海报 · 虚拟歌姬', cat: '墙面', tags: ["纸", "爱好", "宅", "角色识别"],
    w: 122, h: 220, base: 0, foot: [0,220,122,0], wall:true,clickable:true,fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.setTransform(1,0,0,1,-944,-116)
  // 动漫海报 A(粉发美少女 · 挂匾额右侧)
  g.fillStyle = '#3a2c20'; g.fillRect(944, 116, 122, 220)
  g.fillStyle = '#f6efdc'; g.fillRect(950, 122, 110, 208)
  g.fillStyle = '#ffd8e4'; g.fillRect(950, 122, 110, 40)
  pxCircle(1005, 208, 26, '#e87a98')
  pxCircle(1005, 214, 20, '#f0c8a0')
  g.fillStyle = '#e87a98'
  g.fillRect(966, 196, 14, 66); g.fillRect(1030, 196, 14, 66)
  g.fillStyle = '#3a2c20'
  g.fillRect(996, 212, 5, 6); g.fillRect(1014, 212, 5, 6)
  g.fillStyle = '#c8384a'; g.fillRect(1002, 224, 8, 3)
  g.fillStyle = '#4a6a88'; g.fillRect(986, 240, 40, 48)
  g.fillStyle = '#f6efdc'; g.fillRect(986, 240, 40, 8)
  g.fillStyle = '#f0c8a0'; g.fillRect(1026, 248, 10, 20)
  g.fillStyle = '#e87a98'; g.fillRect(956, 300, 98, 20)
  g.fillStyle = '#f6efdc'
  g.fillRect(964, 306, 20, 8); g.fillRect(990, 306, 26, 8); g.fillRect(1022, 306, 24, 8)
      g.restore()
    }
  })
  def("ayun_poster_mecha", {
    fx(g, t, X, Y, inst) {
      // 纸张感:下 40% 逐行横向摆动,越接近下缘幅度越大(上缘被钉住)
      const cv = inst.cv, h = cv.height, w = cv.width, top = Math.round(h * 0.6)
      g.clearRect(X, Y + top, w, h - top)
      for (let i = top; i < h; i++) {
        const u = (i - top) / (h - top)
        const dx = Math.sin(t / 900 + i * 0.06 + X) * 1.8 * u * u
        g.drawImage(cv, 0, i, w, 1, X + dx, Y + i, w, 1)
      }
    },
    clickable: true, say: '这张是凑单买的',
    scope: 'character',
    name: '海报 · 机甲', cat: '墙面', tags: ["纸", "爱好", "宅"],
    w: 122, h: 210, base: 0, foot: [0,210,122,0], wall:true,fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.setTransform(1,0,0,1,-1174,-106)
  // 动漫海报 B(机甲 · 床头上方)
  g.fillStyle = '#3a2c20'; g.fillRect(1174, 106, 122, 210)
  g.fillStyle = '#2a3a5a'; g.fillRect(1180, 112, 110, 198)
  g.fillStyle = '#f6efdc'
  for (let k = 0; k < 8; k++) g.fillRect(1186 + (k * 37) % 100, 118 + (k * 53) % 60, 3, 3)
  g.fillStyle = '#9a938a'; g.fillRect(1216, 170, 38, 44)
  g.fillStyle = '#c8c4bc'; g.fillRect(1222, 176, 26, 32)
  g.fillStyle = '#c04838'; g.fillRect(1228, 184, 6, 6); g.fillRect(1238, 184, 6, 6)
  g.fillStyle = '#e8b23d'
  g.beginPath(); g.moveTo(1216, 170); g.lineTo(1204, 148); g.lineTo(1222, 164); g.fill()
  g.beginPath(); g.moveTo(1254, 170); g.lineTo(1266, 148); g.lineTo(1248, 164); g.fill()
  g.fillStyle = '#9a938a'
  g.fillRect(1208, 214, 16, 40); g.fillRect(1246, 214, 16, 40)
  g.fillRect(1198, 178, 14, 30); g.fillRect(1258, 178, 14, 30)
  g.fillStyle = '#e8b23d'; g.fillRect(1188, 280, 44, 18)
  g.fillStyle = '#2a3a5a'; g.fillRect(1194, 285, 32, 8)
      g.restore()
    }
  })
  def("ayun_body_pillow", {
    say: '……那是护法用的',
    scope: 'character',
    name: '等身抱枕', cat: '坐卧', tags: ["布", "爱好", "宅", "梗"],
    w: 70, h: 216, base: 216, foot: [0,196,70,20], clickable:true,fromRoom: 'ayun',
    zLayer: 'sort',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.setTransform(1,0,0,1,-1140,-572)
  // 痛枕(dakimakura · 床上 · 最大笑点)
  g.fillStyle = '#3a2c20'; g.fillRect(1140, 572, 70, 216)
  g.fillStyle = '#ffd8e4'; g.fillRect(1144, 576, 62, 208)
  pxCircle(1175, 618, 22, '#e87a98')
  pxCircle(1175, 624, 16, '#f0c8a0')
  g.fillStyle = '#e87a98'
  g.fillRect(1148, 610, 10, 52); g.fillRect(1194, 610, 10, 52)
  g.fillStyle = '#3a2c20'
  g.fillRect(1168, 622, 4, 5); g.fillRect(1182, 622, 4, 5)
  g.fillStyle = '#4a6a88'; g.fillRect(1158, 648, 34, 60)
  g.fillStyle = '#f6efdc'; g.fillRect(1158, 648, 34, 7)
  g.fillStyle = '#f0c8a0'
  g.fillRect(1160, 708, 12, 40); g.fillRect(1178, 708, 12, 40)
  g.fillStyle = '#c8384a'; g.fillRect(1160, 748, 12, 10); g.fillRect(1178, 748, 12, 10)
      g.restore()
    }
  })
  def("ayun_handheld_console", {
    clickable: true, say: '就一把',
    scope: 'character',
    name: '掌机', cat: '电器', tags: ["现代", "爱好", "宅"],
    w: 74, h: 38, base: 38, foot: [0,18,74,20], fromRoom: 'ayun',
    zLayer: 'sort',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.setTransform(1,0,0,1,-1282,-684)
  // 掌机(床上 · 粉蓝 joycon)
  g.fillStyle = '#3a2c20'; g.fillRect(1282, 684, 74, 38)
  g.fillStyle = '#1a1a20'; g.fillRect(1300, 688, 38, 30)
  g.fillStyle = '#8ad0e8'; g.fillRect(1304, 692, 30, 22)
  g.fillStyle = '#e87a98'; g.fillRect(1286, 688, 12, 30)
  g.fillStyle = '#4a9ae8'; g.fillRect(1340, 688, 12, 30)
      g.restore()
    }
  })
  def("ayun_figure_shelf", {
    clickable: true, say: '……摆得比法器整齐，贫道知道',
    scope: 'character',
    name: '手办展示架 · 三层 + 扭蛋', cat: '收纳', tags: ["木", "爱好", "宅", "摆得比法器整齐"],
    w: 334, h: 178, base: 178, foot: [0,158,334,20], fromRoom: 'ayun',
    zLayer: 'sort',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.setTransform(1,0,0,1,-1094,-1150)
  // 手办展示架(电视右侧 · 三层 + 扭蛋)
  contact(1310, 1324, 110)
  g.fillStyle = '#3a2c20'; g.fillRect(1306, 1150, 122, 178)
  g.fillStyle = '#8a6844'; g.fillRect(1312, 1156, 110, 166)
  g.fillStyle = '#6e5236'; g.fillRect(1312, 1206, 110, 5); g.fillRect(1312, 1262, 110, 5)
  // 上层:粉双马尾手办 + 蓝短发手办
  for (const [fx, hc, bc] of [[1330, '#e87a98', '#f6efdc'], [1380, '#4a9ae8', '#3a3a40']]) {
    dEllipse(fx + 8, 1200, 14, 5, '#f6efdc')
    pxCircle(fx + 8, 1172, 9, hc)
    g.fillStyle = '#f0c8a0'; g.fillRect(fx + 4, 1176, 9, 6)
    g.fillStyle = bc; g.fillRect(fx + 2, 1182, 13, 14)
  }
  // 中层:金甲武将手办
  dEllipse(1356, 1256, 16, 5, '#f6efdc')
  pxCircle(1356, 1226, 10, '#e8b23d')
  g.fillStyle = '#c99426'; g.fillRect(1348, 1234, 17, 18)
  g.fillStyle = '#c04838'; g.fillRect(1344, 1236, 5, 12); g.fillRect(1364, 1236, 5, 12)
  // 底层:扭蛋胶囊×4
  for (let k = 0; k < 4; k++) {
    const gx = 1322 + k * 26
    g.fillStyle = ['#e87a98', '#4a9ae8', '#5a9438', '#e8b23d'][k]
    pxCircle(gx, 1298, 10, ['#e87a98', '#4a9ae8', '#5a9438', '#e8b23d'][k])
    g.fillStyle = '#f6efdc'; g.fillRect(gx - 10, 1298, 20, 10)
  }
  // 漫画堆(蒲团左)
  contact(1072, 1372, 90)
  for (let k = 0; k < 5; k++) {
    g.fillStyle = '#3a2c20'; g.fillRect(1068 + (k % 2) * 6, 1358 - k * 16, 92, 16)
    g.fillStyle = ['#e87a98', '#4a9ae8', '#e8b23d', '#5a9438', '#c04838'][k]
    g.fillRect(1072 + (k % 2) * 6, 1361 - k * 16, 84, 11)
    g.fillStyle = '#f6efdc'; g.fillRect(1082 + (k % 2) * 6, 1363 - k * 16, 22, 7)
  }
  pxCircle(1106, 1282, 12, '#e87a98'); pxCircle(1106, 1285, 8, '#f0c8a0')
      g.restore()
    }
  })
  def("ayun_instant_meal", {
    clickable: true, say: '凌晨的伙食，别声张',
    scope: 'generic',
    name: '泡面 + 可乐', cat: '器物', tags: ["生活", "宅", "刚吃完"],
    w: 80, h: 72, base: 72, foot: [0,52,80,20], zLayer: 'low', fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3);g.fillStyle='rgba(30,20,10,0.13)';g.fillRect(x-4,y+3,w+8,4)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell
      g.save(); g.setTransform(1,0,0,1,-1258,-1272)
  // 泡面 + 可乐(蒲团右 · 宅男伙食)
  contact(1262, 1344, 80)
  g.fillStyle = '#f6efdc'; g.fillRect(1258, 1296, 40, 48)
  g.fillStyle = '#c04838'; g.fillRect(1258, 1290, 40, 10)
  g.fillStyle = '#e8b23d'; g.fillRect(1264, 1312, 28, 12)
  g.fillStyle = '#9a938a'; g.fillRect(1292, 1272, 5, 26)
  g.fillStyle = '#c04838'; g.fillRect(1312, 1298, 26, 46)
  g.fillStyle = '#f6efdc'; g.fillRect(1312, 1314, 26, 12)
  g.fillStyle = '#8a8578'; g.fillRect(1314, 1292, 22, 7)
      g.restore()
    }
  })

  /* ────────── 墙面开口 / 装饰(手工提取:原代码用循环,自动包围盒不适用)────────── */
  def("ayun_window_lattice", {
    clickable: true, say: '月亮挺好……就是照得人睡不着',
    scope: 'generic', fromRoom: 'ayun',
    name: '格窗 · 十字棂 + 夜空', cat: '墙面', tags: ['木','夜','月','窗台盆栽','纸鹤'], wall: true,
    w: 236, h: 288, base: 0, foot: [0, 288, 236, 0],
    light: { x: 160, y: 40, r: 150, color: '#8ab4c8', flicker: 0 },
    draw(g) {
      g.save(); g.translate(6, -56)
      g.fillStyle = '#3a2c20'; g.fillRect(0, 56, 106, 132)
      g.fillStyle = '#2c3a54'; g.fillRect(6, 62, 94, 120)
      g.fillStyle = '#f6efdc'
      g.fillRect(22, 78, 4, 4); g.fillRect(66, 100, 4, 4); g.fillRect(42, 140, 4, 3); g.fillRect(80, 158, 3, 3)
      g.fillStyle = '#ffd76a'; g.fillRect(74, 74, 9, 9)
      g.fillStyle = '#3a2c20'
      g.fillRect(6, 118, 94, 4)
      g.fillRect(34, 62, 4, 120); g.fillRect(66, 62, 4, 120)
      g.fillStyle = '#8a6844'; g.fillRect(-6, 188, 118, 12)
      g.fillStyle = '#3a2c20'; g.fillRect(-6, 197, 118, 3)
      g.fillStyle = '#c04838'; g.fillRect(12, 172, 18, 15)
      g.fillStyle = '#5a8a44'
      g.fillRect(17, 160, 4, 12); g.fillRect(23, 163, 4, 9); g.fillRect(11, 165, 4, 7)
      g.fillStyle = '#f6efdc'
      g.fillRect(84, 176, 8, 5); g.fillRect(87, 172, 3, 4); g.fillRect(92, 178, 4, 2)
      g.restore()
    }
  })

  def("ayun_couplet_red", {
    clickable: true, say: '自己写的，别看落款',
    scope: 'generic', fromRoom: 'ayun',
    name: '对联 · 单幅', cat: '墙面', tags: ['纸','红','金','成对'], wall: true, repeat: true,
    w: 76, h: 204, base: 0, foot: [0, 204, 76, 0],
    draw(g) {
      g.save(); g.translate(2, -110)
      g.fillStyle = '#3a2c20'; g.fillRect(-2, 110, 36, 100)
      g.fillStyle = '#c04838'; g.fillRect(0, 112, 32, 96)
      g.fillStyle = '#e8b23d'
      for (let k = 0; k < 4; k++) g.fillRect(10, 120 + k * 22, 12, 12)
      g.restore()
    }
  })


  def("ayun_birdcage", {
    say: '它自己不肯走',
    scope: 'character',
    name: '鸟笼 · 内画眉', cat: '器物', tags: ["竹", "鸟", "挂梁"],
    w: 34, h: 74, base: 0, foot: [0,73,34,0], wall:true,clickable:true,fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell, pxC=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      g.save(); g.setTransform(1,0,0,1,-1030,-78)
  // 鸟笼(挂梁下 · 内画眉)
  g.fillStyle = '#3a2c20'
  g.fillRect(1046, 78, 2, 26)
  g.fillRect(1030, 104, 34, 3)
  for (let k = 0; k < 6; k++) g.fillRect(1032 + k * 6, 107, 1, 40)
  g.fillRect(1030, 147, 34, 4)
  g.fillRect(1044, 100, 6, 4)
  g.fillStyle = '#c9a26a'                                       // 画眉
  g.fillRect(1040, 128, 10, 6); g.fillRect(1048, 124, 5, 5)
  g.fillStyle = '#3a2c20'; g.fillRect(1051, 125, 1, 1)
  g.fillStyle = '#e8b23d'; g.fillRect(1053, 126, 3, 1)
      g.restore()
    }
  })
  def("ayun_windchime", {
    clickable: true, say: '响得好听，就是吵醒过贫道',
    scope: 'generic',
    name: '风铃', cat: '器物', tags: ["铜", "声", "挂墙"],
    w: 14, h: 50, base: 0, foot: [0,49,13,0], wall:true,fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell, pxC=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      g.save(); g.setTransform(1,0,0,1,-1116,-84)
  // 风铃(右窗左)
  g.fillStyle = '#3a2c20'; g.fillRect(1122, 84, 1, 18)
  g.fillStyle = '#c9a26a'
  g.fillRect(1116, 102, 13, 4); g.fillRect(1118, 106, 9, 8)
  g.fillStyle = '#3a2c20'; g.fillRect(1122, 114, 1, 10)
  g.fillStyle = '#e8d8a0'; g.fillRect(1119, 124, 7, 9)
      g.restore()
    }
  })
  def("ayun_cloak_hook", {
    scope: 'generic',
    name: '斗篷挂钩 + 蓑衣', cat: '墙面', tags: ["布", "草", "挂墙"],
    w: 42, h: 60, base: 0, foot: [0,59,42,0], wall:true,fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell, pxC=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      g.save(); g.setTransform(1,0,0,1,-1314,-300)
  // 斗篷挂钩 + 蓑斗篷(右墙)
  g.fillStyle = '#3a2c20'; g.fillRect(1332, 300, 5, 5)
  g.fillStyle = '#8a7a5a'
  g.fillRect(1318, 305, 34, 8); g.fillRect(1314, 313, 42, 34); g.fillRect(1320, 347, 30, 12)
  g.fillStyle = '#6e6248'
  for (let k = 0; k < 4; k++) g.fillRect(1318 + k * 9, 313, 1, 34)
      g.restore()
    }
  })
  def("ayun_divine_sticks", {
    clickable: true, say: '给别人起课用的，自己的？不起', sayDeep: '不给自己起……怕真算准了',
    scope: 'character',
    name: '卦筹散棍 ×5', cat: '器物', tags: ["竹", "法器", "桌面"],
    w: 50, h: 30, base: 30, foot: [0,18,50,12], zLayer:'low',fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell, pxC=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      g.save(); g.setTransform(1,0,0,1,-802,-1149)
  // 卦筹散棍(桌面 · 5 根)
  g.fillStyle = '#e8d8a0'
  g.fillRect(806, 1156, 34, 3); g.fillRect(812, 1163, 34, 3)
  g.fillRect(802, 1170, 30, 3); g.fillRect(818, 1149, 26, 3); g.fillRect(824, 1176, 28, 3)
  g.fillStyle = 'rgba(58,44,32,0.6)'
  g.fillRect(806, 1156, 34, 1); g.fillRect(812, 1163, 34, 1); g.fillRect(802, 1170, 30, 1)
      g.restore()
    }
  })
  def("ayun_fire_tongs", {
    clickable: true, say: '夹炭的，烫过手，两次',
    scope: 'generic',
    name: '火钳 + 炭篓', cat: '器物', tags: ["铁", "竹", "炉旁"],
    w: 70, h: 44, base: 44, foot: [0,32,70,12], zLayer:'low',fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell, pxC=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      g.save(); g.setTransform(1,0,0,1,-292,-1934)
  // 火钳 + 炭篓(火盆旁)
  g.fillStyle = '#4a453e'
  g.fillRect(292, 1938, 3, 34); g.fillRect(300, 1936, 3, 36)
  g.fillRect(292, 1934, 11, 4)
  g.fillStyle = '#3a2c20'; g.fillRect(322, 1948, 40, 30)
  g.fillStyle = '#8a6844'; g.fillRect(326, 1952, 32, 22)
  g.fillStyle = '#1a1a20'
  g.fillRect(330, 1956, 8, 6); g.fillRect(342, 1958, 8, 6); g.fillRect(336, 1964, 8, 6)
      g.restore()
    }
  })
  def("ayun_hand_warmer", {
    clickable: true, say: '冬天离不了，夏天也懒得收',
    scope: 'generic',
    name: '暖手炉', cat: '器物', tags: ["铜", "暖", "榻边"],
    w: 30, h: 28, base: 28, foot: [0,16,30,12], zLayer:'low',fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell, pxC=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      g.save(); g.setTransform(1,0,0,1,-1128,-842)
  // 暖手炉(榻边)
  g.fillStyle = '#3a2c20'
  g.fillRect(1128, 848, 30, 22)
  g.fillStyle = '#c9a26a'; g.fillRect(1131, 851, 24, 16)
  g.fillStyle = '#3a2c20'
  for (let k = 0; k < 3; k++) g.fillRect(1135 + k * 7, 855, 3, 3)
  g.fillRect(1136, 842, 14, 3)
      g.restore()
    }
  })
  def("ayun_open_book", {
    clickable: true, say: '读到第七页了……上个月也是第七页', sayDeep: '不是读不进，是读了也改不了什么',
    scope: 'generic',
    name: '摊开的书', cat: '器物', tags: ["纸", "榻上", "刚读过"],
    w: 48, h: 34, base: 34, foot: [0,22,48,12], zLayer:'low',fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell, pxC=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      g.save(); g.setTransform(1,0,0,1,-1244,-698)
  // 摊开的书(榻上)
  g.fillStyle = '#f6efdc'
  g.fillRect(1246, 700, 22, 30); g.fillRect(1268, 700, 22, 30)
  g.fillStyle = '#3a2c20'
  g.fillRect(1244, 698, 48, 2); g.fillRect(1267, 700, 2, 30); g.fillRect(1244, 730, 48, 2)
  g.fillStyle = 'rgba(58,44,32,0.5)'
  g.fillRect(1250, 706, 12, 1); g.fillRect(1250, 712, 12, 1); g.fillRect(1274, 706, 12, 1); g.fillRect(1274, 714, 10, 1)
      g.restore()
    }
  })
  def("ayun_incense_box", {
    clickable: true, say: '点一炷，醒神用的，不是为了修行',
    scope: 'generic',
    name: '香盒 · 掀盖', cat: '器物', tags: ["木", "香", "桌面"],
    w: 28, h: 26, base: 26, foot: [0,14,28,12], zLayer:'low',fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell, pxC=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      g.save(); g.setTransform(1,0,0,1,-1032,-1322)
  // 香盒(香炉旁 · 掀盖)
  g.fillStyle = '#3a2c20'; g.fillRect(1032, 1330, 28, 18)
  g.fillStyle = '#c04838'; g.fillRect(1035, 1333, 22, 12)
  g.fillStyle = '#e8b23d'; g.fillRect(1043, 1337, 6, 4)
  g.fillStyle = '#c9a26a'; g.fillRect(1038, 1322, 20, 6)
      g.restore()
    }
  })
  def("ayun_candle_snuffer", {
    clickable: true, say: '灭烛用，吹会呛，别问贫道怎么知道的',
    scope: 'generic',
    name: '烛剪', cat: '器物', tags: ["铁", "灯下"],
    w: 26, h: 10, base: 9, foot: [0,0,26,9], zLayer:'low',fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell, pxC=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      g.save(); g.setTransform(1,0,0,1,-998,-1892)
  // 烛剪(灯台下)
  g.fillStyle = '#4a453e'
  g.fillRect(1002, 1898, 22, 2); g.fillRect(1020, 1892, 2, 8)
  g.fillStyle = '#3a2c20'; g.fillRect(998, 1896, 5, 5)
      g.restore()
    }
  })
  def("ayun_tea_washer", {
    clickable: true, say: '洗茶的，贫道一般不洗',
    scope: 'generic',
    name: '茶洗', cat: '器物', tags: ["陶", "茶具"],
    w: 26, h: 12, base: 12, foot: [0,0,26,12], zLayer:'low',fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell, pxC=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      g.save(); g.setTransform(1,0,0,1,-1178,-964)
  // 茶洗(床头几下层)
  g.fillStyle = '#5a6a88'; g.fillRect(1180, 966, 22, 10)
  g.fillStyle = '#3a2c20'; g.fillRect(1178, 964, 26, 2)
      g.restore()
    }
  })
  def("ayun_dustpan", {
    scope: 'generic',
    name: '簸箕', cat: '器物', tags: ["竹", "清扫", "柜旁"],
    w: 38, h: 24, base: 23, foot: [0,11,38,12], zLayer:'low',fromRoom: 'ayun',
    draw(g) {
      const pxCircle=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      const pxRing=(a,b,c,d,e)=>PRIM.pxR(g,a,b,c,d,e)
      const glow=(x,y,r,c)=>{const q=g.createRadialGradient(x,y,2,x,y,r);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,215,106,0)');g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
      const box=(x,y,w,h,e,f)=>{g.fillStyle=e;g.fillRect(x,y,w,h);g.fillStyle=f;g.fillRect(x+3,y+3,w-6,h-6)}
      const contact=(x,y,w)=>{g.fillStyle='rgba(30,20,10,0.28)';g.fillRect(x,y,w,3)}
      const ell=(cx,cy,rx,ry,c)=>{g.fillStyle=c;for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
      const dEllipse=ell, pxE=ell, pxC=(a,b,c,d)=>PRIM.pxC(g,a,b,c,d)
      g.save(); g.setTransform(1,0,0,1,-54,-1892)
  // 簸箕(药柜旁)
  g.fillStyle = '#c9a26a'
  g.fillRect(56, 1892, 34, 22)
  g.fillStyle = '#a87f48'
  for (let k = 0; k < 4; k++) g.fillRect(60 + k * 8, 1896, 1, 14)
  g.fillStyle = '#3a2c20'; g.fillRect(54, 1912, 38, 3)
  g.fillStyle = '#5a8a44'; g.fillRect(66, 1898, 5, 3); g.fillRect(74, 1900, 4, 3)
      g.restore()
    }
  })

  def("ayun_floor_boards", {
    scope: 'generic',
    name: '散落木板 ×2', cat: '器物', tags: ['木','杂物','地面'],
    w: 110, h: 32, base: 32, foot: [0, 20, 110, 12], zLayer: 'low', fromRoom: 'ayun',
    draw(g) {
      g.save(); g.setTransform(1,0,0,1,0,0)
      g.fillStyle = 'rgba(58,44,32,0.4)'; g.fillRect(8, 24, 56, 6); g.fillRect(66, 30, 44, 6)
      g.fillStyle = '#c8b088'; g.fillRect(0, 0, 52, 26); g.fillRect(58, 6, 52, 26)
      g.fillStyle = '#a88858'; g.fillRect(0, 0, 52, 8); g.fillRect(58, 6, 52, 8)
      g.restore()
    }
  })

  def("ayun_cabinet_low", {
    clickable: true, say: '塞满了，开了就合不上，别碰',
    occludeH: 44,   // 矮柜齐腰,人站柜后应露出上半身
    scope: 'generic',
    name: '矮柜 · 门边', cat: '收纳', tags: ['木','矮','门边'],
    w: 96, h: 60, base: 60, foot: [0, 40, 96, 20], zLayer: 'low', fromRoom: 'ayun',
    draw(g) {
      g.save(); g.setTransform(1,0,0,1,0,0)
      g.fillStyle = 'rgba(58,44,32,0.4)'; g.fillRect(4, 58, 92, 6)
      g.fillStyle = '#3a2c20'; g.fillRect(0, 0, 96, 60)
      g.fillStyle = '#8a6844'; g.fillRect(6, 6, 84, 20)
      g.fillStyle = '#6e5236'; g.fillRect(10, 26, 12, 32); g.fillRect(74, 26, 12, 32)
      g.restore()
    }
  })

  def("ayun_almanac", {
    scope: 'generic',
    name: '历书 · 翻卷起毛', cat: '器物', tags: ['纸','术数','桌面','天天翻'],
    w: 68, h: 48, base: 48, foot: [0, 34, 68, 14], zLayer: 'low',
    clickable: true, say: '今日甲子……月将在亥', fromRoom: 'ayun',
    draw(g) {
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0)
      // 起课第一步是查当日干支与月将,所以这本是天天翻的:卷边、起毛、夹条
      g.fillStyle = 'rgba(30,20,10,0.22)'; g.fillRect(4, 42, 60, 5)      // 落地影
      g.fillStyle = '#6a4a2c'; g.fillRect(0, 6, 68, 36)                   // 封底
      g.fillStyle = '#e8dcc0'; g.fillRect(3, 9, 62, 30)                   // 纸页
      g.fillStyle = '#d8cbaa'                                             // 页层错位(翻旧了)
      g.fillRect(3, 9, 62, 2); g.fillRect(3, 36, 62, 3)
      g.fillStyle = '#8a6844'; g.fillRect(30, 6, 6, 36)                   // 书脊居中(摊开)
      g.fillStyle = '#5a4432'
      for (let i = 0; i < 5; i++) { g.fillRect(8, 14 + i * 5, 18, 1); g.fillRect(40, 14 + i * 5, 18, 1) }  // 墨字行
      g.fillStyle = '#c04838'; g.fillRect(52, 4, 5, 16)                   // 红书签条
      g.fillStyle = '#e8dcc0'                                             // 右下角卷边翘起
      g.fillRect(58, 33, 7, 6); g.fillRect(60, 31, 5, 4)
      g.fillStyle = '#c8b898'; g.fillRect(58, 33, 7, 1); g.fillRect(60, 31, 5, 1)
      g.fillStyle = 'rgba(90,68,50,0.5)'                                  // 边缘起毛
      for (let i = 0; i < 9; i++) g.fillRect(3 + i * 7, 39, 3, 1)
      g.restore()
    }
  })

