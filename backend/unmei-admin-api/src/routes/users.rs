//! 旧版 stub · users 管理待 commerce v2 重写。
use axum::Router;
use crate::state::AppState;
pub fn router() -> Router<AppState> { Router::new() }
