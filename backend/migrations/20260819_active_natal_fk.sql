-- app_user.active_natal_id 一直没有外键，而指向同一张表的另外两处都有：
-- natal_summary 是 ON DELETE CASCADE，naji_record 是 ON DELETE SET NULL。
--
-- 于是删掉自己的本命之后，active_natal_id 还指着那一行，**此后每一次起卦都 500**
-- （外键炸在 naji_record 上），而且原始的数据库报错直接发回给了客户端。
-- 2026-08-19 实测：建本命 → 删掉 → 起卦 500，一直到重新建一份为止。
--
-- 跟 naji_record 取同一种做法（SET NULL）—— 那是这张表已经有的先例。
-- 起卦那条路本来就认得 active_natal_id 为空的情况（没有用神就不加分），
-- 所以清空是安全的；改成 RESTRICT 会让「删自己的本命」这个动作直接失败，
-- 那是另一种产品行为，不在这次范围里。

-- 先把已经悬空的清掉，否则约束加不上。
UPDATE app_user u SET active_natal_id = NULL
WHERE u.active_natal_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM natal n WHERE n.id = u.active_natal_id);

ALTER TABLE app_user
  ADD CONSTRAINT app_user_active_natal_id_fkey
  FOREIGN KEY (active_natal_id) REFERENCES natal(id) ON DELETE SET NULL;
