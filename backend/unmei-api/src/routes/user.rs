use axum::{routing::{get, patch}, Router, Json, extract::State};
use serde::Deserialize;
use unmei_domain::UserPublic;
use crate::state::AppState;
use crate::auth::{AuthedUser, ApiError};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/user/me", get(me).patch(patch_me))
}

async fn me(
    State(st): State<AppState>,
    AuthedUser(claims): AuthedUser,
) -> Result<Json<UserPublic>, ApiError> {
    let u = sqlx::query!(
        "SELECT id, nickname, avatar_url, platform, region, locale, active_natal_id, is_anonymous
         FROM app_user WHERE id = $1", claims.sub
    ).fetch_one(&st.db).await?;
    Ok(Json(UserPublic {
        id: u.id, nickname: u.nickname, avatar_url: u.avatar_url,
        platform: u.platform, region: u.region, locale: u.locale,
        active_natal_id: u.active_natal_id, is_anonymous: u.is_anonymous,
    }))
}

#[derive(Debug, Deserialize)]
struct PatchReq {
    nickname: Option<String>,
    avatar_url: Option<String>,
    locale: Option<String>,
}

async fn patch_me(
    State(st): State<AppState>,
    AuthedUser(claims): AuthedUser,
    Json(req): Json<PatchReq>,
) -> Result<Json<UserPublic>, ApiError> {
    if let Some(n) = req.nickname { sqlx::query!("UPDATE app_user SET nickname=$1 WHERE id=$2", n, claims.sub).execute(&st.db).await?; }
    if let Some(a) = req.avatar_url { sqlx::query!("UPDATE app_user SET avatar_url=$1 WHERE id=$2", a, claims.sub).execute(&st.db).await?; }
    if let Some(l) = req.locale { sqlx::query!("UPDATE app_user SET locale=$1 WHERE id=$2", l, claims.sub).execute(&st.db).await?; }
    me(State(st), AuthedUser(claims)).await
}
