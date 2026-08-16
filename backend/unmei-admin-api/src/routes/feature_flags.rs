use axum::{routing::{get, patch}, Router, Json, extract::{State, Path}};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use crate::state::AppState;
use crate::auth::{Admin, ApiError};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/feature_flags", get(list))
        .route("/admin/feature_flags/:code", patch(update))
}

async fn list(
    State(st): State<AppState>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let rows = sqlx::query(
        "SELECT code, default_on, by_platform, by_region, description, updated_at FROM feature_flag ORDER BY code"
    ).fetch_all(&st.db).await?;
    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| json!({
        "code": r.get::<String, _>("code"),
        "default_on": r.get::<bool, _>("default_on"),
        "by_platform": r.get::<serde_json::Value, _>("by_platform"),
        "by_region": r.get::<serde_json::Value, _>("by_region"),
        "description": r.get::<Option<String>, _>("description"),
        "updated_at": r.get::<DateTime<Utc>, _>("updated_at").to_rfc3339(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

#[derive(Debug, Deserialize)]
struct UpdateReq {
    default_on: Option<bool>,
    by_platform: Option<serde_json::Value>,
    by_region: Option<serde_json::Value>,
}

async fn update(
    State(st): State<AppState>,
    Path(code): Path<String>,
    a: Admin,
    Json(r): Json<UpdateReq>,
) -> Result<Json<serde_json::Value>, ApiError> {
    a.requires_role("operator")?;
    if let Some(v) = r.default_on {
        sqlx::query("UPDATE feature_flag SET default_on=$1, updated_at=NOW() WHERE code=$2")
            .bind(v).bind(&code).execute(&st.db).await?;
    }
    if let Some(v) = r.by_platform {
        sqlx::query("UPDATE feature_flag SET by_platform=$1, updated_at=NOW() WHERE code=$2")
            .bind(v).bind(&code).execute(&st.db).await?;
    }
    if let Some(v) = r.by_region {
        sqlx::query("UPDATE feature_flag SET by_region=$1, updated_at=NOW() WHERE code=$2")
            .bind(v).bind(&code).execute(&st.db).await?;
    }
    Ok(Json(json!({"ok": true})))
}
