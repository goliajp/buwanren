
// ══ B3g 沈砚家 · 落第斋 —— S4 骨架(墙地 + 光 + 四件定调大件,还是空房)══
;(function () {
  /* 这支脚本【不碰浏览器】。取画布、驱动帧是宿主的事,在文件末尾单独一段:
     设计页那段用 document + requestAnimationFrame,小程序那边用它自己的。
     中间这一大段(姿态、表演、房间、每帧算什么)两边共用,一个字不改。 */

  /* ── 姿态 ────────────────────────────────────────────────────────
     侧 / 背 / 两个走路帧二在设计规范 B0 里已经画好(codexPoses 会取过来),
     这里只画规范【没有】的:正面,以及他在这间房里真正会做的几件事。
     一律 16 行 × 12 列,与规范的侧背图同格,否则同一个人换个朝向就变了体型。
     调色板沿用规范:K 描边 · H 发 · A/a 儒巾 · F 肤 · E 目 · r 唇 · C/c 蓝袍。
     房间另补三色:W 纸 · N 笔杆 · I 墨。 */
  const PS = { W: '#f2ece0', N: '#8a7a5c', I: '#1b1714' }
  const POSES = {}
  globalThis.SHENYAN_POSES = POSES
  globalThis.SHENYAN_PALETTE = PS
  function pdef(name, s) { POSES[name] = s.trim().split('\n').map(r => r.trimEnd()) }

  /* ── 猫的姿态 ────────────────────────────────────────────────
     一开始想复用阿云房那套(csit/csleep/cwalk1/cwalk2/cstretch),但那套本身就是欠账:
     走姿的身体是一条 11 格长的横杠、四条腿是单像素竖线,读出来是腊肠不是猫。
     复用等于把欠账带过来,所以这里另画。

     猫走路最强的识别特征是【尾巴竖起来】—— 先立住这一条,其余才谈得上像。
     另外身体要短而厚(体长 ≈ 体高的 2.5 倍,不是 3 倍以上)、头要占得住、
     腿要有两格宽度。基准朝向一律【朝右】(引擎规范),房间给的 flip 表示是否反向。

     大橘另有一套,大一圈 —— 它是大橘,尺寸参照桃桃房的金毛。
     调色板键:O 主毛 · C 耳内 · E 眼 · P 鼻 · W 腹白 · K 描边。 */
  const CATP = {}
  globalThis.SHENYAN_CATPOSES = CATP
  function cdef(name, s) { CATP[name] = s.trim().split('\n').map(r => r.trimEnd()) }

  // ── 常规体型(狸花 · 小猫)──
  cdef('csit', `
..KK.....KK..
.KOOK...KOOK.
.KOCOKKKOCOK.
..KOOOOOOOOK.
..KOEOOOOEOK.
..KOOOPOOOOK.
...KOOOOOOK..
..KOWWWWWWOK.
..KOWWWWWWOK.
..KOOOOOOOOK.
..KKOOOOOOKK.
...KK....KK..`)

  cdef('csleep', `
.....KKKK....
...KKOOOOKK..
..KOCOOOOCOK.
.KOOEOOOOOOK.
KOOOOOOOOOOOK
KOOWWWWOOOOOK
.KOOOOOOOOOK.
..KKKKKKKKK..`)

  cdef('cwalk1', `
.KK..........
KOOK.........
KOOK.........
KOOK.....KK..
KOOK....KOOK.
.KOK...KOCOOK
.KOKKKKOOOOOK
.KOOOOOOOOEOK
.KOOOOOOOOPOK
.KOOOOOOOOOK.
..KOKKOKKOK..
..KK..K..KK..`)

  cdef('cwalk2', `
.KK..........
KOOK.........
KOOK.........
KOOK.....KK..
KOOK....KOOK.
.KOK...KOCOOK
.KOKKKKOOOOOK
.KOOOOOOOOEOK
.KOOOOOOOOPOK
.KOOOOOOOOOK.
..KKOKOKKOKK.
...KOK.KO.K..`)

  cdef('cstretch', `
.KK..........
KOOK.........
KOOK.....KK..
KOOK....KOOK.
.KOK...KOCOOK
.KOKKKKOOOOOK
.KOOOOOOOOEOK
KOOOOOOOOOPOK
KOOOOOOOOOOK.
.KKOKKKKOKK..
..K.K...K.K..`)

  // ── 大橘:大一圈,而且胖。尺寸参照桃桃房的金毛 ──
  cdef('gsit', `
..KK.......KK..
.KOOK.....KOOK.
.KOCOKKKKKOCOK.
..KOOOOOOOOOOK.
..KOEOOOOOOEOK.
..KOOOOPOOOOOK.
...KOOOOOOOOK..
..KOWWWWWWWWOK.
.KOWWWWWWWWWWOK
.KOWWWWWWWWWWOK
.KOOOOOOOOOOOOK
..KKOOOOOOOOKK.
...KK......KK..`)

  cdef('gsleep', `
......KKKKK.....
....KKOOOOOKK...
..KKOCOOOOOCOK..
.KOOOEOOOOOOOOK.
KOOOOOOOOOOOOOOK
KOOWWWWWOOOOOOOK
KOOWWWWWOOOOOOOK
.KOOOOOOOOOOOOK.
..KKKKKKKKKKKK..`)

  cdef('gwalk1', `
.KK.............
KOOK............
KOOK............
KOOK.......KK...
KOOK......KOOK..
.KOK.....KOCOOK.
.KOKKKKKKOOOOOOK
.KOOOOOOOOOOEOOK
KOOOOOOOOOOOPOOK
KOOOOOOOOOOOOOK.
.KOOOOOOOOOOOK..
..KOKKOKKKOKK...
..KK..K..KK.....`)

  cdef('gwalk2', `
.KK.............
KOOK............
KOOK............
KOOK.......KK...
KOOK......KOOK..
.KOK.....KOCOOK.
.KOKKKKKKOOOOOOK
.KOOOOOOOOOOEOOK
KOOOOOOOOOOOPOOK
KOOOOOOOOOOOOOK.
.KOOOOOOOOOOOK..
..KKOKOKKOKKK...
...KOK.KO..K....`)

  cdef('gstretch', `
.KK.............
KOOK.......KK...
KOOK......KOOK..
KOOK.....KOCOOK.
.KOKKKKKKOOOOOOK
.KOOOOOOOOOOEOOK
KOOOOOOOOOOOPOOK
KOOOOOOOOOOOOOK.
.KKOKKKKKOKKK...
..K.K....K.K....`)

  /* 正面 —— 【逐格照抄规范】,只做了一次居中平移(内容原本贴在右侧,
     左移 3 格、裁到 12 列与 side/back 同格),一个像素没改。

     规范的正面在 CSS 精灵 .spr-shenyan 的 ::after box-shadow 里(图鉴卡渲染用的就是它),
     不在 FRONT_OVR —— 我 grep 了后者没找到,就一路自己画,连错三版:
       ① 腮红画成了中间的嘴、眼睛用纯黑(规范用发色)
       ② 改成「照它的画法自己画」—— 那还是自己画,16 行里 15 行对不上
       ③ 结构根本不同:规范的身子只有 4 行、袖子中间有 K 分隔两条袖,我画了 6 行实心
     像素图就该一格一格抄。要参照请用 globalThis.codexFront(id) 取出来对照。

     调色板键与规范一一对应(颜色完全相同):A→K · B→a · C→H · D→F · E→r · F→C · G→A */

  pdef('stand', `
............
...KKKKKK...
..KaaaaaaK..
..KKKKKKKK..
..KHHHHHHK..
..KHFFFFHK..
..KFHFFHFK..
..KFFFFFFK..
..KFrFFrFK..
...KFFFFK...
...KKKKKK...
...KCCCCK...
..KCKCCKCK..
..KCKKKKCK..
..KAAAAAAK..
...K....K...`)

  // 站着时的两个微动。idlePose 按名字找 breath / blink,
  // 没画就永远僵着 —— 桃桃的 breath 曾与 stand 像素相同,四人里唯一不呼吸的
  pdef('breath', `
............
...KKKKKK...
..KaaaaaaK..
..KKKKKKKK..
..KHHHHHHK..
..KHFFFFHK..
..KFHFFHFK..
..KFFFFFFK..
..KFrFFrFK..
...KFFFFK...
...KKKKKK...
...KCCCCK...
..KCKKKKCK..
..KAAAAAAK..
...K....K...`)

  pdef('blink', `
............
...KKKKKK...
..KaaaaaaK..
..KKKKKKKK..
..KHHHHHHK..
..KHFFFFHK..
..KFKFFKFK..
..KFFFFFFK..
..KFrFFrFK..
...KFFFFK...
...KKKKKK...
...KCCCCK...
..KCKCCKCK..
..KCKKKKCK..
..KAAAAAAK..
...K....K...`)

  pdef('walkfront1', POSES.stand.join('\n'))

  // 正面走路:帧一就是站姿(站-迈-站-迈的循环),帧二【只改末行】——
  // 两块腿合并居中 = 迈出去的那一步。写成 walkfront2 = walkfront1 会让他平移滑行。
  pdef('walkfront2', `
............
...KKKKKK...
..KaaaaaaK..
..KKKKKKKK..
..KHHHHHHK..
..KHFFFFHK..
..KFHFFHFK..
..KFFFFFFK..
..KFrFFrFK..
...KFFFFK...
...KKKKKK...
...KCCCCK...
..KCKCCKCK..
..KCKKKKCK..
..KAAAAAAK..
.....KK.....`)

  /* 跪坐 = 站姿【删掉肩线那一行】,顶上补一行空。其余一格不动 —— 连脚都照抄。
     那一行 `...KKKKKK...` 在坐姿里读成一截脖子,人一坐下本来就是缩着的。
     走过弯路,记在这儿:照丹增打坐重画袍子(8px 一格下糊成一团蓝)、
     身子砍到三行(头大身小像不倒翁)、末行的脚换成下摆(下半身成了一块板)。
     **改一行就够了,多改一个字都是错的。** */
  pdef('sit', `
............
...KKKKKK...
..KaaaaaaK..
..KKKKKKKK..
..KHHHHHHK..
..KHFFFFHK..
..KFHFFHFK..
..KFFFFFFK..
..KFrFFrFK..
...KFFFFK...
...KCCCCK...
..KCKCCKCK..
..KCKKKKCK..
..KAAAAAAK..
...K....K...`)

  // 伏案写字:侧向。正面画不出「前倾」——低头、弓背、手臂前伸执笔,
  // 三件事只有侧影说得清。姿态里【不画案面】——案是房间里的真素材,画了会撞
  // 这三件事只有侧影说得清。帧二笔落低一格,是落笔的那一下
  pdef('write1', `
............
............
...KAAAAK...
..aKaAAAK...
..KKKKKKKK..
..KHHHHFFK..
.KHHHHFFFFK.
.KHHHFEFFFK.
.KHHFFrFFK..
..KKKKKKK...
..KCCcCKFFN.
.KCCCcCCKKI.
.KCCCcCCCK..
.KCCCcCCCK..
.KcCCCCCcK..
..KKKKKKK...`)

  pdef('write2', `
............
............
...KAAAAK...
..aKaAAAK...
..KKKKKKKK..
..KHHHHFFK..
.KHHHHFFFFK.
.KHHHFEFFFK.
.KHHFFrFFK..
..KKKKKKK...
..KCCcCK....
.KCCCcCCKFFN
.KCCCcCCCKKI
.KCCCcCCCK..
.KcCCCCCcK..
..KKKKKKK...`)

  // 捧着抄本读 —— 书要探出身体轮廓,两手扶在书两侧。
  // 书夹在身体里面就只剩一条白腰带,读不出是本书
  pdef('read', `
............
...KKKKKK...
..KaaaaaaK..
..KKKKKKKK..
..KHHHHHHK..
..KHFFFFHK..
..KFHFFHFK..
..KFFFFFFK..
..KFrFFrFK..
...KFFFFK...
...KKKKKK...
...KCCCCK...
KFKWWWWWWKFK
KFKWWWWWWKFK
..KAAAAAAK..
...K....K...`)

  // 站在推号墙前指点。手臂整条斜伸到最右上 —— 抬手要看得见抬,
  // 只在袖口加一小块肤色是看不出来的
  pdef('point1', `
...KAAAAK...
..aKaAAAK...
..KKKKKKK...
..KHHHHHHK..
.KHHHHHFFFK.
.KHHHHFFFFK.
.KHHHHFEFFK.
.KHHHFFrFFK.
..KHHFFFFK.F
...KKKKKKKC.
...KCCcCKC..
..KCCCcCCK..
..KCCCcCCK..
..KCCCcCCK..
..KcCCCCcK..
...KK.KK....`)

  pdef('point2', `
...KAAAAK...
..aKaAAAK...
..KKKKKKK...
..KHHHHHHK..
.KHHHHHFFFK.
.KHHHHFFFFK.
.KHHHHFEFFK.
.KHHHFFrFFK.
..KHHFFFFK..
...KKKKKKKF.
...KCCcCKKC.
..KCCCcCCKC.
..KCCCcCCK..
..KCCCcCCK..
..KcCCCCcK..
...KK.KK....`)

  // 仰着头盯开奖屏。整个头往后错一格、下巴翘起来 ——
  // 全屋只有这一处他会抬头,那是他唯一还在指望的东西
  pdef('gaze', `
............
............
..KAAAAK....
.aKaAAAK....
.KKKKKKK....
.KHHHHHHK...
.KHHHHHFFK..
..KHHHFEFFK.
..KHHFFFrFK.
...KKKKKKK..
...KCCcCK...
..KCCCcCCK..
..KCCCcCCK..
..KCCCcCCK..
..KcCCCCcK..
...KK.KK....`)

  // 睡在竹榻上,枕的是书(左下那两块白)。侧躺横过来,不与站姿同格
  pdef('sleep', `
............
............
............
............
............
............
............
...KKKKK....
..KAAAAAK...
.KHHHFFFK...
.KHHFEEFKKKK
.KHHFFrFCCCK
..KKKKKKCCCK
..WW..KCCCcK
..WW..KKKKKK
............`)


  globalThis.SHENYAN_ROOM = {
    w: 1440, h: 2560, wallH: 440,
    surfaces: { wall: 'wall_plaster', floor: 'floor_mat_bamboo' },
    // 江南:粉墙微灰,地上整间铺竹席 —— 南方潮,席子凉,而且比木板便宜。
    // 全屋是【旧席】,压得发暗;他待客那一方寸另铺一张【新席】,
    // 明显浅一档 —— 于是「底下压着旧的、上面铺着新的」这件事连地面也在说。
    // palette 的键要给全,少给一个那一处就落回默认的暖橙,整间房的调子就歪了。
    // 键名要照着表面资源实际读的写(floor_mat_bamboo 读 floor/floorAlt/floorSeam/floorNail/floorGrain)。
    palette: { wall: '#e4e0d6', wallLine: '#d5d0c2', skirt: '#565049',
               floor: '#ab9b71', floorAlt: '#a4946a', floorSeam: '#84764f',
               floorNail: '#786b48', floorGrain: '#96865c' },
    gradePreset: 'overcast', state: {},
    plan: [
      // ── 墙面 ──
      ['shenyan_window_lattice', 96, 96],
      ['shenyan_scroll_zi', 388, 108],
      ['shenyan_blind_rolled', 96, 52],
      ['shenyan_drying_line', 96, 470],
      ['shenyan_cabinet_low', 108, 660],
      ['shenyan_bonsai_pine', 304, 504],
      ['shenyan_bundle_drafts', 648, 1688],
      ['shenyan_cat_bowls', 1180, 2054],
      ['shenyan_cat_nest', 1160, 1810],
      ['shenyan_jars_stack', 1200, 1980],
      ['shenyan_plaque_faced', 1130, 2280],
      ['shenyan_stools_stack', 460, 1900],
      ['shenyan_inkbox_stack', 470, 2270],
      ['shenyan_blind_door', 896, 2200],
      ['shenyan_almanacs', 700, 2030],
      ['shenyan_mat_rolled', 60, 2180],
      ['shenyan_clothes_fold', 1290, 1770],
      ['shenyan_scrolls_top', 104, 1352],
      ['shenyan_envelopes', 386, 2216],
      ['shenyan_hat_umbrella', 990, 2160],
      ['shenyan_crate_couch', 1100, 1742],
      ['shenyan_bad_strips', 484, 116],
      ['shenyan_flyer_lotto', 1200, 396],
      ['shenyan_wall_numbers', 560, 84],
      ['shenyan_wall_record', 1060, 84],
      ['shenyan_stub_string', 1060, 300],
      ['shenyan_wall_thread', 560, 84],
      ['shenyan_sticker_koi', 1096, 336],
      // ── 大件 ──
      ['shenyan_desk_zi', 480, 1200],
      ['shenyan_tube_zi', 400, 1096],
      ['shenyan_stool_guest', 656, 1470],
      ['shenyan_dish_fee', 962, 1464],
      ['shenyan_paper_balls', 232, 1300],
      ['shenyan_tube_lots', 404, 1240],
      ['shenyan_copybook_model', 432, 1372],
      ['shenyan_brush_rest', 772, 1256, { attach: 'shenyan_desk_zi', zBias: 3 }],
      ['shenyan_water_pot', 872, 1304, { attach: 'shenyan_desk_zi', zBias: 3 }],
      ['shenyan_seal_box', 660, 1330, { attach: 'shenyan_desk_zi', zBias: 3 }],
      ['shenyan_rack_paper', 104, 1400],
      // ── 读书区 ──
      ['shenyan_lamp_oil', 372, 1500],
      ['shenyan_copybook', 372, 1636],
      ['shenyan_box_scripts', 232, 1880],
      ['shenyan_box_books', 484, 1900],
      ['shenyan_letter', 500, 1792],
      ['shenyan_raincoat', 336, 2168],
      // ── 推号区 ──
      ['shenyan_desk_num', 940, 560],
      ['shenyan_calendar', 900, 800],
      ['shenyan_stand_screen', 1148, 1040],
      ['shenyan_screen_draw', 1116, 852],
      ['shenyan_scratch_pile', 1064, 812],
      ['shenyan_dish_peanut', 1268, 792],
      ['shenyan_calc', 1176, 700, { attach: 'shenyan_desk_num', zBias: 3 }],
      ['shenyan_piggy', 1352, 900],
      // ── 起居(他住在这儿)──
      ['shenyan_mat_bamboo', 400, 1060],
      ['shenyan_cushion_sit', 656, 1072],
      ['shenyan_couch_bamboo', 1044, 1460],
      ['shenyan_table_bedside', 1064, 1788],
      ['shenyan_jar_pickle', 1320, 1660],
      ['shenyan_bowl_coarse', 1216, 1806],
      // ── 底部与杂项 ──
      ['shenyan_cat_lucky', 1188, 1332],
      ['shenyan_bin_paper', 892, 1900],
      ['shenyan_bamboo_luck', 1332, 1912],
      ['shenyan_basin_leak', 700, 1860],
      ['shenyan_books_tosell', 160, 2120],
      ['shenyan_scraps_floor', 700, 2140],
      ['shenyan_doormat', 620, 2320],
      ['shenyan_shoes', 884, 2330],
    ],
    perform: {
      // 玩家点按钮 → 他回案后跪坐下来测字。speed 22 高于闲逛的 12:
      // 表演是玩家【唯一】发起的动作,让他慢慢晃过去是最直接的挫败感
      actor: { x: 677, y: 1034, poses: ['sit'], fps: 1, flip: false, speed: 22 },
      button: 'shenyanCastBtn', labels: ['请沈砚拆个字', '收起'], stateKey: 'cezi',
      lineGap: 5000,
      lines: ['写一个字来。随手写，别想',
              '此字左虚右实 —— 恕我直言，你近来外头撑得辛苦',
              '拆字不是算命，是照镜子。你写什么，你心里就有什么',
              '「安」字宝盖底下一个女。家里有人等，就安了',
              '我这门手艺，村里只我一个。倒不是我强，是没人肯学',
              '……我测得准。只有测我自己那回，准得太狠了'],
    },
  }

  /* ── 行为 ────────────────────────────────────────────────────────
     三个区各出行为,权重按主次:本业(测字)与执念(推号)同为 3 ——
     反差爱好在这间房里不是点缀,它占的分量跟他的手艺一样重。
     调度全部走引擎(pickAct / startWalkTo / stepWalk / idlePose),
     房间只声明数据、推状态机。自写一套选行为或寻路 = 同一职能两份实现,
     两份就会漂:加一件家具就可能让房间那份的某条边悄悄失效。
     act 的 x/y 是 sprite 左上角,不是脚点 —— startWalkTo 自己加 foot 偏移。 */
  const ACTS = [
    // ── 测字(对外的本业)──
    { id: 'cezi',  node: 'MID', x: 677,  y: 1034, poses: ['sit'],             fps: 1,   dur: [8, 13], flip: false, w: 3, say: '写一个字来，随手写' },
    { id: 'write', node: 'MID', x: 677,  y: 1034, poses: ['write1', 'write2'], fps: 2,  dur: [7, 11], flip: false, w: 3, say: '……这一笔，落得太急' },
    { id: 'lots',  node: 'MID', x: 380,  y: 1120, poses: ['stand'],           fps: 1,   dur: [4, 6],  flip: true,  w: 1, say: '签是签，字是字。两回事' },
    { id: 'hang',  node: 'NW',  x: 336,  y: 514,  poses: ['stand'],           fps: 1,   dur: [4, 7],  flip: false, w: 1, say: '墨还没干，先挂着' },
    // ── 推号(对己的执念)——与本业同权重 ──
    { id: 'push',  node: 'NE',  x: 756,  y: 434,  poses: ['point1', 'point2'], fps: 2.2, dur: [8, 12], flip: false, w: 3, say: '第七期到第十九期……差三' },
    { id: 'calc',  node: 'NE',  x: 1056, y: 704,  poses: ['write1', 'write2'], fps: 2,  dur: [6, 10], flip: true,  w: 2, say: '再推一遍。这回的余数不对' },
    { id: 'gaze',  node: 'E',   x: 1196, y: 1054, poses: ['gaze'],            fps: 1,   dur: [6, 10], flip: false, w: 2, say: '……开了', pSay: 0.85 },
    { id: 'scrat', node: 'E',   x: 1106, y: 864,  poses: ['sit'],             fps: 1,   dur: [5, 8],  flip: false, w: 1, say: '谢谢惠顾。又是谢谢惠顾' },
    // ── 读书(放不下的旧业)──
    { id: 'read',  node: 'SW',  x: 336,  y: 1474, poses: ['read'],            fps: 1,   dur: [8, 12], flip: false, w: 2, say: '「观梅」这一节，我批了三遍' },
    { id: 'box',   node: 'SW',  x: 296,  y: 1954, poses: ['stand'],           fps: 1,   dur: [5, 8],  flip: false, w: 1, say: '……', pSay: 0.9 },
    // ── 起居 ──
    { id: 'sleep', node: 'SE',  x: 966,  y: 1474, poses: ['sleep'],           fps: 1,   dur: [12, 18], flip: false, w: 1, zzz: true, sleepAt: [1108, 1486] },
    { id: 'wash',  node: 'S',   x: 616,  y: 1854, poses: ['stand'],           fps: 1,   dur: [4, 6],  flip: false, w: 1, say: '漏是漏。接住了就还是水' },
    { id: 'pine',  node: 'NW',  x: 596,  y: 674,  poses: ['stand'],           fps: 1,   dur: [5, 8],  flip: false, w: 1, say: '绑了六年。你说它疼不疼' },
    { id: 'kit',   node: 'MID', x: 516,  y: 1474, poses: ['sit'],             fps: 1,   dur: [5, 8],  flip: false, w: 1, say: '你倒是睡得着' },
  ]

  /* ── 三只猫 ────────────────────────────────────────────────────
     照前四房的模式:宠物是【角色】,有自己的行为表,走引擎寻路,在屋里到处跑。
     猫的 act 坐标【本身就是脚点】,所以 startWalkTo 要传 { foot:[0,0] } ——
     主角的锚点才是 sprite 左上角。这两种语义混了,猫就会歪半个身子。
     三只的性子不同,落在 speed 和权重上:大橘最懒(睡的权重最高、走得最慢),
     小猫到处窜(点最多、走最快),狸花居中。 */
  const CATS = [
    { id: 'orange', actor: 'sycat_orange', speed: 4, acts: [
      { id: 'o_nest', x: 1206, y: 1884, poses: ['csleep'],  dur: [26, 44], zzz: true, w: 5 },
      { id: 'o_num',  x: 1100, y: 830,  poses: ['csit'],    dur: [8, 14],  w: 2 },
      { id: 'o_scr',  x: 1246, y: 1180, poses: ['csit'],    dur: [10, 16], w: 2, say: '喵' },
      { id: 'o_bowl', x: 1212, y: 2098, poses: ['csit'],    dur: [5, 9],   w: 2 },
      { id: 'o_mat',  x: 900,  y: 1520, poses: ['csleep'],  dur: [20, 34], zzz: true, w: 3 },
      { id: 'o_str',  x: 1010, y: 1900, poses: ['cstretch'],dur: [3, 5],   w: 1 },
    ] },
    { id: 'tabby', actor: 'sycat_tabby', speed: 6, acts: [
      { id: 't_box',  x: 340,  y: 2062, poses: ['csleep'],  dur: [22, 38], zzz: true, w: 5 },
      { id: 't_rack', x: 386,  y: 1620, poses: ['csit'],    dur: [7, 12],  w: 2 },
      { id: 't_nest', x: 1296, y: 1866, poses: ['csleep'],  dur: [18, 30], zzz: true, w: 3 },
      { id: 't_mat',  x: 452,  y: 1524, poses: ['cstretch'],dur: [3, 5],   w: 1 },
      { id: 't_bowl', x: 1276, y: 2096, poses: ['csit'],    dur: [5, 8],   w: 2 },
      { id: 't_win',  x: 250,  y: 900,  poses: ['csit'],    dur: [8, 13],  w: 2, say: '喵' },
    ] },
    { id: 'kitten', actor: 'sycat_kitten', speed: 9, acts: [
      { id: 'k_mat',  x: 560,  y: 1520, poses: ['csit'],    dur: [4, 7],   w: 3, say: '喵' },
      { id: 'k_desk', x: 1010, y: 1420, poses: ['csit'],    dur: [4, 6],   w: 3 },
      { id: 'k_bowl', x: 1322, y: 2094, poses: ['csit'],    dur: [4, 7],   w: 3 },
      { id: 'k_door', x: 700,  y: 2380, poses: ['csit'],    dur: [3, 6],   w: 2 },
      { id: 'k_pine', x: 640,  y: 940,  poses: ['cstretch'],dur: [3, 5],   w: 2 },
      { id: 'k_win',  x: 300,  y: 1000, poses: ['csit'],    dur: [4, 7],   w: 2 },
      { id: 'k_nap',  x: 1252, y: 1918, poses: ['csleep'],  dur: [12, 20], zzz: true, w: 2 },
    ] },
  ]
  const MIN_GAP = 150, CAT_GAP = 46
  const cst = CATS.map(c => ({
    cfg: c, mode: 'act', act: c.acts[0], x: c.acts[0].x, y: c.acts[0].y, path: [],
    until: globalThis.ENGINE_HOST.now() + 4000 + Math.random() * 9000, frame: 0, tx: 0, ty: 0,
    sayText: null, sayUntil: 0, flip: false,
  }))
  function catWalk(c, a) {
    globalThis.startWalkTo(c, a, globalThis.SHENYAN_ROOM, c.cfg.actor, { foot: [0, 0] })
  }

  const st = { mode: 'act', act: ACTS[0], x: 677, y: 1034, node: 'MID', path: [],
               until: globalThis.ENGINE_HOST.now() + 4000, frame: 0, tx: 0, ty: 0, sayText: null, sayUntil: 0 }
  let SHENYAN_PERF = null
  function pick() { return globalThis.pickAct(ACTS, st.act) }
  function startWalk(a) { globalThis.startWalkTo(st, a, globalThis.SHENYAN_ROOM, 'shenyan') }

  let lastT = 0
  // 一帧:推进状态 + 画出来。宿主给画布上下文、时刻、画布本身(交互要用)。
  function frame(mainG, t, cv) {
    if (t - lastT < 50) return
    lastT = t; st.frame++

    if (!SHENYAN_PERF) {
      SHENYAN_PERF = globalThis.wirePerform(globalThis.SHENYAN_ROOM)
      // 行为表挂到房间对象上 —— 它和 plan / perform 一样是【房间数据】。
      // 从前它只是 IIFE 里的局部变量,闭包外一个字都看不到,`pathlint` 这类
      // 门禁于是无从下手:锚点在不在家具里、路径穿不穿家具,都要拿到这张表才查得了。
      // 挂在【首帧接线】这里,与 wirePerform 并列 —— 房间脚本执行的那一刻,
      // 阿云的 ROOM 对象还在另一个 script 块里没定义,桃桃的 RACTS、婆婆的
      // PETS 也还在 const 的暂时性死区里。到 rAF 第一帧,这些才都齐了。
      // anchorIsFoot:宠物的锚点【本身就是脚点】,主角的是 sprite 左上角 ——
      // startWalkTo 靠 { foot:[0,0] } 区分这两种语义,这里如实标注。
      globalThis.SHENYAN_ROOM.acts = [{ actor: 'shenyan', list: ACTS }].concat(
        CATS.map(c => ({ actor: c.actor, list: c.acts, anchorIsFoot: true })))
    }
    globalThis.stepPerform(globalThis.SHENYAN_ROOM, st, t, { startWalk, pick })
    // 开奖屏的滚动:他真的站过去看的那一刻才滚,不是走过去的路上
    globalThis.roomState(globalThis.SHENYAN_ROOM, {
      // 状态一律在【真的站定开做】那一刻置起,不是走过去的路上 ——
      // 否则人还在半路,道具就先演上了
      watching: st.mode === 'act' && st.act.id === 'gaze',
      lamp: st.mode === 'act' && st.act.id === 'read',
    })

    if (st.mode === 'act') {
      if (t > st.until) startWalk(pick())
    } else if (globalThis.stepWalk(st, st.act.speed || 12)) {
      st.mode = 'act'
      const [d0, d1] = st.act.dur
      st.until = t + (d0 + Math.random() * (d1 - d0)) * 1000
      if (st.act.say && Math.random() < (st.act.pSay || 0.55)) { st.sayText = st.act.say; st.sayUntil = t + 2800 }
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
    pose = globalThis.idlePose(st, pose, 'shenyan')

    // 睡竹榻:寻路终点在榻边(那儿可达),到位后 sleepAt 把人挪到榻上并 attach
    const napping = st.mode === 'act' && st.act.sleepAt
    if (napping) { drawX = st.act.sleepAt[0]; drawY = st.act.sleepAt[1] }
    const opt = napping ? { attach: 'shenyan_couch_bamboo', zBias: 4 } : {}

    const F = globalThis.ACTORS.shenyan.foot
    const ents = [globalThis.placeActor('shenyan', drawX + F[0], drawY + F[1], pose, flip, opt)]

    /* 三只猫。人与猫是两个实体,不该叠在一起 —— 静态碰撞只管家具,
       角色之间靠避让:猫体型小、优先级低,由猫让路。 */
    const heroFx = drawX + F[0], heroFy = drawY + F[1]
    for (const c of cst) {
      c.frame++
      /* 避让。原先只在 act 模式判 —— 走路途中撞上人就照撞过去。
         现在两种模式都判,而且猫与猫之间也让:三只猫叠在一格上同样难看。
         躲的时候挑一个离【所有人和猫】都最远的落脚点,而不是只躲人。 */
      const others = cst.filter(o => o !== c).map(o => [o.x, o.y])
      const crowd = [[heroFx, heroFy]].concat(others)
      const tooClose = crowd.some(([px, py], i) =>
        Math.hypot(px - c.x, py - c.y) < (i === 0 ? MIN_GAP : CAT_GAP))
      /* 只在【停着】的时候判避让。试过走路途中也判(每 6 帧看一次),
         结果是避让震荡:A 躲 B、B 躲 A,两只猫互相追着改道,叠在一起的帧数
         从 10 涨到 28。走路中途改道还会让刚算出来的路径作废,猫原地打转。
         停着被靠近就起身挪窝 —— 这也是前四房的做法。 */
      if (tooClose && c.mode === 'act') {
        let best = null, bestD = -1
        for (const a of c.cfg.acts) {
          if (a.id === c.act.id) continue
          const d = Math.min(...crowd.map(([px, py]) => Math.hypot(a.x - px, a.y - py)))
          if (d > bestD) { bestD = d; best = a }
        }
        if (best) { catWalk(c, best); c.dodging = true }
      } else if (!tooClose) c.dodging = false
      if (c.mode === 'act') {
        if (t > c.until) catWalk(c, globalThis.pickAct(c.cfg.acts, c.act))
      } else if (globalThis.stepWalk(c, c.cfg.speed)) {
        c.mode = 'act'
        const [d0, d1] = c.act.dur
        c.until = t + (d0 + Math.random() * (d1 - d0)) * 1000
        if (c.act.say && Math.random() < 0.4) { c.sayText = c.act.say; c.sayUntil = t + 2200 }
      }
      /* 朝向每帧现算 —— 起步时定一次是错的:寻路走的是 L 形折线,
         先把 x 走完再走 y,拐过弯方向就反了,于是猫倒着走(屁股尾巴在前)。
         静止时保留最后一次的朝向,别让它站着自己转身。 */
      if (c.mode === 'walk' && Math.abs(c.tx - c.x) > 2) c.flip = (c.tx - c.x) < 0
      const cpose = c.mode === 'walk'
        ? (((c.frame >> 2) % 2) ? 'cwalk1' : 'cwalk2')
        : c.act.poses[((c.frame * 0.05) | 0) % c.act.poses.length]
      ents.push(globalThis.placeActor(c.cfg.actor, c.x, c.y, cpose, c.flip, {}))
      c.dbg = { m: c.mode, dx: c.tx - c.x, f: c.flip }
    }
    globalThis.renderRoom(mainG, globalThis.SHENYAN_ROOM, t, ents)

    if (!cv.__interaction && globalThis.attachRoomInteraction) globalThis.attachRoomInteraction(cv, globalThis.SHENYAN_ROOM, {})
    if (globalThis.drawInteraction) globalThis.drawInteraction(mainG, globalThis.SHENYAN_ROOM, cv, t)

    const anc = globalThis.actorAnchor('shenyan', pose, drawX, drawY)
    if (st.act.zzz && st.mode === 'act') globalThis.drawEmote(mainG, 'zzz', anc, t)
    if (st.sayText && t < st.sayUntil) globalThis.drawSay(mainG, anc, st.sayText, { ink: '#3a2c20', paper: '#f0e8d6' })
    else if (t >= st.sayUntil) st.sayText = null
    /* 诊断接口 —— 猫的朝向与位置这两件事没法看图确认(要连采几百帧才看得出
       「有没有倒着走」「有没有停着叠在一起」)。留着给工具读,跟 __hitAt 同性质。 */
    globalThis.__cats = cst.map(c => c.dbg)
    globalThis.__catpos = { h: [heroFx, heroFy], hm: st.mode, c: cst.map(c => [c.x, c.y, c.mode]) }
    for (const c of cst) {
      if (c.act.zzz && c.mode === 'act') globalThis.drawEmote(mainG, 'zzz', { x: c.x, y: c.y - 40 }, t)
      if (c.sayText && t < c.sayUntil) globalThis.drawSay(mainG, { x: c.x, y: c.y - 44 }, c.sayText, { ink: '#3a2c20', paper: '#f0e8d6' })
      else if (t >= c.sayUntil) c.sayText = null
    }
  }
  globalThis.SHENYAN_FRAME = frame

  // ── 宿主那一段 ────────────────────────────────────────────────
  // 以上全部与平台无关;以下三行是设计页专用的驱动。
  // 小程序侧自己取画布(wx.createSelectorQuery)、自己驱动帧,再调同一个 frame。
  if (typeof document === 'undefined') return
  const cv = document.getElementById('shenyanCanvas')
  if (!cv) return
  const mainG = cv.getContext('2d')
  function loop(t) { requestAnimationFrame(loop); frame(mainG, t, cv) }
  requestAnimationFrame(loop)
})()
