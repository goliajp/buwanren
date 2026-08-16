use axum::{routing::get, Router, Json, extract::State};
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::Row;
use crate::state::AppState;
use crate::auth::{Admin, ApiError};

pub fn router() -> Router<AppState> {
    Router::new().route("/admin/activities", get(list))
}

async fn list(
    State(st): State<AppState>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let rows = sqlx::query(
        r#"SELECT id, title, category, city, start_at, max_participants, current_count, status
           FROM activity ORDER BY start_at DESC"#
    ).fetch_all(&st.db).await?;
    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| {
        let max_participants: i32 = r.get("max_participants");
        let current_count: i32 = r.get("current_count");
        json!({
            "id": r.get::<String, _>("id"),
            "title": r.get::<String, _>("title"),
            "category": r.get::<String, _>("category"),
            "city": r.get::<Option<String>, _>("city"),
            "start_at": r.get::<DateTime<Utc>, _>("start_at"),
            "max_participants": max_participants,
            "current_count": current_count,
            "registration_rate": if max_participants > 0 {
                current_count * 100 / max_participants
            } else { 0 },
            "status": r.get::<String, _>("status"),
        })
    }).collect();
    Ok(Json(json!({"items": items})))
}
