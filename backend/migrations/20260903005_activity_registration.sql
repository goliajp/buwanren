-- 报名这条链从建库起就断着（2026-09-03 五路评审 · 架构审计）。
--
-- `activity_registration` 有表、有唯一约束、有 `checked_in_at`，
-- 而整个仓里【没有一行 Rust 读它或写它】，库里零行。
-- 与此同时 `activity.current_count` 被两处读（小程序活动页、后台报名率），
-- 一处写 —— 那一处是 seed.sql 里的字面量 92。
--
-- 也就是说：屏上写着「92/180 已报名」，而报名的人一个都没有，
-- 也没有任何途径能成为其中一个。徽章「到过场」（`activity.checkin`）
-- 挂在一个永远不会发生的动作上。
--
-- 这一支做两件事：
--   1. 把 `current_count` 这一列删掉 —— 一个存着的计数放在它数的那些行旁边，
--      就是两个真相源。改成从 `activity_registration` 现算，
--      屏上那个数从此不可能跟事实对不上（它就是事实本身）。
--   2. 给 status 补 CHECK，并补一条按活动查的索引 —— 报名页与后台名单都按它查。

-- 【重跑一遍也不出事】——测试夹具每次都把整套迁移重装一遍，
-- 所以每一句都得能跑第二次。`ADD CONSTRAINT` 没有 IF NOT EXISTS，
-- 先删再加。
ALTER TABLE activity_registration
  DROP CONSTRAINT IF EXISTS chk_activity_registration_status;
ALTER TABLE activity_registration
  ADD CONSTRAINT chk_activity_registration_status
  CHECK (status IN ('registered', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_activity_registration_activity
  ON activity_registration(activity_id, status);

-- 报名页要按人查「我报了哪些」
CREATE INDEX IF NOT EXISTS idx_activity_registration_user
  ON activity_registration(user_id, status);

ALTER TABLE activity DROP COLUMN IF EXISTS current_count;
