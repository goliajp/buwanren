  //<<< TENZ ASSETS END


  window.ASSETS = A

  // ── 绘制原语(接受 ctx,与房间内的同名函数互不影响)──
  function pxC(g, cx, cy, r, color) {
    g.fillStyle = color
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.sqrt(r * r - dy * dy) | 0
      g.fillRect(cx - dx, cy + dy, dx * 2, 1)
    }
  }
  function pxR(g, cx, cy, r, w, color) {
    g.fillStyle = color
    for (let dy = -r; dy <= r; dy++) {
      const dxo = Math.sqrt(r * r - dy * dy) | 0
      const ri = r - w
      const dxi = Math.abs(dy) > ri ? 0 : (Math.sqrt(ri * ri - dy * dy) | 0)
      g.fillRect(cx - dxo, cy + dy, dxo - dxi, 1)
      g.fillRect(cx + dxi, cy + dy, dxo - dxi, 1)
    }
  }
  function bx(g, x, y, w, h, edge, fill) {
    g.fillStyle = edge; g.fillRect(x, y, w, h)
    g.fillStyle = fill; g.fillRect(x + 2, y + 2, w - 4, h - 4)
  }
  // 椭圆填充（像素扫描线）—— 素材里曾内联 96 份，收进共享集。
  function pxE(g, cx, cy, rx, ry, color) {
    g.fillStyle = color
    for (let dy = -ry; dy <= ry; dy++) {
      const dx = (rx * Math.sqrt(1 - (dy / ry) * (dy / ry))) | 0
      g.fillRect(cx - dx, cy + dy, dx * 2, 1)
    }
  }
  // 径向发光晕 —— color 是中心色，edge 缺省透明（传 fade 覆盖到某色再淡出）。素材里曾内联 43 份。
  function glow(g, x, y, r, color, fade) {
    const q = g.createRadialGradient(x, y, 2, x, y, r)
    q.addColorStop(0, color); q.addColorStop(1, fade || 'rgba(0,0,0,0)')
    g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  window.ASSET_PRIM = { pxC, pxR, bx, pxE, glow }

  const PRIM = { pxC, pxR, bx, pxE, glow }
  function def(id, spec) { spec.id = id; A[id] = spec }

  /* ────────── 收纳类 ────────── */
