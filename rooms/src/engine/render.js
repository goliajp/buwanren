  /* ══════════════════════════════════════════════════════════════
     渲染管线 —— 图层栈 L0..L7(见 B11 规范)
     L0 FLOOR → L1 DECAL → L2/3/4 SORT(含自动 AO)→ L5 LIGHT → L6 FX → L7 GRADE
     ══════════════════════════════════════════════════════════════ */
  /* ══ 渐变缓存:createRadialGradient 每帧新建是明确热点 ══ */
  const GRAD = new Map()
  function radialCached(g, x, y, r, c0, c1) {
    const k = x + ':' + y + ':' + r + ':' + c0
    let v = GRAD.get(k)
    if (!v) { v = g.createRadialGradient(x, y, 2, x, y, r); v.addColorStop(0, c0); v.addColorStop(1, c1); GRAD.set(k, v) }
    return v
  }

  /* ══ 静态层烘焙:L0(墙 + 地板 + 板纹)与时间无关,烘一次复用 ══
     L1/L2 依赖实例列表且只是几次 drawImage,不值得进烘焙;真正重的是地板
     逐条板纹的循环。以 room 弱引用为键,换 surfaces/palette 需 invalidate。 */
  const BAKE0 = new WeakMap()
  window.invalidateRoomBake = function (room) { BAKE0.delete(room) }



  /* ══════════════════════════════════════════════════════════════
     房间状态 · 有状态家具 · 道具 · 关系
     这四样是「角色与房间互相作用」的最小完备集。都做成引擎能力,
     因为 36 间村民房会反复用到 —— 房间里只允许声明,不允许特例。
     ══════════════════════════════════════════════════════════════ */

  /* ── 1. 房间状态 ────────────────────────────────────────────────
     状态必须是【可查询】的,不能只是动画内部参数:屏风拉开代表桃桃
     「开播」,她的台词、灯光色温、镜头内外的分界都要能读到这件事。 */
  window.roomState = function (room, patch) {
    if (!room.state) room.state = {}
    if (patch) Object.assign(room.state, patch)
    return room.state
  }

  /* ── 2. 有状态 / 动画家具 ───────────────────────────────────────
     素材声明 variant(state, t) → 变体名。引擎按变体名走【已有的】
     sprite 缓存,每个变体只栅格化一次,于是动画家具在 L3 里跟普通
     家具没有任何区别 —— 秋千能正确排在坐着的人身后,这是 L6 特效
     层做不到的(L6 在角色之后,只能盖在人身上)。
     连续动画由素材自己【量化】成有限档,例如 16 档摆动 = 16 张 sprite。 */
  function variantFor(a, room, t) {
    if (!a || typeof a.variant !== 'function') return null
    try { return a.variant(room.state || {}, t || 0) } catch (e) { return null }
  }

  /* ── 2.5 寻路 ────────────────────────────────────────────────
     寻路是基础机制，三间房共用一套(丹增房尚未迁入，仍自带 BFS)。此前阿云走 40px 网格 BFS、
     桃桃走手工路网(9 节点 + 直线边) —— 路网的边由人手连，**没有任何机制
     保证它不穿家具**，`pathlint` 实测桃桃 14 处穿模、阿云 4 处。

     碰撞体也不再手工维护：直接从 room.plan 的素材 foot 烧格，
     于是加一件家具，寻路自动绕开它，不必再改一张 FURN 表。 */
  const NAV_CELL = 40, NAV_PAD = 16
  const GRIDS = new WeakMap()

  window.roomGrid = function (room, force) {
    if (!force && GRIDS.has(room)) return GRIDS.get(room)
    const COLS = Math.ceil(room.w / NAV_CELL), ROWS = Math.ceil((room.extBand || room.h) / NAV_CELL)
    const G = new Uint8Array(COLS * ROWS)
    for (const p of room.plan || []) {
      const a = A[p[0]]
      if (!a || !a.foot || a.walkable) continue      // walkable:坐垫/门垫能踩，不是障碍
      const [ox, oy, fw, fh] = a.foot
      if (!fw || !fh) continue                       // 挂件/平铺件不占地
      const fx = p[1] + ox, fy = p[2] + oy
      const c0 = Math.max(0, ((fx - NAV_PAD) / NAV_CELL) | 0)
      const c1 = Math.min(COLS - 1, ((fx + fw + NAV_PAD) / NAV_CELL) | 0)
      const r0 = Math.max(0, ((fy - NAV_PAD) / NAV_CELL) | 0)
      const r1 = Math.min(ROWS - 1, ((fy + fh + NAV_PAD) / NAV_CELL) | 0)
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) G[r * COLS + c] = 1
    }
    const wallR = Math.floor((room.wallH || 0) / NAV_CELL)
    for (let r = 0; r < wallR; r++) for (let c = 0; c < COLS; c++) G[r * COLS + c] = 1
    const g = { G, COLS, ROWS, CELL: NAV_CELL }
    GRIDS.set(room, g)
    return g
  }

  window.gridPath = function (room, sx, sy, tx, ty) {
    const { G, COLS, ROWS, CELL } = window.roomGrid(room)
    const free = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !G[r * COLS + c]
    const near = (c, r) => {
      if (free(c, r)) return [c, r]
      for (let d = 1; d < 14; d++)
        for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
          if (Math.abs(dr) !== d && Math.abs(dc) !== d) continue
          if (free(c + dc, r + dr)) return [c + dc, r + dr]
        }
      return null
    }
    const s0 = near((sx / CELL) | 0, (sy / CELL) | 0)
    const t0 = near((tx / CELL) | 0, (ty / CELL) | 0)
    if (!s0 || !t0) return null
    const sI = s0[1] * COLS + s0[0], tI = t0[1] * COLS + t0[0]
    if (sI === tI) return []
    const prev = new Int32Array(COLS * ROWS).fill(-1)
    prev[sI] = sI
    const q = [sI]; let head = 0, found = false
    while (head < q.length) {
      const n = q[head++]
      if (n === tI) { found = true; break }
      const c = n % COLS, r = (n / COLS) | 0
      for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const c2 = c + dc, r2 = r + dr
        if (!free(c2, r2)) continue
        const i2 = r2 * COLS + c2
        if (prev[i2] !== -1) continue
        prev[i2] = n; q.push(i2)
      }
    }
    if (!found) return null
    const out = []
    for (let n = tI; n !== sI; n = prev[n]) out.push(n)
    out.reverse()
    // 只保留拐点 —— 直线段中间的格子不必逐格走
    const pts = []
    for (let i = 0; i < out.length; i++) {
      const c = out[i] % COLS, r = (out[i] / COLS) | 0
      if (i === 0 || i === out.length - 1) { pts.push([c, r]); continue }
      const p = out[i - 1], nx = out[i + 1]
      const dir1 = (out[i] - p), dir2 = (nx - out[i])
      if (dir1 !== dir2) pts.push([c, r])
    }
    return pts.map(([c, r]) => [c * CELL + CELL / 2, r * CELL + CELL / 2])
  }

  /* ── 2.6 走位姿态 ────────────────────────────────────────────
     「朝哪个方向走 → 用哪个姿态、要不要翻转」三间房各写过一份，逻辑一字不差，
     只有帧率移位不同。收编成一处：改走路手感只需改这里，不必两房各改一遍。

     侧向 sprite 规范为**默认朝右**（`baseFacing`），所以向左走才翻转。 */
  // 朝向判定 —— 走路、骑乘、将来任何「按行进方向取姿态」的东西都从这里取。
  // 抽出来是因为走路与飞行共用同一套朝向判定:两份判定必然漂移,而漂移的症状是
  // 「人朝左走，扫帚朝右飞」这种只有目视才发现的错位。
  // 侧向优先于纵向(斜着走时看侧面比看正面好认),阈值 6px 是死区,防抖。
  window.faceOf = function (dx, dy) {
    if (Math.abs(dx) > 6) return { face: 'side',  flip: dx < 0 }
    if (Math.abs(dy) > 6) return { face: dy > 0 ? 'front' : 'back', flip: false }
    return { face: 'idle', flip: false }
  }

  // 站姿微动:隔一阵眨一次眼、起伏一次呼吸。三房曾各写一份逐字相同的判断，收编。
  // 只在角色确有 blink/breath 姿态时生效（宠物没有，原样返回）。
  window.idlePose = function (self, pose, actorId) {
    if (pose !== 'stand') return pose
    const P = (ACTORS[actorId] && ACTORS[actorId].poses) || {}
    if ((self.frame % 88) < 5 && P.blink) return 'blink'
    if ((self.frame >> 4) % 2 && P.breath) return 'breath'
    return pose
  }

  // 水平踱步往返。两房各写一份，收编。self.paceDir 记方向，range=[x0,x1]。
  window.stepPace = function (self, range, speed) {
    self.x += (self.paceDir || 1) * speed
    if (self.x > range[1]) { self.x = range[1]; self.paceDir = -1 }
    if (self.x < range[0]) { self.x = range[0]; self.paceDir = 1 }
  }

  window.walkPose = function (self, opt) {
    opt = opt || {}
    const rate = opt.rate || 2                    // 帧移位:数字越大越慢
    const f = (self.frame >> rate)
    const d = window.faceOf(self.tx - self.x, self.ty - self.y)
    if (d.face === 'side')
      return { pose: ['walkside1', 'walkside2', 'walkside3', 'walkside2'][f % 4], flip: d.flip }
    if (d.face === 'front' || d.face === 'back') {
      const k = f % 2, b = d.face === 'front' ? 'walkfront' : 'walkback'
      return { pose: b + (k ? 1 : 2), flip: false }
    }
    return { pose: 'stand', flip: false }
  }



  /* ── 2.7 日程调度 ──────────────────────────────────────────────
     「选下一个行为 → 走过去 → 到位做事 → 计时」三间房各写一份，宠物再各写一份，
     一共六个函数做同一件事。改一条规则要改六处 —— `pick()` 那次我就改错了房间。

     收编成三支：选行为、起步、推进一步。房间只保留【它自己特有的】筛选条件
     （比如阿云要避开猫当前所在的锚点），用 opt.filter 传进来。 */

  // 选下一个行为。权重 a.w（缺省 1）；a.exclude 的不参与随机（按钮驱动的行为用它）
  window.pickAct = function (acts, current, opt) {
    opt = opt || {}
    const cid = current && current.id
    let pool = acts.filter(a => a.id !== cid && !a.exclude)
    if (opt.filter) {
      const narrowed = pool.filter(opt.filter)
      if (narrowed.length) pool = narrowed          // 筛没了就放宽，不能卡死
    }
    if (!pool.length) pool = acts.filter(a => a.id !== cid)
    if (!pool.length) return current
    const tot = pool.reduce((n, a) => n + (a.w || 1), 0)
    let r = Math.random() * tot
    for (const a of pool) { r -= (a.w || 1); if (r <= 0) return a }
    return pool[0]
  }

  // 起步:寻路到行为锚点。路径全程走网格，最后一段才是锚点本身
  window.startWalkTo = function (self, act, room, actorId, opt) {
    self.mode = 'walk'; self.act = act
    // 锚点语义有两种:主角的 act 坐标是 sprite 左上角(要加 foot 换成脚点)，
    // 宠物的 act 坐标【本身就是脚点】。后者传 { foot: [0,0] }，不要再偏移一次。
    const F = (opt && opt.foot) || (window.ACTORS[actorId] && window.ACTORS[actorId].foot) || [0, 0]
    const pts = window.gridPath(room, self.x + F[0], self.y + F[1], act.x + F[0], act.y + F[1])
    self.path = pts ? pts.map(p => [p[0] - F[0], p[1] - F[1]]) : []
    self.path.push([act.x, act.y])
    if (act.node) self.node = act.node
    const nx = self.path.shift() || [act.x, act.y]
    self.tx = nx[0]; self.ty = nx[1]
  }

  // 推进一步。返回 true 表示【本帧抵达终点】，由房间决定到位后做什么
  window.stepWalk = function (self, sp) {
    // 【轴优先】:先走完 x 再走 y —— 走出 L 形折线，而不是斜穿过去。
    // 各房原本都是这个行为，改成同时推进会让走位观感整个变掉。
    if (Math.abs(self.x - self.tx) > sp) { self.x += Math.sign(self.tx - self.x) * sp; return false }
    if (Math.abs(self.y - self.ty) > sp) { self.y += Math.sign(self.ty - self.y) * sp; return false }
    self.x = self.tx; self.y = self.ty
    if (self.path && self.path.length) {
      const nx = self.path.shift(); self.tx = nx[0]; self.ty = nx[1]
      return false
    }
    return true
  }

  // 直线飞行。stepWalk 的轴优先(先走完 x 再走 y)是【走路】的步法 ——
  // 骑扫帚的人不会先横着飘完再竖着飘。飞行走斜线，也不寻路:
  // 天上没有家具要绕，绕出来的 L 形折线反而暴露了「她其实在走」。
  /* 在一串落点之间【跳】—— 梅花桩、踏石过溪、屋顶跳跃都是这个动作。
     与 stepWalk / stepFly 的区别:不寻路、不匀速,而是一跳一落的循环 ——
     每跳沿直线插值,离地高度走正弦(起跳最低、中途最高、落点归零)。
     返回 { x, y, lift, phase, idx, landing }:
       lift  → 交给 placeActor 的 airborne(身子抬起、影子缩小,并压过地面家具)
       phase → 0..1 本跳进度,房间据此换姿态(腾空一个、落桩一个)
       landing → 刚落到点上的那一帧,可用来触发音效/台词 */
  window.stepHop = function (self, pts, t, o) {
    o = o || {}
    const period = o.period || 820, height = o.height || 44
    if (!self._hopPts || self._hopPts !== pts) { self._hopPts = pts; self._hopT0 = t }
    const k = (t - self._hopT0) / period
    const n = Math.floor(k), f = k - n
    const a = pts[n % pts.length], b = pts[(n + 1) % pts.length]
    const wasIdx = self._hopIdx
    self._hopIdx = n % pts.length
    return {
      x: a[0] + (b[0] - a[0]) * f,
      y: a[1] + (b[1] - a[1]) * f,
      lift: Math.sin(f * Math.PI) * height,
      phase: f, idx: n % pts.length,
      landing: wasIdx !== undefined && wasIdx !== (n % pts.length),
    }
  }

  window.stepFly = function (self, sp) {
    const dx = self.tx - self.x, dy = self.ty - self.y
    const d = Math.hypot(dx, dy)
    if (d <= sp) { self.x = self.tx; self.y = self.ty; return true }
    self.x += dx / d * sp; self.y += dy / d * sp
    return false
  }

  /* ── 2.75 表演态 ──────────────────────────────────────────────
     「玩家点一颗按钮 → 角色走过去做一件事 → 再点一次结束」，
     每间房唯一由玩家发起的行为。

     本套【以阿云那版为准】升成引擎标准 —— 三套实现里只有它是完整的:
       · performPending（玩家意图）与 performing（真的在演）分成两级
       · 伪 act `_cast` 带天荒地老的 dur:表演由玩家结束，不由计时器结束
       · 到位【那一帧】才开口 —— 走路途中不该有气泡
       · perform.props 在表演时把道具归位（起课要用的摆到桌上）
     桃桃那版是简化的，婆婆抄了桃桃再打补丁，于是「她自己跑了」「按钮说着
     与画面相反的话」「没台词」全都冒出来 —— 那些不是新 bug，是简化版缺的口子。

     房间只声明 room.perform，其余归引擎。 */
  window.setPerform = function (room, on) {
    if (!room || !room.perform) return
    room.performPending = !!on
    if (!on) {
      room.performing = false
      if (room.perform.stateKey) window.roomState(room, { [room.perform.stateKey]: false })
      if (room.perform.onLeave) room.perform.onLeave(room)
    }
  }

  // 按钮接线。房间声明了 button 就自动接上;接不上直接抛错 ——
  // 婆婆那颗按钮曾连 id 都没有，而七道门禁全绿
  window.wirePerform = function (room) {
    const P = room && room.perform
    const btn = P && P.button && document.getElementById(P.button)
    if (!btn) throw new Error('表演态找不到按钮: #' + (P && P.button))
    btn.addEventListener('click', () => window.setPerform(room, !room.performPending))
    return true
  }

  /* 房间状态机每帧调一次。helpers = { startWalk, pick }
     返回 true 表示此刻由表演态接管。 */
  window.stepPerform = function (room, self, t, helpers) {
    const P = room && room.perform
    if (!P) return false
    const onStage = !!(self.act && self.act.id === '_cast')

    // ① 玩家要看，而他还没在演出行为上 → 造伪 act 交给既有寻路，他【走】过去
    if (room.performPending && !onStage) {
      helpers.startWalk(Object.assign({ id: '_cast', dur: [99999, 99999], exclude: true }, P.actor))
      room.performing = false
    }

    // ② 到位那一帧才真正开演
    if (room.performPending && onStage && self.mode === 'act') {
      if (!room.performing) {
        room.performing = true
        P._lineIdx = 0; P._lineAt = 0
        if (P.stateKey) window.roomState(room, { [P.stateKey]: true })
        if (P.onArrive) P.onArrive(room, self, t)
      }
      // ③ 台词到位即说 + 全程轮播。日常那套「62% 概率咕哝一句」是给
      //    他自己走去做事时用的;玩家点了按钮，他必须开口
      if (P.lines && P.lines.length && t > (P._lineAt || 0)) {
        self.sayText = P.lines[P._lineIdx % P.lines.length]
        P._lineIdx++
        self.sayUntil = t + Math.min(4600, (P.lineGap || 4200) - 600)
        P._lineAt = t + (P.lineGap || 4200)
      }
    }

    // ④ 喊停 → 从原地回日程
    if (!room.performPending && onStage) {
      room.performing = false
      if (P.stateKey) window.roomState(room, { [P.stateKey]: false })
      helpers.startWalk(helpers.pick())
    }

    // ⑤ 按钮文案由【状态】决定，不由点了几下决定
    const btn = P.button && document.getElementById(P.button)
    if (btn && P.labels) {
      const want = room.performPending ? P.labels[1] : P.labels[0]
      if (btn.textContent !== want) btn.textContent = want
    }
    return onStage
  }

  /* ── 2.8 效果原语:火 · 烟 · 能量场 ────────────────────────────
     此前每件素材各画各的，于是灶上的火是「一个橙色矩形在上下缩放」，
     烟是「一个方块往上飘」。火和烟 36 间房都要用 —— 它们是引擎能力。

     三支都接受 (g, x, y, opt)，x,y 是【火焰根部 / 烟口】的位置。 */

  // 火焰。舌状分层:外焰暗红、中焰橙、内焰亮黄，各自以不同频率摇曳。
  // 关键不在颜色而在【形】:火是下宽上尖的舌头，逐行收窄，绝不是矩形。
  // ⚠ 高宽比至少 1.3:1 —— 宽大于高会摊成一个圆拱，读作火盆的余烬而不是在烧的火。
  window.fxFlame = function (g, x, y, opt) {
    opt = opt || {}
    const t = opt.t || 0, w = opt.w || 30, h = opt.h || 40
    const seed = opt.seed || 0, a = opt.alpha == null ? 1 : opt.alpha
    const LAYER = [
      { c: [255, 110, 30], sw: 1.00, sh: 1.00, f: 260, sway: 3.5, al: 0.55 },
      { c: [255, 176, 52], sw: 0.66, sh: 0.78, f: 190, sway: 2.4, al: 0.80 },
      { c: [255, 236, 170], sw: 0.34, sh: 0.50, f: 140, sway: 1.6, al: 0.95 },
    ]
    g.save()
    for (const L of LAYER) {
      const lw = w * L.sw, lh = h * L.sh * (0.88 + Math.sin(t / L.f + seed) * 0.12)
      g.fillStyle = `rgba(${L.c[0]},${L.c[1]},${L.c[2]},${(L.al * a).toFixed(3)})`
      const rows = Math.max(4, Math.round(lh / 3))
      for (let i = 0; i < rows; i++) {
        const f = i / rows                                  // 0 根部 → 1 尖端
        const taper = Math.pow(1 - f, 0.62)                 // 收窄曲线:根部饱满、尖端锐利
        const rw = lw * taper
        if (rw < 1) continue
        const drift = Math.sin(t / L.f + seed + f * 2.6) * L.sway * f
        g.fillRect(x - rw / 2 + drift, y - lh * f - lh / rows, rw, lh / rows + 1)
      }
    }
    // 断开的火星:从尖端飘走
    for (let k = 0; k < 3; k++) {
      const ph = ((t / 900) + k / 3 + seed) % 1
      g.fillStyle = `rgba(255,206,120,${(0.6 * (1 - ph) * a).toFixed(3)})`
      g.fillRect(x + Math.sin(t / 300 + k * 2) * (4 + ph * 9) - 1, y - h - ph * 26, 2, 2)
    }
    g.restore()
  }

  // 烟 / 蒸汽。团状上升:越高越大越淡，并随高度横向漂移。
  // 用【圆】不用方块 —— 方块升上去像纸片，圆才像气。
  window.fxSmoke = function (g, x, y, opt) {
    opt = opt || {}
    const t = opt.t || 0, n = opt.n || 4, rise = opt.rise || 80
    const r0 = opt.r || 5, spread = opt.spread || 12
    const c = opt.color || [232, 228, 218], a = opt.alpha == null ? 0.30 : opt.alpha
    const sp = opt.speed || 3000, seed = opt.seed || 0
    const blob = (bx, by, br, al) => {
      if (al <= 0.012 || br < 1) return
      g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${al.toFixed(3)})`
      for (let dy = -br; dy <= br; dy++) {
        const dx = Math.sqrt(br * br - dy * dy) | 0
        if (dx > 0) g.fillRect(bx - dx, by + dy, dx * 2, 1)
      }
    }
    g.save()
    for (let k = 0; k < n; k++) {
      const ph = ((t / sp) + k / n + seed) % 1
      const rr = r0 + ph * r0 * 2.6
      const al = a * (1 - ph) * (1 - ph)
      if (al <= 0.012) continue
      // 两个频率叠加的飘移 —— 单一正弦会走出整齐的蛇形，不像烟
      const px = x + (Math.sin(ph * 3.4 + k * 1.7 + seed) * 0.7 +
                      Math.sin(ph * 8.1 + k * 3.3 + seed) * 0.3) * spread * ph
      const py = y - ph * rise
      // 一团 = 三个错位的圆:主体 + 两个偏心的小块，越升越散
      blob(px, py, rr, al)
      const off = rr * (0.5 + ph * 0.8)
      blob(px + Math.cos(k * 2.2 + seed) * off, py + Math.sin(k * 1.9) * off * 0.5,
           rr * (0.62 - ph * 0.18), al * 0.72)
      blob(px + Math.cos(k * 4.1 + seed + 2) * off * 0.8, py - off * 0.4,
           rr * (0.5 - ph * 0.16), al * 0.55)
    }
    g.restore()
  }

  // 能量场。多层径向渐变叠加，【没有硬边】—— 边界由能量自己衰减出来，
  // 不是画一个圈。传送门那种「像镜子」的观感，一半来自它有一条清晰的轮廓线。
  window.fxAura = function (g, x, y, opt) {
    opt = opt || {}
    const t = opt.t || 0, rx = opt.rx || 80, ry = opt.ry || 140
    const c = opt.color || [186, 122, 246], a = opt.alpha == null ? 0.5 : opt.alpha
    const layers = opt.layers || 4
    g.save()
    for (let i = 0; i < layers; i++) {
      const f = i / layers
      const pulse = 0.82 + Math.sin(t / (620 + i * 190) + i) * 0.18
      const lx = rx * (0.5 + f * 0.72) * pulse, ly = ry * (0.5 + f * 0.72) * pulse
      const al = a * (1 - f) * 0.42
      const q = g.createRadialGradient(x, y, Math.max(1, lx * 0.15), x, y, Math.max(lx, ly))
      q.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${(al * 0.9).toFixed(3)})`)
      q.addColorStop(0.55, `rgba(${c[0]},${c[1]},${c[2]},${(al * 0.5).toFixed(3)})`)
      q.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`)
      g.save(); g.translate(x, y); g.scale(1, ly / lx); g.translate(-x, -y)
      g.fillStyle = q; g.fillRect(x - lx * 1.2, y - lx * 1.2, lx * 2.4, lx * 2.4)
      g.restore()
    }
    g.restore()
  }

  /* ── 3. 道具 ────────────────────────────────────────────────────
     可被角色作用的物件。返回与 placeActor 同形状的实体,进同一个
     排序空间 —— 狗因此能从球前面或后面经过,而不是永远压着球。
     坐标按【落点】给(与 placeActor 一致),不是左上角。 */
  window.placeProp = function (assetId, footX, footY, opt) {
    opt = opt || {}
    const a = window.ASSETS[assetId]
    if (!a) throw new Error('未知道具: ' + assetId)
    const inst = window.placeAsset(assetId, footX - a.w / 2, footY - a.h, opt)
    inst.actor = true                       // 与角色同为可动实体
    inst.baseY = footY
    inst.sortKey = footY + (opt.zBias || 0)
    inst.shadow = opt.attach ? null : { x: footX, y: footY, r: Math.max(10, a.w * 0.28) }
    return inst
  }

  /* ── 4. 关系 / 追逐 ─────────────────────────────────────────────
     一张声明表描述「选目标 → 移动过去 → 到达后做事」。
     「猫追毛线球」与「狗跟主人」只差 target.kind,引擎代码不动:

       { target:   { kind: 'prop',  id: 'ball' }        // 或 actor / spot
         approach: { offset: [70, 40], speed: 7 }
         onArrive: { pose: 'dbeg', hold: [3, 6], say: '汪♪', emote: 'heart' }
         then:     'scatter' }                          // 目标换位后继续追

     world 提供解目标用的位置:{ props:{id:{x,y}}, actors:{id:{x,y}} }。 */
  window.resolveTarget = function (spec, world) {
    const T = spec && spec.target
    if (!T) return null
    if (T.kind === 'spot')  return { x: T.x, y: T.y }
    if (T.kind === 'prop')  return (world.props  || {})[T.id] || null
    if (T.kind === 'actor') return (world.actors || {})[T.id] || null
    return null
  }

  // 推进一步。self 需带 {x,y,tx,ty,state,until};返回 'move' | 'arrive' | 'idle'
  // 调用方:桃桃房的金毛（每帧 stepPursuit(dog, dog.spec, ...)）。dog.spec 在 dogNextIdle 里
  // 球已转成 placeProp 道具,下一步应把那套状态机换成本函数,追球与跟随才真正
  // 由引擎表达。**这是明确的欠账,不是可选项。**
  window.stepPursuit = function (self, spec, world, t, clamp) {
    const tgt = window.resolveTarget(spec, world)
    if (!tgt) return 'idle'
    const off = (spec.approach && spec.approach.offset) || [0, 0]
    const sp  = (spec.approach && spec.approach.speed)  || 6
    let gx = tgt.x + off[0], gy = tgt.y + off[1]
    if (clamp) { gx = clamp.x(gx); gy = clamp.y(gy) }
    self.tx = gx; self.ty = gy
    const dx = gx - self.x, dy = gy - self.y
    if (Math.abs(dx) > sp) { self.x += Math.sign(dx) * sp; return 'move' }
    if (Math.abs(dy) > sp) { self.y += Math.sign(dy) * sp; return 'move' }
    self.x = gx; self.y = gy
    return 'arrive'
  }

  window.renderRoom = function (g, room, t, actors) {
    t = t || 0
    const W = room.w || 1440, H = room.h || 2560
    // ── L0 FLOOR:墙 + 地板 ──
    const P = room.palette || {}, hw = room.wallH || 450
    // 墙与地板来自【表面资源】,不同房间可换成石墙/帐篷/水泥地等
    const sfW = SURF[(room.surfaces && room.surfaces.wall) || 'wall_wood']
    const sfF = SURF[(room.surfaces && room.surfaces.floor) || 'floor_plank']
    let b0 = BAKE0.get(room)
    if (!b0) {
      b0 = document.createElement('canvas'); b0.width = W; b0.height = H
      const bg0 = b0.getContext('2d')
      if (sfW) sfW.draw(bg0, W, hw, P); else { bg0.fillStyle = P.wall || '#7e5e40'; bg0.fillRect(0, 0, W, hw) }
      if (sfF) sfF.draw(bg0, W, H, hw, P); else { bg0.fillStyle = P.floor || '#c9a26a'; bg0.fillRect(0, hw, W, H) }
      // 底部延伸带不再另铺板纹:地板由 surface 一路铺到画布底,
      // 保持同一种板宽,只靠 L7 的景深渐变压暗。
      BAKE0.set(room, b0)
    }
    g.drawImage(b0, 0, 0)
    // 底部延伸带:更密的板纹,视觉上把房间往观者方向延伸出画面


    // ── 实例化 ──
    // 表演态:perform.props 按 id 覆盖平时摆位(道具归到桌上摆正)
    const ov = {}
    if (room.performing && room.perform)
      for (const q of (room.perform.props || [])) ov[q[0]] = q
    const inst = []
    for (const p of room.plan) {
      const e2 = ov[p[0]] || p
      const vopt = e2[3] || p[3]
      const vname = variantFor(window.ASSETS[e2[0]], room, t)
      const vfin = vname ? Object.assign({}, vopt, { variant: vname }) : vopt
      try { inst.push(window.placeAsset(e2[0], e2[1], e2[2], Object.assign({ room: room }, vfin))) }
      catch (e) { console.warn('[room]', e.message) }
    }
    // 附着:把 sortKey 抬到宿主之上(抱枕躺在床上,应排在床之后)
    const byId = {}
    for (const o of inst) if (!byId[o.id]) byId[o.id] = o
    const resolveAttach = (o) => {
      if (!o.attach) return
      const host = byId[o.attach]
      if (host) o.sortKey = host.baseY + ((o.opt && o.opt.zBias) || 1)
    }
    for (const o of inst) resolveAttach(o)
    for (const a of (actors || [])) resolveAttach(a)
    // ── L1 DECAL:平铺物(地毯等,base=0 且不阻挡)──
    const decals = inst.filter(o => o.asset.cat === '地面')
    for (const o of decals) g.drawImage(o.cv, o.x, o.y)
    // ── L1.5 地面动效:毯子/法阵自带的 fx 在这里画 —— 它们贴地，
    //    要被压在其上的家具(桌子)正确遮住，否则金线会透过桌面像半透明。
    //    火/烟/能量场那类空中效果不在此列，留在 L6。
    for (const o of decals) if (o.asset.fx) { g.save(); o.asset.fx(g, t, o.x, o.y, o, room); g.restore() }
    // ── L2 墙面件 ──
    for (const o of inst) if (o.wall) g.drawImage(o.cv, o.x, o.y)
    // ── L3 SORT:家具与角色统一按【遮挡基准线】y-sort + 自动接触阴影 ──
    const pieces = inst.filter(o => !o.wall && o.asset.cat !== '地面')
    const aboveP = pieces.filter(o => o.asset.zLayer === 'above')
    const sortP  = pieces.filter(o => o.asset.zLayer !== 'above')

    // 遮挡层的两个哨兵值:飞行角色压住所有地面物、above 前景压住一切。
    const FLIGHT_LAYER = 1e9, ABOVE_LAYER = 2e9
    // ── 遮挡基准线 ──────────────────────────────────────────────
    // 规则（用户定）:角色在家具的【左·下·右】→ 角色遮家具;在家具【上方】
    // → 家具遮角色。几何表达:家具的排序线取它占地矩形的【顶边】,角色取脚点。
    //   角色脚点 > 家具顶边(在家具的下半区或两侧)→ 角色 key 更大 → 后画 → 遮家具
    //   角色脚点 < 家具顶边(真正绕到家具后面)→ 家具后画 → 遮角色
    // 从前用 low/high 二分 band + 底边 y-sort 来近似它,于是「人站矮柜右侧被柜挡」
    // 「人站桌下方仍被桌吞」都出过 —— 那是近似的裂缝,不是个别 bug。
    const sortLineOf = (o) => o.attach
      ? o.sortKey                          // 附着物保持贴着宿主
      : (o.foot[1] + (o.asset.occludeH != null ? 0 : 0))   // 家具:占地顶边
    const L3 = sortP.map(o => ({ k: sortLineOf(o), o, kind: 'piece' }))
    for (const a of (actors || [])) {
      // 飞行角色进【飞行层】:她高于所有地面家具,即使在家具后方(上方)也从其上方
      // 飞过,不被桌面陈设埋掉 —— 「上方被家具遮」是给站在地面的人用的,不给飞的人。
      // 飞行层内仍按脚点 y-sort(多个飞行体、飞行体与地面角色的前后),但整体压在
      // 地面家具之上、above 前景(2e9)之下。
      const k = a.airborne
        ? FLIGHT_LAYER + a.baseY
        : a.baseY + ((a.opt && a.opt.zBias) || 0)
      L3.push({ k, o: a, kind: 'actor' })
    }
    L3.sort((p, q) => (p.k - q.k) || ((p.kind === 'actor') - (q.kind === 'actor')))
    for (const o of aboveP) L3.push({ k: ABOVE_LAYER, o, kind: 'piece' })

    const ell = (cx, cy, rx, ry, col) => {
      g.fillStyle = col
      for (let dy = -ry; dy <= ry; dy++) {
        const dx = (rx * Math.sqrt(1 - (dy / ry) * (dy / ry))) | 0
        g.fillRect(cx - dx, cy + dy, dx * 2, 1)
      }
    }
    for (const it of L3) {
      const o = it.o
      if (it.kind === 'actor') {
        if (o.shadow) ell(o.shadow.x, o.shadow.y, o.shadow.r, 5, 'rgba(30,20,10,' + (o.shadow.alpha != null ? o.shadow.alpha : 0.26) + ')')
        g.drawImage(o.cv, o.x, o.y)
        // 矮家具遮角色时只遮下半身:家具排在角色前(顶边 < 角色脚点)、又矮
        // （声明 occludeH）、且角色脚点确实落在它进深内 —— 补画它的下缘一条,
        // 让角色露出上半身，而不是被一张矮桌整个吞掉。
        for (const q of sortP) {
          if (o.airborne) break                      // 飞行角色在家具上方,不被 occludeH 补遮
          if (q.asset.occludeH == null) continue
          if (sortLineOf(q) >= (o.baseY + ((o.opt && o.opt.zBias) || 0))) continue  // 家具在角色之后,不遮
          const f = q.foot
          if (o.baseY <= f[1] || o.baseY > f[1] + f[3] + 60) continue               // 角色不在它进深内
          const cut = Math.min(q.asset.occludeH, q.cv.height)
          const sy = q.cv.height - cut
          g.drawImage(q.cv, 0, sy, q.cv.width, cut, q.x, q.y + sy, q.cv.width, cut)
        }
      } else {
        const f = o.foot
        if (f[3] > 0 && !o.attach) ell(f[0] + f[2] / 2, f[1] + f[3] - 2, f[2] * 0.46, 5, 'rgba(30,20,10,0.22)')
        g.drawImage(o.cv, o.x, o.y)
      }
    }
    // ── L5 LIGHT:光源辉光(lighter 叠加)──
    g.save(); g.globalCompositeOperation = 'lighter'
    for (const o of inst) {
      if (!o.light) continue
      const L = o.light
      let a = 1
      if (L.flicker === 'screen') a = 0.75 + 0.25 * Math.sin(t / 90)
      else if (L.flicker) a = 1 - L.flicker * 0.35 * (0.5 + 0.5 * Math.sin(t / 160 + o.x))
      g.globalAlpha = a; g.fillStyle = radialCached(g, L.x, L.y, L.r, L.color + '55', L.color + '00')
      g.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2)
    }
    g.restore()
    // ── L6 FX:资源自带动效(烟汽 / 火苗 / 星芒 / 屏幕闪烁)+ 窗光尘埃 ──
    for (const o of inst) if (o.asset.fx && o.asset.cat !== '地面') { g.save(); o.asset.fx(g, t, o.x, o.y, o, room); g.restore() }
    // ── L6 FX:窗光尘埃 ──
    if (room.dust !== false) {
      g.fillStyle = 'rgba(255,240,200,0.18)'
      for (let n = 0; n < 26; n++) {
        const dx2 = 120 + ((n * 271) % 1180)
        const dy2 = 500 + ((n * 397 + ((t / 26) | 0)) % 1400)
        g.fillRect(dx2, dy2, 3, 3)
      }
    }
    // ── L7 GRADE:色彩分级(可按房间调性配置)──
    // 单一暖色 overlay 做不出玄冥的幽室、赛博的霓虹、伊莎的烛光,故参数化:
    //   preset 取预设,或直接给 tone/strength/vignette/lift 覆盖
    const GRADES = {
      warm:   { tone: '255,196,110', strength: 0.055, vignette: 0.30, lift: null },
      cold:   { tone: '150,190,230', strength: 0.075, vignette: 0.42, lift: null },
      candle: { tone: '255,168,72',  strength: 0.10,  vignette: 0.46, lift: '60,26,8' },
      neon:   { tone: '180,120,255', strength: 0.09,  vignette: 0.38, lift: '30,8,60' },
      dusk:   { tone: '255,150,110', strength: 0.08,  vignette: 0.36, lift: null },
      sterile:{ tone: '210,225,240', strength: 0.05,  vignette: 0.22, lift: null },
      // 阴天漫光(江南的潮)—— 沈砚房。要点在 vignette 极轻:
      // 阴天没有直射光,光是【平的、没有方向的】,压不出暗角来。
      // 色相走灰青而非冷蓝,才是梅雨的天光而不是月光。
      overcast:{ tone: '204,212,208', strength: 0.06, vignette: 0.14, lift: null },
      // 桃桃房:粉调收尾 —— 高位紧收的暗角 + 偏红的延伸带,
      // 几何与色相照搬原房间手写的 polish 段。
      peach:  { tone: '255,190,205', strength: 0.05,  vignette: 0.18, lift: null,
                vigColor: '60,20,30', vigColor0: '60,20,30', vigGeom: [720, 1010, 760, 720, 1080, 1560],
                extColor: '60,40,40', extAlpha: 0.2, gradeH: 2160, vigFirst: true },
    }
    const gd = Object.assign({}, GRADES[room.gradePreset || 'warm'] || GRADES.warm, room.gradeOverride || {})
    // tone/vignette/ext 的几何与色相可由预设覆盖 —— 不同房间的收尾光
    // 差别很大(桃桃房是高位紧收的粉调,阿云房是居中缓收的暖调),
    // 只给强度是不够的。未声明时全部落回原默认值。
    const gh = gd.gradeH || H
    if (gd.lift) { g.fillStyle = 'rgba(' + gd.lift + ',0.10)'; g.fillRect(0, 0, W, gh) }
    g.fillStyle = room.grade || ('rgba(' + gd.tone + ',' + gd.strength + ')'); g.fillRect(0, 0, W, gh)
    const drawVig = () => {
      const vgm = gd.vigGeom || [W / 2, H / 2, H * 0.30, W / 2, H / 2, H * 0.72]
      const vgc = gd.vigColor || '20,10,4'
      const vg = g.createRadialGradient(vgm[0], vgm[1], vgm[2], vgm[3], vgm[4], vgm[5])
      // 两个端点的色相要分开给:canvas 的渐变对 RGB 与 A 分别插值,
      // 起点写 rgba(0,0,0,0) 与写 rgba(20,10,4,0) 中间色并不一样。
      // 默认起点保持纯黑 —— 既有房间就是这么烘出来的。
      vg.addColorStop(0, 'rgba(' + (gd.vigColor0 || '0,0,0') + ',0)')
      vg.addColorStop(1, 'rgba(' + vgc + ',' + gd.vignette + ')')
      g.fillStyle = vg; g.fillRect(0, 0, W, gh)
    }
    const drawExt = () => {
      if (!room.extBand) return
      const ec = gd.extColor || '30,18,8', ea = gd.extAlpha === undefined ? 0.24 : gd.extAlpha
      const eg = g.createLinearGradient(0, room.extBand, 0, H)
      eg.addColorStop(0, 'rgba(' + ec + ',0)'); eg.addColorStop(1, 'rgba(' + ec + ',' + ea + ')')
      g.fillStyle = eg; g.fillRect(0, room.extBand, W, H - room.extBand)
    }
    // 默认顺序:延伸带压暗在前、暗角在后(既有房间依赖它,不能改)。
    if (gd.vigFirst) { drawVig(); drawExt() } else { drawExt(); drawVig() }
    return inst
  }
})()
