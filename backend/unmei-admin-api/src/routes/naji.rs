//! /admin/naji · 纳吉记录查询(管理面)
use axum::{routing::get, Router, Json, extract::{State, Query}};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use crate::state::AppState;
use crate::auth::{Admin, ApiError};

pub fn router() -> Router<AppState> {
    Router::new().route("/admin/naji", get(list))
}

#[derive(Debug, Deserialize)]
struct ListQ {
    page: Option<i64>, size: Option<i64>,
    user_id: Option<String>,
    gate: Option<String>,
    platform: Option<String>,
}

async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQ>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(50).clamp(1, 200);
    let offset = (page - 1) * size;
    let user_id = q.user_id.unwrap_or_default();
    let gate = q.gate.unwrap_or_default();
    let platform = q.platform.unwrap_or_default();

    let rows = sqlx::query(
        r#"SELECT n.id, n.user_id, n.asked_at, n.gate, n.direction, n.gate_explain,
                  n.suit_words, n.avoid_words,
                  u.nickname, u.platform, u.region
           FROM naji_record n
           JOIN app_user u ON u.id = n.user_id
           WHERE ($1 = '' OR n.user_id = $1)
             AND ($2 = '' OR n.gate = $2)
             AND ($3 = '' OR u.platform = $3)
           ORDER BY n.asked_at DESC LIMIT $4 OFFSET $5"#,
    ).bind(&user_id).bind(&gate).bind(&platform).bind(size).bind(offset)
     .fetch_all(&st.db).await?;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM naji_record")
        .fetch_one(&st.db).await?;
    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| json!({
        "id": r.get::<String, _>("id"),
        "user_id": r.get::<String, _>("user_id"),
        "nickname": r.get::<String, _>("nickname"),
        "platform": r.get::<String, _>("platform"),
        "region": r.get::<String, _>("region"),
        "asked_at": r.get::<DateTime<Utc>, _>("asked_at").to_rfc3339(),
        "gate": r.get::<String, _>("gate"),
        "direction": r.get::<String, _>("direction"),
        "gate_explain": r.get::<String, _>("gate_explain"),
        "suit_words": r.get::<serde_json::Value, _>("suit_words"),
        "avoid_words": r.get::<serde_json::Value, _>("avoid_words"),
    })).collect();
    Ok(Json(json!({"items": items, "page": page, "size": size, "total": total})))
}
