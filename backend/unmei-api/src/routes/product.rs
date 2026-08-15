//! 旧版 stub · 由 commerce v2 CatalogService 取代。
use axum::Router;
use crate::state::AppState;
pub fn router() -> Router<AppState> { Router::new() }
