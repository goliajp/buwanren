//! 不完人问签三层 · 对真库。
//!
//! 门禁三条,逐条钉住:
//!   ① 同人同村民同日两次调用**逐字相同**
//!   ② 换村民即不同
//!   ③ 同门不同缺的两人给出不同解读(婆婆与米拉,都修塔罗)
//!
//! 第三条是这套设计成立与否的判据。「一个不完人 = 一门术数 = 一种解读你的方式;
//! 术数会重叠,但缺不同,说出来的话就不同」—— 如果同修塔罗的两个人说一样的话,
//! 那 40 位不完人就只是 35 门术数的皮肤。

mod common;

use chrono::NaiveDate;
use serde_json::json;
use unmei_app::villager::{self, seed_of};

fn day(d: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(2026, 8, d).expect("date")
}

// ═══════════════════════ ① 同人同村民同日 → 逐字相同 ═══════════════════════

#[tokio::test]
async fn same_person_same_villager_same_day_is_word_for_word_identical() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;

    let a = villager::reading(&pool, &user, "ayun", day(1), None).await.expect("第一次");
    let b = villager::reading(&pool, &user, "ayun", day(1), None).await.expect("第二次");

    assert_eq!(a.say, b.say, "同一天同一位不完人，说的话必须一字不差");
    assert_eq!(a.verdict, b.verdict);
    assert_eq!(a.suit, b.suit);
    assert_eq!(a.avoid, b.avoid);
    assert_eq!(a.seed, b.seed);
    assert_eq!(a.id, b.id, "第二次该拿回同一条，而不是新写一条");
}

#[tokio::test]
async fn only_one_row_per_person_villager_day() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    for _ in 0..3 {
        villager::reading(&pool, &user, "popo", day(2), None).await.expect("问签");
    }
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM villager_reading WHERE user_id=$1 AND villager_id='popo' AND asked_on=$2",
    ).bind(&user).bind(day(2)).fetch_one(&pool).await.expect("数");
    assert_eq!(n, 1);
}

#[tokio::test]
async fn a_new_day_is_a_new_reading() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let d1 = villager::reading(&pool, &user, "tenz", day(3), None).await.unwrap();
    let d2 = villager::reading(&pool, &user, "tenz", day(4), None).await.unwrap();
    assert_ne!(d1.seed, d2.seed, "换一天就是另一签");
}

// ═══════════════════════ ② 换村民即不同 ═══════════════════════

#[tokio::test]
async fn a_different_villager_gives_a_different_reading() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;

    let ayun = villager::reading(&pool, &user, "ayun", day(5), None).await.unwrap();
    let tenz = villager::reading(&pool, &user, "tenz", day(5), None).await.unwrap();

    assert_ne!(ayun.seed, tenz.seed);
    assert_ne!(ayun.say, tenz.say, "同一天问两位不完人，不该得到同一句话");
}

#[tokio::test]
async fn the_lack_actually_steers_the_verdict() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;

    // 工序单举的就是这两个例子:缺勤的阿云偏「该动了」,缺静的丹增偏「该停了」
    let ayun = villager::reading(&pool, &user, "ayun", day(6), None).await.unwrap();
    let tenz = villager::reading(&pool, &user, "tenz", day(6), None).await.unwrap();

    let moves = ["该动了", "别再等了", "起身的时候到了"];
    let stills = ["该停了", "先歇一歇", "停下来才看得清"];
    assert!(moves.contains(&ayun.verdict.as_str()), "阿云（缺勤）该偏向动，实际「{}」", ayun.verdict);
    assert!(stills.contains(&tenz.verdict.as_str()), "丹增（缺静）该偏向停，实际「{}」", tenz.verdict);
}

// ═══════════════════════ ③ 同门不同缺 → 不同解读 ═══════════════════════

#[tokio::test]
async fn two_tarot_readers_with_different_lacks_say_different_things() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;

    // 婆婆缺「亲人」、米拉缺「家」,主修都是塔罗。
    // 若这条挂了,40 位不完人就只是 35 门术数的皮肤。
    let popo = villager::reading(&pool, &user, "popo", day(7), None).await.unwrap();
    let mira = villager::reading(&pool, &user, "mira", day(7), None).await.unwrap();

    assert_eq!(popo.art_key, mira.art_key, "前提：两位主修同一门");
    assert_eq!(popo.art_key.as_deref(), Some("tarot"));
    assert_ne!(popo.lack, mira.lack, "前提：两位的缺不同");
    assert_ne!(popo.say, mira.say, "同门不同缺，说出来的话必须不同");
}

#[tokio::test]
async fn the_voice_is_the_villagers_own() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;

    let popo = villager::reading(&pool, &user, "popo", day(8), None).await.unwrap();
    let mira = villager::reading(&pool, &user, "mira", day(8), None).await.unwrap();
    let tenz = villager::reading(&pool, &user, "tenz", day(8), None).await.unwrap();

    // 声音层不是装饰:设计册里写死了他们各自怎么说话,这里就该听得出来
    assert!(popo.say.contains("婆婆") || popo.say.contains("呀"), "婆婆的口气：{}", popo.say);
    assert!(mira.say.contains("小家伙"), "米拉的口气：{}", mira.say);
    assert!(tenz.say.starts_with("嘿哈"), "丹增的口气：{}", tenz.say);
    /* 白鹭「短、冷、精确到分秒」—— 她没有开场也没有收尾。
       比【一次抽到的那句】是抽签:选句的种子含 user id，而 user id 每跑
       一次都是新的（`common::user`），所以同一天两个人取到的句子组合不同。
       白鹭偶尔抽到长句、丹增偶尔抽到短句，这条就翻面 ——
       跑十二次全绿，而门禁那一趟正好撞上（2026-08-31）。
       低频翻面比常红更坏:它让每一次真红都能被当成噪音。

       改成比【好几天的平均】：验的性质没变（她说话短），
       而判据不再取决于抽签抽到哪一句。 */
    let mut bailu_len = 0usize;
    let mut tenz_len = 0usize;
    for d in 8..=14 {
        bailu_len += villager::reading(&pool, &user, "bailu", day(d), None).await.unwrap().say.len();
        tenz_len += villager::reading(&pool, &user, "tenz", day(d), None).await.unwrap().say.len();
    }
    assert!(
        bailu_len < tenz_len,
        "白鹭七天加起来该比丹增短：白鹭 {bailu_len} / 丹增 {tenz_len}"
    );
}

// ═══════════════════════ 不兜底 ═══════════════════════

#[tokio::test]
async fn a_villager_without_a_voice_template_refuses_rather_than_borrowing_one() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;

    // 40 位里只有 7 位写了说话模板。借别人的口气说话等于把他演成别人,
    // 所以这里必须报错 —— 而且错误话要说清楚模板该去哪写。
    let err = villager::reading(&pool, &user, "chenjiu", day(9), None).await
        .expect_err("没模板的不该出签");
    let msg = err.to_string();
    assert!(msg.contains("说话模板"), "错误话要说清是什么问题：{msg}");
    assert!(msg.contains("villager_voice"), "还要说清去哪补：{msg}");
}

#[tokio::test]
async fn an_unknown_villager_is_not_found() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let err = villager::reading(&pool, &user, "nobody_here", day(9), None).await
        .expect_err("查无此人");
    assert!(matches!(err, unmei_app::DomainError::NotFound(_)), "实际 {err:?}");
}

// ═══════════════════════ 算力层留档 ═══════════════════════

#[tokio::test]
async fn the_chart_is_recorded_verbatim_for_audit() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let chart = json!({"leaf": "tarot", "cards": ["XVII 星星", "II 女祭司"], "spread": "three"});

    villager::reading(&pool, &user, "mira", day(10), Some(chart.clone())).await.unwrap();

    // 事后有人问「它当时凭什么这么说」要答得出来。重算答不出来 —— 盘依赖当时的时刻。
    let got: serde_json::Value = sqlx::query_scalar(
        "SELECT chart_json FROM villager_reading WHERE user_id=$1 AND villager_id='mira' AND asked_on=$2",
    ).bind(&user).bind(day(10)).fetch_one(&pool).await.expect("查盘");
    assert_eq!(got, chart, "盘要原样落档，不许改写");
}

#[tokio::test]
async fn no_chart_is_recorded_as_no_chart_not_as_a_fake_one() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    villager::reading(&pool, &user, "shenyan", day(11), None).await.unwrap();

    let got: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT chart_json FROM villager_reading WHERE user_id=$1 AND villager_id='shenyan' AND asked_on=$2",
    ).bind(&user).bind(day(11)).fetch_one(&pool).await.expect("查盘");
    // 这门术数还没接上算力。如实落空盘 —— 翻档案的人要能一眼看出背后有没有真盘
    assert!(got.is_none() || got == Some(serde_json::Value::Null), "实际 {got:?}");
}

// ═══════════════════════ seed ═══════════════════════

#[tokio::test]
async fn the_seed_is_stable_and_spreads() {
    let _ = db_or_skip!();
    let d = day(12);
    assert_eq!(seed_of("u1", "ayun", d), seed_of("u1", "ayun", d), "同三元组必须同 seed");
    assert_ne!(seed_of("u1", "ayun", d), seed_of("u2", "ayun", d), "换人换签");
    assert_ne!(seed_of("u1", "ayun", d), seed_of("u1", "popo", d), "换村民换签");
    assert_ne!(seed_of("u1", "ayun", d), seed_of("u1", "ayun", day(13)), "换天换签");
    assert!(seed_of("u1", "ayun", d) >= 0, "seed 落在正数区，BIGINT 存得下");
}

#[tokio::test]
async fn neighbouring_villagers_do_not_land_on_neighbouring_seeds() {
    let _ = db_or_skip!();
    let d = day(14);
    // 用拼接或相加做 seed 的话,「换个村民」只挪动几个 bit,
    // 相邻 seed 从同一个池里挑出来的往往是同一条 —— 那就等于没换。
    let ids = ["ayun", "ayun2", "ayunb", "bailu", "popo", "mira"];
    let seeds: Vec<i64> = ids.iter().map(|v| seed_of("same_user", v, d)).collect();
    for i in 0..seeds.len() {
        for j in (i + 1)..seeds.len() {
            assert!((seeds[i] - seeds[j]).abs() > 1_000_000,
                    "{} 与 {} 的 seed 挨得太近：{} / {}", ids[i], ids[j], seeds[i], seeds[j]);
        }
    }
}

#[tokio::test]
async fn every_closer_starts_with_punctuation() {
    let pool = db_or_skip!();
    // closer 直接接在「忌 xx」后面。不以标点开头就会粘成一句:「忌动土就这样」。
    // 这条在我肉眼看出来之前先挂了一版 —— 所以钉住它,别指望下一个人也正好看出来。
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT villager_id, closer FROM villager_voice WHERE closer <> ''",
    ).fetch_all(&pool).await.expect("查模板");
    assert!(!rows.is_empty(), "一条模板都没查到，这个断言等于没跑");
    for (id, closer) in rows {
        let first = closer.chars().next().expect("非空");
        assert!(
            "。，、；：？！…—".contains(first),
            "{id} 的 closer 该以标点开头，实际以「{first}」开头：{closer}"
        );

        /* 也不许以句号结尾。项目规矩:台词这类非正式文本,**结尾不写句号** ——
           句号会让一句话显得像念稿,而他是在说话。
           (只是结尾那个;句中断句的照常留 —— 丹增的 closer 就是
           「。就这样。我也在练」,前两个句号都在句中。)

           closer 是整句的最后一段,所以它决定了用户看到的那一句怎么收尾。
           库里 682 条签今天一条都没有以句号结尾,钉住它,别等下一个人正好注意到。 */
        assert!(
            !closer.ends_with('。'),
            "{id} 的 closer 以句号结尾，而台词结尾不写句号（见 .claude/CLAUDE.md）：{closer}"
        );
    }
}

// ═══════════════════════ 记得你问过谁(工序单第 42 步)═══════════════════════
//
// 「友好来自被记得,不来自弹窗提示」。所以这一组钉的不只是「记得」,
// 还有【不催】与【不盯着】—— 后两条一旦破了,同一个机制就从温柔变成催收。

#[tokio::test]
async fn a_villager_remembers_who_you_asked_yesterday() {
    let pool = db_or_skip!();
    // 必须建一行真的 app_user:villager_reading.user_id 有外键。
    // 第一版直接拿 uniq() 当用户 id,六条全撞外键 —— 写测试前该先读迁移。
    let u = common::user(&pool).await;

    villager::reading(&pool, &u, "tao", day(10), None).await.expect("先问桃桃");
    let r = villager::reading(&pool, &u, "ayun", day(11), None).await.expect("隔天问阿云");

    assert!(
        r.say.contains("桃桃"),
        "隔天问另一位，他该记得你昨天找过谁：{}",
        r.say
    );
    assert!(r.say.contains("昨天"), "隔了一天就说「昨天」:{}", r.say);
}

#[tokio::test]
async fn the_same_day_is_not_remembered_out_loud() {
    let pool = db_or_skip!();
    // 必须建一行真的 app_user:villager_reading.user_id 有外键。
    // 第一版直接拿 uniq() 当用户 id,六条全撞外键 —— 写测试前该先读迁移。
    let u = common::user(&pool).await;

    villager::reading(&pool, &u, "tao", day(10), None).await.expect("先问桃桃");
    let r = villager::reading(&pool, &u, "ayun", day(10), None).await.expect("同一天问阿云");

    // 同一天刚问过就当面提,像被盯着;隔一天还记得,才是被记得。
    assert!(
        !r.say.contains("桃桃"),
        "同一天不该提刚问过谁 —— 那是盯梢不是记得：{}",
        r.say
    );
}

#[tokio::test]
async fn beyond_a_week_he_no_longer_brings_it_up() {
    let pool = db_or_skip!();
    // 必须建一行真的 app_user:villager_reading.user_id 有外键。
    // 第一版直接拿 uniq() 当用户 id,六条全撞外键 —— 写测试前该先读迁移。
    let u = common::user(&pool).await;

    villager::reading(&pool, &u, "tao", day(1), None).await.expect("很久以前问过桃桃");
    let r = villager::reading(&pool, &u, "ayun", day(20), None).await.expect("十九天后");

    assert!(
        !r.say.contains("桃桃"),
        "七天以外还提，那不是记得，是翻账本：{}",
        r.say
    );
}

#[tokio::test]
async fn remembering_does_not_nag() {
    let pool = db_or_skip!();
    // 必须建一行真的 app_user:villager_reading.user_id 有外键。
    // 第一版直接拿 uniq() 当用户 id,六条全撞外键 —— 写测试前该先读迁移。
    let u = common::user(&pool).await;

    villager::reading(&pool, &u, "tao", day(10), None).await.expect("先问桃桃");
    let r = villager::reading(&pool, &u, "ayun", day(11), None).await.expect("隔天");

    // 收集是叙事的结果,不是要推着人走的进度条:
    // 不做限时、不做红点、不做「还差 N 位解锁」,这里也不做「再去问问他」。
    for nag in ["再去", "快去", "还差", "解锁", "别忘", "赶紧"] {
        assert!(!r.say.contains(nag), "记得那一句不该催人（「{nag}」）:{}", r.say);
    }
}

#[tokio::test]
async fn remembering_comes_after_his_own_opening() {
    let pool = db_or_skip!();
    // 必须建一行真的 app_user:villager_reading.user_id 有外键。
    // 第一版直接拿 uniq() 当用户 id,六条全撞外键 —— 写测试前该先读迁移。
    let u = common::user(&pool).await;

    villager::reading(&pool, &u, "tao", day(10), None).await.expect("先问桃桃");
    let r = villager::reading(&pool, &u, "tenz", day(11), None).await.expect("隔天问丹增");

    // 开场是这个人的招牌。记得那一句挪到它前面,就不像他开口了。
    assert!(r.say.starts_with("嘿哈"), "丹增还是得先「嘿哈」:{}", r.say);
    assert!(r.say.contains("桃桃"), "而且记得你问过谁：{}", r.say);
}

#[tokio::test]
async fn what_he_remembers_is_frozen_into_that_days_reading() {
    let pool = db_or_skip!();
    // 必须建一行真的 app_user:villager_reading.user_id 有外键。
    // 第一版直接拿 uniq() 当用户 id,六条全撞外键 —— 写测试前该先读迁移。
    let u = common::user(&pool).await;

    villager::reading(&pool, &u, "tao", day(10), None).await.expect("桃桃");
    let first = villager::reading(&pool, &u, "ayun", day(11), None).await.expect("阿云");
    // 又问了第三位,再回头问阿云 —— 他今天已经说过了,一个字都不该变
    villager::reading(&pool, &u, "popo", day(11), None).await.expect("婆婆");
    let again = villager::reading(&pool, &u, "ayun", day(11), None).await.expect("再问阿云");

    assert_eq!(
        first.say, again.say,
        "今天他已经说过了 —— 后来又问了谁，不该改写他今天说过的话"
    );
}
