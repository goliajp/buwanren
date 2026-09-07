-- 按月送那一件的商品图。
--
-- `check-listed-deliverable.py` 当场抓到:寄到家的实物上了架而
-- `hero_image_url` 是空的 —— 买家看不见自己要买的东西长什么样。
-- 「电商漏斗里最该有图的地方是空的，比任何排版问题都更像没做完」
-- （那条判据 2026-09-02 立的，今天第一次抓到新上架的东西）。
--
-- 图跟徽章、底栏同一条路:24×24 的像素画 ×5 = 120×120，
-- 画在 `rooms/tools/export-tabicons.mjs` 的「商品」那一段。
--
-- 【为什么不复用 goods-incense.png】那张画的是三支香斜插在香插上 ——
-- 卖的是「几支香」。按月送每期到的是【一盒】，而「按月」这件事
-- 在屏上唯一说得清的实体就是那只盒子。两件东西两张图。
UPDATE product SET hero_image_url = '/images/goods-incense-box.png'
 WHERE id = 'prod-incense-monthly' AND (hero_image_url IS NULL OR hero_image_url = '');
