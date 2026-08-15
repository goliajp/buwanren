//! 旧版 stub · commerce v2 Dashboard 由 finance KPI 视图供给。
use axum::Router;
use crate::state::AppState;
pub fn router() -> Router<AppState> { Router::new() }
