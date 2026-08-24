-- 幂等键与金额上限(台账 D6)
--
-- 起因是一个实测复现的资金漏洞:同一张订单连按两次「支付」,产生两笔各自成功的
-- 支付,订单实付 39800 而应付 19900。两条路都不走 ——「拒绝并发支付」会让用户
-- 放弃付款后干等 30 分钟,「顶掉旧的」可能把用户正在付的那笔关掉。真正的答案是
-- 客户端带幂等键,同键同参返回首次结果:重复下单与重复支付一次解决。

-- ── 1. idempotency_log 补请求指纹 ────────────────────────────────
-- 「同键同参」的同参靠它判。同一个键配不同的参数是客户端 bug,
-- 这时候把上一次的响应还给它,比报错更糟 —— 它会以为自己那次新请求成功了。
ALTER TABLE idempotency_log ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;

-- 处理中的那一小段窗口要能表示出来:两个并发请求带同一个键,
-- 先到的那个占住键(status=0),后到的拿 409 让它稍后重试,
-- 而不是两个都放进去执行。
COMMENT ON COLUMN idempotency_log.response_status IS
  '首次请求的 HTTP 状态码;0 = 正在处理中(键已被占住,响应还没落)';

-- 过期清理要走索引,否则 24 小时一到全表扫
CREATE INDEX IF NOT EXISTS idx_idempotency_log_expires ON idempotency_log(expires_at);

-- ── 2. 订单实付不得超过应付 ──────────────────────────────────────
-- NOT VALID 是有意的:开发库里已经有两行违反它(2026-08-16 复现那个漏洞时留下的,
-- 各超收 19900),生产库也可能有同类行。NOT VALID 只放过【已有行】,
-- 之后所有 INSERT / UPDATE 一律受检 —— 既立刻止住新的超收,
-- 又不把历史证据静默改写掉。那些行代表真金白银,该由人去对、去退,不该由迁移抹平。
--
-- 数据清干净之后再:
--   ALTER TABLE order_record VALIDATE CONSTRAINT order_paid_not_over_total;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_paid_not_over_total'
  ) THEN
    ALTER TABLE order_record
      ADD CONSTRAINT order_paid_not_over_total
      CHECK (amount_paid_minor <= amount_total_minor) NOT VALID;
  END IF;
END $$;
