use axum::{routing::get, Router, Json};
use serde_json::json;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/v1/health", get(health))
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "service": "unmei-api",
        "version": env!("CARGO_PKG_VERSION"),
        "status": "ok",
    }))
}
