-- 后台按时间倒序翻页的那几张表，补索引（2026-09-03）
--
-- 后台十九页里有一半是「新的在最上面」，SQL 一律是
-- `ORDER BY created_at DESC OFFSET … LIMIT …`。而这四张表的
-- created_at 上没有索引 —— 每翻一页都是全表扫 + 排序。
--
-- 实测 outbox_event（33,723 行）：
--   Seq Scan → Sort Method: external merge  Disk: 12176kB
-- 三万条就要落盘排 12MB。今天 20ms 还看不出来，
-- 而这几张表只会往上长：事件是每一笔业务动作一条，
-- 订阅与运单跟着订单走。等它慢到有人察觉的时候，
-- 慢的是【后台每一页】，而不是某一个查询。
--
-- 【为什么现在补而不是等它慢】：加索引这件事在几万行时是一秒钟，
-- 在几千万行时要停机。而「什么时候会慢」这个判断没人做得准 ——
-- 那正是应该让库自己扛住的东西。
--
-- 复合索引把 region 放前面：这几张表的列表查询几乎都带区域过滤
-- （`normalize_region_scoped` 之后每一条都带），region 等值 +
-- created_at 排序，一个索引同时管掉过滤与排序。
CREATE INDEX IF NOT EXISTS idx_outbox_region_time
    ON outbox_event (region, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_region_time
    ON refund (region, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_region_time
    ON shipment (region, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_region_time
    ON subscription (region, created_at DESC);

-- 审计表按时间倒着读是它唯一的读法（见 webadmin/src/pages/Audit.tsx）
CREATE INDEX IF NOT EXISTS idx_audit_time
    ON audit_log (created_at DESC);

-- payment 也是（2026-09-03 门禁第一次跑抓到的 —— 我上面漏了它）。
-- 它已经有 idx_payment_user 与 idx_payment_status，但后台支付页
-- 按区 + 时间倒序翻，两个都用不上。
CREATE INDEX IF NOT EXISTS idx_payment_region_time
    ON payment (region, created_at DESC);

-- recon_record 不在这一批里：它没有 created_at，
-- 后台读它是「某一批里的所有差异」（`WHERE batch_id=$1 ORDER BY
-- match_state, channel_txn_id`）。那条查法要的是 batch_id 上的索引。
CREATE INDEX IF NOT EXISTS idx_recon_record_batch
    ON recon_record (batch_id, match_state);
