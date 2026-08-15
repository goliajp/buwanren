use axum::{routing::get, Router, Json, extract::{State, Query}};
use serde::Deserialize;
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
    let rows = sqlx::query!(
        r#"SELECT id, title, sub_title, category, banner_url, city,
                  start_at, max_participants, current_count, price_cn, regions_avail, status
           FROM activity WHERE status IN ('open','closed')"#
    ).fetch_all(&st.db).await?;
    let items: Vec<ActivityPublic> = rows.into_iter().filter_map(|r| {
        let regs: Vec<String> = serde_json::from_value(r.regions_avail.clone()).ok()?;
        if !regs.iter().any(|x| x == &q.region) { return None; }
        if let Some(c) = q.category.as_deref() { if r.category != c { return None; } }
        let price = if r.price_cn > 0 {
            format!("¥{}", r.price_cn / 100)
        } else { "免费".to_string() };
        Some(ActivityPublic {
            id: r.id, title: r.title, sub_title: r.sub_title,
            category: r.category, banner_url: r.banner_url, city: r.city,
            start_at: r.start_at.to_rfc3339(),
            max_participants: r.max_participants as i32,
            current_count: r.current_count as i32,
            price_display: price,
            status: r.status,
        })
    }).collect();
    Ok(Json(serde_json::json!({"items": items})))
}
