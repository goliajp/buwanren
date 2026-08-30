-- 「今天」那一屏原先是一本老黄历:大字「生门 · 东北」，一句
-- 「生机萌动;利求财创业、新项目开始、投资理财。东北向尤宜。」（半角分号），
-- 底下两列「宜 焚香 东行 礼宴 / 避 远行 入火」。
--
-- 这一屏是这个产品【每天】要用的那一屏，而它要回答的是
-- 「我今天该不该做那件事」—— 转之前那句提示写的就是「想清楚一件事」。
-- 老黄历回答不了那个问题:没人「入火」，也没人照方位出门。
--
-- 所以两张表整体重写:
--   · 门解 → 一句给这个人的话（现代口语，不带术语）
--   · 宜忌 → 现代人真会做的动作，五行映射照旧不动
-- 门名与方位不删，它们退到屏底当注脚 —— 专业细节留在专业的地方。

-- ─── 门解:八条，每条一句人话 ───────────────────────────────
UPDATE gate_word SET benefit_text =
  '适合把节奏放慢：该休息就休息，把自己顾好了，别的事往后排一排。' WHERE gate = '休门';
UPDATE gate_word SET benefit_text =
  '适合开个头：想做的那件事，今天迈第一步比想清楚更要紧。' WHERE gate = '生门';
UPDATE gate_word SET benefit_text =
  '锋芒容易伤人也伤己：今天少争，把话留三分，硬碰硬讨不到好。' WHERE gate = '伤门';
UPDATE gate_word SET benefit_text =
  '适合关起门来做自己的事：不见人、不回消息，也没什么损失。' WHERE gate = '杜门';
UPDATE gate_word SET benefit_text =
  '适合把话说开：见面谈、当面问，今天开口比发消息管用。' WHERE gate = '景门';
UPDATE gate_word SET benefit_text =
  '适合收尾：该结束的结束、该退的退，别再往里投时间。' WHERE gate = '死门';
UPDATE gate_word SET benefit_text =
  '容易反复：今天别急着定论，等一等再回复也来得及。' WHERE gate = '惊门';
UPDATE gate_word SET benefit_text =
  '适合往前推一把：定下来的事今天办得动，别停在原地。' WHERE gate = '开门';

-- ─── 宜:现代人真会做的事，五行映射不动 ─────────────────────
UPDATE yiji_word SET word = '出门走走'     WHERE type='yi' AND word='东行';
UPDATE yiji_word SET word = '约人聊聊'     WHERE type='yi' AND word='会谈';
UPDATE yiji_word SET word = '把话说定'     WHERE type='yi' AND word='信约';
UPDATE yiji_word SET word = '把规矩理一理' WHERE type='yi' AND word='修律';
UPDATE yiji_word SET word = '写点东西'     WHERE type='yi' AND word='写字';
UPDATE yiji_word SET word = '一个人待会儿' WHERE type='yi' AND word='冥想';
UPDATE yiji_word SET word = '把手上的做完' WHERE type='yi' AND word='务实';
UPDATE yiji_word SET word = '喝杯东西歇会儿' WHERE type='yi' AND word='品茶';
UPDATE yiji_word SET word = '学点新的'     WHERE type='yi' AND word='学思';
UPDATE yiji_word SET word = '发出去让人看见' WHERE type='yi' AND word='宣传';
UPDATE yiji_word SET word = '看场演出'     WHERE type='yi' AND word='戏曲';
UPDATE yiji_word SET word = '教人或者请教' WHERE type='yi' AND word='文教';
UPDATE yiji_word SET word = '收拾屋子'     WHERE type='yi' AND word='焚香';
UPDATE yiji_word SET word = '跟人吃顿饭'   WHERE type='yi' AND word='礼宴';
UPDATE yiji_word SET word = '把合同签了'   WHERE type='yi' AND word='签约';
UPDATE yiji_word SET word = '帮个忙'       WHERE type='yi' AND word='行善';
UPDATE yiji_word SET word = '读几页书'     WHERE type='yi' AND word='读书';
UPDATE yiji_word SET word = '做个决定'     WHERE type='yi' AND word='谋断';
UPDATE yiji_word SET word = '想想长远的事' WHERE type='yi' AND word='远见';
UPDATE yiji_word SET word = '早点睡'       WHERE type='yi' AND word='静坐';

-- ─── 忌:同样换成现代动作 ───────────────────────────────────
UPDATE yiji_word SET word = '跟人争对错'   WHERE type='ji' AND word='争辩';
UPDATE yiji_word SET word = '硬撑'         WHERE type='ji' AND word='入火';
UPDATE yiji_word SET word = '大动干戈地改' WHERE type='ji' AND word='动土';
UPDATE yiji_word SET word = '仓促定终身事' WHERE type='ji' AND word='嫁娶';
UPDATE yiji_word SET word = '开新摊子'     WHERE type='ji' AND word='开店';
UPDATE yiji_word SET word = '急着签字'     WHERE type='ji' AND word='签约';
UPDATE yiji_word SET word = '大改动'       WHERE type='ji' AND word='装修';
UPDATE yiji_word SET word = '把事情闹大'   WHERE type='ji' AND word='诉讼';
UPDATE yiji_word SET word = '跑远路'       WHERE type='ji' AND word='远行';
