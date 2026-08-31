
(function () {
  /* 这支脚本【不碰浏览器】。取画布、取贴图、驱动帧都是宿主的事,
     在文件末尾单独一段:设计页那段用 document + requestAnimationFrame,
     小程序那边用它自己的。中间这三千多行两边共用,一个字不改。

     贴图(16x16 的 tilemap_packed.png)由宿主加载好传进来 —— 加载一张图
     在两个平台上完全是两件事(<img> vs canvas.createImage),而画法一样。 */
  let img = null
  /* 村子的尺寸。2026-08-17 往南扩了一片新住区:44 行 → 60 行(+512px)。
     林带留在原处,老村一栋房都没挪 —— 新地在林子那头。

     尺寸挂到 VILLAGE_SIZE 上,宿主与页面从那里读。扩之前这个数被抄了四份
     (这里两处、设计页的 <canvas> 标签、小程序适配、小程序页面),
     改一次要找四个地方,漏一个就是画布尺寸与内容对不上 —— 那种错不抛异常。 */
  const VW = 704, VH = 960
  globalThis.VILLAGE_SIZE = { w: VW, h: VH }
  const bg = globalThis.ENGINE_HOST.createCanvas(VW, VH)
  // 水上前景层(桥/码头/荷叶/芦苇 · 覆盖水面动画)
  const fg = globalThis.ENGINE_HOST.createCanvas(VW, VH)
  const bgG = bg.getContext('2d')
  const fgG = fg.getContext('2d')
  bgG.imageSmoothingEnabled = false
  fgG.imageSmoothingEnabled = false
  let g = bgG
  const W = VW, H = VH, T = 32, COLS = 22, ROWS = 30

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const GRASS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
  const DIRT = [12, 24, 36]
  const STONE = [96, 108, 120]
  function tile(idx, tx, ty) {
    g.drawImage(img, (idx % 12) * 16, ((idx / 12) | 0) * 16, 16, 16, tx * T, ty * T, T, T)
  }
  function px(x, y, w2, h2, c) { g.fillStyle = c; g.fillRect(x, y, w2, h2) }
  function shadow(cx, cy, w2, h2) {
    g.fillStyle = 'rgba(40,60,20,0.28)'
    g.fillRect(cx - (w2 >> 1), cy, w2, h2)
  }
  function glowG(x, y, r, color) {
    const gr = g.createRadialGradient(x, y, 2, x, y, r)
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const C = {
    K: '#3a2c20', F: '#f0c8a0', E: '#4a3626', H: '#4a3a2c', j: '#a8845a', r: '#e89080',
    B: '#5a7a96', b: '#4c6a8c', P: '#e87a90', p: '#c85a78',
    V: '#7a5a9a', v: '#6a4a8a', M: '#a84838', m: '#8a3a2c',
    y: '#e8b23d', Y: '#ffd76a', W: '#f6efdc', u: '#ddd0b0',
    N: '#a06a40', n: '#7e5230', X: '#e8e0d0', O: '#e89040',
    R: '#d05848', L: '#8ec858', J: '#5a9438', q: '#3e6a34',
    G: '#5a8a44', Z: '#9a938a', z: '#6e675e', A: '#2a2a30',
  }
  const SPR = {}
  function def(name, s) { SPR[name] = s.trim().split('\n').map(r => r.trimEnd()) }
  def('ayun1', `
.....KHHK...
..KjjKHHKjjK
....KKKKKK..
...KHHHHHHK.
..KHHHHHHHHK
..KHFFFFFFHK
..KFKKFFKKFK
..KFFFFFFFFK
..KFPFFFFPFK
...KFFFFFFK.
....KKKKKK..
....KBBBBK..
...KBBBBBBK.
...KBbbbbBK.
...KBBBBBBK.
...KBK..KBK.
...KFK..KFK.`)
  def('ayun2', `
.....KHHK...
..KjjKHHKjjK
....KKKKKK..
...KHHHHHHK.
..KHHHHHHHHK
..KHFFFFFFHK
..KFKKFFKKFK
..KFFFFFFFFK
..KFPFFFFPFK
...KFFFFFFK.
....KKKKKK..
....KBBBBK..
...KBBBBBBK.
...KBbbbbBK.
...KBBBBBBK.
..KBK....KBK
..KFK....KFK`)
  def('ayunS1', `
...KHK....
.KjjHK....
..KKKK....
.KHHHHK...
.KHFFFK...
.KFKFFK...
.KFFFFK...
.KFPFK....
..KFFK....
..KKK.....
.KBBBK....
KBBBBK....
KBbBK.....
.KBBK.....
.KBKBK....
.KFKFK....`)
  def('ayunS2', `
...KHK....
.KjjHK....
..KKKK....
.KHHHHK...
.KHFFFK...
.KFKFFK...
.KFFFFK...
.KFPFK....
..KFFK....
..KKK.....
.KBBBK....
KBBBBK....
KBbBK.....
.KBBK.....
KBKKBK....
KFKKFK....`)
  def('ayunU1', `
.....KHHK...
..KjjKHHKjjK
....KKKKKK..
...KHHHHHHK.
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
...KHHHHHHK.
....KKKKKK..
....KBBBBK..
...KBBBBBBK.
...KBBBBBBK.
...KBBBBBBK.
...KBK..KBK.
...KFK..KFK.`)
  def('ayunU2', `
.....KHHK...
..KjjKHHKjjK
....KKKKKK..
...KHHHHHHK.
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
...KHHHHHHK.
....KKKKKK..
....KBBBBK..
...KBBBBBBK.
...KBBBBBBK.
...KBBBBBBK.
..KBK....KBK
..KFK....KFK`)
  def('taoS1', `
...KK.....
..KHHK....
..KHHHK...
..KHHFFK..
..KHFEFK..
..KHFFFrK.
..KFFFFK..
...KKKK...
..KPPPPK..
.KPPPPPK..
.KPPPPK...
..KPPPK...
..KPKPK...
..KFKFK...`)
  def('taoS2', `
...KK.....
..KHHK....
..KHHHK...
..KHHFFK..
..KHFEFK..
..KHFFFrK.
..KFFFFK..
...KKKK...
..KPPPPK..
.KPPPPPK..
.KPPPPK...
..KPPPK...
.KPKKPK...
.KFKKFK...`)
  def('taoU1', `
...KK....KK.
..KHHK..KHHK
..KHHHKKHHHK
...KHHHHHHK.
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
...KHHHHHHK.
....KKKKKK..
...KPPPPPPK.
..KPPPPPPPPK
..KPPPPPPPPK
..KqqPPPPqqK
...KPKKKPK.
...KFK.KFK.`)
  def('taoU2', `
...KK....KK.
..KHHK..KHHK
..KHHHKKHHHK
...KHHHHHHK.
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
...KHHHHHHK.
....KKKKKK..
...KPPPPPPK.
..KPPPPPPPPK
..KPPPPPPPPK
..KqqPPPPqqK
...KPK.KPK.
...KFK.KFK.`)
  def('tenzS1', `
..KKKKK...
.KFFFFFK..
.KFFKFFK..
.KFFFEFFK.
.KFFFFFFK.
.KFFFFFK..
..KFFKK...
..KKKKK...
.KyMMK...
KMMMMMMK.
KMMMMMK..
.KMMMK...
.KMKKMK...
.KFK.FK...`)
  def('tenzS2', `
..KKKKK...
.KFFFFFK..
.KFFKFFK..
.KFFFEFFK.
.KFFFFFFK.
.KFFFFFK..
..KFFKK...
..KKKKK...
.KyMMK...
KMMMMMMK.
KMMMMMK..
.KMMMK...
KMKKMK....
KFK.FK....`)
  def('tenzU1', `
....KKKKKK..
...KFFFFFFK.
..KFFFFFFFFK
..KFFFFFFFFK
..KFFFFFFFFK
..KFFFFFFFFK
..KFFFFFFFFK
...KFFFFFFK.
...KKKKKKKK.
..KyMMMMMMK.
.KMMMMMMMMK
.KMMMMMMMMK
.KmmMMMMMMK
..KMK..KMK.
..KFK..KFK.`)
  def('tenzU2', `
....KKKKKK..
...KFFFFFFK.
..KFFFFFFFFK
..KFFFFFFFFK
..KFFFFFFFFK
..KFFFFFFFFK
..KFFFFFFFFK
...KFFFFFFK.
...KKKKKKKK.
..KyMMMMMMK.
.KMMMMMMMMK
.KMMMMMMMMK
.KmmMMMMMMK
.KMK....KMK
.KFK....KFK`)
  def('villmS1', `
..KKK..
.KhhhK.
.KhFFK.
.KhFEK.
.KhFFK.
..KFK..
.KbbbK.
KbbbbbK
KbbbbbK
KbbbbK.
.KbbbK.
.KbKbK.
.KFKFK.
.KK.KK.`)
  def('villmS2', `
..KKK..
.KhhhK.
.KhFFK.
.KhFEK.
.KhFFK.
..KFK..
.KbbbK.
KbbbbbK
KbbbbbK
KbbbbK.
.KbbbK.
KbKKbK.
KFKKFK.
KK..KK.`)
  def('villmU1', `
....KKKK....
...KhhhhK...
...KhhhhK...
...KhhhhK...
....KhhK....
..KbbbbbbK..
.KbbbbbbbbK.
.KbbbbbbbbK.
.KbbbbbbbbK.
..KbbbbbbK..
..KbbKKbbK..
..KbK..KbK..
..KFK..KFK..`)
  def('villmU2', `
....KKKK....
...KhhhhK...
...KhhhhK...
...KhhhhK...
....KhhK....
..KbbbbbbK..
.KbbbbbbbbK.
.KbbbbbbbbK.
.KbbbbbbbbK.
..KbbbbbbK..
..KbbKKbbK..
.KbK....KbK.
.KFK....KFK.`)
  def('tao1', `
...KK....KK.
..KHHK..KHHK
..KHHHKKHHHK
...KHHHHHHK.
..KHHHHHHHHK
..KHFFFFFFHK
..KFEFFFFEFK
..KFFFFFFFFK
..KFrFFFFrFK
...KFFFFFFK.
....KKKKKK..
...KPPPPPPK.
..KPPPPPPPPK
..KPPKKKKPPK
..KqqPPPPqqK
...KPKKKPK.
...KFK.KFK.`)
  def('tao2', `
...KK....KK.
..KHHK..KHHK
..KHHHKKHHHK
...KHHHHHHK.
..KHHHHHHHHK
..KHFFFFFFHK
..KFEFFFFEFK
..KFFFFFFFFK
..KFrFFFFrFK
...KFFFFFFK.
....KKKKKK..
...KPPPPPPK.
..KPPPPPPPPK
..KPPKKKKPPK
..KqqPPPPqqK
...KPK.KPK.
...KFK.KFK.`)
  def('popofly', `
........KK..........
.......KVVK.........
......KVVVK.........
.....KVVVVK.........
....KVVVVVVK........
...KKKKKKKKKK.......
....KXXFFXXK........
....KXFEFFXK........
.....KFFFFK.........
....KVVVVVVKK.......
...KVVVVVVVVNNNNKyy.
....KVVKVVK.NNNNyYYy
................KyYy
.................Kyy`)
  def('tenz1', `
....KKKKKK..
...KFKFFKFK.
..KFFFFFFFFK
..KFKKFFKKFK
..KFAFFFFAFK
..KFFFFFFFFK
..KFFFFFFFFK
...KFFFFFFK.
...KKKKKKKK.
...KMMMFFFK.
..KyMMMMFFFK
..KyyMMMMMFK
..KmmMMMMMMK
...KK....KK.
..KFK....KFK`)
  def('tenz2', `
....KKKKKK..
...KFKFFKFK.
..KFFFFFFFFK
..KFKKFFKKFK
..KFAFFFFAFK
..KFFFFFFFFK
..KFFFFFFFFK
...KFFFFFFK.
...KKKKKKKK.
...KMMMFFFK.
..KyMMMMFFFK
..KyyMMMMMFK
..KmmMMMMMMK
..KK......KK
.KFK......KF`)
  def('treeS', `
....KKKK....
..KKLLLLKK..
.KLLLLLLJJK.
.KLLLLLJJJK.
KLLLLLJJJJJK
KLLLJJJJJJJK
.KLJJJJJJJK.
..KKJJJJKK..
....KNNK....
....KNnK....`)
  def('treeR', `
...KKKKK....
..KLLLJJK...
.KLLLLJJJK..
KLLLLLJJJJK.
KLLLLJJJJJK.
KLLJJJJJJqK.
.KLJJJJqqK..
..KKJJqqK...
....KNNK....
....KNnK....`)
  def('treeT', `
....KK....
...KLJK...
..KLLJJK..
.KLLLJJJK.
KLLLLJJJqK
.KLLJJJqK.
..KLJJqK..
...KJqK...
...KNK....
...KnK....`)
  def('villm1', `
....KKKK....
...KhhhhK...
...KhhhhK...
...KFFFFK...
...KFEEFK...
...KFFFFK...
....KFFK....
..KbbbbbbK..
.KbbbbbbbbK.
.KbbbbbbbbK.
.KbbbbbbbbK.
..KbbbbbbK..
..KbbKKbbK..
..KbK..KbK..
..KFK..KFK..
...KK..KK...`)
  def('villm2', `
....KKKK....
...KhhhhK...
...KhhhhK...
...KFFFFK...
...KFEEFK...
...KFFFFK...
....KFFK....
..KbbbbbbK..
.KbbbbbbbbK.
.KbbbbbbbbK.
.KbbbbbbbbK.
..KbbbbbbK..
..KbbKKbbK..
...KbKKbK...
...KFKKFK...
....KKKK....`)
  def('dog1', `
.........yyy.
.YY....yyyyyy
YYYy..yyyyyNN
.yyyyyyyyyyNK
.yyyyyyyyyKNN
.yyyyyyyyyKN.
.yK.yy.yyK...
..K...yy.K...`)
  def('dog2', `
.........yyy.
.YY....yyyyyy
YYYy..yyyyyNN
.yyyyyyyyyyNK
.yyyyyyyyyKNN
.yyyyyyyyyKN.
..yKyy.yK....
...K.yy..K...`)
  def('cat1', `
K.K.....
KOKKKO..
.OOOOOO.
.OOOOOOn
.OK.OK..`)
  def('cat2', `
K.K.....
KOKKKO..
.OOOOOO.
nOOOOOO.
..KO.KO.`)
  def('bird1', `
.K....K.
KKXXXXKK
..KXXK..`)
  def('bird2', `
KK....KK
.KXXXXK.
..KXXK..`)
  def('dfly1', `
.W.KK.W.
.WKKKKW.
..KKKK..
...KK...
...KK...`)
  def('dfly2', `
W..KK..W
.WKKKKW.
..KKKK..
...KK...
...KK...`)
  def('duck1', `
.KK.....
KWWKKK..
KWWWWWK.
.KWWWWO.
..KKKK..`)
  def('duck2', `
.KK.....
KWWKKK..
KWWWWWK.
.KWWWWO.
..KKK...`)
  function sprTo(ctx, name, x, y, sc, flip, remap) {
    const rows = SPR[name]
    ctx.save()
    if (flip) { ctx.translate(x + rows[0].length * sc, y); ctx.scale(-1, 1); x = 0; y = 0 }
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < rows[r].length; c++) {
        let ch = rows[r][c]
        if (ch === '.' || ch === ' ') continue
        if (remap && remap[ch]) ch = remap[ch]
        ctx.fillStyle = C[ch] || ch
        ctx.fillRect(x + c * sc, y + r * sc, sc, sc)
      }
    ctx.restore()
  }
  const spr = (n, x, y, sc, fl, rm) => sprTo(g, n, x, y, sc, fl, rm)
  // 角色规范绘制(读 window.CHARSPEC · footY 底对齐 · side 朝右默认)
  function drawSpecTo(ctx, key, ori, f, x, footY, sc, flip) {
    const cs = window.CHARSPEC[key]
    const g1 = cs[ori] || cs.front
    const g2 = cs[ori + '2']
    const bb = ori === 'side' ? cs.bbS : ori === 'back' ? cs.bbB : cs.bb
    const use = (f && g2) ? g2 : g1
    const w = bb.w * sc, h = bb.h * sc
    const ox = x + (32 - w) / 2, oy = footY - h
    ctx.save()
    if (flip) { ctx.translate(ox + w, oy); ctx.scale(-1, 1) } else ctx.translate(ox, oy)
    for (let yy = bb.y0; yy < bb.y0 + bb.h; yy++) {
      const row = use.g[yy]; if (!row) continue
      for (let xx = bb.x0; xx < bb.x0 + bb.w; xx++) {
        const c = row[xx]; if (!c) continue
        ctx.fillStyle = c
        ctx.fillRect((xx - bb.x0) * sc, (yy - bb.y0) * sc, sc, sc)
      }
    }
    ctx.restore()
  }
  function tree(x, y, sc, rm, vr, fl) {
    const nm = vr || 'treeS'
    const w2 = SPR[nm][0].length
    shadow(x + w2 / 2 * sc, y + 9.6 * sc, w2 * 0.7 * sc, 1.6 * sc)
    spr(nm, x, y, sc, !!fl, rm)
  }
  // ── 树种(叶簇法:L 亮 / J 中 / q 暗 三色阶叠出立体,右上受光、左下背光)──
  def('treeB', `
...KKKKKK...
..KLLLLLJK..
.KLLLLLJJJK.
KLLLLLJJJJJK
KLLLLJJJJJqK
KLLJJJJJqqqK
.KLJJJJqqqK.
..KJJJqqqK..
...KKJJKK...
.....KNK....
.....KNK....
.....KnK....`)
  def('treeC', `
....KK....
...KLJK...
..KLJJqK..
.KKLJJqKK.
...KLJK...
..KLJJqK..
.KLLJJJqK.
KKLJJJqqKK
...KLJK...
..KLJJqK..
.KLLJJJqK.
KLLJJJqqqK
....KNK...
....KnK...`)
  def('treeF', `
...KKKK...
..KLLLJK..
.KLRLLJJK.
.KLLLJRJK.
KLLLJJJJqK
KLRLJJJRqK
.KLJJJqqK.
..KKJqqK..
....KNK...
....KnK...`)
  def('bambo', `
..K.K..K..
.LJ.J.LJ..
..J.J..J..
.LJ.J.LJ..
..J.J..J..
.LJ.J.LJ..
..J.J..J..
..J.J..J..
..N.N..N..
..n.n..n..`)
  def('treeD', `
..K....K..
..KN..NK..
...KNNK...
..K.KNK.K.
...KNNNK..
..KN.N.NK.
....KNK...
....KNK...
....KnK...`)
  const TV = ['treeS', 'treeR', 'treeT', 'treeB', 'treeS', 'treeR', 'treeB']
  const TV_CONIF = ['treeC', 'treeC', 'treeT']            // 针叶:山脚 / 林缘
  const TV_ORCH  = ['treeF', 'treeF', 'treeS']            // 果树:村里 / 田边
  const PINE_RM   = { L: '#5a9a52', J: '#3e7a44', q: '#2a5a32' }   // 针叶偏冷绿
  const AUT_RM    = { L: '#e8c060', J: '#d09038', q: '#a86828' }   // 秋色一株半株
  const PEACH_RM = { L: '#f0a8bc', J: '#e87a90', q: '#c85a78' }


  // ═══════════ 建筑库 ═══════════
  // 规则来自 SLYNYRD Pixelblog 44/45:
  //  · 砖 = 先铺砖缝(grout)作网格,再一块块填砖;变化靠个别褪色/裂砖,不靠全局噪点
  //  · 配色 = 亮部偏黄、暗部偏冷紫(不是简单加白加黑)
  //  · 门窗 = 由布局引擎统一排布,保证永不重叠
  const wrnd = mulberry32(7731)
  function hx2rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] }
  const cl = v => v < 0 ? 0 : v > 255 ? 255 : v | 0
  function sh(h, amt) {                                  // 色相偏移:亮 → 偏黄,暗 → 偏冷紫
    const [r, g2, b] = hx2rgb(h)
    return amt >= 0
      ? `rgb(${cl(r + amt * 1.05)},${cl(g2 + amt * 0.92)},${cl(b + amt * 0.40)})`
      : `rgb(${cl(r + amt * 0.92)},${cl(g2 + amt * 1.05)},${cl(b + amt * 0.72)})`
  }
  // ── 墙材 ──
  function matBrick(x, y, w2, h2, base) {                // 砖:先缝后砖 · 错缝 · 个别褪色/裂
    px(x, y, w2, h2, sh(base, -26))                      // 砖缝铺底(浅 —— 深缝会把墙压成网格)
    const BW = 13, BH = 6                                // 砖块放大:一面墙只排 6-7 行
    for (let r = 0, row = 0; r + 2 < h2; r += BH, row++) {
      const off = row % 2 ? -4 : 0
      for (let c = off; c < w2 - 1; c += BW) {
        const bx = x + Math.max(0, c), bw = Math.min(BW - 1, x + w2 - 1 - bx)
        if (bw < 2) continue
        const v = wrnd()
        const bc = v < 0.10 ? sh(base, -12) : v < 0.22 ? sh(base, 10) : base
        px(bx, y + r, bw, BH - 1, bc)
        px(bx, y + r, bw, 1, sh(base, 13))               // 砖顶受光
        if (v > 0.96 && bw > 5) px(bx + 2, y + r + 2, 3, 1, sh(base, -22))   // 个别裂纹
      }
    }
  }
  function matStone(x, y, w2, h2, base) {                // 石:大小不一的石块 + 深缝
    px(x, y, w2, h2, sh(base, -30))
    for (let r = 0; r + 3 < h2; r += 10) {
      let c = (r / 7 | 0) % 2 ? 0 : 5
      while (c < w2 - 2) {
        const bw = 11 + ((wrnd() * 9) | 0)
        const w3 = Math.min(bw, w2 - 1 - c)
        if (w3 < 3) break
        const v = wrnd()
        const bc = v < 0.2 ? sh(base, -14) : v > 0.8 ? sh(base, 12) : base
        px(x + c, y + r, w3, 9, bc)
        px(x + c, y + r, w3, 1, sh(base, 13))
        px(x + c, y + r + 8, w3, 1, sh(base, -16))
        c += w3 + 1
      }
    }
  }
  function matPlank(x, y, w2, h2, base) {                // 木板:竖板 + 板缝 + 木纹 + 节疤
    px(x, y, w2, h2, sh(base, -22))
    for (let c = 0; c < w2; c += 12) {
      const bw = Math.min(11, w2 - c)
      if (bw < 2) continue
      const v = wrnd()
      const bc = v < 0.25 ? sh(base, -11) : v > 0.75 ? sh(base, 10) : base
      px(x + c, y, bw, h2, bc)
      px(x + c, y, 1, h2, sh(base, 15))                  // 板的受光边
      for (let k = 0; k < 1; k++) {                      // 木纹(少量即可)
        const gy = y + 4 + ((wrnd() * (h2 - 8)) | 0)
        px(x + c + 1, gy, bw - 2, 1, sh(base, -13))
      }
      if (wrnd() < 0.14) {                               // 节疤
        const ky = y + 5 + ((wrnd() * (h2 - 12)) | 0)
        px(x + c + 2, ky, 3, 3, sh(base, -26))
        px(x + c + 3, ky + 1, 1, 1, sh(base, -40))
      }
    }
  }
  function matPlaster(x, y, w2, h2, base) {              // 灰泥:平整 + 少量斑驳 + 墙角污渍
    px(x, y, w2, h2, base)
    for (let i = 0; i < (w2 * h2) / 90; i++) {
      const dx = (wrnd() * w2) | 0, dy = (wrnd() * h2) | 0
      px(x + dx, y + dy, 1 + ((wrnd() * 2) | 0), 1, wrnd() < 0.5 ? sh(base, 12) : sh(base, -10))
    }
    for (let k = 0; k < 3; k++) {                        // 檐下雨痕
      const sx = x + 4 + ((wrnd() * (w2 - 8)) | 0)
      px(sx, y + 3, 1, 6 + ((wrnd() * 8) | 0), sh(base, -12))
    }
    px(x, y + h2 - 5, w2, 5, sh(base, -14))              // 墙脚污渍
  }
  const MATS = [matBrick, matPlank, matStone, matPlaster]
  function wall(x, y, w2, h2, base, kind) {             // 墙 = 材质 + 统一的受光/檐影
    MATS[kind % 4](x, y, w2, h2, base)
    px(x, y, w2, 3, 'rgba(30,22,40,0.20)')               // 檐影
    px(x, y, 2, h2, 'rgba(255,246,220,0.13)')            // 受光侧
    px(x + w2 - 2, y, 2, h2, 'rgba(30,22,40,0.11)')      // 背光侧
  }
  // ── 屋顶瓦 ──
  function matTile(x, y, w2, h2, base) {                 // 瓦:错缝 + 每片上沿高光下沿阴影
    px(x, y, w2, h2, sh(base, -28))
    const TW = 10, TH = 7
    for (let r = 0, row = 0; r < h2; r += TH, row++) {
      const off = row % 2 ? -3 : 0
      for (let c = off; c < w2; c += TW) {
        const tx2 = x + Math.max(0, c), tw = Math.min(TW - 1, x + w2 - tx2)
        if (tw < 2) continue
        const v = wrnd()
        const tc = v < 0.16 ? sh(base, -12) : v > 0.84 ? sh(base, 11) : base
        px(tx2, y + r, tw, TH - 1, tc)
        px(tx2, y + r, tw, 1, sh(base, 20))
        px(tx2, y + r + TH - 2, tw, 1, sh(base, -20))
      }
    }
  }
  function matShingle(x, y, w2, h2, base) {              // 鱼鳞瓦(圆头):用于圆顶 / 塔顶
    px(x, y, w2, h2, sh(base, -44))
    const SW = 8, SH2 = 5
    for (let r = 0, row = 0; r < h2; r += SH2, row++) {
      const off = row % 2 ? -4 : 0
      for (let c = off; c < w2; c += SW) {
        const cx2 = x + c + SW / 2
        if (cx2 < x || cx2 > x + w2) continue
        const v = wrnd()
        const sc2 = v < 0.18 ? sh(base, -12) : v > 0.82 ? sh(base, 11) : base
        g.fillStyle = sc2
        g.beginPath(); g.arc(cx2, y + r + 3, SW / 2 - 0.5, 0, 7); g.fill()
        g.fillStyle = sh(base, 20)
        g.beginPath(); g.arc(cx2 - 1, y + r + 2, SW / 2 - 2.5, 0, 7); g.fill()
      }
    }
  }
  // ── 门窗(带纵深)──
  function doorway(x, y, arch, warm) {
    px(x - 4, y - 40, 32, 5, '#6e6a5e')                  // 门楣石
    px(x - 4, y - 40, 32, 1, '#8a8578')
    px(x, y - 36, 24, 36, '#3a2818')                     // 门洞(深)
    px(x + 2, y - 34, 20, 34, '#6e4a2a')                 // 门框
    px(x + 3, y - 33, 18, 33, '#8a5e36')                 // 门板
    px(x + 4, y - 32, 7, 31, '#9a6c42')                  // 板缝
    px(x + 13, y - 32, 7, 31, '#9a6c42')
    px(x + 3, y - 33, 18, 1, '#a87a4a')                  // 门板上沿受光
    px(x + 3, y - 20, 18, 1, '#5a4028')                  // 中楣
    if (arch) {
      g.fillStyle = '#3a2818'; g.beginPath(); g.arc(x + 12, y - 36, 12, Math.PI, 0); g.fill()
      g.fillStyle = '#8a5e36'; g.beginPath(); g.arc(x + 12, y - 35, 9, Math.PI, 0); g.fill()
      g.fillStyle = '#a87a4a'; g.beginPath(); g.arc(x + 12, y - 35, 5, Math.PI, 0); g.fill()
    }
    px(x + 17, y - 19, 3, 5, '#e8b23d'); px(x + 17, y - 19, 3, 1, '#fbdc8a')   // 门把
    px(x - 3, y, 30, 6, '#b0aba0'); px(x - 3, y, 30, 1, '#c8c4bc')             // 门阶
    px(x - 3, y + 6, 30, 1, 'rgba(30,22,40,0.24)')
    if (warm) glowG(x + 12, y - 18, 18, 'rgba(255,214,106,0.14)')
  }
  const CURT = ['#e8a0a8', '#a8c8e0', '#e8d0a0', '#c8b0d8']
  function winSq(x, y, warm) {                           // 方窗:窗台 + 洞深 + 框 + 窗帘 + 反光
    px(x - 3, y + 17, 26, 4, '#b0aba0'); px(x - 3, y + 17, 26, 1, '#c8c4bc')  // 窗台
    px(x - 3, y + 21, 26, 1, 'rgba(30,22,40,0.26)')
    px(x, y, 20, 17, '#3a2818')                          // 窗洞(深)
    px(x + 1, y + 1, 18, 15, '#7a5638')                  // 外框
    px(x + 2, y + 2, 16, 13, warm ? '#ffe4b8' : '#9ec6dc')  // 玻璃
    px(x + 2, y + 2, 16, 2, warm ? '#ffd48a' : '#7fb0cc')   // 玻璃上沿(洞内投影)
    px(x + 3, y + 4, 6, 5, warm ? '#fff6e2' : '#d2e8f4')    // 反光
    px(x + 2, y + 2, 4, 13, CURT[(x + y) % 4])           // 窗帘
    px(x + 14, y + 2, 4, 13, CURT[(x + y) % 4])
    px(x + 9, y + 2, 2, 13, '#5a4028')                   // 竖棂
    px(x + 2, y + 8, 16, 1, '#5a4028')                   // 横棂
    px(x + 1, y + 1, 18, 1, '#9a7048')                   // 框上沿受光
    if (warm) glowG(x + 10, y + 8, 15, 'rgba(255,214,106,0.30)')
  }
  function winRound(x, y, warm) {
    g.fillStyle = '#3a2818'; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill()
    g.fillStyle = '#7a5638'; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill()
    g.fillStyle = warm ? '#ffe4b8' : '#9ec6dc'; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill()
    g.fillStyle = warm ? '#fff6e2' : '#d2e8f4'; g.beginPath(); g.arc(x - 2.5, y - 2.5, 3.5, 0, 7); g.fill()
    px(x - 1, y - 8, 2, 16, '#5a4028'); px(x - 8, y - 1, 16, 2, '#5a4028')
    if (warm) glowG(x, y, 15, 'rgba(255,214,106,0.30)')
  }
  function planter(x, y, hue) {
    px(x, y, 13, 7, '#8a5a34'); px(x + 1, y + 1, 11, 5, '#b07c4c'); px(x, y, 13, 1, '#c89a68')
    for (let k = 0; k < 3; k++) { px(x + 2 + k * 4, y - 4, 3, 4, '#4e8a3a'); px(x + 2 + k * 4, y - 6, 3, 2, hue) }
  }
  function sign(x, y, w2, c) {
    px(x, y, w2, 11, '#4a3220'); px(x + 1, y + 1, w2 - 2, 9, c)
    px(x + 1, y + 1, w2 - 2, 1, 'rgba(255,246,220,0.25)')
    px(x + 4, y + 4, w2 - 10, 2, 'rgba(40,28,16,0.5)')
    px(x + 4, y + 7, w2 - 16, 1, 'rgba(40,28,16,0.35)')
  }
  function drainpipe(x, y, h2) {
    px(x, y, 3, h2, '#8a8578'); px(x, y, 1, h2, '#aaa494')
    for (let k = 12; k < h2; k += 22) px(x - 1, y + k, 5, 2, '#6e6a5e')   // 卡箍
    px(x - 1, y + h2 - 3, 5, 3, '#6e6a5e')
  }
  function aircon(x, y) {
    px(x, y, 17, 12, '#8a8578'); px(x + 1, y + 1, 15, 10, '#c8c4bc')
    for (let k = 0; k < 3; k++) px(x + 2, y + 3 + k * 3, 13, 2, '#9a938a')
    px(x, y + 12, 17, 2, 'rgba(30,22,40,0.22)')
  }
  // ── 布局引擎:门居中,窗退到门两侧;放不下就不放。门窗永不重叠 ──
  const DW = 24
  function facade(x, y, w2, wallTop, wallBot, floors, fh, warm) {
    const dx = x + ((w2 - DW) >> 1)
    for (let f = 0; f < floors; f++) {
      const wy = wallBot - f * fh - 33
      if (f === 0) {
        // 窗宽 20。门居中后两侧各剩 (w2-24)/2,再扣掉边距 —— 76px 的墙只余 21px,刚好放得下。
        const gapL = dx - 3 - (x + 2), gapR = (x + w2 - 2) - (dx + DW + 3)
        if (gapL >= 20) winSq(dx - 3 - 20, wy, warm)     // 门左:右对齐到门边
        if (gapR >= 20) winSq(dx + DW + 3, wy, warm)     // 门右
      } else {
        winSq(x + 8, wy, true)
        if (w2 >= 72) winSq(x + w2 - 28, wy, true)
      }
    }
    doorway(dx, wallBot, false, warm)
    return dx
  }
  // ── 房型:形制不同,共用同一套材质与布局 ──
  // 墙材由坐标派生 → 同型不同栋也各不相同(砖 / 木板 / 石 / 灰泥)
  // 墙材分配:一半以上是平整的灰泥,砖/石/木只点缀在少数几栋。
  // 家家户户都砌砖 = 满屏砖缝 = 视觉噪音。纹理要留白。
  const matOf = (x, y) => { const h = ((x * 7 + y * 13) >> 2) & 7; return h < 4 ? 3 : h < 6 ? 1 : h === 6 ? 0 : 2 }

  // ① 圆顶屋 —— 鱼鳞瓦圆顶 + 圆窗 + 顶球
  function houseDome(x, y, w2, dc, dc2, wallc) {
    const wh = 52, cx = x + w2 / 2, R = w2 / 2, bot = y + wh
    shadow(cx, bot + 2, w2 + 12, 8)
    wall(x + 3, y, w2 - 6, wh, wallc, matOf(x, y))
    px(x, bot - 5, w2, 7, '#8a8276'); px(x, bot - 5, w2, 1, '#a8a294')       // 勒脚
    g.fillStyle = sh(dc, -34); g.beginPath(); g.arc(cx, y + 3, R + 6, Math.PI, 0); g.fill()   // 檐
    g.save()
    g.beginPath(); g.arc(cx, y + 1, R, Math.PI, 0); g.closePath(); g.clip()
    matShingle(cx - R, y - R, R * 2, R + 2, dc)                              // 鱼鳞瓦
    g.restore()
    g.fillStyle = 'rgba(255,246,220,0.22)'
    g.beginPath(); g.arc(cx - R * 0.36, y - 4, R * 0.20, Math.PI, 0); g.fill()
    px(cx - 3, y - R - 11, 6, 10, sh(dc, -34))
    g.fillStyle = dc2; g.beginPath(); g.arc(cx, y - R - 12, 5, 0, 7); g.fill()
    g.fillStyle = 'rgba(255,246,220,0.5)'; g.beginPath(); g.arc(cx - 2, y - R - 14, 2, 0, 7); g.fill()
    // 门用平顶(不加拱):墙高 52,门框顶在 bot-36 = 墙内 16px,拱会戳进圆顶
    const dx = x + ((w2 - DW) >> 1)
    winRound(x + 15, y + 20, true)
    winRound(x + w2 - 15, y + 20, true)
    doorway(dx, bot, false, true)
    planter(x + 8, y + 33, '#e87a90'); planter(x + w2 - 21, y + 33, '#ffd76a')
  }
  // ② 坡顶小屋 —— 斜瓦 + 烟囱 + 山墙阁楼窗
  function houseGable(x, y, w2, cv2, cs2, wallc, chimney) {
    const wh = 40, rh = 28, cx = x + w2 / 2, bot = y + rh + wh
    shadow(cx, bot + 2, w2 + 10, 7)
    wall(x + 4, y + rh, w2 - 8, wh, wallc, matOf(x, y))
    px(x + 1, bot - 5, w2 - 2, 7, '#8a8276'); px(x + 1, bot - 5, w2 - 2, 1, '#a8a294')
    g.fillStyle = sh(cv2, -36)                                               // 檐(伸出)
    g.beginPath(); g.moveTo(x - 9, y + rh + 5); g.lineTo(cx, y - 5); g.lineTo(x + w2 + 9, y + rh + 5); g.fill()
    g.save()
    g.beginPath(); g.moveTo(x - 4, y + rh); g.lineTo(cx, y); g.lineTo(x + w2 + 4, y + rh); g.closePath(); g.clip()
    matTile(x - 6, y - 2, w2 + 12, rh + 4, cv2)                              // 斜瓦
    g.restore()
    px(cx - 6, y - 7, 12, 9, sh(cv2, -30)); px(cx - 5, y - 7, 10, 2, sh(cv2, 22))   // 脊瓦
    // 阁楼窗(嵌在山墙)
    px(cx - 8, y + rh - 17, 16, 14, '#3a2818'); px(cx - 6, y + rh - 15, 12, 10, '#ffe4b8')
    px(cx - 6, y + rh - 15, 12, 2, '#ffd48a'); px(cx - 1, y + rh - 15, 2, 10, '#5a4028')
    glowG(cx, y + rh - 10, 13, 'rgba(255,214,106,0.26)')
    if (chimney) {
      matBrick(x + w2 - 30, y - 12, 15, 24, '#a05a44')
      px(x + w2 - 32, y - 16, 19, 6, '#6e4e2c'); px(x + w2 - 32, y - 16, 19, 1, '#8a6438')
    }
    facade(x + 4, y, w2 - 8, y + rh, bot, 1, wh, true)
    planter(x + 8, y + rh + 30, '#c8a0e8')
    drainpipe(x + w2 - 7, y + rh + 2, wh - 6)
  }
  // ③ 平顶楼 —— 砖 / 石墙 + 层线 + 屋顶栏杆水箱 + 招牌
  function houseFlatN(x, y, w2, fl, wallc, trim) {
    const fh = 46, h = fl * fh, bot = y + h
    shadow(x + w2 / 2, bot + 2, w2 + 12, 8)
    wall(x + 2, y, w2 - 4, h, wallc, matOf(x, y))
    px(x - 5, y - 9, w2 + 10, 6, sh(trim, -22))                              // 檐口
    px(x - 5, y - 9, w2 + 10, 2, sh(trim, 24))
    px(x - 5, y - 3, w2 + 10, 2, 'rgba(30,22,40,0.26)')
    for (let f = 1; f < fl; f++) {                                           // 层线
      px(x + 2, bot - f * fh, w2 - 4, 5, sh(trim, -12))
      px(x + 2, bot - f * fh, w2 - 4, 1, sh(trim, 22))
      px(x + 2, bot - f * fh + 5, w2 - 4, 1, 'rgba(30,22,40,0.22)')
    }
    px(x, bot - 5, w2, 7, '#8a8276'); px(x, bot - 5, w2, 1, '#a8a294')
    for (let k = 0; k < (w2 / 13 | 0); k++) px(x + 3 + k * 13, y - 20, 3, 11, sh(trim, -14))   // 栏杆
    px(x + 2, y - 22, w2 - 4, 3, sh(trim, -14))
    matBrick(x + w2 - 32, y - 36, 22, 18, '#9aa0a4')                         // 水箱
    px(x + w2 - 34, y - 39, 26, 4, '#c8c4bc'); px(x + w2 - 34, y - 39, 26, 1, '#dcd8d0')
    aircon(x + w2 - 24, y + 10)
    drainpipe(x + 5, y + 2, h - 8)
    if (fl >= 2) sign(x + (w2 >> 1) - 19, bot - fh - 14, 38, trim)           // 招牌挂二层腰线下
    facade(x + 2, y, w2 - 4, y, bot, fl, fh, false)
  }
  // ④ 圆塔 —— 石身 + 鱼鳞锥顶 + 环窗
  function towerRound(x, y, r, coneC, coneD, wallc) {
    const wh = 96, cx = x + r, bot = y + wh
    shadow(cx, bot + 2, r * 2 + 10, 8)
    matStone(x + 2, y, r * 2 - 4, wh, wallc)
    px(x + 2, y, 8, wh, 'rgba(255,246,220,0.20)')                            // 圆柱受光
    px(x + r * 2 - 12, y, 10, wh, 'rgba(30,22,40,0.16)')
    px(x, bot - 5, r * 2, 7, '#8a8276'); px(x, bot - 5, r * 2, 1, '#a8a294')
    px(x - 2, y + 2, r * 2 + 4, 6, sh(coneD, -18)); px(x - 2, y + 2, r * 2 + 4, 1, sh(coneD, 22))  // 檐环
    g.fillStyle = sh(coneD, -30)
    g.beginPath(); g.moveTo(x - 10, y + 4); g.lineTo(cx, y - 46); g.lineTo(x + r * 2 + 10, y + 4); g.fill()
    g.save()
    g.beginPath(); g.moveTo(x - 4, y + 2); g.lineTo(cx, y - 40); g.lineTo(x + r * 2 + 4, y + 2); g.closePath(); g.clip()
    matShingle(x - 6, y - 42, r * 2 + 12, 46, coneC)                         // 锥顶鱼鳞瓦
    g.restore()
    px(cx - 2, y - 52, 4, 9, sh(coneD, -30))
    g.fillStyle = '#e8b23d'; g.beginPath(); g.arc(cx, y - 53, 4, 0, 7); g.fill()
    g.fillStyle = '#fbdc8a'; g.beginPath(); g.arc(cx - 1, y - 54, 1.6, 0, 7); g.fill()
    winRound(cx, y + 24, true)                                               // 上层圆窗(圆窗底 y+36)
    // 门顶在 bot-40。塔身 88,圆窗底 y+34,两者间隔 88-40-34=14px,不再重叠
    doorway(cx - 12, bot, true, true)                                        // 门在塔基
  }
  // ═══════════ 模块化建筑系统 ═══════════
  // SLYNYRD Pixelblog 14/51:建筑 = 可堆叠模块(地基/楼层/屋顶/加建)。
  // 复制+微调而非每栋从头画;屋顶形态在小尺寸下要能一眼读出;顶端略微出挑做纵深。
  const HP = mulberry32(4801)                            // 建筑随机(与地形/墙面分开)
  // ── 屋顶零件库(lx..rx 为墙宽,baseY 为屋顶底/墙顶)──
  function roofGable(lx, rx, baseY, rh, c, ridgeX) {     // 双坡:山墙朝前
    const rc = ridgeX == null ? (lx + rx) / 2 : ridgeX
    g.fillStyle = sh(c, -36)
    g.beginPath(); g.moveTo(lx - 8, baseY + 4); g.lineTo(rc, baseY - rh - 4); g.lineTo(rx + 8, baseY + 4); g.fill()
    g.save(); g.beginPath(); g.moveTo(lx - 3, baseY); g.lineTo(rc, baseY - rh); g.lineTo(rx + 3, baseY); g.closePath(); g.clip()
    matTile(lx - 6, baseY - rh - 2, (rx - lx) + 12, rh + 4, c); g.restore()
    px(rc - (rx - lx) * 0.15, baseY - rh + 3, (rx - lx) * 0.3, 4, sh(c, -30))
  }
  function roofHip(lx, rx, baseY, rh, c) {               // 四坡:梯形,顶脊短(俯视最常见,读得最清)
    const w2 = rx - lx, ridgeInset = w2 * 0.26
    g.fillStyle = sh(c, -40)                             // 前后坡(下深)
    g.beginPath(); g.moveTo(lx - 9, baseY + 4); g.lineTo(rx + 9, baseY + 4)
    g.lineTo(rx - ridgeInset, baseY - rh); g.lineTo(lx + ridgeInset, baseY - rh); g.closePath(); g.fill()
    g.save(); g.beginPath(); g.moveTo(lx - 4, baseY); g.lineTo(rx + 4, baseY)
    g.lineTo(rx - ridgeInset, baseY - rh + 2); g.lineTo(lx + ridgeInset, baseY - rh + 2); g.closePath(); g.clip()
    matTile(lx - 6, baseY - rh, w2 + 12, rh + 4, c); g.restore()
    // 左右侧坡(三角,受光/背光不同 → 立体)
    g.fillStyle = sh(c, -20)
    g.beginPath(); g.moveTo(lx - 9, baseY + 4); g.lineTo(lx + ridgeInset, baseY - rh); g.lineTo(lx + ridgeInset, baseY + 4); g.closePath(); g.fill()
    g.fillStyle = sh(c, -52)
    g.beginPath(); g.moveTo(rx + 9, baseY + 4); g.lineTo(rx - ridgeInset, baseY - rh); g.lineTo(rx - ridgeInset, baseY + 4); g.closePath(); g.fill()
    px(lx + ridgeInset, baseY - rh, w2 - ridgeInset * 2, 3, sh(c, -28))   // 顶脊
    px(lx + ridgeInset, baseY - rh, w2 - ridgeInset * 2, 1, sh(c, 18))
  }
  function roofFlat(lx, rx, topY, trim, seed) {          // 平顶:天台(水箱/通风/太阳能)+ 女儿墙
    const w2 = rx - lx, R = mulberry32((seed || 7) * 71 + 3 | 0)
    // 天台地面(女儿墙内,退进一点 → 有进深)。水泥灰,不跟 trim(红 trim 会变红地面)
    px(lx + 2, topY - 26, w2 - 4, 22, '#b0aaa0')
    px(lx + 2, topY - 26, w2 - 4, 2, '#9a948a')                     // 地面横缝
    px(lx + 3, topY - 25, w2 - 6, 3, 'rgba(30,22,40,0.28)')         // 内侧檐影
    px(lx + 3, topY - 12, w2 - 6, 1, 'rgba(255,255,255,0.06)')
    // 天台杂物(靠种子摆 2-3 件)
    const items = []
    if (R() < 0.75) items.push('tank')
    if (R() < 0.6) items.push('vent')
    if (R() < 0.5) items.push(R() < 0.5 ? 'solar' : 'laundry')
    if (R() < 0.4) items.push('box')
    let ix = lx + 8
    for (const it of items) {
      if (ix > rx - 18) break
      const ty = topY - 24
      if (it === 'tank') {                                          // 水箱
        matBrick(ix, ty - 12, 18, 16, '#9aa0a4')
        px(ix - 2, ty - 15, 22, 4, '#c8c4bc'); px(ix - 2, ty - 15, 22, 1, '#dcd8d0')
        px(ix + 2, ty - 9, 12, 1, '#8a8578'); px(ix + 2, ty - 5, 12, 1, '#8a8578')
        ix += 24
      } else if (it === 'vent') {                                   // 通风管
        px(ix, ty - 14, 8, 18, '#8a8578'); px(ix, ty - 14, 3, 18, '#a8a294')
        px(ix - 2, ty - 17, 12, 4, '#6e6a5e'); px(ix - 2, ty - 17, 12, 1, '#9a938a')
        ix += 16
      } else if (it === 'solar') {                                  // 太阳能板(斜)
        g.save(); g.translate(ix, ty - 2); g.rotate(-0.32)
        px(0, -12, 26, 11, '#2a3a5a')
        for (let k = 0; k < 3; k++) px(2 + k * 8, -10, 6, 7, '#4a6a9a')
        g.restore(); ix += 26
      } else if (it === 'laundry') {                                // 晾衣架
        px(ix, ty - 14, 2, 18, '#8a8578'); px(ix + 18, ty - 14, 2, 18, '#8a8578')
        px(ix, ty - 13, 20, 1, '#c8c4bc')
        for (let k = 0; k < 3; k++) { g.fillStyle = ['#e8a0b0', '#a8c8e0', '#e8d0a0'][k]; g.fillRect(ix + 3 + k * 6, ty - 12, 5, 8) }
        ix += 24
      } else {                                                      // 杂物箱
        px(ix, ty - 8, 14, 12, '#8a6438'); px(ix + 1, ty - 7, 12, 10, '#a87c4a'); px(ix + 1, ty - 7, 12, 1, '#c49a68')
        ix += 18
      }
    }
    // 女儿墙(前沿,压住杂物底部 → 天台是凹的)。用混凝土灰,不跟 trim ——
    // 否则红/深色 trim 会让整个屋顶一团重色。trim 只用在细压条上。
    const PAR = '#cdc8bc'
    px(lx - 5, topY - 9, w2 + 10, 6, sh(PAR, -18)); px(lx - 5, topY - 9, w2 + 10, 2, sh(PAR, 18))
    px(lx - 5, topY - 9, w2 + 10, 1, trim)                          // trim 只压一条细线
    px(lx - 5, topY - 3, w2 + 10, 2, 'rgba(30,22,40,0.22)')
    for (let k = 0; k < (w2 / 16 | 0); k++) px(lx + 6 + k * 16, topY - 14, 3, 6, sh(PAR, -16))   // 栏杆柱(矮 · 疏)
    px(lx - 5, topY - 16, w2 + 10, 2, sh(PAR, -14)); px(lx - 5, topY - 16, w2 + 10, 1, sh(PAR, 16))
  }
  function roofShed(lx, rx, baseY, rh, c) {              // 单坡:一侧高一侧低(现代/工业感)
    g.fillStyle = sh(c, -36)
    g.beginPath(); g.moveTo(lx - 6, baseY + 3); g.lineTo(lx - 6, baseY - rh)
    g.lineTo(rx + 6, baseY - 3); g.lineTo(rx + 6, baseY + 3); g.closePath(); g.fill()
    g.save(); g.beginPath(); g.moveTo(lx - 2, baseY); g.lineTo(lx - 2, baseY - rh + 2)
    g.lineTo(rx + 2, baseY - 3); g.lineTo(rx + 2, baseY); g.closePath(); g.clip()
    matTile(lx - 6, baseY - rh, (rx - lx) + 12, rh + 6, c); g.restore()
    px(lx - 6, baseY - rh, (rx - lx) + 12, 2, sh(c, 16))
  }
  function roofMansard(lx, rx, baseY, rh, c) {           // 复折顶:陡下缓上(法式,分量足)
    const w2 = rx - lx, mid = baseY - rh * 0.55, inset = w2 * 0.18
    g.fillStyle = sh(c, -30)                             // 陡下段
    g.beginPath(); g.moveTo(lx - 6, baseY + 3); g.lineTo(lx + inset * 0.5, mid)
    g.lineTo(rx - inset * 0.5, mid); g.lineTo(rx + 6, baseY + 3); g.closePath(); g.fill()
    g.save(); g.beginPath(); g.moveTo(lx - 2, baseY); g.lineTo(lx + inset * 0.5, mid)
    g.lineTo(rx - inset * 0.5, mid); g.lineTo(rx + 2, baseY); g.closePath(); g.clip()
    matShingle(lx - 4, baseY - rh, w2 + 8, rh, c); g.restore()
    g.fillStyle = sh(c, -44)                             // 缓上段
    g.beginPath(); g.moveTo(lx + inset * 0.5, mid + 1); g.lineTo(lx + inset, baseY - rh)
    g.lineTo(rx - inset, baseY - rh); g.lineTo(rx - inset * 0.5, mid + 1); g.closePath(); g.fill()
    px(lx + inset, baseY - rh, w2 - inset * 2, 3, sh(c, -20)); px(lx + inset, baseY - rh, w2 - inset * 2, 1, sh(c, 16))
    px(lx - 2, mid - 1, w2 + 4, 2, sh(c, 20))            // 折线高光
  }
  const ROOFS = {
    gable: (lx, rx, by, c, s2) => roofGable(lx, rx, by, 26 + (s2 & 6), c),
    hip:   (lx, rx, by, c) => roofHip(lx, rx, by, 24, c),
    shed:  (lx, rx, by, c) => roofShed(lx, rx, by, 20, c),
    mansard: (lx, rx, by, c) => roofMansard(lx, rx, by, 30, c),
  }

  // ── 加建零件 ──
  function addDormer(cx, topY, c) {                      // 老虎窗(凸出屋顶)
    px(cx - 9, topY - 13, 18, 15, sh(c, -30))
    roofGable(cx - 11, cx + 11, topY - 13, 9, c)
    px(cx - 6, topY - 11, 12, 10, '#3a2818'); px(cx - 4, topY - 9, 8, 7, '#ffe4b8')
    glowG(cx, topY - 5, 9, 'rgba(255,214,106,0.22)')
  }
  function addChimney(x, topY, c) {
    matBrick(x, topY - 24, 15, 26, c || '#a05a44')
    px(x - 2, topY - 28, 19, 6, '#6e4e2c'); px(x - 2, topY - 28, 19, 1, '#8a6438')
    if (HP() < 0.6) { g.fillStyle = 'rgba(210,205,195,0.5)'; g.beginPath(); g.arc(x + 7, topY - 32, 4, 0, 7); g.fill() }
  }
  function addBalcony(x, y, w2) {
    px(x, y + 2, w2, 4, '#8a6844'); px(x, y + 2, w2, 1, '#a8845c')
    for (let k = 0; k * 7 < w2; k++) px(x + 2 + k * 7, y - 5, 2, 7, '#8a6844')
    px(x, y - 5, w2, 2, '#8a6844')
  }
  function addAwning(x, y, w2, c) {                      // 条纹遮阳棚
    for (let k = 0; k * 10 < w2; k++) {
      g.fillStyle = k % 2 ? c : '#f6efdc'
      g.beginPath(); g.moveTo(x + k * 10, y); g.lineTo(x + k * 10 + 10, y)
      g.lineTo(x + k * 10 + 6, y + 11); g.lineTo(x + k * 10 - 4, y + 11); g.fill()
    }
    px(x - 2, y - 2, w2 + 4, 3, sh(c, -20))
  }
  // ── 窗户节奏:不均匀网格。按楼层宽度排布,门所在层空出门位 ──
  function facadeRow(x, w2, wy, warm, doorX) {
    const slots = w2 >= 100 ? 3 : w2 >= 68 ? 2 : 1
    const pitch = (w2 - 16) / slots
    for (let i = 0; i < slots; i++) {
      const wx = x + 8 + i * pitch + (pitch - 20) / 2
      if (doorX != null && Math.abs(wx + 10 - (doorX + 12)) < 24) continue   // 让开门
      winSq(wx, wy, warm)
    }
  }
  // ── 组合器:一栋 = 楼层 × 屋顶 × 材质 × 加建,全由种子派生 ──
  function building(x, groundY, w2, seed, opt) {
    opt = opt || {}
    const R = mulberry32(seed * 2654435761 % 2147483647 | 0)
    const floors = opt.floors || (w2 < 70 ? 1 + (R() < 0.4 ? 1 : 0) : 1 + ((R() * 3) | 0))
    const fh = 44, h = floors * fh, bot = groundY, topWall = bot - h
    const rtypes = opt.roofs || (floors >= 3 ? ['flat', 'flat', 'hip'] : ['gable', 'hip', 'gable', 'shed', 'mansard'])
    const rt = opt.roof || rtypes[(R() * rtypes.length) | 0]
    const mat = opt.mat != null ? opt.mat : (R() < 0.55 ? 3 : (R() * 4) | 0)   // 过半灰泥
    const wc = opt.wall || WALLC[(R() * WALLC.length) | 0]
    const rc = opt.roofC || ROOFC[(R() * ROOFC.length) | 0]
    const trim = opt.trim || rc
    shadow(x + w2 / 2, bot + 2, w2 + 12, 8)
    // 墙体
    wall(x + 2, topWall, w2 - 4, h, wc, mat)
    for (let f = 1; f < floors; f++) {                    // 层线
      px(x + 2, bot - f * fh, w2 - 4, 4, sh(trim, -12)); px(x + 2, bot - f * fh, w2 - 4, 1, sh(trim, 20))
    }
    px(x, bot - 5, w2, 7, '#8a8276'); px(x, bot - 5, w2, 1, '#a8a294')   // 勒脚
    // 屋顶
    if (rt === 'flat') roofFlat(x + 2, x + w2 - 2, topWall, trim, seed)
    else ROOFS[rt](x + 2, x + w2 - 2, topWall, rc, (seed & 7) << 1)
    // 门(可偏心)
    const doorCenter = opt.doorMid ? 0.5 : [0.5, 0.32, 0.68][(R() * 3) | 0]
    const doorX = x + (w2 * doorCenter - DW / 2) | 0
    // 各层窗(顶层可留窗,底层让开门)
    for (let f = 0; f < floors; f++) {
      const wy = bot - f * fh - 33
      facadeRow(x, w2, wy, f > 0, f === 0 ? doorX : null)
    }
    doorway(doorX, bot, rt !== 'flat' && floors === 1 && R() < 0.4, true)
    // 加建(按种子概率)
    if (rt !== 'flat' && R() < 0.5) addDormer(x + w2 * (0.4 + R() * 0.2), topWall, rc)
    if (rt !== 'flat' && R() < 0.6) addChimney(x + w2 * (R() < 0.5 ? 0.16 : 0.78), topWall, opt.chimC)
    if (floors >= 2 && R() < 0.45) addBalcony(x + 8, bot - fh - 2, w2 - 16)
    if (R() < 0.5) { drainpipe(x + w2 - 6, topWall + 4, h - 8) }
    if (R() < 0.4) planter(x + 10, bot - 15, PLANTC[(R() * PLANTC.length) | 0])
    if (floors >= 2 && R() < 0.35) aircon(x + w2 - 24, topWall + 10)
    return { doorX, bot, w2, h }
  }
  // 带侧翼的 L 形宅:主楼(高)+ 偏侧配楼(矮),两屋顶错落
  function buildingL(x, groundY, mainW, seed, opt) {
    opt = opt || {}
    const R = mulberry32((seed * 40503) % 2147483647 | 0)
    const side = R() < 0.5 ? 1 : -1                        // 配楼在左/右
    const annexW = 48 + ((R() * 20) | 0), annexH = 46
    const wc = opt.wall || WALLC[(R() * WALLC.length) | 0]
    const rc = opt.roofC || ROOFC[(R() * ROOFC.length) | 0]
    const ax = side > 0 ? x + mainW - 8 : x - annexW + 8
    const aGY = groundY, aTop = aGY - annexH
    // 配楼先画(被主楼压一角)
    shadow(ax + annexW / 2, aGY + 2, annexW + 8, 6)
    wall(ax, aTop, annexW, annexH, wc, 3)
    px(ax, aGY - 5, annexW, 7, '#8a8276'); px(ax, aGY - 5, annexW, 1, '#a8a294')
    roofGable(ax, ax + annexW, aTop, 20, rc, ax + annexW * (side > 0 ? 0.6 : 0.4))
    winSq(ax + (side > 0 ? annexW - 26 : 6), aGY - 33, true)
    // 主楼(2-3 层)覆盖上来
    building(x, groundY, mainW, seed, { wall: wc, roofC: rc, floors: opt.floors || 2 + (R() < 0.4 ? 1 : 0), roof: opt.roof })
    return { bot: groundY }
  }
  const WALLC = ['#eee6da', '#f2e3c8', '#e6ecf0', '#f2d8c8', '#ece0d0', '#dfe6e2', '#f0ead6']
  const ROOFC = ['#c85a48', '#5a9a8a', '#6a8cb0', '#8a6aaa', '#c07820', '#4c6a8c', '#9a938a', '#7a8a5a']
  const PLANTC = ['#e87a90', '#ffd76a', '#c8a0e8', '#f6a0c0']

  // ── 复杂/非对称建筑(SLYNYRD Pixelblog 51:L 形地基 · 主体+偏侧加建 · 高矮错落 · 窗不均匀)──
  // 小工具:一段坡屋顶(裁瓦),脊在 ridgeX
  function gableRoof(lx, rx, baseY, rh, cv2, ridgeX) {
    const rc = ridgeX == null ? (lx + rx) / 2 : ridgeX
    g.fillStyle = sh(cv2, -34)
    g.beginPath(); g.moveTo(lx - 8, baseY + 4); g.lineTo(rc, baseY - rh - 4); g.lineTo(rx + 8, baseY + 4); g.fill()
    g.save()
    g.beginPath(); g.moveTo(lx - 3, baseY); g.lineTo(rc, baseY - rh); g.lineTo(rx + 3, baseY); g.closePath(); g.clip()
    matTile(lx - 6, baseY - rh - 2, (rx - lx) + 12, rh + 4, cv2)
    g.restore()
    px(rc - (rx - lx) * 0.16, baseY - rh + 2, (rx - lx) * 0.32, 4, sh(cv2, -30))   // 脊
  }
  function flatRoofTrim(lx, w2, topY, trim) {                // 平顶檐口 + 女儿墙
    px(lx - 4, topY - 8, w2 + 8, 6, sh(trim, -22)); px(lx - 4, topY - 8, w2 + 8, 2, sh(trim, 24))
    px(lx - 4, topY - 2, w2 + 8, 2, 'rgba(30,22,40,0.24)')
    for (let k = 0; k < (w2 / 13 | 0); k++) px(lx + 3 + k * 13, topY - 18, 3, 11, sh(trim, -14))
    px(lx + 2, topY - 20, w2 - 4, 3, sh(trim, -14))
  }
  // ⑦ L 形宅 —— 两层主楼(左) + 偏右单层配楼,屋顶一高一低
  function houseL(x, y, wallc, cv2) {
    const mW = 92, mH = 92, aW = 62, aH = 50               // 主楼 / 配楼
    const mx = x, my = y, ax = x + mW - 6, ay = y + mH - aH
    const mBot = my + mH, aBot = ay + aH
    shadow(x + (mW + aW) / 2 - 4, mBot + 3, mW + aW + 6, 9)
    // 配楼(先画,被主楼压住一角 → L 形咬合)
    wall(ax, ay, aW, aH, wallc, 3)
    px(ax, aBot - 5, aW, 7, '#8a8276'); px(ax, aBot - 5, aW, 1, '#a8a294')
    gableRoof(ax, ax + aW, ay, 22, cv2, ax + aW * 0.42)     // 配楼坡顶(脊偏左)
    winSq(ax + aW - 26, aBot - 33, true)
    doorway(ax + 10, aBot, false, true)                    // 配楼侧门(偏左,非居中)
    // 主楼(两层,压在配楼左上)
    wall(mx, my, mW, mH, wallc, matOf(mx, my))
    for (let f = 1; f < 2; f++) { px(mx + 2, mBot - f * 46, mW - 4, 5, sh(cv2, -12)); px(mx + 2, mBot - f * 46, mW - 4, 1, sh(cv2, 22)) }
    px(mx, mBot - 5, mW, 7, '#8a8276'); px(mx, mBot - 5, mW, 1, '#a8a294')
    gableRoof(mx, mx + mW, my, 30, cv2, mx + mW * 0.5)
    // 老虎窗(屋顶上凸出的小窗 → 打破屋顶轮廓)
    px(mx + mW * 0.5 - 9, my - 14, 18, 16, sh(cv2, -30))
    gableRoof(mx + mW * 0.5 - 12, mx + mW * 0.5 + 12, my - 14, 10, cv2)
    px(mx + mW * 0.5 - 6, my - 12, 12, 10, '#3a2818'); px(mx + mW * 0.5 - 4, my - 10, 8, 7, '#ffe4b8')
    glowG(mx + mW * 0.5, my - 6, 10, 'rgba(255,214,106,0.24)')
    // 主楼窗:上层两窗,下层门偏左 + 一窗(非对称)
    winSq(mx + 12, my + 12, true); winSq(mx + mW - 32, my + 12, true)
    doorway(mx + 16, mBot, false, true)
    winSq(mx + mW - 30, mBot - 33, true)
    planter(mx + 12, my + 31, '#e87a90')
    drainpipe(mx + mW - 6, my + 4, mH - 8)
    // 主配楼之间的小院墙
    px(mx + mW - 8, aBot - 20, 3, 22, '#b0aba0')
  }
  // ⑧ 店铺 —— 底层敞开门面(遮阳棚)+ 楼上住家 + 侧招牌旗
  function shopHouse(x, y, w2, wallc, awnC) {
    const fh = 46, floors = 2, h = fh * floors, bot = y + h
    shadow(x + w2 / 2, bot + 2, w2 + 12, 8)
    wall(x + 2, y, w2 - 4, h, wallc, matOf(x, y))
    px(x + 2, bot - fh, w2 - 4, 5, sh(awnC, -14)); px(x + 2, bot - fh, w2 - 4, 1, sh(awnC, 22))
    gableRoof(x, x + w2, y, 22, awnC, x + w2 * 0.5)
    // 楼上:两窗(上部)+ 阳台栏杆(窗下)
    winSq(x + 12, y + 9, true); winSq(x + w2 - 32, y + 9, true)
    for (let k = 0; k < (w2 - 16) / 8 | 0; k++) px(x + 10 + k * 8, y + 34, 2, 7, '#8a6844')  // 阳台栏杆立柱
    px(x + 8, y + 32, w2 - 16, 3, '#8a6844'); px(x + 8, y + 32, w2 - 16, 1, '#a8845c')       // 扶手
    // 底层门面:大玻璃窗 + 遮阳棚 + 敞门
    px(x + 6, bot - 34, w2 - 12, 30, '#3a2818')            // 店面凹进
    px(x + 8, bot - 32, w2 - 16, 26, '#a8cfe4')            // 大玻璃
    px(x + 8, bot - 32, w2 - 16, 3, '#cfe6f2')
    px(x + w2 - 30, bot - 32, 22, 26, '#6e4a2a')           // 敞开的门
    px(x + w2 - 28, bot - 30, 18, 24, '#8a5e36')
    // 条纹遮阳棚(凸出)
    for (let k = 0; k * 10 < w2 - 4; k++) {
      g.fillStyle = k % 2 ? awnC : '#f6efdc'
      g.beginPath(); g.moveTo(x + 2 + k * 10, bot - 38); g.lineTo(x + 2 + k * 10 + 10, bot - 38)
      g.lineTo(x + 2 + k * 10 + 6, bot - 26); g.lineTo(x + 2 + k * 10 - 4, bot - 26); g.fill()
    }
    px(x - 2, bot - 40, w2 + 4, 3, sh(awnC, -20))
    // 侧招牌旗(伸出墙外,非对称)
    px(x + w2 - 2, bot - 30, 3, 26, '#6e4a2a')
    sign(x + w2, bot - 28, 22, awnC)
    px(x, bot - 4, w2, 6, '#8a8276')
  }
  // ── 地标:体量与复杂度都要压过民居,村子才有节奏 ──
  // ⑤ 村公所 —— 歇山大顶 · 前廊列柱 · 匾额 · 三级石阶
  function hall(x, y, w2) {
    const wh = 58, rh = 42, cx = x + w2 / 2, bot = y + rh + wh, RC = '#8a4838'
    shadow(cx, bot + 5, w2 + 24, 11)
    wall(x + 10, y + rh, w2 - 20, wh, '#ece0c8', 3)
    px(x + 6, bot - 7, w2 - 12, 9, '#8a8276'); px(x + 6, bot - 7, w2 - 12, 1, '#a8a294')
    // 下檐(伸得远 —— 大屋顶的分量全在出檐)
    g.fillStyle = sh(RC, -34)
    g.beginPath(); g.moveTo(x - 16, y + rh + 8); g.lineTo(cx, y - 4); g.lineTo(x + w2 + 16, y + rh + 8); g.fill()
    px(x - 16, y + rh + 8, w2 + 32, 4, sh(RC, -42))
    px(x - 16, y + rh + 12, w2 + 32, 3, 'rgba(30,22,40,0.28)')
    g.save()
    g.beginPath(); g.moveTo(x - 10, y + rh + 2); g.lineTo(cx, y + 1); g.lineTo(x + w2 + 10, y + rh + 2); g.closePath(); g.clip()
    matTile(x - 12, y - 2, w2 + 24, rh + 6, RC)
    g.restore()
    // 正脊 + 两端翘角
    px(cx - 34, y - 6, 68, 7, sh(RC, -40)); px(cx - 33, y - 6, 66, 2, sh(RC, 22))
    px(cx - 40, y - 8, 8, 5, sh(RC, -40)); px(cx + 32, y - 8, 8, 5, sh(RC, -40))
    // 前廊:四根柱 + 廊檐影
    px(x + 12, bot - 30, w2 - 24, 3, 'rgba(30,22,40,0.24)')
    for (let k = 0; k < 4; k++) {
      const cxp = x + 20 + k * ((w2 - 48) / 3)
      px(cxp, bot - 30, 9, 30, '#6e4a2a'); px(cxp + 1, bot - 30, 6, 30, '#9a6c42')
      px(cxp + 1, bot - 30, 2, 30, '#b07c4c'); px(cxp - 2, bot - 3, 13, 4, '#8a8276')
    }
    // 匾额(挂在檐下)
    px(cx - 36, y + rh + 10, 72, 16, '#4a3220'); px(cx - 34, y + rh + 12, 68, 12, '#c8a850')
    px(cx - 30, y + rh + 15, 60, 3, 'rgba(40,28,16,0.55)')
    px(cx - 30, y + rh + 20, 44, 2, 'rgba(40,28,16,0.40)')
    // 二层小窗一排
    for (let k = 0; k < 3; k++) winSq(x + 24 + k * ((w2 - 68) / 2), y + rh + 32, true)
    doorway(cx - 12, bot, true, true)
    for (let k = 0; k < 3; k++) {                                  // 石阶
      const c = k % 2 ? '#a8a294' : '#8a8578'
      px(cx - 34 + k * 5, bot + 4 + k * 5, 68 - k * 10, 5, c)
      px(cx - 34 + k * 5, bot + 4 + k * 5, 68 - k * 10, 1, '#c0bcb2')
    }
  }
  // ⑥ 谷仓 —— 高坡顶 · 木板墙 · 双开大门 · 顶部通风窗 · 侧面草垛
  function barn(x, y, w2) {
    const wh = 54, rh = 46, cx = x + w2 / 2, bot = y + rh + wh, RC = '#7a4a3a'
    shadow(cx, bot + 4, w2 + 18, 9)
    matPlank(x + 5, y + rh, w2 - 10, wh, '#b8603c')                // 红木板仓身
    px(x + 5, y + rh, w2 - 10, 3, 'rgba(30,22,40,0.22)')
    px(x + 5, y + rh, 2, wh, 'rgba(255,246,220,0.13)')
    px(x + 2, bot - 6, w2 - 4, 8, '#8a8276'); px(x + 2, bot - 6, w2 - 4, 1, '#a8a294')
    for (const bx of [x + 12, x + w2 - 20]) {                      // 交叉支撑
      px(bx, y + rh + 8, 6, wh - 18, '#e8dcc4')
    }
    g.fillStyle = sh(RC, -32)                                      // 陡坡顶
    g.beginPath(); g.moveTo(x - 10, y + rh + 5); g.lineTo(cx, y - 5); g.lineTo(x + w2 + 10, y + rh + 5); g.fill()
    g.save()
    g.beginPath(); g.moveTo(x - 5, y + rh); g.lineTo(cx, y); g.lineTo(x + w2 + 5, y + rh); g.closePath(); g.clip()
    matTile(x - 6, y - 2, w2 + 12, rh + 4, RC)
    g.restore()
    px(cx - 22, y - 7, 44, 7, sh(RC, -38)); px(cx - 21, y - 7, 42, 2, sh(RC, 20))
    // 顶部通风窗(半圆)
    g.fillStyle = '#3a2818'; g.beginPath(); g.arc(cx, y + rh - 4, 11, Math.PI, 0); g.fill()
    g.fillStyle = '#5a4028'; g.beginPath(); g.arc(cx, y + rh - 4, 8, Math.PI, 0); g.fill()
    px(cx - 1, y + rh - 12, 2, 8, '#3a2818')
    // 双开大门
    px(cx - 26, bot - 44, 52, 44, '#3a2818')
    px(cx - 24, bot - 42, 23, 42, '#8a5e36'); px(cx + 1, bot - 42, 23, 42, '#8a5e36')
    px(cx - 24, bot - 42, 23, 1, '#a87a4a'); px(cx + 1, bot - 42, 23, 1, '#a87a4a')
    for (const dxp of [-24, 1]) {                                  // 门上的 X 形木撑
      g.strokeStyle = '#6e4a2a'; g.lineWidth = 3
      g.beginPath(); g.moveTo(cx + dxp + 1, bot - 41); g.lineTo(cx + dxp + 22, bot - 1); g.stroke()
      g.beginPath(); g.moveTo(cx + dxp + 22, bot - 41); g.lineTo(cx + dxp + 1, bot - 1); g.stroke()
    }
    px(cx - 3, bot - 26, 6, 4, '#e8b23d')                          // 门闩
    px(cx - 30, bot, 60, 6, '#b0aba0'); px(cx - 30, bot, 60, 1, '#c8c4bc')
    // 侧面草垛 —— clip 必须包在 save/restore 里,否则裁剪区永久生效,
    // 后面画的耕地和树会全被裁没(上一版就是这么消失的)
    g.save()
    g.fillStyle = '#d8bc60'
    g.beginPath(); g.ellipse(x + w2 + 16, bot - 8, 17, 12, 0, Math.PI, 0); g.fill()
    g.beginPath(); g.ellipse(x + w2 + 16, bot - 8, 17, 12, 0, Math.PI, 0); g.clip()
    for (let k = 0; k < 6; k++) px(x + w2 + 1 + k * 6, bot - 22, 1, 15, '#a88838')
    g.restore()
    px(x + w2 - 1, bot - 8, 34, 2, 'rgba(30,22,40,0.20)')
  }
  function waterTower(x, y) {
    shadow(x + 26, y + 66, 48, 6)
    px(x + 6, y + 20, 6, 46, '#6e5236'); px(x + 40, y + 20, 6, 46, '#6e5236')
    px(x + 2, y + 40, 48, 4, '#6e5236')
    px(x, y - 14, 52, 38, '#8a9ab8')
    px(x, y - 14, 52, 6, '#a8b8d0')
    px(x, y + 20, 52, 4, '#5a6a88')
    g.fillStyle = '#5a6a88'
    g.beginPath(); g.moveTo(x - 4, y - 14); g.lineTo(x + 26, y - 30); g.lineTo(x + 56, y - 14); g.fill()
    px(x + 20, y - 4, 12, 16, '#4a5a78')
  }

  // ═══ 静态场景 ═══
  //
  // 2026-08-25 重排：八排梯田 × 五格，世界 704 × 960。
  // 原来是一幅 704 × 1920 的连续村落，而屏幕只给得起 518pt 画布高 ——
  // 下面二十栋掉在折线以下，靠滚动才够得到。见 docs/REDESIGN.md「R1 定了」。
  //
  // 三条贯穿全局的规矩：
  //   ① **按排从上往下画** —— 后排遮住前排的下半截，梯田的立体感全靠这个顺序
  //   ② 房子一律照 engine/plots.js 的表画，这里不手摆第二份
  //   ③ 河画在第七排之后、第八排之前 —— 「过了河那边」是画序读出来的，不是标签
  function renderStatic() {
    const rnd = mulberry32(2026)
    const P40 = globalThis.VILLAGE_PLOTS || []

    /* 房屋占位框(禁止随机树落入)。从表算 —— 原来这里手抄了第二份坐标，
       表一改就对不上，而对不上不报错：树会长在人家门口。 */
    /* 判定框要贴住【真的画出来那块】，宽一像素都不能白让。

       旧构图 704×1920 时这个框是 220px 高、比列距还宽的 —— 房子稀疏，
       多留点余量只是让树离人家远些。新构图排距 120px、列距 137px，
       同样的框上下左右首尾相接，把整幅画都盖成了「房子」：
       6000 次落点只种上 1 棵树，而且不报错。

       房子是从自己的地面线往上画的，两层封顶约 116px，下沿再留 4px 接地。 */
    const HRECTS = P40.map((q) => [q.x, q.gy, q.w])
    function inHouse(x, y) {
      for (const [hx, gy2, hw] of HRECTS)
        if (x > hx - 5 && x < hx + hw + 5 && y > gy2 - 118 && y < gy2 + 5) return true
      return false
    }

    // ═══ 草地 ═══
    for (let ty = 0; ty < ROWS; ty++)
      for (let tx = 0; tx < COLS; tx++)
        tile(GRASS[(rnd() * GRASS.length) | 0], tx, ty)

    /* 南北明暗：北坡(山那头)深、村心亮、河那岸再压暗一点。
       这一层是梯田读得出坡度的关键 —— 平铺一色的话，八排会像八条货架。 */
    for (let y = 0; y < H; y++) {
      const t = y / H
      const a = t < 0.42 ? 0.16 * (1 - t / 0.42) : (t > 0.72 ? 0.13 * ((t - 0.72) / 0.28) : 0)
      if (a > 0.004) { g.fillStyle = 'rgba(24,40,20,' + a.toFixed(3) + ')'; g.fillRect(0, y, W, 1) }
    }

    /* ═══ 梯田的坎 ═══
       两版都错过：贯穿全宽的土坎读成货架，断续的碎土把整幅图刷成褐色。
       坎不该自己画 —— **让房子脚下的落影去交代高差**：影子连成一线就是一级台地，
       而影子只在房子底下，草地是连着的。 */
    for (const q of P40) {
      const gy = q.gy
      g.fillStyle = 'rgba(28,42,24,0.22)'
      g.fillRect(q.x - 4, gy - 2, q.w + 8, 6)
      g.fillStyle = 'rgba(28,42,24,0.12)'
      g.fillRect(q.x - 9, gy + 4, q.w + 18, 4)
    }

    /* ═══ 河道 ═══
       riverY / riverH 是【唯一来源】：画河用它，判草地用它，判农田能不能开
       也用它。分成两处写的话，农田会种到水里 —— 而那不报错，是渲出来才看得见。 */
    const RIVER_Y0 = 862
    function riverY(x) { return RIVER_Y0 + Math.sin(x / 118) * 7 }
    function riverH(x) { return 32 + Math.cos(x / 86) * 4 }

    // ═══ 路网 ═══
    const road = Array.from({ length: ROWS }, () => new Array(COLS).fill(false))
    const plaza = Array.from({ length: ROWS }, () => new Array(COLS).fill(false))
    const PCX = 352, PCY = 512                  // 广场中心(村心那一排与下一排之间)
    function inPlaza(x, y) {
      const dx = (x - 340) / 152, dy = (y - 548) / 94      // 放大一圈,给树冠留余量
      return dx * dx + dy * dy <= 1
    }
    for (let ty = 0; ty < ROWS; ty++)
      for (let tx = 0; tx < COLS; tx++)
        if (inPlaza(tx * T + T / 2, ty * T + T / 2)) plaza[ty][tx] = true
    function mark(gr2, x, y, wide) {
      for (let dy = 0; dy < wide; dy++)
        for (let dx = 0; dx < wide; dx++)
          if (y + dy >= 0 && y + dy < ROWS && x + dx >= 0 && x + dx < COLS) gr2[y + dy][x + dx] = true
    }
    function walkG(gr2, pts, wide) {
      for (let s = 0; s < pts.length - 1; s++) {
        let [x, y] = pts[s]
        const [x2, y2] = pts[s + 1]
        mark(gr2, x, y, wide)
        // 保持对角走向(路才蜿蜒),但对角移动时格子只在角上相接,路会断成一串方块 ——
        // 所以每走一步对角,额外补一个格填掉缺口。改走阶梯会让转弯处铺满 L 形,路发胖。
        while (x !== x2 || y !== y2) {
          const ox = x, oy = y
          if (x !== x2) x += Math.sign(x2 - x)
          if (y !== y2) y += Math.sign(y2 - y)
          // 只补一格。2 格宽的主路对角走时 2×2 块本就重叠、不缺角;
          // 用 mark(wide) 去补等于把整条路又加宽一圈。
          if (x !== ox && y !== oy && y >= 0 && y < ROWS && ox >= 0 && ox < COLS) gr2[y][ox] = true
          mark(gr2, x, y, wide)
        }
      }
    }
    /* 路脊：从北口一路下到桥。村子得有一条脊梁 —— 没有它，八排就是八条货架。 */
    walkG(road, [[11, 0], [11, 4], [10, 8], [11, 12], [11, 16], [11, 20], [11, 26], [11, 29]], 2)
    /* 只再画两条横巷：一条穿广场，一条到桥头。
       第一版给每家门口都画了支路 —— 五户的支路在同一排上连成一条，
       等于横巷又回来了，加上坎，整幅图铺满褐色，草没了。
       四十栋房子在这个尺度上不需要把每条小路都画出来：**路少了，坡才绿**。 */
    walkG(road, [[6, 15], [11, 15], [16, 15]], 1)
    walkG(road, [[7, 26], [11, 26], [15, 26]], 1)

    /* 路面用中心土 tile，不用 autotile —— 原实现那条注释说得对：
       autotile 的边缘 tile 自带草边框，而路只有 2 格宽、每格都是边缘，
       整条路会碎成一块块孤立的土斑。 */
    for (let ty = 0; ty < ROWS; ty++)
      for (let tx = 0; tx < COLS; tx++)
        if (road[ty][tx]) {
          tile(DIRT[1] + 1, tx, ty)
          g.fillStyle = 'rgba(132,112,80,0.26)'
          g.fillRect(tx * T, ty * T, T, T)
        }

    // ═══ 地被层：草叶 · 野花 · 碎石 ═══
    function onGrass(x, y) {
      const tx = (x / T) | 0, ty = (y / T) | 0
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return false
      if (road[ty][tx] || plaza[ty][tx]) return false          // 路面 / 广场不长草
      const ry = riverY(x)
      if (y > ry - 10 && y < ry + riverH(x) + 10) return false // 水面不长草
      return true
    }
    for (let i = 0; i < 900; i++) {
      const x = (rnd() * W) | 0, y = (rnd() * H) | 0
      if (!onGrass(x, y) || inHouse(x, y)) continue
      px(x, y, 1, 2, rnd() < 0.5 ? '#7ea85e' : '#6a9450')
    }
    for (let i = 0; i < 120; i++) {
      const x = (rnd() * W) | 0, y = (rnd() * H) | 0
      if (!onGrass(x, y) || inHouse(x, y)) continue
      const c = ['#e8d24a', '#e88aa0', '#f0ece0', '#c8a0e8'][(rnd() * 4) | 0]
      px(x, y, 2, 2, c)
    }

    // ═══ 林带：北边压顶、两侧收边 ═══
    function freeSpot(x, y) {
      const tx = (x / T) | 0, ty = (y / T) | 0
      if (tx < 1 || tx >= COLS - 1 || ty < 4 || ty >= ROWS - 3) return false
      if (road[ty][tx] || plaza[ty][tx]) return false
      if (inPlaza(x, y) || inPlaza(x + 12, y + 18)) return false   // 树冠也不许压广场
      // 只查左上角不够 —— 树冠/灌木会向右下延伸,压到人家门上。查整个包围盒。
      for (const [ox, oy] of [[0, 0], [18, 0], [0, 28], [18, 28], [9, 14]])
        if (inHouse(x + ox, y + oy)) return false
      const ry = riverY(x)
      if (y > ry - 46 && y < ry + riverH(x) + 34) return false   // 河
      if (y > 1120 && y < 1300) return false                     // 耕地
      return true
    }
    function rtree(x, y, sMin, sMax, pool, rm) {
      if (inHouse(x + 12, y + 24)) return
      const P = pool || TV
      tree(x, y, sMin + rnd() * (sMax - sMin), rm || null, P[(rnd() * P.length) | 0], rnd() < 0.5)
    }
    function grove(cx, cy, n, rad, sMin, sMax, pool, rm) {      // 林心 + 聚集
      for (let i = 0; i < n; i++) {
        const a2 = rnd() * 6.283, d = Math.sqrt(rnd()) * rad
        const tx = cx + Math.cos(a2) * d, ty = cy + Math.sin(a2) * d * 0.7
        if (!freeSpot(tx, ty)) continue
        rtree(tx, ty, sMin, sMax, pool, rm)
      }
    }
    function forestRow(y0, x0, x1, base, jx, jy, sMin, sMax, pool, rm) {
      for (let x = x0; x < x1; x += base + (rnd() * base * 0.9 - base * 0.3))
        rtree(x + (rnd() * jx - jx / 2), y0 + (rnd() * jy - jy / 2), sMin, sMax, pool, rm)
    }
    /* 树该长在哪儿，不由我指定，由画面剩下的空地决定。

       前两版都是先划一条「排与排之间的草带」再往里种，两版都一棵没种上：
       后一排的房子是从它自己的地面线【往上】画一百来像素的，正好把前一排
       身后那条带子盖满。112 次尝试里 76 次撞房子 —— 那条带子根本不存在。
       不报错，就是没有树：一幅村子图丢掉一半灵气，而看不出为什么。

       改成在整幅画上拒绝采样：随机取点，撞房子/路/广场/河就换一个，
       空就种。种够 44 棵或试满次数为止。四十栋房子往哪儿挪，
       树自己会跟着让开，不用我再算一遍带子。 */
    const planted = []
    for (let att = 0; att < 6000 && planted.length < 44; att++) {
      const tx2 = 6 + rnd() * (W - 24)
      const ty2 = 10 + rnd() * (H - 40)
      const gx = (tx2 / T) | 0, gyt = (ty2 / T) | 0
      if (gyt < 0 || gyt >= ROWS || gx < 0 || gx >= COLS) continue
      if (road[gyt][gx] || plaza[gyt][gx]) continue
      if (inPlaza(tx2, ty2)) continue
      const ry = riverY(tx2)
      if (ty2 > ry - 30 && ty2 < ry + riverH(tx2) + 24) continue
      // 树冠向右下铺开，四角加中心都得是空的 —— 只查左上角会压到人家门上
      let bad = false
      for (const [ox, oy] of [[1, 6], [12, 6], [1, 20], [12, 20], [6, 13]])
        if (inHouse(tx2 + ox, ty2 + oy)) { bad = true; break }
      if (bad) continue
      // 别挤成一堆
      if (planted.some(([px2, py2]) => Math.abs(px2 - tx2) < 22 && Math.abs(py2 - ty2) < 16)) continue
      planted.push([tx2, ty2])
      const conif = ty2 < 220          // 北边山脚是针叶,村里是阔叶
      const pool = conif ? TV_CONIF : TV
      tree(tx2, ty2, 1.15 + rnd() * 0.6, conif ? PINE_RM : null,
           pool[(rnd() * pool.length) | 0], rnd() < 0.5)
    }

    // 两侧收边的林子 —— 贴边但不出界
    grove(56, 300, 5, 30, 1.6, 2.6, TV, null)
    grove(648, 250, 5, 30, 1.6, 2.6, TV, null)
    grove(60, 640, 4, 26, 1.6, 2.4, TV_CONIF, PINE_RM)
    grove(646, 700, 4, 26, 1.6, 2.4, TV, null)

    // ═══ 房子：按排从上往下画，后排遮前排 ═══
    // 中间插河与广场 —— 插在哪一排之后，决定了它们在谁前面、谁后面。
    function ellipseFill(cx, cy, rx, ry, col) {
      g.fillStyle = col
      for (let dy = -ry; dy <= ry; dy++) {
        const dxw = (rx * Math.sqrt(1 - (dy / ry) * (dy / ry))) | 0
        g.fillRect(cx - dxw, cy + dy, dxw * 2, 1)
      }
    }
    function goldStatue(cx, gy) {
      // 大理石基座(三级 + 铭牌)
      shadow(cx, gy + 6, 62, 7)
      for (let k = 0; k < 3; k++) {
        const w2 = 54 - k * 8, c = k % 2 ? '#d8d2c6' : '#c4bcae'
        px(cx - w2 / 2, gy - k * 8, w2, 9, '#a8a094')
        px(cx - w2 / 2, gy - k * 8, w2, 7, c)
        px(cx - w2 / 2, gy - k * 8, w2, 2, '#e8e2d6')          // 台阶受光
      }
      px(cx - 13, gy - 18, 26, 8, '#8a7a58'); px(cx - 12, gy - 17, 24, 6, '#c8a850')   // 金铭牌
      px(cx - 9, gy - 15, 18, 2, '#6a5228'); px(cx - 7, gy - 12, 12, 1, '#6a5228')
      // 金毛(网格 · 金色三档 + 左上受光)
      const DOG = [
        '.......KKKKKKKKKK.......',
        '.....KKMMMMMMMMMMKK.....',
        '....KMMMMhhLLhhMMMMK....',
        '...KMMMMhLLLLLLhMMMMK...',
        '...KMMMLLLLLLLLLLMMMK...',
        '..KMMMLLLLLLLLLLLLMMMK..',
        '..KMMMLLeeLLLLeeLLMMMK..',
        '..KMMMLLeWLLLLeWLLMMMK..',
        '..KMMMLLLLLLLLLLLLMMMK..',
        '..KMMMMLLLLLLLLLLMMMMK..',
        '...KMMMLLLGGGGLLLMMMK...',
        '...KSMMLLLGGGGLLLMMSK...',
        '....KMLLLLNNNNLLLLMK....',
        '....KMLLLLNNNNLLLLMK....',
        '.....KLLLLTTTTLLLLK.....',
        '......KKLLLLLLLLKK......',
        '........KKLLLLKK........',
        '.......KhLLLLLLhK.......',
        '......KLLGGGGGGLLK......',
        '.....KLLGGGGGGGGLLK.....',
        '....KRRRRRRRRRRRRRRK....',
        '....KLGGGGGYYGGGGGLK....',
        '...KLGGGGGGGGGGGGGGLK...',
        '...KLGGGGGGGGGGGGGGLK...',
        '...KLGGGGGSSSSGGGGGLK...',
        '...KkGGGGSSGGSSGGGGkK...',
        '...KLGGGSGGGGGGSGGGLK...',
        '...KLGGKKGGGGGGKKGGLK...',
        '...KkGGKK.KKKK.KKGGkK...',
        '....KKK...KKKK...KKK....',
      ]

      const GP = {
        K:'#6a4818', k:'#8a6420', h:'#fff6d0', H:'#fff6d0', L:'#f8d868', G:'#e8b840',
        M:'#c89428', S:'#a8781e', N:'#4a3410', e:'#5a3e14', W:'#fffae0', T:'#e8b840',
        R:'#c89428', Y:'#fff6d0',
      }
      const sc = 2, ox = cx - DOG[0].length * sc / 2, oy = gy - 14 - DOG.length * sc
      for (let r = 0; r < DOG.length; r++)
        for (let c = 0; c < DOG[r].length; c++) {
          const ch = DOG[r][c]; if (ch === '.') continue
          g.fillStyle = GP[ch]
          g.fillRect((ox + c * sc) | 0, (oy + r * sc) | 0, Math.ceil(sc), Math.ceil(sc))
        }
      // 金属光泽:左上受光带(新网格已自带 h 高光/S 阴影,这里再叠一道整体镜面反光)
      g.fillStyle = 'rgba(255,255,255,0.16)'
      g.fillRect((ox + 5 * sc) | 0, (oy + 3 * sc) | 0, sc | 0, 22 * sc | 0)
    }
    function pier(cy) {
      g.fillStyle = 'rgba(16,38,58,0.34)'
      g.beginPath(); g.ellipse(338, cy + 13, 54, 8, 0, 0, 7); g.fill()        // 水下影
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1
      g.beginPath(); g.ellipse(338, cy + 15, 60, 7, 0, 0, 7); g.stroke()      // 涟漪
      g.beginPath(); g.ellipse(338, cy + 16, 68, 9, 0, 0, 7); g.stroke()
      px(290, cy - 10, 96, 20, '#5e5a50')
      px(291, cy - 9, 94, 18, '#8a8578')
      px(292, cy - 8, 92, 5, '#a8a294')                                       // 顶面受光
      for (let r = 0; r < 3; r++) px(292, cy - 2 + r * 4, 92, 1, 'rgba(40,36,30,0.30)')
    }
    function drawHouse(q) {
      if (q.kind === 'dome') houseDome(q.x, q.gy - 52, q.w, q.roof[0], q.roof[1], '#f2e3c8')
      else if (q.kind === 'tower') towerRound(q.x, q.gy - 96, q.w / 2, q.roof[0], q.roof[1], '#f2e3c8')
      else if (q.kind === 'shop') shopHouse(q.x, q.gy, q.w, '#f2e3c8', '#5a9a62')
      else if (q.kind === 'barn') barn(q.x, q.gy - 100, q.w)
      else if (q.kind === 'bldL') buildingL(q.x, q.gy, q.w, q.seed, { floors: 1 })
      // 第一排单层 —— 两层的屋顶会被画布上沿切掉
      else building(q.x, q.gy, q.w, q.seed, { floors: (q.row === 1 || q.row === 2) ? 2 : 1 })
    }
    const BY_ROW = Array.from({ length: 8 }, (_, r) => P40.filter((q) => q.row === r))

    for (let r = 0; r < 8; r++) {
      // 第四排画完之后铺广场 —— 它于是被第五排的房子挡去下沿，像真的嵌在坡上
      if (r === 4) {
        ellipseFill(PCX, PCY, 118, 62, '#cfc4ac')
        ellipseFill(PCX, PCY, 108, 54, '#ded4bd')
        for (let i = 0; i < 90; i++) {
          const a2 = rnd() * Math.PI * 2, rr = Math.sqrt(rnd())
          const sx = PCX + Math.cos(a2) * rr * 104, sy = PCY + Math.sin(a2) * rr * 50
          px(sx | 0, sy | 0, 2, 1, rnd() < 0.5 ? '#c8bda4' : '#e6ddc8')
        }
        goldStatue(PCX, PCY + 26)
      }
      // 第七排画完之后铺河 —— 第八排于是站在河那岸
      if (r === 7) {
        for (let x = 0; x < W; x++) {
          const ry = riverY(x) | 0, rh = riverH(x) | 0
          px(x, ry, 1, rh, '#4a7a9a')
          px(x, ry + 2, 1, rh - 6, '#5a8aaa')
          px(x, ry + 7, 1, ((rh - 16) > 2 ? rh - 16 : 2), '#6a9aba')
        }
        for (let i = 0; i < 70; i++) {
          const x = (rnd() * W) | 0
          px(x, (riverY(x) | 0) + 4 + ((rnd() * 20) | 0), 6, 1, 'rgba(230,244,255,0.35)')
        }
        // 木桥：架在路脊上，跨过河最宽处
        const BY = (riverY(352) | 0) - 6
        px(320, BY, 68, 46, '#8a6a44')
        for (let i = 0; i < 7; i++) px(322, BY + 3 + i * 6, 64, 3, '#a07c52')
        px(318, BY, 4, 46, '#6e5236'); px(386, BY, 4, 46, '#6e5236')
        pier((riverY(338) | 0) + 26)
      }
      for (const q of BY_ROW[r]) drawHouse(q)
    }

    // ═══ 农田：河这岸的边角 ═══
    const CROPS = {
      rice:   { soil: '#6e5230', row: '#5a9438', tip: '#c8c060', gap: 12, h: 5 },  // 稻:绿行金穗
      veg:    { soil: '#7a5638', row: '#3e7a34', tip: '#68a838', gap: 14, h: 6 },  // 菜:深绿丛
      wheat:  { soil: '#7e5c38', row: '#c8a850', tip: '#e8d078', gap: 11, h: 6 },  // 麦:金黄
      fallow: { soil: '#8a6440', row: null,      tip: null,      gap: 0, h: 0 },   // 新翻地:只有垄
    }
    function plotPath(cx, cy, rx, ry, seed) {
      // 不规则多边形(有直边)—— 真实的田是划出来的,不是长成椭圆的
      const r2 = mulberry32(seed)
      const N = 5 + ((r2() * 3) | 0)
      g.beginPath()
      for (let i = 0; i < N; i++) {
        const a2 = (i / N) * 6.283 + (r2() - 0.5) * 0.5
        const k = 0.86 + r2() * 0.30
        const px2 = cx + Math.cos(a2) * rx * k, py2 = cy + Math.sin(a2) * ry * k
        i ? g.lineTo(px2, py2) : g.moveTo(px2, py2)
      }
      g.closePath()
    }
    function plot(cx, cy, rx, ry, kind, seed) {
      const C2 = CROPS[kind]
      shadow(cx, cy + ry - 2, rx * 1.7, 3)
      plotPath(cx, cy, rx + 4, ry + 4, seed)                 // 田埂
      g.fillStyle = '#a8845c'; g.fill()
      plotPath(cx, cy, rx + 2, ry + 2, seed)
      g.fillStyle = '#8a6844'; g.fill()
      g.save(); plotPath(cx, cy, rx, ry, seed); g.clip()
      g.fillStyle = C2.soil; g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2)
      // 垄:横向,略带起伏
      const r3 = mulberry32(seed + 9)
      for (let yy = cy - ry; yy < cy + ry; yy += 8) {
        const wob = Math.sin((yy + seed) * 0.06) * 2
        px(cx - rx, yy + wob, rx * 2, 1, 'rgba(40,28,16,0.22)')
        px(cx - rx, yy + wob + 3, rx * 2, 1, 'rgba(255,240,200,0.07)')
      }
      if (C2.row) for (let yy = cy - ry + 4; yy < cy + ry - 2; yy += C2.gap) {
        const wob = Math.sin((yy + seed) * 0.06) * 2
        for (let xx = cx - rx + 4; xx < cx + rx - 3; xx += 10 + ((r3() * 5) | 0)) {
          const jy = wob + (r3() * 2 - 1)
          px(xx, yy + jy, 2, C2.h, C2.row)                   // 作物株
          px(xx, yy + jy - 2, 2, 2, C2.tip)                  // 穗 / 叶尖
          if (r3() < 0.3) px(xx + 2, yy + jy + 1, 1, C2.h - 2, C2.row)
        }
      }
      g.restore()
    }
    function plotOK(cx, cy, rx, ry) {
      const RX = rx + 2, RY = ry + 2
      for (const [ox, oy] of [[0, 0], [-RX, 0], [RX, 0], [0, -RY], [0, RY],
                              [-RX, -RY], [RX, -RY], [-RX, RY], [RX, RY]]) {
        const x = cx + ox, y = cy + oy
        if (x < 22 || x > W - 22) return false
        if (y > 1264) return false                             // 底部按钮遮挡区
        if (y < riverY(x) + riverH(x) + 16) return false        // 河 + 河岸
        const tx = (x / T) | 0, ty = (y / T) | 0
        if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return false
        if (road[ty][tx]) return false                          // 主路
        if (inHouse(x, y)) return false
      }
      return true
    }
    // kind 是 CROPS 的键，不是序号 —— 传序号会拿到 undefined，
    // 报出来是「读不到 soil」，指向的是画法，而错在调用。
    plot(96, 800, 46, 20, 'rice', 771)
    plot(608, 792, 44, 18, 'veg', 442)

    // ═══ 市集：广场边上两摊 ═══
    function stall(x, y, awn, goods) {
      shadow(x + 30, y + 40, 68, 5)
      px(x, y - 4, 4, 44, '#8a6844'); px(x + 56, y - 4, 4, 44, '#8a6844')
      // 条纹棚
      for (let k = 0; k < 5; k++) px(x - 4 + k * 14, y - 14, 14, 12, k % 2 ? awn : '#f6efdc')
      px(x - 6, y - 17, 74, 4, '#8a5c34')
      // 台板 + 货
      px(x - 2, y + 20, 64, 8, '#a06a40')
      px(x - 2, y + 20, 64, 3, '#c08a58')
      if (goods === 'fruit') {
        for (const [ox, oc] of [[6, '#e05038'], [20, '#e8b23d'], [34, '#5a9438'], [48, '#e87a90']]) {
          g.fillStyle = oc; g.beginPath(); g.arc(x + ox, y + 16, 5, 0, 7); g.fill()
          g.beginPath(); g.arc(x + ox + 5, y + 18, 4, 0, 7); g.fill()
        }
      } else {
        px(x + 4, y + 6, 16, 14, '#c08a58'); px(x + 6, y + 8, 12, 4, '#5a9438')
        px(x + 26, y + 8, 14, 12, '#c08a58'); px(x + 28, y + 4, 3, 6, '#e05038'); px(x + 33, y + 4, 3, 6, '#e05038')
        px(x + 44, y + 6, 12, 14, '#8a6844')
      }
      // 小旗
      px(x + 26, y - 26, 2, 12, '#8a5c34')
      px(x + 28, y - 26, 12, 8, awn)
    }
    stall(238, 498, '#c85a48', 0)
    stall(452, 502, '#4a7a9a', 1)

    // ═══ 花草灌木 ═══
    function bush(x, y, s) {
      shadow(x + 6 * s, y + 7 * s, 10 * s, 1.5 * s)
      g.fillStyle = '#3e6a34'; g.beginPath(); g.arc(x + 6 * s, y + 4 * s, 5 * s, 0, 7); g.fill()
      g.fillStyle = '#5a9438'; g.beginPath(); g.arc(x + 4 * s, y + 3 * s, 4 * s, 0, 7); g.fill()
      g.beginPath(); g.arc(x + 9 * s, y + 4 * s, 3.4 * s, 0, 7); g.fill()
      g.fillStyle = '#8ec858'; g.beginPath(); g.arc(x + 4 * s, y + 2 * s, 2 * s, 0, 7); g.fill()
    }
    function flowerbed(x, y, hue) {
      for (let k = 0; k < 7; k++) {
        const fx = x + (k % 4) * 9 + (k > 3 ? 4 : 0), fy = y + (k > 3 ? 7 : 0)
        px(fx + 1, fy + 4, 3, 5, '#5a9438')
        g.fillStyle = k % 2 ? hue : '#f6efdc'
        px(fx, fy, 2, 2); px(fx + 3, fy, 2, 2); px(fx + 1, fy - 2, 2, 2); px(fx + 1, fy + 2, 2, 2)
        g.fillStyle = '#e8b23d'; px(fx + 1, fy, 2, 2)
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = (rnd() * W) | 0, y = (rnd() * H) | 0
      if (!onGrass(x, y) || inHouse(x, y)) continue
      bush(x, y, 1 + rnd() * 0.6)
    }
    flowerbed(150, 470, 0); flowerbed(556, 474, 2)

    // ═══ 光与暗角 ═══
    g.save()
    g.fillStyle = 'rgba(255,196,120,0.055)'
    g.fillRect(0, 0, W, H)
    const vg = g.createRadialGradient(352, 460, 300, 352, 500, 640)
    vg.addColorStop(0, 'rgba(20,24,10,0)')
    vg.addColorStop(1, 'rgba(20,24,10,0.26)')
    g.fillStyle = vg
    g.fillRect(0, 0, W, H)
    g.restore()
    fgG.save()
    fgG.globalCompositeOperation = 'source-atop'
    fgG.fillStyle = 'rgba(255,196,120,0.055)'
    fgG.fillRect(0, 0, W, H)
    fgG.restore()
  }

  // ═══ 路网 ═══
  /* 村民走的路点图。2026-08-25 重排之后全部重画 —— 老的那 17 个点是给
     704 × 1920 那幅图定的，其中一个已经掉出画布，其余的落在新村子的房子上。
     **路点必须跟着构图走**：不跟的话村民会穿墙、会站在河里，而那不报错。

     形状照着路网来：一条脊(N→S)，两条横巷(广场那排、桥头那排)，
     两侧各留一串让人往边上溜达。 */
  const NAV = {
    // y 一律取【某排地面线往下十来像素】—— 那条草带是空的；
    // 取到排中间就会站进人家屋里（第一版 5 个点正是这么落的）。
    EN: [352, 62],  N1: [352, 120], N2: [352, 240],
    PZ: [352, 512], S1: [352, 600], S2: [352, 720],
    BR: [352, 850], SO: [352, 956],
    WN: [176, 240], EN2: [530, 240],
    WM: [176, 480], EM: [530, 480],
    WS: [190, 600], ES: [520, 600],
  }
  // 网状连线(横向 + 斜向 · 绕喷泉 · 自由漫游)
  const EDGES = {
    EN: ['N1'],
    N1: ['EN', 'N2', 'WN', 'EN2'],
    WN: ['N1', 'WM'], EN2: ['N1', 'EM'],
    N2: ['N1', 'PZ', 'WN', 'EN2'],
    PZ: ['N2', 'S1', 'WM', 'EM'],
    WM: ['PZ', 'WN', 'WS'], EM: ['PZ', 'EN2', 'ES'],
    S1: ['PZ', 'S2', 'WS', 'ES'],
    WS: ['S1', 'WM', 'S2'], ES: ['S1', 'EM', 'S2'],
    S2: ['S1', 'BR', 'WS', 'ES'],
    BR: ['S2', 'SO'], SO: ['BR'],
  }
  const NODES = Object.keys(NAV)
  function bfs(a, b) {
    if (a === b) return []
    const prev = { [a]: null }, q = [a]
    while (q.length) {
      const n = q.shift()
      for (const m of EDGES[n]) {
        if (m in prev) continue
        prev[m] = n
        if (m === b) {
          const p2 = [m]; let p = n
          while (p && p !== a) { p2.unshift(p); p = prev[p] }
          return p2
        }
        q.push(m)
      }
    }
    return []
  }
  // ═══════════ 对白系统(Rule-Based Response + Dialogue Exchange)═══════════
  // BARKS:单句规则 · criteria 全 AND · specificity 最高者胜 · cooldown 防复读
  // s=说话人 t=时间 x=天气 p=地点 n=附近角色 | cd=冷却(秒) w=权重
  const RULES = [
    { s:'ayun', t:'night', x:'rain', p:'home', cd:180, l:'雨夜，关灯，打游戏，人生圆满了' },
    { s:'ayun', t:'noon', x:'clear', p:'plaza', cd:150, l:'正午的广场太晒了，贫道要化了' },
    { s:'ayun', t:'morn', x:'clear', p:'river', cd:150, l:'清晨的河边起雾，像开了柔光滤镜' },
    { s:'ayun', t:'noon', x:'rain', p:'market', cd:150, l:'下雨天的市集，摊子都收了，那我买啥' },
    { s:'ayun', t:'dusk', x:'clear', p:'plaza', cd:150, l:'黄昏这个色温，和我存档界面一模一样' },
    { s:'ayun', t:'night', x:'rain', cd:120, l:'雨夜……被窝和主机，二选一，我全都要' },
    { s:'ayun', t:'night', p:'home', cd:90, l:'关灯打，更沉浸' },
    { s:'ayun', x:'rain', p:'market', cd:90, l:'伞？贫道算到了，但没带' },
    { s:'ayun', t:'dusk', p:'river', cd:90, l:'夕阳照水，像极了我的血条' },
    { s:'ayun', t:'morn', p:'market', cd:90, l:'早上的市集人真多，挤不动' },
    { s:'ayun', t:'night', p:'plaza', cd:90, l:'夜里的广场安静，适合思考人生和下一把' },
    { s:'ayun', x:'rain', p:'home', cd:90, l:'下雨了，回屋回屋' },
    { s:'ayun', t:'morn', p:'plaza', cd:90, l:'清晨的广场，只有我和喷泉醒着' },
    { s:'ayun', x:'rain', p:'river', cd:90, l:'雨天的河，鱼应该更好钓吧' },
    { s:'ayun', l:'……唔，早课又睡过了' },
    { s:'ayun', t:'morn', l:'天光正好，晒晒课本' },
    { s:'ayun', t:'morn', l:'一日之计在于……再睡五分钟' },
    { s:'ayun', t:'morn', l:'早饭吃啥，师父又不在' },
    { s:'ayun', t:'noon', l:'今天云不错' },
    { s:'ayun', t:'noon', l:'午后起一课，看看运气' },
    { s:'ayun', t:'noon', l:'师父说过什么来着' },
    { s:'ayun', t:'noon', l:'午睡是修行的一部分' },
    { s:'ayun', t:'dusk', l:'该收摊了……哦，我没摊' },
    { s:'ayun', t:'dusk', l:'夕阳这个色号绝了' },
    { s:'ayun', t:'dusk', l:'晚课前先打一把' },
    { s:'ayun', t:'dusk', l:'天要黑了，签到别忘了' },
    { s:'ayun', t:'night', l:'就打一把……就一把' },
    { s:'ayun', t:'night', l:'夜观天象，顺便看看攻略' },
    { s:'ayun', t:'night', l:'这局不能停！' },
    { s:'ayun', t:'night', l:'再玩十分钟就睡，真的' },
    { s:'ayun', t:'night', l:'熬夜伤身，但下一把能赢' },
    { s:'ayun', x:'rain', l:'雨天最适合睡觉' },
    { s:'ayun', x:'rain', l:'道袍湿了不好烘' },
    { s:'ayun', x:'rain', l:'这雨……我起过课的，准吧？' },
    { s:'ayun', x:'rain', l:'下雨了，网速会变慢吗' },
    { s:'ayun', p:'plaza', l:'喷泉水声挺催眠' },
    { s:'ayun', p:'plaza', l:'广场风水不错' },
    { s:'ayun', p:'market', l:'老板，能便宜点吗，道士也要吃饭' },
    { s:'ayun', p:'market', l:'这个能刷卡吗' },
    { s:'ayun', p:'river', l:'水动风生，好卦' },
    { s:'ayun', p:'river', l:'钓鱼比算命解压' },
    { s:'ayun', p:'home', l:'回屋回屋，主机等我' },
    { s:'ayun', p:'home', l:'家里有零食，广场没有' },
    { s:'ayun', p:'road', l:'走路也能睡着，是种天赋' },
    { s:'ayun', cd:25, w:0.4, l:'嗯……' },
    { s:'ayun', cd:25, w:0.4, l:'（打了个哈欠）' },
    { s:'ayun', cd:30, w:0.5, l:'无量天尊' },
    { s:'tao', t:'night', x:'rain', p:'home', cd:180, l:'雨夜直播，氛围感直接拉满，家人们冲' },
    { s:'tao', t:'dusk', x:'clear', p:'plaza', cd:150, l:'黄昏的广场，这个光，这个角度，开播！' },
    { s:'tao', t:'morn', x:'clear', p:'market', cd:150, l:'清晨的市集最新鲜，先拍个探店' },
    { s:'tao', t:'noon', x:'rain', p:'river', cd:150, l:'下雨天的河边，头发全废了' },
    { s:'tao', t:'night', x:'clear', p:'plaza', cd:150, l:'夜里的喷泉，打光绝了，来一条' },
    { s:'tao', t:'night', x:'rain', cd:120, l:'雨夜直播，氛围感拉满' },
    { s:'tao', x:'rain', p:'home', cd:90, l:'下雨？那今天不出门了，哼' },
    { s:'tao', t:'night', p:'plaza', cd:90, l:'夜里的奇门最灵，你不懂' },
    { s:'tao', t:'morn', p:'market', cd:90, l:'早市的桃子最甜，抢！' },
    { s:'tao', x:'rain', p:'market', cd:90, l:'雨天的市集，人少，好逛' },
    { s:'tao', t:'dusk', p:'river', cd:90, l:'黄昏的河边，适合拍写真' },
    { s:'tao', t:'morn', p:'home', cd:90, l:'清晨起局，一天都顺' },
    { s:'tao', t:'morn', l:'早八是谁发明的' },
    { s:'tao', t:'morn', l:'今天的妆是新色号' },
    { s:'tao', t:'morn', l:'起太早了……哼' },
    { s:'tao', t:'morn', l:'镜子呢？镜子！' },
    { s:'tao', t:'noon', l:'今日局不错哦' },
    { s:'tao', t:'noon', l:'正午阳气足，适合开播' },
    { s:'tao', t:'noon', l:'别拍我，我没化妆' },
    { s:'tao', t:'noon', l:'午饭？粉丝送的' },
    { s:'tao', t:'dusk', l:'黄昏光线最上镜' },
    { s:'tao', t:'dusk', l:'开播倒计时！' },
    { s:'tao', t:'dusk', l:'这个天色适合拍照' },
    { s:'tao', t:'night', l:'家人们，点个小红心' },
    { s:'tao', t:'night', l:'夜里的奇门更灵' },
    { s:'tao', t:'night', l:'晚安啦，别刷了' },
    { s:'tao', t:'night', l:'今晚的榜一是谁' },
    { s:'tao', x:'rain', l:'头发要炸了！' },
    { s:'tao', x:'rain', l:'雨天播效果差' },
    { s:'tao', x:'rain', l:'哼，伞我自己会撑' },
    { s:'tao', x:'rain', l:'妆要花了，救命' },
    { s:'tao', p:'plaza', l:'广场人多，适合直播' },
    { s:'tao', p:'plaza', l:'喷泉当背景板挺好' },
    { s:'tao', p:'market', l:'这桃子我全要了' },
    { s:'tao', p:'market', l:'老板，给个粉丝价' },
    { s:'tao', p:'river', l:'小心水，别弄脏裙子' },
    { s:'tao', p:'river', l:'拍个水边写真' },
    { s:'tao', p:'home', l:'哼，才没在等谁' },
    { s:'tao', p:'home', l:'我的房间不许乱进' },
    { s:'tao', p:'road', l:'走路要有仪态，懂？' },
    { s:'tao', cd:25, w:0.4, l:'哼。' },
    { s:'tao', cd:25, w:0.4, l:'（甩了下头发）' },
    { s:'tao', cd:30, w:0.5, l:'……看什么看' },
    { s:'popo', t:'night', x:'rain', p:'home', cd:180, l:'雨夜里，壁炉、热茶、小可爱们，齐了' },
    { s:'popo', t:'morn', x:'clear', p:'plaza', cd:150, l:'清晨的广场，露水最适合调药' },
    { s:'popo', t:'night', x:'clear', p:'river', cd:150, l:'月色正好，飞一圈去河边看看' },
    { s:'popo', t:'noon', x:'rain', p:'market', cd:150, l:'雨天的市集，给猫猫多买点鱼干' },
    { s:'popo', t:'dusk', x:'clear', p:'river', cd:150, l:'黄昏的河边，水灵最活跃' },
    { s:'popo', t:'night', x:'clear', cd:120, l:'月色正好，飞一圈' },
    { s:'popo', x:'rain', p:'home', cd:90, l:'下雨了，小可爱们都回窝了吗' },
    { s:'popo', t:'night', x:'rain', cd:90, l:'雨天骑扫帚？会感冒的' },
    { s:'popo', t:'dusk', p:'river', cd:90, l:'荷叶底下藏着东西哦' },
    { s:'popo', t:'morn', p:'market', cd:90, l:'早上的市集，果子最新鲜' },
    { s:'popo', t:'night', p:'plaza', cd:90, l:'夜里的广场，适合摆摊算命' },
    { s:'popo', x:'rain', p:'home', cd:90, l:'雨天的水晶球，看得更清' },
    { s:'popo', t:'morn', l:'小可爱们，开饭啦～' },
    { s:'popo', t:'morn', l:'露水最适合调药' },
    { s:'popo', t:'morn', l:'早呀，睡得好吗' },
    { s:'popo', t:'morn', l:'扫帚今天也要擦一擦' },
    { s:'popo', t:'noon', l:'在线占卜，好评返现' },
    { s:'popo', t:'noon', l:'扫帚该保养了' },
    { s:'popo', t:'noon', l:'午后来杯花茶？' },
    { s:'popo', t:'noon', l:'单子有点多，慢慢来' },
    { s:'popo', t:'dusk', l:'黄昏是通灵的好时辰' },
    { s:'popo', t:'dusk', l:'快递到了没？' },
    { s:'popo', t:'dusk', l:'水晶球有点浑' },
    { s:'popo', t:'night', l:'月亮真圆，飞一圈' },
    { s:'popo', t:'night', l:'夜里的塔罗最准' },
    { s:'popo', t:'night', l:'乖，吃糖' },
    { s:'popo', t:'night', l:'夜深了，早点回家哦' },
    { s:'popo', x:'rain', l:'骑扫帚淋雨会感冒的' },
    { s:'popo', x:'rain', l:'这雨我早算到了' },
    { s:'popo', x:'rain', l:'猫猫不许出门！' },
    { s:'popo', p:'plaza', l:'喷泉的水，聚气' },
    { s:'popo', p:'plaza', l:'广场适合摆摊算命' },
    { s:'popo', p:'market', l:'给猫猫买点鱼干' },
    { s:'popo', p:'market', l:'这果子给小家伙们' },
    { s:'popo', p:'river', l:'河边有水灵' },
    { s:'popo', p:'river', l:'荷叶下面藏着东西哦' },
    { s:'popo', p:'home', l:'小家伙们，婆婆回来啦' },
    { s:'popo', p:'home', l:'壁炉的火要添柴了' },
    { s:'popo', p:'road', l:'慢走呀，常来玩～' },
    { s:'popo', cd:25, w:0.4, l:'呵呵呵' },
    { s:'popo', cd:25, w:0.4, l:'（塞给你一颗糖）' },
    { s:'popo', cd:30, w:0.5, l:'心诚则灵哦' },
    { s:'tenz', t:'night', x:'rain', p:'home', cd:180, l:'雨夜，鼓声，谁也别拦我' },
    { s:'tenz', t:'noon', x:'clear', p:'plaza', cd:150, l:'正午的广场，空旷，回音好，排练！' },
    { s:'tenz', t:'morn', x:'clear', p:'river', cd:150, l:'清晨的河边打坐，心最静' },
    { s:'tenz', t:'noon', x:'rain', p:'market', cd:150, l:'雨天的市集，牛肉降价了没' },
    { s:'tenz', t:'night', x:'clear', p:'plaza', cd:150, l:'夜里的广场，月光当灯，练！' },
    { s:'tenz', t:'night', x:'clear', cd:120, l:'夜练，月光当灯' },
    { s:'tenz', x:'rain', p:'river', cd:90, l:'雨中打坐，妙' },
    { s:'tenz', t:'dusk', p:'plaza', cd:90, l:'今晚摇滚法会！广场借我用用' },
    { s:'tenz', t:'night', x:'rain', cd:90, l:'雨打鼓皮……心疼' },
    { s:'tenz', t:'morn', p:'road', cd:90, l:'早课后先跑十圈' },
    { s:'tenz', t:'dusk', p:'home', cd:90, l:'黄昏收功，回去练琴' },
    { s:'tenz', t:'morn', l:'一百零八式，走起' },
    { s:'tenz', t:'morn', l:'晨练！嘿哈' },
    { s:'tenz', t:'morn', l:'酥油茶，巴适' },
    { s:'tenz', t:'morn', l:'今天先来两百个俯卧撑' },
    { s:'tenz', t:'noon', l:'正午练功，出汗才痛快' },
    { s:'tenz', t:'noon', l:'今天加练二十组' },
    { s:'tenz', t:'noon', l:'中午吃三碗' },
    { s:'tenz', t:'dusk', l:'黄昏拉伸，收功' },
    { s:'tenz', t:'dusk', l:'今晚摇滚法会！' },
    { s:'tenz', t:'dusk', l:'调一下吉他' },
    { s:'tenz', t:'night', l:'夜练，月光当灯' },
    { s:'tenz', t:'night', l:'咚次哒次——' },
    { s:'tenz', t:'night', l:'深夜的鼓最带劲' },
    { s:'tenz', t:'night', l:'这段 riff 我想了三天' },
    { s:'tenz', x:'rain', l:'雨中练拳更有味' },
    { s:'tenz', x:'rain', l:'鼓皮受潮了，可惜' },
    { s:'tenz', x:'rain', l:'淋雨也是修行' },
    { s:'tenz', p:'plaza', l:'广场空旷，适合打拳' },
    { s:'tenz', p:'plaza', l:'这里回音好，适合排练' },
    { s:'tenz', p:'market', l:'来两斤牛肉！' },
    { s:'tenz', p:'market', l:'蛋白粉快没了' },
    { s:'tenz', p:'river', l:'河边打坐，心静' },
    { s:'tenz', p:'river', l:'水声像鼓点' },
    { s:'tenz', p:'home', l:'回去练琴' },
    { s:'tenz', p:'home', l:'粉色，是力量的颜色' },
    { s:'tenz', p:'road', l:'让一让，负重跑' },
    { s:'tenz', cd:25, w:0.4, l:'嘿哈！' },
    { s:'tenz', cd:25, w:0.4, l:'（甩了甩头）' },
    { s:'tenz', cd:30, w:0.5, l:'扎西德勒' },
    { s:'villm', t:'night', x:'rain', p:'road', cd:150, l:'雨夜路滑，早点回吧' },
    { s:'villm', t:'morn', x:'clear', p:'market', cd:120, l:'清晨的市集，抢早菜' },
    { s:'villm', x:'rain', p:'market', cd:90, l:'这雨说下就下，伞带了没' },
    { s:'villm', t:'night', x:'rain', cd:90, l:'夜路滑，慢点走' },
    { s:'villm', t:'night', p:'plaza', cd:60, l:'天黑了，灯都亮了' },
    { s:'villm', t:'morn', p:'market', cd:90, l:'早市的菜最新鲜' },
    { s:'villm', t:'dusk', p:'road', cd:90, l:'黄昏该回家做饭了' },
    { s:'villm', t:'morn', l:'早啊' },
    { s:'villm', t:'morn', l:'今儿天气真好' },
    { s:'villm', t:'morn', l:'去买个菜' },
    { s:'villm', t:'morn', l:'赶早市去' },
    { s:'villm', t:'noon', l:'午饭吃啥好' },
    { s:'villm', t:'noon', l:'晒得慌' },
    { s:'villm', t:'noon', l:'歇会儿再走' },
    { s:'villm', t:'dusk', l:'该回家做饭了' },
    { s:'villm', t:'dusk', l:'天要黑了' },
    { s:'villm', t:'dusk', l:'回见啊' },
    { s:'villm', t:'night', l:'夜路小心' },
    { s:'villm', t:'night', l:'早点睡吧' },
    { s:'villm', t:'night', l:'灯都亮了' },
    { s:'villm', x:'rain', l:'这雨说下就下' },
    { s:'villm', x:'rain', l:'伞带了没？' },
    { s:'villm', x:'rain', l:'路滑，慢点' },
    { s:'villm', p:'plaza', l:'喷泉修好了啊' },
    { s:'villm', p:'plaza', l:'广场热闹' },
    { s:'villm', p:'plaza', l:'坐会儿' },
    { s:'villm', p:'market', l:'这个多少钱' },
    { s:'villm', p:'market', l:'给我来两斤' },
    { s:'villm', p:'market', l:'新鲜吗？' },
    { s:'villm', p:'river', l:'河边风凉快' },
    { s:'villm', p:'river', l:'钓两条鱼' },
    { s:'villm', p:'river', l:'水涨了' },
    { s:'villm', p:'home', l:'到家了' },
    { s:'villm', p:'road', l:'走咯' },
    { s:'villm', cd:25, w:0.4, l:'嗯。' },
    { s:'villm', cd:25, w:0.4, l:'（点了点头）' },
    { s:'vfruit', x:'rain', p:'market', cd:120, l:'雨天果子降价，进棚里躲躲雨' },
    { s:'vfruit', t:'night', p:'market', cd:120, l:'夜市也开张！灯下看果子更好看' },
    { s:'vfruit', t:'morn', cd:90, l:'清晨刚摘的果子，还带露水' },
    { s:'vfruit', t:'morn', l:'新鲜果子嘞！' },
    { s:'vfruit', t:'morn', l:'天没亮就摘的' },
    { s:'vfruit', t:'noon', l:'来看看，果子甜得很' },
    { s:'vfruit', t:'noon', l:'两文一斤，不贵' },
    { s:'vfruit', t:'dusk', l:'最后两斤，便宜卖' },
    { s:'vfruit', t:'dusk', l:'收摊咯' },
    { s:'vfruit', t:'night', l:'夜里的果子更甜' },
    { s:'vfruit', x:'rain', l:'雨天不加价' },
    { s:'vfruit', p:'market', l:'自家种的，不甜不要钱' },
    { s:'vfruit', p:'market', l:'尝一个？' },
    { s:'vfruit', cd:25, w:0.6, l:'走过路过别错过' },
    { s:'vveg', x:'rain', p:'market', cd:120, l:'雨天青菜降价，进棚里躲躲雨' },
    { s:'vveg', t:'night', p:'market', cd:120, l:'夜市也开张！灯下看青菜更好看' },
    { s:'vveg', t:'morn', cd:90, l:'清晨刚摘的青菜，还带露水' },
    { s:'vveg', t:'morn', l:'新鲜青菜嘞！' },
    { s:'vveg', t:'morn', l:'天没亮就摘的' },
    { s:'vveg', t:'noon', l:'来看看，青菜甜得很' },
    { s:'vveg', t:'noon', l:'两文一斤，不贵' },
    { s:'vveg', t:'dusk', l:'最后两斤，便宜卖' },
    { s:'vveg', t:'dusk', l:'收摊咯' },
    { s:'vveg', t:'night', l:'夜里的青菜更甜' },
    { s:'vveg', x:'rain', l:'雨天不加价' },
    { s:'vveg', p:'market', l:'自家种的，不甜不要钱' },
    { s:'vveg', p:'market', l:'尝一个？' },
    { s:'vveg', cd:25, w:0.6, l:'走过路过别错过' },
    { s:'vpeach', x:'rain', p:'market', cd:120, l:'雨天桃子降价，进棚里躲躲雨' },
    { s:'vpeach', t:'night', p:'market', cd:120, l:'夜市也开张！灯下看桃子更好看' },
    { s:'vpeach', t:'morn', cd:90, l:'清晨刚摘的桃子，还带露水' },
    { s:'vpeach', t:'morn', l:'新鲜桃子嘞！' },
    { s:'vpeach', t:'morn', l:'天没亮就摘的' },
    { s:'vpeach', t:'noon', l:'来看看，桃子甜得很' },
    { s:'vpeach', t:'noon', l:'两文一斤，不贵' },
    { s:'vpeach', t:'dusk', l:'最后两斤，便宜卖' },
    { s:'vpeach', t:'dusk', l:'收摊咯' },
    { s:'vpeach', t:'night', l:'夜里的桃子更甜' },
    { s:'vpeach', x:'rain', l:'雨天不加价' },
    { s:'vpeach', p:'market', l:'自家种的，不甜不要钱' },
    { s:'vpeach', p:'market', l:'尝一个？' },
    { s:'vpeach', cd:25, w:0.6, l:'走过路过别错过' },
  ]
  // CONVOS:碰面触发的多轮对话 · a 开场 · L=[[a|b, 台词]…]
  const CONVOS = [
    { a:'tao', b:'ayun', L:[['a','喂，道士，别走路睡觉'],['b','……唔？哦，桃桃啊'],['a','哼，眼睛都睁不开'],['b','贫道这叫闭目养神']] },
    { a:'tao', b:'ayun', L:[['a','你昨晚几点睡的'],['b','……三点？'],['a','难怪脸这么青'],['b','是月光的颜色']] },
    { a:'tao', b:'ayun', cd:240, L:[['a','帮我起一课，看我今晚能不能上榜'],['b','课不能乱起'],['a','两包辣条'],['b','……好的，这就起']] },
    { a:'tao', b:'ayun', t:'night', cd:240, L:[['a','你那游戏有什么好玩的'],['b','你试试就知道了'],['a','哼，才不要'],['b','（小声）她昨天玩到两点']] },
    { a:'tao', b:'ayun', x:'rain', cd:240, L:[['a','下雨了还不回家？'],['b','正好，雨声助眠'],['a','……你也就这点出息']] },
    { a:'tao', b:'ayun', p:'market', cd:240, L:[['a','早市的桃子被我包了'],['b','贫道只想买两个'],['a','……给你一个'],['b','善哉']] },
    { a:'popo', b:'ayun', L:[['a','小道士，气色不太好哦'],['b','昨晚熬夜了'],['a','来，吃颗糖'],['b','谢婆婆']] },
    { a:'popo', b:'ayun', L:[['a','年轻人要早睡'],['b','贫道在参悟'],['a','参悟什么'],['b','……排位赛的机制']] },
    { a:'popo', b:'ayun', p:'plaza', cd:240, L:[['a','这单子接不完，帮我算算？'],['b','按小时算钱'],['a','管饭'],['b','成交']] },
    { a:'popo', b:'ayun', x:'rain', cd:240, L:[['a','雨天关节疼哦'],['b','婆婆，我帮你把窗关上'],['a','乖孩子～']] },
    { a:'tenz', b:'ayun', L:[['a','小道士，一起练？'],['b','……贫道更适合静功'],['a','躺着不算静功'],['b','躺着最静']] },
    { a:'tenz', b:'ayun', t:'dusk', cd:240, L:[['a','今晚有法会，来听鼓'],['b','几点结束'],['a','天亮'],['b','那贫道正好打完游戏来']] },
    { a:'tenz', b:'ayun', cd:300, L:[['a','你那手柄能借我看看吗'],['b','小心点，它比我贵'],['a','（按坏了）'],['b','………………']] },
    { a:'popo', b:'tao', L:[['a','小姑娘，笑一个，运气会来的'],['b','哼，我笑起来很贵的'],['a','那婆婆请你喝花茶'],['b','……那勉强笑一下']] },
    { a:'popo', b:'tao', L:[['a','这个色号衬你'],['b','婆婆懂行！'],['a','婆婆年轻时候也爱美的'],['b','看得出来～']] },
    { a:'popo', b:'tao', p:'plaza', cd:240, L:[['a','塔罗和奇门，你更信哪个'],['b','当然是奇门'],['a','那你翻一张试试'],['b','……为什么是塔？']] },
    { a:'tao', b:'tenz', L:[['a','你那鼓声太吵了！'],['b','那是节奏'],['a','那是噪音'],['b','……要不要来我们乐队']] },
    { a:'tao', b:'tenz', p:'plaza', cd:240, L:[['a','广场是我的直播位'],['b','广场是我的排练场'],['a','哼'],['b','哼']] },
    { a:'tao', b:'tenz', cd:300, L:[['a','你身上……是粉色的？'],['b','怎么，不行？'],['a','……挺好看的，哼']] },
    { a:'popo', b:'tenz', L:[['a','壮小伙，喝杯花茶？'],['b','有酥油茶吗'],['a','没有，但有糖'],['b','……那来一颗']] },
    { a:'popo', b:'tenz', t:'night', cd:240, L:[['a','今晚的鼓，能小声点吗'],['b','可以，为了婆婆'],['a','乖～']] },
    { a:'villm', b:'ayun', L:[['a','道长，帮我看看今天出门顺不顺'],['b','（掐指）……顺'],['a','这么快？'],['b','贫道快，但准']] },
    { a:'villm', b:'tao', L:[['a','姑娘，你是那个主播吧！'],['b','哼，你也刷到我了'],['a','能合张影吗'],['b','……就一张']] },
    { a:'villm', b:'popo', L:[['a','婆婆，我家猫丢了'],['b','往河边找找，它在看鱼'],['a','谢谢婆婆！']] },
    { a:'villm', b:'tenz', L:[['a','师父好！'],['b','（点头）'],['a','……好酷']] },
    { a:'villm', b:'villm', x:'rain', cd:180, L:[['a','这雨要下到啥时候'],['b','谁知道呢'],['a','唉']] },
    { a:'villm', b:'villm', L:[['a','听说要来新住户了'],['b','空屋还有几间？'],['a','一间吧']] },
    { a:'vfruit', b:'tao', p:'market', cd:240, L:[['a','姑娘，这果子甜！'],['b','拍个视频，给你导流'],['a','那这筐送你！']] },
    { a:'vveg', b:'tenz', p:'market', cd:240, L:[['a','大师，来点青菜？'],['b','有牛肉吗'],['a','……隔壁'],['b','（走了）']] },
    { a:'vpeach', b:'popo', p:'market', cd:240, L:[['a','婆婆，今天的桃子最甜'],['b','给小家伙们来两斤'],['a','好嘞！']] },
    { a:'vfruit', b:'ayun', p:'market', cd:240, L:[['a','道长，来点果子？'],['b','贫道……身上没带钱'],['a','（叹气）先拿去吧']] },
  ]
  const cdUntil = new Array(RULES.length).fill(0)
  const convoCd = new Array(CONVOS.length).fill(0)
  const PLACE = {
    PT: 'plaza', PL: 'plaza', PR: 'plaza', PB: 'plaza',
    Wl: 'market', Rt2: 'market', L1: 'market',
    Rv2: 'river', M3: 'river', M4: 'river',
    HA: 'home', HT: 'home', HP: 'home', HZ: 'home',
    EN: 'road', M2: 'road', L2: 'road',
  }
  let curTime = 'noon', curWx = 'clear', curRain = 0
  function nearOf(v) {
    const out = []
    for (const o of 在场()) {
      if (o === v || o.mode === 'home') continue
      if (Math.hypot(o.x - v.x, o.y - v.y) < 72) out.push(o.lk)
    }
    return out
  }
  // 单句:AND 匹配 → 最高特异度层 → 冷却过滤 → 加权随机
  function pickSay(v, now) {
    const ctx = { s: v.lk, t: curTime, x: curWx, p: PLACE[v.node] || 'road', n: nearOf(v) }
    let best = -1, pool = []
    for (let i = 0; i < RULES.length; i++) {
      const r = RULES[i]
      if (r.s !== ctx.s) continue
      if (r.t && r.t !== ctx.t) continue
      if (r.x && r.x !== ctx.x) continue
      if (r.p && r.p !== ctx.p) continue
      if (r.n && ctx.n.indexOf(r.n) < 0) continue
      if (now < cdUntil[i]) continue
      const spec = (r.t ? 1 : 0) + (r.x ? 1 : 0) + (r.p ? 1 : 0) + (r.n ? 1 : 0)
      if (spec > best) { best = spec; pool = [i] }
      else if (spec === best) pool.push(i)
    }
    if (!pool.length) return null
    let tot = 0
    for (const i of pool) tot += (RULES[i].w || 1)
    let roll = Math.random() * tot, hit = pool[0]
    for (const i of pool) { roll -= (RULES[i].w || 1); if (roll <= 0) { hit = i; break } }
    cdUntil[hit] = now + (RULES[hit].cd || 45) * 1000
    return RULES[hit].l
  }

  // ─── 碰面对话:检测 → 概率触发 → 多轮播放 ───
  const MEET_DIST = 74        // 碰面距离
  const MEET_CHANCE = 0.35    // 每次碰面触发概率
  const LINE_MS = 2200        // 每句停留
  let convo = null            // { va, vb, script, i, nextAt, ci }
  let meetCheckAt = 0

  function tryMeet(now) {
    if (convo || now < meetCheckAt) return
    meetCheckAt = now + 900
    const 场2 = 在场()
    for (let i = 0; i < 场2.length; i++) {
      for (let j = i + 1; j < 场2.length; j++) {
        const A = 场2[i], B = 场2[j]
        if (A.mode === 'home' || B.mode === 'home') continue
        if (A.mode === 'talk' || B.mode === 'talk') continue
        if (A.fly || B.fly) continue                    // 飞行中不停下聊天
        if (Math.hypot(A.x - B.x, A.y - B.y) > MEET_DIST) continue
        if (Math.random() > MEET_CHANCE) continue
        const place = PLACE[A.node] || 'road'
        let best = -1, pool = []
        for (let k = 0; k < CONVOS.length; k++) {
          const cv = CONVOS[k]
          if (now < convoCd[k]) continue
          let va, vb
          if (cv.a === A.lk && cv.b === B.lk) { va = A; vb = B }
          else if (cv.a === B.lk && cv.b === A.lk) { va = B; vb = A }
          else continue
          if (cv.t && cv.t !== curTime) continue
          if (cv.x && cv.x !== curWx) continue
          if (cv.p && cv.p !== place) continue
          const spec = (cv.t ? 1 : 0) + (cv.x ? 1 : 0) + (cv.p ? 1 : 0)
          if (spec > best) { best = spec; pool = [[k, va, vb]] }
          else if (spec === best) pool.push([k, va, vb])
        }
        if (!pool.length) continue
        const [ci, va, vb] = pool[(Math.random() * pool.length) | 0]
        convoCd[ci] = now + (CONVOS[ci].cd || 200) * 1000
        va.mode = 'talk'; vb.mode = 'talk'
        va.sayText = null; vb.sayText = null
        convo = { va, vb, script: CONVOS[ci].L, i: 0, nextAt: now, ci }
        return
      }
    }
  }
  function stepConvo(now) {
    if (!convo) return
    // 走散了就中断
    if (Math.hypot(convo.va.x - convo.vb.x, convo.va.y - convo.vb.y) > MEET_DIST + 40) { endConvo(now); return }
    if (now < convo.nextAt) return
    if (convo.i >= convo.script.length) { endConvo(now); return }
    const [who, line] = convo.script[convo.i]
    const sp = who === 'a' ? convo.va : convo.vb
    const other = who === 'a' ? convo.vb : convo.va
    sp.sayText = line; sp.sayUntil = now + LINE_MS + 200
    other.sayText = null
    convo.i++
    convo.nextAt = now + LINE_MS
  }
  function endConvo(now) {
    if (!convo) return
    convo.va.mode = 'idle'; convo.vb.mode = 'idle'
    convo.va.until = now + 1200 + Math.random() * 2000
    convo.vb.until = now + 1200 + Math.random() * 2000
    convo = null
  }

  function mkV(sprB, startNode, says, opts) {
    return Object.assign({
      spr: sprB, node: startNode, home: startNode, says,
      lk: sprB,
      umb: ['#c85a48', '#4a6a88', '#5a9438', '#e8b23d', '#8a6aaa'][(startNode.charCodeAt(0) + startNode.length) % 5],
      x: NAV[startNode][0] - 16, y: NAV[startNode][1] - 36,
      mode: 'idle', until: globalThis.ENGINE_HOST.now() + 2000 + Math.random() * 4000,
      path: [], tx: 0, ty: 0, sayText: null, sayUntil: 0, fly: false, doorFlash: 0,
    }, opts || {})
  }
  /* 走动的村民。起点用的是 NAV 里的点名 —— 2026-08-25 重排之后
     老的那些点(HA/HT/HP/HZ/PL/PR/M2/Rt2/Rv2/Wl)全没了，
     不跟着改的话 mkV 会读 NAV[undefined][0]，整块画布直接不出来。
     指派原则：各自站在【自家附近】那个点上。 */
  const villagers = [
    /* 【这四位是四十位里的】—— 请回家之后才在村里走动。
       没请回来的人在你的村子里溜达、还冒着台词气泡，跟卡片上那句
       「四十间屋子，还都空着 · 0/40」直接打架：新用户第一眼看见的是
       一个已经很热闹的村子，那「请人回家」的动机就没了。
       这也正是「还没请回来的人连名字都不该知道」那条设定 ——
       而这儿是从正门破的。下面 `cast: true` 就是这个标记。
       没标的那些是路人（villm），村子的生气归他们，不受此限。 */
    mkV('ayun', 'WN', ['今天云不错', '就打一把……就一把', '课上说什么来着'], { cast: true }),
    mkV('tao', 'WM', ['今日局不错哦', '家人们，点个小红心', '哼，才没在等谁'], { cast: true }),
    mkV('popo', 'PZ', ['在线占卜，好评返现', '乖，吃糖', '快递到了没？'], { fly: true, cast: true }),
    mkV('tenz', 'N1', ['一百零八式，走起', '今晚摇滚法会！', '酥油茶，巴适'], { cast: true }),
    mkV('villm', 'EN2', ['今儿天气真好', '去买个菜', '早啊'], { remap: { h: '#5a4028', b: '#5a8a44' } }),
    mkV('villm', 'EM', ['听说要来新住户', '这瓜甜', '回见'], { remap: { h: '#3a2c20', b: '#c85a48' } }),
    mkV('villm', 'S1', ['纳个吉去', '午饭吃啥好', '哎哟'], { remap: { h: '#6e5236', b: '#4a6a88' } }),
    mkV('villm', 'ES', ['奶茶买一送一！', '慢走啊', '街口新开了铺子'], { remap: { h: '#3a2c20', b: '#c8a0e8' } }),
    mkV('villm', 'S2', ['河边风凉快', '钓两条鱼', '你也来啦'], { remap: { h: '#5a4028', b: '#e8b23d' } }),
    // 摊贩：站着不动，位置跟着 renderStatic 里那两个摊子走
    mkV('villm', 'PZ', ['新鲜果子嘞！', '来看看', '甜得很'], { remap: { h: '#3a2c20', b: '#c85a48' }, stationary: true, x: 214, y: 486, lk: 'vfruit' }),
    mkV('villm', 'PZ', ['时令青菜！', '刚摘的', '两文一斤'], { remap: { h: '#6e5236', b: '#5a9438' }, stationary: true, x: 476, y: 490, lk: 'vveg' }),
    mkV('villm', 'WS', ['桃子便宜卖', '走过路过别错过', '尝一个？'], { remap: { h: '#3a2c20', b: '#e8b23d' }, stationary: true, x: 168, y: 616, lk: 'vpeach' }),
  ]


  /* 此刻【在场】的那些人。四十位里的（`cast`）请回家之后才算在场；
     路人一直在场，村子的生气归他们。

     做成一个取数口而不是在七处各加一次判断 —— 七处里漏掉一处，
     那位就会半个身子在场：走动的循环跳过他，画的循环还画他。
     `HOME` 是同一份真相（门口木牌换灯笼也读它）。 */
  function 在场() {
    return villagers.filter((v) => !v.cast || HOME[v.spr])
  }

  let frame = 0, lastT = 0
  const clouds = [
    { x: 40, y: 26, s: 1.5, tint: 0 }, { x: 300, y: 58, s: 1.1, tint: 1 },
    { x: 520, y: 40, s: 0.9, tint: 0 }, { x: 160, y: 96, s: 0.7, tint: 2 },
    { x: 600, y: 110, s: 1.2, tint: 1 }, { x: 420, y: 150, s: 0.6, tint: 0 },
    { x: 80, y: 170, s: 0.85, tint: 2 },
  ]
  const ducks = [{ x: 120, dir: 1, ph: 0 }, { x: 500, dir: -1, ph: 3 }]
  const pets = [
    { spr: 'dog', x: 258, y: 622, tx: 258, ty: 622, dir: 1, mode: 'act', until: 0, sc: 3, say: '汪！', barkUntil: 0, nextBark: 6000, sp: 2.4 },
    { spr: 'cat', x: 462, y: 764, tx: 462, ty: 764, dir: 1, mode: 'act', until: 0, sc: 3, say: '喵~', barkUntil: 0, nextBark: 11000, sp: 1.6 },
  ]
  const petPts = [[196, 502], [326, 636], [458, 604], [242, 758], [418, 822], [562, 684]]
  const birds = [{ x: -40, y: 122, ph: 0 }, { x: -220, y: 78, ph: 2 }, { x: -380, y: 168, ph: 4 }]
  const dflies = [{ bx: 258, by: 992, ph: 0 }, { bx: 462, by: 1006, ph: 2.5 }]
  // 夜间灯光点(暖光位置 · [x,y,r])
  const LIGHTS = [
    [318, 362, 30], [386, 642, 30], [318, 822, 30], [390, 1062, 30],   // 路灯
    [499, 794, 26], [226, 710, 26],                                     // 招牌
    [340, 500, 40],                                                     // 喷泉
    // 全屋窗灯
    [61, 228, 15], [174, 154, 15], [274, 190, 15], [474, 168, 15], [582, 190, 15], [621, 300, 15], [41, 340, 15], [123, 388, 15],
    [38, 514, 15], [492, 422, 15], [625, 354, 15], [628, 486, 15], [137, 630, 15], [45, 702, 15], [507, 692, 15], [630, 598, 15],
    [629, 774, 15], [407, 828, 15], [205, 764, 15], [60, 894, 15], [169, 918, 15], [582, 890, 15], [51, 1104, 15], [635, 1114, 15],
  ]
  // 星空(固定伪随机 · 夜间闪)
  const STARS = Array.from({ length: 46 }, (_, k) => [
    (k * 137 + 30) % 700, 20 + (k * 83) % 180, (k % 5) * 0.2 + 0.3, k
  ])
  // 灯笼串灯(暖橙)
  const LANTS = []
  for (let k = 1; k <= 5; k++) { const tt = k / 6; LANTS.push([250 + 220 * tt, 150 + Math.sin(tt * Math.PI) * 56 + 8 * tt + 13]) }
  const fireflies = Array.from({ length: 16 }, (_, k) => ({ x: 60 + k * 40, y: 300 + (k * 97) % 900, ph: k }))

  // 一帧。宿主给画布上下文与时刻。
  function frame2(mainG, t) {
    // 像素画必须关插值。设在这里而不是宿主那边:忘了关的症状是整幅村子发糊,
    // 而每个宿主都得记住一遍的事,迟早有一个记不住。
    mainG.imageSmoothingEnabled = false
    if (t - lastT < 50) return
    lastT = t; frame++

    // ═══ 世界状态:时间 / 天气(供语料库与渲染共用)═══
    /* 昼夜跟【真实时刻】走，不再是两千帧一轮（约一百秒一天）。

       原先屏上写着「早上好」而画面是深夜 —— 问候语按你几点，村子按它自己
       转到哪儿了，两件事各说各的。设计册 0830 §6.1 把「时间在走」定成
       这一版的第一条主线，而这正是它最该成立的地方:
       你早上来和晚上来看见的不是同一个村子，那才是回来看看的理由。

       画面不会因此变静:村民照样走动、动物照样叫、萤火虫照样飞 ——
       变慢的只有光。

       `VILLAGE_CLOCK` 可以覆盖小时数（0–24），给要确定性的场合用。
       回归那支只钉烘好的静态层（地形与房屋，与时间无关），不受这里影响。 */
    const 钟 = typeof globalThis.VILLAGE_CLOCK === 'number'
      ? globalThis.VILLAGE_CLOCK
      : (() => { const d = new Date(ENGINE_HOST.now()); return d.getHours() + d.getMinutes() / 60 })()
    /* 作息按人来分，不按十二等分:
       5:00–6:30 天亮 · 6:30–17:30 白天 · 17:30–19:30 日落 · 19:30–5:00 夜 */
    let dRaw
    if (钟 < 5) dRaw = 1
    else if (钟 < 6.5) dRaw = 1 - (钟 - 5) / 1.5
    else if (钟 < 17.5) dRaw = 0
    else if (钟 < 19.5) dRaw = (钟 - 17.5) / 2
    else dRaw = 1
    // 语料库按时段挑话 —— 也跟着真实时刻，村民才不会在你的早晨道晚安
    const dayT = 钟 / 24
    /* 四段跟上面的天色用同一批边界。差一点点都会露馅:
       凌晨两点若还算 morn，婆婆就在满天星斗下道早安。 */
    curTime = (钟 < 5 || 钟 >= 19.5) ? 'night' : 钟 < 11 ? 'morn' : 钟 < 17.5 ? 'noon' : 'dusk'
    const rp = (frame % 4200) / 4200
    curRain = (rp > 0.72 && rp < 0.93) ? Math.sin((rp - 0.72) / 0.21 * Math.PI) : 0
    curWx = curRain > 0.25 ? 'rain' : 'clear'
    // 副标题:算在这里,写在哪儿是宿主的事(设计页写进一个 <span>,
    // 小程序 setData 到 WXML)。引擎只把算好的那句话挂出去。
    if (frame % 20 === 0) {
      const tl = { morn: '清晨', noon: '正午', dusk: '黄昏', night: '夜里' }[curTime]
      const wl = curRain > 0.55 ? '雨' : curRain > 0.12 ? '小雨' : '晴'
      globalThis.VILLAGE_SUB = '村民 ' + 在场().length + ' · ' + tl + ' · ' + wl
    }

    // 碰面判定 + 对话推进
    tryMeet(t)
    stepConvo(t)

    for (const v of 在场()) {
      if (v.mode === 'talk') continue          // 对话中:站定不动
      if (v.stationary) {
        if (t > v.until) {
          v.until = t + 4000 + Math.random() * 5000
          if (Math.random() < 0.5) { const s = pickSay(v, t); if (s) { v.sayText = s; v.sayUntil = t + 2600 } }
        }
        if (v.sayText && t >= v.sayUntil) v.sayText = null
        continue
      }
      if (v.mode === 'home') {
        if (t > v.until) {
          v.mode = 'idle'
          v.until = t + 1800 + Math.random() * 2500
          v.doorFlash = t + 700
          if (Math.random() < 0.6) {
            const s = pickSay(v, t); if (s) { v.sayText = s; v.sayUntil = t + 2600 }
          }
        }
      } else if (v.mode === 'idle') {
        if (t > v.until) {
          if (v.node === v.home && Math.random() < 0.4) {
            v.mode = 'home'
            v.until = t + 6000 + Math.random() * 12000
            v.doorFlash = t + 700
            v.sayText = null
          } else {
            let target
            do { target = NODES[(Math.random() * NODES.length) | 0] } while (target === v.node)
            const nodes = bfs(v.node, target)
            v.path = nodes.map(n => [NAV[n][0] - 16, NAV[n][1] - 36])
            v.node = target
            if (v.path.length) { const n = v.path.shift(); v.tx = n[0]; v.ty = n[1]; v.mode = 'walk' }
            else v.until = t + 3000
          }
        }
      } else {
        const sp = v.fly ? 4.6 : 3.2
        const ddx = v.tx - v.x, ddy = v.ty - v.y
        const dist = Math.sqrt(ddx * ddx + ddy * ddy)
        if (dist > sp) {
          v.x += ddx / dist * sp
          v.y += ddy / dist * sp
        } else if (v.path.length) { const n = v.path.shift(); v.tx = n[0]; v.ty = n[1] }
        else {
          v.x = v.tx; v.y = v.ty
          v.mode = 'idle'
          v.until = t + 3000 + Math.random() * 6000
          if (Math.random() < 0.4) {
            const s = pickSay(v, t); if (s) { v.sayText = s; v.sayUntil = t + 2600 }
          }
        }
      }
    }
    for (const c2 of clouds) { c2.x += 0.24 * c2.s; if (c2.x > W + 40) c2.x = -120 }
    for (const d of ducks) {
      d.x += d.dir * 0.7
      if (d.x > 620) d.dir = -1
      if (d.x < 80) d.dir = 1
    }
    mainG.drawImage(bg, 0, 0)
    drawPlotMarks(mainG, t)
    for (const c2 of clouds) {
      const cs = c2.s * 2
      // 变色:白 → 粉霞 → 金霞 缓慢循环(每朵相位不同)
      const ph = Math.sin(frame / 90 + c2.tint * 2.1) * 0.5 + 0.5
      const rr2 = 255, gg2 = (245 - ph * 40) | 0, bb2 = (250 - ph * 90) | 0
      mainG.fillStyle = 'rgba(40,60,20,0.10)'
      mainG.fillRect(c2.x + 8, c2.y + 8 * cs, 36 * cs, 6)
      /* 半透明。云原先是不透明的实色方块，跟台词气泡（白底圆角块）
         在同一屏上撞了形状——七朵没有字的方块飘在房顶上，一眼看过去
         像是七个没加载出来的气泡。透了之后房子从底下透出来，
         它才读得成「天上的东西」。0.72 是让房顶的瓦纹刚好看得见的那一档。 */
      mainG.globalAlpha = 0.72
      mainG.fillStyle = 'rgb(' + rr2 + ',' + gg2 + ',' + bb2 + ')'
      mainG.fillRect(c2.x, c2.y, 14 * cs, 9 * cs)
      mainG.fillRect(c2.x + 12 * cs, c2.y, 14 * cs, 9 * cs)
      mainG.fillRect(c2.x + 25 * cs, c2.y + 1 * cs, 11 * cs, 8 * cs)
      mainG.fillRect(c2.x + 8 * cs, c2.y - 6 * cs, 13 * cs, 8 * cs)
      mainG.fillRect(c2.x + 20 * cs, c2.y - 5 * cs, 10 * cs, 7 * cs)
      // 顶高光 + 底影
      mainG.fillStyle = 'rgba(255,255,255,0.7)'
      mainG.fillRect(c2.x + 6 * cs, c2.y - 6 * cs, 10 * cs, 3)
      mainG.fillStyle = 'rgba(' + rr2 + ',' + ((gg2 - 24) | 0) + ',' + ((bb2 - 30) | 0) + ',0.9)'
      mainG.fillRect(c2.x + 3, c2.y + 8 * cs, 32 * cs, 3 * cs)
      mainG.globalAlpha = 1
    }
    mainG.fillStyle = 'rgba(255,255,255,0.45)'
    for (let k = 0; k < 22; k++) {
      const x = ((k * 37 + frame * 1.6) % W) | 0
      const y = 968 + (k * 13) % 56
      mainG.fillRect(x, y, 9, 2)
    }
    for (const d of ducks) {
      const dy2 = 990 + Math.sin((frame + d.ph * 10) / 14) * 3
      mainG.fillStyle = 'rgba(255,255,255,0.35)'
      mainG.fillRect(d.x - d.dir * 12, dy2 + 8, 10, 2)
      sprTo(mainG, (frame >> 3) % 2 ? 'duck1' : 'duck2', d.x, dy2, 3, d.dir > 0)
    }
    // ═══ 合成水上前景层(桥/码头/荷叶/芦苇 覆盖水波与鸭子)═══
    mainG.drawImage(fg, 0, 0)
    // 飞鸟(横掠天空 · 扇翅)
    for (const bd of birds) {
      bd.x += 1.4
      const by2 = bd.y + Math.sin((frame + bd.ph * 12) / 18) * 8
      if (bd.x > W + 60) { bd.x = -60 - Math.random() * 200; bd.y = 70 + Math.random() * 120 }
      sprTo(mainG, (frame >> 2) % 2 ? 'bird1' : 'bird2', bd.x, by2, 3, false)
    }
    // 钓漂(浮沉 + 涟漪 · 偶尔咬钩)
    const bite = (frame % 200) > 188
    const fby = 992 + (bite ? Math.sin(frame) * 4 : Math.sin(frame / 14) * 2)
    mainG.strokeStyle = 'rgba(200,235,250,0.5)'; mainG.lineWidth = 1
    for (let k = 0; k < 2; k++) {
      const rp = ((frame * 0.8 + k * 12) % 20)
      mainG.beginPath(); mainG.ellipse(216, fby + 4, 4 + rp, (4 + rp) * 0.5, 0, 0, 6.3); mainG.stroke()
    }
    mainG.fillStyle = '#e05038'; mainG.fillRect(214, fby, 4, 4)
    mainG.fillStyle = '#f6efdc'; mainG.fillRect(214, fby, 4, 2)
    if (bite) { mainG.font = '600 16px sans-serif'; mainG.fillStyle = '#e8b23d'; mainG.fillText('!', 220, fby - 12) }
    // 芦苇摇曳(覆盖静态 · 顶端摆)
    for (const [rx, ry] of [[60, 950], [560, 948], [640, 946]]) {
      const sw = Math.sin(t / 600 + rx) * 3
      for (let k = 0; k < 4; k++) {
        mainG.fillStyle = '#7aa84a'
        mainG.fillRect(rx + k * 4 + sw, ry - 20 - (k % 2) * 4, 2, 8)
      }
    }
    // 蜻蜓(河面悬停 · 之字)
    for (const df of dflies) {
      const dx5 = df.bx + Math.sin((frame + df.ph * 10) / 12) * 40
      const dy5 = df.by + Math.cos((frame + df.ph * 8) / 9) * 10
      sprTo(mainG, (frame >> 1) % 2 ? 'dfly1' : 'dfly2', dx5, dy5, 2, (frame >> 5) % 2)
    }
    // 地面宠物(狗/猫 · 游走 + 叫)
    for (const pt of pets) {
      if (pt.mode === 'act') {
        if (t > pt.until) { const n = petPts[(Math.random() * petPts.length) | 0]; pt.tx = n[0]; pt.ty = n[1]; pt.mode = 'walk' }
      } else {
        const ddx = pt.tx - pt.x, ddy = pt.ty - pt.y, dd = Math.sqrt(ddx * ddx + ddy * ddy)
        if (dd > pt.sp) { pt.x += ddx / dd * pt.sp; pt.y += ddy / dd * pt.sp; pt.dir = ddx > 0 ? 1 : -1 }
        else { pt.mode = 'act'; pt.until = t + 2500 + Math.random() * 5000 }
      }
      if (t > pt.nextBark) { pt.barkUntil = t + 1600; pt.nextBark = t + 9000 + Math.random() * 12000 }
      const moving = pt.mode === 'walk'
      mainG.fillStyle = 'rgba(40,60,20,0.28)'
      mainG.fillRect(pt.x + 2, pt.y + pt.sc * 5 + 1, pt.sc * 6, 3)
      sprTo(mainG, pt.spr + (moving && (frame >> 2) % 2 ? '2' : '1'), pt.x, pt.y, pt.sc, pt.dir > 0)
      if (t < pt.barkUntil) {
        mainG.font = '600 23px "PingFang SC", sans-serif'
        const bkw = mainG.measureText(pt.say).width
        mainG.fillStyle = '#3a2c20'; mainG.fillRect(pt.x + pt.sc * 6, pt.y - 30, bkw + 14, 30)
        mainG.fillStyle = '#faf2dc'; mainG.fillRect(pt.x + pt.sc * 6 + 2, pt.y - 28, bkw + 10, 26)
        mainG.fillStyle = '#3a2c20'; mainG.textAlign = 'left'; mainG.textBaseline = 'middle'
        mainG.fillText(pt.say, pt.x + pt.sc * 6 + 7, pt.y - 15)
      }
    }
    // 村民相遇:靠近时头顶冒符号
    const 场 = 在场()
    for (let a2 = 0; a2 < 场.length; a2++)
      for (let b2 = a2 + 1; b2 < 场.length; b2++) {
        const va = 场[a2], vb = 场[b2]
        if (va.mode === 'home' || vb.mode === 'home' || va.fly || vb.fly) continue
        const dd = Math.hypot(va.x - vb.x, va.y - vb.y)
        if (dd < 60) {
          const sym = ['♪', '!', '~'][(a2 + b2) % 3]
          mainG.font = '600 20px sans-serif'; mainG.fillStyle = '#e8b23d'
          mainG.textAlign = 'center'; mainG.textBaseline = 'middle'
          if ((frame >> 3) % 2) { mainG.fillText(sym, va.x + 16, va.y - 40); mainG.fillText(sym, vb.x + 16, vb.y - 40) }
        }
      }

    // ═══ 天气:偶尔阵雨 ═══
    const rain = curRain
    if (rain > 0.04) {
      // 压暗 + 冷调
      mainG.fillStyle = 'rgba(56,66,88,' + (rain * 0.20) + ')'
      mainG.fillRect(0, 0, W, H)
      // 雨丝(斜落)
      const nR = (rain * 90) | 0
      mainG.strokeStyle = 'rgba(200,220,240,' + (0.35 * rain) + ')'; mainG.lineWidth = 1
      for (let k = 0; k < nR; k++) {
        const rx = (k * 89 + frame * 22) % W
        const ry = (k * 137 + frame * 30) % H
        mainG.beginPath(); mainG.moveTo(rx, ry); mainG.lineTo(rx - 5, ry + 14); mainG.stroke()
      }
      // 地面溅点
      mainG.fillStyle = 'rgba(210,225,240,' + (0.4 * rain) + ')'
      for (let k = 0; k < (rain * 24 | 0); k++) {
        const sx = (k * 173 + frame * 3) % W
        const sy = 200 + (k * 211 + frame * 2) % 1000
        if (((frame + k * 3) % 12) < 3) mainG.fillRect(sx, sy, 3, 1)
      }
      // 河面雨涟漪加密
      mainG.strokeStyle = 'rgba(230,240,250,' + (0.3 * rain) + ')'
      for (let k = 0; k < 8; k++) {
        const wx = (k * 91 + frame * 2) % W
        const wr = ((frame + k * 14) % 16)
        mainG.beginPath(); mainG.ellipse(wx, 985 + (k * 7) % 40, 3 + wr, (3 + wr) * 0.5, 0, 0, 6.3); mainG.stroke()
      }
      // 村民撑伞
      if (rain > 0.25) {
        for (const v of 在场()) {
          if (v.fly || v.stationary || v.mode === 'home') continue
          const uc = v.umb
          mainG.fillStyle = uc
          mainG.beginPath(); mainG.arc(v.x + 16, v.y - 6, 16, Math.PI, 0); mainG.fill()
          mainG.fillStyle = 'rgba(0,0,0,0.18)'
          mainG.beginPath(); mainG.arc(v.x + 16, v.y - 6, 16, 3.6, 0); mainG.fill()
          mainG.fillStyle = '#3a2c20'; mainG.fillRect(v.x + 15, v.y - 6, 2, 14)
          mainG.fillStyle = uc; mainG.fillRect(v.x, v.y - 8, 32, 3)
          mainG.fillStyle = 'rgba(58,44,32,0.5)'; mainG.fillRect(v.x, v.y - 5, 32, 1)
        }
      }
    }

    // ═══ 昼夜循环 ═══
    const d = dRaw
    const dark = d * 0.72
    const dusk = (d > 0.02 && d < 0.98) ? Math.sin(d * Math.PI) : 0
    if (dark > 0.01) {
      // 夜蓝罩 —— 黄昏时让位给暖调,否则夕阳被蓝色压死,只剩「变暗」
      mainG.fillStyle = 'rgba(24,34,72,' + (dark * (1 - dusk * 0.48)) + ')'
      mainG.fillRect(0, 0, W, H)
      // 暮色:天边橙红最浓,越往近处越淡(夕阳压在地平线上)
      if (dusk > 0.02) {
        const wg = mainG.createLinearGradient(0, 0, 0, H)
        wg.addColorStop(0, 'rgba(255,142,58,' + (dusk * 0.36) + ')')
        wg.addColorStop(0.45, 'rgba(238,110,62,' + (dusk * 0.22) + ')')
        wg.addColorStop(1, 'rgba(198,88,72,' + (dusk * 0.12) + ')')
        mainG.fillStyle = wg
        mainG.fillRect(0, 0, W, H)
      }
      // 星空(夜深渐显 · 闪烁)
      if (dark > 0.12) {
        const sa = Math.min(1, (dark - 0.12) / 0.35)
        for (const [sx, sy, sb, sk] of STARS) {
          const tw = 0.4 + 0.6 * Math.sin(frame / 7 + sk * 1.3)
          mainG.fillStyle = 'rgba(240,246,255,' + (sa * sb * tw) + ')'
          mainG.fillRect(sx, sy, 2, 2)
          if (tw > 0.85 && sb > 0.6) {
            mainG.fillStyle = 'rgba(240,246,255,' + (sa * 0.5) + ')'
            mainG.fillRect(sx - 2, sy, 6, 1); mainG.fillRect(sx, sy - 2, 1, 6)
          }
        }
      }
      // 月亮(右上)
      if (dark > 0.15) {
        const ma = Math.min(1, (dark - 0.15) / 0.3)
        mainG.fillStyle = 'rgba(200,215,240,0)'
        const mg = mainG.createRadialGradient(600, 130, 6, 600, 130, 46)
        mg.addColorStop(0, 'rgba(240,244,255,' + (0.55 * ma) + ')'); mg.addColorStop(1, 'rgba(240,244,255,0)')
        mainG.fillStyle = mg; mainG.fillRect(554, 84, 92, 92)
        mainG.fillStyle = 'rgba(246,248,255,' + (0.92 * ma) + ')'
        mainG.beginPath(); mainG.arc(600, 130, 18, 0, 6.3); mainG.fill()
        mainG.fillStyle = 'rgba(220,228,246,' + (0.5 * ma) + ')'
        mainG.beginPath(); mainG.arc(606, 126, 5, 0, 6.3); mainG.fill()
      }
      // 灯光点亮(强度随夜)
      for (const [lx, ly, lr] of LIGHTS) {
        const lg = mainG.createRadialGradient(lx, ly, 2, lx, ly, lr)
        lg.addColorStop(0, 'rgba(255,214,120,' + (0.5 * dark) + ')'); lg.addColorStop(1, 'rgba(255,214,120,0)')
        mainG.fillStyle = lg; mainG.fillRect(lx - lr, ly - lr, lr * 2, lr * 2)
      }
      // 灯笼(闪烁暖橙)
      for (let i2 = 0; i2 < LANTS.length; i2++) {
        const [lx, ly] = LANTS[i2]
        const fl = 0.7 + 0.3 * Math.sin(frame / 5 + i2)
        const lg = mainG.createRadialGradient(lx, ly, 1, lx, ly, 18)
        lg.addColorStop(0, 'rgba(255,150,90,' + (0.6 * dark * fl) + ')'); lg.addColorStop(1, 'rgba(255,150,90,0)')
        mainG.fillStyle = lg; mainG.fillRect(lx - 18, ly - 18, 36, 36)
      }
      // 萤火虫(夜深渐多)
      const fcount = (dark / 0.72 * fireflies.length) | 0
      for (let k = 0; k < fcount; k++) {
        const f = fireflies[k]
        const fx = f.x + Math.sin(frame / 22 + f.ph) * 26
        const fy = f.y + Math.cos(frame / 17 + f.ph * 1.4) * 20
        const bl = 0.4 + 0.6 * Math.sin(frame / 6 + f.ph * 2)
        if (bl > 0.35) {
          mainG.fillStyle = 'rgba(200,255,140,' + (bl * 0.9) + ')'
          mainG.fillRect(fx, fy, 3, 3)
          mainG.fillStyle = 'rgba(200,255,140,' + (bl * 0.3) + ')'
          mainG.fillRect(fx - 2, fy - 2, 7, 7)
        }
      }
    }
    for (const [sx, sy, col] of [[470, 782, '248,244,232'], [196, 108, '248,244,232'], [96, 546, '200,160,232']]) {
      for (let k = 0; k < 4; k++) {
        const ph = ((frame * 1.1 + k * 16) % 60)
        mainG.fillStyle = 'rgba(' + col + ',' + Math.max(0, 0.7 - ph / 80) + ')'
        const sz = 4 + ph / 12
        mainG.fillRect(sx + Math.sin((frame + k * 20) / 9) * 5, sy - ph * 1.5, sz, sz)
      }
    }
    for (let k = 0; k < 6; k++) {
      const ph = (frame * 1.3 + k * 34) % 130
      mainG.fillStyle = 'rgba(240,168,188,' + Math.max(0, 0.85 - ph / 140) + ')'
      mainG.fillRect(470 + Math.sin((frame + k * 25) / 12) * 26 - k * 14, 330 + ph, 5, 4)
    }
    mainG.fillStyle = (frame >> 4) % 2 ? '#ffd76a' : '#c8384a'
    mainG.fillRect(572, 504, 4, 4)
    // ═══ 金毛雕像:呼吸金光 + 绕行星芒 ═══
    const SX = 340, SY = 578
    const breath = 0.5 + 0.5 * Math.sin(frame / 14)              // 0..1 呼吸
    const gr = mainG.createRadialGradient(SX, SY, 4, SX, SY, 40 + breath * 14)
    gr.addColorStop(0, 'rgba(255,224,130,' + (0.22 + breath * 0.20) + ')')
    gr.addColorStop(0.5, 'rgba(255,206,90,' + (0.10 + breath * 0.10) + ')')
    gr.addColorStop(1, 'rgba(255,206,90,0)')
    mainG.fillStyle = gr
    mainG.fillRect(SX - 56, SY - 56, 112, 112)
    // 四点星芒绕雕像旋转(闪烁)
    for (let k = 0; k < 4; k++) {
      const a = frame / 22 + k * 1.5708
      const rad = 30 + Math.sin(frame / 9 + k) * 4
      const sx = SX + Math.cos(a) * rad, sy = SY - 8 + Math.sin(a) * rad * 0.6
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(frame / 7 + k * 2))   // 明灭
      mainG.fillStyle = 'rgba(255,246,210,' + tw + ')'
      mainG.fillRect(sx - 3, sy, 7, 1); mainG.fillRect(sx, sy - 3, 1, 7)   // 十字星
      mainG.fillStyle = 'rgba(255,255,255,' + tw + ')'
      mainG.fillRect(sx, sy, 1, 1)
    }
    // 雕像表面缓慢流过的一道镜面高光
    const shine = (frame % 90) / 90
    if (shine < 0.5) {
      mainG.fillStyle = 'rgba(255,255,255,' + (0.5 - shine) * 0.7 + ')'
      mainG.fillRect(SX - 22 + shine * 44, SY - 34, 2, 40)
    }
    // ═══ 喷泉动画(大 · 明显)═══
    const FX = 340, FY = 548
    // 顶柱水花(从上层小盆喷出)
    const jh = 46 + Math.sin(frame / 4) * 8
    // 主水柱(粗 · 分股 · 亮芯)
    for (let k = 0; k < 5; k++) {
      const off = (k - 2) * 4
      mainG.fillStyle = 'rgba(140,205,240,0.5)'
      mainG.fillRect(FX + off - 2, FY - 74 - jh, 5, jh + 10)
    }
    for (let k = 0; k < 3; k++) {
      const off = (k - 1) * 4
      mainG.fillStyle = 'rgba(230,248,255,0.9)'
      mainG.fillRect(FX + off - 1, FY - 74 - jh, 2, jh + 10)
    }
    // 顶部喷涌水团
    mainG.fillStyle = 'rgba(240,252,255,0.92)'
    mainG.fillRect(FX - 6, FY - 78 - jh, 12, 7)
    mainG.fillRect(FX - 3, FY - 84 - jh, 6, 6)
    // 落水:从柱顶向四周辐射喷洒下落
    const NDROP = 20
    for (let k = 0; k < NDROP; k++) {
      const a = (k / NDROP) * 6.283
      const p = ((frame * 1.4 + k * 47) % 64) / 64
      const reach = 8 + p * 50
      const dx4 = Math.cos(a) * reach
      const dep = Math.sin(a) * 18                 // 前后景深
      const startY = FY - 76 - jh
      const yy = startY - 12 * Math.sin(p * Math.PI) + p * p * (jh + 74) + dep
      mainG.fillStyle = 'rgba(210,240,252,' + Math.max(0, 0.85 - p * 0.6) + ')'
      const sz = p < 0.4 ? 3 : 2
      mainG.fillRect(FX + dx4, yy, sz, sz)
    }
    // 上层盆溢流(小瀑)
    for (let k = 0; k < 6; k++) {
      const p = ((frame * 1.8 + k * 24) % 40) / 40
      const side = k % 2 ? 1 : -1
      mainG.fillStyle = 'rgba(200,235,250,' + Math.max(0, 0.7 - p * 0.5) + ')'
      mainG.fillRect(FX + side * (18 + p * 4), FY - 54 + p * 30, 2, 4)
    }
    // 下层盆涟漪(大 · 多环)
    for (let k = 0; k < 4; k++) {
      const rp = ((frame * 1.1 + k * 14) % 50)
      mainG.strokeStyle = 'rgba(210,240,252,' + Math.max(0, 0.55 - rp / 56) + ')'
      mainG.lineWidth = 2
      mainG.beginPath()
      mainG.ellipse(FX, FY - 6, 10 + rp, (10 + rp) * 0.5, 0, 0, 6.3)
      mainG.stroke()
    }
    // 盆面滑动反光×2
    for (let m2 = 0; m2 < 2; m2++) {
      mainG.fillStyle = 'rgba(255,255,255,' + (0.22 + 0.16 * Math.sin(frame / 6 + m2 * 3)) + ')'
      mainG.fillRect(FX - 34 + ((frame * 1.4 + m2 * 40) % 68), FY - 6 + m2 * 6, 8, 1)
    }
    // 水雾光晕(大 · 呼吸)
    const fmist = mainG.createRadialGradient(FX, FY - 60, 6, FX, FY - 60, 66)
    fmist.addColorStop(0, 'rgba(200,232,250,' + (0.18 + 0.08 * Math.sin(frame / 9)) + ')')
    fmist.addColorStop(1, 'rgba(200,232,250,0)')
    mainG.fillStyle = fmist
    mainG.fillRect(FX - 66, FY - 126, 132, 132)

    // 福气铜钱(缓慢飘浮 · 方孔圆钱 · 闪金)
    for (let k = 0; k < 4; k++) {
      const cx3 = 90 + k * 150 + Math.sin(frame / 40 + k * 2) * 30
      const cy3 = 400 + ((k * 260 + frame * 0.5) % 700)
      const tw = 0.6 + 0.4 * Math.sin(frame / 8 + k)
      mainG.fillStyle = 'rgba(232,178,61,' + (0.5 * tw) + ')'
      mainG.beginPath(); mainG.arc(cx3, cy3, 7, 0, 6.3); mainG.fill()
      mainG.fillStyle = 'rgba(255,224,140,' + (0.7 * tw) + ')'
      mainG.beginPath(); mainG.arc(cx3, cy3, 7, 0, 6.3); mainG.stroke()
      mainG.fillStyle = 'rgba(60,44,32,' + (0.6 * tw) + ')'
      mainG.fillRect(cx3 - 2, cy3 - 2, 4, 4)
      // 闪点
      if ((frame + k * 5) % 24 < 4) {
        mainG.fillStyle = 'rgba(255,250,220,' + tw + ')'
        mainG.fillRect(cx3 - 10, cy3, 20, 1); mainG.fillRect(cx3, cy3 - 10, 1, 20)
      }
    }
    // 阳光尘埃(缓慢飘浮)
    for (let k = 0; k < 18; k++) {
      const mx = (k * 83 + frame * 0.4) % W
      const my = 100 + ((k * 137 + frame * 0.7) % 1100)
      mainG.fillStyle = 'rgba(255,245,200,' + (0.10 + 0.10 * Math.sin(frame / 20 + k)) + ')'
      mainG.fillRect(mx | 0, my | 0, 2, 2)
    }
    // 蝴蝶×2(花圃间 · 之字飞)
    for (let bi = 0; bi < 2; bi++) {
      const bx3 = 140 + bi * 380 + Math.sin(frame / 22 + bi * 2) * 70
      const by3 = 480 + bi * 220 + Math.cos(frame / 16 + bi) * 44
      const wing = (frame >> 1) % 2
      mainG.fillStyle = bi ? '#e87a90' : '#e8b23d'
      mainG.fillRect(bx3 - (wing ? 4 : 2), by3 - 2, wing ? 4 : 2, 5)
      mainG.fillRect(bx3 + (wing ? 2 : 0), by3 - 2, wing ? 4 : 2, 5)
      mainG.fillStyle = '#3a2c20'; mainG.fillRect(bx3, by3 - 2, 2, 6)
    }
    const sorted = 在场().slice().sort((a, b) => a.y - b.y)
    for (const v of sorted) {
      if (t < v.doorFlash) {
        const [dx3, dy3] = NAV[v.home]
        const dg = mainG.createRadialGradient(dx3, dy3 - 20, 4, dx3, dy3 - 20, 44)
        dg.addColorStop(0, 'rgba(255,220,130,0.55)'); dg.addColorStop(1, 'rgba(255,220,130,0)')
        mainG.fillStyle = dg
        mainG.fillRect(dx3 - 44, dy3 - 64, 88, 88)
      }
      if (v.mode === 'home') continue
      const moving = v.mode === 'walk'
      let pose, vy = v.y, faceSide = false
      const specKey = v.fly ? 'popo' : v.spr
      const spec = (window.CHARSPEC && window.CHARSPEC[specKey] && specKey !== 'villm') ? window.CHARSPEC[specKey] : null
      if (v.fly) {
        vy = v.y - 14 + Math.sin(t / 600) * 4
        mainG.fillStyle = 'rgba(40,60,20,0.22)'
        mainG.fillRect(v.x + 8, v.y + 40, 26, 4)
        if (moving) {
          for (let k = 1; k < 4; k++) {
            mainG.fillStyle = 'rgba(255,215,106,' + (0.6 - k * 0.15) + ')'
            mainG.fillRect(v.x + 20 - Math.sign(v.tx - v.x) * k * 9, vy + 22 + k * 2, 4, 4)
          }
        }
      } else {
        mainG.fillStyle = 'rgba(40,60,20,0.3)'
        mainG.fillRect(v.x + 6, v.y + 35, 22, 3)
      }
      if (spec) {
        // ── 角色规范驱动(小号 sc2 · 正=下 背=上 侧=横/斜) ──
        const ddx = v.tx - v.x, ddy = v.ty - v.y
        let ori = 'front'
        if (v.fly) ori = (!moving || Math.abs(ddx) > 4) ? 'side' : (ddy < 0 ? 'back' : 'front')
        else {
          faceSide = moving && Math.abs(ddx) > 4 && !!spec.side
          const faceUp = moving && !faceSide && ddy < 0 && !!spec.back
          ori = faceSide ? 'side' : (faceUp ? 'back' : 'front')
        }
        const fr2 = v.fly ? ((frame >> 3) % 2) : (moving && ((frame >> 1) % 2) ? 1 : 0)
        const flipS = (ori === 'side') && (v.tx - v.x) < 0
        drawSpecTo(mainG, specKey, ori, fr2, v.x, vy + 36, 2, flipS)
      } else {
        const fr = (moving && ((frame >> 2) % 2)) ? '2' : '1'
        const ddx = v.tx - v.x, ddy = v.ty - v.y
        faceSide = moving && Math.abs(ddx) > 4 && !!SPR[v.spr + 'S' + fr]
        const faceUp = moving && !faceSide && ddy < 0 && !!SPR[v.spr + 'U' + fr]
        pose = v.fly ? 'popofly' : (faceSide ? v.spr + 'S' + fr : (faceUp ? v.spr + 'U' + fr : v.spr + fr))
        const flip = faceSide ? (v.tx - v.x) < 0 : (moving && (v.tx - v.x) > 0)
        sprTo(mainG, pose, v.x, vy, 2, flip, v.remap)
      }
      if (v.sayText && t < v.sayUntil) {
        mainG.font = '600 23px "PingFang SC", sans-serif'
        const tw = mainG.measureText(v.sayText).width
        let bx2 = v.x + 16 - tw / 2 - 11, by2 = v.y - 42
        if (bx2 < 4) bx2 = 4
        if (bx2 + tw + 22 > 700) bx2 = 700 - tw - 22
        mainG.fillStyle = '#3a2c20'; mainG.fillRect(bx2 - 2, by2 - 2, tw + 26, 38)
        mainG.fillStyle = '#faf2dc'; mainG.fillRect(bx2, by2, tw + 22, 34)
        mainG.fillStyle = '#3a2c20'
        mainG.fillRect(v.x + 12, by2 + 34, 8, 4); mainG.fillRect(v.x + 14, by2 + 38, 4, 4)
        mainG.textAlign = 'left'; mainG.textBaseline = 'middle'
        mainG.fillText(v.sayText, bx2 + 11, by2 + 17)
      } else if (t >= v.sayUntil) v.sayText = null
    }
  }
  /* 宿主先把贴图交进来,才能烘静态层。两步分开:加载图是异步的、
     而且两个平台的加载方式完全不同;烘图是同步的、两边一模一样。 */
  globalThis.VILLAGE_INIT = function (image) {
    if (!image) throw new Error('村子要一张贴图(tilemap_packed.png)，宿主没给')
    img = image
    renderStatic()
  }
  globalThis.VILLAGE_FRAME = frame2
  /* 烘好的静态层(地形 / 水 / 房屋 / 桥码头前景)。这两层与时间无关,
     所以它们是村子这三千行里【唯一能被视觉回归钉住】的部分 ——
     村民走位与对话是有状态的,没有复位入口,快照它们量到的是
     「页面活了多久」而不是「源码是什么样」。 */
  globalThis.VILLAGE_LAYERS = { bg, fg }

  /* ── 宅基:谁住着、门口挂什么 ────────────────────────────────
     表在 engine/plots.js(数据),这里只管画与点。

     谁住着是【运行期】的事(服务端说了算),所以标记逐帧画,不烘进静态层 ——
     烘进去的话,请一个人回家得重烘一次整张图。

     标记的画法刻意【不碰房子本身】:房子是圆顶、是塔、是谷仓,形状各不相同,
     往上面盖一层半透明的罩子怎么盖怎么难看。改为在【门口】立东西:
       没人住 —— 一根木牌,牌面空白
       住着了 —— 一盏灯,夜里会亮
     一眼就分得出,而且请人回家那一刻,门口的牌换成灯,是看得见的回报。 */
  const HOME = {}
  globalThis.VILLAGE_SET_HOME = function (ids) {
    for (const k in HOME) delete HOME[k]
    for (const id of ids || []) HOME[id] = true
  }

  function drawPlotMarks(g2, t) {
    const P = globalThis.VILLAGE_PLOTS
    if (!P) return
    for (const p2 of P) {
      // 挂在门的右手边,不压门本身
      const dx = p2.x + (p2.w >> 1) + 12, dy = p2.gy
      if (HOME[p2.id]) {
        /* 住着了 —— 门口一盏红灯笼。
           白天也要看得见:这一格是【请回家的回报】,不能只在夜里才认得出。
           所以灯笼本体用饱和的红,不靠透明度;夜里再加一圈晕。 */
        px2(g2, dx + 3, dy - 40, 2, 8, '#6e5236')              // 挂绳
        px2(g2, dx, dy - 32, 8, 3, '#e8b23d')                  // 上箍
        px2(g2, dx - 1, dy - 29, 10, 12, '#c8302c')            // 灯身
        px2(g2, dx + 1, dy - 27, 2, 8, '#e85a4c')              // 高光
        px2(g2, dx, dy - 17, 8, 3, '#e8b23d')                  // 下箍
        px2(g2, dx + 3, dy - 14, 2, 5, '#e8b23d')              // 穗
        const night = curTime === 'night' ? 1 : curTime === 'dusk' ? 0.55 : 0
        if (night) {
          const fl = 0.85 + 0.15 * Math.sin(t / 220 + dx)
          g2.globalAlpha = 0.42 * night * fl
          px2(g2, dx - 7, dy - 36, 22, 26, '#ffb347')
          g2.globalAlpha = 1
        }
      } else {
        /* 空着 —— 门边一块【空白的门牌】。牌子已经挂上了,名字还没写 ——
           这正是「等人」,不是「锁上了」。

           第一版画的是靠在门边的木板,木色。渲出来一看:褐色的墙(谷仓、
           河边那间木屋)上整块糊掉,根本认不出。所以改成【浅底 + 深描边】——
           像素画里让一件小东西在深浅两种背景上都立得住,只有描边这一条路。 */
        px2(g2, dx - 1, dy - 31, 13, 24, '#3a2c20')            // 描边
        px2(g2, dx, dy - 30, 11, 22, '#efe6d0')                // 牌面(空白)
        px2(g2, dx + 2, dy - 27, 7, 1, '#d8ccae')              // 一道浅压痕,免得像纸片
        px2(g2, dx + 4, dy - 7, 3, 6, '#6e5236')               // 挂钩
      }
    }
  }
  function px2(g2, x, y, w2, h2, c) { g2.fillStyle = c; g2.fillRect(x, y, w2, h2) }

  /* 点选:给一个画布坐标,回答「点到谁了」。
     宿主只负责把坐标换算成画布像素(见平台缝的 onPointer),判定在这里 ——
     判定写两份迟早会漂,而漂出来的症状是「看得见的那个点不到」,
     房间那边已经栽过一次(附着件曾 1/7 可达),不再栽第二次。

     村民优先于房子:他们走在房子前面,视觉上压着房子。

     【范围有限,如实记着】现在只认 NAV 里的 4 个房门节点与 12 位村民。
     路线图要的是 40 户、空屋也要能点且会说「这间空着,等人」——
     那需要一张 40 格的宅基表,村子里还没有,不是这里少写了几行。 */
  globalThis.VILLAGE_HIT = function (x, y) {
    let best = null, bd = Infinity
    for (const v of 在场()) {
      const dx = x - (v.x + 16), dy = y - (v.y + 20), d = dx * dx + dy * dy
      if (d < 26 * 26 && d < bd) { bd = d; best = { kind: 'villager', who: v.lk, at: v.home, x: v.x + 16, y: v.y } }
    }
    if (best) return best

    /* 宅基。命中框从【地面线】往上取一栋房子的高度 —— 各家形状差太远
       (圆顶、塔、谷仓),按各自轮廓判要把画法搬第二份过来,而两份一定会漂。
       统一取门脸那一片,人的手指本来也是奔着门去的。

       两栋挨着时(村里有一对是重叠的)按【门心更近】的那栋算,
       与「看得见的那个点得到」是同一条规矩。 */
    const P = globalThis.VILLAGE_PLOTS || []
    for (const p2 of P) {
      if (x < p2.x || x > p2.x + p2.w) continue
      if (y > p2.gy + 14 || y < p2.gy - 118) continue
      const cx = p2.x + p2.w / 2, dx = x - cx, dy = y - p2.gy, d = dx * dx + dy * dy
      if (d < bd) { bd = d; best = { kind: 'plot', at: p2.id, home: !!HOME[p2.id], x: cx, y: p2.gy } }
    }
    return best
  }

  /* 村子里现在有什么 —— 页面拿它做「收集 n/40」那一栏,不自己数。
     住着的 4 户是有主角房的那几位;40 是设定里的总数,不是现在画出来的数。 */
  /* 给门禁用:每位村民【他自己所在的那个点】。门禁拿它逐个点一遍,
     点到的必须是他自己。不导出这个的话,门禁只能自己算一份坐标 ——
     那就是第二份实现,两份会漂。 */
  globalThis.VILLAGE_VILLAGERS_FOR_TEST = villagers.map((v) => ({ x: v.x + 16, y: v.y + 20, at: v.home }))

  /* 村子里现在有什么。页面拿它对账 —— n/40 的真数来自服务端,
     这里报的是【画面这一侧】能显示多少格,两个数不该混用:
     服务端说你请回来 12 位,而村子只画得下 20 格,差在哪儿要一眼看得出。 */
  /* 此刻在场的【四十位里的】那几个 —— 给门禁用。
     「没请回来的不该在村里走动」这条只能这么验：光看屏上有没有他的
     台词气泡是碰运气（气泡是间歇冒的），碰不上就成了一条永远绿的断言。 */
  globalThis.VILLAGE_CAST_ON_STAGE = function () {
    return 在场().filter((v) => v.cast).map((v) => v.spr)
  }

  globalThis.VILLAGE_CENSUS = function () {
    const P = globalThis.VILLAGE_PLOTS || [], U = globalThis.VILLAGE_UNSITED || []
    return {
      已落位: P.length,
      待落位: U.length,
      住着: P.filter((p2) => HOME[p2.id]).length,
      村民: villagers.length,
      /* 此刻【在场】的有几位 —— 四十位里的请回家之后才在场，路人一直在。
         点选那一支要拿它当判据：拿全量比的话，台下那几位本来就点不到，
         报出来是「村子点不准」，看着像命中判定坏了。 */
      在场: 在场().length,
    }
  }

  // ── 宿主那一段 ────────────────────────────────────────────────
  // 以上全部与平台无关;以下是设计页专用的驱动。
  if (typeof document === 'undefined') return
  const cv = document.getElementById('vilCanvas')
  const imgEl = document.getElementById('tilesImg')
  if (!cv || !imgEl) return
  // 画布尺寸由村子说了算。写在 <canvas> 标签里的话,村子扩地那天要记得
  // 同步改标签 —— 忘了就是画布比内容小一截,而它不抛错。
  cv.width = VW
  cv.height = VH
  const mainG = cv.getContext('2d')
  const sub = document.getElementById('vilSub')
  function loop(t) {
    requestAnimationFrame(loop)
    frame2(mainG, t)
    if (sub && globalThis.VILLAGE_SUB && sub.textContent !== globalThis.VILLAGE_SUB)
      sub.textContent = globalThis.VILLAGE_SUB
  }
  function boot() { globalThis.VILLAGE_INIT(imgEl); requestAnimationFrame(loop) }
  if (imgEl.complete && imgEl.naturalWidth) boot()
  else imgEl.onload = boot
})()
