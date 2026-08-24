//! 履约推进用例 · 对真库。
//!
//! 这两个入口是 outbox handler,重试是设计内行为 —— 所以每条测试的核心手法
//! 都是「跑两遍,断言效果只发生一遍」。

mod common;

use serde_json::json;
use unmei_app::fulfillment::{self, FulfillmentOutcome};
use unmei_app::{order, payment};

/// 建一个 shipping 类商品的已付订单。返回 (order_id, line_id)。
async fn paid_shipping_order(pool: &sqlx::PgPool, with_meta: bool) -> (String, String) {
    let user = common::user(pool).await;
    let sku = common::sku_with_price(pool, "CNY", 39800).await;
    // fixture 的 product 默认 fulfillment_kind='instant',改成 shipping
    sqlx::query(
        "UPDATE product SET fulfillment_kind='shipping'
         WHERE id = (SELECT product_id FROM sku WHERE id=$1)",
    )
    .bind(&sku)
    .execute(pool)
    .await
    .expect("set shipping kind");

    let mut req = order::NewOrder {
        user_id: user.clone(),
        region: "cn".into(),
        channel_origin: "web".into(),
        lines: vec![order::NewOrderLine { sku_id: sku, qty: 1 }],
        shipping_address: Some(json!({"city": "长沙", "detail": "岳麓区"})),
        contact: None,
        coupon_codes: vec![],
        note: None,
        ip: None,
        ua: None,
    };
    if !with_meta {
        req.shipping_address = None;
    }
    let created = order::create(pool, req).await.expect("create order");

    if !with_meta {
        // 建单用例总是写 order_meta;要模拟「没有 meta 行」的历史数据得手动删
        sqlx::query("DELETE FROM order_meta WHERE order_id=$1")
            .bind(&created.order_id)
            .execute(pool)
            .await
            .expect("drop meta");
    }

    let pending = payment::start(pool, &created.order_id, &user, "wechat_jsapi", None)
        .await
        .expect("start payment");
    payment::apply_succeeded(pool, &pending.payment_id, None, chrono::Utc::now())
        .await
        .expect("pay");

    let line_id: String = sqlx::query_scalar("SELECT id FROM order_line WHERE order_id=$1")
        .bind(&created.order_id)
        .fetch_one(pool)
        .await
        .expect("line id");
    (created.order_id, line_id)
}

async fn shipment_count(pool: &sqlx::PgPool, order_id: &str) -> i64 {
    common::scalar_i64(pool, "SELECT COUNT(*) FROM shipment WHERE order_id=$1", order_id).await
}

// ═══════════════════════════ instant 路径 ═══════════════════════════

#[tokio::test]
async fn instant_order_fulfills_to_done_and_emits_once() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 100).await; // fixture 默认 instant
    let created = order::create(
        &pool,
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
    .expect("create");
    let pending = payment::start(&pool, &created.order_id, &user, "wechat_jsapi", None).await.expect("start");
    payment::apply_succeeded(&pool, &pending.payment_id, None, chrono::Utc::now()).await.expect("pay");

    let outcome = fulfillment::apply_order_paid(&pool, &created.order_id).await.expect("fulfill");
    assert_eq!(outcome, FulfillmentOutcome::Done);
    assert_eq!(common::order_status(&pool, &created.order_id).await.as_deref(), Some("done"));
    assert_eq!(common::outbox_count(&pool, "OrderFulfilled", &created.order_id).await, 1);

    // outbox 重试:再跑一遍,事件不能翻倍(履约通知发两遍 = 给用户发两次货的邻居)
    let again = fulfillment::apply_order_paid(&pool, &created.order_id).await.expect("retry");
    assert_eq!(again, FulfillmentOutcome::NotApplicable);
    assert_eq!(common::outbox_count(&pool, "OrderFulfilled", &created.order_id).await, 1);
}

// ═══════════════════════════ shipping 路径 ═══════════════════════════

#[tokio::test]
async fn shipping_order_creates_exactly_one_shipment_even_when_retried() {
    let pool = db_or_skip!();
    let (order_id, line_id) = paid_shipping_order(&pool, true).await;

    let outcome = fulfillment::apply_order_paid(&pool, &order_id).await.expect("fulfill");
    assert!(matches!(outcome, FulfillmentOutcome::Fulfilling { pending_lines: 1 }));
    assert_eq!(shipment_count(&pool, &order_id).await, 1);
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("fulfilling"));

    // ★ 旧实现的 ON CONFLICT DO NOTHING 是空守卫(shipment 只有主键唯一,
    //   每次 id 都是新 uuid),挂在「建 shipment 后、标 line 前」再重试就是两个包裹。
    //   现在行已是 processing 不会再选出,且 INSERT 有 NOT EXISTS 兜底。
    fulfillment::apply_order_paid(&pool, &order_id).await.expect("retry");
    assert_eq!(shipment_count(&pool, &order_id).await, 1, "重试不该建第二个包裹");

    // 模拟最刁的挂法:手动把行改回 pending(等价于第一次挂在标 processing 之前),
    // NOT EXISTS 这道兜底必须还能拦住
    sqlx::query("UPDATE order_line SET fulfillment_status='pending' WHERE id=$1")
        .bind(&line_id)
        .execute(&pool)
        .await
        .expect("rewind line");
    fulfillment::apply_order_paid(&pool, &order_id).await.expect("retry after rewind");
    assert_eq!(shipment_count(&pool, &order_id).await, 1, "行回退重放也不该出第二个包裹");
}

#[tokio::test]
async fn shipping_order_without_order_meta_still_gets_a_shipment() {
    let pool = db_or_skip!();
    let (order_id, _line) = paid_shipping_order(&pool, false).await;

    // ★ 旧实现的 INSERT 用 `FROM order_meta WHERE order_id=…`:meta 行不存在时
    //   静默插 0 行,line 却标了 processing —— 包裹从此不存在。
    fulfillment::apply_order_paid(&pool, &order_id).await.expect("fulfill");
    assert_eq!(shipment_count(&pool, &order_id).await, 1, "没有 order_meta 也必须建出包裹");
    let snapshot: serde_json::Value = sqlx::query_scalar(
        "SELECT recipient_snapshot_json FROM shipment WHERE order_id=$1",
    )
    .bind(&order_id)
    .fetch_one(&pool)
    .await
    .expect("snapshot");
    assert_eq!(snapshot, json!({}), "meta 缺行时快照回退为空对象");
}

#[tokio::test]
async fn delivered_shipment_settles_the_order_and_emits_fulfilled() {
    let pool = db_or_skip!();
    let (order_id, _line) = paid_shipping_order(&pool, true).await;
    fulfillment::apply_order_paid(&pool, &order_id).await.expect("fulfill");
    let shipment_id: String = sqlx::query_scalar("SELECT id FROM shipment WHERE order_id=$1")
        .bind(&order_id)
        .fetch_one(&pool)
        .await
        .expect("shipment id");

    let outcome = fulfillment::apply_shipment_delivered(&pool, &shipment_id, &order_id)
        .await
        .expect("delivered");
    assert_eq!(outcome, FulfillmentOutcome::Done);
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("done"));
    // ★ 旧实现这条路径不发 OrderFulfilled —— shipping 订单的完成对下游是隐形的,
    //   与 instant 路径不一致
    assert_eq!(common::outbox_count(&pool, "OrderFulfilled", &order_id).await, 1);

    // 物流商重复推送达 → 重放,事件不翻倍
    fulfillment::apply_shipment_delivered(&pool, &shipment_id, &order_id)
        .await
        .expect("replay delivered");
    assert_eq!(common::outbox_count(&pool, "OrderFulfilled", &order_id).await, 1);
}

#[tokio::test]
async fn interrupted_before_settlement_recovers_on_retry() {
    let pool = db_or_skip!();
    let (order_id, line_id) = paid_shipping_order(&pool, true).await;
    fulfillment::apply_order_paid(&pool, &order_id).await.expect("fulfill");

    // 模拟:行全部到终态,但订单还停在 fulfilling(等价于上次挂在结算前)。
    // ★ 旧实现 `if lines.is_empty() { return }` —— 这种状态永远无法自愈。
    sqlx::query("UPDATE order_line SET fulfillment_status='done' WHERE id=$1")
        .bind(&line_id)
        .execute(&pool)
        .await
        .expect("force done");

    let outcome = fulfillment::apply_order_paid(&pool, &order_id).await.expect("retry settles");
    assert_eq!(outcome, FulfillmentOutcome::Done);
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("done"));
    assert_eq!(common::outbox_count(&pool, "OrderFulfilled", &order_id).await, 1);
}
