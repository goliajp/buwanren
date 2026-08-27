//! 履约推进用例 · 对真库。
//!
//! 这两个入口是 outbox handler,重试是设计内行为 —— 所以每条测试的核心手法
//! 都是「跑两遍,断言效果只发生一遍」。

mod common;

use serde_json::json;
use unmei_app::fulfillment::{self, FulfillmentOutcome};
use unmei_app::{order, payment, report};

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

// ═══════════════════════════ 报告路径 ═══════════════════════════
//
// ¥199 的报告在这之前跟 instant 走同一支:付完钱直接标 done,
// `fulfillment_ref` 写 `{"mocked": true}` —— 订单显示「已完成」,
// 而买家手上什么都没有。这几条钉住的是「拿得到」。

/// 建一个 async_compute 类商品的已付订单。返回 (order_id, line_id, user_id)
async fn paid_report_order(pool: &sqlx::PgPool) -> (String, String, String) {
    let user = common::user(pool).await;
    let sku = common::sku_with_price(pool, "CNY", 19900).await;
    sqlx::query(
        "UPDATE product SET fulfillment_kind='async_compute'
         WHERE id = (SELECT product_id FROM sku WHERE id=$1)",
    )
    .bind(&sku)
    .execute(pool)
    .await
    .expect("set async_compute kind");

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
    .expect("create");
    let pending = payment::start(pool, &created.order_id, &user, "wechat_jsapi", None)
        .await.expect("start");
    payment::apply_succeeded(pool, &pending.payment_id, None, chrono::Utc::now())
        .await.expect("pay");
    let line: String = sqlx::query_scalar("SELECT id FROM order_line WHERE order_id=$1")
        .bind(&created.order_id).fetch_one(pool).await.expect("line");
    (created.order_id, line, user)
}

/// 给这个人建一份【算好了盘的】本命。返回 natal_id
async fn natal_with_chart(pool: &sqlx::PgPool, user: &str) -> String {
    let id = common::uniq("n");
    sqlx::query(
        "INSERT INTO natal (id,user_id,label,year,month,day,hour,minute,tz,gender,
                            true_solar_time,subject_type,is_default)
         VALUES ($1,$2,'我',1998,3,5,14,30,8.0,'F',FALSE,'person',TRUE)",
    ).bind(&id).bind(user).execute(pool).await.expect("natal");
    sqlx::query(
        "INSERT INTO natal_summary (natal_id,day_master,strength_level,strength_score,
             primary_yongshen,primary_role,secondary_yongshen,avoid_wuxing,
             pattern_name,friendly_hint,raw_chart,mingli_version)
         VALUES ($1,'辛金','偏弱',36,'土','印星','金','[\"火\",\"木\"]'::jsonb,
                 '正财格','', $2, 'mingli-test')",
    ).bind(&id)
     .bind(json!({"day_master": "辛", "day": {"ganzhi": "辛亥"}}))
     .execute(pool).await.expect("summary");
    id
}

async fn report_of(pool: &sqlx::PgPool, line_id: &str) -> Option<(String, String)> {
    sqlx::query_as("SELECT id, status FROM report WHERE order_line_id=$1")
        .bind(line_id).fetch_optional(pool).await.expect("report")
}

#[tokio::test]
async fn report_without_natal_waits_instead_of_claiming_done() {
    let pool = db_or_skip!();
    let (order_id, line_id, _user) = paid_report_order(&pool).await;

    let outcome = fulfillment::apply_order_paid(&pool, &order_id).await.expect("fulfill");

    // ★ 这一条是这一轮的要害:生辰还没填,这一单【就是没完成】。
    //   标 done 的话它会从「我买过的」里以完成态消失,而买家什么都没拿到。
    assert!(matches!(outcome, FulfillmentOutcome::Fulfilling { .. }),
            "还差生辰的单子不该翻 done：{outcome:?}");
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("fulfilling"));
    let (_, status) = report_of(&pool, &line_id).await.expect("册子该立起来了");
    assert_eq!(status, "awaiting_natal");
}

#[tokio::test]
async fn report_with_natal_is_ready_at_once() {
    let pool = db_or_skip!();
    let (order_id, line_id, user) = paid_report_order(&pool).await;
    natal_with_chart(&pool, &user).await;

    let outcome = fulfillment::apply_order_paid(&pool, &order_id).await.expect("fulfill");
    assert_eq!(outcome, FulfillmentOutcome::Done);
    let (_, status) = report_of(&pool, &line_id).await.expect("册子");
    assert_eq!(status, "ready");
    // 盘要真冻进去 —— 只记一行 ready 而不存盘的话,本命一改这一册就变了
    let 有盘: bool = sqlx::query_scalar("SELECT chart_json IS NOT NULL FROM report WHERE order_line_id=$1")
        .bind(&line_id).fetch_one(&pool).await.expect("chart");
    assert!(有盘, "出好的册子里必须有那一刻的盘");
}

#[tokio::test]
async fn filling_the_birth_time_finishes_the_order() {
    let pool = db_or_skip!();
    let (order_id, line_id, user) = paid_report_order(&pool).await;
    fulfillment::apply_order_paid(&pool, &order_id).await.expect("fulfill");

    let natal = natal_with_chart(&pool, &user).await;
    let lines = report::fill_awaiting(&pool, &user, &natal).await.expect("fill");
    assert_eq!(lines, vec![line_id.clone()]);
    for l in &lines {
        fulfillment::apply_report_ready(&pool, l).await.expect("推进");
    }

    let (_, status) = report_of(&pool, &line_id).await.expect("册子");
    assert_eq!(status, "ready");
    // 册子出了,订单也得跟着走完 —— 停在 fulfilling 的话买家看到的还是「进行中」
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("done"));
    assert_eq!(common::outbox_count(&pool, "OrderFulfilled", &order_id).await, 1);
}

#[tokio::test]
async fn retrying_fulfillment_does_not_mint_a_second_report() {
    let pool = db_or_skip!();
    let (order_id, line_id, user) = paid_report_order(&pool).await;
    natal_with_chart(&pool, &user).await;

    fulfillment::apply_order_paid(&pool, &order_id).await.expect("fulfill");
    let 第一册 = report_of(&pool, &line_id).await.expect("册子").0;

    // 履约由 outbox 驱动,重试是设计内行为。第二册意味着买家读到的那一册
    // 可能在他眼前被换掉
    sqlx::query("UPDATE order_line SET fulfillment_status='pending' WHERE id=$1")
        .bind(&line_id).execute(&pool).await.expect("rewind");
    sqlx::query("UPDATE order_record SET status='paid' WHERE id=$1")
        .bind(&order_id).execute(&pool).await.expect("rewind order");
    fulfillment::apply_order_paid(&pool, &order_id).await.expect("retry");

    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM report WHERE order_line_id=$1")
        .bind(&line_id).fetch_one(&pool).await.expect("count");
    assert_eq!(n, 1, "重试不该出第二册");
    assert_eq!(report_of(&pool, &line_id).await.expect("册子").0, 第一册, "也不该换一册");
}

#[tokio::test]
async fn a_report_only_fills_for_its_own_owner() {
    let pool = db_or_skip!();
    let (order_id, line_id, _user) = paid_report_order(&pool).await;
    fulfillment::apply_order_paid(&pool, &order_id).await.expect("fulfill");

    // 另一个人填了自己的生辰 —— 不该把别人等着的册子填掉
    let 别人 = common::user(&pool).await;
    let 他的 = natal_with_chart(&pool, &别人).await;
    let lines = report::fill_awaiting(&pool, &别人, &他的).await.expect("fill");
    assert!(lines.is_empty(), "别人的生辰不该补出我的册子：{lines:?}");
    assert_eq!(report_of(&pool, &line_id).await.expect("册子").1, "awaiting_natal");
}
