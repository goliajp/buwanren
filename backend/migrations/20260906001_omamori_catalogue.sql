-- 御守目录 —— 名册那一屏第一次真的有东西卖。
--
-- 【它原先卖的是什么】。什么也没有。`backend/seed/` 里御守商品**一件都没有**,
-- 而 `scripts/plan25.sh` 的 `make_omamori_product` 头上就写着这句:
-- 「见文档里的先决条件:种子里一件都没有,这一支自己造」。
-- 也就是说:一份新克隆出来的库,名册那一屏四十位【全部】按不动,
-- 顶上那行写着「另外 40 位」。而这一屏是「请人回村」那条掏钱路的入口。
--
-- 本机之所以看着像有东西卖,是因为库里躺着 884 件 `prod-oma-t*` 的测试夹具
-- （`20260902009_goods_image.sql` 已经下架过一批,之后每一轮门禁又长出新的）。
-- 也就是说【货架上摆的是谁,取决于最近哪一轮测试跑过】——
-- 名册按 `DISTINCT ON (villager_id) … sort_weight DESC, id` 每位取一件,
-- 取中哪一件是夹具 id 的字典序说了算。这是在流沙上开店。
--
-- 【谁该上架】。判据是「他真的搬得进来」,三条都要:
--   · 有屋子    `rooms/src/rooms/<id>.js` —— 请回来之后你进得去
--   · 走得动    `rooms/src/engine/village.js` 里那行 `cast: true` ——
--               请回来之后他在村里真的走动。没有这一条,买家花 ¥99
--               换来一间亮着灯却永远没人出来的屋子
--   · 答得上话  `villager_voice` —— 御守那一屏明写着「有事可以问他」
-- 三条同时满足的是四位:阿云、桃桃、婆婆、丹增。
--
-- 白鹭与沈砚有屋子、有口气,但村里没有他们的走动素材（`village.js` 的 SPR
-- 里没有这两副像素）。**不上架** —— 这是 2026-09-06 用户拍的板。
-- 画好那两副像素之后再各自上架,一位一次。
-- 这三条由 `scripts/check-can-move-in.py` 守着,两个方向都守:
-- 上架了却搬不进来要报,反过来素材都齐了却没上架也要报（画了没人买得到）。
--
-- 【价】一律 ¥99。设计册 10.8 写的就是这个数,不按稀有度分档 ——
-- 那是另一个产品决定,没人拍过。
--
-- 【区】cn 与 zh_hant 两格。真目录其余几件（玉坠 / 苏合香 / 纳吉深报）
-- 都是 `{cn}` 独一格,而御守是这批里唯一【不寄东西】的:
-- 没有物流、没有关税、没有各区不同的包装合规,拦着它出 cn 的理由不存在。
-- zh_hant 是阿港与阿双管的那一格,给了它才有真数据可管。
-- 其余四格（jp/kr/sea/na）暂不开:那要先定当地币种的价,
-- 而定价是产品决定,不是迁移能替人拍的。
--
-- 【夹具与真目录分开】。上完架顺手把 `prod-oma-t*` 那一批全下架 ——
-- 判据是 id 前缀,只认夹具,不碰这四件。下架不删:那些 id 被真实测过的
-- 订单与支付引着,删了会连带动外键（同 20260902009 的理由）。
-- `plan25.sh` 也跟着改成用 `sku-oma-ayun`,不再自己造一件混进真目录。

-- 【文案里不写他/她】（同日改）。头一版四件的副标题写的是「请他回村」
-- 「请她回村」，正文里也是「他会住进你的村子里」—— 而
-- `scripts/check-no-deixis.py` 当场报了:这套句式对四十位是同一套,
-- 男女都有,而商品名旁边那一句读的人不一定知道说的是谁。
-- 改成用名字,或者干脆省掉主语。
-- 这一支红着的时候变异测试的结论一律不算数（它靠「干净源码上全绿」当基准）——
-- 那一轮 117 项里「漏掉 2 项」全是这一条的下游。

INSERT INTO product(id, code, name, sub_title, category, kind, status,
                    description_md, available_regions, available_platforms,
                    fulfillment_kind, tags, sort_weight, audit_note)
VALUES
  ('prod-oma-ayun', 'OMA-AYUN', '阿云的御守', '请回村 · 住进你的村子',
   'omamori', 'one_shot', 'listed',
   '请阿云回村。往后就住在你的村子里，白天在村口那条路上晃，有事你可以问阿云 —— 一天一次。',
   ARRAY['cn','zh_hant'], ARRAY['web','mini','ios','android'],
   'residency', ARRAY['御守','村民'], 95,
   '2026-09-06 立:名册第一次真的有东西卖'),
  ('prod-oma-tao', 'OMA-TAO', '桃桃的御守', '请回村 · 住进你的村子',
   'omamori', 'one_shot', 'listed',
   '请桃桃回村。往后就住在你的村子里，在村西头开直播间，有事你可以问桃桃 —— 一天一次。',
   ARRAY['cn','zh_hant'], ARRAY['web','mini','ios','android'],
   'residency', ARRAY['御守','村民'], 95,
   '2026-09-06 立:名册第一次真的有东西卖'),
  ('prod-oma-popo', 'OMA-POPO', '婆婆的御守', '请回村 · 住进你的村子',
   'omamori', 'one_shot', 'listed',
   '请婆婆回村。往后就住在你的村子里，带着那一屋子动物，有事你可以问婆婆 —— 一天一次。',
   ARRAY['cn','zh_hant'], ARRAY['web','mini','ios','android'],
   'residency', ARRAY['御守','村民'], 95,
   '2026-09-06 立:名册第一次真的有东西卖'),
  ('prod-oma-tenz', 'OMA-TENZ', '丹增的御守', '请回村 · 住进你的村子',
   'omamori', 'one_shot', 'listed',
   '请丹增回村。往后就住在你的村子里，天没亮就在村北练那一百零八式，有事你可以问丹增 —— 一天一次。',
   ARRAY['cn','zh_hant'], ARRAY['web','mini','ios','android'],
   'residency', ARRAY['御守','村民'], 95,
   '2026-09-06 立:名册第一次真的有东西卖')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sku(id, product_id, code, name, stock_kind, default_currency,
                status, region, villager_id)
VALUES
  ('sku-oma-ayun', 'prod-oma-ayun', 'OMA-AYUN-1', '阿云的御守',
   'unlimited', 'CNY', 'active', 'cn', 'ayun'),
  ('sku-oma-tao',  'prod-oma-tao',  'OMA-TAO-1',  '桃桃的御守',
   'unlimited', 'CNY', 'active', 'cn', 'tao'),
  ('sku-oma-popo', 'prod-oma-popo', 'OMA-POPO-1', '婆婆的御守',
   'unlimited', 'CNY', 'active', 'cn', 'popo'),
  ('sku-oma-tenz', 'prod-oma-tenz', 'OMA-TENZ-1', '丹增的御守',
   'unlimited', 'CNY', 'active', 'cn', 'tenz')
ON CONFLICT (id) DO NOTHING;

-- 价排在 sku 之后 —— `price_book.sku_id` 有外键
INSERT INTO price_book(id, sku_id, currency, price_minor, region, platform,
                       effective_from, status, audit_note)
VALUES
  ('pb-oma-ayun-cn', 'sku-oma-ayun', 'CNY', 9900, 'cn', 'all', NOW(), 'active',
   '设计册 10.8:御守 ¥99'),
  ('pb-oma-tao-cn',  'sku-oma-tao',  'CNY', 9900, 'cn', 'all', NOW(), 'active',
   '设计册 10.8:御守 ¥99'),
  ('pb-oma-popo-cn', 'sku-oma-popo', 'CNY', 9900, 'cn', 'all', NOW(), 'active',
   '设计册 10.8:御守 ¥99'),
  ('pb-oma-tenz-cn', 'sku-oma-tenz', 'CNY', 9900, 'cn', 'all', NOW(), 'active',
   '设计册 10.8:御守 ¥99'),
  -- 繁中那一格。990 TWD ≈ ¥99 —— 跟纳吉深报那件的 cn:zh_hant 比例
  -- （3800 分 : 950 TWD）一个量级,不另定一套定价法
  ('pb-oma-ayun-zh-hant', 'sku-oma-ayun', 'TWD', 990, 'zh_hant', 'all', NOW(),
   'active', '繁中那一格 · 跟纳吉深报同一个换算量级'),
  ('pb-oma-tao-zh-hant',  'sku-oma-tao',  'TWD', 990, 'zh_hant', 'all', NOW(),
   'active', '繁中那一格 · 跟纳吉深报同一个换算量级'),
  ('pb-oma-popo-zh-hant', 'sku-oma-popo', 'TWD', 990, 'zh_hant', 'all', NOW(),
   'active', '繁中那一格 · 跟纳吉深报同一个换算量级'),
  ('pb-oma-tenz-zh-hant', 'sku-oma-tenz', 'TWD', 990, 'zh_hant', 'all', NOW(),
   'active', '繁中那一格 · 跟纳吉深报同一个换算量级')
ON CONFLICT (id) DO NOTHING;

-- ── 夹具让开货架 ──────────────────────────────────────────────
-- 夹具 id 长这样:`prod-oma-t81613-2`、`prod-oma-t1498x806212951-5` ——
-- `t` 后面跟的是数字。判据必须钉到那个数字上:
-- 头一版写的是 `id LIKE 'prod-oma-t%'`,而它当场把上面刚建的
-- `prod-oma-tao` 与 `prod-oma-tenz` 一起下架了 —— 四件上架完只剩两件,
-- 而这条 UPDATE 不会为此报任何错。加上 plan25 自己造的那一件。
-- 下架,不删:那些 id 被真实测过的订单与支付引着(同 20260902009 的理由)。
UPDATE product SET status = 'draft'
 WHERE status = 'listed' AND category = 'omamori'
   AND (id ~ '^prod-oma-t[0-9]' OR id LIKE 'p25-oma-%');
