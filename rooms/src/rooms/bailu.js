
// ══ B3h 白鹭家 · 观舍 —— S4 骨架(墙地 + 光 + 四件定调大件,还是空房)══
;(function () {
  /* 这支脚本【不碰浏览器】。取画布、驱动帧是宿主的事,在文件末尾单独一段:
     设计页那段用 document + requestAnimationFrame,小程序那边用它自己的。
     中间这一大段(姿态、表演、房间、每帧算什么)两边共用,一个字不改。 */

  /* ── 姿态 ─────────────────────────────────────────────────────
     侧/背/走路帧二在规范 B0 里有,codexPoses 引入。正面【规范只有图鉴 CSS 精灵】,
     它是头像(偏瘦),不能直接当行走图 —— 照它的画法(发髻、道袍、青绿束带),
     但尺寸【逐行照 standback 对齐】。功能姿态(排盘/记录/浇水/擦拭)房间自画。
     调色板沿用规范:K描边 H发 F肤 E目 r唇 W素袍 w袍暗边 D青绿束带。房间另补:B书/纸。 */
  const BP = { B: '#e8e4d6', e: '#2a5a6a' }   // e:图鉴正面的青绿眼
  const POSES = {}
  globalThis.BAILU_POSES = POSES
  globalThis.BAILU_PALETTE = BP
  function pdef(name, s) { POSES[name] = s.trim().split('\n').map(r => r.trimEnd()) }

  // 正面 —— 逐行同宽于 BACK_OVR.bailu(头 1-9 行照抄结构,身体 10-16 行同宽),
  // 五官照 CSS 精灵:低眉、素净。道袍前襟一道青绿束带(D)
  pdef('stand', `
..............
.......KDDK...
......KKDDKK..
.....KHHDDHHK.
.....KHHHHHHK.
.....KHFFFFHK.
.....KFeFFeFK.
.....KFFFFFFK.
.....KFrFFrFK.
......KFFFFK..
......KKKKKK..
......KWWWWK..
.....KDWWWWDK.
.....KWKKKKWK.
.....KDDDDDDK.
....KWWWWWWWWK`)

  pdef('blink', `
..............
.......KDDK...
......KKDDKK..
.....KHHDDHHK.
.....KHHHHHHK.
.....KHFFFFHK.
.....KFFFFFFK.
.....KFFFFFFK.
.....KFrFFrFK.
......KFFFFK..
......KKKKKK..
......KWWWWK..
.....KDWWWWDK.
.....KWKKKKWK.
.....KDDDDDDK.
....KWWWWWWWWK`)

  // 呼吸:整体沉一格(顶空一行、去掉腰带下一行)
  pdef('breath', `
..............
.......KDDK...
......KKDDKK..
.....KHHDDHHK.
.....KHHHHHHK.
.....KHFFFFHK.
.....KFeFFeFK.
.....KFFFFFFK.
.....KFrFFrFK.
......KFFFFK..
......KKKKKK..
......KWWWWK..
.....KWKKKKWK.
.....KDDDDDDK.
....KWWWWWWWWK`)

  // 正面走路:帧一=站姿(站-迈循环),帧二只改末行(两腿并拢居中)
  pdef('walkfront1', POSES.stand.join('\n'))
  pdef('walkfront2', `
..............
.......KDDK...
......KKDDKK..
.....KHHDDHHK.
.....KHHHHHHK.
.....KHFFFFHK.
.....KFeFFeFK.
.....KFFFFFFK.
.....KFrFFrFK.
......KFFFFK..
......KKKKKK..
......KWWWWK..
.....KDWWWWDK.
.....KWKKKKWK.
.....KDDDDDDK.
.....KWWWWK...`)

  // 跪坐排盘:去掉肩线那一行,头直接接袍(沈砚同法)
  pdef('sit', `
..............
.......KDDK...
......KKDDKK..
.....KHHDDHHK.
.....KHHHHHHK.
.....KHFFFFHK.
.....KFeFFeFK.
.....KFFFFFFK.
.....KFrFFrFK.
......KFFFFK..
......KKKKKK..
.....KWWWWK...
....KWWWWWWK..
....KDDDDDDK..
...KWWWWWWWWK.`)

  // 排盘:侧向,右手执笔垂在盘上。帧二笔落一格
  pdef('divine1', `
...KHK.....
..KHHHK....
..KKKKK....
..KHHHHHK..
.KHHHHFFFK.
.KHHHFFFFK.
.KHHHFEFFK.
.KHHFFFFrK.
..KHFFFFK..
...KKKKK...
...KWDWKF..
..KWWDWWKB.
..KWWWWWK..
..KWWWWWK..
..KwWWWwK..
...KK.KK...`)

  pdef('divine2', `
...KHK.....
..KHHHK....
..KKKKK....
..KHHHHHK..
.KHHHHFFFK.
.KHHHFFFFK.
.KHHHFEFFK.
.KHHFFFFrK.
..KHFFFFK..
...KKKKK...
...KWDWK...
..KWWDWWKF.
..KWWWWWKB.
..KWWWWWK..
..KwWWWwK..
...KK.KK...`)

  // 记录:低头写,册子在膝前(捧读同结构,道袍展开)
  pdef('write', `
.......KDDK...
......KKDDKK..
.....KHHDDHHK.
.....KHHHHHHK.
.....KHFFFFHK.
.....KFeFFeFK.
.....KFFFFFFK.
.....KFrFFrFK.
......KKKKKK..
.....KWWWWWWK.
....KWDDDDDWK.
...KFWWWKWWKF
...KFWWWKWWKF
....KWWWWWWK..
.....KKKKKK...`)

  // 擦拭:侧身,手臂前伸(擦盘/擦布)
  pdef('wipe1', `
...KHK.....
..KHHHK....
..KKKKK....
..KHHHHHK..
.KHHHHFFFK.
.KHHHFFFFK.
.KHHHFEFFKF
.KHHFFFFrFB
..KHFFFFK..
...KKKKK...
...KWDWK...
..KWWDWWK..
..KWWWWWK..
..KwWWWwK..
...KK.KK...`)

  pdef('wipe2', `
...KHK.....
..KHHHK....
..KKKKK....
..KHHHHHK..
.KHHHHFFFKF
.KHHHFFFFFB
.KHHHFEFFK.
.KHHFFFFrK.
..KHFFFFK..
...KKKKK...
...KWDWK...
..KWWDWWK..
..KWWWWWK..
..KwWWWwK..
...KK.KK...`)

  // 凝视:抬头看星图,下巴微扬
  pdef('gaze', `
.......KDDK...
......KKDDKK..
.....KHHDDHHK.
.....KHHHHHHK.
.....KHHFFFFK.
.....KHFeFFeK.
.....KHFFFrFK.
......KKKKKK..
......KWWWWK..
.....KWWWWWWK.
.....KDDDDDDK.
.....KWWWWWWK.
.....KwWWWWwK.
......KK..KK..`)

  // 睡:侧躺榻上,横过来
  pdef('sleep', `
............
............
............
............
............
...KKKKK....
..KHHHHHK...
.KHFFFFKKKK.
.KHFEEFWWWK.
.KHFFrFWWWK.
..KKKKKDWWK.
....WW.WWWK.
....WW.KKKK.
............`)

  globalThis.BAILU_ROOM = {
    w: 1440, h: 2560, wallH: 440,
    // 素墙 + 石板地都是现成的表面资源,直接引入(铁律一:先引入,再新建)。
    // floor_stone 原先石板四色写死,已就地参数化 —— 改一处,所有房间受益。
    surfaces: { wall: 'wall_plaster', floor: 'floor_stone' },
    /* 「干净得没有人味」:墙是素白偏冷,地是青灰石板,缝比原版深。
       gradePreset 用现成的 sterile(tone 210,225,240 · vignette 0.22)——
       名字和立意直接对上,不必新造一个。 */
    palette: {
      wall: '#e6e8e5', wallLine: '#d8dbd7', skirt: '#4a4e52',
      floor: '#8e948f',
      slabs: ['#969c96', '#8e948f', '#9ea49d', '#8a908b'],
      slabSeam: 'rgba(34,40,38,0.26)',
    },
    gradePreset: 'sterile', state: {},
    plan: [
      // S4 只放定调的四件 —— 骨架阶段不填内容
      ['bailu_window_north', 88, 84],      // 唯一的光,朝北,冷
      ['bailu_desk_chart', 396, 520],      // 本业:排盘,占北窗下最好的光
      ['bailu_dial_star', 470, 556, { attach: 'bailu_desk_chart', zBias: 3 }],
      ['bailu_dial_shi', 664, 570, { attach: 'bailu_desk_chart', zBias: 3 }],
      ['bailu_paper_charts', 820, 566, { attach: 'bailu_desk_chart', zBias: 3 }],
      ['bailu_tools_align', 410, 690, { attach: 'bailu_desk_chart', zBias: 4 }],
      ['bailu_ruler_jade', 600, 700, { attach: 'bailu_desk_chart', zBias: 4 }],
      ['bailu_almanac', 960, 470],
      ['bailu_table_ledger', 960, 660],
      ['bailu_scroll_star', 424, 100],
      ['bailu_chart_28', 596, 88],
      ['bailu_scroll_star2', 372, 800],
      ['bailu_compass', 376, 1024],
      ['bailu_counting_rods', 936, 772],
      ['bailu_ink_stone', 700, 700, { attach: 'bailu_desk_chart', zBias: 4 }],
      ['bailu_compass_set', 820, 706, { attach: 'bailu_desk_chart', zBias: 4 }],
      ['bailu_mat_square', 616, 1180],
      ['bailu_lamp_desk', 872, 1204],
      ['bailu_whisk', 400, 1400],
      ['bailu_lamp_oil_jug', 900, 1436],
      ['bailu_flint', 796, 1528],
      ['bailu_mirror_covered', 1200, 92],
      ['bailu_retreat_tag', 1052, 96],
      // attach 是为命中排序:门闩视觉上钉在二十八宿图下沿之前。非附着时命中公式对
      // fh=0 的件 fallback 到 base(图 384 > 闩 356),整件被图吃掉 —— 事故模式 19
      // 在 fh=0 支的残留。全局对齐公式会翻转 14 对已验收房间的命中赢家,不动;
      // attach 支两侧(绘制/命中)是同一条已对齐的规则,宿主+zBias 稳赢宿主本体。
      ['bailu_door_bar', 636, 300, { attach: 'bailu_chart_28', zBias: 2 }],
      ['bailu_sutra', 508, 1900],
      ['bailu_vase_pure', 1356, 1808],
      ['bailu_broom', 220, 2040],
      ['bailu_shoes', 860, 2296],
      ['bailu_doormat', 620, 2300],
      ['bailu_wall_mark', 700, 1596],
      ['bailu_light_patch', 144, 496],
      ['bailu_cup_ring', 884, 706, { attach: 'bailu_desk_chart', zBias: 5 }],
      ['bailu_rack_plants', 56, 780],      // 反差爱好:多肉架(整面墙的第一层)
      ['bailu_tags_row', 56, 940, { attach: 'bailu_rack_plants', zBias: 3 }],
      ['bailu_rack_plants2', 56, 1000],
      ['bailu_rack_plants3', 56, 1220],
      ['bailu_log_water', 68, 1420],
      ['bailu_tweezers', 236, 1432],
      ['bailu_jars_soil', 60, 1536],
      ['bailu_book_years', 260, 1540],
      ['bailu_pot_dead', 84, 1620],
      ['bailu_pots_spare', 224, 1627],
      ['bailu_seat_covered', 1108, 800],   // ★ 分界线核心:与人有关的,盖着
      ['bailu_portrait_covered', 1000, 820],
      ['bailu_qin_covered', 1004, 968],
      ['bailu_chest_covered', 1004, 1240],
      ['bailu_tea_covered', 1152, 1128],
      ['bailu_scroll_covered', 1060, 200],
      ['bailu_letter_unopened', 1216, 1250],
      ['bailu_photo_covered', 1140, 1424],
      ['bailu_rack_covered', 1348, 1160],
      ['bailu_box_covered', 510, 1700],
      ['bailu_stool_covered', 460, 1500],
      ['bailu_cloth_spare', 392, 1560],
      ['bailu_screen', 976, 1560],
      ['bailu_bed_wood', 1040, 1340],
      ['bailu_quilt_folded', 1096, 1388, { attach: 'bailu_bed_wood', zBias: 4 }],
      ['bailu_pillow', 1276, 1400, { attach: 'bailu_bed_wood', zBias: 4 }],
      ['bailu_basin_stand', 1150, 1800],
      ['bailu_towel', 1170, 1836, { attach: 'bailu_basin_stand', zBias: 4 }],
      ['bailu_soap', 1274, 1876, { attach: 'bailu_basin_stand', zBias: 4 }],
      ['bailu_jar_rice', 120, 1680],
      ['bailu_bowl_upturned', 150, 1908],
      ['bailu_pickle', 360, 1930],
      ['bailu_food_box', 336, 1720],
      ['bailu_incense', 380, 1216],
    ],
  }

  globalThis.BAILU_ROOM.perform = {
    // 玩家点按钮 → 她回案前跪坐排盘。speed 20 高于闲逛 12
    actor: { x: 640, y: 796, poses: ['sit'], fps: 1, flip: false, speed: 20 },
    button: 'bailuCastBtn', labels: ['请白鹭排个盘', '收起'], stateKey: 'divining',
    lineGap: 5000,
    lines: ['写生辰来。年月日时，要准',
            '……紫微在命，天府在迁。你天生是要动的',
            '盘我念了。信不信，你自己的事',
            '有一颗星犯你今年。我只说到这儿',
            '改命的话别问我。命盘我只念，不改',
            '……念准了，也不一定是好事'],
  }

  /* ── 行为 ──────────────────────────────────────────────────────
     三条功能各出行为:排盘(本业)· 浇水记录(反差爱好)· 擦拭闭关(洁癖独处)。
     调度全走引擎,房间只声明数据、推状态机。act 的 x/y 是 sprite 左上角。
     她话少,pSay 低 —— 大多数时候只是安静地做,不出声。 */
  const ACTS = [
    // ── 排盘(本业)──
    { id: 'divine', node: 'MID', x: 560, y: 796, poses: ['divine1', 'divine2'], fps: 2, dur: [9, 14], flip: false, w: 3, divining: true, say: '紫微在午', pSay: 0.4 },
    { id: 'chart',  node: 'MID', x: 660, y: 800, poses: ['sit'],   fps: 1, dur: [7, 11], flip: false, w: 2, say: '……', pSay: 0.3 },
    { id: 'almanac',node: 'NE',  x: 900, y: 560, poses: ['stand'], fps: 1, dur: [4, 7],  flip: true,  w: 1, say: '查一年', pSay: 0.4 },
    // ── 浇水记录(反差爱好)──
    { id: 'water',  node: 'W',   x: 400, y: 1120, poses: ['wipe1', 'wipe2'], fps: 1.6, dur: [6, 10], flip: true, w: 3, say: '卯时三刻，十二毫升', pSay: 0.5 },
    { id: 'log',    node: 'W',   x: 400, y: 1360, poses: ['write'], fps: 1, dur: [7, 11], flip: true, w: 2, say: '记上', pSay: 0.4 },  // y1440 时脚点恰扎进拂尘 foot(pathlint 抓的);上移一档仍对着记录册那层
    { id: 'prune',  node: 'W',   x: 400, y: 1720, poses: ['wipe1', 'wipe2'], fps: 1.6, dur: [5, 8], flip: true, w: 2, say: '枯叶，拔了', pSay: 0.4 },
    { id: 'deadp',  node: 'W',   x: 400, y: 1760, poses: ['gaze'], fps: 1, dur: [5, 9], flip: true, w: 1, say: '四十二号', pSay: 0.6 },
    // ── 擦拭 · 独处 ──
    { id: 'wipe',   node: 'MID', x: 460, y: 800, poses: ['wipe1', 'wipe2'], fps: 1.8, dur: [5, 8], flip: false, w: 2, say: '不能有灰', pSay: 0.4 },
    { id: 'star',   node: 'N',   x: 760, y: 800, poses: ['gaze'], fps: 1, dur: [6, 10], flip: false, w: 2, say: '二十八宿', pSay: 0.4 },
    { id: 'medit',  node: 'CEN', x: 616, y: 1180, poses: ['sit'], fps: 1, dur: [10, 16], flip: false, w: 2, say: '', pSay: 0 },
    { id: 'compass',node: 'W',   x: 340, y: 1024, poses: ['stand'], fps: 1, dur: [4, 6], flip: true, w: 1, say: '定南', pSay: 0.5 },
    // ── 起居 ──
    { id: 'sleep',  node: 'SE',  x: 1000, y: 1690, poses: ['sleep'], fps: 1, dur: [12, 18], flip: false, w: 1, zzz: true, sleepAt: [1130, 1440] },
    { id: 'wash',   node: 'SE',  x: 1060, y: 1880, poses: ['stand'], fps: 1, dur: [4, 6], flip: true, w: 1, say: '凉水', pSay: 0.4 },
    { id: 'rice',   node: 'SW',  x: 340, y: 1860, poses: ['stand'], fps: 1, dur: [4, 6], flip: true, w: 1, say: '一天二两', pSay: 0.4 },
    { id: 'cloth',  node: 'E',   x: 1120, y: 1000, poses: ['stand'], fps: 1, dur: [4, 7], flip: false, w: 1, say: '盖着', pSay: 0.5 },
  ]

  /* 开局坐标必须等于 ACTS[0] 的坐标 —— 状态说她在做第一件事，人就得在那件事的位置上。
     这里原先写的是 y:566，比 divine 的 796 高 230，正好把她塞进工作台底下：
     她照常被 placeActor 放出来、照常摆排盘姿势，只是整个人被桌子挡得一点不剩。
     开局那 4 秒正是进屋的第一印象，于是「进白鹭家看不见白鹭」。 */
  const st = { mode: 'act', act: ACTS[0], x: ACTS[0].x, y: ACTS[0].y, node: 'MID', path: [],
               until: globalThis.ENGINE_HOST.now() + 4000, frame: 0, tx: 0, ty: 0, sayText: null, sayUntil: 0 }
  let BAILU_PERF = null
  function pick() { return globalThis.pickAct(ACTS, st.act) }
  function startWalk(a) { globalThis.startWalkTo(st, a, globalThis.BAILU_ROOM, 'bailu') }

  let lastT = 0
  // 一帧:推进状态 + 画出来。宿主给画布上下文、时刻、画布本身(交互要用)。
  function frame(mainG, t, cv) {
    if (t - lastT < 50) return
    lastT = t; st.frame++

    if (!BAILU_PERF) {
      BAILU_PERF = globalThis.wirePerform(globalThis.BAILU_ROOM)
      globalThis.BAILU_ROOM.acts = [{ actor: 'bailu', list: ACTS }]
    }
    globalThis.stepPerform(globalThis.BAILU_ROOM, st, t, { startWalk, pick })
    // 排盘灯:她真坐下排盘那一刻才亮(排盘态 = divining)
    globalThis.roomState(globalThis.BAILU_ROOM, { divining: st.mode === 'act' && !!st.act.divining })

    if (st.mode === 'act') {
      if (t > st.until) startWalk(pick())
    } else if (globalThis.stepWalk(st, st.act.speed || 12)) {
      st.mode = 'act'
      const [d0, d1] = st.act.dur
      st.until = t + (d0 + Math.random() * (d1 - d0)) * 1000
      if (st.act.say && Math.random() < (st.act.pSay != null ? st.act.pSay : 0.5)) { st.sayText = st.act.say; st.sayUntil = t + 2600 }
    }

    let pose, flip = false, drawX = st.x, drawY = st.y
    if (st.mode === 'walk') {
      const d = globalThis.faceOf(st.tx - st.x, st.ty - st.y)
      if (d.face === 'side') { pose = ['walkside1', 'walkside2', 'walkside3', 'walkside2'][(st.frame >> 2) % 4]; flip = d.flip }
      else if (d.face === 'back') { pose = ((st.frame >> 2) % 2) ? 'walkback1' : 'walkback2'; flip = false }
      else { pose = ((st.frame >> 2) % 2) ? 'walkfront1' : 'walkfront2'; flip = false }
    } else {
      const ps = st.act.poses
      pose = ps[((st.frame * st.act.fps / 20) | 0) % ps.length]
      flip = st.act.flip
    }
    pose = globalThis.idlePose(st, pose, 'bailu')

    const napping = st.mode === 'act' && st.act.sleepAt
    if (napping) { drawX = st.act.sleepAt[0]; drawY = st.act.sleepAt[1] }
    const opt = napping ? { attach: 'bailu_bed_wood', zBias: 4 } : {}

    const F = globalThis.ACTORS.bailu.foot
    const ents = [globalThis.placeActor('bailu', drawX + F[0], drawY + F[1], pose, flip, opt)]
    globalThis.renderRoom(mainG, globalThis.BAILU_ROOM, t, ents)

    if (!cv.__interaction && globalThis.attachRoomInteraction) globalThis.attachRoomInteraction(cv, globalThis.BAILU_ROOM, {})
    if (globalThis.drawInteraction) globalThis.drawInteraction(mainG, globalThis.BAILU_ROOM, cv, t)

    const anc = globalThis.actorAnchor('bailu', pose, drawX, drawY)
    if (st.act.zzz && st.mode === 'act') globalThis.drawEmote(mainG, 'zzz', anc, t)
    if (st.sayText && t < st.sayUntil) globalThis.drawSay(mainG, anc, st.sayText, { ink: '#3e3a30', paper: '#eef0ea' })
    else if (t >= st.sayUntil) st.sayText = null
  }
  globalThis.BAILU_FRAME = frame

  // ── 宿主那一段 ────────────────────────────────────────────────
  // 以上全部与平台无关;以下三行是设计页专用的驱动。
  // 小程序侧自己取画布(wx.createSelectorQuery)、自己驱动帧,再调同一个 frame。
  if (typeof document === 'undefined') return
  const cv = document.getElementById('bailuCanvas')
  if (!cv) return
  const mainG = cv.getContext('2d')
  function loop(t) { requestAnimationFrame(loop); frame(mainG, t, cv) }
  requestAnimationFrame(loop)
})()
