
(function () {
  const cv = document.getElementById('taoCanvas')
  if (!cv) return
  const mainG = cv.getContext('2d')

  // ── 陈设:声明式房间数据 + 引擎渲染 ───────────────────────────────
  // 原先近千行硬编码陈设已拆成素材库资源(tao_* 70 件)+ 下方 plan。
  // 静态层一次性烘焙进 bg;桃桃与金毛仍逐帧画在 mainG 上,不受影响。


  window.TAO_ROOM = {
    w: 1440, h: 2560, wallH: 430, extBand: 2160,
    surfaces: { wall: 'wall_taohua', floor: 'floor_bamboo' },
    palette: { wall:'#ece4d6', wallLine:'#8a6844', floor:'#b8c294', floorLine:'#98a476', skirt:'#6e5236' },
    gradePreset: 'peach', dust: false,
    plan: [
      ['tao_moon_window',1002,53], ['tao_sword_glow',56,88], ['tao_scroll_luoshu',560,60],
      ['tao_sword_rack',218,178], ['tao_dart_target',864,195], ['tao_drape_wide',470,34],
      ['tao_drape_narrow',940,34], ['tao_lantern',60,34], ['tao_lantern',1360,34], ['tao_birdcage',876,430],
      ['tao_windchime',982,60], ['tao_sword_tassel',458,120], ['tao_yingluo',293,34],
      ['tao_yingluo',653,34], ['tao_dart_pouch',480,284], ['tao_bagua_mirror',514,152],
      ['tao_peach_sword',596,322], ['tao_polaroid_string',910,48], ['tao_rug_center',420,721],
      ['tao_rug_round',14,523], ['tao_rug_bedside',1096,868], ['tao_rug_tea',48,1370],
      ['tao_rug_study',1104,1756], ['tao_petals',136,624], ['tao_door_mat',600,1960],
      ['tao_poem_papers',706,1560], ['tao_ext_slippers',514,2284], ['tao_table_qimen',520,810],
      ['tao_cushion_pink',586,1277], ['tao_cushion_pink',796,1277], ['tao_vanity',60,407],
      ['tao_vanity_stool',146,707], ['tao_bed',1072,488], ['tao_training_post',150,860],
      ['tao_chart_wall',60,110], ['tao_shrine',130,960], ['tao_cup_shelf',420,1660], ['tao_paper_bin',540,1400], ['tao_notebook',110,1190], ['tao_lamp_desk',392,1170], ['tao_beam',980,856], ['tao_swing',1020,880], ['tao_swing_cushion',1186,1074,{"attach":"tao_swing","zBias":4}], ['tao_table_tea',90,1414], ['tao_rabbit_nest',1120,1555],
      ['tao_vase_peach',430,1344], ['tao_vase_peach',984,564],
      ['tao_clothes_rack',48,1552], ['tao_dart_case',250,1640], ['tao_wine_table',680,1604],
      ['tao_incense_burner',914,1491], ['tao_pillow_pile',916,1663], ['tao_orchid_pot',64,1032],
      ['tao_orchid_pot',1380,1382], ['tao_candy_jar_amber',430,1560], ['tao_copper_pot',464,1579],
      ['tao_lamp_gauze',1054,1740], ['tao_blanket',1098,800,{"attach":"tao_bed","zBias":2}], ['tao_wardrobe',36,716],
      ['tao_curio_shelf',1344,1090], ['tao_screen_peach',730,1782], ['tao_desk_qimen',1164,1740],
      ['tao_stool_embroidered',1238,1959], ['tao_flower_stand',950,442], ['tao_light_board', 1256, 863],
      ['tao_luopan',474,1143], ['tao_flag_holder',924,1120], ['tao_book_stack',544,1274],
      ['tao_nightstand',960,726], ['tao_headphones',1062,534,{"attach":"tao_bed","zBias":3}], ['tao_candy_jar_glass',266,1434,{"attach":"tao_table_tea","zBias":2}],
      ['tao_chips_cola',1322,826,{"attach":"tao_bed","zBias":5}], ['tao_selfie_stick',248,546], ['tao_ring_light',266,336],
      ['tao_ext_crate',906,2228],
    ],
    // ══ 表演态:点「请桃桃起一局」══
    perform: {
      actor: { x: 636, y: 700, poses: ['reach1', 'reach2'], fps: 1.0, flip: false, speed: 18 },
      button: 'taoCastBtn', labels: ['请桃桃起一局', '收局'],
      stateKey: 'casting',                      // 局桌读这个键画九宫与天盘
      lineGap: 4200,                            // 她在算，不是在演 —— 节奏放慢
      lines: ['三奇六仪……先排地盘', '值符落在哪一宫来着', '别催。催也快不了',
              '休门在北 —— 我说了算', '哼，果然是这样'],
    }
  }


  // ═══════════ 桃桃 NPC ═══════════
  const PC = {
    K: '#3a2c20', F: '#f0c8a0', E: '#4a3626', H: '#4a3a2c', q: '#c85a70', r: '#e89080',
    D: '#d84a34',
    P: '#e87a90', Y: '#ffd76a', W: '#f6efdc', Z: '#b8c4d4', O: '#e89040', C: '#c87028',
    L: '#f2d288', G: '#e6bd6e', M: '#cf9c52', S: '#b07e3c', T: '#ef8fa0',   // 金毛:亮/中/暗毛/腿影/舌
    N: '#241a10', R: '#e0485f', h: '#fff0c0', k: '#5e3f1e', e: '#7a4a24',   // 鼻眼/项圈/高光/浅描边/眼珠
  }
  const POSES = {}
  function pdef(n, s) { POSES[n] = s.trim().split('\n').map(r => r.trimEnd()) }
  // 单一数据源:角色资源用 getter 引用这两个对象,不拷贝快照。
  // 拷贝会让新姿态静默回退到 stand(PLAYBOOK §3.5)。
  window.TAO_POSES = POSES
  window.TAO_PALETTE = PC
  pdef('stand', `
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
  pdef('standside', `
...KKKK....
..KHHHHK...
..KKKKKK...
.KHHHHHHK..
.KHHHHFFFK.
KHHHHFEFFK.
KHHHFFFFFK.
KHHHFFFFFK.
.KHHFFrFFK.
..KFFFFFK..
...KKKKK...
..KPPPPK...
.KPPPPPPK..
.KPPPPPPK..
.KqPPPPqK..
...K..K....`)
  pdef('walkside1', `
...KKKK....
..KHHHHK...
..KKKKKK...
.KHHHHHHK..
.KHHHHFFFK.
KHHHHFEFFK.
KHHHFFFFFK.
KHHHFFFFFK.
.KHHFFrFFK.
..KFFFFFK..
...KKKKK...
..KPPPPK...
.KPPPPPPK..
.KPPPPPPK..
.KqPPPPqK..
...K..K....`)
  pdef('walkside3', `
...KKKK....
..KHHHHK...
..KKKKKK...
.KHHHHHHK..
.KHHHHFFFK.
KHHHHFEFFK.
KHHHFFFFFK.
KHHHFFFFFK.
.KHHFFrFFK.
..KFFFFFK..
...KKKKK...
..KPPPPK...
.KPPPPPPK..
.KPPPPPPK..
.KqPPPPqK..
..K...K....`)
  pdef('walkside2', `
...KKKK....
..KHHHHK...
..KKKKKK...
.KHHHHHHK..
.KHHHHFFFK.
KHHHHFEFFK.
KHHHFFFFFK.
KHHHFFFFFK.
.KHHFFrFFK.
..KFFFFFK..
...KKKKK...
..KPPPPK...
.KPPPPPPK..
.KPPPPPPK..
..KqPPqK...
....KK.....`)
  pdef('walkfront1', `
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
  pdef('walkfront2', `
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
    pdef('standback', `
...KK....KK.
..KHHK..KHHK
..KHHHKKHHHK
...KHHKKHHK.
..KHHHKKHHHK
..KHHHKKHHHK
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
...KHHHHHHK.
....KKKKKK..
...KPPPPPPK.
..KPPPPPPPPK
..KPPPPPPPPK
..KqqPPPPqqK
...KK....KK.`)
pdef('walkback1', `
...KK....KK.
..KHHK..KHHK
..KHHHKKHHHK
...KHHKKHHK.
..KHHHKKHHHK
..KHHHKKHHHK
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
...KHHHHHHK.
....KKKKKK..
...KPPPPPPK.
..KPPPPPPPPK
..KPPPPPPPPK
..KqqPPPPqqK
...KK....KK.`)
  pdef('walkback2', `
...KK....KK.
..KHHK..KHHK
..KHHHKKHHHK
...KHHKKHHK.
..KHHHKKHHHK
..KHHHKKHHHK
..KHHHHHHHHK
..KHHHHHHHHK
..KHHHHHHHHK
...KHHHHHHK.
....KKKKKK..
...KPPPPPPK.
..KPPPPPPPPK
..KPPPPPPPPK
..KqqPPPPqqK
..KK......KK`)
  pdef('blink', `
...KK....KK.
..KHHK..KHHK
..KHHHKKHHHK
...KHHHHHHK.
..KHHHHHHHHK
..KHFFFFFFHK
..KFFFFFFFFK
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
  pdef('breath', `
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
...KKKKKKKK.
..KPPPPPPPPK
..KPPPPPPPPK
..KPPKKKKPPK
..KqqPPPPqqK
...KPKKKPK.
...KFK.KFK.`)
  pdef('sit', `
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
..KPPPPPPPPK
.KKPPPPPPKK.
..KKKKKKKK..`)
  pdef('sleep', `
.KK..KK.........
KHHKKHHK.KKKKKK.
KHHHHHHKPPPPPPPK
KHFFFFHKPPPPPPPK
KHFKKFHKPPPPPPPK
KHrFFrHKPPPPPPPK
.KFFFFK.KKKKKK..
..KKKK..........`)
  // 桃桃垂直睡姿。头部逐字复用 stand,身体对齐【头的轴】(8.5)而非
  // sprite 居中 —— 差半列就会读成歪脖子。她是长发:头发在枕上铺开比脸宽,
  // 所以被子宽度跟着头发走,不是跟着脸走。
  pdef('sleepv', `
.....KK....KK.....
....KHHK..KHHK....
....KHHHKKHHHK....
.....KHHHHHHK.....
....KHHHHHHHHK....
..KHKHFFFFFFHKHK..
.KHHKFEFFFFEFKHHK.
.KHHKFFFFFFFFKHHK.
.KHHKFrFFFFrFKHHK.
.KHHKKFFFFFFKKHHK.
.KHHHHKKKKKKHHHHK.
.KHHHHHHHHHHHHHHK.
.KKWWWWWWWWWWWWKK.
.KPWWWWWWWWWWWWPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
..KKKKKKKKKKKKKK..`)
  pdef('sleepv2', `
.....KK....KK.....
....KHHK..KHHK....
....KHHHKKHHHK....
.....KHHHHHHK.....
....KHHHHHHHHK....
..KHKHFFFFFFHKHK..
.KHHKFEFFFFEFKHHK.
.KHHKFFFFFFFFKHHK.
.KHHKFrFFFFrFKHHK.
.KHHKKFFFFFFKKHHK.
.KHHHHKKKKKKHHHHK.
.KHHHHHHHHHHHHHHK.
.KKWWWWWWWWWWWWKK.
.KPWWWWWWWWWWWWPK.
.KPWWWWWWWWWWWWPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
.KPPPPPPPPPPPPPPK.
..KKKKKKKKKKKKKK..`)
  pdef('sword1', `
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
....KKKKKK.Z
...KPPPPPPKZ.
..KPPPPPPPPKF
..KqqPPPPqqK.
...KK....KK..`)
  pdef('sword2', `
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
...KPPPPPPK..
..KPPPPPPPPKF
..KqqPPPPqqKZ
...KK....KK.Z`)
  pdef('reach1', `
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
...KPPPPPPKFF
..KPPPPPPPPKF
..KqqPPPPqqK.
...KK....KK..`)
  pdef('reach2', `
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
...KPPPPPPK..
..KPPPPPPPPKFF
..KqqPPPPqqKF.
...KK....KK...`)
  pdef('sulk', `
...KK....KK.D.D
..KHHK..KHHK.D.
..KHHHKKHHHKD.D
...KHHHHHHK....
..KHHHHHHHHK...
..KHFFFFFFHK...
..KFEFFFFEFK...
..KFFFFFFFFK...
..KFrFFFFrFK...
...KFFFFFFK....
....KKKKKK.....
...KPPPPPPK....
..KPPPPPPPPK...
..KPPPPPPPPK...
.KKPPPPPPKK....
..KPPPPPPK.....`)
  // 兔子
  // 兔子 v2:8×8 → 10×12。多出来的格数几乎全给了耳朵 ——
  // 长耳是兔子唯一不可替代的识别特征,旧图里只有 1-2 格,读不出来。
  // 蹲坐取「小头 + 圆臀」的梨形剪影;跳姿必须与蹲姿明显不同:
  // 耳朵后倒、身体拉长、前后腿分开。
  pdef('rsit', `
..K...K...
.KPK.KPK..
.KPK.KPK..
.KPK.KPK..
.KPK.KPK..
.KKKKKKK..
.KWWWWWK..
.KWEWWEK..
.KWWNWWK..
KWWWWWWWK.
KWWWWWWWWK
.KKKKKKKK.`)
  pdef('rhop1', `
............
............
............
..KK........
.KPK........
.KPKKKK.KKK.
..KWWWWKWWWK
.KWWWWWWWEWK
KWWWWWWWWWWK
KWWKKKKKWWWK
KK.......KK.
............`)
  pdef('rsleep', `
..........
..........
..........
..........
.KKKK.....
.KKPPK....
..KKKKKK..
.KWWWWWWK.
KWWWWWWWWK
KWWWWWKWWK
KWWWWWWWWK
.KKKKKKKK.`)
  // 金毛 v14:14×12 @scale8 = 112×96,与猫同颗粒但明显更宽。
  // v13 剪影没立住 —— 头和身子一样宽,每个姿态都是同一个圆角矩形,
  // 耳/吻/尾全埋在色块里。v14 把四要素放到轮廓上:
  //   垂耳比头骨更宽(第 2-4 行是头部最宽处)· 吻部收窄 · 脖子更窄
  //   (项圈在此)· 尾巴 2×3 的蓬松羽状,左/藏/右三档摆。
  pdef('dsit', `
....KKKKKK....
..KKLLLLLLKK..
.KSSLLLLLLSSK.
.KSSLeWLLeWSK.
.KSSLLLNNLLSK.
..KKLLLNNLKK..
...KLLLTTLK...
....KKLLKK....
....KRRRRK....
KGKGGGGGGGGK..
KGKGGGGGGGGK..
..KKLLKKLLKK..`)
  pdef('dsitC', `
....KKKKKK....
..KKLLLLLLKK..
.KSSLLLLLLSSK.
.KSSLeWLLeWSK.
.KSSLLLNNLLSK.
..KKLLLNNLKK..
...KLLLTTLK...
....KKLLKK....
....KRRRRK....
..KGGGGGGGGK..
..KGGGGGGGGK..
..KKLLKKLLKK..`)
  pdef('dsit2', `
....KKKKKK....
..KKLLLLLLKK..
.KSSLLLLLLSSK.
.KSSLeWLLeWSK.
.KSSLLLNNLLSK.
..KKLLLNNLKK..
...KLLLTTLK...
....KKLLKK....
....KRRRRK....
..KGGGGGGGGKGK
..KGGGGGGGGKGK
..KKLLKKLLKK..`)
  pdef('ddn1', `
....KKKKKK....
..KKLLLLLLKK..
.KSSLLLLLLSSK.
.KSSLeWLLeWSK.
.KSSLLLNNLLSK.
..KKLLLNNLKK..
...KLLLLLLK...
....KKLLKK....
....KRRRRK....
..KGGGGGGGGK..
..KGGGGGGGGK..
..KLLK..KLK...`)
  pdef('ddn2', `
....KKKKKK....
..KKLLLLLLKK..
.KSSLLLLLLSSK.
.KSSLeWLLeWSK.
.KSSLLLNNLLSK.
..KKLLLNNLKK..
...KLLLLLLK...
....KKLLKK....
....KRRRRK....
..KGGGGGGGGK..
..KGGGGGGGGK..
...KLK..KLLK..`)
  pdef('dup1', `
....KKKKKK....
..KKLLLLLLKK..
.KSSLLLLLLSSK.
.KSSLLLLLLSSK.
.KSSLLLLLLSSK.
..KKLLLLLLKK..
...KLLLLLLK...
....KKLLKK....
KGK.KRRRRK....
KGKGGGGGGGGK..
KGKGGGGGGGGK..
..KKLLKKLLKK..`)
  pdef('dupC', `
....KKKKKK....
..KKLLLLLLKK..
.KSSLLLLLLSSK.
.KSSLLLLLLSSK.
.KSSLLLLLLSSK.
..KKLLLLLLKK..
...KLLLLLLK...
....KKLLKK....
....KRRRRK....
..KGGGGGGGGK..
..KGGGGGGGGK..
..KKLLKKLLKK..`)
  pdef('dup2', `
....KKKKKK....
..KKLLLLLLKK..
.KSSLLLLLLSSK.
.KSSLLLLLLSSK.
.KSSLLLLLLSSK.
..KKLLLLLLKK..
...KLLLLLLK...
....KKLLKK....
....KRRRRK.KGK
..KGGGGGGGGKGK
..KGGGGGGGGKGK
..KKLLKKLLKK..`)
  pdef('dsw1', `
............KK..
..KK.......KLLK.
.KGK......KLLLLK
.KGK.....KLLSSLN
.KGKKKKKKLLLSSLN
.KGGGGGGGGGLeWLK
.KGGGGGGGGGGLLK.
.KGGGGGGGGGGGK..
.KKLLKGGGGKLLK..
..KLLK...KLLK...
..KKK.....KKK...`)
  pdef('dsw2', `
............KK..
..KK.......KLLK.
.KGK......KLLLLK
.KGK.....KLLSSLN
.KGKKKKKKLLLSSLN
.KGGGGGGGGGLeWLK
.KGGGGGGGGGGLLK.
.KGGGGGGGGGGGK..
.KKLLKGGGGKLLK..
...KLLK.KLLK....
...KKK...KKK....`)
  pdef('dbeg', `
....KKKKKK....
..KKLLLLLLKK..
.KSSLLLLLLSSK.
.KSSLeWLLeWSK.
.KSSLLLNNLLSK.
..KKLLLNNLKK..
...KLLLTTLK...
....KKLLKK....
KLK.KRRRRK.KLK
KLK.KGGGGK.KLK
.KKGGGGGGGGKK.
..KKLLKKLLKK..`)
  // 桃桃的脚点偏移 —— 取自角色资源。此前这里引用的 af 定义在阿云那个
  // IIFE 里,桃桃房根本取不到:说话气泡与金毛追球每帧抛 ReferenceError。
  const af = i => window.ACTORS.tao.foot[i]

  // 路网(绕中央桌)

  const ACTS = [
    { id: 'board',  node: 'L2', x: 400, y: 940,  poses: ['reach1', 'reach2'], fps: 1.2, dur: [6, 9],  flip: true,  w: 3, say: '今日休门在北……嗯' },
    { id: 'sword',  node: 'L2', x: 260, y: 900,  poses: ['sword1', 'sword2'], fps: 1.8, dur: [5, 8],  flip: false, say: '哈！' },
    { id: 'mirror', node: 'L1', x: 180, y: 600,  poses: ['sit'],              fps: 1,   dur: [6, 9],  flip: false, say: '……还行吧' },
    { id: 'eat',    node: 'L3', x: 170, y: 1300, poses: ['reach1', 'reach2'], fps: 0.8, dur: [4, 7],  flip: false, say: '唔，甜' },
    { id: 'swing',  node: 'R2', x: 1086, y: 1148, poses: ['sit'],             fps: 1,   dur: [8, 12], flip: false, sway: true, w: 2 },
    { id: 'rabbit', node: 'R3', x: 1060, y: 1500,poses: ['reach1', 'reach2'], fps: 1,   dur: [4, 6],  flip: true,  heart: true, w: 2, say: '软乎乎……' },
    { id: 'bed',    node: 'R1', x: 1000, y: 740, poses: ['sleepv', 'sleepv2'], fps: 0.35, dur: [10, 14], flip: false, zzz: true,
      // 寻路终点留在床外 —— 人不该在床上走;到位后切 sleepAt 直接落到床心。
      // 1245(床面 x1098..1392 的中心)− 72(sprite 18 列 ×8 的一半)= 1173。
      sleepAt: [1173, 508], w: 3 },
    { id: 'sulk',   node: 'L3', x: 90,  y: 1780, poses: ['sulk'],             fps: 1,   dur: [6, 9],  flip: false, circle: true, w: 2, say: '哼' },
    { id: 'pace',   node: 'M3', x: 520, y: 1540, poses: null, pace: [500, 940], dur: [6, 9], say: '局是死的，人是活的……' },
    { id: 'live',   node: 'L1', x: 560, y: 620,  poses: ['reach1', 'reach2'], fps: 1.4, dur: [70, 110], flip: true, heart: true, w: 7,
      // 一场直播七十秒到两分钟 —— 她的主业，不该几秒就散场。
      // 台词轮播:先招呼，再接单，再毒舌，偶尔露一点真的。
      say: [
        '家人们，点个小红心',
        '问事的排队，一个一个来',
        '这位……你自己心里有数吧',
        '奇门不是算命，是算【时机】。记好了',
        '哎那个刷礼物的，不用刷，说事就行',
        '今天休门在北。要出门的往那边走',
        '不准？不准你来找我啊，哼',
        '……谢谢。不用谢，我是说下一位',
        '别问感情。感情我不算',
        '在的在的，我没走神',
      ] },
  ]
  const st = {
    mode: 'act', act: ACTS[0], x: 400, y: 940, node: 'L2', path: [],
    until: performance.now() + 5000, frame: 0, tx: 0, ty: 0,
    paceDir: 1, sayText: null, sayUntil: 0,
  }
  // 选行为归引擎。cast 用 exclude 标记（按钮驱动、dur 999 秒，随机选中会把她钉住）
  function pick() { return window.pickAct(ACTS, st.act) }
  // ── 起一局:按钮驱动 ────────────────────────────────────────────
  // 与阿云的「起课」同构 —— 不瞬移，她从当前位置【走】到局桌北，到位才开始排盘。
  // 起局中念念有词：一句一句轮，不是一条重复。
  let TAO_PERF = null
  function startWalk(a) { window.startWalkTo(st, a, window.TAO_ROOM, 'tao') }

  // 兔子(轻量:3 锚点直线)
  // 兔子锚点。此前睡觉权重 4/7 且每次 18-30 秒,绝大多数时间不动,
  // rhop1 几乎没机会出现;睡姿又正压在草窝正中,白色蜷缩体贴在浅色
  // 草窝上没有轮廓 —— 三个原因叠起来就是「一直没见到」。
  // 现在三态权重相当、时长缩短(转场变多 = 跳跃真的看得到),
  // 睡姿错开窝心,让耳朵与头部露在草窝上沿之外。
  const RACTS = [
    { id: 'rs', x: 1160, y: 1500, poses: ['rsleep'], dur: [6, 10], w: 2, zzz: true },
    { id: 'rn', x: 1090, y: 1600, poses: ['rsit'],   dur: [5, 9],  w: 2 },
    { id: 'rp', x: 560,  y: 1720, poses: ['rsit'],   dur: [5, 9],  w: 2 },
  ]
  const rst = { mode: 'act', act: RACTS[0], x: 1160, y: 1500, until: performance.now() + 4000, tx: 0, ty: 0 }
  // ═══ 金毛:行为状态机(漫步四方向 · 坐/趴/眨眼 · 追球 · 跟主人献媚)═══
  // 开阔地锚点(避家具:围棋桌/屏风/床/衣柜等)
  // 开阔地锚点(全部在中下空地矩形内,避开围棋桌/屏风/梳妆台/床/衣柜)
  const DZONE = { x0: 480, x1: 1000, y0: 1340, y1: 1520 }
  const dclampX = x => Math.max(DZONE.x0, Math.min(DZONE.x1, x))
  const dclampY = y => Math.max(DZONE.y0, Math.min(DZONE.y1, y))
  const DSPOTS = [[600, 1380], [820, 1400], [960, 1460], [700, 1480], [900, 1500], [520, 1440]]
  const dog = {
    x: 620, y: 1560, tx: 620, ty: 1560, state: 'sit', dir: 'dn', flip: false,
    frame: 0, until: performance.now() + 4000, ball: null, chases: 0, say: '', sayUntil: 0,
  }
  // 狗的三种去向写成【追逐规格】，由引擎的 stepPursuit 解目标并推进：
  // 去开阔地 = 追一个点、跑到主人脚边 = 追一个角色、追球 = 追一件道具。
  // 三者只差 target.kind —— 这正是 stepPursuit 当初被造出来要表达的东西。
  function dogNextIdle(t) {
    const r = Math.random()
    const spot = () => DSPOTS[(Math.random() * DSPOTS.length) | 0]
    if (r < 0.42) {
      const sp = spot()
      dog.spec = { target: { kind: 'spot', x: sp[0], y: sp[1] },
                   approach: { offset: [0, 0], speed: 7 } }
      dog.after = 'sit'
    } else if (r < 0.72) {
      dog.spec = { target: { kind: 'actor', id: 'tao' },
                   approach: { offset: [70, 40], speed: 7 } }
      dog.after = 'beg'
    } else {
      const sp = spot()
      dog.ball = { x: dclampX(sp[0]), y: dclampY(sp[1]) }; dog.chases = 0
      dog.spec = { target: { kind: 'prop', id: 'ball' },
                   approach: { offset: [-af(0), 20], speed: 7 } }
      dog.after = 'ball'
    }
    dog.state = 'roam'
  }
  function pickR() { return window.pickAct(RACTS, rst.act) }

  let lastT = 0
  function loop(t) {
    requestAnimationFrame(loop)
    if (t - lastT < 50) return
    lastT = t; st.frame++

    if (st.mode === 'act') {
      if (t > st.until) startWalk(pick())
      if (st.act.pace) {
        window.stepPace(st, st.act.pace, 4)
      }
    } else {
      // 推进与取下一路径点归引擎；速度 11 与阿云一致 —— 她比他更急，没道理慢一半
      if (window.stepWalk(st, st.act.speed || 11)) {
        st.mode = 'act'
        const [d0, d1] = st.act.dur
        st.until = t + (d0 + Math.random() * (d1 - d0)) * 1000
        // 直播中持续说话：每 4.5 秒换一句。一场三十多秒只吭一声不像在直播。
        if (st.act.id === 'live') st.chatUntil = t
        // say 可以是一句，也可以是一组 —— 直播要说很多话，一句循环三十秒会假。
        if (st.act.say && Math.random() < 0.55) {
          const L = st.act.say
          st.sayText = Array.isArray(L) ? L[(Math.random() * L.length) | 0] : L
          st.sayUntil = t + 2800
        }
      }
    }
    // 兔子
    if (rst.mode === 'act') {
      // 兔子也走网格寻路 —— 原先直接设 tx/ty 直线走，会穿过家具
      if (t > rst.until) window.startWalkTo(rst, pickR(), window.TAO_ROOM, 'rabbit', { foot: [0, 0] })
    } else if (window.stepWalk(rst, 4)) {
      {
        rst.mode = 'act'
        const [d0, d1] = rst.act.dur
        rst.until = t + (d0 + Math.random() * (d1 - d0)) * 1000
      }
    }
    // 金毛行为
    dog.frame++
    if (dog.state === 'roam') {
      // 推进交给引擎的 stepPursuit：它解目标(点/角色/道具)、按 offset 与 speed 走一步，
      // 返回 'move' | 'arrive' | 'idle'。房间只负责朝向与到达后做什么。
      const world = {
        actors: { tao: { x: st.x + af(0), y: st.y + af(1) } },
        props:  { ball: dog.ball || null },
      }
      const res = window.stepPursuit(dog, dog.spec || {}, world, t,
        { x: dclampX, y: dclampY })
      const dx = dog.tx - dog.x, dy = dog.ty - dog.y
      dog.dir = Math.abs(dx) > 6 ? 'side' : (dy > 0 ? 'dn' : 'up')   // 只有近乎纯垂直才正/背面
      if (dog.dir === 'side') dog.flip = dx < 0
      if (res === 'move') { /* 还在路上 */ }
      else {                                                  // 到达(或无目标)
        const after = dog.after; dog.after = null
        if (after === 'beg') { dog.state = 'beg'; dog.until = t + (3 + Math.random() * 3) * 1000; if (Math.random() < 0.6) { dog.say = '汪♪'; dog.sayUntil = t + 2200 } }
        else if (after === 'ball') {
          if (dog.chases < 3 && dog.ball) {                   // 把球拱到新位置,继续追
            dog.chases++
            const nb = DSPOTS[(Math.random() * DSPOTS.length) | 0]
            // 只需把球挪走 —— 追逐规格盯的是球本身，球一动，追逐自然跟上。
            // 目标由 dogNextIdle 写进 dog.spec，stepPursuit 每帧从 spec 重设，把它覆盖了。
            dog.ball = { x: dclampX(nb[0]), y: dclampY(nb[1]) }
            dog.state = 'roam'; dog.after = 'ball'
            if (Math.random() < 0.5) { dog.say = '汪！'; dog.sayUntil = t + 1500 }
          } else { dog.ball = null; dog.state = 'sit'; dog.until = t + 3000 }
        }
        else { dog.state = 'sit'; dog.until = t + (4 + Math.random() * 4) * 1000 }
      }
    } else {                                                  // sit / lie / beg
      if (t > dog.until) dogNextIdle(t)
    }

    // ── 姿态先算,再交给引擎排序 ────────────────────────────────
    // 兔子 / 金毛 / 球都是可动实体,和家具进同一个排序空间:
    // 狗因此能从球前面或后面经过,秋千能排在坐着的人身后。
    const rpose = rst.mode === 'walk' ? (((st.frame >> 2) % 2) ? 'rhop1' : 'rsit') : rst.act.poses[0]
    let dpose, dflip = false
    const f2 = (dog.frame >> 2) % 2
    const wag4 = (dog.frame >> 2) % 4   // 摇尾 4 步:左→中→右→中,平滑
    if (dog.state === 'roam') {
      if (dog.dir === 'side') { dpose = f2 ? 'dsw2' : 'dsw1'; dflip = dog.flip }
      else if (dog.dir === 'dn') dpose = f2 ? 'ddn2' : 'ddn1'
      else dpose = ['dup1', 'dupC', 'dup2', 'dupC'][wag4]   // 背面走:尾巴平滑摆
    } else if (dog.state === 'beg') dpose = 'dbeg'
    else dpose = ['dsit', 'dsitC', 'dsit2', 'dsitC'][wag4]  // idle 坐:尾巴平滑摆
    const dbob = (dog.state === 'sit' || dog.state === 'beg') ? Math.round(Math.sin(t / 600) * 2) : 0

    // 房间状态:秋千上有人时摆幅大一点,由家具自己读
    window.roomState(window.TAO_ROOM, {
          swinging: !!(st.mode === 'act' && st.act.sway),
          // 开播 = 屏风展开当背景；收工 = 折起，把证据那半挡回去。
          // 状态放在房间上而非屏风内部，别处（台词、色温）才读得到。
          streaming: st.mode === 'act' && st.act.id === 'live',
          // 起局中：局桌自己读这个状态画九宫与天盘，房间不碰画笔。
          // casting 由引擎的表演态在【到位那一刻】置位 —— 先前每帧重算，
          // 意味着她一被派去起局就算在演，走过去那一路也被算了进去
        })

    // ── 表演态:玩家点「请桃桃起一局」──────────────────────────
    if (!TAO_PERF) {
      TAO_PERF = window.wirePerform(window.TAO_ROOM)
      // 行为表挂到房间对象上 —— 它和 plan / perform 一样是【房间数据】。
      // 从前它只是 IIFE 里的局部变量,闭包外一个字都看不到,`pathlint` 这类
      // 门禁于是无从下手:锚点在不在家具里、路径穿不穿家具,都要拿到这张表才查得了。
      // 挂在【首帧接线】这里,与 wirePerform 并列 —— 房间脚本执行的那一刻,
      // 阿云的 ROOM 对象还在另一个 script 块里没定义,桃桃的 RACTS、婆婆的
      // PETS 也还在 const 的暂时性死区里。到 rAF 第一帧,这些才都齐了。
      // anchorIsFoot:宠物的锚点【本身就是脚点】,主角的是 sprite 左上角 ——
      // startWalkTo 靠 { foot:[0,0] } 区分这两种语义,这里如实标注。
      window.TAO_ROOM.acts = [{ actor: 'tao', list: ACTS }, { actor: 'rabbit', list: RACTS, anchorIsFoot: true }]
    }
    window.stepPerform(window.TAO_ROOM, st, t, { startWalk, pick })

    // ── 桃桃:与家具同为可排序实体 ──────────────────────────────
    // 姿态属于行为系统,先算;绘制交给引擎,她因此与柜/床/秋千一起 y-sort。
    let pose, flip = false, drawX = st.x, drawY = st.y
    if (st.mode === 'walk') {
      const wp = window.walkPose(st, { rate: 2 })   // 走位姿态归引擎；rate 是本角色的步频
      pose = wp.pose; flip = wp.flip
    } else if (st.act.pace) {
      pose = ((st.frame >> 2) % 2) ? 'walkside1' : 'walkside3'
      flip = st.paceDir < 0
    } else {
      const ps = st.act.poses
      pose = ps[((st.frame * st.act.fps / 20) | 0) % ps.length]
      flip = st.act.flip
      if (st.act.sway)   // 坐在秋千上:摆动量问秋千要,房间不另算一份
        drawX = st.x + window.ASSETS.tao_swing.swayAt(window.TAO_ROOM.state || {}, t)
    }
    // 睡觉:到位后改用 sleepAt 落位 —— 人躺在床心,不是站在床边的寻路终点。
    const sleeping = st.mode === 'act' && st.act.sleepAt
    if (sleeping) { drawX = st.act.sleepAt[0]; drawY = st.act.sleepAt[1] }
    pose = window.idlePose(st, pose, 'tao')
    // 躺在床上 / 坐在秋千里时随宿主排序,否则会被自己正躺着的那件家具挡住。
    const taoAtt = sleeping   ? { attach: 'tao_bed',   zBias: 6 }
                 : st.act.sway ? { attach: 'tao_swing', zBias: 1 }
                 : {}

    const ents = []
    const rs = window.actorSprite('rabbit', rpose, false)
    ents.push(window.placeActor('rabbit', rst.x + rs.width / 2, rst.y + rs.height,
                                rpose, (rst.tx - rst.x) < 0, {}))
    if (dog.ball) {
      const bb = Math.abs(Math.sin(t / 180)) * 6
      ents.push(window.placeProp('tao_ball', dog.ball.x + 20, dog.ball.y - bb, {}))
    }
    const ds = window.actorSprite('dog', dpose, dflip)
    ents.push(window.placeActor('dog', dog.x + ds.width / 2, dog.y + dbob + ds.height,
                                dpose, dflip, {}))
    ents.push(window.placeActor('tao', drawX + af(0), drawY + af(1), pose, flip, taoAtt))
    window.renderRoom(mainG, window.TAO_ROOM, t, ents)
    // L8 UI:可点道具的高亮与叙事气泡。**交互是角色档案的出口** ——
    // 这一句此前【完全没接】,于是四十多件素材声明了 clickable/say 却一件都点不到。
    // 「素材有属性」和「交互接上了」是两件事,PLAYBOOK §4.10 的老账又犯一次。
    if (!cv.__interaction && window.attachRoomInteraction) window.attachRoomInteraction(cv, window.TAO_ROOM, {})
    if (window.drawInteraction) window.drawInteraction(mainG, window.TAO_ROOM, cv, t)



    if (rst.mode === 'act' && rst.act.zzz)
      window.drawEmote(mainG, 'zzz', window.actorAnchor('rabbit', rpose, rst.x, rst.y), t)
    if (dog.sayUntil > t)
      window.drawSay(mainG, window.actorAnchor('dog', dpose, dog.x, dog.y), dog.say || '汪',
                     { ink: '#3a2c20', paper: '#f6efdc' })


    // 角色附属绘制全部走引擎:房间只声明「谁 · 在哪 · 什么情绪 · 说什么」。
    // 锚点由 sprite 自己算,不写 st.x + 40 这类换算 —— 姿态宽度一变就会错。
    const anc = window.actorAnchor('tao', pose, drawX, drawY)
    if (st.mode === 'act') {
      if (st.act.zzz) window.drawEmote(mainG, 'zzz', anc, t)
      if (st.act.heart && ((st.frame >> 4) % 2)) window.drawEmote(mainG, 'heart', anc, t)
      if (st.act.circle) window.drawEmote(mainG, 'sulk', anc, t)
    }
      // 桃桃的台词纸=淡粉（直播少女）。三房各一色：阿云米、桃桃粉、婆婆紫。
      const TAO_SAY = { ink: '#5a2a44', paper: '#fdf0f5' }
      if (st.act && st.act.id === 'live' && st.mode === 'act' && Array.isArray(st.act.say)) {
        // 直播中一直在说 —— 每 4.5 秒换一句，按时间轮，不随机跳
        window.drawSay(mainG, anc, st.act.say[Math.floor(t / 4500) % st.act.say.length], TAO_SAY)
      } else if (st.sayText && t < st.sayUntil) window.drawSay(mainG, anc, st.sayText, TAO_SAY)
      else if (t >= st.sayUntil) st.sayText = null
  }
  requestAnimationFrame(loop)
})()
