use axum::{routing::get, Router, Json, extract::State};
use chrono::{DateTime, Utc};
use sqlx::Row;
use unmei_domain::{BadgePublic, 徽章进度};
use unmei_app::badge as app_badge;

use crate::state::AppState;
use crate::auth::{AuthedUser, ApiError};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/badge", get(list))
        .route("/v1/user/me/badges", get(my))
}

async fn list(State(st): State<AppState>) -> Result<Json<Vec<BadgePublic>>, ApiError> {
    let rows = sqlx::query(
        "SELECT id, code, name, description, glyph, icon_url, points FROM badge WHERE status='active'"
    ).fetch_all(&st.db).await?;
    let v: Vec<BadgePublic> = rows.into_iter().map(|r| BadgePublic {
        id: r.get("id"), code: r.get("code"), name: r.get("name"),
        description: r.get("description"), glyph: r.get("glyph"),
        icon_url: r.get("icon_url"),
        points: r.get("points"),
        earned: false, earned_at: None,
        // 公开那一份不认得你是谁，也就没有进度可言
        progress: None,
    }).collect();
    Ok(Json(v))
}

async fn my(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
) -> Result<Json<Vec<BadgePublic>>, ApiError> {
    let rows = sqlx::query(
        r#"SELECT b.id, b.code, b.name, b.description, b.glyph, b.icon_url, b.points, ub.earned_at
           FROM badge b LEFT JOIN user_badge ub ON ub.badge_id = b.id AND ub.user_id = $1
           WHERE b.status='active'
           -- `b.code` 是最后一道 tiebreaker。在它之前六枚的 points 全是 10，
           -- 也就是这一条 ORDER BY 实际上没有定序 —— 而页面在这个顺序上
           -- 再做一层「同一条路只给最近的那一枚」，于是那条 CTA 指给谁
           -- 由数据库心情决定（见 20260906002_badge_points.sql）
           ORDER BY (ub.earned_at IS NOT NULL) DESC, b.points ASC, b.code"#,
    ).bind(&c.sub).fetch_all(&st.db).await?;
    let 进度 = app_badge::进度表(&st.db, &c.sub).await?;
    let v: Vec<BadgePublic> = rows.into_iter().map(|r| {
        let earned_at: Option<DateTime<Utc>> = r.get("earned_at");
        let code: String = r.get("code");
        BadgePublic {
            id: r.get("id"), name: r.get("name"),
            description: r.get("description"), glyph: r.get("glyph"),
            icon_url: r.get("icon_url"),
            points: r.get("points"),
            earned: earned_at.is_some(),
            earned_at: earned_at.map(|t| t.to_rfc3339()),
            progress: 进度.get(&code).map(|p| 徽章进度 { have: p.有, need: p.要 }),
            code,
        }
    }).collect();
    Ok(Json(v))
}
