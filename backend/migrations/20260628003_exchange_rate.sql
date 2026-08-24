-- unmei commerce v2 · 汇率表(global 视图折算用)
-- 各 cell 用本币挂账,集团报表按 effective_at 取汇率折成 USD

CREATE TABLE IF NOT EXISTS exchange_rate (
    id              TEXT PRIMARY KEY,
    base_currency   TEXT NOT NULL,             -- USD 一律基准
    quote_currency  TEXT NOT NULL,             -- CNY/JPY/KRW/SGD/TWD/HKD/USD
    rate_to_base    NUMERIC(20, 8) NOT NULL,   -- 1 quote = rate_to_base USD
    effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to    TIMESTAMPTZ,
    source          TEXT NOT NULL DEFAULT 'manual',
    audit_note      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xrate_lookup
ON exchange_rate(quote_currency, effective_from DESC)
WHERE effective_to IS NULL;

-- seed 1 USD = X currency 的反向汇率(rate_to_base = USD/quote)
-- 2026-06 mid-quarter 参考汇率(mock,可后续接 ECB/FED API 更新)
INSERT INTO exchange_rate(id, base_currency, quote_currency, rate_to_base, source, audit_note) VALUES
  ('xr-usd-cny-2026q2','USD','CNY', 0.14000000, 'mock', '1 CNY ≈ 0.14 USD'),
  ('xr-usd-jpy-2026q2','USD','JPY', 0.00640000, 'mock', '1 JPY ≈ 0.0064 USD'),
  ('xr-usd-krw-2026q2','USD','KRW', 0.00074000, 'mock', '1 KRW ≈ 0.00074 USD'),
  ('xr-usd-sgd-2026q2','USD','SGD', 0.74000000, 'mock', '1 SGD ≈ 0.74 USD'),
  ('xr-usd-twd-2026q2','USD','TWD', 0.03200000, 'mock', '1 TWD ≈ 0.032 USD'),
  ('xr-usd-hkd-2026q2','USD','HKD', 0.12800000, 'mock', '1 HKD ≈ 0.128 USD'),
  ('xr-usd-usd-2026q2','USD','USD', 1.00000000, 'identity', 'self')
ON CONFLICT (id) DO NOTHING;

-- helper view:给定币种 + 当前时刻拿最新汇率
CREATE OR REPLACE VIEW v_exchange_latest AS
SELECT DISTINCT ON (quote_currency)
    base_currency, quote_currency, rate_to_base, effective_from
FROM exchange_rate
WHERE effective_to IS NULL OR effective_to > NOW()
ORDER BY quote_currency, effective_from DESC;

SELECT * FROM v_exchange_latest ORDER BY quote_currency;
