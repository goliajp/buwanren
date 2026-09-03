//! `/admin/users` —— 后台的用户列表。
//!
//! 这条路由 2026-08-18 之前**不存在**,而控制台里那一页从初始提交起就在,
//! 侧边栏也挂着它 —— 运营点进去，前端请求 404，页面永远是空的。
//! 谁也不会红：前端拿到 404 就当没数据，构建管不着，路由冒烟也只打
//! 后端**自己有**的那些路由。是逐页走一遍才撞出来的。
//!
//! 字段照前端 `Users.tsx` 里 `UserRow` 声明的那几个给，**一个不多**：
//! 手机号、各家 openid、session key 那些它没要，这里也不给。
//!
//! 2026-09-03 加了 `is_banned` —— 前端那一列要显示他现在进不进得来。
//! 加字段就把这段注释一起改，不然「一个不多」这句话本身就成了假的。
use axum::{extract::{Path, Query, State}, routing::{get, post}, Json, Router};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;

use crate::auth::{Admin, ApiError};
use crate::routes::commerce::{normalize_region_scoped, 这个对象归他管吗};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/users", get(list))
        .route("/admin/users/:id/ban", post(set_ban))
}

#[derive(Deserialize)]
struct Filter {
    #[serde(default = "one")]
    page: i64,
    #[serde(default = "thirty")]
    size: i64,
    #[serde(default)]
    q: String,
    #[serde(default)]
    platform: String,
    #[serde(default)]
    region: String,
}

fn one() -> i64 { 1 }
fn thirty() -> i64 { 30 }

async fn list(
    State(st): State<AppState>,
    admin: Admin,
    Query(f): Query<Filter>,
) -> Result<Json<serde_json::Value>, ApiError> {
    /* 【这一条既不分区也不分角色】（2026-09-03 五路评审 · 越权审计）。

       签名是 `_: Admin` —— token 有效就给全库的人。而它偏偏收一个
       `region` 参数，收下来只当过滤条件用，从不跟管理员的
       `region_scope` 对一下:`scope={hk}` 的管理员传 `region=cn`
       就把大陆全部用户拉出来，不传则连所有区一起拉。

       它掉在两支门禁中间:`check-admin-roles` 只看写方法（这是 GET），
       `check-admin-region` 只扫 commerce.rs（这在 users.rs）。
       两支都绿，而这一条一直敞着。

       看用户名单是客服与运营的日常，跟封人同一档 —— 角色照 `set_ban` 那条写。 */
    admin.requires_any_role(&["support", "operator"])?;
    let 想看的区 = if f.region.is_empty() { None } else { Some(f.region.clone()) };
    let 区 = normalize_region_scoped(&想看的区, &admin)?.unwrap_or_default();

    // 前端那一页的页码从 1 起（`useState(1)`），这里换算成 offset
    let size = f.size.clamp(1, 200);
    let page = f.page.max(1);
    let off = (page - 1) * size;
    let like = format!("%{}%", f.q);

    let rows = sqlx::query(
        r#"SELECT id, nickname, platform, region, locale, is_anonymous, is_banned,
                  created_at, last_active_at
             FROM app_user
            WHERE ($1 = '' OR id ILIKE $2 OR nickname ILIKE $2)
              AND ($3 = '' OR platform = $3)
              AND ($4 = '' OR region = $4)
            ORDER BY created_at DESC OFFSET $5 LIMIT $6"#,
    )
    .bind(&f.q).bind(&like).bind(&f.platform).bind(&区)
    .bind(off).bind(size)
    .fetch_all(&st.db).await?;

    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM app_user
            WHERE ($1 = '' OR id ILIKE $2 OR nickname ILIKE $2)
              AND ($3 = '' OR platform = $3)
              AND ($4 = '' OR region = $4)"#,
    )
    .bind(&f.q).bind(&like).bind(&f.platform).bind(&区)
    .fetch_one(&st.db).await?;

    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| {
        json!({
            "id": r.get::<String, _>("id"),
            // 匿名用户没有昵称，给空串而不是 null —— 前端声明的是 string
            "nickname": r.get::<Option<String>, _>("nickname").unwrap_or_default(),
            "platform": r.get::<String, _>("platform"),
            "region": r.get::<String, _>("region"),
            "locale": r.get::<String, _>("locale"),
            "is_anonymous": r.get::<bool, _>("is_anonymous"),
            "created_at": r.get::<DateTime<Utc>, _>("created_at"),
            "last_active_at": r.get::<DateTime<Utc>, _>("last_active_at"),
        })
    }).collect();

    Ok(Json(json!({ "items": items, "total": total, "page": page, "size": size })))
}

#[derive(Deserialize)]
struct BanBody {
    banned: bool,
    /// 为什么封 / 为什么放。**空的不收** —— 只有一个布尔值的话，
    /// 三个月后没人说得出当初为什么封了这个人。
    reason: String,
}

/// 封一个人 / 放一个人。
///
/// 【`is_banned` 这一列从建库起就在，而没有任何地方写它、也没有任何地方
/// 读它】（2026-09-03 查到）。一个建好了却不生效的开关比没有更糟:
/// 后台看着能封，封完那个人照常下单 —— 而客服会以为自己处理完了。
///
/// 现在两头都接上:这里写，`unmei-api` 的 `AuthedUser` 提取器读。
async fn set_ban(
    State(st): State<AppState>, admin: Admin, Path(id): Path<String>, Json(b): Json<BanBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    admin.requires_any_role(&["support", "operator"])?;    // 封人是客服日常，运营也要动得了
    // 封人也要分区 —— 香港的客服封不着大陆的用户
    这个对象归他管吗(&st.db, &admin, "app_user", &id).await?;
    if b.reason.trim().is_empty() {
        return Err(ApiError::from(unmei_domain::DomainError::Validation(
            "说一句为什么 —— 只有一个开关的话，三个月后没人说得出当初为什么封".into(),
        )));
    }
    let n = sqlx::query("UPDATE app_user SET is_banned=$1 WHERE id=$2")
        .bind(b.banned)
        .bind(&id)
        .execute(&st.db)
        .await
        .map_err(|e| ApiError(unmei_domain::AppError::Infra(format!("db: {e}"))))?
        .rows_affected();
    if n == 0 {
        return Err(ApiError::not_found("user"));
    }
    // 理由落在审计上 —— 中间件已经把请求体记进 diff 了，
    // 所以这里不另写一份（两份会各说各的）
    Ok(Json(json!({ "ok": true, "banned": b.banned })))
}
