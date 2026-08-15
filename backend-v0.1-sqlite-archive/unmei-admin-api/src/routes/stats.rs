use axum::{routing::get, Router, Json, extract::{State, Query}};
use chrono::{Utc, Duration};
use serde::Deserialize;
use serde_json::json;
use crate::state::AppState;
use crate::auth::{Admin, ApiError};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/stats/dau", get(dau))
        .route("/admin/stats/naji_distribution", get(naji_dist))
        .route("/admin/stats/products_top", get(top_products))
}

#[derive(Debug, Deserialize)]
struct DauQ { days: Option<i64> }

async fn dau(
    State(st): State<AppState>,
    Query(q): Query<DauQ>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let days = q.days.unwrap_or(14).clamp(1, 90);
    let today = Utc::now().date_naive();
    let mut series = Vec::new();
    for i in (0..days).rev() {
        let d = today - Duration::days(i);
        let day_s = d.format("%Y-%m-%d").to_string();
        let day_like = format!("{day_s}%");
        let dau = sqlx::query!(
            "SELECT COUNT(DISTINCT user_id) as c FROM naji_record WHERE asked_at LIKE ?",
            day_like
        ).fetch_one(&st.db).await?.c;
        let cnt = sqlx::query!(
            "SELECT COUNT(*) as c FROM naji_record WHERE asked_at LIKE ?",
            day_like
        ).fetch_one(&st.db).await?.c;
        series.push(json!({"date": day_s, "dau": dau, "naji_count": cnt}));
    }
    Ok(Json(json!({"series": series})))
}

async fn naji_dist(
    State(st): State<AppState>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let rows = sqlx::query!(
        "SELECT gate, COUNT(*) as c FROM naji_record GROUP BY gate ORDER BY c DESC"
    ).fetch_all(&st.db).await?;
    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| json!({
        "gate": r.gate, "count": r.c
    })).collect();
    Ok(Json(json!({"items": items})))
}

async fn top_products(
    State(st): State<AppState>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let rows = sqlx::query!(
        r#"SELECT p.id, p.name, p.sales_count,
                  COUNT(n.recommended_product_id) as recommend_count
           FROM product p LEFT JOIN naji_record n ON n.recommended_product_id = p.id
           GROUP BY p.id ORDER BY recommend_count DESC LIMIT 10"#
    ).fetch_all(&st.db).await?;
    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| json!({
        "id": r.id, "name": r.name,
        "sales_count": r.sales_count,
        "recommend_count": r.recommend_count,
    })).collect();
    Ok(Json(json!({"items": items})))
}
