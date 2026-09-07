-- 填完出生时间那一屏上的那一句，结尾不写句号（.claude/CLAUDE.md ★）。
--
-- 那一句是【界面短句】不是文章:句号让它读起来像念稿，而它正是那一屏
-- 唯一一句人话。生成它的两处（natal.rs 的 build_friendly_hint、
-- report.rs 的 人话）今天已经改掉。
--
-- 【为什么还要一条迁移】：`natal_summary.friendly_hint` 是【落库的】——
-- 建本命那一刻算一次就存下来，之后每次读都读这一行。
-- 改了生成的代码，已经建过本命的人看到的仍然是旧那一句。
-- 库里 862 行，862 行都以句号收尾。
--
-- 只去掉结尾那一个。两句的中间那个是断句，照留 ——
-- `。$` 锚在末尾，正好只吃最后一个。
UPDATE natal_summary
   SET friendly_hint = regexp_replace(friendly_hint, '。$', '')
 WHERE friendly_hint LIKE '%。';
