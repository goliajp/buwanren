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
    /// 基础设施故障（数据库、上游 HTTP）。**Display 里没有那段原文** ——
    /// 响应体走的就是 Display，而这些原文里有表名、约束名，有时还有值。
    ///
    /// 2026-08-19 实测：删掉本命之后起卦，客户端收到的是
    /// `insert or update on table "naji_record" violates foreign key constraint …`。
    /// 那一行对排查的人有用，对拿到它的人也一样有用。
    ///
    /// 原文用 [`AppError::detail`] 取，只进日志。自己写的 500 仍然用
    /// [`AppError::Internal`]，那种消息是特意讲给调用方听的（如
    /// `no published quote for locale "en"`）。
    #[error("internal error")] Infra(String),
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
            Self::Infra(_) => 500,
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
            Self::Infra(_) => "internal",
            Self::Domain(d) => d.code(),
        }
    }
}

impl AppError {
    /// 不该发给客户端、但必须进日志的那一段。
    ///
    /// `Infra` 与 `Domain(Repository(..))` 都算 —— 后者是持久化层
    /// 把 `sqlx::Error` 转成字符串之后的样子，内容同样是库的原文。
    pub fn detail(&self) -> Option<&str> {
        match self {
            Self::Infra(d) => Some(d),
            Self::Domain(DomainError::Repository(d)) => Some(d),
            _ => None,
        }
    }

    /// 发给客户端的那句话。
    ///
    /// 【库的原文不上屏】（2026-09-02 第四轮评审 · 工程审计）。
    /// `AppError::Domain` 是 `#[error(transparent)]`，于是
    /// `Domain(Repository("error returned from database: invalid byte
    /// sequence for encoding \"UTF8\": 0x00"))` 会原样出现在响应体里 ——
    /// 审计对 `/v1/orders` 的 `note` 塞一个 NUL 字节就复现了。
    /// 表名、约束名、编码细节都不该给到调用方，而 `Infra` 这一支
    /// 早就想清楚了（它的 Display 就是「internal error」）——
    /// 只是 `Repository` 走的是另一条路，没跟上。
    ///
    /// 排查要的东西不丢:原文由 `detail()` 交给日志。
    pub fn 出面(&self) -> String {
        match self {
            Self::Domain(DomainError::Repository(_)) => "internal error".to_string(),
            _ => self.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ApiErrorBody {
    pub error: String,
    pub code: String,
}

pub type ApiResult<T> = Result<T, AppError>;
