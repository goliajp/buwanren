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

    批到钱回去(&pool, &refund_id, &Actor::admin("admin_fin")).await;

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

    批到钱回去(&pool, &refund_id, &Actor::admin("admin_fin")).await;

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

    批到钱回去(&pool, &refund_id, &Actor::admin("a")).await;
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

/// 批一笔退款，**并且让渠道真的把钱退回去**。
///
/// 【为什么要两步】（2026-09-07）。`approve` 现在只做「我们同意退」——
/// 钱怎么动、东西怎么收回，全挪到了「渠道说退成了」那一刻
/// （`apply_succeeded`）。在这之前它一步到位:`status='success'`、
/// `channel_refund_id='MOCK_'||id`，而渠道那一侧一个字都没收到 ——
/// 买家看到「已退款」，钱一分没回。
///
/// 绝大多数用例关心的是「钱最后回没回去」，所以给它们一个走完两步的入口；
/// 关心那道分界本身的用例（批了还没发是什么样）自己分开写。
/// 把「批了还没发」的那几笔推到「渠道说退成了」。
///
/// 【它代替的是 `payment_sweep` 里那一支】。发款是 I/O，走的是适配器，
/// 而适配器在 `unmei-api` 那一层 —— 用例层的测试够不着它。
/// 系统自批的那两条清扫（无家可归的钱、交付不了的行）现在只批到
/// `approved` 为止，所以测试里要有人接着往下走一步。
async fn 渠道把批了的都退掉(pool: &sqlx::PgPool) {
    for r in refund::批了还没发的(pool, 200).await.expect("查待发") {
        let ch = format!("WXR_{}", r.refund_id);
        refund::发给渠道了(pool, &r.refund_id, &ch).await.expect("发给渠道");
        refund::apply_succeeded(pool, &ch).await.expect("渠道说退成了");
    }
}

async fn 批到钱回去(pool: &sqlx::PgPool, refund_id: &str, actor: &Actor) {
    refund::approve(pool, refund_id, actor).await.expect("批");
    refund::发给渠道了(pool, refund_id, &format!("WXR_{refund_id}")).await.expect("发给渠道");
    refund::apply_succeeded(pool, &format!("WXR_{refund_id}")).await.expect("渠道说退成了");
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

    /* 【第二张直接插进库，不走 `request`】（2026-09-03）。
       原先这里是第二次 `request` —— 它当时会通过，因为
       `amount_refunded_minor` 要到审批才增加。现在 `request` 会把
       【在途】的退款也算进已退，所以那条路建不出第二张了。

       但这条测试钉的不是 `request`，是 **`approve` 那一步的余额复核**——
       重复退款的最后一道。照着改成「第二次申请该被挡」的话，
       那道复核就再也没有测试够得着，而它正是 2026-08-18
       实付 9900 退出 19800 那次的补丁。

       所以第二张绕过 `request` 直接落库:模拟「一张先前建下的、
       还没批的申请」——那在真实世界里存在（`request` 收紧之前建的，
       或者并发擦身而过的），而 `approve` 必须挡得住。 */
    let r2 = format!("rfd-{}", uuid::Uuid::new_v4());
    sqlx::query(
        "INSERT INTO refund(id, order_id, payment_id, amount_minor, currency,
                            reason_code, actor_kind, actor_id, status, region)
         SELECT $1, order_id, payment_id, amount_minor, currency,
                reason_code, actor_kind, actor_id, 'requested', region
           FROM refund WHERE id=$2",
    )
    .bind(&r2).bind(&r1)
    .execute(&pool).await.expect("照着第一张再落一张待批的");

    批到钱回去(&pool, &r1, &Actor::admin("a")).await;
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
async fn a_late_success_on_an_expired_payment_records_the_money() {
    /* 【这一条 2026-09-07 换了方向】。
       它原先叫 `..._records_nothing`，钉的是「已过期的支付被迟到的回调
       推成功时，一分钱都不记」—— 而它自己的注释写着
       「这不是本条测试要评判的事，怎么办是待拍板的」。
       也就是说它钉的是**一个悬而未决的现状**，而护栏钉在要被淘汰的东西上，
       就会替它挡住改动。

       板拍了（台账 `pay-channel-switch`）：`expired` 说的是「我们不等了」，
       不是「渠道撤单了」。渠道说收到了，那钱就是真的 —— 不记的话，
       它在系统里不存在，只能等第二天对账列成 missing_in_internal
       再等人去处理。所以现在它照记。

       仍然不报错:报错的话渠道会一直重推。 */
    let pool = db_or_skip!();
    common::确保当月开着(&pool).await;

    let (user, order) = unpaid_order(&pool, 8800).await;
    let p = payment::start(&pool, &order, &user, "wechat_jsapi", None).await.expect("start");
    sqlx::query("UPDATE payment SET status='expired' WHERE id=$1")
        .bind(&p.payment_id).execute(&pool).await.expect("摆成已过期");

    payment::apply_succeeded(&pool, &p.payment_id, Some("txn-late-1"), chrono::Utc::now())
        .await.expect("迟到的成功回调不该报错，否则渠道会一直重推");

    let st: String = sqlx::query_scalar("SELECT status FROM payment WHERE id=$1")
        .bind(&p.payment_id).fetch_one(&pool).await.expect("读");
    assert_eq!(st, "success", "渠道说收到了，而这一笔还挂在 expired —— 那笔钱在系统里不存在");

    let (paid, ostatus): (i64, String) = sqlx::query_as(
        "SELECT amount_paid_minor, status FROM order_record WHERE id=$1")
        .bind(&order).fetch_one(&pool).await.expect("读");
    assert_eq!(paid, 8800, "钱没有被记进订单 —— 这正是那笔钱失去踪迹的地方");
    assert_eq!(ostatus, "paid");
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
    批到钱回去(&pool, &refund_id, &Actor::admin("a")).await;

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

    /* 【钱退出去了才记账】（2026-09-03 五路评审 · 资金审计）。
       上一版申请完就直接记 —— 而 `post_refund_journal` 是
       `RefundCompleted` 事件的处理器，那个事件只在退款走成之后才发。
       测试跳过审批这一步，测的就不是生产里发生的顺序。
       它现在会明确拒记一笔还没退出去的钱。 */
    批到钱回去(&pool, &refund_id, &Actor::admin("adm-test")).await;

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

    /* 【钱退出去了才记账】（2026-09-03 五路评审 · 资金审计）。
       上一版申请完就直接记 —— 而 `post_refund_journal` 是
       `RefundCompleted` 事件的处理器，那个事件只在退款走成之后才发。
       测试跳过审批这一步，测的就不是生产里发生的顺序。
       它现在会明确拒记一笔还没退出去的钱。 */
    批到钱回去(&pool, &refund_id, &Actor::admin("adm-test")).await;

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

/// 【退款请求里的 payment_id 得真属于这张单】（2026-09-02 第四轮评审 · 工程审计）。
///
/// `refund::request` 原先是 `Some(p) => p` —— 传进来什么就用什么。
/// 上面校的是「这张单是不是你的」和「金额超没超」，从没有人问过
/// 这笔支付是谁的。审计实测:甲对自己的单发起退款、`payment_id` 填乙的，
/// 回 200 落库。而退款最终会拿这条 id 去渠道发一次真的退款请求。
#[tokio::test]
async fn a_refund_cannot_name_someone_elses_payment() {
    let pool = db_or_skip!();
    let (甲, 甲的单, _) = paid_order(&pool, 9900).await;
    let (_乙, _乙的单, 乙的支付) = paid_order(&pool, 9900).await;

    let 借别人的 = refund::request(
        &pool, &甲的单, &甲, Some(乙的支付.clone()), Some(9900),
        "user_request", None,
    ).await;
    match 借别人的 {
        Err(DomainError::Validation(m)) => {
            assert!(m.contains("不属于"), "话要说清为什么：{m}");
        }
        other => panic!("别人的那笔支付不该退得动，实际 {other:?}"),
    }

    // 而不带 payment_id 的正常路径照旧走得通 —— 收紧的是判据，不是覆盖面
    let 正常 = refund::request(
        &pool, &甲的单, &甲, None, Some(9900), "user_request", None,
    ).await;
    assert!(正常.is_ok(), "自己那张单该退得动，实际 {:?}", 正常.err());
}

/// 【两笔各退一半，两边都该说「全退了」】（2026-09-03 第四轮评审 · 工程审计）。
///
/// `approve` 里 payment 的终态原先拿【这一笔】的金额跟支付总额比，
/// 而订单那一侧用的是累计式 —— 两笔各退一半，每一笔都小于总额，
/// 于是支付永远停在 `refunded_partial`、订单已经是 `refunded`。
/// 同一笔钱两处说法不一致，对账时看到的是「订单全退了、支付没退完」。
#[tokio::test]
async fn two_half_refunds_leave_both_sides_saying_fully_refunded() {
    let pool = db_or_skip!();
    let (用户, 单, 支付) = paid_order(&pool, 10000).await;

    for _ in 0..2 {
        let r = refund::request(&pool, &单, &用户, None, Some(5000), "user_request", None)
            .await.expect("发起退款");
        批到钱回去(&pool, &r, &Actor::system()).await;
    }

    let 支付态 = common::scalar_string(&pool, "SELECT status FROM payment WHERE id=$1", &支付).await;
    let 订单态 = common::scalar_string(&pool, "SELECT status FROM order_record WHERE id=$1", &单).await;
    assert_eq!(支付态.as_deref(), Some("refunded"),
               "两笔加起来等于全额，支付这一侧也该说全退了");
    assert_eq!(订单态.as_deref(), Some("refunded"), "订单那一侧本来就是累计式");
}

// ═══════════════════ 取消订单要把在飞的支付撤下来 ═══════════════════

/// 【`order::cancel` 一处都没碰过支付】（2026-09-03 五路评审 · 资金审计）。
///
/// 它改订单、放券、写事件，而已经发起的那笔 pending 支付原封不动地活着。
/// 付成之后订单停在 `cancelled` 而 `amount_paid_minor` 变成全额 ——
/// 钱进账、买家什么都没拿到，且没有任何一处会说出来。
///
/// 实测存量：486 单、¥48,082，全部 `refunded=0`。
#[tokio::test]
async fn cancelling_an_order_takes_its_in_flight_payment_down() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 9900).await;

    let pay = payment::start(&pool, &order_id, &user, "wechat_h5", None)
        .await.expect("发起支付");
    let 起初 = common::scalar_string(
        &pool, "SELECT status FROM payment WHERE id=$1", &pay.payment_id).await;
    assert_eq!(起初.as_deref(), Some("pending"), "前提：这笔支付在飞");

    order::cancel(&pool, &order_id, "改主意了", &Actor::system(), Some(&user))
        .await.expect("取消订单");

    /* 【转 cancelling 而不是 cancelled】。`payment_sweep` 只查
       pending / processing，转过去它就不再自动结算；
       而 `apply_succeeded` 仍接受 cancelling —— 渠道那边真收了钱还是要记上，
       那种「钱到了但没有归宿」该被看见，不该被状态守卫吞掉。 */
    let 之后 = common::scalar_string(
        &pool, "SELECT status FROM payment WHERE id=$1", &pay.payment_id).await;
    assert_eq!(之后.as_deref(), Some("cancelling"),
               "取消订单之后这笔支付还在飞 —— 它还会被 sweeper 结成 success");
}

#[tokio::test]
async fn an_expired_order_takes_its_payment_down_too() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 9900).await;
    let pay = payment::start(&pool, &order_id, &user, "wechat_h5", None)
        .await.expect("发起支付");

    // 把这一单推到过期线以外，再跑清扫
    sqlx::query("UPDATE order_record SET expires_at = NOW() - INTERVAL '1 minute' WHERE id=$1")
        .bind(&order_id).execute(&pool).await.expect("推到过期");
    order::expire_unpaid(&pool).await.expect("清扫");

    // 【这条路上没有人在场】—— 所以更需要它自己做对
    let 之后 = common::scalar_string(
        &pool, "SELECT status FROM payment WHERE id=$1", &pay.payment_id).await;
    assert_eq!(之后.as_deref(), Some("cancelling"),
               "订单过期了，支付还在飞 —— 每一次弃购都留下一笔会自动结算的支付");
}

// ═════════ 2026-09-04 · 撤到一半的支付要有下场 ═════════

/// 【`cancelling` 原先进得去出不来】。
///
/// 同一天早上加的 `cancel_in_flight` 把在飞的支付转成 `cancelling`，
/// 而状态机写着 `Cancelling => [Cancelled, Success]` ——
/// Success 那条通（渠道竞态），而 Cancelled **全仓没有一处写**：
/// 实测 20 笔卡在那儿，18 笔窗口早过了。
/// 这正是这一轮评审反复遇到的形状，而它是当天新造的一个。
#[tokio::test]
async fn 窗口过了的撤销支付会落成已撤销() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 19900).await;
    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", None).await.expect("起一笔");

    // 撤下来 —— 走真的那条路（订单取消会顺带撤支付）
    order::cancel(&pool, &order_id, "不要了", &Actor::user(&user), Some(&user))
        .await
        .expect("取消");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM payment WHERE id=$1", &pending.payment_id).await.as_deref(),
        Some("cancelling"),
        "取消订单没把支付撤下来",
    );

    // 窗口还没过，不该动它 —— 那时渠道仍可能说「已经付了」
    payment::settle_cancelled(&pool).await.expect("清扫");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM payment WHERE id=$1", &pending.payment_id).await.as_deref(),
        Some("cancelling"),
        "窗口没过就把它落定了 —— 那两笔还可能被付掉，钱要记上",
    );

    // 把窗口推到过去，再清扫
    sqlx::query("UPDATE payment SET expires_at = NOW() - INTERVAL '1 minute' WHERE id=$1")
        .bind(&pending.payment_id)
        .execute(&pool)
        .await
        .expect("推过期");
    payment::settle_cancelled(&pool).await.expect("清扫");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM payment WHERE id=$1", &pending.payment_id).await.as_deref(),
        Some("cancelled"),
        "窗口过了还卡在 cancelling —— 那个状态又进得去出不来了",
    );
}

/// 反面：撤到一半、而渠道随后说「已经付了」——那笔钱仍然要记上。
/// 这一条守的是「不许用状态守卫把到账的钱吞掉」。
#[tokio::test]
async fn 撤销中的支付被渠道付掉了还是要记账() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 19900).await;
    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", None).await.expect("起一笔");
    order::cancel(&pool, &order_id, "不要了", &Actor::user(&user), Some(&user))
        .await
        .expect("取消");

    payment::apply_succeeded(&pool, &pending.payment_id, Some("txn-race"), chrono::Utc::now())
        .await
        .expect("渠道说付成了");

    let 状态 = common::scalar_string(&pool, "SELECT status FROM payment WHERE id=$1", &pending.payment_id).await;
    assert_eq!(状态.as_deref(), Some("success"), "撤销中被付掉，那笔钱没被记上");
    let 收了 = common::scalar_i64(
        &pool, "SELECT amount_paid_minor FROM order_record WHERE id=$1", &order_id,
    ).await;
    assert_eq!(收了, 19900, "钱到了而订单上一分没记 —— 那是一笔没有归宿的钱");
}

/// 【取消了的单上收着钱，扫一遍要退回去】。
///
/// 实测存量 486 单、¥48,082 全部 refunded=0，从 2026-08-16 攒到当天，
/// 而没有任何一处会说出来。上游堵了两个口子，但渠道竞态仍然会造出这种钱
/// （`Cancelling => Success` 是状态机明写的一条）。
#[tokio::test]
async fn 取消单上无家可归的钱会被退回去() {
    let pool = db_or_skip!();
    common::确保当月开着(&pool).await;
    let (user, order_id) = unpaid_order(&pool, 19900).await;
    let pending = payment::start(&pool, &order_id, &user, "wechat_jsapi", None).await.expect("起一笔");
    order::cancel(&pool, &order_id, "不要了", &Actor::user(&user), Some(&user)).await.expect("取消");
    // 渠道竞态：撤销中被付掉了 —— 钱记上（这一条由上一支测试单独钉）
    payment::apply_succeeded(&pool, &pending.payment_id, Some("txn-orphan"), chrono::Utc::now())
        .await
        .expect("渠道说付成了");
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_paid_minor FROM order_record WHERE id=$1", &order_id).await,
        19900,
    );

    /* 【一轮扫不完就多扫几轮】。这一支一次最多处理 200 单
       （生产上靠一轮轮 tick 排空积压，而不是一口气把库锁住），
       而测试库里攒着两百多单历史的同类单子，按 `cancelled_at` 排序时
       刚造的这一单排在最后。所以这里照生产的样子跑：扫到它为止，有上限。

       上限本身也是断言的一部分:排不空的话它会挂在这儿，
       而那正是「这一支扫不动」该有的样子。 */
    let mut 轮 = 0;
    loop {
        let 退了 = refund::refund_orphan_money(&pool).await.expect("清扫");
        渠道把批了的都退掉(&pool).await;
        let 已退 = common::scalar_i64(
            &pool, "SELECT COALESCE(amount_refunded_minor,0) FROM order_record WHERE id=$1", &order_id,
        ).await;
        if 已退 == 19900 {
            break;
        }
        轮 += 1;
        assert!(退了 > 0, "第 {轮} 轮一笔都没退，而我这一单还欠着 —— 那 486 单就是这么攒出来的");
        assert!(轮 < 40, "扫了 {轮} 轮还没轮到这一单");
    }

    /* 【跑第二遍不许再退一次】。清扫会每 30 秒跑一次 ——
       不幂等的话，一笔 199 元的钱会被退成好几笔。 */
    let 再退 = refund::refund_orphan_money(&pool).await.expect("再扫一遍");
    let 退款笔数 = common::scalar_i64(
        &pool, "SELECT count(*) FROM refund WHERE order_id=$1", &order_id,
    ).await;
    assert_eq!(退款笔数, 1, "扫第二遍又退了一笔（第二遍报 {再退} 笔）");
    assert_eq!(
        common::scalar_i64(&pool, "SELECT COALESCE(amount_refunded_minor,0) FROM order_record WHERE id=$1", &order_id).await,
        19900,
        "退的比收的还多了",
    );
}

/// 【过了三十分钟就付不了了】（2026-09-06 三路验证 · 准备花钱的那一路）。
///
/// `start` 原先只看 `order.status`。清扫每 30 秒一轮，所以「已过 `expires_at`、
/// 状态还挂 unpaid」是一段真实存在的窗口:在那里点「去付」，微信真扣钱，
/// 回来看到「已取消」，几分钟后钱才自动退回。链路是闭的，
/// 而那几分钟里人会认为自己被吞了钱。
#[tokio::test]
async fn 过了点的单发不起支付() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 9900).await;
    // 清扫还没轮到它：过了点，状态还挂着 unpaid —— 这正是那段窗口
    sqlx::query("UPDATE order_record SET expires_at = NOW() - INTERVAL '1 minute' WHERE id=$1")
        .bind(&order_id).execute(&pool).await.expect("把它推到过期");

    let err = payment::start(&pool, &order_id, &user, "wechat_jsapi", None)
        .await
        .expect_err("过了点还发得出支付");
    assert!(
        format!("{err}").contains("三十分钟"),
        "报的不是「过了点」这件事，而是别的：{err}",
    );
}

/// 【钱退干净了，东西要收回来】（2026-09-06 三路验证）。
///
/// `approve` 此前只动 refund / payment / order_record 三张表加一个事件 ——
/// 客服按下「批」，钱退回去，而那位村民还住在他村里、那份说明书还读得到。
/// 协议写的是「数字内容一经交付不支持退款」，订单屏也照这条把按钮换成了说明；
/// 而那条规矩此前只靠「后台的人不点错」来维持。
#[tokio::test]
async fn 退干净了的单会把住进来的人搬走() {
    let pool = db_or_skip!();
    common::确保当月开着(&pool).await;
    let user = common::user(&pool).await;
    let (sku, villager) = common::residency_sku(&pool, "CNY", 9900).await;
    let created = order::create(
        &pool,
        order::NewOrder {
            user_id: user.clone(), region: "cn".into(), channel_origin: "web".into(),
            lines: vec![order::NewOrderLine { sku_id: sku, qty: 1 }],
            shipping_address: None, contact: None, coupon_codes: vec![],
            note: None, ip: None, ua: None,
        },
    ).await.expect("建单");
    let p = payment::start(&pool, &created.order_id, &user, "wechat_jsapi", None)
        .await.expect("起一笔");
    payment::apply_succeeded(&pool, &p.payment_id, None, chrono::Utc::now())
        .await.expect("付了");
    // 履约由 outbox 的消费者驱动，测试里直接调它那一支
    unmei_app::fulfillment::apply_order_paid(&pool, &created.order_id).await.expect("履约");

    // 付完就该住进来了 —— 这是这一支的前提，不成立的话下面验的是别的事
    assert_eq!(
        common::scalar_i64(
            &pool, "SELECT count(*) FROM villager_residency WHERE user_id=$1", &user).await,
        1,
        "前提：付完钱 {villager} 该住进来",
    );

    let rid = refund::request(
        &pool, &created.order_id, &user, None, None, "goodwill", Some("客服通融"),
    ).await.expect("申请");
    批到钱回去(&pool, &rid, &Actor::admin("admin_kf")).await;

    assert_eq!(
        common::scalar_i64(&pool, "SELECT count(*) FROM villager_residency WHERE user_id=$1", &user).await,
        0,
        "钱退干净了，人还住在他村里",
    );
}

/// 退了一半不搬人 —— 部分退款对不上具体哪几行，凭它把人搬走，
/// 会把「退了一半」变成「什么都没有了」。
#[tokio::test]
async fn 退了一半的单不搬人() {
    let pool = db_or_skip!();
    common::确保当月开着(&pool).await;
    let user = common::user(&pool).await;
    let (sku, _villager) = common::residency_sku(&pool, "CNY", 9900).await;
    let created = order::create(
        &pool,
        order::NewOrder {
            user_id: user.clone(), region: "cn".into(), channel_origin: "web".into(),
            lines: vec![order::NewOrderLine { sku_id: sku, qty: 1 }],
            shipping_address: None, contact: None, coupon_codes: vec![],
            note: None, ip: None, ua: None,
        },
    ).await.expect("建单");
    let p = payment::start(&pool, &created.order_id, &user, "wechat_jsapi", None)
        .await.expect("起一笔");
    payment::apply_succeeded(&pool, &p.payment_id, None, chrono::Utc::now())
        .await.expect("付了");
    unmei_app::fulfillment::apply_order_paid(&pool, &created.order_id).await.expect("履约");

    let rid = refund::request(
        &pool, &created.order_id, &user, None, Some(3000), "goodwill", Some("退一部分"),
    ).await.expect("申请");
    批到钱回去(&pool, &rid, &Actor::admin("admin_kf")).await;

    assert_eq!(
        common::scalar_i64(&pool, "SELECT count(*) FROM villager_residency WHERE user_id=$1", &user).await,
        1,
        "只退了一部分，人却被搬走了",
    );
}

/// 【交付不了的那几行，钱要退回去】（2026-09-06 三路验证）。
///
/// 履约里有两处把行标成 `failed`（御守 SKU 没挂村民、这位村民已经住着了），
/// 两处的注释都写着「该退这一笔」。而 `settle_order_in_tx` 数的是
/// `NOT IN ('done','failed')` —— 一张全部失败的单照样翻成 `done`：
/// 屏上写「已完成」，钱收着，东西没有，而自动退款那一支只捞已取消的单。
#[tokio::test]
async fn 交付不了的那几行钱会被退回去() {
    let pool = db_or_skip!();
    common::确保当月开着(&pool).await;
    let (_user, order_id, _p) = paid_order(&pool, 9900).await;
    // 履约把这一行判成交付不了 —— 两条真实路径写的都是这一个状态
    sqlx::query("UPDATE order_line SET fulfillment_status='failed' WHERE order_id=$1")
        .bind(&order_id).execute(&pool).await.expect("标 failed");
    sqlx::query("UPDATE order_record SET status='done', fulfilled_at=NOW() WHERE id=$1")
        .bind(&order_id).execute(&pool).await.expect("收尾就是这么翻的");

    /* 一轮最多 200 单，库里攒着同类的历史单 —— 照生产的样子扫到它为止。
       【断言钉在这一单上，不钉在「这一轮退了几笔」】。
       单跑这一支时 `退了 > 0` 成立，而 `cargo test` 是**并发**跑的:
       同一个文件里另外两支也调这一支清扫，而清扫是【全库】的 ——
       别的线程那一次调用可能已经把这一单退掉了，于是轮到自己调的时候
       它返回 0，断言当场红，而产品行为完全正确。
       单跑绿、全量红，报的还是「一笔都没退」——指错方向的失败比失败本身更贵。
       要守的事只有一件:这一单的钱回去了。上限仍然在，扫不动它会挂在这儿。 */
    let mut 轮 = 0;
    loop {
        refund::refund_undelivered_lines(&pool).await.expect("清扫");
        渠道把批了的都退掉(&pool).await;
        let 已退 = common::scalar_i64(
            &pool, "SELECT COALESCE(amount_refunded_minor,0) FROM order_record WHERE id=$1", &order_id,
        ).await;
        if 已退 == 9900 {
            break;
        }
        轮 += 1;
        assert!(轮 < 40, "扫了 {轮} 轮，这一单交付不了、钱还收着 —— 已退 {已退}");
    }

    /* 退完之后订单不该再写着「已完成」—— 那正是这条 bug 让买家看到的那句话。
       `approve` 里那段 CASE 会把它推成 refunded / refund_partial。 */
    let 状态 = common::scalar_string(
        &pool, "SELECT status FROM order_record WHERE id=$1", &order_id).await;
    assert_eq!(状态.as_deref(), Some("refunded"),
        "钱退完了，单子还写着「已完成」");

    // 每 30 秒扫一次 —— 不幂等的话同一笔钱会被退好几遍
    refund::refund_undelivered_lines(&pool).await.expect("再扫一遍");
    let 笔数 = common::scalar_i64(
        &pool, "SELECT count(*) FROM refund WHERE order_id=$1", &order_id).await;
    assert_eq!(笔数, 1, "扫第二遍又退了一笔");
}

/// 行都交付成了的单，不该被这一支碰 —— 那是绝大多数已付单的样子。
#[tokio::test]
async fn 交付成了的单不会凭空生出退款() {
    let pool = db_or_skip!();
    common::确保当月开着(&pool).await;
    let (_user, order_id, _p) = paid_order(&pool, 9900).await;
    sqlx::query("UPDATE order_line SET fulfillment_status='done' WHERE order_id=$1")
        .bind(&order_id).execute(&pool).await.expect("标 done");
    sqlx::query("UPDATE order_record SET status='done' WHERE id=$1")
        .bind(&order_id).execute(&pool).await.expect("收尾");

    refund::refund_undelivered_lines(&pool).await.expect("清扫");
    let 笔数 = common::scalar_i64(
        &pool, "SELECT count(*) FROM refund WHERE order_id=$1", &order_id).await;
    assert_eq!(笔数, 0, "东西都给出去了，却生出了一笔退款");
}

/// 没收着钱的取消单不该被碰 —— 那是绝大多数取消单的样子。
#[tokio::test]
async fn 没收钱的取消单不会凭空生出退款() {
    let pool = db_or_skip!();
    let (user, order_id) = unpaid_order(&pool, 19900).await;
    order::cancel(&pool, &order_id, "不要了", &Actor::user(&user), Some(&user)).await.expect("取消");

    refund::refund_orphan_money(&pool).await.expect("清扫");
    let 退款笔数 = common::scalar_i64(
        &pool, "SELECT count(*) FROM refund WHERE order_id=$1", &order_id,
    ).await;
    assert_eq!(退款笔数, 0, "一分钱没收，却生出了一笔退款");
}

// ═══════════ 被顶掉的那一笔，钱回来了怎么办 ═══════════
//
// 台账 `known-money-bugs.json` 的 `pay-channel-switch`：换支付方式时旧那一笔
// 被就地标成 `expired`，而渠道那一侧的下单可能已经发出去、用户仍然付得出去。
// 2026-09-07 之前那笔钱回来会落进「渠道重推，已忽略」——
// `channel_txn_id` 不写、订单不入账、接口回 200，**那笔钱在系统里不存在**，
// 要等第二天对账列成 missing_in_internal 再等人处理。

/// 【被顶掉的那一笔付成了，钱要记下来】。
#[tokio::test]
async fn 被顶掉的支付付成了照样入账() {
    let pool = db_or_skip!();
    common::确保当月开着(&pool).await;
    let (user, order_id) = unpaid_order(&pool, 19900).await;

    let 旧 = payment::start(&pool, &order_id, &user, "wechat_jsapi", None).await.expect("旧的");
    // 换渠道 —— 旧那一笔被顶成 expired
    let _新 = payment::start(&pool, &order_id, &user, "wechat_h5", None).await.expect("新的");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM payment WHERE id=$1", &旧.payment_id).await
            .as_deref(),
        Some("expired"),
        "前提：换渠道之后旧那一笔该是 expired",
    );

    // 而渠道那一侧他把【旧的那一笔】付了
    payment::apply_succeeded(&pool, &旧.payment_id, Some("txn-old-one"), chrono::Utc::now())
        .await
        .expect("渠道说旧那一笔付成了");

    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM payment WHERE id=$1", &旧.payment_id).await
            .as_deref(),
        Some("success"),
        "钱到了而这一笔还挂在 expired —— 那笔钱在系统里不存在",
    );
    assert_eq!(
        common::scalar_string(&pool, "SELECT channel_txn_id FROM payment WHERE id=$1", &旧.payment_id)
            .await.as_deref(),
        Some("txn-old-one"),
        "渠道流水号没记下来 —— 第二天对账就对不上这一条",
    );
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_paid_minor FROM order_record WHERE id=$1", &order_id)
            .await,
        19900,
        "订单没入账",
    );
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("paid"));
}

/// 回调丢了的时候，还有没有人去问那一笔。
///
/// 上面那条验的是「钱回来时收不收」，这条验的是「回调根本没回来时够不够得着」——
/// 两条路缺一条，那笔钱就还是只能等第二天对账。sweeper 就是第二条路，
/// 而它问谁由 `to_ask_channel_about` 说了算。
#[tokio::test]
async fn 被顶掉的那一笔还在该问渠道的名单里() {
    let pool = db_or_skip!();
    common::确保当月开着(&pool).await;
    let (user, order_id) = unpaid_order(&pool, 19900).await;

    let 旧 = payment::start(&pool, &order_id, &user, "wechat_jsapi", None).await.expect("旧的");
    let 新 = payment::start(&pool, &order_id, &user, "wechat_h5", None).await.expect("新的");

    /* 名单有「先给回调一分钟」那一条，也按 created_at 取前 50 —— 而这个库里
       跑着别的测试。把这两笔的建单时间挪到很久以前，它们就一定排在最前面，
       名单满不满都轮得到（`expires_at` 是另一列，不受影响，窗口照旧开着）。 */
    sqlx::query("UPDATE payment SET created_at = TIMESTAMPTZ '1900-01-01' WHERE order_id=$1")
        .bind(&order_id).execute(&pool).await.expect("挪建单时间");

    let 名单 = payment::to_ask_channel_about(&pool).await.expect("名单");
    let 有 = |id: &str| 名单.iter().any(|(p, _)| p == id);
    assert!(有(&旧.payment_id), "被顶掉的那一笔没人再问它 —— 渠道那边收了钱也不会有人知道");
    assert!(有(&新.payment_id), "现在这一笔本来就该问");

    // 而自然到期的那些不该被永远问下去 —— 判据是窗口关没关，不是状态叫什么
    sqlx::query("UPDATE payment SET expires_at = NOW() - INTERVAL '1 hour' WHERE id=$1")
        .bind(&旧.payment_id).execute(&pool).await.expect("把窗口关掉");
    let 名单 = payment::to_ask_channel_about(&pool).await.expect("名单");
    assert!(
        !名单.iter().any(|(p, _)| p == &旧.payment_id),
        "窗口都关了还在问 —— 渠道再也不会说这笔成了，这是白问",
    );
}

/// 【两笔都付了 —— 多出来的那笔照记，但不往订单上加】。
///
/// `order_paid_not_over_total`（实付 ≤ 应付）是 2026-08-16 那次超收之后立的规矩。
/// 旧写法无条件 `+ 金额`、指望 CHECK 去炸 —— 一炸整个事务回滚，
/// 于是这笔支付连 `success` 都记不上，退回到「钱查无此笔」。
#[tokio::test]
async fn 多收的那一笔照记而订单金额不动() {
    let pool = db_or_skip!();
    common::确保当月开着(&pool).await;
    let (user, order_id) = unpaid_order(&pool, 19900).await;

    let 旧 = payment::start(&pool, &order_id, &user, "wechat_jsapi", None).await.expect("旧的");
    let 新 = payment::start(&pool, &order_id, &user, "wechat_h5", None).await.expect("新的");

    // 先把新那一笔付了 —— 这一单付清
    payment::apply_succeeded(&pool, &新.payment_id, Some("txn-new"), chrono::Utc::now())
        .await.expect("新的付成了");
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("paid"));

    // 他又把旧那一笔也付了
    payment::apply_succeeded(&pool, &旧.payment_id, Some("txn-old"), chrono::Utc::now())
        .await.expect("旧的也付成了 —— 这一步不该炸");

    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM payment WHERE id=$1", &旧.payment_id).await
            .as_deref(),
        Some("success"),
        "多收的那一笔也是真的钱，payment 那一行要记成 success",
    );
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_paid_minor FROM order_record WHERE id=$1", &order_id)
            .await,
        19900,
        "订单实付被加成了两倍 —— 那正是 CHECK 要挡的事",
    );
    let 案 = common::scalar_string(
        &pool, "SELECT audit_note FROM payment WHERE id=$1", &旧.payment_id).await;
    assert!(案.as_deref().unwrap_or("").contains("多收的"),
        "多收这件事没有写在案上，事后没人看得出来：{案:?}");
}

// ═══════════ 批下来 ≠ 钱退回去了（2026-09-07）═══════════

/// 【后台按下「批」，钱还没动】。
///
/// 在这之前 `approve` 一步到位：`status='success'`、
/// `channel_refund_id='MOCK_' || id`，订单金额当场加、东西当场收回 ——
/// 而**渠道那一侧一个字都没收到**。买家在屏上看到「已退款」，钱一分没回。
#[tokio::test]
async fn 批下来的时候钱还没退回去() {
    let pool = db_or_skip!();
    let (user, order_id, _p) = paid_order(&pool, 19900).await;
    let rid = refund::request(&pool, &order_id, &user, None, None, "不想要了", None)
        .await.expect("申请");

    refund::approve(&pool, &rid, &Actor::admin("kf")).await.expect("批");

    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM refund WHERE id=$1", &rid).await.as_deref(),
        Some("approved"),
        "批完就说 success —— 而渠道那边还什么都不知道",
    );
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_refunded_minor FROM order_record WHERE id=$1", &order_id).await,
        0,
        "钱还没退，账上已经记着退过了",
    );
    assert_eq!(
        common::scalar_string(&pool, "SELECT COALESCE(channel_refund_id,'') FROM refund WHERE id=$1", &rid)
            .await.as_deref(),
        Some(""),
        "渠道还没给号，我们自己编了一个",
    );
    // 而它在「该发给渠道」的名单里
    let 待发 = refund::批了还没发的(&pool, 200).await.expect("查待发");
    assert!(待发.iter().any(|r| r.refund_id == rid), "批了却没人去发这一笔");
}

/// 渠道收下之后是「退款中」，说退成了才动账。
#[tokio::test]
async fn 渠道说退成了才动账() {
    let pool = db_or_skip!();
    let (user, order_id, _p) = paid_order(&pool, 19900).await;
    let rid = refund::request(&pool, &order_id, &user, None, None, "不想要了", None)
        .await.expect("申请");
    refund::approve(&pool, &rid, &Actor::admin("kf")).await.expect("批");

    refund::发给渠道了(&pool, &rid, "WXR_TEST_1").await.expect("发给渠道");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM refund WHERE id=$1", &rid).await.as_deref(),
        Some("processing"), "发出去了却不是「退款中」",
    );
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_refunded_minor FROM order_record WHERE id=$1", &order_id).await,
        0, "只是发出去了，钱还在路上，账不该动",
    );

    refund::apply_succeeded(&pool, "WXR_TEST_1").await.expect("渠道说退成了");
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_refunded_minor FROM order_record WHERE id=$1", &order_id).await,
        19900, "钱退回去了而账没动",
    );
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("refunded"));

    // 重推一次什么都不该再动 —— 渠道会乱序、会重推
    refund::apply_succeeded(&pool, "WXR_TEST_1").await.expect("再来一次");
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_refunded_minor FROM order_record WHERE id=$1", &order_id).await,
        19900, "同一笔退款被记了两遍",
    );
}

/// 渠道不收，不是终态 —— 人可以在后台再批一次。
#[tokio::test]
async fn 渠道不收的退款还能再批一次() {
    let pool = db_or_skip!();
    let (user, order_id, _p) = paid_order(&pool, 19900).await;
    let rid = refund::request(&pool, &order_id, &user, None, None, "不想要了", None)
        .await.expect("申请");
    refund::approve(&pool, &rid, &Actor::admin("kf")).await.expect("批");
    refund::渠道不收(&pool, &rid, "NOTENOUGH", "商户余额不足").await.expect("渠道拒了");

    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM refund WHERE id=$1", &rid).await.as_deref(),
        Some("failed"));
    assert_eq!(
        common::scalar_i64(&pool, "SELECT amount_refunded_minor FROM order_record WHERE id=$1", &order_id).await,
        0, "渠道都没收，账上却记着退过了");
    // 状态机写着 Failed => [Approved]
    refund::approve(&pool, &rid, &Actor::admin("kf")).await.expect("再批一次该成");
}
