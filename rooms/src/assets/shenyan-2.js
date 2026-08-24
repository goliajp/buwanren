
  def("shenyan_window_lattice", {
    clickable: true, say: '江南的天，一年有半年是这个颜色',
    name: "格窗", cat: "墙面", tags: ["木格", "天光", "江南"],
    scope: "character", fromRoom: 'shenyan', wall: true,
    w: 236, h: 288, base: 288, foot: [0, 288, 236, 0], zLayer: 'sort',
    draw(g) {
      // 素材是【半分辨率】创作的:placeAsset 预缩放 2×,所以用最终像素写的坐标
      // 必须补这一行,否则整件画成两倍大、右下半被自己的包围盒裁掉。
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#5d4a34'; g.fillRect(0, 0, 236, 288)                 // 外框
      g.fillStyle = '#6f5940'; g.fillRect(6, 6, 224, 276)
      g.fillStyle = '#c9ccc4'; g.fillRect(16, 16, 204, 256)               // 窗纸:阴天的灰白
      g.fillStyle = '#d6d8d0'; g.fillRect(16, 16, 204, 92)                // 上半更亮一点(天在上)
      g.fillStyle = '#5d4a34'                                             // 步步锦格心
      for (let c = 0; c <= 3; c++) g.fillRect(16 + c * 68, 16, 8, 256)
      for (let r = 0; r <= 4; r++) g.fillRect(16, 16 + r * 64, 204, 8)
      g.fillStyle = '#7d6748'                                             // 格心内的短棂
      for (let c = 0; c < 3; c++) for (let r = 0; r < 4; r++)
        if ((c + r) % 2 === 0) g.fillRect(28 + c * 68, 44 + r * 64, 44, 5)
      g.fillStyle = 'rgba(120,124,116,0.22)'; g.fillRect(16, 214, 204, 58) // 下沿的水汽
      g.restore()
    }
  })

  def("shenyan_scroll_zi", {
    clickable: true, say: '待时。挂了十一年，字还没旧',
    sayDeep: ['写的时候是自勉', '……后来就成了习惯，看都不看了', '待时。我是真等过的'],
    name: "字幅 · 待时", cat: "墙面", tags: ["书法", "挂轴", "表层"],
    scope: "character", fromRoom: 'shenyan', wall: true,
    w: 88, h: 236, base: 236, foot: [0, 236, 88, 0], zLayer: 'sort',
    draw(g) {
      // 素材是【半分辨率】创作的:placeAsset 预缩放 2×,所以用最终像素写的坐标
      // 必须补这一行,否则整件画成两倍大、右下半被自己的包围盒裁掉。
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#8a7a5c'; g.fillRect(2, 0, 84, 10)                   // 上轴
      g.fillStyle = '#6d5f46'; g.fillRect(0, 4, 88, 5)
      g.fillStyle = '#b8ab8c'; g.fillRect(8, 12, 72, 210)                 // 绫边
      g.fillStyle = '#f0ebdc'; g.fillRect(14, 20, 60, 194)                // 纸面
      if (globalThis.CALLI) {                                                 // 竖排「待时」
        globalThis.CALLI(g, '待', 22, 34, 44, '#2b2318', { weight: 1.4 })
        globalThis.CALLI(g, '时', 22, 108, 44, '#2b2318', { weight: 1.4 })
      }
      g.fillStyle = '#b03a2e'; g.fillRect(28, 174, 16, 16)                // 落款印
      g.fillStyle = '#f0ebdc'; g.fillRect(31, 177, 10, 3); g.fillRect(31, 183, 10, 3)
      g.fillStyle = '#8a7a5c'; g.fillRect(2, 224, 84, 12)                 // 下轴
      g.fillStyle = '#6d5f46'; g.fillRect(0, 228, 88, 5)
      g.restore()
    }
  })

  def("shenyan_wall_record", {
    clickable: true, say: '第八百四十期起，一期没落下',
    name: "开奖记录表", cat: "墙面", tags: ["彩票", "抄表", "表层"],
    scope: "character", fromRoom: 'shenyan', wall: true,
    w: 300, h: 200, base: 200, foot: [0, 200, 300, 0], zLayer: 'sort',
    draw(g) {
      // 素材是【半分辨率】创作的:placeAsset 预缩放 2×,所以用最终像素写的坐标
      // 必须补这一行,否则整件画成两倍大、右下半被自己的包围盒裁掉。
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#d3c8a6'; g.fillRect(6, 8, 294, 192)                 // 底下压着的旧表(露边)
      g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 292, 188)                 // 表层:本册
      g.fillStyle = '#e8e1cf'; g.fillRect(0, 0, 292, 12)
      g.fillStyle = 'rgba(96,86,68,0.34)'                                 // 表格线
      for (let c = 0; c <= 6; c++) g.fillRect(16 + c * 43, 22, 2, 150)
      for (let r = 0; r <= 5; r++) g.fillRect(16, 22 + r * 30, 260, 2)
      g.fillStyle = '#332c22'                                             // 抄上去的号码
      for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++)
        if (((r * 5 + c * 3) % 4) !== 0) g.fillRect(24 + c * 43, 32 + r * 30, 26, 11)
      g.fillStyle = '#b03a2e'                                             // 红笔:中过的那两期
      g.fillRect(24, 62, 26, 3); g.fillRect(153, 122, 26, 3)
      g.restore()
    }
  })

  def("shenyan_stub_string", {
    clickable: true, say: '存根。不留着，怎么知道自己错在哪',
    name: "存根串", cat: "墙面", tags: ["彩票", "存根", "底层"],
    scope: "character", fromRoom: 'shenyan', wall: true,
    w: 300, h: 84, base: 84, foot: [0, 84, 300, 0], zLayer: 'sort',
    draw(g) {
      // 素材是【半分辨率】创作的:placeAsset 预缩放 2×,所以用最终像素写的坐标
      // 必须补这一行,否则整件画成两倍大、右下半被自己的包围盒裁掉。
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#8a8378'; g.fillRect(0, 4, 300, 3)                   // 挂线
      const COL = ['#e8b8c0', '#e8d8a0', '#a8c8e0', '#d8c0e0', '#e8c8a0']
      for (let i = 0; i < 8; i++) {                                       // 长短不一的存根
        const x = 8 + i * 36, hh = 46 + ((i * 7) % 3) * 12
        g.fillStyle = COL[i % COL.length]; g.fillRect(x, 6, 28, hh)
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x, 6, 28, 6)    // 撕口白边
        g.fillStyle = 'rgba(60,52,44,0.45)'                               // 上面的印字
        g.fillRect(x + 4, 18, 20, 3); g.fillRect(x + 4, 26, 14, 3)
        g.fillRect(x + 4, hh - 10, 20, 3)
        g.fillStyle = '#5a5248'; g.fillRect(x + 12, 2, 5, 5)              // 图钉
      }
      g.restore()
    }
  })

  def("shenyan_wall_thread", {
    clickable: true, say: '线是我连的。规律，就快出来了',
    name: "棉线与图钉", cat: "墙面", tags: ["红线", "图钉", "规律"],
    scope: "character", fromRoom: 'shenyan', wall: true,
    w: 800, h: 300, base: 300, foot: [0, 300, 800, 0], zLayer: 'above',
    draw(g) {
      // 素材是【半分辨率】创作的:placeAsset 预缩放 2×,所以用最终像素写的坐标
      // 必须补这一行,否则整件画成两倍大、右下半被自己的包围盒裁掉。
      g.save(); g.scale(0.5, 0.5)
      const PIN = [[64, 42], [212, 96], [140, 190], [330, 58], [286, 214],
                   [452, 128], [560, 74], [612, 206], [724, 152], [396, 262]]
      g.strokeStyle = '#b03a2e'; g.lineWidth = 2                          // 连出的「规律」
      g.beginPath()
      for (let i = 0; i < PIN.length; i++) {
        const [x, y] = PIN[i]
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y)
      }
      g.stroke()
      g.beginPath(); g.moveTo(64, 42); g.lineTo(452, 128); g.lineTo(140, 190); g.stroke()
      for (const [x, y] of PIN) {                                         // 图钉
        g.fillStyle = '#8a2f24'; g.fillRect(x - 4, y - 4, 8, 8)
        g.fillStyle = '#d85a48'; g.fillRect(x - 3, y - 3, 4, 4)
      }
      g.restore()
    }
  })

  def("shenyan_sticker_koi", {
    clickable: true, say: '锦鲤。图个念想，别笑',
    name: "锦鲤贴纸", cat: "墙面", tags: ["转运", "贴纸", "点缀"],
    scope: "character", fromRoom: 'shenyan', wall: true,
    w: 96, h: 60, base: 60, foot: [0, 60, 96, 0], zLayer: 'sort',
    draw(g) {
      // 素材是【半分辨率】创作的:placeAsset 预缩放 2×,所以用最终像素写的坐标
      // 必须补这一行,否则整件画成两倍大、右下半被自己的包围盒裁掉。
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = '#f4f2ec'; g.fillRect(2, 2, 92, 56)                   // 贴纸白边
      pxE(46, 30, 34, 17, '#e8663c')                                      // 鱼身
      pxE(40, 27, 22, 11, '#f08a5c')
      g.fillStyle = '#f4f2ec'; g.fillRect(30, 24, 8, 4)                   // 白斑
      g.fillRect(50, 33, 10, 4)
      g.fillStyle = '#e8663c'                                             // 尾
      g.fillRect(76, 22, 10, 6); g.fillRect(80, 28, 12, 5); g.fillRect(76, 33, 10, 6)
      g.fillStyle = '#2b2318'; g.fillRect(32, 27, 4, 4)                   // 眼
      g.fillStyle = 'rgba(180,160,120,0.5)'; g.fillRect(2, 52, 92, 6)     // 贴歪了的下边
      g.restore()
    }
  })
  def("shenyan_tube_zi", {
    clickable: true, say: '写好的插上面。写坏的，塞底下',
    sayDeep: ['底下那些？练笔而已', '……写坏一个字，那天就不测了', '手抖的时候，写出来的字自己会说话。我认得'],
    name: "字纸筒", cat: "收纳", tags: ["竹筒", "字条", "层积"],
    scope: "character", fromRoom: 'shenyan',
    w: 64, h: 120, base: 120, foot: [4, 96, 56, 24], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      // 竹筒
      g.fillStyle = '#4a3f22'; g.fillRect(6, 34, 52, 84)
      g.fillStyle = '#7d6a38'; g.fillRect(10, 34, 44, 80)
      g.fillStyle = '#94804a'; g.fillRect(12, 34, 12, 80)                 // 高光竹面
      g.fillStyle = '#5d5029'                                             // 竹节
      g.fillRect(10, 60, 44, 5); g.fillRect(10, 92, 44, 5)
      pxE(32, 36, 24, 7, '#3a3119')                                       // 筒口
      // 表层:插着写好的字条(白净、露头高)
      const 表 = ['#f2ece0', '#efe8d8', '#f4efe4']
      for (let k = 0; k < 3; k++) {
        g.fillStyle = 表[k]; g.fillRect(14 + k * 13, 8 + (k % 2) * 5, 11, 34)
        g.fillStyle = '#2b2318'; g.fillRect(16 + k * 13, 14 + (k % 2) * 5, 6, 3)
        g.fillRect(16 + k * 13, 22 + (k % 2) * 5, 6, 3)
      }
      // ★ 底层:塞在筒底写坏的 —— 只在筒口露出发黄的边
      g.fillStyle = '#c9b579'; g.fillRect(12, 32, 40, 7)
      g.fillStyle = '#b08a4a'; g.fillRect(14, 35, 22, 3)
      g.restore()
    }
  })

  def("shenyan_stool_guest", {
    clickable: true, say: '坐。测一个字，不收贵的',
    name: "客位矮凳", cat: "坐卧", tags: ["竹凳", "客位"],
    scope: "character", fromRoom: 'shenyan',
    w: 108, h: 96, base: 96, foot: [0, 40, 108, 56], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(54, 30, 50, 20, '#3f3520')                                      // 凳面(俯视椭圆)
      pxE(54, 27, 46, 17, '#7d6a3c')
      pxE(54, 25, 38, 12, '#8f7c4a')
      g.fillStyle = '#6a5930'                                             // 编面纹
      for (let k = -3; k <= 3; k++) g.fillRect(54 + k * 11 - 1, 16, 2, 22)
      g.fillStyle = '#3f3520'                                             // 四条腿
      g.fillRect(16, 38, 7, 50); g.fillRect(86, 38, 7, 50)
      g.fillRect(30, 44, 6, 44); g.fillRect(74, 44, 6, 44)
      g.fillStyle = '#5a4c2b'; g.fillRect(20, 66, 70, 5)                  // 横枨
      g.restore()
    }
  })

  def("shenyan_dish_fee", {
    clickable: true, say: '润笔。给多少是心意，我不看',
    sayDeep: ['……看是看的', '上个月最多的一次，是两块糖', '给糖的那位，字测得最好'],
    name: "润笔钱碟", cat: "器物", tags: ["碟", "铜钱", "润笔"],
    scope: "character", fromRoom: 'shenyan',
    w: 80, h: 48, base: 48, foot: [0, 12, 80, 36], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(40, 26, 38, 18, '#6f6a60')                                      // 粗陶碟
      pxE(40, 24, 33, 14, '#948d80')
      pxE(40, 25, 26, 10, '#5f5a52')                                      // 碟心凹
      // 里面只有几个零钱 —— 一枚铜钱、两块糖
      g.fillStyle = '#b08a3a'; g.fillRect(28, 20, 10, 10)                 // 铜钱
      g.fillStyle = '#5f5a52'; g.fillRect(31, 23, 4, 4)                   // 钱孔
      g.fillStyle = '#d8607a'; g.fillRect(42, 22, 9, 7)                   // 糖
      g.fillStyle = '#e8a0b4'; g.fillRect(42, 22, 9, 3)
      g.fillStyle = '#7ab0d0'; g.fillRect(52, 24, 8, 6)
      g.restore()
    }
  })

  def("shenyan_paper_balls", {
    clickable: true, say: '写坏的。别捡',
    name: "废字纸堆", cat: "地面", tags: ["纸团", "写坏的", "底层"],
    scope: "character", fromRoom: 'shenyan',
    w: 150, h: 64, base: 0, foot: [0, 0, 0, 0], zLayer: 'low', walkable: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      const BALL = [[16, 40, 13], [44, 34, 15], [70, 44, 11], [96, 36, 14], [122, 46, 10], [58, 50, 9]]
      for (const [x, y, r] of BALL) {
        pxE(x, y, r, r * 0.8, '#e6dfcd')                                  // 纸团
        pxE(x - 2, y - 2, r * 0.6, r * 0.5, '#f2ece0')                    // 高光褶
        g.fillStyle = 'rgba(120,108,86,0.45)'                             // 褶痕
        g.fillRect(x - r + 3, y, r * 1.4, 2)
        g.fillStyle = 'rgba(43,35,24,0.5)'                                // 露出的墨迹
        g.fillRect(x - 3, y - 4, 5, 2)
      }
      g.restore()
    }
  })
  def("shenyan_desk_num", {
    clickable: true, say: '这一期的走势，跟上上期是反的',
    sayDeep: ['我记了十一年，本子在架上', '……中过两回。加起来不够买本子的',
              '你笑吧。我读了半辈子书，最后拿它推这个'],
    name: "推号桌", cat: "桌案", tags: ["彩票", "推算", "乱"],
    scope: "character", fromRoom: 'shenyan',
    w: 380, h: 220, base: 220, foot: [0, 0, 380, 220], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      // ── 桌体:比测字案高、旧、乱 ──
      g.fillStyle = '#33261a'; g.fillRect(0, 0, 380, 220)
      g.fillStyle = '#6b543c'; g.fillRect(4, 4, 372, 196)
      g.fillStyle = '#7d6448'; g.fillRect(8, 8, 364, 22)
      g.fillStyle = 'rgba(52,40,28,0.24)'
      for (let i = 0; i < 4; i++) g.fillRect(14, 40 + i * 36, 352, 3)
      g.fillStyle = '#41301f'; g.fillRect(4, 200, 372, 14)
      g.fillStyle = '#2a1d12'; g.fillRect(0, 212, 380, 8)
      g.fillRect(20, 212, 24, 8); g.fillRect(336, 212, 24, 8)             // 桌腿
      // ── 号码本堆(表层:摊开的那本)──
      g.fillStyle = '#f2ece0'; g.fillRect(26, 46, 132, 86)
      g.fillStyle = '#e3dac6'; g.fillRect(26, 46, 132, 7)
      g.fillStyle = 'rgba(90,80,62,0.40)'                                  // 横格
      for (let k = 0; k < 7; k++) g.fillRect(32, 60 + k * 10, 120, 2)
      g.fillStyle = '#332c22'                                              // 写满的号码
      for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++)
        if (((r + c) % 3) !== 0) g.fillRect(36 + c * 30, 62 + r * 10, 14, 5)
      g.fillStyle = '#b03a2e'; g.fillRect(36, 92, 44, 3)                   // 红笔划的一道
      // ★ 压在本子下:作废的旧本,只露一条边(层积)
      g.fillStyle = '#d3c08a'; g.fillRect(30, 126, 128, 10)
      g.fillStyle = '#b8a068'; g.fillRect(30, 132, 74, 4)
      // ── 算珠 ──
      g.fillStyle = '#4a3320'; g.fillRect(186, 60, 108, 56)
      g.fillStyle = '#63472e'; g.fillRect(190, 64, 100, 48)
      g.fillStyle = '#8a6a44'
      for (let k = 0; k < 5; k++) g.fillRect(196 + k * 19, 64, 4, 48)      // 档
      g.fillStyle = '#3a2718'; g.fillRect(190, 84, 100, 5)                 // 梁
      g.fillStyle = '#c9a05a'
      for (let k = 0; k < 5; k++) {
        g.fillRect(192 + k * 19, 70, 12, 8)                                // 上珠
        for (let j = 0; j < 3; j++) g.fillRect(192 + k * 19, 92 + j * 7, 12, 5)
      }
      // ── 红蓝笔筒 ──
      pxE(322, 78, 22, 9, '#5a5248')
      g.fillStyle = '#6f665c'; g.fillRect(300, 78, 44, 42)
      g.fillStyle = '#857b70'; g.fillRect(300, 78, 12, 42)
      g.fillStyle = '#b03a2e'; g.fillRect(308, 52, 6, 30)                  // 红笔
      g.fillStyle = '#2f5a9a'; g.fillRect(318, 46, 6, 36)                  // 蓝笔
      g.fillStyle = '#8a7a5c'; g.fillRect(328, 56, 5, 26)                  // 毛笔
      // ── 放大镜 ──
      g.fillStyle = '#4a4238'; g.fillRect(196, 138, 70, 8)                 // 柄
      pxE(178, 142, 26, 22, '#4a4238')
      pxE(178, 142, 21, 17, '#b8d0d8')
      pxE(174, 138, 9, 7, '#e0eef2')                                       // 镜面高光
      // ── 散落的纸条 ──
      g.fillStyle = '#efe8d8'
      g.fillRect(276, 150, 52, 16); g.fillRect(300, 168, 44, 14)
      g.fillStyle = 'rgba(51,44,34,0.55)'
      g.fillRect(282, 156, 26, 3); g.fillRect(306, 173, 22, 3)
      g.restore()
    }
  })

  def("shenyan_calendar", {
    clickable: true, say: '逢二、四、日开奖。这个我不会记错',
    name: "台历", cat: "器物", tags: ["开奖日", "红圈"],
    scope: "character", fromRoom: 'shenyan',
    w: 72, h: 84, base: 84, foot: [4, 66, 64, 18], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#4a4238'; g.fillRect(6, 20, 60, 6)                    // 铁环
      g.fillStyle = '#8a8078'
      for (let k = 0; k < 4; k++) g.fillRect(12 + k * 14, 16, 4, 12)
      g.fillStyle = '#d8d2c4'; g.fillRect(4, 24, 64, 44)                   // 底层旧页(露边)
      g.fillStyle = '#f4efe2'; g.fillRect(6, 22, 60, 42)                   // 当页
      g.fillStyle = '#b03a2e'; g.fillRect(6, 22, 60, 8)                    // 红头
      g.fillStyle = '#332c22'                                              // 日期格
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++)
        g.fillRect(11 + c * 11, 36 + r * 9, 6, 5)
      g.fillStyle = '#b03a2e'                                              // 圈出的开奖日
      for (const [c, r] of [[1, 0], [3, 1], [0, 2]]) {
        g.fillRect(9 + c * 11, 34 + r * 9, 10, 2); g.fillRect(9 + c * 11, 41 + r * 9, 10, 2)
        g.fillRect(9 + c * 11, 34 + r * 9, 2, 9); g.fillRect(17 + c * 11, 34 + r * 9, 2, 9)
      }
      g.fillStyle = '#5a5248'; g.fillRect(10, 66, 52, 14)                  // 支架
      g.fillStyle = '#3f3830'; g.fillRect(10, 76, 52, 6)
      g.restore()
    }
  })

  def("shenyan_stand_screen", {
    clickable: true, say: '搬来搬去，最后还是摆在这儿最顺眼',
    name: "屏下小几", cat: "桌案", tags: ["矮几", "电器"],
    scope: "character", fromRoom: 'shenyan',
    w: 204, h: 72, base: 72, foot: [0, 0, 204, 72], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#33261a'; g.fillRect(0, 0, 204, 72)
      g.fillStyle = '#6b543c'; g.fillRect(4, 4, 196, 54)
      g.fillStyle = '#7d6448'; g.fillRect(8, 8, 188, 12)
      g.fillStyle = 'rgba(52,40,28,0.22)'; g.fillRect(14, 30, 176, 3)
      g.fillStyle = '#41301f'; g.fillRect(4, 58, 196, 10)
      g.fillStyle = '#2a1d12'; g.fillRect(14, 66, 22, 6); g.fillRect(168, 66, 22, 6)
      // 几面上散着的电池与遥控
      g.fillStyle = '#3a3a42'; g.fillRect(140, 26, 40, 12)
      g.fillStyle = '#5a5a64'; g.fillRect(144, 28, 8, 3); g.fillRect(144, 33, 8, 3)
      g.fillStyle = '#c9a05a'; g.fillRect(112, 32, 8, 16); g.fillRect(124, 32, 8, 16)
      g.restore()
    }
  })

  def("shenyan_scratch_pile", {
    clickable: true, say: '刮完了。银粉刮得干净，是我的毛病',
    sayDeep: ['一张两块，不算赌', '……一个月下来，够买两刀纸', '我知道这是什么。我就是知道，才更想刮'],
    name: "刮刮乐堆", cat: "杂物", tags: ["彩票", "银粉", "底层"],
    scope: "character", fromRoom: 'shenyan',
    w: 168, h: 108, base: 108, foot: [0, 40, 168, 68], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      const CARD = [[6, 46, 0], [40, 34, 1], [78, 48, 2], [22, 70, 1], [92, 74, 0], [58, 62, 2]]
      const BASE = ['#e8d8a0', '#e8b8c0', '#a8c8e0']
      for (const [x, y, ci] of CARD) {
        g.fillStyle = '#8a8078'; g.fillRect(x + 2, y + 2, 62, 36)          // 影
        g.fillStyle = BASE[ci]; g.fillRect(x, y, 62, 36)                   // 卡面
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x, y, 62, 6)
        g.fillStyle = '#b9bcbf'; g.fillRect(x + 6, y + 12, 48, 16)         // 刮开的银层
        g.fillStyle = '#8f9497'; g.fillRect(x + 6, y + 12, 48, 4)
        g.fillStyle = '#3a352e'                                            // 露出的数字
        for (let k = 0; k < 3; k++) g.fillRect(x + 10 + k * 15, y + 18, 8, 7)
        g.fillStyle = 'rgba(60,52,44,0.5)'; g.fillRect(x + 6, y + 30, 30, 3)
      }
      // 刮奖用的硬币
      pxE(146, 84, 11, 11, '#8a8378')
      pxE(146, 84, 8, 8, '#a8a196')
      g.restore()
    }
  })

  def("shenyan_dish_peanut", {
    clickable: true, say: '看开奖的时候嗑的。壳我攒着，别问为什么',
    name: "花生壳碟", cat: "器物", tags: ["花生", "开奖夜"],
    scope: "character", fromRoom: 'shenyan',
    w: 84, h: 48, base: 48, foot: [0, 12, 84, 36], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(42, 28, 40, 18, '#6f6a60')
      pxE(42, 26, 35, 14, '#948d80')
      pxE(42, 27, 28, 10, '#5f5a52')
      const SH = [[30, 22], [40, 26], [50, 22], [36, 31], [48, 31], [56, 27]]
      for (const [x, y] of SH) {
        g.fillStyle = '#c9a878'; g.fillRect(x, y, 9, 5)
        g.fillStyle = '#a8875a'; g.fillRect(x, y + 3, 9, 2)
        g.fillStyle = '#e0c49a'; g.fillRect(x + 1, y, 4, 2)
      }
      g.restore()
    }
  })
  def("shenyan_lamp_oil", {
    clickable: true, say: '灯油贵。那边屏亮着，够看了',
    sayDeep: ['以前是夜夜点的', '……点着灯看书，看到第七次落榜', '现在只在写字的时候点。写字的时候少'],
    name: "油灯", cat: "灯火", tags: ["灭着的", "读书灯"],
    scope: "character", fromRoom: 'shenyan',
    w: 60, h: 96, base: 96, foot: [6, 76, 48, 20], zLayer: 'sort',
    /* 灯有开关 —— light 可以是函数,拿到房间 state。
       它的台词写着「现在只在写字的时候点。写字的时候少」,那就真的只在
       他坐下批注抄本的那一段亮:这间房平时唯一亮着的东西是开奖屏(冷),
       这一盏是唯一的暖光,而且要他做正事才舍得点。两盏光是一对,
       不是两个数字 —— 旧业的暖 ↔ 执念的冷。
       半径 180 明显小于屏的 240:它不当主光源,brief 里定死的。 */
    light: (st) => st.lamp ? { x: 30, y: 24, r: 180, color: '#e0a854', flicker: 0.55 } : null,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(30, 88, 24, 8, '#3f3830')                                       // 灯座
      pxE(30, 85, 20, 6, '#5f574c')
      g.fillStyle = '#4a4238'; g.fillRect(26, 52, 8, 34)                  // 灯柱
      g.fillStyle = '#5f574c'; g.fillRect(26, 52, 3, 34)
      pxE(30, 48, 22, 12, '#3f3830')                                      // 油碗
      pxE(30, 46, 18, 9, '#6f6558')
      pxE(30, 47, 12, 6, '#2b2620')                                       // 碗里剩的油
      // ★ 灯芯是焦黑的 —— 这盏灯【没点】
      g.fillStyle = '#1a1614'; g.fillRect(28, 38, 4, 10)
      g.fillStyle = '#0f0d0c'; g.fillRect(28, 36, 4, 4)
      g.fillStyle = 'rgba(90,80,70,0.45)'; g.fillRect(20, 30, 20, 3)      // 熏黑的痕
      g.restore()
    },
    /* 点着的时候才有火苗 —— 素材本体画的是【灭着的】那盏(它平时就是灭的),
       点亮不能只靠 L5 的光晕:晕在那儿而灯芯还是黑的,读起来像屋里另有光源。
       ⚠ fx 的 ctx 是 1440 系,不要在这儿再 scale(0.5)。 */
    fx(g, t, X, Y, o, room) {
      if (!(room && room.state && room.state.lamp)) return
      const w = 0.72 + 0.28 * Math.sin(t / 130) + 0.12 * Math.sin(t / 47)   // 油灯是晃的
      g.save(); g.translate(X, Y)
      g.fillStyle = 'rgba(58,42,22,0.55)'; g.fillRect(27, 34, 6, 8)          // 灯芯
      g.fillStyle = 'rgba(232,150,60,' + (0.85 * w).toFixed(2) + ')'
      g.fillRect(26, 20, 8, 16); g.fillRect(28, 14, 4, 8)
      g.fillStyle = 'rgba(252,222,140,' + (0.95 * w).toFixed(2) + ')'
      g.fillRect(28, 24, 4, 11); g.fillRect(29, 19, 2, 6)
      g.fillStyle = 'rgba(255,246,214,' + (0.9 * w).toFixed(2) + ')'; g.fillRect(29, 27, 2, 5)
      // 灯碗被自己的火照亮的那一圈
      g.globalCompositeOperation = 'lighter'
      g.fillStyle = 'rgba(226,164,84,' + (0.30 * w).toFixed(2) + ')'
      g.fillRect(14, 34, 32, 9); g.fillRect(18, 42, 24, 5)
      g.restore()
    }
  })

  def("shenyan_copybook", {
    clickable: true, say: '梅花易数。抄第七遍了，字倒是越写越好',
    sayDeep: ['抄书是笨办法', '……笨办法我用了半辈子', '批注是给我自己看的。写给谁看呢，又没有学生'],
    name: "抄本 · 梅花易数", cat: "书卷", tags: ["抄本", "批注", "表层"],
    scope: "character", fromRoom: 'shenyan',
    w: 132, h: 76, base: 76, foot: [0, 0, 132, 76], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 摊开的两页
      g.fillStyle = '#c9bda0'; g.fillRect(2, 4, 128, 70)                  // 底下压着的旧抄本(露边)
      g.fillStyle = '#f2ece0'; g.fillRect(0, 0, 126, 68)                  // 表层:当前这本
      g.fillStyle = '#e2dac6'; g.fillRect(0, 0, 126, 5)
      g.fillStyle = '#d8cfb8'; g.fillRect(61, 0, 5, 68)                   // 书脊
      g.fillStyle = '#332c22'                                             // 抄的正文(竖排)
      for (let c = 0; c < 4; c++) for (let r = 0; r < 5; r++)
        g.fillRect(10 + c * 13, 12 + r * 10, 7, 6)
      for (let c = 0; c < 4; c++) for (let r = 0; r < 5; r++)
        if ((c + r) % 4) g.fillRect(72 + c * 13, 12 + r * 10, 7, 6)
      g.fillStyle = '#b03a2e'                                             // 朱笔批注
      g.fillRect(10, 58, 30, 3); g.fillRect(72, 54, 24, 3)
      // ★ 夹在里面的批注纸条 —— 从书页间露出来(底层)
      g.fillStyle = '#e8d8a0'; g.fillRect(96, 62, 34, 12)
      g.fillStyle = '#c9b579'; g.fillRect(96, 68, 34, 4)
      g.fillStyle = 'rgba(51,44,34,0.6)'; g.fillRect(100, 65, 18, 3)
      g.restore()
    }
  })

  def("shenyan_box_scripts", {
    clickable: true, say: '旧纸罢了，垫桌脚正好',
    sayDeep: ['……第七张我留着，别的都烧了',
              '我算得出别人的运，算不出自己的。买张彩票，至少那串数不是我算的'],
    name: "卷子箱", cat: "收纳", tags: ["落榜", "七张", "核心物件"],
    scope: "character", fromRoom: 'shenyan',
    w: 220, h: 140, base: 140, foot: [0, 24, 220, 116], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      // ── 木箱:旧、边角磨圆、包着铁角 ──
      g.fillStyle = '#2f2015'; g.fillRect(0, 24, 220, 116)
      g.fillStyle = '#5d4530'; g.fillRect(6, 30, 208, 104)
      g.fillStyle = '#6f5540'; g.fillRect(10, 34, 200, 18)                // 箱盖面
      g.fillStyle = 'rgba(46,32,20,0.30)'
      for (let i = 0; i < 3; i++) g.fillRect(16, 62 + i * 22, 188, 3)     // 板缝
      g.fillStyle = '#3f3028'                                            // 四角铁包
      g.fillRect(6, 30, 22, 22); g.fillRect(192, 30, 22, 22)
      g.fillRect(6, 112, 22, 22); g.fillRect(192, 112, 22, 22)
      g.fillStyle = '#585048'
      g.fillRect(9, 33, 16, 4); g.fillRect(195, 33, 16, 4)
      // 锁扣(没锁)
      g.fillStyle = '#4a4238'; g.fillRect(96, 44, 28, 16)
      g.fillStyle = '#6f6558'; g.fillRect(100, 47, 20, 5)
      g.fillStyle = '#3a332c'; g.fillRect(104, 58, 12, 10)
      // ── ★ 箱盖没盖严:缝里露出发黄的卷子边(底层) ──
      g.fillStyle = '#c9b579'; g.fillRect(12, 52, 196, 9)
      g.fillStyle = '#b08a4a'; g.fillRect(12, 57, 130, 4)
      g.fillStyle = '#d8c48e'; g.fillRect(150, 53, 46, 5)
      // 侧面也挤出来一角
      g.fillStyle = '#c9b579'; g.fillRect(6, 92, 10, 22)
      // ── 表层:压在箱盖上的一沓新纸(遮住下面) ──
      g.fillStyle = '#efe9db'; g.fillRect(28, 8, 160, 34)
      g.fillStyle = '#e0d8c4'; g.fillRect(28, 8, 160, 6)
      g.fillStyle = '#d2c8ae'; g.fillRect(28, 36, 160, 5)
      g.fillStyle = 'rgba(51,44,34,0.40)'                                 // 新纸上写了两行
      g.fillRect(38, 18, 60, 3); g.fillRect(38, 26, 92, 3)
      // 镇在纸上的一块石头(免得风吹)
      pxE(160, 20, 18, 11, '#5a5f66')
      pxE(160, 17, 14, 8, '#727881')
      g.restore()
    }
  })
  def("shenyan_bin_paper", {
    clickable: true, say: '揉了就别看了。看了又要捡回来',
    name: "废纸篓", cat: "收纳", tags: ["竹篓", "废稿", "底层"],
    scope: "character", fromRoom: 'shenyan',
    w: 108, h: 132, base: 132, foot: [8, 96, 92, 36], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(54, 46, 42, 14, '#4a3f22')                                      // 篓口
      g.fillStyle = '#6a5930'; g.fillRect(14, 46, 80, 76)                 // 篓身
      g.fillStyle = '#7d6a38'; g.fillRect(18, 46, 16, 76)
      g.fillStyle = '#4a3f22'                                             // 竹篾横纹
      for (let k = 0; k < 5; k++) g.fillRect(14, 54 + k * 15, 80, 4)
      g.fillStyle = '#5d5029'
      for (let k = 0; k < 4; k++) g.fillRect(24 + k * 18, 46, 3, 76)      // 竖篾
      pxE(54, 122, 40, 10, '#3f3520')                                     // 篓底
      // 冒出来的废稿:写坏的推算 —— 揉了但还看得出红笔
      const B = [[34, 34, 12], [58, 28, 14], [76, 38, 10]]
      for (const [x, y, r] of B) {
        pxE(x, y, r, r * 0.82, '#e6dfcd')
        pxE(x - 2, y - 2, r * 0.55, r * 0.5, '#f2ece0')
        g.fillStyle = 'rgba(176,58,46,0.55)'; g.fillRect(x - 4, y - 1, 9, 2)
      }
      g.restore()
    }
  })

  def("shenyan_cat_lucky", {
    clickable: true, say: '同乡送的。他说这个招财，我说我信不过',
    sayDeep: ['……摆着又不费什么', '手举了三年，一分没招来', '它总比我准 —— 它至少一直举着'],
    name: "招财猫", cat: "装饰", tags: ["转运", "点缀"],
    scope: "character", fromRoom: 'shenyan',
    w: 72, h: 88, base: 88, foot: [10, 68, 52, 20], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(36, 78, 26, 8, '#c9c2b4')                                       // 底座
      g.fillStyle = '#f2efe6'; g.fillRect(16, 40, 40, 40)                 // 身
      g.fillStyle = '#e2ddce'; g.fillRect(16, 40, 40, 6)
      pxE(36, 30, 22, 18, '#f2efe6')                                      // 头
      g.fillStyle = '#e8663c'; g.fillRect(20, 14, 8, 12)                  // 耳
      g.fillRect(44, 14, 8, 12)
      g.fillStyle = '#2b2318'; g.fillRect(26, 26, 5, 5); g.fillRect(41, 26, 5, 5)  // 眼
      g.fillStyle = '#e8663c'; g.fillRect(33, 34, 6, 4)                   // 鼻
      g.fillStyle = '#c9a05a'; g.fillRect(24, 50, 24, 8)                  // 围兜
      g.fillStyle = '#b03a2e'; g.fillRect(30, 52, 12, 4)
      g.fillStyle = '#f2efe6'; g.fillRect(52, 22, 12, 26)                 // 举起的手
      g.fillStyle = '#e2ddce'; g.fillRect(52, 22, 12, 5)
      g.fillStyle = 'rgba(140,130,110,0.35)'; g.fillRect(16, 74, 40, 4)   // 积了灰
      g.restore()
    }
  })

  def("shenyan_bamboo_luck", {
    clickable: true, say: '转运竹。养了三年，它转它的',
    name: "转运竹", cat: "植物", tags: ["转运", "点缀"],
    scope: "character", fromRoom: 'shenyan',
    w: 80, h: 220, base: 220, foot: [14, 180, 52, 40], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      const STALK = [[26, 40], [38, 22], [50, 48]]
      for (const [x, y0] of STALK) {                                      // 三根竹
        g.fillStyle = '#4a6a3a'; g.fillRect(x, y0, 9, 152 - y0 + 40)
        g.fillStyle = '#6a8a4a'; g.fillRect(x, y0, 4, 152 - y0 + 40)
        g.fillStyle = '#3a5230'
        for (let k = 0; k < 5; k++) g.fillRect(x, y0 + 14 + k * 26, 9, 3) // 竹节
        g.fillStyle = '#5f8a44'                                           // 叶
        g.fillRect(x - 10, y0 + 6, 12, 5); g.fillRect(x + 8, y0 + 16, 12, 5)
        g.fillRect(x - 8, y0 + 30, 10, 4)
      }
      g.fillStyle = '#8fa3a8'; g.fillRect(14, 178, 52, 36)                // 玻璃瓶
      g.fillStyle = '#a9bcc0'; g.fillRect(14, 178, 14, 36)
      g.fillStyle = 'rgba(110,150,160,0.55)'; g.fillRect(16, 192, 48, 20) // 瓶里的水
      g.fillStyle = '#6f8a6a'; g.fillRect(20, 196, 40, 5)                 // 水苔
      pxE(40, 178, 26, 6, '#7d9094')                                      // 瓶口
      g.restore()
    }
  })

  def("shenyan_basin_leak", {
    clickable: true, say: '梅雨天接的。漏了三年，没修',
    sayDeep: ['修一次要半吊钱', '……那半吊钱我买了别的', '你猜买了什么'],
    name: "接漏陶盆", cat: "器物", tags: ["梅雨", "漏雨", "江南"],
    scope: "character", fromRoom: 'shenyan',
    w: 120, h: 100, base: 100, foot: [0, 30, 120, 70], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(60, 66, 56, 28, '#4a4038')                                      // 盆(俯视)
      pxE(60, 62, 50, 24, '#6f6459')
      pxE(60, 64, 42, 19, '#7d7268')
      pxE(60, 66, 36, 15, '#5a6e74')                                      // 接住的水
      pxE(60, 66, 30, 12, '#6d848a')
      // 水面的涟漪(一滴刚落下)
      g.fillStyle = 'rgba(200,222,228,0.65)'
      g.fillRect(52, 62, 16, 2); g.fillRect(48, 68, 24, 2)
      g.fillStyle = '#c8dee4'; g.fillRect(58, 34, 4, 12)                  // 正在落的水滴
      g.fillStyle = 'rgba(90,110,116,0.35)'                               // 盆沿的水渍圈
      pxE(60, 66, 58, 29, 'rgba(90,110,116,0.18)')
      g.restore()
    }
  })

  def("shenyan_books_tosell", {
    clickable: true, say: '这几捆是要卖的。书店压价，我还没舍得送去',
    sayDeep: ['捆了半年了', '……每回想送去，又拆开翻两页', '翻完再捆上。就这么半年'],
    name: "待卖的旧书", cat: "书卷", tags: ["捆好的", "半年没送去", "拆开又捆上"],
    scope: "character", fromRoom: 'shenyan',
    w: 200, h: 110, base: 110, foot: [0, 26, 200, 84], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,38,30,0.18)'; g.fillRect(8, 98, 184, 9)
      /* 线装书摞起来,一眼认出来靠的是【书签】—— 书脊那一侧贴的白条,
         上面写着书名。只画深色书脊 + 浅色书口,在这个尺寸上读成百叶窗。
         两摞之间还要留缝,不然连成一整片。 */
      const TONE = ['#c9b98c', '#d3c396', '#bfae80', '#cdbd90', '#c4b486', '#d8c89b', '#c9b98c']
      // ── 左边那摞:高些,七本 ──
      for (let k = 0; k < 7; k++) {
        const yy = 88 - k * 9, xx = 10 + (k % 2) * 2
        g.fillStyle = TONE[k]; g.fillRect(xx, yy, 80, 9)
        g.fillStyle = '#a8956a'; g.fillRect(xx, yy + 7, 80, 2)          // 书口的暗边
        g.fillStyle = '#6f5c3a'; g.fillRect(xx, yy, 8, 9)               // 订线的那一侧
        g.fillStyle = '#54452b'; g.fillRect(xx + 2, yy + 1, 2, 7); g.fillRect(xx + 5, yy + 1, 2, 7)
        g.fillStyle = '#efe8d6'; g.fillRect(xx + 12, yy + 1, 15, 7)     // ★ 书签
        g.fillStyle = '#5a4c34'; g.fillRect(xx + 14, yy + 3, 9, 2)
      }
      // ── 右边那摞:矮些,五本,书脊朝右 ──
      for (let k = 0; k < 5; k++) {
        const yy = 88 - k * 9, xx = 106 + (k % 2) * 2
        g.fillStyle = TONE[(k + 3) % 7]; g.fillRect(xx, yy, 82, 9)
        g.fillStyle = '#a8956a'; g.fillRect(xx, yy + 7, 82, 2)
        g.fillStyle = '#6f5c3a'; g.fillRect(xx + 74, yy, 8, 9)
        g.fillStyle = '#54452b'; g.fillRect(xx + 76, yy + 1, 2, 7); g.fillRect(xx + 79, yy + 1, 2, 7)
        g.fillStyle = '#efe8d6'; g.fillRect(xx + 55, yy + 1, 15, 7)
        g.fillStyle = '#5a4c34'; g.fillRect(xx + 57, yy + 3, 9, 2)
      }
      // ── 麻绳:一摞一道十字捆 ──
      g.fillStyle = '#a89263'
      g.fillRect(40, 22, 9, 76); g.fillRect(142, 40, 9, 58)
      g.fillStyle = '#c2ad7e'; g.fillRect(40, 22, 9, 4); g.fillRect(142, 40, 9, 4)
      g.fillStyle = '#8a7550'; g.fillRect(40, 58, 9, 3); g.fillRect(142, 68, 9, 3)
      // 捆绳的结,支棱着两截绳头
      g.fillStyle = '#a89263'; g.fillRect(34, 18, 21, 9); g.fillRect(136, 36, 21, 9)
      g.fillStyle = '#c2ad7e'; g.fillRect(34, 18, 21, 4); g.fillRect(136, 36, 21, 4)
      g.fillStyle = '#8a7550'; g.fillRect(50, 14, 12, 5); g.fillRect(152, 32, 11, 5)
      // ── 最上面那本翻着 —— 「每回想送去,又拆开翻两页」 ──
      g.fillStyle = '#e8dfc6'; g.fillRect(104, 20, 74, 14)
      g.fillStyle = '#f2ebd8'; g.fillRect(104, 20, 74, 5)
      g.fillStyle = '#d5c9a8'; g.fillRect(138, 20, 4, 14)
      g.fillStyle = '#4a3f2c'
      g.fillRect(112, 25, 16, 2); g.fillRect(112, 29, 11, 2)
      g.fillRect(148, 25, 16, 2); g.fillRect(148, 29, 13, 2)
      g.restore()
    }
  })

  def("shenyan_shoes", {
    clickable: true, say: '出门的鞋。出门的时候少',
    name: "旧鞋", cat: "杂物", tags: ["布鞋", "门边"],
    scope: "character", fromRoom: 'shenyan',
    w: 110, h: 58, base: 58, foot: [0, 14, 110, 44], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      for (const dx of [0, 56]) {
        pxE(24 + dx, 34, 22, 11, '#3a332c')                               // 鞋底
        pxE(24 + dx, 30, 20, 10, '#4a4238')                               // 鞋面
        pxE(20 + dx, 27, 13, 7, '#5f574c')                                // 鞋头
        g.fillStyle = '#6f6558'; g.fillRect(28 + dx, 22, 14, 6)           // 鞋口
        g.fillStyle = 'rgba(200,190,170,0.30)'; g.fillRect(14 + dx, 36, 20, 3) // 磨白的边
      }
      g.restore()
    }
  })

  def("shenyan_doormat", {
    clickable: true, say: '进门擦一擦。地上都是纸',
    name: "门垫", cat: "地面", tags: ["草编", "门口"],
    scope: "character", fromRoom: 'shenyan',
    w: 200, h: 72, base: 0, foot: [0, 0, 0, 0], zLayer: 'low', walkable: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#6a5930'; g.fillRect(0, 0, 200, 72)
      g.fillStyle = '#7d6a38'; g.fillRect(4, 4, 192, 64)
      g.fillStyle = '#5d5029'
      for (let k = 0; k < 9; k++) g.fillRect(4, 8 + k * 7, 192, 3)        // 草编横纹
      g.fillStyle = '#8a7444'
      for (let k = 0; k < 6; k++) g.fillRect(10 + k * 32, 4, 4, 64)       // 竖纹
      g.fillStyle = 'rgba(60,52,40,0.28)'; g.fillRect(60, 20, 80, 32)     // 踩旧的中间
      g.restore()
    }
  })

  def("shenyan_scraps_floor", {
    clickable: true, say: '扫过的。风一吹又是一地',
    name: "地上的纸屑", cat: "地面", tags: ["纸屑", "扫不完"],
    scope: "character", fromRoom: 'shenyan',
    w: 240, h: 60, base: 0, foot: [0, 0, 0, 0], zLayer: 'low', walkable: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const S = [[10, 18, 14, 6], [38, 34, 10, 5], [62, 12, 16, 5], [90, 40, 12, 6],
                 [118, 22, 14, 5], [148, 38, 10, 5], [172, 16, 15, 6], [200, 32, 11, 5],
                 [50, 46, 13, 4], [130, 48, 12, 4]]
      for (const [x, y, w2, h2] of S) {
        g.fillStyle = '#e6dfcd'; g.fillRect(x, y, w2, h2)
        g.fillStyle = 'rgba(120,108,86,0.40)'; g.fillRect(x, y + h2 - 2, w2, 2)
        if ((x + y) % 3 === 0) { g.fillStyle = 'rgba(43,35,24,0.45)'; g.fillRect(x + 2, y + 1, 5, 2) }
      }
      g.restore()
    }
  })
  def("shenyan_couch_bamboo", {
    clickable: true, say: '竹榻凉，夏天好睡。冬天……冬天也这么睡',
    sayDeep: ['枕头？那是书', '……垫着睡踏实些', '读了半辈子，最后是拿它垫头。这话我只跟你说'],
    name: "竹榻", cat: "坐卧", tags: ["竹编", "凉榻", "起居"],
    scope: "character", fromRoom: 'shenyan', sleep: true,
    w: 340, h: 300, base: 300, foot: [0, 0, 340, 300], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // ① 接触阴影
      g.fillStyle = 'rgba(40,32,20,0.22)'; g.fillRect(10, 288, 324, 10)
      // ② 榻框描边 + 竹编面(只在四周露出)
      g.fillStyle = '#3f3520'; g.fillRect(0, 0, 340, 292)
      g.fillStyle = '#8a7644'; g.fillRect(8, 8, 324, 268)
      g.fillStyle = '#9c8752'; g.fillRect(8, 8, 324, 16)
      g.fillStyle = '#6f5d34'
      for (let k = 0; k < 17; k++) g.fillRect(8, 20 + k * 16, 324, 3)     // 竹篾
      g.fillStyle = '#7d6a3c'
      for (let k = 0; k < 9; k++) g.fillRect(16 + k * 38, 8, 4, 268)
      // ③ 铺开的薄被 —— 占中部一大块,不是卷起来的一坨
      g.fillStyle = '#3f4652'; g.fillRect(30, 96, 280, 168)               // 描边
      g.fillStyle = '#7e8a98'; g.fillRect(34, 100, 272, 160)              // 被面
      g.fillStyle = '#94a0ae'; g.fillRect(34, 100, 272, 26)               // 上沿受光
      g.fillStyle = '#6b7683'; g.fillRect(34, 246, 272, 14)               // 下沿背光
      g.fillStyle = '#69747f'                                             // 被褶
      for (let k = 0; k < 5; k++) g.fillRect(48 + k * 52, 130, 8, 112)
      g.fillStyle = 'rgba(120,132,146,0.55)'; g.fillRect(34, 176, 272, 5)
      g.fillStyle = '#8d99a6'; g.fillRect(60, 200, 96, 40)                // 掀开的一角
      g.fillStyle = '#a6b1bd'; g.fillRect(60, 200, 96, 8)
      // ④ ★ 枕头就是一摞书 —— 横跨榻头(阿云的枕头也是横跨的)
      g.fillStyle = '#2f2015'; g.fillRect(38, 22, 264, 72)                // 描边
      const C = ['#8a6a4a', '#6f5540', '#95765a', '#7d5f46']
      for (let k = 0; k < 4; k++) {
        g.fillStyle = C[k]; g.fillRect(42, 26 + k * 16, 256, 15)          // 一摞四册
        g.fillStyle = 'rgba(242,236,214,0.66)'; g.fillRect(42, 26 + k * 16, 256, 4)  // 书口
        g.fillStyle = 'rgba(60,44,28,0.35)'; g.fillRect(42, 38 + k * 16, 256, 2)
      }
      g.fillStyle = '#c9b579'; g.fillRect(42, 84, 256, 8)                 // ★ 压在最底的黄纸
      g.fillStyle = '#b08a4a'; g.fillRect(42, 88, 150, 3)
      g.fillStyle = 'rgba(50,38,24,0.26)'; g.fillRect(128, 26, 92, 62)    // 头压出的凹陷
      // ⑤ 榻沿厚度 + 腿
      g.fillStyle = '#3f3520'; g.fillRect(8, 268, 324, 14)
      g.fillStyle = '#2f2818'; g.fillRect(0, 280, 340, 12)
      g.fillRect(24, 292, 28, 8); g.fillRect(288, 292, 28, 8)
      g.restore()
    }
  })


  def("shenyan_table_bedside", {
    clickable: true, say: '半夜醒了就喝一口。凉的',
    name: "榻边小几", cat: "桌案", tags: ["矮几", "茶"],
    scope: "character", fromRoom: 'shenyan',
    w: 120, h: 96, base: 96, foot: [0, 0, 120, 96], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = '#33261a'; g.fillRect(0, 0, 120, 96)
      g.fillStyle = '#6b543c'; g.fillRect(4, 4, 112, 74)
      g.fillStyle = '#7d6448'; g.fillRect(8, 8, 104, 12)
      g.fillStyle = '#41301f'; g.fillRect(4, 78, 112, 12)
      g.fillStyle = '#2a1d12'; g.fillRect(12, 88, 18, 8); g.fillRect(90, 88, 18, 8)
      // 茶壶(粗陶)
      pxE(38, 44, 22, 16, '#7a6a58')
      pxE(38, 40, 18, 12, '#8f7f6c')
      g.fillStyle = '#5f5348'; g.fillRect(30, 26, 16, 8)                  // 壶盖
      g.fillStyle = '#7a6a58'; g.fillRect(56, 36, 14, 5)                  // 壶嘴
      g.fillStyle = '#5f5348'; g.fillRect(16, 36, 8, 14)                  // 把
      // 两只茶碗,一只倒扣着
      pxE(80, 48, 14, 9, '#8fa3a8')
      pxE(80, 46, 11, 7, '#a9bcc0')
      pxE(80, 47, 7, 4, '#6b7d82')
      pxE(100, 58, 13, 8, '#8fa3a8')                                      // 倒扣的那只
      pxE(100, 56, 10, 6, '#7d9094')
      g.restore()
    }
  })

  def("shenyan_bowl_coarse", {
    clickable: true, say: '一碗粥。就着咸菜，够了',
    name: "粗瓷碗", cat: "器物", tags: ["粗瓷", "粥"],
    scope: "character", fromRoom: 'shenyan',
    w: 84, h: 52, base: 52, foot: [0, 12, 84, 40], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(42, 30, 36, 18, '#6f6a60')
      pxE(42, 27, 32, 15, '#8f8a80')
      pxE(42, 28, 26, 11, '#b8b2a4')                                      // 碗里的粥
      pxE(42, 27, 20, 8, '#cfc9ba')
      g.fillStyle = 'rgba(90,84,74,0.4)'; g.fillRect(24, 38, 36, 3)       // 碗底影
      g.fillStyle = '#8a7a5c'; g.fillRect(56, 16, 4, 22)                  // 搁着的筷子
      g.fillRect(62, 16, 4, 22)
      g.restore()
    }
  })

  def("shenyan_jar_pickle", {
    clickable: true, say: '一坛咸菜，能吃两个月',
    sayDeep: ['同乡腌的', '……他中了举，托人捎来的', '我谢过了。谢得很客气'],
    name: "咸菜坛", cat: "器物", tags: ["粗陶", "咸菜", "清贫"],
    scope: "character", fromRoom: 'shenyan',
    w: 96, h: 128, base: 128, foot: [8, 92, 80, 36], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(48, 40, 34, 14, '#4a4038')                                      // 坛口
      g.fillStyle = '#5f5348'; g.fillRect(16, 40, 64, 76)                 // 坛身
      g.fillStyle = '#7a6a58'; g.fillRect(20, 40, 20, 76)                 // 高光
      g.fillStyle = '#4a4038'; g.fillRect(16, 60, 64, 6)                  // 束腰
      pxE(48, 116, 32, 12, '#3f3830')                                     // 坛底
      // 布封口 + 草绳
      g.fillStyle = '#c9c2b0'; g.fillRect(18, 28, 60, 16)
      g.fillStyle = '#b3ab98'; g.fillRect(18, 28, 60, 5)
      g.fillStyle = '#b09a62'; g.fillRect(16, 40, 64, 5)
      g.fillStyle = '#8a7448'; g.fillRect(40, 38, 8, 9)                   // 绳结
      // 坛身写的字
      g.fillStyle = 'rgba(43,35,24,0.5)'; g.fillRect(38, 76, 20, 4); g.fillRect(38, 86, 20, 4)
      g.restore()
    }
  })

  def("shenyan_mat_bamboo", {
    clickable: true, say: '席子铺着，来人坐地上也不凉',
    sayDeep: ['家里最体面的就这一张', '……去年换的新席', '来测字的人，总不好让人坐灰地上'],
    name: "竹席", cat: "地面", tags: ["竹席", "待客", "浅色"],
    scope: "character", fromRoom: 'shenyan',
    w: 640, h: 520, base: 0, foot: [0, 0, 0, 0], zLayer: 'low', walkable: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // 编织方向【转九十度】—— 全屋那张旧席是横纹,这一张竖纹。
      // 江南铺席本来就转向铺;不转向的话两张席只差一点明度,
      // 读起来是同一张席的两块,而不是「他另铺的一张」
      g.fillStyle = '#b6a67c'; g.fillRect(0, 0, 640, 520)
      g.fillStyle = '#e2d6ae'; g.fillRect(11, 11, 618, 498)
      g.fillStyle = '#ece2c0'; g.fillRect(11, 11, 618, 46)
      g.fillStyle = '#cfc094'
      for (let k = 0; k < 41; k++) g.fillRect(16 + k * 15, 11, 3, 498)      // 主纹:竖篾
      g.fillStyle = '#dbcfa6'
      for (let k = 0; k < 15; k++) g.fillRect(11, 24 + k * 33, 618, 3)      // 副纹:横向压条
      // 布包边 —— 旧席只有素色包边,这一张是包了布的
      g.fillStyle = '#7d6a4a'
      g.fillRect(0, 0, 640, 12); g.fillRect(0, 508, 640, 12)
      g.fillRect(0, 0, 12, 520); g.fillRect(628, 0, 12, 520)
      g.fillStyle = '#977f57'; g.fillRect(0, 3, 640, 3); g.fillRect(0, 514, 640, 3)
      g.fillRect(3, 0, 3, 520); g.fillRect(634, 0, 3, 520)
      g.fillStyle = '#6a5a3e'; g.fillRect(0, 11, 640, 2); g.fillRect(0, 507, 640, 2)
      g.fillStyle = 'rgba(136,120,84,0.22)'; g.fillRect(250, 62, 170, 128)   // 他常坐那块,坐塌了
      g.fillStyle = 'rgba(136,120,84,0.15)'; g.fillRect(230, 398, 190, 100)  // 客人常坐那块
      g.restore()
    }
  })



  def("shenyan_cushion_sit", {
    clickable: true, say: '坐了十一年，坐塌了一块',
    name: "蒲团", cat: "坐卧", tags: ["蒲草", "坐塌了"],
    scope: "character", fromRoom: 'shenyan',
    // 130 宽:人坐上去后两侧各还露 21px。110 太小(一坐下只剩两个角,像从身体两侧
    // 长出来的东西),150 又过大(垫子比人还抢眼)。跟坐姿的身宽一起定的。
    w: 130, h: 106, base: 106, foot: [0, 0, 0, 0], zLayer: 'low', walkable: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(65, 55, 62, 44, '#6a5930')                                      // 蒲团
      pxE(65, 51, 56, 40, '#8a7444')
      pxE(65, 50, 48, 34, '#9c8552')
      for (let k = 0; k < 5; k++) {                                       // 盘绕的草绳纹
        const rr = 41 - k * 8
        pxE(65, 50, rr, rr * 0.76, k % 2 ? '#8a7444' : '#94804a')
      }
      g.fillStyle = '#7d6a3c'                                             // 草茎的走向
      for (let k = 0; k < 14; k++) {
        const th = k * 0.449, rr = 44
        g.fillRect(65 + Math.cos(th) * rr * 0.86 | 0, 50 + Math.sin(th) * rr * 0.62 | 0, 4, 3)
      }
      pxE(65, 50, 24, 16, 'rgba(70,58,34,0.38)')                          // ★ 坐了十一年,坐塌的那块
      pxE(65, 49, 16, 10, 'rgba(70,58,34,0.24)')
      g.restore()
    }
  })
  def("shenyan_drying_line", {
    clickable: true, say: '写好的要晾。江南潮，不晾第二天就洇了',
    sayDeep: ['一天晾七八张', '……能卖出去的一两张', '晾着的时候最好看。装裱起来就俗了'],
    name: "晾字绳", cat: "墙面", tags: ["晾字", "梅雨", "表层"],
    scope: "character", fromRoom: 'shenyan', wall: true,
    w: 252, h: 136, base: 136, foot: [0, 136, 252, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#5a5248'; g.fillRect(0, 6, 252, 4)                   // 绳
      g.fillStyle = '#3f3830'; g.fillRect(0, 2, 8, 12); g.fillRect(244, 2, 8, 12)
      const X = [14, 66, 118, 170, 214]
      for (let k = 0; k < X.length; k++) {
        const x = X[k], h = 76 + (k % 3) * 16
        g.fillStyle = '#f2ece0'; g.fillRect(x, 12, 40, h)                 // 晾着的字条
        g.fillStyle = '#e2dac6'; g.fillRect(x, 12, 40, 5)
        if (globalThis.CALLI && k % 2 === 0)
          globalThis.CALLI(g, k === 0 ? '待' : '时', x + 6, 26, 26, '#2b2318', { weight: 1.2 })
        else {
          g.fillStyle = 'rgba(43,35,24,0.6)'
          g.fillRect(x + 12, 30, 14, 4); g.fillRect(x + 12, 44, 14, 4); g.fillRect(x + 12, 58, 14, 4)
        }
        g.fillStyle = '#8a8378'; g.fillRect(x + 16, 4, 6, 10)             // 夹子
        g.fillStyle = 'rgba(43,35,24,0.30)'; g.fillRect(x + 4, 12 + h - 4, 32, 3)  // 墨还没干,下沿洇了
      }
      g.restore()
    }
  })




  def("shenyan_plaque_faced", {
    clickable: true, say: '那块匾……朝里放着就行',
    sayDeep: ['中秀才那年做的', '……做的时候想着，将来挂中堂', '现在朝里放着。挂出来给谁看'],
    name: "朝里放的匾", cat: "陈设", tags: ["中秀才那年", "正面朝墙", "只露背面"],
    scope: "character", fromRoom: 'shenyan',
    w: 200, h: 130, base: 130, foot: [10, 92, 180, 38], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(42,34,26,0.22)'; g.fillRect(12, 112, 176, 12)
      // ── 背面朝外:木纹、两个吊环、一道顺纹的裂 ──
      g.fillStyle = '#3e2e1e'; g.fillRect(8, 14, 184, 104)
      g.fillStyle = '#6a4f33'; g.fillRect(13, 19, 174, 94)
      g.fillStyle = '#7a5c3c'; g.fillRect(13, 19, 174, 10)
      g.fillStyle = '#5a422a'
      for (let k = 0; k < 6; k++) g.fillRect(20, 34 + k * 14, 160, 4)
      g.fillStyle = '#4b3722'; g.fillRect(66, 19, 5, 94); g.fillRect(132, 19, 5, 94)
      g.fillStyle = '#33251a'; g.fillRect(96, 22, 4, 60); g.fillRect(94, 74, 5, 34)   // 那道裂
      g.fillStyle = '#8e7048'                                                          // 吊环
      g.fillRect(44, 24, 20, 7); g.fillRect(140, 24, 20, 7)
      g.fillStyle = '#5c4830'; g.fillRect(48, 28, 12, 4); g.fillRect(144, 28, 12, 4)
      // ── 落了一层灰 ──
      g.fillStyle = 'rgba(206,198,182,0.16)'; g.fillRect(13, 19, 174, 22)
      g.fillStyle = 'rgba(206,198,182,0.10)'; g.fillRect(13, 41, 174, 30)
      // ── 与墙的夹角里,漏出一线当年的金漆 ──
      g.fillStyle = '#2a1f14'; g.fillRect(8, 108, 184, 10)
      g.fillStyle = '#a8842f'; g.fillRect(30, 110, 46, 4); g.fillRect(112, 110, 38, 4)
      g.fillStyle = '#cfa93f'; g.fillRect(36, 110, 20, 2); g.fillRect(120, 110, 16, 2)
      g.restore()
    }
  })

  def("shenyan_stools_stack", {
    clickable: true, say: '以前来测字的人多，要摆三张凳',
    sayDeep: ['现在一张就够', '……多的两张摞起来了', '摞着也好。摞着看不出少了人'],
    name: "摞起的矮凳", cat: "坐卧", tags: ["三张凳", "现在一张就够", "下面那张缺腿"],
    scope: "character", fromRoom: 'shenyan',
    w: 120, h: 140, base: 140, foot: [6, 96, 108, 42], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(44,36,28,0.20)'; g.fillRect(8, 128, 104, 9)
      // ── 底下那张:缺一条腿,拿半块砖垫着 ──
      g.fillStyle = '#8a7f74'; g.fillRect(14, 108, 24, 18)              // 垫的砖
      g.fillStyle = '#9a8f83'; g.fillRect(14, 108, 24, 5)
      g.fillStyle = '#6f594a'; g.fillRect(16, 118, 20, 4)
      g.fillStyle = '#5c422a'; g.fillRect(88, 100, 13, 30)              // 剩下的那条腿
      g.fillStyle = '#6f5233'; g.fillRect(88, 100, 5, 30)
      g.fillStyle = '#4a3520'; g.fillRect(10, 84, 100, 18)
      g.fillStyle = '#71553a'; g.fillRect(14, 87, 92, 12)
      g.fillStyle = '#8a6a48'; g.fillRect(14, 87, 92, 4)
      // ── 上面那张:倒扣着摞上去,四条腿朝天 ──
      g.fillStyle = '#5c4227'; g.fillRect(22, 26, 12, 56); g.fillRect(86, 26, 12, 56)
      g.fillStyle = '#74563a'; g.fillRect(22, 26, 5, 56); g.fillRect(86, 26, 5, 56)
      g.fillStyle = '#4d3722'; g.fillRect(36, 30, 10, 50); g.fillRect(74, 30, 10, 50)
      g.fillStyle = '#3e2c1b'; g.fillRect(12, 76, 96, 12)
      g.fillStyle = '#7d5e3d'; g.fillRect(16, 78, 88, 8)
      g.fillStyle = '#916f49'; g.fillRect(16, 78, 88, 3)
      g.fillStyle = '#5c4227'; g.fillRect(30, 52, 60, 5)                // 横枨
      g.restore()
    }
  })

  def("shenyan_inkbox_stack", {
    clickable: true, say: '用完的墨盒。空的，还摞着',
    name: "空墨盒一摞", cat: "器物", tags: ["用完的", "摞着", "最上面那只还剩个墨头"],
    scope: "character", fromRoom: 'shenyan',
    w: 110, h: 70, base: 70, foot: [0, 20, 110, 50], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,38,30,0.18)'; g.fillRect(6, 60, 96, 7)
      // ── 底下三只:漆磨秃了,层层错开 ──
      const tone = ['#4a3f36', '#554941', '#5f524a']
      for (let k = 0; k < 3; k++) {
        const yy = 52 - k * 10, xx = 6 + k * 4
        g.fillStyle = tone[k]; g.fillRect(xx, yy, 98 - k * 8, 11)
        g.fillStyle = '#6d5f56'; g.fillRect(xx, yy, 98 - k * 8, 3)
        g.fillStyle = '#3a312a'; g.fillRect(xx, yy + 8, 98 - k * 8, 3)
      }
      // ── 最上面那只:盖开着,里面剩个用秃的墨头 ──
      g.fillStyle = '#6a5c53'; g.fillRect(20, 14, 74, 10)              // 掀开的盖
      g.fillStyle = '#7d6e64'; g.fillRect(20, 14, 74, 3)
      g.fillStyle = '#584c44'; g.fillRect(18, 24, 78, 18)
      g.fillStyle = '#4a3f38'; g.fillRect(22, 27, 70, 12)
      g.fillStyle = '#191512'; g.fillRect(34, 30, 26, 8)               // 墨头
      g.fillStyle = '#2c2622'; g.fillRect(34, 30, 26, 3)
      g.fillStyle = '#a89263'; g.fillRect(66, 31, 14, 6)               // 一小截金签
      g.restore()
    }
  })

  def("shenyan_blind_door", {
    clickable: true, say: '门帘。夏天挂，冬天卷起来',
    sayDeep: ['底下那卷是破的', '……去年就该扔', '卷着放着，看不出破'],
    name: "卷起的门帘", cat: "墙面", tags: ["竹帘", "卷着", "底下压着破的那卷"],
    scope: "character", fromRoom: 'shenyan',
    w: 90, h: 200, base: 200, foot: [12, 168, 66, 30], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,38,30,0.18)'; g.fillRect(12, 186, 66, 9)
      // ── 底下:破的那卷,颜色更暗,断篾支棱着 ──
      g.fillStyle = '#6e6042'; g.fillRect(16, 124, 60, 66)
      g.fillStyle = '#7f7150'; g.fillRect(20, 124, 40, 66)
      g.fillStyle = '#544931'
      for (let k = 0; k < 8; k++) g.fillRect(16, 128 + k * 8, 60, 3)
      g.fillStyle = '#8d7f5c'; g.fillRect(74, 138, 12, 3); g.fillRect(76, 156, 10, 3)  // 支棱的断篾
      pxE(46, 124, 30, 9, '#5f5338')
      // ── 上面:好的那卷 ──
      g.fillStyle = '#9a8a5e'; g.fillRect(14, 28, 64, 94)
      g.fillStyle = '#b3a274'; g.fillRect(18, 28, 44, 94)
      g.fillStyle = '#c4b384'; g.fillRect(22, 28, 18, 94)
      g.fillStyle = '#87784f'
      for (let k = 0; k < 11; k++) g.fillRect(14, 34 + k * 8, 64, 3)
      pxE(46, 28, 32, 11, '#7e7049')
      pxE(46, 27, 25, 8, '#a2915f')
      // 吊绳,搭在墙钉上
      g.fillStyle = '#8a7550'; g.fillRect(28, 8, 5, 22); g.fillRect(60, 8, 5, 22)
      g.fillStyle = '#5c5039'; g.fillRect(24, 4, 44, 6)
      g.restore()
    }
  })

  def("shenyan_jars_stack", {
    clickable: true, say: '空坛。腌完了就摞着，等下一季',
    sayDeep: ['最底下那只裂了', '……裂了也摞着，垫高些', '总有一天要用上。腌菜的坛，不嫌多'],
    name: "摞起的空坛", cat: "器物", tags: ["空坛", "摞着", "最底下那只裂了"],
    scope: "character", fromRoom: 'shenyan',
    w: 130, h: 180, base: 180, foot: [8, 132, 114, 46], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(44,36,28,0.20)'; g.fillRect(10, 166, 110, 10)
      // ── 最底下:裂了的那只,釉色最暗 ──
      pxE(65, 148, 55, 17, '#4e4038')
      g.fillStyle = '#5c4c40'; g.fillRect(12, 118, 106, 32)
      g.fillStyle = '#6b594a'; g.fillRect(12, 118, 106, 10)
      g.fillStyle = '#3e332c'                                    // 那道裂
      g.fillRect(44, 120, 4, 18); g.fillRect(46, 136, 4, 14); g.fillRect(42, 144, 5, 8)
      pxE(65, 118, 53, 12, '#7a6656')
      pxE(65, 116, 44, 8, '#4a3d34')
      // ── 中间那只 ──
      g.fillStyle = '#6f5b48'; g.fillRect(18, 70, 94, 46)
      g.fillStyle = '#836d57'; g.fillRect(18, 70, 94, 13)
      g.fillStyle = '#5b4a3a'; g.fillRect(18, 106, 94, 8)
      g.fillStyle = 'rgba(38,30,24,0.24)'; g.fillRect(30, 82, 22, 5); g.fillRect(76, 90, 18, 5)
      pxE(65, 70, 47, 11, '#907a63')
      pxE(65, 68, 38, 7, '#54453a')
      // ── 最上面那只:口朝上,里面是空的 ──
      g.fillStyle = '#7d6752'; g.fillRect(26, 26, 78, 42)
      g.fillStyle = '#94795f'; g.fillRect(26, 26, 78, 12)
      g.fillStyle = '#67543f'; g.fillRect(26, 58, 78, 8)
      pxE(65, 26, 40, 10, '#9c8267')
      pxE(65, 25, 32, 7, '#3c3128')
      g.fillStyle = '#57493c'; g.fillRect(46, 20, 38, 5)
      g.restore()
    }
  })

  def("shenyan_almanacs", {
    clickable: true, say: '历书。今年的压着往年的',
    sayDeep: ['我不看宜忌', '……我看它印的开奖日历', '一本历书，两个人用。看的不是同一页'],
    name: "旧历书一摞", cat: "书卷", tags: ["历书", "今年压着往年", "看的不是宜忌"],
    scope: "character", fromRoom: 'shenyan',
    w: 160, h: 86, base: 86, foot: [0, 22, 160, 64], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,38,30,0.18)'; g.fillRect(8, 76, 144, 8)
      // ── 底下四本:越往下越黄,书口参差 ──
      const yr = ['#a89058', '#b39a63', '#bda56d', '#c7b079']
      for (let k = 0; k < 4; k++) {
        const yy = 68 - k * 9, xx = 8 + k * 3, ww = 146 - k * 6
        g.fillStyle = yr[k]; g.fillRect(xx, yy, ww, 9)
        g.fillStyle = '#8d7743'; g.fillRect(xx, yy + 6, ww, 3)
        g.fillStyle = '#6f5c33'; g.fillRect(xx + ww - 9, yy, 9, 9)     // 书脊
      }
      // ── 最上面那本:今年的,封皮还红 ──
      g.fillStyle = '#8e4034'; g.fillRect(18, 20, 128, 32)
      g.fillStyle = '#a24d3e'; g.fillRect(18, 20, 128, 9)
      g.fillStyle = '#6f2f26'; g.fillRect(18, 46, 128, 6)
      g.fillStyle = '#e8dcc2'; g.fillRect(30, 27, 46, 18)              // 贴的签
      g.fillStyle = '#3a2f26'; g.fillRect(36, 32, 22, 3); g.fillRect(36, 38, 15, 3)
      g.fillStyle = '#d8c98f'                                          // 夹着的纸条
      g.fillRect(104, 16, 12, 40); g.fillRect(122, 18, 10, 36)
      g.fillStyle = '#b9a76d'; g.fillRect(104, 50, 12, 5); g.fillRect(122, 48, 10, 5)
      g.restore()
    }
  })

  def("shenyan_mat_rolled", {
    clickable: true, say: '换下来的旧席。卷着，还能用',
    name: "卷起的旧席", cat: "地面", tags: ["旧席", "卷着", "里面还有更旧的一卷"],
    scope: "character", fromRoom: 'shenyan',
    w: 96, h: 230, base: 230, foot: [10, 194, 76, 34], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,38,30,0.18)'; g.fillRect(10, 214, 76, 10)
      // ── 外层:新换下来的那张,颜色还浅 ──
      g.fillStyle = '#9c8a5e'; g.fillRect(14, 26, 68, 192)
      g.fillStyle = '#b5a375'; g.fillRect(18, 26, 52, 192)
      g.fillStyle = '#c6b585'; g.fillRect(22, 26, 22, 192)
      g.fillStyle = '#8a7a52'
      for (let k = 0; k < 12; k++) g.fillRect(14, 34 + k * 16, 68, 3)
      // 卷口:能看进去,里面还有一卷更旧的
      pxE(48, 26, 34, 12, '#7e6e48')
      pxE(48, 25, 27, 9, '#5f5237')
      pxE(48, 25, 16, 5, '#8e7d55')                                   // 里面那卷的芯
      g.fillStyle = '#4c422c'; g.fillRect(36, 22, 24, 3)
      // 捆席的两道草绳
      g.fillStyle = '#a89263'; g.fillRect(12, 72, 72, 8); g.fillRect(12, 156, 72, 8)
      g.fillStyle = '#c2ad7e'; g.fillRect(12, 72, 72, 3); g.fillRect(12, 156, 72, 3)
      g.fillStyle = '#8a7550'; g.fillRect(40, 68, 6, 16); g.fillRect(40, 152, 6, 16)
      g.restore()
    }
  })

  def("shenyan_clothes_fold", {
    clickable: true, say: '换洗的。就这两件，轮着穿',
    sayDeep: ['底下那件打了补丁', '……我自己缝的，缝得不好', '反正没人看。这话说了三年，我自己都听腻了'],
    name: "叠着的旧衣", cat: "杂物", tags: ["两件轮着穿", "底下那件打补丁"],
    scope: "character", fromRoom: 'shenyan',
    w: 130, h: 90, base: 90, foot: [0, 26, 130, 62], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,38,30,0.18)'; g.fillRect(8, 80, 114, 8)
      // ── 底下:打补丁的那件旧棉衣,布色发灰 ──
      g.fillStyle = '#6d6a63'; g.fillRect(6, 52, 118, 28)
      g.fillStyle = '#7c7972'; g.fillRect(6, 52, 118, 8)
      g.fillStyle = '#5b5851'; g.fillRect(6, 74, 118, 6)
      g.fillStyle = '#8a7f6a'; g.fillRect(28, 58, 22, 16)               // 补丁
      g.fillStyle = '#4e4a42'
      for (let k = 0; k < 6; k++) g.fillRect(29 + k * 4, 57, 2, 2)
      for (let k = 0; k < 6; k++) g.fillRect(29 + k * 4, 73, 2, 2)
      g.fillStyle = '#9c917c'; g.fillRect(84, 62, 15, 11)
      // ── 上面:那件青布的,还整齐 ──
      g.fillStyle = '#3f5468'; g.fillRect(14, 20, 102, 34)
      g.fillStyle = '#4d6479'; g.fillRect(14, 20, 102, 10)
      g.fillStyle = '#334455'; g.fillRect(14, 46, 102, 8)
      g.fillStyle = '#5a7288'; g.fillRect(14, 34, 102, 3)               // 折痕
      g.fillStyle = '#2b3a48'; g.fillRect(56, 20, 5, 34)                // 中缝
      g.fillStyle = '#8ea3b5'; g.fillRect(30, 26, 12, 4); g.fillRect(88, 26, 12, 4)
      g.restore()
    }
  })

  def("shenyan_cat_bowls", {
    clickable: true, say: '三只碗。大的那只是大橘的',
    sayDeep: ['我一个月开三回荤', '……它们一天两回', '它们不认字。这屋里就它们睡得踏实'],
    name: "猫食碗", cat: "器物", tags: ["三只", "大小不一", "它们吃得比我好"],
    scope: "character", fromRoom: 'shenyan',
    w: 168, h: 62, base: 62, foot: [0, 18, 168, 44], zLayer: 'sort', walkable: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,38,30,0.18)'; g.fillRect(8, 52, 152, 7)
      const B = [[34, 40, 30, 15, '#8a7059'], [92, 42, 24, 12, '#7d6a56'], [138, 43, 19, 10, '#8f7a62']]
      for (const [cx, cy, rx, ry, col] of B) {
        pxE(cx, cy, rx, ry, '#4e4038')
        pxE(cx, cy - 1, rx - 2, ry - 2, col)
        pxE(cx, cy - 2, rx - 7, ry - 5, '#3e332c')
      }
      g.fillStyle = '#a8977e'; g.fillRect(20, 36, 12, 4); g.fillRect(126, 40, 9, 3)
      g.restore()
    }
  })

  def("shenyan_cat_nest", {
    clickable: true, say: '拿旧棉絮铺的。三个挤一个窝',
    sayDeep: ['小的那只是去年冬天在门口捡的', '……冻得叫都叫不出声', '我那阵子也快叫不出声了。就这么养着，都活下来了'],
    name: "猫窝", cat: "坐卧", tags: ["旧棉絮", "三个挤一个", "去年冬天"],
    scope: "character", fromRoom: 'shenyan',
    w: 180, h: 120, base: 120, foot: [0, 30, 180, 90], zLayer: 'low', walkable: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,38,30,0.16)'; g.fillRect(10, 104, 160, 8)
      pxE(90, 66, 84, 44, '#6d6156')                                  // 窝沿
      pxE(90, 62, 76, 39, '#8a7c6d')
      pxE(90, 64, 60, 30, '#4e453c')                                  // 窝心,踩得发暗
      pxE(90, 63, 54, 26, '#5d5349')
      g.fillStyle = '#9a8b78'                                          // 翻出来的棉絮
      g.fillRect(24, 44, 22, 8); g.fillRect(140, 50, 20, 8); g.fillRect(74, 30, 26, 7)
      g.fillStyle = '#ada08c'; g.fillRect(28, 44, 12, 4); g.fillRect(144, 50, 11, 4); g.fillRect(80, 30, 14, 3)
      g.fillStyle = '#3f3831'                                          // 掉的毛
      for (let k = 0; k < 9; k++) g.fillRect(40 + k * 13, 58 + (k % 4) * 9, 7, 2)
      g.restore()
    }
  })

  def("shenyan_bundle_drafts", {
    clickable: true, say: '捆好的。捆好就不会再看',
    sayDeep: ['底下那捆是前年的', '……我算过前年那批号，一个没中', '捆着放着。哪天想起来再拆'],
    name: "捆好的旧稿", cat: "杂物", tags: ["旧推算稿", "捆", "压着更旧的"],
    scope: "character", fromRoom: 'shenyan',
    w: 170, h: 84, base: 84, foot: [0, 20, 170, 64], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,38,30,0.18)'; g.fillRect(8, 74, 154, 8)
      // ── 底下那捆:更旧,纸边发暗,只露出一截 ──
      g.fillStyle = '#a89468'; g.fillRect(10, 50, 152, 26)
      g.fillStyle = '#bda87c'; g.fillRect(10, 50, 152, 8)
      g.fillStyle = '#8d7b55'
      for (let k = 0; k < 9; k++) g.fillRect(14 + k * 17, 58, 12, 3)
      g.fillStyle = '#6b5a3c'; g.fillRect(56, 50, 9, 26); g.fillRect(112, 50, 9, 26)
      // ── 上面这捆:新些,纸白 ──
      g.fillStyle = '#e5ddc8'; g.fillRect(16, 18, 140, 34)
      g.fillStyle = '#f1ead8'; g.fillRect(16, 18, 140, 9)
      g.fillStyle = '#d3c9ae'; g.fillRect(16, 46, 140, 6)
      g.fillStyle = '#c4b896'
      for (let k = 0; k < 8; k++) g.fillRect(22 + k * 17, 28, 11, 3)
      g.fillStyle = '#3f352a'; g.fillRect(28, 24, 22, 3); g.fillRect(34, 21, 3, 10)
      // 麻绳十字捆
      g.fillStyle = '#9c8a5e'; g.fillRect(58, 14, 10, 42); g.fillRect(114, 14, 10, 42)
      g.fillStyle = '#b8a473'; g.fillRect(58, 14, 10, 5); g.fillRect(114, 14, 10, 5)
      g.fillStyle = '#7f6f48'; g.fillRect(58, 32, 10, 3); g.fillRect(114, 32, 10, 3)
      g.restore()
    }
  })

  def("shenyan_scrolls_top", {
    clickable: true, say: '架子顶上塞的，够不着就一直塞着',
    name: "架顶的卷轴", cat: "收纳", tags: ["卷轴", "塞在顶上", "压着更旧的"],
    scope: "character", fromRoom: 'shenyan',
    w: 216, h: 58, base: 58, foot: [0, 0, 0, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      // ── 底下那层:横躺的旧卷,轴头参差 ──
      g.fillStyle = '#9d8b64'; g.fillRect(8, 34, 200, 20)
      g.fillStyle = '#b0a077'; g.fillRect(8, 34, 200, 6)
      g.fillStyle = '#5f5138'
      g.fillRect(4, 32, 12, 24); g.fillRect(202, 33, 12, 22)
      g.fillRect(70, 34, 4, 20); g.fillRect(138, 34, 4, 20)
      // ── 上面这层:新卷,纸白些,压着下面那排 ──
      g.fillStyle = '#ddd3ba'; g.fillRect(24, 14, 168, 22)
      g.fillStyle = '#ece4cf'; g.fillRect(24, 14, 168, 7)
      g.fillStyle = '#c6bb9d'; g.fillRect(24, 30, 168, 5)
      g.fillStyle = '#6b5c3f'; g.fillRect(20, 12, 11, 26); g.fillRect(186, 13, 11, 25)
      g.fillStyle = '#8a7854'; g.fillRect(20, 12, 11, 5); g.fillRect(186, 13, 11, 5)
      g.fillStyle = '#a2966f'; g.fillRect(60, 14, 3, 22); g.fillRect(120, 14, 3, 22)
      g.fillStyle = 'rgba(56,46,34,0.20)'; g.fillRect(24, 34, 168, 4)
      g.restore()
    }
  })

  def("shenyan_envelopes", {
    clickable: true, say: '同乡寄的。年年寄，我年年回',
    sayDeep: ['最上面那封还没拆', '……底下压着的是我退回去的', '他寄钱来。我退回去。就这么来回了六年'],
    name: "一叠信封", cat: "书卷", tags: ["同乡来信", "压着退回的"],
    scope: "character", fromRoom: 'shenyan',
    w: 130, h: 62, base: 62, foot: [0, 14, 130, 48], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(46,38,30,0.16)'; g.fillRect(8, 54, 114, 6)
      // ── 底下:退回去的那些,纸黄,盖着退件的红戳 ──
      g.fillStyle = '#d6c69c'; g.fillRect(6, 36, 118, 20)
      g.fillStyle = '#e2d4ad'; g.fillRect(6, 36, 118, 6)
      g.fillStyle = '#bfae83'; g.fillRect(6, 50, 118, 5)
      g.fillStyle = '#a8493c'; g.fillRect(88, 40, 20, 11)
      g.fillStyle = '#c05a49'; g.fillRect(90, 42, 16, 4)
      // ── 上面:新到的那封,还没拆 ──
      g.fillStyle = '#f0ead9'; g.fillRect(12, 12, 108, 28)
      g.fillStyle = '#f7f2e4'; g.fillRect(12, 12, 108, 8)
      g.fillStyle = '#ddd3bb'; g.fillRect(12, 34, 108, 6)
      g.fillStyle = '#cfc3a5'                                   // 信封背面的三角折口
      g.fillRect(46, 12, 40, 4); g.fillRect(52, 16, 28, 4); g.fillRect(60, 20, 12, 4)
      g.fillStyle = '#3d332a'; g.fillRect(20, 22, 26, 3); g.fillRect(20, 28, 18, 3)
      g.restore()
    }
  })

  def("shenyan_hat_umbrella", {
    clickable: true, say: '出门戴的。伞是坏的，一直压在底下',
    sayDeep: ['伞骨断了两根', '……修一修也能用', '说了三年了'],
    name: "斗笠与旧伞", cat: "杂物", tags: ["斗笠", "坏伞", "压在底下"],
    scope: "character", fromRoom: 'shenyan',
    w: 120, h: 170, base: 170, foot: [18, 138, 84, 32], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,38,30,0.18)'; g.fillRect(18, 156, 84, 9)
      // ── 底下:坏伞,斜靠着墙。斗笠遮住它中段,只露出伞头和伞尖 ──
      g.fillStyle = '#3f454d'; g.fillRect(30, 14, 26, 30)
      g.fillStyle = '#525a63'; g.fillRect(30, 14, 9, 30)
      g.fillStyle = '#6b737d'; g.fillRect(52, 18, 13, 4); g.fillRect(56, 26, 12, 4)  // 戳出来的断骨
      g.fillStyle = '#2f353b'; g.fillRect(34, 40, 18, 6)
      g.fillStyle = '#3f454d'; g.fillRect(36, 112, 20, 44)
      g.fillStyle = '#525a63'; g.fillRect(36, 112, 7, 44)
      g.fillStyle = '#8a7248'; g.fillRect(38, 150, 15, 12)                            // 伞柄头
      g.fillStyle = '#a68a58'; g.fillRect(38, 150, 15, 4)
      // ── 上面:斗笠,正面朝外挂着,压住伞的中段 ──
      pxE(60, 84, 50, 40, '#6b5830')
      pxE(60, 82, 46, 36, '#9c8450')
      pxE(60, 78, 36, 27, '#ab9159')
      pxE(60, 72, 22, 16, '#bda068')
      pxE(60, 68, 11, 8, '#c9ac74')
      // 竹篾:同心几圈 + 放射的骨
      g.fillStyle = '#87703e'
      pxE(60, 82, 40, 31, null); g.fillRect(22, 80, 76, 3); g.fillRect(28, 96, 64, 3); g.fillRect(34, 108, 52, 3)
      g.fillStyle = '#7c6637'
      g.fillRect(59, 46, 3, 74); g.fillRect(34, 56, 3, 56); g.fillRect(84, 56, 3, 56)
      g.fillStyle = '#5e4d2b'; g.fillRect(12, 82, 96, 3)                              // 笠檐那一道
      // 系带,从两边垂下来
      g.fillStyle = '#8d7a54'; g.fillRect(26, 112, 5, 30); g.fillRect(90, 112, 5, 26)
      g.fillStyle = '#a5906a'; g.fillRect(26, 112, 5, 8); g.fillRect(90, 112, 5, 8)
      g.restore()
    }
  })

  def("shenyan_crate_couch", {
    clickable: true, say: '塞榻底下了。冬天的东西，夏天用不着',
    sayDeep: ['一床棉被，两件厚衣', '……还有我那身赶考的行头', '那身还留着。不为再穿，是舍不得'],
    name: "榻下木箱", cat: "收纳", tags: ["塞在榻底", "只露一角", "赶考的行头"],
    scope: "character", fromRoom: 'shenyan',
    w: 200, h: 72, base: 72, foot: [0, 24, 200, 48], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = 'rgba(42,34,26,0.22)'; g.fillRect(6, 62, 188, 8)
      // 箱体只露出前面这一截 —— 上半被竹榻压着,画成阴影里
      g.fillStyle = '#3b2b1c'; g.fillRect(4, 12, 192, 54)
      g.fillStyle = '#6b4f33'; g.fillRect(9, 17, 182, 44)
      g.fillStyle = '#7d5e3d'; g.fillRect(9, 17, 182, 9)
      g.fillStyle = 'rgba(28,20,12,0.34)'; g.fillRect(9, 17, 182, 14)   // 榻投下的阴影
      g.fillStyle = '#54402a'; g.fillRect(9, 40, 182, 4); g.fillRect(9, 55, 182, 4)
      g.fillStyle = '#8e7048'; g.fillRect(78, 34, 44, 18)               // 铜面叶
      g.fillStyle = '#a8875a'; g.fillRect(78, 34, 44, 6)
      g.fillStyle = '#4a3a24'; g.fillRect(94, 42, 12, 9)
      g.fillStyle = '#8e7048'; g.fillRect(16, 30, 12, 26); g.fillRect(172, 30, 12, 26)
      // 箱盖没关严,露出一角布 —— 底下压着的那层
      g.fillStyle = '#9aa5b0'; g.fillRect(126, 12, 42, 8)
      g.fillStyle = '#b3bcc6'; g.fillRect(130, 12, 30, 4)
      g.restore()
    }
  })

  def("shenyan_bonsai_pine", {
    clickable: true, say: '这松是同乡中举那年送的',
    sayDeep: ['本来是直的', '……长歪了，我拿绳子绑回来', '绑了六年。它还是要往那边长'],
    name: "松盆景", cat: "陈设", tags: ["盆景", "蟠扎", "同乡所赠"],
    scope: "character", fromRoom: 'shenyan',
    w: 280, h: 420, base: 420, foot: [0, 364, 280, 56], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      // ── 接触阴影 ──
      g.fillStyle = 'rgba(46,38,30,0.20)'; g.fillRect(25, 403, 230, 14)
      // ── 几架 ──
      g.fillStyle = '#4d3722'; g.fillRect(64, 297, 17, 98); g.fillRect(204, 297, 17, 98)
      g.fillStyle = '#6b4e30'; g.fillRect(39, 302, 18, 106); g.fillRect(227, 302, 18, 106)
      g.fillStyle = '#5c4227'; g.fillRect(39, 375, 206, 13)
      g.fillStyle = '#7a5937'; g.fillRect(17, 266, 251, 24)
      g.fillStyle = '#8e6a44'; g.fillRect(17, 266, 251, 8)
      g.fillStyle = '#5c4227'; g.fillRect(17, 286, 251, 7)
      g.fillStyle = '#6b4e30'; g.fillRect(34, 290, 217, 11)
      // ── 粗陶浅盆 ──
      g.fillStyle = '#7d5a48'; g.fillRect(59, 207, 165, 18)
      g.fillStyle = '#936c56'; g.fillRect(59, 207, 165, 7)
      g.fillStyle = '#6d4d3d'; g.fillRect(66, 225, 151, 35)
      g.fillStyle = '#5b3f32'; g.fillRect(66, 249, 151, 11)
      g.fillStyle = '#6d4d3d'; g.fillRect(81, 260, 21, 10); g.fillRect(179, 260, 21, 10)
      g.fillStyle = 'rgba(52,36,28,0.28)'; g.fillRect(84, 230, 36, 4); g.fillRect(157, 238, 28, 4)
      // ── 盆土与青苔 ──
      g.fillStyle = '#3d3125'; g.fillRect(67, 209, 148, 11)
      g.fillStyle = '#5d7248'; g.fillRect(76, 210, 31, 7); g.fillRect(134, 211, 24, 6); g.fillRect(179, 210, 28, 7)
      g.fillStyle = '#6f8656'; g.fillRect(78, 210, 17, 4); g.fillRect(182, 210, 15, 4)
      // ── 主干:从盆心出来,一路往右歪 ──
      g.fillStyle = '#4a3a28'
      g.fillRect(118, 171, 27, 42); g.fillRect(126, 134, 27, 39)
      g.fillRect(139, 104, 25, 34); g.fillRect(150, 78, 21, 28)
      g.fillStyle = '#5e4a33'
      g.fillRect(120, 171, 7, 42); g.fillRect(129, 134, 7, 39); g.fillRect(140, 104, 7, 34)
      g.fillStyle = '#3a2d1f'; g.fillRect(118, 202, 31, 8)          // 露根
      g.fillRect(101, 140, 31, 11); g.fillRect(162, 106, 36, 11)    // 左右两枝
      // ── 云片(四团针叶),压着枝 ──
      pxE(104, 154, 48, 27, '#3b4831')
      pxE(104, 148, 42, 21, '#4d5d3e')
      pxE(210, 148, 32, 18, '#3b4831')
      pxE(210, 144, 28, 14, '#4a5a3c')
      pxE(195, 102, 52, 28, '#3b4831')
      pxE(195, 97, 46, 22, '#526344')
      pxE(141, 57, 57, 31, '#3b4831')
      pxE(141, 52, 52, 25, '#556747')
      g.fillStyle = '#687c51'
      g.fillRect(78, 141, 14, 4); g.fillRect(126, 146, 13, 4); g.fillRect(106, 169, 11, 4)
      g.fillRect(168, 90, 14, 4); g.fillRect(230, 95, 13, 4); g.fillRect(199, 119, 11, 4)
      g.fillRect(115, 45, 14, 4); g.fillRect(174, 46, 13, 4); g.fillRect(144, 35, 11, 4)
      g.fillRect(200, 154, 11, 4); g.fillRect(232, 150, 10, 4)
      // ── 麻绳:从右枝一路拉回左盆沿。绑了六年,还是往那边长 ──
      g.fillStyle = '#a89263'
      for (let k = 0; k < 17; k++) g.fillRect(188 - k * 7, 112 + k * 6, 6, 4)
      g.fillStyle = '#c2ad7e'
      for (let k = 0; k < 8; k++) g.fillRect(186 - k * 15, 112 + k * 13, 4, 3)
      g.fillStyle = '#a89263'; g.fillRect(62, 204, 22, 13)          // 盆沿上的绳结
      g.fillStyle = '#c2ad7e'; g.fillRect(62, 204, 22, 6)
      g.fillStyle = '#8e7b55'; g.fillRect(70, 216, 7, 13)
      g.fillStyle = '#a89263'; g.fillRect(185, 101, 18, 13)         // 枝上勒出的那一圈
      g.fillStyle = '#8e7b55'; g.fillRect(185, 109, 18, 4)
      g.restore()
    }
  })
  def("shenyan_cabinet_low", {
    clickable: true, say: '窗底下这只柜，装的都是没用的东西',
    sayDeep: ['旧笔、干了的墨、写废的帖', '……舍不得扔', '扔了就等于承认那七年白费'],
    name: "窗下矮柜", cat: "收纳", tags: ["矮柜", "旧物", "底层"],
    scope: "character", fromRoom: 'shenyan',
    w: 208, h: 152, base: 152, foot: [0, 40, 208, 112], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#33261a'; g.fillRect(0, 30, 208, 122)
      g.fillStyle = '#63472e'; g.fillRect(5, 35, 198, 112)
      g.fillStyle = '#77593a'; g.fillRect(9, 39, 190, 14)                 // 柜面
      g.fillStyle = '#4a3320'; g.fillRect(9, 74, 190, 5)                  // 中缝
      for (const dx of [0, 96]) {                                         // 两扇门
        g.fillStyle = '#6b543c'; g.fillRect(12 + dx, 82, 88, 58)
        g.fillStyle = 'rgba(46,32,20,0.28)'; g.fillRect(12 + dx, 82, 88, 4)
        g.fillStyle = '#8a7a5c'; g.fillRect(48 + dx, 106, 14, 6)          // 拉手
      }
      // 柜面上摞着的东西(表层)+ 底下露出的黄纸边(底层)
      g.fillStyle = '#efe9db'; g.fillRect(24, 8, 108, 30)
      g.fillStyle = '#e0d8c4'; g.fillRect(24, 8, 108, 5)
      g.fillStyle = '#c9b579'; g.fillRect(20, 32, 116, 8)
      g.fillStyle = '#b08a4a'; g.fillRect(20, 36, 70, 3)
      g.fillStyle = '#5f5348'; g.fillRect(150, 14, 40, 24)                // 一只干墨盒
      g.fillStyle = '#7a6a58'; g.fillRect(150, 14, 40, 6)
      g.restore()
    }
  })

  def("shenyan_blind_rolled", {
    clickable: true, say: '雨大的时候放下来。雨小就不管了',
    name: "卷竹帘", cat: "墙面", tags: ["竹帘", "梅雨"],
    scope: "character", fromRoom: 'shenyan', wall: true,
    w: 236, h: 46, base: 46, foot: [0, 46, 236, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#4a3f22'; g.fillRect(0, 8, 236, 30)                  // 卷起的帘
      g.fillStyle = '#7d6a38'; g.fillRect(4, 10, 228, 26)
      g.fillStyle = '#94804a'; g.fillRect(4, 10, 228, 7)
      g.fillStyle = '#5d5029'
      for (let k = 0; k < 22; k++) g.fillRect(8 + k * 10, 10, 3, 26)      // 竹条
      g.fillStyle = '#3a3119'; g.fillRect(0, 0, 8, 46); g.fillRect(228, 0, 8, 46)
      g.fillStyle = '#b09a62'                                             // 系帘的绳
      g.fillRect(56, 4, 4, 40); g.fillRect(176, 4, 4, 40)
      g.restore()
    }
  })

  def("shenyan_bad_strips", {
    clickable: true, say: '写坏的。串起来挂着，提醒自己手别抖',
    sayDeep: ['一天写坏三张，那天就不测了', '……上个月坏了十一张', '手抖是从第七次落榜那年开始的'],
    name: "写坏的字条串", cat: "墙面", tags: ["写坏的", "底层"],
    scope: "character", fromRoom: 'shenyan', wall: true,
    w: 72, h: 244, base: 244, foot: [0, 244, 72, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#8a8378'; g.fillRect(34, 0, 4, 244)                  // 挂绳
      const Y = [16, 62, 108, 156, 202]
      for (let k = 0; k < Y.length; k++) {
        const y = Y[k], off = (k % 2) ? 6 : 0
        g.fillStyle = '#d8cba6'; g.fillRect(8 + off, y, 56, 40)           // 字条(发黄)
        g.fillStyle = '#c9b579'; g.fillRect(8 + off, y, 56, 6)
        g.fillStyle = 'rgba(43,35,24,0.55)'                               // 写坏的墨
        g.fillRect(16 + off, y + 12, 26, 5); g.fillRect(16 + off, y + 22, 18, 5)
        g.fillStyle = 'rgba(176,58,46,0.6)'; g.fillRect(14 + off, y + 10, 34, 3)  // 划掉的一道
        g.fillStyle = '#5a5248'; g.fillRect(32, y - 4, 6, 8)              // 夹子
      }
      g.restore()
    }
  })

  def("shenyan_flyer_lotto", {
    clickable: true, say: '街口发的。我看看规则改了没有',
    name: "彩票宣传单", cat: "墙面", tags: ["彩票", "宣传单"],
    scope: "character", fromRoom: 'shenyan', wall: true,
    w: 104, h: 42, base: 42, foot: [0, 42, 104, 0], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#f0e4c8'; g.fillRect(0, 0, 104, 42)
      g.fillStyle = '#e8663c'; g.fillRect(0, 0, 104, 12)                  // 红头
      g.fillStyle = '#f4efe2'; g.fillRect(6, 3, 44, 6)
      g.fillStyle = '#c9a05a'                                             // 号码球
      for (let k = 0; k < 5; k++) g.fillRect(8 + k * 18, 18, 12, 12)
      g.fillStyle = '#8a6a3a'
      for (let k = 0; k < 5; k++) g.fillRect(11 + k * 18, 22, 6, 4)
      g.fillStyle = 'rgba(60,52,40,0.5)'; g.fillRect(8, 34, 64, 3)
      g.fillStyle = 'rgba(140,130,110,0.35)'; g.fillRect(0, 38, 104, 4)   // 贴歪的下角
      g.restore()
    }
  })

  def("shenyan_seal_box", {
    clickable: true, say: '落款印。刻的是「砚」字，刻坏过两回',
    name: "印章盒", cat: "文具", tags: ["印", "落款"],
    scope: "character", fromRoom: 'shenyan',
    w: 62, h: 42, base: 42, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#4a3320'; g.fillRect(0, 8, 62, 34)                   // 木盒
      g.fillStyle = '#6b543c'; g.fillRect(3, 11, 56, 28)
      g.fillStyle = '#7d6448'; g.fillRect(3, 11, 56, 7)
      g.fillStyle = '#b03a2e'; g.fillRect(10, 0, 18, 20)                  // 立着的印
      g.fillStyle = '#8a2f24'; g.fillRect(10, 14, 18, 6)
      g.fillStyle = '#d8604a'; g.fillRect(12, 2, 6, 12)
      g.fillStyle = '#c9403a'; g.fillRect(36, 20, 18, 14)                 // 印泥
      g.fillStyle = '#e05a52'; g.fillRect(38, 22, 14, 6)
      g.restore()
    }
  })

  def("shenyan_water_pot", {
    clickable: true, say: '磨墨的水。一天换一回',
    name: "水盂", cat: "文具", tags: ["水盂", "磨墨"],
    scope: "character", fromRoom: 'shenyan',
    w: 44, h: 38, base: 38, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(22, 24, 20, 13, '#7a8d92')
      pxE(22, 21, 16, 10, '#9db0b4')
      pxE(22, 22, 11, 6, '#5a6e74')                                       // 水面
      pxE(20, 20, 5, 3, '#c8dee4')                                        // 高光
      g.fillStyle = '#6b7d82'; g.fillRect(30, 6, 5, 16)                   // 小勺
      g.fillStyle = '#8fa3a8'; g.fillRect(28, 4, 9, 5)
      g.restore()
    }
  })

  def("shenyan_brush_rest", {
    clickable: true, say: '笔搁。三支笔，两支秃了',
    name: "笔架", cat: "文具", tags: ["笔搁", "秃笔"],
    scope: "character", fromRoom: 'shenyan',
    w: 52, h: 72, base: 72, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#4a4238'; g.fillRect(4, 40, 44, 10)                  // 架身
      g.fillStyle = '#6f6558'; g.fillRect(4, 40, 44, 4)
      g.fillStyle = '#3a332c'                                             // 三个齿
      g.fillRect(10, 32, 6, 10); g.fillRect(23, 30, 6, 12); g.fillRect(36, 32, 6, 10)
      g.fillStyle = '#8a7a5c'                                             // 挂着的三支笔
      g.fillRect(8, 6, 5, 30); g.fillRect(21, 4, 5, 32); g.fillRect(34, 8, 5, 28)
      g.fillStyle = '#2f2a22'
      g.fillRect(7, 34, 7, 14); g.fillRect(20, 34, 7, 16); g.fillRect(33, 34, 7, 12)
      g.fillStyle = 'rgba(120,110,90,0.6)'                                // 秃了的两支
      g.fillRect(7, 44, 7, 4); g.fillRect(33, 42, 7, 4)
      g.restore()
    }
  })

  def("shenyan_tube_lots", {
    clickable: true, say: '抽一支，写在这支上的字，就是你的字',
    name: "测字签筒", cat: "器物", tags: ["签筒", "测字"],
    scope: "character", fromRoom: 'shenyan',
    w: 56, h: 112, base: 112, foot: [4, 90, 48, 22], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = '#4a3f22'; g.fillRect(6, 34, 44, 76)
      g.fillStyle = '#7d6a38'; g.fillRect(9, 34, 38, 72)
      g.fillStyle = '#94804a'; g.fillRect(11, 34, 10, 72)
      g.fillStyle = '#5d5029'; g.fillRect(9, 58, 38, 5); g.fillRect(9, 86, 38, 5)
      pxE(28, 36, 21, 7, '#3a3119')
      const SL = [[12, 10], [19, 4], [26, 12], [33, 6], [39, 14]]         // 竹签
      for (const [x, y] of SL) {
        g.fillStyle = '#c9b579'; g.fillRect(x, y, 5, 30)
        g.fillStyle = '#e0d0a0'; g.fillRect(x, y, 5, 6)
        g.fillStyle = 'rgba(43,35,24,0.55)'; g.fillRect(x + 1, y + 10, 3, 3)
      }
      g.restore()
    }
  })

  def("shenyan_copybook_model", {
    clickable: true, say: '临的帖。临了七年，还是不像',
    name: "字帖", cat: "书卷", tags: ["临帖", "表层"],
    scope: "character", fromRoom: 'shenyan',
    w: 128, h: 84, base: 0, foot: [0, 0, 0, 0], zLayer: 'low', walkable: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#d8cba6'; g.fillRect(4, 6, 124, 78)                  // 底下压着自己临的
      g.fillStyle = '#f2ece0'; g.fillRect(0, 0, 122, 76)                  // 表层:原帖
      g.fillStyle = '#e2dac6'; g.fillRect(0, 0, 122, 6)
      g.fillStyle = 'rgba(92,82,64,0.3)'                                  // 田字格
      for (let c = 0; c <= 4; c++) g.fillRect(10 + c * 25, 12, 2, 56)
      for (let r = 0; r <= 2; r++) g.fillRect(10, 12 + r * 28, 102, 2)
      if (globalThis.CALLI) {
        globalThis.CALLI(g, '时', 16, 18, 20, '#2b2318', { weight: 1.1 })
        globalThis.CALLI(g, '待', 66, 44, 20, 'rgba(43,35,24,0.45)', { weight: 1.1 })
      }
      g.fillStyle = '#b03a2e'; g.fillRect(88, 20, 20, 3)                  // 朱笔圈改
      g.restore()
    }
  })

  def("shenyan_calc", {
    clickable: true, say: '算得快。快，可是不准',
    name: "计算器", cat: "电器", tags: ["现代", "推号"],
    scope: "character", fromRoom: 'shenyan',
    w: 72, h: 52, base: 52, foot: [0, 0, 0, 0], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2b2b30'; g.fillRect(0, 0, 72, 52)
      g.fillStyle = '#43434c'; g.fillRect(3, 3, 66, 46)
      g.fillStyle = '#9fc4a0'; g.fillRect(8, 7, 56, 13)                   // 液晶
      g.fillStyle = '#3a4a3a'
      for (let k = 0; k < 4; k++) g.fillRect(44 - k * 9, 11, 5, 6)
      g.fillStyle = '#6f6f7a'                                             // 键
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++)
        g.fillRect(8 + c * 12, 24 + r * 8, 9, 6)
      g.fillStyle = '#c9704a'; g.fillRect(56, 40, 9, 6)
      g.restore()
    }
  })

  def("shenyan_piggy", {
    clickable: true, say: '攒着。攒够了就去买',
    sayDeep: ['一天存两文', '……存到月底，一次买完', '存的时候最踏实。买完就不踏实了'],
    name: "存钱罐", cat: "器物", tags: ["粗陶", "攒钱"],
    scope: "character", fromRoom: 'shenyan',
    w: 72, h: 92, base: 92, foot: [6, 66, 60, 26], zLayer: 'sort',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      pxE(36, 56, 30, 32, '#5f5348')                                      // 罐身
      pxE(32, 52, 24, 26, '#7a6a58')
      pxE(28, 46, 12, 12, '#8f7f6c')                                      // 高光
      g.fillStyle = '#3f3830'; g.fillRect(26, 24, 20, 6)                  // 投币口
      pxE(36, 28, 22, 8, '#4a4038')
      pxE(36, 88, 24, 7, '#3f3830')                                       // 底
      g.fillStyle = '#c9a05a'; g.fillRect(30, 18, 10, 8)                  // 露出半枚钱
      g.fillStyle = '#8a6a3a'; g.fillRect(33, 21, 4, 3)
      g.restore()
    }
  })

  def("shenyan_box_books", {
    clickable: true, say: '这一箱是抄本。抄的比买的多',
    name: "书箱", cat: "收纳", tags: ["抄本", "木箱", "表层"],
    scope: "character", fromRoom: 'shenyan',
    w: 170, h: 112, base: 112, foot: [0, 16, 170, 96], zLayer: 'low',
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#2f2015'; g.fillRect(0, 16, 170, 96)
      g.fillStyle = '#63472e'; g.fillRect(5, 21, 160, 86)
      g.fillStyle = '#77593a'; g.fillRect(9, 25, 152, 14)
      g.fillStyle = 'rgba(46,32,20,0.30)'
      for (let i = 0; i < 2; i++) g.fillRect(14, 56 + i * 22, 146, 3)
      g.fillStyle = '#3f3028'; g.fillRect(5, 21, 18, 18); g.fillRect(147, 21, 18, 18)
      // 箱盖开着,里面立着抄本(表层)
      const C = ['#8a6a4a', '#6f5540', '#95765a', '#7d5f46', '#8a6a4a']
      for (let k = 0; k < 5; k++) {
        g.fillStyle = C[k]; g.fillRect(22 + k * 26, 0, 22, 24)
        g.fillStyle = 'rgba(240,232,210,0.7)'; g.fillRect(24 + k * 26, 0, 18, 4)
      }
      g.fillStyle = '#c9b579'; g.fillRect(22, 20, 126, 6)                 // 箱口露出的黄纸
      g.restore()
    }
  })

  def("shenyan_letter", {
    clickable: true, say: '同乡的信。他中了举',
    sayDeep: ['信里说，让我别灰心', '……他是好意', '我回了。回信写了三遍才写完'],
    name: "同乡的信", cat: "书卷", tags: ["中举", "底层"],
    scope: "character", fromRoom: 'shenyan',
    w: 96, h: 64, base: 0, foot: [0, 0, 0, 0], zLayer: 'low', walkable: true,
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      g.fillStyle = '#e8dfc4'; g.fillRect(0, 6, 92, 56)                   // 摊开的信纸
      g.fillStyle = '#f2ece0'; g.fillRect(2, 4, 88, 52)
      g.fillStyle = '#dcd2b8'; g.fillRect(2, 4, 88, 5)
      g.fillStyle = 'rgba(51,44,34,0.55)'                                 // 竖排的字
      for (let c = 0; c < 5; c++) for (let r = 0; r < 4; r++)
        if ((c + r) % 5) g.fillRect(10 + c * 16, 12 + r * 10, 6, 6)
      g.fillStyle = '#b03a2e'; g.fillRect(72, 40, 12, 12)                 // 他的印
      g.fillStyle = '#c9b579'; g.fillRect(0, 50, 92, 10)                  // 压在下面的信封
      g.fillStyle = '#b08a4a'; g.fillRect(0, 55, 56, 4)
      g.restore()
    }
  })

  def("shenyan_raincoat", {
    clickable: true, say: '蓑衣。出门测字要带，江南的雨说来就来',
    sayDeep: ['棕丝烂了半边', '……下小雨够用', '下大雨我就不出门。反正也没人等我'],
    name: "蓑衣", cat: "杂物", tags: ["棕丝", "江南雨", "挂着"],
    scope: "character", fromRoom: 'shenyan',
    w: 104, h: 190, base: 190, foot: [22, 168, 60, 22], zLayer: 'sort',
    /* 原先它连斗笠一起画,和门边那件「斗笠与旧伞」功能重了,
       而且立在地上一根,读起来是根柱子。斗笠归那件,这里只剩蓑衣,
       并且画成【挂在钉子上】—— 肩宽、身子层层散开、下摆参差,才不是柱子。 */
    draw(g) {
      g.save(); g.scale(0.5, 0.5)
      const pxE = (...a) => PRIM.pxE(g, ...a)
      g.fillStyle = 'rgba(46,38,30,0.16)'; g.fillRect(24, 178, 56, 8)
      // 墙钉与挂绳
      g.fillStyle = '#5c5148'; g.fillRect(46, 6, 12, 7)
      g.fillStyle = '#7a6e60'; g.fillRect(46, 6, 12, 3)
      g.fillStyle = '#8d7a52'; g.fillRect(50, 12, 4, 16)
      // 蓑衣领 —— 肩要宽,一眼是件衣裳不是一根柱
      g.fillStyle = '#6b5730'; g.fillRect(24, 26, 56, 14)
      g.fillStyle = '#836c3d'; g.fillRect(24, 26, 56, 5)
      g.fillStyle = '#5a4826'; g.fillRect(24, 37, 56, 4)
      g.fillStyle = '#7a6437'; g.fillRect(14, 32, 76, 12)
      g.fillStyle = '#8d7444'; g.fillRect(14, 32, 76, 4)
      // 棕丝:一层层往下散,每层比上一层宽一点、参差一点
      const LAY = [[16, 44, 72], [12, 62, 80], [8, 82, 88], [6, 104, 92], [8, 126, 88]]
      for (let n = 0; n < LAY.length; n++) {
        const [x0, y0, ww] = LAY[n]
        g.fillStyle = n % 2 ? '#7a6437' : '#6f5a31'
        g.fillRect(x0, y0, ww, 22)
        g.fillStyle = n % 2 ? '#8d7444' : '#7f6939'
        g.fillRect(x0, y0, ww, 6)
        g.fillStyle = '#523f21'
        for (let k = 0; k < 11; k++) g.fillRect(x0 + 4 + k * (ww / 11 | 0), y0 + 5, 2, 17)
      }
      // 下摆:长短不齐的丝尾
      const TIP = [10, 22, 16, 30, 18, 26, 14, 24, 12, 20, 15]
      for (let k = 0; k < TIP.length; k++) {
        g.fillStyle = k % 2 ? '#6f5a31' : '#7a6437'
        g.fillRect(10 + k * 8, 146, 6, TIP[k])
        g.fillStyle = '#523f21'; g.fillRect(10 + k * 8, 146 + TIP[k] - 3, 6, 3)
      }
      // 烂掉的那半边 —— 台词说的就是它
      g.fillStyle = 'rgba(58,44,24,0.42)'; g.fillRect(62, 96, 30, 52)
      g.fillStyle = '#4a3a1e'; g.fillRect(74, 110, 14, 26); g.fillRect(66, 128, 10, 18)
      g.restore()
    }
  })
