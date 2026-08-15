// Asset spec for Taotao room extraction.
// L = inclusive 1-based line range into tao_furniture.js
// code = literal override (used where the original looped over N positions,
//        so the asset is authored once and placed N times in the plan)
const R = require('fs').readFileSync(__dirname + '/rnd.json', 'utf8')
const RND = JSON.parse(R)
const J = a => JSON.stringify(a)

// ── helper prelude injected into every draw() ────────────────────────────
// verbatim ports of the originals, rebound to the draw's own `g`
const PRELUDE = `
    const pxC=(cx,cy,r,color)=>{g.fillStyle=color
      for(let dy=-r;dy<=r;dy++){const dx=Math.sqrt(r*r-dy*dy)|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
    const pxE=(cx,cy,rx,ry,color)=>{g.fillStyle=color
      for(let dy=-ry;dy<=ry;dy++){const dx=(rx*Math.sqrt(1-(dy/ry)*(dy/ry)))|0;g.fillRect(cx-dx,cy+dy,dx*2,1)}}
    const pxRingT=(cx,cy,r,w2,color)=>{g.fillStyle=color
      for(let dy=-r;dy<=r;dy++){const dxo=Math.sqrt(r*r-dy*dy)|0;const ri=r-w2
        const dxi=Math.abs(dy)>ri?0:(Math.sqrt(ri*ri-dy*dy)|0)
        g.fillRect(cx-dxo,cy+dy,dxo-dxi,1);g.fillRect(cx+dxi,cy+dy,dxo-dxi,1)}}
`
// zoneRug / zoneRound / vase / pinkTuan are only needed by a few assets
const P_RUG = `
    const zoneRug=(x,y,w2,h2,base,edge,deco)=>{
      g.fillStyle='rgba(60,44,32,0.18)';g.fillRect(x+6,y+h2,w2,8)
      g.fillStyle=edge;g.fillRect(x,y,w2,h2)
      g.fillStyle=base;g.fillRect(x+10,y+10,w2-20,h2-20)
      g.fillStyle='rgba(120,150,140,0.16)'
      for(let yy=y+16;yy<y+h2-14;yy+=10)g.fillRect(x+12,yy,w2-24,2)
      g.fillStyle='rgba(255,255,255,0.55)'
      for(let k=x+18;k<x+w2-16;k+=24){g.fillRect(k,y+3,5,4);g.fillRect(k,y+h2-7,5,4)}
      for(let k=y+18;k<y+h2-16;k+=24){g.fillRect(x+3,k,4,5);g.fillRect(x+w2-7,k,4,5)}
      g.strokeStyle=edge;g.lineWidth=3
      g.strokeRect(x+26,y+26,w2-52,h2-52)
      for(const [qx,qy] of [[x+26,y+26],[x+w2-26,y+26],[x+26,y+h2-26],[x+w2-26,y+h2-26]]){
        g.fillStyle=edge
        g.fillRect(qx-8,qy-2,16,5);g.fillRect(qx-2,qy-8,5,16)
        g.fillStyle='rgba(255,255,255,0.65)';g.fillRect(qx-2,qy-2,5,5)
      }
      if(deco==='tassel'){
        for(let k=0;k<((w2/36)|0);k++){
          g.fillStyle=edge
          g.fillRect(x+10+k*36,y-9,5,9);g.fillRect(x+10+k*36,y+h2,5,9)
          g.fillStyle='rgba(255,255,255,0.55)'
          g.fillRect(x+10+k*36,y-4,5,2);g.fillRect(x+10+k*36,y+h2+6,5,2)
        }
      } else if(deco==='dots'){
        g.fillStyle=edge
        for(const [qx,qy] of [[x+46,y+46],[x+w2-52,y+46],[x+46,y+h2-52],[x+w2-52,y+h2-52]]){
          g.fillRect(qx,qy-5,5,15);g.fillRect(qx-5,qy,15,5)
        }
      }
    }
`
const P_ROUND = `
    const zoneRound=(cx,cy,r,base,edge)=>{
      g.fillStyle='rgba(60,44,32,0.15)'
      for(let dy=-6;dy<=6;dy++){
        const dxs=(r*Math.sqrt(1-(dy/6)*(dy/6)))|0
        g.fillRect(cx-dxs+8,cy+(r*0.42|0)+dy-4,dxs*2,1)
      }
      for(const [rr,col] of [[r,edge],[r-10,base]]){
        for(let dy=-rr*0.42|0;dy<=rr*0.42;dy++){
          const dxs=(rr*Math.sqrt(1-(dy/(rr*0.42))*(dy/(rr*0.42))))|0
          g.fillRect(cx-dxs,cy+dy,dxs*2,1)
        }
      }
      g.save();g.translate(cx,cy);g.scale(1,0.42)
      g.strokeStyle='rgba(120,150,140,0.22)';g.lineWidth=2
      for(let k=0;k<12;k++){
        const a2=k*Math.PI/6
        g.beginPath();g.moveTo(Math.cos(a2)*40,Math.sin(a2)*40)
        g.lineTo(Math.cos(a2)*(r-26),Math.sin(a2)*(r-26));g.stroke()
      }
      g.strokeStyle=edge;g.lineWidth=3
      g.beginPath();g.arc(0,0,r-24,0,7);g.stroke()
      g.strokeStyle='rgba(168,196,184,0.6)';g.lineWidth=2
      g.beginPath();g.arc(0,0,r-44,0,7);g.stroke()
      g.fillStyle=edge
      for(let k=0;k<8;k++){
        const a2=k*Math.PI/4
        const fx=Math.cos(a2)*66,fy=Math.sin(a2)*66
        g.fillRect(fx-6,fy-6,12,12)
      }
      g.fillStyle='rgba(255,255,255,0.6)'
      g.beginPath();g.arc(0,0,22,0,7);g.fill()
      g.fillStyle=edge
      g.beginPath();g.arc(0,0,12,0,7);g.fill()
      g.restore()
    }
`

// ── the inventory ────────────────────────────────────────────────────────
// zLayer is judged by REAL-WORLD height, not drawn pixel size.
const A = [

// ══ wall decals (wall:true) ══
{ id:'tao_moon_window', L:[[47,73]], wall:1, name:'月洞窗', cat:'墙面', tags:['窗','景'], scope:'generic' },
{ id:'tao_sword_glow', L:[[76,90]], wall:1, name:'桃夭宝剑', cat:'墙面', tags:['剑','发光'], scope:'character' },
{ id:'tao_scroll_luoshu', L:[[93,110]], wall:1, name:'洛书九宫挂轴', cat:'墙面', tags:['卷轴','术数'], scope:'generic' },
{ id:'tao_sword_rack', L:[[113,123]], wall:1, name:'剑架双剑', cat:'墙面', tags:['剑','架'], scope:'generic' },
{ id:'tao_dart_target', L:[[125,130]], wall:1, name:'飞镖靶', cat:'墙面', tags:['靶','练'], scope:'generic' },
{ id:'tao_drape_wide', wall:1, name:'粉纱幔（宽）', cat:'墙面', tags:['纱','垂'], scope:'character',
  code:`g.fillStyle='rgba(240,168,188,0.4)'
    g.fillRect(470,34,44,330)
    g.fillStyle='rgba(240,168,188,0.25)'
    g.fillRect(514,34,20,260)` },
{ id:'tao_drape_narrow', wall:1, name:'粉纱幔（窄）', cat:'墙面', tags:['纱','垂'], scope:'character',
  code:`g.fillStyle='rgba(240,168,188,0.4)'
    g.fillRect(940,34,44,300)` },
{ id:'tao_lantern', wall:1, name:'粉灯笼', cat:'墙面', tags:['灯','发光'], scope:'character',
  code:`const lx=60
    g.fillStyle='#3a2c20';g.fillRect(lx+9,34,3,20)
    g.fillStyle='#e87a98';g.fillRect(lx,54,22,28)
    g.fillStyle='#f0a8bc';g.fillRect(lx+4,58,14,20)
    g.fillStyle='#ffd76a';g.fillRect(lx+8,62,6,12)
    g.fillStyle='#3a2c20';g.fillRect(lx,54,22,3);g.fillRect(lx,79,22,3)` },
{ id:'tao_fan_round', wall:1, name:'团扇', cat:'墙面', tags:['扇','雅'], scope:'generic',
  code:`const fx=390,fy=150
    pxC(fx,fy,40,'#3a2c20')
    pxC(fx,fy,35,'#f6efdc')
    g.fillStyle='#f0a8bc'
    g.fillRect(fx-12,fy-10,10,10);g.fillRect(fx+4,fy-4,10,10)
    g.fillStyle='#5a8a44';g.fillRect(fx-4,fy+8,12,4)
    g.fillStyle='#a06a40';g.fillRect(fx-3,fy+35,6,26)` },
{ id:'tao_birdcage', L:[[640,647]], wall:1, name:'鸟笼', cat:'墙面', tags:['笼','雀'], scope:'generic' },
{ id:'tao_windchime', L:[[668,671]], wall:1, name:'风铃', cat:'墙面', tags:['铃','垂'], scope:'generic' },
{ id:'tao_sword_tassel', L:[[672,675]], wall:1, name:'剑穗挂件', cat:'墙面', tags:['穗','挂'], scope:'generic' },
{ id:'tao_yingluo', wall:1, name:'璎珞流苏', cat:'墙面', tags:['流苏','挂'], scope:'generic',
  code:`const yx=300
    g.fillStyle='#e8b23d';g.fillRect(yx,34,3,26)
    pxC(yx+1,66,8,'#5a9a8a')
    g.fillStyle='#e87a98'
    g.fillRect(yx-4,76,2,16);g.fillRect(yx+1,76,2,20);g.fillRect(yx+6,76,2,16)` },
{ id:'tao_dart_pouch', L:[[684,688]], wall:1, name:'镖囊', cat:'墙面', tags:['囊','镖'], scope:'generic' },
{ id:'tao_bagua_mirror', L:[[796,805]], wall:1, name:'八卦镜', cat:'墙面', tags:['镜','术数'], scope:'generic' },
{ id:'tao_peach_sword', L:[[807,812]], wall:1, name:'桃木剑', cat:'墙面', tags:['剑','法器'], scope:'generic' },
{ id:'tao_polaroid_string', L:[[814,824]], wall:1, name:'拍立得照片串', cat:'墙面', tags:['照片','串'], scope:'character' },

// ══ floor decals (cat 地面 → L1) ══
{ id:'tao_rug_center', cat:'地面', name:'中央方毯', tags:['毯','布'], scope:'character', rug:1,
  code:`zoneRug(420,730,600,620,'#cfdfd8','#a8c4b8','tassel')
    g.strokeStyle='#a8c4b8';g.lineWidth=3
    for(const [ccx,ccy,fx2] of [[478,792,1],[962,792,-1],[478,1288,1],[962,1288,-1]]){
      g.beginPath();g.arc(ccx,ccy,16,0.4,4.6);g.stroke()
      g.beginPath();g.arc(ccx+18*fx2,ccy+6,10,1,5.6);g.stroke()
      g.beginPath();g.arc(ccx-14*fx2,ccy+8,7,0,4.2);g.stroke()
    }` },
{ id:'tao_rug_round', cat:'地面', name:'梳妆圆毯', tags:['毯','圆'], scope:'generic', round:1,
  code:`zoneRound(246,620,232,'#cfdfd8','#a8c4b8')` },
{ id:'tao_rug_bedside', cat:'地面', name:'床边长毯', tags:['毯','条'], scope:'generic', rug:1,
  code:`zoneRug(1096,868,300,110,'#e8f1ee','#a8c4b8','dots')
    g.fillStyle='#cfdfd8'
    for(let k=0;k<5;k++)g.fillRect(1122+k*56,884,28,78)` },
{ id:'tao_rug_tea', cat:'地面', name:'茶点方毯', tags:['毯','方'], scope:'generic', rug:1,
  code:`zoneRug(48,1370,330,240,'#cfdfd8','#a8c4b8','dots')` },
{ id:'tao_rug_study', cat:'地面', name:'书房方毯', tags:['毯','方'], scope:'generic', rug:1,
  code:`zoneRug(1104,1756,330,250,'#cfdfd8','#a8c4b8','dots')` },
{ id:'tao_petals', cat:'地面', name:'散落花瓣', tags:['花瓣','装饰'], scope:'character',
  code:`const P14=${J(RND.p14)},P10=${J(RND.p10)}
    for(let k=0;k<14;k++){const px=P14[k][0],py=P14[k][1]
      g.fillStyle=k%3?'#f0a8bc':'#e8a0b4'
      g.fillRect(px,py,7,5);g.fillRect(px+3,py-3,5,4)}
    for(let k=0;k<10;k++){const px=P10[k][0],py=P10[k][1]
      g.fillStyle=k%2?'#f0a8bc':'#f6ccd8'
      g.fillRect(px,py,6,4);g.fillRect(px+2,py-3,4,4)}` },
{ id:'tao_door_mat', L:[[476,482]], cat:'地面', name:'门垫绣鞋', tags:['垫','鞋'], scope:'character' },
{ id:'tao_poem_papers', L:[[650,656]], cat:'地面', name:'诗笺散落', tags:['纸','诗'], scope:'generic' },
{ id:'tao_ext_slippers', L:[[949,950]], cat:'地面', name:'绣鞋（前景）', tags:['鞋','粉'], scope:'character' },

// ══ standing pieces ══
{ id:'tao_table_qimen', L:[[253,303]], name:'奇门局桌', cat:'桌案', tags:['木','术数'], scope:'character',
  zLayer:'low', clickable:1, say:'奇门遁甲，九宫八门。' },
{ id:'tao_cushion_pink', name:'粉蒲团', cat:'坐卧', tags:['布','可坐'], scope:'generic', zLayer:'low', sit:1,
  code:`const x=620,y=1310
    pxC(x,y+3,34,'rgba(40,30,20,0.2)')
    pxC(x,y,34,'#3a2c20')
    pxC(x,y,30,'#e8a0b4')
    pxC(x,y,20,'#f0b8c8')
    pxC(x,y,8,'#c86a88')` },
{ id:'tao_vanity', L:[[318,332]], name:'梳妆台', cat:'桌案', tags:['木','镜'], scope:'character',
  zLayer:'sort', clickable:1, say:'今天的桃桃也很可爱。' },
{ id:'tao_vanity_stool', L:[[334,334]], name:'妆凳', cat:'坐卧', tags:['凳','可坐'], scope:'generic', zLayer:'low', sit:1 },
{ id:'tao_bed', L:[[338,375]], name:'幔帐床', cat:'坐卧', tags:['床','纱','可卧'], scope:'character',
  zLayer:'sort', clickable:1, say:'再睡五分钟……' },
{ id:'tao_training_post', L:[[379,385]], name:'练功桩', cat:'器械', tags:['木','红布'], scope:'generic', zLayer:'sort' },
{ id:'tao_swing_cushion', L:[[390,402]], name:'桃子坐垫', cat:'坐卧', tags:['垫','桃'], scope:'character', zLayer:'sort' },
{ id:'tao_table_tea', L:[[406,431]], name:'茶点桌', cat:'桌案', tags:['木','茶点'], scope:'character',
  zLayer:'low', clickable:1, say:'珍珠奶茶，三分糖。' },
{ id:'tao_rabbit_nest', L:[[435,445]], name:'兔窝', cat:'杂物', tags:['草','兔'], scope:'character', zLayer:'low' },
{ id:'tao_vase_peach', name:'桃枝花瓶', cat:'器物', tags:['瓶','花'], scope:'generic', zLayer:'low',
  code:`const x=430,y=1400,sc=1
    g.fillStyle='#3a2c20';g.fillRect(x,y,44*sc,66*sc)
    g.fillStyle='#f6efdc';g.fillRect(x+4*sc,y+4*sc,36*sc,58*sc)
    g.fillStyle='#4a6a88'
    g.fillRect(x+8*sc,y+22*sc,28*sc,5*sc);g.fillRect(x+8*sc,y+40*sc,28*sc,5*sc)
    g.fillStyle='#6e5236'
    g.fillRect(x+18*sc,y-46*sc,5*sc,50*sc)
    g.fillRect(x+8*sc,y-30*sc,4*sc,24*sc)
    for(const [dx,dy] of [[14,-56],[2,-38],[26,-44],[8,-18]]){
      g.fillStyle='#f0a8bc'
      g.fillRect(x+dx*sc,y+dy*sc,10*sc,10*sc)
      g.fillStyle='#e87a98'
      g.fillRect(x+(dx+3)*sc,y+(dy+3)*sc,4*sc,4*sc)
    }` },
{ id:'tao_guqin_table', L:[[487,498]], name:'古琴桌', cat:'桌案', tags:['木','琴'], scope:'character',
  zLayer:'low', clickable:1, say:'桃花岛的曲子，弹给你听。' },
{ id:'tao_go_table', L:[[502,514]], name:'围棋小桌', cat:'桌案', tags:['木','棋'], scope:'generic', zLayer:'low' },
{ id:'tao_embroidery_hoop', L:[[517,524]], name:'绣绷', cat:'器物', tags:['绣','布'], scope:'generic', zLayer:'low' },
{ id:'tao_thread_basket', L:[[525,527]], name:'线笸箩', cat:'器物', tags:['笸箩','线'], scope:'generic', zLayer:'low' },
{ id:'tao_jewelry_box', L:[[530,534]], name:'首饰盒', cat:'器物', tags:['盒','珠'], scope:'generic', zLayer:'sort' },
{ id:'tao_cosmetics', L:[[535,536]], name:'胭脂水粉', cat:'器物', tags:['妆','瓶'], scope:'character', zLayer:'sort' },
{ id:'tao_umbrella', L:[[549,556]], name:'纸伞', cat:'器物', tags:['伞','纸'], scope:'generic', zLayer:'sort' },
{ id:'tao_clothes_rack', L:[[561,571]], name:'衣桁', cat:'收纳', tags:['木','衣'], scope:'character', zLayer:'sort' },
{ id:'tao_dart_case', L:[[575,583]], name:'暗器匣', cat:'收纳', tags:['匣','镖'], scope:'generic', zLayer:'low' },
{ id:'tao_wine_table', L:[[587,598]], name:'酒壶小几', cat:'桌案', tags:['木','酒'], scope:'character', zLayer:'low' },
{ id:'tao_incense_burner', L:[[602,606]], name:'香薰炉', cat:'器物', tags:['炉','香'], scope:'generic', zLayer:'low' },
{ id:'tao_pillow_pile', L:[[620,625]], name:'抱枕堆', cat:'坐卧', tags:['枕','软'], scope:'character', zLayer:'low' },
{ id:'tao_orchid_pot', name:'兰花盆栽', cat:'植物', tags:['花','盆'], scope:'generic', zLayer:'low',
  code:`const bx=64,by=1080
    g.fillStyle='#3a2c20';g.fillRect(bx,by,48,36)
    g.fillStyle='#4a6a88';g.fillRect(bx+4,by+4,40,28)
    g.fillStyle='#5a8a44'
    g.fillRect(bx+20,by-40,4,44)
    g.fillRect(bx+8,by-28,4,32);g.fillRect(bx+34,by-30,4,34)
    g.fillStyle='#f0a8bc';g.fillRect(bx+18,by-48,8,8)` },
{ id:'tao_candy_jar_amber', L:[[659,661]], name:'蜜饯罐', cat:'器物', tags:['罐','食'], scope:'generic', zLayer:'low' },
{ id:'tao_copper_pot', L:[[663,665]], name:'铜壶', cat:'器物', tags:['壶','铜'], scope:'generic', zLayer:'low' },
{ id:'tao_lamp_gauze', L:[[692,695]], name:'纱罩灯台', cat:'灯具', tags:['灯','纱'], scope:'generic', zLayer:'sort' },
{ id:'tao_blanket', L:[[696,698]], name:'床尾毛毯', cat:'布艺', tags:['毯','软'], scope:'generic', zLayer:'sort' },
{ id:'tao_wardrobe', L:[[710,720]], name:'粉双门衣柜', cat:'收纳', tags:['木','衣'], scope:'character',
  zLayer:'sort', clickable:1, say:'今天穿哪件好呢？' },
{ id:'tao_curio_shelf', L:[[723,732]], name:'多宝格', cat:'收纳', tags:['木','陈列'], scope:'generic', zLayer:'sort' },
{ id:'tao_screen_peach', L:[[735,764]], name:'桃花屏风', cat:'屏隔', tags:['屏','桃'], scope:'character', zLayer:'sort' },
{ id:'tao_desk_qimen', L:[[767,779]], name:'奇门书桌', cat:'桌案', tags:['木','灯'], scope:'character',
  zLayer:'low', clickable:1, say:'今日课业：起局三则。' },
{ id:'tao_stool_embroidered', L:[[780,781]], name:'绣凳', cat:'坐卧', tags:['凳','可坐'], scope:'generic', zLayer:'low', sit:1 },
{ id:'tao_flower_stand', L:[[784,792]], name:'花架', cat:'植物', tags:['架','花'], scope:'generic', zLayer:'sort' },
{ id:'tao_light_board', L:[[826,835]], name:'应援灯牌「桃」', cat:'灯具', tags:['灯','发光'], scope:'character',
  zLayer:'sort' },
{ id:'tao_luopan', L:[[837,844]], name:'罗盘', cat:'器物', tags:['盘','术数'], scope:'generic', zLayer:'low',
  clickable:1, say:'天盘地盘，人在其中。' },
{ id:'tao_flag_holder', L:[[847,853]], name:'令旗筒', cat:'器物', tags:['旗','筒'], scope:'character', zLayer:'low' },
{ id:'tao_book_stack', L:[[856,860]], name:'遁甲书堆', cat:'书卷', tags:['书','术数'], scope:'generic', zLayer:'low' },
{ id:'tao_nightstand', L:[[863,878]], name:'床头小几', cat:'桌案', tags:['木','妆'], scope:'character', zLayer:'low' },
{ id:'tao_headphones', L:[[880,885]], name:'猫耳耳机', cat:'器物', tags:['耳机','粉'], scope:'character', zLayer:'sort' },
{ id:'tao_candy_jar_glass', L:[[887,891]], name:'糖果罐', cat:'器物', tags:['罐','糖'], scope:'generic', zLayer:'low' },
{ id:'tao_chips_cola', L:[[894,899]], name:'薯片可乐', cat:'器物', tags:['零食','现代'], scope:'character', zLayer:'sort' },
{ id:'tao_selfie_stick', L:[[901,903]], name:'自拍杆', cat:'器物', tags:['杆','现代'], scope:'character', zLayer:'low' },
{ id:'tao_ring_light', L:[[907,930]], name:'环形补光灯', cat:'灯具', tags:['灯','直播'], scope:'character',
  zLayer:'sort', clickable:1, say:'开播啦——今天算奇门！' },
{ id:'tao_ext_crate', L:[[952,956]], name:'前景木箱', cat:'收纳', tags:['木','箱'], scope:'generic', zLayer:'low' },
]

// ── surfaces ─────────────────────────────────────────────────────────────
const SURFACES = {
  wall_taohua: `
    g.fillStyle='#ece4d6';g.fillRect(0,0,1440,430)
    g.fillStyle='#e2d8c6'
    const SP=${J(RND.wall)}
    for(let k=0;k<30;k++)g.fillRect(SP[k][0],SP[k][1],14,2)
    g.fillStyle='#8a6844';g.fillRect(0,0,1440,34)
    g.fillStyle='#755838';g.fillRect(0,28,1440,6)
    for(const x of [0,470,940,1408]){
      g.fillStyle='#8a6844';g.fillRect(x,0,32,430)
      g.fillStyle='#755838';g.fillRect(x+26,0,6,430)
    }
    g.fillStyle='#8a6844';g.fillRect(0,408,1440,22)
    g.fillStyle='#6e5236';g.fillRect(0,424,1440,6)`,
  floor_bamboo: `
    for(let y=430,k=0;y<2160;y+=26,k++){
      g.fillStyle=k%2?'#b8c294':'#aeb88a'
      g.fillRect(0,y,1440,26)
      g.fillStyle='#98a476';g.fillRect(0,y,1440,2)
      const off=k%2*60
      g.fillStyle='#a2ac80'
      for(let x=off;x<1440;x+=120)g.fillRect(x,y+6,3,14)
    }
    g.fillStyle='rgba(150,160,110,0.5)'
    const WR=${J(RND.floor)}
    for(let k=0;k<40;k++)g.fillRect(WR[k][0],WR[k][1],WR[k][2],1)
    g.fillStyle='rgba(255,200,214,0.12)'
    g.beginPath();g.moveTo(1020,430);g.lineTo(1330,430);g.lineTo(1400,760);g.lineTo(1100,760);g.fill()
    for(let y=2160,k=66;y<2560;y+=26,k++){
      g.fillStyle=k%2?'#b8c294':'#aeb88a'
      g.fillRect(0,y,1440,26)
      g.fillStyle='#98a476';g.fillRect(0,y,1440,2)
      g.fillStyle='#a2ac80'
      for(let x=k%2*60;x<1440;x+=120)g.fillRect(x,y+6,3,14)
    }`,
}

module.exports = { A, SURFACES, PRELUDE, P_RUG, P_ROUND }
