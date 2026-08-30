-- 六位村民的身份词用的是现代汉语里不再说的话。
--
--   白鹭 —— 女冠（女道士的古称）
--   陈九 —— 赌坊
--   沈砚 —— 落第（科举没中）
--   苏合 —— 娘子
--   燕娘 —— 婆子
--   玄冥 —— 隐者
--
-- 改的不是角色，是称谓。四十位里本来就有「拉花的人 · 咖啡占」
-- 「读茶叶的 · 茶叶占」这种当代身份 —— 混搭是这套角色的味道，
-- 而「娘子」「女冠」不是味道，是读者读不出来的词。
-- 其余三十四位（老渔夫、钟表匠、玛雅祭司、星盘师……）照旧。

UPDATE villager SET title = '道观里长大的' WHERE id = 'bailu';
UPDATE villager SET title = '牌桌上的算手' WHERE id = 'chenjiu';
UPDATE villager SET title = '一直没考上的读书人' WHERE id = 'shenyan';
UPDATE villager SET title = '调香的' WHERE id = 'suhe';
UPDATE villager SET title = '街角看相的' WHERE id = 'yanniang';
UPDATE villager SET title = '不常露面的那位' WHERE id = 'xuanming';
