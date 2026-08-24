//! `/admin/users` —— 后台的用户列表。
//!
//! 这条路由 2026-08-18 之前**不存在**,而控制台里那一页从初始提交起就在,
//! 侧边栏也挂着它 —— 运营点进去，前端请求 404，页面永远是空的。
//! 谁也不会红：前端拿到 404 就当没数据，构建管不着，路由冒烟也只打
//! 后端**自己有**的那些路由。是逐页走一遍才撞出来的。
//!
//! 字段照前端 `Users.tsx` 里 `UserRow` 声明的那几个给，**一个不多**：
//! 手机号、各家 openid、session key 那些它没要，这里也不给。
use axum::{extract::{Query, State}, routing::get, Json, Router};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;

use crate::auth::{Admin, ApiError};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/admin/users", get(list))
}

#[derive(Deserialize)]
struct Filter {
    #[serde(default = "one")]
    page: i64,
    #[serde(default = "thirty")]
    size: i64,
    #[serde(default)]
    q: String,
    #[serde(default)]
    platform: String,
    #[serde(default)]
    region: String,
}

fn one() -> i64 { 1 }
fn thirty() -> i64 { 30 }

async fn list(
    State(st): State<AppState>,
    _: Admin,
    Query(f): Query<Filter>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // 前端那一页的页码从 1 起（`useState(1)`），这里换算成 offset
    let size = f.size.clamp(1, 200);
    let page = f.page.max(1);
    let off = (page - 1) * size;
    let like = format!("%{}%", f.q);

    let rows = sqlx::query(
        r#"SELECT id, nickname, platform, region, locale, is_anonymous,
                  created_at, last_active_at
             FROM app_user
            WHERE ($1 = '' OR id ILIKE $2 OR nickname ILIKE $2)
              AND ($3 = '' OR platform = $3)
              AND ($4 = '' OR region = $4)
            ORDER BY created_at DESC OFFSET $5 LIMIT $6"#,
    )
    .bind(&f.q).bind(&like).bind(&f.platform).bind(&f.region)
    .bind(off).bind(size)
    .fetch_all(&st.db).await?;

    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM app_user
            WHERE ($1 = '' OR id ILIKE $2 OR nickname ILIKE $2)
              AND ($3 = '' OR platform = $3)
              AND ($4 = '' OR region = $4)"#,
    )
    .bind(&f.q).bind(&like).bind(&f.platform).bind(&f.region)
    .fetch_one(&st.db).await?;

    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| {
        json!({
            "id": r.get::<String, _>("id"),
            // 匿名用户没有昵称，给空串而不是 null —— 前端声明的是 string
            "nickname": r.get::<Option<String>, _>("nickname").unwrap_or_default(),
            "platform": r.get::<String, _>("platform"),
            "region": r.get::<String, _>("region"),
            "locale": r.get::<String, _>("locale"),
            "is_anonymous": r.get::<bool, _>("is_anonymous"),
            "created_at": r.get::<DateTime<Utc>, _>("created_at"),
            "last_active_at": r.get::<DateTime<Utc>, _>("last_active_at"),
        })
    }).collect();

    Ok(Json(json!({ "items": items, "total": total, "page": page, "size": size })))
}
