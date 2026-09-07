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
        matches!(结果, unmei_app::subscription::RenewOutcome::AwaitingPayment { .. }),
        "该开出这一期的单，实际 {结果:?}",
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

// ═══════════════════ 「按你缺的那一味配」那一档 ═══════════════════

/// 给这个人一份本命 + 命局简介，返回那一份的 id。
/// （跟 `order_use_cases.rs` 里那一份是同一件事的两处夹具 ——
///  夹具不共用是有意的：共用的话，一处改动会同时改掉两支的前提。）
async fn 给他一份本命(pool: &sqlx::PgPool, user: &str) -> String {
    let natal = common::uniq("natal");
    sqlx::query(
        "INSERT INTO natal(id, user_id, label, year, month, day, hour, minute, gender)
         VALUES ($1,$2,'我',1998,3,5,14,30,'male')",
    ).bind(&natal).bind(user).execute(pool).await.expect("插本命");
    sqlx::query(
        // `mingli_version` 是 NOT NULL —— 少了它报的是「插简介失败」，
        // 跟被测的那件事没关系
        "INSERT INTO natal_summary(natal_id, day_master, strength_level, strength_score,
                                   primary_yongshen, primary_role, secondary_yongshen,
                                   avoid_wuxing, pattern_name, friendly_hint, mingli_version)
         VALUES ($1,'丁','偏弱',40,'金','印星','土','[]'::jsonb,'建禄格','该收的收','test')",
    ).bind(&natal).execute(pool).await.expect("插简介");
    sqlx::query("UPDATE app_user SET active_natal_id=$1 WHERE id=$2")
        .bind(&natal).bind(user).execute(pool).await.expect("挂上");
    natal
}

/// 把这一档的 sku 标成「要按用神配」。
async fn 标成要配的(pool: &sqlx::PgPool, sub: &str) {
    sqlx::query(
        "UPDATE sku SET spec_json = spec_json || '{\"needs_yongshen\":true}'::jsonb
          WHERE id = (SELECT p.sku_id FROM subscription s JOIN plan p ON p.id=s.plan_id
                       WHERE s.id=$1)",
    )
    .bind(sub).execute(pool).await.expect("标 needs_yongshen");
}

async fn 这一份的失败码(pool: &sqlx::PgPool, sub: &str) -> String {
    sqlx::query_scalar("SELECT last_failure_code FROM subscription WHERE id=$1")
        .bind(sub).fetch_one(pool).await.expect("查失败码")
}

async fn 这一份续出几张单(pool: &sqlx::PgPool, sub: &str) -> i64 {
    sqlx::query_scalar(
        "SELECT count(*)::int8 FROM order_record
          WHERE source_kind='subscription_renew'
            AND source_ref_id IN (SELECT id FROM subscription_invoice WHERE subscription_id=$1)",
    ).bind(sub).fetch_one(pool).await.expect("数续费单")
}

/// 【拿不到用神就这一期不扣钱】（2026-09-07）。
///
/// 下单那条路早上接上了用神，而续费**不经过 `order::create`** ——
/// 它自己拼 order_record + order_line，于是第一盒记着照谁的盘配，
/// 之后每一盒都不记：钱照扣，装箱的人照默认款发。
/// 全量门禁在一轮真跑上抓到了那张单（`check-yongshen-recorded`）。
///
/// 收了钱按默认款发出去比不发更糟 —— 买家会以为这就是他买的东西。
#[tokio::test]
async fn 按用神配的那一档拿不到用神就不扣这一期的钱() {
    let pool = db_or_skip!();
    let sub = 到期而没有下次扣款时间(&pool, true, false).await;
    标成要配的(&pool, &sub).await;   // 而这个用户没有本命

    let 结果 = unmei_app::subscription::renew_due(&pool, &sub).await.expect("续费");
    assert!(
        matches!(结果, unmei_app::subscription::RenewOutcome::NeedsYongshen),
        "该说「还不知道他缺什么」，实际 {结果:?}",
    );
    assert_eq!(这一份续出几张单(&pool, &sub).await, 0, "钱扣了 —— 而没人知道该配哪一味");
    assert_eq!(
        这一份的失败码(&pool, &sub).await, "need_yongshen",
        "屏上那句「先把出生时间填了」靠这个码，它不写就没人说得出为什么",
    );
    assert_eq!(sub_status(&pool, &sub).await, "active", "这不是欠费，不该改状态");
    assert!(
        next_billing(&pool, &sub).await.is_some(),
        "不留下次再问的时间 = 这一份从此没人看它一眼",
    );
}

/// 填了生辰之后，下一轮真的续得动 —— 而且那一单记着照谁的盘配。
#[tokio::test]
async fn 填了生辰之后续费单上记着照谁的盘配() {
    let pool = db_or_skip!();
    let sub = 到期而没有下次扣款时间(&pool, true, false).await;
    标成要配的(&pool, &sub).await;
    let user: String = sqlx::query_scalar("SELECT user_id FROM subscription WHERE id=$1")
        .bind(&sub).fetch_one(&pool).await.expect("查人");
    let natal = 给他一份本命(&pool, &user).await;

    let 结果 = unmei_app::subscription::renew_due(&pool, &sub).await.expect("续费");
    assert!(
        matches!(结果, unmei_app::subscription::RenewOutcome::AwaitingPayment { .. }),
        "填了生辰还开不出单，实际 {结果:?}",
    );
    let 记的: String = sqlx::query_scalar(
        "SELECT COALESCE(om.extra_json->'yongshen'->>'primary','')
           FROM order_record o JOIN order_meta om ON om.order_id=o.id
          WHERE o.source_kind='subscription_renew'
            AND o.source_ref_id IN (SELECT id FROM subscription_invoice WHERE subscription_id=$1)
          ORDER BY o.created_at DESC LIMIT 1",
    ).bind(&sub).fetch_one(&pool).await.expect("查续费单上的用神");
    assert_eq!(记的, "金", "续费单上没记用神 —— 装箱的人还是不知道配哪一味");
    let 用的盘: String = sqlx::query_scalar(
        "SELECT COALESCE(om.extra_json->'yongshen'->>'natal_id','')
           FROM order_record o JOIN order_meta om ON om.order_id=o.id
          WHERE o.source_kind='subscription_renew'
            AND o.source_ref_id IN (SELECT id FROM subscription_invoice WHERE subscription_id=$1)
          ORDER BY o.created_at DESC LIMIT 1",
    ).bind(&sub).fetch_one(&pool).await.expect("查盘");
    assert_eq!(用的盘, natal, "记的不是他此刻在用的那一份盘");
    /* 【开完单挂的是「该你付了」，不再是「还不知道你缺什么」】。
       钱还没到，所以不能是空 —— 空的意思是「这一期结清了」。 */
    assert_eq!(
        这一份的失败码(&pool, &sub).await, "needs_your_pay",
        "生辰补上了，屏上该换成「这一期该付了」，而不是继续叫人去填生辰",
    );
}
