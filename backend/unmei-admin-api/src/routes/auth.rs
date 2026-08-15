use axum::{routing::post, Router, Json, extract::State};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use serde::Deserialize;
use serde_json::json;
use crate::state::AppState;
use crate::auth::{issue, ApiError};
use unmei_domain::AppError;

pub fn router() -> Router<AppState> {
    Router::new().route("/admin/auth/login", post(login))
}

#[derive(Debug, Deserialize)]
struct LoginReq { email: String, password: String }

async fn login(
    State(st): State<AppState>,
    Json(req): Json<LoginReq>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let row = sqlx::query!(
        "SELECT id, email, password_hash, name, roles, region_scope, is_active FROM admin_user WHERE email=$1",
        req.email
    ).fetch_optional(&st.db).await?;
    let row = row.ok_or(ApiError(AppError::Unauthorized))?;
    if !row.is_active { return Err(ApiError(AppError::Forbidden)); }

    let parsed = PasswordHash::new(&row.password_hash)
        .map_err(|_| ApiError(AppError::Internal("invalid hash".into())))?;
    if Argon2::default().verify_password(req.password.as_bytes(), &parsed).is_err() {
        return Err(ApiError(AppError::Unauthorized));
    }

    let roles: Vec<String> = serde_json::from_value(row.roles.clone()).unwrap_or_default();
    let region_scope: Vec<String> = row.region_scope.clone();
    sqlx::query!("UPDATE admin_user SET last_login_at=NOW() WHERE id=$1", row.id)
        .execute(&st.db).await?;

    let token = issue(&row.id, &row.name, &roles, &region_scope, &st.jwt_secret, 8 * 3600)
        .map_err(ApiError::from)?;
    Ok(Json(json!({
        "token": token, "name": row.name, "roles": roles,
        "region_scope": region_scope,
        "expires_in": 8*3600
    })))
}
