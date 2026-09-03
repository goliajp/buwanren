-- 对账差异结掉时，那一句「怎么查的」要有地方落（2026-09-03）
--
-- `recon_record` 建表时留了 resolved_action / resolved_by_admin_id /
-- resolved_at 三列等人来结，独独没有备注。而 `resolved_action` 只有四个词
-- （渠道错了 / 我们漏记了 / 只是跨日切 / 已知手续费）——
-- 光有词说不清是怎么查出来的，下个月同一类差异再来时，
-- 这条记录帮不上任何忙，等于每次都从头查一遍。
--
-- 允许为空:一千四百多条历史记录还没结过，它们的备注本来就该是空的。
ALTER TABLE recon_record ADD COLUMN IF NOT EXISTS resolved_note TEXT;
