-- 【pending 的支付一定有到期时间】。
--
-- `payment.rs` 里那句复用查询写着 `expires_at IS NULL OR expires_at > NOW()`,
-- 也就是说它认为「没有到期时间」是可能的;而紧接着第 119 行读的是
-- `let expires_at: DateTime<Utc> = row.get("expires_at")` —— 非 Option。
-- sqlx 的 `Row::get` 在 NULL 上会 panic，于是这条复用路径撞上一笔
-- 没有到期时间的 pending 支付就会把请求打崩:用户点「去付」什么都不会发生。
--
-- 两处说法必须有一处是错的。错的是 SQL:发起支付那一步(payment.rs:150)
-- 一直写着 `Utc::now() + 30 分钟`，pending 从来就有到期时间。
-- 库里现有 9502 笔支付，908 笔 expires_at 为空，**全部是 `success`**
-- (订阅那条路径 subscription.rs:283 直接插 success，本来就不需要到期时间)。
-- pending / processing 里一笔都没有。
--
-- 所以正统改法是【让类型为真】，不是在代码里加一层 Option 防御:
-- 把「pending 必有到期时间」写进库，SQL 那句 `IS NULL OR` 跟着删掉,
-- 读成非 Option 就成立了。
--
-- 顺带一件:没有到期时间的 pending 支付永远扫不到 ——
-- `expire_overdue` 判的是 `expires_at <= NOW()`，NULL 不满足任何比较。
-- 这条约束同时堵掉「一笔永远不会过期、也永远付不掉的支付」。
ALTER TABLE payment
  ADD CONSTRAINT payment_pending_has_expiry
  CHECK (status NOT IN ('pending', 'processing') OR expires_at IS NOT NULL);
