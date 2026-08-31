-- 收尾:把「勤」那一行删干净。
--
-- 20260831004 用 UPDATE 把它改成了「勤快」，那一步本身没错，
-- 但**参照数据的源头不是迁移，是 `backend/seed/*.sql`** ——
-- 只改迁移的话，任何一次灌种子都会照着旧词把「勤」原样插回来，
-- 于是 lack_bias 变成 41+1 = 42 行，测试里那句「应有 41 行」当场红。
--
-- 源头已经在 seed/lack_bias.sql 与 seed/villagers.sql 里改掉了。
-- 这一条只负责清掉已经跑出来的那一行遗留。
--
-- 教训:改参照数据的键，要改的是种子，不是补一条 UPDATE。
DELETE FROM lack_bias WHERE lack = '勤';
UPDATE villager SET lack = '勤快' WHERE lack = '勤';
