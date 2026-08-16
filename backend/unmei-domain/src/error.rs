//! 错误类型 — `AppError`(HTTP 边界)+ `DomainError`(业务逻辑 / state machine / 适配器)。

use serde::Serialize;
use thiserror::Error;

// ═══════════════════════════════ Domain 层 ══════════════════════════════
#[derive(Debug, Error)]
pub enum DomainError {
    #[error("illegal state transition: {from} → {to}")]
    IllegalStateTransition { from: String, to: String },

    #[error("not found: {0}")] NotFound(String),
    #[error("conflict: {0}")] Conflict(String),
    #[error("validation: {0}")] Validation(String),
    #[error("idempotency mismatch: {0}")] IdempotencyMismatch(String),
    #[error("blocked by risk rule {rule_id}: {action}")] RiskBlocked { rule_id: String, action: String },
    #[error("insufficient: {0}")] Insufficient(String),
    #[error("adapter: {0}")] Adapter(String),
    /// 持久化层失败。**刻意只收字符串** —— domain 不认识任何数据库驱动,
    /// 这个变体以前是 `Sqlx(#[from] sqlx::Error)`,等于让最内层依赖 sqlx。
    /// 转换发生在持久化层(见 `unmei-app` 的 `DbResultExt`)。
    #[error("repository: {0}")] Repository(String),
    #[error("serde: {0}")] Serde(#[from] serde_json::Error),
    #[error("internal: {0}")] Internal(String),
}

impl DomainError {
    pub fn http_status(&self) -> u16 {
        match self {
            Self::NotFound(_) => 404,
            Self::Conflict(_) | Self::IllegalStateTransition { .. } => 409,
            Self::Validation(_) => 422,
            Self::IdempotencyMismatch(_) => 409,
            Self::RiskBlocked { .. } => 423,
            Self::Insufficient(_) => 422,
            Self::Adapter(_) => 502,
            Self::Repository(_) | Self::Serde(_) | Self::Internal(_) => 500,
        }
    }
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFound(_) => "not_found",
            Self::Conflict(_) => "conflict",
            Self::IllegalStateTransition { .. } => "illegal_state_transition",
            Self::Validation(_) => "validation",
            Self::IdempotencyMismatch(_) => "idempotency_mismatch",
            Self::RiskBlocked { .. } => "risk_blocked",
            Self::Insufficient(_) => "insufficient",
            Self::Adapter(_) => "adapter",
            Self::Repository(_) => "repository",
            Self::Serde(_) => "serde",
            Self::Internal(_) => "internal",
        }
    }
}

// ═══════════════════════════════ HTTP 边界 ══════════════════════════════
#[derive(Debug, Error)]
pub enum AppError {
    #[error("invalid input: {0}")] BadRequest(String),
    #[error("unauthorized")] Unauthorized,
    #[error("forbidden")] Forbidden,
    #[error("not found: {0}")] NotFound(String),
    #[error("conflict: {0}")] Conflict(String),
    #[error("upstream(mingli) failure: {0}")] Upstream(String),
    #[error("internal: {0}")] Internal(String),
    #[error(transparent)] Domain(#[from] DomainError),
}

impl AppError {
    pub fn status(&self) -> u16 {
        match self {
            Self::BadRequest(_) => 400,
            Self::Unauthorized => 401,
            Self::Forbidden => 403,
            Self::NotFound(_) => 404,
            Self::Conflict(_) => 409,
            Self::Upstream(_) => 502,
            Self::Internal(_) => 500,
            Self::Domain(d) => d.http_status(),
        }
    }
    pub fn code(&self) -> &'static str {
        match self {
            Self::BadRequest(_) => "bad_request",
            Self::Unauthorized => "unauthorized",
            Self::Forbidden => "forbidden",
            Self::NotFound(_) => "not_found",
            Self::Conflict(_) => "conflict",
            Self::Upstream(_) => "upstream",
            Self::Internal(_) => "internal",
            Self::Domain(d) => d.code(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ApiErrorBody {
    pub error: String,
    pub code: String,
}

pub type ApiResult<T> = Result<T, AppError>;
