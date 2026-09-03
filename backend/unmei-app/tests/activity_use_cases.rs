//! 报名这条链（2026-09-03 五路评审 · 架构审计接上）。
//!
//! 在这之前 `activity_registration` 是一张【没有任何 Rust 读或写】的表，
//! 库里零行，而屏上写着「48/100 已报名」。所以这里每一条都在钉
//! 「这条路真的走得通」，而不是「函数返回了 Ok」。
mod common;

use unmei_app::{activity, Actor, DomainError};

/// 建一场活动。`何时` 是相对现在的小时数 —— 负数就是已经开场了。
async fn 一场活动(
    pool: &sqlx::PgPool,
    上限: i32,
    何时: i64,
    status: &str,
    区们: &str,
) -> String {
    let id = common::uniq("act");
    sqlx::query(
        "INSERT INTO activity(id, title, category, start_at, end_at,
                              max_participants, regions_avail, status)
         VALUES ($1, '测试场', 'market',
                 NOW() + ($2 || ' hours')::interval,
                 NOW() + ($2 || ' hours')::interval + INTERVAL '2 hours',
                 $3, $4::jsonb, $5)",
    )
    .bind(&id)
    .bind(何时.to_string())
    .bind(上限)
    .bind(区们)
    .bind(status)
    .execute(pool)
    .await
    .expect("insert activity");
    id
}

async fn 报了几个人(pool: &sqlx::PgPool, activity_id: &str) -> i64 {
    common::scalar_i64(
        pool,
        "SELECT count(*) FROM activity_registration
          WHERE activity_id=$1 AND status='registered'",
        activity_id,
    )
    .await
}

#[tokio::test]
async fn 报名落进名单里() {
    let pool = db_or_skip!();
    let act = 一场活动(&pool, 10, 24, "open", r#"["cn"]"#).await;
    let u = common::user(&pool).await;

    let 报名号 = activity::register(&pool, &act, &u, "cn").await.expect("报名");
    assert!(报名号.starts_with("areg"), "报名号形状不对：{报名号}");
    assert_eq!(报了几个人(&pool, &act).await, 1, "报了名而名单上没有这个人");
}

/// 【同一个人不能占两个位子】。表上有 UNIQUE，但报两次要给一句人话，
/// 不是把数据库的唯一约束原文丢给用户。
#[tokio::test]
async fn 报两次只算一次() {
    let pool = db_or_skip!();
    let act = 一场活动(&pool, 10, 24, "open", r#"["cn"]"#).await;
    let u = common::user(&pool).await;

    activity::register(&pool, &act, &u, "cn").await.expect("第一次");
    let err = activity::register(&pool, &act, &u, "cn").await.unwrap_err();
    assert!(matches!(err, DomainError::Conflict(_)), "第二次该是 Conflict，实际 {err:?}");
    assert_eq!(报了几个人(&pool, &act).await, 1, "报第二次把人数加上去了");
}

/// 【满了就是满了】。上限 1，第二个人报不进来。
#[tokio::test]
async fn 满了就报不进来() {
    let pool = db_or_skip!();
    let act = 一场活动(&pool, 1, 24, "open", r#"["cn"]"#).await;
    let a = common::user(&pool).await;
    let b = common::user(&pool).await;

    activity::register(&pool, &act, &a, "cn").await.expect("第一个");
    let err = activity::register(&pool, &act, &b, "cn").await.unwrap_err();
    assert!(matches!(err, DomainError::Conflict(_)), "满场该是 Conflict，实际 {err:?}");
    assert_eq!(报了几个人(&pool, &act).await, 1, "超员了");
}

/// 【退了位子要还回来】。这正是限量库存那条的同一个坑：只减不还的话，
/// 一场活动会在坐满之前先「坐满」。
#[tokio::test]
async fn 退订把位子还回去() {
    let pool = db_or_skip!();
    let act = 一场活动(&pool, 1, 24, "open", r#"["cn"]"#).await;
    let a = common::user(&pool).await;
    let b = common::user(&pool).await;

    activity::register(&pool, &act, &a, "cn").await.expect("a 报名");
    activity::cancel(&pool, &act, &a).await.expect("a 退订");
    assert_eq!(报了几个人(&pool, &act).await, 0, "退订之后名单上还有人");

    activity::register(&pool, &act, &b, "cn").await.expect("b 顶上");
    assert_eq!(报了几个人(&pool, &act).await, 1, "位子没还回来，b 报不进去");
}

/// 退过之后本人还能再报回来 —— 表上是 UNIQUE(user_id, activity_id)，
/// 退订是把那一行标成 cancelled 而不是删掉，所以再报走的是 ON CONFLICT 那一支。
#[tokio::test]
async fn 退了还能再报() {
    let pool = db_or_skip!();
    let act = 一场活动(&pool, 10, 24, "open", r#"["cn"]"#).await;
    let u = common::user(&pool).await;

    activity::register(&pool, &act, &u, "cn").await.expect("报名");
    activity::cancel(&pool, &act, &u).await.expect("退订");
    activity::register(&pool, &act, &u, "cn").await.expect("再报一次");
    assert_eq!(报了几个人(&pool, &act).await, 1, "再报没报上");
}

/// 没报过的人退不了 —— 回 404 而不是静静地成功。
#[tokio::test]
async fn 没报过退不了() {
    let pool = db_or_skip!();
    let act = 一场活动(&pool, 10, 24, "open", r#"["cn"]"#).await;
    let u = common::user(&pool).await;

    let err = activity::cancel(&pool, &act, &u).await.unwrap_err();
    assert!(matches!(err, DomainError::NotFound(_)), "该是 NotFound，实际 {err:?}");
}

/// 【开场了就报不了】。时间过了还能报名的话，名单上会出现从没到过场的人。
#[tokio::test]
async fn 开场了就报不了() {
    let pool = db_or_skip!();
    let act = 一场活动(&pool, 10, -2, "open", r#"["cn"]"#).await;
    let u = common::user(&pool).await;

    let err = activity::register(&pool, &act, &u, "cn").await.unwrap_err();
    assert!(matches!(err, DomainError::Validation(_)), "该是 Validation，实际 {err:?}");
}

/// 【别的区的场，说成「没有这一场」】——跟券那一处同一句话。
/// 回「不对你开放」等于告诉他这一场在别的区办着。
#[tokio::test]
async fn 别的区的场看不见也报不了() {
    let pool = db_or_skip!();
    let act = 一场活动(&pool, 10, 24, "open", r#"["jp"]"#).await;
    let u = common::user(&pool).await;

    let err = activity::register(&pool, &act, &u, "cn").await.unwrap_err();
    assert!(matches!(err, DomainError::NotFound(_)), "该是 NotFound，实际 {err:?}");
}

/// 关掉的场报不了。
#[tokio::test]
async fn 关掉的场报不了() {
    let pool = db_or_skip!();
    let act = 一场活动(&pool, 10, 24, "closed", r#"["cn"]"#).await;
    let u = common::user(&pool).await;

    let err = activity::register(&pool, &act, &u, "cn").await.unwrap_err();
    assert!(matches!(err, DomainError::Validation(_)), "该是 Validation，实际 {err:?}");
}

/// 【签到要发得出那枚徽章】。「到过场」的规则是
/// `{"action":"activity.checkin","threshold":1}`，
/// 而在这条链接上之前，全仓没有任何地方触发这个动作 ——
/// 六枚徽章里有一枚从建库起就发不出来。
#[tokio::test]
async fn 签到发出到过场那枚徽章() {
    let pool = db_or_skip!();
    let act = 一场活动(&pool, 10, 24, "open", r#"["cn"]"#).await;
    let u = common::user(&pool).await;
    let 报名号 = activity::register(&pool, &act, &u, "cn").await.expect("报名");

    // 自己种一枚，不依赖 seed —— 开发库里有没有那一枚不该决定这条测试的成败
    let badge = common::uniq("b");
    sqlx::query(
        r#"INSERT INTO badge(id, code, name, description, rule_dsl)
           VALUES ($1, $1, '到过场', '测试用',
                   '{"type":"count","action":"activity.checkin","threshold":1}'::jsonb)"#,
    )
    .bind(&badge)
    .execute(&pool)
    .await
    .expect("种徽章");

    activity::check_in(&pool, &报名号, &Actor::admin("adm-test")).await.expect("签到");

    let 有了 = common::scalar_i64(
        &pool,
        "SELECT count(*) FROM user_badge WHERE badge_id=$1",
        &badge,
    )
    .await;
    assert_eq!(有了, 1, "签到了而徽章没发出来");
}

/// 签两次要说「已经签过了」，不能报成功 —— 现场的人得知道刚才那一下算不算数。
#[tokio::test]
async fn 签两次说得出已经签过() {
    let pool = db_or_skip!();
    let act = 一场活动(&pool, 10, 24, "open", r#"["cn"]"#).await;
    let u = common::user(&pool).await;
    let 报名号 = activity::register(&pool, &act, &u, "cn").await.expect("报名");

    activity::check_in(&pool, &报名号, &Actor::admin("a")).await.expect("第一次");
    let err = activity::check_in(&pool, &报名号, &Actor::admin("a")).await.unwrap_err();
    assert!(matches!(err, DomainError::Conflict(_)), "该是 Conflict，实际 {err:?}");
}

/// 签到过就退不了 —— 人已经到场了还能把自己从名单上撤掉的话，
/// 签到那个时刻就成了一件事后可以否认的事，而徽章已经发出去了。
#[tokio::test]
async fn 签到过的退不了() {
    let pool = db_or_skip!();
    let act = 一场活动(&pool, 10, 24, "open", r#"["cn"]"#).await;
    let u = common::user(&pool).await;
    let 报名号 = activity::register(&pool, &act, &u, "cn").await.expect("报名");
    activity::check_in(&pool, &报名号, &Actor::admin("a")).await.expect("签到");

    let err = activity::cancel(&pool, &act, &u).await.unwrap_err();
    assert!(matches!(err, DomainError::NotFound(_)), "该是 NotFound，实际 {err:?}");
}

/// 不存在的报名号签不了 —— 回 404 而不是 Ok。
#[tokio::test]
async fn 幽灵报名号签不了() {
    let pool = db_or_skip!();
    let err = activity::check_in(&pool, "areg-does-not-exist", &Actor::admin("a"))
        .await
        .unwrap_err();
    assert!(matches!(err, DomainError::NotFound(_)), "该是 NotFound，实际 {err:?}");
}

/// 「我报了哪些」要只回自己的、且退掉的不算。
#[tokio::test]
async fn 我报了哪些只回自己那些() {
    let pool = db_or_skip!();
    let 甲 = 一场活动(&pool, 10, 24, "open", r#"["cn"]"#).await;
    let 乙 = 一场活动(&pool, 10, 24, "open", r#"["cn"]"#).await;
    let 我 = common::user(&pool).await;
    let 别人 = common::user(&pool).await;

    activity::register(&pool, &甲, &我, "cn").await.expect("我报甲");
    activity::register(&pool, &乙, &我, "cn").await.expect("我报乙");
    activity::register(&pool, &甲, &别人, "cn").await.expect("别人报甲");
    activity::cancel(&pool, &乙, &我).await.expect("我退乙");

    let 我的 = activity::mine(&pool, &我).await.expect("我报了哪些");
    assert_eq!(我的, vec![甲.clone()], "退掉的还在里头，或者混进了别人的");
}
