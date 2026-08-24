(function(){
    var CHARS=[['ayun','阿云'],['tao','桃桃'],['tenz','丹增'],['popo','婆婆'],['shenyan','沈砚'],['bailu','白鹭'],['chenjiu','陈九'],['suhe','苏合'],['leiming','雷鸣'],['yanniang','燕娘'],['laogui','老龟'],['muyi','木一'],['aluo','阿罗'],['xuanming','玄冥'],['aying','阿萤'],['jiangya','姜牙'],['weila','薇拉'],['rune','卢恩'],['mago','玛戈'],['sesir','塞西尔'],['yisha','伊莎'],['orlando','奥兰多'],['lilith','莉莉丝'],['thomas','托马'],['mira','米拉'],['kama','卡玛'],['aman','阿曼'],['engo','恩戈'],['rama','拉玛'],['xueyao','雪鸮'],['chizuru','千鹤'],['set','塞特'],['kdata','K'],['xiaoman','小满'],['laoxu','老徐'],['cyber','赛博'],['ami','阿弥'],['barista','阿咖'],['courier','小邮'],['anonymous','无名']];
    // 重画角色 override (rgb网格) —— 设计表与游戏优先读此处
    var FRONT_OVR={
      xuanming:{pal:{K:'#1a1620',D:'#2c3440',d:'#232a34',R:'#c84838'},rows:['...KKKK....','..KDDDDK...','.KDDDDDDK..','.KDRDDRDK..','.KDDDDDDK..','.KDdDDdDK..','..KDDDDK...','..KdDDdK...','...KdDK....','...KdKdK...','....K.K....']},
      popo:{pal:{K:'rgb(58,44,32)',V:'rgb(122,90,154)',X:'rgb(232,224,208)',F:'rgb(240,200,160)',e:'rgb(74,54,38)',n:'rgb(200,160,128)',y:'rgb(232,178,61)',Y:'rgb(255,215,106)',N:'rgb(160,106,64)'},
        rows:['....KyyyyK....','...KyYYYYyK...','...KyYYYYyK...','....KyyyyK....','......NN......','......NNKK....','......NKVVK...','......KVVK....','.....KVVVK....','....KVVVVK....','...KVVVVVVK...','..KVyyVVVVVK..','.KKKKKKKKKKKK.','..KXXFFFFXXK..','..KXFeFFeFXK..','...KFFnFFFK...','...KFFFFFK....','..KVVVVVVVK...','..KVVVVVVVK...','...KK.NN.KK...','......NN......']},
      leiming:{pal:{K:'rgb(58,44,32)',H:'rgb(90,70,50)',F:'rgb(232,200,160)',E:'rgb(42,32,24)',O:'rgb(208,122,46)',o:'rgb(168,94,32)',y:'rgb(224,176,72)',n:'rgb(122,90,58)',W:'rgb(240,220,192)'},
        rows:['...KKKKKK...','..KHHHHHHK..','.KHWWWWWWHK.','.KHFFFFFFHK.','.KFEFFFEFFK.','.KFFFFFFFFK.','.KnFFnnFFnK.','.KnnFFFFnnK.','..KnnnnnnK..','..KKKKKKKK..','.KOOOOOOOOK.','KOOOOOOOOOOK','KOOyyKKyyOOK','KOOOOOOOOOOK','.KOoooooooK.','.KOK.KK.KOK.']},
      yanniang:{pal:{K:'#3a2c20',H:'#b8b0a4',F:'#f0c8a0',n:'#c8a080',C:'#8a4a6a',c:'#6a3852'},rows:['.....KHHK...','....KHHHHK..','..KHHHHHHK..','.KHFFFFFFHK.','.KFKKFFKKFK.','.KFnFFFFnFK.','.KFFFnnFFFK.','..KFFFFFFK..','...KKKKKK...','...KCCCCK...','..KcCCCCcK..','..KCCCCCCK..','.KcCCCCCCcK.','...KK..KK...']},
      muyi:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#4a3a2c',A:'#c8a040',C:'#4a6a88',c:'#385570',D:'#c8a040'},rows:['....KKKK....','...KHHHHK...','..KAAAAAAK..','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFrFFFFrFK.','..KFFFFFFK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCcccCCCK.','...KGG.GGK..','...KK...KK..']},
      aluo:{pal:{K:'#3a2c20',H:'#4a3a2c',D:'#c84838',d:'#e86a50',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#6aa848',c:'#4a8830'},rows:['.......KDK..','......KdDK..','..KHHHHHdK..','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFrFFFFrFK.','..KFFFFFFK..','...KKKKKK...','...KCCCCK...','..KCCCCCCK..','..KCccCCCK..','..KcCCCCcK..','...KK..KK...']},
      aying:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#5a4632',C:'#e8c840',c:'#c8a028',D:'#ffd76a'},rows:['......KKKK..','.....KHHHHK.','.....KHDDHK.','.KHHHHHHHHK.','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFrFFFFrFK.','..KFFFFFFK..','...KKKKKK...','...KCCCCK...','..KCCCCCCK..','..KCCCCCCK..','.KcCCCCCCcK.','...KK..KK...']},
      jiangya:{pal:{K:'#3a2c20',A:'#d8b060',a:'#b89040',H:'#8a8578',F:'#f0c8a0',E:'#241a10',n:'#8a8578',C:'#4a6a88',c:'#385570'},rows:['.....KAK....','....KAaAK...','..KAAAAAAK..','KAAAAAAAAAAK','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFnnFFnnFK.','..KFFnnFFK..','...KKKKKK...','...KCCCCK...','..KCcCCcCK..','..KcCCCCcK..','...KK..KK...']},
      weila:{pal:{K:'#3a2c20',H:'#e0c060',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#3a4a7a',c:'#2c3a62',D:'#ffd76a'},rows:['....KKKK....','..KKHHHHKK..','..KHHHHHHK..','.KHFFFFFFHK.','.KHEFFFFEHK.','.KHFFFFFFHK.','.KHrFFFFrHK.','.KHFFFFFFHK.','.KHKKKKKKHK.','.KHKCCCCKHK.','.KHCCDCCCHK.','..KCCCCDCK..','.KcCCCCCCcK.','...KK..KK...']},
      rune:{pal:{K:'#3a2c20',H:'#c8c4bc',n:'#c8c4bc',F:'#f0c8a0',E:'#241a10',C:'#3a4a5a',c:'#2c3a48',D:'#8ab4c8'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHFFFFFFHK.','.KFEFFFFEFK.','.KnFFFFFFnK.','.KnnFFFFnnK.','..KnnnnnnK..','...KKKKKK...','...KCCCCK...','..KCCDCCCK..','..KCDDDCCK..','.KcCCDCCCcK.','...KK..KK...']},
      mago:{pal:{K:'#3a2c20',A:'#2a6a5a',a:'#1e564a',H:'#5a4632',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#a8563e',c:'#8a4432',W:'#f0ece0'},rows:['....KAAK....','..KAAAAAAK..','.KAaAAAAaAK.','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFrFFFFrFK.','..KFFFFFFK..','...KKKKKK...','...KCCCCK...','..KCWWWWCK..','..KCWccWCK..','.KcCWWWWCcK.','...KK..KK...']},
      sesir:{pal:{K:'#3a2c20',H:'#6a4a32',F:'#f0c8a0',E:'#241a10',C:'#3a3a44',c:'#2c2c36',D:'#e8b23d',d:'#8a3a2c'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFFFFFFFFK.','..KFFFFFFK..','...KKKKKK...','...KCCCCK...','..KCCddCCK..','..KCDCCCCK..','.KcCCDCCCcK.','...KK..KK...']},
      yisha:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#8a2838',c:'#6e1e22',W:'#f0ece0'},rows:['....KKKK....','..KKHHHHKK..','..KHHHHHHK..','.KHFFFFFFHK.','.KHEFFFFEHK.','.KHFFFFFFHK.','.KHrFFFFrHK.','.KHFFFFFFHK.','.KHKKKKKKHK.','.KHKWWWWKHK.','.KHCCCCCCHK.','..KCCCCCCK..','.KcCCCCCCcK.','...KK..KK...']},
      orlando:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',E:'#241a10',n:'#4a3626',C:'#6a4a8a',c:'#553a70',D:'#e8b23d'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFnnFFFK.','.KFnnFFnnFK.','..KFFFFFFK..','...KKKKKK...','...KCCCCK...','..KCCCCCCK..','..KCDDDDCK..','.KcCCCCCCcK.','...KK..KK...']},
      lilith:{pal:{K:'#3a2c20',H:'#241c28',F:'#f0d8c8',E:'#241a10',C:'#4a2c5a',c:'#3a2248',D:'#8a6aa8'},rows:['....KKKK....','..KKHHHHKK..','..KHHHHHHK..','.KHFFFFFFHK.','.KHEFFFFEHK.','.KHFFFFFFHK.','.KHFFFFFFHK.','.KHFFFFFFHK.','.KHKKKKKKHK.','.KHKCCCCKHK.','.KHCDCCCCHK.','..KCCCCDCK..','.KcCCCCCCcK.','...KK..KK...']},
      thomas:{pal:{K:'#3a2c20',A:'#6a5340',F:'#f0c8a0',n:'#c8a080',C:'#6a5340',c:'#554330',D:'#c8b090'},rows:['....KAAK....','...KAAAAK...','..KAAAAAAK..','.KAAFFFFAAK.','.KAKKFFKKAK.','.KAFFFFFFAK.','.KAFFnnFFAK.','..KFFFFFFK..','...KKKKKK...','...KCCCCK...','..KCCCCCCK..','..KDDDDDDK..','.KcCCCCCCcK.','...KK..KK...']},
      mira:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#2c2420',A:'#c84858',B:'#e8b23d',C:'#a83848',c:'#8a2c3a',D:'#e8b23d'},rows:['...KAAAAK...','..KAAAAAAK..','.KABABABABK.','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFrFFFFrFK.','..KFFFFFFK..','...KKKKKK...','...KCCCCK...','..KCCCCCCK..','..KCCCCCCK..','.KcCCCCCCcK.','...KK..KK...']},
      kama:{pal:{K:'#3a2c20',F:'#d8a878',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#2c2420',A:'#2a8a7a',B:'#e8b23d',D:'#e8b23d',C:'#2a8a7a',c:'#1e6a5e'},rows:['.KD.KDK.DK..','..KAAAAAAK..','.KAABAABAABK','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFFFFFFFFK.','..KFFFFFFK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCcccCCCK.','...KGG.GGK..','...KK...KK..']},
      aman:{pal:{K:'#3a2c20',F:'#d8a878',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#2c2420',A:'#f0ece0',B:'#d8d0c0',C:'#c8a060',c:'#a88448',D:'#8a6a3a'},rows:['....KAAK....','..KAAAAAAK..','.KAABAAABAK.','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFFFFFFFFK.','..KFFFFFFK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCDDDDCCK.','..KcCCCCCcK.','...KK...KK..']},
      engo:{pal:{K:'#3a2c20',H:'#1a1410',F:'#8a5a3a',E:'#0e0a08',C:'#e8b23d',c:'#c89020',D:'#2a8a5a',W:'#f0ece0'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFFFFFFFFK.','..KFFFFFFK..','...KKKKKK...','..KCWCCWCK..','..KCCCCCCK..','..KCDDDDCK..','.KcCCCCCCcK.','...KK..KK...']},
      rama:{pal:{K:'#3a2c20',H:'#2c2420',F:'#d8a878',E:'#241a10',D:'#c83828',C:'#e88028',c:'#c8661e'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHFFDFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFFFFFFFFK.','..KFFFFFFK..','...KKKKKK...','...KcCCCK...','..KCcCCCCK..','..KCCcCCCK..','.KcCCCcCCcK.','...KK..KK...']},
      chizuru:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',E:'#241a10',r:'#e89080',W:'#f0ece0',D:'#c83838',d:'#a82c2c'},rows:['....KKKK....','..KKHHHHKK..','.KHHHDDHHHK.','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFrFFFFrFK.','..KFFFFFFK..','...KKKKKK...','...KWWWWK...','..KWWWWWWK..','..KDDDDDDK..','.KDDDDDDDDK.','.KdDDDDDDdK.','...KK..KK...']},
      set:{pal:{K:'#3a2c20',A:'#e8b23d',B:'#3858a8',F:'#d8a878',E:'#14100c',W:'#f0ece0',w:'#d8d0c0',D:'#e8b23d'},rows:['...KAAAAK...','..KBABABAK..','.KABABABABK.','.KAFFFFFFAK.','.KFEEFFEEFK.','.KFFFFFFFFK.','.KFFFFFFFFK.','..KFFFFFFK..','...KKKKKK...','...KWWWWK...','..KWWWWWWK..','..KWDDDDWK..','.KwWWWWWWwK.','...KK..KK...']},
      kdata:{pal:{K:'#3a2c20',H:'#3a3a44',F:'#f0c8a0',E:'#14100c',W:'#eef0f2',w:'#d0d4d8',D:'#4ab0a8'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHFFFFFFHK.','.KFEEFFEEFK.','.KFFFFFFFFK.','.KFFFFFFFFK.','..KFFFFFFK..','...KKKKKK...','...KWWWWK...','..KWWDDWWK..','..KWWWWWWK..','.KwWWWWWWwK.','...KK..KK...']},
      xiaoman:{pal:{K:'#3a2c20',H:'#5a4632',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#4ab0a0',c:'#389080',D:'#f0ece0'},rows:['.....KHK....','...KKHHKK...','..KHHHHHHK..','.KHFFFFFFHK.','.KHEFFFFEHK.','.KKFFFFFFKK.','.KFrFFFFrFK.','..KFFFFFFK..','...KKKKKK...','...KCCCCK...','..KCCDDCCK..','..KCCCCCCK..','.KcCCCCCCcK.','...KK..KK...']},
      laoxu:{pal:{K:'#3a2c20',H:'#8a8578',F:'#f0c8a0',E:'#241a10',n:'#c8a080',C:'#5a5a66',c:'#46464f',D:'#c83838'},rows:['....KKKK....','...KFFFFK...','..KFFFFFFK..','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFnFFFFnFK.','..KFFFFFFK..','...KKKKKK...','...KCCCCK...','..KCCDDCCK..','..KCCDDCCK..','.KcCCCCCCcK.','...KK..KK...']},
      cyber:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#2c2434',A:'#2c2434',C:'#2c2434',c:'#221c2a',D:'#4ad4e8'},rows:['....KAAK....','...KAAAAK...','..KADDDAKK..','.KHFFFFFFHK.','.KEEEFFEEEK.','.KFFFFFFFFK.','.KFFFFFFFFK.','..KFFFFFFK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCDDDDCCK.','..KcCCCCCcK.','...KK...KK..']},
      ami:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#c86a8a',C:'#e85a90',c:'#c84070',D:'#ffd76a'},rows:['..KHHK..KHHK','..KHHHKKHHHK','...KHHHHHHK.','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFrFFFFrFK.','..KFFFFFFK..','...KKKKKK...','...KCCCCK...','..KCCCCCCK..','..KCCCCCCK..','.KcCCCCCCcK.','...KK..KK...']},
      barista:{pal:{K:'#3a2c20',A:'#6a4a32',H:'#4a3a2c',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#6a4a32',c:'#553a28',W:'#f0ece0',w:'#d8d0c0'},rows:['...KAAAAK...','..KAAAAAAK..','..KAAAAAAKK.','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFrFFFFrFK.','..KFFFFFFK..','...KKKKKK...','...KCWWCK...','..KWWWWWWK..','..KWWWWWWK..','.KcWWWWWWcK.','...KK..KK...']},
      courier:{pal:{K:'#3a2c20',A:'#3a6a9a',H:'#4a3a2c',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#3a6a9a',c:'#2c527a',D:'#e8b23d',s:'#8a6a3a'},rows:['....KAAK....','...KADAAK...','..KAAAAAAK..','.KHFFFFFFHK.','.KFEFFFFEFK.','.KFFFFFFFFK.','.KFrFFFFrFK.','..KFFFFFFK..','...KKKKKK...','...KCsCCK...','..KCCsCCCK..','..KCCCsCCK..','.KcCCCsCCcK.','...KK..KK...']}

    };
    // 手绘侧面(朝右)与背面 —— 逐角色补齐; 无则回退派生
    var AYP={K:'rgb(58,44,32)',H:'rgb(74,58,44)',j:'rgb(168,132,90)',F:'rgb(240,200,160)',E:'rgb(74,54,38)',P:'rgb(232,144,128)',B:'rgb(90,122,150)',b:'rgb(70,96,122)'};
    var TAP={K:'rgb(58,44,32)',H:'rgb(74,58,44)',F:'rgb(240,200,160)',E:'rgb(74,54,38)',r:'rgb(232,144,128)',P:'rgb(232,122,144)',q:'rgb(200,90,112)'};
    var TZP={K:'rgb(58,44,32)',F:'rgb(240,200,160)',B:'rgb(42,32,24)',R:'rgb(168,72,56)',r:'rgb(138,58,44)',y:'rgb(232,178,61)'};
    var POPP={K:'rgb(58,44,32)',V:'rgb(122,90,154)',X:'rgb(232,224,208)',F:'rgb(240,200,160)',e:'rgb(74,54,38)',n:'rgb(200,160,128)',y:'rgb(232,178,61)',Y:'rgb(255,215,106)',N:'rgb(160,106,64)'};
    var SIDE_OVR={
      ayun:{pal:AYP,rows:['....KHK....','...KjHHK...','...KKKKK...','..KHHHHHK..','.KHHHHHFFK.','.KHHHFFEFK.','.KHHHFFFFK.','.KHHFFFFFK.','.KHHFFPFFK.','..KHFFFFK..','...KKKKK...','...KBBBK...','..KBBBBBK..','..KBBBBBK..','..KbbbbK...','...K..K....']},
      tao:{pal:TAP,rows:['...KKKK....','..KHHHHK...','..KKKKKK...','.KHHHHHHK..','.KHHHHFFFK.','KHHHHFEFFK.','KHHHFFFFFK.','KHHHFFFFFK.','.KHHFFrFFK.','..KFFFFFK..','...KKKKK...','..KPPPPK...','.KPPPPPPK..','.KPPPPPPK..','.KqPPPPqK..','...K..K....']},
      tenz:{pal:TZP,rows:['...KKKKK...','..KFFFFFK..','.KFFFFFFFK.','.KFFFFKFFK.','.KFFFFBFFK.','.KFFFFFFFK.','.KFFFFFFK..','..KFFFFK...','...KKKKK...','...KRRFK...','..KyRRRFK..','..KRRRRRK..','..KrRRRK...','...KK.KK...']},
      popo:{pal:POPP,rows:['..........KK........','.........KVVK.......','..........KVVK......','..........KVVVK.....','..........KVVVVK....','.........KVVVVVVK...','........KVVVVVyyVK..','.......KKKKKKKKKKKK.','........KXXFFFFXXK..','........KXFeFFeFXK..','....Kyy..KFFFnFFFK..','...KyYYyKKVVVVVVVK..','..KyYYYyNNVVVVVVVVK.','...KyYYyK.KVVVKVVK..','....Kyy.....KFK.KFK.']},
      yanniang:{pal:{K:'#3a2c20',H:'#b8b0a4',F:'#f0c8a0',n:'#c8a080',C:'#8a4a6a',c:'#6a3852'},rows:['....KHHK...','...KHHHHK..','...KKKKK...','..KHHHHHK..','.KHHHHFFFK.','.KHHHFKKFK.','.KHHHFFFFK.','.KHHFnFFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KcCCCcK..','..KCCCCCK..','..KcCCCcK..','...KK.KK...']},
      muyi:{pal:{K:'#3a2c20',H:'#4a3a2c',A:'#c8a040',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#4a6a88',c:'#385570'},rows:['....KHHK...','...KAAAAK..','..KHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCCCCCK..','..KCcCCCK..','..KcCCCcK..','...KK.KK...']},
      aluo:{pal:{K:'#3a2c20',H:'#4a3a2c',D:'#c84838',d:'#e86a50',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#6aa848',c:'#4a8830'},rows:['KDK........','KdDK.......','.KKHHHHK...','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCCCCCK..','..KCcCCCK..','..KcCCCcK..','...KK.KK...']},
      aying:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#5a4632',C:'#e8c840',c:'#c8a028',D:'#ffd76a'},rows:['.KKK.......','KHHHK......','KHDDHKKK...','.KKHHHHHK..','.KHHHHHFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCCCCCK..','..KCCCCCK..','..KcCCCcK..','...K..K....']},
      jiangya:{pal:{K:'#3a2c20',A:'#d8b060',a:'#b89040',H:'#8a8578',F:'#f0c8a0',E:'#241a10',n:'#8a8578',C:'#4a6a88',c:'#385570'},rows:['....KAK....','...KAaAK...','..KAAAAAK..','KAAAAAAAAAK','.KHHHFFFK..','.KHHFEFFK..','.KHHFFnnK..','..KHFFnFK..','...KKKK....','...KCCCK...','..KCcCCK...','..KcCCcK...','...KK.KK...']},
      weila:{pal:{K:'#3a2c20',H:'#e0c060',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#3a4a7a',c:'#2c3a62',D:'#ffd76a'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','.KHHFFFFK..','.KHHKKKK...','.KHHKCCCK..','.KHKCCCCK..','..KKCDCCK..','..KcCCCcK..','...KK.KK...']},
      rune:{pal:{K:'#3a2c20',H:'#c8c4bc',n:'#c8c4bc',F:'#f0c8a0',E:'#241a10',C:'#3a4a5a',c:'#2c3a48',D:'#8ab4c8'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFnnFK.','..KHFnnnK..','...KKnnK...','...KKKKK...','...KCCCK...','..KCDCCCK..','..KCCCCCK..','..KcCCCcK..','...KK.KK...']},
      mago:{pal:{K:'#3a2c20',A:'#2a6a5a',a:'#1e564a',H:'#5a4632',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#a8563e',c:'#8a4432',W:'#f0ece0'},rows:['...KAAK....','..KAAAAK...','.KAaAAAAK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCWWCK...','..KCWWCK...','..KcCCCcK..','...KK.KK...']},
      sesir:{pal:{K:'#3a2c20',H:'#6a4a32',F:'#f0c8a0',E:'#241a10',C:'#3a3a44',c:'#2c2c36',D:'#e8b23d',d:'#8a3a2c'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFFFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCCCCCK..','..KCCCCCFK.','..KcCCcK.K.','...KK.KK.D.']},
      yisha:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#8a2838',c:'#6e1e22',W:'#f0ece0'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','.KHHFFFFK..','.KHHKWWK...','.KHHKCCCK..','.KHKCCCCK..','..KKCCCCK..','..KcCCCcK..','...KK.KK...']},
      orlando:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',E:'#241a10',n:'#4a3626',C:'#6a4a8a',c:'#553a70',D:'#e8b23d'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFnFK.','.KHHFFFFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCCCCCK..','..KCDDCCK..','..KcCCCcK..','...KK.KK...']},
      lilith:{pal:{K:'#3a2c20',H:'#241c28',F:'#f0d8c8',E:'#241a10',C:'#4a2c5a',c:'#3a2248',D:'#8a6aa8'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFFFFK.','.KHHFFFFK..','.KHHKKKK...','.KHHKCCCK..','.KHKCDCCK..','..KKCCCCK..','..KcCCCcK..','...KK.KK...']},
      thomas:{pal:{K:'#3a2c20',A:'#6a5340',F:'#f0c8a0',n:'#c8a080',C:'#6a5340',c:'#554330',D:'#c8b090'},rows:['...KAAK....','..KAAAAK...','.KAAAAAAK..','.KAAAFFFK..','.KAAFKKFK..','.KAAFFFFK..','.KAAFFnFK..','..KAFFFK...','...KKKK....','...KCCCK...','..KCCCCK...','..KDDDDK...','..KcCCcK...','...KK.KK...']},
      mira:{pal:{K:'#3a2c20',A:'#c84858',B:'#e8b23d',H:'#2c2420',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#a83848',c:'#8a2c3a'},rows:['...KAAAK...','..KAAAAAK..','.KABABABK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCCCCCK..','..KCCCCCK..','..KcCCCcK..','...KK.KK...']},
      kama:{pal:{K:'#3a2c20',A:'#2a8a7a',D:'#e8b23d',H:'#2c2420',F:'#d8a878',E:'#241a10',C:'#2a8a7a',c:'#1e6a5e'},rows:['..KDK......','.KAAAAK....','.KADAADK...','.KHHHFFFK..','.KHHFEFFK..','.KHHFFFFK..','.KHFFFFFK..','..KFFFFK...','...KKKK....','...KCCCK...','..KCCCCK...','..KCcCCK...','..KcCCcK...','...KK.KK...']},
      aman:{pal:{K:'#3a2c20',A:'#f0ece0',B:'#d8d0c0',F:'#d8a878',E:'#241a10',C:'#c8a060',c:'#a88448'},rows:['...KAAK....','..KAAAAK...','.KABAABAK..','.KAAAFFFK..','.KAAFEFFK..','.KAAFFFFK..','.KAFFFFFK..','..KFFFFK...','...KKKK....','...KCCCK...','..KCCCCK...','..KCcCCK...','..KcCCcK...','...KK.KK...']},
      engo:{pal:{K:'#3a2c20',H:'#1a1410',F:'#8a5a3a',E:'#0e0a08',C:'#e8b23d',c:'#c89020',D:'#2a8a5a',W:'#f0ece0'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHFFFK..','.KHHFEFFK..','.KHHFFFFK..','.KHFFFFFK..','..KFFFFK...','...KKKK....','...KWCCK...','..KCCCCK...','..KCDDCK...','..KcCCcK...','...KK.KK...']},
      rama:{pal:{K:'#3a2c20',H:'#2c2420',F:'#d8a878',E:'#241a10',D:'#c83828',C:'#e88028',c:'#c8661e'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHFDFK..','.KHHFEFFK..','.KHHFFFFK..','.KHFFFFFK..','..KFFFFK...','...KKKK....','...KcCCK...','..KCcCCK...','..KCCcCK...','..KcCCcK...','...KK.KK...']},
      chizuru:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',E:'#241a10',r:'#e89080',W:'#f0ece0',D:'#c83838',d:'#a82c2c'},rows:['...KKKK....','..KHHHHK...','.KHHDDHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','..KHFFFFK..','...KKKKK...','...KWWWK...','..KWWWWWK..','..KDDDDDK..','..KDDDDDK..','..KdDDDdK..','...KK.KK...']},
      set:{pal:{K:'#3a2c20',A:'#e8b23d',B:'#3858a8',F:'#d8a878',E:'#14100c',W:'#f0ece0',w:'#d8d0c0',D:'#e8b23d'},rows:['...KAAAK...','..KBABABK..','.KABABABAK.','.KABAFFFK..','.KABFEEFK..','.KABFFFFK..','.KAAFFFFK..','..KAFFFK...','...KKKK....','...KWWWK...','..KWWWWK...','..KWDDWK...','..KwWWwK...','...KK.KK...']},
      kdata:{pal:{K:'#3a2c20',H:'#3a3a44',F:'#f0c8a0',E:'#14100c',W:'#eef0f2',w:'#d0d4d8',D:'#4ab0a8'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHFFFK..','.KHHFEEFK..','.KHHFFFFK..','.KHFFFFFK..','..KFFFFK...','...KKKK....','...KWWWK...','..KWDDWK...','..KWWWWK...','..KwWWwK...','...KK.KK...']},
      xiaoman:{pal:{K:'#3a2c20',H:'#5a4632',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#4ab0a0',c:'#389080',D:'#f0ece0'},rows:['...KHK.....','..KKKKK....','.KHHHHHK...','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','.KHKFFFFK..','..KKKKKK...','...KCCCK...','..KCDDCCK..','..KCCCCCK..','..KcCCCcK..','...KK.KK...']},
      laoxu:{pal:{K:'#3a2c20',H:'#8a8578',F:'#f0c8a0',E:'#241a10',n:'#c8a080',C:'#5a5a66',c:'#46464f',D:'#c83838'},rows:['...KKKK....','..KFFFFK...','.KFFFFFFK..','.KHHFFFFK..','.KHHFEFFK..','.KHFFFFFK..','.KHFnFFFK..','..KFFFFK...','...KKKK....','...KCCCK...','..KCCCCK...','..KCcCCK...','..KcCCcK...','...KK.KK...']},
      cyber:{pal:{K:'#3a2c20',A:'#2c2434',F:'#f0c8a0',E:'#241a10',C:'#2c2434',c:'#221c2a',D:'#4ad4e8'},rows:['...KAAK....','..KAAAAK...','.KAAAAAAK..','.KAADDFFK..','.KAAFEFFK..','.KAAFFFFK..','.KAFFFFFK..','..KFFFFK...','...KKKK....','...KCCCK...','..KCDDCK...','..KCCCCK...','..KcCCcK...','...KK.KK...']},
      ami:{pal:{K:'#3a2c20',H:'#c86a8a',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#e85a90',c:'#c84070',D:'#ffd76a'},rows:['...KHHK....','..KHHHHK...','.KHHHHHHK..','.KHHDHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCCCCCK..','..KCDCCCK..','..KcCCCcK..','...KK.KK...']},
      barista:{pal:{K:'#3a2c20',A:'#6a4a32',H:'#4a3a2c',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#6a4a32',c:'#553a28',W:'#f0ece0',w:'#d8d0c0'},rows:['..KAAAK....','.KAAAAAKK..','.KAAAAAAKK.','.KHHHFFFK..','.KHHFEFFK..','.KHHFFFFK..','.KHFFrFFK..','..KFFFFK...','...KKKK....','...KCWWK...','..KWWWWK...','..KWWWWK...','..KcWWcK...','...KK.KK...']},
      courier:{pal:{K:'#3a2c20',A:'#3a6a9a',H:'#4a3a2c',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#3a6a9a',c:'#2c527a',D:'#e8b23d',B:'#c8a060'},rows:['...KAAK....','..KADAAK...','.KAAAAAAK..','.KHHHFFFK..','.KHHFEFFK..','.KHHFFFFK..','.KHFFrFFK..','..KFFFFK...','...KKKK....','...KCCCK...','..KCCCCKBBK','..KCCCCKBBK','..KcCCcK...','...KK.KK...']},
      shenyan:{pal:{K:'#3a2c20',H:'#2a2018',A:'#3a52a0',a:'#2a4a9a',F:'#f0d8b8',E:'#241a10',C:'#4a6ac8',c:'#2a4a9a',r:'#e89080'},rows:['...KAAAAK...','..aKaAAAK...','..KKKKKKK...','..KHHHHHHK..','.KHHHHHFFFK.','.KHHHHFFFFK.','.KHHHHFEFFK.','.KHHHFFrFFK.','..KHHFFFFK..','...KKKKKK...','...KCCcCK...','..KCCCcCCK..','..KCCCcCCK..','..KCCCcCCK..','..KcCCCCcK..','...KK.KK....']},
      bailu:{pal:{K:'#3a2c20',H:'#4a4238',F:'#f8e4d0',E:'#241a10',r:'#e89080',W:'#eef0ea',w:'#d8d8d0',D:'#5e8e8a'},rows:['...KHK.....','..KHHHK....','..KKKKK....','..KHHHHHK..','.KHHHHFFFK.','.KHHHFFFFK.','.KHHHFEFFK.','.KHHFFFFrK.','..KHFFFFK..','...KKKKK...','...KWDWK...','..KWWDWWK..','..KWWWWWK..','..KWWWWWK..','..KwWWWwK..','...KK.KK...']},
      chenjiu:{pal:{K:'#18161e',k:'#14121a',C:'#3a3844',W:'#f0e8e0',R:'#8a4838',r:'#6a3428',y:'#e8b23d',b:'#e89080'},rows:['..K.K......','.KCKCK.....','.KCCCCK....','.KCCCCCK...','KCCCCCCCK..','KCCCCWyCK..','KCCCCCCbbK.','KKCCCCCKK..','.KCCCCCK...','..KKKKK....','..KRRRK....','.KRyRRRK...','.KRRRRRK...','.KrRRRrK...','..KK.KK....']},
      suhe:{pal:{K:'#3a2c20',k:'#2a2018',F:'#f8d8c0',E:'#2a2018',b:'#e89080',P:'#b090d0',G:'#48b890'},rows:['...KKKK....','..KKKKKK...','.KKKKKKKK..','.KKKKKFFFK.','.KKKKFEFFK.','.KKKKFFFFK.','.KKKFFbFFK.','..KKFFFFK..','...KKKKK...','...KPPPK...','..KPGPPPK..','..KPPPPPK..','..KPGGGPK..','.KPPPPPPPK.','..KK..KK...']},
      leiming:{pal:{K:'#3a2c20',H:'#5a4632',F:'#e8c8a0',E:'#2a2018',O:'#d07a2e',o:'#a85e20',y:'#e0b048',n:'#7a5a3a',W:'#f0dcc0'},rows:['...KHHHK...','..KWWWWWK..','..KHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFFnnK.','.KHHFnnnnK.','..KFnnnnK..','...KKKKK...','...KOOOK...','..KOOOOOK..','..KOyyOOK..','..KOOOOOK..','..KoOOOoK..','...KK.KK...']},
      laogui:{pal:{K:'#3a2c20',G:'#8aa070',E:'#2a2018',S:'#7a5c38',s:'#5e4628'},rows:['......KKKK...','.....KGGGGK..','.....KGGEGK..','.....KGGGGK..','......KGGK...','..KKKKKKKKK..','.KSsSSsSSSSK.','.KSSsSSsSSsK.','.KSsSSsSSsSK.','..KKKKKKKKK..','..KGGK..KGGK.','...KK....KK..']},
      xuanming:{pal:{K:'#1a1620',D:'#2c3440',d:'#232a34',R:'#c84838'},rows:['...KKKK....','..KDDDDK...','.KDDDDDDK..','.KDDDDRDK..','.KDDDDDDK..','.KDdDDDdK..','..KDDDDK...','..KdDDdK...','...KdDK....','...KdKdK...','....K.K....']},
      xueyao:{pal:{A:'#3a2c20',B:'#a8a498',C:'#d07828',D:'#d8d0bc',E:'#f4f0e8',F:'#f8cc50'},rows:['....AA......','...AEEAA....','..AEEEEA....','.AEEEEEEA...','.AEDFFDEA...','.AEDFFDECA..','.AEEEEEEA...','.ABBEEEEA...','.ABBEEEEA...','.ABBEEEEA...','.ABBEEEA....','..ABEEA.....','...AACA.....']},
      anonymous:{pal:{K:'#1a1620',D:'#3a3a44',d:'#2c2c36'},rows:['...KKKK...','..KDDDDK..','..KDDDDK..','..KDDDDK..','.KDDDDDK..','.KDDDDDK..','.KDdDDDK..','..KDDDK...','..KdKdK...','...K.K....']}

    };
    var BACK_OVR={
      ayun:{pal:AYP,rows:['.....KHHK...','..KjjKHHKjjK','....KKKKKK..','...KHHHHHHK.','..KHHHHHHHHK','..KHHHHHHHHK','..KHHHHHHHHK','..KHHHHHHHHK','..KHHHHHHHHK','...KHHHHHHK.','....KKKKKK..','....KBBBBK..','...KBBBBBBK.','...KBBBBBBK.','...KbbbbbbK.','....K....K..']},
      tao:{pal:TAP,rows:['...KK....KK.','..KHHK..KHHK','..KHHHKKHHHK','...KHHKKHHK.','..KHHHKKHHHK','..KHHHKKHHHK','..KHHHHHHHHK','..KHHHHHHHHK','..KHHHHHHHHK','...KHHHHHHK.','....KKKKKK..','...KPPPPPPK.','..KPPPPPPPPK','..KPPPPPPPPK','..KqqPPPPqqK','...KK....KK.']},
      tenz:{pal:TZP,rows:['....KKKKKK..','...KFFFFFFK.','..KFFFFFFFFK','..KFFFFFFFFK','..KFFFFFFFFK','..KFFFFFFFFK','..KFFFFFFFFK','...KFFFFFFK.','...KKKKKKKK.','...KRRRRRRK.','..KRRRRRRRRK','..KRRRRRRRRK','..KrrRRRRrrK','...KK....KK.']},
      popo:{pal:POPP,rows:['......NN......','......NN......','......NNKK....','......NKVVK...','......KVVK....','.....KVVVK....','....KVVVVK....','...KVVVVVVK...','..KVVVVVVVVK..','.KKKKKKKKKKKK.','..KXXVVVVXXK..','..KXVVVVVVXK..','...KVVVVVVK...','...KVVVVVK....','..KVVVVVVVK...','..KVVVVVVVK...','...KK.NN.KK...','....KyyyyK....','...KyYYYYyK...','...KyYYYYyK...']},
      yanniang:{pal:{K:'#3a2c20',k:'#6a5028',H:'#b8b0a4',F:'#f0c8a0',C:'#8a4a6a',c:'#6a3852'},rows:['....KHHK....','...KHHHHK...','...KkkkkK...','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KcCCCCCcK.','..KCCCCCCCK.','..KcCCCCCcK.','...KK...KK..']},
      muyi:{pal:{K:'#3a2c20',H:'#4a3a2c',A:'#c8a040',F:'#f0c8a0',C:'#4a6a88',c:'#385570',G:'#8a8578'},rows:['....KHHHK...','...KAAAAAK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KGGCCCGGK.','..KCCCCCCCK.','..KcCCCCCcK.','...KK...KK..']},
      aluo:{pal:{K:'#3a2c20',H:'#4a3a2c',D:'#c84838',d:'#e86a50',F:'#f0c8a0',C:'#6aa848',c:'#4a8830'},rows:['...KDK......','...KDdK.....','.KHHHdHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KcCCCCCcK.','...KK...KK..']},
      aying:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#5a4632',C:'#e8c840',c:'#c8a028',D:'#ffd76a'},rows:['.....KKKK...','....KHHHHK..','....KHDDHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KcCCCCCcK.','...KK...KK..']},
      jiangya:{pal:{K:'#3a2c20',A:'#d8b060',a:'#b89040',H:'#8a8578',F:'#f0c8a0',C:'#4a6a88',c:'#385570'},rows:['.....KAK....','....KAaAK...','..KAAAAAAK..','KAAAAAAAAAAK','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCccCCCK.','..KcCCCCCcK.','...KK...KK..']},
      weila:{pal:{K:'#3a2c20',H:'#e0c060',F:'#f0c8a0',C:'#3a4a7a',c:'#2c3a62',D:'#ffd76a'},rows:['....KKKK....','..KKHHHHKK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','..KCHHHHCK..','..KCCHHCCK..','..KCCDCCCK..','..KcCCCCcK..','...KK...KK..']},
      rune:{pal:{K:'#3a2c20',H:'#c8c4bc',F:'#f0c8a0',C:'#3a4a5a',c:'#2c3a48',D:'#8ab4c8'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCDDCCCK.','..KCCDCCCCK.','..KcCCCCCcK.','...KK...KK..']},
      mago:{pal:{K:'#3a2c20',A:'#2a6a5a',a:'#1e564a',H:'#5a4632',F:'#f0c8a0',C:'#a8563e',c:'#8a4432',W:'#f0ece0'},rows:['....KAAK....','..KAAAAAAK..','.KAaAAAAaAK.','..KAaKKaAK..','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','..KCWCCWCK..','..KCCWWCCK..','..KCWCCWCK..','..KcCCCCcK..','...KK...KK..']},
      sesir:{pal:{K:'#3a2c20',H:'#6a4a32',F:'#f0c8a0',C:'#3a3a44',c:'#2c2c36'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCcKcCCK.','..KCCCCCCCK.','..KcCCCCCcK.','...KK...KK..']},
      yisha:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',C:'#8a2838',c:'#6e1e22'},rows:['....KKKK....','..KKHHHHKK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','..KCHHHHCK..','..KCCHHCCK..','..KCCCCCCK..','..KcCCCCcK..','...KK...KK..']},
      orlando:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',C:'#6a4a8a',c:'#553a70',D:'#e8b23d'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KCDDDDCCK.','..KcCCCCCcK.','...KK...KK..']},
      lilith:{pal:{K:'#3a2c20',H:'#241c28',F:'#f0d8c8',C:'#4a2c5a',c:'#3a2248',D:'#8a6aa8'},rows:['....KKKK....','..KKHHHHKK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','..KCHHHHCK..','..KCCHHCCK..','..KCCCCDCK..','..KcCCCCcK..','...KK...KK..']},
      thomas:{pal:{K:'#3a2c20',A:'#6a5340',F:'#f0c8a0',C:'#6a5340',c:'#554330',D:'#c8b090'},rows:['....KAAK....','...KAAAAK...','..KAAAAAAK..','.KAAAAAAAAK.','.KAAAKKAAAK.','.KAAAAAAAAK.','..KAAAAAAK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KDDDDDDDK.','..KCCCCCCCK.','..KcCCCCCcK.','...KK...KK..']},
      mira:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#2c2420',A:'#c84858',B:'#e8b23d',C:'#a83848',c:'#8a2c3a',D:'#e8b23d'},rows:['...KAAAAK...','..KAAAAAAK..','.KABABABABK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KcCCCCCcK.','...KK...KK..']},
      kama:{pal:{K:'#3a2c20',F:'#d8a878',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#2c2420',A:'#2a8a7a',B:'#e8b23d',D:'#e8b23d',C:'#2a8a7a',c:'#1e6a5e'},rows:['.KD.KDK.DK..','..KAAAAAAK..','.KAABAABAABK','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KcCCCCCcK.','...KK...KK..']},
      aman:{pal:{K:'#3a2c20',A:'#f0ece0',B:'#d8d0c0',F:'#d8a878',C:'#c8a060',c:'#a88448'},rows:['....KAAK....','...KAAAAK...','..KABAABAK..','.KAAAAAAAAK.','.KAAAAAAAAK.','.KAABAABAAK.','..KAAAAAAK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KCccccCCK.','..KcCCCCCcK.','...KK...KK..']},
      engo:{pal:{K:'#3a2c20',H:'#1a1410',F:'#8a5a3a',C:'#e8b23d',c:'#c89020',D:'#2a8a5a'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCDDDDCCK.','..KCCCCCCCK.','..KcCCCCCcK.','...KK...KK..']},
      rama:{pal:{K:'#3a2c20',H:'#2c2420',F:'#d8a878',C:'#e88028',c:'#c8661e'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCcK...','..KCCCCcCK..','..KCCCcCCK..','..KCCcCCCK..','..KcCCCCCcK.','...KK...KK..']},
      chizuru:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',W:'#f0ece0',D:'#c83838',d:'#a82c2c'},rows:['....KKKK....','..KKHHHHKK..','.KHHHDDHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KWWWWWK..','..KWWWWWWWK.','..KDDDDDDDK.','.KDDDDDDDDK.','.KdDDDDDDdK.','...KK...KK..']},
      set:{pal:{K:'#3a2c20',A:'#e8b23d',B:'#3858a8',F:'#d8a878',W:'#f0ece0',w:'#d8d0c0',D:'#e8b23d'},rows:['...KAAAAK...','..KBABABAK..','.KABABABABK.','.KABABABABK.','.KABABABABK.','.KABABABABK.','..KABABABK..','...KKKKKK...','...KWWWWWK..','..KWWWWWWWK.','..KWWWWWWWK.','..KWDDDDWWK.','..KwWWWWWwK.','...KK...KK..']},
      kdata:{pal:{K:'#3a2c20',H:'#3a3a44',F:'#f0c8a0',W:'#eef0f2',w:'#d0d4d8',D:'#4ab0a8'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KWWWWWK..','..KWWWWWWWK.','..KWWWWWWWK.','..KWWwwWWWK.','..KwWWWWWwK.','...KK...KK..']},
      xiaoman:{pal:{K:'#3a2c20',H:'#5a4632',F:'#f0c8a0',C:'#4ab0a0',c:'#389080',D:'#f0ece0'},rows:['.....KHK....','...KKHHKK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','..KHCCCCHK..','..KHCCCCHK..','..KCCDDCCK..','.KcCCCCCCcK.','...KK..KK...']},
      laoxu:{pal:{K:'#3a2c20',H:'#8a8578',F:'#f0c8a0',C:'#5a5a66',c:'#46464f'},rows:['....KKKK....','...KFFFFK...','..KFFFFFFK..','.KFFFFFFFFK.','.KHHFFFFHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KCCcccCCK.','..KcCCCCCcK.','...KK...KK..']},
      cyber:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#2c2434',A:'#2c2434',C:'#2c2434',c:'#221c2a',D:'#4ad4e8'},rows:['....KAAK....','...KAAAAK...','..KADDDAKK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KcCCCCCcK.','...KK...KK..']},
      ami:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#c86a8a',C:'#e85a90',c:'#c84070',D:'#ffd76a'},rows:['..KHHK..KHHK','..KHHHKKHHHK','...KHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KcCCCCCcK.','...KK...KK..']},
      barista:{pal:{K:'#3a2c20',A:'#6a4a32',H:'#4a3a2c',F:'#f0c8a0',C:'#6a4a32',c:'#553a28',W:'#f0ece0'},rows:['...KAAAAK...','..KAAAAAAK..','..KAAAAAAK..','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCWCCWCK..','..KCCWWCCK..','..KCCCCCCK..','..KcCCCCcK..','...KK...KK..']},
      courier:{pal:{K:'#3a2c20',A:'#3a6a9a',H:'#4a3a2c',F:'#f0c8a0',C:'#3a6a9a',c:'#2c527a',s:'#8a6a3a',B:'#c8a060'},rows:['....KAAK....','...KAAAAK...','..KAAAAAAK..','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCsCCK..','..KCCsCCCK..','..KCsCCCCK..','..KBBCCCCK..','..KBBCCCcK..','...KK...KK..']},
      shenyan:{pal:{K:'#3a2c20',H:'#2a2018',A:'#3a52a0',a:'#2a4a9a',F:'#f0d8b8',C:'#4a6ac8',c:'#2a4a9a'},rows:['...KAAAAK...','..aKaAAaKa..','..KKKKKKKK..','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHKKHHK..','...KKKKKK...','...KCCCCK...','..KCCCCCCK..','..KCCCCCCK..','..KCccccCK..','..KCCCCCCK..','..KcCCCCcK..','...KK..KK...']},
      bailu:{pal:{K:'#3a2c20',H:'#4a4238',F:'#f8e4d0',W:'#eef0ea',w:'#d8d8d0',D:'#5e8e8a'},rows:['.....KHK....','....KHHHK...','....KKKKK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHKKHHK..','...KKKKKK...','...KWWWWWK..','..KWWWWWWWK.','..KWWWWWWWK.','..KDDDDDDDK.','..KWWWWWWWK.','..KwWWWWWwK.','...KK...KK..']},
      chenjiu:{pal:{K:'#18161e',C:'#3a3844',R:'#8a4838',r:'#6a3428'},rows:['..K......K..','.KCK....KCK.','.KCCK..KCCK.','.KCCCCCCCCK.','.KCCCCCCCCK.','.KCCCCCCCCK.','.KCCCCCCCCK.','..KCCCCCCK..','...KKKKKK..K','...KRRRRK.KC','..KRRRRRRKCK','..KRRRRRRKCK','..KrRRRRrKK.','...KK..KK...']},
      suhe:{pal:{K:'#3a2c20',k:'#2a2018',F:'#f8d8c0',P:'#b090d0',G:'#48b890'},rows:['....KKKK....','...KKKKKK...','..KKKKKKKK..','.KKKKKKKKKK.','.KKKKKKKKKK.','.KKKKGGKKKK.','.KKKKkkKKKK.','..KKkKKkKK..','...KKKKKK...','...KPPPPK...','..KPPPPPPK..','..KPPPPPPK..','..KPGGGGPK..','.KPPPPPPPPK.','..KK....KK..']},
      leiming:{pal:{K:'#3a2c20',H:'#5a4632',F:'#e8c8a0',O:'#d07a2e',o:'#a85e20',y:'#e0b048',W:'#f0dcc0'},rows:['...KHHHHK...','..KWWWWWWK..','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KOOOOOK..','..KOOOOOOOK.','..KOOOOOOOK.','..KOyyyyOOK.','..KOOOOOOOK.','..KoOOOOOoK.','...KK...KK..']},
      laogui:{pal:{K:'#3a2c20',G:'#8aa070',S:'#7a5c38',s:'#5e4628'},rows:['.....KKKK....','....KGGGGK...','....KGGGGK...','.....KGGK....','..KKKKKKKKK..','.KSSsSSsSSSK.','.KSsSSsSSsSK.','.KSSsSSsSSsK.','.KSsSSsSSsSK.','..KKKKKKKKK..','..KGGK..KGGK.','...KK....KK..']},
      xuanming:{pal:{K:'#1a1620',D:'#2c3440',d:'#232a34'},rows:['...KKKK....','..KDDDDK...','.KDDDDDDK..','.KDDDDDDK..','.KDDDDDDK..','.KDdDDdDK..','..KDDDDK...','..KdDDdK...','...KdDK....','...KdKdK...','....K.K....']},
      xueyao:{pal:{A:'#3a2c20',B:'#a8a498',C:'#d07828',D:'#d8d0bc',E:'#f4f0e8',F:'#f8cc50'},rows:['...AA....AA..','..AEEA..AEEA.','..AEEEAAEEEA.','.AEEEEEEEEEEA','.AEEEEEEEEEEA','.ABBBEEEEBBBA','.ABBBEEEEBBBA','.ABBBEEEEBBBA','.ABBBEEEEBBBA','.ABBBEEEEBBBA','.ABBEEEEEEBBA','..ABEEEEEEBA.','...AAACCAAA..']},
      anonymous:{pal:{K:'#1a1620',D:'#3a3a44',d:'#2c2c36'},rows:['...KKKK....','..KDDDDK...','..KDDDDK...','..KDDDDK...','.KDDDDDDK..','.KDDDDDDK..','.KDDDDDDK..','..KDDDDK...','..KdKKdK...','...K..K....']}

    };
    function parseOvr(o){
      if(!o) return null;
      var rows=o.rows, H=rows.length, W=0; for(var i=0;i<H;i++) if(rows[i].length>W)W=rows[i].length;
      var g=[]; for(var y=0;y<H;y++){g.push([]); for(var x=0;x<W;x++){var ch=rows[y][x]; g[y].push((!ch||ch==='.'||ch===' ')?null:(o.pal[ch]||null));}}
      return {g:g,W:W,H:H};
    }
    function ovrGrid(cls){
      var o=FRONT_OVR[cls]; if(!o) return null;
      var rows=o.rows, H=rows.length, W=0; for(var i=0;i<H;i++) if(rows[i].length>W)W=rows[i].length;
      var g=[]; for(var y=0;y<H;y++){g.push([]); for(var x=0;x<W;x++){var ch=rows[y][x]; g[y].push((!ch||ch==='.'||ch===' ')?null:(o.pal[ch]||null));}}
      return {g:g,W:W,H:H};
    }
    var PORTRAIT_SRC={popo:'codex'};   // 载具角色: 静态正面用图鉴原生(无载具)
    function codexGrid(cls){
      var el=document.createElement('div'); el.className='spr spr-'+cls;
      el.style.cssText='position:absolute;left:-9999px;top:0'; document.body.appendChild(el);
      var cs=getComputedStyle(el,'::after'); var bs=cs.boxShadow; var w=parseInt(cs.width)||3;
      document.body.removeChild(el);
      if(!bs||bs==='none') return null;
      var re=/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)\s+(-?\d+)px\s+(-?\d+)px/g, m, cells=[], maxx=0, maxy=0;
      while((m=re.exec(bs))){ var x=Math.round(m[4]/w), y=Math.round(m[5]/w); cells.push([x,y,'rgb('+m[1]+','+m[2]+','+m[3]+')']); if(x>maxx)maxx=x; if(y>maxy)maxy=y; }
      if(!cells.length) return null;
      var g=[]; for(var i=0;i<=maxy;i++){g.push([]); for(var j=0;j<=maxx;j++)g[i].push(null);}
      for(var k=0;k<cells.length;k++){var c=cells[k]; g[c[1]][c[0]]=c[2];}
      return {g:g,W:maxx+1,H:maxy+1};
    }
    function grid(cls){ return ovrGrid(cls) || codexGrid(cls); }
    function portraitGrid(cls){
      if(PORTRAIT_SRC[cls]==='codex'){ var c=codexGrid(cls); if(c) return c; }
      return grid(cls);
    }
    // 步伐帧: 按角色脚簇结构生成第2帧 · 纵向=张/并交替 横向=跨/并交替
    function stepGrid(gd, mode){
      var H=gd.H, W=gd.W, g2=[];
      for(var y=0;y<H;y++) g2.push(gd.g[y].slice());
      var fy=-1;
      for(var y=H-1;y>=0;y--){ var has=false; for(var x=0;x<W;x++) if(gd.g[y][x]){has=true;break;} if(has){fy=y;break;} }
      if(fy<0) return gd;
      var row=gd.g[fy], clusters=[], st=-1;
      for(var x=0;x<=W;x++){ var c=(x<W)?row[x]:null;
        if(c&&st<0)st=x; if(!c&&st>=0){clusters.push([st,x-1]);st=-1;} }
      if(clusters.length<2) return {g:g2,W:W,H:H};
      var nr=new Array(W).fill(null);
      var mid=(clusters[0][0]+clusters[clusters.length-1][1])/2;
      for(var ci=0;ci<clusters.length;ci++){
        var cl=clusters[ci], dir=((cl[0]+cl[1])/2<mid)?1:-1;
        if(mode==='out') dir=-dir;
        for(var x=cl[0];x<=cl[1];x++){ var nx=x+dir; if(nx>=0&&nx<W) nr[nx]=row[x]; }
      }
      g2[fy]=nr;
      return {g:g2,W:W,H:H};
    }
    // 独立动画角色帧2: 婆婆=飞行穗尾晃动 · 白鹭/苏合=裙摆摆动 · 雪鸮=扑翅 · 玄冥=尾部摆动
    var WALK_OVR={
      aluo:{side:{pal:{K:'#3a2c20',H:'#4a3a2c',D:'#c84838',d:'#e86a50',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#6aa848',c:'#4a8830'},rows:['KDK........','KdDK.......','.KKHHHHK...','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCCCCCK..','..KCcCCCK..','..KcCCCcK..','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#4a3a2c',D:'#c84838',d:'#e86a50',F:'#f0c8a0',C:'#6aa848',c:'#4a8830'},rows:['...KDK......','...KDdK.....','.KHHHdHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KcCCCCCcK.','....KKKK....']}},
      aman:{side:{pal:{K:'#3a2c20',A:'#f0ece0',B:'#d8d0c0',F:'#d8a878',E:'#241a10',C:'#c8a060',c:'#a88448'},rows:['...KAAK....','..KAAAAK...','.KABAABAK..','.KAAAFFFK..','.KAAFEFFK..','.KAAFFFFK..','.KAFFFFFK..','..KFFFFK...','...KKKK....','...KCCCK...','..KCCCCK...','..KCcCCK...','..KcCCcK...','...KKKK....']},back:{pal:{K:'#3a2c20',A:'#f0ece0',B:'#d8d0c0',F:'#d8a878',C:'#c8a060',c:'#a88448'},rows:['....KAAK....','...KAAAAK...','..KABAABAK..','.KAAAAAAAAK.','.KAAAAAAAAK.','.KAABAABAAK.','..KAAAAAAK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KCccccCCK.','..KcCCCCCcK.','....KKKK....']}},
      ami:{side:{pal:{K:'#3a2c20',H:'#c86a8a',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#e85a90',c:'#c84070',D:'#ffd76a'},rows:['...KHHK....','..KHHHHK...','.KHHHHHHK..','.KHHDHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCCCCCK..','..KCDCCCK..','..KcCCCcK..','...KKKK....']},back:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#c86a8a',C:'#e85a90',c:'#c84070',D:'#ffd76a'},rows:['..KHHK..KHHK','..KHHHKKHHHK','...KHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KcCCCCCcK.','....KKKK....']}},
      anonymous:{side:{pal:{K:'#1a1620',D:'#3a3a44',d:'#2c2c36'},rows:['...KKKK...','..KDDDDK..','..KDDDDK..','..KDDDDK..','.KDDDDDK..','.KDDDDDK..','.KDdDDDK..','..KDDDK...','..KdKdK...','...KK.....']},back:{pal:{K:'#1a1620',D:'#3a3a44',d:'#2c2c36'},rows:['...KKKK....','..KDDDDK...','..KDDDDK...','..KDDDDK...','.KDDDDDDK..','.KDDDDDDK..','.KDDDDDDK..','..KDDDDK...','..KdKKdK...','....KK.....']}},
      aying:{side:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#5a4632',C:'#e8c840',c:'#c8a028',D:'#ffd76a'},rows:['.KKK.......','KHHHK......','KHDDHKKK...','.KKHHHHHK..','.KHHHHHFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCCCCCK..','..KCCCCCK..','..KcCCCcK..','....KK.....']},back:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#5a4632',C:'#e8c840',c:'#c8a028',D:'#ffd76a'},rows:['.....KKKK...','....KHHHHK..','....KHDDHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KcCCCCCcK.','....KKKK....']}},
      barista:{side:{pal:{K:'#3a2c20',A:'#6a4a32',H:'#4a3a2c',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#6a4a32',c:'#553a28',W:'#f0ece0',w:'#d8d0c0'},rows:['..KAAAK....','.KAAAAAKK..','.KAAAAAAKK.','.KHHHFFFK..','.KHHFEFFK..','.KHHFFFFK..','.KHFFrFFK..','..KFFFFK...','...KKKK....','...KCWWK...','..KWWWWK...','..KWWWWK...','..KcWWcK...','...KKKK....']},back:{pal:{K:'#3a2c20',A:'#6a4a32',H:'#4a3a2c',F:'#f0c8a0',C:'#6a4a32',c:'#553a28',W:'#f0ece0'},rows:['...KAAAAK...','..KAAAAAAK..','..KAAAAAAK..','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCWCCWCK..','..KCCWWCCK..','..KCCCCCCK..','..KcCCCCcK..','....KKKK....']}},
      chenjiu:{side:{pal:{K:'#18161e',k:'#14121a',C:'#3a3844',W:'#f0e8e0',R:'#8a4838',r:'#6a3428',y:'#e8b23d',b:'#e89080'},rows:['..K.K......','.KCKCK.....','.KCCCCK....','.KCCCCCK...','KCCCCCCCK..','KCCCCWyCK..','KCCCCCCbbK.','KKCCCCCKK..','.KCCCCCK...','..KKKKK....','..KRRRK....','.KRyRRRK...','.KRRRRRK...','.KrRRRrK...','..KKKK.....']},back:{pal:{K:'#18161e',C:'#3a3844',R:'#8a4838',r:'#6a3428'},rows:['..K......K..','.KCK....KCK.','.KCCK..KCCK.','.KCCCCCCCCK.','.KCCCCCCCCK.','.KCCCCCCCCK.','.KCCCCCCCCK.','..KCCCCCCK..','...KKKKKK..K','...KRRRRK.KC','..KRRRRRRKCK','..KRRRRRRKCK','..KrRRRRrKK.','....KKKK....']}},
      chizuru:{side:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',E:'#241a10',r:'#e89080',W:'#f0ece0',D:'#c83838',d:'#a82c2c'},rows:['...KKKK....','..KHHHHK...','.KHHDDHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','..KHFFFFK..','...KKKKK...','...KWWWK...','..KWWWWWK..','..KDDDDDK..','..KDDDDDK..','..KdDDDdK..','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',W:'#f0ece0',D:'#c83838',d:'#a82c2c'},rows:['....KKKK....','..KKHHHHKK..','.KHHHDDHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KWWWWWK..','..KWWWWWWWK.','..KDDDDDDDK.','.KDDDDDDDDK.','.KdDDDDDDdK.','....KKKK....']}},
      courier:{side:{pal:{K:'#3a2c20',A:'#3a6a9a',H:'#4a3a2c',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#3a6a9a',c:'#2c527a',D:'#e8b23d',B:'#c8a060'},rows:['...KAAK....','..KADAAK...','.KAAAAAAK..','.KHHHFFFK..','.KHHFEFFK..','.KHHFFFFK..','.KHFFrFFK..','..KFFFFK...','...KKKK....','...KCCCK...','..KCCCCKBBK','..KCCCCKBBK','..KcCCcK...','...KKKK....']},back:{pal:{K:'#3a2c20',A:'#3a6a9a',H:'#4a3a2c',F:'#f0c8a0',C:'#3a6a9a',c:'#2c527a',s:'#8a6a3a',B:'#c8a060'},rows:['....KAAK....','...KAAAAK...','..KAAAAAAK..','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCsCCK..','..KCCsCCCK..','..KCsCCCCK..','..KBBCCCCK..','..KBBCCCcK..','....KKKK....']}},
      cyber:{side:{pal:{K:'#3a2c20',A:'#2c2434',F:'#f0c8a0',E:'#241a10',C:'#2c2434',c:'#221c2a',D:'#4ad4e8'},rows:['...KAAK....','..KAAAAK...','.KAAAAAAK..','.KAADDFFK..','.KAAFEFFK..','.KAAFFFFK..','.KAFFFFFK..','..KFFFFK...','...KKKK....','...KCCCK...','..KCDDCK...','..KCCCCK...','..KcCCcK...','...KKKK....']},back:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#2c2434',A:'#2c2434',C:'#2c2434',c:'#221c2a',D:'#4ad4e8'},rows:['....KAAK....','...KAAAAK...','..KADDDAKK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KcCCCCCcK.','....KKKK....']}},
      engo:{side:{pal:{K:'#3a2c20',H:'#1a1410',F:'#8a5a3a',E:'#0e0a08',C:'#e8b23d',c:'#c89020',D:'#2a8a5a',W:'#f0ece0'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHFFFK..','.KHHFEFFK..','.KHHFFFFK..','.KHFFFFFK..','..KFFFFK...','...KKKK....','...KWCCK...','..KCCCCK...','..KCDDCK...','..KcCCcK...','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#1a1410',F:'#8a5a3a',C:'#e8b23d',c:'#c89020',D:'#2a8a5a'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCDDDDCCK.','..KCCCCCCCK.','..KcCCCCCcK.','....KKKK....']}},
      jiangya:{side:{pal:{K:'#3a2c20',A:'#d8b060',a:'#b89040',H:'#8a8578',F:'#f0c8a0',E:'#241a10',n:'#8a8578',C:'#4a6a88',c:'#385570'},rows:['....KAK....','...KAaAK...','..KAAAAAK..','KAAAAAAAAAK','.KHHHFFFK..','.KHHFEFFK..','.KHHFFnnK..','..KHFFnFK..','...KKKK....','...KCCCK...','..KCcCCK...','..KcCCcK...','...KKKK....']},back:{pal:{K:'#3a2c20',A:'#d8b060',a:'#b89040',H:'#8a8578',F:'#f0c8a0',C:'#4a6a88',c:'#385570'},rows:['.....KAK....','....KAaAK...','..KAAAAAAK..','KAAAAAAAAAAK','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCccCCCK.','..KcCCCCCcK.','....KKKK....']}},
      kama:{side:{pal:{K:'#3a2c20',A:'#2a8a7a',D:'#e8b23d',H:'#2c2420',F:'#d8a878',E:'#241a10',C:'#2a8a7a',c:'#1e6a5e'},rows:['..KDK......','.KAAAAK....','.KADAADK...','.KHHHFFFK..','.KHHFEFFK..','.KHHFFFFK..','.KHFFFFFK..','..KFFFFK...','...KKKK....','...KCCCK...','..KCCCCK...','..KCcCCK...','..KcCCcK...','...KKKK....']},back:{pal:{K:'#3a2c20',F:'#d8a878',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#2c2420',A:'#2a8a7a',B:'#e8b23d',D:'#e8b23d',C:'#2a8a7a',c:'#1e6a5e'},rows:['.KD.KDK.DK..','..KAAAAAAK..','.KAABAABAABK','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KcCCCCCcK.','....KKKK....']}},
      kdata:{side:{pal:{K:'#3a2c20',H:'#3a3a44',F:'#f0c8a0',E:'#14100c',W:'#eef0f2',w:'#d0d4d8',D:'#4ab0a8'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHFFFK..','.KHHFEEFK..','.KHHFFFFK..','.KHFFFFFK..','..KFFFFK...','...KKKK....','...KWWWK...','..KWDDWK...','..KWWWWK...','..KwWWwK...','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#3a3a44',F:'#f0c8a0',W:'#eef0f2',w:'#d0d4d8',D:'#4ab0a8'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KWWWWWK..','..KWWWWWWWK.','..KWWWWWWWK.','..KWWwwWWWK.','..KwWWWWWwK.','....KKKK....']}},
      laogui:{side:{pal:{K:'#3a2c20',G:'#8aa070',E:'#2a2018',S:'#7a5c38',s:'#5e4628'},rows:['......KKKK...','.....KGGGGK..','.....KGGEGK..','.....KGGGGK..','......KGGK...','..KKKKKKKKK..','.KSsSSsSSSSK.','.KSSsSSsSSsK.','.KSsSSsSSsSK.','..KKKKKKKKK..','..KGGK..KGGK.','.....KKKK....']},back:{pal:{K:'#3a2c20',G:'#8aa070',S:'#7a5c38',s:'#5e4628'},rows:['.....KKKK....','....KGGGGK...','....KGGGGK...','.....KGGK....','..KKKKKKKKK..','.KSSsSSsSSSK.','.KSsSSsSSsSK.','.KSSsSSsSSsK.','.KSsSSsSSsSK.','..KKKKKKKKK..','..KGGK..KGGK.','.....KKKK....']}},
      laoxu:{side:{pal:{K:'#3a2c20',H:'#8a8578',F:'#f0c8a0',E:'#241a10',n:'#c8a080',C:'#5a5a66',c:'#46464f',D:'#c83838'},rows:['...KKKK....','..KFFFFK...','.KFFFFFFK..','.KHHFFFFK..','.KHHFEFFK..','.KHFFFFFK..','.KHFnFFFK..','..KFFFFK...','...KKKK....','...KCCCK...','..KCCCCK...','..KCcCCK...','..KcCCcK...','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#8a8578',F:'#f0c8a0',C:'#5a5a66',c:'#46464f'},rows:['....KKKK....','...KFFFFK...','..KFFFFFFK..','.KFFFFFFFFK.','.KHHFFFFHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KCCcccCCK.','..KcCCCCCcK.','....KKKK....']}},
      leiming:{side:{pal:{K:'#3a2c20',H:'#5a4632',F:'#e8c8a0',E:'#2a2018',O:'#d07a2e',o:'#a85e20',y:'#e0b048',n:'#7a5a3a',W:'#f0dcc0'},rows:['...KHHHK...','..KWWWWWK..','..KHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFFnnK.','.KHHFnnnnK.','..KFnnnnK..','...KKKKK...','...KOOOK...','..KOOOOOK..','..KOyyOOK..','..KOOOOOK..','..KoOOOoK..','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#5a4632',F:'#e8c8a0',O:'#d07a2e',o:'#a85e20',y:'#e0b048',W:'#f0dcc0'},rows:['...KHHHHK...','..KWWWWWWK..','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KOOOOOK..','..KOOOOOOOK.','..KOOOOOOOK.','..KOyyyyOOK.','..KOOOOOOOK.','..KoOOOOOoK.','....KKKK....']}},
      lilith:{side:{pal:{K:'#3a2c20',H:'#241c28',F:'#f0d8c8',E:'#241a10',C:'#4a2c5a',c:'#3a2248',D:'#8a6aa8'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFFFFK.','.KHHFFFFK..','.KHHKKKK...','.KHHKCCCK..','.KHKCDCCK..','..KKCCCCK..','..KcCCCcK..','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#241c28',F:'#f0d8c8',C:'#4a2c5a',c:'#3a2248',D:'#8a6aa8'},rows:['....KKKK....','..KKHHHHKK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','..KCHHHHCK..','..KCCHHCCK..','..KCCCCDCK..','..KcCCCCcK..','....KKKK....']}},
      mago:{side:{pal:{K:'#3a2c20',A:'#2a6a5a',a:'#1e564a',H:'#5a4632',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#a8563e',c:'#8a4432',W:'#f0ece0'},rows:['...KAAK....','..KAAAAK...','.KAaAAAAK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCWWCK...','..KCWWCK...','..KcCCCcK..','...KKKK....']},back:{pal:{K:'#3a2c20',A:'#2a6a5a',a:'#1e564a',H:'#5a4632',F:'#f0c8a0',C:'#a8563e',c:'#8a4432',W:'#f0ece0'},rows:['....KAAK....','..KAAAAAAK..','.KAaAAAAaAK.','..KAaKKaAK..','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','..KCWCCWCK..','..KCCWWCCK..','..KCWCCWCK..','..KcCCCCcK..','....KKKK....']}},
      mira:{side:{pal:{K:'#3a2c20',A:'#c84858',B:'#e8b23d',H:'#2c2420',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#a83848',c:'#8a2c3a'},rows:['...KAAAK...','..KAAAAAK..','.KABABABK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCCCCCK..','..KCCCCCK..','..KcCCCcK..','...KKKK....']},back:{pal:{K:'#3a2c20',F:'#f0c8a0',E:'#4a3626',r:'#e89080',W:'#f0ece0',G:'#8a8578',n:'#8a6a4a',H:'#2c2420',A:'#c84858',B:'#e8b23d',C:'#a83848',c:'#8a2c3a',D:'#e8b23d'},rows:['...KAAAAK...','..KAAAAAAK..','.KABABABABK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KcCCCCCcK.','....KKKK....']}},
      muyi:{side:{pal:{K:'#3a2c20',H:'#4a3a2c',A:'#c8a040',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#4a6a88',c:'#385570'},rows:['....KHHK...','...KAAAAK..','..KHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCCCCCK..','..KCcCCCK..','..KcCCCcK..','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#4a3a2c',A:'#c8a040',F:'#f0c8a0',C:'#4a6a88',c:'#385570',G:'#8a8578'},rows:['....KHHHK...','...KAAAAAK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KGGCCCGGK.','..KCCCCCCCK.','..KcCCCCCcK.','....KKKK....']}},
      orlando:{side:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',E:'#241a10',n:'#4a3626',C:'#6a4a8a',c:'#553a70',D:'#e8b23d'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFnFK.','.KHHFFFFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCCCCCK..','..KCDDCCK..','..KcCCCcK..','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',C:'#6a4a8a',c:'#553a70',D:'#e8b23d'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCCCCCCK.','..KCDDDDCCK.','..KcCCCCCcK.','....KKKK....']}},
      rama:{side:{pal:{K:'#3a2c20',H:'#2c2420',F:'#d8a878',E:'#241a10',D:'#c83828',C:'#e88028',c:'#c8661e'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHFDFK..','.KHHFEFFK..','.KHHFFFFK..','.KHFFFFFK..','..KFFFFK...','...KKKK....','...KcCCK...','..KCcCCK...','..KCCcCK...','..KcCCcK...','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#2c2420',F:'#d8a878',C:'#e88028',c:'#c8661e'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCcK...','..KCCCCcCK..','..KCCCcCCK..','..KCCcCCCK..','..KcCCCCCcK.','....KKKK....']}},
      rune:{side:{pal:{K:'#3a2c20',H:'#c8c4bc',n:'#c8c4bc',F:'#f0c8a0',E:'#241a10',C:'#3a4a5a',c:'#2c3a48',D:'#8ab4c8'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFnnFK.','..KHFnnnK..','...KKnnK...','...KKKKK...','...KCCCK...','..KCDCCCK..','..KCCCCCK..','..KcCCCcK..','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#c8c4bc',F:'#f0c8a0',C:'#3a4a5a',c:'#2c3a48',D:'#8ab4c8'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCDDCCCK.','..KCCDCCCCK.','..KcCCCCCcK.','....KKKK....']}},
      sesir:{back:{pal:{K:'#3a2c20',H:'#6a4a32',F:'#f0c8a0',C:'#3a3a44',c:'#2c2c36'},rows:['....KKKK....','...KHHHHK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KCCcKcCCK.','..KCCCCCCCK.','..KcCCCCCcK.','....KKKK....']},side:{pal:{K:'#3a2c20',H:'#6a4a32',F:'#f0c8a0',E:'#241a10',C:'#3a3a44',c:'#2c2c36',D:'#e8b23d',d:'#8a3a2c'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFFFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KCCCCCK..','..KCCCCCFK.','..KcCCcK.K.','...KKKK..D.']}},
      set:{side:{pal:{K:'#3a2c20',A:'#e8b23d',B:'#3858a8',F:'#d8a878',E:'#14100c',W:'#f0ece0',w:'#d8d0c0',D:'#e8b23d'},rows:['...KAAAK...','..KBABABK..','.KABABABAK.','.KABAFFFK..','.KABFEEFK..','.KABFFFFK..','.KAAFFFFK..','..KAFFFK...','...KKKK....','...KWWWK...','..KWWWWK...','..KWDDWK...','..KwWWwK...','...KKKK....']},back:{pal:{K:'#3a2c20',A:'#e8b23d',B:'#3858a8',F:'#d8a878',W:'#f0ece0',w:'#d8d0c0',D:'#e8b23d'},rows:['...KAAAAK...','..KBABABAK..','.KABABABABK.','.KABABABABK.','.KABABABABK.','.KABABABABK.','..KABABABK..','...KKKKKK...','...KWWWWWK..','..KWWWWWWWK.','..KWWWWWWWK.','..KWDDDDWWK.','..KwWWWWWwK.','....KKKK....']}},
      shenyan:{side:{pal:{K:'#3a2c20',H:'#2a2018',A:'#3a52a0',a:'#2a4a9a',F:'#f0d8b8',E:'#241a10',C:'#4a6ac8',c:'#2a4a9a',r:'#e89080'},rows:['...KAAAAK...','..aKaAAAK...','..KKKKKKK...','..KHHHHHHK..','.KHHHHHFFFK.','.KHHHHFFFFK.','.KHHHHFEFFK.','.KHHHFFrFFK.','..KHHFFFFK..','...KKKKKK...','...KCCcCK...','..KCCCcCCK..','..KCCCcCCK..','..KCCCcCCK..','..KcCCCCcK..','...KKKK.....']},back:{pal:{K:'#3a2c20',H:'#2a2018',A:'#3a52a0',a:'#2a4a9a',F:'#f0d8b8',C:'#4a6ac8',c:'#2a4a9a'},rows:['...KAAAAK...','..aKaAAaKa..','..KKKKKKKK..','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHKKHHK..','...KKKKKK...','...KCCCCK...','..KCCCCCCK..','..KCCCCCCK..','..KCccccCK..','..KCCCCCCK..','..KcCCCCcK..','....KKKK....']}},
      thomas:{side:{pal:{K:'#3a2c20',A:'#6a5340',F:'#f0c8a0',n:'#c8a080',C:'#6a5340',c:'#554330',D:'#c8b090'},rows:['...KAAK....','..KAAAAK...','.KAAAAAAK..','.KAAAFFFK..','.KAAFKKFK..','.KAAFFFFK..','.KAAFFnFK..','..KAFFFK...','...KKKK....','...KCCCK...','..KCCCCK...','..KDDDDK...','..KcCCcK...','...KKKK....']},back:{pal:{K:'#3a2c20',A:'#6a5340',F:'#f0c8a0',C:'#6a5340',c:'#554330',D:'#c8b090'},rows:['....KAAK....','...KAAAAK...','..KAAAAAAK..','.KAAAAAAAAK.','.KAAAKKAAAK.','.KAAAAAAAAK.','..KAAAAAAK..','...KKKKKK...','...KCCCCCK..','..KCCCCCCCK.','..KDDDDDDDK.','..KCCCCCCCK.','..KcCCCCCcK.','....KKKK....']}},
      weila:{side:{pal:{K:'#3a2c20',H:'#e0c060',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#3a4a7a',c:'#2c3a62',D:'#ffd76a'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','.KHHFFFFK..','.KHHKKKK...','.KHHKCCCK..','.KHKCCCCK..','..KKCDCCK..','..KcCCCcK..','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#e0c060',F:'#f0c8a0',C:'#3a4a7a',c:'#2c3a62',D:'#ffd76a'},rows:['....KKKK....','..KKHHHHKK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','..KCHHHHCK..','..KCCHHCCK..','..KCCDCCCK..','..KcCCCCcK..','....KKKK....']}},
      xiaoman:{side:{pal:{K:'#3a2c20',H:'#5a4632',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#4ab0a0',c:'#389080',D:'#f0ece0'},rows:['...KHK.....','..KKKKK....','.KHHHHHK...','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','.KHKFFFFK..','..KKKKKK...','...KCCCK...','..KCDDCCK..','..KCCCCCK..','..KcCCCcK..','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#5a4632',F:'#f0c8a0',C:'#4ab0a0',c:'#389080',D:'#f0ece0'},rows:['.....KHK....','...KKHHKK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','..KHCCCCHK..','..KHCCCCHK..','..KCCDDCCK..','.KcCCCCCCcK.','....KKKK....']}},
      yanniang:{side:{pal:{K:'#3a2c20',H:'#b8b0a4',F:'#f0c8a0',n:'#c8a080',C:'#8a4a6a',c:'#6a3852'},rows:['....KHHK...','...KHHHHK..','...KKKKK...','..KHHHHHK..','.KHHHHFFFK.','.KHHHFKKFK.','.KHHHFFFFK.','.KHHFnFFFK.','..KHFFFFK..','...KKKKK...','...KCCCK...','..KcCCCcK..','..KCCCCCK..','..KcCCCcK..','...KKKK....']},back:{pal:{K:'#3a2c20',k:'#6a5028',H:'#b8b0a4',F:'#f0c8a0',C:'#8a4a6a',c:'#6a3852'},rows:['....KHHK....','...KHHHHK...','...KkkkkK...','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','...KKKKKK...','...KCCCCCK..','..KcCCCCCcK.','..KCCCCCCCK.','..KcCCCCCcK.','....KKKK....']}},
      yisha:{side:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',E:'#241a10',r:'#e89080',C:'#8a2838',c:'#6e1e22',W:'#f0ece0'},rows:['...KKKK....','..KHHHHK...','.KHHHHHHK..','.KHHHHFFFK.','.KHHHFEFFK.','.KHHHFFFFK.','.KHHFFrFFK.','.KHHFFFFK..','.KHHKWWK...','.KHHKCCCK..','.KHKCCCCK..','..KKCCCCK..','..KcCCCcK..','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#2c2420',F:'#f0c8a0',C:'#8a2838',c:'#6e1e22'},rows:['....KKKK....','..KKHHHHKK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHHHHHK..','..KCHHHHCK..','..KCCHHCCK..','..KCCCCCCK..','..KcCCCCcK..','....KKKK....']}},
      tenz:{
        side:{pal:TZP,rows:['...KKKKK...','..KFFFFFK..','.KFFFFFFFK.','.KFFFFKFFK.','.KFFFFBFFK.','.KFFFFFFFK.','.KFFFFFFK..','..KFFFFK...','...KKKKK...','...KRRFK...','..KyRRRFK..','..KRRRRRK..','..KRRRrK...','...KKKK....']},
        back:{pal:TZP,rows:['....KKKKKK..','...KFFFFFFK.','..KFFFFFFFFK','..KFFFFFFFFK','..KFFFFFFFFK','..KFFFFFFFFK','..KFFFFFFFFK','...KFFFFFFK.','...KKKKKKKK.','...KRRRRRRK.','..KRRRRRRRRK','..KRRRRRRRRK','..KrrRRRRrrK','....KKKK....']},
      },
      popo:{
        front:{pal:FRONT_OVR.popo.pal,rows:['...KyyyyK.....','...KyYYYYyK...','...KyYYYYyK...','....KyyyyK....','......NN......','......NNKK....','......NKVVK...','......KVVK....','.....KVVVK....','....KVVVVK....','...KVVVVVVK...','..KVyyVVVVVK..','.KKKKKKKKKKKK.','..KXXFFFFXXK..','..KXFeFFeFXK..','...KFFnFFFK...','...KFFFFFK....','..KVVVVVVVK...','..KVVVVVVVK...','...KK.NN.KK...','......NN......']},
        side:{pal:POPP,rows:['..........KK........','.........KVVK.......','..........KVVK......','..........KVVVK.....','..........KVVVVK....','.........KVVVVVVK...','........KVVVVVyyVK..','.......KKKKKKKKKKKK.','........KXXFFFFXXK..','........KXFeFFeFXK..','....Kyy..KFFFnFFFK..','...KyYYyKKVVVVVVVK..','..KyYYYyNNVVVVVVVVK.','...KyYYyK.KVVVKVVK..','...Kyy......KFK.KFK.']},
        back:{pal:POPP,rows:['......NN......','......NN......','......NNKK....','......NKVVK...','......KVVK....','.....KVVVK....','....KVVVVK....','...KVVVVVVK...','..KVVVVVVVVK..','.KKKKKKKKKKKK.','..KXXVVVVXXK..','..KXVVVVVVXK..','...KVVVVVVK...','...KVVVVVK....','..KVVVVVVVK...','..KVVVVVVVK...','...KK.NN.KK...','....KyyyyK....','...KyYYYYyK...','..KyYYYYyK....']}
      },
      xuanming:{
        front:{pal:FRONT_OVR.xuanming.pal,rows:['...KKKK....','..KDDDDK...','.KDDDDDDK..','.KDRDDRDK..','.KDDDDDDK..','.KDdDDdDK..','..KDDDDK...','..KdDDdK...','..KdDK.....','..KdKdK....','...K.K.....']}
      ,side:{pal:{K:'#1a1620',D:'#2c3440',d:'#232a34',R:'#c84838'},rows:['...KKKK....','..KDDDDK...','.KDDDDDDK..','.KDDDDRDK..','.KDDDDDDK..','.KDdDDDdK..','..KDDDDK...','..KdDDdK...','...KdDK....','...KdKdK...','....KK.....']},back:{pal:{K:'#1a1620',D:'#2c3440',d:'#232a34'},rows:['...KKKK....','..KDDDDK...','.KDDDDDDK..','.KDDDDDDK..','.KDDDDDDK..','.KDdDDdDK..','..KDDDDK...','..KdDDdK...','...KdDK....','...KdKdK...','....KK.....']}},
      bailu:{
        front:{pal:{A:'#2a5a6a',B:'#3a2c20',C:'#4a4238',D:'#5e8e8a',E:'#e89080',F:'#eef0ea',G:'#f8e4d0'},rows:['............','.....BDDB...','....BBDDBB..','...BCCDDCCB.','...BCCCCCCB.','...BCGGGGCB.','...BGAGGAGB.','...BGGGGGGB.','...BGEGGEGB.','....BGGGGB..','....BBBBBB..','....BFFFFB..','...BDFFFFDB.','...BFBBBBFB.','..BDDDDDDB..','.BFFFFFFFFB.']}
      ,side:{pal:{K:'#3a2c20',H:'#4a4238',F:'#f8e4d0',E:'#241a10',r:'#e89080',W:'#eef0ea',w:'#d8d8d0',D:'#5e8e8a'},rows:['...KHK.....','..KHHHK....','..KKKKK....','..KHHHHHK..','.KHHHHFFFK.','.KHHHFFFFK.','.KHHHFEFFK.','.KHHFFFFrK.','..KHFFFFK..','...KKKKK...','...KWDWK...','..KWWDWWK..','..KWWWWWK..','..KWWWWWK..','..KwWWWwK..','...KKKK....']},back:{pal:{K:'#3a2c20',H:'#4a4238',F:'#f8e4d0',W:'#eef0ea',w:'#d8d8d0',D:'#5e8e8a'},rows:['.....KHK....','....KHHHK...','....KKKKK...','..KHHHHHHK..','.KHHHHHHHHK.','.KHHHHHHHHK.','.KHHHHHHHHK.','..KHHKKHHK..','...KKKKKK...','...KWWWWWK..','..KWWWWWWWK.','..KWWWWWWWK.','..KDDDDDDDK.','..KWWWWWWWK.','..KwWWWWWwK.','....KKKK....']}},
      suhe:{
        front:{pal:{A:'#2a2018',B:'#3a2c20',C:'#48b890',D:'#e89080',E:'#f0a0c0',F:'#f8d8c0'},rows:['.....BBBB....','....BBBBBB...','....BBBBBB...','...BBBBBBBB..','..BBBBBBBBBB.','..BBFFFFFFBB.','..BFAFFFFAFB.','..BFFFFFFFFB.','..BFDFFFFDFB.','...BFFFFFFB..','....BBBBBB...','...BEEEEEEB..','..BECEEEECEB.','..BEEBBBBEEB.','.BECCCCCCEB..','BBEEEEEEEEBB.']}
      ,side:{pal:{K:'#3a2c20',k:'#2a2018',F:'#f8d8c0',E:'#2a2018',b:'#e89080',P:'#b090d0',G:'#48b890'},rows:['...KKKK....','..KKKKKK...','.KKKKKKKK..','.KKKKKFFFK.','.KKKKFEFFK.','.KKKKFFFFK.','.KKKFFbFFK.','..KKFFFFK..','...KKKKK...','...KPPPK...','..KPGPPPK..','..KPPPPPK..','..KPGGGPK..','.KPPPPPPPK.','...KKKK....']},back:{pal:{K:'#3a2c20',k:'#2a2018',F:'#f8d8c0',P:'#b090d0',G:'#48b890'},rows:['....KKKK....','...KKKKKK...','..KKKKKKKK..','.KKKKKKKKKK.','.KKKKKKKKKK.','.KKKKGGKKKK.','.KKKKkkKKKK.','..KKkKKkKK..','...KKKKKK...','...KPPPPK...','..KPPPPPPK..','..KPPPPPPK..','..KPGGGGPK..','.KPPPPPPPPK.','....KKKK....']}},
      xueyao:{
        front:{pal:{A:'#3a2c20',B:'#a8a498',C:'#d07828',D:'#d8d0bc',E:'#f4f0e8',F:'#f8cc50'},rows:['.............','...AA....AA..','..AEEA..AEEA.','..AEEEAAEEEA.','.AEEEEEEEEEEA','.AEDFFDDFFDEA','.AEDFFDDFFDEA','.AEEEECCEEEEA','.ABBEEEEEEBBA','.ABBEEEEEEBBA','.ABBEEEEEEBBA','.AEEEEEEEEEEA','..ABEEEEEEBA.','...AAACCAAA..']}
      ,side:{pal:{A:'#3a2c20',B:'#a8a498',C:'#d07828',D:'#d8d0bc',E:'#f4f0e8',F:'#f8cc50'},rows:['....AA......','...AEEAA....','..AEEEEA....','.AEEEEEEA...','.AEDFFDEA...','.AEDFFDECA..','.AEEEEEEA...','.ABBEEEEA...','.ABBEEEEA...','.ABBEEEEA...','.ABBEEEA....','..ABEEA.....','..AACA......']},back:{pal:{A:'#3a2c20',B:'#a8a498',C:'#d07828',D:'#d8d0bc',E:'#f4f0e8',F:'#f8cc50'},rows:['...AA....AA..','..AEEA..AEEA.','..AEEEAAEEEA.','.AEEEEEEEEEEA','.AEEEEEEEEEEA','.ABBBEEEEBBBA','.ABBBEEEEBBBA','.ABBBEEEEBBBA','.ABBBEEEEBBBA','.ABBBEEEEBBBA','.ABBEEEEEEBBA','..ABEEEEEEBA.','..AAACCAAA...']}}
    };
    /* ── 规范 → 引擎 的接缝 ────────────────────────────────────────
       B0 写着「此表为单一数据源，游戏 sprite 与之对齐」。这里就是那个「对齐」：
       把图鉴画好的四向两帧暴露出去，房间不要再自己画一套。
       婆婆的三向图本来就是骑着扫帚的 —— 载具不必另做，规范早就把它画进姿态了。 */
    window.CODEX = { FRONT: FRONT_OVR, SIDE: SIDE_OVR, BACK: BACK_OVR, WALK: WALK_OVR }

    function bounds(gd){
      var x0=gd.W,y0=gd.H,x1=-1,y1=-1;
      for(var y=0;y<gd.H;y++)for(var x=0;x<gd.W;x++) if(gd.g[y][x]){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
      return {x0:x0,y0:y0,w:x1-x0+1,h:y1-y0+1};
    }
    function hairColor(gd){ var dark='rgb(58,44,32)';
      for(var y=0;y<gd.H;y++)for(var x=0;x<gd.W;x++){var c=gd.g[y][x]; if(c&&c!==dark) return c;} return dark; }
    function isSkin(c){ if(!c)return false; var m=/rgb\((\d+),(\d+),(\d+)/.exec(c); if(!m)return false; var r=+m[1],g=+m[2],b=+m[3]; return r>205&&g>160&&b>120&&r>=g&&g>b; }
    function isDark(c){ var m=/rgb\((\d+),(\d+),(\d+)/.exec(c); if(!m)return false; var r=+m[1],g=+m[2],b=+m[3]; return r<95&&g<85&&b<75; }
    function isInterior(gd,x,y){ var nb=[[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,1],[-1,1],[1,-1]];
      for(var i=0;i<nb.length;i++){var nx=x+nb[i][0],ny=y+nb[i][1]; if(nx<0||ny<0||nx>=gd.W||ny>=gd.H||!gd.g[ny][nx]) return false;} return true; }
    function drawGrid(ctx,gd,ox,oy,sc,mode,hair,bb){
      for(var y=0;y<gd.H;y++)for(var x=0;x<gd.W;x++){
        var c=gd.g[y][x]; if(!c)continue; var sx=x;
        if(mode==='left') sx=bb?(bb.x0+bb.x0+bb.w-1-x):(gd.W-1-x);
        if(mode==='back'){ if(isSkin(c)) c=hair; else if(isDark(c)&&isInterior(gd,x,y)) c=hair; }
        ctx.fillStyle=c; ctx.fillRect(ox+sx*sc, oy+y*sc, sc, sc);
      }
    }
    var SIZES=[['大',4],['中',3],['小',2]], ORI=['portrait','front','left','right','back'], ORL=['静','正','左','右','背'];
    // 先收集全部角色, 算全局统一正方形格子(以最大角色的大号为准)
    var data=[]; var gMax=0;
    for(var ci=0;ci<CHARS.length;ci++){
      var gd=grid(CHARS[ci][0]); if(!gd) continue;
      var bb=bounds(gd);
      var gdS=parseOvr(SIDE_OVR[CHARS[ci][0]]), gdB=parseOvr(BACK_OVR[CHARS[ci][0]]);
      var wk=WALK_OVR[CHARS[ci][0]]||{};
      var gd2 = (wk.front?parseOvr(wk.front):null) || stepGrid(gd,'in');
      var gdS2= gdS ? ((wk.side?parseOvr(wk.side):null) || stepGrid(gdS,'out')) : null;
      var gdB2= gdB ? ((wk.back?parseOvr(wk.back):null) || stepGrid(gdB,'in')) : null;
      var gdP=portraitGrid(CHARS[ci][0])||gd;
      data.push([CHARS[ci][1],gd,hairColor(gd),bb,gdS,gdB,gd2,gdS2,gdB2,gdP]);
      window.CHARSPEC=window.CHARSPEC||{};
      window.CHARSPEC[CHARS[ci][0]]={front:gd,front2:gd2,side:gdS,side2:gdS2,back:gdB,back2:gdB2,portrait:gdP,bbP:bounds(gdP),bb:bb,bbS:gdS?bounds(gdS):null,bbB:gdB?bounds(gdB):null};
      var mx=Math.max(bb.w,bb.h); if(mx>gMax)gMax=mx;
    }
    var cpad=6, SIDE=gMax*4+cpad*2;   // 全局统一正方形边长
    var headH=20, gCell=5, gRow=5, tagW=26;
    var gridEl=document.getElementById('cdGrid'), dpr=window.devicePixelRatio||1;
    var cards=[];
    function drawCard(cd, f){
      var ctx=cd.ctx;
      ctx.clearRect(0,0,cd.cw,cd.ch);
      ctx.textBaseline='middle'; ctx.font='12px monospace';
      for(var o=0;o<ORI.length;o++){ ctx.fillStyle=(o===0?'#555':'#a8a49c'); ctx.textAlign='center';
        ctx.fillText(ORL[o], (SIDE+gCell)*o+SIDE/2, headH/2); }
      for(var si=0;si<SIZES.length;si++){
        var sc=SIZES[si][1], ry=headH+si*(SIDE+gRow);
        for(var o=0;o<ORI.length;o++){
          var cx=(SIDE+gCell)*o;
          ctx.strokeStyle=(o===0?'#c8c4bc':'#e7e4dd'); ctx.lineWidth=1;
          ctx.strokeRect(cx+0.5, ry+0.5, SIDE-1, SIDE-1);
          var base=cd.gd, ug=cd.gd, um=ORI[o];
          if(ORI[o]==='portrait'){base=cd.gdP;ug=cd.gdP;um='front';}
          else if(ORI[o]==='right'&&cd.gdS){base=cd.gdS;ug=(f&&cd.gdS2)?cd.gdS2:cd.gdS;um='front';}
          else if(ORI[o]==='left'&&cd.gdS){base=cd.gdS;ug=(f&&cd.gdS2)?cd.gdS2:cd.gdS;um='left';}
          else if(ORI[o]==='back'&&cd.gdB){base=cd.gdB;ug=(f&&cd.gdB2)?cd.gdB2:cd.gdB;um='front';}
          else if(f&&cd.gd2){ug=cd.gd2;}
          var ubb=(base===cd.gd)?cd.bb:bounds(base);
          var sw=ubb.w*sc, sh=ubb.h*sc;
          var ox=cx+(SIDE-sw)/2-ubb.x0*sc, oy=ry+(SIDE-sh)/2-ubb.y0*sc;
          drawGrid(ctx,ug,Math.round(ox),Math.round(oy),sc,um,cd.hair,ubb);
        }
        ctx.fillStyle='#999'; ctx.font='12px monospace'; ctx.textAlign='left';
        ctx.fillText(SIZES[si][0], ORI.length*(SIDE+gCell)+4, ry+SIDE/2);
      }
    }
    for(var d=0;d<data.length;d++){
      var name=data[d][0], gd=data[d][1], hair=data[d][2], bb=data[d][3], gdS=data[d][4], gdB=data[d][5], gd2=data[d][6], gdS2=data[d][7], gdB2=data[d][8], gdP=data[d][9];
      var card=document.createElement('div'); card.className='cd-card';
      var nm=document.createElement('div'); nm.className='cd-nm'; nm.textContent=name; card.appendChild(nm);
      var cvs=document.createElement('canvas'); card.appendChild(cvs);
      var cw=ORI.length*(SIDE+gCell)+tagW, ch=headH+SIZES.length*(SIDE+gRow)+4;
      cvs.width=cw*dpr; cvs.height=ch*dpr; cvs.style.width=cw+'px'; cvs.style.height=ch+'px';
      var ctx=cvs.getContext('2d'); ctx.scale(dpr,dpr); ctx.imageSmoothingEnabled=false;
      var cd={ctx:ctx,cw:cw,ch:ch,gd:gd,hair:hair,bb:bb,gdS:gdS,gdB:gdB,gd2:gd2,gdS2:gdS2,gdB2:gdB2,gdP:gdP,slow:(name==='婆婆')};
      cards.push(cd); drawCard(cd,0);
      gridEl.appendChild(card);
    }
    // 行动动画: 每角色独立第2帧 · 步行=腿张/并交替 · 婆婆=飞行穗尾晃动 · 幽影=飘尾摆动
    var walkTick=0;
    setInterval(function(){ walkTick++; var walkF=walkTick%2, slowF=(walkTick>>2)%2;
      for(var i=0;i<cards.length;i++) drawCard(cards[i], cards[i].slow?slowF:walkF); }, 260);
    document.getElementById('cdCount').textContent=data.length+' 角色';
    // ── 全局规范绘制: cx=中心x footY=脚底 · side朝右默认 ──
    window.drawSpecChar=function(ctx,key,ori,f,cx,footY,sc,flip){
      var cs=window.CHARSPEC[key]; if(!cs)return false;
      var g1=cs[ori]||cs.front, g2=cs[ori+'2'];
      var bb= ori==='side'?cs.bbS: ori==='back'?cs.bbB: cs.bb;
      if(!g1||!bb){g1=cs.front;bb=cs.bb;g2=cs.front2;}
      var use=(f&&g2)?g2:g1;
      var w=bb.w*sc,h=bb.h*sc, ox=cx-w/2, oy=footY-h;
      ctx.save();
      if(flip){ctx.translate(ox+w,oy);ctx.scale(-1,1);}else ctx.translate(ox,oy);
      for(var yy=bb.y0;yy<bb.y0+bb.h;yy++){var row=use.g[yy];if(!row)continue;
        for(var xx=bb.x0;xx<bb.x0+bb.w;xx++){var c=row[xx];if(!c)continue;
          ctx.fillStyle=c;ctx.fillRect((xx-bb.x0)*sc,(yy-bb.y0)*sc,sc,sc);}}
      ctx.restore(); return true;
    };
    // ── 规范驱动全部 UI: 40角色 + 尺寸变体类(-s 2px / 基础 3px / -m 4px / -l 6px)──
    (function(){
      var css='';
      function emit(cls, g, px){
        // 方形容器 · 按实际像素包围盒完全居中 · 四周留白
        var bb=bounds(g);
        var S=Math.max(bb.w,bb.h)+2;
        var ox=Math.round((S-bb.w)/2)-bb.x0, oy=Math.round((S-bb.h)/2)-bb.y0;
        var shadows=[];
        for(var y=0;y<g.H;y++)for(var x=0;x<g.W;x++){
          var c=g.g[y][x]; if(!c) continue;
          shadows.push(((x+ox)*px)+'px '+((y+oy)*px)+'px 0 0 '+c);
        }
        css+='.spr-'+cls+'{width:'+(S*px)+'px;height:'+(S*px)+'px}';
        css+='.spr-'+cls+'::after{width:'+px+'px;height:'+px+'px;box-shadow:'+shadows.join(',')+'}';
      }
      for(var k in window.CHARSPEC) emit(k, window.CHARSPEC[k].portrait, 3);
      // 页面 UI 的旧类名别名 + 尺寸变体
      var ALIAS=[['yun','ayun'],['monk','tenz'],['tao','tao'],['popo','popo']];
      var SUF={'-s':2,'':3,'-m':4,'-l':6};
      for(var i=0;i<ALIAS.length;i++){
        var spec=window.CHARSPEC[ALIAS[i][1]]; if(!spec) continue;
        for(var suf in SUF) emit(ALIAS[i][0]+suf, spec.portrait, SUF[suf]);
      }
      css+='.spr-frame{display:flex;align-items:center;justify-content:center}';
      var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
    })();
  })()