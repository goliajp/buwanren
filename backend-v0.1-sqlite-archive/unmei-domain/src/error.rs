//! 错误类型:HTTP 状态码 + 业务码,统一序列化为 JSON。

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("invalid input: {0}")] BadRequest(String),
    #[error("unauthorized")] Unauthorized,
    #[error("forbidden")] Forbidden,
    #[error("not found: {0}")] NotFound(String),
    #[error("conflict: {0}")] Conflict(String),
    #[error("upstream(mingli) failure: {0}")] Upstream(String),
    #[error("internal: {0}")] Internal(String),
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
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ApiErrorBody {
    pub error: String,
    pub code: String,
}

pub type ApiResult<T> = Result<T, AppError>;
