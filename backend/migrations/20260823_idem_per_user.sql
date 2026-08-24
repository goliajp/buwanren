-- 幂等键按【用户】隔离。
--
-- 原先主键只有 key,而占键、查重、落响应、放开键全都只按 key 走 ——
-- 表里有 user_id 这一列,却没有任何地方拿它过滤。
-- 于是两个不同用户用同一个幂等键、同样的请求体时,后一个会拿到前一个的响应体。
--
-- 2026-08-23 实测(两个匿名用户、同键同体、POST /v1/orders):
--   乙收到的 order_id 与金额都是甲那一单的,而乙自己那一单【根本没建】——
--   乙以为下单成功了。既是跨用户的信息外泄,也是一次静默的没执行。
--
-- 键是客户端给的头,所以这不是「撞上的概率有多小」的问题:它由调用方决定。
--
-- user_id 原先可空(810 行里 160 行是空的,来自不带用户的调用与测试)。
-- 主键列不能为空,所以空值统一收敛成 ''—— 不带用户的调用共用 '' 这一格,
-- 跟从前一样,但只跟同样不带用户的调用共用,不再跟真实用户混在一起。
UPDATE idempotency_log SET user_id = '' WHERE user_id IS NULL;

ALTER TABLE idempotency_log ALTER COLUMN user_id SET DEFAULT '';
ALTER TABLE idempotency_log ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE idempotency_log DROP CONSTRAINT idempotency_log_pkey;
ALTER TABLE idempotency_log ADD CONSTRAINT idempotency_log_pkey PRIMARY KEY (user_id, key);
