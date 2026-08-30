-- 沈砚那两句跟他新的身份词打架，也是屏上的文言。
--
--   「在下今日不占，只想坐坐」 —— 在下 / 占
--   「落第又如何，字还是要写的」 —— 落第（他现在是「一直没考上的读书人」）
--
-- 定的规矩：**角色的口头禅可以是笑点，旁白与系统话不行**。
-- 阿云的「贫道不算命，贫道只是看看」留着 —— 那是一个懒道士装样子的梗，
-- 人物档案里写着「爱用『贫道』，被戳穿就装睡」，去掉就没有笑点了。
-- 沈砚这两句不是笑点，只是旧。
UPDATE villager_line SET text = '今天不想算，就想坐会儿'
  WHERE villager_id = 'shenyan' AND text LIKE '在下今日不占%';
UPDATE villager_line SET text = '没考上又怎样，字还是要写的'
  WHERE villager_id = 'shenyan' AND text LIKE '落第又如何%';
UPDATE villager_line SET text = '你要问运势，我先问你最近在读什么'
  WHERE villager_id = 'shenyan' AND text LIKE '你若问运%';

-- 苏合在动线上到得了（她卖香、她那一屏有她的话），却一句台词都没有。
-- 补四句 —— 她的性子是「香药娘子」那一路的稳与体贴，只是不用旧词说。
INSERT INTO villager_line (villager_id, seq, text) VALUES
  ('suhe', 1, '火候到了自己会香，急不来'),
  ('suhe', 2, '这一味压得住心浮'),
  ('suhe', 3, '你身上有股焦味 —— 最近熬夜了吧'),
  ('suhe', 4, '闻闻这个。不买也没关系')
ON CONFLICT DO NOTHING;
