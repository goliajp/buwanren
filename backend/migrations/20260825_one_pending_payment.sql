-- 一张订单同时只许有一笔待付的支付。
--
-- 在这之前，同一张未付订单连点两次「去支付」会建出两笔独立的 pending，
-- 每笔都是【全额】（2026-08-23 实测：应付 19900 的单子上两笔各 19900）。
-- 幂等键挡不住它 —— 客户端每次点击生成一个新键，两次点击就是两次新操作。
--
-- 这道唯一索引是把不变式交给数据库，而不是交给「先查再写」：
-- 两个请求同时进来时，先查再写会双双查到「没有 pending」然后双双插入。
-- 索引让第二笔插不进去，无论应用层怎么写。
--
-- 只管 pending。success / expired / failed 的历史记录一张单上可以有很多笔，
-- 那是账，不该被这条约束碰。

-- 建索引之前先把已经存在的重复收拾掉：每张单只留最新那一笔，
-- 其余标成 expired 并写明为什么 —— 直接删会把账抹掉。
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY order_id ORDER BY created_at DESC, id DESC) AS rn
  FROM payment WHERE status = 'pending'
)
UPDATE payment p
   SET status = 'expired',
       audit_note = CASE WHEN p.audit_note = '' THEN '' ELSE p.audit_note || ' | ' END
                    || '20260825 一单一笔待付：同一张单上更早的重复 pending，建唯一索引前统一过期'
  FROM ranked r
 WHERE p.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX uq_payment_one_pending ON payment(order_id) WHERE status = 'pending';
