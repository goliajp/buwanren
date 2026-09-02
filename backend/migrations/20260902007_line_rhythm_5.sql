-- 台词节奏（五）· 最后八位
-- 手法同前四支:只动节奏、不动内容，贴着 `villager.voice`。

-- 婆婆（缺亲人）· 上一支改完仍是 3/4 的「两拍逗号句」——
-- 我把两条都改成了逗号句，等于没动密度。这次给她一条三拍的。
UPDATE villager_line SET text = '牌摊在那儿呢，不急，什么时候来看都行呀'
 WHERE villager_id = 'popo' AND seq = 3;

-- 拉玛（缺急）· voice：语速慢 —— 连读反而更慢，句号是催促
UPDATE villager_line SET text = '这一轮走完还有下一轮，你急什么'
 WHERE villager_id = 'rama' AND seq = 1;

-- 塞西尔（缺情）· voice：只说陈述句，从不感叹
UPDATE villager_line SET text = '我不评价，摆子怎么动，我怎么说'
 WHERE villager_id = 'sesir' AND seq = 3;

-- 塞特（缺谦）· voice：说话像在刻碑，喜欢排比
UPDATE villager_line SET text = '这段我念给三代法老听过，他们都不在了'
 WHERE villager_id = 'set' AND seq = 2;

-- 沈砚（缺运）· 四条全是「两拍逗号句」，唯一一位四条全同的
UPDATE villager_line SET text = '书读到一半，人先散了。剩下的我自己读'
 WHERE villager_id = 'shenyan' AND seq = 1;
UPDATE villager_line SET text = '今天不想算，就想坐会儿，你也坐'
 WHERE villager_id = 'shenyan' AND seq = 2;

-- 薇拉（缺快）· voice：爱用长定语，从不承诺
UPDATE villager_line SET text = '快的东西我做不好，你做得好，那就去做'
 WHERE villager_id = 'weila' AND seq = 3;

-- 小满（缺身体）· voice：句式规整，偶尔冒出别人的口头禅
UPDATE villager_line SET text = '我没有手，要是有，我给你倒杯水'
 WHERE villager_id = 'xiaoman' AND seq = 4;

-- 雪鸮（缺醒）· voice：清醒时惜字如金
UPDATE villager_line SET text = '醒着最难，我一天醒不了几个时辰'
 WHERE villager_id = 'xueyao' AND seq = 4;
