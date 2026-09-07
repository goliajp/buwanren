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
    Actor, coupon as app_coupon};
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
        .route("/v1/orders/preview",                      post(preview_order))
        .route("/v1/orders/:id",                          get(get_my_order))
        .route("/v1/orders/:id/cancel",                   post(cancel_my_order))
        .route("/v1/orders/:id/pay",                      post(pay_my_order))
        .route("/v1/orders/:id/refund",                   post(refund_my_order))
        // 支付查询
        .route("/v1/payments/:id",                        get(get_my_payment))
        // 物流
        .route("/v1/orders/:id/shipments",                get(my_shipments))
        .route("/v1/orders/:id/shipments/:sid/trace",     get(my_shipment_trace))
        // 券 · 他名下的那些
        .route("/v1/coupons",                             get(my_coupons))
        // 订阅
        .route("/v1/subscriptions",                       get(my_subscriptions))
        .route("/v1/subscriptions/:id/cancel",            post(cancel_my_subscription))
        .route("/v1/subscriptions/:id/pay",               post(pay_my_subscription))
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
    /* 【2026-09-01】列表也带上价钱。
       村民页那颗「请 X 回村」是掏钱的入口，而它之前【不写价】——
       五路评审里有三路把它列成第一条不敢按的理由:一个没用过的人，
       不知道按下去是马上扣钱还是先看看，于是干脆不按。
       价钱在 price_book 上、按 region/platform 生效，跟详情页同一套取法;
       这里取这件商品最便宜的那一档，够按钮写「¥99 起」。
       取不到（没上架、没定价）就是 null，页面据此说「还没上架」，
       不假装有货。 */
    let rows = sqlx::query(
        r#"SELECT p.id, p.code, p.name, p.sub_title, p.category, p.kind, p.fulfillment_kind,
                  p.hero_image_url, p.tags, p.description_md,
                  lo.price_minor AS from_price_minor, lo.currency AS from_currency
           FROM product p
           LEFT JOIN LATERAL (
              SELECT pb.price_minor, pb.currency
                FROM sku s
                JOIN price_book pb ON pb.sku_id = s.id AND pb.status='active'
                 AND pb.region IN ($1, 'global') AND pb.platform IN ($2, 'all')
                 AND pb.effective_from <= NOW()
                 AND (pb.effective_to IS NULL OR pb.effective_to > NOW())
               WHERE s.product_id = p.id AND s.status='active'
               ORDER BY pb.price_minor ASC LIMIT 1
           ) lo ON TRUE
           WHERE p.status='listed'
             AND $1 = ANY(p.available_regions)
             AND ($2 = 'all' OR $2 = ANY(p.available_platforms))
             AND ($3::text IS NULL OR p.category = $3)
             AND ($4::text IS NULL OR p.kind = $4)
             AND ($5::text IS NULL OR EXISTS (
                   SELECT 1 FROM sku s2
                   WHERE s2.product_id = p.id
                     AND s2.status = 'active'
                     AND s2.villager_id = $5))
           ORDER BY p.sort_weight DESC, p.created_at DESC"#,
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
    /* 御守是【一个人】。这一屏是决定掏不掏钱的地方，而原先它只说
       「御守 · ¥99 · 买下之后寄一枚实物御守给你，扫开它，这位不完人就住进你的村子」——
       没有名字、没有脸，连指代都只能写「这位不完人」。
       他刚点的是「丹增 · 请回家」，落地却是一件匿名的商品。
       村民绑在 sku 上（`sku.villager_id`），所以这里顺着 sku 把人取出来。
       不是御守的商品（香、报告）取不到，就是 null —— 页面据此决定说不说。 */
    let 是谁 = sqlx::query(
        r#"SELECT v.id, v.name, v.title, COALESCE(a.plain, a.name) AS art_name, b.direction
             FROM sku s
             JOIN villager v ON v.id = s.villager_id
             LEFT JOIN art a ON a.key = v.art_key
             LEFT JOIN lack_bias b ON b.lack = v.lack
            WHERE s.product_id = $1 AND s.villager_id IS NOT NULL
            ORDER BY s.created_at LIMIT 1"#,
    ).bind(&id).fetch_optional(&st.db).await.map_err(map_db)?
     .map(|r| json!({
        "id": r.get::<String, _>("id"),
        "name": r.get::<String, _>("name"),
        "title": r.get::<Option<String>, _>("title"),
        "art": r.get::<Option<String>, _>("art_name"),
        "direction": r.get::<Option<String>, _>("direction"),
     }));

    Ok(Json(json!({
        "product": map_rows(vec![p]).into_iter().next().unwrap_or(J::Null),
        "skus": map_rows(skus),
        "villager": 是谁,
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

#[derive(Deserialize, Serialize)]
struct PreviewBody {
    lines: Vec<CreateLine>,
    #[serde(default)]
    coupon_codes: Vec<String>,
    region: Option<String>,
    channel_origin: Option<String>,
}

/// 下单之前先算一遍：这些东西加上这些券，一共多少。
///
/// 【券的折扣只有服务端算得准】——封顶、余额、活动有效期、
/// 多张券按余额依次算。客户端自己算一遍必然跟服务端不一致，
/// 而不一致的那一刻，用户是在看着客户端那个数按下付款的。
///
/// 不动库、不锁券。校验一条不少 —— 试算说得通、下单却被拒，
/// 跟试算说减 40、下单扣 50 是同一种欺骗。
async fn preview_order(
    State(st): State<AppState>, AuthedUser(claims): AuthedUser,
    Json(b): Json<PreviewBody>,
) -> Result<Json<J>, ApiError> {
    if b.lines.is_empty() {
        return Err(ApiError::bad("没说买什么"));
    }
    /* 小计要跟下单那一步【用同一条 SQL】——取价看区、看平台、看时段，
       抄一份简化版的话，试算与实扣就会在某些组合下对不上，
       而那种不一致只有在特定区 / 特定平台才显形。 */
    let region = b.region.clone().unwrap_or_else(|| "cn".to_string());
    let 平台 = b.channel_origin.clone().unwrap_or_else(|| "web".to_string());
    let mut subtotal: i64 = 0;
    let mut currency: Option<String> = None;
    for l in &b.lines {
        if l.qty <= 0 {
            return Err(ApiError::bad("数量要大于 0"));
        }
        let row = sqlx::query(
            r#"SELECT pb.price_minor, pb.currency
                 FROM sku s
                 LEFT JOIN LATERAL (
                   SELECT price_minor, currency FROM price_book
                   WHERE sku_id = s.id AND status='active'
                     AND region IN ($2, 'global')
                     AND platform IN ($3, 'all')
                     AND effective_from <= NOW()
                     AND (effective_to IS NULL OR effective_to > NOW())
                   ORDER BY effective_from DESC LIMIT 1
                 ) pb ON TRUE
                WHERE s.id=$1 AND s.status='active'"#,
        )
        .bind(&l.sku_id)
        .bind(&region)
        .bind(&平台)
        .fetch_optional(&st.db)
        .await?
        .ok_or_else(|| ApiError::bad(format!("sku {} 现在买不了", l.sku_id)))?;
        let unit: i64 = row
            .try_get("price_minor")
            .map_err(|_| ApiError::bad(format!("sku {} 现在没有价", l.sku_id)))?;
        let cur: String = row
            .try_get("currency")
            .map_err(|_| ApiError::bad(format!("sku {} 的价没有币种", l.sku_id)))?;
        match &currency {
            None => currency = Some(cur),
            Some(c) if *c != cur => return Err(ApiError::bad("这几件的币种不一样")),
            Some(_) => {}
        }
        subtotal += unit * l.qty as i64;
    }
    let (券们, discount) =
        app_coupon::preview(&st.db, &claims.sub, &region, subtotal, &b.coupon_codes).await?;

    Ok(Json(json!({
        "amount_subtotal_minor": subtotal,
        "amount_discount_minor": discount,
        "amount_total_minor": subtotal - discount,
        "currency": currency.unwrap_or_else(|| "CNY".into()),
        "coupons": 券们,
    })))
}

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
    /* `title` / `line_count` 是给「我买过的」那一列用的。
       没有它,那一列只显示得出订单号 —— 一串 UUID,读的人认不出自己买了什么。
       名字取【下单那一刻的 sku 快照】,不是 join 现在的 sku 表:
       商品改了名、下了架,单子上写的还该是当时买的那个东西。
       逐单再取一次详情也能拿到,但那是 N+1,而这里一次 LATERAL 就够。 */
    let rows = sqlx::query(
        r#"SELECT o.id, o.channel_origin, o.currency, o.amount_total_minor,
                  o.amount_paid_minor, o.amount_refunded_minor, o.status,
                  o.source_kind, o.expires_at, o.paid_at, o.fulfilled_at, o.created_at,
                  /* 取消的原因也要给。列表上每一行都写着「已取消」——
                     而超时取消跟买家自己点「不要了」是两件事，
                     混成一个词，买家会以为是自己做的（2026-09-02）。
                     详情那一条走 `SELECT *`，本来就带着它;
                     两处共用同一个前端类型，少给一个键就是声明落空。 */
                  o.cancel_reason,
                  l.title, l.line_count, sh.status AS ship_status
           FROM order_record o
           LEFT JOIN LATERAL (
             /* 【护身符那一笔要说出是谁】（2026-09-02 第三轮评审 · 转化路）。
                快照名是「护身符 · 单枚」，于是从商品页的「丹增」、
                确认屏的「丹增的护身符」、订单详情的「丹增的护身符」，
                一走到清单就变回一件匿名货 —— 买满三位之后
                「我买过的」是三行一模一样的「护身符 · 单枚 ¥99」。
                详情那一条早就为此专门解析了村民名（本文件下面那段），
                列表没有。

                名字取【现在库里的】而不是快照:村民改名是极少的事，
                而认不出是谁的代价比名字晚一天更新大得多 ——
                这跟详情那一处的取舍是同一句话。
                只对【会有人住进来】的那种拼（`fulfillment_kind='residency'`）:
                香也挂着苏合，但买香不是请她搬进来。 */
             SELECT (array_agg(
                       CASE WHEN p.fulfillment_kind = 'residency' AND v.name IS NOT NULL
                            THEN v.name || '的护身符'
                            ELSE ol.sku_snapshot_json->>'sku_name' END
                       ORDER BY ol.line_no))[1] AS title,
                    COUNT(*)::int AS line_count
             FROM order_line ol
             LEFT JOIN sku k ON k.id = ol.sku_id
             LEFT JOIN product p ON p.id = k.product_id
             LEFT JOIN villager v ON v.id = k.villager_id
             WHERE ol.order_id = o.id
           ) l ON TRUE
           /* 【包裹走到哪儿了，列表上也要说得出】（2026-09-05 · 25 计划）。
              `fulfilling` 在屏上是「备着」，而包裹可能早就在路上 ——
              点进去详情写的是「在路上了」，同一单两屏两个说法。
              一单多件包裹时取最近建的那一件:一单一包是常态，
              多包的那一档这一列本来也说不全，详情页才说得清。 */
           LEFT JOIN LATERAL (
             SELECT sp.status FROM shipment sp
              WHERE sp.order_id = o.id
              ORDER BY sp.created_at DESC LIMIT 1
           ) sh ON TRUE
           WHERE o.user_id=$1 AND ($2::text IS NULL OR o.status=$2)
           ORDER BY o.created_at DESC OFFSET $3 LIMIT $4"#,
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
    /* 御守是一个人 —— 这一单的行上要说得出是谁。
       快照名是「御守 · 单枚」，于是从商品页的「丹增 · 下山的武僧」
       走到结账屏，人就不见了，买家读到的是「我在买一件货」。
       名字取【现在库里的】而不是快照:村民改名是极少的事，
       而认不出是谁的代价，比名字晚一天更新大得多。 */
    /* 【挂着人 ≠ 是御守】。香也挂着苏合（`sku.villager_id`），
       但买香是寄一盒香给你，不是请她搬进来。判据是商品的 `fulfillment_kind`：
       `residency` 才会有人住进村里。

       这个等价错过三次（商品页的眉标、下单页的卡片名、这一页的明细名），
       每次都是各自在前端推断「有 villager_name 就是御守」——
       所以这里直接把答案给出去，不让调用方再猜。 */
    let 行上的人: std::collections::HashMap<String, (String, Option<String>, bool, String)> = sqlx::query(
        r#"SELECT ol.id AS line_id, v.name, b.direction, v.id AS vid,
                  (p.fulfillment_kind = 'residency') AS resident
             FROM order_line ol
             JOIN sku k ON k.id = ol.sku_id
             JOIN product p ON p.id = k.product_id
             JOIN villager v ON v.id = k.villager_id
             LEFT JOIN lack_bias b ON b.lack = v.lack
            WHERE ol.order_id = $1"#,
    ).bind(&id).fetch_all(&st.db).await.map_err(map_db)?
     .into_iter()
     .map(|r| (r.get::<String, _>("line_id"),
               (r.get::<String, _>("name"), r.get::<Option<String>, _>("direction"),
                r.get::<Option<bool>, _>("resident").unwrap_or(false),
                r.get::<String, _>("vid"))))
     .collect();
    let lines = sqlx::query("SELECT * FROM order_line WHERE order_id=$1 ORDER BY line_no")
        .bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    let payments = sqlx::query(
        "SELECT id, channel, amount_minor, currency, status, paid_at, expires_at, created_at FROM payment WHERE order_id=$1 ORDER BY created_at DESC",
    ).bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    let shipments = sqlx::query(
        "SELECT id, carrier_code, tracking_no, status, picked_up_at, delivered_at FROM shipment WHERE order_id=$1 ORDER BY created_at DESC",
    ).bind(&id).fetch_all(&st.db).await.map_err(map_db)?;
    /* 这一单里还有没有没扫开的御守（设计册 M3）。
       主按钮是「收到了，去扫开它」—— 订单的完成态不是「已签收」，
       是她住进村里。判据跟村子主屏那一条同一个来源，不各写一套。 */
    let to_scan = unmei_app::residency::unscanned_in_order(&st.db, &c.sub, &id).await?;
    /* 这一单里买的册子。御守的完成态是住进村里，报告的完成态是**你读到了** ——
       所以它跟「收到了，去扫开它」一样是这一屏的主按钮，不是一行小字。

       还没出的那些（`awaiting_natal`）也要给出来：一半的买家下单时还没填
       生辰，那一屏得说得出「还差你的生辰」并给一条去填的路，
       而不是把这一单显示成已完成。 */
    let reports = sqlx::query(
        r#"SELECT r.id, r.status, r.order_line_id
           FROM report r JOIN order_line ol ON ol.id = r.order_line_id
           WHERE ol.order_id = $1 AND r.user_id = $2
           ORDER BY ol.line_no"#,
    ).bind(&id).bind(&c.sub).fetch_all(&st.db).await.map_err(map_db)?;
    /* 【申请完退款，这一屏此前什么都不变】（2026-09-06 · 五路体验走查）。
       客户端按完只 `setData({ note: '退款已申请，等审核' })`，
       而紧接着的 `load()` 把 note 清掉 —— 那句话在屏上活不过一秒。
       而这个接口从前只返一个 `amount_refunded_minor`（审批之后才增加），
       所以屏上没有「审核中」这一态、没有退款单号可以念给客服。

       人这时只会做一件事:**再按一次**。 */
    let refunds = sqlx::query(
        r#"SELECT id, amount_minor, currency, status, reason_code,
                  approved_at, completed_at, created_at
           FROM refund WHERE order_id=$1 ORDER BY created_at DESC"#,
    ).bind(&id).fetch_all(&st.db).await.map_err(map_db)?;

    Ok(Json(json!({
        "order": map_rows(vec![o]).into_iter().next().unwrap_or(J::Null),
        /* 行上补一个顶层 `sku_name`。名字本来只在 `sku_snapshot_json` 里，
           而 `types/commerce.ts` 的 `OrderLine` 早就声明了顶层有它 ——
           两边对不上的后果不是报错，是**每一单的商品名都显示成 sku_id**
           （`sku-oma-t46166-13`）。2026-08-28 从截图上看见的。
           `check-api-shape` 够不着这一条：它比的是 `json!({…})` 里的键，
           而这一条走的是 `map_rows`，键来自 SQL 的列。 */
        "lines": map_rows(lines).into_iter().map(|mut l| {
            if let Some(o) = l.as_object_mut() {
                let name = o.get("sku_snapshot_json")
                    .and_then(|s| s.get("sku_name"))
                    .and_then(|n| n.as_str())
                    .map(|s| s.to_string());
                if let Some(n) = name { o.insert("sku_name".into(), J::String(n)); }
                /* 这一行封着谁。**不是御守也给这个键，值是 null** ——
                   「有时候有这个键、有时候没有」比「一直是 null」难对付得多:
                   前端得同时处理 undefined 与 null 两种缺席，
                   而动线那一支（check-api-shape-live）判的是「键在不在」，
                   条件给键会让它在某些数据下红、某些数据下绿。 */
                let who = o.get("id").and_then(|v| v.as_str())
                    .and_then(|lid| 行上的人.get(lid)).cloned();
                o.insert("villager_name".into(),
                         who.as_ref().map_or(J::Null, |(n, _, _, _)| J::String(n.clone())));
                /* 【村民 id】。头像按 id 取（engine/faces.js），只有名字取不到脸 ——
                   而这一屏原先根本没显示过脸:wxml 上写着 who，
                   ts 里却没有这个字段，从来没人给它赋过值。 */
                o.insert("villager_id".into(),
                         who.as_ref().map_or(J::Null, |(_, _, _, i)| J::String(i.clone())));
                /* 买了这一行，村里会不会多一个人。**不挂人的行也给这个键**，
                   值是 false —— 理由跟 villager_name 那条一样：
                   「有时候有这个键」比「一直有」难对付得多。 */
                o.insert("becomes_resident".into(),
                         J::Bool(who.as_ref().map_or(false, |(_, _, r, _)| *r)));
                /* 方向也给 —— 一单那一屏要拿它给脸配色。
                   不给的话页面只能自己引用自己的旧值，那是取不到就摆错色。 */
                o.insert("villager_direction".into(),
                         who.and_then(|(_, d, _, _)| d).map_or(J::Null, J::String));
            }
            l
        }).collect::<Vec<_>>(),
        "payments": map_rows(payments),
        "shipments": map_rows(shipments),
        "to_scan": to_scan,
        "reports": map_rows(reports),
        "refunds": map_rows(refunds),
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

    /* 【回给客户端的形状只声明一处】（2026-09-03 五路评审 · 架构审计）。
       `app_payment::outcome_payload` 早就在，而【没有任何人调它】——
       这里手写了同一份 JSON。两份各自演进的话，改了一处不改另一处
       没有任何东西会红，而客户端读的是这一处。 */
    Ok(Json(app_payment::outcome_payload(&pending.payment_id, &outcome)?))
}

// ─── Order · refund ─────────────────────────────────────────────
#[derive(Deserialize, Serialize)]
struct RefundBody {
    payment_id: Option<String>,
    amount_minor: Option<i64>, // 缺省 = 全额
    reason_code: String,
    reason_text: Option<String>,
}

async fn refund_my_order(
    State(st): State<AppState>, AuthedUser(c): AuthedUser, Path(id): Path<String>,
    headers: HeaderMap,
    Json(b): Json<RefundBody>,
) -> Result<Response, ApiError> {
    /* 【退款也是钱】（2026-09-03）。下单与支付都要幂等键，这一条一直不要 ——
       实测:一模一样的退款请求发两次，建出两张申请、合计 100 元。
       一次网络重试就够。用户看到「已提交」两回，
       后台多一张要处理的单子，而第二张永远批不下去
       （`request` 现在把在途的算进已退了）。

       路径带上订单 id，跟支付那一处同一个道理:
       同一个键用在两张单上没有意义，该被当成参数不同拒掉。 */
    let fp_body = serde_json::to_value(&b).unwrap_or(json!({}));
    let path = format!("/v1/orders/{id}/refund");
    let guard = match idem::begin_required(&st, &headers, Some(&c.sub), &path, &fp_body).await? {
        idem::Begin::Replay(resp) => return Ok(resp),
        idem::Begin::Proceed(g) => g,
    };
    let out = refund_my_order_inner(&st, &c.sub, &id, b).await;
    guard.settle(&st, &out).await;
    out.map(IntoResponse::into_response)
}

async fn refund_my_order_inner(
    st: &AppState, user: &str, id: &str, b: RefundBody,
) -> Result<Json<J>, ApiError> {
    let refund_id = app_refund::request(
        &st.db, id, user,
        b.payment_id, b.amount_minor,
        &b.reason_code, b.reason_text.as_deref(),
    ).await?;
    Ok(Json(json!({ "refund_id": refund_id, "status": "requested" })))
}

/// 这份订阅是不是他的。**每一条订阅接口都要先问这一句** ——
/// 订阅 id 是可猜的（`p25-sub-…`），不问就等于谁都能退别人的订。
async fn 是他的订阅(st: &AppState, sub_id: &str, user: &str) -> Result<(), ApiError> {
    let 主人: Option<String> =
        sqlx::query_scalar("SELECT user_id FROM subscription WHERE id=$1")
            .bind(sub_id)
            .fetch_optional(&st.db)
            .await
            .map_err(map_db)?;
    match 主人 {
        None => Err(ApiError::not_found("subscription")),
        Some(u) if u != user => Err(ApiError(AppError::Forbidden)),
        Some(_) => Ok(()),
    }
}

/// 不再续了。
///
/// **到期不续，不是立刻停** —— 这一期的钱已经付过，香也该照发。
/// 后端 `subscription::cancel(immediate=false)` 一直在，只是从来没有入口:
/// 屏上那句「用到 X 为止 —— 到期不再续」说得出这个状态，
/// 而用户没有任何办法把自己变成这个状态。
async fn cancel_my_subscription(
    State(st): State<AppState>, AuthedUser(c): AuthedUser, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    是他的订阅(&st, &id, &c.sub).await?;
    unmei_app::subscription::cancel(
        &st.db, &id, false, Some("用户自己在小程序里停的"),
        &unmei_app::Actor::user(&c.sub),
    ).await?;
    Ok(Json(json!({ "ok": true, "cancel_at_period_end": true })))
}

/// 补上这一期。
///
/// 扣不成的那两种（past_due / grace）屏上写着「再不补就断了」，
/// 而在这之前**屏上没有任何一个按得动的东西** —— 说了要紧的事，
/// 却不给做那件事的办法，比不说更差。
///
/// 它走的就是续期那一条路（`renew_due`）:那支复用「还开着的那张发票」,
/// 收上钱之后把周期推下去、状态推回 active，并给这一期开一张包裹。
/// 换句话说「补一期」跟「续一期」本来就是同一件事，只是谁触发的不同。
///
/// **收款仍是 mock**（跟 worker 那一侧一样，直接建一条 success 的 payment）——
/// 真机上的微信收银台在浏览器里根本不存在，这一步只有真机验得到。
async fn pay_my_subscription(
    State(st): State<AppState>, AuthedUser(c): AuthedUser, Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    是他的订阅(&st, &id, &c.sub).await?;
    let 结果 = unmei_app::subscription::renew_due(&st.db, &id).await?;
    Ok(Json(match 结果 {
        unmei_app::subscription::RenewOutcome::Renewed { period_end, .. } =>
            json!({ "ok": true, "paid": true, "current_period_end": period_end }),
        // 还没到期就来补，那是没事可补 —— 说清楚，不假装收了钱
        unmei_app::subscription::RenewOutcome::NotDue =>
            json!({ "ok": true, "paid": false, "why": "还没到期，这一期不用补" }),
        其他 =>
            json!({ "ok": false, "paid": false, "why": format!("{其他:?}") }),
    }))
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
                  s.created_at,
                  /* 【这一档每期发什么】（2026-09-05）。屏上原先一律说「续到 X」——
                     而一味香按月送每期真的会寄一盒香，那句话该是「下一盒 X 发」。
                     取自 `plan.entitlements_json`,不在页面里按 plan_id 写死:
                     写死的话，加一档就得再改一次前端。 */
                  p.entitlements_json->>'ships' AS ships,
                  /* 【它是哪件商品】。「订着的」那一屏底下摆着「还能订什么」,
                     而没有这一列的话，它会把用户此刻正订着的那一件也摆出来 ——
                     一张写着「看看 ›」的卡，点进去是他已经有的东西。
                     plan → sku → product 这条链库里本来就有，只是没发出来。 */
                  sk.product_id AS product_id
           FROM subscription s
                LEFT JOIN plan p  ON p.id = s.plan_id
                LEFT JOIN sku sk  ON sk.id = p.sku_id
           WHERE s.user_id=$1
           /* 【还在续的排前面】（2026-09-05 · 25 计划）。只按 created_at 排的话，
              一年前退掉的那一份会因为记录建得晚而顶在第一行 —— 而这一屏叫
              「订着的」，人点进来找的是他现在还订着什么。
              退了、到期了的仍然要列出来（那是他的台账），只是排在后面。 */
           ORDER BY (s.status IN ('trialing','active','past_due','grace','paused')) DESC,
                    s.current_period_end DESC NULLS LAST"#,
    ).bind(&c.sub).fetch_all(&st.db).await.map_err(map_db)?;
    Ok(Json(map_rows(rows)))
}

// ─── 券 ────────────────────────────────────────────────────────
#[derive(Deserialize)]
struct CouponsQ {
    #[serde(default = "default_region")] region: String,
}

/// 我手里有哪些券。
///
/// 【在这之前用户那一侧看不见任何一张券】。后台发得出绑人的券
/// （`POST /admin/commerce/coupons` 收 `owner_user_id`），库里那一列
/// 也一直存着，而客户端唯一跟券有关的东西是确认页上那个
/// 「有券码就填这儿」的格子 —— 也就是**他得先知道那串码**。
/// 运营补一张券，用户打开 app 什么都看不到。
async fn my_coupons(
    State(st): State<AppState>, AuthedUser(c): AuthedUser, Query(q): Query<CouponsQ>,
) -> Result<Json<Vec<app_coupon::MyCoupon>>, ApiError> {
    Ok(Json(app_coupon::mine(&st.db, &c.sub, &q.region).await?))
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
