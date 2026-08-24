-- unmei commerce v2 · mock 数据(让 webadmin 有内容看)
--
-- 假设:已应用 20260627_commerce_v2.sql,有 product / sku / price_book / plan / promotion 种子。
-- 本文件只追加 mock 订单 / 支付 / 退款 / 物流 / 订阅 / 风控事件 / 财务分录。
--
-- 幂等:全部 ON CONFLICT DO NOTHING

----------------------------------------------------------------------
-- §1 用户(已有 demo_user_001;再加 2 个)
----------------------------------------------------------------------
INSERT INTO app_user(id, nickname, platform, region, locale, is_active)
VALUES
  ('mock_user_01', '李清照', 'web',   'cn', 'zh-CN', TRUE),
  ('mock_user_02', '陶渊明', 'wx_mp', 'cn', 'zh-CN', TRUE),
  ('mock_user_03', '苏东坡', 'ios',   'cn', 'zh-CN', TRUE)
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §2 订单 · 6 条覆盖各状态
----------------------------------------------------------------------
INSERT INTO order_record(
  id, user_id, channel_origin, currency,
  amount_subtotal_minor, amount_discount_minor, amount_shipping_minor, amount_tax_minor,
  amount_total_minor, amount_paid_minor, amount_refunded_minor,
  status, source_kind, expires_at, paid_at, fulfilled_at,
  region, created_at, updated_at
) VALUES
  ('ord-01-deep-paid',
    'mock_user_01', 'web', 'CNY',
    19900, 0, 0, 0, 19900, 19900, 0,
    'done', 'one_shot',
    NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '5 hours',  NOW() - INTERVAL '5 hours',
    'cn', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours'),

  ('ord-02-hehun-paid',
    'mock_user_01', 'wx_mp', 'CNY',
    26800, 5360, 0, 0, 21440, 21440, 0,
    'paid', 'one_shot',
    NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '1 hour', NULL,
    'cn', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '50 minutes'),

  ('ord-03-jade-unpaid',
    'mock_user_02', 'wx_mp', 'CNY',
    39800, 0, 1200, 0, 41000, 0, 0,
    'unpaid', 'one_shot',
    NOW() + INTERVAL '25 minutes', NULL, NULL,
    'cn', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'),

  ('ord-04-naji-cancelled',
    'mock_user_03', 'ios', 'CNY',
    4900, 0, 0, 0, 4900, 0, 0,
    'cancelled', 'one_shot',
    NOW() - INTERVAL '40 minutes', NULL, NULL,
    'cn', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes'),

  ('ord-05-jade-shipped',
    'mock_user_02', 'web', 'CNY',
    39800, 7960, 1200, 0, 33040, 33040, 0,
    'fulfilling', 'one_shot',
    NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '20 hours', NULL,
    'cn', NOW() - INTERVAL '20 hours', NOW() - INTERVAL '15 hours'),

  ('ord-06-deep-refunded',
    'mock_user_03', 'wx_h5', 'CNY',
    19900, 0, 0, 0, 19900, 19900, 19900,
    'refunded', 'one_shot',
    NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days',
    'cn', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §3 订单行
----------------------------------------------------------------------
INSERT INTO order_line(id, order_id, line_no, sku_id, sku_snapshot_json,
  unit_price_minor, qty, line_subtotal_minor, applied_discount_minor, fulfillment_status, fulfillment_ref) VALUES
  ('ol-01', 'ord-01-deep-paid', 1, 'sku-naji-deep',
    '{"name":"八字深度报告 · 默认版","pages":30}'::jsonb, 19900, 1, 19900, 0, 'done',
    '{"natal_id":"natal-mock-01","report_url":"/report/ord-01-deep-paid"}'::jsonb),
  ('ol-02', 'ord-02-hehun-paid', 1, 'sku-hehun-double',
    '{"name":"合婚双盘报告","pages":24}'::jsonb, 26800, 1, 26800, 5360, 'processing',
    '{}'::jsonb),
  ('ol-03', 'ord-03-jade-unpaid', 1, 'sku-jade-pendant',
    '{"name":"和田玉葫芦坠"}'::jsonb, 39800, 1, 39800, 0, 'pending',
    '{}'::jsonb),
  ('ol-04', 'ord-04-naji-cancelled', 1, 'sku-naji-single',
    '{"name":"问事一卦"}'::jsonb, 4900, 1, 4900, 0, 'failed',
    '{}'::jsonb),
  ('ol-05', 'ord-05-jade-shipped', 1, 'sku-jade-pendant',
    '{"name":"和田玉葫芦坠"}'::jsonb, 39800, 1, 39800, 7960, 'processing',
    '{}'::jsonb),
  ('ol-06', 'ord-06-deep-refunded', 1, 'sku-naji-deep',
    '{"name":"八字深度报告"}'::jsonb, 19900, 1, 19900, 0, 'done',
    '{"natal_id":"natal-mock-06"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §4 订单事件(状态机时间线)
----------------------------------------------------------------------
INSERT INTO order_event(id, order_id, kind, actor_kind, actor_id, before_status, after_status, meta_json, created_at) VALUES
  ('oe-01-create', 'ord-01-deep-paid', 'OrderCreated', 'user', 'mock_user_01', NULL, 'unpaid', '{}'::jsonb, NOW() - INTERVAL '5 hours'),
  ('oe-01-paid',   'ord-01-deep-paid', 'OrderPaid',    'webhook', NULL, 'unpaid', 'paid', '{"payment_id":"pay-01"}'::jsonb, NOW() - INTERVAL '4 hours 55 minutes'),
  ('oe-01-fulf',   'ord-01-deep-paid', 'OrderFulfilled','system', NULL, 'fulfilling', 'done', '{}'::jsonb, NOW() - INTERVAL '4 hours'),
  ('oe-02-create', 'ord-02-hehun-paid', 'OrderCreated', 'user', 'mock_user_01', NULL, 'unpaid', '{}'::jsonb, NOW() - INTERVAL '1 hour'),
  ('oe-02-paid',   'ord-02-hehun-paid', 'OrderPaid', 'webhook', NULL, 'unpaid', 'paid', '{}'::jsonb, NOW() - INTERVAL '50 minutes'),
  ('oe-03-create', 'ord-03-jade-unpaid', 'OrderCreated','user', 'mock_user_02', NULL, 'unpaid', '{}'::jsonb, NOW() - INTERVAL '5 minutes'),
  ('oe-04-create', 'ord-04-naji-cancelled', 'OrderCreated', 'user', 'mock_user_03', NULL, 'unpaid', '{}'::jsonb, NOW() - INTERVAL '2 hours'),
  ('oe-04-cancel', 'ord-04-naji-cancelled', 'OrderCancelled', 'user', 'mock_user_03', 'unpaid', 'cancelled', '{"reason":"用户主动取消"}'::jsonb, NOW() - INTERVAL '1 hour 35 minutes'),
  ('oe-05-create', 'ord-05-jade-shipped','OrderCreated','user', 'mock_user_02', NULL, 'unpaid', '{}'::jsonb, NOW() - INTERVAL '20 hours'),
  ('oe-05-paid',   'ord-05-jade-shipped','OrderPaid','webhook', NULL, 'unpaid', 'paid', '{}'::jsonb, NOW() - INTERVAL '19 hours 55 minutes'),
  ('oe-05-fulf-start','ord-05-jade-shipped','OrderFulfillStarted','system', NULL, 'paid', 'fulfilling', '{}'::jsonb, NOW() - INTERVAL '15 hours'),
  ('oe-06-create', 'ord-06-deep-refunded', 'OrderCreated', 'user', 'mock_user_03', NULL, 'unpaid', '{}'::jsonb, NOW() - INTERVAL '3 days'),
  ('oe-06-paid',   'ord-06-deep-refunded', 'OrderPaid', 'webhook', NULL, 'unpaid', 'paid', '{}'::jsonb, NOW() - INTERVAL '3 days' + INTERVAL '5 minutes'),
  ('oe-06-fulf',   'ord-06-deep-refunded', 'OrderFulfilled','system', NULL, 'fulfilling', 'done', '{}'::jsonb, NOW() - INTERVAL '3 days' + INTERVAL '20 minutes'),
  ('oe-06-refund', 'ord-06-deep-refunded', 'OrderRefunded', 'admin', 'admin_root', 'done', 'refunded', '{"reason":"质量问题"}'::jsonb, NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §5 支付流水
----------------------------------------------------------------------
INSERT INTO payment(id, order_id, user_id, channel, amount_minor, currency, status,
  channel_txn_id, channel_user_ref, paid_at, expires_at, metadata_json, created_at, updated_at) VALUES
  ('pay-01', 'ord-01-deep-paid', 'mock_user_01', 'stripe_card', 19900, 'CNY', 'success',
    'pi_3PfHmJDk3xZJqL7y0AbCdEfG', 'cus_QXmJhDk3xZJqL7y', NOW() - INTERVAL '4 hours 55 minutes',
    NOW() - INTERVAL '4 hours 25 minutes', '{}'::jsonb, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours 55 minutes'),
  ('pay-02', 'ord-02-hehun-paid', 'mock_user_01', 'wechat_mp', 21440, 'CNY', 'success',
    '4200001234202606270567890123', 'oXxYz9DEMOhDk3xZJqL7y0AbC', NOW() - INTERVAL '50 minutes',
    NOW() - INTERVAL '20 minutes', '{}'::jsonb, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '50 minutes'),
  ('pay-03', 'ord-03-jade-unpaid', 'mock_user_02', 'wechat_mp', 41000, 'CNY', 'pending',
    NULL, 'oXxYz9DEMOhDk3xZJqL7yMOCK02', NULL,
    NOW() + INTERVAL '25 minutes', '{}'::jsonb, NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '4 minutes'),
  ('pay-04', 'ord-04-naji-cancelled', 'mock_user_03', 'iap', 4900, 'CNY', 'expired',
    NULL, '1000000XX_REC_TOKEN_MOCK', NULL,
    NOW() - INTERVAL '1 hour 30 minutes', '{}'::jsonb, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 30 minutes'),
  ('pay-05', 'ord-05-jade-shipped', 'mock_user_02', 'alipay_wap', 33040, 'CNY', 'success',
    '2026062722001234567890123456', 'ali_mock_2026', NOW() - INTERVAL '19 hours 55 minutes',
    NOW() - INTERVAL '19 hours 25 minutes', '{}'::jsonb, NOW() - INTERVAL '20 hours', NOW() - INTERVAL '19 hours 55 minutes'),
  ('pay-06', 'ord-06-deep-refunded', 'mock_user_03', 'wechat_h5', 19900, 'CNY', 'refunded',
    '4200005678202606240712345678', 'oXxYz9DEMOhDk3xZJqL7yMOCK03', NOW() - INTERVAL '3 days' + INTERVAL '5 minutes',
    NOW() - INTERVAL '3 days' + INTERVAL '30 minutes', '{}'::jsonb, NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO payment_attempt(id, payment_id, attempt_no, request_payload_json, response_payload_json, latency_ms, error_kind, created_at) VALUES
  ('pa-01-1', 'pay-01', 1, '{"intent":"payment.create"}'::jsonb, '{"client_secret":"pi_3PfHmJDk3xZ_secret_XXX"}'::jsonb, 320, NULL, NOW() - INTERVAL '5 hours'),
  ('pa-02-1', 'pay-02', 1, '{"trade_type":"JSAPI"}'::jsonb, '{"prepay_id":"wx27024012345_MOCK"}'::jsonb, 245, NULL, NOW() - INTERVAL '1 hour'),
  ('pa-03-1', 'pay-03', 1, '{"trade_type":"JSAPI"}'::jsonb, '{"prepay_id":"wx27270556_MOCK_PENDING"}'::jsonb, 198, NULL, NOW() - INTERVAL '4 minutes'),
  ('pa-04-1', 'pay-04', 1, '{"product_id":"naji_single","tx_id":"mock-iap-rec"}'::jsonb, '{"status":"deferred"}'::jsonb, 110, NULL, NOW() - INTERVAL '2 hours'),
  ('pa-04-2', 'pay-04', 2, '{"action":"poll"}'::jsonb, '{"status":"expired"}'::jsonb, 88, 'expired', NOW() - INTERVAL '1 hour 30 minutes'),
  ('pa-05-1', 'pay-05', 1, '{"trade_type":"alipay.trade.wap.pay"}'::jsonb, '{"redirect":"https://openapi.alipay.com/..."}'::jsonb, 256, NULL, NOW() - INTERVAL '20 hours'),
  ('pa-06-1', 'pay-06', 1, '{"trade_type":"MWEB"}'::jsonb, '{"mweb_url":"https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=MOCK"}'::jsonb, 232, NULL, NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO payment_event(id, payment_id, kind, channel, channel_event_id, payload_json, received_at, processed_at) VALUES
  ('pe-01-succ','pay-01', 'PaymentSucceededByCallback','stripe_card', 'evt_3PfHmJ_MOCK_SUCCEEDED',
    '{"id":"evt_3PfHmJ_MOCK_SUCCEEDED","type":"payment_intent.succeeded","data":{"object":{"amount":19900}}}'::jsonb,
    NOW() - INTERVAL '4 hours 55 minutes', NOW() - INTERVAL '4 hours 55 minutes' + INTERVAL '1 second'),
  ('pe-02-succ','pay-02', 'PaymentSucceededByCallback','wechat_mp', '4200001234202606270567890123_SUCC',
    '{"return_code":"SUCCESS","result_code":"SUCCESS","transaction_id":"4200001234..."}'::jsonb,
    NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '50 minutes' + INTERVAL '1 second'),
  ('pe-05-succ','pay-05', 'PaymentSucceededByCallback','alipay_wap', 'alipay_2026062722001_OK',
    '{"trade_status":"TRADE_SUCCESS"}'::jsonb,
    NOW() - INTERVAL '19 hours 55 minutes', NOW() - INTERVAL '19 hours 55 minutes' + INTERVAL '1 second'),
  ('pe-06-succ','pay-06', 'PaymentSucceededByCallback','wechat_h5', '4200005678202606240712345678_SUCC',
    '{"transaction_id":"4200005678..."}'::jsonb,
    NOW() - INTERVAL '3 days' + INTERVAL '5 minutes', NOW() - INTERVAL '3 days' + INTERVAL '5 minutes' + INTERVAL '1 second'),
  ('pe-06-refund','pay-06', 'RefundCompleted','wechat_h5', '50000999201606240712345678_REFUND',
    '{"refund_id":"50000999...","refund_fee":19900}'::jsonb,
    NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '1 second')
ON CONFLICT (channel, channel_event_id) DO NOTHING;

----------------------------------------------------------------------
-- §6 退款
----------------------------------------------------------------------
INSERT INTO refund(id, order_id, payment_id, amount_minor, currency, reason_code, reason_text,
  actor_kind, actor_id, status, channel_refund_id, approved_at, approved_by_admin_id,
  processed_at, completed_at, created_at, updated_at) VALUES
  ('rfd-01', 'ord-06-deep-refunded', 'pay-06', 19900, 'CNY', 'quality_issue', '报告生成失败 + 二次联系无响应',
    'admin', 'admin_root', 'success', '50000999201606240712345678',
    NOW() - INTERVAL '1 day 2 hours', 'admin_root',
    NOW() - INTERVAL '1 day 1 hour', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day 3 hours', NOW() - INTERVAL '1 day'),
  ('rfd-02', 'ord-02-hehun-paid', 'pay-02', 10720, 'CNY', 'user_request', '用户申请部分退款，理由「双方未到现场」',
    'user', 'mock_user_01', 'requested', NULL, NULL, NULL, NULL, NULL,
    NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §7 物流(实物订单 jade)
----------------------------------------------------------------------
INSERT INTO shipment(id, order_id, order_line_ids, carrier_code, tracking_no,
  recipient_snapshot_json, shipping_method, weight_g, status,
  picked_up_at, delivered_at, cost_minor, cost_currency,
  carrier_meta_json, created_at, updated_at) VALUES
  ('shp-01', 'ord-05-jade-shipped', ARRAY['ol-05'], 'sf', 'SF1234567890123',
    '{"name":"陶渊明","phone":"138****1234","address":"湖南省长沙市岳麓区某街某号","zipcode":"410000"}'::jsonb,
    'standard', 80, 'in_transit',
    NOW() - INTERVAL '15 hours', NULL, 1200, 'CNY',
    '{}'::jsonb, NOW() - INTERVAL '19 hours', NOW() - INTERVAL '2 hours'),
  ('shp-02', 'ord-03-jade-unpaid', ARRAY['ol-03'], 'manual', NULL,
    '{"name":"陶渊明","phone":"138****1234"}'::jsonb,
    'standard', NULL, 'preparing',
    NULL, NULL, NULL, NULL,
    '{}'::jsonb, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO shipment_trace_event(id, shipment_id, event_at, event_kind, location, description,
  raw_source, raw_event_id, raw_payload_json, received_at) VALUES
  ('ste-01-1', 'shp-01', NOW() - INTERVAL '15 hours', 'picked_up', '长沙处理中心',
    '已揽件',                          'kuaidi100', 'k100-SF1234567890123-1', '{}'::jsonb, NOW() - INTERVAL '15 hours' + INTERVAL '2 minutes'),
  ('ste-01-2', 'shp-01', NOW() - INTERVAL '12 hours', 'departed', '长沙集散中心',
    '已发出至[北京]',                  'kuaidi100', 'k100-SF1234567890123-2', '{}'::jsonb, NOW() - INTERVAL '12 hours' + INTERVAL '5 minutes'),
  ('ste-01-3', 'shp-01', NOW() - INTERVAL '6 hours', 'arrived_at_sort_facility', '北京分拨中心',
    '到达北京[海淀分拨]',              'kuaidi100', 'k100-SF1234567890123-3', '{}'::jsonb, NOW() - INTERVAL '6 hours' + INTERVAL '1 minute'),
  ('ste-01-4', 'shp-01', NOW() - INTERVAL '2 hours', 'in_transit', '北京分拨中心',
    '快件已分拣，准备装车',            'kuaidi100', 'k100-SF1234567890123-4', '{}'::jsonb, NOW() - INTERVAL '2 hours' + INTERVAL '3 minutes')
ON CONFLICT (raw_source, raw_event_id) DO NOTHING;

----------------------------------------------------------------------
-- §8 订阅
----------------------------------------------------------------------
INSERT INTO subscription(id, user_id, plan_id, status, source_channel, source_payment_id,
  current_period_start, current_period_end, next_billing_attempt_at, cancel_at_period_end,
  created_at, updated_at) VALUES
  ('sub-01-month-active', 'mock_user_01', 'plan-mg-month', 'active', 'wechat_jsapi', 'pay-02',
    NOW() - INTERVAL '8 days', NOW() + INTERVAL '22 days', NOW() + INTERVAL '22 days', FALSE,
    NOW() - INTERVAL '15 days', NOW() - INTERVAL '8 days'),
  ('sub-02-year-trial', 'mock_user_02', 'plan-mg-year', 'trialing', 'iap', NULL,
    NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days', NOW() + INTERVAL '4 days', FALSE,
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  ('sub-03-month-pastdue', 'mock_user_03', 'plan-mg-month', 'past_due', 'stripe_card', NULL,
    NOW() - INTERVAL '32 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '1 day', FALSE,
    NOW() - INTERVAL '32 days', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscription_invoice(id, subscription_id, period_start, period_end, amount_minor, currency,
  status, payment_id, attempt_count, created_at) VALUES
  ('inv-01', 'sub-01-month-active', NOW() - INTERVAL '8 days', NOW() + INTERVAL '22 days', 4800, 'CNY',
    'paid', 'pay-02', 1, NOW() - INTERVAL '8 days'),
  ('inv-03', 'sub-03-month-pastdue', NOW() - INTERVAL '2 days', NOW() + INTERVAL '28 days', 4800, 'CNY',
    'open', NULL, 2, NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §9 风控事件(让风控页面有数据)
----------------------------------------------------------------------
INSERT INTO risk_event(id, kind, user_id, order_id, payment_id, matched_rule_ids,
  decided_action, details_json, decided_at) VALUES
  ('re-01', 'pre_pay', 'mock_user_02', 'ord-03-jade-unpaid', NULL, ARRAY['rule-002'],
    'challenge', '{"reason":"count_in_window(payment, user_id, 1h) > 5"}'::jsonb, NOW() - INTERVAL '5 minutes'),
  ('re-02', 'pre_pay', 'mock_user_03', NULL, NULL, ARRAY['rule-001'],
    'review',    '{"amount":1500000,"user_age_days":3}'::jsonb, NOW() - INTERVAL '3 hours')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §10 财务分录(让财务页面有内容)
----------------------------------------------------------------------
INSERT INTO journal_entry(id, period_id, description, posted_at, posted_by_kind,
  business_kind, business_ref_id, status) VALUES
  ('je-01', 'period-2026-06', '订单 ord-01 营收 ¥199 + Stripe 在途', NOW() - INTERVAL '4 hours 55 minutes', 'system', 'payment', 'pay-01', 'posted'),
  ('je-02', 'period-2026-06', '订单 ord-02 营收 ¥214.4 + 微信在途', NOW() - INTERVAL '50 minutes',           'system', 'payment', 'pay-02', 'posted'),
  ('je-05', 'period-2026-06', '订单 ord-05 营收 ¥330.4 + 运费 ¥12 + 支付宝在途', NOW() - INTERVAL '19 hours 55 minutes', 'system', 'payment', 'pay-05', 'posted'),
  ('je-06', 'period-2026-06', '订单 ord-06 退款冲销 ¥199 + 微信退款',            NOW() - INTERVAL '1 day',                  'system', 'refund',  'rfd-01', 'posted')
ON CONFLICT (id) DO NOTHING;

INSERT INTO journal_line(id, entry_id, line_no, account_code, debit_minor, credit_minor, currency, ref_kind, ref_id, note) VALUES
  ('jl-01-1', 'je-01', 1, '1002', 19900, 0, 'CNY', 'payment', 'pay-01', 'Stripe 在途款'),
  ('jl-01-2', 'je-01', 2, '4001', 0, 19900, 'CNY', 'payment', 'pay-01', '主营业务收入'),
  ('jl-02-1', 'je-02', 1, '1002', 21440, 0, 'CNY', 'payment', 'pay-02', '微信在途款'),
  ('jl-02-2', 'je-02', 2, '4001', 0, 21440, 'CNY', 'payment', 'pay-02', '主营业务收入'),
  ('jl-05-1', 'je-05', 1, '1002', 33040, 0, 'CNY', 'payment', 'pay-05', '支付宝在途款'),
  ('jl-05-2', 'je-05', 2, '4001', 0, 31840, 'CNY', 'payment', 'pay-05', '主营业务收入'),
  ('jl-05-3', 'je-05', 3, '4002', 0, 1200,  'CNY', 'payment', 'pay-05', '运费收入'),
  ('jl-06-1', 'je-06', 1, '4001', 19900, 0, 'CNY', 'refund', 'rfd-01', '主营业务收入（冲销）'),
  ('jl-06-2', 'je-06', 2, '1001', 0, 19900, 'CNY', 'refund', 'rfd-01', '银行存款流出')
ON CONFLICT (id) DO NOTHING;
