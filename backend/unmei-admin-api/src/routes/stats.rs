//! 旧版 stub · 由 finance.monthly_report + 物化视图供给。
use axum::Router;
use crate::state::AppState;
pub fn router() -> Router<AppState> { Router::new() }
