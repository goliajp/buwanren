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
        "SELECT id, email, password_hash, name, roles, is_active FROM admin_user WHERE email=?",
        req.email
    ).fetch_optional(&st.db).await?;
    let row = row.ok_or(ApiError(AppError::Unauthorized))?;
    if row.is_active == 0 { return Err(ApiError(AppError::Forbidden)); }

    let parsed = PasswordHash::new(&row.password_hash)
        .map_err(|_| ApiError(AppError::Internal("invalid hash".into())))?;
    if Argon2::default().verify_password(req.password.as_bytes(), &parsed).is_err() {
        return Err(ApiError(AppError::Unauthorized));
    }

    let roles: Vec<String> = serde_json::from_str(&row.roles).unwrap_or_default();
    let now_str = chrono::Utc::now().to_rfc3339();
    sqlx::query!("UPDATE admin_user SET last_login_at=? WHERE id=?", now_str, row.id)
        .execute(&st.db).await?;

    let token = issue(&row.id, &row.name, &roles, &st.jwt_secret, 8 * 3600)
        .map_err(ApiError::from)?;
    Ok(Json(json!({
        "token": token, "name": row.name, "roles": roles, "expires_in": 8*3600
    })))
}
