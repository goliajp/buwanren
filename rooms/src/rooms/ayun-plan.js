(function(){
  // 阿云房布局 —— 声明式:[素材id, x, y, 选项]。挂到 window 供房间本体复用。
  var ROOM = globalThis.AYUN_ROOM = {
    w: 1440, h: 2560, wallH: 450, extBand: 2160,
    palette: { wall:'#7e5e40', wallLine:'#6e5236', floor:'#c9a26a', floorLine:'#bd9760', skirt:'#4a3420' },
    grade: 'rgba(255,196,110,0.06)',
    plan: [
      ['ayun_window_lattice',72,112], ['ayun_window_lattice',1132,112],
      ['ayun_couplet_red',472,220], ['ayun_couplet_red',892,220],
      ['ayun_wall_daoist_set',-4,92], ['ayun_plaque_hall',564,92], ['ayun_scroll_starchart',640,224],
      ['ayun_wall_mirror_sword',344,208], ['ayun_poster_idol',944,116], ['ayun_poster_mecha',1174,106],
      ['ayun_shelf_books',28,472], ['ayun_shelf_books',240,472], ['ayun_shelf_topset',74,428],
      ['ayun_bed_couch',1092,456],
      ['ayun_body_pillow',1140,572,{attach:'ayun_bed_couch',zBias:2}],
      ['ayun_handheld_console',1282,684,{attach:'ayun_bed_couch',zBias:3}],
      ['ayun_table_night',1112,872], ['ayun_desk_study',88,888], ['ayun_rug_cloud',372,792],
      ['ayun_table_shipan',512,892], ['ayun_tv_stand',1128,1118],
      ['ayun_tv_flat',1138,1026,{attach:'ayun_tv_stand',zBias:2}],
      ['ayun_console_ps5',1146,1072,{attach:'ayun_tv_stand',zBias:3}],
      ['ayun_bonsai_pine',1288,1076], ['ayun_basket_scroll',52,1096],
      ['ayun_figure_shelf',1094,1150], ['ayun_censer_floor',796,1242], ['ayun_instant_meal',1258,1272],
      ['ayun_cushion_round',442,1316], ['ayun_cushion_round',874,1316], ['ayun_cushion_round',658,1388],
      ['ayun_rack_umbrella',1360,1328], ['ayun_cabinet_herb2',28,1356],
      ['ayun_screen_panel',1060,1472], ['ayun_screen_panel',1168,1448], ['ayun_screen_panel',1276,1472],
      ['ayun_qing_bowl',1024,1474], ['ayun_lamp_floor',940,1620], ['ayun_furnace_alch',388,1716],
      ['ayun_broom',1368,1720], ['ayun_bellows_set',320,1816], ['ayun_crates_stack',1192,1832],
      ['ayun_firewood',632,1880], ['ayun_door_frame',372,1934], ['ayun_books_unread',896,1996], ['ayun_gift_boxes',984,2008], ['ayun_water_vat',372,1940],
      // 小道具(自原房间「新道具」层提取)
      ['ayun_birdcage',1030,78], ['ayun_windchime',1116,84], ['ayun_cloak_hook',1314,300],
      ['ayun_divine_sticks',802,1149,{attach:'ayun_table_shipan',zBias:2}],
      ['ayun_almanac',592,1152,{attach:'ayun_table_shipan',zBias:2}],
      ['ayun_fire_tongs',292,1934], ['ayun_hand_warmer',1128,842], ['ayun_open_book',1244,698,{attach:'ayun_bed_couch',zBias:2}],
      ['ayun_incense_box',1032,1322], ['ayun_candle_snuffer',998,1892], ['ayun_tea_washer',1178,964],
      ['ayun_dustpan',54,1892],
      ['ayun_floor_boards',548,2272], ['ayun_cabinet_low',876,2290],
    ],
    // ══ 表演态:点「请阿云起一课」时的定格 ══
    // 起课要用的归到中心圆桌上摆正,阿云站桌北不动。
    // props 按 id 覆盖平时位置;actor 锁定站位与姿态。
    perform: {
      actor: { x: 680, y: 762, poses: ['divine1', 'divine2'], fps: 1.4, flip: false, pointer: true, speed: 18 },
    /* 按钮上不写行话。「起一课」「排个盘」「测个字」「指点迷津」这些是
       术数名词，只有付费报告的专业页才留;界面上一律说人话。
       实测:给一位没听说过命理的人看这四句，三句完全不懂 ——
       「起一课」被读成「上一节课」，「排个盘」猜成排队上菜，
       「指点迷津」认得字却说「是我爸妈朋友圈里的词，配一朵莲花那种」。

       写法是【这位在屏幕上真的做的那个动作】:六颗各不相同，
       而且每颗都预告了点下去会看到什么。行话反而做不到 ——
       「起一课」看不出画面。 */
      button: 'ayunCastBtn', labels: ['请阿云掐指算算', '收了'], stateKey: 'casting',
      lineGap: 5200,
      lines: ['时辰这东西  你不定它  它就定你', '四课立起来  人事才有骨架',
              '初传是因  中传是变  末传是果', '课是死的  人是活的',
              '日子走到哪里  课就从哪里起', '一课看己  二课看人  三课四课看它们怎么缠',
              '传下去了  往后它自己会走', '看得清  未必躲得开',
              '先把此刻按住  别让它跑了', '事情总有四个面  平常只看得见一面',
              '起手容易  落处难', '唔  有意思'],
      props: [
        ['ayun_almanac',       574, 944],    // 历书摊在左手边(桌北沿):先查干支月将
        ['ayun_divine_sticks', 806, 944],    // 卦筹排在右手边,伸手可及
      ],
    },
  }
  // ── 宿主那一段 ────────────────────────────────────────────────
  // 以上是房间数据(AYUN_ROOM),与平台无关,小程序要的就是它。
  // 以下是【设计页上的对照演示】——往页面里另外两块画布画新旧管线的对比,
  // 只有那一页需要。小程序侧连这段都不该加载。
  if (typeof document === 'undefined') return

  function run(){
    if(!globalThis.renderRoom) return setTimeout(run,60)
    var cv=document.getElementById('rbNew'); if(!cv) return
    var g=cv.getContext('2d'), shown=0
    function frame(t){
      // 演示角色:沿路线走动,验证与家具的遮挡关系一视同仁
      var T=t/1000, pts=[[470,680],[900,760],[1180,1000],[900,1500],[470,1300]]
      var seg=(T/2.2)%pts.length, i0=seg|0, i1=(i0+1)%pts.length, f=seg-i0
      var ax=pts[i0][0]+(pts[i1][0]-pts[i0][0])*f, ay=pts[i0][1]+(pts[i1][1]-pts[i0][1])*f
      var mv=pts[i1][0]-pts[i0][0]
      var pose=((t/160)|0)%2 ? 'walkside1':'walkside3'
      var actors=[ globalThis.placeActor('ayun', ax, ay, pose, mv>0),
                   globalThis.placeActor('ayun', 1190, 800, 'sleep', false, {attach:'ayun_bed_couch', zBias:1}) ]
      var inst=globalThis.renderRoom(g, ROOM, t, actors)
      if(!shown){ shown=inst.length
        var c=document.getElementById('rbCount'); if(c) c.textContent='· '+shown+' 件 · 全管线（AO/光照/尘埃/分级）' }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    var src=document.getElementById('ayunCanvas'), dst=document.getElementById('rbOrig')
    if(src&&dst){ var f=function(){ dst.getContext('2d').drawImage(src,0,0) }; setTimeout(f,1200); setTimeout(f,3200) }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run()
})()