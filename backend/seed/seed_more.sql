-- 额外 mock 数据 · webadmin / 业务接口演示用
-- 跑两次也安全(ON CONFLICT DO NOTHING)

-- ─── 多端 / 多区域用户(8 名)──────────────────────────────
INSERT INTO app_user (id, wx_mp_openid, wx_unionid, nickname, platform, region, locale, is_anonymous) VALUES
  ('u_001','mock_openid_alice','mock_unionid_alice','观若止水','mini','cn','zh-CN',FALSE),
  ('u_002','mock_openid_bob','mock_unionid_bob','子衿青青','mini','cn','zh-CN',FALSE),
  ('u_003',NULL,NULL,'游子吟','ios','jp','ja-JP',FALSE),
  ('u_004',NULL,NULL,'风行者','android','hk','zh-HK',FALSE),
  ('u_005','mock_openid_emily',NULL,'清辉','mini','cn','zh-CN',FALSE),
  ('u_006',NULL,NULL,'匿名过客','web','tw','zh-TW',TRUE),
  ('u_007','mock_openid_grace','mock_unionid_grace','听雨阁','mini','cn','zh-CN',FALSE),
  ('u_008',NULL,NULL,'弦上行','web','us','en-US',FALSE)
ON CONFLICT (id) DO NOTHING;

-- ─── 每个用户 1 张本命 + summary ───────────────────────────
INSERT INTO natal (id, user_id, label, year, month, day, hour, minute, tz, gender, birth_city, is_default) VALUES
  ('n_001','u_001','本命',1990, 3, 5, 9, 30, 8.0,'female','北京',TRUE),
  ('n_002','u_002','本命',1985,11,22,14, 0, 8.0,'male','上海',TRUE),
  ('n_003','u_003','本命',1993, 7,18,22, 0, 9.0,'male','东京',TRUE),
  ('n_004','u_004','本命',1988, 1,30, 7, 0, 8.0,'female','香港',TRUE),
  ('n_005','u_005','本命',1995, 5, 9,16,30, 8.0,'female','成都',TRUE),
  ('n_007','u_007','本命',1991,10,12,11, 0, 8.0,'female','杭州',TRUE),
  ('n_008','u_008','本命',1979, 4,14,19, 0,-5.0,'male','纽约',TRUE)
ON CONFLICT (id) DO NOTHING;

UPDATE app_user SET active_natal_id='n_001' WHERE id='u_001' AND active_natal_id IS NULL;
UPDATE app_user SET active_natal_id='n_002' WHERE id='u_002' AND active_natal_id IS NULL;
UPDATE app_user SET active_natal_id='n_003' WHERE id='u_003' AND active_natal_id IS NULL;
UPDATE app_user SET active_natal_id='n_004' WHERE id='u_004' AND active_natal_id IS NULL;
UPDATE app_user SET active_natal_id='n_005' WHERE id='u_005' AND active_natal_id IS NULL;
UPDATE app_user SET active_natal_id='n_007' WHERE id='u_007' AND active_natal_id IS NULL;
UPDATE app_user SET active_natal_id='n_008' WHERE id='u_008' AND active_natal_id IS NULL;

INSERT INTO natal_summary (natal_id, day_master, strength_level, strength_score, primary_yongshen, primary_role, secondary_yongshen, avoid_wuxing, pattern_name, friendly_hint, mingli_version) VALUES
  ('n_001','甲木','偏弱',43,'水','印星','金','["土","火"]'::jsonb,'印星格','你属甲木之命,气稍弱。水滋木,北方/水域/学问之事顺势而行。',  'mingli-v0.1'),
  ('n_002','戊土','偏强',58,'木','官杀','水','["火","土"]'::jsonb,'食神格','你属戊土之命,气盛。木官杀克制,东方/律法/秩序之事顺势。',  'mingli-v0.1'),
  ('n_003','壬水','身强',67,'火','财星','土','["水","金"]'::jsonb,'财格',  '你属壬水之命,气旺。火财激活,南方/光明/温热之事顺势。',  'mingli-v0.1'),
  ('n_004','丙火','偏弱',38,'木','印星','火','["水","金"]'::jsonb,'印格',  '你属丙火之命,气稍弱。木生火,东方/青绿/温润之物宜近。',  'mingli-v0.1'),
  ('n_005','癸水','身强',62,'木','食神','火','["水","金"]'::jsonb,'食神格','你属癸水之命,气旺。木食神泄秀,东方/创作/教化之事可为。',  'mingli-v0.1'),
  ('n_007','辛金','中和',50,'土','印星','金','["木","火"]'::jsonb,'正印格','你属辛金之命,气和。土生金,西南/中庸/守信之事顺势。',  'mingli-v0.1'),
  ('n_008','庚金','偏强',56,'水','食神','木','["土","火"]'::jsonb,'食神格','你属庚金之命,气盛。水食神泄秀,北方/智慧/流通之事顺势。',  'mingli-v0.1')
ON CONFLICT (natal_id) DO NOTHING;

-- ─── 36 条纳吉历史(给 webadmin 实时流 / dashboard 用)─────
INSERT INTO naji_record (id, user_id, natal_id, asked_at, asked_year, asked_month, asked_day, asked_hour, asked_minute, asked_tz, gate, direction, gate_explain, suit_words, avoid_words, seed) VALUES
  ('nr_001','u_001','n_001',NOW() - INTERVAL '5 min',  2026, 6,26,11,30, 8.0,'生门','东北','利求财创业',  '["谋断","签约"]'::jsonb,'["争辩"]'::jsonb, 8112389),
  ('nr_002','u_002','n_002',NOW() - INTERVAL '12 min', 2026, 6,26,11,15, 8.0,'开门','西北','利工作事业',  '["会谈","签约"]'::jsonb,'["远行"]'::jsonb, 2334551),
  ('nr_003','u_003','n_003',NOW() - INTERVAL '23 min', 2026, 6,26,11, 5, 9.0,'景门','南方','利考试文昌',  '["读书","学思"]'::jsonb,'["诉讼"]'::jsonb, 6691023),
  ('nr_004','u_004','n_004',NOW() - INTERVAL '40 min', 2026, 6,26,10,48, 8.0,'休门','北方','利休养静心',  '["品茶","冥想"]'::jsonb,'["动土"]'::jsonb, 1023499),
  ('nr_005','u_005','n_005',NOW() - INTERVAL '1 hour', 2026, 6,26,10,30, 8.0,'杜门','东南','利修炼内功',  '["静坐","写字"]'::jsonb,'["争辩"]'::jsonb, 3349821),
  ('nr_006','u_demo','n_demo',NOW() - INTERVAL '2 hour',2026, 6,26, 9,30, 8.0,'生门','东北','利求财创业',  '["读书","行善"]'::jsonb,'["开店"]'::jsonb, 8821023),
  ('nr_007','u_007','n_007',NOW() - INTERVAL '3 hour', 2026, 6,26, 8,40, 8.0,'开门','西北','利工作事业',  '["谋断","信约"]'::jsonb,'["远行"]'::jsonb,  998312),
  ('nr_008','u_002','n_002',NOW() - INTERVAL '5 hour', 2026, 6,26, 6,55, 8.0,'惊门','西方','利谈判交际',  '["会谈","宣传"]'::jsonb,'["争辩"]'::jsonb,  331298),
  ('nr_009','u_001','n_001',NOW() - INTERVAL '8 hour', 2026, 6,26, 3,30, 8.0,'休门','北方','利休养静心',  '["品茶","冥想"]'::jsonb,'["动土"]'::jsonb,  220199),
  ('nr_010','u_004','n_004',NOW() - INTERVAL '12 hour',2026, 6,25,23,32, 8.0,'死门','西南','宜静养',      '["静坐"]'::jsonb,        '["远行","开店"]'::jsonb, 5582),
  ('nr_011','u_003','n_003',NOW() - INTERVAL '14 hour',2026, 6,25,22, 8, 9.0,'伤门','东方','收敛锋芒',    '["静坐"]'::jsonb,        '["争辩","诉讼"]'::jsonb,8821),
  ('nr_012','u_005','n_005',NOW() - INTERVAL '18 hour',2026, 6,25,18, 0, 8.0,'生门','东北','利求财创业',  '["签约","会谈"]'::jsonb,'["争辩"]'::jsonb,    9913),
  ('nr_013','u_demo','n_demo',NOW() - INTERVAL '1 day', 2026, 6,25,12, 0, 8.0,'景门','南方','利考试文昌','["读书"]'::jsonb,'["争辩"]'::jsonb, 7723),
  ('nr_014','u_001','n_001',NOW() - INTERVAL '1 day',  2026, 6,25,11, 0, 8.0,'开门','西北','利工作事业',  '["会谈"]'::jsonb,'["远行"]'::jsonb, 3382),
  ('nr_015','u_007','n_007',NOW() - INTERVAL '1 day',  2026, 6,25,10, 0, 8.0,'休门','北方','利休养静心',  '["品茶"]'::jsonb,'["动土"]'::jsonb, 6691),
  ('nr_016','u_002','n_002',NOW() - INTERVAL '2 day',  2026, 6,24,15, 0, 8.0,'生门','东北','利求财创业',  '["签约"]'::jsonb,'["争辩"]'::jsonb, 4408),
  ('nr_017','u_003','n_003',NOW() - INTERVAL '2 day',  2026, 6,24,14, 0, 9.0,'惊门','西方','利谈判交际',  '["宣传"]'::jsonb,'["争辩"]'::jsonb, 2294),
  ('nr_018','u_004','n_004',NOW() - INTERVAL '2 day',  2026, 6,24,11, 0, 8.0,'杜门','东南','利修炼内功',  '["写字"]'::jsonb,'["远行"]'::jsonb, 5571),
  ('nr_019','u_005','n_005',NOW() - INTERVAL '3 day',  2026, 6,23,17, 0, 8.0,'开门','西北','利工作事业',  '["谋断"]'::jsonb,'["争辩"]'::jsonb, 7798),
  ('nr_020','u_demo','n_demo',NOW() - INTERVAL '3 day', 2026, 6,23,12, 0, 8.0,'休门','北方','利休养静心','["冥想"]'::jsonb,'["动土"]'::jsonb, 3328),
  ('nr_021','u_001','n_001',NOW() - INTERVAL '3 day',  2026, 6,23,10, 0, 8.0,'景门','南方','利考试文昌',  '["读书"]'::jsonb,'["争辩"]'::jsonb, 6694),
  ('nr_022','u_007','n_007',NOW() - INTERVAL '4 day',  2026, 6,22,16, 0, 8.0,'生门','东北','利求财创业',  '["签约"]'::jsonb,'["争辩"]'::jsonb, 9913),
  ('nr_023','u_002','n_002',NOW() - INTERVAL '4 day',  2026, 6,22,14, 0, 8.0,'开门','西北','利工作事业',  '["会谈"]'::jsonb,'["远行"]'::jsonb, 4429),
  ('nr_024','u_004','n_004',NOW() - INTERVAL '4 day',  2026, 6,22,10, 0, 8.0,'休门','北方','利休养静心',  '["品茶"]'::jsonb,'["动土"]'::jsonb, 2237),
  ('nr_025','u_003','n_003',NOW() - INTERVAL '5 day',  2026, 6,21,18, 0, 9.0,'杜门','东南','利修炼内功',  '["写字"]'::jsonb,'["远行"]'::jsonb, 5582),
  ('nr_026','u_005','n_005',NOW() - INTERVAL '5 day',  2026, 6,21,14, 0, 8.0,'生门','东北','利求财创业',  '["签约"]'::jsonb,'["争辩"]'::jsonb, 8800),
  ('nr_027','u_demo','n_demo',NOW() - INTERVAL '5 day', 2026, 6,21,11, 0, 8.0,'开门','西北','利工作事业','["会谈"]'::jsonb,'["远行"]'::jsonb, 1138),
  ('nr_028','u_001','n_001',NOW() - INTERVAL '6 day',  2026, 6,20,16, 0, 8.0,'景门','南方','利考试文昌',  '["读书"]'::jsonb,'["争辩"]'::jsonb, 3361),
  ('nr_029','u_002','n_002',NOW() - INTERVAL '6 day',  2026, 6,20,14, 0, 8.0,'休门','北方','利休养静心',  '["品茶"]'::jsonb,'["动土"]'::jsonb, 5582),
  ('nr_030','u_007','n_007',NOW() - INTERVAL '6 day',  2026, 6,20,10, 0, 8.0,'生门','东北','利求财创业',  '["签约"]'::jsonb,'["争辩"]'::jsonb, 9913),
  ('nr_031','u_004','n_004',NOW() - INTERVAL '7 day',  2026, 6,19,18, 0, 8.0,'开门','西北','利工作事业',  '["会谈"]'::jsonb,'["远行"]'::jsonb, 4429),
  ('nr_032','u_003','n_003',NOW() - INTERVAL '7 day',  2026, 6,19,14, 0, 9.0,'杜门','东南','利修炼内功',  '["写字"]'::jsonb,'["远行"]'::jsonb, 2294),
  ('nr_033','u_005','n_005',NOW() - INTERVAL '7 day',  2026, 6,19,10, 0, 8.0,'生门','东北','利求财创业',  '["签约"]'::jsonb,'["争辩"]'::jsonb, 8800),
  ('nr_034','u_demo','n_demo',NOW() - INTERVAL '8 day', 2026, 6,18,12, 0, 8.0,'休门','北方','利休养静心','["品茶"]'::jsonb,'["动土"]'::jsonb, 3328),
  ('nr_035','u_001','n_001',NOW() - INTERVAL '8 day',  2026, 6,18,11, 0, 8.0,'景门','南方','利考试文昌',  '["读书"]'::jsonb,'["争辩"]'::jsonb, 6694),
  ('nr_036','u_002','n_002',NOW() - INTERVAL '9 day',  2026, 6,17,15, 0, 8.0,'开门','西北','利工作事业',  '["会谈"]'::jsonb,'["远行"]'::jsonb, 4429)
ON CONFLICT (id) DO NOTHING;

-- ─── 订单 5 条(状态多样)+ 支付流水 3 条 ──────────────────
INSERT INTO order_record (id, user_id, items, total_amount, currency, status, payment_channel, payment_ref, created_at, paid_at) VALUES
  ('o_001','u_001','[{"product_id":"p_chen","qty":1,"price":12800}]'::jsonb,12800,'CNY','paid',     'wechat_mp','wxpay_4200001234567890', NOW() - INTERVAL '2 day',  NOW() - INTERVAL '2 day'),
  ('o_002','u_002','[{"product_id":"p_bd","qty":2,"price":6800}]'::jsonb,   13600,'CNY','done',     'wechat_mp','wxpay_4200001234567891', NOW() - INTERVAL '5 day',  NOW() - INTERVAL '5 day'),
  ('o_003','u_demo','[{"product_id":"p_qzhl","qty":1,"price":18800}]'::jsonb,18800,'CNY','paid',    'wechat_mp','wxpay_4200001234567892', NOW() - INTERVAL '1 day',  NOW() - INTERVAL '1 day'),
  ('o_004','u_005','[{"product_id":"p_tan","qty":1,"price":9800},{"product_id":"p_ai","qty":1,"price":5800}]'::jsonb,15600,'CNY','unpaid', NULL, NULL, NOW() - INTERVAL '2 hour', NULL),
  ('o_005','u_004','[{"product_id":"p_ya","qty":1,"price":7800}]'::jsonb,    7800,'HKD','cancelled',NULL, NULL, NOW() - INTERVAL '6 day', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO payment_order (id, order_id, user_id, channel, amount, currency, third_party_appid, third_party_mchid, third_party_prepay, third_party_txn_id, status, paid_at) VALUES
  ('p_001','o_001','u_001','wechat_mp',12800,'CNY','wx_mock_appid','1900000000','prepay_4200001234567890','wxpay_4200001234567890','success',NOW() - INTERVAL '2 day'),
  ('p_002','o_002','u_002','wechat_mp',13600,'CNY','wx_mock_appid','1900000000','prepay_4200001234567891','wxpay_4200001234567891','success',NOW() - INTERVAL '5 day'),
  ('p_003','o_003','u_demo','wechat_mp',18800,'CNY','wx_mock_appid','1900000000','prepay_4200001234567892','wxpay_4200001234567892','success',NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- ─── 徽章 ───────────────────────────────────────────────
INSERT INTO user_badge (user_id, badge_id, earned_at, progress) VALUES
  ('u_demo','b_first',NOW() - INTERVAL '10 day','{"count":1}'::jsonb),
  ('u_demo','b_buy',  NOW() - INTERVAL '1 day','{"count":1}'::jsonb),
  ('u_001','b_first', NOW() - INTERVAL '8 day','{"count":1}'::jsonb),
  ('u_001','b_buy',   NOW() - INTERVAL '2 day','{"count":1}'::jsonb),
  ('u_002','b_first', NOW() - INTERVAL '12 day','{"count":1}'::jsonb),
  ('u_002','b_buy',   NOW() - INTERVAL '5 day','{"count":1}'::jsonb),
  ('u_002','b_streak',NOW() - INTERVAL '3 day','{"days":7}'::jsonb),
  ('u_003','b_first', NOW() - INTERVAL '7 day','{"count":1}'::jsonb),
  ('u_005','b_first', NOW() - INTERVAL '6 day','{"count":1}'::jsonb),
  ('u_007','b_first', NOW() - INTERVAL '8 day','{"count":1}'::jsonb)
ON CONFLICT (user_id, badge_id) DO NOTHING;

-- ─── 活动报名 ────────────────────────────────────────────
INSERT INTO activity_registration (id, user_id, activity_id, status, registered_at) VALUES
  ('ar_001','u_demo','a_gw','registered', NOW() - INTERVAL '3 day'),
  ('ar_002','u_001','a_gw','registered', NOW() - INTERVAL '4 day'),
  ('ar_003','u_002','a_dy','checked_in',  NOW() - INTERVAL '8 day'),
  ('ar_004','u_005','a_xd','registered', NOW() - INTERVAL '2 day'),
  ('ar_005','u_007','a_dy','registered', NOW() - INTERVAL '1 day')
ON CONFLICT (user_id, activity_id) DO NOTHING;

-- ─── 后台审计日志(几条样例)────────────────────────────
INSERT INTO audit_log (id, admin_id, action, target_type, target_id, diff, ip, created_at) VALUES
  ('al_001','admin_root','login',          NULL,        NULL,   NULL,                                              '192.168.1.10', NOW() - INTERVAL '2 hour'),
  ('al_002','admin_root','quote.publish',  'quote',     'q01',  '{"before":"draft","after":"published"}'::jsonb,    '192.168.1.10', NOW() - INTERVAL '5 hour'),
  ('al_003','admin_root','flag.update',    'feature_flag','show_product_iap','{"before":{"by_region":{}},"after":{"by_region":{"cn":false}}}'::jsonb,'192.168.1.10', NOW() - INTERVAL '1 day'),
  ('al_004','admin_root','product.create', 'product',   'p_new','{"name":"沉香小品"}'::jsonb,                       '192.168.1.10', NOW() - INTERVAL '2 day')
ON CONFLICT (id) DO NOTHING;
