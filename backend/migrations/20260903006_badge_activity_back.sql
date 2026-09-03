-- 「到过场」回到在架（2026-09-03 五路评审 · 架构审计）。
--
-- 它 2026-09-01 被下架（20260901009），理由写在那支迁移里：
-- 「一枚拿不到的徽章、配一条通向名册的假路，不如不摆。
--   有活动入口那天把 status 改回 active 就行。」
--
-- 今天就是那一天：报名这条链整条接上了 ——
-- 用户侧有活动页（pages/activity）能报名退订，后台有名单与签到，
-- `unmei-app::activity::check_in` 里发的正是 `activity.checkin` 那一枚。
-- 门禁 check-badges-earnable 现在也认得这一支，所以它不再是空承诺。

UPDATE badge SET status = 'active' WHERE id = 'b_act';
