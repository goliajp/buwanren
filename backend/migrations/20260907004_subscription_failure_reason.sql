-- 续费失败时，为什么失败 —— 这件事此前一个字都没落库。
--
-- `record_renewal_failure(pool, id, reason)` 收着一个 `reason` 参数，
-- 而函数体里【一次都没用它】：阶梯往前走一格、状态改成 past_due，
-- 原因随着那一行 warn 一起留在日志里。
-- 于是「这期没扣成」在屏上没有下文，后台也答不出「为什么」。
--
-- 两列分开是有据的：
--   code   给屏用。它是一小撮我们认识的值，页面照它说人话
--          （原文直接上屏 = 把内部报错泄给用户，check-error-leak 盯着这条）
--   reason 给后台与排查用。原文，可能很长、可能是渠道那边的话
ALTER TABLE subscription
  ADD COLUMN IF NOT EXISTS last_failure_code   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_failure_reason text NOT NULL DEFAULT '';

COMMENT ON COLUMN subscription.last_failure_code IS
  '上一次续费没成的原因码：need_yongshen（还不知道他缺什么）/ charge_failed（钱没扣成）。续成一次就清空';
COMMENT ON COLUMN subscription.last_failure_reason IS
  '上一次续费没成的原文，给后台看。不上屏';
