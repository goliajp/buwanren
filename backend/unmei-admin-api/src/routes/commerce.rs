//! /admin/commerce/* · commerce v2 全 10 工作台 routes
//!
//! **写操作一律调 `unmei-app` 的用例层**,与客户端 API 共用同一份实现。
//! 这里只做 HTTP 解析、鉴权、把 [`Actor`] 传进去。
//!
//! 只读的 list / detail 仍是本文件里的直接 sqlx —— 它们与客户端不重叠
//! (客户端按 user_id 过滤，后台按筛选条件),不存在双写。SQL 的去向见 P2。

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
    catalog as app_catalog, coupon as app_coupon, finance as app_finance,
    order as app_order, outbox_ops as app_outbox, recon as app_recon,
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
        .route("/admin/commerce/coupons",                           get(list_coupons).post(issue_coupon))
        .route("/admin/commerce/coupons/batch",                     post(issue_coupon_batch))
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
        .route("/admin/commerce/recon/records/:id/resolve",         post(resolve_recon_record))
        // ─── risk ───
        .route("/admin/commerce/risk/rules",                        get(list_risk_rules))
        .route("/admin/commerce/risk/rules/:id/state",              post(update_risk_rule_state))
        .route("/admin/commerce/risk/events",                       get(list_risk_events))
        .route("/admin/commerce/risk/cases",                        get(list_risk_cases))
        .route("/admin/commerce/risk/cases/:id/state",              post(close_risk_case))
        // ─── finance ───
        .route("/admin/commerce/finance/periods",                   get(list_periods))
        .route("/admin/commerce/finance/periods/:id/close",         post(close_period))
        .route("/admin/commerce/finance/entries",                   get(list_journal_entries))
        .route("/admin/commerce/finance/entries/:id",               get(get_journal_entry))
        .route("/admin/commerce/finance/report/:period_id",         get(monthly_report))
        // ─── outbox 事件驾驶舱 ───
        .route("/admin/commerce/outbox",                            get(list_outbox))
        .route("/admin/commerce/outbox/:id",                        get(get_outbox))
        .route("/admin/commerce/outbox/:id/retry",                  post(retry_outbox))
        // ─── kpi 顶部仪表 ───
        .route("/admin/commerce/dashboard",                         get(dashboard_kpi))
        .route("/admin/commerce/audit",                             get(list_audit))
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
// SPU / plan / account_chart / risk rule template 集中维护，push 到 6 cell

pub fn master_router() -> Router<AppState> {
    Router::new()
        .route("/admin/master/products",       get(master_products))
        .route("/admin/master/plans",          get(master_plans))
        .route("/admin/master/account-chart",  get(master_account_chart))
        .route("/admin/master/risk-templates", get(master_risk_templates))
}

/* 【主数据是全局的，所以只给不限区的人】（2026-09-06 三路验证 · 运营那一路）。
   这四条原先的签名是 `_: Admin` —— 没有角色、没有区域。实测阿港（只管繁中）
   从这里拿到 13,904 个商品，而他自己那一格只有 4 个；另外还有全量会计科目表
   与风控模板（含每条规则部署在哪些区）。

   判据不是「谁需要」，是【这一页给的东西本身没有区】：SPU 目录、订阅套餐、
   会计科目、风控模板，四张表要么没有 region 列、要么是跨区聚合。
   给一位分区管理员看它，等于让他看别人那几格 —— 而他从这里看不出
   哪一行归他。所以这一页归不限区的人，跟「操作记录」那一挡同一个理由
   （`audit_log` 没有 region 列，一页看不到比一页看到别人的东西好）。

   落成一个函数，四条共用 —— 四条各写一遍的话，下次加第五条会忘。 */
fn 主数据归谁看(a: &Admin) -> Result<(), ApiError> {
    let scope = &a.0.region_scope;
    if scope.is_empty() || scope.iter().any(|s| s == "global") {
        Ok(())
    } else {
        Err(ApiError(AppError::Forbidden))
    }
}

async fn master_products(State(st): State<AppState>, a: Admin) -> Result<Json<Vec<J>>, ApiError> {
    主数据归谁看(&a)?;
    let rows = sqlx::query(
        r#"SELECT id, code, name, sub_title, category, kind, status, fulfillment_kind,
                  available_regions, tags, sort_weight, created_at, updated_at
           FROM product ORDER BY sort_weight DESC, created_at DESC"#,
    ).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

async fn master_plans(State(st): State<AppState>, a: Admin) -> Result<Json<Vec<J>>, ApiError> {
    主数据归谁看(&a)?;
    let rows = sqlx::query(
        r#"SELECT p.id, p.sku_id, p.name, p.billing_period, p.trial_days, p.grace_days,
                  p.cancel_policy, p.prorate_on_upgrade, p.channel_constraints, p.status,
                  p.created_at, p.updated_at, s.code AS sku_code, s.name AS sku_name
           FROM plan p LEFT JOIN sku s ON s.id = p.sku_id
           ORDER BY p.created_at DESC"#,
    ).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

async fn master_account_chart(State(st): State<AppState>, a: Admin) -> Result<Json<Vec<J>>, ApiError> {
    主数据归谁看(&a)?;
    let rows = sqlx::query(
        r#"SELECT code, name, kind, parent_code, currency_constraint, created_at
           FROM account_chart ORDER BY code"#,
    ).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

async fn master_risk_templates(State(st): State<AppState>, a: Admin) -> Result<Json<Vec<J>>, ApiError> {
    主数据归谁看(&a)?;
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
    State(st): State<AppState>, admin: Admin, Query(f): Query<OutboxFilter>,
) -> Result<Json<Page<J>>, ApiError> {
    let kw = f.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let region = normalize_region_scoped(&f.region, &admin)?;
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
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    /* 【读也要问归属】（2026-09-03 五路评审 · 越权审计）。
       `这个对象归他管吗` 从前只出现在写路由上 —— 十九处，一处不落，
       而每一个 `get_X(:id)` 的签名都是 `_: Admin`。
       实测:`region_scope={hk}` 的管理员按 id 读大陆的订单、支付、
       运单、对账批次、凭证，七条全通。

       门禁那六条探针里只有一条是读（`GET /orders?region=cn` 列表），
       另五条全是写 —— 于是「读」这一整个面从来没被探过，
       而列表被挡住这件事【恰好让人以为读已经守住了】。 */
    这个对象归他管吗(&st.db, &admin, "outbox_event", &id).await?;
    let r = sqlx::query("SELECT * FROM outbox_event WHERE id=$1").bind(&id)
        .fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("event"))?;
    Ok(Json(map_rows(vec![r]).into_iter().next().unwrap_or(J::Null)))
}

async fn retry_outbox(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    这个对象归他管吗(&st.db, &admin, "outbox_event", &id).await?;
    admin.requires_role("operator")?;    // 重推事件是运维动作
    app_outbox::retry(&st.db, &id).await?;
    Ok(Json(json!({"ok": true})))
}

// ═══════════════════════════ 共用辅助 ═══════════════════════════

/// 规范化 region filter:
/// - 缺省 / 空 / "global" → None(看全部)
/// - 其它(cn/jp/kr/sea/na/zh_hant)→ Some
/// 这样 webadmin 切到 global 视图自动跨区
/// 规范化 region filter，并且**按这个管理员管得着的区收口**。
///
/// 【`region_scope` 一直只发不查】（2026-09-03）。登录时把它写进 token、
/// 前端拿它筛区域下拉框 —— 而后端一处都不校验。实测：
/// 造一个 `region_scope = {hk}` 的管理员，
/// `GET /admin/commerce/orders?region=cn` 拿到大陆全部 18,490 笔。
/// **前端挡的东西不算挡** —— 换一个查询参数就绕过去了。
///
/// 收口规则：
/// - scope 含 `global` 或为空 → 不限（super 与老 token 走这条）
/// - 指定了某个区：在 scope 里就用，不在就【当场拒】——
///   而不是悄悄换成他管得着的那个（那会让他以为在看大陆的数，
///   实际看的是香港的，比报错糟得多）
/// - 没指定 / 要 global：scope 只有一个区就锁到那个区；
///   多个区先拒 —— 跨区聚合要另设一个明确的接口，
///   不能让「不填参数」意外地变成跨区
pub(crate) fn normalize_region_scoped(
    r: &Option<String>,
    admin: &Admin,
) -> Result<Option<String>, ApiError> {
    let scope = &admin.0.region_scope;
    let 不限 = scope.is_empty() || scope.iter().any(|s| s == "global");
    match r.as_deref() {
        None | Some("") | Some("global") => {
            if 不限 {
                Ok(None)
            } else if scope.len() == 1 {
                Ok(Some(scope[0].clone()))
            } else {
                Err(ApiError(AppError::Forbidden))
            }
        }
        Some(要的) => {
            if 不限 || scope.iter().any(|s| s == 要的) {
                Ok(Some(要的.to_string()))
            } else {
                Err(ApiError(AppError::Forbidden))
            }
        }
    }
}

/// 这一批券落在哪个区。
///
/// 【管全部区域的人必须说清楚】（2026-09-05）。这里原先是
/// `.unwrap_or_else(|| "cn")` —— 于是一位 super 在顶栏切到日本、
/// 发一张券，券落在 `cn`：他手上的界面从头到尾说的是日本，
/// 而这张券只有大陆的人用得上，**两边都不会报错**。
/// 券要到有人拿它下单才炸，那时炸在用户脸上（`券 X 不能在 jp 用`）。
///
/// 分区管理员不受影响：`normalize_region_scoped` 已经把他锁到
/// 他那一格了，`None` 只可能出自「不限区」这一支。
fn 发券落在哪个区(r: &Option<String>, admin: &Admin) -> Result<String, ApiError> {
    normalize_region_scoped(r, admin)?.ok_or_else(|| {
        ApiError(AppError::BadRequest(
            "你管的是全部区域 —— 发券得说清这一张落在哪个区".into(),
        ))
    })
}

/// 按 id 写的那些端点：这个对象在不在他管得着的区里。
///
/// 【上面那个管不到它们】——它收的是查询参数里的 `region`，
/// 而 `POST /orders/:id/annotate` 这类路径里根本没有 region，
/// 对象是从 id 找出来的。实测：`region_scope = {hk}` 的管理员
/// 给一张大陆的订单加备注，回 200。
///
/// 十六个这样的端点，逐个手写 SQL 必然漏一两处 ——
/// 而漏掉的那一处就是越权还开着的那一处。所以收进一个函数。
///
/// 表名是**代码里写死的字面量**，不来自请求 —— 不然这就成了注入口。
pub(crate) async fn 这个对象归他管吗(
    db: &sqlx::PgPool,
    admin: &Admin,
    表: &'static str,
    id: &str,
) -> Result<(), ApiError> {
    let scope = &admin.0.region_scope;
    if scope.is_empty() || scope.iter().any(|s| s == "global") {
        return Ok(());
    }
    debug_assert!(
        表.chars().all(|c| c.is_ascii_lowercase() || c == '_'),
        "表名只能是字面量"
    );

    /* 【`product` 是全局 SPU，没有 region 列】——它按 `available_regions`
       数组判可见（`list_products` 那条 SQL 一直是这么写的）。
       上一版给它配了 `SELECT region FROM product`，于是那条路由
       从 404 变成 500 —— 「语义 · 边界那一半」当场报了
       「toggle_product_listing 幽灵 ID 期望 404 实际 500」。

       别的十五张表都有 region 列，就它一个例外，所以单独一支。 */
    let 归他管 = if 表 == "product" {
        /* 【`EXISTS` 把「没这一行」和「有但不归他」混成同一个 false】。
           上一版这么写，于是幽灵商品 id 回 403 而不是 404 ——
           「幽灵 id 的写操作不许说成功」那一支盯的正是这个:
           403 会把「这个 id 不存在」这件事盖掉。
           所以查的是【那一行的 available_regions】，
           查不到就是 None，跟别的表一个语义。 */
        let 可见区: Option<Vec<String>> = sqlx::query_scalar(
            "SELECT available_regions FROM product WHERE id=$1",
        )
        .bind(id)
        .fetch_optional(db)
        .await
        .map_err(map_db)?;
        可见区.map(|区们| 区们.iter().any(|r| scope.iter().any(|s| s == r)))
    } else {
        let 区: Option<String> = sqlx::query_scalar(&format!("SELECT region FROM {表} WHERE id=$1"))
            .bind(id)
            .fetch_optional(db)
            .await
            .map_err(map_db)?
            .flatten();
        区.map(|r| scope.iter().any(|s| *s == r))
    };

    match 归他管 {
        // 【找不到就放行，让业务层去给 404】——在这里回 403 等于
        // 告诉他「这个 id 存在但不归你」，而那本身就是他不该知道的事。
        // 而且回 403 会把幽灵 id 的 404 盖掉，那一支门禁正盯着这个。
        None => Ok(()),
        Some(true) => Ok(()),
        /* 【不归他管 = 不存在，连同那句话也要一模一样】
           （2026-09-03 五路评审 · 越权审计）。

           上一版这里回 403，而上面那条注释自己说明了为什么不该回 ——
           它只把「幽灵 id」那一半修了，「存在但不归你」这一半原样留着。
           于是同一个分区管理员拿两个 id 试:一个回 404、一个回 403，
           两者之差就把「这个 id 在库里真的存在」这件事说出来了。
           订单号是有规律的，靠这个差可以把别的区的订单量数出来。

           所以回 404，**并且回跟业务层完全相同的那句话** ——
           `not_found(表)` 会说 "order_record" 而处理器说 "order"，
           两句不一样，差别照样是一个可读的信号。 */
        Some(false) => Err(ApiError::not_found(业务叫它什么(表))),
    }
}

/// 表名 → 处理器在 404 里用的那个词。
///
/// 【它必须跟处理器那一句逐字相同】——这个函数存在的唯一理由，
/// 就是让「不归你管」和「没这东西」连响应正文都分不出来。
/// 新增一张表时，照着那张表的处理器里 `not_found("…")` 抄。
fn 业务叫它什么(表: &str) -> &'static str {
    match 表 {
        "outbox_event" => "event",
        "product" => "product",
        "sku" => "sku",
        "price_book" => "price",
        "promotion" => "promotion",
        "coupon" => "coupon",
        "subscription" => "subscription",
        "order_record" => "order",
        "payment" => "payment",
        "refund" => "refund",
        "shipment" => "shipment",
        "recon_batch" => "batch",
        "risk_rule" => "rule",
        "risk_case" => "case",
        "accounting_period" => "period",
        "journal_entry" => "entry",
        "app_user" => "user",
        _ => "resource",
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
    /// 【结过的算不算】（2026-09-04 · 25 计划的后台逐页走）。
    /// 对账批次结完一整批只写 `resolved_at`，`status` 一直留着
    /// `has_discrepancy` —— 那是有意的:账上不改写历史
    /// （`unmei-app/src/recon.rs` 里那段注释）。
    /// 于是「有对不上的」这个数把【已经处理完的】也算了进去,
    /// 运营看到的待办永远比真要做的多，而且每结一批就多虚高一点。
    /// `resolved=false` 只要还没结的;不给就跟从前一样，两种都列。
    resolved: Option<bool>,
    /// IANA timezone (e.g. "Asia/Shanghai" / "America/New_York")。
    /// dashboard 的「今日」按此 tz 算当日零点，绕开 sqlx UTC session 漂移。
    /// 前端由 `Intl.DateTimeFormat().resolvedOptions().timeZone` 取客户端 tz。
    /// 缺省回退 "UTC"(curl 直 hit 时可预测)。
    tz: Option<String>,
}
fn default_size() -> i64 { 50 }
impl Pg {
    /* 【两处用同一个数】（2026-09-03 第四轮评审 · 工程审计）。
       上一版 `off()` 用的是【原始】size，`lim()` 用的是 clamp 过的 ——
       `size=1000&page=1` 于是跳过 1000 行却只显示 200 行，
       中间那 800 行任何翻页组合都到不了。
       `page` 也 clamp:负数以前会算出负 offset，Postgres 直接 500，
       而同仓的 users.rs / quotes.rs 早就写了 `.max(1)`。 */
    fn 每页(&self) -> i64 { self.size.clamp(1, 200) }
    fn off(&self) -> i64 { self.page.max(0) * self.每页() }
    fn lim(&self) -> i64 { self.每页() }
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
    // 通用兜底：按 type info 走分支；失败回字符串。
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
        // NUMERIC 没有单独一支 —— 这里【故意】让它掉进下面的兜底。
        // `SUM(bigint)` 在 Postgres 里返回 NUMERIC，而这个项目里每一处
        // 聚合都该在 SQL 里显式 `::int8`（`monthly_report` 一直是这么写的）。
        // 掉进兜底会在屏幕上显示「<解不出 NUMERIC>」，一眼看得见，
        // 指的正是「这条 SQL 少了一个 cast」。为它装一个 decimal 依赖
        // 反而会把「忘了 cast」这件事永久地藏起来。
        // 【解不出来 ≠ 值是空的】。上一版这里写的是
        // `.ok().flatten().unwrap_or(J::Null)` —— 于是「这个类型我按 String
        // 取不出来」跟「这一格真的是 NULL」变成同一个 null 送到前端。
        // 财务页上 1,078 条分录的借贷合计全是「—」，就是这么来的：
        // 页面看起来正常，只是每个数都没了。
        // 现在把两件事分开：真 NULL 还是 null，解不出来的送一个
        // 一眼就知道不对的记号上屏。
        _ => match r.try_get::<Option<String>, _>(i) {
            Ok(Some(s)) => json!(s),
            Ok(None) => J::Null,
            Err(_) => J::String(format!("<解不出 {tn}>")),
        },
    }
}

// ═══════════════════════════ Catalog ═══════════════════════════

/// 商品列表的筛选。
///
/// 【为什么不复用 `Pg`】（2026-09-06 · 五路体验走查）。后台商品页的筛选栏上
/// 摆着一个「类型」下拉框（one_shot / subscription / digital_goods / service），
/// 而 `Pg` **没有 `kind` 字段** —— serde 把它静静丢掉，
/// 实测 `kind=subscription` 与不带它一样返回 13,901 条：
/// **那个下拉框从建起来就没生效过，而屏上看不出任何区别**。
///
/// 订单 / 支付 / 运单三页早就各有自己的 filter 结构体，商品这一页是漏的。
/// `scripts/check-query-params-used.py` 从此盯着这一类。
#[derive(Debug, Deserialize, Default)]
struct ProductFilter {
    #[serde(default)] page: i64,
    #[serde(default = "default_size")] size: i64,
    keyword: Option<String>,
    status: Option<String>,
    kind: Option<String>,
    region: Option<String>,
}

async fn list_products(
    State(st): State<AppState>, admin: Admin, Query(q): Query<ProductFilter>,
) -> Result<Json<Page<J>>, ApiError> {
    let kw = q.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let status = q.status.clone();
    let kind = q.kind.clone();
    let region = normalize_region_scoped(&q.region, &admin)?;
    let off = q.page * q.size;
    let lim = q.size.clamp(1, 200);
    // product 是全局 SPU,按 available_regions 数组判可见性
    let rows = sqlx::query(
        r#"SELECT id, code, name, sub_title, category, kind, status, fulfillment_kind,
                  sort_weight, tags, available_regions, created_at, updated_at
           FROM product
           WHERE ($1='' OR name ILIKE $2 OR code ILIKE $2)
             AND ($3::text IS NULL OR status = $3)
             AND ($4::text IS NULL OR $4 = ANY(available_regions))
             AND ($7::text IS NULL OR kind = $7)
           ORDER BY sort_weight DESC, created_at DESC
           OFFSET $5 LIMIT $6"#,
    )
    .bind(&kw).bind(&kw_like).bind(&status).bind(&region).bind(off).bind(lim).bind(&kind)
    .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM product
           WHERE ($1='' OR name ILIKE $2 OR code ILIKE $2)
             AND ($3::text IS NULL OR status = $3)
             AND ($4::text IS NULL OR $4 = ANY(available_regions))
             AND ($5::text IS NULL OR kind = $5)"#,
    ).bind(&kw).bind(&kw_like).bind(&status).bind(&region).bind(&kind)
     .fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: q.page, size: q.size }))
}

async fn get_product(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    /* 【读也要问归属】（2026-09-03 五路评审 · 越权审计）。
       `这个对象归他管吗` 从前只出现在写路由上 —— 十九处，一处不落，
       而每一个 `get_X(:id)` 的签名都是 `_: Admin`。
       实测:`region_scope={hk}` 的管理员按 id 读大陆的订单、支付、
       运单、对账批次、凭证，七条全通。

       门禁那六条探针里只有一条是读（`GET /orders?region=cn` 列表），
       另五条全是写 —— 于是「读」这一整个面从来没被探过，
       而列表被挡住这件事【恰好让人以为读已经守住了】。 */
    这个对象归他管吗(&st.db, &admin, "product", &id).await?;
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
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    /* 【读也要问归属】（2026-09-03 五路评审 · 越权审计）。
       `这个对象归他管吗` 从前只出现在写路由上 —— 十九处，一处不落，
       而每一个 `get_X(:id)` 的签名都是 `_: Admin`。
       实测:`region_scope={hk}` 的管理员按 id 读大陆的订单、支付、
       运单、对账批次、凭证，七条全通。

       门禁那六条探针里只有一条是读（`GET /orders?region=cn` 列表），
       另五条全是写 —— 于是「读」这一整个面从来没被探过，
       而列表被挡住这件事【恰好让人以为读已经守住了】。 */
    这个对象归他管吗(&st.db, &admin, "sku", &id).await?;
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
    这个对象归他管吗(&st.db, &admin, "product", &id).await?;
    admin.requires_any_role(&["content", "operator"])?;    // 上下架：内容侧编排，运营侧也要动得了
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
    这个对象归他管吗(&st.db, &admin, "sku", &sku_id).await?;
    admin.requires_role("finance")?;    // 定价直接是钱
    /* 【定的是哪个区的价，也得在他管得着的范围里】（2026-09-05）。
       上一行只问了「这个 sku 归不归他管」—— 而**价是按区落的**:
       `region_scope={cn}` 的人给一个 cn 的 sku 发一条 `region='jp'` 的价，
       上面那一道一路放行。日本那一格的定价就这么被大陆的运营改掉了，
       而两边的后台都不会说一个字。

       `PublishPriceBody` 的 region 有默认值（cn），所以这里一律当成
       「他明说了要发哪个区」来判 —— 不填就是 cn，而 cn 归不归他管，
       同一道判断答得出来。 */
    let region = normalize_region_scoped(&Some(b.region.clone()), &admin)?
        .unwrap_or(b.region);
    let id = app_catalog::publish_price(&st.db, &sku_id, app_catalog::NewPrice {
        currency: b.currency,
        price_minor: b.price_minor,
        region,
        platform: b.platform,
        effective_from: b.effective_from,
        audit_note: b.audit_note,
    }, &Actor::admin(&admin.0.sub)).await?;
    Ok(Json(json!({"ok":true, "id":id})))
}

async fn expire_price(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    这个对象归他管吗(&st.db, &admin, "price_book", &id).await?;
    admin.requires_role("finance")?;    // 下架一档价同样是钱
    app_catalog::expire_price(&st.db, &id).await?;
    Ok(Json(json!({"ok":true})))
}

// ═══════════════════════════ Promotion / Coupon ═══════════════════════════

async fn list_promotions(
    State(st): State<AppState>, admin: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let kw = q.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let region = normalize_region_scoped(&q.region, &admin)?;
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
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    /* 【读也要问归属】（2026-09-03 五路评审 · 越权审计）。
       `这个对象归他管吗` 从前只出现在写路由上 —— 十九处，一处不落，
       而每一个 `get_X(:id)` 的签名都是 `_: Admin`。
       实测:`region_scope={hk}` 的管理员按 id 读大陆的订单、支付、
       运单、对账批次、凭证，七条全通。

       门禁那六条探针里只有一条是读（`GET /orders?region=cn` 列表），
       另五条全是写 —— 于是「读」这一整个面从来没被探过，
       而列表被挡住这件事【恰好让人以为读已经守住了】。 */
    这个对象归他管吗(&st.db, &admin, "promotion", &id).await?;
    let p = sqlx::query("SELECT * FROM promotion WHERE id=$1").bind(&id)
        .fetch_optional(&st.db).await.map_err(map_db)?
        .ok_or_else(|| ApiError::not_found("promotion"))?;
    let stats: (i64, i64) = sqlx::query_as(
        r#"SELECT COUNT(*)::int8, COALESCE(SUM(applied_amount_minor),0)::int8
           FROM coupon_redemption cr WHERE cr.coupon_id IN
             (SELECT id FROM coupon WHERE promotion_id=$1)"#,
    // 核销统计查不到就上抛 —— 显示成「0 张券、0 元」跟
    // 「这个活动一张都没核销」长得一模一样，而运营正拿它判活动效果
    ).bind(&id).fetch_one(&st.db).await.map_err(map_db)?;
    let prod = map_rows(vec![p]).into_iter().next().unwrap_or(J::Null);
    Ok(Json(json!({ "promotion": prod, "redemption_count": stats.0, "redemption_amount_minor": stats.1 })))
}

#[derive(Deserialize)]
struct PromoStateBody { status: String }

async fn update_promotion_state(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<PromoStateBody>,
) -> Result<Json<J>, ApiError> {
    这个对象归他管吗(&st.db, &admin, "promotion", &id).await?;
    admin.requires_role("operator")?;    // 促销开关是运营动作
    let status = app_promotion::set_status(
        &st.db, &id, &b.status, &Actor::admin(&admin.0.sub),
    ).await?;
    Ok(Json(json!({"ok":true, "status": status.as_str()})))
}

#[derive(Deserialize)]
struct IssueCouponBody {
    code: String,
    promotion_id: Option<String>,
    owner_user_id: Option<String>,
    benefit_json: J,
    /// RFC3339。不给就是不发 —— 不替调用方猜一个有效期出来
    expires_at: String,
    region: Option<String>,
}

/// 发一张券。
///
/// 【在它之前只有读端】——后台列得出券，却发不出券，
/// 于是 `coupon` 表从建起来就是空的，而下单那一侧的核销代码从没被真数据走过。
async fn issue_coupon(
    State(st): State<AppState>, admin: Admin, Json(b): Json<IssueCouponBody>,
) -> Result<Json<J>, ApiError> {
    admin.requires_role("operator")?;    // 发券是花钱的动作，跟改促销同一档
    // ApiError 只有 not_found 一个构造器 —— 其余走 DomainError 转换，
    // 状态码由 `DomainError::http_status()` 决定，路由不手工判。
    let expires: DateTime<Utc> = b.expires_at.parse().map_err(|_| {
        unmei_domain::DomainError::Validation(
            "expires_at 要是 RFC3339 的时刻，例如 2026-12-31T23:59:59Z".into(),
        )
    })?;
    let region = 发券落在哪个区(&b.region, &admin)?;
    let id = app_coupon::issue(
        &st.db,
        app_coupon::IssueCoupon {
            code: &b.code,
            promotion_id: b.promotion_id.as_deref(),
            owner_user_id: b.owner_user_id.as_deref(),
            benefit_json: b.benefit_json,
            expires_at: expires,
            region: &region,
        },
        &Actor::admin(&admin.0.sub),
    ).await?;
    Ok(Json(json!({"ok": true, "id": id})))
}

#[derive(Deserialize)]
struct IssueBatchBody {
    count: i32,
    prefix: String,
    promotion_id: Option<String>,
    benefit_json: J,
    expires_at: String,
    region: Option<String>,
}

/// 一次发一批券。
///
/// 【`coupon.batch_id` 一直是空的】——列表查它、前端显示它，
/// 而没有任何地方写。真实发券是成批的（一次一千张码往外投），
/// 一张张点不可行 —— 于是「批」这个概念在系统里等于不存在。
///
/// 码由服务端生成 —— 让调用方传一千个码的话，重码与弱码（连号、
/// 可猜）都成了它的责任，而那件事只该做对一次。
async fn issue_coupon_batch(
    State(st): State<AppState>, admin: Admin, Json(b): Json<IssueBatchBody>,
) -> Result<Json<J>, ApiError> {
    admin.requires_role("operator")?;    // 跟单张发券同一档：这是花钱的动作
    let expires: DateTime<Utc> = b.expires_at.parse().map_err(|_| {
        unmei_domain::DomainError::Validation(
            "expires_at 要是 RFC3339 的时刻，例如 2026-12-31T23:59:59Z".into(),
        )
    })?;
    let region = 发券落在哪个区(&b.region, &admin)?;
    let (batch_id, 码们) = app_coupon::issue_batch(
        &st.db,
        app_coupon::IssueBatch {
            张数: b.count,
            前缀: &b.prefix,
            promotion_id: b.promotion_id.as_deref(),
            benefit_json: b.benefit_json,
            expires_at: expires,
            region: &region,
        },
        &Actor::admin(&admin.0.sub),
    ).await?;
    /* 【码要跟着响应回去】。发完一千张而运营拿不到那一千个码，
       这一批就白发了 —— 库里躺着，谁也用不上。
       前端把它们存成一个文本文件。 */
    Ok(Json(json!({ "ok": true, "batch_id": batch_id, "count": 码们.len(), "codes": 码们 })))
}

async fn list_coupons(
    State(st): State<AppState>, admin: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let kw = q.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let region = normalize_region_scoped(&q.region, &admin)?;
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
    State(st): State<AppState>, admin: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let region = normalize_region_scoped(&q.region, &admin)?;
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
    这个对象归他管吗(&st.db, &admin, "subscription", &id).await?;
    admin.requires_any_role(&["support", "finance"])?;    // 客服替用户退订；涉及退款预期，财务也要动得了
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
    State(st): State<AppState>, admin: Admin, Query(f): Query<OrderFilter>,
) -> Result<Json<Page<J>>, ApiError> {
    let kw = f.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let region = normalize_region_scoped(&f.region, &admin)?;
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
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    /* 【读也要问归属】（2026-09-03 五路评审 · 越权审计）。
       `这个对象归他管吗` 从前只出现在写路由上 —— 十九处，一处不落，
       而每一个 `get_X(:id)` 的签名都是 `_: Admin`。
       实测:`region_scope={hk}` 的管理员按 id 读大陆的订单、支付、
       运单、对账批次、凭证，七条全通。

       门禁那六条探针里只有一条是读（`GET /orders?region=cn` 列表），
       另五条全是写 —— 于是「读」这一整个面从来没被探过，
       而列表被挡住这件事【恰好让人以为读已经守住了】。 */
    这个对象归他管吗(&st.db, &admin, "order_record", &id).await?;
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
    这个对象归他管吗(&st.db, &admin, "order_record", &id).await?;
    admin.requires_role("operator")?;    // 取消订单会牵动库存与履约，不给客服，避免误操作
    // owner 传 None → 后台不受归属限制。
    //
    // ⚠ 行为变更：旧实现允许从 `paid` / `fulfilling` 取消，但 domain 状态机的
    // Paid → [Fulfilling, Done, RefundPartial, Refunded, Disputed] 里没有 Cancelled,
    // 客户端路由也明说「已付订单需走退款」。三处语义原本互相打架。
    // 现在统一以状态机为准：已付订单只能走退款，不能直接取消 ——
    // 否则会留下「用户付了钱、订单被取消、没有退款记录」的窟窿。
    app_order::cancel(&st.db, &id, &b.reason, &Actor::admin(&admin.0.sub), None).await?;
    Ok(Json(json!({"ok":true})))
}

#[derive(Deserialize)]
struct AnnotateBody { note: String }

async fn annotate_order(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<AnnotateBody>,
) -> Result<Json<J>, ApiError> {
    这个对象归他管吗(&st.db, &admin, "order_record", &id).await?;
    admin.requires_any_role(&["support", "operator"])?;    // 给单子加备注，客服天天做
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
    State(st): State<AppState>, admin: Admin, Query(f): Query<PaymentFilter>,
) -> Result<Json<Page<J>>, ApiError> {
    let kw = f.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let region = normalize_region_scoped(&f.region, &admin)?;
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
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    /* 【读也要问归属】（2026-09-03 五路评审 · 越权审计）。
       `这个对象归他管吗` 从前只出现在写路由上 —— 十九处，一处不落，
       而每一个 `get_X(:id)` 的签名都是 `_: Admin`。
       实测:`region_scope={hk}` 的管理员按 id 读大陆的订单、支付、
       运单、对账批次、凭证，七条全通。

       门禁那六条探针里只有一条是读（`GET /orders?region=cn` 列表），
       另五条全是写 —— 于是「读」这一整个面从来没被探过，
       而列表被挡住这件事【恰好让人以为读已经守住了】。 */
    这个对象归他管吗(&st.db, &admin, "payment", &id).await?;
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
    这个对象归他管吗(&st.db, &admin, "payment", &id).await?;
    admin.requires_role("finance")?;    // 改一笔支付的结局，动的是账
    app_payment::mark_failed(
        &st.db, &id, &b.code, &b.msg, &Actor::admin(&admin.0.sub),
    ).await?;
    Ok(Json(json!({"ok":true})))
}

// ═══════════════════════════ Refund ═══════════════════════════

async fn list_refunds(
    State(st): State<AppState>, admin: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let region = normalize_region_scoped(&q.region, &admin)?;
    /* 【`keyword` 收下了，而 SQL 里一次都没用】（2026-09-06 · 五路体验走查）。
       `Pg` 有这个字段，前端 FilterBar 也发得出来 —— 实测带不带它，
       返回都是 2,538 条。而 serde 对不认识的字段是静静丢掉，
       所以两边都不报错，只是那个搜索框永远不生效。

       后果落在客服身上:退款页四百多条待批，**按订单号搜不到**,
       只能靠日期缩窄再肉眼翻。这是这一页最常做的一件事。 */
    let kw = q.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let rows = sqlx::query(
        /* `failure_msg` 也取回来（2026-09-06 三路验证 · 运营那一路）：
           库里 132 笔 `failed` 写着 `CHANNEL_REJECTED | 渠道拒绝`，
           而屏上一个字都不显示 —— 客服看到的只是一颗「重试」按钮,
           于是一笔笔重试，一笔笔再失败。
           `failure_code` 早就在这条 SELECT 里了，`failure_msg` 连查都没查。 */
        r#"SELECT id, order_id, payment_id, amount_minor, currency, reason_code, reason_text,
                  actor_kind, status, approved_at, completed_at,
                  failure_code, failure_msg, created_at, region
           FROM refund
           WHERE ($1::text IS NULL OR status=$1)
             AND ($2::timestamptz IS NULL OR created_at >= $2)
             AND ($3::timestamptz IS NULL OR created_at <= $3)
             AND ($4::text IS NULL OR region=$4)
             AND ($7='' OR id ILIKE $8 OR order_id ILIKE $8 OR payment_id ILIKE $8)
           ORDER BY created_at DESC OFFSET $5 LIMIT $6"#,
    ).bind(&q.status).bind(q.from).bind(q.to).bind(&region).bind(q.off()).bind(q.lim())
     .bind(&kw).bind(&kw_like)
     .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM refund WHERE ($1::text IS NULL OR status=$1)
           AND ($2::timestamptz IS NULL OR created_at >= $2)
           AND ($3::timestamptz IS NULL OR created_at <= $3)
           AND ($4::text IS NULL OR region=$4)
           AND ($5='' OR id ILIKE $6 OR order_id ILIKE $6 OR payment_id ILIKE $6)"#,
    ).bind(&q.status).bind(q.from).bind(q.to).bind(&region).bind(&kw).bind(&kw_like)
     .fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: q.page, size: q.size }))
}

async fn approve_refund(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    这个对象归他管吗(&st.db, &admin, "refund", &id).await?;
    admin.requires_role("finance")?;    // 批退款
    app_refund::approve(&st.db, &id, &Actor::admin(&admin.0.sub)).await?;
    Ok(Json(json!({
        "ok": true,
        "status": "success",
        "note": "已 mock 模式直推到 success，真接入将由 adapter.refund() + webhook 推进"
    })))
}

#[derive(Deserialize)]
struct DenyBody { reason: String }

async fn deny_refund(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<DenyBody>,
) -> Result<Json<J>, ApiError> {
    这个对象归他管吗(&st.db, &admin, "refund", &id).await?;
    admin.requires_role("finance")?;    // 拒退款也是钱的决定，跟批同权
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
    State(st): State<AppState>, admin: Admin, Query(f): Query<ShipmentFilter>,
) -> Result<Json<Page<J>>, ApiError> {
    let kw = f.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let region = normalize_region_scoped(&f.region, &admin)?;
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
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    /* 【读也要问归属】（2026-09-03 五路评审 · 越权审计）。
       `这个对象归他管吗` 从前只出现在写路由上 —— 十九处，一处不落，
       而每一个 `get_X(:id)` 的签名都是 `_: Admin`。
       实测:`region_scope={hk}` 的管理员按 id 读大陆的订单、支付、
       运单、对账批次、凭证，七条全通。

       门禁那六条探针里只有一条是读（`GET /orders?region=cn` 列表），
       另五条全是写 —— 于是「读」这一整个面从来没被探过，
       而列表被挡住这件事【恰好让人以为读已经守住了】。 */
    这个对象归他管吗(&st.db, &admin, "shipment", &id).await?;
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
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<AssignTrackingBody>,
) -> Result<Json<J>, ApiError> {
    这个对象归他管吗(&st.db, &admin, "shipment", &id).await?;
    admin.requires_any_role(&["support", "operator"])?;    // 填运单号
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
    这个对象归他管吗(&st.db, &admin, "shipment", &id).await?;
    admin.requires_any_role(&["support", "operator"])?;    // 标物流异常
    app_shipment::mark_exception(&st.db, &id, &b.reason, &Actor::admin(&admin.0.sub)).await?;
    Ok(Json(json!({"ok":true})))
}

// ═══════════════════════════ Reconciliation ═══════════════════════════

async fn list_recon_batches(
    State(st): State<AppState>, admin: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let region = normalize_region_scoped(&q.region, &admin)?;
    let rows = sqlx::query(
        r#"SELECT id, channel, batch_date, source, total_count, total_amount_minor, currency,
                  status, pulled_at, matched_at, resolved_at, region
           FROM recon_batch
           WHERE ($1::text IS NULL OR status=$1)
             AND ($2::text IS NULL OR region=$2)
             AND ($5::bool IS NULL
                  OR ($5 = true AND resolved_at IS NOT NULL)
                  OR ($5 = false AND resolved_at IS NULL))
           ORDER BY batch_date DESC OFFSET $3 LIMIT $4"#,
    ).bind(&q.status).bind(&region).bind(q.off()).bind(q.lim()).bind(q.resolved)
     .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM recon_batch
           WHERE ($1::text IS NULL OR status=$1)
             AND ($2::text IS NULL OR region=$2)
             AND ($3::bool IS NULL
                  OR ($3 = true AND resolved_at IS NOT NULL)
                  OR ($3 = false AND resolved_at IS NULL))"#,
    ).bind(&q.status).bind(&region).bind(q.resolved).fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: q.page, size: q.size }))
}

async fn get_recon_batch(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    /* 【读也要问归属】（2026-09-03 五路评审 · 越权审计）。
       `这个对象归他管吗` 从前只出现在写路由上 —— 十九处，一处不落，
       而每一个 `get_X(:id)` 的签名都是 `_: Admin`。
       实测:`region_scope={hk}` 的管理员按 id 读大陆的订单、支付、
       运单、对账批次、凭证，七条全通。

       门禁那六条探针里只有一条是读（`GET /orders?region=cn` 列表），
       另五条全是写 —— 于是「读」这一整个面从来没被探过，
       而列表被挡住这件事【恰好让人以为读已经守住了】。 */
    这个对象归他管吗(&st.db, &admin, "recon_batch", &id).await?;
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
    State(st): State<AppState>, admin: Admin, Query(q): Query<Pg>,
) -> Result<Json<Vec<J>>, ApiError> {
    let region = normalize_region_scoped(&q.region, &admin)?;
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
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<RiskRuleStateBody>,
) -> Result<Json<J>, ApiError> {
    这个对象归他管吗(&st.db, &admin, "risk_rule", &id).await?;
    admin.requires_role("super")?;    // 风控规则是安全面，只给 super
    let status = app_risk::set_rule_status(&st.db, &id, &b.status).await?;
    Ok(Json(json!({"ok":true, "status": status.as_str()})))
}

async fn list_risk_events(
    State(st): State<AppState>, admin: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let region = normalize_region_scoped(&q.region, &admin)?;
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

#[derive(Deserialize)]
struct ResolveBody { action: String, note: String }

/// 结掉一条对不上的账。
///
/// 【对账这一块在它之前一个写操作都没有】——1432 条差异躺着，
/// 因为找出来之后没有路可走。
async fn resolve_recon_record(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<ResolveBody>,
) -> Result<Json<J>, ApiError> {
    admin.requires_role("finance")?;    // 判账是财务的活儿
    /* 【`recon_record` 自己没有 region 列】——区挂在它所属的批次上，
       所以这一处用不了 `这个对象归他管吗`（它按 id 查同名表的 region）。
       先找批次再问。手抄的这一处正是最容易漏的那种，
       所以写清楚它为什么是特例。 */
    let 批次: Option<String> = sqlx::query_scalar(
        "SELECT batch_id FROM recon_record WHERE id=$1",
    ).bind(&id).fetch_optional(&st.db).await.map_err(map_db)?;
    if let Some(b) = 批次 {
        这个对象归他管吗(&st.db, &admin, "recon_batch", &b).await?;
    }
    let batch = app_recon::resolve_record(
        &st.db, &id, &b.action, &b.note, &Actor::admin(&admin.0.sub),
    ).await?;
    Ok(Json(json!({"ok": true, "batch_id": batch})))
}

#[derive(Deserialize)]
struct CaseStateBody { state: String, note: String }

/// 结掉一个风控案子。
async fn close_risk_case(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<CaseStateBody>,
) -> Result<Json<J>, ApiError> {
    这个对象归他管吗(&st.db, &admin, "risk_case", &id).await?;
    // 【结案跟改规则分开】：改一条规则影响此后每一笔交易（那是安全面，
    // 只给 super）；结一个案子只是对一件已发生的事下判断，是日常处置。
    // 合成一档的话，要么日常处置卡在 super 手里，要么规则开关落到运营手里。
    admin.requires_role("operator")?;
    let st2 = app_risk::close_case(
        &st.db, &id, &b.state, &b.note, &Actor::admin(&admin.0.sub),
    ).await?;
    Ok(Json(json!({"ok": true, "state": st2.as_str()})))
}

async fn list_risk_cases(
    State(st): State<AppState>, admin: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let region = normalize_region_scoped(&q.region, &admin)?;
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

/// 会计期。
///
/// 【它是按区记的，而这一条从前不看区】（2026-09-05）。
/// `accounting_period` 有 region 列，`close_period` 与 `list_journal_entries`
/// 都按它守着 —— 只有这一条是 `_: Admin` 加一句不带 WHERE 的 SELECT。
///
/// 后果不是越权，是**一整页读不通**：一位只管繁中那一格的财务打开财务页，
/// 上面列着大陆的五个会计期（那是这个产品唯一有账的区），
/// 挑一个进去，分录一条都没有 —— 因为那些分录是大陆的。
/// 屏上没有一处说得出「这不是你那一格的期间」。
/// 后台逐页走那一支报的正是这个:「拿到 5 条，一行都没渲」。
async fn list_periods(
    State(st): State<AppState>, admin: Admin, Query(q): Query<Pg>,
) -> Result<Json<Vec<J>>, ApiError> {
    let region = normalize_region_scoped(&q.region, &admin)?;
    let rows = sqlx::query(
        "SELECT * FROM accounting_period
          WHERE ($1::text IS NULL OR region=$1)
          ORDER BY year DESC, sub DESC, kind",
    ).bind(&region).fetch_all(&st.db).await.map_err(map_db)?;
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

/// 关账。
///
/// 【这是财务这一块第一个写操作】。在它之前后台只能看账，
/// 而 `accounting_period.state` 从建库到现在全是 open ——
/// 记账那一侧一直防着「关了的期间」，却没有任何地方能把它关上。
async fn close_period(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    这个对象归他管吗(&st.db, &admin, "accounting_period", &id).await?;
    admin.requires_role("finance")?;    // 封期是财务的动作，运营不能碰
    let (借, 贷) = app_finance::close_period(&st.db, &id, &Actor::admin(&admin.0.sub)).await?;
    Ok(Json(json!({"ok": true, "total_debit": 借, "total_credit": 贷})))
}

async fn list_journal_entries(
    State(st): State<AppState>, admin: Admin, Query(q): Query<EntriesQuery>,
) -> Result<Json<Page<J>>, ApiError> {
    let region = normalize_region_scoped(&q.region, &admin)?;
    let off = q.page * q.size; let lim = q.size.clamp(1, 200);
    let rows = sqlx::query(
        r#"SELECT je.id, je.period_id, je.description, je.posted_at, je.posted_by_kind,
                  je.business_kind, je.business_ref_id, je.status, je.region,
                  COALESCE(SUM(jl.debit_minor), 0)::int8 AS total_debit,
                  COALESCE(SUM(jl.credit_minor), 0)::int8 AS total_credit
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
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    /* 【读也要问归属】（2026-09-03 五路评审 · 越权审计）。
       `这个对象归他管吗` 从前只出现在写路由上 —— 十九处，一处不落，
       而每一个 `get_X(:id)` 的签名都是 `_: Admin`。
       实测:`region_scope={hk}` 的管理员按 id 读大陆的订单、支付、
       运单、对账批次、凭证，七条全通。

       门禁那六条探针里只有一条是读（`GET /orders?region=cn` 列表），
       另五条全是写 —— 于是「读」这一整个面从来没被探过，
       而列表被挡住这件事【恰好让人以为读已经守住了】。 */
    这个对象归他管吗(&st.db, &admin, "journal_entry", &id).await?;
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
    State(st): State<AppState>, admin: Admin, Path(period_id): Path<String>, Query(q): Query<Pg>,
) -> Result<Json<J>, ApiError> {
    let region = normalize_region_scoped(&q.region, &admin)?;
    // 试算平衡：按 account_chart 聚合本期分录(region 过滤)
    let tb = sqlx::query(
        r#"SELECT ac.code, ac.name, ac.kind,
                  COALESCE(SUM(jl.debit_minor),0)::int8 AS debit,
                  COALESCE(SUM(jl.credit_minor),0)::int8 AS credit
           /* 【期间条件要挂在 jl 那一层】（2026-09-03 五路评审 · 资金审计）。
              上一版把 period/region 挂在【第二层】LEFT JOIN 的 ON 上 ——
              `jl` 已经无条件全表进来了，那些条件只能让 `je` 变 NULL，
              聚合的仍是全量。实测：换任何 period（连不存在的）
              这张表都返回同一个数，而同屏的 KPI（走 INNER JOIN）是对的，
              两个数差 33 倍。而试算表恰恰是财务用来判断「这一期平不平」的那张。

              改成子查询：先把本期本区的分录行圈出来，再跟科目表对齐。 */
           FROM account_chart ac
           LEFT JOIN (
             SELECT jl.account_code, jl.debit_minor, jl.credit_minor
               FROM journal_line jl
               JOIN journal_entry je ON je.id = jl.entry_id
              WHERE je.period_id=$1 AND je.status='posted'
                AND ($2::text IS NULL OR je.region=$2)
           ) jl ON jl.account_code = ac.code
           GROUP BY ac.code, ac.name, ac.kind
           ORDER BY ac.code"#,
    ).bind(&period_id).bind(&region).fetch_all(&st.db).await.map_err(map_db)?;

    // 收入 / 退款 / 物流毛利 各 KPI
    let kpi: (i64, i64, i64, i64) = sqlx::query_as(
        r#"SELECT
            COALESCE(SUM(CASE WHEN ac.code IN ('4001','4002','4003') THEN jl.credit_minor - jl.debit_minor END), 0)::int8 AS revenue,
            /* 【退款读的科目跟记账写的对不上】（2026-09-03）。
               上一版读 `5003 退款损失`，而 `post_refund_journal` 写的是
               `4001` 的借方（收入冲销）—— `5003` 一行都没有，
               于是「本期退款」恒为 0，而库里 1,094 条退款分录明明在那儿。
               改成读 4001 的借方：那正是冲销掉的收入。 */
            COALESCE(SUM(CASE WHEN ac.code = '4001' THEN jl.debit_minor END), 0)::int8 AS refund,
            COALESCE(SUM(CASE WHEN ac.code = '4002' THEN jl.credit_minor - jl.debit_minor END), 0)::int8 AS shipping_revenue,
            COALESCE(SUM(CASE WHEN ac.code = '5002' THEN jl.debit_minor - jl.credit_minor END), 0)::int8 AS shipping_cost
          FROM journal_entry je JOIN journal_line jl ON jl.entry_id=je.id
            JOIN account_chart ac ON ac.code = jl.account_code
          WHERE je.period_id=$1 AND je.status='posted'
            AND ($2::text IS NULL OR je.region=$2)"#,
    /* 【月报的四个数不许吞】。查询挂了返回 (0,0,0,0)，屏幕上就是
       「本期收入 0、退款 0、运费收入 0、运费成本 0」——
       而那跟「这个月真的一分钱没进」在页面上没有任何区别。
       财务报表说错一次，后面每一个基于它的决定都跟着错。 */
    ).bind(&period_id).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;

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

/* 【看板上的零必须是真的零】（2026-09-03）。
   这十一个数原本每一个都是 `.await.unwrap_or(0)` —— 查询挂了就显示 0，
   而这一屏的整个读法建立在「零是好消息」上:
   左栏不为零才报数、看板只列不为零的待办、
   没事的时候它说「都清完了 —— 没有待付的订单、没有等着批的退款」。

   于是一次数据库抖动会让运营看到一屏「什么都不用做」，
   而那正是这台控制台最不该说错的一句话。
   `map_db` 上抛之后前端拿到 500，react-query 会显示取数失败 ——
   「取不到」跟「是零」终于分得开。 */
/// 后台做过的事。
///
/// 【`audit_log` 一直是空的，也没有地方看】——十八个写操作各自往业务表的
/// `audit_note` 里拼一句话，那能回答「这条记录被谁动过」，
/// 回答不了「今天这个人做了什么」。
/// 【它对分区管理员是敞开的】（2026-09-06 · 五路体验走查）。签名是 `_: Admin`，
/// SQL 里没有 region —— 实测 `region_scope={zh_hant}` 的管理员拿到的
/// **1,056 条与超级管理员逐字相同**，第一条就是「超级管理员 批了退款 rfd-8e1e…」,
/// 一笔大陆的退款。
///
/// 【为什么不按区过滤，而是整页只给不限区的人看】：
/// `audit_log` **没有 region 列**（id / admin_id / action / target_type /
/// target_id / diff / ip / created_at）。按 `target_id` 反查十六张业务表
/// 去凑一个区出来，是把简单问题做复杂，而且漏一张表就是漏一个口子。
/// 一页看不到，比一页看到别人的东西好。
///
/// 开第二格那天要做的是给 `audit_log` 加一列 region，
/// 由 `audit.rs` 中间件写入时从 `这个对象归他管吗` 已经查出来的那一行里取 ——
/// 那时这一页才真的能按区看。
async fn list_audit(
    State(st): State<AppState>, admin: Admin, Query(q): Query<Pg>,
) -> Result<Json<Page<J>>, ApiError> {
    let scope = &admin.0.region_scope;
    let 不限 = scope.is_empty() || scope.iter().any(|s| s == "global");
    if !不限 {
        return Err(ApiError(AppError::Forbidden));
    }
    let kw = q.keyword.clone().unwrap_or_default();
    let kw_like = format!("%{kw}%");
    let rows = sqlx::query(
        r#"SELECT a.id, a.admin_id, a.action, a.target_type, a.target_id,
                  a.diff, a.ip, a.created_at, u.name AS admin_name
             FROM audit_log a LEFT JOIN admin_user u ON u.id = a.admin_id
            WHERE ($1='' OR a.action ILIKE $2 OR a.target_id ILIKE $2 OR a.admin_id ILIKE $2)
            ORDER BY a.created_at DESC OFFSET $3 LIMIT $4"#,
    ).bind(&kw).bind(&kw_like).bind(q.off()).bind(q.lim())
     .fetch_all(&st.db).await.map_err(map_db)?;
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM audit_log
            WHERE ($1='' OR action ILIKE $2 OR target_id ILIKE $2 OR admin_id ILIKE $2)"#,
    ).bind(&kw).bind(&kw_like).fetch_one(&st.db).await.map_err(map_db)?;
    Ok(Json(Page { items: map_rows(rows), total, page: q.page, size: q.size }))
}

async fn dashboard_kpi(
    State(st): State<AppState>, admin: Admin, Query(q): Query<Pg>,
) -> Result<Json<J>, ApiError> {
    let region = normalize_region_scoped(&q.region, &admin)?;
    // 「今日」按客户端 tz 算 — 前端传 IANA tz,缺省 UTC。
    // `date_trunc('day', NOW() AT TIME ZONE $tz) AT TIME ZONE $tz` 双转模式：
    //   内层 → 把 timestamptz 转成 tz 当地的 naive timestamp
    //   date_trunc → 取当地零点
    //   外层 → 把当地零点 naive 再转回 timestamptz(UTC instant)
    // 与 paid_at (timestamptz) 比较时无 session-tz 漂移。
    let tz = q.tz.as_deref().filter(|s| !s.is_empty()).unwrap_or("UTC");
    // 本币营收(单 region 时是该币种；global 时跨币种 sum 不直观)
    let today_revenue: i64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(amount_minor),0)::int8 FROM payment
           WHERE status='success'
             AND paid_at >= (date_trunc('day', NOW() AT TIME ZONE $2) AT TIME ZONE $2)
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).bind(tz).fetch_one(&st.db).await.map_err(map_db)?;
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
    ).bind(&region).bind(tz).fetch_one(&st.db).await.map_err(map_db)?;
    let today_orders: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM order_record
           WHERE created_at >= (date_trunc('day', NOW() AT TIME ZONE $2) AT TIME ZONE $2)
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).bind(tz).fetch_one(&st.db).await.map_err(map_db)?;
    let pending_payments: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM payment WHERE status='pending' AND expires_at > NOW()
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
    let unpaid_orders: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM order_record WHERE status='unpaid' AND expires_at > NOW()
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
    let pending_refunds: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM refund WHERE status IN ('requested','approved','processing')
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
    let exception_shipments: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM shipment WHERE status IN ('exception','returning')
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
    let active_subs: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM subscription WHERE status IN ('active','trialing')
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
    let active_promos: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM promotion WHERE status='active'
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
    let open_risk_cases: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM risk_case WHERE state IN ('open','investigating')
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
    /* 【对账那一千多批，看板与左栏一个字都不提】（2026-09-06 三路验证 ·
       运营那一路）。实测 1,023 批未结差异、明细层 1,364 条 ——
       而早上打开后台，看板十个数里没有对账，左栏那一项也没有 `watch`。
       于是「今天有什么要我处理」这个问题，答案里少了最大的一块，
       只能靠记性去翻那一页。 */
    let open_recon_batches: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM recon_batch WHERE status='has_discrepancy'
             AND ($1::text IS NULL OR region=$1)"#,
    ).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
    // product 是全局 SPU,按 available_regions 包含 region 判可见
    let listed_products: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM product WHERE status='listed'
             AND ($1::text IS NULL OR $1 = ANY(available_regions))"#,
    ).bind(&region).fetch_one(&st.db).await.map_err(map_db)?;
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
        "open_recon_batches": open_recon_batches,
        "listed_products": listed_products,
        "region": region,
    })))
}

// ═══════════════════════════ Error helpers ═══════════════════════════
fn map_db(e: sqlx::Error) -> ApiError { ApiError(AppError::Infra(format!("db: {e}"))) }
