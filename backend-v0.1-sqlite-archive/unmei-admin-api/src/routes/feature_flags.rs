use axum::{routing::{get, patch}, Router, Json, extract::{State, Path}};
use serde::Deserialize;
use serde_json::json;
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
    let rows = sqlx::query!(
        "SELECT code, default_on, by_platform, by_region, description, updated_at FROM feature_flag ORDER BY code"
    ).fetch_all(&st.db).await?;
    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| json!({
        "code": r.code, "default_on": r.default_on != 0,
        "by_platform": serde_json::from_str::<serde_json::Value>(&r.by_platform).unwrap_or(json!({})),
        "by_region": serde_json::from_str::<serde_json::Value>(&r.by_region).unwrap_or(json!({})),
        "description": r.description,
        "updated_at": r.updated_at,
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
    if let Some(v) = r.default_on { let i = v as i64;
        sqlx::query!("UPDATE feature_flag SET default_on=?, updated_at=datetime('now') WHERE code=?", i, code).execute(&st.db).await?;
    }
    if let Some(v) = r.by_platform { let s = serde_json::to_string(&v)?;
        sqlx::query!("UPDATE feature_flag SET by_platform=?, updated_at=datetime('now') WHERE code=?", s, code).execute(&st.db).await?;
    }
    if let Some(v) = r.by_region { let s = serde_json::to_string(&v)?;
        sqlx::query!("UPDATE feature_flag SET by_region=?, updated_at=datetime('now') WHERE code=?", s, code).execute(&st.db).await?;
    }
    Ok(Json(json!({"ok": true})))
}
