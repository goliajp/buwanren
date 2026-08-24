
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
  const VW = 704, VH = 1920
  globalThis.VILLAGE_SIZE = { w: VW, h: VH }
  const bg = globalThis.ENGINE_HOST.createCanvas(VW, VH)
  // 水上前景层(桥/码头/荷叶/芦苇 · 覆盖水面动画)
  const fg = globalThis.ENGINE_HOST.createCanvas(VW, VH)
  const bgG = bg.getContext('2d')
  const fgG = fg.getContext('2d')
  bgG.imageSmoothingEnabled = false
  fgG.imageSmoothingEnabled = false
  let g = bgG
  const W = VW, H = VH, T = 32, COLS = 22, ROWS = 60

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
  function renderStatic() {
    const rnd = mulberry32(2026)
    // 房屋占位(禁止随机树落入 · [x,y,w])
    const HRECTS = [
      [36, 190, 88], [150, 116, 84], [252, 152, 78], [452, 130, 80], [556, 152, 92], [600, 262, 76],
      [20, 302, 76], [92, 356, 108], [16, 476, 80], [462, 384, 108], [600, 316, 88], [606, 448, 80],
      [108, 592, 104], [24, 664, 76], [470, 604, 150], [608, 560, 80], [614, 736, 52],
      [376, 790, 110], [150, 690, 152], [36, 856, 84], [148, 880, 76], [536, 830, 124], [30, 1066, 76], [614, 1076, 76],
    ]
    function inHouse(x, y) {
      // 判定框要罩住整栋楼:三层楼 + 屋顶有 150+px 高。原来只算到 +118,
      // 树正好种在下沿之外 —— 而森林墙是在建筑之后画的,直接盖住了人家的门。
      for (const [hx, hy, hw] of HRECTS)
        if (x > hx - 22 && x < hx + hw + 22 && y > hy - 62 && y < hy + 158) return true
      return false
    }
    for (let ty = 0; ty < ROWS; ty++)
      for (let tx = 0; tx < COLS; tx++)
        tile(GRASS[(rnd() * GRASS.length) | 0], tx, ty)

    // ═══ 草地色彩层次 ═══
    // 远近渐深(顶部远处更深绿 → 近处更亮)
    const depth = g.createLinearGradient(0, 90, 0, 1290)
    depth.addColorStop(0, 'rgba(28,58,26,0.34)')
    depth.addColorStop(0.28, 'rgba(34,66,30,0.16)')
    depth.addColorStop(0.55, 'rgba(120,180,90,0.04)')
    depth.addColorStop(1, 'rgba(180,220,130,0.10)')
    g.fillStyle = depth
    g.fillRect(0, 0, W, H)
    // 分区深浅斑块(多档 · 柔和 radial)
    for (const [gx, gy, gr2, tone] of [
      [150, 260, 240, 2], [520, 300, 220, 1], [340, 500, 260, 0],
      [120, 620, 210, 2], [580, 640, 200, 1], [300, 820, 250, 1],
      [90, 900, 200, 2], [600, 1000, 190, 0], [420, 200, 190, 1],
      [660, 460, 170, 2], [40, 440, 180, 1],
    ]) {
      const cols = ['rgba(190,228,138,0.10)', 'rgba(56,96,40,0.10)', 'rgba(36,70,28,0.15)']
      const gg = g.createRadialGradient(gx, gy, 20, gx, gy, gr2)
      gg.addColorStop(0, cols[tone])
      gg.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = gg
      g.fillRect(gx - gr2, gy - gr2, gr2 * 2, gr2 * 2)
    }
    const road = Array.from({ length: ROWS }, () => new Array(COLS).fill(false))
    const plaza = Array.from({ length: ROWS }, () => new Array(COLS).fill(false))
    // 中央广场是后面用椭圆画的(PCX/PCY = 340/548, rx/ry = 132/74),不走 tile 系统。
    // 这个数组一直没人填 —— 于是草叶和树全种到广场上去了。
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
    walkG(road, [[10, 11], [9, 13], [10, 15]], 1)
    walkG(road, [[10, 18], [11, 20], [9, 23], [10, 26], [11, 28], [10, 29]], 1)
    walkG(road, [[10, 31], [9, 33], [11, 36], [10, 38]], 1)
    // 往南穿过林子,进新住区;两条横巷,房子朝巷子开门
    walkG(road, [[10, 38], [10, 42], [11, 45], [10, 48], [10, 53], [10, 56]], 1)
    walkG(road, [[2, 48], [10, 48], [19, 48]], 1)
    walkG(road, [[2, 53], [10, 53], [19, 53]], 1)
    walkG(road, [[9, 14], [7, 15], [5, 14]], 1)
    walkG(road, [[12, 14], [14, 15], [17, 14]], 1)
    walkG(road, [[9, 21], [7, 22], [5, 22]], 1)
    walkG(road, [[11, 22], [13, 24], [16, 23]], 1)
    walkG(road, [[9, 13], [7, 11], [6, 9]], 1)
    walkG(road, [[11, 13], [13, 11], [14, 9]], 1)
    function autotile(gr2, base) {
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++) {
          if (!gr2[y][x]) continue
          const n = y > 0 && gr2[y - 1][x], s2 = y < ROWS - 1 && gr2[y + 1][x]
          const w2 = x > 0 && gr2[y][x - 1], e = x < COLS - 1 && gr2[y][x + 1]
          tile(base[!n ? 0 : (!s2 ? 2 : 1)] + (!w2 ? 0 : (!e ? 2 : 1)), x, y)
        }
    }
    // 路面:一律用中心土 tile —— autotile 的边缘 tile 自带草边框,
    // 而路只有 2 格宽,每格都是「边缘」,整条路会碎成一块块孤立的土斑。
    // 边缘的自然过渡交给下面的「路缘过渡」(草探进路 / 土蹭上草)。
    for (let ty = 0; ty < ROWS; ty++)
      for (let tx = 0; tx < COLS; tx++)
        if (road[ty][tx]) {
          tile(DIRT[1] + 1, tx, ty)
          g.fillStyle = 'rgba(132,112,80,0.26)'      // 压一层暖灰降饱和
          g.fillRect(tx * T, ty * T, T, T)
        }
    // 路面纹理:碎石 · 土斑 · 车辙 —— 纯色 tile 铺的路太生硬
    for (let ty = 0; ty < ROWS; ty++)
      for (let tx = 0; tx < COLS; tx++) {
        if (!road[ty][tx]) continue
        for (let i = 0; i < 16; i++) {
          const x = tx * T + ((rnd() * T) | 0), y = ty * T + ((rnd() * T) | 0)
          const r = rnd()
          if (r < 0.40) px(x, y, 1, 1, '#d09a68')                                   // 浅土(微亮)
          else if (r < 0.72) px(x, y, 1, 1, '#b8825a')                               // 深土(微暗)
          else if (r < 0.90) { px(x, y, 2, 1, '#c4a084'); px(x, y + 1, 1, 1, '#a8825e') } // 碎石(低对比)
          else px(x, y, 1, 2, '#a06e46')                                             // 车辙
        }
      }

    // 河 + 桥
    const riverY = x => (960 + Math.sin(x * 0.01) * 10 + Math.sin(x * 0.028) * 5) | 0
    const riverH = x => (72 + Math.sin(x * 0.014 + 1.4) * 8) | 0
    for (let x = 0; x < W; x++) {
      const y0 = riverY(x), h2 = riverH(x)
      px(x, y0 - 8, 1, 8, '#e6d6a4')
      px(x, y0 - 3, 1, 3, '#d8c48e')
      px(x, y0, 1, h2, '#4f9ed6')
      px(x, y0, 1, 5, '#7cc4e8')
      px(x, y0 + h2 - 6, 1, 6, '#3f86bc')
      px(x, y0 + h2, 1, 3, '#d8c48e')
      px(x, y0 + h2 + 3, 1, 5, '#e6d6a4')
    }
    // ─── 切到水上前景层(桥/码头/荷叶/芦苇)───
    g = fgG
    // ═══ 木桥(俯视)—— 桥墩 · 桥板 · 栏杆 · 石阶 ═══
    // 桥墩:横跨桥下,两侧各露出一截 —— 俯视看不到桥下,只能靠露出的部分交代它撑着桥
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
    pier(966); pier(1020)
    // 桥头石阶(接主路)
    for (let k = 0; k < 3; k++) {
      const c = k % 2 ? '#a8a294' : '#8a8578'
      px(306 + k * 3, 928 + k * 6, 64 - k * 6, 6, c)
      px(306 + k * 3, 928 + k * 6, 64 - k * 6, 1, '#c0bcb2')
      px(306 + k * 3, 1064 - k * 6, 64 - k * 6, 6, c)
      px(306 + k * 3, 1064 - k * 6, 64 - k * 6, 1, '#c0bcb2')
    }
    // 桥板:宽窄不一 + 木纹 + 铁钉(原来是均匀横线,像打印的)
    px(300, 944, 76, 5, '#4a3220')
    px(302, 949, 72, 112, '#6e4a2e')
    let bty = 952
    while (bty < 1056) {
      const bh = 6 + ((bty * 7) % 3)
      px(304, bty, 68, bh, '#a8764a')
      px(304, bty, 68, 1, '#c08a58')
      px(304, bty + bh - 1, 68, 1, '#6e4a2e')
      for (let k = 0; k < 3; k++) px(310 + ((bty * 13 + k * 23) % 52), bty + 2, 4, 1, 'rgba(90,60,30,0.26)')
      px(307, bty + 2, 2, 2, '#5a5648'); px(367, bty + 2, 2, 2, '#5a5648')    // 铁钉
      bty += bh + 1
    }
    // 栏杆:扶手 + 立柱(俯视:立柱是小方块)+ 落在桥面上的影
    px(306, 950, 3, 106, 'rgba(30,20,10,0.16)')
    px(365, 950, 3, 106, 'rgba(30,20,10,0.16)')
    for (const rx of [298, 370]) {
      px(rx, 944, 8, 118, '#4a3220')
      px(rx + 1, 946, 6, 114, '#8a6844')
      px(rx + 1, 946, 2, 114, '#a8845c')
      for (let r = 0; r < 6; r++) {
        const py2 = 950 + r * 20
        px(rx - 1, py2, 10, 9, '#3a2c20')
        px(rx, py2 + 1, 8, 7, '#7a5638')
        px(rx, py2 + 1, 8, 2, '#a8845c')
      }
    }
    // ═══ 河滨:小码头 + 芦苇 + 荷叶 ═══
    // 码头(左岸伸入河 · 木栈)
    px(128, 940, 44, 4, '#3a2c20')
    px(132, 944, 36, 62, '#a06a40')
    g.fillStyle = '#c08a58'
    for (let r = 0; r < 7; r++) g.fillRect(134, 948 + r * 8, 32, 4)
    px(128, 942, 5, 66, '#6e5236'); px(167, 942, 5, 66, '#6e5236')
    px(140, 1006, 4, 26, '#5a4028'); px(156, 1006, 4, 26, '#5a4028')   // 支柱入水
    // 水桶 + 鱼篓(码头上)
    px(136, 986, 12, 14, '#8a6844'); px(136, 986, 12, 3, '#a8825a')
    px(152, 990, 12, 12, '#c8a850'); px(154, 986, 8, 5, '#a88838')
    // 钓竿(斜伸出水)
    g.strokeStyle = '#8a5c34'; g.lineWidth = 2
    g.beginPath(); g.moveTo(158, 992); g.lineTo(214, 968); g.stroke()
    g.strokeStyle = 'rgba(60,50,40,0.5)'; g.lineWidth = 1
    g.beginPath(); g.moveTo(214, 968); g.lineTo(216, 992); g.stroke()
    // 荷叶×4 + 莲花(避桥/码头)
    for (const [lx, ly, r2] of [[430, 998, 14], [470, 985, 11], [520, 1004, 13], [250, 1000, 10]]) {
      g.fillStyle = '#3e7a44'
      g.beginPath(); g.ellipse(lx, ly, r2, r2 * 0.5, 0, 0, 6.3); g.fill()
      g.fillStyle = '#5a9a54'
      g.beginPath(); g.ellipse(lx - 2, ly - 1, r2 - 3, (r2 - 3) * 0.5, 0, 0, 6.3); g.fill()
      g.strokeStyle = '#3e7a44'; g.lineWidth = 1
      g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + r2 - 2, ly - 2); g.stroke()
    }
    // 莲花(荷叶间)
    for (const [fx, fy] of [[448, 984], [500, 992]]) {
      g.fillStyle = '#f0a8bc'
      for (let k = 0; k < 5; k++) {
        const a2 = k * 1.256 - 1.57
        g.fillRect(fx + Math.cos(a2) * 5 - 2, fy + Math.sin(a2) * 4 - 2, 4, 5)
      }
      g.fillStyle = '#e8b23d'; g.fillRect(fx - 1, fy - 1, 3, 3)
    }
    // 芦苇丛(两岸 · 避桥码头)
    for (const [rx, ry] of [[60, 950], [90, 946], [220, 952], [560, 948], [600, 950], [640, 946], [40, 1030], [340, 1044]]) {
      for (let k = 0; k < 4; k++) {
        px(rx + k * 4, ry - 18 - (k % 2) * 4, 2, 20 + (k % 2) * 4, '#6a9a44')
        px(rx + k * 4, ry - 20 - (k % 2) * 4, 3, 6, '#8a6438')   // 芦花
      }
    }
    // ─── 切回底层 ───
    g = bgG

    // 远山
    g.fillStyle = '#9ec4b4'
    g.beginPath(); g.moveTo(0, 96); g.lineTo(120, 20); g.lineTo(260, 96); g.fill()
    g.fillStyle = '#aecfc0'
    g.beginPath(); g.moveTo(180, 96); g.lineTo(340, 8); g.lineTo(520, 96); g.fill()
    g.fillStyle = '#bad8ca'
    g.beginPath(); g.moveTo(430, 96); g.lineTo(580, 30); g.lineTo(704, 96); g.fill()
    g.fillStyle = '#f2f6fa'
    g.beginPath(); g.moveTo(300, 30); g.lineTo(340, 8); g.lineTo(384, 32); g.lineTo(352, 26); g.lineTo(322, 36); g.fill()
    // 村碑 + 村口树
    shadow(352, 210, 50, 6)
    px(334, 168, 36, 40, '#8a857a')
    px(338, 172, 28, 32, '#9a938a')
    px(342, 176, 20, 24, '#b0aba0')
    px(345, 180, 14, 3, '#4a453e'); px(345, 187, 14, 3, '#4a453e'); px(345, 194, 14, 3, '#4a453e')
    px(328, 204, 48, 8, '#6e675e')
    px(330, 204, 44, 2, '#8a8276')
    tree(250, 130, 4)
    tree(414, 138, 3)

    // ═══ 地被层:草叶 · 野花 · 碎石 ═══
    // 像素风草地靠密集的草叶像素立住,纯色块渐变再怎么调都是塑料感
    function onGrass(x, y) {
      const tx = (x / T) | 0, ty = (y / T) | 0
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return false
      if (road[ty][tx] || plaza[ty][tx]) return false          // 路面 / 广场不长草
      const ry = riverY(x)
      if (y > ry - 10 && y < ry + riverH(x) + 10) return false // 水面不长草
      return true
    }
    // 草叶(1px 竖线,近处更亮更密 —— 呼应远深近亮的地面渐变)
    const BLADE = ['#5a9a3e', '#6aa848', '#4e8c36', '#78b854']
    for (let i = 0; i < 22000; i++) {
      const x = (rnd() * W) | 0, y = (rnd() * H) | 0
      if (!onGrass(x, y)) continue
      const near = y / H                                        // 0 远 → 1 近
      if (rnd() > 0.62 + near * 0.36) continue                  // 近处密,远处疏
      const c = BLADE[(rnd() * (near > 0.5 ? 4 : 2)) | 0]
      const h2 = 2 + ((rnd() * 3) | 0)
      px(x, y, 1, h2, c)
      if (rnd() < 0.34) px(x + 1, y + 1, 1, h2 - 1, c)          // 双叶
      if (rnd() < 0.12) px(x - 1, y + 1, 1, h2 - 1, c)          // 三叶丛
    }
    // 野花(星散,不成行)
    const PETAL = ['#f0f0e0', '#ffd76a', '#e88ca0', '#c8a0e8', '#f6efdc']
    for (let i = 0; i < 240; i++) {
      const x = (rnd() * W) | 0, y = (rnd() * H) | 0
      if (!onGrass(x, y)) continue
      px(x + 1, y + 2, 1, 3, '#3e6e2e')
      g.fillStyle = PETAL[(rnd() * PETAL.length) | 0]
      px(x, y, 1, 1); px(x + 2, y, 1, 1); px(x + 1, y - 1, 1, 1); px(x + 1, y + 1, 1, 1)
    }
    // 路缘过渡:草叶探进路面 · 土点探进草地(消掉 autotile 的锯齿边)
    for (let ty = 0; ty < ROWS; ty++)
      for (let tx = 0; tx < COLS; tx++) {
        const isRoad = road[ty][tx]
        const nb = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => {
          const nx = tx + dx, ny = ty + dy
          return nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && road[ny][nx] !== isRoad
        })
        if (!nb) continue
        for (let i = 0; i < 9; i++) {
          const x = tx * T + ((rnd() * T) | 0), y = ty * T + ((rnd() * T) | 0)
          if (isRoad) { px(x, y, 1, 2 + ((rnd() * 2) | 0), '#4e8a3a') }   // 路面冒出的草
          else { px(x, y, 1 + ((rnd() * 2) | 0), 1, '#a89268') }          // 蹭到草上的土
        }
      }

    // 碎石 / 土斑(打破纯绿)
    for (let i = 0; i < 170; i++) {
      const x = (rnd() * W) | 0, y = (rnd() * H) | 0
      if (!onGrass(x, y)) continue
      const c = rnd() < 0.5 ? '#8a9a72' : '#6e8058'
      const w2 = 1 + ((rnd() * 2) | 0)
      px(x, y, w2, 1, c); if (rnd() < 0.4) px(x, y + 1, w2 - 1 || 1, 1, '#5c6e48')
    }

    // ═══ 建筑(类型混搭 · 组团)═══
    // 村口西群
    houseDome(36, 190, 88, '#e8a030', '#c07820', '#f2e3c8')
    building(150, 200, 84, 150116)
    building(252, 240, 78, 252152)
    // 村口东群
    towerRound(452, 130, 40, '#5a9a8a', '#3e7a6a', '#f2e3c8')
    buildingL(556, 244, 88, 556152)
    houseDome(600, 262, 76, '#6a8cb0', '#4c6a8c', '#eee6da')
    // 西翼:阿云家(坡顶蓝瓦大)+ 邻
    building(20, 384, 76, 20302)
    shopHouse(92, 356, 108, '#f2e3c8', '#c85a48')  // 店铺(敞门面+遮阳棚)
    // (原布幌挪到店铺左侧,不再挡 building(20,384) 的门)
    px(100, 372, 3, 40, '#6e5236'); px(91, 376, 10, 30, '#f6efdc')
    px(93, 382, 6, 3, '#4a6a88'); px(93, 390, 6, 3, '#4a6a88')
    px(132, 396, 32, 9, '#3a2c20'); px(134, 398, 28, 5, '#e8b23d')
    winSq(160, 386, true)
    building(16, 566, 80, 16476)
    // 东翼:桃桃家(粉圆顶大)+ 邻
    houseDome(462, 384, 108, '#e88aa0', '#c86a80', '#f6ecec')
    for (let k = 0; k < 3; k++) {
      px(478 + k * 32, 398, 2, 6, '#3a2c20')
      px(475 + k * 32, 404, 8, 9, '#e87a90')
    }
    building(600, 408, 88, 600316)
    building(606, 538, 80, 606448)
    tree(430, 300, 4, PEACH_RM)
    tree(586, 500, 3, PEACH_RM)
    // ═══ 中央圆形广场(开放式石铺 + 喷泉)═══
    const PCX = 340, PCY = 548
    function ellipseFill(cx, cy, rx, ry, col) {
      g.fillStyle = col
      for (let dy = -ry; dy <= ry; dy++) {
        const dxw = (rx * Math.sqrt(1 - (dy / ry) * (dy / ry))) | 0
        g.fillRect(cx - dxw, cy + dy, dxw * 2, 1)
      }
    }
    shadow(PCX, PCY + 62, 210, 8)
    ellipseFill(PCX, PCY, 132, 74, '#c8c0b0')
    ellipseFill(PCX, PCY, 124, 68, '#d4ccbc')
    // 环形铺石缝
    g.strokeStyle = 'rgba(120,110,96,0.4)'; g.lineWidth = 2
    for (const rr of [42, 74, 106]) {
      g.beginPath()
      for (let a2 = 0; a2 <= 6.3; a2 += 0.05) {
        const ex = PCX + Math.cos(a2) * rr, ey = PCY + Math.sin(a2) * rr * 0.56
        a2 ? g.lineTo(ex, ey) : g.moveTo(ex, ey)
      }
      g.stroke()
    }
    for (let k = 0; k < 16; k++) {
      const a2 = k * Math.PI / 8
      g.beginPath()
      g.moveTo(PCX + Math.cos(a2) * 42, PCY + Math.sin(a2) * 42 * 0.56)
      g.lineTo(PCX + Math.cos(a2) * 122, PCY + Math.sin(a2) * 122 * 0.56)
      g.stroke()
    }
    // 石缘
    g.strokeStyle = '#a89e88'; g.lineWidth = 4
    g.beginPath()
    for (let a2 = 0; a2 <= 6.3; a2 += 0.05) {
      const ex = PCX + Math.cos(a2) * 130, ey = PCY + Math.sin(a2) * 130 * 0.56
      a2 ? g.lineTo(ex, ey) : g.moveTo(ex, ey)
    }
    g.stroke()
    // 喷泉(大石盆 · 双层 · 高中柱)
    shadow(PCX, PCY + 10, 110, 8)
    // 下层大盆
    ellipseFill(PCX, PCY, 60, 32, '#7a7268')
    ellipseFill(PCX, PCY - 3, 54, 27, '#8a8276')
    ellipseFill(PCX, PCY - 5, 50, 25, '#6a9ac0')
    ellipseFill(PCX, PCY - 7, 50, 24, '#8fc0e0')
    g.strokeStyle = '#a89e88'; g.lineWidth = 4
    g.beginPath()
    for (let a2 = 0; a2 <= 6.3; a2 += 0.05) g[a2 ? 'lineTo' : 'moveTo'](PCX + Math.cos(a2) * 56, PCY - 5 + Math.sin(a2) * 28)
    g.stroke()
    // 中柱
    ellipseFill(PCX, PCY - 18, 22, 11, '#8a8276')
    px(PCX - 6, PCY - 54, 12, 38, '#9a938a')
    px(PCX - 6, PCY - 54, 4, 38, '#b0aba0')
    // 上层小盆
    ellipseFill(PCX, PCY - 54, 24, 12, '#7a7268')
    ellipseFill(PCX, PCY - 56, 20, 10, '#8fc0e0')
    px(PCX - 3, PCY - 74, 6, 22, '#9a938a')
    ellipseFill(PCX, PCY - 74, 8, 4, '#8a8276')
    glowG(PCX, PCY - 44, 56, 'rgba(180,220,240,0.30)')

    // 环广场花圃×4(石框 + 密花)
    for (const [bx, by, hue] of [[PCX - 150, PCY - 34, '#e87a90'], [PCX + 150, PCY - 34, '#c8a0e8'], [PCX - 118, PCY + 60, '#ffd76a'], [PCX + 118, PCY + 60, '#f6a0c0']]) {
      ellipseFill(bx, by, 30, 16, '#8a7a5c')
      ellipseFill(bx, by - 1, 26, 13, '#5a8a44')
      for (let k = 0; k < 9; k++) {
        const fa = k * 0.7
        const fx = bx + Math.cos(fa) * (6 + (k % 3) * 6), fy = by + Math.sin(fa) * (4 + (k % 3) * 3) - 2
        g.fillStyle = k % 3 ? hue : '#ffffff'
        g.fillRect(fx - 2, fy - 2, 4, 4)
        g.fillStyle = '#e8b23d'; g.fillRect(fx, fy, 2, 2)
      }
    }
    // 广场长椅×2(弧向)
    for (const [bx, by] of [[PCX - 70, PCY + 46], [PCX + 40, PCY + 46]]) {
      shadow(bx + 15, by + 12, 34, 3)
      px(bx, by, 34, 5, '#a06a40'); px(bx, by - 8, 34, 3, '#a06a40')
      px(bx + 2, by + 5, 4, 8, '#8a5c34'); px(bx + 28, by + 5, 4, 8, '#8a5c34')
    }
    // ═══ 黄金雕像:村口迎客的大金毛(坐姿 · 大理石基座 · 呼吸金光)═══
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
    goldStatue(340, 632)

    // 告示板(广场东北)
    shadow(452, 508, 50, 5)
    px(432, 460, 6, 48, '#6e5236'); px(470, 460, 6, 48, '#6e5236')
    px(424, 440, 62, 26, '#a06a40')
    px(428, 444, 54, 18, '#e8d8a0')
    px(432, 448, 20, 3, '#8a6844'); px(432, 454, 26, 3, '#8a6844')
    px(462, 448, 14, 10, '#e87a90')
    // 婆婆家:紫圆塔(魔女感)+ 邻
    towerRound(108, 592, 52, '#8a6aaa', '#6a4a8a', '#ece6f0')
    g.fillStyle = '#c8c4bc'; g.beginPath(); g.arc(96, 566, 9, 0, 7); g.fill()
    g.fillStyle = '#9a938a'; g.beginPath(); g.arc(98, 568, 6, 0, 7); g.fill()
    px(94, 700, 13, 11, '#e89040'); px(99, 696, 3, 5, '#5a9438')
    px(112, 704, 9, 7, '#e89040')
    building(24, 746, 76, 24664)
    // 丹增家:平顶白墙红檐 + 光伏 + 邻 3 层楼
    buildingL(470, 690, 92, 470604)              // L 形宅(主楼+配楼)
    g.save(); g.translate(536, 588); g.rotate(0.26)
    px(0, 0, 30, 12, '#2a3a5a')
    for (let k = 0; k < 3; k++) px(2 + k * 10, 2, 8, 8, '#4a6a9a')
    g.restore()
    g.strokeStyle = '#8a7a5c'; g.lineWidth = 2
    g.beginPath(); g.moveTo(470, 648); g.quadraticCurveTo(500, 656, 530, 642); g.stroke()
    for (let k = 0; k < 5; k++) {
      g.fillStyle = ['#3868b8', '#f6efdc', '#c83828', '#5a9438', '#e8b23d'][k]
      g.fillRect(474 + k * 11, 648 + (k % 2) * 3, 7, 6)
    }
    building(608, 692, 80, 608560, { floors: 3 })
    waterTower(614, 736)
    // 商业:奶茶铺(幌子)+ 杂货店
    shadow(430, 866, 120, 8)
    px(376, 790, 110, 76, '#f2e8dc')
    px(372, 858, 118, 8, '#8a8276')
    for (let k = 0; k < 7; k++) px(370 + k * 18, 774, 18, 16, k % 2 ? '#e87a90' : '#f6efdc')
    px(370, 770, 126, 6, '#a85868')
    px(486, 780, 26, 30, '#e87a90')
    px(490, 786, 18, 3, '#f6efdc'); px(497, 790, 4, 12, '#f6efdc'); px(490, 796, 18, 3, '#f6efdc')
    glowG(499, 794, 22, 'rgba(255,180,200,0.5)')
    px(392, 806, 36, 28, '#3a2c20')
    px(395, 809, 30, 22, '#ffe9c8')
    px(438, 806, 22, 30, '#f6efdc')
    px(441, 810, 14, 2, '#8a6844'); px(441, 816, 16, 2, '#8a6844'); px(441, 822, 12, 2, '#8a6844')
    // 布幌(奶茶铺侧)
    px(364, 786, 3, 56, '#6e5236')
    px(350, 790, 14, 44, '#e87a90')
    px(353, 796, 8, 8, '#f6efdc'); px(353, 810, 8, 8, '#f6efdc')
    // 杂货店(2 层平楼 + 大招牌)
    hall(150, 690, 152)                       // 村公所(地标)
    px(190, 700, 72, 20, '#5a8a44')
    g.fillStyle = '#f6efdc'
    g.fillRect(200, 704, 12, 12); g.fillRect(218, 704, 12, 12); g.fillRect(236, 704, 12, 12)
    glowG(226, 710, 30, 'rgba(200,240,150,0.35)')
    // 售货机 + 快递柜 + 邮筒
    shadow(560, 560, 30, 5)
    px(546, 500, 32, 58, '#3a2c20')
    px(548, 502, 28, 54, '#c8384a')
    px(551, 506, 22, 26, '#8ad0e8')
    for (let k = 0; k < 3; k++) { px(553 + k * 8, 509, 6, 8, '#f6efdc'); px(553 + k * 8, 520, 6, 8, '#ffd76a') }
    px(551, 538, 22, 9, '#3a2c20')
    shadow(80, 762, 48, 5)
    px(54, 706, 52, 54, '#3a2c20')
    px(56, 708, 48, 50, '#5a9438')
    g.fillStyle = '#8ec858'
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 4; c++) g.fillRect(60 + c * 11, 712 + r * 13, 9, 11)
    px(60, 752, 26, 4, '#f6efdc')
    shadow(254, 622, 20, 4)
    px(246, 590, 18, 32, '#c04838')
    g.fillStyle = '#c04838'; g.beginPath(); g.arc(255, 590, 9, Math.PI, 0); g.fill()
    px(248, 596, 14, 4, '#3a2c20')
    px(250, 610, 10, 6, '#e8b23d')
    // 河北岸群
    building(36, 940, 84, 36856)
    houseDome(148, 880, 76, '#5a9a8a', '#3e7a6a', '#f2e3c8')
    barn(536, 830, 124)                       // 谷仓(地标)
    // 河南岸
    building(30, 1110, 76, 30106, { floors: 1 })
    houseDome(614, 1076, 76, '#e8a030', '#c07820', '#f2e3c8')
    // ═══ 农田 ═══
    // 规则长方形排两行 = 贴纸感。改成:边界不规则的有机地块 · 大小不一 ·
    // 田埂分隔 · 四种作物(稻/菜/麦/新翻地) · 上移避开底部按钮。
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
    // 地块位置改程序化布局 —— 手写坐标不做避让,就会有一块跑进河里。
    // 每块地按九个方位点逐一校验:不下水、不压路、不压房、不进底部按钮区、彼此不重叠。
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
    const KINDS = ['rice', 'wheat', 'veg', 'rice', 'wheat', 'fallow']
    const laid = []
    for (let t = 0; t < 1600 && laid.length < 13; t++) {
      const rx = 30 + rnd() * 40, ry = 18 + rnd() * 16
      const cx = 52 + rnd() * (W - 104), cy = 1072 + rnd() * 182
      if (!plotOK(cx, cy, rx, ry)) continue
      if (laid.some(([px2, py2, prx, pry]) =>
        Math.abs(cx - px2) < rx + prx + 10 && Math.abs(cy - py2) < ry + pry + 8)) continue
      laid.push([cx, cy, rx, ry])
      plot(cx, cy, rx, ry, KINDS[(rnd() * KINDS.length) | 0], (t * 37 + 11) | 0)
    }
    // 村内小菜园(房前屋后 · 同样走校验)
    for (const [cx, cy] of [[92, 1052], [640, 1058], [258, 1066]])
      if (plotOK(cx, cy, 24, 13)) plot(cx, cy, 24, 13, 'veg', (cx * 7) | 0)

    // ═══ 市集摊位(避房 · 条纹棚 + 货筐)═══
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
    const STALLS = [[150, 620, '#e05038', 'fruit'], [488, 636, '#5a9438', 'veg'], [64, 760, '#e8b23d', 'fruit']]
    for (const [sx, sy, aw, gd] of STALLS) if (!inHouse(sx + 28, sy)) stall(sx, sy, aw, gd)
    // 节庆灯串(村碑 → 东侧 · 红灯笼 · 暖光)
    g.strokeStyle = '#8a7a5c'; g.lineWidth = 2
    g.beginPath(); g.moveTo(250, 150); g.quadraticCurveTo(360, 210, 470, 158); g.stroke()
    for (let k = 1; k <= 5; k++) {
      const tt = k / 6
      const lx = 250 + (470 - 250) * tt
      const ly = 150 + Math.sin(tt * Math.PI) * 56 + (158 - 150) * tt + 8
      px(lx - 1, ly - 8, 2, 8, '#8a5c34')
      px(lx - 5, ly, 10, 12, '#d0402c')
      px(lx - 5, ly, 10, 3, '#a83020')
      px(lx - 2, ly + 12, 4, 3, '#e8b23d')
      glowG(lx, ly + 5, 16, 'rgba(255,150,90,0.4)')
    }

    // ═══ 电线杆(疏 · 细淡电线 · 背景点缀)═══
    const POLES = [[620, 380], [636, 720], [70, 650], [612, 1030]]
      .filter(([x, y]) => !inHouse(x, y - 40))
    const LINKS = [[0, 1], [1, 3], [2, 1]]
    for (const [a, b] of LINKS) {
      if (!POLES[a] || !POLES[b]) continue
      const [x1, y1] = POLES[a], [x2, y2] = POLES[b]
      const ay = y1 - 72, by = y2 - 72
      const mx = (x1 + x2) / 2, my = (ay + by) / 2
      const span = Math.hypot(x2 - x1, y2 - y1)
      const sag = 12 + span * 0.06
      g.strokeStyle = 'rgba(40,32,24,0.28)'; g.lineWidth = 1
      g.beginPath(); g.moveTo(x1, ay)
      g.quadraticCurveTo(mx, my + 2 * sag, x2, by)
      g.stroke()
    }
    for (const [x, y] of POLES) {
      shadow(x, y + 2, 10, 2)
      px(x - 2, y - 76, 5, 78, '#6e5642')
      px(x - 2, y - 76, 1, 78, '#8a6e52')
      px(x - 11, y - 72, 24, 4, '#6e5642')
    }
    // 栅栏 + 晾衣绳
    for (let k = 0; k < 6; k++) {
      px(60 + k * 20, 450, 3, 18, '#a06a40')
      px(60 + k * 20, 450, 3, 3, '#c08a58')
    }
    px(56, 455, 112, 3, '#8a6844')
    px(56, 462, 112, 2, '#8a6844')
    px(238, 350, 4, 46, '#6e5236'); px(316, 350, 4, 46, '#6e5236')
    g.strokeStyle = '#8a7a5c'; g.lineWidth = 2
    g.beginPath(); g.moveTo(240, 354); g.quadraticCurveTo(278, 366, 318, 354); g.stroke()
    // ═══ 精心布置的花草灌木 ═══
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
    // 灌木(墙角/路边成组)
    for (const [bx, by, bs] of [[150, 240, 2], [178, 250, 1.6], [560, 300, 2], [40, 560, 1.6], [566, 700, 2], [120, 820, 1.6], [470, 560, 2], [590, 1010, 1.8]])
      if (!inHouse(bx + 6 * bs, by + 5 * bs)) bush(bx, by, bs)     // 这些在建筑之后画,必须自己避让
    // 花圃(房前/路口)
    for (const [fx, fy, hue] of [[130, 470, '#e87a90'], [560, 480, '#c8a0e8'], [40, 700, '#ffd76a'], [470, 730, '#f6a0c0'], [180, 900, '#e87a90'], [600, 840, '#c8a0e8'], [90, 1130, '#ffd76a'], [520, 1090, '#f6a0c0']])
      if (!inHouse(fx + 16, fy + 6)) flowerbed(fx, fy, hue)
    // 零星野花(疏)
    for (const [fx, fy] of [[220, 300], [420, 250], [80, 380], [640, 400], [260, 660], [500, 660], [160, 1000], [420, 980], [660, 1130]]) {
      if (inHouse(fx, fy)) continue
      px(fx + 1, fy + 3, 2, 4, '#5a9438')
      g.fillStyle = ['#e87a90', '#ffd76a', '#f6efdc'][(fx + fy) % 3]
      px(fx, fy, 2, 2); px(fx + 2, fy, 2, 2); px(fx + 1, fy - 2, 2, 2)
    }
    // ═══ 村居道具:篱笆 · 水井 · 稻草人 · 柴堆 · 晾衣绳 · 石磨 ═══
    function fence(x, y, n, vert) {                       // 木篱笆
      for (let i = 0; i < n; i++) {
        const fx = vert ? x : x + i * 12, fy = vert ? y + i * 12 : y
        shadow(fx + 3, fy + 16, 7, 2)
        px(fx + 1, fy, 5, 17, '#8a6844'); px(fx + 2, fy, 3, 15, '#a8845c'); px(fx + 2, fy, 3, 2, '#c4a074')
      }
      const L = vert ? 17 : n * 12
      if (vert) { px(x, y + 4, 7, 3, '#8a6844'); px(x, y + 11, 7, 3, '#8a6844') }
      else { px(x, y + 4, L, 3, '#8a6844'); px(x, y + 5, L, 1, '#a8845c'); px(x, y + 11, L, 3, '#8a6844') }
    }
    function well(x, y) {                                 // 水井
      const disc = (cx, cy, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill() }
      shadow(x + 14, y + 28, 32, 4)
      disc(x + 14, y + 16, 16, '#6e6a5e')                 // 井台
      disc(x + 14, y + 15, 13, '#9a9284')
      disc(x + 14, y + 14, 10, '#2c3a54')                 // 井水
      disc(x + 11, y + 12, 3, '#4a6a90')                  // 水面反光
      px(x + 2, y - 8, 4, 24, '#7a5638'); px(x + 22, y - 8, 4, 24, '#7a5638')   // 井架立柱
      px(x, y - 13, 28, 5, '#8a6844'); px(x + 1, y - 12, 26, 2, '#a8845c')      // 横梁
      px(x + 6, y - 7, 16, 5, '#6e4a2e'); px(x + 7, y - 6, 14, 2, '#8a6844')    // 辘轳
      px(x + 13, y - 2, 2, 9, '#8a8578')                                        // 井绳
      px(x + 9, y + 6, 10, 7, '#a8845c'); px(x + 10, y + 7, 8, 5, '#7a5638')    // 吊桶
    }
    function scarecrow(x, y) {                            // 稻草人
      shadow(x + 8, y + 30, 16, 3)
      px(x + 7, y + 8, 3, 24, '#8a6844')                  // 立杆
      px(x - 2, y + 12, 20, 3, '#8a6844')                 // 横杆
      px(x + 2, y + 2, 12, 10, '#d8b45c'); px(x + 3, y + 3, 10, 8, '#e8c870')  // 草头
      px(x + 5, y + 6, 2, 2, '#3a2c20'); px(x + 10, y + 6, 2, 2, '#3a2c20')    // 眼
      px(x + 1, y, 14, 3, '#a8845c')                      // 帽檐
      px(x + 4, y - 4, 8, 5, '#c49a68')                   // 帽顶
      px(x + 1, y + 13, 14, 12, '#c85a48')                // 衣
      px(x + 1, y + 16, 14, 2, '#a84838')
      for (let k = 0; k < 4; k++) px(x - 3 + k * 6, y + 24, 2, 4, '#d8b45c')   // 稻草
    }
    function woodpile(x, y) {                             // 柴堆
      shadow(x + 10, y + 14, 22, 3)
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 4 - r; c++) {
          const wx = x + c * 6 + r * 3, wy = y + 10 - r * 5
          px(wx, wy, 6, 5, '#7a5638'); px(wx + 1, wy + 1, 4, 3, '#a8845c'); px(wx + 2, wy + 2, 2, 1, '#c4a074')
        }
    }
    function laundry(x, y, w2) {                          // 晾衣绳
      px(x, y, 2, 22, '#8a6844'); px(x + w2, y, 2, 22, '#8a6844')
      g.strokeStyle = '#a8a294'; g.lineWidth = 1
      g.beginPath(); g.moveTo(x + 1, y + 3); g.quadraticCurveTo(x + w2 / 2, y + 9, x + w2 + 1, y + 3); g.stroke()
      const CL = ['#e8e4d8', '#7aa8d8', '#e8a0b0', '#d8c470']
      for (let k = 0; k < 4; k++) {
        const lx = x + 8 + k * (w2 - 14) / 4
        const sag = Math.sin((k + 1) / 5 * Math.PI) * 5
        px(lx, y + 3 + sag, 9, 11, CL[k % 4]); px(lx + 1, y + 4 + sag, 7, 2, '#00000018')
      }
    }
    function millstone(x, y) {                            // 石磨
      shadow(x + 12, y + 14, 26, 3)
      const disc = (cx, cy, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill() }
      disc(x + 12, y + 10, 13, '#7a7264'); disc(x + 12, y + 9, 11, '#9a9284'); disc(x + 12, y + 8, 4, '#6e6a5e')
      px(x + 11, y - 2, 3, 10, '#8a6844'); px(x + 13, y - 3, 12, 3, '#a8845c')
    }
    // 耕地边:篱笆围一圈 + 稻草人 + 农具
    fence(108, 1132, 5, false); fence(560, 1132, 5, false)
    fence(96, 1140, 4, true);   fence(578, 1140, 4, true)
    // (村里本就有一个稻草人在 300,1144 —— 不再重复放,改摆农具和菜筐)
    function tools(x, y) {                                // 靠在篱笆上的锄头 + 耙
      px(x, y - 22, 3, 24, '#a8845c'); px(x - 3, y - 26, 9, 5, '#8a8578')       // 锄
      px(x + 9, y - 24, 3, 26, '#a8845c'); px(x + 6, y - 28, 9, 3, '#8a8578')   // 耙
      for (let k = 0; k < 3; k++) px(x + 6 + k * 3, y - 27, 2, 5, '#8a8578')
      shadow(x + 5, y + 2, 16, 3)
    }
    function basket(x, y, veg) {                          // 菜筐
      shadow(x + 9, y + 14, 20, 3)
      px(x, y + 2, 18, 12, '#a8845c'); px(x + 1, y + 3, 16, 10, '#c4a074')
      px(x + 1, y + 6, 16, 1, '#8a6844'); px(x + 1, y + 10, 16, 1, '#8a6844')
      for (let k = 0; k < 4; k++) { px(x + 2 + k * 4, y - 1, 4, 4, veg); px(x + 3 + k * 4, y, 2, 2, '#00000020') }
    }
    tools(120, 1150); tools(566, 1150)
    basket(232, 1300, '#68a838'); basket(430, 1310, '#e05838'); basket(508, 1112, '#e8b23d')
    woodpile(88, 1300); woodpile(596, 1180)
    // 河南岸:水井 + 石磨 + 晾衣绳(住户日常)
    well(146, 1076)
    millstone(524, 1064)
    laundry(196, 1288, 62)
    laundry(600, 1310, 56)
    // 村内:井台 + 柴堆 + 晾衣绳(散布在房前屋后)
    // 村内道具:统一避房(硬编码坐标容易压到门口 —— millstone 曾压在塔2门上)
    const putIf = (fn, x, y, ...rest) => { if (!inHouse(x + 10, y + 8)) fn(x, y, ...rest) }
    putIf(well, 470, 706)
    putIf(woodpile, 70, 622); putIf(woodpile, 636, 806); putIf(woodpile, 246, 884)
    putIf(laundry, 34, 786, 58); putIf(laundry, 560, 918, 54)
    putIf(millstone, 300, 470)
    putIf(fence, 452, 848, 4, false); putIf(fence, 60, 968, 3, false)

    // ═══ 村内绿化:房前屋后 · 路边 · 空地 ═══
    // 之前只有边缘一圈森林墙,村子中间光秃秃
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
    for (let i = 0; i < 260; i++) {
      const x = 24 + rnd() * (W - 48), y = 150 + rnd() * (H - 330)
      if (!freeSpot(x, y)) continue
      const r = rnd()
      if (r < 0.40) rtree(x, y, 1.6, 3.2)
      else if (r < 0.68) bush(x, y, 1.1 + rnd() * 1.5)
      else if (r < 0.80) { // 草丛(高草)
        for (let k = 0; k < 5; k++) {
          const gx = x + (rnd() * 12 | 0), gy = y + (rnd() * 6 | 0)
          px(gx, gy, 1, 5 + (rnd() * 4 | 0), rnd() < 0.5 ? '#3e6e2e' : '#4e8a3a')
        }
      } else if (r < 0.90) { // 小石堆
        shadow(x + 4, y + 6, 10, 2)
        px(x, y, 8, 5, '#8a8578'); px(x + 1, y + 1, 5, 2, '#a8a294'); px(x + 2, y + 5, 5, 1, '#6e6a5e')
      } else { // 树桩
        shadow(x + 4, y + 7, 10, 2)
        px(x, y + 1, 9, 6, '#7a5638'); px(x + 1, y, 7, 3, '#9a7048'); px(x + 3, y + 1, 3, 1, '#6a4a2e')
      }
    }
    for (const [fx, fy, hue] of [[236, 340, '#e87a90'], [464, 300, '#c8a0e8'], [320, 660, '#ffd76a'], [520, 560, '#f6a0c0'], [232, 636, '#e87a90']]) {
      const jx = fx + rnd() * 12, jy = fy + rnd() * 10
      if (!inHouse(jx + 16, jy + 6)) flowerbed(jx, jy, hue)
    }
    // ═══ 林相 ═══
    // 分布规则:树成「组」不成「阵」—— 先撒林心,再在林心周围聚集;
    // 不同区域用不同树种(山脚针叶 / 村内阔叶 / 田边果树 / 河岸竹)。
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
    // 北面山脚:针叶林(密)
    forestRow(-34, -30, W + 20, 30, 22, 20, 2.2, 4.2, TV_CONIF, PINE_RM)
    forestRow(-10, -30, W + 20, 34, 24, 16, 2.4, 4.0, TV_CONIF, PINE_RM)
    forestRow(14, -30, W + 20, 40, 26, 14, 2.0, 3.6, TV_CONIF, PINE_RM)
    forestRow(40, -30, W + 20, 52, 28, 16, 1.8, 3.2, TV, null)          // 林缘混阔叶
    // 东西两侧:阔叶林(疏密不均)
    for (let y = 116; y < 900; y += 38 + rnd() * 62) {
      rtree(-18 + rnd() * 18, y + rnd() * 30, 2.2, 3.8, TV, null)
      rtree(W - 36 - rnd() * 16, y + 30 + rnd() * 36, 2.2, 3.8, TV, null)
    }
    // 南面:阔叶 + 针叶混交(密)
    /* 新住区 —— 照 engine/plots.js 的表画,不在这里手摆第二份。
       一律单层(floors:1):新起的小屋,与老村的多层楼房分得开,
       高度也可控 —— 长上去会压到北边那道林带。 */
    for (const d of (globalThis.VILLAGE_DISTRICT || [])) {
      if (d.kind === 'dome') houseDome(d.x, d.gy - 52, d.w, d.roof[0], d.roof[1], '#f2e3c8')
      else building(d.x, d.gy, d.w, d.seed, { floors: 1 })
    }

    forestRow(1288, -20, W + 20, 34, 26, 22, 2.4, 4.2, TV, null)
    forestRow(1316, -20, W + 20, 40, 24, 16, 2.2, 3.8, TV_CONIF, PINE_RM)
    forestRow(1346, -20, W + 20, 46, 28, 12, 2.0, 3.4, TV, null)
    // 新住区最南也用林带收边 —— 老地图就是这么收的,不收边会像被裁掉一截
    forestRow(1856, -20, W + 20, 34, 26, 20, 2.4, 4.2, TV, null)
    forestRow(1886, -20, W + 20, 40, 24, 14, 2.2, 3.8, TV_CONIF, PINE_RM)
    // 村内树丛(成组 · 疏密不均 · 树种混合)
    grove(404, 300, 7, 34, 1.8, 3.4, TV, null)
    grove(158, 552, 6, 30, 1.8, 3.2, TV, null)
    grove(664, 630, 5, 26, 1.8, 3.0, TV, null)
    grove(300, 706, 8, 38, 1.6, 3.0, TV, null)
    grove(230, 420, 5, 28, 1.8, 3.2, TV, null)
    grove(540, 760, 6, 32, 1.6, 2.8, TV, null)
    grove(90, 980, 5, 26, 1.8, 3.2, TV_CONIF, PINE_RM)
    grove(640, 980, 4, 24, 1.8, 3.0, TV_CONIF, PINE_RM)
    // 一两株秋色 —— 打破满眼绿
    rtree(126, 476, 2.6, 3.2, TV, AUT_RM)
    rtree(556, 336, 2.4, 3.0, TV, AUT_RM)
    rtree(360, 856, 2.6, 3.2, TV, AUT_RM)
    // 河岸竹丛
    for (const [bx, by] of [[52, 1044], [96, 1052], [648, 1040], [604, 1050], [30, 918], [672, 912]])
      if (freeSpot(bx, by)) tree(bx, by, 2.2 + rnd() * 1.2, null, 'bambo', rnd() < 0.5)
    // 枯树(点缀 · 荒地感)
    for (const [dx2, dy2] of [[86, 250], [612, 1148], [462, 1120]])
      if (freeSpot(dx2, dy2)) tree(dx2, dy2, 2.4, null, 'treeD', rnd() < 0.5)
    // 果园(田边成排 · 但行距不齐)
    for (let k = 0; k < 7; k++) {
      const ox = 118 + k * 74 + (rnd() * 20 - 10), oy = 1082 + (rnd() * 16 - 8)
      if (freeSpot(ox, oy)) rtree(ox, oy, 2.0, 2.8, TV_ORCH, null)
    }
    // 零散单株(填空 · 不成行)
    for (let i = 0; i < 90; i++) {
      const x = 24 + rnd() * (W - 48), y = 150 + rnd() * (H - 330)
      if (!freeSpot(x, y)) continue
      if (rnd() < 0.45) rtree(x, y, 1.6, 3.0, TV, null)
      else bush(x, y, 1.1 + rnd() * 1.4)
    }

    // ═══ 深度 polish:光柱 + 顶部天光 + 暖分级 + vignette ═══
    // 顶部天光渐变(远山方向)
    const sky = g.createLinearGradient(0, 0, 0, 200)
    sky.addColorStop(0, 'rgba(200,225,240,0.16)'); sky.addColorStop(1, 'rgba(200,225,240,0)')
    g.fillStyle = sky; g.fillRect(0, 0, W, 200)
    // 斜射阳光柱(左上 → 广场)
    const beam = g.createLinearGradient(120, 120, 420, 620)
    beam.addColorStop(0, 'rgba(255,240,190,0.10)'); beam.addColorStop(1, 'rgba(255,240,190,0)')
    g.fillStyle = beam
    g.beginPath(); g.moveTo(60, 90); g.lineTo(280, 90); g.lineTo(460, 640); g.lineTo(180, 640); g.fill()
    // 暖色分级
    g.fillStyle = 'rgba(255,196,120,0.055)'
    g.fillRect(0, 0, W, H)
    // 冷色压暗底部(河区)
    const cool = g.createLinearGradient(0, H - 208, 0, H)
    cool.addColorStop(0, 'rgba(40,60,90,0)'); cool.addColorStop(1, 'rgba(40,60,90,0.12)')
    g.fillStyle = cool; g.fillRect(0, 1200, W, 208)
    // 强 vignette(四角压暗)
    const vg = g.createRadialGradient(352, 640, 420, 352, 700, 940)
    vg.addColorStop(0, 'rgba(20,24,10,0)')
    vg.addColorStop(1, 'rgba(20,24,10,0.28)')
    g.fillStyle = vg
    g.fillRect(0, 0, W, H)
    // 前景层同步吃 polish(source-atop:只染已绘物体,透明处不动)
    fgG.save()
    fgG.globalCompositeOperation = 'source-atop'
    fgG.fillStyle = 'rgba(255,196,120,0.055)'
    fgG.fillRect(0, 0, W, H)
    const vg2 = fgG.createRadialGradient(352, 640, 420, 352, 700, 940)
    vg2.addColorStop(0, 'rgba(20,24,10,0)')
    vg2.addColorStop(1, 'rgba(20,24,10,0.28)')
    fgG.fillStyle = vg2
    fgG.fillRect(0, 0, W, H)
    fgG.restore()
  }

  // ═══ 路网 ═══
  const NAV = {
    EN: [340, 300], PT: [340, 418], HA: [150, 468], HT: [520, 466],
    PL: [200, 528], PR: [470, 542], PB: [340, 672],
    L1: [440, 690], M2: [338, 782], HZ: [520, 760], HP: [150, 704],
    L2: [140, 800], Rt2: [440, 724], M3: [338, 900], Rv2: [300, 936],
    M4: [338, 1060], Wl: [70, 600],
  }
  // 网状连线(横向 + 斜向 · 绕喷泉 · 自由漫游)
  const EDGES = {
    EN: ['PT'],
    PT: ['EN', 'HA', 'HT', 'PL', 'PR'],
    HA: ['PT', 'PL'], HT: ['PT', 'PR'],
    PL: ['PT', 'HA', 'PB', 'Wl'], PR: ['PT', 'HT', 'PB', 'Rt2'],
    PB: ['PL', 'PR', 'M2', 'L1'],
    Wl: ['PL', 'HP'], HP: ['Wl', 'L2'],
    L1: ['PB', 'Rt2', 'M2'], Rt2: ['PR', 'L1', 'M2', 'HZ'],
    M2: ['PB', 'L1', 'Rt2', 'M3', 'L2'], HZ: ['Rt2', 'M3'],
    L2: ['HP', 'M2', 'M3'],
    M3: ['M2', 'L2', 'HZ', 'Rv2', 'M4'],
    Rv2: ['M3'], M4: ['M3'],
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
    for (const o of villagers) {
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
    for (let i = 0; i < villagers.length; i++) {
      for (let j = i + 1; j < villagers.length; j++) {
        const A = villagers[i], B = villagers[j]
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
  const villagers = [
    mkV('ayun', 'HA', ['今天云不错', '就打一把……就一把', '课上说什么来着']),
    mkV('tao', 'HT', ['今日局不错哦', '家人们，点个小红心', '哼，才没在等谁']),
    mkV('popo', 'HP', ['在线占卜，好评返现', '乖，吃糖', '快递到了没？'], { fly: true }),
    mkV('tenz', 'HZ', ['一百零八式，走起', '今晚摇滚法会！', '酥油茶，巴适']),
    mkV('villm', 'PL', ['今儿天气真好', '去买个菜', '早啊'], { remap: { h: '#5a4028', b: '#5a8a44' } }),
    mkV('villm', 'PR', ['听说要来新住户', '这瓜甜', '回见'], { remap: { h: '#3a2c20', b: '#c85a48' } }),
    mkV('villm', 'M2', ['纳个吉去', '午饭吃啥好', '哎哟'], { remap: { h: '#6e5236', b: '#4a6a88' } }),
    mkV('villm', 'Rt2', ['奶茶买一送一！', '慢走啊', '街口新开了铺子'], { remap: { h: '#3a2c20', b: '#c8a0e8' } }),
    mkV('villm', 'Rv2', ['河边风凉快', '钓两条鱼', '你也来啦'], { remap: { h: '#5a4028', b: '#e8b23d' } }),
    mkV('villm', 'PL', ['新鲜果子嘞！', '来看看', '甜得很'], { remap: { h: '#3a2c20', b: '#c85a48' }, stationary: true, x: 170, y: 600, lk: 'vfruit' }),
    mkV('villm', 'Rt2', ['时令青菜！', '刚摘的', '两文一斤'], { remap: { h: '#6e5236', b: '#5a9438' }, stationary: true, x: 508, y: 616, lk: 'vveg' }),
    mkV('villm', 'Wl', ['桃子便宜卖', '走过路过别错过', '尝一个？'], { remap: { h: '#3a2c20', b: '#e8b23d' }, stationary: true, x: 84, y: 740, lk: 'vpeach' }),
  ]

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
    const CYCLE = 2000, dayT = (frame % CYCLE) / CYCLE
    let dRaw
    if (dayT < 0.14) dRaw = 1 - dayT / 0.14
    else if (dayT < 0.5) dRaw = 0
    else if (dayT < 0.66) dRaw = (dayT - 0.5) / 0.16
    else dRaw = 1
    curTime = dayT < 0.32 ? 'morn' : dayT < 0.5 ? 'noon' : dayT < 0.66 ? 'dusk' : 'night'
    const rp = (frame % 4200) / 4200
    curRain = (rp > 0.72 && rp < 0.93) ? Math.sin((rp - 0.72) / 0.21 * Math.PI) : 0
    curWx = curRain > 0.25 ? 'rain' : 'clear'
    // 副标题:算在这里,写在哪儿是宿主的事(设计页写进一个 <span>,
    // 小程序 setData 到 WXML)。引擎只把算好的那句话挂出去。
    if (frame % 20 === 0) {
      const tl = { morn: '清晨', noon: '正午', dusk: '黄昏', night: '夜里' }[curTime]
      const wl = curRain > 0.55 ? '雨' : curRain > 0.12 ? '小雨' : '晴'
      globalThis.VILLAGE_SUB = '村民 ' + villagers.length + ' · ' + tl + ' · ' + wl
    }

    // 碰面判定 + 对话推进
    tryMeet(t)
    stepConvo(t)

    for (const v of villagers) {
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
    for (let a2 = 0; a2 < villagers.length; a2++)
      for (let b2 = a2 + 1; b2 < villagers.length; b2++) {
        const va = villagers[a2], vb = villagers[b2]
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
        for (const v of villagers) {
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
    const sorted = villagers.slice().sort((a, b) => a.y - b.y)
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
    for (const v of villagers) {
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
  globalThis.VILLAGE_CENSUS = function () {
    const P = globalThis.VILLAGE_PLOTS || [], U = globalThis.VILLAGE_UNSITED || []
    return {
      已落位: P.length,
      待落位: U.length,
      住着: P.filter((p2) => HOME[p2.id]).length,
      村民: villagers.length,
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
