-- unmei commerce v2 · P1.5 业务表全加 region 列(锁定 schema)

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'sku','promotion','coupon','plan','subscription','subscription_invoice',
        'payment','refund','shipment','recon_batch',
        'risk_rule','risk_event','risk_case',
        'accounting_period','journal_entry','outbox_event'
    ])
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT ''cn''', t);
        EXECUTE format('UPDATE %I SET region = ''cn'' WHERE region IS NULL OR region = ''''', t);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_region ON %I(region)', t, t);
    END LOOP;
END$$;

CREATE INDEX IF NOT EXISTS idx_product_available_regions ON product USING GIN(available_regions);

-- 验证
SELECT table_name FROM information_schema.columns
WHERE column_name='region' AND table_schema='public'
ORDER BY table_name;
