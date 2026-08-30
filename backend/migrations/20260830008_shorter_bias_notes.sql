-- 名册顶上那句只说【你要的是什么】，不说【该怎么做】。
--
-- 上一版把两件事写进了同一句：「你要的是守得住的那份定 —— 把手上的事做扎实」。
-- 而「该怎么做」算完那一屏已经说过了（`build_friendly_hint`：
-- 「把手上的事一件件做扎实，别贪多」）—— 同一件事说了两遍，
-- 而且这一句一长就折成两行，把名册第五张卡挤到分页栏底下
-- （那一屏的设计目标是一屏放得下）。
--
-- 顺带把「那份定」换掉：「定」当名词是旧说法，现代人说「稳得住」。
UPDATE yongshen_bias SET note = '你要的是往外伸展的那口气' WHERE wuxing = '木' AND rank = 1;
UPDATE yongshen_bias SET note = '你缺的是热度与人气'       WHERE wuxing = '火' AND rank = 1;
UPDATE yongshen_bias SET note = '你要的是稳得住'           WHERE wuxing = '土' AND rank = 1;
UPDATE yongshen_bias SET note = '该收的收、该断的断'       WHERE wuxing = '金' AND rank = 1;
UPDATE yongshen_bias SET note = '你要的是静下来'           WHERE wuxing = '水' AND rank = 1;
