-- 苏合的香（设计册 H5「一味香」）。
--
-- 「东西长在卖它的人身上」是这个产品的一条论点（设计册 10.8：香在苏合家里卖，
-- 不在铺子里）。在这之前它只有御守一个例证 —— 而御守的 `villager_id` 是
-- 「这枚里封的是谁」，不是「谁卖的」。这是第二个，也是第一个真正的「谁卖的」。
--
-- 内容照设计册 H5 抄，不自己发明：乳香 · 安息 · 桂，三档 ¥29 / ¥128 / ¥268。
--
-- category 用 charm（实物、非御守）。**不能用 omamori** ——
-- 那一类会触发「该扫了」的催促（E2 / M3），而香上没有码。
-- 判据里那一问 2026-08-27 才补上，正是拿这盒香量出来的。

INSERT INTO product (id, code, name, sub_title, category, kind, status,
                     description_md, fulfillment_kind, tags, sort_weight) VALUES
  ('prod-suhe-incense', 'suhe_incense', '苏合配的那一味', '乳香 · 安息 · 桂',
   'charm', 'one_shot', 'listed',
   '香药娘子按你缺的那一味配。一支烧二三十分钟，十支约够一个月。',
   'shipping', ARRAY['香','苏合','实物'], 85)
ON CONFLICT (id) DO NOTHING;

-- 三档。`villager_id` 在这里的意思是【谁配的】——
-- 御守那一列的意思是【里面封的是谁】。同一列两种含义，
-- 靠 product.category 分开（御守才有「扫开」这件事）。
INSERT INTO sku (id, product_id, code, name, villager_id, stock_kind,
                 default_currency, weight_g, region, status) VALUES
  ('sku-incense-try',    'prod-suhe-incense', 'incense_try',    '试香 · 三支',
   'suhe', 'unlimited', 'CNY', 40,  'cn', 'active'),
  ('sku-incense-box',    'prod-suhe-incense', 'incense_box',    '一盒十支',
   'suhe', 'unlimited', 'CNY', 120, 'cn', 'active'),
  ('sku-incense-bespoke','prod-suhe-incense', 'incense_bespoke','她按你八字单配',
   'suhe', 'unlimited', 'CNY', 120, 'cn', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO price_book (id, sku_id, currency, price_minor, region, platform,
                        status, audit_note) VALUES
  ('pb-incense-try-cn',     'sku-incense-try',     'CNY', 2900,  'cn', 'all', 'active', '¥29 · 试香三支'),
  ('pb-incense-box-cn',     'sku-incense-box',     'CNY', 12800, 'cn', 'all', 'active', '¥128 · 一盒十支'),
  ('pb-incense-bespoke-cn', 'sku-incense-bespoke', 'CNY', 26800, 'cn', 'all', 'active', '¥268 · 按八字单配')
ON CONFLICT (id) DO NOTHING;
