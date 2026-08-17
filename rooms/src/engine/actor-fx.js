  /* ══════════════════════════════════════════════════════════════
     角色附属绘制 —— 气泡 / 情绪符号
     这段绘制曾被复制进四个房间,所以上一轮改一个锚点变量就同时打挂三间。
     现在只有这一份:房间声明「谁 · 说什么 · 什么情绪」,不碰画笔。
     ══════════════════════════════════════════════════════════════ */
  const SAY = { font: '600 46px "PingFang SC", sans-serif',
                padX: 26, padY: 16, lh: 52, maxW: 620, gap: 16, tail: 18 }
  // 每间房的气泡配色不同(桃桃粉、婆婆紫、丹增米),按房声明,不各写一份绘制
  window.SAY_STYLE = { ink: '#3a2c20', paper: '#fdf2f5' }

  // 锚点:sprite 顶边中心。房间不再自己写 st.x + 40 这类换算 ——
  // 换算写死过一次,姿态一换宽度就对不上。
  window.actorAnchor = function (id, pose, x, y, key) {
    const a = window.ACTORS[id]
    if (key && a && a.anchors && a.anchors[key])
      return { x: x + a.anchors[key][0], y: y + a.anchors[key][1] }
    const cv = window.actorSprite(id, pose, false)
    return { x: x + cv.width / 2, y: y }
  }

  window.drawSay = function (g, anchor, text, style) {
    if (!text) return
    style = style || window.SAY_STYLE
    g.save()
    g.font = SAY.font
    // 折行:中文逐字断,西文遇空格断
    const lines = []
    let cur = ''
    for (const ch of String(text)) {
      const nx = cur + ch
      if (g.measureText(nx).width > SAY.maxW && cur) { lines.push(cur); cur = ch }
      else cur = nx
    }
    if (cur) lines.push(cur)
    const tw = Math.max.apply(null, lines.map(l => g.measureText(l).width))
    const bw = tw + SAY.padX * 2, bh = lines.length * SAY.lh + SAY.padY * 2
    const W = g.canvas.width
    let bx = anchor.x - bw / 2, by = anchor.y - bh - SAY.gap - SAY.tail
    if (bx < 12) bx = 12
    if (bx + bw > W - 12) bx = W - 12 - bw
    if (by < 12) by = 12
    g.fillStyle = style.ink;   g.fillRect(bx - 5, by - 5, bw + 10, bh + 10)
    g.fillStyle = style.paper; g.fillRect(bx, by, bw, bh)
    // 尾巴指回说话的人,并夹在气泡内,免得说话的人贴边时尾巴飞出去
    const tx = Math.max(bx + 12, Math.min(anchor.x - 11, bx + bw - 34))
    g.fillStyle = style.ink
    g.fillRect(tx, by + bh, 22, 7); g.fillRect(tx + 6, by + bh + 7, 11, 11)
    g.textAlign = 'left'; g.textBaseline = 'middle'
    lines.forEach((l, i) => g.fillText(l, bx + SAY.padX, by + SAY.padY + SAY.lh * (i + 0.5)))
    g.restore()
  }

  /* 情绪符号 —— 可扩展表。新房间要新符号时 defineEmote 一次,不改引擎。 */
  const EMOTES = {}
  window.defineEmote = function (kind, fn) { EMOTES[kind] = fn }
  window.drawEmote = function (g, kind, anchor, t) {
    const f = EMOTES[kind]; if (!f) return
    g.save(); f(g, anchor.x, anchor.y, t || 0); g.restore()
  }
  const bob = t => Math.sin(t / 400) * 4
  defineEmote('zzz', function (g, x, y, t) {
    g.fillStyle = '#8a9ab8'
    const zy = y - 30 + bob(t)
    g.fillRect(x + 4, zy, 12, 3); g.fillRect(x + 10, zy + 4, 5, 4); g.fillRect(x + 4, zy + 9, 12, 3)
    g.fillRect(x - 16, zy - 22, 8, 2); g.fillRect(x - 12, zy - 19, 3, 3); g.fillRect(x - 16, zy - 15, 8, 2)
  })
  defineEmote('heart', function (g, x, y, t) {
    g.fillStyle = '#e87a90'
    const hx = x - 44, hy = y + 4 + bob(t)
    g.fillRect(hx, hy + 3, 4, 4); g.fillRect(hx + 6, hy + 3, 4, 4)
    g.fillRect(hx + 1, hy + 6, 8, 4); g.fillRect(hx + 3, hy + 10, 4, 3)
  })
  defineEmote('sulk', function (g, x, y, t) {   // 生闷气画圈圈
    g.fillStyle = 'rgba(90,80,60,0.55)'
    const n = ((t / 120) | 0) % 14
    for (let k = 0; k < n; k++) {
      const a = k * 0.45
      g.fillRect(x + 70 + Math.cos(a) * 26, y + 106 + Math.sin(a) * 13, 4, 3)
    }
  })
  defineEmote('note', function (g, x, y, t) {
    g.fillStyle = '#6a8ab0'
    const ny = y - 24 + bob(t)
    g.fillRect(x + 10, ny, 5, 18); g.fillRect(x + 10, ny, 14, 5); g.fillRect(x + 4, ny + 14, 12, 8)
  })
  /* 视觉连线:把角色和它正在作用的东西连起来(手柄线 / 牵绳 / 视线)。
     这是「角色 ↔ 道具」关系的视觉那一半,追逐是行为那一半。 */
  /* 素材可以声明具名锚点(插口 / 挂点 / 视线落点),供连线与关系引用。
     没声明就落回包围盒中心。房间因此不必写「电视插口在 1248,1110」。 */
  window.roomAnchorOf = function (room, assetId, key) {
    const a = window.ASSETS[assetId]; if (!a || !room || !room.plan) return null
    for (const e of room.plan) {
      if (e[0] !== assetId) continue
      const off = (key && a.anchors && a.anchors[key]) || [a.w / 2, a.h / 2]
      return { x: e[1] + off[0], y: e[2] + off[1] }
    }
    return null
  }


  window.drawLink = function (g, from, to, opt) {
    opt = opt || {}
    const n = opt.seg || 12, sag = opt.sag === undefined ? 20 : opt.sag
    g.save(); g.fillStyle = opt.color || 'rgba(30,30,40,0.6)'
    for (let i = 0; i < n; i++) {
      const k = i / n
      const lx = from.x + (to.x - from.x) * k
      const ly = from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * sag
      g.fillRect(lx | 0, ly | 0, 3, 3)
    }
    g.restore()
  }
  defineEmote('gamepad', function (g, x, y) {   // 双手握手柄,贴在角色胸前
    g.fillStyle = '#f6efdc'
    g.fillRect(x - 22, y + 68, 12, 8); g.fillRect(x - 4, y + 68, 12, 8)
  })
  defineEmote('sweat', function (g, x, y, t) {
    g.fillStyle = '#7cc4e8'
    g.fillRect(x - 52, y + 34 + ((((t / 60) | 0) % 16) * 2), 4, 6)
  })
  defineEmote('star', function (g, x, y, t) {   // 打赏 / 高光
    const ph = (t / 900) % 1, s = Math.sin(ph * Math.PI) * 11
    if (s <= 1.5) return
    g.fillStyle = 'rgba(255,215,106,' + (0.9 * Math.sin(ph * Math.PI)) + ')'
    const sx = x + 52, sy = y - 16
    g.fillRect(sx - s, sy - 2, s * 2, 4); g.fillRect(sx - 2, sy - s, 4, s * 2)
    g.fillRect(sx - 4, sy - 4, 8, 8)
  })


