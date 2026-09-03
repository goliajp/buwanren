//! 订阅 dunning 阶梯 · 对真库。
//!
//! 阶梯要钉住的是**它有终点**。没有阶梯的时候,一次扣款失败等于永久失联:
//! `renew_due` 出错、事务回滚、`next_billing_attempt_at` 原地不动,
//! worker 每 5 分钟把这条订阅重新选出来一次,直到有人去库里手改。
//!
//! 所以断言集中在两件事:每一级都把下次重试推远了;第六次之后不再有下一次。

mod common;

use chrono::{DateTime, Duration, Utc};
use unmei_app::subscription::{record_renewal_failure, DunningStep};

/// 造一条到期待续的订阅,附一张 open 账单。
async fn due_subscription(pool: &sqlx::PgPool) -> String {
    let user = common::user(pool).await;
    let sku = common::sku_with_price(pool, "CNY", 3900).await;
    let plan = common::uniq("plan");
    sqlx::query(
        "INSERT INTO plan(id, sku_id, name, billing_period, status) \
         VALUES ($1, $2, '测试套餐', 'month', 'active')",
    )
    .bind(&plan)
    .bind(&sku)
    .execute(pool)
    .await
    .expect("建套餐");

    let sub = common::uniq("sub");
    sqlx::query(
        "INSERT INTO subscription(id, user_id, plan_id, status, source_channel, \
           current_period_start, current_period_end, next_billing_attempt_at, region) \
         VALUES ($1, $2, $3, 'active', 'wechat_mp', NOW() - INTERVAL '30 days', NOW(), NOW(), 'cn')",
    )
    .bind(&sub)
    .bind(&user)
    .bind(&plan)
    .execute(pool)
    .await
    .expect("建订阅");

    sqlx::query(
        "INSERT INTO subscription_invoice(id, subscription_id, period_start, period_end, \
           amount_minor, currency, status, attempt_count, next_attempt_at, region) \
         VALUES ($1, $2, NOW(), NOW() + INTERVAL '30 days', 3900, 'CNY', 'open', 0, NOW(), 'cn')",
    )
    .bind(common::uniq("inv"))
    .bind(&sub)
    .execute(pool)
    .await
    .expect("建账单");

    sub
}

async fn sub_status(pool: &sqlx::PgPool, sub: &str) -> String {
    sqlx::query_scalar("SELECT status FROM subscription WHERE id=$1")
        .bind(sub).fetch_one(pool).await.expect("查状态")
}

async fn next_billing(pool: &sqlx::PgPool, sub: &str) -> Option<DateTime<Utc>> {
    sqlx::query_scalar("SELECT next_billing_attempt_at FROM subscription WHERE id=$1")
        .bind(sub).fetch_one(pool).await.expect("查下次扣款")
}

async fn invoice_status(pool: &sqlx::PgPool, sub: &str) -> String {
    sqlx::query_scalar(
        "SELECT status FROM subscription_invoice WHERE subscription_id=$1 ORDER BY created_at DESC LIMIT 1",
    ).bind(sub).fetch_one(pool).await.expect("查账单")
}

/// 天数误差容一分钟 —— 断言的是阶梯的级差,不是时钟。
fn about_days_away(t: DateTime<Utc>, days: i64) -> bool {
    let want = Utc::now() + Duration::days(days);
    (t - want).num_seconds().abs() < 60
}

// ═══════════════════════ 三次重试 ═══════════════════════

#[tokio::test]
async fn three_retries_back_off_one_three_seven_days() {
    let pool = db_or_skip!();
    let sub = due_subscription(&pool).await;

    for (n, days) in [(1, 1), (2, 3), (3, 7)] {
        let step = record_renewal_failure(&pool, &sub, "mock 收款失败").await.expect("记失败");
        match step {
            DunningStep::Retry { attempt, next_attempt_at } => {
                assert_eq!(attempt, n);
                assert!(about_days_away(next_attempt_at, days), "第 {n} 次该退 {days} 天");
            }
            other => panic!("第 {n} 次不该是 {other:?}"),
        }
        // 订阅本身还在正常态 —— 重试期间不该让用户先失去服务
        assert_eq!(sub_status(&pool, &sub).await, "active");
        assert!(about_days_away(next_billing(&pool, &sub).await.expect("有下次"), days));
    }
}

// ═══════════════════════ past_due → grace → expired ═══════════════════════

#[tokio::test]
async fn fourth_failure_is_past_due_and_emits_an_event() {
    let pool = db_or_skip!();
    let sub = due_subscription(&pool).await;
    for _ in 0..3 { record_renewal_failure(&pool, &sub, "x").await.unwrap(); }

    let step = record_renewal_failure(&pool, &sub, "x").await.expect("第四次");
    assert!(matches!(step, DunningStep::PastDue { attempt: 4, .. }), "实际 {step:?}");
    assert_eq!(sub_status(&pool, &sub).await, "past_due");
    assert_eq!(common::outbox_count(&pool, "SubscriptionPastDue", &sub).await, 1);
}

#[tokio::test]
async fn fifth_failure_is_grace() {
    let pool = db_or_skip!();
    let sub = due_subscription(&pool).await;
    for _ in 0..4 { record_renewal_failure(&pool, &sub, "x").await.unwrap(); }

    let step = record_renewal_failure(&pool, &sub, "x").await.expect("第五次");
    assert!(matches!(step, DunningStep::Grace { attempt: 5, .. }), "实际 {step:?}");
    assert_eq!(sub_status(&pool, &sub).await, "grace");
}

#[tokio::test]
async fn the_ladder_ends_and_does_not_retry_forever() {
    let pool = db_or_skip!();
    let sub = due_subscription(&pool).await;
    for _ in 0..5 { record_renewal_failure(&pool, &sub, "x").await.unwrap(); }

    let step = record_renewal_failure(&pool, &sub, "x").await.expect("第六次");
    assert!(matches!(step, DunningStep::Expired { attempt: 6 }), "实际 {step:?}");
    assert_eq!(sub_status(&pool, &sub).await, "expired");
    // ★ 这一条才是阶梯的意义:不再有下一次。没有它就是每 5 分钟重试到永远
    assert_eq!(next_billing(&pool, &sub).await, None, "走完阶梯后不该再排下一次扣款");
    assert_eq!(invoice_status(&pool, &sub).await, "uncollectible");
    assert_eq!(common::outbox_count(&pool, "SubscriptionExpired", &sub).await, 1);
}

// ═══════════════════════ 边角 ═══════════════════════

#[tokio::test]
async fn each_failure_advances_the_invoice_attempt_count() {
    let pool = db_or_skip!();
    let sub = due_subscription(&pool).await;
    for want in 1..=3 {
        record_renewal_failure(&pool, &sub, "x").await.unwrap();
        let n: i32 = sqlx::query_scalar(
            "SELECT attempt_count FROM subscription_invoice WHERE subscription_id=$1",
        ).bind(&sub).fetch_one(&pool).await.expect("查次数");
        assert_eq!(n, want);
    }
}

#[tokio::test]
async fn failure_without_an_open_invoice_still_backs_off() {
    let pool = db_or_skip!();
    let sub = due_subscription(&pool).await;
    sqlx::query("UPDATE subscription_invoice SET status='void' WHERE subscription_id=$1")
        .bind(&sub).execute(&pool).await.expect("作废账单");

    // 失败发生在建账单之前(多半是库层面的临时故障)。没有账单可记,
    // 但绝不能把订阅留在「5 分钟一次」上。
    let step = record_renewal_failure(&pool, &sub, "库挂了").await.expect("记失败");
    assert!(matches!(step, DunningStep::Retry { attempt: 1, .. }), "实际 {step:?}");
    assert!(about_days_away(next_billing(&pool, &sub).await.expect("有下次"), 1));
}

#[tokio::test]
async fn expired_subscription_is_no_longer_picked_up_by_the_sweeper() {
    let pool = db_or_skip!();
    let sub = due_subscription(&pool).await;
    for _ in 0..6 { record_renewal_failure(&pool, &sub, "x").await.unwrap(); }

    // worker 的选取条件:status IN (active,past_due,trialing) AND next_billing_attempt_at <= NOW()
    let picked: Option<String> = sqlx::query_scalar(
        "SELECT id FROM subscription WHERE id=$1 \
           AND status IN ('active','past_due','trialing') \
           AND next_billing_attempt_at IS NOT NULL AND next_billing_attempt_at <= NOW()",
    ).bind(&sub).fetch_optional(&pool).await.expect("按 worker 的条件选");
    assert!(picked.is_none(), "已 expired 的订阅不该再被扫出来");
}

// ═════════ 2026-09-04 · 没有下次扣款时间的订阅不该是不死的 ═════════

/// 造一条【没有 next_billing_attempt_at】的活跃订阅，周期已走完。
/// 库里这种有 395 笔，周期全落在 2026-09-15 到 09-22。
async fn 到期而没有下次扣款时间(
    pool: &sqlx::PgPool,
    有没有价: bool,
    到期不续: bool,
) -> String {
    let user = common::user(pool).await;
    let sku = if 有没有价 {
        common::sku_with_price(pool, "CNY", 3900).await
    } else {
        common::sku_without_price(pool).await
    };
    let plan = common::uniq("plan");
    sqlx::query(
        "INSERT INTO plan(id, sku_id, name, billing_period, status) \
         VALUES ($1, $2, '测试套餐', 'month', 'active')",
    )
    .bind(&plan).bind(&sku).execute(pool).await.expect("建套餐");

    let sub = common::uniq("sub");
    sqlx::query(
        "INSERT INTO subscription(id, user_id, plan_id, status, source_channel, \
           current_period_start, current_period_end, next_billing_attempt_at, \
           cancel_at_period_end, region) \
         VALUES ($1, $2, $3, 'active', 'wechat_mp', NOW() - INTERVAL '31 days', \
                 NOW() - INTERVAL '1 day', NULL, $4, 'cn')",
    )
    .bind(&sub).bind(&user).bind(&plan).bind(到期不续)
    .execute(pool).await.expect("建订阅");
    sub
}

/// 【周期走完了就该续上】——而这一条在补 worker 捞取条件之前
/// 根本不会被看到一眼（worker 只捞 `next_billing_attempt_at <= NOW()`）。
#[tokio::test]
async fn 没有下次扣款时间但周期走完的订阅会续上() {
    let pool = db_or_skip!();
    let sub = 到期而没有下次扣款时间(&pool, true, false).await;

    let 结果 = unmei_app::subscription::renew_due(&pool, &sub).await.expect("续费");
    assert!(
        matches!(结果, unmei_app::subscription::RenewOutcome::Renewed { .. }),
        "该续上，实际 {结果:?}",
    );
    assert_eq!(sub_status(&pool, &sub).await, "active");
    assert!(
        next_billing(&pool, &sub).await.is_some(),
        "续上了却还是没有下次扣款时间 —— 那它下个月又成了不死的",
    );
}

/// 【点过「到期不续」的要真的停】。「停」只发生在 `renew_due` 里，
/// 而它只对被 worker 捞到的行跑 —— 库里 201 笔就这么停不下来。
#[tokio::test]
async fn 到期不续且没有下次扣款时间的订阅会真的停() {
    let pool = db_or_skip!();
    let sub = 到期而没有下次扣款时间(&pool, true, true).await;

    let 结果 = unmei_app::subscription::renew_due(&pool, &sub).await.expect("续费");
    assert!(
        matches!(结果, unmei_app::subscription::RenewOutcome::StoppedAtPeriodEnd),
        "该停，实际 {结果:?}",
    );
    assert_eq!(sub_status(&pool, &sub).await, "cancelled", "点了到期不续却还在服务");
}

/// 【套餐没价 = 收不了钱 = 服务不能继续】。
///
/// 这一支原先只清掉重试时间就返回，订阅留在 active ——
/// 止住的是重试，不是服务：人照用、钱不再收，而且此后再也不会被看到一眼。
#[tokio::test]
async fn 无价套餐的订阅到期就停而不是白给() {
    let pool = db_or_skip!();
    let sub = 到期而没有下次扣款时间(&pool, false, false).await;

    let 结果 = unmei_app::subscription::renew_due(&pool, &sub).await.expect("续费");
    assert!(
        matches!(结果, unmei_app::subscription::RenewOutcome::Unpriced),
        "该报无价，实际 {结果:?}",
    );
    assert_eq!(
        sub_status(&pool, &sub).await, "cancelled",
        "套餐没价而订阅还在 active —— 那就是白给服务",
    );
    assert!(next_billing(&pool, &sub).await.is_none(), "还留着下次扣款时间");
}

/// 周期【还没走完】的不许被动 —— 那是绝大多数订阅的样子。
#[tokio::test]
async fn 周期没走完的订阅不会被提前处理() {
    let pool = db_or_skip!();
    let sub = 到期而没有下次扣款时间(&pool, true, true).await;
    sqlx::query("UPDATE subscription SET current_period_end = NOW() + INTERVAL '10 days' WHERE id=$1")
        .bind(&sub).execute(&pool).await.expect("推到未来");

    let 结果 = unmei_app::subscription::renew_due(&pool, &sub).await.expect("续费");
    assert!(
        matches!(结果, unmei_app::subscription::RenewOutcome::NotDue),
        "周期没走完就动了它，实际 {结果:?}",
    );
    assert_eq!(sub_status(&pool, &sub).await, "active");
}
