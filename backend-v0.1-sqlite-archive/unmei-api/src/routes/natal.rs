use axum::{routing::{get, post, delete}, Router, Json, extract::{State, Path}};
use serde_json::json;
use uuid::Uuid;
use unmei_domain::{Natal, NatalInput, NatalSummary};
use crate::state::AppState;
use crate::auth::{AuthedUser, ApiError};
use crate::mingli::{MingliClient, BaziLite};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/user/natals", get(list).post(create))
        .route("/v1/user/natals/:id", delete(remove))
        .route("/v1/user/natals/:id/activate", post(activate))
        .route("/v1/natal/:id/summary", get(summary))
}

async fn list(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
) -> Result<Json<Vec<Natal>>, ApiError> {
    let rows = sqlx::query!(
        r#"SELECT id, user_id, label, year, month, day, hour, minute, tz, gender,
                  birth_lat, birth_lon, birth_city, true_solar_time, subject_type, is_default
           FROM natal WHERE user_id = ? ORDER BY is_default DESC, created_at DESC"#,
        c.sub
    ).fetch_all(&st.db).await?;
    let v: Vec<Natal> = rows.into_iter().map(|r| Natal {
        id: r.id, user_id: r.user_id, label: r.label,
        year: r.year as i32, month: r.month as u32, day: r.day as u32,
        hour: r.hour as u32, minute: r.minute as u32, tz: r.tz,
        gender: r.gender, birth_lat: r.birth_lat, birth_lon: r.birth_lon,
        birth_city: r.birth_city, true_solar_time: r.true_solar_time != 0,
        subject_type: r.subject_type, is_default: r.is_default != 0,
    }).collect();
    Ok(Json(v))
}

async fn create(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Json(req): Json<NatalInput>,
) -> Result<Json<Natal>, ApiError> {
    let id = format!("n_{}", Uuid::new_v4().simple());
    let label = req.label.clone().unwrap_or_else(|| "默认".into());
    // 设为 default,旧 default 取消
    sqlx::query!("UPDATE natal SET is_default=0 WHERE user_id=?", c.sub).execute(&st.db).await?;
    let yr = req.year; let mo = req.month as i64; let d = req.day as i64;
    let h = req.hour as i64; let mi = req.minute as i64; let tsi = req.true_solar_time as i64;
    sqlx::query!(
        r#"INSERT INTO natal (id, user_id, label, year, month, day, hour, minute, tz, gender,
                             birth_lat, birth_lon, birth_city, true_solar_time, subject_type, is_default)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)"#,
        id, c.sub, label, yr, mo, d, h, mi, req.tz, req.gender,
        req.birth_lat, req.birth_lon, req.birth_city, tsi, req.subject_type,
    ).execute(&st.db).await?;
    sqlx::query!("UPDATE user SET active_natal_id=? WHERE id=?", id, c.sub).execute(&st.db).await?;

    // 同步预算 natal_summary(简化:同步 — 真实生产应入 worker queue)
    compute_summary_now(&st, &id, &req).await.ok();

    Ok(Json(Natal {
        id, user_id: c.sub, label,
        year: req.year, month: req.month, day: req.day,
        hour: req.hour, minute: req.minute, tz: req.tz,
        gender: req.gender, birth_lat: req.birth_lat, birth_lon: req.birth_lon,
        birth_city: req.birth_city, true_solar_time: req.true_solar_time,
        subject_type: req.subject_type, is_default: true,
    }))
}

async fn remove(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    sqlx::query!("DELETE FROM natal WHERE id=? AND user_id=?", id, c.sub).execute(&st.db).await?;
    Ok(Json(json!({"ok": true})))
}

async fn activate(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    sqlx::query!("UPDATE natal SET is_default=0 WHERE user_id=?", c.sub).execute(&st.db).await?;
    sqlx::query!("UPDATE natal SET is_default=1 WHERE id=? AND user_id=?", id, c.sub).execute(&st.db).await?;
    sqlx::query!("UPDATE user SET active_natal_id=? WHERE id=?", id, c.sub).execute(&st.db).await?;
    Ok(Json(json!({"ok": true})))
}

async fn summary(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Path(id): Path<String>,
) -> Result<Json<NatalSummary>, ApiError> {
    // 验证归属
    let n = sqlx::query!("SELECT user_id FROM natal WHERE id=?", id).fetch_optional(&st.db).await?;
    let n = n.ok_or_else(|| ApiError(unmei_domain::AppError::NotFound("natal".into())))?;
    if n.user_id != c.sub {
        return Err(ApiError(unmei_domain::AppError::Forbidden));
    }
    let s = sqlx::query!(
        r#"SELECT day_master, strength_level, primary_yongshen, primary_role,
                  secondary_yongshen, avoid_wuxing, friendly_hint
           FROM natal_summary WHERE natal_id = ?"#,
        id
    ).fetch_optional(&st.db).await?;
    let s = s.ok_or_else(|| ApiError(unmei_domain::AppError::NotFound("summary not computed".into())))?;
    let avoid: Vec<String> = serde_json::from_str(&s.avoid_wuxing).unwrap_or_default();
    Ok(Json(NatalSummary {
        day_master: s.day_master,
        strength_level: s.strength_level,
        primary_yongshen: s.primary_yongshen,
        primary_role: s.primary_role,
        secondary_yongshen: s.secondary_yongshen,
        avoid_wuxing: avoid,
        friendly_hint: s.friendly_hint,
        strength_score: None,  // 客户端不见
        pattern_name: None,    // 客户端不见
    }))
}

async fn compute_summary_now(st: &AppState, natal_id: &str, n: &NatalInput) -> Result<(), ApiError> {
    let client = MingliClient::new(st);
    let body = serde_json::json!({
        "year": n.year, "month": n.month, "day": n.day,
        "hour": n.hour, "minute": n.minute, "tz": n.tz,
        "gender": n.gender.clone().unwrap_or_default(),
        "latitude": n.birth_lat, "longitude": n.birth_lon,
        "true_solar_time": n.true_solar_time,
    });
    let chart = client.bazi(&body).await?;
    let lite: BaziLite = serde_json::from_value(chart.clone())
        .map_err(|e| ApiError(unmei_domain::AppError::Upstream(format!("bazi parse: {e}"))))?;
    let avoid_json = serde_json::to_string(&lite.yongshen.avoid_wuxing)?;
    let friendly_hint = build_friendly_hint(&lite);
    let raw = serde_json::to_string(&chart)?;
    sqlx::query!(
        r#"INSERT OR REPLACE INTO natal_summary
           (natal_id, day_master, strength_level, strength_score, primary_yongshen,
            primary_role, secondary_yongshen, avoid_wuxing, pattern_name, friendly_hint,
            raw_chart, mingli_version)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"#,
        natal_id,
        format!("{}{}", lite.day_master, lite.day_master_wuxing),
        lite.strength.level, lite.strength.score, lite.yongshen.primary_wuxing,
        lite.yongshen.primary_role, lite.yongshen.secondary_wuxing, avoid_json,
        lite.pattern.name, friendly_hint, raw,
        "mingli-v0.1",
    ).execute(&st.db).await?;
    Ok(())
}

fn build_friendly_hint(b: &BaziLite) -> String {
    let benefits = match b.yongshen.primary_wuxing.as_str() {
        "木" => "东方 / 青绿 / 文教 / 律法",
        "火" => "南方 / 红黄 / 礼宴 / 宣传",
        "土" => "中央 / 黄褐 / 务实 / 信约",
        "金" => "西方 / 银白 / 决断 / 修律",
        "水" => "北方 / 黑蓝 / 静思 / 智谋",
        _    => "顺势而行",
    };
    let avoid_hint = b.yongshen.avoid_wuxing.first().map(|w| match w.as_str() {
        "木" => "东方木旺",
        "火" => "南方红黄 / 燥处",
        "土" => "中央 / 过湿之处",
        "金" => "西方金锐 / 寒冷",
        "水" => "北方阴湿",
        _    => "燥进",
    }).unwrap_or("燥进");
    format!("{benefits}之事顺势而行。{avoid_hint}宜静守。")
}
