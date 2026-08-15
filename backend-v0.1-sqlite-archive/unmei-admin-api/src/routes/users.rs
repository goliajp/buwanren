use axum::{routing::get, Router, Json, extract::{State, Query, Path}};
use serde::Deserialize;
use serde_json::json;
use crate::state::AppState;
use crate::auth::{Admin, ApiError};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/users", get(list))
        .route("/admin/users/:id", get(detail))
}

#[derive(Debug, Deserialize)]
struct ListQ {
    page: Option<i64>,
    size: Option<i64>,
    platform: Option<String>,
    region: Option<String>,
    q: Option<String>,
}

async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQ>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * size;
    let search = q.q.unwrap_or_default();
    let like = format!("%{search}%");
    let platform = q.platform.unwrap_or_default();
    let region = q.region.unwrap_or_default();

    let rows = sqlx::query!(
        r#"SELECT id, nickname, platform, region, locale, is_anonymous, created_at, last_active_at
           FROM user
           WHERE (?1 = '' OR platform = ?1)
             AND (?2 = '' OR region = ?2)
             AND (?3 = '' OR nickname LIKE ?4 OR id LIKE ?4)
           ORDER BY last_active_at DESC LIMIT ?5 OFFSET ?6"#,
        platform, region, search, like, size, offset
    ).fetch_all(&st.db).await?;
    let total = sqlx::query!("SELECT COUNT(*) as c FROM user").fetch_one(&st.db).await?.c;
    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| json!({
        "id": r.id, "nickname": r.nickname,
        "platform": r.platform, "region": r.region, "locale": r.locale,
        "is_anonymous": r.is_anonymous != 0,
        "created_at": r.created_at, "last_active_at": r.last_active_at,
    })).collect();
    Ok(Json(json!({"items": items, "page": page, "size": size, "total": total})))
}

async fn detail(
    State(st): State<AppState>,
    Path(id): Path<String>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let u = sqlx::query!(
        r#"SELECT id, nickname, avatar_url, platform, region, locale, active_natal_id,
                  is_anonymous, is_banned, created_at, last_active_at
           FROM user WHERE id=?"#,
        id
    ).fetch_optional(&st.db).await?
    .ok_or(ApiError(unmei_domain::AppError::NotFound("user".into())))?;
    let n_count = sqlx::query!("SELECT COUNT(*) as c FROM naji_record WHERE user_id=?", id)
        .fetch_one(&st.db).await?.c;
    let o_count = sqlx::query!("SELECT COUNT(*) as c FROM order_record WHERE user_id=?", id)
        .fetch_one(&st.db).await?.c;
    let badges = sqlx::query!(
        "SELECT b.code, b.name, ub.earned_at FROM user_badge ub JOIN badge b ON b.id=ub.badge_id WHERE ub.user_id=?",
        id
    ).fetch_all(&st.db).await?;
    Ok(Json(json!({
        "user": {
            "id": u.id, "nickname": u.nickname, "avatar_url": u.avatar_url,
            "platform": u.platform, "region": u.region, "locale": u.locale,
            "active_natal_id": u.active_natal_id,
            "is_anonymous": u.is_anonymous != 0,
            "is_banned": u.is_banned != 0,
            "created_at": u.created_at, "last_active_at": u.last_active_at,
        },
        "stats": { "naji_count": n_count, "order_count": o_count },
        "badges": badges.into_iter().map(|b| json!({"code": b.code, "name": b.name, "earned_at": b.earned_at})).collect::<Vec<_>>(),
    })))
}
