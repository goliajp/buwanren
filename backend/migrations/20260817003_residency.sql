-- 御守 → 入住(工序单第 08 步)
--
-- 「每个不完人把自己的一部分封进一枚御守,散落人间。谁拾到、唤醒它,
--  谁就是他的村长 —— 他从此住进你的村子。」
--
-- 结构照 archive/omamori-research/01-architecture.md 的基石:
-- **不变量放在身份记录上,可变量留给载体**。NFC 的 UID、QR 的序列号、
-- 将来链上的 token id,都只是指向同一条御守身份的凭证。换载体 = 换一个 Adapter,
-- 身份记录与它之上的一切(绑定、内容、变现)纹丝不动。

-- ── 御守身份:稳定的那一条 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS omamori (
    id          TEXT PRIMARY KEY,                       -- OmamoriIdentity
    villager_id TEXT NOT NULL REFERENCES villager(id),  -- 这枚御守里封的是谁
    minted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note        TEXT
);

CREATE INDEX IF NOT EXISTS idx_omamori_villager ON omamori(villager_id);

-- ── 载体凭证:可换的那一层 ──────────────────────────────────────
-- 一枚御守可以同时有 NFC 与 QR 两种凭证(同一枚实物上印一个刻一个),
-- 所以是 1:N。凭证在同一种载体内唯一。
CREATE TABLE IF NOT EXISTS omamori_credential (
    carrier_kind TEXT NOT NULL CHECK (carrier_kind IN ('nfc','qr','chain','manual')),
    credential   TEXT NOT NULL,                         -- NFC UID / QR 序列号 / token id
    omamori_id   TEXT NOT NULL REFERENCES omamori(id) ON DELETE CASCADE,
    issued_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at   TIMESTAMPTZ,
    PRIMARY KEY (carrier_kind, credential)
);

-- ── 入住:绑定的结果 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS villager_residency (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    villager_id  TEXT NOT NULL REFERENCES villager(id),
    -- 从哪儿来的:买的(order_line)还是扫的(omamori)。两条路进同一张表 ——
    -- 「载体换了,身份记录不变」这条基石在这里兑现。
    omamori_id   TEXT REFERENCES omamori(id),
    source_kind  TEXT NOT NULL CHECK (source_kind IN ('purchase','scan','grant')),
    source_ref   TEXT,                                  -- order_line_id / credential
    moved_in_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- ★ 一位用户对一位不完人只入住一次。
    --   重复扫同一枚不该多出一个人 —— 村子里不会有两个阿云。
    UNIQUE (user_id, villager_id)
);

CREATE INDEX IF NOT EXISTS idx_residency_user ON villager_residency(user_id, moved_in_at DESC);

-- ── 履约类型加一种:住进来 ───────────────────────────────────────
-- 御守类 SKU 支付成功 → OrderPaid → 履约写入住。
-- 与 instant / shipping 并列,走同一条履约管线,不另开一条。
ALTER TABLE product DROP CONSTRAINT IF EXISTS product_fulfillment_kind_check;
ALTER TABLE product ADD CONSTRAINT product_fulfillment_kind_check
  CHECK (fulfillment_kind IN ('instant','async_compute','manual','shipping','residency'));

-- 哪一款 SKU 对应哪位不完人。放在 sku 上而不是 product 上:
-- 同一款御守(product)可以有「阿云」「桃桃」多个 SKU,像颜色一样。
ALTER TABLE sku ADD COLUMN IF NOT EXISTS villager_id TEXT REFERENCES villager(id);
CREATE INDEX IF NOT EXISTS idx_sku_villager ON sku(villager_id) WHERE villager_id IS NOT NULL;
