//! /v1/commerce/* · 客户端商业 BFF · commerce v2
//!
//! 鉴权:`AuthedUser`(JWT in Bearer)。所有 query/mutate 自动按 user_id 过滤,
//! 不允许跨用户访问。
//! Webhook 路径 `/v1/webhooks/*` 不需要 JWT,只需要渠道签名。

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use http::HeaderMap;
use serde::Deserialize;
use serde_json::{json, Value as J};
use sqlx::{Column as _, Row, TypeInfo};
use unmei_domain::commerce::adapters::{
    CreatePaymentParam, WebhookEvent,
};
use unmei_domain::commerce::events::DomainEvent;
use unmei_domain::commerce::outbox;
use unmei_domain::AppError;
use uuid::Uuid;

use crate::auth::{ApiError, AuthedUser};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        // 商品 · 半公开(可不登录)
        .route("/v1/products",                            get(list_products))
        .route("/v1/products/:id",                        get(get_product))
        // 订单 · 必须登录
        .route("/v1/orders",                              get(my_orders).post(create_order))
        .route("/v1/orders/:id",                          get(get_my_order))
        .route("/v1/orders/:id/cancel",                   post(cancel_my_order))
        .route("/v1/orders/:id/pay",                      post(pay_my_order))
        .route("/v1/orders/:id/refund",                   post(refund_my_order))
        // 支付查询
        .route("/v1/payments/:id",                        get(get_my_payment))
        // 物流
        .route("/v1/orders/:id/shipments",                get(my_shipments))
        .route("/v1/orders/:id/shipments/:sid/trace",     get(my_shipment_trace))
        // 订阅
        .route("/v1/subscriptions",                       get(my_subscriptions))
        // Webhook
        .route("/v1/webhooks/wechat",                     post(wx_webhook))
        .route("/v1/webhooks/carrier/:provider",          post(carrier_webhook))
}

// ─── 公共辅助 ────────────────────────────────────────────────────
fn map_rows(rows: Vec<sqlx::postgres::PgRow>) -> Vec<J> {
    rows.into_iter().map(|r| {
        let mut o = serde_json::Map::new();
        let cols = r.columns();
        for (i, col) in cols.iter().enumerate() {
            let name = col.name();
            let v = pg_value_to_json(&r, i);
            o.insert(name.to_string(), v);
        }
        J::Object(o)
    }).collect()
}

fn pg_value_to_json(r: &sqlx::postgres::PgRow, i: usize) -> J {
    let cols = r.columns();
    let ti = cols[i].type_info();
    match ti.name() {
        "INT2" | "INT4" => r.try_get::<Option<i32>, _>(i).ok().flatten().map(|x| json!(x)).unwrap_or(J::Null),
        "INT8" => r.try_get::<Option<i64>, _>(i).ok().flatten().map(|x| json!(x)).unwrap_or(J::Null),
        "BOOL" => r.try_get::<Option<bool>, _>(i).ok().flatten().map(|x| json!(x)).unwrap_or(J::Null),
        "FLOAT4" => r.try_get::<Option<f32>, _>(i).ok().flatten().map(|x| json!(x)).unwrap_or(J::Null),
        "FLOAT8" => r.try_get::<Option<f64>, _>(i).ok().flatten().map(|x| json!(x)).unwrap_or(J::Null),
        "TIMESTAMPTZ" => r.try_get::<Option<DateTime<Utc>>, _>(i).ok().flatten().map(|x| json!(x.to_rfc3339())).unwrap_or(J::Null),
        "DATE" => r.try_get::<Option<chrono::NaiveDate>, _>(i).ok().flatten().map(|x| json!(x.to_string())).unwrap_or(J::Null),
        "JSONB" | "JSON" => r.try_get::<Option<J>, _>(i).ok().flatten().unwrap_or(J::Null),
        "TEXT[]" => r.try_get::<Option<Vec<String>>, _>(i).ok().flatten().map(|v| json!(v)).unwrap_or(J::Null),
        _ => r.try_get::<Option<String>, _>(i).ok().flatten().map(|s| json!(s)).unwrap_or(J::Null),
    }
}

fn map_db(e: sqlx::Error) -> ApiError { ApiError(AppError::Internal(format!("db: {e}"))) }

// ─── Catalog ─────────────────────────────────────────────────────
#[derive(Deserialize)]
struct ProductsQ {
    #[serde(default = "default_region")] region: String,
    #[serde(default = "default_platform")] platform: String,
    category: Option<String>,
    kind: Option<String>,
}
fn default_region() -> String { "cn".into() }
fn default_platform() -> String { "web".into() }

async fn list_products(
    State(st): State<AppState>, Query(q): Query<ProductsQ>,
) -> Result<Json<Vec<J>>, ApiError> {
    let rows = sqlx::query(
        r#"SELECT id, code, name, sub_title, category, kind, fulfillment_kind,
                  hero_image_url, tags, description_md
           FROM product
           WHERE status='listed'
             AND $1 = ANY(available_regions)
             AND ($2 = 'all' OR $2 = ANY(available_platforms))
             AND ($3::text IS NULL OR category = $3)
             AND ($4::text IS NULL OR kind = $4)
           ORDER BY sort_weight DESC, created_at DESC"#,
    ).bind(&q.region).bind(&q.platform).bind(&q.category).bind(&q.kind)
     .fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

async fn get_product(
    State(st): State<AppState>, Path(id): Path<String>,
    Query(q): Query<ProductsQ>,
) -> Result<Json<J>, ApiError> {
    let p = sqlx::query("SELECT * FROM product WHERE id=$1 AND status='listed'")
        .bind(&id).fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("product"))?;
    let skus = sqlx::query(
        r#"SELECT s.id, s.code, s.name, s.spec_json, s.stock_kind, s.stock_count,
                  s.per_user_cap, s.default_currency, s.weight_g,
                  pb.price_minor AS current_price_minor,
                  pb.currency    AS current_currency,
                  pb.id          AS price_book_id
           FROM sku s
           LEFT JOIN LATERAL (
              SELECT id, price_minor, currency FROM price_book
              WHERE sku_id = s.id AND status='active'
                AND region IN ($2, 'global')
                AND platform IN ($3, 'all')
                AND effective_from <= NOW()
                AND (effective_to IS NULL OR effective_to > NOW())
              ORDER BY effective_from DESC LIMIT 1
           ) pb ON TRUE
           WHERE s.product_id=$1 AND s.status='active'
           ORDER BY s.created_at"#,
    ).bind(&id).bind(&q.region).bind(&q.platform)
     .fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(json!({
        "product": map_rows(vec![p]).into_iter().next().unwrap_or(J::Null),
        "skus": map_rows(skus),
    })))
}

// ─── Order · create ──────────────────────────────────────────────
#[derive(Deserialize)]
struct CreateOrderBody {
    lines: Vec<CreateLine>,
    #[serde(default = "default_region")] region: String,
    #[serde(default = "default_channel_origin")] channel_origin: String,
    shipping_address: Option<J>,
    contact: Option<J>,
    coupon_codes: Option<Vec<String>>,
    note: Option<String>,
}
fn default_channel_origin() -> String { "web".into() }
#[derive(Deserialize)]
struct CreateLine { sku_id: String, qty: i32 }

async fn create_order(
    State(st): State<AppState>, AuthedUser(claims): AuthedUser,
    Json(body): Json<CreateOrderBody>,
) -> Result<Json<J>, ApiError> {
    if body.lines.is_empty() || body.lines.iter().any(|l| l.qty <= 0) {
        return Err(ApiError::bad("invalid lines"));
    }
    let mut tx = st.db.begin().await.map_err(map_db)?;

    let order_id = format!("ord-{}", Uuid::new_v4());
    let mut subtotal: i64 = 0;
    let mut order_lines: Vec<(String, String, i64, i32, i64, J)> = vec![]; // (line_id, sku_id, unit, qty, line_subtotal, snapshot)

    for (i, l) in body.lines.iter().enumerate() {
        let row = sqlx::query(
            r#"SELECT s.id, s.code, s.name, s.spec_json, s.weight_g,
                      pb.price_minor, pb.currency
               FROM sku s
               LEFT JOIN LATERAL (
                  SELECT price_minor, currency FROM price_book
                  WHERE sku_id = s.id AND status='active'
                    AND effective_from <= NOW()
                    AND (effective_to IS NULL OR effective_to > NOW())
                  ORDER BY effective_from DESC LIMIT 1
               ) pb ON TRUE
               WHERE s.id=$1 AND s.status='active'"#,
        ).bind(&l.sku_id).fetch_optional(&mut *tx).await.map_err(map_db)?;
        let row = row.ok_or_else(|| ApiError::not_found(format!("sku {}", l.sku_id)))?;

        let unit: i64 = row.try_get("price_minor").map_err(|_| ApiError::bad(format!("sku {} 无激活价格", l.sku_id)))?;
        let cur: String = row.try_get("currency").unwrap_or_else(|_| "CNY".into());
        if cur != "CNY" { return Err(ApiError::bad("only CNY supported here")); }

        let line_sub = unit * l.qty as i64;
        subtotal += line_sub;
        let snap = json!({
            "sku_code": row.try_get::<String, _>("code").unwrap_or_default(),
            "sku_name": row.try_get::<String, _>("name").unwrap_or_default(),
            "spec":     row.try_get::<J, _>("spec_json").unwrap_or(J::Null),
            "weight_g": row.try_get::<Option<i32>, _>("weight_g").ok().flatten(),
        });
        order_lines.push((format!("ol-{}", Uuid::new_v4()), l.sku_id.clone(), unit, l.qty, line_sub, snap));
    }

    // 简化:不计 promo / coupon(后续 PromotionService 接通);不计税/运费。
    let total = subtotal;

    sqlx::query(
        r#"INSERT INTO order_record(
              id, user_id, channel_origin, currency,
              amount_subtotal_minor, amount_total_minor,
              status, source_kind, region, ip, ua, expires_at, audit_note
           ) VALUES ($1, $2, $3, 'CNY', $4, $5, 'unpaid', 'one_shot', $6, NULL, NULL,
                     NOW() + INTERVAL '30 minutes', $7)"#,
    ).bind(&order_id).bind(&claims.sub).bind(&body.channel_origin)
     .bind(subtotal).bind(total).bind(&body.region)
     .bind(body.note.clone().unwrap_or_default())
     .execute(&mut *tx).await.map_err(map_db)?;

    for (idx, (lid, sku_id, unit, qty, line_sub, snap)) in order_lines.iter().enumerate() {
        sqlx::query(
            r#"INSERT INTO order_line(
                 id, order_id, line_no, sku_id, sku_snapshot_json,
                 unit_price_minor, qty, line_subtotal_minor, fulfillment_status
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')"#,
        ).bind(lid).bind(&order_id).bind((idx + 1) as i32).bind(sku_id).bind(snap)
         .bind(unit).bind(qty).bind(line_sub)
         .execute(&mut *tx).await.map_err(map_db)?;
    }

    sqlx::query(
        r#"INSERT INTO order_meta(order_id, shipping_address_json, contact_json, extra_json)
           VALUES ($1, $2, $3, '{}'::jsonb)"#,
    ).bind(&order_id).bind(body.shipping_address).bind(body.contact)
     .execute(&mut *tx).await.map_err(map_db)?;

    sqlx::query(
        r#"INSERT INTO order_event(id, order_id, kind, actor_kind, actor_id,
                                   before_status, after_status, meta_json)
           VALUES ($1, $2, 'OrderCreated', 'user', $3, NULL, 'unpaid', '{}'::jsonb)"#,
    ).bind(format!("oe-{}", Uuid::new_v4())).bind(&order_id).bind(&claims.sub)
     .execute(&mut *tx).await.map_err(map_db)?;

    let _ = body.coupon_codes; // TODO PromotionService.redeem
    tx.commit().await.map_err(map_db)?;

    Ok(Json(json!({
        "order_id": order_id,
        "amount_total_minor": total,
        "currency": "CNY",
        "status": "unpaid",
    })))
}

// ─── Order · my list ─────────────────────────────────────────────
#[derive(Deserialize, Default)]
struct MyListQ {
    #[serde(default)] page: i64,
    #[serde(default = "default_size")] size: i64,
    status: Option<String>,
}
fn default_size() -> i64 { 20 }

async fn my_orders(
    State(st): State<AppState>, AuthedUser(c): AuthedUser, Query(q): Query<MyListQ>,
) -> Result<Json<J>, ApiError> {
    let off = q.page * q.size;
    let lim = q.size.clamp(1, 100);
    let rows = sqlx::query(
        r#"SELECT id, channel_origin, currency, amount_total_minor, amount_paid_minor,
                  amount_refunded_minor, status, source_kind, expires_at, paid_at,
                  fulfilled_at, created_at
           FROM order_record
           WHERE user_id=$1 AND ($2::text IS NULL OR status=$2)
           ORDER BY created_at DESC OFFSET $3 LIMIT $4"#,
    ).bind(&c.sub).bind(&q.status).bind(off).bind(lim)
     .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM order_record WHERE user_id=$1 AND ($2::text IS NULL OR status=$2)",
    ).bind(&c.sub).bind(&q.status).fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(json!({ "items": map_rows(rows), "total": total, "page": q.page, "size": q.size })))
}

async fn get_my_order(
    State(st): State<AppState>, AuthedUser(c): AuthedUser, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    let o = sqlx::query("SELECT * FROM order_record WHERE id=$1 AND user_id=$2")
        .bind(&id).bind(&c.sub).fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("order"))?;
    let lines = sqlx::query("SELECT * FROM order_line WHERE order_id=$1 ORDER BY line_no")
        .bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    let payments = sqlx::query(
        "SELECT id, channel, amount_minor, currency, status, paid_at, expires_at, created_at FROM payment WHERE order_id=$1 ORDER BY created_at DESC",
    ).bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    let shipments = sqlx::query(
        "SELECT id, carrier_code, tracking_no, status, picked_up_at, delivered_at FROM shipment WHERE order_id=$1 ORDER BY created_at DESC",
    ).bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(json!({
        "order": map_rows(vec![o]).into_iter().next().unwrap_or(J::Null),
        "lines": map_rows(lines),
        "payments": map_rows(payments),
        "shipments": map_rows(shipments),
    })))
}

#[derive(Deserialize)]
struct CancelBody { #[serde(default = "default_reason")] reason: String }
fn default_reason() -> String { "user_cancel".into() }

async fn cancel_my_order(
    State(st): State<AppState>, AuthedUser(c): AuthedUser, Path(id): Path<String>,
    Json(b): Json<CancelBody>,
) -> Result<Json<J>, ApiError> {
    let mut tx = st.db.begin().await.map_err(map_db)?;
    let cur: Option<String> = sqlx::query_scalar(
        "SELECT status FROM order_record WHERE id=$1 AND user_id=$2 FOR UPDATE",
    ).bind(&id).bind(&c.sub).fetch_optional(&mut *tx).await.map_err(map_db)?;
    let cur = cur.ok_or_else(|| ApiError::not_found("order"))?;
    if !["draft","unpaid"].contains(&cur.as_str()) {
        return Err(ApiError::bad(format!("cannot cancel from {cur}; 已付订单需走退款")));
    }
    sqlx::query(
        "UPDATE order_record SET status='cancelled', cancelled_at=NOW(), cancel_reason=$1, cancel_actor='user' WHERE id=$2",
    ).bind(&b.reason).bind(&id).execute(&mut *tx).await.map_err(map_db)?;
    sqlx::query(
        r#"INSERT INTO order_event(id, order_id, kind, actor_kind, actor_id,
                                   before_status, after_status, meta_json)
           VALUES ($1, $2, 'OrderCancelled', 'user', $3, $4, 'cancelled', $5)"#,
    ).bind(format!("oe-{}", Uuid::new_v4())).bind(&id).bind(&c.sub).bind(&cur)
     .bind(json!({ "reason": b.reason }))
     .execute(&mut *tx).await.map_err(map_db)?;
    outbox::write(&mut *tx, &DomainEvent::OrderCancelled {
        order_id: id.clone(), reason: b.reason.clone(), actor: c.sub.clone(),
        occurred_at: Utc::now(),
    }).await.map_err(|e| ApiError(AppError::Internal(format!("outbox: {e}"))))?;
    tx.commit().await.map_err(map_db)?;
    Ok(Json(json!({ "ok": true, "status": "cancelled" })))
}

// ─── Order · pay ─────────────────────────────────────────────────
#[derive(Deserialize)]
struct PayBody {
    channel: String,            // wechat_jsapi/h5/native/mp
    openid: Option<String>,     // JSAPI/MP 必填
    return_url: Option<String>,
}

async fn pay_my_order(
    State(st): State<AppState>, AuthedUser(c): AuthedUser, Path(id): Path<String>,
    Json(b): Json<PayBody>,
) -> Result<Json<J>, ApiError> {
    let order = sqlx::query(
        "SELECT user_id, status, amount_total_minor, amount_paid_minor, currency FROM order_record WHERE id=$1",
    ).bind(&id).fetch_optional(&st.db).await.map_err(map_db)?
     .ok_or_else(|| ApiError::not_found("order"))?;
    let uid: String = order.try_get("user_id").map_err(map_db)?;
    if uid != c.sub { return Err(ApiError(AppError::Forbidden)); }
    let status: String = order.try_get("status").map_err(map_db)?;
    if status != "unpaid" { return Err(ApiError::bad(format!("status={status} 不可重发起支付"))); }
    let total: i64 = order.try_get("amount_total_minor").map_err(map_db)?;
    let paid: i64 = order.try_get("amount_paid_minor").map_err(map_db)?;
    let due = total - paid;
    let currency: String = order.try_get("currency").map_err(map_db)?;

    let adapter = st.payment_adapters.pick(&b.channel)
        .ok_or_else(|| ApiError::bad(format!("unsupported channel {}", b.channel)))?;

    let payment_id = format!("pay-{}", Uuid::new_v4());
    let expires_at = Utc::now() + chrono::Duration::minutes(30);
    let notify_url = std::env::var("UNMEI_PUBLIC_BASE")
        .unwrap_or_else(|_| "http://localhost:6028".into()) + "/v1/webhooks/wechat";

    sqlx::query(
        r#"INSERT INTO payment(id, order_id, user_id, channel, amount_minor, currency, status,
                               channel_user_ref, expires_at, metadata_json)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, '{}'::jsonb)"#,
    ).bind(&payment_id).bind(&id).bind(&c.sub).bind(&b.channel)
     .bind(due).bind(&currency).bind(&b.openid).bind(expires_at)
     .execute(&st.db).await.map_err(map_db)?;

    let param = CreatePaymentParam {
        payment_id: payment_id.clone(),
        order_id: id.clone(),
        user_id: c.sub.clone(),
        amount_minor: due,
        currency: currency.clone(),
        description: format!("订单 {id}"),
        channel_user_ref: b.openid.clone(),
        return_url: b.return_url.clone(),
        notify_url,
        expires_at,
        metadata: json!({}),
    };
    let outcome = adapter.create_payment(param).await
        .map_err(|e| ApiError(AppError::Internal(format!("adapter: {e}"))))?;

    // 记 attempt
    sqlx::query(
        r#"INSERT INTO payment_attempt(id, payment_id, attempt_no, request_payload_json, response_payload_json)
           VALUES ($1, $2, 1, $3, $4)"#,
    ).bind(format!("pa-{}", Uuid::new_v4())).bind(&payment_id)
     .bind(json!({ "channel": b.channel, "amount": due }))
     .bind(serde_json::to_value(&outcome).map_err(|e| ApiError(AppError::Internal(e.to_string())))?)
     .execute(&st.db).await.map_err(map_db)?;

    Ok(Json(json!({
        "payment_id": payment_id,
        "outcome": outcome,
    })))
}

// ─── Order · refund ─────────────────────────────────────────────
#[derive(Deserialize)]
struct RefundBody {
    payment_id: Option<String>,
    amount_minor: Option<i64>, // 缺省 = 全额
    reason_code: String,
    reason_text: Option<String>,
}

async fn refund_my_order(
    State(st): State<AppState>, AuthedUser(c): AuthedUser, Path(id): Path<String>,
    Json(b): Json<RefundBody>,
) -> Result<Json<J>, ApiError> {
    let order = sqlx::query("SELECT user_id, amount_paid_minor, amount_refunded_minor, currency FROM order_record WHERE id=$1")
        .bind(&id).fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("order"))?;
    if order.try_get::<String, _>("user_id").map_err(map_db)? != c.sub {
        return Err(ApiError(AppError::Forbidden));
    }
    let paid: i64 = order.try_get("amount_paid_minor").map_err(map_db)?;
    let refunded: i64 = order.try_get("amount_refunded_minor").map_err(map_db)?;
    let remaining = paid - refunded;
    let amt = b.amount_minor.unwrap_or(remaining);
    if amt <= 0 || amt > remaining {
        return Err(ApiError::bad(format!("amount {amt} 超出可退余额 {remaining}")));
    }

    let pid = match b.payment_id {
        Some(p) => p,
        None => {
            // 自动选最近一笔成功 payment
            let pp: Option<String> = sqlx::query_scalar(
                "SELECT id FROM payment WHERE order_id=$1 AND status='success' ORDER BY paid_at DESC LIMIT 1",
            ).bind(&id).fetch_optional(&st.db).await.map_err(map_db)?;
            pp.ok_or_else(|| ApiError::bad("无成功支付可退"))?
        }
    };
    let cur: String = order.try_get("currency").map_err(map_db)?;

    let refund_id = format!("rfd-{}", Uuid::new_v4());
    sqlx::query(
        r#"INSERT INTO refund(id, order_id, payment_id, amount_minor, currency, reason_code, reason_text,
                              actor_kind, actor_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'user', $8, 'requested')"#,
    ).bind(&refund_id).bind(&id).bind(&pid).bind(amt).bind(&cur)
     .bind(&b.reason_code).bind(b.reason_text.unwrap_or_default()).bind(&c.sub)
     .execute(&st.db).await.map_err(map_db)?;
    Ok(Json(json!({ "refund_id": refund_id, "status": "requested" })))
}

// ─── Payment query ──────────────────────────────────────────────
async fn get_my_payment(
    State(st): State<AppState>, AuthedUser(c): AuthedUser, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    let p = sqlx::query(
        "SELECT id, order_id, user_id, channel, amount_minor, currency, status,
                channel_txn_id, paid_at, expires_at, failure_code, failure_msg, created_at, updated_at
         FROM payment WHERE id=$1",
    ).bind(&id).fetch_optional(&st.db).await.map_err(map_db)?
     .ok_or_else(|| ApiError::not_found("payment"))?;
    if p.try_get::<String, _>("user_id").map_err(map_db)? != c.sub {
        return Err(ApiError(AppError::Forbidden));
    }
    Ok(Json(map_rows(vec![p]).into_iter().next().unwrap_or(J::Null)))
}

// ─── Shipment ───────────────────────────────────────────────────
async fn my_shipments(
    State(st): State<AppState>, AuthedUser(c): AuthedUser, Path(order_id): Path<String>,
) -> Result<Json<Vec<J>>, ApiError> {
    let exists: Option<String> = sqlx::query_scalar("SELECT user_id FROM order_record WHERE id=$1").bind(&order_id)
        .fetch_optional(&st.db).await.map_err(map_db)?;
    let uid = exists.ok_or_else(|| ApiError::not_found("order"))?;
    if uid != c.sub { return Err(ApiError(AppError::Forbidden)); }
    let rows = sqlx::query(
        r#"SELECT id, carrier_code, tracking_no, status, shipping_method,
                  picked_up_at, delivered_at, created_at
           FROM shipment WHERE order_id=$1 ORDER BY created_at DESC"#,
    ).bind(&order_id).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

async fn my_shipment_trace(
    State(st): State<AppState>, AuthedUser(c): AuthedUser, Path((order_id, sid)): Path<(String, String)>,
) -> Result<Json<J>, ApiError> {
    let row = sqlx::query("SELECT s.*, o.user_id FROM shipment s JOIN order_record o ON o.id=s.order_id WHERE s.id=$1 AND s.order_id=$2")
        .bind(&sid).bind(&order_id).fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("shipment"))?;
    if row.try_get::<String, _>("user_id").map_err(map_db)? != c.sub {
        return Err(ApiError(AppError::Forbidden));
    }
    let trace = sqlx::query("SELECT * FROM shipment_trace_event WHERE shipment_id=$1 ORDER BY event_at DESC")
        .bind(&sid).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(json!({
        "shipment": map_rows(vec![row]).into_iter().next().unwrap_or(J::Null),
        "trace": map_rows(trace),
    })))
}

// ─── Subscription ──────────────────────────────────────────────
async fn my_subscriptions(
    State(st): State<AppState>, AuthedUser(c): AuthedUser,
) -> Result<Json<Vec<J>>, ApiError> {
    let rows = sqlx::query(
        r#"SELECT s.id, s.plan_id, p.name AS plan_name, s.status, s.source_channel,
                  s.current_period_start, s.current_period_end, s.cancel_at_period_end,
                  s.created_at
           FROM subscription s LEFT JOIN plan p ON p.id = s.plan_id
           WHERE s.user_id=$1 ORDER BY s.created_at DESC"#,
    ).bind(&c.sub).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

// ─── Webhooks ──────────────────────────────────────────────────
async fn wx_webhook(
    State(st): State<AppState>, headers: HeaderMap, body: axum::body::Bytes,
) -> Result<Json<J>, ApiError> {
    // 默认 JSAPI adapter 跑回调路径(对 v3 各子模式 verify 行为相同)
    let adapter = st.payment_adapters.wechat_jsapi.clone();
    let ev = adapter.verify_webhook(&headers, body.as_ref()).await
        .map_err(|e| ApiError(AppError::BadRequest(format!("verify: {e}"))))?;
    apply_payment_webhook(&st, "wechat", ev).await?;
    Ok(Json(json!({ "code": "SUCCESS", "message": "OK" })))
}

async fn carrier_webhook(
    State(st): State<AppState>, Path(provider): Path<String>,
    headers: HeaderMap, body: axum::body::Bytes,
) -> Result<Json<J>, ApiError> {
    let adapter = st.carrier_adapters.pick(&provider)
        .ok_or_else(|| ApiError::bad(format!("unknown provider {provider}")))?;
    let ev = adapter.verify_webhook(&headers, body.as_ref()).await
        .map_err(|e| ApiError(AppError::BadRequest(format!("verify: {e}"))))?;
    apply_carrier_webhook(&st, ev).await?;
    Ok(Json(json!({ "ok": true })))
}

async fn apply_payment_webhook(st: &AppState, channel_group: &str, ev: WebhookEvent) -> Result<(), ApiError> {
    use WebhookEvent::*;
    match ev {
        PaymentSucceeded { txn_id, paid_at, .. } => {
            // 幂等 by (channel, channel_event_id) — 这里用 txn_id 作 event_id
            sqlx::query(
                r#"INSERT INTO payment_event(id, payment_id, kind, channel, channel_event_id, payload_json, received_at)
                   SELECT $1, p.id, 'PaymentSucceededByCallback', p.channel, $2, '{}'::jsonb, NOW()
                   FROM payment p WHERE p.channel_txn_id = $2 OR p.id = $2
                   LIMIT 1"#,
            ).bind(format!("pe-{}", Uuid::new_v4())).bind(&txn_id)
             .execute(&st.db).await.map_err(map_db)?;
            sqlx::query(
                "UPDATE payment SET status='success', paid_at=$1, channel_txn_id=COALESCE(channel_txn_id, $2)
                 WHERE (channel_txn_id=$2 OR id=$2) AND status IN ('pending','processing')",
            ).bind(paid_at).bind(&txn_id).execute(&st.db).await.map_err(map_db)?;
            // 同步 order
            sqlx::query(
                r#"UPDATE order_record o SET
                     amount_paid_minor = amount_paid_minor + p.amount_minor,
                     status = CASE WHEN o.amount_paid_minor + p.amount_minor >= o.amount_total_minor
                                   THEN 'paid' ELSE o.status END,
                     paid_at = COALESCE(o.paid_at, NOW())
                   FROM payment p
                   WHERE p.id IN (SELECT id FROM payment WHERE channel_txn_id=$1 OR id=$1)
                     AND p.order_id = o.id"#,
            ).bind(&txn_id).execute(&st.db).await.map_err(map_db)?;
            tracing::info!("payment.success [{channel_group}] txn={txn_id}");
        }
        PaymentFailed { txn_id, code, msg } => {
            sqlx::query(
                "UPDATE payment SET status='failed', failure_code=$1, failure_msg=$2
                 WHERE channel_txn_id=$3 OR id=$3",
            ).bind(&code).bind(&msg).bind(&txn_id).execute(&st.db).await.map_err(map_db)?;
        }
        PaymentExpired { txn_id } => {
            sqlx::query("UPDATE payment SET status='expired' WHERE (channel_txn_id=$1 OR id=$1) AND status IN ('pending','processing')")
                .bind(&txn_id).execute(&st.db).await.map_err(map_db)?;
        }
        RefundSucceeded { refund_id, .. } => {
            sqlx::query("UPDATE refund SET status='success', completed_at=NOW() WHERE channel_refund_id=$1 OR id=$1")
                .bind(&refund_id).execute(&st.db).await.map_err(map_db)?;
        }
        RefundFailed { refund_id, code, msg } => {
            sqlx::query("UPDATE refund SET status='failed', failure_code=$1, failure_msg=$2 WHERE channel_refund_id=$3 OR id=$3")
                .bind(&code).bind(&msg).bind(&refund_id).execute(&st.db).await.map_err(map_db)?;
        }
        _ => {
            tracing::warn!("unhandled webhook event in {channel_group}");
        }
    }
    Ok(())
}

async fn apply_carrier_webhook(
    st: &AppState,
    ev: unmei_domain::commerce::adapters::TraceWebhookEvent,
) -> Result<(), ApiError> {
    // 找 shipment by (carrier_code, tracking_no)
    let row: Option<String> = sqlx::query_scalar(
        "SELECT id FROM shipment WHERE carrier_code=$1 AND tracking_no=$2",
    ).bind(&ev.carrier_code).bind(&ev.tracking_no)
     .fetch_optional(&st.db).await.map_err(map_db)?;
    let sid = row.ok_or_else(|| ApiError::not_found("shipment"))?;
    for e in ev.events {
        sqlx::query(
            r#"INSERT INTO shipment_trace_event(
                 id, shipment_id, event_at, event_kind, location, description,
                 raw_source, raw_event_id, raw_payload_json
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb)
               ON CONFLICT (id) DO NOTHING"#,
        ).bind(format!("ste-{}", Uuid::new_v4())).bind(&sid)
         .bind(e.event_at).bind(&e.kind).bind(&e.location).bind(&e.description)
         .bind("webhook").bind(&e.raw_event_id)
         .execute(&st.db).await.map_err(map_db)?;
        // 推进 shipment.status
        sqlx::query(
            r#"UPDATE shipment SET status = CASE
                 WHEN $1='delivered'          THEN 'delivered'
                 WHEN $1='out_for_delivery'   THEN 'out_for_delivery'
                 WHEN $1='picked_up'          THEN 'picked_up'
                 WHEN $1='exception'          THEN 'exception'
                 WHEN $1='returned'           THEN 'returned'
                 ELSE 'in_transit' END,
               delivered_at = CASE WHEN $1='delivered' THEN NOW() ELSE delivered_at END
               WHERE id=$2"#,
        ).bind(&e.kind).bind(&sid).execute(&st.db).await.map_err(map_db)?;
    }
    Ok(())
}

