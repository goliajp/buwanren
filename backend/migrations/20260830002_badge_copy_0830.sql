-- 徽章文案重写（0830 版）。
--
-- 原来的六条有三个毛病，每一个都在用户眼前：
--
-- ① **「纳吉」直接印在界面上**。它既是术数行话，又跟一个同类小程序同名 ——
--    我们的徽章上写着别人的名字。设计册 §1 早就定了「术数是内容不是卖点」，
--    而这是它漏得最明显的一处
-- ② **修仙腔**：初入道门、修心有成、禅修初成、通晓门径。
--    0830 版要的是平易亲和，不是《凡人修仙传》
-- ③ **半角逗号**：「首次纳吉,开启修行之旅」—— 项目铁律里写着中文标点一律全角
--
-- 新的六条按同一条尺子写:说【你做了什么】，不说【你修到了第几层】。
-- 语气可以有一点自嘲，但不油。
UPDATE badge SET name = '头一回',   description = '第一次转罗盘 —— 你来了'                WHERE id = 'b_first';
UPDATE badge SET name = '七天没断', description = '连着七天来问一件事'                     WHERE id = 'b_streak';
UPDATE badge SET name = '一个月',   description = '连着三十天。这份认真本身就少见'         WHERE id = 'b_30';
UPDATE badge SET name = '一百次',   description = '累计问过一百件事 —— 你比自己以为的清楚' WHERE id = 'b_hund';
UPDATE badge SET name = '闻过香',   description = '第一次买香。屋子里从此有味道'           WHERE id = 'b_buy';
UPDATE badge SET name = '到过场',   description = '去过一次线下 —— 隔着屏幕见不到的那种'   WHERE id = 'b_act';

-- 圆牌上那个字。原先取名字的首字，而「一个月」和「一百次」都取到「一」——
-- 六枚里两枚长得一样，收集品最要紧的「一眼分得开」就没了。
-- 一个字是【设计资产】，不该由名字碰巧决定。
ALTER TABLE badge ADD COLUMN IF NOT EXISTS glyph TEXT;
UPDATE badge SET glyph = '头' WHERE id = 'b_first';
UPDATE badge SET glyph = '七' WHERE id = 'b_streak';
UPDATE badge SET glyph = '卅' WHERE id = 'b_30';
UPDATE badge SET glyph = '百' WHERE id = 'b_hund';
UPDATE badge SET glyph = '香' WHERE id = 'b_buy';
UPDATE badge SET glyph = '场' WHERE id = 'b_act';

-- 说明收短。三行换行的说明比一行读起来累，而它要答的只有一句:怎么得到
UPDATE badge SET description = '第一次转罗盘'       WHERE id = 'b_first';
UPDATE badge SET description = '连着七天来问'       WHERE id = 'b_streak';
UPDATE badge SET description = '连着三十天'         WHERE id = 'b_30';
UPDATE badge SET description = '问过一百件事'       WHERE id = 'b_hund';
UPDATE badge SET description = '第一次买香'         WHERE id = 'b_buy';
UPDATE badge SET description = '去过一次线下'       WHERE id = 'b_act';
