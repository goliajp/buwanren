-- 三场线下活动的开场时刻，削到整点。
--
-- 种库时写的是 `NOW() + INTERVAL '10 days'`，把种库那一刻的分秒也带了进去 ——
-- 屏上三场并排写着「9月13日 18:57」「9月23日 18:57」「10月3日 18:57」:
-- 同一个分钟，而且是个谁也不会挑的分钟。那一列一眼看得出是机器生成的。
--
-- 【结束时刻要拿开场那天当锚】。头一版写的是
-- `date_trunc('day', end_at) + INTERVAL '18 hours'` —— 而原来的结束时刻
-- 是开场 +8 小时，18:57 加八小时已经翻到了第二天凌晨。
-- 按它自己那天削，一场市集就成了「9月13日 10:00 到 9月14日 18:00」，
-- 三十二个小时。回读那一步才看出来。
--
-- 市集与义诊当天十点到十八点;香道课是三天的，十月三号九点到五号十七点。
UPDATE activity
   SET start_at = date_trunc('day', start_at) + INTERVAL '10 hours',
       end_at   = date_trunc('day', start_at) + INTERVAL '18 hours'
 WHERE id IN ('a_gw', 'a_dy');

UPDATE activity
   SET start_at = date_trunc('day', start_at) + INTERVAL '9 hours',
       end_at   = date_trunc('day', start_at) + INTERVAL '2 days 17 hours'
 WHERE id = 'a_xd';
