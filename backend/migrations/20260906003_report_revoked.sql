-- 说明书多一个终态：`revoked`（退款之后收回）。
--
-- 【钱退了，东西还在】（2026-09-06 三路验证 · 准备花钱的那一路）。
-- `refund::approve` 只动 refund / payment / order_record 三张表加一个事件。
-- 也就是说：客服在后台按下「批」，钱退回去，而**那位村民还住在他村里、
-- 那份说明书还读得到**。协议写的是「数字内容一经交付不支持退款」，
-- 订单屏也照这条把按钮换成了说明 —— 但那条规矩此前只靠
-- 「后台的人不点错」来维持。
--
-- 御守那一头收回不需要新状态：`villager_residency` 删掉那一行就是搬走。
-- 说明书需要，因为它的 CHECK 只认 `awaiting_natal` / `ready` 两档，
-- 而「退过款所以看不了了」跟「还没算」是两件事 ——
-- 合并成一个状态的话，屏上会对一个退过款的人说「还差你的生辰」。
--
-- 不删行：`report.order_line_id` 是唯一键，删了之后同一行再履约会重建一份，
-- 而且对账要看得见这一册存在过。

ALTER TABLE report DROP CONSTRAINT IF EXISTS report_status_check;
ALTER TABLE report ADD CONSTRAINT report_status_check
  CHECK (status IN ('awaiting_natal', 'ready', 'revoked'));
