use axum::{routing::{get, post}, Router, Json, extract::{Path, State}};
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::Row;
use crate::state::AppState;
use crate::auth::{Admin, ApiError};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/activities", get(list))
        .route("/admin/activities/:id/registrations", get(registrations))
        .route("/admin/activity-registrations/:id/checkin", post(checkin))
}

async fn list(
    State(st): State<AppState>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let rows = sqlx::query(
        /* 【已报名多少人是数出来的，不是存着的】
           （2026-09-03 五路评审 · 架构审计）。
           `activity.current_count` 那一列已经删了 —— 它跟
           `activity_registration` 是两个真相源，而实测差着 92 个人：
           列里写着 92，表里零行，报名这条链根本没接。
           现在这个数就是名单本身的长度。 */
        r#"SELECT a.id, a.title, a.category, a.city, a.start_at, a.max_participants, a.status,
                  COUNT(r.id) FILTER (WHERE r.status='registered')::int4 AS current_count,
                  COUNT(r.id) FILTER (WHERE r.checked_in_at IS NOT NULL)::int4 AS checked_in_count
           FROM activity a
           LEFT JOIN activity_registration r ON r.activity_id = a.id
           GROUP BY a.id, a.title, a.category, a.city, a.start_at, a.max_participants, a.status
           ORDER BY a.start_at DESC"#
    ).fetch_all(&st.db).await?;
    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| {
        let max_participants: i32 = r.get("max_participants");
        let current_count: i32 = r.get("current_count");
        json!({
            "id": r.get::<String, _>("id"),
            "title": r.get::<String, _>("title"),
            "category": r.get::<String, _>("category"),
            "city": r.get::<Option<String>, _>("city"),
            "start_at": r.get::<DateTime<Utc>, _>("start_at"),
            "max_participants": max_participants,
            "current_count": current_count,
            "registration_rate": if max_participants > 0 {
                current_count * 100 / max_participants
            } else { 0 },
            "checked_in_count": r.get::<i32, _>("checked_in_count"),
            "status": r.get::<String, _>("status"),
        })
    }).collect();
    Ok(Json(json!({"items": items})))
}

/// 一场活动的报名名单。现场核名单、事后看到场率都靠它。
///
/// 【这一条以前不存在】——后台能看见「48/100 已报名」，
/// 点进去看那 48 个是谁却没有路。而报名这件事本身也没有路（见 activity.rs）。
async fn registrations(
    State(st): State<AppState>,
    admin: Admin,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    admin.requires_any_role(&["support", "operator"])?;
    let rows = sqlx::query(
        r#"SELECT r.id, r.user_id, r.status, r.registered_at, r.checked_in_at,
                  u.nickname, u.region
             FROM activity_registration r
             JOIN app_user u ON u.id = r.user_id
            WHERE r.activity_id = $1
            ORDER BY r.registered_at"#,
    ).bind(&id).fetch_all(&st.db).await?;
    let items: Vec<serde_json::Value> = rows.into_iter().map(|r| json!({
        "id": r.get::<String, _>("id"),
        "user_id": r.get::<String, _>("user_id"),
        // 匿名用户没有昵称，给空串而不是 null —— 跟 users.rs 那一处同一个理由
        "nickname": r.get::<Option<String>, _>("nickname").unwrap_or_default(),
        "region": r.get::<String, _>("region"),
        "status": r.get::<String, _>("status"),
        "registered_at": r.get::<DateTime<Utc>, _>("registered_at"),
        "checked_in_at": r.get::<Option<DateTime<Utc>>, _>("checked_in_at"),
    })).collect();
    Ok(Json(json!({"items": items})))
}

/// 现场签到。
///
/// 徽章「到过场」挂的动作是 `activity.checkin` —— 在这条路由之前
/// 全仓没有任何地方触发它，那一枚从建库起就发不出来。
async fn checkin(
    State(st): State<AppState>,
    admin: Admin,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    admin.requires_any_role(&["support", "operator"])?;
    unmei_app::activity::check_in(&st.db, &id, &unmei_app::actor::Actor::admin(&admin.0.sub)).await?;
    Ok(Json(json!({ "ok": true })))
}
