-- 台词节奏（四）· 四中之三的第八到十四位
-- 手法同前三支:只动节奏、不动内容，每位一条，贴着 `villager.voice`。

-- K（缺相信）· voice：爱说「统计上」，被戳穿会沉默
UPDATE villager_line SET text = '有百分之六十四的把握，剩下那部分归你'
 WHERE villager_id = 'kdata' AND seq = 2;

-- 老徐（缺止损）· voice：嗓门大
-- 【不加省略号】。第一版这里写的是「这波稳了！……上一波我也这么说」，
-- 而 check-villager-lines 当场报红:省略号这一招已经有千鹤和玄冥在用，
-- 三个人用同一招就开始像同一个作者写的。感叹号够了。
UPDATE villager_line SET text = '这波稳了！上一波我也这么说'
 WHERE villager_id = 'laoxu' AND seq = 1;

-- 雷鸣（缺柔）· voice：大嗓门，直来直去
UPDATE villager_line SET text = '这屋子病在西北角，你自己也知道'
 WHERE villager_id = 'leiming' AND seq = 1;

-- 米拉（缺家）· voice：唱着说
UPDATE villager_line SET text = '牌摊在车厢里，哪儿停哪儿是家'
 WHERE villager_id = 'mira' AND seq = 1;

-- 木一（缺信）· voice：说话有齿轮感 —— 短促咬合，不是长句
UPDATE villager_line SET text = '慢了十一秒，十一秒也是慢'
 WHERE villager_id = 'muyi' AND seq = 1;

-- 奥兰多（缺真）
UPDATE villager_line SET text = '掌纹不撒谎，握手的人才撒'
 WHERE villager_id = 'orlando' AND seq = 2;

-- 婆婆（缺亲人）· 这位撞的是「两拍逗号句」，不是那个句号形状。
-- voice：尾音上扬带「哦」「呀」—— 让她多一句真的上扬的
UPDATE villager_line SET text = '今儿降温了哦，加件衣裳呀'
 WHERE villager_id = 'popo' AND seq = 2;
UPDATE villager_line SET text = '牌摊在那儿呢，什么时候来看都行呀'
 WHERE villager_id = 'popo' AND seq = 3;
