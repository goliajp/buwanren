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

// ═══════════════════════════ 续费 ═══════════════════════════

#[tokio::test]
async fn renew_extends_the_period_and_records_an_order() {
    let pool = db_or_skip!();
    let sub_id = subscription_fixture(&pool).await;
    let before: chrono::DateTime<chrono::Utc> = sqlx::query_scalar(
        "SELECT current_period_end FROM subscription WHERE id=$1",
    )
    .bind(&sub_id)
    .fetch_one(&pool)
    .await
    .expect("period end");

    let outcome = subscription::renew_due(&pool, &sub_id).await.expect("renew");
    let subscription::RenewOutcome::Renewed { order_id, period_end, .. } = outcome else {
        panic!("期望 Renewed，实际 {outcome:?}");
    };

    assert!(period_end > before, "周期该被延长");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM order_record WHERE id=$1", &order_id).await.as_deref(),
        Some("paid")
    );
    // 旧实现一条事件都不发,续费对 dispatcher 和财务是隐形的
    assert_eq!(common::outbox_count(&pool, "SubscriptionRenewed", &sub_id).await, 1);
}

#[tokio::test]
async fn renew_does_not_charge_a_subscription_cancelled_at_period_end() {
    let pool = db_or_skip!();
    let sub_id = subscription_fixture(&pool).await;

    // 用户点了「到期不续」
    subscription::cancel(&pool, &sub_id, false, Some("不续了"), &Actor::user("u1"))
        .await
        .expect("cancel at period end");

    // ★ 旧 worker 的选行条件里根本没有 cancel_at_period_end 这一项,
    //   到期照样建订单、建支付、延周期 —— 用户明确说了不续还是被扣钱。
    let outcome = subscription::renew_due(&pool, &sub_id).await.expect("renew_due");
    assert_eq!(outcome, subscription::RenewOutcome::StoppedAtPeriodEnd);

    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM subscription WHERE id=$1", &sub_id).await.as_deref(),
        Some("cancelled")
    );
    // 一分钱都不该收
    let user_id = common::scalar_string(&pool, "SELECT user_id FROM subscription WHERE id=$1", &sub_id)
        .await
        .expect("user");
    assert_eq!(
        common::scalar_i64(&pool, "SELECT COUNT(*) FROM order_record WHERE user_id=$1", &user_id).await,
        0,
        "到期不续不该产生任何订单"
    );
    // `cancel(immediate=false)` 说好事件留到这一刻发
    assert_eq!(common::outbox_count(&pool, "SubscriptionCancelled", &sub_id).await, 1);
    // 别再被下一个 tick 捞出来
    let next: Option<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
        "SELECT next_billing_attempt_at FROM subscription WHERE id=$1",
    )
    .bind(&sub_id)
    .fetch_one(&pool)
    .await
    .expect("next attempt");
    assert!(next.is_none(), "停掉之后不该再排下一次续费");
}

#[tokio::test]
async fn renew_without_an_active_price_stops_retrying_instead_of_looping() {
    let pool = db_or_skip!();
    let sub_id = subscription_fixture_without_price(&pool).await;

    let outcome = subscription::renew_due(&pool, &sub_id).await.expect("renew_due");
    assert_eq!(outcome, subscription::RenewOutcome::Unpriced);

    // 旧实现直接 return,`next_billing_attempt_at` 原封不动 ——
    // 这条订阅会被每 5 分钟重新选出来一次,永远。
    let next: Option<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
        "SELECT next_billing_attempt_at FROM subscription WHERE id=$1",
    )
    .bind(&sub_id)
    .fetch_one(&pool)
    .await
    .expect("next attempt");
    assert!(next.is_none(), "收不了钱就该停止重试，而不是每个 tick 重来");
}

#[tokio::test]
async fn renew_skips_subscriptions_that_are_no_longer_active() {
    let pool = db_or_skip!();
    let sub_id = subscription_fixture(&pool).await;
    subscription::cancel(&pool, &sub_id, true, None, &Actor::admin("a")).await.expect("cancel now");

    let outcome = subscription::renew_due(&pool, &sub_id).await.expect("renew_due");
    assert_eq!(outcome, subscription::RenewOutcome::NotDue);
}

// ═══════════════════════════ 物流 ═══════════════════════════

/// 承运商回调说「已签收」，跟轮询查到「已签收」是同一件事，
/// 所以必须发同一个 `ShipmentDelivered` —— 履约那一侧是靠它推进的。
///
/// 这跟 README 里已记的支付那条一字不差是同一个病：
/// 「它发 OrderPaid 事件而回调那条路不发 —— 走 webhook 进来的支付
///   永远不会触发履约」。这次是物流版。
#[tokio::test]
async fn a_delivery_reported_by_webhook_emits_the_same_event_as_one_found_by_polling() {
    let pool = db_or_skip!();
    let shipment_id = shipment_fixture(&pool).await;
    let tracking = common::uniq("SF-DELIVERED");
    shipment::assign_tracking(
        &pool,
        &shipment_id,
        shipment::TrackingAssignment {
            carrier_code: "sf".into(),
            tracking_no: tracking.clone(),
            shipping_method: None,
            cost_minor: None,
            cost_currency: None,
        },
    )
    .await
    .expect("assign tracking");

    shipment::apply_trace_webhook(&pool, unmei_domain::commerce::adapters::TraceWebhookEvent {
        carrier_code: "sf".into(),
        tracking_no: tracking.clone(),
        events: vec![unmei_domain::commerce::adapters::TraceEvent {
            event_at: chrono::Utc::now(),
            kind: "delivered".into(),
            location: Some("门口".into()),
            description: "已签收".into(),
            raw_event_id: Some(common::uniq("sf-evt-delivered")),
        }],
    })
    .await
    .expect("webhook");

    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM shipment WHERE id=$1", &shipment_id)
            .await.as_deref(),
        Some("delivered")
    );
    assert_eq!(
        common::outbox_count(&pool, "ShipmentDelivered", &shipment_id).await, 1,
        "回调报的签收也要发 ShipmentDelivered，否则履约那一侧永远不知道"
    );
}

/// 认不出的轨迹类型，原先会被 `ELSE 'in_transit'` 说成「在途」——
/// 已经在派件的包裹因此**退回**在途，而迁移里写着的 `failed_delivery`
/// （投递失败）根本不在那五项里，也被显示成在途。
#[tokio::test]
async fn an_unrecognised_trace_kind_does_not_move_the_shipment() {
    let pool = db_or_skip!();
    let shipment_id = shipment_fixture(&pool).await;

    shipment::advance_status_now(&pool, &shipment_id, "out_for_delivery").await.expect("派件中");
    shipment::advance_status_now(&pool, &shipment_id, "什么类型-zzz").await.expect("不认识的也别报错");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM shipment WHERE id=$1", &shipment_id)
            .await.as_deref(),
        Some("out_for_delivery"),
        "不认识的轨迹不该把派件中的包裹退回在途"
    );

    // 投递失败是词表里写着的一种，它归 exception —— 说成「在途」或停在
    // 「派件中」都是假话。
    shipment::advance_status_now(&pool, &shipment_id, "failed_delivery").await.expect("投递失败");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM shipment WHERE id=$1", &shipment_id)
            .await.as_deref(),
        Some("exception")
    );

    // 词表里那两种中途节点仍然是在途，行为不变。
    shipment::advance_status_now(&pool, &shipment_id, "departed").await.expect("离开集散中心");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM shipment WHERE id=$1", &shipment_id)
            .await.as_deref(),
        Some("in_transit")
    );
}

/// 轮询那条入口（`advance_status_now`）与回调那条现在是同一份实现，
/// 所以同一串事件必须给出同样的结果。这条从轮询这一侧再验一遍 ——
/// 「两条路同行为」这句话，只测一侧是证不出来的。
#[tokio::test]
async fn the_polling_entry_point_behaves_exactly_like_the_webhook_one() {
    let pool = db_or_skip!();
    let shipment_id = shipment_fixture(&pool).await;

    shipment::advance_status_now(&pool, &shipment_id, "picked_up").await.expect("picked_up");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM shipment WHERE id=$1", &shipment_id)
            .await.as_deref(),
        Some("picked_up")
    );

    shipment::advance_status_now(&pool, &shipment_id, "delivered").await.expect("delivered");
    assert_eq!(
        common::outbox_count(&pool, "ShipmentDelivered", &shipment_id).await, 1,
        "轮询报的签收同样要发 ShipmentDelivered"
    );

    shipment::advance_status_now(&pool, &shipment_id, "in_transit").await.expect("late");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM shipment WHERE id=$1", &shipment_id)
            .await.as_deref(),
        Some("delivered"),
        "签收之后不退回"
    );
}

/// 迟到的在途事件不该把已签收的运单退回去。
///
/// 轮询那条路本来就带着这个守卫（`workers/shipment_trace.rs` 的
/// `WHERE ... status NOT IN ('delivered','returned','cancelled')`），
/// 回调这条没有 —— 同一件事，两条路给出不同结果。
#[tokio::test]
async fn a_late_in_transit_event_does_not_undeliver_a_delivered_shipment() {
    let pool = db_or_skip!();
    let shipment_id = shipment_fixture(&pool).await;
    let tracking = common::uniq("SF-LATE");
    shipment::assign_tracking(
        &pool,
        &shipment_id,
        shipment::TrackingAssignment {
            carrier_code: "sf".into(),
            tracking_no: tracking.clone(),
            shipping_method: None,
            cost_minor: None,
            cost_currency: None,
        },
    )
    .await
    .expect("assign tracking");
    let ev = |kind: &str| unmei_domain::commerce::adapters::TraceWebhookEvent {
        carrier_code: "sf".into(),
        tracking_no: tracking.clone(),
        events: vec![unmei_domain::commerce::adapters::TraceEvent {
            event_at: chrono::Utc::now(),
            kind: kind.into(),
            location: None,
            description: String::new(),
            raw_event_id: Some(common::uniq("sf-evt")),
        }],
    };
    shipment::apply_trace_webhook(&pool, ev("delivered")).await.expect("delivered");
    shipment::apply_trace_webhook(&pool, ev("in_transit")).await.expect("late in_transit");

    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM shipment WHERE id=$1", &shipment_id)
            .await.as_deref(),
        Some("delivered"),
        "签收之后不该被一条迟到的在途事件退回去"
    );
}

/// 承运商把同一条事件重推一次，不该报错、也不该多出一行。
///
/// `uq_trace_dedup ON (raw_source, raw_event_id)` 这个唯一索引【本来就是
/// 为去重建的】，而插入写的是 `ON CONFLICT (id)` —— id 每次现生成，
/// 这个冲突永远不会发生，撞上的是那个唯一索引，于是整个事务回滚、
/// 回调收到 500、承运商继续重推。
///
/// 这跟支付那条已修的 bug 是同一个病（README「渠道重推回调会重复入账」
/// 里记着：漏 ON CONFLICT → 撞 uq_payment_event_channel_eid → 500 → 死循环）。
#[tokio::test]
async fn a_carrier_repushing_the_same_event_is_absorbed_not_an_error() {
    let pool = db_or_skip!();
    let shipment_id = shipment_fixture(&pool).await;
    // 运单号必须每次都不一样：回调是按 carrier_code + tracking_no 找单的，
    // 写死一个号的话，上一轮跑剩的那一单会把这一轮的事件接走 —— 我第一版
    // 就是这么被骗的：断言说「只该留一行」，实际读到 0，而事件落在了旧单上。
    let tracking = common::uniq("SF-REPUSH");
    // 事件 id 也要每轮唯一：去重键 `(raw_source, raw_event_id)` 是【全局】的，
    // 不带运单。写死的话上一轮那条已经占住它，这一轮的插入会被 DO NOTHING
    // 吸收掉 —— 于是断言读到 0，看起来像「修的那一版把第一条也吞了」。
    let evt_id = common::uniq("sf-evt");
    shipment::assign_tracking(
        &pool,
        &shipment_id,
        shipment::TrackingAssignment {
            carrier_code: "sf".into(),
            tracking_no: tracking.clone(),
            shipping_method: None,
            cost_minor: None,
            cost_currency: None,
        },
    )
    .await
    .expect("assign tracking");

    let ev = || unmei_domain::commerce::adapters::TraceWebhookEvent {
        carrier_code: "sf".into(),
        tracking_no: tracking.clone(),
        events: vec![unmei_domain::commerce::adapters::TraceEvent {
            event_at: chrono::Utc::now(),
            kind: "in_transit".into(),
            location: Some("上海".into()),
            description: "运输中".into(),
            raw_event_id: Some(evt_id.clone()),
        }],
    };

    shipment::apply_trace_webhook(&pool, ev()).await.expect("第一次");
    shipment::apply_trace_webhook(&pool, ev())
        .await
        .expect("重推同一条事件不该报错 —— 报错会让承运商一直重推");

    let n = common::scalar_i64(
        &pool,
        "SELECT count(*) FROM shipment_trace_event WHERE shipment_id=$1",
        &shipment_id,
    )
    .await;
    assert_eq!(n, 1, "同一条事件推两次，只该留一行");
}

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
    let sku = common::sku_with_price(pool, "CNY", 4800).await;
    subscription_on_sku(pool, sku).await
}

/// 套餐挂在一个没有激活价的 SKU 上 —— 测「收不了钱」那条分支。
async fn subscription_fixture_without_price(pool: &sqlx::PgPool) -> String {
    let sku = common::sku_without_price(pool).await;
    subscription_on_sku(pool, sku).await
}

async fn subscription_on_sku(pool: &sqlx::PgPool, sku: String) -> String {
    let user = common::user(pool).await;
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

/// 同一笔订阅【连着续两次】会怎样 —— 钉住的是现状，不是期望。
///
/// `renew_due` 的文档注释里写着这条（2026-08-18 实测）：它不问「这一期
/// 是不是已经续过了」，`FOR UPDATE` 只保证两次串行，不保证第二次会退出。
/// 今天够不着，因为那个 billing worker 单实例、顺序处理，一个 id 一轮只取一次。
///
/// 但那是**部署形态在兜底，不是代码在兜底**。多起一个实例、或者来一个
/// 新调用方，这就是一次重复扣款。所以把它钉下来：
/// 哪天有人给它加上「这一期续过了吗」，这条会红 —— 那时该改的是这个测试
/// 和 `scripts/known-money-bugs.json` 里那一条，而不是把它删掉。
#[tokio::test]
async fn renewing_twice_in_a_row_bills_twice_today() {
    let pool = db_or_skip!();
    let sub_id = subscription_fixture(&pool).await;

    subscription::renew_due(&pool, &sub_id).await.expect("第一次续费");
    subscription::renew_due(&pool, &sub_id).await.expect("第二次续费");

    // 订单的 source_ref_id 记的是【发票 id】，不是订阅 id —— 所以顺着发票串起来数
    let orders: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM order_record o
           JOIN subscription_invoice i ON i.id = o.source_ref_id
          WHERE o.source_kind='subscription_renew' AND i.subscription_id=$1",
    )
    .bind(&sub_id)
    .fetch_one(&pool)
    .await
    .expect("数订单");

    assert_eq!(
        orders, 2,
        "现状是连续两次续费开出两张单。变成 1 说明有人加上了「这一期续过了吗」——\
         那是好事，改这条测试与 known-money-bugs.json，别把它删掉"
    );
}

/// 点过「到期不续」的订阅，到期时**不许收钱**。
///
/// README「已修 · 到期不续的订阅照样被扣钱」那一条钉的是这里 ——
/// 而 2026-08-24 核过：现有测试只验了取消接口把标志置上，
/// **续费那条路上没有任何测试**。修好的钱 bug 没人钉着，它会静静回来。
#[tokio::test]
async fn cancel_at_period_end_is_honoured_by_the_renewal_and_bills_nothing() {
    let pool = db_or_skip!();
    let sub_id = subscription_fixture(&pool).await;

    subscription::cancel(&pool, &sub_id, false, Some("到期不续"), &Actor::admin("admin_kf"))
        .await
        .expect("到期不续");

    let outcome = subscription::renew_due(&pool, &sub_id).await.expect("renew_due");
    assert!(
        matches!(outcome, subscription::RenewOutcome::StoppedAtPeriodEnd),
        "点过「到期不续」，续费却没停下来：{outcome:?}"
    );

    // 一分钱都不该收：既没有续费订单，也没有发票
    let orders = common::scalar_i64(
        &pool,
        "SELECT count(*) FROM order_record o JOIN subscription_invoice i ON i.id = o.source_ref_id
          WHERE o.source_kind='subscription_renew' AND i.subscription_id=$1",
        &sub_id,
    )
    .await;
    assert_eq!(orders, 0, "点过「到期不续」还是开了 {orders} 张续费单");

    let invoices = common::scalar_i64(
        &pool,
        "SELECT count(*) FROM subscription_invoice WHERE subscription_id=$1",
        &sub_id,
    )
    .await;
    assert_eq!(invoices, 0, "点过「到期不续」还是开了 {invoices} 张发票");

    // 到期这一刻才发 SubscriptionCancelled —— cancel(immediate=false) 当时刻意没发
    assert_eq!(common::outbox_count(&pool, "SubscriptionCancelled", &sub_id).await, 1);
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM subscription WHERE id=$1", &sub_id).await.as_deref(),
        Some("cancelled")
    );
}
