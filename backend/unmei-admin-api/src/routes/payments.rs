//! 旧版 stub · 已被 commerce v2 替代(routes/commerce/payments.rs)。
use axum::Router;
use crate::state::AppState;
pub fn router() -> Router<AppState> { Router::new() }
