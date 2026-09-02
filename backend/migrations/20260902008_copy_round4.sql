-- 第四轮评审 · 文案（库里那一半）
--
-- 三处，各自的门禁都够不着:

-- ── 一、「时辰」从两支门禁的缝里过去了 ────────────────────────
-- `check-plain-words.py` 的术语表里【有】「时辰」，但那一支不扫 villager_line;
-- `check-villager-lines.py` 扫 villager_line，但它的三张词表里【没有】「时辰」。
-- 各差一半，于是这两条一路报绿。词表那一侧一起补（见 check-villager-lines.py）。
UPDATE villager_line SET text = '这支还能烧两个钟头。够了'
 WHERE villager_id = 'yisha' AND seq = 1;
UPDATE villager_line SET text = '醒着最难，我一天醒不了几个钟头'
 WHERE villager_id = 'xueyao' AND seq = 4;

-- ── 二、一条开发备注坐在【面向用户】的字段里 ──────────────────
-- `lack_bias.note` 直接印在名册屏最上面（invite/index.wxml:9）。
-- 「放下」那一行写的是「（保留：若有村民缺「放下」）」—— 一句给自己看的话，
-- 只要哪天有一位村民缺「放下」，它就会原样印上屏。
UPDATE lack_bias SET note = '放不下的人，劝你先把手松开一寸'
 WHERE lack = '放下';

-- ── 三、「看手的绅士」屏上写着「这一门是看面相」 ─────────────
-- `art.xiangmian` 的 name 是「面相手相」，而 plain 砍成了「看面相」——
-- 燕娘看脸、奥兰多看手，两位共用这一行，于是奥兰多的详情页
-- （villager/index.wxml:109）说他看面相，跟他自己的 title 打架。
-- 「看相」两个字把两边都包住，且仍然是大白话。
UPDATE art SET plain = '看相' WHERE key = 'xiangmian';
