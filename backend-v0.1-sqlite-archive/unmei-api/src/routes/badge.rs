use axum::{routing::get, Router, Json, extract::State};
use unmei_domain::BadgePublic;
use crate::state::AppState;
use crate::auth::{AuthedUser, ApiError};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/badge", get(list))
        .route("/v1/user/me/badges", get(my))
}

async fn list(State(st): State<AppState>) -> Result<Json<Vec<BadgePublic>>, ApiError> {
    let rows = sqlx::query!(
        "SELECT id, code, name, description, icon_url, points FROM badge WHERE status='active'"
    ).fetch_all(&st.db).await?;
    let v: Vec<BadgePublic> = rows.into_iter().map(|r| BadgePublic {
        id: r.id, code: r.code, name: r.name,
        description: r.description, icon_url: r.icon_url,
        points: r.points as i32,
        earned: false, earned_at: None,
    }).collect();
    Ok(Json(v))
}

async fn my(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
) -> Result<Json<Vec<BadgePublic>>, ApiError> {
    let rows = sqlx::query!(
        r#"SELECT b.id, b.code, b.name, b.description, b.icon_url, b.points,
                  ub.earned_at
           FROM badge b LEFT JOIN user_badge ub ON ub.badge_id = b.id AND ub.user_id = ?1
           WHERE b.status='active'
           ORDER BY (ub.earned_at IS NOT NULL) DESC, b.points ASC"#,
        c.sub
    ).fetch_all(&st.db).await?;
    let v: Vec<BadgePublic> = rows.into_iter().map(|r| BadgePublic {
        id: r.id, code: r.code, name: r.name,
        description: r.description, icon_url: r.icon_url,
        points: r.points as i32,
        earned: r.earned_at.is_some(),
        earned_at: r.earned_at,
    }).collect();
    Ok(Json(v))
}
