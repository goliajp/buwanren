use axum::{routing::get, Router, Json, extract::State};
use serde_json::json;
use crate::state::AppState;
use crate::auth::{Admin, ApiError};

pub fn router() -> Router<AppState> {
    Router::new().route("/admin/activities", get(list))
}

async fn list(
    State(st): State<AppState>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let rows = sqlx::query!(
        r#"SELECT id, title, category, city, start_at, max_participants, current_count, status
           FROM activity ORDER BY start_at DESC"#
    ).fetch_all(&st.db).await?;
    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| json!({
        "id": r.id, "title": r.title, "category": r.category,
        "city": r.city, "start_at": r.start_at,
        "max_participants": r.max_participants,
        "current_count": r.current_count,
        "registration_rate": if r.max_participants > 0 {
            (r.current_count * 100 / r.max_participants) as i32
        } else { 0 },
        "status": r.status,
    })).collect();
    Ok(Json(json!({"items": items})))
}
