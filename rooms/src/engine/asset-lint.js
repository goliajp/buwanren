  /* ══════════════════════════════════════════════════════════════
     素材库规范校验 —— 公共库必须可信,元数据缺失会在下游静默出错
     (foot 缺失 → 网格烧不出碰撞;zLayer 缺失 → 遮挡判错;cat 缺失 → 分不了类)
     ══════════════════════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════════════════════
     交互热区 —— 没有反馈的可点物等于不可点(B11 §PROPS)
     三档:A 自发(fx) / B 点击(clickable) / C 叙事(say)
     ══════════════════════════════════════════════════════════════ */
  window.attachRoomInteraction = function (canvas, room, opts) {
    opts = opts || {}
    const state = { hover: null, said: null, saidUntil: 0 }
    canvas.__interaction = state
    // 命中检测必须逐像素(alpha test):素材的包围盒常远大于实际像素 —— 组合件
    // 尤其如此(立式香炉 226×602 里大半是空的),只用包围盒会让一整片空白都响应。
    // 每个素材缓存一张 1bit alpha mask,hover 是低频事件,开销可忽略。
    const MASK = {}
    function maskOf(id, x, y) {
      if (MASK[id]) return MASK[id]
      const inst = window.placeAsset(id, x, y, {})
      const c = inst.cv.getContext('2d')
      const d = c.getImageData(0, 0, inst.cv.width, inst.cv.height).data
      const w = inst.cv.width, h = inst.cv.height
      const m = new Uint8Array(w * h)
      for (let i = 0, n = 0; i < d.length; i += 4, n++) m[n] = d[i + 3] > 24 ? 1 : 0
      MASK[id] = { m: m, w: w, h: h }
      return MASK[id]
    }
    // 命中的先后必须与【画的先后】同一套规则,否则「看得见的那件点不到」。
    // 附着件(茶杯放在桌上、抱枕放在床上)在 renderRoom 里的 sortKey 是
    // 宿主的 baseY + zBias,而这里原先一律用自己的 y + base —— 桌子的 base
    // 总是更大,于是桌上的每一件都被桌子吃掉。婆婆房的缺口杯与她的碗
    // 就是这么点不到的,而那两件正是这间房要说的话。
    function depthOf(p) {
      const a = A[p[0]], o = p[3]
      if (o && o.attach) {
        for (const q of room.plan) {
          if (q[0] !== o.attach) continue
          const h = A[q[0]]
          if (h) return q[2] + h.base + (o.zBias || 1)
        }
      }
      // 非附着件:必须与【绘制】用同一条排序线 —— renderRoom 的 sortLineOf 取的是
      // 占地矩形的【顶边】(y + foot[1]),而这里从前取的是底边(y + base)。两套公式,
      // 于是两件重叠时绘制的前后与命中的前后可能【相反】,症状就是「看得见的那件点不到」。
      // 事故模式 19 当年只把 attach 那一支对齐了,非附着件这一支漏了。
      return p[2] + (a.foot && a.foot[3] > 0 ? a.foot[1] : a.base)
    }
    function hit(mx, my) {
      let best = null, bestD = -Infinity
      for (const p of room.plan) {
        const a = A[p[0]]
        if (!a || !a.clickable) continue
        const x = p[1], y = p[2]
        if (mx < x || mx > x + a.w || my < y || my > y + a.h) continue   // 包围盒粗筛
        const mk = maskOf(p[0], x, y)
        const px = Math.floor(mx - x), py = Math.floor(my - y)
        if (px < 0 || py < 0 || px >= mk.w || py >= mk.h) continue
        if (!mk.m[py * mk.w + px]) continue                              // alpha 精筛
        const d = depthOf(p)
        if (!best || d > bestD) { best = { id: p[0], x: x, y: y }; bestD = d }
      }
      return best
    }
    // 把命中函数挂到画布上 —— 门禁要能【逐件点一遍】看点到的是不是它自己。
    // 「声明了 clickable」「verify 说交互已接」「点了有气泡」三样都成立,
    // 仍可能点到的是桌子而不是桌上的杯子(附着件曾 1/7 可达)。
    canvas.__hitAt = hit

    function toCanvas(ev) {
      const r = canvas.getBoundingClientRect()
      return [(ev.clientX - r.left) / r.width * canvas.width,
              (ev.clientY - r.top) / r.height * canvas.height]
    }
    canvas.addEventListener('mousemove', function (ev) {
      const p = toCanvas(ev); state.hover = hit(p[0], p[1])
      canvas.style.cursor = state.hover ? 'pointer' : ''
    })
    canvas.addEventListener('mouseleave', function () { state.hover = null })
    canvas.addEventListener('click', function (ev) {
      const p = toCanvas(ev), h = hit(p[0], p[1])
      if (!h) return
      const a = A[h.id]
      // 追问 —— 同一件反复点，遮掩会松动。
      // 说不出真话的人不会因为你问一次就说；但问到第三次，她会。
      // 素材声明 sayDeep 才有这一层，没有的就一直是原句。
      state.asked = state.asked || {}
      state.asked[h.id] = (state.asked[h.id] || 0) + 1
      const deep = a.sayDeep && state.asked[h.id] >= 3
      state.said = { id: h.id, text: (deep ? a.sayDeep : (a.say || a.name)), x: h.x + a.w / 2, y: h.y }
      state.saidUntil = performance.now() + (deep ? 4200 : 2600)
      if (opts.onClick) opts.onClick(h.id, a)
    })
    return state
  }

  /* ══ L8 UI:交互反馈(描边高亮 + 叙事气泡)══ */
  window.drawInteraction = function (g, room, canvas, t) {
    const st = canvas && canvas.__interaction
    if (!st) return
    if (st.hover) {
      // 反馈用【光泽】而非描边框:框会破坏画面,光泽更像物件本身被照亮
      const a = A[st.hover.id], inst = window.placeAsset(st.hover.id, st.hover.x, st.hover.y, {})
      const pulse = 0.16 + 0.10 * Math.sin(t / 260)
      g.save()
      g.globalCompositeOperation = 'lighter'
      g.globalAlpha = pulse
      g.drawImage(inst.cv, st.hover.x, st.hover.y)      // 叠自身一层 → 只亮物件本体
      g.restore()
      // 原本这里还叠了一层径向泛光,半径按包围盒 max(w,h)*0.62 算、铺满 w*1.4 × h*1.4。
      // 对细高的组合件(立式香炉 226×602)那就是半径 373px、覆盖 316×843 的一大片,
      // 照亮的全是空气,看着像整片都在响应。逐像素命中的意义被这层光抵消了,故删除。
      // 反馈只保留上面那层「叠自身」——光严格落在物件自己的像素上。
    }
if (st.said && t < st.saidUntil) {
      // 气泡换行:台词里的双空格是天然断句点;单行仍过宽时按字数硬折
      g.save()
      g.font = '600 42px "PingFang SC", sans-serif'
      const MAXW = 620
      let parts = String(st.said.text).split(/\s{2,}/).filter(Boolean)
      const lines = []
      for (const seg of parts) {
        if (g.measureText(seg).width <= MAXW) { lines.push(seg); continue }
        let cur = ''
        for (const ch of seg) {
          if (g.measureText(cur + ch).width > MAXW) { lines.push(cur); cur = ch }
          else cur += ch
        }
        if (cur) lines.push(cur)
      }
      const lh = 52, padX = 22, padY = 16
      const tw = Math.max.apply(null, lines.map(l => g.measureText(l).width))
      const bw = tw + padX * 2, bh = lines.length * lh + padY * 2 - 10
      let bx = st.said.x - bw / 2, by = st.said.y - bh - 18
      if (bx < 12) bx = 12
      if (bx + bw > 1428) bx = 1428 - bw
      if (by < 12) by = 12
      g.fillStyle = '#2a1e18'; g.fillRect(bx - 4, by - 4, bw + 8, bh + 8)
      g.fillStyle = '#faf4e4'; g.fillRect(bx, by, bw, bh)
      g.fillStyle = '#2a1e18'; g.textAlign = 'left'; g.textBaseline = 'middle'
      lines.forEach((l, i) => g.fillText(l, bx + padX, by + padY + i * lh + lh / 2 - 6))
      g.restore()
    } else if (st.said && t >= st.saidUntil) st.said = null
  }

  /* ══════════════════════════════════════════════════════════════
     库合规校验 —— `assetlint` 调它。这两支从前【根本不存在】,
     assetlint 里 `window.lintAssets ? ... : null` 静默取到 null,
     于是「双门禁全绿」是空转出来的:S5 素材、S3 布局两步的门禁一直是空的。
     ══════════════════════════════════════════════════════════════ */

  // 素材元数据合规:尺寸 / 占地 / 分层 / 作用域 / 命名
  window.lintAssets = function () {
    const bad = []
    for (const id of Object.keys(A)) {
      const a = A[id], e = []
      if (!(a.w > 0) || !(a.h > 0)) e.push('w/h 非正数')
      if (typeof a.draw !== 'function') e.push('draw 不是函数')
      if (!a.cat) e.push('缺 cat')
      if (!['generic', 'character'].includes(a.scope)) e.push('scope 应为 generic|character')
      if (!a.fromRoom) e.push('缺 fromRoom')
      // 命名规则:id = <出生房前缀>_<物件>,generic 也带前缀(前缀是溯源)
      else if (!id.startsWith(a.fromRoom + '_')) e.push(`命名应为 ${a.fromRoom}_*`)
      if (a.zLayer != null && !['low', 'sort', 'above'].includes(a.zLayer)) e.push('zLayer 应为 low|sort|above')
      const f = a.foot
      if (f != null) {
        if (!Array.isArray(f) || f.length !== 4) e.push('foot 应为 [ox,oy,w,h]')
        else if (f.some(n => typeof n !== 'number')) e.push('foot 含非数字')
        else if (f[0] + f[2] > a.w + 1 || f[1] + f[3] > a.h + 1) e.push('foot 超出素材范围')
      }
      if (e.length) bad.push({ id, errs: e })
    }
    return bad
  }

  // 素材清单 —— 供工具取用(coverage 一直在调它,而它从来没被实现过,
  // 于是那支工具对任何房间都直接崩;没人跑它,也就没人发现)。
  window.assetManifest = function () {
    return Object.keys(A).sort().map(id => {
      const a = A[id]
      return { id, name: a.name || '', cat: a.cat || '', scope: a.scope || '', fromRoom: a.fromRoom || '',
               w: a.w, h: a.h, base: a.base, foot: a.foot || null, zLayer: a.zLayer || 'sort',
               fx: !!a.fx, light: !!a.light, variant: !!a.variant, walkable: !!a.walkable, wall: !!a.wall,
               clickable: !!a.clickable, say: !!a.say, sayDeep: !!a.sayDeep, patina: a.patina || null }
    })
  }

  // UI 遮挡禁区(1440×2560 房间坐标系):标题栏与行动按钮各盖住一条,里面的陈设看不见
  const UIZONE = { top: 180, bottom: 2400 }

  // 房间布局合规:引用存在 / 不越界 / 实体不重叠 / 不进 UI 遮挡带
  // 返回 { errs 必须修, notes 看一眼就好 }
  window.lintRoom = function (room) {
    const errs = [], notes = [], W = room.w || 1440, H = room.h || 2560
    const solid = []
    for (const p of (room.plan || [])) {
      const [id, x, y, opt] = p
      const a = A[id]
      if (!a) { errs.push(`${id} 未定义`); continue }
      if (x < -8 || y < -8 || x + a.w > W + 8 || y + a.h > H + 8)
        errs.push(`${id} 越界 (${x},${y}) ${a.w}x${a.h}`)
      // 只比【实体占地】:地面/可踩/附着物不参与重叠判定
      const attached = !!(opt && opt.attach)
      const f = a.foot
      if (a.cat === '地面' || a.walkable || a.wall || attached) continue
      if (!f || !(f[2] > 0) || !(f[3] > 0)) continue
      const s = { id, x: x + f[0], y: y + f[1], w: f[2], h: f[3] }
      solid.push(s)
      // UI 遮挡禁区(设计圣经 B「禁区」):顶栏盖住 y<180,行动按钮盖住 y>2400。
      // 这两带里的陈设玩家根本看不见 —— 画了等于没画。规则一直写在册子里,
      // 但唯一查它的 planlint 只认早已删掉的 FULLROOMS 格式,于是多年无人执行。
      if (s.y + s.h > UIZONE.bottom) notes.push(`${id} 探进底部按钮遮挡带(y ${s.y + s.h} > ${UIZONE.bottom})—— 玩家看不到`)
      if (s.y < UIZONE.top) notes.push(`${id} 探进顶栏遮挡带(y ${s.y} < ${UIZONE.top})—— 玩家看不到`)
    }
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
      const p = solid[i], q = solid[j]
      const ox = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)
      const oy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y)
      // 提示,不是错误 —— 2.5D 下大件的上部(锅肚/香炉肩)会探出底座,
      // 小件摆在它的投影下方物理上说得通。真正要卡的是【看得见却点不到】
      // (roomaudit C 逐件点)和【走不到】(可达性),那两项才判失败。
      if (ox > 12 && oy > 12) notes.push(`占地重叠 ${p.id} ↔ ${q.id}  ${ox}x${oy}px（大件投影盖住小件,人工看一眼）`)
    }
    return { errs, notes }
  }

