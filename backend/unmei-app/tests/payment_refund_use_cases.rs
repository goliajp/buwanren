//! 支付与退款用例 · 对真库。
//!
//! 这两条链路碰钱,所以断言写得比别处细:不只看返回,也看订单侧的金额有没有跟着动。

mod common;

use unmei_app::{order, payment, refund, Actor, DomainError};

// ═══════════════════════════ 发起支付 ═══════════════════════════

#[tokio::test]
async fn start_charges_the_outstanding_balance_not_the_caller_supplied_amount() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 19900).await;

    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", Some("openid_x"))
        .await
        .expect("start payment");

    // 金额由服务端从订单算,调用方说了不算
    assert_eq!(pending.amount_minor, 19900);
    assert_eq!(pending.currency, "CNY");
    assert_eq!(pending.order_id, order_id);

    let status = common::scalar_string(&pool, "SELECT status FROM payment WHERE id=$1", &pending.payment_id).await;
    assert_eq!(status.as_deref(), Some("pending"));
}

#[tokio::test]
async fn start_by_non_owner_is_not_found() {
    let pool = db_or_skip!();
    let (_owner, order_id) = unpaid_order(&pool, 100).await;
    let intruder = common::user(&pool).await;

    let err = payment::start(&pool, &order_id, &intruder, "wechat_jsapi", None)
        .await
        .expect_err("非属主不能给别人的订单发起支付");
    assert!(matches!(err, DomainError::NotFound(_)), "实际 {err:?}");
}

#[tokio::test]
async fn start_on_already_paid_order_is_conflict() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 100).await;
    sqlx::query("UPDATE order_record SET status='paid' WHERE id=$1")
        .bind(&order_id)
        .execute(&pool)
        .await
        .expect("set paid");

    let err = payment::start(&pool, &order_id, &user, "wechat_jsapi", None)
        .await
        .expect_err("已付订单不该能再发起支付");
    assert!(matches!(err, DomainError::Conflict(_)), "实际 {err:?}");
}

#[tokio::test]
async fn record_attempt_numbers_sequentially_per_payment() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 100).await;
    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", None).await.expect("start");

    // 旧实现把 attempt_no 硬编码成 1,同一笔支付重试就撞唯一约束
    for _ in 0..3 {
        payment::record_attempt(
            &pool,
            &pending.payment_id,
            serde_json::json!({"try": true}),
            serde_json::json!({"ok": true}),
        )
        .await
        .expect("record attempt");
    }

    let nos: Vec<i32> = sqlx::query_scalar(
        "SELECT attempt_no FROM payment_attempt WHERE payment_id=$1 ORDER BY attempt_no",
    )
    .bind(&pending.payment_id)
    .fetch_all(&pool)
    .await
    .expect("query attempts");
    assert_eq!(nos, vec![1, 2, 3]);
}

#[tokio::test]
async fn mark_failed_rejects_payments_that_are_not_in_flight() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 100).await;
    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", None).await.expect("start");

    payment::mark_failed(&pool, &pending.payment_id, "E_TEST", "手工置失败", &Actor::admin("admin_root"))
        .await
        .expect("first mark_failed");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM payment WHERE id=$1", &pending.payment_id).await.as_deref(),
        Some("failed")
    );

    // 已经 failed 了,不该还能再置一次
    let err = payment::mark_failed(&pool, &pending.payment_id, "E", "再来", &Actor::admin("admin_root"))
        .await
        .expect_err("重复置失败该被拒");
    assert!(matches!(err, DomainError::Conflict(_)), "实际 {err:?}");
}

#[tokio::test]
async fn mark_failed_on_unknown_payment_is_not_found() {
    let pool = db_or_skip!();
    let err = payment::mark_failed(&pool, "pay-nope", "E", "m", &Actor::admin("a"))
        .await
        .expect_err("幽灵支付");
    assert!(matches!(err, DomainError::NotFound(_)));
}

// ═══════════════════════════ 回调入账 ═══════════════════════════

#[tokio::test]
async fn apply_succeeded_moves_order_to_paid_and_is_idempotent() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 19900).await;
    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", None).await.expect("start");

    payment::apply_succeeded(&pool, &pending.payment_id, chrono::Utc::now()).await.expect("callback");

    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("paid"));
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_paid_minor FROM order_record WHERE id=$1", &order_id).await,
        19900
    );

    // 渠道重复推同一笔回调是常态。第二次不该再加一遍钱 ——
    // UPDATE 上的 `status IN ('pending','processing')` 守着这件事。
    payment::apply_succeeded(&pool, &pending.payment_id, chrono::Utc::now()).await.expect("重复回调");
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_paid_minor FROM order_record WHERE id=$1", &order_id).await,
        19900,
        "重复回调不该重复入账"
    );
}

// ═══════════════════════════ 退款 ═══════════════════════════

#[tokio::test]
async fn request_computes_refundable_balance_server_side() {
    let pool = db_or_skip!();
    let (user, order_id, _payment_id) = paid_order(&pool, 19900).await;

    // 不传金额 = 全额
    let refund_id = refund::request(&pool, &order_id, &user, None, None, "user_request", Some("不想要了"))
        .await
        .expect("request refund");

    let amount = common::scalar_i64(&pool, "SELECT amount_minor FROM refund WHERE id=$1", &refund_id).await;
    assert_eq!(amount, 19900);
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM refund WHERE id=$1", &refund_id).await.as_deref(),
        Some("requested")
    );
}

#[tokio::test]
async fn request_rejects_amount_over_refundable_balance() {
    let pool = db_or_skip!();
    let (user, order_id, _p) = paid_order(&pool, 19900).await;

    let err = refund::request(&pool, &order_id, &user, None, Some(99_999_999), "greedy", None)
        .await
        .expect_err("超额退款该被拒");
    assert!(matches!(err, DomainError::Validation(_)), "实际 {err:?}");
}

#[tokio::test]
async fn request_without_a_successful_payment_is_rejected() {
    let pool = db_or_skip!();
    // 手工把订单标成已付但不给它成功支付行 —— 对账不上的状态不该能退款
    let (user, order_id) = unpaid_order(&pool, 100).await;
    sqlx::query("UPDATE order_record SET status='paid', amount_paid_minor=100 WHERE id=$1")
        .bind(&order_id)
        .execute(&pool)
        .await
        .expect("fake paid");

    let err = refund::request(&pool, &order_id, &user, None, None, "x", None)
        .await
        .expect_err("无成功支付不该能退");
    assert!(matches!(err, DomainError::Validation(_)), "实际 {err:?}");
}

#[tokio::test]
async fn approve_settles_refund_payment_and_order_together() {
    let pool = db_or_skip!();
    let (user, order_id, payment_id) = paid_order(&pool, 19900).await;
    let refund_id = refund::request(&pool, &order_id, &user, None, None, "user_request", None)
        .await
        .expect("request");

    refund::approve(&pool, &refund_id, &Actor::admin("admin_fin")).await.expect("approve");

    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM refund WHERE id=$1", &refund_id).await.as_deref(),
        Some("success")
    );
    assert_eq!(
        common::scalar_string(&pool, "SELECT approved_by_admin_id FROM refund WHERE id=$1", &refund_id).await.as_deref(),
        Some("admin_fin")
    );
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM payment WHERE id=$1", &payment_id).await.as_deref(),
        Some("refunded")
    );
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("refunded"));
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_refunded_minor FROM order_record WHERE id=$1", &order_id).await,
        19900
    );
    // 财务挂账靠这条事件驱动
    assert_eq!(common::outbox_count(&pool, "RefundCompleted", &refund_id).await, 1);
}

#[tokio::test]
async fn partial_approve_marks_order_refund_partial() {
    let pool = db_or_skip!();
    let (user, order_id, payment_id) = paid_order(&pool, 20000).await;
    let refund_id = refund::request(&pool, &order_id, &user, None, Some(5000), "partial", None)
        .await
        .expect("request partial");

    refund::approve(&pool, &refund_id, &Actor::admin("admin_fin")).await.expect("approve");

    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM payment WHERE id=$1", &payment_id).await.as_deref(),
        Some("refunded_partial")
    );
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("refund_partial"));
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_refunded_minor FROM order_record WHERE id=$1", &order_id).await,
        5000
    );
}

#[tokio::test]
async fn approve_twice_is_rejected() {
    let pool = db_or_skip!();
    let (user, order_id, _p) = paid_order(&pool, 100).await;
    let refund_id = refund::request(&pool, &order_id, &user, None, None, "x", None).await.expect("request");

    refund::approve(&pool, &refund_id, &Actor::admin("a")).await.expect("first approve");
    let err = refund::approve(&pool, &refund_id, &Actor::admin("a"))
        .await
        .expect_err("重复批准该被拒");
    assert!(matches!(err, DomainError::NotFound(_)), "实际 {err:?}");

    // 更要紧的是钱没被退第二遍
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_refunded_minor FROM order_record WHERE id=$1", &order_id).await,
        100
    );
}

#[tokio::test]
async fn deny_only_applies_to_pending_refunds() {
    let pool = db_or_skip!();
    let (user, order_id, _p) = paid_order(&pool, 100).await;
    let refund_id = refund::request(&pool, &order_id, &user, None, None, "x", None).await.expect("request");

    refund::deny(&pool, &refund_id, "证据不足", &Actor::admin("admin_kf")).await.expect("deny");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM refund WHERE id=$1", &refund_id).await.as_deref(),
        Some("cancelled")
    );

    // 旧实现不看影响行数,驳回一个已经驳回过的也返回 ok:true
    let err = refund::deny(&pool, &refund_id, "再驳一次", &Actor::admin("admin_kf"))
        .await
        .expect_err("已 cancelled 的退款不该能再驳");
    assert!(matches!(err, DomainError::NotFound(_)), "实际 {err:?}");
}

#[tokio::test]
async fn deny_unknown_refund_is_not_found() {
    let pool = db_or_skip!();
    let err = refund::deny(&pool, "rfd-nope", "x", &Actor::admin("a"))
        .await
        .expect_err("幽灵退款");
    assert!(matches!(err, DomainError::NotFound(_)));
}

// ═══════════════════════════ 辅助 ═══════════════════════════

async fn unpaid_order(pool: &sqlx::PgPool, price_minor: i64) -> (String, String) {
    let user = common::user(pool).await;
    let sku = common::sku_with_price(pool, "CNY", price_minor).await;
    let created = order::create(
        pool,
        order::NewOrder {
            user_id: user.clone(),
            region: "cn".into(),
            channel_origin: "web".into(),
            lines: vec![order::NewOrderLine { sku_id: sku, qty: 1 }],
            shipping_address: None,
            contact: None,
            coupon_codes: vec![],
            note: None,
            ip: None,
            ua: None,
        },
    )
    .await
    .expect("fixture order");
    (user, created.order_id)
}

/// 走完整路径的已付订单:建单 → 发起支付 → 回调入账。
/// 返回 (user_id, order_id, payment_id)。
async fn paid_order(pool: &sqlx::PgPool, price_minor: i64) -> (String, String, String) {
    let (user, order_id) = unpaid_order(pool, price_minor).await;
    let pending = payment::start(pool, &order_id, &user, "wechat_jsapi", None).await.expect("start");
    payment::apply_succeeded(pool, &pending.payment_id, chrono::Utc::now()).await.expect("callback");
    (user, order_id, pending.payment_id)
}
