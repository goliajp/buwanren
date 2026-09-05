-- 一味香 · 按月送 —— 拿它换掉「黄金会员」那一档订阅。
--
-- 【为什么换掉会员】。`20260828003_delist_membership.sql` 把黄金会员下架时
-- 写的理由是「买了不会开通订阅，而权益本身也没有代码读」。补上开通那一步
-- 并不能解决第二层:那两项权益是假的 —— 起卦本来就免费无限，
-- AI 解读这个功能不存在。而设计册（v1 与 0830）从头到尾没有出现过「会员」,
-- 这套订阅是商务引擎带来的脚手架，不是产品判断。
-- 0830 §2.1「这一品类的通病，我们逐条不要」头一条就是会员制那种续费跑步机;
-- §1.5.3 的「不催」跟「你的会员还有三天到期」天然对立。
--
-- 【为什么是香】。这个世界里真的每月会发生一次的事，苏合那一屏底下
-- 早就写着:「一支烧二三十分钟 · 十支约够一个月」。同步点香每周一支,
-- 一个月四支;她按你缺的那一味配。十支一盒按月送 ——
-- 它是实物（履约走已有的 shipping）、它长在卖它的人身上（设计册 10.8）、
-- 它不设权益也不到期施压:你只是会收到香。
--
-- 【价】单买一盒十支 ¥88。按月 ¥78 —— 订着的人便宜一成。
-- **不给试用**:实物试用等于白送一盒。
--
-- 【只做按月，不做年付】。年付要把「收钱周期」和「发货周期」拆成两件事,
-- 而 `renew_due` 只有一个周期。为了多一档价钱去造双周期机器不划算 ——
-- 等发货排程真的存在再说。
--
-- 【怎么开通的】。这件商品的 `fulfillment_kind` 是 `shipping`,不是新枚举:
-- 付完钱真实发生的事就是「一盒香寄给你」。开通订阅顺带发生在同一支里 ——
-- 判据是「这个 sku 背后挂着一个套餐」(plan.sku_id)，见 fulfillment.rs。
-- 这样确认屏问地址那一路一个字都不用改:它认的正是 shipping。

INSERT INTO product(id, code, name, sub_title, category, kind, status,
                    description_md, available_regions, available_platforms,
                    fulfillment_kind, sort_weight, audit_note)
VALUES ('prod-incense-monthly', 'INCENSE-MONTHLY', '一味香 · 按月送',
        '每月十支 · 按你缺的那一味配', 'charm', 'subscription', 'listed',
        '苏合每月给你配一盒，十支，按你缺的那一味。烧完了下一盒也就到了。随时可以停。',
        ARRAY['cn'], ARRAY['web','mini','ios','android'], 'shipping', 20,
        '2026-09-05 立:拿它换掉黄金会员那一档订阅')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sku(id, product_id, code, name, stock_kind, status, region)
VALUES ('sku-incense-monthly', 'prod-incense-monthly', 'INCENSE-MONTHLY-1',
        '一味香 · 按月', 'unlimited', 'active', 'cn')
ON CONFLICT (id) DO NOTHING;

INSERT INTO price_book(id, sku_id, currency, price_minor, region, platform,
                       effective_from, status, audit_note)
VALUES ('pb-incense-monthly-cn', 'sku-incense-monthly', 'CNY', 7800, 'cn', 'all',
        NOW(), 'active', '单买一盒十支 ¥88，订着的 ¥78')
ON CONFLICT (id) DO NOTHING;

-- `entitlements_json` 这一列在黄金会员那两档里装的是假权益（unlimited_cast /
-- ai_interpret，两样都没有代码读）。这里装的是一句**真的**:每期发什么。
-- 今天没有代码读它 —— 发的是这个 plan 自己的 sku，而它的商品就是 shipping。
-- 写在这儿是为了让「这一档到底给什么」在库里说得出来，不用去翻代码。
INSERT INTO plan(id, sku_id, name, billing_period, trial_days, grace_days,
                 entitlements_json, cancel_policy, status, region)
VALUES ('plan-incense-monthly', 'sku-incense-monthly', '一味香 · 按月',
        'month', 0, 3, '{"ships": "十支一盒", "per_period": 1}'::jsonb,
        'end_of_period', 'active', 'cn')
ON CONFLICT (id) DO NOTHING;
