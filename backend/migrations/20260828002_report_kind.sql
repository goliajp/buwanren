-- 在售的报告，得说清它出的是【哪一种】册子。
--
-- 2026-08-28 出册子那一版把 kind 写死成 `bazi_deep`，于是三个在售的
-- async_compute 商品里只有一个对得上：
--
--   sku-naji-deep   八字深度报告  → 出八字册子    ✓
--   sku-hehun-double 合婚双盘报告 → 出【自己的】八字册子  ✗ 答非所问
--   sku-naji-single  问事一卦     → 出八字册子    ✗ 答非所问
--
-- 「什么都没有」升级成「给了个不对的」不算进步 —— 后者买家还会以为
-- 这就是他买的东西。
--
-- 所以册子的种类是【商品的属性】，不是履约代码里的常量。
-- CHECK 只管在售的那些：下架的商品不必先想清楚出什么，
-- 但**上架就得想清楚**，否则这一条会在上架那一刻拦住它，
-- 而不是等买家付完钱才发现给不出东西。
ALTER TABLE product ADD COLUMN IF NOT EXISTS report_kind TEXT;

UPDATE product SET report_kind = 'bazi_deep' WHERE id = 'prod-naji-deep';

-- 这两个下架 —— 不是「删掉」，是承认还没做：
--
-- · 合婚：要两个人的生辰，而排盘服务只有 /api/cast 与 /api/bazi，
--   没有合婚接口。收件那一步也没有「填对方生辰」这一屏
-- · 问事一卦：`/v1/naji/spin` 是【免费】的，村子主屏和我家那一屏都靠它。
--   卖一个白送的东西，买家付完钱会发现它一直都在那儿。
--   要卖就得先有一个跟免费版真区分得开的深度版，而那个还不存在
UPDATE product SET status = 'draft',
       audit_note = audit_note || E'\n2026-08-28 下架：还做不出来（合婚要两个人的盘，排盘服务没有这个接口）'
 WHERE id = 'prod-hehun' AND status = 'listed';
UPDATE product SET status = 'draft',
       audit_note = audit_note || E'\n2026-08-28 下架：问签是免费的（/v1/naji/spin），没有区分得开的深度版之前不该卖'
 WHERE id = 'prod-naji-single' AND status = 'listed';

-- 其余在售却没说出哪一种的:一律下架。
-- **不猜**。猜一个种类就是答非所问,而答非所问正是这一版要消灭的东西。
-- 开发库里那三个是真商品(上面逐个处理过);别处（测试库、别人的机器）
-- 还会有别的,按 id 打补丁的迁移到那儿就装不上 —— 而装不上的迁移
-- 表现成「服务起不来」,跟代码坏了长得一模一样。
UPDATE product SET status = 'draft',
       audit_note = audit_note || E'\n2026-08-28 下架：async_compute 却没说出要出哪一种册子'
 WHERE fulfillment_kind = 'async_compute' AND status = 'listed' AND report_kind IS NULL;

ALTER TABLE product DROP CONSTRAINT IF EXISTS product_listed_report_kind;
ALTER TABLE product ADD CONSTRAINT product_listed_report_kind CHECK (
    fulfillment_kind <> 'async_compute'
 OR status <> 'listed'
 OR report_kind IS NOT NULL
);

-- 下架的商品，它的 SKU 也得停。
--
-- 下单只看 `sku.status='active'`，**不看商品上没上架**（`order.rs:112`）。
-- 所以光把商品改成 draft 是句空话:直链照样买得到,然后履约出不来册子、
-- 行留在 pending —— 钱收了,东西没有。那比出一册不对的还糟。
--
-- （下单不看商品状态这件事本身是另一个洞，记在 docs/OPEN.md 里。
--   这里先把这两件真正停掉，不留一条走得通的旁路。）
UPDATE sku SET status = 'inactive'
 WHERE status = 'active'
   AND product_id IN (SELECT id FROM product
                      WHERE fulfillment_kind = 'async_compute' AND status <> 'listed');
