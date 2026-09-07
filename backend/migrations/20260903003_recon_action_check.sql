-- 对账差异的四种结法，库里也要认（2026-09-03）
--
-- `resolved_action` 加进来的时候只是一列 TEXT。四个值
-- （channel_wrong / ours_missing / timing_only / known_fee）
-- 在 Rust 那侧是枚举，在库这侧什么都不是 —— 一条 UPDATE 写进
-- 「看过了」也会成功，而这一列存在的全部意义正是「说清是哪一种」。
--
-- `match_state` 那一列一直有 CHECK，这一列漏了。
-- 「枚举跟库里的 CHECK 对得上吗」那支门禁点名了它。
--
-- 写法跟这个库里其它 CHECK 对齐：`列 = ANY (ARRAY[...])` 打头。
-- 【不写成 `IS NULL OR 列 = ANY(...)`】—— NULL 在 SQL 里本来就
-- 让 CHECK 判成 unknown 而放行，加那一句是多余的；
-- 而多出来的前缀会让那支门禁的正则匹配不上，于是它读不到这条约束，
-- 报「库里没有这条 CHECK」。约束真在库里、门禁说没有 ——
-- 又一种「失效长得跟数据一样」。
ALTER TABLE recon_record DROP CONSTRAINT IF EXISTS recon_record_resolved_action_check;
ALTER TABLE recon_record ADD CONSTRAINT recon_record_resolved_action_check
  CHECK (resolved_action = ANY (ARRAY[
    'channel_wrong'::text, 'ours_missing'::text, 'timing_only'::text, 'known_fee'::text
  ]));
