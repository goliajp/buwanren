//! JWT 鉴权 — 极简,headers 取 token,middleware 注入 user_id

use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode, header::AUTHORIZATION},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{encode, decode, EncodingKey, DecodingKey, Header, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use unmei_domain::{AppError, ApiErrorBody, DomainError};

use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,       // user_id
    pub exp: i64,
    pub plat: String,
    pub region: String,
}

pub fn issue(user_id: &str, plat: &str, region: &str, secret: &[u8], ttl_sec: i64) -> anyhow::Result<String> {
    let now = chrono::Utc::now().timestamp();
    let claims = Claims {
        sub: user_id.to_string(),
        exp: now + ttl_sec,
        plat: plat.to_string(),
        region: region.to_string(),
    };
    let tok = encode(&Header::new(Algorithm::HS256), &claims, &EncodingKey::from_secret(secret))?;
    Ok(tok)
}

pub fn decode_token(tok: &str, secret: &[u8]) -> Result<Claims, AppError> {
    decode::<Claims>(
        tok,
        &DecodingKey::from_secret(secret),
        &Validation::new(Algorithm::HS256),
    )
    .map(|d| d.claims)
    .map_err(|_| AppError::Unauthorized)
}

/// 从 Authorization: Bearer ... 取 claims;无 token 时返回 None(用于半公开接口)
pub fn try_claims(parts: &Parts, secret: &[u8]) -> Option<Claims> {
    let v = parts.headers.get(AUTHORIZATION)?.to_str().ok()?;
    let tok = v.strip_prefix("Bearer ").or_else(|| v.strip_prefix("bearer "))?;
    decode_token(tok, secret).ok()
}

/// Required-auth extractor
pub struct AuthedUser(pub Claims);

#[axum::async_trait]
impl FromRequestParts<AppState> for AuthedUser {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, ApiError> {
        let v = parts.headers.get(AUTHORIZATION).ok_or(ApiError(AppError::Unauthorized))?;
        let v = v.to_str().map_err(|_| ApiError(AppError::Unauthorized))?;
        let tok = v.strip_prefix("Bearer ").or_else(|| v.strip_prefix("bearer "))
            .ok_or(ApiError(AppError::Unauthorized))?;
        let claims = decode_token(tok, &state.jwt_secret).map_err(ApiError)?;
        Ok(AuthedUser(claims))
    }
}

// ─── Error wrapper for axum response ───────────────────────────
pub struct ApiError(pub AppError);

impl ApiError {
    pub fn bad(msg: impl Into<String>) -> Self { Self(AppError::BadRequest(msg.into())) }
    pub fn not_found(msg: impl Into<String>) -> Self { Self(AppError::NotFound(msg.into())) }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = StatusCode::from_u16(self.0.status()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        let body = ApiErrorBody { error: self.0.to_string(), code: self.0.code().to_string() };
        (status, Json(body)).into_response()
    }
}
impl From<AppError> for ApiError { fn from(e: AppError) -> Self { Self(e) } }
/// 用例层(`unmei-app`)的错误。状态码由 `DomainError::http_status()` 决定 ——
/// NotFound→404 / Conflict→409 / Validation→422 / IllegalStateTransition→409,
/// 路由不再手工判断该返回什么。
impl From<DomainError> for ApiError {
    fn from(e: DomainError) -> Self { Self(AppError::Domain(e)) }
}
impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self { Self(AppError::Internal(format!("db: {e}"))) }
}
impl From<reqwest::Error> for ApiError {
    fn from(e: reqwest::Error) -> Self { Self(AppError::Upstream(format!("http: {e}"))) }
}
impl From<serde_json::Error> for ApiError {
    fn from(e: serde_json::Error) -> Self { Self(AppError::Internal(format!("json: {e}"))) }
}
impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> Self { Self(AppError::Internal(e.to_string())) }
}
