use axum::{routing::{get, patch}, Router, Json, extract::{State, Path}};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use crate::state::AppState;
use crate::auth::{Admin, ApiError};
use unmei_domain::AppError;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/feature_flags", get(list))
        .route("/admin/feature_flags/:code", patch(update))
}

async fn list(
    State(st): State<AppState>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let rows = sqlx::query(
        "SELECT code, default_on, by_platform, by_region, description, updated_at FROM feature_flag ORDER BY code"
    ).fetch_all(&st.db).await?;
    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| json!({
        "code": r.get::<String, _>("code"),
        "default_on": r.get::<bool, _>("default_on"),
        "by_platform": r.get::<serde_json::Value, _>("by_platform"),
        "by_region": r.get::<serde_json::Value, _>("by_region"),
        "description": r.get::<Option<String>, _>("description"),
        "updated_at": r.get::<DateTime<Utc>, _>("updated_at").to_rfc3339(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

#[derive(Debug, Deserialize)]
struct UpdateReq {
    default_on: Option<bool>,
    by_platform: Option<serde_json::Value>,
    by_region: Option<serde_json::Value>,
}

/// 这一次动的是哪几个区的开关，他管得着吗。
///
/// 【这道守卫此前不存在】（2026-09-06 三路验证 · 运营那一路）。
/// `update` 只有 `requires_role("operator")` —— 而阿港（只管繁中）正是
/// `operator`，`by_region` 又是整块 JSON 覆盖写：他一次误点就能把某个功能
/// 在大陆关掉，且屏上那个格子只有 20×20px、一行里六个区并排、没有确认框。
/// 后台那一页的注释还写着「能不能改由后端那道守卫说了算，不靠这儿藏起来」——
/// 被指着的那道守卫是空的。
///
/// 判据是【差异】不是【整块】：只看这一次真改了值的那几个键。
/// 拿整块 JSON 比的话，一位分区管理员连读回来原样提交都会被拒 ——
/// 而那是他每次改自己那一格时必然发生的事（前端提交的就是整块）。
fn 动到的区他管得着吗(
    a: &Admin,
    旧: &serde_json::Value,
    新: &serde_json::Value,
) -> Result<(), ApiError> {
    let scope = &a.0.region_scope;
    if scope.is_empty() || scope.iter().any(|s| s == "global") {
        return Ok(());
    }
    let 旧图 = 旧.as_object().cloned().unwrap_or_default();
    let 新图 = 新.as_object().cloned().unwrap_or_default();
    // 两边的键并起来走一遍 —— 只看新的会漏掉「把某个区整条删掉」这一种改法
    let mut 键: Vec<&String> = 旧图.keys().chain(新图.keys()).collect();
    键.sort();
    键.dedup();
    for k in 键 {
        let 变了 = 旧图.get(k) != 新图.get(k);
        if 变了 && !scope.iter().any(|s| s == k) {
            return Err(ApiError(AppError::Forbidden));
        }
    }
    Ok(())
}

async fn update(
    State(st): State<AppState>,
    Path(code): Path<String>,
    a: Admin,
    Json(r): Json<UpdateReq>,
) -> Result<Json<serde_json::Value>, ApiError> {
    a.requires_role("operator")?;
    /* 开关名打错原先回 200 ok:true —— 后台上看着是改好了，实际一行没动。
       三条 UPDATE 都是条件执行的，靠哪一条的影响行数都判不准。 */
    let 现有 = sqlx::query("SELECT by_region FROM feature_flag WHERE code=$1")
        .bind(&code).fetch_optional(&st.db).await?;
    let Some(现有) = 现有 else {
        return Err(ApiError(AppError::NotFound(format!("feature_flag {code}"))));
    };
    /* 【总开关与平台开关是全局的】。`default_on` 与 `by_platform` 不分区 ——
       一位分区管理员改它们等于改所有区，所以这两样只让不限区的人动。 */
    let 不限 = a.0.region_scope.is_empty() || a.0.region_scope.iter().any(|s| s == "global");
    if !不限 && (r.default_on.is_some() || r.by_platform.is_some()) {
        return Err(ApiError(AppError::Forbidden));
    }
    if let Some(v) = r.by_region.as_ref() {
        动到的区他管得着吗(&a, &现有.get::<serde_json::Value, _>("by_region"), v)?;
    }
    if let Some(v) = r.default_on {
        sqlx::query("UPDATE feature_flag SET default_on=$1, updated_at=NOW() WHERE code=$2")
            .bind(v).bind(&code).execute(&st.db).await?;
    }
    if let Some(v) = r.by_platform {
        sqlx::query("UPDATE feature_flag SET by_platform=$1, updated_at=NOW() WHERE code=$2")
            .bind(v).bind(&code).execute(&st.db).await?;
    }
    if let Some(v) = r.by_region {
        sqlx::query("UPDATE feature_flag SET by_region=$1, updated_at=NOW() WHERE code=$2")
            .bind(v).bind(&code).execute(&st.db).await?;
    }
    Ok(Json(json!({"ok": true})))
}
