-- seed 演示数据 · 演示用,生产请清空重建

-- ─── quote · 24 句(《庄子》《道德经》《论语》等)─────────────────
INSERT INTO quote (id, book, chapter, text, length, wuxing_affinity, gate_affinity, sensitivity_score) VALUES
  ('q01','庄子','列御寇','巧者劳而智者忧,无能者无所求。',16,'["木","土"]','["休门","死门"]',1),
  ('q02','庄子','齐物论','今者吾丧我,汝知之乎?',12,'["水"]','["景门","开门"]',2),
  ('q03','庄子','逍遥游','至人无己,神人无功,圣人无名。',16,'["水","木"]','["开门"]',1),
  ('q04','庄子','养生主','吾生也有涯,而知也无涯。',12,'["木","水"]','["杜门","休门"]',1),
  ('q05','庄子','大宗师','泉涸,鱼相与处于陆,相呴以湿,相濡以沫。',20,'["水"]','["休门"]',1),
  ('q06','庄子','人间世','形若槁木,心若死灰,可乎?',13,'["土","金"]','["死门","杜门"]',1),
  ('q07','庄子','秋水','大知闲闲,小知间间。',10,'["木"]','["杜门"]',1),
  ('q08','庄子','知北游','天地有大美而不言,四时有明法而不议。',18,'["木","火"]','["生门","景门"]',1),
  ('q09','道德经','二十五章','人法地,地法天,天法道,道法自然。',16,'["土"]','["休门"]',1),
  ('q10','道德经','八章','上善若水,水善利万物而不争。',14,'["水"]','["休门","开门"]',1),
  ('q11','道德经','十六章','致虚极,守静笃。',8,'["金","水"]','["休门"]',1),
  ('q12','道德经','二十二章','曲则全,枉则直,洼则盈,敝则新。',16,'["土"]','["杜门"]',1),
  ('q13','道德经','三十三章','知人者智,自知者明。',10,'["金"]','["景门"]',1),
  ('q14','道德经','四十四章','知足不辱,知止不殆,可以长久。',14,'["土","金"]','["休门"]',1),
  ('q15','道德经','六十三章','为无为,事无事,味无味。',12,'["土"]','["休门"]',1),
  ('q16','论语','里仁','德不孤,必有邻。',8,'["木"]','["生门"]',1),
  ('q17','论语','述而','三人行,必有我师焉。',10,'["木","土"]','["生门"]',1),
  ('q18','论语','为政','学而不思则罔,思而不学则殆。',14,'["木"]','["杜门"]',1),
  ('q19','论语','子罕','岁寒,然后知松柏之后凋也。',13,'["木","水"]','["死门"]',1),
  ('q20','大学','一','知止而后有定,定而后能静。',12,'["土","金"]','["休门"]',1),
  ('q21','中庸','一','喜怒哀乐之未发,谓之中。',12,'["土"]','["休门"]',1),
  ('q22','周易','系辞','一阴一阳之谓道。',8,'["木","金"]','["开门"]',1),
  ('q23','周易','乾','天行健,君子以自强不息。',12,'["金","火"]','["开门","生门"]',1),
  ('q24','周易','坤','地势坤,君子以厚德载物。',12,'["土"]','["生门"]',1);

-- ─── gate_word · 八门解释 ──────────────────────────────────────────
INSERT INTO gate_word (id, gate, direction, benefit_text) VALUES
  ('g_xiu', '休门','北方','休则养正,正则气盈;利休养静心、修身养性、家庭和睦。北向青绿色之处更宜。'),
  ('g_sheng','生门','东北','生机萌动;利求财创业、新项目开始、投资理财。东北向尤宜。'),
  ('g_shang','伤门','东方','锋芒外露;宜守不宜攻,避免冲突、收敛锋芒。'),
  ('g_du', '杜门','东南','静默潜修;利修炼内功、技术研究、深造学习。东南向尤宜。'),
  ('g_jing','景门','南方','明亮昭彰;利考试文昌、策划宣传、面试答辩。南向尤宜。'),
  ('g_si', '死门','西南','收敛归藏;宜避之、不宜大事、宜静养。'),
  ('g_jing2','惊门','西方','言语外交;利谈判交际、演讲表达、公关活动。西向尤宜。'),
  ('g_kai', '开门','西北','开拓新局;利工作事业、求人办事、开拓新局。西北向尤宜。');

-- ─── yiji_word · 宜忌词 ────────────────────────────────────────────
INSERT INTO yiji_word (id, type, word, category, favor_when_main_wuxing, disfavor_when_avoid_wuxing) VALUES
  -- 宜 · 木
  ('y_du','yi','读书','文','["木","水"]','[]'),
  ('y_ht','yi','会谈','文','["木","金"]','[]'),
  ('y_wj','yi','文教','文','["木","水"]','[]'),
  ('y_dx','yi','东行','行','["木"]','[]'),
  ('y_qy','yi','签约','武','["金","水"]','[]'),
  ('y_xs','yi','行善','文','["木","土"]','[]'),
  -- 宜 · 火
  ('y_yj','yi','远见','文','["火","金"]','[]'),
  ('y_xc','yi','宣传','武','["火","木"]','[]'),
  ('y_lt','yi','礼宴','文','["火","土"]','[]'),
  -- 宜 · 土
  ('y_xy','yi','信约','文','["土","金"]','[]'),
  ('y_ws','yi','务实','文','["土"]','[]'),
  -- 宜 · 金
  ('y_zd','yi','谋断','武','["金","水"]','[]'),
  ('y_xl','yi','修律','文','["金","土"]','[]'),
  -- 宜 · 水
  ('y_jz','yi','静坐','居','["水","金"]','[]'),
  ('y_my','yi','冥想','居','["水"]','[]'),
  ('y_xs2','yi','学思','文','["水","木"]','[]'),
  ('y_xq','yi','戏曲','文','["水","木"]','[]'),
  -- 宜 通用
  ('y_pc','yi','品茶','居','["木","水"]','[]'),
  ('y_xs3','yi','写字','文','["木","金"]','[]'),
  ('y_fz','yi','焚香','居','["金","土"]','[]'),
  -- 忌 通用 → 在忌神当道时归忌
  ('j_dt','ji','动土','武','[]','["土","金"]'),
  ('j_qa','ji','签约','武','[]','["火","土"]'),
  ('j_zb','ji','争辩','文','[]','["火","金"]'),
  ('j_yh','ji','远行','行','[]','["火","土"]'),
  ('j_rh','ji','入火','居','[]','["火"]'),
  ('j_kd','ji','开店','武','[]','["火","土"]'),
  ('j_ssn','ji','诉讼','武','[]','["金","火"]'),
  ('j_jy','ji','嫁娶','武','[]','["火","金"]'),
  ('j_zw','ji','装修','武','[]','["土"]');

-- ─── product · 6 商品 ────────────────────────────────────────────
INSERT INTO product (id, name, sub_title, category, price_cn, stock, image_urls, description, recommend_when_main_wuxing) VALUES
  ('p_chen','不完人线香·沉香','安神静心·助眠修身','incense',12800,200,'["https://images.pexels.com/photos/4226892/pexels-photo-4226892.jpeg?auto=compress&w=400"]','选用上等沉香木,经传统工艺精制。气醇厚幽远,有安神静心、助眠修身之效。','["水","木"]'),
  ('p_tan','老山檀线香','清心定神·日常修行','incense',9800,150,'["https://images.pexels.com/photos/776653/pexels-photo-776653.jpeg?auto=compress&w=400"]','印度老山檀香,香气温润细腻,助清心定神、提升专注。','["金","木"]'),
  ('p_ya','崖柏线香','山林气息·净化空间','incense',7800,180,'["https://images.pexels.com/photos/691668/pexels-photo-691668.jpeg?auto=compress&w=400"]','四川崖柏,松柏清香,净化空间、驱散湿气。','["木","土"]'),
  ('p_ai','艾草线香','驱蚊避秽·温经通络','incense',5800,300,'["https://images.pexels.com/photos/164739/pexels-photo-164739.jpeg?auto=compress&w=400"]','端午时令艾草,有驱蚊避秽、温经通络之效。','["火","土"]'),
  ('p_bd','白檀香囊·静心款','随身佩戴·清雅怡人','sachet',6800,120,'["https://images.pexels.com/photos/691668/pexels-photo-691668.jpeg?auto=compress&w=400"]','内填白檀香粉,香气持久淡雅,可随身佩戴。','["金","水"]'),
  ('p_qzhl','青瓷香炉','简约雅致·传统器型','censer',18800,60,'["https://images.pexels.com/photos/2387871/pexels-photo-2387871.jpeg?auto=compress&w=400"]','景德镇青瓷烧制,釉色温润,简约优雅。','["土","金"]');

-- ─── activity · 3 活动 ──────────────────────────────────────────
INSERT INTO activity (id, title, sub_title, category, banner_url, location, city, start_at, end_at, max_participants, current_count, description) VALUES
  ('a_gw','古物市集·夏至专场','匠心手作·古物古玩·香氛药香','market','https://images.pexels.com/photos/776653/pexels-photo-776653.jpeg?auto=compress&w=800','西溪湿地','杭州','2026-07-21 10:00','2026-07-21 18:00',100,48,'汇集各地古物古玩,传承东方美学。'),
  ('a_dy','道医问诊·义诊专场','名师坐诊·中医调理','market','https://images.pexels.com/photos/4226892/pexels-photo-4226892.jpeg?auto=compress&w=800','平江路','苏州','2026-07-28 09:00','2026-07-28 17:00',60,32,'特邀道医传人坐诊,提供中医问诊、针灸调理、养生建议等服务。'),
  ('a_xd','香道入门课','三日浸修·从识香到调香','course','https://images.pexels.com/photos/4226892/pexels-photo-4226892.jpeg?auto=compress&w=800','栖云堂','上海','2026-08-15 09:00','2026-08-17 17:00',20,12,'三日课程,从识香、品香、用香到自调香方,系统入门。');

-- ─── badge · 6 徽章 ─────────────────────────────────────────────
INSERT INTO badge (id, code, name, description, rule_dsl) VALUES
  ('b_first','first_naji','初入道门','首次纳吉,开启修行之旅','{"type":"count","action":"naji.spin","threshold":1}'),
  ('b_streak','continous_7','静心修行','连续纳吉 7 天,持之以恒','{"type":"streak","action":"naji.spin","days":7}'),
  ('b_buy','first_purchase','香缘之人','首次购买香品,结香之缘','{"type":"count","action":"order.paid","threshold":1}'),
  ('b_30','continous_30','持之以恒','连续纳吉 30 天,修心有成','{"type":"streak","action":"naji.spin","days":30}'),
  ('b_act','first_activity','禅修初成','参加 1 次线下活动,身心合一','{"type":"count","action":"activity.checkin","threshold":1}'),
  ('b_hund','hundred_naji','百卦通晓','累计纳吉 100 次,通晓门径','{"type":"count","action":"naji.spin","threshold":100}');

-- ─── feature_flag · 4 个示例开关 ──────────────────────────────────
INSERT INTO feature_flag (code, default_on, by_platform, by_region, description) VALUES
  ('show_ai_explanation_full',1,'{"mini":false}','{}','「AI 详细释义」全文版;mini 平台限简版'),
  ('show_product_iap',1,'{}','{"cn":false,"us":true,"eu":true}','iOS IAP 商品入口(国内 OFF,海外 ON)'),
  ('sensitive_terms_strict',0,'{"mini":true}','{}','敏感词严格模式(mini 必开)'),
  ('show_dayun_in_summary',0,'{}','{}','本命简介是否露出大运(默认 OFF,保持极轻)');

-- ─── admin_user · 默认管理员 admin / admin123 ────────────────────
-- argon2id of "admin123" with default cost; 重启时若已存在则忽略
INSERT INTO admin_user (id, email, password_hash, name, roles) VALUES
  ('admin_root','admin@unmei.local','$argon2id$v=19$m=19456,t=2,p=1$YWRtaW51bm1laXNhbHQ$EFzePuf0Vd2NbMM4Yz5e/h7VLYgKjk3+gXc1pX2hcis','超级管理员','["super","operator","content","support","finance"]');

-- ─── 示例用户 + 1 张盘(便于演示)─────────────────────────────
INSERT INTO user (id, nickname, platform, region, locale, is_anonymous) VALUES
  ('u_demo','观若','web','cn','zh-CN',0);
INSERT INTO natal (id, user_id, label, year, month, day, hour, minute, tz, gender, birth_lat, birth_lon, birth_city, is_default) VALUES
  ('n_demo','u_demo','默认',1987,9,17,15,0,8.0,'male',28.23,112.94,'长沙',1);
UPDATE user SET active_natal_id = 'n_demo' WHERE id = 'u_demo';
INSERT INTO natal_summary (natal_id, day_master, strength_level, strength_score, primary_yongshen, primary_role, secondary_yongshen, avoid_wuxing, pattern_name, friendly_hint, mingli_version) VALUES
  ('n_demo','己土','偏强',61,'木','官杀','水','["火","土"]','暗食神格','你属己土之命,气偏盛。木之类利于你 — 东方 / 青绿 / 文教 / 律法 之事顺势而行。火盛之季 / 南方红黄 / 燥处宜静守。','mingli-v0.1');
