  /* ══════════════════════════════════════════════════════════════
     书法字 GLYPHS —— 笔画骨架 + 粗细包络,而非系统字体像素化
     系统字渲染出来是「印刷体的像素化」,没有笔锋。此处按书法的实际写法建模:
     每一笔给出骨架点与起收笔宽度,光栅化时沿骨架铺圆点、宽度沿笔画插值,
     于是自带提按顿挫;起笔加顿、收笔出锋、轻微抖动带来手写感。
     设计网格统一 100×100,渲染时缩放到目标字号。
     ══════════════════════════════════════════════════════════════ */
  const GLYPHS = {}
  globalThis.GLYPHS = GLYPHS
  globalThis.defGlyph = function (ch, spec) { GLYPHS[ch] = spec }

  // 笔画类型的默认包络:起笔略顿 → 行笔 → 收笔出锋
  function strokeEnvelope(kind, u) {
    switch (kind) {
      case 'dot':   return 0.55 + 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.15))
      case 'heng':  return 0.72 + 0.55 * u * u                       // 横:右端略重
      case 'shu':   return 0.95 - 0.25 * u                           // 竖:略收
      case 'pie':   return 1.15 - 0.95 * u                           // 撇:出锋
      case 'na':    return 0.45 + 0.95 * u * u                       // 捺:末端捺脚最重
      case 'ti':    return 1.0 - 0.8 * u
      default:      return 1 - 0.25 * u
    }
  }

  // 沿骨架点列做 Catmull-Rom 采样,得到平滑笔迹
  function sampleSpline(pts, n) {
    if (pts.length === 2) {
      const out = []
      for (let i = 0; i <= n; i++) {
        const u = i / n
        out.push([pts[0][0] + (pts[1][0] - pts[0][0]) * u, pts[0][1] + (pts[1][1] - pts[0][1]) * u])
      }
      return out
    }
    const P = [pts[0]].concat(pts, [pts[pts.length - 1]]), out = []
    for (let seg = 0; seg < P.length - 3; seg++) {
      const [p0, p1, p2, p3] = [P[seg], P[seg + 1], P[seg + 2], P[seg + 3]]
      const m = Math.ceil(n / (P.length - 3))
      for (let i = 0; i < m; i++) {
        const u = i / m, u2 = u * u, u3 = u2 * u
        out.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * u + (2*p0[0] - 5*p1[0] + 4*p2[0] - p3[0]) * u2 + (-p0[0] + 3*p1[0] - 3*p2[0] + p3[0]) * u3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * u + (2*p0[1] - 5*p1[1] + 4*p2[1] - p3[1]) * u2 + (-p0[1] + 3*p1[1] - 3*p2[1] + p3[1]) * u3),
        ])
      }
    }
    out.push(pts[pts.length - 1])
    return out
  }

  /* 把一个字光栅化到独立 canvas(带缓存)
     size = 目标字号(px);color;opt.weight 整体粗细;opt.jitter 手写抖动 */
  const GLYPH_CACHE = {}
  globalThis.glyphSprite = function (ch, size, color, opt) {
    opt = opt || {}
    const key = ch + '|' + size + '|' + color + '|' + (opt.weight || 1) + '|' + (opt.jitter || 0)
    if (GLYPH_CACHE[key]) return GLYPH_CACHE[key]
    const G = GLYPHS[ch]
    const cv = HOST.createCanvas(size, size)
    const g = cv.getContext('2d')
    if (!G) {                                  // 无字形数据 → 退回系统字(明确标记为待补)
      g.fillStyle = color
      g.font = '700 ' + Math.round(size * 0.86) + 'px "Kaiti SC","STKaiti","Songti SC",serif'
      g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(ch, size / 2, size * 0.54)
      GLYPH_CACHE[key] = cv
      return cv
    }
    // 笔画密度自适应:笔画多的字必须写细,否则在小字号下糊成一团。
    // 以 6 笔为基准,每多一笔收 4%,下限 0.62;字形也可用 G.weight 手动微调。
    const dense = Math.max(0.62, Math.min(1.25, 1 - (G.strokes.length - 6) * 0.04))
    const k = size / (G.box || 100), W = (opt.weight || 1) * (G.weight || 1) * dense
    g.fillStyle = color
    for (const st of G.strokes) {
      const base = (st.w || 6) * k * W
      // 采样密度按笔画实长决定:圆点铺得稀就会出现波浪边(被误认成「抖动」)
      let plen = 0
      for (let q = 1; q < st.pts.length; q++)
        plen += Math.hypot(st.pts[q][0] - st.pts[q-1][0], st.pts[q][1] - st.pts[q-1][1])
      const pts = sampleSpline(st.pts, Math.max(24, Math.round(plen * k * 1.6)))
      for (let i = 0; i < pts.length; i++) {
        const u = i / (pts.length - 1)
        let r = base * strokeEnvelope(st.k || 'heng', u) * 0.5
        if (r < 0.6) r = 0.6
        let x = pts[i][0] * k, y = pts[i][1] * k
        if (opt.jitter) {
          x += Math.sin(i * 1.7 + ch.charCodeAt(0)) * opt.jitter
          y += Math.cos(i * 2.3 + ch.charCodeAt(0)) * opt.jitter
        }
        // 像素圆点:逐行填充,保持像素质感(不用 arc,避免抗锯齿糊边)
        const R = Math.round(r)
        for (let dy = -R; dy <= R; dy++) {
          const dx = Math.sqrt(Math.max(0, R * R - dy * dy)) | 0
          g.fillRect(Math.round(x - dx), Math.round(y + dy), dx * 2 + 1, 1)
        }
      }
    }
    GLYPH_CACHE[key] = cv
    return cv
  }

  /* 写一行字:CALLI(g, '六壬堂', x, y, size, color, opt) —— x,y 为该行左上角 */
  globalThis.CALLI = function (g, text, x, y, size, color, opt) {
    opt = opt || {}
    const gap = opt.gap != null ? opt.gap : Math.round(size * 0.12)
    let cx = x
    for (const ch of text) {
      const sp = globalThis.glyphSprite(ch, size, color, opt)
      g.drawImage(sp, Math.round(cx), Math.round(y))
      cx += size + gap
    }
    return cx - x - gap
  }

  /* ── 字形库:匾额常用字(骨架取自行楷写法)── */
  defGlyph('六', { box: 100, strokes: [
    { k:'dot',  w:9,  pts: [[50,8],[52,20]] },
    { k:'heng', w:8,  pts: [[14,34],[50,31],[86,35]] },
    { k:'pie',  w:10, pts: [[36,48],[28,68],[14,90]] },
    { k:'na',   w:9,  pts: [[64,48],[74,70],[88,90]] },
  ]})
  defGlyph('壬', { box: 100, strokes: [
    { k:'pie',  w:8,  pts: [[30,16],[46,12],[62,14]] },
    { k:'heng', w:8,  pts: [[20,40],[52,37],[84,41]] },
    { k:'shu',  w:9,  pts: [[52,14],[51,44],[52,76]] },
    { k:'heng', w:10, pts: [[12,80],[50,76],[90,82]] },
  ]})
  defGlyph('堂', { box: 100, strokes: [
    // ⺌:竖点 + 左撇 + 右点
    { k:'dot',  w:8,  pts: [[50,5],[50,16]] },
    { k:'pie',  w:7,  pts: [[33,10],[27,20]] },
    { k:'na',   w:7,  pts: [[67,10],[73,20]] },
    // 冖:秃宝盖(带左垂点)
    { k:'shu',  w:6,  pts: [[19,27],[18,33]] },
    { k:'heng', w:8,  pts: [[18,27],[50,25],[82,29]] },
    // 口
    { k:'shu',  w:7,  pts: [[33,40],[33,58]] },
    { k:'heng', w:7,  pts: [[33,40],[67,39]] },
    { k:'shu',  w:7,  pts: [[67,39],[67,58]] },
    { k:'heng', w:7,  pts: [[33,58],[67,57]] },
    // 土
    { k:'heng', w:7,  pts: [[35,70],[65,69]] },
    { k:'shu',  w:8,  pts: [[50,64],[50,84]] },
    { k:'heng', w:12, pts: [[13,90],[50,86],[87,91]] },
  ]})

  /* ── 沈砚的字:「待时」—— 他挂在墙上的那幅 ──
     等待时机。考了七次是在等时,如今替人测字也还在等;
     明知等不到还挂着 —— 骨架取行楷,笔断意连。 */
  defGlyph('待', { box: 100, strokes: [
    // 彳 双人旁
    { k:'pie',  w:7,  pts: [[27,13],[17,27]] },
    { k:'pie',  w:8,  pts: [[29,31],[15,47]] },
    { k:'shu',  w:8,  pts: [[23,31],[22,88]] },
    // 寺
    { k:'heng', w:8,  pts: [[43,27],[68,25],[91,28]] },
    { k:'shu',  w:8,  pts: [[66,19],[66,49]] },
    { k:'heng', w:8,  pts: [[46,49],[68,47],[89,50]] },
    { k:'heng', w:9,  pts: [[41,66],[67,63],[93,67]] },
    { k:'shu',  w:9,  pts: [[71,57],[70,84],[62,92]] },
    { k:'dot',  w:8,  pts: [[52,75],[59,82]] },
  ]})
  // 客人递过来要他拆的那个字。这间房里,「運」是他自己最缺的一个 ——
  // 繁体写法:走之底托着「軍」,冖 下面一个車
  defGlyph('運', { box: 100, strokes: [
    // 軍 —— 冖
    { k:'dot',  w:7,  pts: [[52,10],[57,17]] },
    { k:'heng', w:8,  pts: [[33,22],[57,20],[82,23]] },
    { k:'shu',  w:7,  pts: [[35,22],[34,32]] },
    { k:'shu',  w:7,  pts: [[81,23],[80,33]] },
    // 軍 —— 車
    { k:'heng', w:7,  pts: [[42,35],[58,33],[75,35]] },
    { k:'shu',  w:7,  pts: [[45,35],[45,60]] },
    { k:'shu',  w:7,  pts: [[72,35],[72,60]] },
    { k:'heng', w:7,  pts: [[43,47],[58,45],[74,47]] },
    { k:'heng', w:7,  pts: [[42,60],[58,58],[75,60]] },
    { k:'heng', w:9,  pts: [[36,72],[58,69],[84,72]] },
    { k:'shu',  w:9,  pts: [[59,28],[58,86]] },
    // 辶 —— 走之底
    { k:'dot',  w:8,  pts: [[16,26],[23,33]] },
    { k:'pie',  w:8,  pts: [[21,42],[14,54]] },
    { k:'heng', w:8,  pts: [[14,54],[19,63]] },
    { k:'na',   w:11, pts: [[19,63],[34,86],[62,93],[92,86]] },
  ]})
  defGlyph('时', { box: 100, strokes: [
    // 日
    { k:'shu',  w:8,  pts: [[16,23],[16,77]] },
    { k:'heng', w:7,  pts: [[16,23],[30,21],[43,23]] },
    { k:'shu',  w:8,  pts: [[43,23],[43,77]] },
    { k:'heng', w:7,  pts: [[17,49],[30,47],[42,49]] },
    { k:'heng', w:8,  pts: [[16,77],[30,75],[43,77]] },
    // 寸
    { k:'heng', w:8,  pts: [[52,47],[74,45],[93,48]] },
    { k:'shu',  w:9,  pts: [[75,39],[74,80],[66,89]] },
    { k:'dot',  w:8,  pts: [[58,61],[65,68]] },
  ]})


