-- 哪几件东西是「按你缺的那一样配」的 —— 标出来，让下单那一步问得到。
--
-- 【屏上写着，而订单里没有任何一处记它】（2026-09-07 三路验证 ·
-- 准备花钱的那一路）。
--   · 玉坠   商品名就叫「和田玉葫芦坠（配你缺的那一样）」，¥398
--   · 单配香 SKU 名就叫「按你缺的那味单配」，¥268
--   · 按月送 正文写着「按你缺的那一味配」，¥78 每月
-- 而 `product.required_inputs` 全仓零读者，`order_line` / `order_meta`
-- 没有任何相关列，`yongshen` / `五行` 在 `order.rs` / `fulfillment.rs` 里
-- 一次都没出现过 —— **下单流程从头到尾没问过买家缺什么**，
-- 装箱的人也拿不到。花 ¥398 买「配我缺的那一样」，收到的只能是默认款。
--
-- 标记落在 `sku.spec_json.needs_yongshen` 上，不落在 product:
-- 苏合那一件下面三档，只有「按你缺的那味单配」是配的，
-- 试香三支与一盒十支是现成的（正文那句「按你缺的那一味配」说的是
-- 她配方子这件事，不是每一档都现配）。落在 product 上会把那两档
-- 一起挡在「先填出生时间」后面，而它们本来就不需要。
--
-- 判据由 `scripts/check-yongshen-recorded.py` 守着:标了这个的 SKU，
-- 它的每一张已付订单都要记得下用神。

UPDATE sku SET spec_json = spec_json || '{"needs_yongshen": true}'::jsonb
 WHERE id IN ('sku-jade-pendant', 'sku-incense-bespoke', 'sku-incense-monthly');
