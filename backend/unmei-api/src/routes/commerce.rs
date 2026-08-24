//! /v1/commerce/* · 客户端商业 BFF · commerce v2
//!
//! 鉴权:`AuthedUser`(JWT in Bearer)。所有 query/mutate 自动按 user_id 过滤,
//! 不允许跨用户访问。
//! Webhook 路径 `/v1/webhooks/*` 不需要 JWT,只需要渠道签名。

use axum::{
    extract::{Path, Query, State},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use http::HeaderMap;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as J};
use sqlx::{Column as _, Row, TypeInfo};
use unmei_app::{
    order as app_order, payment as app_payment, refund as app_refund, shipment as app_shipment,
    Actor,
};
use unmei_domain::commerce::adapters::{CreatePaymentParam, WebhookEvent, WebhookHeaders};
use unmei_domain::AppError;

use crate::idem;

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

fn map_db(e: sqlx::Error) -> ApiError { ApiError(AppError::Infra(format!("db: {e}"))) }

// ─── Catalog ─────────────────────────────────────────────────────
#[derive(Deserialize)]
struct ProductsQ {
    #[serde(default = "default_region")] region: String,
    #[serde(default = "default_platform")] platform: String,
    category: Option<String>,
    kind: Option<String>,
    /// 按不完人筛。绑定在 **sku** 上（`sku.villager_id`），不在 product 上 ——
    /// 一件御守商品对应一位不完人，而村里 40 位里只有 4 位有御守在卖。
    /// 「他的御守还没上架」是真话，客户端要照实说，不能拿别人的顶上。
    villager_id: Option<String>,
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
             AND ($5::text IS NULL OR EXISTS (
                   SELECT 1 FROM sku s
                   WHERE s.product_id = product.id
                     AND s.status = 'active'
                     AND s.villager_id = $5))
           ORDER BY sort_weight DESC, created_at DESC"#,
    ).bind(&q.region).bind(&q.platform).bind(&q.category).bind(&q.kind).bind(&q.villager_id)
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
#[derive(Deserialize, Serialize)]
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
#[derive(Deserialize, Serialize)]
struct CreateLine { sku_id: String, qty: i32 }

async fn create_order(
    State(st): State<AppState>, AuthedUser(claims): AuthedUser,
    headers: HeaderMap,
    Json(body): Json<CreateOrderBody>,
) -> Result<Response, ApiError> {
    // 幂等键(D6):同键同参返回首次结果。连按两次「下单」不会建出两张单。
    let fp_body = serde_json::to_value(&body).unwrap_or(json!({}));
    let guard = match idem::begin_required(&st, &headers, Some(&claims.sub), "/v1/orders", &fp_body).await? {
        idem::Begin::Replay(resp) => return Ok(resp),
        idem::Begin::Proceed(g) => g,
    };

    let out = create_order_inner(&st, claims, &headers, body).await;
    guard.settle(&st, &out).await;
    out.map(IntoResponse::into_response)
}

async fn create_order_inner(
    st: &AppState, claims: crate::auth::Claims, headers: &HeaderMap, body: CreateOrderBody,
) -> Result<Json<J>, ApiError> {
    let created = app_order::create(&st.db, app_order::NewOrder {
        user_id: claims.sub,
        region: body.region,
        channel_origin: body.channel_origin,
        lines: body.lines.into_iter()
            .map(|l| app_order::NewOrderLine { sku_id: l.sku_id, qty: l.qty })
            .collect(),
        shipping_address: body.shipping_address,
        contact: body.contact,
        coupon_codes: body.coupon_codes.unwrap_or_default(),
        note: body.note,
        // 旧实现这两列一直写 NULL,风控拿不到来源。JWT 里没有,只能从请求头取。
        ip: client_ip(headers),
        ua: headers.get(http::header::USER_AGENT)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string),
    }).await?;

    Ok(Json(json!({
        "order_id": created.order_id,
        "amount_total_minor": created.amount_total_minor,
        "currency": created.currency,
        "status": created.status,
    })))
}

/// 从反代头里取客户端 IP。Cloudflare 在前,优先信 `CF-Connecting-IP`,
/// 其次 `X-Forwarded-For` 的第一跳。都没有就是直连,拿不到就写 NULL。
fn client_ip(headers: &HeaderMap) -> Option<String> {
    headers.get("cf-connecting-ip")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string)
        .or_else(|| {
            headers.get(http::header::FORWARDED)
                .or_else(|| headers.get("x-forwarded-for"))
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.split(',').next())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        })
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
    // owner 传 Some(...) → 用例层同时做归属校验,非属主一律 404
    app_order::cancel(&st.db, &id, &b.reason, &Actor::user(&c.sub), Some(&c.sub)).await?;
    Ok(Json(json!({ "ok": true, "status": "cancelled" })))
}

// ─── Order · pay ─────────────────────────────────────────────────
#[derive(Deserialize, Serialize)]
struct PayBody {
    channel: String,            // wechat_jsapi/h5/native/mp
    openid: Option<String>,     // JSAPI/MP 必填
    return_url: Option<String>,
}

async fn pay_my_order(
    State(st): State<AppState>, AuthedUser(c): AuthedUser, Path(id): Path<String>,
    headers: HeaderMap,
    Json(b): Json<PayBody>,
) -> Result<Response, ApiError> {
    // 幂等键(D6)。这一处是那个实测漏洞的现场:连按两次「支付」,
    // 产生两笔各自成功的支付,应付 19900 实付 39800。
    // 路径带上订单 id —— 同一个键用在两张单上没有意义,该被当成参数不同拒掉。
    let fp_body = serde_json::to_value(&b).unwrap_or(json!({}));
    let path = format!("/v1/orders/{id}/pay");
    let guard = match idem::begin_required(&st, &headers, Some(&c.sub), &path, &fp_body).await? {
        idem::Begin::Replay(resp) => return Ok(resp),
        idem::Begin::Proceed(g) => g,
    };
    let out = pay_my_order_inner(&st, &c.sub, &id, b).await;
    guard.settle(&st, &out).await;
    out.map(IntoResponse::into_response)
}

async fn pay_my_order_inner(
    st: &AppState, user: &str, id: &str, b: PayBody,
) -> Result<Json<J>, ApiError> {
    let (c_sub, id) = (user, id.to_string());
    let id = &id;
    // adapter 的挑选是 binary 自己的事(registry 在 AppState 里),
    // 所以先让用例层占位落库,再拿着 PendingPayment 去调渠道。
    let adapter = st.payment_adapters.pick(&b.channel)
        .ok_or_else(|| ApiError::bad(format!("unsupported channel {}", b.channel)))?;

    let pending = app_payment::start(
        &st.db, id, c_sub, &b.channel, b.openid.as_deref(),
    ).await?;

    let notify_url = std::env::var("UNMEI_PUBLIC_BASE")
        .unwrap_or_else(|_| "http://localhost:6028".into()) + "/v1/webhooks/wechat";

    let outcome = adapter.create_payment(CreatePaymentParam {
        payment_id: pending.payment_id.clone(),
        order_id: pending.order_id.clone(),
        user_id: pending.user_id.clone(),
        amount_minor: pending.amount_minor,
        currency: pending.currency.clone(),
        description: format!("订单 {id}"),
        channel_user_ref: b.openid.clone(),
        return_url: b.return_url.clone(),
        notify_url,
        expires_at: pending.expires_at,
        metadata: json!({}),
    }).await.map_err(|e| ApiError(AppError::Internal(format!("adapter: {e}"))))?;

    app_payment::record_attempt(
        &st.db,
        &pending.payment_id,
        json!({ "channel": b.channel, "amount": pending.amount_minor }),
        serde_json::to_value(&outcome)?,
    ).await?;

    Ok(Json(json!({
        "payment_id": pending.payment_id,
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
    let refund_id = app_refund::request(
        &st.db, &id, &c.sub,
        b.payment_id, b.amount_minor,
        &b.reason_code, b.reason_text.as_deref(),
    ).await?;
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
    let ev = adapter.verify_webhook(&to_webhook_headers(&headers), body.as_ref()).await
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
    let ev = adapter.verify_webhook(&to_webhook_headers(&headers), body.as_ref()).await
        .map_err(|e| ApiError(AppError::BadRequest(format!("verify: {e}"))))?;
    apply_carrier_webhook(&st, ev).await?;
    Ok(Json(json!({ "ok": true })))
}

async fn apply_payment_webhook(
    st: &AppState, channel_group: &str, ev: WebhookEvent,
) -> Result<(), ApiError> {
    use WebhookEvent::*;
    match ev {
        PaymentSucceeded { our_ref, channel_txn_id, paid_at, .. } => {
            app_payment::apply_succeeded(&st.db, &our_ref, channel_txn_id.as_deref(), paid_at).await?
        }
        PaymentFailed { our_ref, code, msg } => {
            app_payment::apply_failed(&st.db, &our_ref, &code, &msg).await?
        }
        PaymentExpired { our_ref } => app_payment::apply_expired(&st.db, &our_ref).await?,
        RefundSucceeded { refund_id, .. } => {
            app_refund::apply_succeeded(&st.db, &refund_id).await?
        }
        RefundFailed { refund_id, code, msg } => {
            app_refund::apply_failed(&st.db, &refund_id, &code, &msg).await?
        }
        other => {
            tracing::warn!(channel_group, event = ?other, "未处理的渠道回调事件");
        }
    }
    Ok(())
}

async fn apply_carrier_webhook(
    st: &AppState,
    ev: unmei_domain::commerce::adapters::TraceWebhookEvent,
) -> Result<(), ApiError> {
    app_shipment::apply_trace_webhook(&st.db, ev).await?;
    Ok(())
}


/// axum 的 `HeaderMap` → domain 的传输中立 [`WebhookHeaders`]。
///
/// 端口不该认识具体 HTTP 库,转换就发生在这条边界上。
/// 非 UTF-8 的头直接跳过 —— 验签用得到的头(微信 v3 的 signature /
/// timestamp / nonce / serial)全是 ASCII。
fn to_webhook_headers(h: &HeaderMap) -> WebhookHeaders {
    h.iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|v| (k.as_str(), v)))
        .collect()
}
