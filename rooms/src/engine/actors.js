  /* ══════════════════════════════════════════════════════════════
     角色资源 ACTORS —— 角色与家具同为可排序实体,统一进 L3
     正统做法:角色不是「画在最上层的一层」,而是按脚点参与 y-sort,
     因此绕到柜后会被遮挡、走到桌前会盖住桌子,与家具一视同仁。
     ══════════════════════════════════════════════════════════════ */
  const ACTORS = {}
  globalThis.ACTORS = ACTORS
  /* 把 `fn(现值)` 的结果装回 spec 的某个字段上。
     字段是普通值就地换掉;是【getter】就把合并推迟到读的时候。

     为什么需要推迟:大部分角色的 poses / palette 是 getter,引用房间脚本的
     globalThis.XXX_POSES / XXX_PALETTE。设计页里房间脚本先跑,定义时就地合并
     没问题;但引擎作为库单独发出去时(小程序)顺序是反的 —— 引擎先加载,那时
     getter 返回的是 `|| {}` 那个一次性空对象,规范的图与色合进去就丢了,
     而且【不报错】:人照样能走,只是缺了规范那几帧、色板空了一片,
     `actorSprite` 静默回退到 stand、`palette[ch] || ch` 拿字符当颜色用。
     这种坏法只在真机上看得见,所以从根上去掉。 */
  function deferredMerge(spec, key, fn) {
    const own = Object.getOwnPropertyDescriptor(spec, key)
    if (!own || !own.get) { spec[key] = fn(spec[key]); return }
    let cacheFrom = null, cacheTo = null
    Object.defineProperty(spec, key, {
      configurable: true,
      get() {
        const base = own.get.call(this)
        // 按房间那张表的**身份**缓存:表没换过就不重合一遍
        if (base !== cacheFrom) { cacheFrom = base; cacheTo = fn(base) }
        return cacheTo
      },
    })
  }

  globalThis.defineActor = function (id, spec) {
    spec.id = id; ACTORS[id] = spec
    // codex: 从设计规范 B0 取四向两帧，合并进这个角色的姿态表。
    // 必须在【引擎侧】做：房间脚本先于引擎执行，在那里调 codexPoses
    // 拿到的是 undefined，而 `X && X()` 会把这件事静默跳过 —— 姿态照旧
    // 是房间自画的那套，页面不报错，看起来完全正常。
    if (spec.codex) {
      const CX = globalThis.codexPoses(spec.codex)
      if (!CX) throw new Error('规范里没有这个角色的图： ' + spec.codex)
      // 移动姿态:规范说了算,直接覆盖(单一数据源)。
      // 站姿(stand*):【只填空,不覆盖】—— 规范的四向图是【行进中】的样子,
      // 婆婆那套里扫帚就画在身上,而她停下来搅锅织毛衣时不该还扛着。
      // 房间自画了站姿就用房间的;没画才拿规范的顶上(新房因此不必抄那段补齐样板)。
      const merge = (base) => {
        const out = Object.assign({}, base)
        for (const k in CX.poses) {
          if (/^stand/.test(k) && out[k] && out[k].length) continue
          out[k] = CX.poses[k]
        }
        return out
      }
      deferredMerge(spec, 'poses', merge)
      deferredMerge(spec, 'palette', (base) => Object.assign({}, base, CX.palette))
    }
  }

  /* ── 2.5b 规范姿态 ────────────────────────────────────────────
     角色的四向两帧在设计规范 B0 里【已经画好】(FRONT/SIDE/BACK 帧一，
     WALK 帧二)，40 个角色全都有。房间不该再画第二套 —— 画了就有两个
     数据源，而规范那句「此表为单一数据源」就成了一句空话。

     婆婆是现成的例子：她的三向图本来就骑着扫帚(side 左侧那片 yYYy 是
     刷毛、NN 是杆)。我曾照着「她需要一个载具」另建了一整套合成系统，
     而规范早把扫帚画进姿态里了。规范先读，再动手。 */
  /* 取出图鉴卡用的那张正面(CSS 精灵 .spr-<id> 的 ::after box-shadow)。
     规范的正面有【两个来源】,只查一个就会以为「规范没画正面」:
       ① FRONT_OVR —— 四向行走图的正面,一部分角色有
       ② 这里读的 CSS 精灵 —— 图鉴卡用的头像,40 个角色全有
     沈砚在 ① 里没有、在 ② 里有。我只 grep 了 ① 就自己画了一套,
     画出来腮红成了嘴、眼睛用了纯黑,跟图鉴里的他是两个人。
     ⚠ 但 ② 是【头像】不是行走图(13 列、偏瘦),不能直接当 stand/walkfront ——
     房间自画正面时照着它的【画法】,尺寸仍照 standback。 */
  globalThis.codexFront = function (id) {
    if (typeof document === 'undefined') return null
    const el = document.createElement('div')
    el.className = 'spr spr-' + id
    el.style.cssText = 'position:absolute;left:-9999px;top:0'
    document.body.appendChild(el)
    const cs = getComputedStyle(el, '::after'), bs = cs.boxShadow, unit = parseInt(cs.width) || 3
    document.body.removeChild(el)
    if (!bs || bs === 'none') return null
    const re = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)\s+(-?\d+)px\s+(-?\d+)px/g
    let m; const cells = []; let mx = 0, my = 0
    while ((m = re.exec(bs))) {
      const x = Math.round(m[4] / unit), y = Math.round(m[5] / unit)
      const hex = '#' + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, '0')).join('')
      cells.push([x, y, hex]); if (x > mx) mx = x; if (y > my) my = y
    }
    if (!cells.length) return null
    const grid = Array.from({ length: my + 1 }, () => Array(mx + 1).fill(null))
    for (const [x, y, c] of cells) grid[y][x] = c
    // 颜色 → 单字符键。用 §¤ 这类不会与既有键撞的字符,免得盖掉角色自己的调色板
    const KEYS = '¡¢£¤¥¦§¨©ª«¬'
    const pal = {}, seen = {}
    let n = 0
    const rows = grid.map(r => r.map(c => {
      if (!c) return '.'
      if (!(c in seen)) { seen[c] = KEYS[n] || c; pal[seen[c]] = c; n++ }
      return seen[c]
    }).join(''))
    return { rows, pal }
  }

  globalThis.codexPoses = function (id) {
    const C = globalThis.CODEX; if (!C) return null
    const pick = (S) => (S && S[id]) || null
    /* 正面【只认 FRONT_OVR】。CSS 精灵那一路(globalThis.codexFront)不接进来 ——
       它是【图鉴卡的头像】:13 列、比例偏瘦,与四向行走图不是同一套资产。
       接进来当 walkfront1,人走起来就一帧胖一帧瘦。
       它仍然有用:房间自画正面时【照着它的画法】(五官怎么摆、腮红在哪),
       但尺寸得照 standback。查询用 globalThis.codexFront(id)。 */
    const f = pick(C.FRONT)
    const sd = pick(C.SIDE), bk = pick(C.BACK), w = (C.WALK || {})[id] || {}
    if (!f && !sd && !bk) return null
    const palette = {}, poses = {}
    const take = (o, names) => {
      if (!o) return
      Object.assign(palette, o.pal || {})
      for (const n of names) poses[n] = o.rows
    }
    // 只覆盖【移动】姿态。规范的四向图是行进中的样子 —— 婆婆那套里
    // 扫帚就画在身上，她停下来搅锅织毛衣时不该还扛着。站姿留给房间自己。
    // 规范的四向图【本身就是站着的样子】,所以它同时就是 standside / standback ——
    // 从前每间房都在 loop 首帧自己补一句 `POSES.standside = POSES.walkside1`,
    // 新房不写就被 poselint 判缺四向。这段样板收进引擎,房间不必再抄。
    // (注意与「帧二兜底」区分:`walkside2 = walkside1` 是【错的】,它抹掉真帧二导致滑行;
    //  `standside = walkside1` 是【对的】,走路循环的站姿帧就是站立侧面。)
    take(f,  ['walkfront1'])
    take(sd, ['walkside1', 'walkside3', 'standside'])
    take(bk, ['walkback1', 'standback'])
    // 帧二：规范给了就用规范的；没给的角色由图鉴自己的 stepGrid 生成，不在这里造
    take(w.front, ['walkfront2'])
    take(w.side,  ['walkside2'])
    take(w.back,  ['walkback2'])
    return { poses, palette }
  }


  const ACT_CACHE = {}

  defineActor('ayun', {
    name: '阿云', scale: 8, foot: [40, 114],   // foot = sprite 内脚点偏移(1440 系)
    anchors: { hand: [40, 82] },               // 手柄线 / 牵绳的起点
    palette: {K: '#3a2c20', F: '#f0c8a0', E: '#3d6a34', H: '#4a3a2c', j: '#a8845a', P: '#e87a90', b: '#4c6a8c', x: '#4a3626',
    B: '#5a7a96', Y: '#ffd76a', W: '#f6efdc', Z: '#9a938a',
    O: '#e89040', C: '#c87028',},
    // 【引用】房间的 POSES,不再拷贝一份快照:新增姿态只需在 pdef 处写一次
    get poses() { return globalThis.AYUN_POSES || {} }
  })

  defineActor('cat', {
    // scale 与阿云一致(8):像素颗粒必须同大,否则两者不像一个世界里的东西。
    // 猫因此长约 96px —— 接近真猫与人的实际比例。
    name: '猫', scale: 8, footMode: 'bottom', foot: [48, 120],
    palette: ACTORS.ayun.palette,          // 共用调色板
    // 同样引用而非拷贝;只挑出猫用得到的几个姿态
    get poses() {
      const P = globalThis.AYUN_POSES || {}
      return { csleep: P.csleep, csit: P.csit, cwalk1: P.cwalk1, cwalk2: P.cwalk2, cstretch: P.cstretch }
    }
  })

  /* ── 桃桃房的三个角色 ──────────────────────────────────────────
     桃桃的 33 个姿态原本只有 pdef,没有 actor 资源,也不走 placeActor:
     资源化做了一半,房间自己拿 drawPose 画,scale 当参数传。
     三个角色都在这里声明,姿态一律 getter 引用 globalThis.TAO_POSES。 */
  defineActor('tao', {
    name: '桃桃', scale: 8, foot: [40, 106],
    // beside = 别人来她身边站的位置
    anchors: { beside: [70, 40] },
    get palette() { return globalThis.TAO_PALETTE || {} },
    get poses() { return globalThis.TAO_POSES || {} }
  })

  // 金毛与兔子按 sprite 底边中心落地:两者的坐/趴/跳姿高度不一,
  // 固定 foot 必然让其中一个悬空或陷进地里(与猫同理)。
  defineActor('dog', {
    name: '金毛', scale: 8, footMode: 'bottom',
    get palette() { return globalThis.TAO_PALETTE || {} },
    get poses() {
      const P = globalThis.TAO_POSES || {}
      return { dsit: P.dsit, dsitC: P.dsitC, dsit2: P.dsit2,
               ddn1: P.ddn1, ddn2: P.ddn2, dup1: P.dup1, dupC: P.dupC, dup2: P.dup2,
               dsw1: P.dsw1, dsw2: P.dsw2, dbeg: P.dbeg }
    }
  })

  // 球:金毛的玩具。现在是精灵实体,下一步升格为可交互道具素材。

  defineActor('rabbit', {
    name: '兔子', scale: 8, footMode: 'bottom',
    get palette() { return globalThis.TAO_PALETTE || {} },
    get poses() {
      const P = globalThis.TAO_POSES || {}
      return { rsit: P.rsit, rhop1: P.rhop1, rsleep: P.rsleep }
    }
  })

  /* ── 婆婆房的四个角色 ──────────────────────────────────────────
     角色必须在【引擎这一层】声明:房间脚本跑在引擎装载之前,
     在那里调 defineActor 拿到的是 undefined,姿态一个都注册不上
     （verify 报「未知角色: popopet」就是这么来的）。
     姿态一律 getter 引用 globalThis.POPO_POSES,不拷贝快照。 */
    defineActor('popo', {
    name: '婆婆', scale: 8, foot: [56, 128], codex: 'popo',
    anchors: { hand: [56, 92] },
    get palette() { return globalThis.POPO_PALETTE || {} },
    get poses() { return globalThis.POPO_POSES || {} }
  })
  defineActor('popocat', {
    name: '黑猫', scale: 8, footMode: 'bottom',
    get palette() { return globalThis.POPO_PALETTE || {} },
    get poses() { const P = globalThis.POPO_POSES || {}; return { bcat: P.bcat, bcatsleep: P.bcatsleep } }
  })
  defineActor('popoowl', {
    name: '猫头鹰', scale: 8, footMode: 'bottom',
    get palette() { return globalThis.POPO_PALETTE || {} },
    get poses() { const P = globalThis.POPO_POSES || {}; return { owl1: P.owl1, owl2: P.owl2 } }
  })
  defineActor('popopet', {
    name: '小家伙', scale: 8, footMode: 'bottom',
    get palette() { return globalThis.POPO_PALETTE || {} },
    get poses() {
      const P = globalThis.POPO_POSES || {}
      return { hedge: P.hedge, turt: P.turt, pcat: P.pcat, pdog: P.pdog, pbun: P.pbun, pbear: P.pbear }
    }
  })

  defineActor('tenz', {
    name: '丹增', scale: 8, foot: [48, 116], codex: 'tenz',
    get palette() { return globalThis.TENZ_PALETTE || {} },
    get poses() { return globalThis.TENZ_POSES || {} }
  })

  // 沈砚:侧 / 背 / 走路帧二由规范供给(codex),正面与功能姿态是房间自画的。
  // codex 只覆盖【移动】姿态,stand* 只填空不覆盖 —— 他的正面必须自己画,
  // 规范里 40 个角色只有一部分有 FRONT,castlint 会把缺的标出来。
  defineActor('shenyan', {
    name: '沈砚', scale: 8, foot: [44, 126], codex: 'shenyan',
    anchors: { hand: [44, 88] },
    get palette() { return globalThis.SHENYAN_PALETTE || {} },
    get poses() { return globalThis.SHENYAN_POSES || {} }
  })

  /* 沈砚养的三只。前四房的宠物一律是【角色】—— 有姿态表、有行为表、
     走引擎寻路,会在屋里到处跑(阿云的猫、桃桃的金毛与兔子、婆婆的黑猫猫头鹰小家伙)。
     我一度把它们做成了带 variant 的【摆件】,那是脱离四房积累自己发明的一套,
     结果就是三只钉在原地的猫。
     footMode:'bottom' —— 猫的坐/卧/走高度不一,固定 foot 必然让其中一个悬空或陷地。
     姿态:狸花与小猫复用阿云那套(骨架通用),大橘另有一套(它得大一圈)。 */
  defineActor('sycat_orange', {
    name: '大橘', scale: 8, footMode: 'bottom',
    palette: { K: '#3a2c20', O: '#d99a4e', C: '#b87a34', E: '#3d6a34', P: '#c88070', W: '#f0d3a8' },
    get poses() {
      const P = globalThis.SHENYAN_CATPOSES || {}
      return { csit: P.gsit, csleep: P.gsleep, cwalk1: P.gwalk1, cwalk2: P.gwalk2, cstretch: P.gstretch }
    }
  })
  defineActor('sycat_tabby', {
    name: '狸花', scale: 8, footMode: 'bottom',
    palette: { K: '#3a2f28', O: '#8a7a68', C: '#5d5145', E: '#6a6a3a', P: '#9a7f75', W: '#c6bba9' },
    get poses() { return globalThis.SHENYAN_CATPOSES || {} }
  })
  defineActor('sycat_kitten', {
    name: '小猫', scale: 8, footMode: 'bottom',
    palette: { K: '#2a261f', O: '#d9cfbe', C: '#3a352e', E: '#5a7a8c', P: '#d09b93', W: '#efe8da' },
    get poses() { return globalThis.SHENYAN_CATPOSES || {} }
  })

  /* 白鹭。侧/背/走路帧二由规范 codex 供给;正面与功能姿态房间画,
     正面照 CSS 精灵的画法、尺寸对齐 standback(codexFront 只作参照,不当行走图)。 */
  defineActor('bailu', {
    name: '白鹭', scale: 8, foot: [44, 122], codex: 'bailu',
    anchors: { hand: [44, 84] },
    get palette() { return globalThis.BAILU_PALETTE || {} },
    get poses() { return globalThis.BAILU_POSES || {} }
  })

  // 光栅化某个姿态 → sprite(带缓存)
  globalThis.actorSprite = function (id, pose, flip) {
    const a = ACTORS[id]; if (!a) throw new Error('未知角色： ' + id)
    const rows = a.poses[pose] || a.poses.stand || a.poses[Object.keys(a.poses)[0]]
    // 【基准朝向】房间给的 flip 一律表示「是否朝向行进反方向」,与素材本身
    // 画的是哪一边无关。素材规范是侧向一律朝右;个别无法重画的来源可以声明
    // baseFacing:'left',由引擎补一次镜像,而不是逼房间去记哪个角色是反的。
    // 朝向发散过一次:金毛基准朝左但 flip 规则按朝右写,走路方向就是反的。
    if ((a.baseFacing || 'right') === 'left') flip = !flip
    const key = id + '|' + pose + '|' + (flip ? 1 : 0)
    let cv = ACT_CACHE[key]
    if (cv) return cv
    const SC = a.scale, w = rows[0].length * SC, h = rows.length * SC
    cv = HOST.createCanvas(w, h)
    const c = cv.getContext('2d')
    if (flip) { c.translate(w, 0); c.scale(-1, 1) }
    for (let r = 0; r < rows.length; r++)
      for (let q = 0; q < rows[r].length; q++) {
        const ch = rows[r][q]
        if (ch === '.' || ch === ' ') continue
        c.fillStyle = a.palette[ch] || ch
        c.fillRect(q * SC, r * SC, SC, SC)
      }
    ACT_CACHE[key] = cv
    return cv
  }

  // 生成可排序实体:footX/footY 是【脚点】,直接作为 sortKey
  globalThis.placeActor = function (id, footX, footY, pose, flip, opt) {
    const a = ACTORS[id], cv = globalThis.actorSprite(id, pose, flip)
    // 落地点:固定 foot 只在所有姿态同尺寸时才成立。猫的坐姿 12×15、睡姿 14×7,
    // 用一个固定 foot 必然让其中一个悬空或陷进地里。footMode 'bottom' 改成按
    // sprite 自身的底边中心落地,姿态尺寸怎么变都对,换 scale 也不用重算。
    opt = opt || {}
    const fx = a.footMode === 'bottom' ? cv.width / 2 : a.foot[0]
    const fy = a.footMode === 'bottom' ? cv.height    : a.foot[1]
    // airborne = 离地高度(像素)。飞行角色的身体抬到空中,脚点仍是地面投影
    // (影子落地、排序知道她在平面的哪) —— 但【遮挡】走飞行层,见 renderRoom L3。
    const lift = opt.airborne || 0
    const x = footX - fx, y = footY - fy - lift
    return {
      actor: true, id, x, y, cv, baseY: footY,
      sortKey: footY + (opt.zBias || 0),
      airborne: lift,
      // 角色同样需要附着:躺在床上 / 坐在蒲团上时,应随宿主排序而非自己的脚点,
      // 否则会被它正躺着的那件家具挡住。
      attach: opt.attach || null, opt,
      // 飞起来影子淡而小 —— 离地全靠影子说明。落地(lift=0)照常。
      shadow: opt.attach ? null
            : { x: footX, y: footY, r: (pose === 'sleep' ? 50 : 30) * (lift ? 0.62 : 1),
                alpha: lift ? Math.max(0.10, 0.22 - lift * 0.0012) : 0.26 },
    }
  }



