-- unmei commerce v2 · 2026-06 月度 mock 填充
-- 每天每 region 1 单 paid,30 天 × 6 region = 180 单 order + 180 success payment
-- 时间戳用 NOW() + ((d-28) || ' days')::INTERVAL 相对今天 → 跟着 NOW() 走,
-- 避免 sqlx UTC session vs server Asia/Shanghai 的"today"判定漂移
--
-- d=0 → 06-01(28 天前)· d=28 → 06-29(今天)· d=29 → 06-30(明天)
-- 三档金额按 d%3 切档,跨币种 region 看 dashboard 有 variance
-- ID 命名: ord-jun-{region}-d{NN} / pay-jun-{region}-d{NN}
-- 与现有 28 单(cn-ord-NNN / kr-ord-NNN / ord-renew-* 等)不冲突

BEGIN;

-- ========== 30 × 6 = 180 单 order_record (status=paid) ==========
INSERT INTO order_record (
  id, user_id, channel_origin, currency,
  amount_subtotal_minor, amount_discount_minor, amount_shipping_minor, amount_tax_minor,
  amount_total_minor, amount_paid_minor, amount_refunded_minor,
  status, source_kind,
  expires_at, paid_at,
  region, audit_note, created_at, updated_at
)
SELECT
  'ord-jun-' || c.region || '-d' || lpad(d::text, 2, '0'),
  c.user_id,
  'web', c.currency,
  CASE d % 3 WHEN 0 THEN c.amt_low WHEN 1 THEN c.amt_mid ELSE c.amt_high END,  -- subtotal
  0, 0, 0,
  CASE d % 3 WHEN 0 THEN c.amt_low WHEN 1 THEN c.amt_mid ELSE c.amt_high END,  -- total
  CASE d % 3 WHEN 0 THEN c.amt_low WHEN 1 THEN c.amt_mid ELSE c.amt_high END,  -- paid
  0,
  'paid', 'one_shot',
  NOW() + ((d - 28) || ' days')::INTERVAL + INTERVAL '30 minutes',  -- expires_at
  NOW() + ((d - 28) || ' days')::INTERVAL,                           -- paid_at
  c.region, 'jun-2026 mock fill',
  NOW() + ((d - 28) || ' days')::INTERVAL - INTERVAL '5 minutes',    -- created_at
  NOW() + ((d - 28) || ' days')::INTERVAL                            -- updated_at
FROM generate_series(0, 29) d
CROSS JOIN (VALUES
  ('cn',      'mock_user_01',    'CNY',  8800, 18800, 28800),
  ('jp',      'jp-user-01',      'JPY',   980,  1980,  2980),
  ('kr',      'kr-user-01',      'KRW',  9900, 19800, 29800),
  ('sea',     'sea-user-01',     'SGD',   680,   980,  1880),
  ('na',      'na-user-01',      'USD',   590,   990,  1990),
  ('zh_hant', 'zh_hant-user-01', 'TWD',   299,   599,   899)
) AS c(region, user_id, currency, amt_low, amt_mid, amt_high);

-- ========== 180 单 success payment 匹配 ==========
INSERT INTO payment (
  id, order_id, user_id, channel, amount_minor, currency, status,
  channel_txn_id, paid_at, expires_at, audit_note,
  region, created_at, updated_at
)
SELECT
  'pay-jun-' || c.region || '-d' || lpad(d::text, 2, '0'),
  'ord-jun-' || c.region || '-d' || lpad(d::text, 2, '0'),
  c.user_id,
  CASE c.region
    WHEN 'cn'      THEN 'wechat_jsapi'
    WHEN 'jp'      THEN 'stripe_card'
    WHEN 'kr'      THEN 'stripe_card'
    WHEN 'sea'     THEN 'stripe_card'
    WHEN 'na'      THEN 'stripe_card'
    WHEN 'zh_hant' THEN 'stripe_card'
  END,
  CASE d % 3 WHEN 0 THEN c.amt_low WHEN 1 THEN c.amt_mid ELSE c.amt_high END,
  c.currency,
  'success',
  'mock-jun-' || c.region || '-d' || lpad(d::text, 2, '0'),
  NOW() + ((d - 28) || ' days')::INTERVAL,                           -- paid_at
  NOW() + ((d - 28) || ' days')::INTERVAL + INTERVAL '30 minutes',
  'jun-2026 mock fill',
  c.region,
  NOW() + ((d - 28) || ' days')::INTERVAL - INTERVAL '5 minutes',
  NOW() + ((d - 28) || ' days')::INTERVAL
FROM generate_series(0, 29) d
CROSS JOIN (VALUES
  ('cn',      'mock_user_01',    'CNY',  8800, 18800, 28800),
  ('jp',      'jp-user-01',      'JPY',   980,  1980,  2980),
  ('kr',      'kr-user-01',      'KRW',  9900, 19800, 29800),
  ('sea',     'sea-user-01',     'SGD',   680,   980,  1880),
  ('na',      'na-user-01',      'USD',   590,   990,  1990),
  ('zh_hant', 'zh_hant-user-01', 'TWD',   299,   599,   899)
) AS c(region, user_id, currency, amt_low, amt_mid, amt_high);

COMMIT;

-- 校验:每天每 region 1 单 = 30 × 6 = 180
SELECT date(paid_at) d, region, count(*) n
FROM order_record
WHERE id LIKE 'ord-jun-%'
GROUP BY 1, 2 ORDER BY 1, 2;
