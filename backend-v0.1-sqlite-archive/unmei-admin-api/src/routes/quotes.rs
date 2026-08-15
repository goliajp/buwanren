use axum::{routing::{get, patch, delete}, Router, Json, extract::{State, Path, Query}};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;
use crate::state::AppState;
use crate::auth::{Admin, ApiError};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/quotes", get(list).post(create))
        .route("/admin/quotes/:id", patch(update).delete(remove))
}

#[derive(Debug, Deserialize)]
struct ListQ {
    book: Option<String>,
    status: Option<String>,
    q: Option<String>,
    page: Option<i64>, size: Option<i64>,
}

async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQ>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(30).clamp(1, 200);
    let off = (page - 1) * size;
    let book = q.book.unwrap_or_default();
    let status = q.status.unwrap_or_default();
    let search = q.q.unwrap_or_default();
    let like = format!("%{search}%");
    let rows = sqlx::query!(
        r#"SELECT id, book, chapter, text, locale, wuxing_affinity, gate_affinity,
                  sensitivity_score, status, created_at
           FROM quote
           WHERE (?1 = '' OR book = ?1)
             AND (?2 = '' OR status = ?2)
             AND (?3 = '' OR text LIKE ?4)
           ORDER BY created_at DESC LIMIT ?5 OFFSET ?6"#,
        book, status, search, like, size, off
    ).fetch_all(&st.db).await?;
    let total = sqlx::query!("SELECT COUNT(*) as c FROM quote").fetch_one(&st.db).await?.c;
    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| json!({
        "id": r.id, "book": r.book, "chapter": r.chapter, "text": r.text,
        "locale": r.locale,
        "wuxing": serde_json::from_str::<serde_json::Value>(&r.wuxing_affinity).unwrap_or(json!([])),
        "gate":   serde_json::from_str::<serde_json::Value>(&r.gate_affinity).unwrap_or(json!([])),
        "sensitivity": r.sensitivity_score,
        "status": r.status,
        "created_at": r.created_at,
    })).collect();
    Ok(Json(json!({"items": items, "page": page, "size": size, "total": total})))
}

#[derive(Debug, Deserialize)]
struct CreateReq {
    book: String, chapter: Option<String>, text: String,
    #[serde(default = "default_locale")] locale: String,
    #[serde(default)] wuxing_affinity: Vec<String>,
    #[serde(default)] gate_affinity: Vec<String>,
    #[serde(default = "default_sensitivity")] sensitivity_score: i64,
}
fn default_locale() -> String { "zh-CN".into() }
fn default_sensitivity() -> i64 { 1 }

async fn create(
    State(st): State<AppState>,
    a: Admin,
    Json(r): Json<CreateReq>,
) -> Result<Json<serde_json::Value>, ApiError> {
    a.requires_role("content")?;
    let id = format!("q_{}", Uuid::new_v4().simple());
    let len = r.text.chars().count() as i64;
    let aff_w = serde_json::to_string(&r.wuxing_affinity)?;
    let aff_g = serde_json::to_string(&r.gate_affinity)?;
    sqlx::query!(
        r#"INSERT INTO quote (id, book, chapter, text, length, locale,
                              wuxing_affinity, gate_affinity, sensitivity_score, created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?)"#,
        id, r.book, r.chapter, r.text, len, r.locale, aff_w, aff_g, r.sensitivity_score, a.0.sub,
    ).execute(&st.db).await?;
    Ok(Json(json!({"id": id, "ok": true})))
}

#[derive(Debug, Deserialize)]
struct UpdateReq {
    text: Option<String>,
    wuxing_affinity: Option<Vec<String>>,
    gate_affinity: Option<Vec<String>>,
    sensitivity_score: Option<i64>,
    status: Option<String>,
}

async fn update(
    State(st): State<AppState>,
    Path(id): Path<String>,
    a: Admin,
    Json(r): Json<UpdateReq>,
) -> Result<Json<serde_json::Value>, ApiError> {
    a.requires_role("content")?;
    if let Some(t) = r.text {
        let len = t.chars().count() as i64;
        sqlx::query!("UPDATE quote SET text=?, length=? WHERE id=?", t, len, id).execute(&st.db).await?;
    }
    if let Some(w) = r.wuxing_affinity {
        let v = serde_json::to_string(&w)?;
        sqlx::query!("UPDATE quote SET wuxing_affinity=? WHERE id=?", v, id).execute(&st.db).await?;
    }
    if let Some(g) = r.gate_affinity {
        let v = serde_json::to_string(&g)?;
        sqlx::query!("UPDATE quote SET gate_affinity=? WHERE id=?", v, id).execute(&st.db).await?;
    }
    if let Some(s) = r.sensitivity_score {
        sqlx::query!("UPDATE quote SET sensitivity_score=? WHERE id=?", s, id).execute(&st.db).await?;
    }
    if let Some(s) = r.status {
        sqlx::query!("UPDATE quote SET status=? WHERE id=?", s, id).execute(&st.db).await?;
    }
    Ok(Json(json!({"ok": true})))
}

async fn remove(
    State(st): State<AppState>,
    Path(id): Path<String>,
    a: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    a.requires_role("content")?;
    sqlx::query!("UPDATE quote SET status='archived' WHERE id=?", id).execute(&st.db).await?;
    Ok(Json(json!({"ok": true})))
}
