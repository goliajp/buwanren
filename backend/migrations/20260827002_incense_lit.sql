-- 同步点香：谁点了（设计册 E1）。
--
-- **不建场次表**。「每周四晚九点，烧二十五分钟」是一条规则，不是一批数据 ——
-- 建了表就要有人每周去种一场，而漏种的那一周症状是「这一屏今晚不存在」，
-- 跟「还没到点」长得一模一样。规则算得出来的东西不落库。
--
-- 落库的只有参与：哪一场、谁点了。场次用它的开始时刻做标识
-- （上海时区的 `YYYY-MM-DDT21`），一眼看得出是哪一晚。
--
-- 一个人一场只算一次 —— 连点十下不该变成十个人（跟入住那张表同一条道理）。
CREATE TABLE IF NOT EXISTS incense_lit (
    session_key TEXT NOT NULL,
    user_id     TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    lit_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_incense_lit_session ON incense_lit(session_key);
