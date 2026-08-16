//! /admin/commerce/* · commerce v2 全 10 工作台 routes
//!
//! **写操作一律调 `unmei-app` 的用例层**,与客户端 API 共用同一份实现。
//! 这里只做 HTTP 解析、鉴权、把 [`Actor`] 传进去。
//!
//! 只读的 list / detail 仍是本文件里的直接 sqlx —— 它们与客户端不重叠
//! (客户端按 user_id 过滤,后台按筛选条件),不存在双写。SQL 的去向见 P2。

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as J};
use sqlx::{Column as _, Row};
use unmei_app::{
    catalog as app_catalog, order as app_order, outbox_ops as app_outbox,
    payment as app_payment, promotion as app_promotion, refund as app_refund,
    risk as app_risk, shipment as app_shipment, subscription as app_subscription,
    Actor,
};
use unmei_domain::AppError;

use crate::auth::{Admin, ApiError};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        // ─── catalog ───
        .route("/admin/commerce/products",                          get(list_products))
        .route("/admin/commerce/products/:id",                      get(get_product))
        .route("/admin/commerce/products/:id/skus",                 get(list_skus_for_product))
        .route("/admin/commerce/products/:id/listing",              post(toggle_product_listing))
        .route("/admin/commerce/skus/:id",                          get(get_sku))
        // ─── pricing ───
        .route("/admin/commerce/pricing/:sku_id",                   get(list_prices))
        .route("/admin/commerce/pricing/:sku_id/publish",           post(publish_price))
        .route("/admin/commerce/pricing/expire/:id",                post(expire_price))
        // ─── promotion / coupon ───
        .route("/admin/commerce/promotions",                        get(list_promotions))
        .route("/admin/commerce/promotions/:id",                    get(get_promotion))
        .route("/admin/commerce/promotions/:id/state",              post(update_promotion_state))
        .route("/admin/commerce/coupons",                           get(list_coupons))
        // ─── subscription ───
        .route("/admin/commerce/plans",                             get(list_plans))
        .route("/admin/commerce/subscriptions",                     get(list_subscriptions))
        .route("/admin/commerce/subscriptions/:id/cancel",          post(cancel_subscription))
        // ─── order ───
        .route("/admin/commerce/orders",                            get(list_orders))
        .route("/admin/commerce/orders/:id",                        get(get_order))
        .route("/admin/commerce/orders/:id/cancel",                 post(admin_cancel_order))
        .route("/admin/commerce/orders/:id/annotate",               post(annotate_order))
        // ─── payment ───
        .route("/admin/commerce/payments",                          get(list_payments))
        .route("/admin/commerce/payments/:id",                      get(get_payment))
        .route("/admin/commerce/payments/:id/mark-failed",          post(mark_payment_failed))
        // ─── refund ───
        .route("/admin/commerce/refunds",                           get(list_refunds))
        .route("/admin/commerce/refunds/:id/approve",               post(approve_refund))
        .route("/admin/commerce/refunds/:id/deny",                  post(deny_refund))
        // ─── shipment ───
        .route("/admin/commerce/shipments",                         get(list_shipments))
        .route("/admin/commerce/shipments/:id",                     get(get_shipment))
        .route("/admin/commerce/shipments/:id/assign-tracking",     post(assign_shipment_tracking))
        .route("/admin/commerce/shipments/:id/mark-exception",      post(mark_shipment_exception))
        // ─── reconciliation ───
        .route("/admin/commerce/recon/batches",                     get(list_recon_batches))
        .route("/admin/commerce/recon/batches/:id",                 get(get_recon_batch))
        // ─── risk ───
        .route("/admin/commerce/risk/rules",                        get(list_risk_rules))
        .route("/admin/commerce/risk/rules/:id/state",              post(update_risk_rule_state))
        .route("/admin/commerce/risk/events",                       get(list_risk_events))
        .route("/admin/commerce/risk/cases",                        get(list_risk_cases))
        // ─── finance ───
        .route("/admin/commerce/finance/periods",                   get(list_periods))
        .route("/admin/commerce/finance/entries",                   get(list_journal_entries))
        .route("/admin/commerce/finance/entries/:id",               get(get_journal_entry))
        .route("/admin/commerce/finance/report/:period_id",         get(monthly_report))
        // ─── outbox 事件驾驶舱 ───
        .route("/admin/commerce/outbox",                            get(list_outbox))
        .route("/admin/commerce/outbox/:id",                        get(get_outbox))
        .route("/admin/commerce/outbox/:id/retry",                  post(retry_outbox))
        // ─── kpi 顶部仪表 ───
        .route("/admin/commerce/dashboard",                         get(dashboard_kpi))
        // ─── 6 region cell metadata(给 webadmin 顶部 region 切换器)───
        .route("/admin/regions",                                    get(list_regions))
        .route("/admin/exchange-rates",                             get(list_exchange_rates))
}

async fn list_exchange_rates(
    State(st): State<AppState>, _: Admin,
) -> Result<Json<Vec<J>>, ApiError> {
    let rows = sqlx::query(
        r#"SELECT base_currency, quote_currency, rate_to_base::text AS rate, effective_from
           FROM v_exchange_latest ORDER BY quote_currency"#,
    ).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

// ═══════════════════════════ Master Data(Control Plane)═══════════════════════════
// SPU / plan / account_chart / risk rule template 集中维护,push 到 6 cell

pub fn master_router() -> Router<AppState> {
    Router::new()
        .route("/admin/master/products",       get(master_products))
        .route("/admin/master/plans",          get(master_plans))
        .route("/admin/master/account-chart",  get(master_account_chart))
        .route("/admin/master/risk-templates", get(master_risk_templates))
}

async fn master_products(State(st): State<AppState>, _: Admin) -> Result<Json<Vec<J>>, ApiError> {
    let rows = sqlx::query(
        r#"SELECT id, code, name, sub_title, category, kind, status, fulfillment_kind,
                  available_regions, tags, sort_weight, created_at, updated_at
           FROM product ORDER BY sort_weight DESC, created_at DESC"#,
    ).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

async fn master_plans(State(st): State<AppState>, _: Admin) -> Result<Json<Vec<J>>, ApiError> {
    let rows = sqlx::query(
        r#"SELECT p.id, p.sku_id, p.name, p.billing_period, p.trial_days, p.grace_days,
                  p.cancel_policy, p.prorate_on_upgrade, p.channel_constraints, p.status,
                  p.created_at, p.updated_at, s.code AS sku_code, s.name AS sku_name
           FROM plan p LEFT JOIN sku s ON s.id = p.sku_id
           ORDER BY p.created_at DESC"#,
    ).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

async fn master_account_chart(State(st): State<AppState>, _: Admin) -> Result<Json<Vec<J>>, ApiError> {
    let rows = sqlx::query(
        r#"SELECT code, name, kind, parent_code, currency_constraint, created_at
           FROM account_chart ORDER BY code"#,
    ).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

async fn master_risk_templates(State(st): State<AppState>, _: Admin) -> Result<Json<Vec<J>>, ApiError> {
    // 把所有 region 的 risk_rule 聚合(按 name 去重),作为 template 展示
    let rows = sqlx::query(
        r#"SELECT name, kind, expression, action, priority,
                  array_agg(DISTINCT region) AS deployed_regions,
                  COUNT(*) AS deployed_count
           FROM risk_rule
           WHERE status='active'
           GROUP BY name, kind, expression, action, priority
           ORDER BY priority DESC, name"#,
    ).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

async fn list_regions(
    State(st): State<AppState>, _: Admin,
) -> Result<Json<Vec<J>>, ApiError> {
    let rows = sqlx::query(
        r#"SELECT code, name, primary_currency, primary_locale, tz,
                  jurisdiction, data_residency_required, status,
                  payment_channels, carriers, supported_currencies, supported_locales
           FROM region_registry
           ORDER BY CASE WHEN code='cn' THEN 0 ELSE 1 END, code"#,
    ).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

#[derive(Debug, Deserialize, Default)]
struct OutboxFilter {
    #[serde(default)] page: i64,
    #[serde(default = "default_size")] size: i64,
    status: Option<String>,
    kind: Option<String>,
    aggregate_kind: Option<String>,
    aggregate_id: Option<String>,
    keyword: Option<String>,
    region: Option<String>,
}

async fn list_outbox(
    State(st): State<AppState>, _: Admin, Query(f): Query<OutboxFilter>,
) -> Result<Json<Page<J>>, ApiError> {
    let kw = f.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let region = normalize_region(&f.region);
    let off = f.page * f.size;
    let lim = f.size.clamp(1, 200);
    let rows = sqlx::query(
        r#"SELECT id, kind, aggregate_kind, aggregate_id, status,
                  attempt_count, next_attempt_at, last_error, created_at, region
           FROM outbox_event
           WHERE ($1::text IS NULL OR status=$1)
             AND ($2::text IS NULL OR kind=$2)
             AND ($3::text IS NULL OR aggregate_kind=$3)
             AND ($4::text IS NULL OR aggregate_id=$4)
             AND ($5='' OR id ILIKE $6 OR aggregate_id ILIKE $6 OR kind ILIKE $6)
             AND ($7::text IS NULL OR region=$7)
           ORDER BY created_at DESC OFFSET $8 LIMIT $9"#,
    ).bind(&f.status).bind(&f.kind).bind(&f.aggregate_kind).bind(&f.aggregate_id)
     .bind(&kw).bind(&kw_like).bind(&region).bind(off).bind(lim)
     .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM outbox_event
           WHERE ($1::text IS NULL OR status=$1)
             AND ($2::text IS NULL OR kind=$2)
             AND ($3::text IS NULL OR aggregate_kind=$3)
             AND ($4::text IS NULL OR aggregate_id=$4)
             AND ($5='' OR id ILIKE $6 OR aggregate_id ILIKE $6 OR kind ILIKE $6)
             AND ($7::text IS NULL OR region=$7)"#,
    ).bind(&f.status).bind(&f.kind).bind(&f.aggregate_kind).bind(&f.aggregate_id)
     .bind(&kw).bind(&kw_like).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: f.page, size: f.size }))
}

async fn get_outbox(
    State(st): State<AppState>, _: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    let r = sqlx::query("SELECT * FROM outbox_event WHERE id=$1").bind(&id)
        .fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("event"))?;
    Ok(Json(map_rows(vec![r]).into_iter().next().unwrap_or(J::Null)))
}

async fn retry_outbox(
    State(st): State<AppState>, _admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    app_outbox::retry(&st.db, &id).await?;
    Ok(Json(json!({"ok": true})))
}

// ═══════════════════════════ 共用辅助 ═══════════════════════════

/// 规范化 region filter:
/// - 缺省 / 空 / "global" → None(看全部)
/// - 其它(cn/jp/kr/sea/na/zh_hant)→ Some
/// 这样 webadmin 切到 global 视图自动跨区
fn normalize_region(r: &Option<String>) -> Option<String> {
    match r.as_deref() {
        None | Some("") | Some("global") => None,
        Some(s) => Some(s.to_string()),
    }
}

#[derive(Debug, Deserialize, Default)]
struct Pg {
    #[serde(default)] page: i64,
    #[serde(default = "default_size")] size: i64,
    keyword: Option<String>,
    status: Option<String>,
    from: Option<DateTime<Utc>>,
    to: Option<DateTime<Utc>>,
    region: Option<String>,
    /// IANA timezone (e.g. "Asia/Shanghai" / "America/New_York")。
    /// dashboard 的「今日」按此 tz 算当日零点,绕开 sqlx UTC session 漂移。
    /// 前端由 `Intl.DateTimeFormat().resolvedOptions().timeZone` 取客户端 tz。
    /// 缺省回退 "UTC"(curl 直 hit 时可预测)。
    tz: Option<String>,
}
fn default_size() -> i64 { 50 }
impl Pg {
    fn off(&self) -> i64 { self.page * self.size }
    fn lim(&self) -> i64 { self.size.clamp(1, 200) }
}

#[derive(Serialize)]
struct Page<T> {
    items: Vec<T>,
    total: i64,
    page: i64,
    size: i64,
}

fn map_rows(rows: Vec<sqlx::postgres::PgRow>) -> Vec<J> {
    rows.into_iter().map(|r| {
        let mut o = serde_json::Map::new();
        for (i, col) in r.columns().iter().enumerate() {
            let name = col.name();
            let v = pg_value_to_json(&r, i);
            o.insert(name.to_string(), v);
        }
        J::Object(o)
    }).collect()
}

fn pg_value_to_json(r: &sqlx::postgres::PgRow, i: usize) -> J {
    // 通用兜底:按 type info 走分支;失败回字符串。
    use sqlx::TypeInfo;
    let cols = r.columns();
    let ti = cols[i].type_info();
    let tn = ti.name();
    match tn {
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

// ═══════════════════════════ Catalog ═══════════════════════════

async fn list_products(
    State(st): State<AppState>, _: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let kw = q.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let status = q.status.clone();
    let region = normalize_region(&q.region);
    let off = q.off();
    let lim = q.lim();
    // product 是全局 SPU,按 available_regions 数组判可见性
    let rows = sqlx::query(
        r#"SELECT id, code, name, sub_title, category, kind, status, fulfillment_kind,
                  sort_weight, tags, available_regions, created_at, updated_at
           FROM product
           WHERE ($1='' OR name ILIKE $2 OR code ILIKE $2)
             AND ($3::text IS NULL OR status = $3)
             AND ($4::text IS NULL OR $4 = ANY(available_regions))
           ORDER BY sort_weight DESC, created_at DESC
           OFFSET $5 LIMIT $6"#,
    )
    .bind(&kw).bind(&kw_like).bind(&status).bind(&region).bind(off).bind(lim)
    .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM product
           WHERE ($1='' OR name ILIKE $2 OR code ILIKE $2)
             AND ($3::text IS NULL OR status = $3)
             AND ($4::text IS NULL OR $4 = ANY(available_regions))"#,
    ).bind(&kw).bind(&kw_like).bind(&status).bind(&region)
     .fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: q.page, size: q.size }))
}

async fn get_product(
    State(st): State<AppState>, _: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    let p = sqlx::query("SELECT * FROM product WHERE id=$1").bind(&id)
        .fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("product"))?;
    let skus = sqlx::query(
        r#"SELECT s.*,
                  (SELECT price_minor FROM price_book pb WHERE pb.sku_id=s.id AND pb.status='active'
                    ORDER BY effective_from DESC LIMIT 1) AS current_price_minor,
                  (SELECT currency FROM price_book pb WHERE pb.sku_id=s.id AND pb.status='active'
                    ORDER BY effective_from DESC LIMIT 1) AS current_currency
           FROM sku s WHERE s.product_id=$1 ORDER BY s.created_at"#,
    ).bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    let prod = map_rows(vec![p]).into_iter().next().unwrap_or(J::Null);
    Ok(Json(json!({ "product": prod, "skus": map_rows(skus) })))
}

async fn list_skus_for_product(
    State(st): State<AppState>, _: Admin, Path(id): Path<String>,
) -> Result<Json<Vec<J>>, ApiError> {
    let rows = sqlx::query("SELECT * FROM sku WHERE product_id=$1 ORDER BY created_at").bind(&id)
        .fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

async fn get_sku(
    State(st): State<AppState>, _: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    let s = sqlx::query("SELECT * FROM sku WHERE id=$1").bind(&id)
        .fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("sku"))?;
    Ok(Json(map_rows(vec![s]).into_iter().next().unwrap_or(J::Null)))
}

#[derive(Deserialize)]
struct ToggleListingBody { status: String }

async fn toggle_product_listing(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(body): Json<ToggleListingBody>,
) -> Result<Json<J>, ApiError> {
    let status = app_catalog::set_product_status(
        &st.db, &id, &body.status, &Actor::admin(&admin.0.sub),
    ).await?;
    Ok(Json(json!({"ok":true, "status": status.as_str()})))
}

// ═══════════════════════════ Pricing ═══════════════════════════

async fn list_prices(
    State(st): State<AppState>, _: Admin, Path(sku_id): Path<String>,
) -> Result<Json<Vec<J>>, ApiError> {
    let rows = sqlx::query(
        "SELECT * FROM price_book WHERE sku_id=$1 ORDER BY effective_from DESC",
    ).bind(&sku_id).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

#[derive(Deserialize)]
struct PublishPriceBody {
    currency: String,
    price_minor: i64,
    #[serde(default = "default_region")] region: String,
    #[serde(default = "default_platform")] platform: String,
    effective_from: Option<DateTime<Utc>>,
    audit_note: Option<String>,
}
fn default_region() -> String { "cn".into() }
fn default_platform() -> String { "all".into() }

async fn publish_price(
    State(st): State<AppState>, admin: Admin,
    Path(sku_id): Path<String>, Json(b): Json<PublishPriceBody>,
) -> Result<Json<J>, ApiError> {
    let id = app_catalog::publish_price(&st.db, &sku_id, app_catalog::NewPrice {
        currency: b.currency,
        price_minor: b.price_minor,
        region: b.region,
        platform: b.platform,
        effective_from: b.effective_from,
        audit_note: b.audit_note,
    }, &Actor::admin(&admin.0.sub)).await?;
    Ok(Json(json!({"ok":true, "id":id})))
}

async fn expire_price(
    State(st): State<AppState>, _: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    app_catalog::expire_price(&st.db, &id).await?;
    Ok(Json(json!({"ok":true})))
}

// ═══════════════════════════ Promotion / Coupon ═══════════════════════════

async fn list_promotions(
    State(st): State<AppState>, _: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let kw = q.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let region = normalize_region(&q.region);
    let rows = sqlx::query(
        r#"SELECT id, code, name, kind, effective_from, effective_to, budget_minor, used_minor,
                  per_user_cap, total_cap, daily_cap, status, priority, stackable, created_at, region
           FROM promotion
           WHERE ($1='' OR name ILIKE $2 OR code ILIKE $2)
             AND ($3::text IS NULL OR status = $3)
             AND ($4::text IS NULL OR region = $4)
           ORDER BY status='active' DESC, priority DESC, created_at DESC
           OFFSET $5 LIMIT $6"#,
    ).bind(&kw).bind(&kw_like).bind(&q.status).bind(&region).bind(q.off()).bind(q.lim())
    .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM promotion
           WHERE ($1='' OR name ILIKE $2 OR code ILIKE $2)
             AND ($3::text IS NULL OR status=$3)
             AND ($4::text IS NULL OR region=$4)"#,
    ).bind(&kw).bind(&kw_like).bind(&q.status).bind(&region)
     .fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: q.page, size: q.size }))
}

async fn get_promotion(
    State(st): State<AppState>, _: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    let p = sqlx::query("SELECT * FROM promotion WHERE id=$1").bind(&id)
        .fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("promotion"))?;
    let stats: (i64, i64) = sqlx::query_as(
        r#"SELECT COUNT(*)::int8, COALESCE(SUM(applied_amount_minor),0)::int8
           FROM coupon_redemption cr WHERE cr.coupon_id IN
             (SELECT id FROM coupon WHERE promotion_id=$1)"#,
    ).bind(&id).fetch_one(&st.db).await.unwrap_or((0,0));
    let prod = map_rows(vec![p]).into_iter().next().unwrap_or(J::Null);
    Ok(Json(json!({ "promotion": prod, "redemption_count": stats.0, "redemption_amount_minor": stats.1 })))
}

#[derive(Deserialize)]
struct PromoStateBody { status: String }

async fn update_promotion_state(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<PromoStateBody>,
) -> Result<Json<J>, ApiError> {
    let status = app_promotion::set_status(
        &st.db, &id, &b.status, &Actor::admin(&admin.0.sub),
    ).await?;
    Ok(Json(json!({"ok":true, "status": status.as_str()})))
}

async fn list_coupons(
    State(st): State<AppState>, _: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let kw = q.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let region = normalize_region(&q.region);
    let rows = sqlx::query(
        r#"SELECT c.id, c.code, c.batch_id, c.promotion_id, c.owner_user_id, c.state,
                  c.issued_at, c.redeemed_at, c.expires_at, c.region, p.name AS promotion_name
           FROM coupon c LEFT JOIN promotion p ON p.id = c.promotion_id
           WHERE ($1='' OR c.code ILIKE $2 OR c.owner_user_id = $1)
             AND ($3::text IS NULL OR c.state = $3)
             AND ($4::text IS NULL OR c.region = $4)
           ORDER BY c.issued_at DESC OFFSET $5 LIMIT $6"#,
    ).bind(&kw).bind(&kw_like).bind(&q.status).bind(&region).bind(q.off()).bind(q.lim())
    .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM coupon
           WHERE ($1='' OR code ILIKE $2 OR owner_user_id=$1)
             AND ($3::text IS NULL OR state=$3)
             AND ($4::text IS NULL OR region=$4)"#,
    ).bind(&kw).bind(&kw_like).bind(&q.status).bind(&region)
     .fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: q.page, size: q.size }))
}

// ═══════════════════════════ Subscription ═══════════════════════════

async fn list_plans(
    State(st): State<AppState>, _: Admin,
) -> Result<Json<Vec<J>>, ApiError> {
    let rows = sqlx::query("SELECT * FROM plan ORDER BY status='active' DESC, created_at DESC")
        .fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

async fn list_subscriptions(
    State(st): State<AppState>, _: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let region = normalize_region(&q.region);
    let rows = sqlx::query(
        r#"SELECT s.id, s.user_id, s.plan_id, p.name AS plan_name, s.status, s.source_channel,
                  s.current_period_start, s.current_period_end, s.next_billing_attempt_at,
                  s.cancel_at_period_end, s.created_at, s.region
           FROM subscription s LEFT JOIN plan p ON p.id = s.plan_id
           WHERE ($1::text IS NULL OR s.status = $1)
             AND ($2::text IS NULL OR s.region = $2)
           ORDER BY s.created_at DESC OFFSET $3 LIMIT $4"#,
    ).bind(&q.status).bind(&region).bind(q.off()).bind(q.lim())
    .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM subscription
           WHERE ($1::text IS NULL OR status=$1)
             AND ($2::text IS NULL OR region=$2)"#,
    ).bind(&q.status).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: q.page, size: q.size }))
}

#[derive(Deserialize)]
struct CancelSubBody { immediate: Option<bool>, reason: Option<String> }

async fn cancel_subscription(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<CancelSubBody>,
) -> Result<Json<J>, ApiError> {
    let immediate = b.immediate.unwrap_or(false);
    app_subscription::cancel(
        &st.db, &id, immediate, b.reason.as_deref(), &Actor::admin(&admin.0.sub),
    ).await?;
    Ok(Json(json!({"ok":true, "immediate": immediate})))
}

// ═══════════════════════════ Order ═══════════════════════════

#[derive(Debug, Deserialize, Default)]
struct OrderFilter {
    #[serde(default)] page: i64,
    #[serde(default = "default_size")] size: i64,
    status: Option<String>,
    channel_origin: Option<String>,
    user_id: Option<String>,
    region: Option<String>,
    amount_min_minor: Option<i64>,
    amount_max_minor: Option<i64>,
    from: Option<DateTime<Utc>>,
    to: Option<DateTime<Utc>>,
    keyword: Option<String>,
}

async fn list_orders(
    State(st): State<AppState>, _: Admin, Query(f): Query<OrderFilter>,
) -> Result<Json<Page<J>>, ApiError> {
    let kw = f.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let region = normalize_region(&f.region);
    let off = f.page * f.size;
    let lim = f.size.clamp(1, 200);
    let rows = sqlx::query(
        r#"SELECT id, user_id, channel_origin, currency,
                  amount_total_minor, amount_paid_minor, amount_refunded_minor,
                  status, source_kind, region, expires_at, paid_at, fulfilled_at,
                  cancelled_at, cancel_reason, risk_score, created_at, updated_at
           FROM order_record
           WHERE ($1::text IS NULL OR status = $1)
             AND ($2::text IS NULL OR channel_origin = $2)
             AND ($3::text IS NULL OR user_id = $3)
             AND ($4::text IS NULL OR region = $4)
             AND ($5::int8 IS NULL OR amount_total_minor >= $5)
             AND ($6::int8 IS NULL OR amount_total_minor <= $6)
             AND ($7::timestamptz IS NULL OR created_at >= $7)
             AND ($8::timestamptz IS NULL OR created_at <= $8)
             AND ($9='' OR id ILIKE $10 OR user_id ILIKE $10)
           ORDER BY created_at DESC OFFSET $11 LIMIT $12"#,
    )
    .bind(&f.status).bind(&f.channel_origin).bind(&f.user_id).bind(&region)
    .bind(f.amount_min_minor).bind(f.amount_max_minor)
    .bind(f.from).bind(f.to)
    .bind(&kw).bind(&kw_like).bind(off).bind(lim)
    .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM order_record
           WHERE ($1::text IS NULL OR status=$1)
             AND ($2::text IS NULL OR channel_origin=$2)
             AND ($3::text IS NULL OR user_id=$3)
             AND ($4::text IS NULL OR region=$4)
             AND ($5::int8 IS NULL OR amount_total_minor >= $5)
             AND ($6::int8 IS NULL OR amount_total_minor <= $6)
             AND ($7::timestamptz IS NULL OR created_at >= $7)
             AND ($8::timestamptz IS NULL OR created_at <= $8)
             AND ($9='' OR id ILIKE $10 OR user_id ILIKE $10)"#,
    ).bind(&f.status).bind(&f.channel_origin).bind(&f.user_id).bind(&region)
     .bind(f.amount_min_minor).bind(f.amount_max_minor)
     .bind(f.from).bind(f.to).bind(&kw).bind(&kw_like)
     .fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: f.page, size: f.size }))
}

async fn get_order(
    State(st): State<AppState>, _: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    let o = sqlx::query("SELECT * FROM order_record WHERE id=$1").bind(&id)
        .fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("order"))?;
    let lines = sqlx::query("SELECT * FROM order_line WHERE order_id=$1 ORDER BY line_no")
        .bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    let events = sqlx::query("SELECT * FROM order_event WHERE order_id=$1 ORDER BY created_at DESC LIMIT 50")
        .bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    let payments = sqlx::query("SELECT id, channel, amount_minor, currency, status, paid_at, created_at FROM payment WHERE order_id=$1 ORDER BY created_at DESC")
        .bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    let refunds = sqlx::query("SELECT id, amount_minor, status, reason_code, created_at, completed_at FROM refund WHERE order_id=$1 ORDER BY created_at DESC")
        .bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    let shipments = sqlx::query("SELECT id, carrier_code, tracking_no, status, created_at, delivered_at FROM shipment WHERE order_id=$1 ORDER BY created_at DESC")
        .bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(json!({
        "order": map_rows(vec![o]).into_iter().next().unwrap_or(J::Null),
        "lines": map_rows(lines),
        "events": map_rows(events),
        "payments": map_rows(payments),
        "refunds": map_rows(refunds),
        "shipments": map_rows(shipments),
    })))
}

#[derive(Deserialize)]
struct CancelOrderBody { reason: String }

async fn admin_cancel_order(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<CancelOrderBody>,
) -> Result<Json<J>, ApiError> {
    // owner 传 None → 后台不受归属限制。
    //
    // ⚠ 行为变更:旧实现允许从 `paid` / `fulfilling` 取消,但 domain 状态机的
    // Paid → [Fulfilling, Done, RefundPartial, Refunded, Disputed] 里没有 Cancelled,
    // 客户端路由也明说「已付订单需走退款」。三处语义原本互相打架。
    // 现在统一以状态机为准:已付订单只能走退款,不能直接取消 ——
    // 否则会留下「用户付了钱、订单被取消、没有退款记录」的窟窿。
    app_order::cancel(&st.db, &id, &b.reason, &Actor::admin(&admin.0.sub), None).await?;
    Ok(Json(json!({"ok":true})))
}

#[derive(Deserialize)]
struct AnnotateBody { note: String }

async fn annotate_order(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<AnnotateBody>,
) -> Result<Json<J>, ApiError> {
    app_order::annotate(&st.db, &id, &b.note, &Actor::admin(&admin.0.sub)).await?;
    Ok(Json(json!({"ok":true})))
}

// ═══════════════════════════ Payment ═══════════════════════════

#[derive(Debug, Deserialize, Default)]
struct PaymentFilter {
    #[serde(default)] page: i64,
    #[serde(default = "default_size")] size: i64,
    status: Option<String>,
    channel: Option<String>,
    user_id: Option<String>,
    order_id: Option<String>,
    amount_min_minor: Option<i64>,
    amount_max_minor: Option<i64>,
    from: Option<DateTime<Utc>>,
    to: Option<DateTime<Utc>>,
    keyword: Option<String>,
    region: Option<String>,
}

async fn list_payments(
    State(st): State<AppState>, _: Admin, Query(f): Query<PaymentFilter>,
) -> Result<Json<Page<J>>, ApiError> {
    let kw = f.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let region = normalize_region(&f.region);
    let off = f.page * f.size;
    let lim = f.size.clamp(1, 200);
    let rows = sqlx::query(
        r#"SELECT id, order_id, user_id, channel, amount_minor, currency, status,
                  channel_txn_id, paid_at, expires_at, failure_code, created_at, updated_at, region
           FROM payment
           WHERE ($1::text IS NULL OR status=$1)
             AND ($2::text IS NULL OR channel=$2)
             AND ($3::text IS NULL OR user_id=$3)
             AND ($4::text IS NULL OR order_id=$4)
             AND ($5::int8 IS NULL OR amount_minor >= $5)
             AND ($6::int8 IS NULL OR amount_minor <= $6)
             AND ($7::timestamptz IS NULL OR created_at >= $7)
             AND ($8::timestamptz IS NULL OR created_at <= $8)
             AND ($9='' OR id ILIKE $10 OR channel_txn_id ILIKE $10 OR user_id ILIKE $10)
             AND ($11::text IS NULL OR region=$11)
           ORDER BY created_at DESC OFFSET $12 LIMIT $13"#,
    ).bind(&f.status).bind(&f.channel).bind(&f.user_id).bind(&f.order_id)
     .bind(f.amount_min_minor).bind(f.amount_max_minor)
     .bind(f.from).bind(f.to).bind(&kw).bind(&kw_like).bind(&region).bind(off).bind(lim)
     .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM payment
           WHERE ($1::text IS NULL OR status=$1)
             AND ($2::text IS NULL OR channel=$2)
             AND ($3::text IS NULL OR user_id=$3)
             AND ($4::text IS NULL OR order_id=$4)
             AND ($5::int8 IS NULL OR amount_minor >= $5)
             AND ($6::int8 IS NULL OR amount_minor <= $6)
             AND ($7::timestamptz IS NULL OR created_at >= $7)
             AND ($8::timestamptz IS NULL OR created_at <= $8)
             AND ($9='' OR id ILIKE $10 OR channel_txn_id ILIKE $10 OR user_id ILIKE $10)
             AND ($11::text IS NULL OR region=$11)"#,
    ).bind(&f.status).bind(&f.channel).bind(&f.user_id).bind(&f.order_id)
     .bind(f.amount_min_minor).bind(f.amount_max_minor)
     .bind(f.from).bind(f.to).bind(&kw).bind(&kw_like).bind(&region)
     .fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: f.page, size: f.size }))
}

async fn get_payment(
    State(st): State<AppState>, _: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    let p = sqlx::query("SELECT * FROM payment WHERE id=$1").bind(&id)
        .fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("payment"))?;
    let attempts = sqlx::query("SELECT * FROM payment_attempt WHERE payment_id=$1 ORDER BY attempt_no DESC")
        .bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    let events = sqlx::query("SELECT * FROM payment_event WHERE payment_id=$1 ORDER BY received_at DESC")
        .bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    let refunds = sqlx::query("SELECT id, amount_minor, status, reason_code, created_at FROM refund WHERE payment_id=$1 ORDER BY created_at DESC")
        .bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(json!({
        "payment": map_rows(vec![p]).into_iter().next().unwrap_or(J::Null),
        "attempts": map_rows(attempts),
        "events": map_rows(events),
        "refunds": map_rows(refunds),
    })))
}

#[derive(Deserialize)]
struct MarkFailedBody { code: String, msg: String }

async fn mark_payment_failed(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<MarkFailedBody>,
) -> Result<Json<J>, ApiError> {
    app_payment::mark_failed(
        &st.db, &id, &b.code, &b.msg, &Actor::admin(&admin.0.sub),
    ).await?;
    Ok(Json(json!({"ok":true})))
}

// ═══════════════════════════ Refund ═══════════════════════════

async fn list_refunds(
    State(st): State<AppState>, _: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let region = normalize_region(&q.region);
    let rows = sqlx::query(
        r#"SELECT id, order_id, payment_id, amount_minor, currency, reason_code, reason_text,
                  actor_kind, status, approved_at, completed_at, failure_code, created_at, region
           FROM refund
           WHERE ($1::text IS NULL OR status=$1)
             AND ($2::timestamptz IS NULL OR created_at >= $2)
             AND ($3::timestamptz IS NULL OR created_at <= $3)
             AND ($4::text IS NULL OR region=$4)
           ORDER BY created_at DESC OFFSET $5 LIMIT $6"#,
    ).bind(&q.status).bind(q.from).bind(q.to).bind(&region).bind(q.off()).bind(q.lim())
     .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM refund WHERE ($1::text IS NULL OR status=$1)
           AND ($2::timestamptz IS NULL OR created_at >= $2)
           AND ($3::timestamptz IS NULL OR created_at <= $3)
           AND ($4::text IS NULL OR region=$4)"#,
    ).bind(&q.status).bind(q.from).bind(q.to).bind(&region)
     .fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: q.page, size: q.size }))
}

async fn approve_refund(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    app_refund::approve(&st.db, &id, &Actor::admin(&admin.0.sub)).await?;
    Ok(Json(json!({
        "ok": true,
        "status": "success",
        "note": "已 mock 模式直推到 success,真接入将由 adapter.refund() + webhook 推进"
    })))
}

#[derive(Deserialize)]
struct DenyBody { reason: String }

async fn deny_refund(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<DenyBody>,
) -> Result<Json<J>, ApiError> {
    app_refund::deny(&st.db, &id, &b.reason, &Actor::admin(&admin.0.sub)).await?;
    Ok(Json(json!({"ok":true})))
}

// ═══════════════════════════ Shipment ═══════════════════════════

#[derive(Debug, Deserialize, Default)]
struct ShipmentFilter {
    #[serde(default)] page: i64,
    #[serde(default = "default_size")] size: i64,
    status: Option<String>,
    carrier_code: Option<String>,
    order_id: Option<String>,
    exception_only: Option<bool>,
    keyword: Option<String>,
    region: Option<String>,
}

async fn list_shipments(
    State(st): State<AppState>, _: Admin, Query(f): Query<ShipmentFilter>,
) -> Result<Json<Page<J>>, ApiError> {
    let kw = f.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let region = normalize_region(&f.region);
    let off = f.page * f.size;
    let lim = f.size.clamp(1, 200);
    let exc = f.exception_only.unwrap_or(false);
    let rows = sqlx::query(
        r#"SELECT id, order_id, carrier_code, tracking_no, status, shipping_method,
                  picked_up_at, delivered_at, cost_minor, cost_currency, created_at, updated_at, region
           FROM shipment
           WHERE ($1::text IS NULL OR status=$1)
             AND ($2::text IS NULL OR carrier_code=$2)
             AND ($3::text IS NULL OR order_id=$3)
             AND (NOT $4 OR status IN ('exception','returning'))
             AND ($5='' OR id ILIKE $6 OR tracking_no ILIKE $6 OR order_id ILIKE $6)
             AND ($7::text IS NULL OR region=$7)
           ORDER BY (status='exception') DESC, created_at DESC OFFSET $8 LIMIT $9"#,
    ).bind(&f.status).bind(&f.carrier_code).bind(&f.order_id).bind(exc)
     .bind(&kw).bind(&kw_like).bind(&region).bind(off).bind(lim)
     .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM shipment
           WHERE ($1::text IS NULL OR status=$1)
             AND ($2::text IS NULL OR carrier_code=$2)
             AND ($3::text IS NULL OR order_id=$3)
             AND (NOT $4 OR status IN ('exception','returning'))
             AND ($5='' OR id ILIKE $6 OR tracking_no ILIKE $6 OR order_id ILIKE $6)
             AND ($7::text IS NULL OR region=$7)"#,
    ).bind(&f.status).bind(&f.carrier_code).bind(&f.order_id).bind(exc)
     .bind(&kw).bind(&kw_like).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: f.page, size: f.size }))
}

async fn get_shipment(
    State(st): State<AppState>, _: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    let s = sqlx::query("SELECT * FROM shipment WHERE id=$1").bind(&id)
        .fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("shipment"))?;
    let trace = sqlx::query("SELECT * FROM shipment_trace_event WHERE shipment_id=$1 ORDER BY event_at DESC")
        .bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(json!({
        "shipment": map_rows(vec![s]).into_iter().next().unwrap_or(J::Null),
        "trace": map_rows(trace),
    })))
}

#[derive(Deserialize)]
struct AssignTrackingBody {
    carrier_code: String,
    tracking_no: String,
    shipping_method: Option<String>,
    cost_minor: Option<i64>,
    cost_currency: Option<String>,
}

async fn assign_shipment_tracking(
    State(st): State<AppState>, _admin: Admin, Path(id): Path<String>, Json(b): Json<AssignTrackingBody>,
) -> Result<Json<J>, ApiError> {
    app_shipment::assign_tracking(&st.db, &id, app_shipment::TrackingAssignment {
        carrier_code: b.carrier_code,
        tracking_no: b.tracking_no,
        shipping_method: b.shipping_method,
        cost_minor: b.cost_minor,
        cost_currency: b.cost_currency,
    }).await?;
    Ok(Json(json!({"ok":true})))
}

#[derive(Deserialize)]
struct MarkExceptionBody { reason: String }

async fn mark_shipment_exception(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<MarkExceptionBody>,
) -> Result<Json<J>, ApiError> {
    app_shipment::mark_exception(&st.db, &id, &b.reason, &Actor::admin(&admin.0.sub)).await?;
    Ok(Json(json!({"ok":true})))
}

// ═══════════════════════════ Reconciliation ═══════════════════════════

async fn list_recon_batches(
    State(st): State<AppState>, _: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let region = normalize_region(&q.region);
    let rows = sqlx::query(
        r#"SELECT id, channel, batch_date, source, total_count, total_amount_minor, currency,
                  status, pulled_at, matched_at, resolved_at, region
           FROM recon_batch
           WHERE ($1::text IS NULL OR status=$1)
             AND ($2::text IS NULL OR region=$2)
           ORDER BY batch_date DESC OFFSET $3 LIMIT $4"#,
    ).bind(&q.status).bind(&region).bind(q.off()).bind(q.lim())
     .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM recon_batch
           WHERE ($1::text IS NULL OR status=$1)
             AND ($2::text IS NULL OR region=$2)"#,
    ).bind(&q.status).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: q.page, size: q.size }))
}

async fn get_recon_batch(
    State(st): State<AppState>, _: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    let b = sqlx::query("SELECT * FROM recon_batch WHERE id=$1").bind(&id)
        .fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("batch"))?;
    let recs = sqlx::query("SELECT * FROM recon_record WHERE batch_id=$1 ORDER BY match_state, channel_txn_id")
        .bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(json!({
        "batch": map_rows(vec![b]).into_iter().next().unwrap_or(J::Null),
        "records": map_rows(recs),
    })))
}

// ═══════════════════════════ Risk ═══════════════════════════

async fn list_risk_rules(
    State(st): State<AppState>, _: Admin, Query(q): Query<Pg>,
) -> Result<Json<Vec<J>>, ApiError> {
    let region = normalize_region(&q.region);
    let rows = sqlx::query(
        r#"SELECT * FROM risk_rule
           WHERE ($1::text IS NULL OR region=$1)
           ORDER BY status='active' DESC, priority DESC, name"#,
    ).bind(&region).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

#[derive(Deserialize)]
struct RiskRuleStateBody { status: String }

async fn update_risk_rule_state(
    State(st): State<AppState>, _admin: Admin, Path(id): Path<String>, Json(b): Json<RiskRuleStateBody>,
) -> Result<Json<J>, ApiError> {
    let status = app_risk::set_rule_status(&st.db, &id, &b.status).await?;
    Ok(Json(json!({"ok":true, "status": status.as_str()})))
}

async fn list_risk_events(
    State(st): State<AppState>, _: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let region = normalize_region(&q.region);
    let rows = sqlx::query(
        r#"SELECT * FROM risk_event
           WHERE ($1::text IS NULL OR decided_action=$1)
             AND ($2::text IS NULL OR region=$2)
           ORDER BY decided_at DESC OFFSET $3 LIMIT $4"#,
    ).bind(&q.status).bind(&region).bind(q.off()).bind(q.lim())
     .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM risk_event
           WHERE ($1::text IS NULL OR decided_action=$1)
             AND ($2::text IS NULL OR region=$2)"#,
    ).bind(&q.status).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: q.page, size: q.size }))
}

async fn list_risk_cases(
    State(st): State<AppState>, _: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let region = normalize_region(&q.region);
    let rows = sqlx::query(
        r#"SELECT * FROM risk_case
           WHERE ($1::text IS NULL OR state=$1)
             AND ($2::text IS NULL OR region=$2)
           ORDER BY opened_at DESC OFFSET $3 LIMIT $4"#,
    ).bind(&q.status).bind(&region).bind(q.off()).bind(q.lim())
     .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM risk_case
           WHERE ($1::text IS NULL OR state=$1)
             AND ($2::text IS NULL OR region=$2)"#,
    ).bind(&q.status).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: q.page, size: q.size }))
}

// ═══════════════════════════ Finance ═══════════════════════════

async fn list_periods(
    State(st): State<AppState>, _: Admin,
) -> Result<Json<Vec<J>>, ApiError> {
    let rows = sqlx::query("SELECT * FROM accounting_period ORDER BY year DESC, sub DESC, kind")
        .fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

#[derive(Deserialize, Default)]
struct EntriesQuery {
    period_id: Option<String>,
    business_kind: Option<String>,
    region: Option<String>,
    #[serde(default)] page: i64,
    #[serde(default = "default_size")] size: i64,
}

async fn list_journal_entries(
    State(st): State<AppState>, _: Admin, Query(q): Query<EntriesQuery>,
) -> Result<Json<Page<J>>, ApiError> {
    let region = normalize_region(&q.region);
    let off = q.page * q.size; let lim = q.size.clamp(1, 200);
    let rows = sqlx::query(
        r#"SELECT je.id, je.period_id, je.description, je.posted_at, je.posted_by_kind,
                  je.business_kind, je.business_ref_id, je.status, je.region,
                  COALESCE(SUM(jl.debit_minor), 0) AS total_debit,
                  COALESCE(SUM(jl.credit_minor), 0) AS total_credit
           FROM journal_entry je
           LEFT JOIN journal_line jl ON jl.entry_id = je.id
           WHERE ($1::text IS NULL OR je.period_id=$1)
             AND ($2::text IS NULL OR je.business_kind=$2)
             AND ($3::text IS NULL OR je.region=$3)
           GROUP BY je.id ORDER BY je.posted_at DESC OFFSET $4 LIMIT $5"#,
    ).bind(&q.period_id).bind(&q.business_kind).bind(&region).bind(off).bind(lim)
     .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM journal_entry
           WHERE ($1::text IS NULL OR period_id=$1)
             AND ($2::text IS NULL OR business_kind=$2)
             AND ($3::text IS NULL OR region=$3)"#,
    ).bind(&q.period_id).bind(&q.business_kind).bind(&region)
     .fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: q.page, size: q.size }))
}

async fn get_journal_entry(
    State(st): State<AppState>, _: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    let e = sqlx::query("SELECT * FROM journal_entry WHERE id=$1").bind(&id)
        .fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("entry"))?;
    let lines = sqlx::query(
        r#"SELECT jl.*, ac.name AS account_name, ac.kind AS account_kind
           FROM journal_line jl JOIN account_chart ac ON ac.code = jl.account_code
           WHERE jl.entry_id=$1 ORDER BY jl.line_no"#,
    ).bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(json!({
        "entry": map_rows(vec![e]).into_iter().next().unwrap_or(J::Null),
        "lines": map_rows(lines),
    })))
}

async fn monthly_report(
    State(st): State<AppState>, _: Admin, Path(period_id): Path<String>, Query(q): Query<Pg>,
) -> Result<Json<J>, ApiError> {
    let region = normalize_region(&q.region);
    // 试算平衡:按 account_chart 聚合本期分录(region 过滤)
    let tb = sqlx::query(
        r#"SELECT ac.code, ac.name, ac.kind,
                  COALESCE(SUM(jl.debit_minor),0)::int8 AS debit,
                  COALESCE(SUM(jl.credit_minor),0)::int8 AS credit
           FROM account_chart ac
           LEFT JOIN journal_line jl ON jl.account_code = ac.code
           LEFT JOIN journal_entry je ON je.id = jl.entry_id
             AND je.period_id=$1 AND je.status='posted'
             AND ($2::text IS NULL OR je.region=$2)
           GROUP BY ac.code, ac.name, ac.kind
           ORDER BY ac.code"#,
    ).bind(&period_id).bind(&region).fetch_all(&st.db).await.map_err(map_db)?;

    // 收入 / 退款 / 物流毛利 各 KPI
    let kpi: (i64, i64, i64, i64) = sqlx::query_as(
        r#"SELECT
            COALESCE(SUM(CASE WHEN ac.code IN ('4001','4002','4003') THEN jl.credit_minor - jl.debit_minor END), 0)::int8 AS revenue,
            COALESCE(SUM(CASE WHEN ac.code = '5003' THEN jl.debit_minor - jl.credit_minor END), 0)::int8 AS refund,
            COALESCE(SUM(CASE WHEN ac.code = '4002' THEN jl.credit_minor - jl.debit_minor END), 0)::int8 AS shipping_revenue,
            COALESCE(SUM(CASE WHEN ac.code = '5002' THEN jl.debit_minor - jl.credit_minor END), 0)::int8 AS shipping_cost
          FROM journal_entry je JOIN journal_line jl ON jl.entry_id=je.id
            JOIN account_chart ac ON ac.code = jl.account_code
          WHERE je.period_id=$1 AND je.status='posted'
            AND ($2::text IS NULL OR je.region=$2)"#,
    ).bind(&period_id).bind(&region).fetch_one(&st.db).await.unwrap_or((0,0,0,0));

    Ok(Json(json!({
        "period_id": period_id,
        "kpi": {
            "revenue_minor": kpi.0,
            "refund_minor": kpi.1,
            "shipping_revenue_minor": kpi.2,
            "shipping_cost_minor": kpi.3,
            "shipping_margin_minor": kpi.2 - kpi.3,
        },
        "trial_balance": map_rows(tb),
    })))
}

// ═══════════════════════════ Dashboard KPI ═══════════════════════════

async fn dashboard_kpi(
    State(st): State<AppState>, _: Admin, Query(q): Query<Pg>,
) -> Result<Json<J>, ApiError> {
    let region = normalize_region(&q.region);
    // 「今日」按客户端 tz 算 — 前端传 IANA tz,缺省 UTC。
    // `date_trunc('day', NOW() AT TIME ZONE $tz) AT TIME ZONE $tz` 双转模式:
    //   内层 → 把 timestamptz 转成 tz 当地的 naive timestamp
    //   date_trunc → 取当地零点
    //   外层 → 把当地零点 naive 再转回 timestamptz(UTC instant)
    // 与 paid_at (timestamptz) 比较时无 session-tz 漂移。
    let tz = q.tz.as_deref().filter(|s| !s.is_empty()).unwrap_or("UTC");
    // 本币营收(单 region 时是该币种;global 时跨币种 sum 不直观)
    let today_revenue: i64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(amount_minor),0)::int8 FROM payment
           WHERE status='success'
             AND paid_at >= (date_trunc('day', NOW() AT TIME ZONE $2) AT TIME ZONE $2)
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).bind(tz).fetch_one(&st.db).await.unwrap_or(0);
    // 集团等值(USD cent · 用 v_exchange_latest 按 currency 折算)· global 视图主指标
    let today_revenue_usd_cent: i64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(
             p.amount_minor::numeric
             * COALESCE(x.rate_to_base, 1)
             * CASE WHEN p.currency IN ('JPY','KRW','TWD') THEN 100 ELSE 1 END
           ),0)::int8
           FROM payment p
           LEFT JOIN v_exchange_latest x ON x.quote_currency = p.currency
           WHERE p.status='success'
             AND p.paid_at >= (date_trunc('day', NOW() AT TIME ZONE $2) AT TIME ZONE $2)
             AND ($1::text IS NULL OR p.region=$1)"#,
    ).bind(&region).bind(tz).fetch_one(&st.db).await.unwrap_or(0);
    let today_orders: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM order_record
           WHERE created_at >= (date_trunc('day', NOW() AT TIME ZONE $2) AT TIME ZONE $2)
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).bind(tz).fetch_one(&st.db).await.unwrap_or(0);
    let pending_payments: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM payment WHERE status='pending' AND expires_at > NOW()
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.unwrap_or(0);
    let unpaid_orders: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM order_record WHERE status='unpaid' AND expires_at > NOW()
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.unwrap_or(0);
    let pending_refunds: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM refund WHERE status IN ('requested','approved','processing')
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.unwrap_or(0);
    let exception_shipments: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM shipment WHERE status IN ('exception','returning')
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.unwrap_or(0);
    let active_subs: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM subscription WHERE status IN ('active','trialing')
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.unwrap_or(0);
    let active_promos: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM promotion WHERE status='active'
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.unwrap_or(0);
    let open_risk_cases: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM risk_case WHERE state IN ('open','investigating')
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.unwrap_or(0);
    // product 是全局 SPU,按 available_regions 包含 region 判可见
    let listed_products: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM product WHERE status='listed'
             AND ($1::text IS NULL OR $1 = ANY(available_regions))"#,
    ).bind(&region).fetch_one(&st.db).await.unwrap_or(0);
    Ok(Json(json!({
        "today_revenue_minor": today_revenue,
        "today_revenue_usd_cent": today_revenue_usd_cent,
        "today_orders": today_orders,
        "pending_payments": pending_payments,
        "unpaid_orders": unpaid_orders,
        "pending_refunds": pending_refunds,
        "exception_shipments": exception_shipments,
        "active_subscriptions": active_subs,
        "active_promotions": active_promos,
        "open_risk_cases": open_risk_cases,
        "listed_products": listed_products,
        "region": region,
    })))
}

// ═══════════════════════════ Error helpers ═══════════════════════════
fn map_db(e: sqlx::Error) -> ApiError { ApiError(AppError::Internal(format!("db: {e}"))) }
