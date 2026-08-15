-- unmei commerce v2 · demo 数据(让 11 工作台全部有视觉丰富的内容)
-- 幂等:全部 ON CONFLICT DO NOTHING
-- 注意:依赖前置已 apply 的 commerce_v2 migration + commerce_mock seed

----------------------------------------------------------------------
-- §1 多个促销活动(原 NEWUSER20 之外)
----------------------------------------------------------------------
INSERT INTO promotion(id, code, name, kind, match_json, rule_json, benefit_json,
  effective_from, effective_to, budget_minor, used_minor,
  per_user_cap, total_cap, daily_cap, stackable, priority, status, audit_note) VALUES

  ('promo-summer-30off', 'SUMMER30', '夏至感恩 · 全场满 ¥300 减 ¥30',
   'amount_off',
   '{"sku_categories":["report","service"]}'::jsonb,
   '{"min_amount":30000}'::jsonb,
   '{"amount_off_minor":3000}'::jsonb,
   '2026-06-01T00:00:00Z', '2026-08-31T23:59:59Z',
   500000, 87000, 1, NULL, 200, FALSE, 90, 'active', '夏季活动'),

  ('promo-rebirth-bxgy', 'REBIRTH', '夏至重生 · 第二份半价',
   'bxgy',
   '{"sku_kinds":["one_shot"]}'::jsonb,
   '{"buy_qty":2}'::jsonb,
   '{"second_pct_off_bps":5000}'::jsonb,
   '2026-06-22T00:00:00Z', '2026-06-30T23:59:59Z',
   NULL, 19900, NULL, 50, NULL, FALSE, 50, 'paused', '夏至专属'),

  ('promo-jade-bundle', 'JADE_BUNDLE', '玉坠 + 报告 套餐折扣',
   'bundle',
   '{"sku_ids":["sku-naji-deep","sku-jade-pendant"]}'::jsonb,
   '{}'::jsonb,
   '{"bundle_price_minor":49800}'::jsonb,
   '2026-05-01T00:00:00Z', '2026-12-31T23:59:59Z',
   100000, 0, NULL, 20, NULL, FALSE, 80, 'scheduled', '高客单价套餐'),

  ('promo-old-yend', 'OLDPROMO', '春节抢福袋(已结束 demo)',
   'pct_off',
   '{}'::jsonb,
   '{"min_amount":9900}'::jsonb,
   '{"pct_off_bps":1500}'::jsonb,
   '2026-01-22T00:00:00Z', '2026-02-15T23:59:59Z',
   200000, 178400, NULL, NULL, NULL, FALSE, 100, 'ended', '春节专场')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §2 优惠券 · 各状态 demo(让 Promotions/Coupons tab 有内容)
----------------------------------------------------------------------
INSERT INTO coupon(id, code, batch_id, promotion_id, owner_user_id, benefit_json,
  state, locked_for_order_id, issued_at, redeemed_at, expires_at, audit_note) VALUES

  -- 待领取(unowned, issued)
  ('cp-001', 'NEW-AAAA0001', 'batch-newuser-2026-q2', 'promo-new-user-20off', NULL,
   '{"pct_off_bps":2000,"max_off_minor":10000}'::jsonb, 'issued', NULL,
   NOW() - INTERVAL '3 days', NULL, NOW() + INTERVAL '60 days', ''),
  ('cp-002', 'NEW-AAAA0002', 'batch-newuser-2026-q2', 'promo-new-user-20off', NULL,
   '{"pct_off_bps":2000,"max_off_minor":10000}'::jsonb, 'issued', NULL,
   NOW() - INTERVAL '3 days', NULL, NOW() + INTERVAL '60 days', ''),
  ('cp-003', 'NEW-AAAA0003', 'batch-newuser-2026-q2', 'promo-new-user-20off', NULL,
   '{"pct_off_bps":2000,"max_off_minor":10000}'::jsonb, 'issued', NULL,
   NOW() - INTERVAL '3 days', NULL, NOW() + INTERVAL '60 days', ''),

  -- 已领取待用(issued, with owner)
  ('cp-004', 'NEW-BBBB1001', 'batch-newuser-2026-q2', 'promo-new-user-20off', 'mock_user_01',
   '{"pct_off_bps":2000,"max_off_minor":10000}'::jsonb, 'issued', NULL,
   NOW() - INTERVAL '5 days', NULL, NOW() + INTERVAL '55 days', ''),
  ('cp-005', 'NEW-BBBB1002', 'batch-newuser-2026-q2', 'promo-new-user-20off', 'mock_user_02',
   '{"pct_off_bps":2000,"max_off_minor":10000}'::jsonb, 'issued', NULL,
   NOW() - INTERVAL '5 days', NULL, NOW() + INTERVAL '55 days', ''),

  -- 锁定(下单中)
  ('cp-006', 'SUM-CCCC2001', 'batch-summer', 'promo-summer-30off', 'mock_user_03',
   '{"amount_off_minor":3000}'::jsonb, 'locked', 'ord-03-jade-unpaid',
   NOW() - INTERVAL '10 hours', NULL, NOW() + INTERVAL '30 days', '锁定在 ord-03'),

  -- 已核销
  ('cp-007', 'SUM-CCCC2002', 'batch-summer', 'promo-summer-30off', 'mock_user_01',
   '{"amount_off_minor":3000}'::jsonb, 'redeemed', NULL,
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', ''),
  ('cp-008', 'NEW-DDDD3001', 'batch-newuser-2026-q1', 'promo-new-user-20off', 'mock_user_02',
   '{"pct_off_bps":2000,"max_off_minor":10000}'::jsonb, 'redeemed', NULL,
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '13 days', NOW() + INTERVAL '46 days', ''),

  -- 已过期
  ('cp-009', 'OLD-EEEE9001', 'batch-q1', 'promo-old-yend', 'mock_user_01',
   '{"pct_off_bps":1500}'::jsonb, 'expired', NULL,
   NOW() - INTERVAL '120 days', NULL, NOW() - INTERVAL '60 days', ''),
  ('cp-010', 'OLD-EEEE9002', 'batch-q1', 'promo-old-yend', NULL,
   '{"pct_off_bps":1500}'::jsonb, 'expired', NULL,
   NOW() - INTERVAL '120 days', NULL, NOW() - INTERVAL '60 days', ''),

  -- 已撤回
  ('cp-011', 'REV-FFFF0001', 'batch-revoked-test', 'promo-summer-30off', 'mock_user_03',
   '{"amount_off_minor":3000}'::jsonb, 'revoked', NULL,
   NOW() - INTERVAL '7 days', NULL, NOW() + INTERVAL '23 days', '运营手动撤回 · 异常多领取')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §3 对账批次 + 异常 record(Reconciliation 工作台)
----------------------------------------------------------------------
INSERT INTO recon_batch(id, channel, batch_date, source, total_count, total_amount_minor,
  currency, status, pulled_at, matched_at, resolved_at, raw_file_uri) VALUES

  ('rb-wx-2026-06-26', 'wechat_jsapi', '2026-06-26', 'channel_pulled', 12, 412800, 'CNY',
   'matched',          NOW() - INTERVAL '1 day' - INTERVAL '8 hours',
                       NOW() - INTERVAL '1 day' - INTERVAL '7 hours 50 minutes',
                       NULL, '/recon/wx/2026-06-26.csv'),

  ('rb-wx-2026-06-25', 'wechat_jsapi', '2026-06-25', 'channel_pulled', 9, 287900, 'CNY',
   'has_discrepancy',  NOW() - INTERVAL '2 days' - INTERVAL '8 hours',
                       NOW() - INTERVAL '2 days' - INTERVAL '7 hours 50 minutes',
                       NULL, '/recon/wx/2026-06-25.csv'),

  ('rb-alipay-2026-06-26', 'alipay_wap', '2026-06-26', 'channel_pulled', 4, 132160, 'CNY',
   'matched',          NOW() - INTERVAL '1 day' - INTERVAL '6 hours',
                       NOW() - INTERVAL '1 day' - INTERVAL '5 hours 50 minutes',
                       NULL, '/recon/alipay/2026-06-26.csv'),

  ('rb-stripe-2026-06-26', 'stripe_card', '2026-06-26', 'channel_pulled', 3, 79600, 'USD',
   'has_discrepancy',  NOW() - INTERVAL '1 day' - INTERVAL '4 hours',
                       NOW() - INTERVAL '1 day' - INTERVAL '3 hours 50 minutes',
                       NULL, '/recon/stripe/2026-06-26.csv'),

  ('rb-wx-2026-06-24', 'wechat_jsapi', '2026-06-24', 'channel_pulled', 8, 198700, 'CNY',
   'resolved',         NOW() - INTERVAL '3 days' - INTERVAL '8 hours',
                       NOW() - INTERVAL '3 days' - INTERVAL '7 hours 50 minutes',
                       NOW() - INTERVAL '2 days' - INTERVAL '6 hours', '/recon/wx/2026-06-24.csv')
ON CONFLICT (id) DO NOTHING;

INSERT INTO recon_record(id, batch_id, channel_txn_id, channel_amount_minor, channel_status,
  matched_payment_id, match_state, resolved_by_admin_id, resolved_action, resolved_at) VALUES

  -- 微信 0626 matched batch · 全部 matched
  ('rr-w626-01', 'rb-wx-2026-06-26', '4200001234202606270567890123', 21440, 'SUCCESS',
   'pay-02', 'matched', NULL, NULL, NULL),
  ('rr-w626-02', 'rb-wx-2026-06-26', '4200001234202606261234567890', 19900, 'SUCCESS',
   NULL,     'missing_in_internal', 'admin_root', 'pulled_manual_sync', NOW() - INTERVAL '23 hours'),
  ('rr-w626-03', 'rb-wx-2026-06-26', '4200001234202606261234567891', 4900,  'SUCCESS',
   NULL,     'matched', NULL, NULL, NULL),
  ('rr-w626-04', 'rb-wx-2026-06-26', '4200001234202606261234567892', 19900, 'SUCCESS',
   NULL,     'matched', NULL, NULL, NULL),

  -- 微信 0625 has_discrepancy · 有 3 异常
  ('rr-w625-01', 'rb-wx-2026-06-25', '4200005678202606251234567891', 21440, 'SUCCESS',
   NULL,     'matched', NULL, NULL, NULL),
  ('rr-w625-02', 'rb-wx-2026-06-25', '4200005678202606251234567892', 19900, 'SUCCESS',
   NULL,     'amount_mismatch', NULL, NULL, NULL),
  ('rr-w625-03', 'rb-wx-2026-06-25', '4200005678202606251234567893', 4900,  'SUCCESS',
   NULL,     'missing_in_internal', NULL, NULL, NULL),
  -- missing_in_channel:我方有 payment 但渠道账单里没;channel_txn_id 留 NULL 表示「未在渠道账单中匹配到」
  ('rr-w625-04', 'rb-wx-2026-06-25', NULL, NULL, NULL,
   'pay-02', 'missing_in_channel', NULL, NULL, NULL),

  -- Stripe 0626 has_discrepancy
  ('rr-s626-01', 'rb-stripe-2026-06-26', 'pi_3PfHmJDk3xZJqL7y0AbCdEfG', 19900, 'SUCCESS',
   'pay-01', 'matched', NULL, NULL, NULL),
  ('rr-s626-02', 'rb-stripe-2026-06-26', 'pi_3PfHmJDk3xZJqL7y0AbCdEfH', 29900, 'SUCCESS',
   NULL,     'status_mismatch', NULL, NULL, NULL),

  -- 支付宝 0626 matched 全部
  ('rr-a626-01', 'rb-alipay-2026-06-26', '2026062722001234567890123456', 33040, 'TRADE_SUCCESS',
   'pay-05', 'matched', NULL, NULL, NULL),

  -- 微信 0624 resolved 演示历史
  ('rr-w624-01', 'rb-wx-2026-06-24', '4200005678202606240712345678', 19900, 'SUCCESS',
   'pay-06', 'matched', NULL, NULL, NULL),
  ('rr-w624-02', 'rb-wx-2026-06-24', '4200005678202606241000000001', 4900,  'SUCCESS',
   NULL,     'missing_in_internal', 'admin_root', 'manual_record_creation',
   NOW() - INTERVAL '2 days' - INTERVAL '6 hours')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §4 风控案件(open / investigating / resolved / false_positive)
----------------------------------------------------------------------
INSERT INTO risk_case(id, kind, severity, involved_user_ids, involved_order_ids,
  state, assigned_admin_id, opened_at, closed_at, audit_note) VALUES

  ('rc-001-aml',   'pre_pay', 'high', ARRAY['mock_user_03'], ARRAY[]::text[],
   'open', NULL,
   NOW() - INTERVAL '2 hours', NULL,
   '触发反洗钱阈值 · amount=¥15000 user_age_days=3 · 需人工审核身份与资金来源'),

  ('rc-002-velocity', 'pre_pay', 'med', ARRAY['mock_user_02'], ARRAY['ord-03-jade-unpaid']::text[],
   'investigating', 'admin_root',
   NOW() - INTERVAL '8 hours', NULL,
   '1 小时内 6 次发起支付 · 已联系用户确认是否本人操作 · 等待用户回复'),

  ('rc-003-refund-abuse', 'refund', 'med', ARRAY['mock_user_01'], ARRAY[]::text[],
   'resolved', 'admin_root',
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days',
   '30 天内 6 次退款 · 实际是用户测试商品并确实存在质量问题 · 已加入观察名单'),

  ('rc-004-fp',  'pre_order', 'low', ARRAY['mock_user_01'], ARRAY['ord-01-deep-paid']::text[],
   'false_positive', 'admin_root',
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days 23 hours',
   '触发新人大额单审核 · 但用户已实名 + 历史无异常 · 关闭并放行'),

  ('rc-005-payout', 'pre_pay', 'critical', ARRAY['mock_user_03'], ARRAY[]::text[],
   'open', NULL,
   NOW() - INTERVAL '30 minutes', NULL,
   '同一 IP 在 5 分钟内有 12 个不同账户支付尝试 · 高度疑似刷单 · 已临时阻止该 IP')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §5 风控事件补充(让事件 tab 流水更丰富)
----------------------------------------------------------------------
INSERT INTO risk_event(id, kind, user_id, order_id, payment_id, matched_rule_ids,
  decided_action, details_json, decided_at) VALUES

  ('re-03', 'pre_order', 'mock_user_03', NULL, NULL, ARRAY['rule-001'],
   'review',     '{"amount":1500000,"user_age_days":3,"reason":"新人大额单"}'::jsonb,
   NOW() - INTERVAL '2 hours'),

  ('re-04', 'pre_pay',  'mock_user_03', NULL, NULL, ARRAY['rule-004'],
   'review',     '{"amount":5000000,"reason":"反洗钱阈值"}'::jsonb,
   NOW() - INTERVAL '2 hours'),

  ('re-05', 'pre_pay',  'mock_user_02', 'ord-03-jade-unpaid', NULL, ARRAY['rule-002'],
   'challenge',  '{"reason":"1 小时内 6 次支付"}'::jsonb,
   NOW() - INTERVAL '8 hours'),

  ('re-06', 'refund',   'mock_user_01', NULL, NULL, ARRAY['rule-003'],
   'review',     '{"refund_count_30d":6}'::jsonb,
   NOW() - INTERVAL '5 days'),

  ('re-07', 'pre_pay',  NULL, NULL, NULL, ARRAY['rule-002'],
   'log_only',   '{"reason":"IP velocity spike,系统自动 challenge"}'::jsonb,
   NOW() - INTERVAL '30 minutes'),

  ('re-08', 'login',    'mock_user_01', NULL, NULL, ARRAY[]::text[],
   'allow',      '{}'::jsonb,
   NOW() - INTERVAL '15 minutes')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §6 故意造 1 个失败的 outbox 事件 + 1 个 dropped(Outbox 工作台 retry 按钮有用)
----------------------------------------------------------------------
INSERT INTO outbox_event(id, kind, aggregate_kind, aggregate_id, payload_json, status,
  attempt_count, next_attempt_at, last_error, created_at) VALUES

  ('oe-demo-failed', 'PaymentFailed', 'payment', 'pay-demo-failed',
   '{"kind":"PaymentFailed","payload":{"payment_id":"pay-demo-failed","code":"channel_timeout","msg":"模拟渠道超时,演示 retry 按钮","occurred_at":"2026-06-27T10:00:00Z"}}'::jsonb,
   'failed', 3, NOW() + INTERVAL '5 minutes',
   '渠道 timeout · 已重试 3 次仍未成功,人工介入',
   NOW() - INTERVAL '1 hour'),

  ('oe-demo-dropped', 'CouponExpired', 'coupon', 'cp-demo-dropped',
   '{"kind":"CouponExpired","payload":{"coupon_id":"cp-demo-dropped","occurred_at":"2026-06-25T00:00:00Z"}}'::jsonb,
   'dropped', 5, NOW() - INTERVAL '1 hour',
   '事件源已删除 · 无法关联到具体 coupon · 永久 drop',
   NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §7 多补一个订阅 invoice(让 invoice 历史更丰富)
----------------------------------------------------------------------
INSERT INTO subscription_invoice(id, subscription_id, period_start, period_end, amount_minor, currency,
  status, payment_id, attempt_count, last_attempt_at, next_attempt_at, created_at) VALUES

  ('inv-01-prev', 'sub-01-month-active',
   NOW() - INTERVAL '38 days', NOW() - INTERVAL '8 days',
   4800, 'CNY', 'paid', NULL, 1,
   NOW() - INTERVAL '38 days', NULL,
   NOW() - INTERVAL '38 days'),

  ('inv-02-trial', 'sub-02-year-trial',
   NOW() + INTERVAL '4 days', NOW() + INTERVAL '369 days',
   49800, 'CNY', 'open', NULL, 0,
   NULL, NOW() + INTERVAL '4 days',
   NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §8 inventory(终态对照)
----------------------------------------------------------------------
SELECT 'coupon'        AS tbl, COUNT(*) FROM coupon
UNION ALL SELECT 'recon_batch',  COUNT(*) FROM recon_batch
UNION ALL SELECT 'recon_record', COUNT(*) FROM recon_record
UNION ALL SELECT 'risk_case',    COUNT(*) FROM risk_case
UNION ALL SELECT 'risk_event',   COUNT(*) FROM risk_event
UNION ALL SELECT 'promotion',    COUNT(*) FROM promotion
UNION ALL SELECT 'outbox_event', COUNT(*) FROM outbox_event
UNION ALL SELECT 'subscription_invoice', COUNT(*) FROM subscription_invoice
ORDER BY 1;
