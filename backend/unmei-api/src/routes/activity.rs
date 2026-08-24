use axum::{routing::get, Router, Json, extract::{State, Query}};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::Row;
use unmei_domain::ActivityPublic;
use crate::state::AppState;
use crate::auth::ApiError;

pub fn router() -> Router<AppState> {
    Router::new().route("/v1/activity", get(list))
}

#[derive(Debug, Deserialize)]
struct ListQ {
    category: Option<String>,
    #[serde(default = "default_region")] region: String,
}
fn default_region() -> String { "cn".into() }

async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQ>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let rows = sqlx::query(
        r#"SELECT id, title, sub_title, category, banner_url, city,
                  start_at, max_participants, current_count, price_cn, regions_avail, status
           FROM activity WHERE status IN ('open','closed')"#
    ).fetch_all(&st.db).await?;
    let items: Vec<ActivityPublic> = rows.into_iter().filter_map(|r| {
        let regs: Vec<String> = serde_json::from_value(r.get("regions_avail")).ok()?;
        if !regs.iter().any(|x| x == &q.region) { return None; }
        let category: String = r.get("category");
        if let Some(c) = q.category.as_deref() { if category != c { return None; } }
        let price_cn: i32 = r.get("price_cn");
        let price = if price_cn > 0 {
            format!("¥{}", price_cn / 100)
        } else { "免费".to_string() };
        Some(ActivityPublic {
            id: r.get("id"), title: r.get("title"), sub_title: r.get("sub_title"),
            category, banner_url: r.get("banner_url"), city: r.get("city"),
            start_at: r.get::<DateTime<Utc>, _>("start_at").to_rfc3339(),
            max_participants: r.get("max_participants"),
            current_count: r.get("current_count"),
            price_display: price,
            status: r.get("status"),
        })
    }).collect();
    Ok(Json(serde_json::json!({"items": items})))
}
