use axum::{routing::get, Router, Json, extract::State};
use chrono::{Utc, Duration};
use serde_json::json;
use crate::state::AppState;
use crate::auth::{Admin, ApiError};

pub fn router() -> Router<AppState> {
    Router::new().route("/admin/dashboard/overview", get(overview))
}

async fn overview(
    State(st): State<AppState>,
    _: Admin,
) -> Result<Json<serde_json::Value>, ApiError> {
    // 4 大数字 + 实时纳吉日志 + DAU 7 天
    let total_users = sqlx::query!("SELECT COUNT(*) as c FROM user").fetch_one(&st.db).await?.c;
    let total_naji = sqlx::query!("SELECT COUNT(*) as c FROM naji_record").fetch_one(&st.db).await?.c;
    let total_orders = sqlx::query!("SELECT COUNT(*) as c FROM order_record WHERE status='paid' OR status='shipped' OR status='done'")
        .fetch_one(&st.db).await?.c;
    let revenue = sqlx::query!("SELECT COALESCE(SUM(total_amount), 0) as v FROM order_record WHERE status IN ('paid','shipped','done')")
        .fetch_one(&st.db).await?.v;

    let today = Utc::now().date_naive();
    let mut dau_series = Vec::new();
    for i in (0..7).rev() {
        let d = today - Duration::days(i);
        let day_s = d.format("%Y-%m-%d").to_string();
        let day_like = format!("{day_s}%");
        let dau = sqlx::query!(
            "SELECT COUNT(DISTINCT user_id) as c FROM naji_record WHERE asked_at LIKE ?",
            day_like
        ).fetch_one(&st.db).await?.c;
        dau_series.push(json!({"date": day_s, "dau": dau}));
    }

    let recent = sqlx::query!(
        r#"SELECT n.id, n.user_id, n.asked_at, n.gate, n.direction, u.nickname, u.platform
           FROM naji_record n JOIN user u ON u.id = n.user_id
           ORDER BY n.asked_at DESC LIMIT 8"#
    ).fetch_all(&st.db).await?;
    let recent_v: Vec<serde_json::Value> = recent.into_iter().map(|r| json!({
        "id": r.id, "user_id": r.user_id, "nickname": r.nickname, "platform": r.platform,
        "asked_at": r.asked_at, "gate": r.gate, "direction": r.direction,
    })).collect();

    Ok(Json(json!({
        "totals": {
            "users": total_users,
            "naji_count": total_naji,
            "orders": total_orders,
            "revenue_cents": revenue,
            "revenue_display": format!("¥{}", revenue / 100),
        },
        "dau_7d": dau_series,
        "recent_naji": recent_v,
    })))
}
