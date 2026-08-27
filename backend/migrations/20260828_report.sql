-- 买了报告，得看得到（设计册 M2「八字深度报告 ¥199 · 已完成 · 看 ›」）。
--
-- 在这之前，`fulfillment_kind='async_compute'` 的行付完钱直接标 done，
-- `fulfillment_ref` 里写一句 `{"mocked": true}` —— 钱收了，客户端连一条
-- 读它的路都没有。**订单显示「已完成」，而买家手上什么都没有。**
--
-- 报告的内容不用现编：`natal_summary.raw_chart` 里已经躺着 mingli 排的
-- 整盘（四柱藏干十神、格局带出处、旬空、强弱五行分数、用神带推理原文、
-- 三宫、大运）。这一册是把那份盘**快照**下来。
--
-- 为什么快照而不是每次去读本命：报告是买断的。买家后来改了生辰、
-- 或者排盘换了版本，已经出的那一册不许跟着变 —— 否则他上周读到的话
-- 今天不算数了，而这种变化没有一处会红。
--
-- `order_line_id` 唯一：履约由 outbox 驱动，**重试是设计内行为**。
-- 没有这条约束，重试一次就多出一册。
CREATE TABLE IF NOT EXISTS report (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    order_line_id TEXT NOT NULL UNIQUE REFERENCES order_line(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL,
    -- ready:盘已快照，能读了
    -- awaiting_natal:买家还没填生辰 —— 这不是异常，是一半的真实情况
    --   （量过：async_compute 的行里，只有 46% 的买家已经有本命）。
    --   所以订单那一屏要能说清「还差你的生辰」，而不是显示「已完成」。
    status        TEXT NOT NULL CHECK (status IN ('awaiting_natal', 'ready')),
    -- 出这一册时用的是哪个本命。生辰后来改了不影响这一册（见上）
    natal_id      TEXT REFERENCES natal(id) ON DELETE SET NULL,
    -- 那一刻的生辰本身，连同盘一起冻住：本命被删了，这一册照样读得出
    natal_snapshot_json JSONB,
    chart_json    JSONB,
    mingli_version TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ready_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_report_user ON report(user_id, created_at DESC);
