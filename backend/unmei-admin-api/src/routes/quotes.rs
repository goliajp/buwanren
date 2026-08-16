use axum::{routing::{get, patch}, Router, Json, extract::{State, Path, Query}};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
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
    let rows = sqlx::query(
        r#"SELECT id, book, chapter, text, locale, wuxing_affinity, gate_affinity,
                  sensitivity_score, status, created_at
           FROM quote
           WHERE ($1 = '' OR book = $1)
             AND ($2 = '' OR status = $2)
             AND ($3 = '' OR text LIKE $4)
           ORDER BY created_at DESC LIMIT $5 OFFSET $6"#,
    ).bind(&book).bind(&status).bind(&search).bind(&like).bind(size).bind(off)
     .fetch_all(&st.db).await?;
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM quote")
        .fetch_one(&st.db).await?;
    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| json!({
        "id": r.get::<String, _>("id"),
        "book": r.get::<String, _>("book"),
        "chapter": r.get::<Option<String>, _>("chapter"),
        "text": r.get::<String, _>("text"),
        "locale": r.get::<String, _>("locale"),
        "wuxing": r.get::<serde_json::Value, _>("wuxing_affinity"),
        "gate":   r.get::<serde_json::Value, _>("gate_affinity"),
        "sensitivity": r.get::<i32, _>("sensitivity_score"),
        "status": r.get::<String, _>("status"),
        "created_at": r.get::<DateTime<Utc>, _>("created_at"),
    })).collect();
    Ok(Json(json!({"items": items, "page": page, "size": size, "total": total})))
}

#[derive(Debug, Deserialize)]
struct CreateReq {
    book: String, chapter: Option<String>, text: String,
    #[serde(default = "default_locale")] locale: String,
    #[serde(default)] wuxing_affinity: Vec<String>,
    #[serde(default)] gate_affinity: Vec<String>,
    #[serde(default = "default_sensitivity")] sensitivity_score: i32,
}
fn default_locale() -> String { "zh-CN".into() }
fn default_sensitivity() -> i32 { 1 }

async fn create(
    State(st): State<AppState>,
    a: Admin,
    Json(r): Json<CreateReq>,
) -> Result<Json<serde_json::Value>, ApiError> {
    a.requires_role("content")?;
    let id = format!("q_{}", Uuid::new_v4().simple());
    let len = r.text.chars().count() as i32;
    let aff_w = serde_json::to_value(&r.wuxing_affinity)?;
    let aff_g = serde_json::to_value(&r.gate_affinity)?;
    sqlx::query(
        r#"INSERT INTO quote (id, book, chapter, text, length, locale,
                              wuxing_affinity, gate_affinity, sensitivity_score, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)"#,
    ).bind(&id).bind(&r.book).bind(&r.chapter).bind(&r.text).bind(len).bind(&r.locale)
     .bind(aff_w).bind(aff_g).bind(r.sensitivity_score).bind(&a.0.sub)
     .execute(&st.db).await?;
    Ok(Json(json!({"id": id, "ok": true})))
}

#[derive(Debug, Deserialize)]
struct UpdateReq {
    text: Option<String>,
    wuxing_affinity: Option<Vec<String>>,
    gate_affinity: Option<Vec<String>>,
    sensitivity_score: Option<i32>,
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
        let len = t.chars().count() as i32;
        sqlx::query("UPDATE quote SET text=$1, length=$2 WHERE id=$3")
            .bind(&t).bind(len).bind(&id).execute(&st.db).await?;
    }
    if let Some(w) = r.wuxing_affinity {
        let v = serde_json::to_value(&w)?;
        sqlx::query("UPDATE quote SET wuxing_affinity=$1 WHERE id=$2")
            .bind(v).bind(&id).execute(&st.db).await?;
    }
    if let Some(g) = r.gate_affinity {
        let v = serde_json::to_value(&g)?;
        sqlx::query("UPDATE quote SET gate_affinity=$1 WHERE id=$2")
            .bind(v).bind(&id).execute(&st.db).await?;
    }
    if let Some(s) = r.sensitivity_score {
        sqlx::query("UPDATE quote SET sensitivity_score=$1 WHERE id=$2")
            .bind(s).bind(&id).execute(&st.db).await?;
    }
    if let Some(s) = r.status {
        sqlx::query("UPDATE quote SET status=$1 WHERE id=$2")
            .bind(&s).bind(&id).execute(&st.db).await?;
    }
    Ok(Json(json!({"ok": true})))
}

async fn remove(
    State(st): State<AppState>,
    Path(id): Path<String>,
    a: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    a.requires_role("content")?;
    sqlx::query("UPDATE quote SET status='archived' WHERE id=$1")
        .bind(&id).execute(&st.db).await?;
    Ok(Json(json!({"ok": true})))
}
