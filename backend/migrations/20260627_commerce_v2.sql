-- unmei commerce v2 · 一次性切版
-- 1. drop 旧 v0.1 商业表(无生产数据,直接 reset)
-- 2. 建 9 域全表(catalog/pricing/promotion/subscription/order/payment/refund/shipment/settlement/risk/finance/横切)
--
-- v0.1 中非商业表 (app_user / naji_record / yiji_word / gate_word / quote / feature_flag / audit_log / wx_message_log /
-- natal / natal_summary / activity / activity_registration / badge / user_badge / admin_user) 保留不动。
-- 删除 v0.1 商业骨架:product / order_record / payment_order(被新 schema 替代,带 CASCADE 清外键)。

----------------------------------------------------------------------
-- §0 公共工具:updated_at trigger fn(所有 v2 表共用)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END $$;

----------------------------------------------------------------------
-- §0.1 drop v0.1 商业骨架(无数据,reset)
----------------------------------------------------------------------
DROP TABLE IF EXISTS payment_order CASCADE;
DROP TABLE IF EXISTS order_record  CASCADE;
DROP TABLE IF EXISTS product       CASCADE;

----------------------------------------------------------------------
-- §1 Catalog · 商品 / SKU
----------------------------------------------------------------------
CREATE TABLE product (
    id              TEXT PRIMARY KEY,                                      -- uuid v4
    code            TEXT NOT NULL UNIQUE,                                  -- 'naji_deep' / 'jade_pendant_01' / ...
    name            TEXT NOT NULL,
    sub_title       TEXT,
    category        TEXT NOT NULL,                                         -- report/manual/charm/course/service/...
    kind            TEXT NOT NULL CHECK (kind IN ('one_shot','subscription','digital_goods','service')),
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','listed','delisted','discontinued')),
    description_md  TEXT NOT NULL DEFAULT '',
    hero_image_url  TEXT,
    gallery_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
    default_locale  TEXT NOT NULL DEFAULT 'zh-CN',
    available_locales   TEXT[] NOT NULL DEFAULT ARRAY['zh-CN']::TEXT[],
    available_regions   TEXT[] NOT NULL DEFAULT ARRAY['cn']::TEXT[],
    available_platforms TEXT[] NOT NULL DEFAULT ARRAY['web','mini','ios','android']::TEXT[],
    required_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,                    -- {natal:true, naji:false, ...}
    fulfillment_kind TEXT NOT NULL DEFAULT 'instant'
                    CHECK (fulfillment_kind IN ('instant','async_compute','manual','shipping')),
    tags            TEXT[] NOT NULL DEFAULT '{}',
    sort_weight     INTEGER NOT NULL DEFAULT 100,
    audit_note      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_product_status_cat ON product(status, category);
CREATE INDEX idx_product_kind_status ON product(kind, status);
CREATE TRIGGER trg_product_updated BEFORE UPDATE ON product
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE sku (
    id              TEXT PRIMARY KEY,
    product_id      TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    code            TEXT NOT NULL UNIQUE,                                  -- 'naji_deep_basic' / 'naji_deep_pro'
    name            TEXT NOT NULL,
    spec_json       JSONB NOT NULL DEFAULT '{}'::jsonb,                    -- {pages:30, ai_uses:5, period_days:30, ...}
    stock_kind      TEXT NOT NULL DEFAULT 'unlimited'
                    CHECK (stock_kind IN ('unlimited','limited','per_user_cap')),
    stock_count     INTEGER,                                               -- limited 时必填
    per_user_cap    INTEGER,                                               -- per_user_cap 时必填
    default_currency TEXT NOT NULL DEFAULT 'CNY',
    weight_g        INTEGER,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('draft','active','inactive','sold_out')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sku_product ON sku(product_id);
CREATE INDEX idx_sku_status ON sku(status);
CREATE TRIGGER trg_sku_updated BEFORE UPDATE ON sku
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

----------------------------------------------------------------------
-- §2 Pricing · 定价
----------------------------------------------------------------------
CREATE TABLE price_book (
    id              TEXT PRIMARY KEY,
    sku_id          TEXT NOT NULL REFERENCES sku(id) ON DELETE CASCADE,
    currency        TEXT NOT NULL,                                         -- CNY/USD/HKD/JPY/EUR
    price_minor     BIGINT NOT NULL CHECK (price_minor >= 0),              -- 分
    region          TEXT NOT NULL DEFAULT 'cn',                            -- cn/hk/tw/jp/us/eu/global
    platform        TEXT NOT NULL DEFAULT 'all',                           -- wx_mp/wx_h5/ios/android/web/all
    effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to    TIMESTAMPTZ,
    tier_kind       TEXT NOT NULL DEFAULT 'flat'
                    CHECK (tier_kind IN ('flat','qty_tier','user_tier')),
    tier_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','scheduled','expired')),
    audit_note      TEXT NOT NULL DEFAULT '',
    created_by_admin_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_price_book_sku_active ON price_book(sku_id, region, platform, effective_from DESC) WHERE status='active';
CREATE INDEX idx_price_book_status     ON price_book(status, effective_from);

CREATE TABLE price_rule (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    scope_sku_ids   TEXT[] NOT NULL DEFAULT '{}',                          -- 空 = 全部
    match_json      JSONB NOT NULL DEFAULT '{}'::jsonb,                    -- {user_tier:'gold', platform:'ios', region:'cn'}
    override_price_minor BIGINT,
    override_pct_bps     INTEGER,                                          -- 9000 = 90%(打 9 折)
    effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to    TIMESTAMPTZ,
    priority        INTEGER NOT NULL DEFAULT 100,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','expired')),
    audit_note      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_price_rule_status_pri ON price_rule(status, priority DESC);

----------------------------------------------------------------------
-- §3 Promotion · 营销
----------------------------------------------------------------------
CREATE TABLE promotion (
    id              TEXT PRIMARY KEY,
    code            TEXT UNIQUE,                                           -- 营销活动 code
    name            TEXT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('pct_off','amount_off','bxgy','bundle','cap_only')),
    match_json      JSONB NOT NULL DEFAULT '{}'::jsonb,                    -- {sku_ids:[], categories:[], user_tier:'new'}
    rule_json       JSONB NOT NULL DEFAULT '{}'::jsonb,                    -- {min_amount:9900, min_qty:1}
    benefit_json    JSONB NOT NULL DEFAULT '{}'::jsonb,                    -- {pct_off_bps:9000} / {amount_off:1000}
    effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to    TIMESTAMPTZ,
    budget_minor    BIGINT,                                                -- 总预算
    used_minor      BIGINT NOT NULL DEFAULT 0,
    per_user_cap    INTEGER,
    total_cap       INTEGER,
    daily_cap       INTEGER,
    stackable       BOOLEAN NOT NULL DEFAULT FALSE,
    priority        INTEGER NOT NULL DEFAULT 100,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','scheduled','active','paused','exhausted','ended')),
    audit_note      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_promotion_status_eff ON promotion(status, effective_from);
CREATE TRIGGER trg_promotion_updated BEFORE UPDATE ON promotion
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE coupon (
    id              TEXT PRIMARY KEY,
    code            TEXT UNIQUE,                                           -- 用户兑换码;NULL = 系统派发
    batch_id        TEXT,
    promotion_id    TEXT REFERENCES promotion(id) ON DELETE SET NULL,
    owner_user_id   TEXT,                                                  -- NULL = 待领取
    benefit_json    JSONB NOT NULL DEFAULT '{}'::jsonb,                    -- 同 promotion.benefit_json
    state           TEXT NOT NULL DEFAULT 'issued'
                    CHECK (state IN ('issued','locked','redeemed','expired','revoked')),
    locked_for_order_id TEXT,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    redeemed_at     TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ NOT NULL,
    audit_note      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_coupon_owner ON coupon(owner_user_id, state);
CREATE INDEX idx_coupon_state_exp ON coupon(state, expires_at);
CREATE INDEX idx_coupon_batch ON coupon(batch_id) WHERE batch_id IS NOT NULL;

CREATE TABLE coupon_redemption (
    id              TEXT PRIMARY KEY,
    coupon_id       TEXT NOT NULL REFERENCES coupon(id),
    order_id        TEXT NOT NULL,                                         -- 软关联(order 表后建);避免循环依赖
    applied_amount_minor BIGINT NOT NULL,
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_coupon_redemp_coupon ON coupon_redemption(coupon_id);
CREATE INDEX idx_coupon_redemp_order  ON coupon_redemption(order_id);

----------------------------------------------------------------------
-- §4 Subscription · 订阅 plan
----------------------------------------------------------------------
CREATE TABLE plan (
    id              TEXT PRIMARY KEY,
    sku_id          TEXT NOT NULL REFERENCES sku(id),
    name            TEXT NOT NULL,
    billing_period  TEXT NOT NULL CHECK (billing_period IN ('month','quarter','year','lifetime')),
    trial_days      INTEGER NOT NULL DEFAULT 0,
    grace_days      INTEGER NOT NULL DEFAULT 3,
    entitlements_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    cancel_policy   TEXT NOT NULL DEFAULT 'end_of_period'
                    CHECK (cancel_policy IN ('immediate','end_of_period')),
    prorate_on_upgrade BOOLEAN NOT NULL DEFAULT TRUE,
    channel_constraints TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],           -- ['iap','gpb','wechat','alipay','stripe']
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','retired')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_plan_updated BEFORE UPDATE ON plan
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE subscription (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    plan_id         TEXT NOT NULL REFERENCES plan(id),
    status          TEXT NOT NULL DEFAULT 'trialing'
                    CHECK (status IN ('trialing','active','past_due','grace','cancelled','expired','paused')),
    source_channel  TEXT NOT NULL,                                         -- 渠道,影响续费与取消入口
    source_payment_id TEXT,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end   TIMESTAMPTZ NOT NULL,
    next_billing_attempt_at TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    cancelled_at    TIMESTAMPTZ,
    upgrade_from_subscription_id TEXT,
    prorate_credit_minor BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_subscription_user      ON subscription(user_id, status);
CREATE INDEX idx_subscription_next_bill ON subscription(next_billing_attempt_at)
    WHERE status IN ('active','past_due','trialing');
CREATE TRIGGER trg_subscription_updated BEFORE UPDATE ON subscription
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE subscription_invoice (
    id              TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL REFERENCES subscription(id) ON DELETE CASCADE,
    period_start    TIMESTAMPTZ NOT NULL,
    period_end      TIMESTAMPTZ NOT NULL,
    amount_minor    BIGINT NOT NULL,
    currency        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','paid','uncollectible','void')),
    payment_id      TEXT,                                                  -- 软关联
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sub_invoice_sub ON subscription_invoice(subscription_id, period_start DESC);
CREATE INDEX idx_sub_invoice_status ON subscription_invoice(status, next_attempt_at) WHERE status='open';

----------------------------------------------------------------------
-- §5 Order · 订单核心
----------------------------------------------------------------------
CREATE TABLE order_record (
    id              TEXT PRIMARY KEY,                                      -- uuid v4
    user_id         TEXT NOT NULL,
    channel_origin  TEXT NOT NULL,                                         -- wx_mp/wx_h5/ios/android/web/admin
    currency        TEXT NOT NULL DEFAULT 'CNY',
    amount_subtotal_minor BIGINT NOT NULL CHECK (amount_subtotal_minor >= 0),
    amount_discount_minor BIGINT NOT NULL DEFAULT 0,
    amount_shipping_minor BIGINT NOT NULL DEFAULT 0,
    amount_tax_minor      BIGINT NOT NULL DEFAULT 0,
    amount_total_minor    BIGINT NOT NULL,
    amount_paid_minor     BIGINT NOT NULL DEFAULT 0,
    amount_refunded_minor BIGINT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'unpaid'
                    CHECK (status IN ('draft','unpaid','paid','fulfilling','done','cancelled','refund_partial','refunded','disputed')),
    source_kind     TEXT NOT NULL DEFAULT 'one_shot'
                    CHECK (source_kind IN ('one_shot','subscription_initial','subscription_renew')),
    source_ref_id   TEXT,                                                  -- 订阅 → subscription.id 或 subscription_invoice.id
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
    paid_at         TIMESTAMPTZ,
    fulfilled_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    cancel_reason   TEXT,
    cancel_actor    TEXT,                                                  -- user/admin/system
    receipt_kind    TEXT NOT NULL DEFAULT 'none'
                    CHECK (receipt_kind IN ('none','receipt','vat_normal','vat_special')),
    receipt_meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    region          TEXT NOT NULL DEFAULT 'cn',
    ip              TEXT,
    ua              TEXT,
    risk_score      INTEGER,
    audit_note      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_user        ON order_record(user_id, created_at DESC);
CREATE INDEX idx_order_status_time ON order_record(status, created_at DESC);
CREATE INDEX idx_order_expires_unpaid ON order_record(expires_at) WHERE status='unpaid';
CREATE INDEX idx_order_source_ref  ON order_record(source_kind, source_ref_id) WHERE source_ref_id IS NOT NULL;
CREATE TRIGGER trg_order_updated BEFORE UPDATE ON order_record
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE order_line (
    id              TEXT PRIMARY KEY,
    order_id        TEXT NOT NULL REFERENCES order_record(id) ON DELETE CASCADE,
    line_no         INTEGER NOT NULL,
    sku_id          TEXT NOT NULL REFERENCES sku(id),
    sku_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- 下单时刻快照,防 SKU 改名/价
    unit_price_minor BIGINT NOT NULL,
    qty             INTEGER NOT NULL CHECK (qty > 0),
    line_subtotal_minor BIGINT NOT NULL,
    applied_promo_ids  TEXT[] NOT NULL DEFAULT '{}',
    applied_coupon_ids TEXT[] NOT NULL DEFAULT '{}',
    applied_discount_minor BIGINT NOT NULL DEFAULT 0,
    fulfillment_status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (fulfillment_status IN ('pending','processing','done','failed')),
    fulfillment_ref JSONB NOT NULL DEFAULT '{}'::jsonb,                    -- {natal_id, report_url, shipment_id}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_line_order ON order_line(order_id);
CREATE UNIQUE INDEX uq_order_line_no ON order_line(order_id, line_no);

CREATE TABLE order_event (
    id              TEXT PRIMARY KEY,
    order_id        TEXT NOT NULL REFERENCES order_record(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL,                                         -- OrderCreated / OrderPaid / OrderFulfilled / ...
    actor_kind      TEXT NOT NULL CHECK (actor_kind IN ('user','system','admin','webhook')),
    actor_id        TEXT,
    before_status   TEXT,
    after_status    TEXT,
    meta_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_event_order ON order_event(order_id, created_at);
CREATE INDEX idx_order_event_kind  ON order_event(kind, created_at);

CREATE TABLE order_meta (
    order_id        TEXT PRIMARY KEY REFERENCES order_record(id) ON DELETE CASCADE,
    shipping_address_json JSONB,
    contact_json    JSONB,
    gift_note       TEXT,
    extra_json      JSONB NOT NULL DEFAULT '{}'::jsonb
);

----------------------------------------------------------------------
-- §6 Payment · 支付
----------------------------------------------------------------------
CREATE TABLE payment (
    id              TEXT PRIMARY KEY,                                      -- 我方 out_trade_no
    order_id        TEXT NOT NULL REFERENCES order_record(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    channel         TEXT NOT NULL,                                         -- wechat_jsapi/wechat_h5/wechat_native/wechat_mp/alipay_wap/alipay_pc/iap/gpb/stripe_card
    amount_minor    BIGINT NOT NULL CHECK (amount_minor > 0),
    currency        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','success','failed','expired','cancelling','cancelled','refunding','refunded_partial','refunded','disputed')),
    channel_txn_id  TEXT,                                                  -- 渠道侧交易号
    channel_user_ref TEXT,                                                 -- openid / apple_account_token / stripe_pi_id
    paid_at         TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    failure_code    TEXT,
    failure_msg     TEXT,
    metadata_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    audit_note      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payment_order      ON payment(order_id);
CREATE INDEX idx_payment_user       ON payment(user_id, created_at DESC);
CREATE INDEX idx_payment_status     ON payment(status, created_at DESC);
CREATE INDEX idx_payment_channel_txn ON payment(channel, channel_txn_id) WHERE channel_txn_id IS NOT NULL;
CREATE INDEX idx_payment_pending_expire ON payment(expires_at) WHERE status='pending';
CREATE TRIGGER trg_payment_updated BEFORE UPDATE ON payment
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE payment_attempt (
    id              TEXT PRIMARY KEY,
    payment_id      TEXT NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
    attempt_no      INTEGER NOT NULL,
    request_payload_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    latency_ms      INTEGER,
    error_kind      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payment_attempt_pay ON payment_attempt(payment_id, attempt_no);

CREATE TABLE payment_event (
    id              TEXT PRIMARY KEY,
    payment_id      TEXT NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL,                                         -- Created / SucceededByCallback / SucceededByQuery / Failed / Refunded
    channel         TEXT NOT NULL,
    channel_event_id TEXT,                                                 -- 渠道侧事件 id,跨表唯一
    payload_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_payment_event_channel_eid ON payment_event(channel, channel_event_id) WHERE channel_event_id IS NOT NULL;
CREATE INDEX idx_payment_event_payment ON payment_event(payment_id, received_at);

----------------------------------------------------------------------
-- §7 Refund · 退款
----------------------------------------------------------------------
CREATE TABLE refund (
    id              TEXT PRIMARY KEY,
    order_id        TEXT NOT NULL REFERENCES order_record(id),
    payment_id      TEXT NOT NULL REFERENCES payment(id),
    amount_minor    BIGINT NOT NULL CHECK (amount_minor > 0),
    currency        TEXT NOT NULL,
    reason_code     TEXT NOT NULL,                                         -- user_request / quality_issue / dup / fraud / system_error
    reason_text     TEXT NOT NULL DEFAULT '',
    actor_kind      TEXT NOT NULL CHECK (actor_kind IN ('user','admin','system')),
    actor_id        TEXT,
    status          TEXT NOT NULL DEFAULT 'requested'
                    CHECK (status IN ('requested','approved','processing','success','failed','cancelled')),
    channel_refund_id TEXT,
    approved_at     TIMESTAMPTZ,
    approved_by_admin_id TEXT,
    processed_at    TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    failure_code    TEXT,
    failure_msg     TEXT,
    audit_note      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refund_order   ON refund(order_id);
CREATE INDEX idx_refund_payment ON refund(payment_id);
CREATE INDEX idx_refund_status  ON refund(status, created_at DESC);
CREATE TRIGGER trg_refund_updated BEFORE UPDATE ON refund
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

----------------------------------------------------------------------
-- §8 Shipment · 物流
----------------------------------------------------------------------
CREATE TABLE shipment (
    id              TEXT PRIMARY KEY,
    order_id        TEXT NOT NULL REFERENCES order_record(id) ON DELETE CASCADE,
    order_line_ids  TEXT[] NOT NULL DEFAULT '{}',
    carrier_code    TEXT NOT NULL DEFAULT 'manual',                        -- sf/jd/zto/yto/yunda/ems/manual/...
    tracking_no     TEXT,
    recipient_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    shipping_method TEXT NOT NULL DEFAULT 'standard'
                    CHECK (shipping_method IN ('standard','express','overnight','pickup')),
    weight_g        INTEGER,
    dim_cm_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          TEXT NOT NULL DEFAULT 'preparing'
                    CHECK (status IN ('preparing','picked_up','in_transit','out_for_delivery','delivered','exception','returning','returned','cancelled')),
    picked_up_at    TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    cost_minor      BIGINT,                                                -- 承运商账单价格(财务用)
    cost_currency   TEXT,
    carrier_meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    audit_note      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_shipment_order   ON shipment(order_id);
CREATE INDEX idx_shipment_status  ON shipment(status, created_at DESC);
CREATE INDEX idx_shipment_track   ON shipment(tracking_no, carrier_code) WHERE tracking_no IS NOT NULL;
CREATE TRIGGER trg_shipment_updated BEFORE UPDATE ON shipment
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE shipment_trace_event (
    id              TEXT PRIMARY KEY,
    shipment_id     TEXT NOT NULL REFERENCES shipment(id) ON DELETE CASCADE,
    event_at        TIMESTAMPTZ NOT NULL,
    event_kind      TEXT NOT NULL,                                         -- picked_up/arrived_at_sort_facility/departed/out_for_delivery/delivered/failed_delivery/returned/exception
    location        TEXT,
    description     TEXT NOT NULL DEFAULT '',
    raw_source      TEXT NOT NULL,                                         -- kuaidi100 / kdniao / sf_direct / aftership / manual
    raw_event_id    TEXT,                                                  -- 第三方事件唯一 id(去重)
    raw_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trace_shipment ON shipment_trace_event(shipment_id, event_at DESC);
CREATE UNIQUE INDEX uq_trace_dedup ON shipment_trace_event(raw_source, raw_event_id) WHERE raw_event_id IS NOT NULL;

----------------------------------------------------------------------
-- §9 Settlement · 对账
----------------------------------------------------------------------
CREATE TABLE recon_batch (
    id              TEXT PRIMARY KEY,
    channel         TEXT NOT NULL,
    batch_date      DATE NOT NULL,
    source          TEXT NOT NULL DEFAULT 'channel_pulled'
                    CHECK (source IN ('channel_pulled','internal_snapshot')),
    total_count     INTEGER NOT NULL DEFAULT 0,
    total_amount_minor BIGINT NOT NULL DEFAULT 0,
    currency        TEXT NOT NULL DEFAULT 'CNY',
    status          TEXT NOT NULL DEFAULT 'pulled'
                    CHECK (status IN ('pulled','parsed','matched','has_discrepancy','resolved','closed')),
    pulled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    matched_at      TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    raw_file_uri    TEXT
);
CREATE UNIQUE INDEX uq_recon_batch ON recon_batch(channel, batch_date, source);

CREATE TABLE recon_record (
    id              TEXT PRIMARY KEY,
    batch_id        TEXT NOT NULL REFERENCES recon_batch(id) ON DELETE CASCADE,
    channel_txn_id  TEXT,
    channel_amount_minor BIGINT,
    channel_status  TEXT,
    matched_payment_id TEXT REFERENCES payment(id),
    match_state     TEXT NOT NULL DEFAULT 'matched'
                    CHECK (match_state IN ('matched','missing_in_channel','missing_in_internal','amount_mismatch','status_mismatch')),
    resolved_by_admin_id TEXT,
    resolved_action TEXT,
    resolved_at     TIMESTAMPTZ
);
CREATE INDEX idx_recon_record_batch ON recon_record(batch_id);
CREATE INDEX idx_recon_record_txn   ON recon_record(channel_txn_id) WHERE channel_txn_id IS NOT NULL;
CREATE INDEX idx_recon_record_state ON recon_record(match_state) WHERE match_state <> 'matched';

----------------------------------------------------------------------
-- §10 Risk · 风控
----------------------------------------------------------------------
CREATE TABLE risk_rule (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('pre_order','pre_pay','post_pay','refund','login')),
    expression      TEXT NOT NULL,                                         -- 简易 DSL
    action          TEXT NOT NULL CHECK (action IN ('allow','challenge','block','review','log_only')),
    priority        INTEGER NOT NULL DEFAULT 100,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','retired')),
    effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to    TIMESTAMPTZ,
    audit_note      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_risk_rule_status ON risk_rule(status, kind, priority DESC);
CREATE TRIGGER trg_risk_rule_updated BEFORE UPDATE ON risk_rule
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE risk_event (
    id              TEXT PRIMARY KEY,
    kind            TEXT NOT NULL,
    user_id         TEXT,
    order_id        TEXT,
    payment_id      TEXT,
    matched_rule_ids TEXT[] NOT NULL DEFAULT '{}',
    decided_action  TEXT NOT NULL,
    details_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    decided_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_risk_event_user   ON risk_event(user_id, decided_at DESC);
CREATE INDEX idx_risk_event_action ON risk_event(decided_action, decided_at DESC);

CREATE TABLE risk_case (
    id              TEXT PRIMARY KEY,
    kind            TEXT NOT NULL,
    severity        TEXT NOT NULL DEFAULT 'low'
                    CHECK (severity IN ('low','med','high','critical')),
    involved_user_ids   TEXT[] NOT NULL DEFAULT '{}',
    involved_order_ids  TEXT[] NOT NULL DEFAULT '{}',
    state           TEXT NOT NULL DEFAULT 'open'
                    CHECK (state IN ('open','investigating','resolved','false_positive')),
    assigned_admin_id TEXT,
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ,
    audit_note      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_risk_case_state ON risk_case(state, severity);

----------------------------------------------------------------------
-- §11 Finance · 复式记账
----------------------------------------------------------------------
CREATE TABLE account_chart (
    code            TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('asset','liability','equity','revenue','expense')),
    parent_code     TEXT REFERENCES account_chart(code),
    currency_constraint TEXT,                                              -- NULL = 任意币种;'CNY' = 必须 CNY
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE accounting_period (
    id              TEXT PRIMARY KEY,
    kind            TEXT NOT NULL CHECK (kind IN ('day','month','quarter','year')),
    year            INTEGER NOT NULL,
    sub             INTEGER NOT NULL,                                      -- month: 1-12; quarter: 1-4; year: 0
    state           TEXT NOT NULL DEFAULT 'open'
                    CHECK (state IN ('open','closing','closed')),
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ,
    closed_by_admin_id TEXT
);
CREATE UNIQUE INDEX uq_accounting_period ON accounting_period(kind, year, sub);

CREATE TABLE journal_entry (
    id              TEXT PRIMARY KEY,
    period_id       TEXT NOT NULL REFERENCES accounting_period(id),
    description     TEXT NOT NULL,
    posted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    posted_by_kind  TEXT NOT NULL DEFAULT 'system'
                    CHECK (posted_by_kind IN ('system','admin')),
    posted_by_id    TEXT,
    business_kind   TEXT NOT NULL,                                         -- payment / refund / order / subscription / manual / shipment_cost
    business_ref_id TEXT,
    is_reversal_of  TEXT REFERENCES journal_entry(id),
    status          TEXT NOT NULL DEFAULT 'posted'
                    CHECK (status IN ('draft','posted','reversed'))
);
CREATE INDEX idx_journal_period   ON journal_entry(period_id);
CREATE INDEX idx_journal_business ON journal_entry(business_kind, business_ref_id);

CREATE TABLE journal_line (
    id              TEXT PRIMARY KEY,
    entry_id        TEXT NOT NULL REFERENCES journal_entry(id) ON DELETE CASCADE,
    line_no         INTEGER NOT NULL,
    account_code    TEXT NOT NULL REFERENCES account_chart(code),
    debit_minor     BIGINT NOT NULL DEFAULT 0 CHECK (debit_minor >= 0),
    credit_minor    BIGINT NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
    currency        TEXT NOT NULL,
    ref_kind        TEXT,
    ref_id          TEXT,
    note            TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_journal_line_entry ON journal_line(entry_id);
CREATE INDEX idx_journal_line_acc   ON journal_line(account_code, entry_id);

----------------------------------------------------------------------
-- §12 横切 · outbox + audit 扩展
----------------------------------------------------------------------
CREATE TABLE outbox_event (
    id              TEXT PRIMARY KEY,
    kind            TEXT NOT NULL,                                         -- OrderPaid / RefundCompleted / ...
    aggregate_kind  TEXT NOT NULL,                                         -- order/payment/refund/shipment/subscription/coupon
    aggregate_id    TEXT NOT NULL,
    payload_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','dispatched','failed','dropped')),
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_outbox_pending ON outbox_event(next_attempt_at) WHERE status='pending';
CREATE INDEX idx_outbox_aggregate ON outbox_event(aggregate_kind, aggregate_id, created_at);

----------------------------------------------------------------------
-- §13 idempotency 记录(辅助 KEVY 持久回流)
----------------------------------------------------------------------
CREATE TABLE idempotency_log (
    key             TEXT PRIMARY KEY,
    user_id         TEXT,
    method          TEXT NOT NULL,
    path            TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    response_body   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);
CREATE INDEX idx_idem_expire ON idempotency_log(expires_at);
-- unmei commerce v2 · seed
-- 科目表(accounting chart)+ 默认风控规则 + 当前会计期间

----------------------------------------------------------------------
-- §1 会计科目表(中式 + 适应 SaaS 简版)
----------------------------------------------------------------------
INSERT INTO account_chart (code, name, kind, parent_code, currency_constraint) VALUES
  -- 资产
  ('1001', '银行存款', 'asset', NULL, NULL),
  ('1002', '第三方在途款', 'asset', NULL, NULL),
  ('1101', '应收账款', 'asset', NULL, NULL),
  -- 负债
  ('2001', '应付账款', 'liability', NULL, NULL),
  ('2002', '应付承运商', 'liability', '2001', NULL),
  ('2101', '预收账款', 'liability', NULL, NULL),
  -- 权益
  ('3001', '实收资本', 'equity', NULL, NULL),
  ('3002', '留存收益', 'equity', NULL, NULL),
  -- 收入
  ('4001', '主营业务收入', 'revenue', NULL, NULL),
  ('4002', '运费收入', 'revenue', NULL, NULL),
  ('4003', '订阅收入', 'revenue', '4001', NULL),
  -- 费用
  ('5001', '渠道手续费', 'expense', NULL, NULL),
  ('5002', '物流费用', 'expense', NULL, NULL),
  ('5003', '退款损失', 'expense', NULL, NULL)
ON CONFLICT (code) DO NOTHING;

----------------------------------------------------------------------
-- §2 当前会计期间(本月 + 本年)
----------------------------------------------------------------------
INSERT INTO accounting_period (id, kind, year, sub, state) VALUES
  ('period-2026-06',  'month',   2026, 6, 'open'),
  ('period-2026-Q2',  'quarter', 2026, 2, 'open'),
  ('period-2026',     'year',    2026, 0, 'open')
ON CONFLICT (kind, year, sub) DO NOTHING;

----------------------------------------------------------------------
-- §3 基础风控规则(可在 webadmin /risk 改)
----------------------------------------------------------------------
INSERT INTO risk_rule (id, name, kind, expression, action, priority, status, audit_note) VALUES
  ('rule-001', '新人大额单审核',     'pre_pay', 'amount > 100000 AND user.age_days < 7', 'review',   100, 'active', '风控基础规则'),
  ('rule-002', '单用户支付速率限制', 'pre_pay', 'count_in_window(payment, user_id, 1h) > 5', 'challenge', 90, 'active', ''),
  ('rule-003', '退款滥用拦截',       'refund',  'refund_count_in_30d(user_id) > 5', 'review', 100, 'active', ''),
  ('rule-004', '反洗钱阈值',         'pre_pay', 'amount > 5000000', 'review', 200, 'active', '单笔 > ¥50000 自动 review')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §4 测试商品(可在 webadmin /products 看到 + 编辑)
----------------------------------------------------------------------
INSERT INTO product (id, code, name, sub_title, category, kind, status, description_md, fulfillment_kind, tags, sort_weight) VALUES
  ('prod-naji-deep', 'naji_deep', '八字深度报告', '日主旺衰 + 格局 + 用神 + 大运 + 流年', 'report', 'one_shot', 'listed',
   '基于经审计的 21 叶算力源,出一份完整的八字结构分析报告。', 'async_compute', ARRAY['八字','本命','热门'], 90),
  ('prod-hehun', 'hehun_double', '合婚双盘报告', '两位本命叠加 · 互补指数', 'report', 'one_shot', 'listed',
   '基于双方八字结构计算互补与互克,客观信号呈现,**非吉凶断言**。', 'async_compute', ARRAY['合婚','合盘'], 80),
  ('prod-naji-single', 'naji_single', '问事一卦', '梅花易数 / 六爻 / 奇门任选', 'report', 'one_shot', 'listed',
   '当下问事起卦,五分钟出结果。', 'async_compute', ARRAY['问事','卦'], 70),
  ('prod-jade-pendant', 'jade_pendant_01', '和田玉葫芦坠', '消炁化煞 · 配本命五行', 'charm', 'one_shot', 'listed',
   '实物商品,顺丰发货,3-5 日达。', 'shipping', ARRAY['实物','配饰'], 60),
  ('prod-membership-gold', 'membership_gold', '黄金会员', '月卡 / 年卡 · 无限排盘 + AI 深度解读', 'service', 'subscription', 'listed',
   '订阅会员,可随时取消;本周期结束停止续费,本周期不退。', 'instant', ARRAY['会员','订阅'], 100)
ON CONFLICT (code) DO NOTHING;

----------------------------------------------------------------------
-- §5 测试 SKU + 定价
----------------------------------------------------------------------
INSERT INTO sku (id, product_id, code, name, spec_json, stock_kind, default_currency, status) VALUES
  ('sku-naji-deep', 'prod-naji-deep', 'naji_deep_default', '八字深度报告 · 默认版',
   '{"pages":30, "ai_uses":3, "ttl_days":365}'::jsonb, 'unlimited', 'CNY', 'active'),
  ('sku-hehun-double', 'prod-hehun', 'hehun_double_default', '合婚双盘报告',
   '{"pages":24}'::jsonb, 'unlimited', 'CNY', 'active'),
  ('sku-naji-single', 'prod-naji-single', 'naji_single_default', '问事一卦',
   '{"validity_days":7}'::jsonb, 'unlimited', 'CNY', 'active'),
  ('sku-jade-pendant', 'prod-jade-pendant', 'jade_pendant_01_default', '和田玉葫芦坠(自选五行)',
   '{"materials":["jade"], "weight_g":15}'::jsonb, 'limited', 'CNY', 'active'),
  ('sku-mg-month', 'prod-membership-gold', 'membership_gold_month', '黄金会员 · 月卡',
   '{"period":"month","entitlements":["unlimited_cast","ai_interpret_20"]}'::jsonb, 'unlimited', 'CNY', 'active'),
  ('sku-mg-year',  'prod-membership-gold', 'membership_gold_year', '黄金会员 · 年卡(送 2 月)',
   '{"period":"year","entitlements":["unlimited_cast","ai_interpret_unlimited"]}'::jsonb, 'unlimited', 'CNY', 'active')
ON CONFLICT (code) DO NOTHING;

UPDATE sku SET stock_count = 50 WHERE id='sku-jade-pendant';

INSERT INTO price_book (id, sku_id, currency, price_minor, region, platform, status, audit_note) VALUES
  ('pb-naji-deep-cn',     'sku-naji-deep',     'CNY', 19900,  'cn', 'all', 'active', '默认价'),
  ('pb-hehun-double-cn',  'sku-hehun-double',  'CNY', 26800,  'cn', 'all', 'active', '默认价'),
  ('pb-naji-single-cn',   'sku-naji-single',   'CNY', 4900,   'cn', 'all', 'active', '默认价'),
  ('pb-jade-pendant-cn',  'sku-jade-pendant',  'CNY', 39800,  'cn', 'all', 'active', '默认价'),
  ('pb-mg-month-cn',      'sku-mg-month',      'CNY', 4800,   'cn', 'all', 'active', '月卡 ¥48'),
  ('pb-mg-year-cn',       'sku-mg-year',       'CNY', 49800,  'cn', 'all', 'active', '年卡 ¥498 (送2月)')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §6 默认订阅 plan
----------------------------------------------------------------------
INSERT INTO plan (id, sku_id, name, billing_period, trial_days, grace_days, entitlements_json, cancel_policy, channel_constraints) VALUES
  ('plan-mg-month', 'sku-mg-month', '黄金会员月卡', 'month', 7, 3,
   '{"unlimited_cast":true,"ai_interpret":20}'::jsonb, 'end_of_period',
   ARRAY['wechat_jsapi','wechat_mp','alipay_wap','iap','gpb','stripe_card']),
  ('plan-mg-year',  'sku-mg-year',  '黄金会员年卡', 'year',  0, 7,
   '{"unlimited_cast":true,"ai_interpret":-1}'::jsonb, 'end_of_period',
   ARRAY['wechat_jsapi','wechat_mp','alipay_wap','iap','gpb','stripe_card'])
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- §7 默认 promotion(新人首单 8 折)
----------------------------------------------------------------------
INSERT INTO promotion (id, code, name, kind, match_json, rule_json, benefit_json, effective_from, effective_to, status, audit_note) VALUES
  ('promo-new-user-20off', 'NEWUSER20', '新人首单立减 20%',
   'pct_off',
   '{"user_tier":"new","new_user_only":true}'::jsonb,
   '{"min_amount":4900}'::jsonb,
   '{"pct_off_bps":2000,"max_off_minor":10000}'::jsonb,
   '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z',
   'active', '新人首单 8 折,封顶减 ¥100')
ON CONFLICT (id) DO NOTHING;
