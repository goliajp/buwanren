-- 六枚徽章的难度 —— 那一列一直是 10，六枚一模一样。
--
-- 【它不是装饰】。徽章那一屏按 `ORDER BY (earned_at IS NOT NULL) DESC, b.points ASC`
-- 排（`unmei-api/src/routes/badge.rs`），而六个 points 全等于 10 ——
-- 也就是**没有 tiebreaker，顺序是未定义的**。页面又在这个顺序上再做一层
-- 「同一条路上只给最近的那一枚」（`badges/index.ts` 的 `只留最近`），
-- 于是「去问一件事 ›」这条路指给了列表里碰巧排在前面的那一枚 ——
-- 实测指的是**「一个月 · 连着三十天」**，而一次都还没问过的人，
-- 一步之遥的「头一回」什么出口都没有
-- （2026-09-06 五路评审 · 第一次打开的人）。
--
-- 数按【要做多少次】给，不是拍脑袋:
--   头一回   1 次      · 10
--   闻过香   买一次    · 20
--   到过场   到场一次  · 20（要出门，比买一次难）
--   七天没断 7 天      · 30
--   一百次   100 次    · 50
--   一个月   30 天     · 60（连着三十天是这六枚里最难的）
-- 排序那一头同日补了 `b.code` 当最后一道 tiebreaker ——
-- 分数万一再撞上，顺序也不能是「看数据库心情」。

UPDATE badge SET points = 10 WHERE code = 'first_naji';
UPDATE badge SET points = 20 WHERE code = 'first_purchase';
UPDATE badge SET points = 20 WHERE code = 'first_activity';
UPDATE badge SET points = 30 WHERE code = 'continous_7';
UPDATE badge SET points = 50 WHERE code = 'hundred_naji';
UPDATE badge SET points = 60 WHERE code = 'continous_30';
