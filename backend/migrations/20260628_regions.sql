-- unmei commerce v2 · P1 多区域代码化(代码层 region-aware,部署仍单 cell)
--
-- 本 migration 做:
--   1. region_registry 表 + seed 6 cell 元数据(cn/jp/kr/sea/na/zh_hant)
--   2. admin_user 表加 region_scope text[] · seed admin 给 super 全开
--   3. order_record / app_user 加 region 列(PoC)· 默认 'cn'(向后兼容)
--
-- P2 留:其它业务表加 region 列 + partitioning by LIST(region) + service region filter

----------------------------------------------------------------------
-- §1 region_registry · 6 cell 元数据
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS region_registry (
    code              TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    primary_currency  TEXT NOT NULL,
    primary_locale    TEXT NOT NULL,
    tz                TEXT NOT NULL,
    jurisdiction      TEXT NOT NULL DEFAULT '',
    data_residency_required BOOLEAN NOT NULL DEFAULT FALSE,
    -- cell 部署端点(P1 都是同一个,P3 拆出后各自填)
    cell_endpoint     TEXT NOT NULL DEFAULT '',
    cell_db_url       TEXT NOT NULL DEFAULT '',  -- 加密存储,本 P1 留空
    status            TEXT NOT NULL DEFAULT 'planned'
                      CHECK (status IN ('planned','provisioning','live','draining','retired')),
    -- 渠道 / 物流(json array,代码侧 Region::meta() 也有镜像)
    payment_channels  JSONB NOT NULL DEFAULT '[]'::jsonb,
    carriers          JSONB NOT NULL DEFAULT '[]'::jsonb,
    supported_currencies JSONB NOT NULL DEFAULT '[]'::jsonb,
    supported_locales JSONB NOT NULL DEFAULT '[]'::jsonb,
    audit_note        TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO region_registry (code, name, primary_currency, primary_locale, tz,
  jurisdiction, data_residency_required, status,
  payment_channels, carriers, supported_currencies, supported_locales) VALUES

  ('cn', '中国大陆', 'CNY', 'zh-CN', 'Asia/Shanghai',
   'CN', TRUE, 'live',
   '["wechat_jsapi","wechat_mp","wechat_h5","wechat_native","alipay_wap","alipay_pc","alipay_mini"]'::jsonb,
   '["sf","jd","zto","yto","yunda","sto","ems"]'::jsonb,
   '["CNY"]'::jsonb,
   '["zh-CN"]'::jsonb),

  ('jp', '日本', 'JPY', 'ja-JP', 'Asia/Tokyo',
   'JP', TRUE, 'planned',
   '["stripe_card","line_pay","paypay","iap","gpb"]'::jsonb,
   '["jp_post","yamato","sagawa"]'::jsonb,
   '["JPY"]'::jsonb,
   '["ja-JP","en-US"]'::jsonb),

  ('kr', '韩国', 'KRW', 'ko-KR', 'Asia/Seoul',
   'KR', TRUE, 'planned',
   '["toss","kakaopay","naverpay","stripe_card","iap","gpb"]'::jsonb,
   '["cj_logistics","hanjin","lotte"]'::jsonb,
   '["KRW"]'::jsonb,
   '["ko-KR","en-US"]'::jsonb),

  ('sea', '东南亚', 'SGD', 'en-US', 'Asia/Singapore',
   'SG-multi', FALSE, 'planned',
   '["stripe_card","grabpay","shopeepay","iap","gpb"]'::jsonb,
   '["dhl","jnt","ninja_van"]'::jsonb,
   '["SGD","MYR","THB","IDR","VND","PHP"]'::jsonb,
   '["en-US","zh-Hans","th-TH","vi-VN","id-ID","ms-MY"]'::jsonb),

  ('na', '北美', 'USD', 'en-US', 'America/New_York',
   'US-CA', FALSE, 'planned',
   '["stripe_card","iap","gpb","paypal"]'::jsonb,
   '["usps","fedex","ups","dhl"]'::jsonb,
   '["USD","CAD"]'::jsonb,
   '["en-US","en-CA","fr-CA","es-US"]'::jsonb),

  ('zh_hant', '中文繁体', 'TWD', 'zh-TW', 'Asia/Taipei',
   'TW-HK-MO', FALSE, 'planned',
   '["stripe_card","line_pay","iap","gpb"]'::jsonb,
   '["chunghwa_post","sf"]'::jsonb,
   '["TWD","HKD","MOP"]'::jsonb,
   '["zh-TW","zh-HK"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

----------------------------------------------------------------------
-- §2 admin_user 加 region_scope · seed admin 给 global 全开
----------------------------------------------------------------------
ALTER TABLE admin_user ADD COLUMN IF NOT EXISTS region_scope TEXT[] NOT NULL DEFAULT ARRAY['cn']::TEXT[];

-- roles 是 jsonb,用 ? 操作符判断包含 key 'super'
UPDATE admin_user
SET region_scope = ARRAY['cn','jp','kr','sea','na','zh_hant','global']::TEXT[]
WHERE roles ? 'super';

CREATE INDEX IF NOT EXISTS idx_admin_user_regions ON admin_user USING GIN(region_scope);

----------------------------------------------------------------------
-- §3 业务表加 region 列(PoC:order_record + app_user · 其它表 P2 补)
----------------------------------------------------------------------
-- app_user 已存在 region 字段(看 20260626_000_initial.sql),无需添加,仅确保非空 DEFAULT
ALTER TABLE app_user ALTER COLUMN region SET DEFAULT 'cn';
UPDATE app_user SET region = 'cn' WHERE region IS NULL OR region = '';

-- order_record:已有 region 字段(默认 'cn' from commerce_v2),无需添加。
-- 这里只做 sanity 校验:确保所有现有订单 region 不为空
UPDATE order_record SET region = 'cn' WHERE region IS NULL OR region = '';

-- 加 region GIN/BTree index 让 region filter 查询快
CREATE INDEX IF NOT EXISTS idx_order_record_region ON order_record(region, created_at DESC);

----------------------------------------------------------------------
-- §4 audit
----------------------------------------------------------------------
COMMENT ON TABLE region_registry IS 'P1 6 cell 元数据 · code/currency/locale/tz/channels/carriers';
COMMENT ON COLUMN admin_user.region_scope IS 'admin JWT 内嵌的 region 权限范围 · super = 全 6 cell + global';
