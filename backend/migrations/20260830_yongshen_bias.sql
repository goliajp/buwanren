-- 用神 → 该找哪一路人（设计册 V4「你缺『火』，下面这几位跟你补得上」）。
--
-- 在这之前那句话是**假的**：「谁能来」那一页顶上说着「跟你补得上」，
-- 而排序只按「在卖的排前面、然后按 id」——【跟用神一点关系都没有】。
-- 设计册 10.8 说不下没有来源的断言，这一句正是：它陈述了一个不存在的因果。
--
-- 两头本来就接得上，只差中间这张表：
--
--   `lack_bias`（已有）  村民缺什么 → 他反过来劝你哪个方向
--                        「缺勤的人最懂拖延的代价，所以催你起身」
--   `yongshen_bias`（这张）你的用神 → 你需要哪个方向
--
-- 映射照五行本身的性质来，每一条都写着为什么 —— 界面上那句「为什么是
-- 这几位」直接引它，不另编一套说法。
CREATE TABLE IF NOT EXISTS yongshen_bias (
    wuxing    TEXT     NOT NULL,
    direction TEXT     NOT NULL,
    -- 1 = 主，2 = 次。主的排前面，次的跟上，其余按原来的规矩排
    rank      SMALLINT NOT NULL CHECK (rank IN (1, 2)),
    note      TEXT     NOT NULL,
    PRIMARY KEY (wuxing, direction)
);

INSERT INTO yongshen_bias (wuxing, direction, rank, note) VALUES
  ('木', 'move', 1, '木主生发条达，你要的是往外伸展的那口气 —— 先动起来'),
  ('木', 'near', 2, '生发也要有处可去，往人里走比一个人使劲容易'),
  ('火', 'near', 1, '火主炎上而暖，你缺的是热度与人气 —— 往热闹里去'),
  ('火', 'move', 2, '热不起来常常是因为停太久，动一动就有了'),
  ('土', 'keep', 1, '土主承载，你要的是守得住的那份定'),
  ('土', 'still', 2, '守得住先得停得下'),
  ('金', 'let_go', 1, '金主肃降，该收的收、该断的断'),
  ('金', 'wait', 2, '断之前先掂量 —— 收手不是赌气'),
  ('水', 'still', 1, '水主润下而藏，你要的是静下来的那一段'),
  ('水', 'ask', 2, '静下来才问得出真问题')
ON CONFLICT (wuxing, direction) DO NOTHING;
