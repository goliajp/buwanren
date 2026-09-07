-- 三十五门术，给每门配一句【人话】。
--
-- 硬要求是「术数行话只能出现在付费报告的专业页，界面上不行」，
-- 但名册页至今写着「小道士 · 大六壬」「落第书生 · 梅花易数」
-- 「下山的武僧 · 藏历密算」—— 一个没听说过命理的人一个都不认识。
--
-- 反证就在产品自己身上:房间里那六颗表演按钮写的是「掐指算算」
-- 「拆个字」「拨拨念珠」，人话早就有了，只是没用到列表页上。
--
-- `plain` 写的是【这一门在屏幕上做什么】，不是行话的翻译。
-- 界面一律用 plain;`name` 与 `essence` 留给「你的说明书」的专业页。
ALTER TABLE art ADD COLUMN IF NOT EXISTS plain TEXT;

UPDATE art SET plain = CASE key
  -- 中式术数:行话最重的一批，全部换成动作
  WHEN 'liuren'    THEN '掐指算'
  WHEN 'qimen'     THEN '摆盘'
  WHEN 'meihua'    THEN '拆字'
  WHEN 'ziwei'     THEN '看星'
  WHEN 'bazi'      THEN '看生辰'
  WHEN 'liuyao'    THEN '摇铜钱'
  WHEN 'taiyi'     THEN '推大势'
  WHEN 'fengshui'  THEN '看屋子'
  WHEN 'guijia'    THEN '烧龟甲'
  WHEN 'cezi'      THEN '拆字'
  WHEN 'xiangmian' THEN '看面相'
  WHEN 'zangli'    THEN '拨念珠'
  -- 外来与现代的:本来就好懂，只做微调
  WHEN 'tarot'     THEN '翻牌'
  WHEN 'cyber'     THEN '翻牌'
  WHEN 'astro'     THEN '看星盘'
  WHEN 'veda'      THEN '看星盘'
  WHEN 'egypt'     THEN '看星象'
  WHEN 'maya'      THEN '数日子'
  WHEN 'rune'      THEN '刻符'
  WHEN 'shinto'    THEN '抽签'
  WHEN 'pendulum'  THEN '看灵摆'
  WHEN 'crystal'   THEN '看水晶球'
  WHEN 'mirror'    THEN '照镜子'
  WHEN 'candle'    THEN '看烛火'
  WHEN 'tea'       THEN '读茶叶'
  WHEN 'coffee'    THEN '读咖啡'
  WHEN 'sand'      THEN '画沙'
  WHEN 'shell'     THEN '抛贝壳'
  WHEN 'bone'      THEN '灼骨'
  WHEN 'niaozhan'  THEN '听鸟'
  WHEN 'denghua'   THEN '看灯花'
  WHEN 'chaozhan'  THEN '看潮水'
  WHEN 'stock'     THEN '看 K 线'
  WHEN 'data'      THEN '跑数据'
  WHEN 'ml'        THEN '跑模型'
  ELSE plain
END;
