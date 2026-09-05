-- 注销账号 —— 隐私政策上写了两遍的那件事，此前一处都做不到。
--
-- 政策那一屏（`pages/policy`）说：
--   「存多久：账号在，数据就在。你退出并删除账号，出生时间与盘会一起删掉；
--     订单与支付记录按法律要求保留，那部分只留金额与时间」
--   「你能做什么 · 删：在「设置」里退出并删除账号」
--
-- 而「设置」上那颗按钮是 `logout()` —— 它清掉本机那份 token，
-- 服务端一行数据都不动。绑了微信的人下次登录回来东西全在;
-- 匿名的人只是再也够不着自己那个号，数据照旧躺着。
-- 也就是说这两句话【对谁都不成立】。
--
-- 这一列是「他走了」的判据。不真删 `app_user` 那一行:
--   · 订单、支付、凭证要按法律留着，而它们指着这个 user_id
--   · 真删会把那些行的归属抹成一个悬空的字符串，
--     后台看到的是一张查不出主人的单 —— 那比留一行「已注销」更难处理
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 后台用户列表按它筛「还在的人」；auth 那一道按它挡已注销的 token。
-- 部分索引:注销是少数，不该让每个人都背一条索引项。
CREATE INDEX IF NOT EXISTS idx_app_user_deleted
    ON app_user(deleted_at) WHERE deleted_at IS NOT NULL;
