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
pub struct AdminClaims {
    pub sub: String,        // admin_id
    pub exp: i64,
    pub roles: Vec<String>,
    pub name: String,
    /// P1 6-cell:本 admin 可访问的 region 集合(super=全开;区域 admin=单个)
    /// 含 `"global"` 表示可访问集团聚合视图
    #[serde(default)]
    pub region_scope: Vec<String>,
}

pub fn issue(id: &str, name: &str, roles: &[String], region_scope: &[String], secret: &[u8], ttl_sec: i64) -> anyhow::Result<String> {
    let now = chrono::Utc::now().timestamp();
    let claims = AdminClaims {
        sub: id.to_string(), name: name.to_string(),
        roles: roles.to_vec(),
        region_scope: region_scope.to_vec(),
        exp: now + ttl_sec,
    };
    Ok(encode(&Header::new(Algorithm::HS256), &claims, &EncodingKey::from_secret(secret))?)
}

pub fn decode_token(tok: &str, secret: &[u8]) -> Result<AdminClaims, AppError> {
    decode::<AdminClaims>(tok, &DecodingKey::from_secret(secret), &Validation::new(Algorithm::HS256))
        .map(|d| d.claims)
        .map_err(|_| AppError::Unauthorized)
}

pub struct Admin(pub AdminClaims);
#[axum::async_trait]
impl FromRequestParts<AppState> for Admin {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, ApiError> {
        let v = parts.headers.get(AUTHORIZATION).ok_or(ApiError(AppError::Unauthorized))?;
        let v = v.to_str().map_err(|_| ApiError(AppError::Unauthorized))?;
        let tok = v.strip_prefix("Bearer ").or_else(|| v.strip_prefix("bearer "))
            .ok_or(ApiError(AppError::Unauthorized))?;
        let claims = decode_token(tok, &state.jwt_secret).map_err(ApiError)?;
        Ok(Admin(claims))
    }
}

impl Admin {
    pub fn requires_role(&self, role: &str) -> Result<(), ApiError> {
        if self.0.roles.iter().any(|r| r == role || r == "super") { Ok(()) }
        else { Err(ApiError(AppError::Forbidden)) }
    }
}

// ─── Error wrapper ────────────────────────────────────────────
pub struct ApiError(pub AppError);
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = StatusCode::from_u16(self.0.status()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        let body = ApiErrorBody { error: self.0.to_string(), code: self.0.code().to_string() };
        (status, Json(body)).into_response()
    }
}
impl From<AppError> for ApiError { fn from(e: AppError) -> Self { Self(e) } }
/// 用例层(`unmei-app`)的错误。状态码由 `DomainError::http_status()` 决定,
/// 路由不再手工判断该返回什么。
impl From<DomainError> for ApiError {
    fn from(e: DomainError) -> Self { Self(AppError::Domain(e)) }
}
impl ApiError {
    pub fn bad(msg: impl Into<String>) -> Self { Self(AppError::BadRequest(msg.into())) }
    pub fn not_found(msg: impl Into<String>) -> Self { Self(AppError::NotFound(msg.into())) }
}
impl From<sqlx::Error> for ApiError { fn from(e: sqlx::Error) -> Self { Self(AppError::Internal(format!("db: {e}"))) } }
impl From<reqwest::Error> for ApiError { fn from(e: reqwest::Error) -> Self { Self(AppError::Upstream(format!("http: {e}"))) } }
impl From<serde_json::Error> for ApiError { fn from(e: serde_json::Error) -> Self { Self(AppError::Internal(format!("json: {e}"))) } }
impl From<anyhow::Error> for ApiError { fn from(e: anyhow::Error) -> Self { Self(AppError::Internal(e.to_string())) } }
