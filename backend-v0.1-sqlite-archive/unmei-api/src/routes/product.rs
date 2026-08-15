use axum::{routing::get, Router, Json, extract::{State, Query}};
use serde::Deserialize;
use unmei_domain::ProductPublic;
use crate::state::AppState;
use crate::auth::ApiError;

pub fn router() -> Router<AppState> {
    Router::new().route("/v1/product", get(list))
}

#[derive(Debug, Deserialize)]
struct ListQ {
    category: Option<String>,
    #[serde(default = "default_region")] region: String,
    #[serde(default = "default_platform")] platform: String,
}
fn default_region() -> String { "cn".into() }
fn default_platform() -> String { "web".into() }

async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQ>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let rows = sqlx::query!(
        r#"SELECT id, name, sub_title, category, price_cn, image_urls,
                  stock, regions_avail, platforms_avail
           FROM product WHERE status='on_sale'"#
    ).fetch_all(&st.db).await?;
    let items: Vec<ProductPublic> = rows.into_iter().filter_map(|r| {
        let regs: Vec<String> = serde_json::from_str(&r.regions_avail).ok()?;
        let plats: Vec<String> = serde_json::from_str(&r.platforms_avail).ok()?;
        if !regs.iter().any(|x| x == &q.region) { return None; }
        if !plats.iter().any(|x| x == &q.platform) { return None; }
        if let Some(c) = q.category.as_deref() { if r.category != c { return None; } }
        let imgs: Vec<String> = serde_json::from_str(&r.image_urls).unwrap_or_default();
        let stock_status = if r.stock <= 0 { "售罄" }
            else if r.stock < 10 { "现货 · 紧俏" }
            else { "现货" };
        Some(ProductPublic {
            id: r.id, name: r.name, sub_title: r.sub_title,
            category: r.category,
            price_display: format!("¥{}", r.price_cn / 100),
            image_url: imgs.into_iter().next(),
            stock_status: stock_status.to_string(),
        })
    }).collect();
    Ok(Json(serde_json::json!({"items": items})))
}
