-- unmei commerce v2 · 5 个新 region 的营销/风控/财务/对账数据补全
-- 让 webadmin 切到 jp/kr/sea/na/zh_hant 任何工作台都有内容

----------------------------------------------------------------------
-- §1 各 region 本地化促销
----------------------------------------------------------------------
INSERT INTO promotion(id, code, name, kind, match_json, rule_json, benefit_json,
  effective_from, effective_to, budget_minor, used_minor,
  per_user_cap, total_cap, daily_cap, stackable, priority, status, region, audit_note) VALUES

  ('jp-promo-tanabata', 'TANABATA', '七夕祭 · 月卡 20% OFF',
   'pct_off', '{"sku_kinds":["subscription"]}'::jsonb,
   '{"min_amount":900}'::jsonb,
   '{"pct_off_bps":2000}'::jsonb,
   '2026-07-01T00:00:00Z', '2026-07-15T23:59:59Z',
   500000, 18000, 1, NULL, 100, FALSE, 80, 'scheduled', 'jp', '七夕限定'),

  ('kr-promo-chuseok', 'CHUSEOK', '추석 명절 · 全场 ₩5000 OFF',
   'amount_off', '{}'::jsonb,
   '{"min_amount":30000}'::jsonb,
   '{"amount_off_minor":5000}'::jsonb,
   '2026-09-15T00:00:00Z', '2026-09-30T23:59:59Z',
   2000000, 0, 1, NULL, 500, FALSE, 90, 'scheduled', 'kr', '추석 행사'),

  ('sea-promo-hari', 'HARI', 'Hari Raya · 35% OFF subscription',
   'pct_off', '{"sku_kinds":["subscription"]}'::jsonb,
   '{"min_amount":500}'::jsonb,
   '{"pct_off_bps":3500}'::jsonb,
   '2026-06-01T00:00:00Z', '2026-07-31T23:59:59Z',
   15000, 2400, 1, NULL, 200, FALSE, 85, 'active', 'sea', 'Multi-country campaign'),

  ('na-promo-summer', 'SUMMER_SALE', 'Summer Sale · $5 OFF first order',
   'amount_off', '{"user_tier":"new"}'::jsonb,
   '{"min_amount":1999}'::jsonb,
   '{"amount_off_minor":500}'::jsonb,
   '2026-06-01T00:00:00Z', '2026-08-31T23:59:59Z',
   50000, 1500, 1, 100, NULL, FALSE, 90, 'active', 'na', 'NA summer campaign'),

  ('zht-promo-mid', 'MID_AUTUMN', '中秋特惠 · 報告買一送一',
   'bxgy', '{"sku_kinds":["one_shot"]}'::jsonb,
   '{"buy_qty":2}'::jsonb,
   '{"second_pct_off_bps":10000}'::jsonb,
   '2026-09-10T00:00:00Z', '2026-09-30T23:59:59Z',
   NULL, 0, 1, 100, NULL, FALSE, 88, 'scheduled', 'zh_hant', '中秋活動')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §2 各 region 优惠券
----------------------------------------------------------------------
INSERT INTO coupon(id, code, batch_id, promotion_id, owner_user_id, benefit_json,
  state, issued_at, redeemed_at, expires_at, region, audit_note) VALUES

  -- JP
  ('jp-cp-001', 'TANABATA-JP-001', 'jp-batch-q3', 'jp-promo-tanabata', 'jp-user-01',
   '{"pct_off_bps":2000}'::jsonb, 'issued',
   NOW() - INTERVAL '1 day', NULL, NOW() + INTERVAL '15 days', 'jp', ''),
  ('jp-cp-002', 'TANABATA-JP-002', 'jp-batch-q3', 'jp-promo-tanabata', 'jp-user-02',
   '{"pct_off_bps":2000}'::jsonb, 'redeemed',
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '15 days', 'jp', ''),

  -- KR
  ('kr-cp-001', 'CHUSEOK-KR-001', 'kr-batch-q3', 'kr-promo-chuseok', 'kr-user-01',
   '{"amount_off_minor":5000}'::jsonb, 'issued',
   NOW() - INTERVAL '2 days', NULL, NOW() + INTERVAL '90 days', 'kr', ''),
  ('kr-cp-002', 'CHUSEOK-KR-002', 'kr-batch-q3', 'kr-promo-chuseok', NULL,
   '{"amount_off_minor":5000}'::jsonb, 'issued',
   NOW() - INTERVAL '2 days', NULL, NOW() + INTERVAL '90 days', 'kr', '待领取'),

  -- SEA
  ('sea-cp-001', 'HARI-SEA-001', 'sea-batch-hari', 'sea-promo-hari', 'sea-user-01',
   '{"pct_off_bps":3500}'::jsonb, 'redeemed',
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '10 minutes', NOW() + INTERVAL '30 days', 'sea', ''),
  ('sea-cp-002', 'HARI-SEA-002', 'sea-batch-hari', 'sea-promo-hari', NULL,
   '{"pct_off_bps":3500}'::jsonb, 'issued',
   NOW() - INTERVAL '5 days', NULL, NOW() + INTERVAL '30 days', 'sea', ''),
  ('sea-cp-003', 'HARI-SEA-003', 'sea-batch-hari', 'sea-promo-hari', NULL,
   '{"pct_off_bps":3500}'::jsonb, 'expired',
   NOW() - INTERVAL '60 days', NULL, NOW() - INTERVAL '5 days', 'sea', '过期'),

  -- NA
  ('na-cp-001', 'SUMMER-NA-001', 'na-batch-summer', 'na-promo-summer', 'na-user-01',
   '{"amount_off_minor":500}'::jsonb, 'issued',
   NOW() - INTERVAL '4 days', NULL, NOW() + INTERVAL '60 days', 'na', ''),
  ('na-cp-002', 'SUMMER-NA-002', 'na-batch-summer', 'na-promo-summer', 'na-user-02',
   '{"amount_off_minor":500}'::jsonb, 'locked',
   NOW() - INTERVAL '4 days', NULL, NOW() + INTERVAL '60 days', 'na', '锁定在某订单'),
  ('na-cp-003', 'SUMMER-NA-003', 'na-batch-summer', 'na-promo-summer', NULL,
   '{"amount_off_minor":500}'::jsonb, 'issued',
   NOW() - INTERVAL '4 days', NULL, NOW() + INTERVAL '60 days', 'na', '待领取'),

  -- ZH_HANT
  ('zht-cp-001', 'MIDAUT-TW-001', 'zht-batch-midaut', 'zht-promo-mid', 'zht-user-01',
   '{"second_pct_off_bps":10000}'::jsonb, 'issued',
   NOW() - INTERVAL '2 days', NULL, NOW() + INTERVAL '85 days', 'zh_hant', ''),
  ('zht-cp-002', 'MIDAUT-TW-002', 'zht-batch-midaut', 'zht-promo-mid', 'zht-user-02',
   '{"second_pct_off_bps":10000}'::jsonb, 'issued',
   NOW() - INTERVAL '2 days', NULL, NOW() + INTERVAL '85 days', 'zh_hant', '')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §3 各 region 本地化 risk_rule
----------------------------------------------------------------------
INSERT INTO risk_rule(id, name, kind, expression, action, priority, status, region, audit_note) VALUES
  ('jp-rule-velocity',   '速率限制 · 1h>5次',    'pre_pay', 'count_in_window(payment, user_id, 1h) > 5',         'challenge', 100, 'active', 'jp',      ''),
  ('jp-rule-large',      '大额订单审查',         'pre_pay', 'amount > 50000 AND user.age_days < 7',                'review',    150, 'active', 'jp',      ''),
  ('kr-rule-velocity',   '속도 제한',            'pre_pay', 'count_in_window(payment, user_id, 1h) > 5',         'challenge', 100, 'active', 'kr',      ''),
  ('sea-rule-stripe-3ds','3DS 強認證',           'pre_pay', 'amount > 100000 AND channel = ''stripe_card''',      'challenge', 120, 'active', 'sea',     ''),
  ('na-rule-aml',        'AML threshold (5K USD)','pre_pay', 'amount > 500000',                                     'review',    200, 'active', 'na',      ''),
  ('na-rule-velocity',   'Velocity ratelimit',   'pre_pay', 'count_in_window(payment, user_id, 1h) > 5',         'challenge', 100, 'active', 'na',      ''),
  ('zht-rule-large',     '大額交易審查',         'pre_pay', 'amount > 30000',                                      'review',    150, 'active', 'zh_hant', '')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §4 各 region 风控事件
----------------------------------------------------------------------
INSERT INTO risk_event(id, kind, user_id, order_id, payment_id, matched_rule_ids,
  decided_action, details_json, decided_at, region) VALUES
  ('jp-re-01', 'pre_pay', 'jp-user-01', 'jp-ord-001', 'jp-pay-001', ARRAY['jp-rule-large']::TEXT[],
   'review',    '{"amount":3500,"reason":"new_user_first_purchase"}'::jsonb,
   NOW() - INTERVAL '6 hours', 'jp'),
  ('jp-re-02', 'pre_pay', 'jp-user-02', NULL, NULL, ARRAY['jp-rule-velocity']::TEXT[],
   'log_only',  '{"reason":"velocity_within_threshold"}'::jsonb,
   NOW() - INTERVAL '3 hours', 'jp'),

  ('kr-re-01', 'pre_pay', 'kr-user-01', 'kr-ord-001', 'kr-pay-001', ARRAY['kr-rule-velocity']::TEXT[],
   'challenge', '{"reason":"6 attempts in 1h"}'::jsonb,
   NOW() - INTERVAL '8 hours', 'kr'),
  ('kr-re-02', 'login',   'kr-user-02', NULL, NULL, ARRAY[]::TEXT[],
   'allow',     '{}'::jsonb,
   NOW() - INTERVAL '1 hour', 'kr'),

  ('sea-re-01', 'pre_pay', 'sea-user-01', 'sea-ord-001', 'sea-pay-001', ARRAY['sea-rule-stripe-3ds']::TEXT[],
   'challenge', '{"reason":"3DS required by Stripe"}'::jsonb,
   NOW() - INTERVAL '10 hours', 'sea'),

  ('na-re-01', 'pre_pay', 'na-user-02', 'na-ord-002', 'na-pay-002', ARRAY['na-rule-aml']::TEXT[],
   'review',    '{"amount":3999,"jurisdiction":"US"}'::jsonb,
   NOW() - INTERVAL '3 days', 'na'),
  ('na-re-02', 'pre_pay', 'na-user-01', NULL, NULL, ARRAY['na-rule-velocity']::TEXT[],
   'log_only',  '{"reason":"normal velocity"}'::jsonb,
   NOW() - INTERVAL '5 hours', 'na'),

  ('zht-re-01', 'pre_pay', 'zht-user-01', 'zht-ord-001', 'zht-pay-001', ARRAY['zht-rule-large']::TEXT[],
   'review',    '{"amount":950,"reason":"first_order_check"}'::jsonb,
   NOW() - INTERVAL '14 hours', 'zh_hant')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §5 各 region 风控案件
----------------------------------------------------------------------
INSERT INTO risk_case(id, kind, severity, involved_user_ids, involved_order_ids,
  state, assigned_admin_id, opened_at, closed_at, region, audit_note) VALUES
  ('jp-rc-01', 'pre_pay',  'high',     ARRAY['jp-user-01']::TEXT[],  ARRAY['jp-ord-001']::TEXT[],
   'investigating', 'admin_root', NOW() - INTERVAL '5 hours', NULL,
   'jp', '新規ユーザーの初回大額注文 · 確認中'),

  ('kr-rc-01', 'refund',   'med',      ARRAY['kr-user-01']::TEXT[],  ARRAY['kr-ord-001']::TEXT[],
   'open', NULL, NOW() - INTERVAL '2 hours', NULL,
   'kr', '환불 요청 · 검토 필요'),

  ('sea-rc-01','pre_order','low',      ARRAY['sea-user-02']::TEXT[], ARRAY[]::TEXT[],
   'resolved', 'admin_root', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day',
   'sea', 'False positive · normal pattern'),

  ('na-rc-01', 'refund',   'critical', ARRAY['na-user-02']::TEXT[],  ARRAY['na-ord-002']::TEXT[],
   'open', NULL, NOW() - INTERVAL '6 hours', NULL,
   'na', 'Apple IAP refund · 需联系 Apple 仲裁'),

  ('zht-rc-01','pre_pay',  'med',      ARRAY['zht-user-01']::TEXT[], ARRAY['zht-ord-001']::TEXT[],
   'resolved', 'admin_root', NOW() - INTERVAL '13 hours', NOW() - INTERVAL '12 hours',
   'zh_hant', '首單檢查 · 已通過')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §6 各 region 财务挂账(让 finance 工作台切到任一 region 都有内容)
----------------------------------------------------------------------
INSERT INTO journal_entry(id, period_id, description, posted_at, posted_by_kind,
  business_kind, business_ref_id, status, region) VALUES
  ('jp-je-001',  'period-2026-06', 'JP order paid · LINE Pay revenue ¥4800',
   NOW() - INTERVAL '2 hours', 'system', 'payment', 'jp-pay-002', 'posted', 'jp'),
  ('jp-je-002',  'period-2026-06', 'JP order completed · IAP revenue ¥3500',
   NOW() - INTERVAL '6 hours', 'system', 'payment', 'jp-pay-001', 'posted', 'jp'),

  ('kr-je-001',  'period-2026-06', 'KR order paid · Toss revenue ₩32000',
   NOW() - INTERVAL '8 hours', 'system', 'payment', 'kr-pay-001', 'posted', 'kr'),
  ('kr-je-002',  'period-2026-06', 'KR subscription · KakaoPay ₩8500',
   NOW() - INTERVAL '4 hours', 'system', 'payment', 'kr-pay-002', 'posted', 'kr'),

  ('sea-je-001', 'period-2026-06', 'SEA order paid · GrabPay S$33.00',
   NOW() - INTERVAL '10 hours', 'system', 'payment', 'sea-pay-001', 'posted', 'sea'),
  ('sea-je-002', 'period-2026-06', 'SEA order paid · Stripe S$45.00',
   NOW() - INTERVAL '1 hour', 'system', 'payment', 'sea-pay-002', 'posted', 'sea'),

  ('na-je-001',  'period-2026-06', 'NA order paid · Stripe $29.99',
   NOW() - INTERVAL '12 hours', 'system', 'payment', 'na-pay-001', 'posted', 'na'),
  ('na-je-002',  'period-2026-06', 'NA refund · Apple IAP $39.99 (reverse)',
   NOW() - INTERVAL '2 days', 'system', 'refund', 'na-rfd-001', 'posted', 'na'),

  ('zht-je-001', 'period-2026-06', 'TW order paid · LINE Pay NT$950',
   NOW() - INTERVAL '14 hours', 'system', 'payment', 'zht-pay-001', 'posted', 'zh_hant'),
  ('zht-je-002', 'period-2026-06', 'TW refund · LINE Pay NT$950 (duplicate)',
   NOW() - INTERVAL '12 hours', 'system', 'refund', 'zht-rfd-001', 'posted', 'zh_hant')
ON CONFLICT (id) DO NOTHING;

INSERT INTO journal_line(id, entry_id, line_no, account_code, debit_minor, credit_minor, currency, ref_kind, ref_id, note) VALUES
  -- JP
  ('jp-jl-001-1', 'jp-je-001', 1, '1002', 4800, 0, 'JPY', 'payment', 'jp-pay-002', 'LINE Pay in-transit'),
  ('jp-jl-001-2', 'jp-je-001', 2, '4001', 0, 4800, 'JPY', 'payment', 'jp-pay-002', 'Main revenue'),
  ('jp-jl-002-1', 'jp-je-002', 1, '1002', 3500, 0, 'JPY', 'payment', 'jp-pay-001', 'IAP in-transit'),
  ('jp-jl-002-2', 'jp-je-002', 2, '4001', 0, 3500, 'JPY', 'payment', 'jp-pay-001', 'Main revenue'),
  -- KR
  ('kr-jl-001-1', 'kr-je-001', 1, '1002', 32000, 0, 'KRW', 'payment', 'kr-pay-001', 'Toss in-transit'),
  ('kr-jl-001-2', 'kr-je-001', 2, '4001', 0, 32000, 'KRW', 'payment', 'kr-pay-001', 'Main revenue'),
  ('kr-jl-002-1', 'kr-je-002', 1, '1002', 8500, 0, 'KRW', 'payment', 'kr-pay-002', 'KakaoPay in-transit'),
  ('kr-jl-002-2', 'kr-je-002', 2, '4003', 0, 8500, 'KRW', 'payment', 'kr-pay-002', 'Subscription revenue'),
  -- SEA
  ('sea-jl-001-1','sea-je-001',1, '1002', 3300, 0, 'SGD', 'payment', 'sea-pay-001', 'GrabPay in-transit'),
  ('sea-jl-001-2','sea-je-001',2, '4001', 0, 3300, 'SGD', 'payment', 'sea-pay-001', 'Main revenue'),
  ('sea-jl-002-1','sea-je-002',1, '1002', 4500, 0, 'SGD', 'payment', 'sea-pay-002', 'Stripe in-transit'),
  ('sea-jl-002-2','sea-je-002',2, '4001', 0, 4500, 'SGD', 'payment', 'sea-pay-002', 'Main revenue'),
  -- NA
  ('na-jl-001-1', 'na-je-001', 1, '1002', 2999, 0, 'USD', 'payment', 'na-pay-001', 'Stripe in-transit'),
  ('na-jl-001-2', 'na-je-001', 2, '4001', 0, 2999, 'USD', 'payment', 'na-pay-001', 'Main revenue'),
  ('na-jl-002-1', 'na-je-002', 1, '4001', 3999, 0, 'USD', 'refund', 'na-rfd-001', 'Revenue reversal'),
  ('na-jl-002-2', 'na-je-002', 2, '1001', 0, 3999, 'USD', 'refund', 'na-rfd-001', 'Bank outflow'),
  -- ZH_HANT
  ('zht-jl-001-1','zht-je-001',1, '1002', 950, 0, 'TWD', 'payment', 'zht-pay-001', 'LINE Pay in-transit'),
  ('zht-jl-001-2','zht-je-001',2, '4001', 0, 950, 'TWD', 'payment', 'zht-pay-001', 'Main revenue'),
  ('zht-jl-002-1','zht-je-002',1, '4001', 950, 0, 'TWD', 'refund', 'zht-rfd-001', 'Revenue reversal'),
  ('zht-jl-002-2','zht-je-002',2, '1001', 0, 950, 'TWD', 'refund', 'zht-rfd-001', 'Bank outflow')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §7 各 region 对账批次
----------------------------------------------------------------------
INSERT INTO recon_batch(id, channel, batch_date, source, total_count, total_amount_minor,
  currency, status, pulled_at, matched_at, resolved_at, raw_file_uri, region) VALUES
  ('jp-rb-line-2026-06-27', 'line_pay',  '2026-06-27', 'channel_pulled', 2, 8300,  'JPY',
   'matched',        NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', NULL,
   '/recon/jp/line/2026-06-27.csv', 'jp'),
  ('jp-rb-iap-2026-06-27',  'iap',       '2026-06-27', 'channel_pulled', 1, 3500,  'JPY',
   'matched',        NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', NULL,
   '/recon/jp/iap/2026-06-27.csv', 'jp'),

  ('kr-rb-toss-2026-06-27', 'toss',      '2026-06-27', 'channel_pulled', 1, 32000, 'KRW',
   'matched',        NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', NULL,
   '/recon/kr/toss/2026-06-27.csv', 'kr'),
  ('kr-rb-kakao-2026-06-27','kakaopay',  '2026-06-27', 'channel_pulled', 1, 8500,  'KRW',
   'has_discrepancy',NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', NULL,
   '/recon/kr/kakao/2026-06-27.csv', 'kr'),

  ('sea-rb-grab-2026-06-27','grabpay',   '2026-06-27', 'channel_pulled', 1, 3300, 'SGD',
   'matched',        NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', NULL,
   '/recon/sea/grab/2026-06-27.csv', 'sea'),

  ('na-rb-stripe-2026-06-27','stripe_card','2026-06-27','channel_pulled', 1, 2999, 'USD',
   'matched',        NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', NULL,
   '/recon/na/stripe/2026-06-27.csv', 'na'),

  ('zht-rb-line-2026-06-27','line_pay',  '2026-06-27', 'channel_pulled', 2, 1200, 'TWD',
   'matched',        NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', NULL,
   '/recon/zht/line/2026-06-27.csv', 'zh_hant')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- 验证(每 region 各类数据汇总)
----------------------------------------------------------------------
SELECT
    'promotion'    AS tbl, region, COUNT(*) FROM promotion    GROUP BY region
UNION ALL SELECT 'coupon',     region, COUNT(*) FROM coupon       GROUP BY region
UNION ALL SELECT 'risk_rule',  region, COUNT(*) FROM risk_rule    GROUP BY region
UNION ALL SELECT 'risk_event', region, COUNT(*) FROM risk_event   GROUP BY region
UNION ALL SELECT 'risk_case',  region, COUNT(*) FROM risk_case    GROUP BY region
UNION ALL SELECT 'journal',    region, COUNT(*) FROM journal_entry GROUP BY region
UNION ALL SELECT 'recon_batch',region, COUNT(*) FROM recon_batch  GROUP BY region
ORDER BY tbl, region;
