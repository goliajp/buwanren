use axum::{routing::post, Router, Json, extract::State};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
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
    let row = sqlx::query(
        "SELECT id, email, password_hash, name, roles, region_scope, is_active FROM admin_user WHERE email=$1",
    ).bind(&req.email).fetch_optional(&st.db).await?;
    let row = row.ok_or(ApiError(AppError::Unauthorized))?;
    if !row.get::<bool, _>("is_active") { return Err(ApiError(AppError::Forbidden)); }

    let id: String = row.get("id");
    let name: String = row.get("name");
    let password_hash: String = row.get("password_hash");

    let parsed = PasswordHash::new(&password_hash)
        .map_err(|_| ApiError(AppError::Internal("invalid hash".into())))?;
    if Argon2::default().verify_password(req.password.as_bytes(), &parsed).is_err() {
        return Err(ApiError(AppError::Unauthorized));
    }

    let roles: Vec<String> = serde_json::from_value(row.get::<serde_json::Value, _>("roles"))
        .unwrap_or_default();
    let region_scope: Vec<String> = row.get("region_scope");
    sqlx::query("UPDATE admin_user SET last_login_at=NOW() WHERE id=$1")
        .bind(&id).execute(&st.db).await?;

    let token = issue(&id, &name, &roles, &region_scope, &st.jwt_secret, 8 * 3600)
        .map_err(ApiError::from)?;
    Ok(Json(json!({
        "token": token, "name": name, "roles": roles,
        "region_scope": region_scope,
        "expires_in": 8*3600
    })))
}
