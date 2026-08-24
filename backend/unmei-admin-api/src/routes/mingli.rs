use axum::{routing::get, Router, Json, extract::State};
use serde_json::json;
use crate::state::AppState;
use crate::auth::{Admin, ApiError};

pub fn router() -> Router<AppState> {
    Router::new().route("/admin/mingli/health", get(health))
}

async fn health(
    State(st): State<AppState>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let url = format!("{}/api/health", st.mingli_base);
    let r = st.http.get(&url).send().await;
    match r {
        Ok(resp) => {
            let status = resp.status();
            let body = resp.json::<serde_json::Value>().await.unwrap_or(json!({}));
            Ok(Json(json!({
                "reachable": status.is_success(),
                "status": status.as_u16(),
                "upstream": body,
                "base": st.mingli_base.as_ref(),
            })))
        }
        Err(e) => Ok(Json(json!({
            "reachable": false,
            "error": format!("{e}"),
            "base": st.mingli_base.as_ref(),
        }))),
    }
}
