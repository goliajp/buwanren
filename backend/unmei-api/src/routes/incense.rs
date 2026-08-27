//! /v1/incense · 同步点香（设计册 E1）
//!
//! 每周四晚九点，村里一起点一支，烧二十五分钟。
//!
//! ## 场次是算出来的，不是种出来的
//!
//! **没有场次表**。「每周四 21:00 起烧 25 分钟」是一条规则；建了表就要有人
//! 每周去种一场，而漏种那一周的症状是「今晚这一屏不存在」——
//! 跟「还没到点」长得一模一样，没有人会发现。
//!
//! 落库的只有参与（`incense_lit`）。场次用它的开始时刻做标识。
//!
//! ## 不到点时这一屏不存在
//!
//! 设计册 10.7 写着：**不做「本周还没开始」的占位页**。所以不到点时
//! 这条接口回 `null`，客户端据此不开那一屏 —— 而不是开一屏说「还没开始」。

use axum::{routing::{get, post}, Json, Router};
use chrono::{Datelike, Duration, TimeZone, Timelike, Utc};
use serde_json::{json, Value as J};

use unmei_domain::AppError;

use crate::auth::{ApiError, AuthedUser};
use crate::state::AppState;

/* 几点点香是【配置】，不是常量。
   设计册写的是周四晚九点、烧二十五分钟，那是默认值；
   运营想挪一个钟头不该改代码重新发版。

   顺带它让这件事验得到：这一屏的行为一周只有二十五分钟能碰上，
   而「一周只有二十五分钟能验」跟「验不到」实际上是一回事。
   把规则做成可配的，就能在别的时刻起一个实例把它走一遍 ——
   这跟【伪造当前时刻】不同：伪造时间是测试后门，可配时刻是真功能。 */
fn 环境数(名: &str, 默认: i64) -> i64 {
    std::env::var(名).ok().and_then(|v| v.parse().ok()).unwrap_or(默认)
}

/// 周几。0 = 周一 … 3 = 周四（`num_days_from_monday`）
fn 周几() -> u32 { 环境数("UNMEI_INCENSE_WEEKDAY", 3).clamp(0, 6) as u32 }
/// 上海时间几点起
fn 起点小时() -> u32 { 环境数("UNMEI_INCENSE_HOUR", 21).clamp(0, 23) as u32 }
/// 烧多久（秒）。设计册上写的是「约 25:00」
fn 烧多久() -> i64 { 环境数("UNMEI_INCENSE_MINUTES", 25).clamp(1, 240) * 60 }

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/incense", get(now))
        .route("/v1/incense/lit", post(lit))
}

/// 现在在不在一场里。在 → (场次标识, 开始时刻 UTC)；不在 → None。
///
/// 时区按上海算，跟问签那边的 `today_shanghai` 同一套 —— 用户在哪儿都一样，
/// 「一起点」的意思是同一个时刻，不是各自的本地九点。
fn 这一场() -> Option<(String, chrono::DateTime<Utc>)> {
    let 沪 = Utc::now() + Duration::hours(8);
    if 沪.weekday().num_days_from_monday() != 周几() {
        return None;
    }
    let 起点 = 起点小时();
    let 起 = 沪.date_naive().and_hms_opt(起点, 0, 0)?;
    let 现在秒 = (沪.naive_utc() - 起).num_seconds();
    if !(0..烧多久()).contains(&现在秒) {
        return None;
    }
    // 场次标识：那一晚的日期 + 起点小时。一眼看得出是哪一场。
    let key = format!("{}T{:02}", 沪.date_naive(), 起点);
    let 起_utc = Utc.from_utc_datetime(&(起 - Duration::hours(8)));
    Some((key, 起_utc))
}

async fn now(
    axum::extract::State(st): axum::extract::State<AppState>,
    AuthedUser(c): AuthedUser,
) -> Result<Json<J>, ApiError> {
    let Some((key, 起)) = 这一场() else {
        // 不到点这一屏不存在 —— 不给「还没开始」的占位内容
        return Ok(Json(J::Null));
    };

    /* 人数与「我点了没有」分开取，而且**人数取不到不该让整条挂掉** ——
       设计册 10.7：「人数取不到就不显示那一行，香照点」。
       所以这里失败也只是少一个字段，不是 500。 */
    let 几个人: Option<i64> = sqlx::query_scalar(
        "SELECT count(*)::bigint FROM incense_lit WHERE session_key = $1",
    )
    .bind(&key)
    .fetch_optional(&st.db)
    .await
    .ok()
    .flatten();

    let 我点了: bool = sqlx::query_scalar::<_, Option<String>>(
        "SELECT user_id FROM incense_lit WHERE session_key = $1 AND user_id = $2",
    )
    .bind(&key)
    .bind(&c.sub)
    .fetch_optional(&st.db)
    .await
    .map_err(|e| ApiError(AppError::Infra(e.to_string())))?
    .flatten()
    .is_some();

    Ok(Json(json!({
        "session_key": key,
        "started_at": 起,
        "burn_seconds": 烧多久(),
        // 取不到就是 null —— 客户端据此不显示那一行，不是显示 0
        "lit_count": 几个人,
        "i_lit": 我点了,
    })))
}

async fn lit(
    axum::extract::State(st): axum::extract::State<AppState>,
    AuthedUser(c): AuthedUser,
) -> Result<Json<J>, ApiError> {
    let Some((key, _)) = 这一场() else {
        return Err(ApiError(AppError::BadRequest("现在不是点香的时候".into())));
    };
    /* 一个人一场只算一次。连点十下不该变成十个人 ——
       靠主键 + ON CONFLICT 兜住，不是靠调用方记得先查一次。 */
    sqlx::query(
        "INSERT INTO incense_lit(session_key, user_id) VALUES ($1, $2)
         ON CONFLICT (session_key, user_id) DO NOTHING",
    )
    .bind(&key)
    .bind(&c.sub)
    .execute(&st.db)
    .await
    .map_err(|e| ApiError(AppError::Infra(e.to_string())))?;

    let 几个人: Option<i64> = sqlx::query_scalar(
        "SELECT count(*)::bigint FROM incense_lit WHERE session_key = $1",
    )
    .bind(&key)
    .fetch_optional(&st.db)
    .await
    .ok()
    .flatten();

    Ok(Json(json!({ "ok": true, "lit_count": 几个人 })))
}
