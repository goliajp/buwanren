-- 黄金会员下架 —— 买了什么也不会发生。
--
-- 2026-08-28 实测走了一遍：下单 → 付款 → 订单翻 `done`，
-- `fulfillment_ref` 写着 `{"kind":"instant","mocked":true}`，
-- 而 `subscription` 表**一条没多**。库里 2425 条订阅全是种子造的，
-- 通过下单产生的是 0 条。
--
-- 根因有两层，接上其中一层不够：
--
-- 1. 没有开通这一步。`unmei_app::subscription` 只有 cancel / renew_due /
--    record_renewal_failure —— **没有 create**。履约按 `fulfillment_kind`
--    分支，而会员是 `instant`，于是跟别的即时商品走同一支：标 done，完事
-- 2. 权益本身是空的。`plan.entitlements_json` 写着「无限起卦」和
--    「AI 解读 20 次」，而这两样在整个后端只有一个结构体字段承接它，
--    **没有任何代码读**。起卦（`/v1/naji/spin`）本来就免费无限；
--    AI 解读那个功能还不存在
--
-- 所以只补第 1 层是没用的：订阅记录建起来了，买家还是什么都没多。
-- 跟「问事一卦」同一个处理 —— **先下架，等权益真的存在再卖**。
--
-- 不动 `plan`，也不动已有的订阅：老的继续续费，只是新的买不到。
-- 整块订阅代码（plan / invoice / dunning / renew / cancel）留着，
-- 它不是死的，是还没接上入口。
UPDATE product SET status = 'draft',
       audit_note = audit_note || E'\n2026-08-28 下架：买了不会开通订阅（没有 create），而权益本身也没有代码读'
 WHERE id = 'prod-membership-gold' AND status = 'listed';

-- 商品下架是句空话，除非 SKU 也停：建单只看 `sku.status='active'`，
-- 不看商品上没上架（order.rs:112，记在 docs/OPEN.md #16）
UPDATE sku SET status = 'inactive'
 WHERE status = 'active' AND product_id = 'prod-membership-gold';
