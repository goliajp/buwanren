-- 两件实物配上商品图（2026-09-02 第四轮评审:第一次来的人 + 视觉，两路各自报）
--
-- ¥29 的香、¥398 的和田玉葫芦坠都是【寄到家的实物】，而商品页上唯一的图
-- 是店主的头像 —— 电商漏斗里最该有图的地方是空的，这比任何排版问题
-- 都更像「没做完」。
--
-- `hero_image_url` 这个字段一直在，后端 `SELECT *` 也一直把它带出来 ——
-- 只是没人填、页面也没接。字段做了、屏上没有:这个仓反复出现的那个形状。
--
-- 图是像素画（24×24 ×5 = 120×120），跟四十位村民、六间屋、村子同一套语言;
-- 生成在 rooms/tools/export-tabicons.mjs 里，跟底栏图标与徽章一处。
--
-- 【说明书那一档不配图】。它没有实物，配张图等于暗示会寄东西给你。
UPDATE product SET hero_image_url = '/images/goods-incense.png'
 WHERE id = 'prod-suhe-incense';
UPDATE product SET hero_image_url = '/images/goods-jade.png'
 WHERE id = 'prod-jade-pendant';

-- ── 测试残留不该以「在架」的身份留着 ──────────────────────────
--
-- 加完「实物要有商品图」那条判据之后，746 件在架实物里有 744 件没图 ——
-- 而它们【全部】是 `prod-t*` / `prd-t*`，也就是集成测试跑出来的夹具。
-- （开发库与测试库共用过一段时间，见 docs/FINDING-2026-08-22-shared-test-db.md。）
--
-- 这些夹具以 `listed` 的身份留在库里有两个真实后果:
--   · 任何按「在架」筛的门禁都要在几千件噪音里找那几件真商品 ——
--     实物那条判据一上来就报 744 处，真问题淹在里面
--   · 商品列表接口按 `status='listed'` 取数，货架上混着「测试商品」
--
-- 下架，不删:删了会连带动订单与支付的外键，而那些订单是真实测试过的账。
-- 下架之后它们仍然查得到、对得上账，只是不在货架上。
UPDATE product SET status = 'draft'
 WHERE status = 'listed'
   AND (id LIKE 'prod-t%' OR id LIKE 'prd-t%');

-- ── 御守也一样:每位村民只需要一件在架的商品 ────────────────────
--
-- 名册那一段用的是 `DISTINCT ON (villager_id) … ORDER BY sort_weight DESC, id`
-- （village.rs:331）—— 每位只取一件。而库里在架的居住商品有 838 件，
-- 阿云一个人名下 334 件，**全部是 prod-oma-t* 的测试夹具**。
-- 也就是说 834 件从来没有人访问过，它们只做两件事:
--   · 把任何按「在架」筛的门禁淹在噪音里
--   · 给「同一张单里两个 sku 指着同一位村民」那个洞提供土壤
--     （见 20260902 那批 order.rs 的守卫）
--
-- 留下每位村民【名册真会选中的那一件】，其余下架。判据跟接口一字不差，
-- 不另发明一套 —— 两处对不上的话，下架的正好是在卖的那件。
UPDATE product SET status = 'draft'
 WHERE status = 'listed' AND category = 'omamori'
   AND id NOT IN (
     SELECT DISTINCT ON (k.villager_id) p.id
       FROM sku k JOIN product p ON p.id = k.product_id
      WHERE k.villager_id IS NOT NULL AND k.status = 'active'
        AND p.status = 'listed' AND p.category = 'omamori'
      ORDER BY k.villager_id, p.sort_weight DESC, p.id
   );
