-- 名册顶上那句「你缺 X · ……」说给人听，不说给同行听。
--
-- 原句每条都以术语开头:「土主承载，你要的是守得住的那份定」——
-- 前半截是给读过书的人看的，后半截才是说给填完出生时间的那个人听的。
-- 两句并排时，读的人先撞上不懂的那一半，就不会读到懂的那一半。
--
-- 迁移是【编译期嵌进二进制】的:改这一份要连着重编，
-- 单改文件不生效（这个仓踩过两次）。
UPDATE yongshen_bias SET note = '你要的是往外伸展的那口气 —— 先动起来'
  WHERE wuxing = '木' AND rank = 1;
UPDATE yongshen_bias SET note = '你缺的是热度与人气 —— 往热闹的地方去'
  WHERE wuxing = '火' AND rank = 1;
UPDATE yongshen_bias SET note = '你要的是守得住的那份定 —— 把手上的事做扎实'
  WHERE wuxing = '土' AND rank = 1;
UPDATE yongshen_bias SET note = '该收的收、该断的断，别拖着'
  WHERE wuxing = '金' AND rank = 1;
UPDATE yongshen_bias SET note = '你要的是静下来的那一段 —— 想清楚再动'
  WHERE wuxing = '水' AND rank = 1;
