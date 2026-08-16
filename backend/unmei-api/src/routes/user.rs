use axum::{routing::get, Router, Json, extract::State};
use serde::Deserialize;
use unmei_domain::UserPublic;
use crate::state::AppState;
use crate::auth::{AuthedUser, ApiError};
use crate::routes::user_public_from_row;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/user/me", get(me).patch(patch_me))
}

async fn me(
    State(st): State<AppState>,
    AuthedUser(claims): AuthedUser,
) -> Result<Json<UserPublic>, ApiError> {
    let u = sqlx::query(
        "SELECT id, nickname, avatar_url, platform, region, locale, active_natal_id, is_anonymous
         FROM app_user WHERE id = $1",
    ).bind(&claims.sub).fetch_one(&st.db).await?;
    Ok(Json(user_public_from_row(&u)))
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
    if let Some(n) = req.nickname {
        sqlx::query("UPDATE app_user SET nickname=$1 WHERE id=$2")
            .bind(&n).bind(&claims.sub).execute(&st.db).await?;
    }
    if let Some(a) = req.avatar_url {
        sqlx::query("UPDATE app_user SET avatar_url=$1 WHERE id=$2")
            .bind(&a).bind(&claims.sub).execute(&st.db).await?;
    }
    if let Some(l) = req.locale {
        sqlx::query("UPDATE app_user SET locale=$1 WHERE id=$2")
            .bind(&l).bind(&claims.sub).execute(&st.db).await?;
    }
    me(State(st), AuthedUser(claims)).await
}
