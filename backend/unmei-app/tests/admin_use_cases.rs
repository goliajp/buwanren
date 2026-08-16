//! 后台写操作用例 · 对真库。
//!
//! 这批的共同主题是 P1 修掉的一类系统性缺陷:旧实现全都不看影响行数,
//! 对不存在的 ID 一律返回 `ok:true`,运营在后台点了没反应也毫不知情。
//! 另一条是状态白名单 —— 旧实现在每个 handler 里手抄一份字符串数组,
//! 枚举加了值就漏,现在一律走 domain 枚举。

mod common;

use unmei_app::{catalog, outbox_ops, promotion, risk, shipment, subscription, Actor, DomainError};

// ═══════════════════════════ 商品 / 定价 ═══════════════════════════

#[tokio::test]
async fn set_product_status_accepts_only_domain_enum_values() {
    let pool = db_or_skip!();
    let sku = common::sku_with_price(&pool, "CNY", 100).await;
    let product_id: String = sqlx::query_scalar("SELECT product_id FROM sku WHERE id=$1")
        .bind(&sku)
        .fetch_one(&pool)
        .await
        .expect("query product_id");

    let status = catalog::set_product_status(&pool, &product_id, "delisted", &Actor::admin("admin_op"))
        .await
        .expect("delist");
    assert_eq!(status.as_str(), "delisted");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM product WHERE id=$1", &product_id).await.as_deref(),
        Some("delisted")
    );

    // 旧实现在路由里手抄 ["draft","listed","delisted","discontinued"]
    let err = catalog::set_product_status(&pool, &product_id, "bogus", &Actor::admin("admin_op"))
        .await
        .expect_err("非法状态该被拒");
    assert!(matches!(err, DomainError::Validation(_)), "实际 {err:?}");
}

#[tokio::test]
async fn set_product_status_on_unknown_product_is_not_found() {
    let pool = db_or_skip!();
    let err = catalog::set_product_status(&pool, "prd-nope", "listed", &Actor::admin("a"))
        .await
        .expect_err("幽灵商品");
    assert!(matches!(err, DomainError::NotFound(_)));
}

#[tokio::test]
async fn publish_price_checks_the_sku_exists_before_inserting() {
    let pool = db_or_skip!();
    // 旧实现直接 INSERT,让外键去报错 —— 出来的是一条 500 db error 而不是 404
    let err = catalog::publish_price(&pool, "sku-nope", new_price("CNY", 100), &Actor::admin("a"))
        .await
        .expect_err("幽灵 SKU");
    assert!(matches!(err, DomainError::NotFound(_)), "实际 {err:?}");
}

#[tokio::test]
async fn publish_price_rejects_negative_amounts() {
    let pool = db_or_skip!();
    let sku = common::sku_with_price(&pool, "CNY", 100).await;
    let err = catalog::publish_price(&pool, &sku, new_price("CNY", -1), &Actor::admin("a"))
        .await
        .expect_err("负价该被拒");
    assert!(matches!(err, DomainError::Validation(_)), "实际 {err:?}");
}

#[tokio::test]
async fn publish_price_records_the_publishing_admin() {
    let pool = db_or_skip!();
    let sku = common::sku_with_price(&pool, "CNY", 100).await;

    let price_id = catalog::publish_price(&pool, &sku, new_price("JPY", 1200), &Actor::admin("admin_pricing"))
        .await
        .expect("publish");

    assert_eq!(
        common::scalar_string(&pool, "SELECT created_by_admin_id FROM price_book WHERE id=$1", &price_id).await.as_deref(),
        Some("admin_pricing")
    );
    assert_eq!(
        common::scalar_string(&pool, "SELECT currency FROM price_book WHERE id=$1", &price_id).await.as_deref(),
        Some("JPY")
    );
}

#[tokio::test]
async fn expire_price_reports_not_found_for_unknown_id() {
    let pool = db_or_skip!();
    let sku = common::sku_with_price(&pool, "CNY", 100).await;
    let price_id = catalog::publish_price(&pool, &sku, new_price("CNY", 200), &Actor::admin("a"))
        .await
        .expect("publish");

    catalog::expire_price(&pool, &price_id).await.expect("expire");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM price_book WHERE id=$1", &price_id).await.as_deref(),
        Some("expired")
    );

    let err = catalog::expire_price(&pool, "pb-nope").await.expect_err("幽灵价格");
    assert!(matches!(err, DomainError::NotFound(_)));
}

// ═══════════════════════════ 营销 ═══════════════════════════

#[tokio::test]
async fn promotion_status_goes_through_the_domain_enum() {
    let pool = db_or_skip!();
    let promo_id = common::uniq("promo");
    sqlx::query(
        "INSERT INTO promotion(id, code, name, kind, match_json, rule_json, benefit_json,
                               effective_from, status)
         VALUES ($1, $1, '测试促销', 'pct_off', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, NOW(), 'draft')",
    )
    .bind(&promo_id)
    .execute(&pool)
    .await
    .expect("insert promotion");

    let status = promotion::set_status(&pool, &promo_id, "active", &Actor::admin("admin_mkt"))
        .await
        .expect("activate");
    assert_eq!(status.as_str(), "active");

    let err = promotion::set_status(&pool, &promo_id, "bogus", &Actor::admin("admin_mkt"))
        .await
        .expect_err("非法状态");
    assert!(matches!(err, DomainError::Validation(_)));

    let err = promotion::set_status(&pool, "promo-nope", "active", &Actor::admin("a"))
        .await
        .expect_err("幽灵促销");
    assert!(matches!(err, DomainError::NotFound(_)));
}

// ═══════════════════════════ 订阅 ═══════════════════════════

#[tokio::test]
async fn cancel_at_period_end_does_not_terminate_immediately() {
    let pool = db_or_skip!();
    let sub_id = subscription_fixture(&pool).await;

    subscription::cancel(&pool, &sub_id, false, Some("太贵"), &Actor::admin("admin_kf"))
        .await
        .expect("cancel at period end");

    // 当前周期照常服务
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM subscription WHERE id=$1", &sub_id).await.as_deref(),
        Some("active")
    );
    let flag: bool = sqlx::query_scalar("SELECT cancel_at_period_end FROM subscription WHERE id=$1")
        .bind(&sub_id)
        .fetch_one(&pool)
        .await
        .expect("query flag");
    assert!(flag);
    // 还没真取消,不该发事件 —— 到期时由 billing worker 发
    assert_eq!(common::outbox_count(&pool, "SubscriptionCancelled", &sub_id).await, 0);
}

#[tokio::test]
async fn immediate_cancel_terminates_and_emits_the_event() {
    let pool = db_or_skip!();
    let sub_id = subscription_fixture(&pool).await;

    subscription::cancel(&pool, &sub_id, true, Some("投诉"), &Actor::admin("admin_kf"))
        .await
        .expect("immediate cancel");

    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM subscription WHERE id=$1", &sub_id).await.as_deref(),
        Some("cancelled")
    );
    // 旧实现两条分支都不发事件,订阅被谁什么时候取消无从追查
    assert_eq!(common::outbox_count(&pool, "SubscriptionCancelled", &sub_id).await, 1);
}

#[tokio::test]
async fn cancel_unknown_subscription_is_not_found() {
    let pool = db_or_skip!();
    let err = subscription::cancel(&pool, "sub-nope", true, None, &Actor::admin("a"))
        .await
        .expect_err("幽灵订阅");
    assert!(matches!(err, DomainError::NotFound(_)));
}

// ═══════════════════════════ 物流 ═══════════════════════════

#[tokio::test]
async fn assign_tracking_advances_the_shipment_to_picked_up() {
    let pool = db_or_skip!();
    let shipment_id = shipment_fixture(&pool).await;

    shipment::assign_tracking(
        &pool,
        &shipment_id,
        shipment::TrackingAssignment {
            carrier_code: "sf".into(),
            tracking_no: "SF123456".into(),
            shipping_method: Some("express".into()),
            cost_minor: Some(1200),
            cost_currency: Some("CNY".into()),
        },
    )
    .await
    .expect("assign tracking");

    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM shipment WHERE id=$1", &shipment_id).await.as_deref(),
        Some("picked_up")
    );
    assert_eq!(
        common::scalar_string(&pool, "SELECT tracking_no FROM shipment WHERE id=$1", &shipment_id).await.as_deref(),
        Some("SF123456")
    );
}

#[tokio::test]
async fn mark_delivered_is_idempotent_and_emits_once() {
    let pool = db_or_skip!();
    let shipment_id = shipment_fixture(&pool).await;

    shipment::mark_delivered(&pool, &shipment_id).await.expect("deliver");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM shipment WHERE id=$1", &shipment_id).await.as_deref(),
        Some("delivered")
    );
    assert_eq!(common::outbox_count(&pool, "ShipmentDelivered", &shipment_id).await, 1);

    // 物流商会重复推同一条终态,再调一次不该再发一遍事件
    shipment::mark_delivered(&pool, &shipment_id).await.expect("deliver again");
    assert_eq!(
        common::outbox_count(&pool, "ShipmentDelivered", &shipment_id).await,
        1,
        "重复送达不该重复发事件"
    );
}

#[tokio::test]
async fn shipment_writes_on_unknown_id_are_not_found() {
    let pool = db_or_skip!();
    let err = shipment::mark_exception(&pool, "shp-nope", "破损", &Actor::admin("a"))
        .await
        .expect_err("幽灵运单");
    assert!(matches!(err, DomainError::NotFound(_)));

    let err = shipment::assign_tracking(
        &pool,
        "shp-nope",
        shipment::TrackingAssignment { carrier_code: "sf".into(), tracking_no: "X".into(), ..Default::default() },
    )
    .await
    .expect_err("幽灵运单");
    assert!(matches!(err, DomainError::NotFound(_)));
}

// ═══════════════════════════ 风控 / Outbox ═══════════════════════════

#[tokio::test]
async fn risk_rule_status_goes_through_the_domain_enum() {
    let pool = db_or_skip!();
    let rule_id = common::uniq("rr");
    sqlx::query(
        "INSERT INTO risk_rule(id, name, kind, expression, action, priority, status)
         VALUES ($1, '测试规则', 'pre_pay', 'amount > 100', 'review', 10, 'active')",
    )
    .bind(&rule_id)
    .execute(&pool)
    .await
    .expect("insert risk_rule");

    let status = risk::set_rule_status(&pool, &rule_id, "paused").await.expect("pause");
    assert_eq!(status.as_str(), "paused");

    let err = risk::set_rule_status(&pool, &rule_id, "bogus").await.expect_err("非法状态");
    assert!(matches!(err, DomainError::Validation(_)));

    let err = risk::set_rule_status(&pool, "rr-nope", "active").await.expect_err("幽灵规则");
    assert!(matches!(err, DomainError::NotFound(_)));
}

#[tokio::test]
async fn outbox_retry_only_applies_to_failed_or_dropped_events() {
    let pool = db_or_skip!();
    let event_id = common::uniq("oe");
    sqlx::query(
        "INSERT INTO outbox_event(id, kind, aggregate_kind, aggregate_id, payload_json, status, next_attempt_at)
         VALUES ($1, 'OrderCreated', 'order', 'ord-x', '{}'::jsonb, 'failed', NOW())",
    )
    .bind(&event_id)
    .execute(&pool)
    .await
    .expect("insert outbox_event");

    outbox_ops::retry(&pool, &event_id).await.expect("retry failed event");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM outbox_event WHERE id=$1", &event_id).await.as_deref(),
        Some("pending")
    );

    // 已经回到 pending 了,再 retry 一次没有意义,该明确拒绝而不是假装成功
    let err = outbox_ops::retry(&pool, &event_id).await.expect_err("pending 事件不该能 retry");
    assert!(matches!(err, DomainError::Conflict(_)), "实际 {err:?}");
}

// ═══════════════════════════ 辅助 ═══════════════════════════

fn new_price(currency: &str, price_minor: i64) -> catalog::NewPrice {
    catalog::NewPrice {
        currency: currency.into(),
        price_minor,
        region: "cn".into(),
        platform: "all".into(),
        effective_from: None,
        audit_note: None,
    }
}

async fn subscription_fixture(pool: &sqlx::PgPool) -> String {
    let user = common::user(pool).await;
    let sku = common::sku_with_price(pool, "CNY", 4800).await;
    let plan_id = common::uniq("plan");
    let sub_id = common::uniq("sub");
    // plan 挂在 SKU 上,价格来自 price_book —— 没有自己的 price_minor/currency 列
    sqlx::query(
        "INSERT INTO plan(id, sku_id, name, billing_period, status)
         VALUES ($1, $2, '测试套餐', 'month', 'active')",
    )
    .bind(&plan_id)
    .bind(&sku)
    .execute(pool)
    .await
    .expect("insert plan");
    sqlx::query(
        "INSERT INTO subscription(id, user_id, plan_id, status, source_channel,
                                  current_period_start, current_period_end)
         VALUES ($1, $2, $3, 'active', 'wechat', NOW(), NOW() + INTERVAL '30 days')",
    )
    .bind(&sub_id)
    .bind(&user)
    .bind(&plan_id)
    .execute(pool)
    .await
    .expect("insert subscription");
    sub_id
}

async fn shipment_fixture(pool: &sqlx::PgPool) -> String {
    let user = common::user(pool).await;
    let order_id = common::uniq("ord");
    let shipment_id = common::uniq("shp");
    sqlx::query(
        "INSERT INTO order_record(id, user_id, channel_origin, currency,
                                  amount_subtotal_minor, amount_total_minor, status, source_kind, region)
         VALUES ($1, $2, 'web', 'CNY', 100, 100, 'paid', 'one_shot', 'cn')",
    )
    .bind(&order_id)
    .bind(&user)
    .execute(pool)
    .await
    .expect("insert order for shipment");
    sqlx::query("INSERT INTO shipment(id, order_id, status) VALUES ($1, $2, 'preparing')")
        .bind(&shipment_id)
        .bind(&order_id)
        .execute(pool)
        .await
        .expect("insert shipment");
    shipment_id
}
