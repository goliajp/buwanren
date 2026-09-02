-- 台词节奏（三）· 四中之三的前七位
--
-- 手法同 20260902003/004:只动节奏、不动内容，每位只改一条把密度压到 2/4。
-- 各自贴着 `villager.voice`。

-- 阿弥（缺诚）· voice：甜得发腻，句句在拉票
UPDATE villager_line SET text = '你要问就直接问，绕着问我会顺着绕'
 WHERE villager_id = 'ami' AND seq = 3;

-- 无名（缺名字）
UPDATE villager_line SET text = '灯每天有人点，谁点的，不重要'
 WHERE villager_id = 'anonymous' AND seq = 2;

-- 白鹭（缺热）· voice：短、冷、精确到分秒 —— 让她更短，不是更长
UPDATE villager_line SET text = '我不问你为什么来，你说我就听'
 WHERE villager_id = 'bailu' AND seq = 3;

-- 阿咖（缺认真）· voice：轻描淡写，装作什么都没看见
UPDATE villager_line SET text = '这杯拉坏了，喝吧，味道一样'
 WHERE villager_id = 'barista' AND seq = 3;

-- 小邮（缺停下）· voice：语速飞快 —— 逗号连读正是「快」的形状
UPDATE villager_line SET text = '我一天路过这儿十一趟，今天头一回看清那棵树'
 WHERE villager_id = 'courier' AND seq = 2;

-- 恩戈（缺哀）· voice：大笑穿插在句子里
UPDATE villager_line SET text = '那个贝壳丑，扔了！这个更丑，留着'
 WHERE villager_id = 'engo' AND seq = 3;

-- 姜牙（缺畏）· voice：海腔，爱骂天
UPDATE villager_line SET text = '我这辈子没怕过，所以船翻过三回'
 WHERE villager_id = 'jiangya' AND seq = 2;
