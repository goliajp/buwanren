-- unmei initial schema · SQLite 商业级 baseline
-- 11 业务表 + 1 admin 表;字段 JSON 用 TEXT(SQLite 1.41+ jsonb 也 OK)

PRAGMA foreign_keys = ON;

-- ───────────────────────────────────────────────────────────────────
-- user · 多渠道登录,客户端 region/platform 标记
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user (
    id              TEXT PRIMARY KEY,                  -- uuid v4
    openid_wx       TEXT UNIQUE,
    openid_apple    TEXT UNIQUE,
    openid_google   TEXT UNIQUE,
    phone           TEXT UNIQUE,
    nickname        TEXT NOT NULL DEFAULT '过客',
    avatar_url      TEXT,
    platform        TEXT NOT NULL DEFAULT 'web',       -- mini/ios/android/web
    region          TEXT NOT NULL DEFAULT 'cn',        -- cn/hk/tw/jp/us/eu/other
    locale          TEXT NOT NULL DEFAULT 'zh-CN',
    active_natal_id TEXT,
    segment_tags    TEXT NOT NULL DEFAULT '[]',        -- json array
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    last_active_at  TEXT NOT NULL DEFAULT (datetime('now')),
    is_anonymous    INTEGER NOT NULL DEFAULT 1,
    is_banned       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_user_platform ON user(platform);
CREATE INDEX idx_user_region ON user(region);
CREATE INDEX idx_user_last_active ON user(last_active_at);

-- ───────────────────────────────────────────────────────────────────
-- natal · 本命输入原料,一个用户可有多张盘
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS natal (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    label           TEXT NOT NULL DEFAULT '默认',
    year            INTEGER NOT NULL,
    month           INTEGER NOT NULL,
    day             INTEGER NOT NULL,
    hour            INTEGER NOT NULL,
    minute          INTEGER NOT NULL DEFAULT 0,
    tz              REAL NOT NULL DEFAULT 8.0,
    gender          TEXT,                              -- male/female/unknown
    birth_lat       REAL,
    birth_lon       REAL,
    birth_city      TEXT,
    true_solar_time INTEGER NOT NULL DEFAULT 0,
    subject_type    TEXT NOT NULL DEFAULT 'person',
    is_default      INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_natal_user ON natal(user_id);

-- ───────────────────────────────────────────────────────────────────
-- natal_summary · 预算缓存(给客户端的「本命简介」一句话)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS natal_summary (
    natal_id            TEXT PRIMARY KEY REFERENCES natal(id) ON DELETE CASCADE,
    day_master          TEXT NOT NULL,         -- 「己土」
    strength_level      TEXT NOT NULL,         -- 「偏强」
    strength_score      INTEGER NOT NULL,      -- 内部用
    primary_yongshen    TEXT NOT NULL,         -- 「木」
    primary_role        TEXT NOT NULL,         -- 「官杀」
    secondary_yongshen  TEXT,
    avoid_wuxing        TEXT NOT NULL,         -- json '["火","土"]'
    pattern_name        TEXT NOT NULL,         -- 「暗食神格」(内部)
    friendly_hint       TEXT NOT NULL,         -- 「东方/青绿/文教...」
    raw_chart           TEXT,                  -- 完整 bazi json(内部 audit)
    computed_at         TEXT NOT NULL DEFAULT (datetime('now')),
    mingli_version      TEXT NOT NULL          -- 算力版本,变化触发重算
);

-- ───────────────────────────────────────────────────────────────────
-- naji_record · 每次纳吉快照
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS naji_record (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    natal_id                TEXT REFERENCES natal(id) ON DELETE SET NULL,
    asked_at                TEXT NOT NULL DEFAULT (datetime('now')),
    asked_year              INTEGER NOT NULL,
    asked_month             INTEGER NOT NULL,
    asked_day               INTEGER NOT NULL,
    asked_hour              INTEGER NOT NULL,
    asked_minute            INTEGER NOT NULL,
    asked_tz                REAL NOT NULL,
    location_lat            REAL,
    location_lon            REAL,
    t_chart                 TEXT,                       -- 内部 qimen+bazi json
    gate                    TEXT NOT NULL,
    direction               TEXT NOT NULL,
    gate_explain            TEXT NOT NULL,
    suit_words              TEXT NOT NULL,              -- json array
    avoid_words             TEXT NOT NULL,              -- json array
    quote_id                TEXT REFERENCES quote(id) ON DELETE SET NULL,
    recommended_product_id  TEXT REFERENCES product(id) ON DELETE SET NULL,
    ai_explanation          TEXT,                       -- 异步生成
    seed                    INTEGER NOT NULL
);
CREATE INDEX idx_naji_user ON naji_record(user_id, asked_at DESC);
CREATE INDEX idx_naji_asked ON naji_record(asked_at);

-- ───────────────────────────────────────────────────────────────────
-- quote · 语境句库(《庄子》《道德经》等)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote (
    id                  TEXT PRIMARY KEY,
    book                TEXT NOT NULL,            -- 「庄子」
    chapter             TEXT,                     -- 「列御寇」
    text                TEXT NOT NULL,
    length              INTEGER NOT NULL,
    locale              TEXT NOT NULL DEFAULT 'zh-CN',
    wuxing_affinity     TEXT NOT NULL DEFAULT '[]',  -- json: ["木","水"]
    time_period_affinity TEXT NOT NULL DEFAULT '[]', -- json: ["夜","秋"]
    gate_affinity       TEXT NOT NULL DEFAULT '[]',  -- json: ["休门"]
    sensitivity_score   INTEGER NOT NULL DEFAULT 1,  -- 0-10
    platform_allow      TEXT NOT NULL DEFAULT '["mini","ios","android","web"]',
    status              TEXT NOT NULL DEFAULT 'published', -- draft/published/archived
    created_by          TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_quote_status ON quote(status);

-- ───────────────────────────────────────────────────────────────────
-- yiji_word · 宜/忌词
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS yiji_word (
    id                          TEXT PRIMARY KEY,
    type                        TEXT NOT NULL,    -- yi/ji
    word                        TEXT NOT NULL,
    category                    TEXT,             -- 文/武/行/居
    favor_when_main_wuxing      TEXT NOT NULL DEFAULT '[]',
    disfavor_when_avoid_wuxing  TEXT NOT NULL DEFAULT '[]',
    time_period                 TEXT NOT NULL DEFAULT '[]',
    locale                      TEXT NOT NULL DEFAULT 'zh-CN',
    status                      TEXT NOT NULL DEFAULT 'published',
    created_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_yiji_type_status ON yiji_word(type, status);

-- ───────────────────────────────────────────────────────────────────
-- gate_word · 八门解释
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gate_word (
    id              TEXT PRIMARY KEY,
    gate            TEXT NOT NULL,            -- 休门/生门/.../开门
    direction       TEXT NOT NULL,
    benefit_text    TEXT NOT NULL,
    locale          TEXT NOT NULL DEFAULT 'zh-CN',
    version         INTEGER NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'published'
);
CREATE UNIQUE INDEX idx_gate_word_uk ON gate_word(gate, locale, version);

-- ───────────────────────────────────────────────────────────────────
-- product · 商品 + 多区域定价 + 多平台
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product (
    id                          TEXT PRIMARY KEY,
    name                        TEXT NOT NULL,
    sub_title                   TEXT,
    category                    TEXT NOT NULL,    -- incense/sachet/bracelet/censer/other
    price_cn                    INTEGER NOT NULL,  -- 分
    price_hk                    INTEGER,
    price_tw                    INTEGER,
    price_jp                    INTEGER,
    price_us                    INTEGER,
    iap_product_id              TEXT,
    stock                       INTEGER NOT NULL DEFAULT 0,
    image_urls                  TEXT NOT NULL DEFAULT '[]',
    description                 TEXT,
    recommend_when_main_wuxing  TEXT NOT NULL DEFAULT '[]',
    regions_avail               TEXT NOT NULL DEFAULT '["cn","hk","tw"]',
    platforms_avail             TEXT NOT NULL DEFAULT '["mini","ios","android","web"]',
    sales_count                 INTEGER NOT NULL DEFAULT 0,
    status                      TEXT NOT NULL DEFAULT 'on_sale', -- draft/on_sale/off_sale
    created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_product_status_cat ON product(status, category);

-- ───────────────────────────────────────────────────────────────────
-- order_record · 订单
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_record (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    items           TEXT NOT NULL,                -- json: [{product_id, qty, price}]
    total_amount    INTEGER NOT NULL,             -- 分
    currency        TEXT NOT NULL DEFAULT 'CNY',
    status          TEXT NOT NULL DEFAULT 'unpaid', -- unpaid/paid/shipped/done/cancelled/refunded
    payment_channel TEXT,                          -- wechat/alipay/iap/stripe
    payment_ref     TEXT,                          -- 第三方订单号
    shipping_addr   TEXT,                          -- json
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at         TEXT,
    shipped_at      TEXT,
    done_at         TEXT
);
CREATE INDEX idx_order_user ON order_record(user_id, created_at DESC);
CREATE INDEX idx_order_status ON order_record(status);

-- ───────────────────────────────────────────────────────────────────
-- activity · 线下活动
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity (
    id                  TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    sub_title           TEXT,
    category            TEXT NOT NULL,        -- market/course/energy
    banner_url          TEXT,
    location            TEXT,
    city                TEXT,
    start_at            TEXT NOT NULL,
    end_at              TEXT NOT NULL,
    max_participants    INTEGER NOT NULL DEFAULT 100,
    current_count       INTEGER NOT NULL DEFAULT 0,
    price_cn            INTEGER NOT NULL DEFAULT 0,
    regions_avail       TEXT NOT NULL DEFAULT '["cn"]',
    description         TEXT,
    schedule            TEXT NOT NULL DEFAULT '[]',
    status              TEXT NOT NULL DEFAULT 'open', -- draft/open/closed/ended
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_activity_status_cat ON activity(status, category);

-- ───────────────────────────────────────────────────────────────────
-- activity_registration
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_registration (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    activity_id     TEXT NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'registered', -- registered/checked_in/cancelled
    registered_at   TEXT NOT NULL DEFAULT (datetime('now')),
    checked_in_at   TEXT,
    UNIQUE(user_id, activity_id)
);

-- ───────────────────────────────────────────────────────────────────
-- badge · 徽章定义
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badge (
    id              TEXT PRIMARY KEY,
    code            TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    icon_url        TEXT,
    rule_dsl        TEXT NOT NULL,             -- json
    points          INTEGER NOT NULL DEFAULT 10,
    status          TEXT NOT NULL DEFAULT 'active'
);

-- ───────────────────────────────────────────────────────────────────
-- user_badge · 持有
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_badge (
    user_id         TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    badge_id        TEXT NOT NULL REFERENCES badge(id) ON DELETE CASCADE,
    earned_at       TEXT NOT NULL DEFAULT (datetime('now')),
    progress        TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY(user_id, badge_id)
);

-- ───────────────────────────────────────────────────────────────────
-- feature_flag · 差异化开关
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flag (
    code            TEXT PRIMARY KEY,
    default_on      INTEGER NOT NULL DEFAULT 1,
    by_platform     TEXT NOT NULL DEFAULT '{}',
    by_region       TEXT NOT NULL DEFAULT '{}',
    by_user_segment TEXT NOT NULL DEFAULT '{}',
    description     TEXT,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ───────────────────────────────────────────────────────────────────
-- admin_user · 后台账号
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_user (
    id              TEXT PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,             -- argon2
    name            TEXT NOT NULL,
    roles           TEXT NOT NULL DEFAULT '["operator"]', -- json
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at   TEXT
);

-- ───────────────────────────────────────────────────────────────────
-- audit_log · 后台操作日志
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id              TEXT PRIMARY KEY,
    admin_id        TEXT REFERENCES admin_user(id),
    action          TEXT NOT NULL,
    target_type     TEXT,
    target_id       TEXT,
    diff            TEXT,
    ip              TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_admin ON audit_log(admin_id, created_at DESC);
