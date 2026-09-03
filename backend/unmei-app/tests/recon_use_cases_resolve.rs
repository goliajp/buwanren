//! 对账与风控的收尾动作 · 对真库。
//!
//! 这两块此前都只有「找出来」没有「处理掉」:本机库里 1432 条对不上的账
//! （716 条金额不符 ¥111,518、716 条渠道有我们没有 ¥2,058），
//! `resolved_at` 全是空 —— 不是没人处理，是没有处理的路。

mod common;

use unmei_app::{recon, risk, Actor, DomainError};
use unmei_domain::commerce::enums::RiskCaseState;

async fn 造一条差异(pool: &sqlx::PgPool, state: &str) -> (String, String) {
    let batch = format!("rb-t{}", uuid::Uuid::new_v4().simple());
    /* uq_recon_batch 是 (channel, batch_date, source) —— 一个月只有 28 天，
       并行跑的九条测试必然撞。渠道名带上 uuid 才真的唯一。
       （日期也随机，纯粹是让失败时的信息好读一点。） */
    let 种 = uuid::Uuid::new_v4();
    let 渠道 = format!("t-{}", &种.simple().to_string()[..12]);
    let 日: i32 = 1 + (种.as_u128() % 28) as i32;
    sqlx::query(
        "INSERT INTO recon_batch(id, channel, batch_date, source, status,
                                 total_count, total_amount_minor, currency, region)
         VALUES ($1, $2, make_date(1900, 1, $3), 'channel_pulled', 'has_discrepancy',
                 1, 19900, 'CNY', 'cn')",
    ).bind(&batch).bind(&渠道).bind(日).execute(pool).await.expect("插批次");

    let rec = format!("rr-t{}", uuid::Uuid::new_v4().simple());
    sqlx::query(
        "INSERT INTO recon_record(id, batch_id, channel_txn_id, channel_amount_minor,
                                  channel_status, match_state)
         VALUES ($1, $2, $3, 19900, 'SUCCESS', $4)",
    ).bind(&rec).bind(&batch)
     .bind(format!("txn-{}", uuid::Uuid::new_v4().simple()))
     .bind(state)
     .execute(pool).await.expect("插记录");
    (batch, rec)
}

#[tokio::test]
async fn 对不上的账结得掉并且记下是谁怎么判的() {
    let pool = db_or_skip!();
    let (batch, rec) = 造一条差异(&pool, "amount_mismatch").await;

    let 回 = recon::resolve_record(
        &pool, &rec, "known_fee", "差的 3 分是微信手续费，对得上", &Actor::system(),
    ).await.expect("结掉");
    assert_eq!(回, batch);

    let act = common::scalar_string(&pool, "SELECT resolved_action FROM recon_record WHERE id=$1", &rec).await;
    assert_eq!(act.as_deref(), Some("known_fee"));
    let note = common::scalar_string(&pool, "SELECT resolved_note FROM recon_record WHERE id=$1", &rec).await;
    // 【结论要留下来】。只有四个动作词的话，下个月同一笔再对不上时
    // 这条记录帮不上忙 —— 那句话才是它的价值
    assert_eq!(note.as_deref(), Some("差的 3 分是微信手续费，对得上"));
}

#[tokio::test]
async fn 空的结论不算结() {
    let pool = db_or_skip!();
    let (_, rec) = 造一条差异(&pool, "amount_mismatch").await;
    let e = recon::resolve_record(&pool, &rec, "known_fee", "   ", &Actor::system())
        .await.unwrap_err();
    assert!(matches!(e, DomainError::Validation(_)), "拿到的是 {e:?}");
}

#[tokio::test]
async fn 结法必须是那四种之一() {
    let pool = db_or_skip!();
    let (_, rec) = 造一条差异(&pool, "amount_mismatch").await;
    /* 【「已处理」不能退化成「已看过」】。四个动作对应四种真实情形，
       随便一个词都收的话，这一列就再也说明不了什么。 */
    let e = recon::resolve_record(&pool, &rec, "看过了", "嗯", &Actor::system())
        .await.unwrap_err();
    assert!(matches!(e, DomainError::Validation(_)), "拿到的是 {e:?}");
}

#[tokio::test]
async fn 结过的不能再结() {
    let pool = db_or_skip!();
    let (_, rec) = 造一条差异(&pool, "missing_in_internal").await;
    recon::resolve_record(&pool, &rec, "ours_missing", "已补记", &Actor::system())
        .await.expect("第一次");
    // 覆盖一次就少一次记录 —— 结论要能追溯到一个人和一个时刻
    let e = recon::resolve_record(&pool, &rec, "channel_wrong", "改主意了", &Actor::system())
        .await.unwrap_err();
    assert!(matches!(e, DomainError::Conflict(_)), "拿到的是 {e:?}");
}

#[tokio::test]
async fn 本来就对得上的没什么可结() {
    let pool = db_or_skip!();
    let (_, rec) = 造一条差异(&pool, "matched").await;
    let e = recon::resolve_record(&pool, &rec, "known_fee", "随便写", &Actor::system())
        .await.unwrap_err();
    assert!(matches!(e, DomainError::Validation(_)), "拿到的是 {e:?}");
}

#[tokio::test]
async fn 整批结完批次才算结() {
    let pool = db_or_skip!();
    let (batch, rec1) = 造一条差异(&pool, "amount_mismatch").await;
    // 同一批里再塞一条
    let rec2 = format!("rr-t{}", uuid::Uuid::new_v4().simple());
    sqlx::query(
        "INSERT INTO recon_record(id, batch_id, channel_txn_id, channel_amount_minor,
                                  channel_status, match_state)
         VALUES ($1, $2, $3, 100, 'SUCCESS', 'missing_in_internal')",
    ).bind(&rec2).bind(&batch)
     .bind(format!("txn-{}", uuid::Uuid::new_v4().simple()))
     .execute(&pool).await.expect("插第二条");

    /* `common::scalar_string` 拿 NULL 会 panic（它 decode 成 String，
       不是 Option<String>）——而「这一格还是空的」正是这里要断言的事。
       所以数一数，不取值。 */
    let 批次结了 = |b: &str| {
        let b = b.to_string();
        let pool = pool.clone();
        async move {
            common::scalar_i64(
                &pool,
                "SELECT COUNT(*)::int8 FROM recon_batch WHERE id=$1 AND resolved_at IS NOT NULL",
                &b,
            ).await
        }
    };

    recon::resolve_record(&pool, &rec1, "known_fee", "手续费", &Actor::system()).await.expect("结第一条");
    // 【还剩一条没结就不能说这一批不用再看了】
    assert_eq!(批次结了(&batch).await, 0, "只结了一条，批次不该算结");

    recon::resolve_record(&pool, &rec2, "ours_missing", "已补记", &Actor::system()).await.expect("结第二条");
    assert_eq!(批次结了(&batch).await, 1, "两条都结了，批次才算结");
}

// ═══════════════════════════ 风控案子 ═══════════════════════════

async fn 造个案子(pool: &sqlx::PgPool) -> String {
    let id = format!("rc-t{}", uuid::Uuid::new_v4().simple());
    sqlx::query(
        "INSERT INTO risk_case(id, kind, severity, state, opened_at, audit_note, region)
         VALUES ($1, 'manual', 'med', 'open', NOW(), '', 'cn')",
    ).bind(&id).execute(pool).await.expect("插案子");
    id
}

#[tokio::test]
async fn 案子结得掉() {
    let pool = db_or_skip!();
    let c = 造个案子(&pool).await;
    let st = risk::close_case(&pool, &c, "resolved", "查过了，是本人操作", &Actor::system())
        .await.expect("结案");
    assert_eq!(st, RiskCaseState::Resolved);

    let 关于 = common::scalar_string(&pool, "SELECT closed_at::text FROM risk_case WHERE id=$1", &c).await;
    assert!(关于.is_some(), "结了案要记下时刻");
    let 审计 = common::scalar_string(&pool, "SELECT audit_note FROM risk_case WHERE id=$1", &c).await;
    assert!(审计.unwrap_or_default().contains("是本人操作"), "结论要落在审计里");
}

#[tokio::test]
async fn 误报和已处理要分得开() {
    let pool = db_or_skip!();
    let c = 造个案子(&pool).await;
    /* 【混成一个的话，规则调不调、调哪一条就无从判断】。
       `resolved` 是「确实有问题，已处理」，
       `false_positive` 是「规则报错了」。 */
    let st = risk::close_case(&pool, &c, "false_positive", "规则把老客户误判了", &Actor::system())
        .await.expect("标误报");
    assert_eq!(st, RiskCaseState::FalsePositive);
}

#[tokio::test]
async fn 结了的案子不回头() {
    let pool = db_or_skip!();
    let c = 造个案子(&pool).await;
    risk::close_case(&pool, &c, "resolved", "处理完了", &Actor::system()).await.expect("结案");
    // 判错了要重开是【新】的一件事 —— 抹掉旧结论之后
    // 没人看得出它曾经被结过
    let e = risk::close_case(&pool, &c, "open", "再看看", &Actor::system()).await.unwrap_err();
    assert!(matches!(e, DomainError::IllegalStateTransition { .. }), "拿到的是 {e:?}");
}
