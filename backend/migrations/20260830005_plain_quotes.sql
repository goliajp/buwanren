-- 每日那一屏的收尾句原先是二十四条庄子 / 老子 / 论语的原文
-- （「知足不辱,知止不殆,可以长久。」，还带半角逗号）。
--
-- 按 0830 标尺 §1.5.2「说人话」:文言只允许出现在「那一份」的专业细节里，
-- 而这里是每天都要看的那一屏的最后一句 —— 它该像村里某个人随口说的，
-- 不该像一本摊开的古书。
--
-- 换的是文字，**五行与门的匹配关系原样不动** —— 那是它被挑中的依据，
-- 换掉就等于把这一条从「按你今天的情况挑」退回成「随便抽一句」。
-- `book` 一并改成说话的人的身份，屏上若要署名也署得出。

UPDATE quote SET text = '把自己想得太重要，是件挺累人的事', book = '村口的闲话' WHERE id = 'q01';
UPDATE quote SET text = '有时候你以为在忙，其实只是没停下来', book = '村口的闲话' WHERE id = 'q02';
UPDATE quote SET text = '做成一件事之后不必立刻说出去，放两天更踏实', book = '村口的闲话' WHERE id = 'q03';
UPDATE quote SET text = '想学的东西是学不完的，挑一样先学完', book = '村口的闲话' WHERE id = 'q04';
UPDATE quote SET text = '难的时候，能有个人陪着说说话就够了', book = '村口的闲话' WHERE id = 'q05';
UPDATE quote SET text = '不想动就先别动，装作没事更费劲', book = '村口的闲话' WHERE id = 'q06';
UPDATE quote SET text = '真明白的人话不多，急着解释的通常是心里没底', book = '村口的闲话' WHERE id = 'q07';
UPDATE quote SET text = '好东西大多不吭声 —— 季节换了也没通知谁', book = '村口的闲话' WHERE id = 'q08';
UPDATE quote SET text = '别跟自己较劲，顺着来往往更快', book = '村口的闲话' WHERE id = 'q09';
UPDATE quote SET text = '最好的那种人像水，谁都用得上，还不跟人抢', book = '村口的闲话' WHERE id = 'q10';
UPDATE quote SET text = '心里空出一块地方，事情才装得进来', book = '村口的闲话' WHERE id = 'q11';
UPDATE quote SET text = '肯绕一下的人，反而先到', book = '村口的闲话' WHERE id = 'q12';
UPDATE quote SET text = '看得懂别人不难，看得懂自己才难', book = '村口的闲话' WHERE id = 'q13';
UPDATE quote SET text = '知道什么时候够了，就不容易把自己弄丢', book = '村口的闲话' WHERE id = 'q14';
UPDATE quote SET text = '有些事不做，也是一种做法', book = '村口的闲话' WHERE id = 'q15';
UPDATE quote SET text = '肯对人好的，身边不会一直空着', book = '村口的闲话' WHERE id = 'q16';
UPDATE quote SET text = '身边随便哪个人，都有一样比你强的', book = '村口的闲话' WHERE id = 'q17';
UPDATE quote SET text = '光看不想，等于没看；光想不看，容易想歪', book = '村口的闲话' WHERE id = 'q18';
UPDATE quote SET text = '天冷了才看得出谁一直在', book = '村口的闲话' WHERE id = 'q19';
UPDATE quote SET text = '知道到哪儿为止，心里才定得下来', book = '村口的闲话' WHERE id = 'q20';
UPDATE quote SET text = '情绪还没上来的那会儿，人是最清楚的', book = '村口的闲话' WHERE id = 'q21';
UPDATE quote SET text = '有来就有去，有热闹就有清静，都是一件事的两头', book = '村口的闲话' WHERE id = 'q22';
UPDATE quote SET text = '天天都在转，人也别停太久', book = '村口的闲话' WHERE id = 'q23';
UPDATE quote SET text = '能装得下事的人，路走得远', book = '村口的闲话' WHERE id = 'q24';
