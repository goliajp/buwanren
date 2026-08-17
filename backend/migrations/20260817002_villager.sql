-- 不完人与他们的术数(工序单第 07 步的前置)
--
-- 这三张表之前一张都没有:40 位不完人的「流派 / 缺 / 说话风格」只存在于
-- `rooms/design.html` 的两张表里。问签用例要按【术数算、按缺偏、按声音说】,
-- 三层都要拿这些数据,所以先让它们进库。
--
-- ★ 单一来源仍是设计册。`backend/seed/villagers.sql` 由
--   `scripts/export-cast.py` 从 design.html 导出,幂等、可反复跑。
--   **不要直接改 seed,也不要在库里手工改** —— 那样就有两份会漂移的真相,
--   而这个项目已经在「同一物体两份绘制」上栽过一次。

-- ── 术数 ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS art (
    key         TEXT PRIMARY KEY,          -- tarot / qimen / astro …,与 mingli 叶对齐
    name        TEXT NOT NULL,             -- 塔罗 / 奇门遁甲
    essence     TEXT,                      -- 要义一句话
    -- 这门术数对应 mingli 的哪片叶。为空 = 还没接上算力,
    -- 问签时按「无盘」处理而不是假装算过 —— 空盘要看得见,不能静静降级。
    mingli_leaf TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 不完人 ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS villager (
    id          TEXT PRIMARY KEY,          -- ayun / popo / mira,与 rooms/ 的房间 id 同名
    name        TEXT NOT NULL,
    title       TEXT,                      -- 号:小道士 / 拉琴的吉普赛人
    -- 主修。无名(anonymous)没有术数 —— 那是设定不是缺数据:
    -- 村里永远留着空屋,等还没被找回的人。
    art_key     TEXT REFERENCES art(key),
    arts_extra  TEXT,                      -- 兼修,原样留档(婆婆的「水晶球」)
    origin      TEXT,
    personality TEXT,
    -- ★ 「缺」是偏向层的输入,也是这套设计的核心:
    --   一个不完人 = 一门术数 = 一种解读你的方式;术数会重叠,但缺不同,说的话就不同。
    lack        TEXT NOT NULL,
    background  TEXT,
    milestone   TEXT,
    voice       TEXT,                      -- 说话风格,声音层的输入
    rarity      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_villager_art ON villager(art_key);

-- ── 问签留档 ────────────────────────────────────────────────────
-- 形状照 `naji_record`:把当时那一盘原样存下来。
-- 事后有人问「它当时凭什么这么说」,要答得出来 —— 重算是答不出来的,
-- 因为盘依赖当时的时刻。
CREATE TABLE IF NOT EXISTS villager_reading (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    villager_id     TEXT NOT NULL REFERENCES villager(id),
    asked_on        DATE NOT NULL,             -- 按 Asia/Shanghai 切日
    asked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 算力层:原样落档
    art_key         TEXT,
    chart_json      JSONB,

    -- 偏向层:中性结论按缺重排之后的结果
    lack            TEXT NOT NULL,
    verdict         TEXT NOT NULL,             -- 该动了 / 该停了 …
    suit_words      JSONB NOT NULL DEFAULT '[]'::jsonb,
    avoid_words     JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- 声音层:这位不完人说出来的样子
    say             TEXT NOT NULL,

    seed            BIGINT NOT NULL,

    -- 同一个人、同一位不完人、同一天,只该有一条。
    -- 换个村民就换一条,换一天也换一条 —— 这正是 seed 的定义。
    UNIQUE (user_id, villager_id, asked_on)
);

CREATE INDEX IF NOT EXISTS idx_villager_reading_user ON villager_reading(user_id, asked_at DESC);
