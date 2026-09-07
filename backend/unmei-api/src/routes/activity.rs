use axum::{routing::{get, post}, Router, Json, extract::{Path, State, Query}};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::Row;
use unmei_domain::ActivityPublic;
use crate::state::AppState;
use crate::auth::{AuthedUser, ApiError};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/activity", get(list))
        // 【报名这条链以前不存在】（2026-09-03 五路评审 · 架构审计）——
        // 活动看得见，报名没有路，而屏上还写着「48/100 已报名」
        .route("/v1/activity/mine", get(mine))
        .route("/v1/activity/:id/register", post(register))
        .route("/v1/activity/:id/cancel", post(cancel))
}

#[derive(Debug, Deserialize)]
struct ListQ {
    category: Option<String>,
    #[serde(default = "default_region")] region: String,
}
fn default_region() -> String { "cn".into() }

async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQ>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let rows = sqlx::query(
        r#"SELECT id, title, sub_title, category, banner_url, city,
                  start_at, max_participants, current_count, price_cn, regions_avail, status
           /* 已报名多少人从名单现算 —— `current_count` 那一列已经删了
              （20260903005）。它跟 activity_registration 是两个真相源，
              而实测差着 92 个人：列里写着数，表里零行。 */
           FROM (
             SELECT a.*, COUNT(r.id) FILTER (WHERE r.status='registered')::int4 AS current_count
               FROM activity a
               LEFT JOIN activity_registration r ON r.activity_id = a.id
              GROUP BY a.id
           /* 【办完的场不再列】（2026-09-03 五路评审 · 架构审计）。
              上一版只按 status 过滤 —— 而 status 没有任何人会去改：
              库里三场全是七八月的，到九月还挂着 `open`，
              用户点进去报名拿到「这场已经开始了」，而它就摆在那一屏上。
              「结束了没有」是时间说了算，不是一个要人去翻的开关。 */
           ) activity WHERE status IN ('open','closed') AND end_at > NOW()"#
    ).fetch_all(&st.db).await?;
    let items: Vec<ActivityPublic> = rows.into_iter().filter_map(|r| {
        let regs: Vec<String> = serde_json::from_value(r.get("regions_avail")).ok()?;
        if !regs.iter().any(|x| x == &q.region) { return None; }
        let category: String = r.get("category");
        if let Some(c) = q.category.as_deref() { if category != c { return None; } }
        let price_cn: i32 = r.get("price_cn");
        /* 【格式化只有一支】。原先是 `format!("¥{}", price_cn / 100)` ——
           整数除法截断（9950 会显示成 ¥99，少收五十），而且硬写 ¥。
           `money_display` 按币种定小数位、按币种给符号，跟前端
           `utils/money.ts` 的 `money()` 是同一套规矩
           （2026-09-01 五路评审 · 工程审计）。 */
        let price = if price_cn > 0 {
            crate::ai_compose::money_display(price_cn as i64, "CNY")
        } else { "免费".to_string() };
        Some(ActivityPublic {
            id: r.get("id"), title: r.get("title"), sub_title: r.get("sub_title"),
            category, banner_url: r.get("banner_url"), city: r.get("city"),
            start_at: r.get::<DateTime<Utc>, _>("start_at").to_rfc3339(),
            max_participants: r.get("max_participants"),
            current_count: r.get("current_count"),
            price_display: price,
            status: r.get("status"),
        })
    }).collect();
    Ok(Json(serde_json::json!({"items": items})))
}

/// 我报了哪些场。活动页拿它把按钮从「报名」换成「已报名」。
async fn mine(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
) -> Result<Json<serde_json::Value>, ApiError> {
    let ids = unmei_app::activity::mine(&st.db, &c.sub).await?;
    Ok(Json(serde_json::json!({ "activity_ids": ids })))
}

#[derive(Debug, Deserialize)]
struct RegQ {
    /// 报哪个区的场。不给就按用户自己的区 —— 而不是默认 cn：
    /// 默认成 cn 的话，一个日本用户点报名会拿到「没有这一场」，
    /// 而屏上明明列着它。
    region: Option<String>,
}

async fn register(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Path(id): Path<String>,
    Query(q): Query<RegQ>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let 区 = match q.region {
        Some(r) => r,
        None => sqlx::query_scalar::<_, String>("SELECT region FROM app_user WHERE id=$1")
            .bind(&c.sub)
            .fetch_one(&st.db)
            .await?,
    };
    let 报名号 = unmei_app::activity::register(&st.db, &id, &c.sub, &区).await?;
    Ok(Json(serde_json::json!({ "ok": true, "registration_id": 报名号 })))
}

async fn cancel(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    unmei_app::activity::cancel(&st.db, &id, &c.sub).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
