use axum::{routing::{get, patch}, Router, Json, extract::{State, Path, Query}};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;
use crate::state::AppState;
use crate::auth::{Admin, ApiError};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/products", get(list).post(create))
        .route("/admin/products/:id", patch(update))
}

#[derive(Debug, Deserialize)]
struct ListQ { category: Option<String>, status: Option<String> }

async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQ>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let cat = q.category.unwrap_or_default();
    let st_s = q.status.unwrap_or_default();
    let rows = sqlx::query!(
        r#"SELECT id, name, sub_title, category, price_cn, stock, image_urls,
                  sales_count, status, regions_avail, platforms_avail, updated_at
           FROM product
           WHERE (?1 = '' OR category = ?1) AND (?2 = '' OR status = ?2)
           ORDER BY updated_at DESC"#,
        cat, st_s
    ).fetch_all(&st.db).await?;
    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| {
        let imgs: Vec<String> = serde_json::from_str(&r.image_urls).unwrap_or_default();
        json!({
            "id": r.id, "name": r.name, "sub_title": r.sub_title,
            "category": r.category,
            "price_display": format!("¥{}", r.price_cn / 100),
            "price_cn": r.price_cn,
            "stock": r.stock, "sales_count": r.sales_count,
            "status": r.status,
            "image_url": imgs.into_iter().next(),
            "regions": serde_json::from_str::<serde_json::Value>(&r.regions_avail).unwrap_or(json!([])),
            "platforms": serde_json::from_str::<serde_json::Value>(&r.platforms_avail).unwrap_or(json!([])),
            "updated_at": r.updated_at,
        })
    }).collect();
    Ok(Json(json!({"items": items})))
}

#[derive(Debug, Deserialize)]
struct CreateReq {
    name: String, sub_title: Option<String>, category: String,
    price_cn: i64,
    #[serde(default)] stock: i64,
    #[serde(default)] image_urls: Vec<String>,
    description: Option<String>,
    #[serde(default)] recommend_when_main_wuxing: Vec<String>,
}

async fn create(
    State(st): State<AppState>,
    a: Admin,
    Json(r): Json<CreateReq>,
) -> Result<Json<serde_json::Value>, ApiError> {
    a.requires_role("operator")?;
    let id = format!("p_{}", Uuid::new_v4().simple());
    let imgs = serde_json::to_string(&r.image_urls)?;
    let rec_w = serde_json::to_string(&r.recommend_when_main_wuxing)?;
    sqlx::query!(
        r#"INSERT INTO product (id, name, sub_title, category, price_cn, stock,
                                image_urls, description, recommend_when_main_wuxing)
           VALUES (?,?,?,?,?,?,?,?,?)"#,
        id, r.name, r.sub_title, r.category, r.price_cn, r.stock,
        imgs, r.description, rec_w,
    ).execute(&st.db).await?;
    Ok(Json(json!({"id": id, "ok": true})))
}

#[derive(Debug, Deserialize)]
struct UpdateReq {
    name: Option<String>,
    price_cn: Option<i64>,
    stock: Option<i64>,
    status: Option<String>,
}

async fn update(
    State(st): State<AppState>,
    Path(id): Path<String>,
    a: Admin,
    Json(r): Json<UpdateReq>,
) -> Result<Json<serde_json::Value>, ApiError> {
    a.requires_role("operator")?;
    if let Some(v) = r.name { sqlx::query!("UPDATE product SET name=?, updated_at=datetime('now') WHERE id=?", v, id).execute(&st.db).await?; }
    if let Some(v) = r.price_cn { sqlx::query!("UPDATE product SET price_cn=?, updated_at=datetime('now') WHERE id=?", v, id).execute(&st.db).await?; }
    if let Some(v) = r.stock { sqlx::query!("UPDATE product SET stock=?, updated_at=datetime('now') WHERE id=?", v, id).execute(&st.db).await?; }
    if let Some(v) = r.status { sqlx::query!("UPDATE product SET status=?, updated_at=datetime('now') WHERE id=?", v, id).execute(&st.db).await?; }
    Ok(Json(json!({"ok": true})))
}
