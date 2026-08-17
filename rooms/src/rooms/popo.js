
(function () {
  const cv = document.getElementById('popoCanvas')
  if (!cv) return
  const mainG = cv.getContext('2d')

  // ── 陈设:声明式房间数据 + 引擎渲染 ───────────────────────────────
  // 原先 1700 余行硬编码陈设已拆成素材库资源(popo_* 72 件)+ 下方 plan。
  // 立意（ROOM-popo-S1.md）：她给所有人当亲人，自己没有亲人。
  // 分界线不切空间 —— 走【成对物件】，每件「给别人的」旁边有一件「她自己的」。

  window.POPO_ROOM = {
    w: 1440, h: 2560, wallH: 440, extBand: 2160,
    surfaces: { wall: 'wall_popo_stone', floor: 'floor_popo_plank' },
    palette: { wall:'#4a4258', wallLine:'#38324a', floor:'#5a4a3e', floorAlt:'#544539',
               floorSeam:'#463a30', floorNail:'#4e4034', skirt:'#38324a' },
    gradePreset: 'candle', dust: false,
    // 有状态：抽屉。点一下开，再点关 —— 本房唯一的有状态家具。
    state: { drawerOpen: false, casting: false },
    // ══ 表演态:点「请婆婆看水晶球」══
    // 她骑扫帚 —— fly 走直线，速度与走路一致
    perform: {
      actor: { x: 632, y: 914, poses: ['gaze'], fps: 1, flip: false, fly: true, speed: 13 },
      button: 'popoCastBtn', labels: ['请婆婆看水晶球', '不看了'],
      stateKey: 'casting',                      // 水晶球与五芒星阵读这个键
      lineGap: 7200,
      lines: ['坐近些。雾散得慢，急不得',
              '我不下断语的。我只说我看见什么',
              '我看见有人在等你。不说是谁，说了就不准了',
              '这团雾……是好的。我看着像好的',
              '你手上有东西放不下。我不问是什么',
              '哎哟，别急着问结果。结果自己会来',
              '球里的人在笑呢。你认得的',
              '我这双眼睛替人看了一辈子',
              '……我自己的，从来没看过'],
    },
    plan: [
      // 墙面带
      ['popo_cobweb',0,0], ['popo_fireplace',40,190], ['popo_photo_wall',366,60],
      ['popo_window_night',372,186], ['popo_birthday_board',660,80], ['popo_herb_hang',880,40],
      ['popo_window_small',860,196], ['popo_knit_pattern',1060,60], ['popo_shelf_potions',1090,300],
      ['popo_hat_stand',1290,60],
      // 墙下挂件
      ['ayun_cloak_hook',40,452], ['popo_specimen_jars',204,452], ['popo_dream_catcher',470,452],
      ['popo_palm_chart',620,452], ['popo_sweater_hang',760,452], ['popo_floating_candles',600,620],
      ['popo_mouse_hole',1380,396],
      // 地毯（L1 DECAL，不占地）
      ['popo_rug_star',430,880], ['tao_rug_tea',1020,1150], ['popo_door_mat',616,1972],
      ['popo_rune_floor', 1140, 1560], ['popo_tarot_spread',400,1880], ['popo_ext_rug',596,2264],
      // 左列 · 灶与碗
      ['popo_mirror_veiled',56,690], ['popo_stove',212,700], ['popo_bowl_shelf',212,1010],
      ['popo_book_tower',56,1108], ['popo_pumpkins', 180, 2130], ['popo_cauldron',236,1300],
      ['popo_distiller', 300, 1370], ['popo_owl_perch', 120, 1560], ['ayun_crates_stack',44,1936],
      // 中央 · 读牌区（核心）
      ['tao_stool_embroidered',452,1150], ['popo_table_read',556,1024],
      ['popo_crystal_ball',666,1014,{"attach":"popo_table_read","zBias":3}],
      ['popo_cards_new',588,1086,{"attach":"popo_table_read","zBias":4}],
      ['popo_phone',788,1090,{"attach":"popo_table_read","zBias":4}],
      ['popo_drawer',586,1180,{"attach":"popo_table_read","zBias":5}],
      ['popo_qr_stand',930,1160],
      // 右中 · 待客区（糖罐 / 碗 / 茶具 / 缺口杯 同框）
      ['popo_table_guest',1060,1180],
      ['popo_tea_set',1102,1172,{"attach":"popo_table_guest","zBias":3}],
      ['popo_own_bowl',1266,1242,{"attach":"popo_table_guest","zBias":4}],
      ['popo_own_cup',1174,1228,{"attach":"popo_table_guest","zBias":4}],
      ['popo_candy_jar',1240,1184,{"attach":"popo_table_guest","zBias":3}],
      ['ayun_cushion_round',1060,1428],
      // 右上 · 床与书台
      ['popo_bed',1080,480],
      ['popo_laptop',1148,686,{"attach":"popo_bed","zBias":3}],
      ['popo_coffee_cup',1036,846], ['popo_book_stand',1096,940],
      ['popo_astrolabe',1250,926,{"attach":"popo_book_stand","zBias":3}],
      ['popo_balance',1330,1000], ['popo_mandrake', 1070, 1050],
      // 右下 · 摇椅与毛线
      ['popo_rocking_chair',1146,1508],
      ['popo_own_shawl',1152,1512,{"attach":"popo_rocking_chair","zBias":3}],
      ['popo_yarn_basket', 1050, 1700], ['popo_sweater_pile', 1170, 1836],
      ['popo_portal',1180,1660], ['popo_cat_bowl', 520, 1640],
      ['popo_crystal_grid', 1010, 1660], ['popo_gift_stack', 940, 2080],
      // 动物角
      ['popo_nest_bird', 150, 1470], ['popo_nest_wicker', 326, 1584], ['popo_nest_wicker', 398, 1792],
      ['popo_nest_wicker', 196, 1712], ['popo_nest_wicker', 300, 1864], ['popo_nest_wicker', 210, 1600],
      ['popo_food_bowls', 560, 1600], ['popo_food_bowls', 560, 1672], ['popo_snack_jar', 250, 1470],
      ['popo_biscuit_tin', 168, 1476], ['popo_cat_toy', 250, 1806], ['popo_yarn_ball', 1176, 1690],
      ['popo_scroll_pile', 1064, 1452, { attach: 'ayun_cushion_round', zBias: 2 }],
      // 烛与晶（整屋一种光）
      ['popo_candles', 760, 2160], ['popo_candles',916,820], ['popo_candles',118,1420],
      ['popo_amethyst', 370, 1000], ['popo_amethyst', 1000, 1600],
      ['popo_rune_stones',500,756], ['popo_wand',852,776],
      // 门
      ['popo_omamori_door',860,1856], ['popo_bell_pole', 700, 1846], ['popo_shoes',876,1996],
      ['popo_slippers_guest',330,1996], ['popo_slippers_own',250,2032], ['ayun_broom',400,1900],
      ['tao_ext_crate',1020,2210],
    ],
  }

  // ═══════════ 婆婆 NPC(矮 · 尖帽 · 超宽檐)═══════════
  const PC = {
    K: '#1a1620', F: '#e8c8a8', E: '#3d6a34', V: '#7a5a9a', v: '#6a4a8a',
    W: '#e8e0d0', X: '#e8e0d0', n: '#c8a080', e: '#4a3626', y: '#e8b23d',
    Y: '#ffd76a', A: '#2a2a30', O: '#e89040', R: '#d84a34', N: '#a06a40',
    G: '#5a8a44', q: '#3e6a34', P: '#e858a0', B: '#68a8d8', S: '#c8bca0',
  }
  const POSES = {}
  function pdef(n, s) { POSES[n] = s.trim().split('\n').map(r => r.trimEnd()) }
  // 单一数据源:角色资源用 getter 引用这两个对象,不拷贝快照(PLAYBOOK §3.5)。
  window.POPO_POSES = POSES
  window.POPO_PALETTE = PC

  // ── 正面 ────────────────────────────────────────────────────
  pdef('stand', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXFFFFXXK..
..KXFeFFeFXK..
...KFFnFFFK...
...KFFFFFK....
..KVVVVVVVK...
.KVVVVVVVVVK..
..KVVKKKVVK...
...KK...KK....`)
  pdef('blink', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXFFFFXXK..
..KXFFFFFFXK..
...KFFnFFFK...
...KFFFFFK....
..KVVVVVVVK...
.KVVVVVVVVVK..
..KVVKKKVVK...
...KK...KK....`)
  // 呼吸:整体沉一格(原 walkmid,不是走姿,是站着的起伏)
  pdef('breath', `
..............
........KK....
.......KVVK...
......KVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXFFFFXXK..
..KXFeFFeFXK..
...KFFnFFFK...
...KFFFFFK....
..KVVVVVVVK...
.KVVVVVVVVVK..
..KVVKKKVVK...
...KK...KK....`)
  pdef('walkfront1', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXFFFFXXK..
..KXFeFFeFXK..
...KFFnFFFK...
...KFFFFFK....
..KVVVVVVVK...
.KVVVVVVVVVK..
..KVK.....K...
...KK...KK....`)
  pdef('walkfront2', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXFFFFXXK..
..KXFeFFeFXK..
...KFFnFFFK...
...KFFFFFK....
..KVVVVVVVK...
.KVVVVVVVVVK..
...K.....KVK..
....KK...KK...`)
  // ── 背面(帽 + 白发,无脸)────────────────────────────────────
  pdef('standback', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXXXXXXXK..
..KXXXXXXXXK..
...KXXXXXXK...
...KXXXXXK....
..KVVVVVVVK...
.KVVVVVVVVVK..
..KVVKKKVVK...
...KK...KK....`)
  pdef('walkback1', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXXXXXXXK..
..KXXXXXXXXK..
...KXXXXXXK...
...KXXXXXK....
..KVVVVVVVK...
.KVVVVVVVVVK..
..KVK.....K...
...KK...KK....`)
  pdef('walkback2', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXXXXXXXK..
..KXXXXXXXXK..
...KXXXXXXK...
...KXXXXXK....
..KVVVVVVVK...
.KVVVVVVVVVK..
...K.....KVK..
....KK...KK...`)
  // ── 侧向(规范:一律朝右)──────────────────────────────────────
  pdef('standside', `
......KK......
.....KVVK.....
....KVVK......
...KVVVK......
..KVVVVK......
.KVVVVVVK.....
KVyyVVVVVK....
KKKKKKKKKKK...
.KXXFFFFK.....
.KXFFeFFnK....
.KXFFFFFK.....
..KFFFFK......
..KVVVVVK.....
.KVVVVVVK.....
..KVVKVVK.....
...KK.KK......`)
  pdef('walkside1', `
......KK......
.....KVVK.....
....KVVK......
...KVVVK......
..KVVVVK......
.KVVVVVVK.....
KVyyVVVVVK....
KKKKKKKKKKK...
.KXXFFFFK.....
.KXFFeFFnK....
.KXFFFFFK.....
..KFFFFK......
..KVVVVVK.....
.KVVVVVVK.....
..KVVKVVK.....
.KK.....KK....`)
  pdef('walkside2', `
..............
......KK......
.....KVVK.....
....KVVK......
..KVVVVK......
.KVVVVVVK.....
KVyyVVVVVK....
KKKKKKKKKKK...
.KXXFFFFK.....
.KXFFeFFnK....
.KXFFFFFK.....
..KFFFFK......
..KVVVVVK.....
.KVVVVVVK.....
..KVVKVVK.....
...KK.KK......`)
  pdef('walkside3', `
......KK......
.....KVVK.....
....KVVK......
...KVVVK......
..KVVVVK......
.KVVVVVVK.....
KVyyVVVVVK....
KKKKKKKKKKK...
.KXXFFFFK.....
.KXFFeFFnK....
.KXFFFFFK.....
..KFFFFK......
..KVVVVVK.....
.KVVVVVVK.....
..KVVKVVK.....
..KKK.KKK.....`)
  // ── 干活 ────────────────────────────────────────────────────
  pdef('gaze', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXFFFFXXK..
..KXFeFFeFXK..
...KFFnFFFK...
..FKFFFFFKF...
.FKVVVVVVVKF..
.KVVVVVVVVVK..
..KVVKKKVVK...
...KK...KK....`)
  pdef('stir1', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXFFFFXXK..
..KXFeFFeFXK..
...KFFnFFFKN..
...KFFFFFKN...
..KVVVVVVVK...
.KVVVVVVVVVK..
..KVVKKKVVK...
...KK...KK....`)
  pdef('stir2', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXFFFFXXK..
..KXFeFFeFXK..
.NKFFnFFFK....
..NKFFFFK.....
..KVVVVVVVK...
.KVVVVVVVVVK..
..KVVKKKVVK...
...KK...KK....`)
  pdef('sit', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXFFFFXXK..
..KXFeFFeFXK..
...KFFnFFFK...
...KFFFFFK....
..KVVVVVVVK...
.KVVVVVVVVVK..
KKVVVVVVVVVKK.
.KKKKKKKKKKK..`)
  // 织毛衣:两根针在胸前一上一下(P = 粉毛线)
  pdef('knit1', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXFFFFXXK..
..KXFeFFeFXK..
...KFFnFFFK...
...KFFFFFK....
..KVFPPPPFVK..
.KVVSPPPPSVVK.
KKVVVVVVVVVKK.
.KKKKKKKKKKK..`)
  pdef('knit2', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXFFFFXXK..
..KXFeFFeFXK..
...KFFnFFFK...
...KFFFFFKS...
..KVFPPPPFVK..
.KVVSPPPPPVVK.
KKVVVVVVVVVKK.
.KKKKKKKKKKK..`)
  // 倒茶:一只手举壶偏右(B = 青瓷)
  pdef('pour1', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXFFFFXXK..
..KXFeFFeFXK..
...KFFnFFFKB..
...KFFFFFKBB..
..KVVVVVVVKB..
.KVVVVVVVVVK..
..KVVKKKVVK...
...KK...KK....`)
  pdef('pour2', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXFFFFXXK..
..KXFeFFeFXK..
...KFFnFFFKBB.
...KFFFFFKBBB.
..KVVVVVVVKBB.
.KVVVVVVVVVK..
..KVVKKKVVK...
...KK...KK....`)
  // 喂食:弯下腰,手伸向地面
  pdef('feed1', `
..............
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
...KVVVVVK....
..KVyyVVVVK...
.KKKKKKKKKKK..
..KXXFFFFXK...
..KXFeFFeFK...
...KFFnFFK....
...KFFFFK.....
..KVVVVVVK....
.KVVVVVVVVK...
..KVVKFFK.....
...KK..KFF....`)
  pdef('feed2', `
..............
..............
........KK....
.......KVVK...
......KVVK....
....KVVVVK....
..KVyyVVVVK...
.KKKKKKKKKKK..
..KXXFFFFXK...
..KXFeFFeFK...
...KFFnFFK....
...KFFFFK.....
..KVVVVVVK....
.KVVVVVVVVK...
..KVVKKVVK....
...KK.FFK.....`)
  // 发语音条:手机举到嘴边(P = 粉壳)
  pdef('voice', `
........KK....
.......KVVK...
......KVVK....
.....KVVVK....
....KVVVVK....
...KVVVVVVK...
..KVyyVVVVVK..
.KKKKKKKKKKKK.
..KXXFFFFXXK..
..KXFeFFeFXK..
...KFFnFFFPK..
...KFFFFFKPK..
..KVVVVVVVFK..
.KVVVVVVVVVK..
..KVVKKKVVK...
...KK...KK....`)
  // 躺:睡在床上(体位横)
  pdef('sleepv', `
....................
...KKKKKKKKKKKK.....
..KVVVVVVVVVVVVK....
.KVVVVVVVVVVVVVVK...
KXXFFFFXXKVVVVVVVK..
KXFFFFFFXKVVVVVVVK..
KXXFFFFXXKVVVVVVVK..
.KKKKKKKKKVVVVVVK...
...KVVVVVVVVVVK.....`)
  pdef('sleepv2', `
....................
...KKKKKKKKKKKK.....
..KVVVVVVVVVVVVK....
.KVVVVVVVVVVVVVVK...
KXXFFFFXXKVVVVVVVK..
KXFFFFFFXKVVVVVVVK..
KXXFFFFXXKVVVVVVVK..
.KKKKKKKKKVVVVVVK...
....KVVVVVVVVVK.....`)
  // ── 飞(她高兴时会飞一圈)────────────────────────────────────
  // ── 动物 ────────────────────────────────────────────────────
  pdef('bcat', `
..KK..KK
.KAAAAAK
KAYAAYAK
KAAAAAAK
.KAAAAK.
.KAAAAKK
.KAKKAKK
..K..K..`)
  pdef('bcatsleep', `
............
..KKKKKKKK..
.KAAAAAAAAK.
KAAAAAAAAAAK
.KAAAAAAAAK.
..KKKKKKKK..`)
  pdef('owl1', `
.KKKKKK.
KWWWWWWK
KWYWWYWK
KWWnWWWK
KWWWWWWK
.KWWWWK.
..KKKK..`)
  pdef('owl2', `
.KKKKKK.
KWWWWWWK
KWKWWKWK
KWWnWWWK
KWWWWWWK
.KWWWWK.
..KKKK..`)
  pdef('pcat', `
.KK....KK.
KOOOOOOOOK
KOYOOOOYOK
KOOOOOOOOK
.KOOOOOOK.
..KK..KK..`)
  pdef('pdog', `
KK......KK
KNNNNNNNNK
KNYNNNNYNK
KNNNRNNNNK
KNNNNNNNNK
.KNNNNNNK.
..KN..NK..
..KK..KK..`)
  pdef('pbun', `
.KK..KK...
.KWK.KWK..
KWWWWWWWK.
KWYWWWYWK.
.KWWWWWK..
..KK.KK...`)
  pdef('pbear', `
KK......KK
KNNK..KNNK
KNNNNNNNNK
KNYNNNNYNK
KNNNRNNNNK
KNNNNNNNNK
KNNNNNNNNK
.KNNNNNNK.
..KK..KK..`)
  pdef('hedge', `
...KKKK...
..KAAAAK..
.KAAAAAAK.
KFFKAAAAKK
.KK....KK.`)
  pdef('turt', `
...KKKK...
..KqqqqK..
.KqGGGGqK.
KFKqqqqKKK
.KK....KK.`)

  // ═══ 日程 ═══
  // 权重 w 体现主次：读牌与照顾动物是她的主业，飞一圈是偶尔高兴。
  // node 保留作分区标记（供 roomstats / pathlint 读），寻路本身走网格。
  const ACTS = [
    { id: 'read',   node: 'C1', x: 652, y: 964,  poses: ['gaze'],           fps: 1,   dur: [8, 12], flip: false, w: 4,
      say: ['牌是这么说的哦。信不信在你呀', '我不下断语的。我只说我看见什么', '这张……嗯，不算坏事'] },
    { id: 'drawer', node: 'C1', x: 572, y: 1224, poses: ['sit'],            fps: 1,   dur: [5, 8],  flip: false, w: 1,
      say: '……哎呀，看它做什么' },
    { id: 'stove',  node: 'L1', x: 484, y: 832,  poses: ['stir1', 'stir2'], fps: 1.3, dur: [7, 10], flip: false, w: 3,
      say: ['又煮多了呢', '锅大一点好呀，谁来了都有'] },
    { id: 'bowls',  node: 'L1', x: 264, y: 1052,  poses: ['stand'],          fps: 1,   dur: [4, 6],  flip: false, w: 1,
      say: '碗擦干净些，客人要用的' },
    { id: 'cauldron', node: 'L2', x: 512, y: 1344, poses: ['stir1', 'stir2'], fps: 1.2, dur: [6, 9], flip: true, w: 2,
      say: '加点蝾螈尾巴……开玩笑的呀' },
    { id: 'tea',    node: 'R1', x: 972, y: 1014, poses: ['pour1', 'pour2'], fps: 1.1, dur: [5, 8],  flip: false, w: 3,
      say: ['喝口热的呀', '花茶好，安神'] },
    { id: 'candy',  node: 'R1', x: 982, y: 1194, poses: ['stand'],          fps: 1,   dur: [4, 6],  flip: false, w: 2,
      say: '来，吃颗糖，不吃不许走哦' },
    { id: 'knit',   node: 'R2', x: 1202, y: 1334, poses: ['knit1', 'knit2'], fps: 1.4, dur: [10, 15], flip: false, w: 4,
      say: ['还差两只袖子呢', '天冷之前得织完呀', '这件是给最小的那只的'] },
    { id: 'rock',   node: 'R2', x: 1202, y: 1484, poses: ['sit'],           fps: 1,   dur: [8, 12], flip: false, w: 2, zzz: true },
    { id: 'feed',   node: 'B1', x: 712, y: 1690, poses: ['feed1', 'feed2'], fps: 1.2, dur: [6, 9],  flip: false, w: 4,
      say: ['开饭啦，小可爱们～', '慢点吃，都有份的呀', '一、二、三……哎呀，又数不清了'] },
    { id: 'owl',    node: 'L3', x: 194, y: 1572, poses: ['gaze'],           fps: 1,   dur: [4, 6],  flip: true,  w: 2,
      say: '乖，咕咕' },
    { id: 'voice',  node: 'C2', x: 812, y: 1264, poses: ['voice'],          fps: 1,   dur: [5, 8],  flip: false, w: 3,
      say: ['喂——小云呀，婆婆包了饺子——', '六十秒不够说的呀，我再发一条', '打字？婆婆不学那个'] },
    { id: 'gift',   node: 'C2', x: 852, y: 1314, poses: ['stand'],          fps: 1,   dur: [4, 6],  flip: false, w: 2,
      say: '明天有人过生日啦，得先包起来' },
    { id: 'door',   node: 'B2', x: 672, y: 1764, poses: ['stand'],          fps: 1,   dur: [4, 6],  flip: true,  w: 2,
      say: '慢走呀，常来玩～' },
    { id: 'sleep',  node: 'R3', x: 1004, y: 852, poses: ['sleepv', 'sleepv2'], fps: 0.35, dur: [12, 18], flip: false, w: 2,
      zzz: true, sleepAt: [1136, 560] },
    { id: 'fly',    node: 'C1', x: 652, y: 964,  poses: ['walkside1'],      fps: 1,   dur: [9, 13], flyMode: true, fly: true, w: 1,
      say: '哈哈——起飞！' },
  ]

  const st = {
    mode: 'act', act: ACTS[0], x: 652, y: 964, path: [],
    until: performance.now() + 5000, frame: 0, tx: 652, ty: 964,
    sayText: null, sayUntil: 0, flyA: 0,
  }
  let POPO_PERF = null
  function pick() { return window.pickAct(ACTS, st.act) }

  function startWalk(a) {
    if (a.fly) {       // 飞去某处:不寻路，直线冲过去
      st.act = a; st.mode = 'walk'; st.path = []
      st.tx = a.x; st.ty = a.y
      return
    }
    if (a.flyMode) {   // 飞:不寻路,直接起飞
      st.act = a; st.mode = 'act'
      st.until = performance.now() + (a.dur[0] + Math.random() * (a.dur[1] - a.dur[0])) * 1000
      return
    }
    window.startWalkTo(st, a, window.POPO_ROOM, 'popo')
  }

  // ── 黑猫:慢 · 贪睡。三个窝轮着趴 ──────────────────────────────
  const CATS = [
    { id: 'c1', x: 508, y: 1740, poses: ['bcatsleep'], dur: [20, 34], w: 5, zzz: true },
    { id: 'c2', x: 880, y: 1660, poses: ['bcatsleep'], dur: [16, 28], w: 3, zzz: true },
    { id: 'c3', x: 700, y: 1600, poses: ['bcat'],      dur: [6, 10],  w: 2 },
    { id: 'c4', x: 1120, y: 1620, poses: ['bcat'],     dur: [6, 10],  w: 2 },
  ]
  const cst = { mode: 'act', act: CATS[0], x: 508, y: 1740, tx: 508, ty: 1740,
                until: performance.now() + 12000, frame: 0, path: [] }
  function catWalk(a) { window.startWalkTo(cst, a, window.POPO_ROOM, 'popocat', { foot: [0, 0] }) }

  // ── 猫头鹰:栖架上不动,只眨眼 ────────────────────────────────
  const owl = { blinkUntil: 0, nextBlink: performance.now() + 4000 }

  // ── 刺猬与乌龟:三点小巡游(锚点都在动物角空地上)──────────────
  const PETS = [
    { pose: 'hedge', x: 300, y: 1700, pts: [[300, 1700], [400, 1690], [260, 1790]], sp: 2 },
    { pose: 'turt',  x: 470, y: 1660, pts: [[470, 1660], [560, 1720], [420, 1760]], sp: 2 },
  ].map(p => Object.assign(p, { tx: p.x, ty: p.y, mode: 'act', until: performance.now() + 8000, i: 0 }))

  // ── 传送门:小家伙时不时进来一只 ──────────────────────────────
  const PKINDS = [
    { pose: 'pcat',  say: '喵~',        w: 4 },
    { pose: 'pdog',  say: '汪！',       w: 4 },
    { pose: 'pbun',  say: '……（抖鼻子）', w: 2 },
    { pose: 'pbear', say: '吼——',       w: 1 },
  ]
  const portal = { state: 'idle', until: performance.now() + 6000, kind: null, x: 1280, y: 1960, sayUntil: 0 }

  let lastT = 0
  function loop(t) {
    requestAnimationFrame(loop)
    if (t - lastT < 50) return
    lastT = t; st.frame++

    // ── 表演态:玩家点「请婆婆看水晶球」──────────────────────
    if (!POPO_PERF) {
      POPO_PERF = window.wirePerform(window.POPO_ROOM)
      // 行为表挂到房间对象上 —— 它和 plan / perform 一样是【房间数据】。
      // 从前它只是 IIFE 里的局部变量,闭包外一个字都看不到,`pathlint` 这类
      // 门禁于是无从下手:锚点在不在家具里、路径穿不穿家具,都要拿到这张表才查得了。
      // 挂在【首帧接线】这里,与 wirePerform 并列 —— 房间脚本执行的那一刻,
      // 阿云的 ROOM 对象还在另一个 script 块里没定义,桃桃的 RACTS、婆婆的
      // PETS 也还在 const 的暂时性死区里。到 rAF 第一帧,这些才都齐了。
      // anchorIsFoot:宠物的锚点【本身就是脚点】,主角的是 sprite 左上角 ——
      // startWalkTo 靠 { foot:[0,0] } 区分这两种语义,这里如实标注。
      window.POPO_ROOM.acts = [
        { actor: 'popo', list: ACTS },
        { actor: 'popocat', list: CATS, anchorIsFoot: true },
        // 小家伙沿 pts 巡回,每个点都是一个落脚锚点 —— 展开才查得到
        { actor: 'popopet', anchorIsFoot: true,
          list: PETS.flatMap(pt => pt.pts.map((q, i) => ({ id: pt.pose + '#' + i, x: q[0], y: q[1] }))) },
      ]
    }
    window.stepPerform(window.POPO_ROOM, st, t, { startWalk, pick })

    // ── 婆婆 ──────────────────────────────────────────────────
    if (st.mode === 'act') {
      if (t > st.until) startWalk(pick())
      if (st.act.flyMode) {
        st.flyA += 0.030
        st.x = 720 + Math.cos(st.flyA) * 440 - 80
        st.y = 1180 + Math.sin(st.flyA) * 460 - 64 + Math.sin(t / 300) * 18
        // 把【下一刻】的位置当作朝向目标 —— 绕圈飞没有寻路目标,
        // 但切线方向就是她面朝的方向,交给引擎的 faceOf 定向即可
        const nA = st.flyA + 0.14
        st.tx = 720 + Math.cos(nA) * 440 - 80
        st.ty = 1180 + Math.sin(nA) * 460 - 64
      }
    } else if (st.act.fly ? window.stepFly(st, st.act.speed || 30)
                          : window.stepWalk(st, st.act.speed || 7)) {     // 走得慢 —— 七十几岁了;骑上扫帚就不慢了
      st.mode = 'act'
      const [d0, d1] = st.act.dur
      st.until = t + (d0 + Math.random() * (d1 - d0)) * 1000
      if (st.act.say && Math.random() < 0.62) {
        const L = st.act.say
        st.sayText = Array.isArray(L) ? L[(Math.random() * L.length) | 0] : L
        st.sayUntil = t + 3000
      }
    }

    // ── 黑猫 ──────────────────────────────────────────────────
    cst.frame++
    if (cst.mode === 'act') {
      if (t > cst.until) {
        const a = window.pickAct(CATS, cst.act)
        if (a) catWalk(a)
      }
    } else if (window.stepWalk(cst, 3)) {
      cst.mode = 'act'
      const [d0, d1] = cst.act.dur
      cst.until = t + (d0 + Math.random() * (d1 - d0)) * 1000
    }

    // ── 猫头鹰眨眼 ────────────────────────────────────────────
    if (t > owl.nextBlink) { owl.blinkUntil = t + 220; owl.nextBlink = t + 3000 + Math.random() * 5000 }

    // ── 刺猬 / 乌龟 ───────────────────────────────────────────
    for (const p of PETS) {
      if (p.mode === 'act') {
        if (t > p.until) {
          // 刺猬/乌龟也走网格寻路 —— 原先手写步进直线走，会爬过家具
          p.i = (p.i + 1 + ((Math.random() * 2) | 0)) % p.pts.length
          const pt = p.pts[p.i]
          window.startWalkTo(p, { x: pt[0], y: pt[1] }, window.POPO_ROOM, 'popopet', { foot: [0, 0] })
        }
      } else if (window.stepWalk(p, p.sp)) {
        p.mode = 'act'; p.until = t + (7 + Math.random() * 8) * 1000
      }
    }

    // ── 传送门 ────────────────────────────────────────────────
    if (portal.state === 'idle' && t > portal.until) {
      let r = Math.random() * PKINDS.reduce((s, k) => s + k.w, 0)
      let k = PKINDS[0]
      for (const c of PKINDS) { r -= c.w; if (r <= 0) { k = c; break } }
      portal.kind = k; portal.state = 'out'; portal.x = 1280; portal.y = 1960
      portal.until = t + 5000; portal.sayUntil = t + 2400
    } else if (portal.state === 'out') {
      portal.x -= 4
      if (t > portal.until) { portal.state = 'idle'; portal.until = t + (8 + Math.random() * 10) * 1000 }
    }

    // ── 姿态先算,再交给引擎排序 ──────────────────────────────
    let pose, flip = false, drawX = st.x, drawY = st.y
    if (st.mode === 'walk') {
      const wp = window.walkPose(st, { rate: 2 })
      pose = wp.pose; flip = wp.flip
    } else {
      const ps = st.act.poses
      pose = ps[((st.frame * st.act.fps / 20) | 0) % ps.length]
      flip = st.act.flip
    }
    const sleeping = st.mode === 'act' && st.act.sleepAt
    if (sleeping) { drawX = st.act.sleepAt[0]; drawY = st.act.sleepAt[1] }
    pose = window.idlePose(st, pose, 'popo')
    // 婆婆的行动方式是骑扫帚 —— 移动中(飞行)与看水晶球(悬空)时离地,
    // 从家具上方飞过。落地做事(搅锅/织毛衣/坐摇椅/睡)不飞。
    const airborne = (st.mode === 'walk' || (st.mode === 'act' && st.act.fly)) ? 64 : 0
    const popoAtt = sleeping ? { attach: 'popo_bed', zBias: 6 }
                  : (st.act.id === 'rock' && st.mode === 'act') ? { attach: 'popo_rocking_chair', zBias: 2 }
                  : airborne ? { airborne }
                  : {}

    const cpose = cst.mode === 'walk' ? 'bcat' : cst.act.poses[0]
    const cflip = cst.mode === 'walk' ? (cst.tx - cst.x) < 0 : false

    // ── 全部实体进同一个排序空间 ─────────────────────────────
    const ents = []
    for (const p of PETS) {
      const ps2 = window.actorSprite('popopet', p.pose, false)
      ents.push(window.placeActor('popopet', p.x + ps2.width / 2, p.y + ps2.height,
                                  p.pose, (p.tx - p.x) < 0, {}))
    }
    const opose = (t < owl.blinkUntil) ? 'owl2' : 'owl1'
    const os = window.actorSprite('popoowl', opose, false)
    ents.push(window.placeActor('popoowl', 200 + os.width / 2, 1604 + os.height, opose, false, {}))
    if (portal.state === 'out' && portal.kind) {
      const ks = window.actorSprite('popopet', portal.kind.pose, false)
      ents.push(window.placeActor('popopet', portal.x + ks.width / 2, portal.y + ks.height,
                                  portal.kind.pose, false, {}))
    }
    const cs = window.actorSprite('popocat', cpose, cflip)
    ents.push(window.placeActor('popocat', cst.x + cs.width / 2, cst.y + cs.height, cpose, cflip, {}))
    ents.push(window.placeActor('popo', drawX + window.ACTORS.popo.foot[0],
                                drawY + window.ACTORS.popo.foot[1], pose, flip, popoAtt))

    window.renderRoom(mainG, window.POPO_ROOM, t, ents)

    // L8 UI:可点道具的高亮与叙事气泡。两句都要调,漏一句 clickable 全是死的。
    // 抽屉的开合走引擎给的 onClick 钩子。
    // 原先自己挂了一个 click 监听去读 cv.__interaction.hot —— 那个字段根本不存在
    // （引擎里叫 hover），于是抽屉永远打不开，而且不报任何错。
    if (!cv.__interaction && window.attachRoomInteraction)
      window.attachRoomInteraction(cv, window.POPO_ROOM, {
        onClick(id) {
          if (id !== 'popo_drawer') return
          // 状态放在 room 上(引擎 roomState)，素材的 variant 自己读它。
          window.roomState(window.POPO_ROOM, { drawerOpen: !((window.POPO_ROOM.state || {}).drawerOpen) })
        }
      })
    if (window.drawInteraction) window.drawInteraction(mainG, window.POPO_ROOM, cv, t)

    // 角色附属绘制全部走引擎:房间只声明「谁 · 在哪 · 什么情绪 · 说什么」
    if (cst.mode === 'act' && cst.act.zzz)
      window.drawEmote(mainG, 'zzz', window.actorAnchor('popocat', cpose, cst.x, cst.y), t)
    if (portal.state === 'out' && portal.kind && t < portal.sayUntil)
      window.drawSay(mainG, window.actorAnchor('popopet', portal.kind.pose, portal.x, portal.y),
                     portal.kind.say, { ink: '#1a1620', paper: '#f6efdc' })

    const anc = window.actorAnchor('popo', pose, drawX, drawY)
    if (st.mode === 'act') {
      if (st.act.zzz) window.drawEmote(mainG, 'zzz', anc, t)
      if (st.act.id === 'feed' || st.act.id === 'knit') {
        if ((st.frame >> 4) % 2) window.drawEmote(mainG, 'heart', anc, t)
      }
    }
    // 婆婆的台词纸=淡紫（魔法小屋），与她屋里的紫灰石墙同一支色系
    if (st.sayText && t < st.sayUntil) window.drawSay(mainG, anc, st.sayText, { ink: '#2e2440', paper: '#f2ecfa' })
    else if (t >= st.sayUntil) st.sayText = null
  }
  requestAnimationFrame(loop)
})()
