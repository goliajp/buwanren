use axum::{routing::get, Router, Json, extract::State, http::HeaderMap};
use unmei_domain::ClientConfig;
use crate::state::AppState;
use crate::auth::{try_claims, ApiError};

pub fn router() -> Router<AppState> {
    Router::new().route("/v1/config", get(config))
}

async fn config(
    State(st): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ClientConfig>, ApiError> {
    let (mut platform, mut region, mut locale) = ("web".to_string(), "cn".to_string(), "zh-CN".to_string());

    // 优先从 token 取
    let parts = build_parts(&headers);
    if let Some(c) = try_claims(&parts, &st.jwt_secret) {
        platform = c.plat;
        region = c.region;
    }
    if let Some(v) = headers.get("X-Platform").and_then(|v| v.to_str().ok()) {
        platform = v.to_string();
    }
    if let Some(v) = headers.get("X-Region").and_then(|v| v.to_str().ok()) {
        region = v.to_string();
    }
    if let Some(v) = headers.get("X-Locale").and_then(|v| v.to_str().ok()) {
        locale = v.to_string();
    }

    let rows = sqlx::query!(
        "SELECT code, default_on, by_platform, by_region FROM feature_flag"
    ).fetch_all(&st.db).await?;
    let mut flags = serde_json::Map::new();
    for r in rows {
        let by_p: serde_json::Value = serde_json::from_str(&r.by_platform).unwrap_or(serde_json::Value::Null);
        let by_r: serde_json::Value = serde_json::from_str(&r.by_region).unwrap_or(serde_json::Value::Null);
        let mut on = r.default_on != 0;
        if let Some(v) = by_p.get(&platform).and_then(|x| x.as_bool()) { on = v; }
        if let Some(v) = by_r.get(&region).and_then(|x| x.as_bool()) { on = v; }
        flags.insert(r.code, serde_json::Value::Bool(on));
    }

    Ok(Json(ClientConfig {
        platform, region, locale,
        flags: serde_json::Value::Object(flags),
    }))
}

fn build_parts(headers: &HeaderMap) -> axum::http::request::Parts {
    use axum::http::Request;
    let mut r = Request::new(());
    *r.headers_mut() = headers.clone();
    r.into_parts().0
}
