
(function () {
  /* 这支脚本【不碰浏览器】。取画布、驱动帧是宿主的事,在文件末尾单独一段:
     设计页那段用 document + requestAnimationFrame,小程序那边用它自己的。
     中间这一大段(姿态、表演、房间、每帧算什么)两边共用,一个字不改。 */
  // 陈设一律来自素材库 + AYUN_ROOM.plan,经 renderRoom 渲染。
  // 此处原有 1088 行硬编码陈设,画进一张离屏 bg —— 那张 bg 只在
  // 「管线未就绪」的兜底分支里 blit 过一次,正常路径永远走不到,
  // 也就是说同一批家具存在两份绘制、而其中一份从来没显示过。
  // 改帐幔要改两处、同一张床在两块画布上长得不一样,根源就在这里。

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  NPC 行为系统 · 姿态 sprite 集 + 状态机 + 帧动画(20fps)   ║
  // ╚═══════════════════════════════════════════════════════════╝
  const PC = {
    K: '#3a2c20', F: '#f0c8a0', E: '#3d6a34', H: '#4a3a2c', j: '#a8845a', P: '#e87a90', b: '#4c6a8c', x: '#4a3626',
    B: '#5a7a96', Y: '#ffd76a', W: '#f6efdc', Z: '#9a938a',
    O: '#e89040', C: '#c87028',
  }
  const POSES = {}
  // 姿态数据的唯一定义处。角色资源【引用】它而不是拷贝 —— 拷贝会导致
  // 新姿态只写一处时静默回退成 stand,不报错,很难查。
  globalThis.AYUN_POSES = POSES
  function pdef(name, s) { POSES[name] = s.trim().split('\n').map(r => r.trimEnd()) }

  pdef('stand', `
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

  pdef('standback', `
.....KHHK...
..KjjKHHKjjK
....KKKKKK..
...KHHHHHHK.
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
...KHHHHHHK.
....KKKKKK..
....KBBBBK..
...KBBBBBBK.
...KBBBBBBK.
...KbbbbbbK.
....K....K..`)
  pdef('walkback1', `
.....KHHK...
..KjjKHHKjjK
....KKKKKK..
...KHHHHHHK.
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
...KHHHHHHK.
....KKKKKK..
....KBBBBK..
...KBBBBBBK.
...KBBBBBBK.
...KbbbbbbK.
....K....K..`)
  pdef('walkback2', `
.....KHHK...
..KjjKHHKjjK
....KKKKKK..
...KHHHHHHK.
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
...KHHHHHHK.
....KKKKKK..
....KBBBBK..
...KBBBBBBK.
...KBBBBBBK.
...KbbbbbbK.
...K......K.`)

  pdef('standside', `
....KHK....
...KjHHK...
...KKKKK...
..KHHHHHK..
.KHHHHHFFK.
.KHHHFFxFK.
.KHHHFFFFK.
.KHHFFFFFK.
.KHHFFPFFK.
..KHFFFFK..
...KKKKK...
...KBBBK...
..KBBBBBK..
..KBBBBBK..
..KbbbbK...
...K..K....`)

  pdef('walkside1', `
....KHK....
...KjHHK...
...KKKKK...
..KHHHHHK..
.KHHHHHFFK.
.KHHHFFxFK.
.KHHHFFFFK.
.KHHFFFFFK.
.KHHFFPFFK.
..KHFFFFK..
...KKKKK...
...KBBBK...
..KBBBBBK..
..KBBBBBK..
..KbbbbK...
...K..K....`)

  pdef('walkside3', `
....KHK....
...KjHHK...
...KKKKK...
..KHHHHHK..
.KHHHHHFFK.
.KHHHFFxFK.
.KHHHFFFFK.
.KHHFFFFFK.
.KHHFFPFFK.
..KHFFFFK..
...KKKKK...
...KBBBK...
..KBBBBBK..
..KBBBBBK..
..KbbbbK...
..K...K....`)
  pdef('walkside2', `
....KHK....
...KjHHK...
...KKKKK...
..KHHHHHK..
.KHHHHHFFK.
.KHHHFFxFK.
.KHHHFFFFK.
.KHHFFFFFK.
.KHHFFPFFK.
..KHFFFFK..
...KKKKK...
...KBBBK...
..KBBBBBK..
..KBBBBBK..
...KbbbK...
....KK.....`)
  pdef('blink', `
....KK....
...KHHK...
..KHHHHK..
.KHHHHHHK.
.KFFFFFFK.
.KFFFFFFK.
.KFFFFFFK.
..KFFFFK..
.KBBBBBBK.
KBBBBBBBBK
KBBYYYYBBK
.KBBBBBBK.
.KBBKKBBK.
.KBK..KBK.
..KK..KK..`)
  pdef('breath', `
..........
....KK....
...KHHK...
..KHHHHK..
.KHHHHHHK.
.KFFFFFFK.
.KFEFFEFK.
.KFFFFFFK.
.KBBBBBBK.
KBBBBBBBBK
KBBYYYYBBK
.KBBBBBBK.
.KBBKKBBK.
.KBK..KBK.
..KK..KK..`)

  pdef('walkfront1', `
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

  pdef('walkfront2', `
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

  pdef('sit', `
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
...KBBBBBBK.
..KBBBBBBBBK
..KBBBBBBBBK
.KKBBBBBBKK.
..KKKKKKKK..`)

  // ── 睡姿(侧卧 · 俯视)── 后脑朝右、面朝左,只露半张脸;肩线错开,
  // 被下身形比仰卧窄一列 —— 侧身占地本来就窄。flip 即得另一侧卧。
  pdef('sleepside', `
....KHK......
...KjHHK.....
...KKKKK.....
..KHHHHHK....
.KHHHHHFFK...
.KHHHFFxFK...
.KHHHFFFFK...
.KHHFFFFFK...
.KHHFFPFFK...
..KHFFFFK....
...KKKKK.....
KKWWWWWWWWKK.
KBWWWWWWWWBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
.KBBBBBBBBK..
..KKKKKKKK...`)
  pdef('sleepside2', `
....KHK......
...KjHHK.....
...KKKKK.....
..KHHHHHK....
.KHHHHHFFK...
.KHHHFFxFK...
.KHHHFFFFK...
.KHHFFFFFK...
.KHHFFPFFK...
..KHFFFFK....
...KKKKK.....
KKWWWWWWWWKK.
KBWWWWWWWWBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
KBBBBBBBBBBK.
.KBBBBBBBBK..
..KKKKKKKK...`)
  // ── 睡姿(仰卧 · 俯视)── 与站/走同属角色姿态规范的一部分。
  // 解剖顺序:发顶 → 鬓角 → 额 → 闭眼 → 鼻梁 → 嘴 → 下巴 → 肩 → 被沿 → 被面 → 双臂搭在被外
  // 两帧差异只在被面起伏与眉睫微动,幅度极小,避免"呼吸"变成"抽动"。
  pdef('sleepv', `
.....KHHK....
..KjjKHHKjjK.
....KKKKKK...
...KHHHHHHK..
..KHHHHHHHHK.
..KHFFFFFFHK.
..KFKKFFKKFK.
..KFFFFFFFFK.
..KFPFFFFPFK.
...KFFFFFFK..
....KKKKKK...
.KKWWWWWWWWKK
.KBWWWWWWWWBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
..KBBBBBBBBK.
...KKKKKKKK..`)
  pdef('sleepv2', `
.....KHHK....
..KjjKHHKjjK.
....KKKKKK...
...KHHHHHHK..
..KHHHHHHHHK.
..KHFFFFFFHK.
..KFKKFFKKFK.
..KFFFFFFFFK.
..KFPFFFFPFK.
...KFFFFFFK..
....KKKKKK...
.KKWWWWWWWWKK
.KBWWWWWWWWBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
.KBBBBBBBBBBK
..KBBBBBBBBK.
...KKKKKKKK..`)
  pdef('sleep', `
..KKKK..........
.KjHHjK.KKKKKKK.
KHHHHHHKBBBBBBBK
KHFKKFHKBBBBBBBK
KHFFFFHKBBBBBBBK
KHFFFFHKBBBBBBBK
.KFFFFK.KKKKKKK.
..KKKK..........`)

  pdef('divine1', `
....KK....
...KHHK...
..KHHHHK..
.KHHHHHHK.
.KFFFFHHK.
.KFEFFHHK.
.KFFFFHHK.
..KFFFFKF.
.KBBBBBKFF
.KBBBBBBK.
.KBYYYYBK.
.KBBBBBBK.
.KBBKKBBK.
..KBKKBK..
..KK..KK..`)

  pdef('divine2', `
....KK....
...KHHK...
..KHHHHK..
.KHHHHHHK.
.KFFFFHHKF
.KFEFFHHFF
.KFFFFHHK.
..KFFFFK..
.KBBBBBBK.
.KBBBBBBK.
.KBYYYYBK.
.KBBBBBBK.
.KBBKKBBK.
..KBKKBK..
..KK..KK..`)

  pdef('drink1', `
....KK....
...KHHK...
..KHHHHK..
.KHHHHHHK.
.KFFFFHHK.
.KFEFFHHK.
.KFFFFHHK.
..KFFFFKW.
.KBBBBBKWW
.KBBBBBBK.
.KBYYYYBK.
.KBBBBBBK.
.KBBKKBBK.
..KBKKBK..
..KK..KK..`)

  pdef('drink2', `
....KK....
...KHHK...
..KHHHHK..
.KHHHHHHK.
.KFFFFHHWW
.KFEFFHHWW
.KFFFFHHK.
..KFFFFK..
.KBBBBBBK.
.KBBBBBBK.
.KBYYYYBK.
.KBBBBBBK.
.KBBKKBBK.
..KBKKBK..
..KK..KK..`)

  pdef('lift1', `
...KKKK...
..KHHHHK..
.KHHHHHHK.
.KFFFFFFK.
.KFEFFEFK.
.KFFFFFFK.
..KFFFFK..
ZKBBBBBBKZ
ZKBBBBBBKZ
ZKBYYYYBKZ
.KBBBBBBK.
.KBBKKBBK.
.KBK..KBK.
..KK..KK..`)

  pdef('lift2', `
.Z.KKKK.Z.
.ZKHHHHKZ.
.KHHHHHHK.
.KFFFFFFK.
.KFEFFEFK.
.KFFFFFFK.
..KFFFFK..
.KBBBBBBK.
KBBBBBBBBK
KBBYYYYBBK
.KBBBBBBK.
.KBBKKBBK.
.KBK..KBK.
..KK..KK..`)

  pdef('read', `
....KK....
...KHHK...
..KHHHHK..
.KHHHHHHK.
.KFFFFFFK.
.KFEFFEFK.
.KFFFFFFK.
..KFFFFK..
.KBWWWWBK.
KBBWWWWBBK
KBBWWWWBBK
.KBBBBBBK.
.KBBKKBBK.
.KBK..KBK.
..KK..KK..`)

  pdef('gameback', `
....KK....
...KHHK...
..KHHHHK..
.KHHHHHHK.
.KHHHHHHK.
.KHHHHHHK.
..KHHHHK..
.KBBBBBBK.
FKBBBBBBKF
KBBBBBBBBK
KBBBBBBBBK
KKBBBBBBKK
.KKKKKKKK.
..........
..........`)

  // ── 猫姿态(默认朝左 · scale5)──
  pdef('csleep', `
...KK..KK....
..KOOKKOOK...
.KOCOOOOCOK..
.KOOOOOOOEOK.
KOOOOOOOOOOOK
.KOOOOOWWWOK.
..KKKKKKKKK..`)

  pdef('csit', `
.KK....KK.
KOOK..KOOK
KOCOKKOCOK
.KOOOOOOK.
.KOEOOEOK.
.KOOPOOOK.
.KOWWWWOK.
..KOOOOK..
.KKOOOOK..
KOKWWWWK..
KOKKKKKK..
.KK.......`)

  pdef('cwalk1', `
..........KK.
.........KOOK
.......KKOCOK
..KKKKKOOOEOK
KKOOOOOOOOOOK
KOOOOOOOOOOK.
KOKOKKKKKKOK.
K.KOK....KOK.
...K......K..`)

  pdef('cwalk2', `
..........KK.
.........KOOK
.......KKOCOK
..KKKKKOOOEOK
KKOOOOOOOOOOK
KOOOOOOOOOOK.
KOKKOKKKKOKK.
K..KOK..KOK..
....K....K...`)

  pdef('cstretch', `
...........KK.
..........KOOK
........KKOCOK
....KKKKOOOEOK
.KKOOOOOOOOOK.
.KOOOOOOOOOK..
.KKOKKOKKKKK..
.K.K..K.K.....`)

  pdef('knock1', `
....KK....
...KHHK...
..KHHHHK..
.KHHHHHHK.
.KFFFFFFK.
.KFEFFEFK.
.KFFFFFFK.
..KFFFFK..
.KBBBBBBKF
KBBBBBBBBK
KBBYYYYBBK
KBBBBBBBBK
KKBBBBBBKK
.KKKKKKKK.
..........`)

  pdef('knock2', `
....KK....
...KHHK...
..KHHHHK..
.KHHHHHHK.
.KFFFFFFK.
.KFEFFEFK.
.KFFFFFFK.
..KFFFFK..
.KBBBBBBK.
KBBBBBBBKF
KBBYYYYBBK
KBBBBBBBBK
KKBBBBBBKK
.KKKKKKKK.
..........`)

  const SC = 8   // 1440 系:每 sprite 像素 8px → 人物 80×112


  // ══════════ 场景地基(B11 规范实现)· 网格 + 碰撞 + 寻路 ══════════
  // 碰撞体 = 家具【底面投影 footprint】,不是整个 sprite 高度 ——
  // 书架画 352px 高,但只占地底部一条,角色本来就该能站在它前面。
    // 网格与碰撞体已上引擎:globalThis.roomGrid(room) 从 plan 的素材 foot 自动烧制。

  // ── 行为锚点(1440 系 sprite 左上角 · 脚点 = 左上角 + (40,114))──
  // 注:侧身 sprite 一律面朝右(素材规范)· flip=true 时面朝左 · node = 最近路网节点
  const ACTS = [
    { id: 'divine', node: 'C1',   x: 408,  y: 1072, poses: ['divine1', 'divine2'], fps: 1.4, dur: [6, 9],  flip: true,  pointer: true, say: '（掐指）……有意思' },
    { id: 'meditate', node: 'D2', x: 680,  y: 1342, poses: ['sit'],                fps: 1,   dur: [8, 12], flip: false, say: '（入定）' },
    { id: 'qing', node: 'C3', x: 896,  y: 1270, poses: ['knock1', 'knock2'],   fps: 2.2, dur: [5, 8],  flip: false, note: true, say: '（铮——）' },
    { id: 'sleep', node: 'A3',    x: 1006, y: 700,  poses: ['sleepv', 'sleepv2'],  fps: 0.35, dur: [10, 15],flip: false, zzz: true,
      // 寻路终点在床【下沿之外】,人不在床上走;到位后直接切到 sleepAt 的睡姿
      sleepAt: [1208, 508] },   // sprite 13 列 ×8 = 104px,床心 1260 → 左上角 1208   // 床 x1092..1428 中心 1260,sprite 宽 96 → 居中;头挨枕头下沿
    { id: 'tea', node: 'B3',      x: 1046, y: 872,  poses: ['drink1', 'drink2'],   fps: 0.9, dur: [4, 6],  flip: true,  say: '好茶' },
    { id: 'water', node: 'E2',    x: 540,  y: 1746, poses: ['drink1', 'drink2'],   fps: 0.9, dur: [3, 5],  flip: false, say: '咕嘟…' },
    { id: 'gacha', node: 'D3',    x: 840,  y: 1552, poses: ['divine1', 'divine2'], fps: 1.6, dur: [6, 9],  flip: false, pointer: true, say: '（净手焚香）……此卦大吉' },
    { id: 'read', node: 'B1',     x: 380,  y: 982,  poses: ['read'],               fps: 1,   dur: [7, 10], flip: false },
    { id: 'window', node: 'A1',   x: 460,  y: 566,  poses: ['standback'],          fps: 1,   dur: [4, 6],  flip: false },
    { id: 'cat', node: 'A3',      x: 1002, y: 620,  poses: ['standside'],          fps: 1,   dur: [3, 5],  flip: true,  heart: true, say: '乖' },
    { id: 'pace', node: 'D2',     x: 520,  y: 1548, poses: null, pace: [520, 920], dur: [7, 10], say: '唔……此局何解…' },
    { id: 'ps5', node: 'C3', x: 1160, y: 1162, poses: ['gameback'], fps: 1, dur: [9, 14], flip: false, tv: true, say: '就打一把……就一把' },
  ]

  // ── 猫的日程(贪睡 · 加权随机 · 行动缓慢)──
  const CATACTS = [
    { id: 'cs1', node: 'A3', x: 1240, y: 850,  poses: ['csleep'],  dur: [25, 45], zzz: true, w: 5 },
    { id: 'cs2', node: 'D2', x: 720, y: 1464, poses: ['csleep'],  dur: [20, 35], zzz: true, w: 4 },
    { id: 'cst', node: 'C1', x: 460, y: 1280, poses: ['cstretch'],dur: [3, 5],  w: 1 },
    { id: 'csi', node: 'A2', x: 686, y: 876,  poses: ['csit'],    dur: [6, 10], w: 1, say: '喵', onTop: true },
    { id: 'cw',  node: 'E2', x: 580, y: 1860, poses: ['csit'],    dur: [4, 6],  w: 1 },
  ]
  // 阿云的锚点(sprite 左上角)→ 脚点换算。原先 (40,114) 在十余处写死,
  // 改一次角色尺寸就得逐处追改,漏一处就错位。统一从 ACTORS 读。
  const af = i => globalThis.ACTORS.ayun.foot[i]

  // 猫的选点归引擎；房间只留「离人太近就换一个」这条
  function pickCat() {
    return globalThis.pickAct(CATACTS, cst.act, {
      filter: a => Math.hypot(a.x - (st.x + af(0)), a.y - (st.y + af(1))) >= MIN_GAP,
    })
  }
  const cst = {
    mode: 'act', act: CATACTS[0], x: 1240, y: 850,   // 与 cs1 一致
    until: globalThis.ENGINE_HOST.now() + 15000, node: 'A3', path: [],
    tx: 0, ty: 0, sayText: null, sayUntil: 0,
  }
  // 猫的 act 坐标就是脚点，故 foot 传 [0,0]
  function catWalk(a) { globalThis.startWalkTo(cst, a, globalThis.AYUN_ROOM, 'cat', { foot: [0, 0] }) }

  const st = {
    mode: 'act', act: ACTS[0], x: 408, y: 1072,
    until: globalThis.ENGINE_HOST.now() + 5000, frame: 0,
    tx: 0, ty: 0, paceDir: 1, pointerA: -Math.PI / 2,
    fxT: 0, sayText: null, sayUntil: 0,
    node: 'C1', path: [],
  }
  const MIN_GAP = 92        // 人与猫的最小脚点间距(px)
  // 选行为归引擎；这里只保留阿云特有的一条:避开猫当前所在的锚点(逗猫除外)
  let AYUN_PERF = null
  function pick() {
    return globalThis.pickAct(ACTS, st.act, {
      filter: a => a.id === 'cat' ||
        Math.hypot((a.x + af(0)) - cst.x, (a.y + af(1)) - cst.y) >= MIN_GAP,
    })
  }
  function startWalk(a) { globalThis.startWalkTo(st, a, globalThis.AYUN_ROOM, 'ayun') }

  let lastT = 0
  // 一帧:推进状态 + 画出来。宿主给画布上下文、时刻、画布本身(交互要用)。
  function frame(mainG, t, cv) {
    if (t - lastT < 50) return   // 20fps
    const dt = t - lastT; lastT = t
    st.frame++

    // ── 表演态:玩家点「请阿云起一课」──────────────────────────
    // 驱动逻辑已收进引擎(2.75)。这里只接线 + 每帧推进。
    if (!AYUN_PERF) {
      AYUN_PERF = globalThis.wirePerform(globalThis.AYUN_ROOM)
      // 行为表挂到房间对象上 —— 它和 plan / perform 一样是【房间数据】。
      // 从前它只是 IIFE 里的局部变量,闭包外一个字都看不到,`pathlint` 这类
      // 门禁于是无从下手:锚点在不在家具里、路径穿不穿家具,都要拿到这张表才查得了。
      // 挂在【首帧接线】这里,与 wirePerform 并列 —— 房间脚本执行的那一刻,
      // 阿云的 ROOM 对象还在另一个 script 块里没定义,桃桃的 RACTS、婆婆的
      // PETS 也还在 const 的暂时性死区里。到 rAF 第一帧,这些才都齐了。
      // anchorIsFoot:宠物的锚点【本身就是脚点】,主角的是 sprite 左上角 ——
      // startWalkTo 靠 { foot:[0,0] } 区分这两种语义,这里如实标注。
      globalThis.AYUN_ROOM.acts = [{ actor: 'ayun', list: ACTS }, { actor: 'cat', list: CATACTS, anchorIsFoot: true }]
    }
    globalThis.stepPerform(globalThis.AYUN_ROOM, st, t, { startWalk, pick })

    // ── 状态机 ──
    if (st.mode === 'act') {
      if (t > st.until) startWalk(pick())
      if (st.act.pace) {   // 踱步:水平往返
        globalThis.stepPace(st, st.act.pace, 4)
      }
      if (st.act.pointer) st.pointerA += 0.05
    } else {   // walk:L 型(先 x 后 y)· 11px/帧 ≈ 220px/s
      // 推进与取下一路径点归引擎；返回 true 才是【真的走完了】
      if (globalThis.stepWalk(st, st.act.speed || 11)) {
        st.mode = 'act'
        const [d0, d1] = st.act.dur
        st.until = t + (d0 + Math.random() * (d1 - d0)) * 1000
        if (st.act.say && Math.random() < 0.55) {
          st.sayText = st.act.say
          st.sayUntil = t + 2800
        }
      }
    }

    // ── 角色间互斥(动态避让)──
    // 人与猫是两个实体,不该叠在一起。静态碰撞只管家具,角色之间要靠避让解决。
    // 猫体型小、优先级低 → 由猫让路;阿云正在逗猫(act 'cat')时豁免,那是交互。
    const heroFx = st.x + af(0), heroFy = st.y + af(1)
    const catFx = cst.x, catFy = cst.y
    const gap = Math.hypot(heroFx - catFx, heroFy - catFy)
    const interacting = (st.act.id === 'cat')
    if (!interacting && gap < MIN_GAP && cst.mode === 'act') {
      // 被靠近了:猫起身挪窝,挑一个离人最远的落脚点
      let best = null, bestD = -1
      for (const a of CATACTS) {
        if (a.id === cst.act.id) continue
        const d = Math.hypot(a.x - heroFx, a.y - heroFy)
        if (d > bestD) { bestD = d; best = a }
      }
      if (best) catWalk(best)
    }
    // ── 猫状态机(慢速)──
    if (cst.mode === 'act') {
      if (t > cst.until) catWalk(pickCat())
    } else if (globalThis.stepWalk(cst, 6)) {   // 步进交给引擎 —— 原先这里逐行复制了 stepWalk
      cst.mode = 'act'
      const [d0, d1] = cst.act.dur
      cst.until = t + (d0 + Math.random() * (d1 - d0)) * 1000
      if (cst.act.say && Math.random() < 0.5) {
        cst.sayText = cst.act.say; cst.sayUntil = t + 2000
      }
    }

    // ══════════ 绘制:交由素材库管线 ══════════
    // 房间本体不再使用硬编码的 bg,而是与 B12 重建视图共用同一套资源与管线:
    //   globalThis.AYUN_ROOM(声明式布局) + globalThis.renderRoom(图层栈)
    // 角色/猫由本文件的状态机驱动,作为可排序实体传入,与家具同规则遮挡。
    // 姿态计算保留(它属于行为系统,不属于渲染)。
    let pose, flip = false
    if (st.mode === 'walk') {
      const wp = globalThis.walkPose(st, { rate: 1 })   // 走位姿态归引擎；rate 是本角色的步频
      pose = wp.pose; flip = wp.flip
    } else if (st.act.pace) {
      pose = ((st.frame >> 2) % 2) ? 'walkside1' : 'walkside3'
      flip = st.paceDir < 0
    } else {
      const ps = st.act.poses
      pose = ps[((st.frame * st.act.fps / 20) | 0) % ps.length]
      flip = st.act.flip
    }
    pose = globalThis.idlePose(st, pose, 'ayun')
    const cpose = (cst.mode === 'walk') ? (((st.frame >> 3) % 2) ? 'cwalk1' : 'cwalk2') : cst.act.poses[0]
    const cflip = (cst.mode === 'walk') ? (cst.tx - cst.x) < 0 : true

    if (globalThis.renderRoom && globalThis.AYUN_ROOM && globalThis.placeActor) {
      const acts = []
      // 睡在榻上时附着到床,否则按脚点排序
      // 睡觉:到位后用 sleepAt 渲染(人躺在床上,而不是站在床边),
      // zBias 3 高于抱枕的 2 —— 人睡在抱枕旁边,不该被抱枕盖住。
      // 表演态完全走引擎(stepPerform 已设 st.act=_cast + st.sayText)——
      // 掐指指针由 pointer:true 在正常路径更新 pointerA,姿态 divine 也照常。
      // 曾在这里手写一整套(双 requestAnimationFrame + 12 句台词走交互层),
      // 那是「以阿云那版为准」升级引擎时漏删的旧路径。台词已迁进 perform.lines。
      const sleeping = st.mode === 'act' && st.act.sleepAt
      const hx = sleeping ? st.act.sleepAt[0] + 40 : st.x + af(0)
      const hy = sleeping ? st.act.sleepAt[1] + 114 : st.y + af(1)
      const heroAtt = sleeping ? { attach: 'ayun_bed_couch', zBias: 3 } : {}
      acts.push(globalThis.placeActor('ayun', hx, hy, pose, flip, heroAtt))
      acts.push(globalThis.placeActor('cat', cst.x, cst.y, cpose, cflip, {}))
      globalThis.renderRoom(mainG, globalThis.AYUN_ROOM, t, acts)
      // L8 UI:可点道具的高亮与叙事气泡(交互是角色档案的出口)
      if (!cv.__interaction && globalThis.attachRoomInteraction)
        globalThis.attachRoomInteraction(cv, globalThis.AYUN_ROOM, {})
      if (globalThis.drawInteraction) globalThis.drawInteraction(mainG, globalThis.AYUN_ROOM, cv, t)
    }
    // ── 附加效果 ──
    st.fxT += dt
    if (st.mode === 'act') {
      // 角色附属绘制走引擎:房间只声明情绪,锚点由 sprite 自己算。
      // 睡姿时头在 sleepAt 上缘,不在床边的寻路终点。
      const sA = st.act.sleepAt
      const anc = globalThis.actorAnchor('ayun', pose, sA ? sA[0] : st.x, sA ? sA[1] : st.y)
      if (st.act.zzz) globalThis.drawEmote(mainG, 'zzz', anc, t)
      if (st.act.sweat && ((st.frame >> 3) % 2)) globalThis.drawEmote(mainG, 'sweat', anc, t)
      if (st.act.note && ((st.frame >> 3) % 2)) globalThis.drawEmote(mainG, 'note', anc, t)
      if (st.act.heart && ((st.frame >> 4) % 2)) globalThis.drawEmote(mainG, 'heart', anc, t)
    }

    // ── 烟汽已全部迁到资源自带 fx(丹炉/架顶香炉/立式香炉/茶壶)──
    //    此处原有一份重复绘制,起课分支会跳过它,造成「一起课烟就没了」。


    // 打游戏:屏幕内容归电视自己(room.state.gaming),手柄线与手走引擎。
    // 房间只声明状态,不碰画笔;插口位置由素材的具名锚点给出。
    globalThis.roomState(globalThis.AYUN_ROOM, { gaming: !!(st.act.tv && st.mode === 'act') })
    if (st.act.tv && st.mode === 'act') {
      const anc = globalThis.actorAnchor('ayun', pose, st.x, st.y)
      const port = globalThis.roomAnchorOf(globalThis.AYUN_ROOM, 'ayun_tv_flat', 'port')
      const hand = globalThis.actorAnchor('ayun', pose, st.x, st.y, 'hand')
      if (port) globalThis.drawLink(mainG, hand, port, { sag: 20 })
      globalThis.drawEmote(mainG, 'gamepad', anc, t)
    }

    // ── 台词气泡(3 秒消失)──
    // 气泡走引擎:折行 / 夹边 / 尾巴都在 drawSay 里,阿云用米色纸。
    const sB = st.act && st.act.sleepAt
    if (st.sayText && t < st.sayUntil)
      globalThis.drawSay(mainG, globalThis.actorAnchor('ayun', pose, sB ? sB[0] : st.x, sB ? sB[1] : st.y),
                     st.sayText, { ink: '#3a2c20', paper: '#faf2dc' })
    else if (t >= st.sayUntil) st.sayText = null
  }
  globalThis.AYUN_FRAME = frame

  // ── 宿主那一段 ────────────────────────────────────────────────
  // 以上全部与平台无关;以下三行是设计页专用的驱动。
  // 小程序侧自己取画布(wx.createSelectorQuery)、自己驱动帧,再调同一个 frame。
  if (typeof document === 'undefined') return
  const cv = document.getElementById('ayunCanvas')
  if (!cv) return
  const mainG = cv.getContext('2d')
  function loop(t) { requestAnimationFrame(loop); frame(mainG, t, cv) }
  requestAnimationFrame(loop)
})()
