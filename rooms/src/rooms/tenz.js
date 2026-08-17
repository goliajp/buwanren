
// ══ B3e 丹增家 · 金刚院（已上引擎）══
;(function () {
  const cv = document.getElementById('tenzCanvas')
  if (!cv) return
  const mainG = cv.getContext('2d')

  const PC = {
    K: '#3a2c20', F: '#f0c8a0', E: '#3a2c20',
    R: '#a84838', r: '#8a3a2c', y: '#e8b23d',
    W: '#ece4d0', G: '#8a8578', N: '#6a4a30',
    P: '#e858a0', p: '#c04080', B: '#26201a', b: '#3a3028',
  }
  const POSES = {}
  function pdef(n, s) { POSES[n] = s.trim().split('\n').map(r => r.trimEnd()) }
  pdef('stand', `
....KKKKKK..
...KFKFFKFK.
..KFFFFFFFFK
..KFKKFFKKFK
..KFBFFFFBFK
..KFFFFFFFFK
..KFFFFFFFFK
...KFFFFFFK.
...KKKKKKKK.
...KRRRFFFK.
..KyRRRRFFFK
..KyyRRRRRFK
..KrrRRRRRRK
...KK....KK.
..KFK....KFK`)
  pdef('walkfront1', `
....KKKKKK..
...KFKFFKFK.
..KFFFFFFFFK
..KFKKFFKKFK
..KFBFFFFBFK
..KFFFFFFFFK
..KFFFFFFFFK
...KFFFFFFK.
...KKKKKKKK.
...KRRRFFFK.
..KyRRRRFFFK
..KyyRRRRRFK
..KrrRRRRRRK
...KK....KK.
..KFK....KFK`)
  pdef('walkfront2', `
....KKKKKK..
...KFKFFKFK.
..KFFFFFFFFK
..KFKKFFKKFK
..KFBFFFFBFK
..KFFFFFFFFK
..KFFFFFFFFK
...KFFFFFFK.
...KKKKKKKK.
...KRRRFFFK.
..KyRRRRFFFK
..KyyRRRRRFK
..KrrRRRRRRK
..KK......KK
.KFK......KF`)
  pdef('walkfront3', `
....KKKKKK..
...KFKFFKFK.
..KFFFFFFFFK
..KFKKFFKKFK
..KFBFFFFBFK
..KFFFFFFFFK
..KFFFFFFFFK
...KFFFFFFK.
...KKKKKKKK.
...KRRRFFFK.
..KyRRRRFFFK
..KyyRRRRRFK
..KrrRRRRRRK
...KK....KK.
..KFK....KFK`)
  pdef('tzS1', `
...KKKKK...
..KFFFFFK..
.KFFFFFFFK.
.KFFFFKFFK.
.KFFFFBFFK.
.KFFFFFFFK.
.KFFFFFFK..
..KFFFFK...
...KKKKK...
...KRRFK...
..KyRRRFK..
..KRRRRRK..
..KrRRRK...
...KK.KK...`)
  pdef('tzS2', `
...KKKKK...
..KFFFFFK..
.KFFFFFFFK.
.KFFFFKFFK.
.KFFFFBFFK.
.KFFFFFFFK.
.KFFFFFFK..
..KFFFFK...
...KKKKK...
...KRRFK...
..KyRRRFK..
..KRRRRRK..
..KrRRRK...
..KK..KK...`)
  pdef('tzU1', `
....KKKKKK..
...KFFFFFFK.
..KFFFFFFFFK
..KFFFFFFFFK
..KFFFFFFFFK
..KFFFFFFFFK
..KFFFFFFFFK
...KFFFFFFK.
...KKKKKKKK.
...KRRRRRRK.
..KRRRRRRRRK
..KRRRRRRRRK
..KrrRRRRrrK
...KK....KK.`)
  pdef('tzU2', `
....KKKKKK..
...KFFFFFFK.
..KFFFFFFFFK
..KFFFFFFFFK
..KFFFFFFFFK
..KFFFFFFFFK
..KFFFFFFFFK
...KFFFFFFK.
...KKKKKKKK.
...KRRRRRRK.
..KRRRRRRRRK
..KRRRRRRRRK
..KrrRRRRrrK
..KK......KK`)
  pdef('breath', `
............
...KKKKKK...
..KFKFFKFK..
.KFKKFFKKFK.
.KFBFFFFBFK.
..KFFFFFFK..
.KyRRRRRRK..
.KyRRRRRRK..
.KyRRRRRRK..
.KRRRRRRRRK.
.KRRRRRRRRK.
..KRRRRRRK..
..KRRKKRRK..
..KRK..KRK..
..KFK..KFK..
...KK...KK..`)
  pdef('blink', `
...KKKKKK...
..KFKFFKFK..
.KFKKFFKKFK.
.KFBFFFFBFK.
..KFFFFFFK..
..KyRRRRRK..
.KyRRRRRRRK.
.KyRRRRRRRK.
.KRRRRRRRRK.
.KRRRRRRRRK.
..KRRRRRRK..
..KRRRRRRK..
..KRRKKRRK..
..KRK..KRK..
..KFK..KFK..
...KK...KK..`)
  pdef('lying', `
...KKKK.........
..KFFFFK.KKKKKK.
.KFKFFKFKRRRRRRK
.KFKKFFKKRRRRRRK
.KFFFFFFKRRRRRRK
.KFFFFFFKRRRRRRK
..KFFFFK.KKKKKK.
...KKKK.........`)
  pdef('sit', `
............
............
...KKKKKK...
..KFKFFKFK..
.KFKKFFKKFK.
.KFBFFFFBFK.
..KFFFFFFK..
..KyRRRRRK..
.KyRRRRRRRK.
.KRRRRRRRRK.
.KRRRRRRRRK.
KRRRRRRRRRRK
KRFRRRRRRFRK
KKRRRRRRRRKK
.KKKKKKKKKK.
............`)
  pdef('pray', `
...KKKKKK...
..KFKFFKFK..
.KFKKFFKKFK.
.KFBFFFFBFK.
..KFFFFFFK..
..KyRRRRRK..
.KyRRFFRRRK.
.KyRRFFRRRK.
.KRRRFFRRRK.
.KRRRRRRRRK.
..KRRRRRRK..
..KRRRRRRK..
..KRRKKRRK..
..KRK..KRK..
..KFK..KFK..
...KK...KK..`)
  pdef('fist1', `
...KKKKKK...
..KFKFFKFK..
.KFKKFFKKFK.
.KFBFFFFBFK.
..KFFFFFFK..
..KyRRRRRK..
FFKRRRRRRRK.
KKKRRRRRRRK.
.KRRRRRRRRK.
.KRRRRRRRRK.
..KRRRRRRK..
..KRRRRRRK..
..KRRKKRRK..
..KRK..KRK..
..KFK..KFK..
...KK...KK..`)
  pdef('fist2', `
...KKKKKK...
..KFKFFKFK..
.KFKKFFKKFK.
.KFBFFFFBFK.
..KFFFFFFK..
..KyRRRRRK..
.KyRRRRRRRK.
.KyRRRRRRRK.
FFKRRRRRRRK.
KKKRRRRRRRK.
..KRRRRRRK..
..KRRRRRRK..
..KRRKKRRK..
..KRK..KRK..
..KFK..KFK..
...KK...KK..`)
  pdef('lift', `
.GGGGGGGGGG.
.G........G.
.KF......FK.
..KKKKKKKK..
..KFKFFKFK..
..KFeFFeFK..
...KFFFFK...
..KyRRRRRK..
.KyRRRRRRRK.
.KRRRRRRRRK.
.KRRRRRRRRK.
..KRRRRRRK..
..KRRRRRRK..
..KRRKKRRK..
..KRK..KRK..
...KK...KK..`)
  pdef('rock', `
....KKKK....
...KFFFFK...
..KFFFFFFK..
..KKKKKKKK..
...KFFFFK...
..KyRRRRPK..
.KyRRRPPRK..
.KyRPPPPRK..
.KRPPPPPRK..
.KRpPPPPRK..
..KRRRRRRK..
..KRRRRRRK..
..KRRKKRRK..
..KRK..KRK..
..KFK..KFK..
...KK...KK..`)
  pdef('tea', `
...KKKKKK...
..KFKFFKFK..
.KFKKFFKKFK.
.KFBFFFFBFK.
..KFFFFFFK..
..KyRRRRRK..
.KyRRRRRRRK.
.KyRNNNNRRK.
.KRRNNNNRRK.
.KRRRRRRRRK.
..KRRRRRRK..
..KRRRRRRK..
..KRRKKRRK..
..KRK..KRK..
..KFK..KFK..
...KK...KK..`)
  pdef('read', `
...KKKKKK...
..KFKFFKFK..
.KFKKFFKKFK.
.KFBFFFFBFK.
..KFFFFFFK..
..KyRRRRRK..
.KyRyyyyRRK.
.KyRyyyyRRK.
.KRRyyyyRRK.
.KRRRRRRRRK.
..KRRRRRRK..
..KRRRRRRK..
..KRRKKRRK..
..KRK..KRK..
..KFK..KFK..
...KK...KK..`)
  pdef('hop', `
...KKKKKK...
..KFKFFKFK..
.KFKKFFKKFK.
.KFBFFFFBFK.
..KFFFFFFK..
FFKyRRRRRKFF
KKKyRRRRRKKK
.KyRRRRRRRK.
.KRRRRRRRRK.
.KRRRRRRRRK.
..KRRRRRRK..
..KRRRRRRK..
.KRRKKKKRRK.
.KRK....KRK.
..KFK..KFK..
............`)
  pdef('spin', `
...KKKKKK...
..KFKFFKFK..
.KFKKFFKKFK.
.KFBFFFFBFK.
..KFFFFFFK..
FFKyRRRRRK..
KKKyRRRRRRK.
.KyRRRRRRRK.
.KRRRRRRRRK.
.KRRRRRRRRK.
..KRRRRRRK..
..KRRRRRRK..
..KRRKKRRK..
..KRK..KRK..
..KFK..KFK..
...KK...KK..`)
  window.TENZ_POSES = POSES
  window.TENZ_PALETTE = PC

  window.TENZ_ROOM = {
    w: 1440, h: 2560, wallH: 440,
    surfaces: { wall: 'wall_plaster', floor: 'floor_plank' },
    palette: { wall: '#e8e0d0', floor: '#a87848' },
    gradePreset: 'warm', state: {},
    plan: [
      ['tenz_flags',104,56], ['tenz_altar',540,52], ['tenz_thangka',404,138],
      ['tenz_window',50,130], ['tenz_window',1010,130], ['tenz_speedball',392,660],
      ['tenz_jumprope',170,458], ['tenz_cloak_hook',34,470], ['tenz_punchbag',316,442],
      ['tenz_mandala',406,836], ['tenz_offering_table',592,408], ['tenz_prayer_wheels',1084,452],
      ['tenz_cushion',642,932], ['tenz_torma',936,470], ['tenz_sutra_shelf',60,1560],
      ['tenz_sutra_desk',1104,1150], ['tenz_dungchen',780,1829], ['tenz_mani_stones', 700, 2060],
      ['tenz_hay', 560, 2130],
      ['tenz_bed',1078,640], ['tenz_mat',84,1250], ['tenz_wooden_dummy',880,1500],
      ['tenz_dumbbells', 150, 1950], ['tenz_yoga',448,1240], ['tenz_bottle',388,1646], ['tenz_plum_posts',562,1510],
      ['tenz_amp',1086,950], ['tenz_guitar', 1214, 900], ['tenz_sunglasses',1142,936],
      ['tenz_drumkit',1066,1338], ['tenz_tea', 1060, 2040],
      ['tenz_counter',300,1120], ['tenz_cape',40,710], ['tenz_stone_locks',118,1548], ['tenz_lift_stone',346,1556], ['tenz_staff_rack',118,700], ['tenz_cobweb',480,60], ['tenz_cobweb',860,60,{"flip":true}], ['tenz_cobweb',44,1548],
      // 欠账补充（第二批 21 件）
      ['tenz_poster',920,138], ['tenz_seven_bowls',560,608], ['tenz_kneel_mat',600,680],
      ['tenz_dharma_wheel',694,40], ['tenz_snow_lions',544,527], ['tenz_khata_rod',376,448],
      ['tenz_butter_flower',958,404], ['tenz_vajra_knots',1350,138], ['tenz_stand_drum',46,1180],
      ['tenz_mic_stand',1038,1142], ['tenz_kettlebells', 300, 1980], ['tenz_dice_tray', 1180, 1630],
      ['tenz_gau_boxes',58,138], ['tenz_hand_wheel',1232,1684], ['tenz_protein', 210, 2050],
      ['tenz_trophies',198,1528], ['tenz_pedals',1100,1122], ['tenz_pick_jar',1236,924],
      ['tenz_wrist_guards', 280, 2110], ['tenz_bandage', 130, 2110], ['tenz_barley',1176,2188],
      ['tenz_doormat',618,1998],
    ],
    perform: {
      actor: { x: 673, y: 1091, poses: ['sit'], fps: 1, flip: false, speed: 18 },
      button: 'tenzCastBtn', labels: ['请丹增指点迷津', '收起'], stateKey: 'divining',
      lineGap: 5000,
      lines: ['让贫僧翻翻历书……', '火土相生，是个好日子',
              '初八不宜动土，改初十', '这个方位，宜。放心去',
              '嘿哈——包在贫僧身上', '算日子，贫僧最准'],
    },
  }

  const ACTS = [
    { id: 'medi',   node: 'BT', x: 676,  y: 856,  poses: ['sit'],           fps: 1,   dur: [8, 12],  flip: false, medi: true, say: '唵嘛呢叭咪吽……' },
    { id: 'pray',   node: 'BT', x: 672,  y: 600,  poses: ['pray'],          fps: 1,   dur: [5, 8],   flip: false, say: '佛祖保佑大家' },
    { id: 'sneak',  node: 'BT', x: 700,  y: 604,  poses: ['stand'],         fps: 1,   dur: [3, 5],   flip: false, say: '(左右看看)佛祖不会介意的', pSay: 0.95 },
    { id: 'fist',   node: 'L2', x: 836,  y: 1596, poses: ['fist1', 'fist2'], fps: 2.4, dur: [7, 11], flip: false, dummy: true, say: '哈！嘿！' },
    { id: 'lift',   node: 'L3', x: 110,  y: 1420, poses: ['lift', 'stand'], fps: 0.8, dur: [6, 9],   flip: false, say: '一百零八……一百零九……' },
    { id: 'tea',    node: 'R2', x: 1000, y: 1640, poses: ['tea'],           fps: 1,   dur: [5, 8],   flip: true,  say: '酥油茶，一碗压不住' },
    { id: 'read',   node: 'R2', x: 990,  y: 1080, poses: ['read'],          fps: 1,   dur: [7, 10],  flip: true,  say: '这段经，绕了三遍才顺' },
    { id: 'spin',   node: 'R1', x: 952,  y: 524,  poses: ['spin'],          fps: 1,   dur: [5, 8],   flip: true,  say: '(嗡——)' },
    { id: 'nap',    node: 'R1', x: 952,  y: 704,  poses: ['lying'],         fps: 1,   dur: [10, 15], flip: false, zzz: true, lie: true, sleepAt: [1140, 620] },
    { id: 'horn',   node: 'B2', x: 690,  y: 1724, poses: ['pray'],          fps: 1,   dur: [4, 6],   flip: false, say: '(呜——————)' },
    { id: 'rock',   node: 'R1', x: 990,  y: 940,  poses: ['rock'],          fps: 1,   dur: [7, 10],  flip: true,  notes: true, say: '哦耶——今晚有摇滚法会！' },
    { id: 'kid',    node: 'L1', x: 220,  y: 760,  poses: ['stand'],         fps: 1,   dur: [4, 6],   flip: false, say: '下次法会，就穿这个去', pSay: 0.9 },
    { id: 'bag',    node: 'L1', x: 372,  y: 744,  poses: ['fist1', 'fist2'], fps: 2.4, dur: [5, 8],  flip: false, say: '嘿哈！' },
    { id: 'drums',  node: 'R2', x: 962,  y: 1444, poses: ['fist1', 'fist2'], fps: 3,   dur: [6, 9],  flip: true,  notes: true, say: '咚次哒次——' },
    { id: 'plum',   node: 'B2', x: 540,  y: 1508, poses: ['pray'],          fps: 1,   dur: [11, 16], flip: false, say: '心如止水……别晃',
                 // 五个桩顶(绝对脚点):左下→中→右上→右下→左上,踩出「之」字
                 hops: [[588, 1648], [646, 1584], [704, 1524], [704, 1648], [588, 1524]] },
  ]

  const st = { mode: 'act', act: ACTS[0], x: 676, y: 856, node: 'BT', path: [],
               until: performance.now() + 5000, frame: 0, tx: 0, ty: 0, sayText: null, sayUntil: 0 }
  let TENZ_PERF = null
  function pick() { return window.pickAct(ACTS, st.act) }
  function startWalk(a) { window.startWalkTo(st, a, window.TENZ_ROOM, 'tenz') }
  let lastT = 0
  function loop(t) {
    requestAnimationFrame(loop)
    if (t - lastT < 50) return
    lastT = t; st.frame++
    // 首帧补全:codex 只给了侧/背的帧一，复用它补出站姿与第二帧，让四向完整。
    // 丹增原房间只画了帧一，这是迁移的补齐（复用而非新画，视觉即帧一）。

    if (!TENZ_PERF) {
      TENZ_PERF = window.wirePerform(window.TENZ_ROOM)
      // 行为表挂到房间对象上 —— 它和 plan / perform 一样是【房间数据】。
      // 从前它只是 IIFE 里的局部变量,闭包外一个字都看不到,`pathlint` 这类
      // 门禁于是无从下手:锚点在不在家具里、路径穿不穿家具,都要拿到这张表才查得了。
      // 挂在【首帧接线】这里,与 wirePerform 并列 —— 房间脚本执行的那一刻,
      // 阿云的 ROOM 对象还在另一个 script 块里没定义,桃桃的 RACTS、婆婆的
      // PETS 也还在 const 的暂时性死区里。到 rAF 第一帧,这些才都齐了。
      // anchorIsFoot:宠物的锚点【本身就是脚点】,主角的是 sprite 左上角 ——
      // startWalkTo 靠 { foot:[0,0] } 区分这两种语义,这里如实标注。
      window.TENZ_ROOM.acts = [{ actor: 'tenz', list: ACTS }]
    }
    window.stepPerform(window.TENZ_ROOM, st, t, { startWalk, pick })
    // 打木人时桩身转 —— 状态在【真的站定开打】那一刻置起,不是走过去的路上
    window.roomState(window.TENZ_ROOM, { dummy: st.mode === 'act' && !!st.act.dummy })

    if (st.mode === 'act') {
      if (t > st.until) startWalk(pick())
    } else if (window.stepWalk(st, st.act.speed || 11)) {
      st.mode = 'act'
      const [d0, d1] = st.act.dur
      st.until = t + (d0 + Math.random() * (d1 - d0)) * 1000
      if (st.act.say && Math.random() < (st.act.pSay || 0.55)) { st.sayText = st.act.say; st.sayUntil = t + 2800 }
    }

    let pose, flip = false, drawX = st.x, drawY = st.y
    if (st.mode === 'walk') {
      // 四向走姿：侧向 walkside(codex 左右) · 背向 walkback(codex 上) · 正面 walkfront(房间自绘 下)
      const d = window.faceOf(st.tx - st.x, st.ty - st.y)
      if (d.face === 'side') { pose = ['walkside1', 'walkside2', 'walkside3', 'walkside2'][(st.frame >> 2) % 4]; flip = d.flip }
      else if (d.face === 'back') { pose = ((st.frame >> 2) % 2) ? 'walkback1' : 'walkback2'; flip = false }
      else { pose = ['walkfront1', 'walkfront2', 'walkfront3', 'walkfront2'][(st.frame >> 2) % 4]; flip = false }
    } else {
      const ps = st.act.poses
      pose = ps[((st.frame * st.act.fps / 20) | 0) % ps.length]
      flip = st.act.flip
    }
    pose = window.idlePose(st, pose, 'tenz')
    // 躺床上:寻路终点在床边(可达)，到位后用 sleepAt 把人挪到床上并 attach
    const napping = st.mode === 'act' && st.act.sleepAt
    if (napping) { drawX = st.act.sleepAt[0]; drawY = st.act.sleepAt[1] }
    const att = napping ? { attach: 'tenz_bed', zBias: 4 } : {}

    // 跳梅花桩:落点由行为给,引擎推进抛物线。腾空时转体,落桩那一刻收成合十站定。
    let footX = drawX + window.ACTORS.tenz.foot[0], footY = drawY + window.ACTORS.tenz.foot[1]
    let opt = att
    if (st.mode === 'act' && st.act.hops) {
      const h = window.stepHop(st, st.act.hops, t, { period: 760, height: 52 })
      footX = h.x; footY = h.y
      pose = h.lift > 12 ? 'hop' : 'pray'      // 腾空收腿展臂,落桩合十站定
      flip = h.phase > 0.5 && h.x < (st.act.hops[(h.idx + 1) % st.act.hops.length][0])
      opt = { airborne: h.lift }
    }

    const ents = [window.placeActor('tenz', footX, footY, pose, flip, opt)]
    window.renderRoom(mainG, window.TENZ_ROOM, t, ents)

    if (!cv.__interaction && window.attachRoomInteraction) window.attachRoomInteraction(cv, window.TENZ_ROOM, {})
    if (window.drawInteraction) window.drawInteraction(mainG, window.TENZ_ROOM, cv, t)

    const anc = window.actorAnchor('tenz', pose, drawX, drawY)
    if (st.act.zzz && st.mode === 'act') window.drawEmote(mainG, 'zzz', anc, t)
    if (st.act.notes && st.mode === 'act') window.drawEmote(mainG, 'note', anc, t)
    if (st.sayText && t < st.sayUntil) window.drawSay(mainG, anc, st.sayText, { ink: '#3a2c20', paper: '#f0e4d0' })
    else if (t >= st.sayUntil) st.sayText = null
  }
  requestAnimationFrame(loop)
})()
