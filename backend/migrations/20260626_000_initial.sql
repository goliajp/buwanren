-- unmei initial schema · PostgreSQL 18
-- 用 jsonb / TIMESTAMPTZ / BOOLEAN · 原 SQLite TEXT-as-uuid 保留(降低业务代码改动)
-- 表名 user → app_user(避开 PG 保留字)

-- ─── 扩展(init.sql 通常会建,这里幂等保底)────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── 通用 updated_at 触发器 ────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ───────────────────────────────────────────────────────────────────
-- app_user · 多渠道登录(微信 / Apple / Google / phone / 匿名)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE app_user (
    id                          TEXT PRIMARY KEY,                  -- uuid v4 string
    -- 微信小程序
    wx_mp_openid                TEXT UNIQUE,
    wx_mp_session_key_enc       TEXT,                              -- 加密存储,运行时解密
    -- 微信公众号 / H5 / 开放平台
    wx_unionid                  TEXT UNIQUE,
    wx_h5_openid                TEXT UNIQUE,
    wx_official_openid          TEXT UNIQUE,
    wx_subscribe_official       BOOLEAN NOT NULL DEFAULT FALSE,
    -- 其他渠道
    openid_apple                TEXT UNIQUE,
    openid_google               TEXT UNIQUE,
    phone_country_code          TEXT,
    phone                       TEXT UNIQUE,
    -- 公开信息
    nickname                    TEXT NOT NULL DEFAULT '过客',
    avatar_url                  TEXT,
    -- 端 / 区域
    platform                    TEXT NOT NULL DEFAULT 'web',       -- mini/ios/android/web
    region                      TEXT NOT NULL DEFAULT 'cn',
    locale                      TEXT NOT NULL DEFAULT 'zh-CN',
    -- 业务字段
    active_natal_id             TEXT,
    segment_tags                JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- 状态
    is_anonymous                BOOLEAN NOT NULL DEFAULT TRUE,
    is_banned                   BOOLEAN NOT NULL DEFAULT FALSE,
    -- 时间
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_app_user_platform        ON app_user(platform);
CREATE INDEX idx_app_user_region          ON app_user(region);
CREATE INDEX idx_app_user_last_active     ON app_user(last_active_at DESC);
CREATE INDEX idx_app_user_wx_mp_openid    ON app_user(wx_mp_openid) WHERE wx_mp_openid IS NOT NULL;
CREATE INDEX idx_app_user_wx_unionid      ON app_user(wx_unionid) WHERE wx_unionid IS NOT NULL;


-- ───────────────────────────────────────────────────────────────────
-- natal · 本命输入原料
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE natal (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    label           TEXT NOT NULL DEFAULT '默认',
    year            INTEGER NOT NULL,
    month           INTEGER NOT NULL,
    day             INTEGER NOT NULL,
    hour            INTEGER NOT NULL,
    minute          INTEGER NOT NULL DEFAULT 0,
    tz              DOUBLE PRECISION NOT NULL DEFAULT 8.0,
    gender          TEXT,
    birth_lat       DOUBLE PRECISION,
    birth_lon       DOUBLE PRECISION,
    birth_city      TEXT,
    true_solar_time BOOLEAN NOT NULL DEFAULT FALSE,
    subject_type    TEXT NOT NULL DEFAULT 'person',
    is_default      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_natal_user ON natal(user_id);
CREATE TRIGGER trg_natal_updated BEFORE UPDATE ON natal
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ───────────────────────────────────────────────────────────────────
-- natal_summary · 算力结果桥层(给客户端的极简一句话)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE natal_summary (
    natal_id            TEXT PRIMARY KEY REFERENCES natal(id) ON DELETE CASCADE,
    day_master          TEXT NOT NULL,
    strength_level      TEXT NOT NULL,
    strength_score      INTEGER NOT NULL,
    primary_yongshen    TEXT NOT NULL,
    primary_role        TEXT NOT NULL,
    secondary_yongshen  TEXT,
    avoid_wuxing        JSONB NOT NULL,
    pattern_name        TEXT NOT NULL,
    friendly_hint       TEXT NOT NULL,
    raw_chart           JSONB,
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    mingli_version      TEXT NOT NULL
);


-- ───────────────────────────────────────────────────────────────────
-- naji_record · 每次纳吉快照
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE naji_record (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    natal_id                TEXT REFERENCES natal(id) ON DELETE SET NULL,
    asked_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    asked_year              INTEGER NOT NULL,
    asked_month             INTEGER NOT NULL,
    asked_day               INTEGER NOT NULL,
    asked_hour              INTEGER NOT NULL,
    asked_minute            INTEGER NOT NULL,
    asked_tz                DOUBLE PRECISION NOT NULL,
    location_lat            DOUBLE PRECISION,
    location_lon            DOUBLE PRECISION,
    t_chart                 JSONB,
    gate                    TEXT NOT NULL,
    direction               TEXT NOT NULL,
    gate_explain            TEXT NOT NULL,
    suit_words              JSONB NOT NULL,
    avoid_words             JSONB NOT NULL,
    quote_id                TEXT,
    recommended_product_id  TEXT,
    ai_explanation          TEXT,
    seed                    BIGINT NOT NULL
);
CREATE INDEX idx_naji_user  ON naji_record(user_id, asked_at DESC);
CREATE INDEX idx_naji_asked ON naji_record(asked_at DESC);


-- ───────────────────────────────────────────────────────────────────
-- quote · 语境句库
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE quote (
    id                      TEXT PRIMARY KEY,
    book                    TEXT NOT NULL,
    chapter                 TEXT,
    text                    TEXT NOT NULL,
    length                  INTEGER NOT NULL,
    locale                  TEXT NOT NULL DEFAULT 'zh-CN',
    wuxing_affinity         JSONB NOT NULL DEFAULT '[]'::jsonb,
    time_period_affinity    JSONB NOT NULL DEFAULT '[]'::jsonb,
    gate_affinity           JSONB NOT NULL DEFAULT '[]'::jsonb,
    sensitivity_score       INTEGER NOT NULL DEFAULT 1,
    platform_allow          JSONB NOT NULL DEFAULT '["mini","ios","android","web"]'::jsonb,
    status                  TEXT NOT NULL DEFAULT 'published',
    created_by              TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_quote_status ON quote(status);
CREATE INDEX idx_quote_text_trgm ON quote USING gin (text gin_trgm_ops);


-- ───────────────────────────────────────────────────────────────────
-- yiji_word · 宜/忌词
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE yiji_word (
    id                          TEXT PRIMARY KEY,
    type                        TEXT NOT NULL,
    word                        TEXT NOT NULL,
    category                    TEXT,
    favor_when_main_wuxing      JSONB NOT NULL DEFAULT '[]'::jsonb,
    disfavor_when_avoid_wuxing  JSONB NOT NULL DEFAULT '[]'::jsonb,
    time_period                 JSONB NOT NULL DEFAULT '[]'::jsonb,
    locale                      TEXT NOT NULL DEFAULT 'zh-CN',
    status                      TEXT NOT NULL DEFAULT 'published',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_yiji_type_status ON yiji_word(type, status);


-- ───────────────────────────────────────────────────────────────────
-- gate_word · 八门解释
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE gate_word (
    id              TEXT PRIMARY KEY,
    gate            TEXT NOT NULL,
    direction       TEXT NOT NULL,
    benefit_text    TEXT NOT NULL,
    locale          TEXT NOT NULL DEFAULT 'zh-CN',
    version         INTEGER NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'published',
    UNIQUE(gate, locale, version)
);


-- ───────────────────────────────────────────────────────────────────
-- product · 商品 + 多区域定价 + 多平台
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE product (
    id                          TEXT PRIMARY KEY,
    name                        TEXT NOT NULL,
    sub_title                   TEXT,
    category                    TEXT NOT NULL,
    price_cn                    INTEGER NOT NULL,
    price_hk                    INTEGER,
    price_tw                    INTEGER,
    price_jp                    INTEGER,
    price_us                    INTEGER,
    iap_product_id              TEXT,
    stock                       INTEGER NOT NULL DEFAULT 0,
    image_urls                  JSONB NOT NULL DEFAULT '[]'::jsonb,
    description                 TEXT,
    recommend_when_main_wuxing  JSONB NOT NULL DEFAULT '[]'::jsonb,
    regions_avail               JSONB NOT NULL DEFAULT '["cn","hk","tw"]'::jsonb,
    platforms_avail             JSONB NOT NULL DEFAULT '["mini","ios","android","web"]'::jsonb,
    sales_count                 INTEGER NOT NULL DEFAULT 0,
    status                      TEXT NOT NULL DEFAULT 'on_sale',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_product_status_cat ON product(status, category);
CREATE TRIGGER trg_product_updated BEFORE UPDATE ON product
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ───────────────────────────────────────────────────────────────────
-- order_record · 订单(业务面)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE order_record (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    items           JSONB NOT NULL,
    total_amount    INTEGER NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'CNY',
    status          TEXT NOT NULL DEFAULT 'unpaid',     -- unpaid/paid/shipped/done/cancelled/refunded
    payment_channel TEXT,                                -- wechat_mp/wechat_h5/iap/stripe/alipay
    payment_ref     TEXT,                                -- 三方订单号(快查)
    shipping_addr   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at         TIMESTAMPTZ,
    shipped_at      TIMESTAMPTZ,
    done_at         TIMESTAMPTZ
);
CREATE INDEX idx_order_user   ON order_record(user_id, created_at DESC);
CREATE INDEX idx_order_status ON order_record(status);


-- ───────────────────────────────────────────────────────────────────
-- payment_order · 支付流水(细节面)
-- 跟 order_record 1:N(一笔订单可能多次发起支付)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE payment_order (
    id                  TEXT PRIMARY KEY,                       -- uuid · 我方流水号 = out_trade_no
    order_id            TEXT NOT NULL REFERENCES order_record(id) ON DELETE CASCADE,
    user_id             TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    channel             TEXT NOT NULL,                          -- wechat_mp / wechat_h5 / iap / stripe
    amount              INTEGER NOT NULL,                       -- 分
    currency            TEXT NOT NULL DEFAULT 'CNY',
    -- 三方
    third_party_appid   TEXT,
    third_party_mchid   TEXT,
    third_party_prepay  TEXT,                                   -- prepay_id(微信)
    third_party_txn_id  TEXT,                                   -- transaction_id(成功后回填)
    -- 状态机
    status              TEXT NOT NULL DEFAULT 'pending',        -- pending/success/failed/expired/refunding/refunded
    paid_at             TIMESTAMPTZ,
    refunded_at         TIMESTAMPTZ,
    -- 原文留存(对账)
    request_payload     JSONB,
    notify_payload      JSONB,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pay_order ON payment_order(order_id);
CREATE INDEX idx_pay_user  ON payment_order(user_id, created_at DESC);
CREATE INDEX idx_pay_txn   ON payment_order(third_party_txn_id) WHERE third_party_txn_id IS NOT NULL;
CREATE TRIGGER trg_pay_updated BEFORE UPDATE ON payment_order
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ───────────────────────────────────────────────────────────────────
-- activity · 线下活动
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE activity (
    id                  TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    sub_title           TEXT,
    category            TEXT NOT NULL,
    banner_url          TEXT,
    location            TEXT,
    city                TEXT,
    start_at            TIMESTAMPTZ NOT NULL,
    end_at              TIMESTAMPTZ NOT NULL,
    max_participants    INTEGER NOT NULL DEFAULT 100,
    current_count       INTEGER NOT NULL DEFAULT 0,
    price_cn            INTEGER NOT NULL DEFAULT 0,
    regions_avail       JSONB NOT NULL DEFAULT '["cn"]'::jsonb,
    description         TEXT,
    schedule            JSONB NOT NULL DEFAULT '[]'::jsonb,
    status              TEXT NOT NULL DEFAULT 'open',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_activity_status_cat ON activity(status, category);


CREATE TABLE activity_registration (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    activity_id     TEXT NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'registered',
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checked_in_at   TIMESTAMPTZ,
    UNIQUE(user_id, activity_id)
);


CREATE TABLE badge (
    id              TEXT PRIMARY KEY,
    code            TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    icon_url        TEXT,
    rule_dsl        JSONB NOT NULL,
    points          INTEGER NOT NULL DEFAULT 10,
    status          TEXT NOT NULL DEFAULT 'active'
);


CREATE TABLE user_badge (
    user_id         TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    badge_id        TEXT NOT NULL REFERENCES badge(id) ON DELETE CASCADE,
    earned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    progress        JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY(user_id, badge_id)
);


CREATE TABLE feature_flag (
    code            TEXT PRIMARY KEY,
    default_on      BOOLEAN NOT NULL DEFAULT TRUE,
    by_platform     JSONB NOT NULL DEFAULT '{}'::jsonb,
    by_region       JSONB NOT NULL DEFAULT '{}'::jsonb,
    by_user_segment JSONB NOT NULL DEFAULT '{}'::jsonb,
    description     TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_flag_updated BEFORE UPDATE ON feature_flag
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


CREATE TABLE admin_user (
    id              TEXT PRIMARY KEY,
    email           CITEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    name            TEXT NOT NULL,
    roles           JSONB NOT NULL DEFAULT '["operator"]'::jsonb,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);


CREATE TABLE audit_log (
    id              TEXT PRIMARY KEY,
    admin_id        TEXT REFERENCES admin_user(id) ON DELETE SET NULL,
    action          TEXT NOT NULL,
    target_type     TEXT,
    target_id       TEXT,
    diff            JSONB,
    ip              TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_admin ON audit_log(admin_id, created_at DESC);


-- ───────────────────────────────────────────────────────────────────
-- 微信生态:模板消息 / 订阅消息发送记录(可选,先建表)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE wx_message_log (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    channel         TEXT NOT NULL,                   -- mp_subscribe / official_template
    template_id     TEXT NOT NULL,
    payload         JSONB NOT NULL,
    response        JSONB,
    status          TEXT NOT NULL DEFAULT 'queued',  -- queued / sent / failed
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wx_msg_user ON wx_message_log(user_id, created_at DESC);
