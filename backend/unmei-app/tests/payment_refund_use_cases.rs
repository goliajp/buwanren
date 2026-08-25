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
async fn starting_twice_hands_back_the_same_pending_payment() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 19900).await;

    let first = payment::start(&pool, &order_id, &user, "wechat_jsapi", Some("openid_x"))
        .await
        .expect("第一次");
    let second = payment::start(&pool, &order_id, &user, "wechat_jsapi", Some("openid_x"))
        .await
        .expect("第二次");

    // 点第二次的意思是「我要接着付这张单」,不是「我要再付一笔」
    assert_eq!(first.payment_id, second.payment_id, "第二次该拿回同一笔");

    let n: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM payment WHERE order_id=$1 AND status='pending'",
    )
    .bind(&order_id)
    .fetch_one(&pool)
    .await
    .expect("count");
    assert_eq!(n, 1, "一张单同时只该有一笔待付");

    // 这才是那个洞真正要命的地方:两笔 pending 合计【超过应付】,
    // 渠道那一侧会真收第二笔,而系统这一侧永远记不进来。
    let sum: i64 = sqlx::query_scalar(
        "SELECT COALESCE(sum(amount_minor),0)::bigint FROM payment
          WHERE order_id=$1 AND status='pending'",
    )
    .bind(&order_id)
    .fetch_one(&pool)
    .await
    .expect("sum");
    assert_eq!(sum, 19900, "待付合计不该超过应付");
}

#[tokio::test]
async fn switching_channel_supersedes_the_old_pending_payment() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 19900).await;

    let first = payment::start(&pool, &order_id, &user, "wechat_jsapi", None).await.expect("微信");
    let second = payment::start(&pool, &order_id, &user, "alipay_wap", None).await.expect("支付宝");

    // 换渠道是明确的动作:旧的那笔作废,新的建出来
    assert_ne!(first.payment_id, second.payment_id, "换了渠道该是新的一笔");

    let old_status = common::scalar_string(
        &pool, "SELECT status FROM payment WHERE id=$1", &first.payment_id).await;
    assert_eq!(old_status.as_deref(), Some("expired"), "旧的那笔该被顶掉");

    // 顶掉的原因要写在案上 —— 一笔支付凭空变成 expired，查账的人得看得出是谁顶的
    let note = common::scalar_string(
        &pool, "SELECT audit_note FROM payment WHERE id=$1", &first.payment_id).await;
    assert!(note.as_deref().unwrap_or("").contains("顶掉"), "实际 {note:?}");

    let n: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM payment WHERE order_id=$1 AND status='pending'")
        .bind(&order_id).fetch_one(&pool).await.expect("count");
    assert_eq!(n, 1, "换完渠道仍然只有一笔待付");
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

    payment::apply_succeeded(&pool, &pending.payment_id, None, chrono::Utc::now()).await.expect("callback");

    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("paid"));
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_paid_minor FROM order_record WHERE id=$1", &order_id).await,
        19900
    );

    // 订单付清时要发 OrderPaid,dispatcher 靠它推进履约。
    // 这条事件原先只有 payment_sweep worker 会发,回调这条路不发 ——
    // 真接入微信后走 webhook 的支付就永远不会被履约。
    assert_eq!(common::outbox_count(&pool, "OrderPaid", &order_id).await, 1);

    // 渠道重复推同一笔回调是常态,微信 24 小时内最多推 15 次。
    // 重推既不该重复入账,也不该重复发事件(否则履约会跑两遍)。
    for _ in 0..3 {
        payment::apply_succeeded(&pool, &pending.payment_id, None, chrono::Utc::now()).await.expect("重复回调");
    }
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_paid_minor FROM order_record WHERE id=$1", &order_id).await,
        19900,
        "重复回调不该重复入账"
    );
    assert_eq!(
        common::outbox_count(&pool, "OrderPaid", &order_id).await,
        1,
        "重复回调不该重复发 OrderPaid"
    );
}

#[tokio::test]
async fn partial_payment_does_not_mark_order_paid_or_emit_order_paid() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 20000).await;
    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", None).await.expect("start");
    // 人为把这笔改成只付一半 —— 分期 / 混合支付的形态
    sqlx::query("UPDATE payment SET amount_minor=5000 WHERE id=$1")
        .bind(&pending.payment_id)
        .execute(&pool)
        .await
        .expect("shrink payment");

    payment::apply_succeeded(&pool, &pending.payment_id, None, chrono::Utc::now()).await.expect("callback");

    // 没付清就不该翻成 paid,也不该触发履约
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("unpaid"));
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_paid_minor FROM order_record WHERE id=$1", &order_id).await,
        5000
    );
    assert_eq!(common::outbox_count(&pool, "OrderPaid", &order_id).await, 0);
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

/// 渠道回报失败这条路径，不许把【已经成功】的一笔翻过去。
///
/// 后台手工那条（`payment::mark_failed`）自己写着这条规矩：状态不在
/// pending/processing/cancelling 就返回 Conflict。`apply_succeeded` 与
/// `apply_expired` 也都带着同样的状态守卫 —— 只有回调/轮询走的
/// `apply_failed` 没有。而迟到的失败回调、重推、以及 payment_sweep
/// 轮到一条陈旧的渠道记录，都会走到它。
#[tokio::test]
async fn a_late_failure_callback_does_not_undo_a_successful_payment() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 8800).await;

    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", None)
        .await
        .expect("start payment");
    payment::apply_succeeded(&pool, &pending.payment_id, Some("ch_txn_1"), chrono::Utc::now())
        .await
        .expect("pay");

    // 渠道随后又推来一条失败（乱序、重推、或轮询看到旧状态）
    payment::apply_failed(&pool, &pending.payment_id, "CHANNEL_TIMEOUT", "迟到的失败回调")
        .await
        .expect("apply_failed 本身不该报错");

    let status: String = sqlx::query_scalar("SELECT status FROM payment WHERE id=$1")
        .bind(&pending.payment_id)
        .fetch_one(&pool)
        .await
        .expect("读支付状态");
    assert_eq!(status, "success", "已经成功的支付不该被一条迟到的失败回调翻掉");
}

/// 正常那一半：还没成的那笔，失败回调要真的落下去。
#[tokio::test]
async fn a_failure_callback_marks_a_pending_payment_failed() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 8800).await;

    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", None)
        .await
        .expect("start payment");
    payment::apply_failed(&pool, &pending.payment_id, "INSUFFICIENT_FUNDS", "余额不足")
        .await
        .expect("apply_failed");

    let (status, code): (String, Option<String>) =
        sqlx::query_as("SELECT status, failure_code FROM payment WHERE id=$1")
            .bind(&pending.payment_id)
            .fetch_one(&pool)
            .await
            .expect("读支付状态");
    assert_eq!(status, "failed");
    assert_eq!(code.as_deref(), Some("INSUFFICIENT_FUNDS"), "失败原因要留下来");
}

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
/// 已取消的订单，不该被一条迟到的支付成功改写回 `paid`。
///
/// 领域层的状态机写着 `Cancelled => &[]` —— 已取消没有任何允许的下一个状态。
/// 而 `apply_succeeded` 那条 SQL 原来无条件 `THEN 'paid'`，绕过了它：
/// 「下单 → 发起支付 → 取消 → 迟到的成功回调」会让订单复活成 paid，
/// 接着照常触发履约（2026-08-18 实测）。
///
/// 修之后：**钱照记**（它确实到了），**状态不动** —— 于是这一单停在
/// `cancelled` 且实付 > 0，也就是「钱到了但没有归宿」这件事变得看得见。
#[tokio::test]
async fn a_late_success_does_not_resurrect_a_cancelled_order() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 9900).await;
    let p = payment::start(&pool, &order_id, &user, "wechat_jsapi", None)
        .await.expect("start payment");

    order::cancel(&pool, &order_id, "改主意了", &Actor::user(&user), Some(&user))
        .await.expect("取消");

    payment::apply_succeeded(&pool, &p.payment_id, Some("txn-late"), chrono::Utc::now())
        .await.expect("迟到的成功回调本身不该报错");

    let status = common::scalar_string(
        &pool, "SELECT status FROM order_record WHERE id=$1", &order_id).await;
    let paid = common::scalar_i64(
        &pool, "SELECT amount_paid_minor FROM order_record WHERE id=$1", &order_id).await;
    assert_eq!(status.as_deref(), Some("cancelled"), "取消掉的单不该复活");
    assert_eq!(paid, 9900, "钱确实到了，要记下来 —— 看不见的钱才是麻烦");
}

/// 同一单申请两次退款、两张都批，不该退出两倍的钱。
///
/// `request` 也算余额，但它算的是【申请时】的 —— `amount_refunded_minor`
/// 要到审批才增加，于是两次申请都看到余额未动、都通过。
/// 钱在 `approve` 才真的动，所以余额必须在那一步、拿着行锁再算一次。
///
/// 2026-08-18 实测（修之前）：实付 9900、**已退 19800**，一处报错都没有。
/// 库里也没有「已退 ≤ 已付」的约束 —— 只有「已付 ≤ 应付」那条。
#[tokio::test]
async fn two_approved_refunds_cannot_exceed_what_was_paid() {
    let pool = db_or_skip!();
    let (user, order_id, _pay) = paid_order(&pool, 9900).await;

    let r1 = refund::request(&pool, &order_id, &user, None, None, "user_request", None)
        .await.expect("第一次申请");
    let r2 = refund::request(&pool, &order_id, &user, None, None, "user_request", None)
        .await.expect("第二次申请（申请本身不该被挡，钱还没动）");

    refund::approve(&pool, &r1, &Actor::admin("a")).await.expect("第一张批下来");
    let err = refund::approve(&pool, &r2, &Actor::admin("a")).await
        .expect_err("第二张该被挡住");
    assert!(
        matches!(err, DomainError::Conflict(_)),
        "该是 Conflict，实际 {err:?}"
    );

    let refunded = common::scalar_i64(
        &pool, "SELECT amount_refunded_minor FROM order_record WHERE id=$1", &order_id).await;
    let paid = common::scalar_i64(
        &pool, "SELECT amount_paid_minor FROM order_record WHERE id=$1", &order_id).await;
    assert_eq!(refunded, paid, "退回去的不该超过收进来的");
}

/// 过期回调这条以前也一条测试都没有（33 个用例函数里最后一个）。
/// 它本来就带着状态守卫 —— 这两条是把那个守卫钉住，
/// 免得哪天有人跟着别处「简化」一下就把它删了。
#[tokio::test]
async fn an_expiry_callback_does_not_touch_a_paid_payment() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 8800).await;
    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", None)
        .await
        .expect("start payment");
    payment::apply_succeeded(&pool, &pending.payment_id, None, chrono::Utc::now())
        .await
        .expect("pay");

    payment::apply_expired(&pool, &pending.payment_id).await.expect("apply_expired");

    let status: String = sqlx::query_scalar("SELECT status FROM payment WHERE id=$1")
        .bind(&pending.payment_id)
        .fetch_one(&pool)
        .await
        .expect("读支付状态");
    assert_eq!(status, "success", "付过的钱不该被一条过期通知抹掉");
}

#[tokio::test]
async fn an_expiry_callback_expires_a_payment_still_in_flight() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 8800).await;
    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", None)
        .await
        .expect("start payment");

    payment::apply_expired(&pool, &pending.payment_id).await.expect("apply_expired");

    let status: String = sqlx::query_scalar("SELECT status FROM payment WHERE id=$1")
        .bind(&pending.payment_id)
        .fetch_one(&pool)
        .await
        .expect("读支付状态");
    assert_eq!(status, "expired");
}

/// 批量过期只碰【还在飞】的那些，并且真的碰得到。
///
/// 这段以前长在 worker 里，测不到；搬进用例层之后它跟单笔那条共用同一个
/// 状态守卫，这条把两件事一起钉住：到点的会过期，已付的不会被带走。
#[tokio::test]
async fn a_late_success_on_an_expired_payment_records_nothing() {
    /* 重复扣款那一条（docs/OPEN.md 第 3 条）里，第二笔支付会卡在 pending，
       30 分钟后被 sweeper 翻成 `expired`。这一条钉住之后会发生什么：
       渠道随后推来的「已成功」**一分钱都不记**，因为 apply_succeeded 只认
       `pending`/`processing`；而它返回 Ok，于是渠道收到 200 就不再重推。

       也就是说那笔钱在渠道那边收了，在我们这边留下的唯一一行写着 `expired`
       ——「用户没付」。这不是本条测试要评判的事，怎么办是待拍板的；
       写在这里是因为这个机制决定了那笔钱还能不能被记下来。 */
    let pool = db_or_skip!();

    let (user, order) = unpaid_order(&pool, 8800).await;
    let p = payment::start(&pool, &order, &user, "wechat_jsapi", None).await.expect("start");
    sqlx::query("UPDATE payment SET status='expired' WHERE id=$1")
        .bind(&p.payment_id).execute(&pool).await.expect("摆成已过期");

    // 渠道推「成功」过来。不报错 —— 报错的话渠道会一直重推。
    payment::apply_succeeded(&pool, &p.payment_id, Some("txn-late-1"), chrono::Utc::now())
        .await.expect("迟到的成功回调不该报错，否则渠道会一直重推");

    let st: String = sqlx::query_scalar("SELECT status FROM payment WHERE id=$1")
        .bind(&p.payment_id).fetch_one(&pool).await.expect("读");
    assert_eq!(st, "expired", "已过期的支付不该被迟到的回调翻成 success");

    let (paid, ostatus): (i64, String) = sqlx::query_as(
        "SELECT amount_paid_minor, status FROM order_record WHERE id=$1")
        .bind(&order).fetch_one(&pool).await.expect("读");
    assert_eq!(paid, 0, "钱没有被记进订单 —— 这正是那笔钱失去踪迹的地方");
    assert_eq!(ostatus, "unpaid");
}

#[tokio::test]
async fn expiring_overdue_payments_leaves_paid_ones_alone() {
    let pool = db_or_skip!();

    // 一笔到点未结算的
    let (user_a, order_a) = unpaid_order(&pool, 8800).await;
    let overdue = payment::start(&pool, &order_a, &user_a, "wechat_jsapi", None)
        .await.expect("start");
    sqlx::query("UPDATE payment SET expires_at = NOW() - INTERVAL '1 hour' WHERE id=$1")
        .bind(&overdue.payment_id).execute(&pool).await.expect("摆成已超时");

    // 一笔已经付掉的，也把它的 expires_at 摆到过去 —— 守卫要靠状态挡住它，
    // 不是靠时间
    let (user_b, order_b) = unpaid_order(&pool, 8800).await;
    let paid = payment::start(&pool, &order_b, &user_b, "wechat_jsapi", None)
        .await.expect("start");
    payment::apply_succeeded(&pool, &paid.payment_id, None, chrono::Utc::now())
        .await.expect("pay");
    sqlx::query("UPDATE payment SET expires_at = NOW() - INTERVAL '1 hour' WHERE id=$1")
        .bind(&paid.payment_id).execute(&pool).await.expect("摆成已超时");

    /* 不断言影响行数。`expire_overdue` 扫的是全表，而**并发的过期者不止一个**：
       本机开着后端时，它的 sweeper 每 30 秒也扫一遍同一张表（2026-08-19 起
       每一跳都扫，此前只在有待查支付时才顺带跑）。它抢在前面的话这里就是 0，
       而那不代表这条用例坏了。

       所以断言落在**结果**上：那笔到点未结算的最终是 expired，那笔已经付掉的
       仍然是 success。CI 上没有后端在跑，行数那条本来也只有那里才成立。 */
    payment::expire_overdue(&pool).await.expect("expire_overdue");

    let a: String = sqlx::query_scalar("SELECT status FROM payment WHERE id=$1")
        .bind(&overdue.payment_id).fetch_one(&pool).await.expect("读");
    let b: String = sqlx::query_scalar("SELECT status FROM payment WHERE id=$1")
        .bind(&paid.payment_id).fetch_one(&pool).await.expect("读");
    assert_eq!(a, "expired");
    assert_eq!(b, "success", "已经付掉的钱，不该被批量过期带走");
}

/// 退款那两条回调也没有状态守卫 —— 跟 `payment::apply_failed` 同一个缺陷。
///
/// 后果比支付那条更具体：一笔【已经成功】的退款被翻成 `failed` 之后，
/// `refund::deny` 的守卫写的是 `status IN ('requested','failed')` ——
/// 于是这笔单子重新变得可以「驳回」，而钱早就退回去了、
/// `order_record.amount_refunded_minor` 也早就加过了。
#[tokio::test]
async fn a_late_failure_callback_does_not_undo_a_completed_refund() {
    let pool = db_or_skip!();
    let (user, order_id, _pay) = paid_order(&pool, 8800).await;
    let refund_id = refund::request(&pool, &order_id, &user, None, None, "user_request", None)
        .await
        .expect("request refund");
    refund::approve(&pool, &refund_id, &Actor::admin("a")).await.expect("approve");

    // 渠道随后又推来一条失败（乱序、重推）
    refund::apply_failed(&pool, &refund_id, "CHANNEL_TIMEOUT", "迟到的失败回调")
        .await
        .expect("apply_failed 本身不该报错");

    let status: String = sqlx::query_scalar("SELECT status FROM refund WHERE id=$1")
        .bind(&refund_id)
        .fetch_one(&pool)
        .await
        .expect("读退款状态");
    assert_eq!(status, "success", "已经退成功的钱，不该被一条迟到的失败回调翻掉");
}

/// 正常那一半：还在渠道手里的那笔，失败回调要真的落下去。
#[tokio::test]
async fn a_failure_callback_marks_an_in_flight_refund_failed() {
    let pool = db_or_skip!();
    let (user, order_id, _pay) = paid_order(&pool, 8800).await;
    let refund_id = refund::request(&pool, &order_id, &user, None, None, "user_request", None)
        .await
        .expect("request refund");
    // 真接渠道时 approve 之后是 processing（现在的 mock 直接给 success），
    // 所以这里把它摆成在途的样子再收回调。
    sqlx::query("UPDATE refund SET status='processing' WHERE id=$1")
        .bind(&refund_id)
        .execute(&pool)
        .await
        .expect("摆成在途");

    refund::apply_failed(&pool, &refund_id, "CHANNEL_REJECTED", "渠道拒绝")
        .await
        .expect("apply_failed");

    let (status, code): (String, Option<String>) =
        sqlx::query_as("SELECT status, failure_code FROM refund WHERE id=$1")
            .bind(&refund_id)
            .fetch_one(&pool)
            .await
            .expect("读退款状态");
    assert_eq!(status, "failed");
    assert_eq!(code.as_deref(), Some("CHANNEL_REJECTED"), "失败原因要留下来");
}

async fn paid_order(pool: &sqlx::PgPool, price_minor: i64) -> (String, String, String) {
    let (user, order_id) = unpaid_order(pool, price_minor).await;
    let pending = payment::start(pool, &order_id, &user, "wechat_jsapi", None).await.expect("start");
    payment::apply_succeeded(pool, &pending.payment_id, None, chrono::Utc::now()).await.expect("callback");
    (user, order_id, pending.payment_id)
}

// ═══════════ 回调匹配键 · 真渠道那一天才会暴露的那个 bug ═══════════

/// 渠道流水号与我方单号是**两个不同的号**,定位必须用后者。
///
/// 从前 `apply_succeeded` 只收一个标识,匹配写成 `channel_txn_id=$2 OR id=$2`。
/// 微信真回调传的是 `transaction_id`——它不等于我方 payment id,而
/// `channel_txn_id` 那一列此刻是 NULL,于是两个条件都不成立、UPDATE 影响 0 行、
/// **这笔支付永远不会入账**。mock 把两者填成同一个值,所以测试一直全绿。
///
/// 这条测试就是钉住「两个号长得完全不一样」这件事 —— 只要还有人把它们合并,
/// 它立刻挂。
#[tokio::test]
async fn a_channel_txn_id_that_differs_from_our_ref_still_credits_the_payment() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 19900).await;
    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", None).await.unwrap();

    // 微信的 transaction_id 长这样,跟我们的 pay-xxx 毫无关系
    let channel_txn = format!("4200001{}", &pending.payment_id[4..14]);
    assert_ne!(channel_txn, pending.payment_id, "前提：两个号必须不同");

    payment::apply_succeeded(&pool, &pending.payment_id, Some(&channel_txn), chrono::Utc::now())
        .await
        .expect("入账");

    let status = common::scalar_string(&pool, "SELECT status FROM payment WHERE id=$1", &pending.payment_id).await;
    assert_eq!(status.as_deref(), Some("success"), "按我方单号定位就该命中");
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("paid"));

    // 渠道流水号要落进那一列 —— 对账靠它,存成我们自己的 id 就对不上账单
    let got = common::scalar_string(&pool, "SELECT channel_txn_id FROM payment WHERE id=$1", &pending.payment_id).await;
    assert_eq!(got.as_deref(), Some(channel_txn.as_str()));
}

#[tokio::test]
async fn a_callback_without_a_channel_txn_id_still_credits() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 5000).await;
    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", None).await.unwrap();

    // 渠道没给流水号(mock 查询就是这样)。定位不依赖它,所以照样入账。
    payment::apply_succeeded(&pool, &pending.payment_id, None, chrono::Utc::now()).await.unwrap();
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("paid"));
}

#[tokio::test]
async fn replaying_the_same_channel_txn_credits_once() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 8800).await;
    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", None).await.unwrap();
    let channel_txn = common::uniq("4200009");

    // 微信 24 小时内最多重推 15 次
    for _ in 0..3 {
        payment::apply_succeeded(&pool, &pending.payment_id, Some(&channel_txn), chrono::Utc::now())
            .await
            .expect("重推");
    }
    let paid = common::scalar_i64(&pool, "SELECT amount_paid_minor FROM order_record WHERE id=$1", &order_id).await;
    assert_eq!(paid, 8800, "重推不该重复入账");
}

// ═══════════════════ 退款记账（finance） ═══════════════════
//
// README「已修 · 退款财务分录不平且会重复入账」那一条，2026-08-24 核的时候
// 发现**一条测试都没有** —— `journal_entry` / `business_ref_id` 在整个测试
// 目录里零命中。它当时长在 `workers/outbox.rs` 里，那儿的 SQL 没有任何
// 测试够得着。现在搬进了 `unmei_app::finance`，下面两条把它钉住。

/// 记一笔退款分录：账要平（借方合计 = 贷方合计），且金额就是退款金额。
#[tokio::test]
async fn refund_journal_is_balanced() {
    let pool = db_or_skip!();
    let (user, order_id, _p) = paid_order(&pool, 19900).await;
    let refund_id = refund::request(&pool, &order_id, &user, None, Some(5000), "partial", None)
        .await
        .expect("request");

    unmei_app::finance::post_refund_journal(&pool, &refund_id).await.expect("记账");

    let (debit, credit): (i64, i64) = sqlx::query_as(
        // sum() 在 Postgres 里回 NUMERIC，不转的话取回来是类型不匹配
        "SELECT COALESCE(sum(l.debit_minor),0)::bigint, COALESCE(sum(l.credit_minor),0)::bigint
           FROM journal_line l JOIN journal_entry e ON e.id = l.entry_id
          WHERE e.business_kind='refund' AND e.business_ref_id=$1",
    )
    .bind(&refund_id)
    .fetch_one(&pool)
    .await
    .expect("查分录");

    assert_eq!(debit, credit, "借贷不平 —— 这就是一本不平的账");
    assert_eq!(debit, 5000, "记的金额跟退款金额对不上");
}

/// outbox 事件会重试。重试不该为同一笔退款再记一整套分录 ——
/// 那会在账上凭空多出一笔冲销。
#[tokio::test]
async fn posting_the_same_refund_twice_does_not_double_post() {
    let pool = db_or_skip!();
    let (user, order_id, _p) = paid_order(&pool, 19900).await;
    let refund_id = refund::request(&pool, &order_id, &user, None, None, "user_request", None)
        .await
        .expect("request");

    for _ in 0..3 {
        unmei_app::finance::post_refund_journal(&pool, &refund_id).await.expect("重试记账");
    }

    let entries = common::scalar_i64(
        &pool,
        "SELECT count(*) FROM journal_entry WHERE business_kind='refund' AND business_ref_id=$1",
        &refund_id,
    )
    .await;
    assert_eq!(entries, 1, "重试为同一笔退款记了 {entries} 套分录");

    let lines = common::scalar_i64(
        &pool,
        "SELECT count(*) FROM journal_line l JOIN journal_entry e ON e.id=l.entry_id
          WHERE e.business_kind='refund' AND e.business_ref_id=$1",
        &refund_id,
    )
    .await;
    assert_eq!(lines, 2, "分录行数不对");
}
