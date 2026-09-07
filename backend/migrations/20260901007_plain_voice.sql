-- 说人话 · 2026-09-01（五路评审第三路：中文文案）
--
-- 硬要求写着「完全不允许有任何文言古书的表达」，而下面这几处
-- 恰恰是用户读得最多的地方 —— 而且都不在 wxml 里，所以只扫界面文件的
-- 门禁一个都没看见。

-- ── 一、问签的口气模板 ────────────────────────────────────
-- ★ 这一段【只是把现有库追平】。真正的源头是 backend/seed/villager_voice.sql:
--   API 每次启动都跑一遍种子，而那一段是 `ON CONFLICT … DO UPDATE` ——
--   光在这儿 UPDATE，下一次重启就被写回去（2026-09-01 我就这么丢了一轮，
--   而且不报错）。两处都改，种子那份才是说了算的。
-- 这七条是【全部】问签回答的骨架（unmei-app/src/villager.rs 拿它拼句子），
-- 也就是说这个功能 100% 的输出都带着文言:
--   阿云「贫道」、沈砚「容在下多嘴」「是以」「这般」「参透」、桃桃「起局」。
-- 更糟的是同一个人在 villager_line 里说的是现代话（阿云:「困。有事晚点说」），
-- 一按「问问阿云」就变成「贫道」—— 同一个角色两套语域。
UPDATE villager_voice SET
  opener = '眯着眼看了一眼……', joiner = '。眼下呢，', closer = '……就这样。别问了，困'
 WHERE villager_id = 'ayun';
UPDATE villager_voice SET
  opener = '我多句嘴——', joiner = '。所以啊，', closer = '……我这么一说，倒像是自己想明白了'
 WHERE villager_id = 'shenyan';
UPDATE villager_voice SET
  opener = '这也要问？', joiner = '。要我说，', closer = '。你看着办吧，哼'
 WHERE villager_id = 'tao';
-- 丹增的开场带了个句号 —— 非正式短句结尾不加句号。
UPDATE villager_voice SET opener = '嘿哈' WHERE villager_id = 'tenz';
-- 米拉用了半角波浪号，而且「小家伙」「呀」跟婆婆整套语气词撞车。
UPDATE villager_voice SET
  opener = '听我说啊——', joiner = '。跟你说，', closer = '……牌就摊到这儿，路还长着'
 WHERE villager_id = 'mira';

-- ── 二、罗盘那八句的结尾句号 ─────────────────────────────
-- 它是结果屏最大的一行（ask/index.wxml 的 .verdict）。
-- 非正式文本结尾不加句号 —— 句号让它读起来像公告。
UPDATE gate_word SET benefit_text = rtrim(benefit_text, '。') WHERE benefit_text LIKE '%。';
-- 「锋芒」「伤己」偏文言，单独换一句。
UPDATE gate_word SET benefit_text =
  '今天容易把人扎着，也把自己扎着：少争两句，话留三分，硬碰硬讨不到好'
 WHERE gate = '伤门';

-- ── 三、徽章 ────────────────────────────────────────────
-- 「第一次转罗盘」:罗盘是玄学词，而这个动作在全 app 叫「问一件事」。
UPDATE badge SET description = '第一次问一件事' WHERE id = 'b_first';
-- 「闻过香」的说明写「第一次买香」—— 一个是闻一个是买，且它的规则
-- （见 20260901008）本来就不区分买的是什么。
UPDATE badge SET description = '第一次闻苏合的香' WHERE id = 'b_buy';

-- ── 四、在售商品的副标题 ────────────────────────────────
-- 玉坠名称已经把话说对了（「配你缺的那一样」），副标又用行话说一遍。
UPDATE product SET sub_title = '按你缺的那一样配 · 随身带着'
 WHERE id = 'prod-jade-pendant';

-- ── 五、线下活动 ────────────────────────────────────────
-- 四个半角逗号;而且「汇集」「传承东方美学」「特邀」「传人」「浸修」
-- 是招商文案腔，跟村子的语气是两回事。
UPDATE activity SET description = '各地淘来的老东西，摆一天' WHERE id = 'a_gw';
UPDATE activity SET description = '请了位会看中医的老师坐诊，把脉、扎针、聊聊怎么养着' WHERE id = 'a_dy';
UPDATE activity SET description = '三天的课，从闻香、品香、用香一路到自己调一味' WHERE id = 'a_xd';
UPDATE activity SET sub_title = '三天 · 从闻香到自己调一味' WHERE id = 'a_xd';
