-- 台词修正（第二轮）· 2026-09-01 五路评审 · 中文文案
--
-- villager_line 不在开机种子的覆盖名单里（那几张是 villager / art /
-- lack_bias / villager_voice），所以这里 UPDATE 是算数的。

-- ── 一、白鹭说的那句会上村子首页最大的气泡 ────────────────
-- 「紫微在午」—— 一个没听过紫微斗数的人，打开 app 第一眼看到四个不认识的字。
-- 台词轮播是从住着的村民【全部】四条里等概率挑，所以每一条都得能单独立住。
UPDATE villager_line SET text = '你那张图我摆好了。你自己看得懂，就不用我说'
 WHERE villager_id = 'bailu' AND seq = 2;

-- ── 二、一句「别学我」，四个人在说 ───────────────────────
-- 陈九（缺定）／小邮（缺停下）／老徐（缺止损）／米拉（缺家）都用了它，
-- 而且三个人都放在第 3 条 —— 连位置都一样。超过「三人共用即露出同一个作者」
-- 那条线。留老徐那一处:「我走不掉」是他这个缺本身。
UPDATE villager_line SET text = '你要真信我，那你今天先别摸牌'
 WHERE villager_id = 'chenjiu' AND seq = 4;
UPDATE villager_line SET text = '我停一下车都得先编个理由。你不用编'
 WHERE villager_id = 'courier' AND seq = 3;
UPDATE villager_line SET text = '你有个能回的地方？那你今晚就回去'
 WHERE villager_id = 'mira' AND seq = 3;

-- ── 三、单独拿出来零信息量的两条 ─────────────────────────
-- 「今天说」是从四条里等概率挑一条印在首页大气泡上 —— 也就是说
-- 有四分之一的日子，用户打开 app 看到的是「阿罗今天说：啊」。
UPDATE villager_line SET text = '啊，你还在啊'
 WHERE villager_id = 'aluo' AND seq = 3;
UPDATE villager_line SET text = '嘿哈。……啊，你什么时候来的'
 WHERE villager_id = 'tenz' AND seq = 4;

-- ── 四、丹增第 2 条把他自己的人设推翻了 ──────────────────
-- 「站桩一炷香，什么都想通了」—— 一个缺静的人不会这么说，
-- 那是不缺静的人说的话;他另外三条都对得上。另外「一炷香」是古时制。
UPDATE villager_line SET text = '站了半小时，什么都没想通。明天接着站'
 WHERE villager_id = 'tenz' AND seq = 2;

-- ── 五、薇拉整组跟她的机制正好相反 ───────────────────────
-- lack_bias 写着「慢惯了的人羡慕利落，于是催你快」，而她四条里有三条
-- 在拦着你;问签时她的结论又从 move（「该动了」「别再等了」）池子里取 ——
-- 一位说「别催」的人开口就是「起身的时候到了」。
-- 保留她自己慢（那是她的缺），但让她真的替你催。
UPDATE villager_line SET text = '你等等 —— 不，你别等我，你先去'
 WHERE villager_id = 'weila' AND seq = 2;
UPDATE villager_line SET text = '快的东西我做不好。你做得好，那就去做'
 WHERE villager_id = 'weila' AND seq = 3;
UPDATE villager_line SET text = '别催我。该催的是你自己那件事'
 WHERE villager_id = 'weila' AND seq = 4;
