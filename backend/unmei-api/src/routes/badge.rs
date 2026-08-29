use axum::{routing::get, Router, Json, extract::State};
use chrono::{DateTime, Utc};
use sqlx::Row;
use unmei_domain::BadgePublic;
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
           ORDER BY (ub.earned_at IS NOT NULL) DESC, b.points ASC"#,
    ).bind(&c.sub).fetch_all(&st.db).await?;
    let v: Vec<BadgePublic> = rows.into_iter().map(|r| {
        let earned_at: Option<DateTime<Utc>> = r.get("earned_at");
        BadgePublic {
            id: r.get("id"), code: r.get("code"), name: r.get("name"),
            description: r.get("description"), glyph: r.get("glyph"),
            icon_url: r.get("icon_url"),
            points: r.get("points"),
            earned: earned_at.is_some(),
            earned_at: earned_at.map(|t| t.to_rfc3339()),
        }
    }).collect();
    Ok(Json(v))
}
