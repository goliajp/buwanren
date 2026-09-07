-- 这一笔有没有去渠道撤过单。
--
-- 【在这之前没有人去撤】。`payment::cancel_in_flight` 把在飞的支付转成
-- `cancelling`，换支付方式时旧那一笔被顶成 `expired` —— 两处都只动我们
-- 自己这一侧，而**渠道那边那一单还开着，用户照样付得出去**。
-- 那笔钱回来时我们收（今天改的），但更该做的是一开始就别让它付得出去。
--
-- 资金台账里那一条写的就是这件事：「真要收干净得做什么：在作废旧那笔之前
-- 先去渠道撤单（close/cancel）」。
ALTER TABLE payment ADD COLUMN IF NOT EXISTS channel_closed_at timestamptz;

COMMENT ON COLUMN payment.channel_closed_at IS
  '去渠道撤过这一单的时刻。NULL = 还没撤（或者不需要撤）。撤单由 payment_sweep 发，失败了下一轮再来';
