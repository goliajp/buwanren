//! /admin/naji · 纳吉记录查询(管理面)
use axum::{routing::get, Router, Json, extract::{State, Query}};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use crate::state::AppState;
use crate::auth::{Admin, ApiError};
use crate::routes::commerce::normalize_region_scoped;

pub fn router() -> Router<AppState> {
    Router::new().route("/admin/naji", get(list))
}

#[derive(Debug, Deserialize)]
struct ListQ {
    page: Option<i64>, size: Option<i64>,
    user_id: Option<String>,
    gate: Option<String>,
    platform: Option<String>,
    region: Option<String>,
}

/// 问签记录。
///
/// 【这一条从前谁都能看全库】（2026-09-06）。签名是 `_: Admin` —— token 有效
/// 就给所有人的记录，而它偏偏把 `u.region` 也 SELECT 出来放在屏上。
/// 实测：`region_scope={zh_hant}` 的管理员拿到的条数与超级管理员**逐字相同**。
///
/// 这一条比操作记录更该守：**问签是用户问的私事，不是台账**。
/// 他问了什么、哪一天问的、盘上给了什么答案 —— 一个管别的区的运营
/// 没有任何理由看得到。
///
/// `naji_record` 没有 region 列，但它有 `user_id`，而 `JOIN app_user`
/// 那一句本来就在 —— 按人的区过滤，不用迁移。
///
/// 顺带修 `total`：它原先是一句不带任何条件的 `COUNT(*)`，
/// 也就是说**筛过之后页码仍然按全库算** —— 按 gate 筛出 12 条，
/// 分页器照旧写着一千多页，翻到第二页是空的。
async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQ>,
    admin: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let region = normalize_region_scoped(&q.region, &admin)?;
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
             AND ($6::text IS NULL OR u.region = $6)
           ORDER BY n.asked_at DESC LIMIT $4 OFFSET $5"#,
    ).bind(&user_id).bind(&gate).bind(&platform).bind(size).bind(offset).bind(&region)
     .fetch_all(&st.db).await?;

    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM naji_record n
           JOIN app_user u ON u.id = n.user_id
           WHERE ($1 = '' OR n.user_id = $1)
             AND ($2 = '' OR n.gate = $2)
             AND ($3 = '' OR u.platform = $3)
             AND ($4::text IS NULL OR u.region = $4)"#,
    ).bind(&user_id).bind(&gate).bind(&platform).bind(&region)
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
