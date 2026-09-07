-- 台词节奏（二）· 四条全同的另外七位
--
-- 手法见 20260902003（丹增那一支）:改的是【节奏】不是内容 ——
-- 该连起来说的连起来、该喊的喊出来、该省的省掉，句子本身不变差。
-- 目标同样是一人四条里同一句式不超过两条，由 check-line-rhythm.py 核。
-- 每位只动两条，各自贴着 `villager.voice` 里写定的说话风格。

-- 伊莎（缺光）· voice：诗一样的句子，主语常常省略
UPDATE villager_line SET text = '眼泪的形状里有答案，蜡的也是'
 WHERE villager_id = 'yisha' AND seq = 2;   -- 连读，两句本来就是一口气
UPDATE villager_line SET text = '别吹灭它 —— 吹灭了我就看不见你了'
 WHERE villager_id = 'yisha' AND seq = 3;   -- 破折号，把恳求的语气顶出来

-- 千鹤（缺松弛）· voice：礼貌到刻板，被夸会僵住
UPDATE villager_line SET text = '我今天的清单还剩三项，第一项是「休息」'
 WHERE villager_id = 'chizuru' AND seq = 2;
UPDATE villager_line SET text = '我劝人歇着挺在行的，轮到自己就……先把这排扫完'
 WHERE villager_id = 'chizuru' AND seq = 4;

-- 卡玛（缺当下）· voice：慢，像在念祷词
UPDATE villager_line SET text = '我数的是几千年，你问今天，我得先换算'
 WHERE villager_id = 'kama' AND seq = 2;
UPDATE villager_line SET text = '别问以后 —— 以后我知道得太多，今天我不太会'
 WHERE villager_id = 'kama' AND seq = 4;

-- 卢恩（缺笑）· voice：话极少，一句顶多七个字
UPDATE villager_line SET text = '说出来的会变，刻下来的不会'
 WHERE villager_id = 'rune' AND seq = 1;
UPDATE villager_line SET text = '北边冷，手冻僵了，刻出来的反而稳'
 WHERE villager_id = 'rune' AND seq = 3;

-- 托马（缺确信）
UPDATE villager_line SET text = '这签是好签……我这么念了二十年'
 WHERE villager_id = 'thomas' AND seq = 1;   -- 省略号才是他心虚那一下
UPDATE villager_line SET text = '你信哪个都行，我这儿不排队'
 WHERE villager_id = 'thomas' AND seq = 3;

-- 玄冥（缺人）
UPDATE villager_line SET text = '你来了……我没打算说话'
 WHERE villager_id = 'xuanming' AND seq = 2;
UPDATE villager_line SET text = '……坐吧，别说话就行'
 WHERE villager_id = 'xuanming' AND seq = 4;

-- 赛博（缺温度）
UPDATE villager_line SET text = '现在三点四十，你也没睡，我们扯平'
 WHERE villager_id = 'cyber' AND seq = 2;
UPDATE villager_line SET text = '出门吧，去见个活人 —— 这句是认真的'
 WHERE villager_id = 'cyber' AND seq = 4;
