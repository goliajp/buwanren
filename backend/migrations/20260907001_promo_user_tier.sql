-- `user_tier` 这个键从来没有人读 —— 拿掉。
--
-- 【同一件事两个键，一个生效一个不生效】（2026-09-07）。
-- `NEWUSER20`（新人首单立减 20%）的 `match_json` 是
-- `{"user_tier": "new", "new_user_only": true}` —— 两个键说的是同一件事，
-- 而 2026-09-07 接上的只有 `new_user_only`（判据:他还没有一单付过钱的）。
--
-- 留着 `user_tier` 的代价不是「多一个没用的键」，是**后台照常把它摆出来
-- 给人看**:活动详情页一条条列 `match_json`，读的人会以为这个产品有
-- 「用户分层」这回事，而它从建库起就没有过 —— `app_user` 上没有这一列，
-- 全仓也没有一处算过谁是哪一层。
--
-- 判据由 `scripts/check-promo-rules.py` 守着:活动里出现一个代码不读的键
-- 就红。这一条正是它上线当天报出来的第一个。

UPDATE promotion
   SET match_json = match_json - 'user_tier'
 WHERE match_json ? 'user_tier';
