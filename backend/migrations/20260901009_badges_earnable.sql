-- 六枚徽章里四枚永远发不出来 · 2026-09-01 五路评审（两路各自独立抓到）
--
-- 全仓只有一处发徽章（unmei-api 的 naji.rs），而它只认
-- `type=count AND action=naji.spin` —— 库里的账说得很清楚:
--   b_first（count/naji.spin）发出去 1314 次
--   其余五枚 0 次
-- 「七天没断」「一个月」是 streak，「闻过香」是 order.paid，
-- 「到过场」是 activity.checkin，一个都没有落点。
-- 而屏上还给每一枚配了 CTA，其中一枚直接把人推去买香。
--
-- 这一版:
--   · streak 两枚 → naji.rs 里现算连续天数（不需要 worker，一句 SQL）
--   · 闻过香     → fulfillment.rs 里付款履约时发，并限定到那件香
--   · 到过场     → 【下架】。小程序里没有任何活动页面，也没有一处调活动接口;
--                  一枚拿不到的徽章、配一条通向名册的假路，不如不摆。
--                  有活动入口那天把 status 改回 active 就行。

-- 「闻过香」限定到苏合那件香 —— 名字说的是香，条件就只认香。
-- 原先是「任意一笔付过款的订单」，买御守、买说明书都会触发。
UPDATE badge SET rule_dsl = jsonb_build_object(
    'type', 'count', 'action', 'order.paid',
    'product', 'prod-suhe-incense', 'threshold', 1)
 WHERE id = 'b_buy';

-- 到过场:先下架。0/6 变 0/5，说的是实话。
UPDATE badge SET status = 'inactive' WHERE id = 'b_act';
