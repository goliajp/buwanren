-- 术数 → mingli 叶(算力层的接线)
--
-- 叶名不是我起的,是 `goliajp/mingli` 的 `mingli-registry::registry()` 里登记的那一份 ——
-- 每片叶的 `CastingEngine::id()` 就是 `/api/cast` 输出里的 key。
--
-- 2026-08-17 校对过的全部 24 片(照 registry 的顺序):
--   abjad astrology bazi tarot gematria geomancy ifa jyotish liuren mahabote
--   maya meihua numerology pawukon qimen qizhengsiyu sikidy taiyi tibetan
--   wuge xiaoliuren yijing zeri ziwei
--
-- ⚠ 只能填这张表里的 id。写第一版时我填了 `rune` 与 `luoshu` —— 前者 mingli
--   根本没有这片叶,后者有 crate 但没登记进 registry,两条都是我照着「听起来该有」
--   写的。填错的下场不是报错,是 `fetch_chart` 拿不到盘、静静落一个空盘,
--   看起来跟「这门术数还没接算力」一模一样。所以加叶之前先回 mingli 核一次。
--
-- ★ 只填**确有对应**的那些。35 门术数里 18 门在 mingli 里有现成叶,
--   其余 17 门(镜占、灵摆、咖啡占、赛博塔罗……)没有,那一列就留空。
--
--   留空不是欠账,是事实:`villager::reading` 见到空 leaf 会如实落一个空盘,
--   而不是拿一片不相干的叶去凑一个看起来算过的数。事后翻档案的人
--   要能一眼看出这一签背后有没有真盘 —— 填错比不填糟得多。
--
-- 沙占 / 贝壳卜 / 鸟占这类,mingli 里其实有 geomancy(土占)、ifa、sikidy 等
-- 同族的叶,但「同族」不等于「同一门」。要不要借用是设计决定,不是我能替你
-- 在一条 UPDATE 里做掉的,所以一律留空,列在文末等你拍。

UPDATE art SET mingli_leaf = v.leaf
FROM (VALUES
  -- 中式
  ('bazi',      'bazi'),          -- 八字        → 四柱八字
  ('ziwei',     'ziwei'),         -- 紫微斗数    → 紫微斗数
  ('liuren',    'liuren'),        -- 大六壬      → 大六壬
  ('qimen',     'qimen'),         -- 奇门遁甲    → 奇门遁甲
  ('taiyi',     'taiyi'),         -- 太乙神数    → 太乙神数
  ('meihua',    'meihua'),        -- 梅花易数    → 梅花易数
  ('liuyao',    'yijing'),        -- 六爻        → 易经(六爻是易经的起卦法)
  ('guijia',    'yijing'),        -- 龟甲骨卜    → 易经(龟卜是易的源头,同一套象)
  ('cezi',      'meihua'),        -- 测字        → 梅花易数(拆字起卦本就是梅花的一路)
  -- 西式
  ('astro',     'astrology'),     -- 占星        → 西洋占星
  ('veda',      'jyotish'),       -- 吠陀占星    → 印度占星
  ('egypt',     'qizhengsiyu'),   -- 埃及星象    → 七政四余(古典行星体系最接近的一支)
  ('tarot',     'tarot'),         -- 塔罗        → 塔罗
  -- 其它文明
  ('maya',      'maya'),          -- 玛雅历      → 玛雅历
  ('zangli',    'tibetan'),       -- 藏历密算    → 藏历
  ('sand',      'geomancy'),      -- 沙占        → 土占(geomancy 的原义就是沙土占)
  ('shell',     'ifa'),           -- 贝壳卜      → 伊法(西非贝壳占的正统实现)
  ('bone',      'sikidy')         -- 萨满骨卜    → 西基迪(马达加斯加骨卜同源)
) AS v(art_key, leaf)
WHERE art.key = v.art_key;

-- 剩下 17 门没有对应叶,`mingli_leaf` 留空:
--   candle 蜡烛占 · chaozhan 潮汐占 · coffee 咖啡占 · crystal 水晶球
--   cyber 赛博塔罗 · data 数据占卜 · denghua 灯花卜 · fengshui 风水堪舆
--   mirror 镜占 · ml 机器学习 · niaozhan 鸟占 · pendulum 灵摆
--   rune 卢恩符文 · shinto 神签 · stock 股票玄学 · tea 茶叶占
--   xiangmian 面相手相
--
-- 这些要么 mingli 里没有(镜占、灵摆),要么本就不是算力题(赛博塔罗、股票玄学、
-- 机器学习 —— 它们的「算」是叙事的一部分)。等你拍板要不要各配一片叶。
