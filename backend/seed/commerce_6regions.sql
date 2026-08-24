-- unmei commerce v2 · 6 region mock 数据
-- 让 webadmin 切换 region 切到 jp/kr/sea/na/zh_hant 都能看到本币订单 + 支付 + 退款 + outbox

----------------------------------------------------------------------
-- §1 让 5 个 product 在所有 region 可见
----------------------------------------------------------------------
UPDATE product SET available_regions = ARRAY['cn','jp','kr','sea','na','zh_hant']::TEXT[];

-- price_book 也要为 5 个新 region 各加一份(本币)
INSERT INTO price_book(id, sku_id, currency, price_minor, region, platform, status, audit_note) VALUES
  -- 日本 JPY(0 decimals,直接整数)
  ('pb-naji-deep-jp',    'sku-naji-deep',    'JPY', 3500,  'jp', 'all', 'active', '¥3500 JPY'),
  ('pb-hehun-double-jp', 'sku-hehun-double', 'JPY', 4800,  'jp', 'all', 'active', '¥4800 JPY'),
  ('pb-mg-month-jp',     'sku-mg-month',     'JPY', 900,   'jp', 'all', 'active', '月卡 ¥900 JPY'),

  -- 韩国 KRW(0 decimals)
  ('pb-naji-deep-kr',    'sku-naji-deep',    'KRW', 32000, 'kr', 'all', 'active', '₩32000 KRW'),
  ('pb-hehun-double-kr', 'sku-hehun-double', 'KRW', 44000, 'kr', 'all', 'active', '₩44000 KRW'),
  ('pb-mg-month-kr',     'sku-mg-month',     'KRW', 8500,  'kr', 'all', 'active', '월권 ₩8500 KRW'),

  -- 东南亚 SGD(2 decimals)
  ('pb-naji-deep-sea',   'sku-naji-deep',    'SGD', 3300,  'sea', 'all', 'active', 'S$33.00'),
  ('pb-hehun-double-sea','sku-hehun-double', 'SGD', 4500,  'sea', 'all', 'active', 'S$45.00'),
  ('pb-mg-month-sea',    'sku-mg-month',     'SGD', 880,   'sea', 'all', 'active', 'S$8.80'),

  -- 北美 USD(2 decimals)
  ('pb-naji-deep-na',    'sku-naji-deep',    'USD', 2999,  'na', 'all', 'active', '$29.99'),
  ('pb-hehun-double-na', 'sku-hehun-double', 'USD', 3999,  'na', 'all', 'active', '$39.99'),
  ('pb-mg-month-na',     'sku-mg-month',     'USD', 799,   'na', 'all', 'active', '$7.99'),

  -- 中文繁体 TWD(0 decimals)
  ('pb-naji-deep-zht',   'sku-naji-deep',    'TWD', 950,   'zh_hant', 'all', 'active', 'NT$950'),
  ('pb-hehun-double-zht','sku-hehun-double', 'TWD', 1280,  'zh_hant', 'all', 'active', 'NT$1280'),
  ('pb-mg-month-zht',    'sku-mg-month',     'TWD', 250,   'zh_hant', 'all', 'active', 'NT$250')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §2 各 region 用户(2 each)
----------------------------------------------------------------------
INSERT INTO app_user(id, nickname, platform, region, locale, is_active) VALUES
  ('jp-user-01', '田中太郎',   'ios',     'jp',      'ja-JP', TRUE),
  ('jp-user-02', '佐藤花子',   'web',     'jp',      'ja-JP', TRUE),
  ('kr-user-01', '김민준',     'web',     'kr',      'ko-KR', TRUE),
  ('kr-user-02', '박서연',     'android', 'kr',      'ko-KR', TRUE),
  ('sea-user-01','Lim Wei',    'web',     'sea',     'en-US', TRUE),
  ('sea-user-02','Siti Aishah','android', 'sea',     'ms-MY', TRUE),
  ('na-user-01', 'John Doe',   'web',     'na',      'en-US', TRUE),
  ('na-user-02', 'Maria Garcia','ios',    'na',      'en-US', TRUE),
  ('zht-user-01','陳大文',     'web',     'zh_hant', 'zh-TW', TRUE),
  ('zht-user-02','黃志強',     'mini',    'zh_hant', 'zh-HK', TRUE)
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §3 各 region 订单(3 each · 覆盖 paid/done/cancelled)
----------------------------------------------------------------------
-- JP · 3 单
INSERT INTO order_record(id, user_id, channel_origin, currency,
  amount_subtotal_minor, amount_total_minor, amount_paid_minor,
  status, source_kind, region, expires_at, paid_at, fulfilled_at, created_at) VALUES
  ('jp-ord-001', 'jp-user-01', 'ios',     'JPY', 3500, 3500, 3500, 'done',    'one_shot', 'jp',
   NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '6 hours',  NOW() - INTERVAL '5 hours',  NOW() - INTERVAL '6 hours'),
  ('jp-ord-002', 'jp-user-02', 'web',     'JPY', 4800, 4800, 4800, 'paid',    'one_shot', 'jp',
   NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '2 hours',  NULL,                        NOW() - INTERVAL '2 hours'),
  ('jp-ord-003', 'jp-user-01', 'ios',     'JPY', 3500, 3500, 0,    'cancelled','one_shot','jp',
   NOW() - INTERVAL '1 hour',     NULL,                          NULL,                        NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

-- KR · 3 单
INSERT INTO order_record(id, user_id, channel_origin, currency,
  amount_subtotal_minor, amount_total_minor, amount_paid_minor,
  status, source_kind, region, expires_at, paid_at, fulfilled_at, created_at) VALUES
  ('kr-ord-001', 'kr-user-01', 'web',     'KRW', 32000, 32000, 32000, 'done',    'one_shot', 'kr',
   NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '8 hours',  NOW() - INTERVAL '7 hours',  NOW() - INTERVAL '8 hours'),
  ('kr-ord-002', 'kr-user-02', 'android', 'KRW', 8500,  8500,  8500,  'done',    'subscription_initial', 'kr',
   NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '4 hours',  NOW() - INTERVAL '4 hours',  NOW() - INTERVAL '4 hours'),
  ('kr-ord-003', 'kr-user-01', 'web',     'KRW', 44000, 44000, 0,     'unpaid',  'one_shot', 'kr',
   NOW() + INTERVAL '25 minutes', NULL,                          NULL,                        NOW() - INTERVAL '3 minutes')
ON CONFLICT (id) DO NOTHING;

-- SEA · 3 单
INSERT INTO order_record(id, user_id, channel_origin, currency,
  amount_subtotal_minor, amount_total_minor, amount_paid_minor,
  status, source_kind, region, expires_at, paid_at, fulfilled_at, created_at) VALUES
  ('sea-ord-001','sea-user-01','web',     'SGD', 3300, 3300, 3300, 'done',    'one_shot', 'sea',
   NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '10 hours', NOW() - INTERVAL '9 hours',  NOW() - INTERVAL '10 hours'),
  ('sea-ord-002','sea-user-02','android', 'SGD', 4500, 4500, 4500, 'fulfilling','one_shot','sea',
   NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '1 hour',   NULL,                        NOW() - INTERVAL '1 hour'),
  ('sea-ord-003','sea-user-01','web',     'SGD', 880,  880,  880,  'done',    'subscription_initial', 'sea',
   NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '5 days',   NOW() - INTERVAL '5 days',   NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- NA · 3 单
INSERT INTO order_record(id, user_id, channel_origin, currency,
  amount_subtotal_minor, amount_total_minor, amount_paid_minor, amount_refunded_minor,
  status, source_kind, region, expires_at, paid_at, fulfilled_at, created_at) VALUES
  ('na-ord-001', 'na-user-01', 'web',     'USD', 2999, 2999, 2999, 0,    'done',    'one_shot', 'na',
   NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '11 hours', NOW() - INTERVAL '12 hours'),
  ('na-ord-002', 'na-user-02', 'ios',     'USD', 3999, 3999, 3999, 3999, 'refunded','one_shot', 'na',
   NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '3 days',   NOW() - INTERVAL '3 days',   NOW() - INTERVAL '3 days'),
  ('na-ord-003', 'na-user-01', 'web',     'USD', 799,  799,  0,    0,    'unpaid',  'subscription_initial', 'na',
   NOW() + INTERVAL '20 minutes', NULL,                          NULL,                        NOW() - INTERVAL '8 minutes')
ON CONFLICT (id) DO NOTHING;

-- ZH_HANT · 3 单
INSERT INTO order_record(id, user_id, channel_origin, currency,
  amount_subtotal_minor, amount_total_minor, amount_paid_minor,
  status, source_kind, region, expires_at, paid_at, fulfilled_at, created_at) VALUES
  ('zht-ord-001','zht-user-01','web',     'TWD', 950,  950,  950,  'done',    'one_shot', 'zh_hant',
   NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '14 hours', NOW() - INTERVAL '13 hours', NOW() - INTERVAL '14 hours'),
  ('zht-ord-002','zht-user-02','mini',    'TWD', 1280, 1280, 1280, 'paid',    'one_shot', 'zh_hant',
   NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '3 hours',  NULL,                        NOW() - INTERVAL '3 hours'),
  ('zht-ord-003','zht-user-01','web',     'TWD', 250,  250,  250,  'done',    'subscription_initial', 'zh_hant',
   NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '6 days',   NOW() - INTERVAL '6 days',   NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §4 各 region 支付流水(覆盖订单)
----------------------------------------------------------------------
INSERT INTO payment(id, order_id, user_id, channel, amount_minor, currency, status,
  channel_txn_id, channel_user_ref, paid_at, expires_at, region, created_at) VALUES
  -- JP
  ('jp-pay-001', 'jp-ord-001', 'jp-user-01', 'iap',         3500, 'JPY', 'success', '1000000_JP_IAP_001', 'jp_apple_001',
   NOW() - INTERVAL '6 hours',  NOW() - INTERVAL '5 hours 30 minutes', 'jp', NOW() - INTERVAL '6 hours'),
  ('jp-pay-002', 'jp-ord-002', 'jp-user-02', 'line_pay',    4800, 'JPY', 'success', 'LP_JP_2026062801_TXN', 'line_jp_user02',
   NOW() - INTERVAL '2 hours',  NOW() - INTERVAL '1 hour 30 minutes', 'jp', NOW() - INTERVAL '2 hours'),
  ('jp-pay-003', 'jp-ord-003', 'jp-user-01', 'paypay',      3500, 'JPY', 'expired', NULL, 'paypay_jp_user01',
   NULL, NOW() - INTERVAL '1 hour 30 minutes', 'jp', NOW() - INTERVAL '2 hours'),
  -- KR
  ('kr-pay-001', 'kr-ord-001', 'kr-user-01', 'toss',        32000, 'KRW', 'success', 'TOSS_KR_2026062801_TX', 'toss_kr_user01',
   NOW() - INTERVAL '8 hours',  NOW() - INTERVAL '7 hours 30 minutes', 'kr', NOW() - INTERVAL '8 hours'),
  ('kr-pay-002', 'kr-ord-002', 'kr-user-02', 'kakaopay',    8500,  'KRW', 'success', 'KAKAO_KR_2026062801_TX', 'kakao_kr_user02',
   NOW() - INTERVAL '4 hours',  NOW() - INTERVAL '3 hours 30 minutes', 'kr', NOW() - INTERVAL '4 hours'),
  ('kr-pay-003', 'kr-ord-003', 'kr-user-01', 'naverpay',    44000, 'KRW', 'pending', NULL, 'naver_kr_user01',
   NULL, NOW() + INTERVAL '25 minutes', 'kr', NOW() - INTERVAL '3 minutes'),
  -- SEA
  ('sea-pay-001','sea-ord-001','sea-user-01','grabpay',     3300, 'SGD', 'success', 'GRAB_SEA_2026062801_TX', 'grab_sea_user01',
   NOW() - INTERVAL '10 hours', NOW() - INTERVAL '9 hours 30 minutes', 'sea', NOW() - INTERVAL '10 hours'),
  ('sea-pay-002','sea-ord-002','sea-user-02','stripe_card', 4500, 'SGD', 'success', 'pi_3PfHm_SEA_002_XX', 'cus_SEA_user02',
   NOW() - INTERVAL '1 hour',   NOW() - INTERVAL '30 minutes',         'sea', NOW() - INTERVAL '1 hour'),
  ('sea-pay-003','sea-ord-003','sea-user-01','shopeepay',   880,  'SGD', 'success', 'SHOPEE_SEA_2026062801_TX', 'shopee_sea_user01',
   NOW() - INTERVAL '5 days',   NOW() - INTERVAL '5 days' + INTERVAL '30 minutes', 'sea', NOW() - INTERVAL '5 days'),
  -- NA
  ('na-pay-001', 'na-ord-001', 'na-user-01', 'stripe_card', 2999, 'USD', 'success',  'pi_3PfHm_NA_001_XYZ', 'cus_NA_user01',
   NOW() - INTERVAL '12 hours', NOW() - INTERVAL '11 hours 30 minutes', 'na', NOW() - INTERVAL '12 hours'),
  ('na-pay-002', 'na-ord-002', 'na-user-02', 'iap',         3999, 'USD', 'refunded', '1000000_NA_IAP_002',  'na_apple_user02',
   NOW() - INTERVAL '3 days',   NOW() - INTERVAL '3 days' + INTERVAL '30 minutes', 'na', NOW() - INTERVAL '3 days'),
  ('na-pay-003', 'na-ord-003', 'na-user-01', 'stripe_card', 799,  'USD', 'pending',  NULL, 'cus_NA_user01',
   NULL, NOW() + INTERVAL '20 minutes', 'na', NOW() - INTERVAL '8 minutes'),
  -- ZH_HANT
  ('zht-pay-001','zht-ord-001','zht-user-01','line_pay',    950,  'TWD', 'success', 'LP_TW_2026062801_TX',  'line_tw_user01',
   NOW() - INTERVAL '14 hours', NOW() - INTERVAL '13 hours 30 minutes', 'zh_hant', NOW() - INTERVAL '14 hours'),
  ('zht-pay-002','zht-ord-002','zht-user-02','stripe_card', 1280, 'TWD', 'success', 'pi_3PfHm_TW_002_TX',   'cus_TW_user02',
   NOW() - INTERVAL '3 hours',  NOW() - INTERVAL '2 hours 30 minutes',  'zh_hant', NOW() - INTERVAL '3 hours'),
  ('zht-pay-003','zht-ord-003','zht-user-01','line_pay',    250,  'TWD', 'success', 'LP_TW_2026062202_TX',  'line_tw_user01',
   NOW() - INTERVAL '6 days',   NOW() - INTERVAL '6 days' + INTERVAL '30 minutes', 'zh_hant', NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §5 各 region 一些退款(只 na 有完整 1 全额退款,其它 region 加 1 个 requested)
----------------------------------------------------------------------
INSERT INTO refund(id, order_id, payment_id, amount_minor, currency, reason_code, reason_text,
  actor_kind, actor_id, status, region, created_at) VALUES
  ('na-rfd-001', 'na-ord-002', 'na-pay-002', 3999, 'USD', 'quality_issue', 'Report did not match expectation, refunded via Apple',
   'admin', 'admin_root', 'success', 'na', NOW() - INTERVAL '2 days'),
  ('jp-rfd-001', 'jp-ord-002', 'jp-pay-002', 2400, 'JPY', 'user_request', '部分退款請求 · 50% 既已使用',
   'user', 'jp-user-02', 'requested', 'jp', NOW() - INTERVAL '30 minutes'),
  ('kr-rfd-001', 'kr-ord-001', 'kr-pay-001', 32000, 'KRW', 'user_request', '서비스 문제 · 환불 요청',
   'user', 'kr-user-01', 'approved', 'kr', NOW() - INTERVAL '2 hours'),
  ('zht-rfd-001','zht-ord-001','zht-pay-001',950,  'TWD', 'duplicate', '重複付款 · 已退款',
   'admin', 'admin_root', 'success', 'zh_hant', NOW() - INTERVAL '12 hours')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §6 各 region 一些 outbox 事件(让事件驾驶舱切换 region 都有数据)
----------------------------------------------------------------------
INSERT INTO outbox_event(id, kind, aggregate_kind, aggregate_id, payload_json, status,
  attempt_count, next_attempt_at, created_at, region) VALUES

  ('jp-oe-001', 'OrderPaid', 'order', 'jp-ord-001',
   '{"kind":"OrderPaid","payload":{"order_id":"jp-ord-001","payment_id":"jp-pay-001","occurred_at":"2026-06-28T03:00:00Z"}}'::jsonb,
   'dispatched', 1, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours', 'jp'),

  ('jp-oe-002', 'OrderFulfilled', 'order', 'jp-ord-001',
   '{"kind":"OrderFulfilled","payload":{"order_id":"jp-ord-001","occurred_at":"2026-06-28T04:00:00Z"}}'::jsonb,
   'dispatched', 1, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours', 'jp'),

  ('kr-oe-001', 'OrderPaid', 'order', 'kr-ord-001',
   '{"kind":"OrderPaid","payload":{"order_id":"kr-ord-001","payment_id":"kr-pay-001","occurred_at":"2026-06-28T01:00:00Z"}}'::jsonb,
   'dispatched', 1, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '8 hours', 'kr'),

  ('kr-oe-002', 'RefundInitiated', 'refund', 'kr-rfd-001',
   '{"kind":"RefundInitiated","payload":{"refund_id":"kr-rfd-001","payment_id":"kr-pay-001","amount_minor":32000,"occurred_at":"2026-06-28T07:00:00Z"}}'::jsonb,
   'dispatched', 1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', 'kr'),

  ('sea-oe-001','SubscriptionStarted','subscription','sub-sea-001',
   '{"kind":"SubscriptionStarted","payload":{"subscription_id":"sub-sea-001","plan_id":"plan-mg-month","period_end":"2026-07-23T00:00:00Z","occurred_at":"2026-06-23T00:00:00Z"}}'::jsonb,
   'dispatched', 1, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', 'sea'),

  ('na-oe-001', 'RefundCompleted', 'refund', 'na-rfd-001',
   '{"kind":"RefundCompleted","payload":{"refund_id":"na-rfd-001","occurred_at":"2026-06-26T09:00:00Z"}}'::jsonb,
   'dispatched', 1, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'na'),

  ('zht-oe-001','OrderFulfilled','order','zht-ord-001',
   '{"kind":"OrderFulfilled","payload":{"order_id":"zht-ord-001","occurred_at":"2026-06-27T13:00:00Z"}}'::jsonb,
   'dispatched', 1, NOW() - INTERVAL '13 hours', NOW() - INTERVAL '13 hours', 'zh_hant')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §7 各 region 一个订阅(覆盖 5 个新 region)
----------------------------------------------------------------------
INSERT INTO subscription(id, user_id, plan_id, status, source_channel,
  current_period_start, current_period_end, next_billing_attempt_at, region, created_at) VALUES
  ('jp-sub-01', 'jp-user-02', 'plan-mg-month', 'active', 'iap',
   NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', NOW() + INTERVAL '15 days', 'jp', NOW() - INTERVAL '15 days'),
  ('kr-sub-01', 'kr-user-02', 'plan-mg-month', 'active', 'kakaopay',
   NOW() - INTERVAL '4 hours', NOW() + INTERVAL '30 days', NOW() + INTERVAL '30 days', 'kr', NOW() - INTERVAL '4 hours'),
  ('sea-sub-01','sea-user-01','plan-mg-month','active', 'stripe_card',
   NOW() - INTERVAL '5 days',  NOW() + INTERVAL '25 days', NOW() + INTERVAL '25 days', 'sea', NOW() - INTERVAL '5 days'),
  ('na-sub-01', 'na-user-01', 'plan-mg-month', 'past_due', 'stripe_card',
   NOW() - INTERVAL '40 days', NOW() - INTERVAL '10 days', NOW() + INTERVAL '1 day',   'na', NOW() - INTERVAL '40 days'),
  ('zht-sub-01','zht-user-01','plan-mg-month','active', 'line_pay',
   NOW() - INTERVAL '6 days',  NOW() + INTERVAL '24 days', NOW() + INTERVAL '24 days', 'zh_hant', NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- 验证
----------------------------------------------------------------------
SELECT region, COUNT(*) AS orders FROM order_record GROUP BY region ORDER BY region;
SELECT region, COUNT(*) AS payments FROM payment GROUP BY region ORDER BY region;
SELECT region, COUNT(*) AS subs FROM subscription GROUP BY region ORDER BY region;
SELECT region, COUNT(*) AS outbox FROM outbox_event GROUP BY region ORDER BY region;
