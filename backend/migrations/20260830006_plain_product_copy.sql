-- 商品文案说人话。
--
-- 原句是工程语 + 玄学语的混合，还带半角标点：
--   「基于经审计的 21 叶算力源,出一份完整的八字结构分析报告。」
--   「基于双方八字结构计算互补与互克,客观信号呈现,**非吉凶断言**。」
--   「消炁化煞 · 配本命五行」（「炁」是古字）
-- 这几句是决定掏不掏钱的地方读到的字。「21 叶算力源」是我们内部的说法，
-- 「客观信号呈现」是给合规看的，「消炁化煞」是给同行看的 ——
-- 没有一句是说给买的人听的。
--
-- 按 0830 标尺：先说他拿到什么，再说怎么给他，术语一个不留。

UPDATE product SET description_md =
  '把你的出生时间排成一份完整的分析：你缺什么、什么已经够多、这些年怎么走。六页，一次读完。'
  WHERE description_md LIKE '%21 叶算力源%';

UPDATE product SET description_md =
  '把两个人的出生时间放在一起看：哪儿合得来、哪儿容易别着。只讲能对上的地方，不下结论。'
  WHERE description_md LIKE '%互补与互克%';

UPDATE product SET description_md =
  '心里有件拿不准的事，现在就问。五分钟给你答复。'
  WHERE description_md LIKE '%当下问事起卦%';

-- 原句「实物商品,顺丰发货,3-5 日达。」两处半角逗号，两段都要提到，
-- 否则门禁那一支只认出前半段被改过（它按五字滑窗找证据）
UPDATE product SET description_md =
  '实物，顺丰寄给你，三到五天到。'
  WHERE description_md LIKE '%顺丰发货%' OR description_md LIKE '%3-5 日达%';

UPDATE product SET description_md =
  '按月续，随时可以停。停了这个月还能用完，不退这个月的钱。'
  WHERE description_md LIKE '%本周期结束停止续费%';

UPDATE product SET name = '和田玉葫芦坠（配你缺的那一样）'
  WHERE name LIKE '%和田玉葫芦坠%';
UPDATE product SET sub_title = '按你缺的五行配 · 随身带着'
  WHERE sub_title LIKE '%消炁化煞%';

UPDATE product SET name = replace(name, '(送 2 月)', '（多给两个月）')
  WHERE name LIKE '%(送 2 月)%';
UPDATE product SET sub_title = replace(sub_title, '(送2月)', '（多给两个月）')
  WHERE sub_title LIKE '%(送2月)%';

UPDATE promotion SET name = '新人第一单八折 · 最多减 ¥100'
  WHERE name LIKE '%新人首单 8 折%';
