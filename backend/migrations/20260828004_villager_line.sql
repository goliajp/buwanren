-- 村里某位今天说的一句（设计册 V1）。
--
-- 主屏第一眼该是【有人在跟你打招呼】，不是一张地图加两个数。
-- 线框里那一块长这样：
--
--     婆婆今天说
--     「别急，慢慢来」
--     占卜的老太太 · 塔罗
--     去看看她
--
-- 这不是签、不是运势、不下任何判断 —— 就是她今天说的一句闲话。
-- 所以它【不需要来源】，也不违 10.8：那一条管的是「不下没有来源的断言」，
-- 而「今儿降温了，加件衣裳呀」不是断言。
--
-- `villager_voice` 里那三样（opener / closer / joiner）是**说话的口吻**，
-- 拿来拼签文的，不能当一句话摆出来 ——「来，坐下说呀——」独立成句没有意义。
--
-- 只给【御守在售的那四位】写。真实用户能请回家的就是这四位
-- （另外 888 件 `prod-oma-*` 是本地压测数据，不在 seed 也不在迁移里），
-- 所以四位就是 100% 覆盖。剩下 36 位等他们的御守要上架时再一位一位写 ——
-- 一次写四十位，写出来的是四十句一个味儿的话。
CREATE TABLE IF NOT EXISTS villager_line (
    villager_id TEXT     NOT NULL REFERENCES villager(id) ON DELETE CASCADE,
    seq         SMALLINT NOT NULL,
    text        TEXT     NOT NULL,
    PRIMARY KEY (villager_id, seq)
);

-- 婆婆 · 占卜的老太太 · 慈祥神秘爱操心
-- 口吻：「来，坐下说呀——」「乖，拿颗糖哦」
INSERT INTO villager_line (villager_id, seq, text) VALUES
  ('popo', 1, '别急，慢慢来'),
  ('popo', 2, '今儿降温了，加件衣裳呀'),
  ('popo', 3, '牌摊在那儿呢，什么时候来看都行'),
  ('popo', 4, '吃了没？没吃先去吃')
ON CONFLICT (villager_id, seq) DO NOTHING;

-- 阿云 · 小道士 · 嗜睡散漫嘴硬心软
-- 口吻：「贫道看了一眼……」「……嗯，就这样。别问了，困」
INSERT INTO villager_line (villager_id, seq, text) VALUES
  ('ayun', 1, '困。有事晚点说'),
  ('ayun', 2, '起局要静，你现在太吵了'),
  ('ayun', 3, '……行吧，看在你来了的份上'),
  ('ayun', 4, '贫道不算命，贫道只是看看')
ON CONFLICT (villager_id, seq) DO NOTHING;

-- 沈砚 · 落第书生 · 清高敏感嘴碎
-- 口吻：「容在下多嘴——」「……在下这般说，倒像是自己参透了似的」
INSERT INTO villager_line (villager_id, seq, text) VALUES
  ('shenyan', 1, '书读到一半，人先散了'),
  ('shenyan', 2, '在下今日不占，只想坐坐'),
  ('shenyan', 3, '落第又如何，字还是要写的'),
  ('shenyan', 4, '你若问运，在下先问你近来读什么')
ON CONFLICT (villager_id, seq) DO NOTHING;

-- 丹增 · 下山的武僧 · 耿直热血话少
-- 口吻：「嘿哈。」「就这样。我也在练」
INSERT INTO villager_line (villager_id, seq, text) VALUES
  ('tenz', 1, '今天练完了。你呢'),
  ('tenz', 2, '站桩一炷香，什么都想通了'),
  ('tenz', 3, '师父说心静自然凉。我不信，但我照做'),
  ('tenz', 4, '嘿哈')
ON CONFLICT (villager_id, seq) DO NOTHING;
