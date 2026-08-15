//! /v1/naji/spin — 核心:罗盘一抽
//! 输入:可选 time_now(默认服务器现在) + 位置
//! 流程:取 user.active_natal_id → 若有 → 用 natal_summary 反算个性化 quote/gate/yi/ji
//!                                  → 若无 → 池中随机抽
//! 输出:NajiResult(完全契合 design.html v0.3)
//! 写表:naji_record(留快照)

use axum::{routing::{get, post}, Router, Json, extract::{State, Path}};
use chrono::{Datelike, Timelike, Local};
use uuid::Uuid;
use unmei_domain::{NajiResult, NajiSpinReq, QuoteOut};

use crate::state::AppState;
use crate::auth::{AuthedUser, ApiError};
use crate::ai_compose::*;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/naji/spin", post(spin))
        .route("/v1/naji/history", get(history))
        .route("/v1/naji/:id", get(detail))
}

async fn spin(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Json(req): Json<NajiSpinReq>,
) -> Result<Json<NajiResult>, ApiError> {
    // ─── 1. 时刻 ───────────────────────────────────────────────
    let now = match req.time_now.as_deref() {
        Some(s) => chrono::DateTime::parse_from_rfc3339(s)
            .map(|dt| dt.with_timezone(&Local))
            .unwrap_or_else(|_| Local::now()),
        None => Local::now(),
    };
    let (year, month, day) = (now.year(), now.month(), now.day());
    let (hour, minute) = (now.hour(), now.minute());
    let tz_offset = (now.offset().local_minus_utc() as f64) / 3600.0;
    // 时支(粗 — 真实算力还会用 mingli_qimen 算时柱;这里取 time_branch 用于 ai_compose)
    let time_branch_u = compute_time_branch(hour);

    // ─── 2. 取用户 + 本命 ───────────────────────────────────────
    let user_row = sqlx::query!(
        "SELECT active_natal_id, platform, region, locale FROM app_user WHERE id=$1", c.sub
    ).fetch_one(&st.db).await?;

    let (primary_yongshen, avoid_wuxing) = if let Some(nid) = user_row.active_natal_id.as_ref() {
        let s = sqlx::query!(
            "SELECT primary_yongshen, avoid_wuxing FROM natal_summary WHERE natal_id=$1",
            nid
        ).fetch_optional(&st.db).await?;
        if let Some(s) = s {
            let av: Vec<String> = serde_json::from_value(s.avoid_wuxing.clone()).unwrap_or_default();
            (Some(s.primary_yongshen), av)
        } else { (None, vec![]) }
    } else { (None, vec![]) };

    // ─── 3. seed: 基于用户 + 当日(每天同用户结果稳定,新天换)
    let seed = make_seed(&c.sub, year, month, day, hour);

    // ─── 4. 真奇门时盘(用现有 mingli /api/cast → qimen 叶取 time_ganzhi)
    //         算力虽不暴露,但能让 record.t_chart 留真盘审计
    let t_chart_json = call_qimen(&st, year, month, day, hour, minute, tz_offset).await
        .unwrap_or(serde_json::Value::Null);

    // ─── 5. 组合
    let gate = pick_gate_by_yongshen(primary_yongshen.as_deref(), time_branch_u, seed).to_string();
    let gate_ex = pick_gate_explain(&st.db, &gate, &user_row.locale).await?;
    let q = pick_quote(&st.db, primary_yongshen.as_deref(), Some(&gate), &user_row.locale, seed).await?;
    let (yi, ji) = pick_yiji(&st.db, primary_yongshen.as_deref(), &avoid_wuxing, &user_row.locale, seed).await?;
    let rec = pick_recommend(&st.db, primary_yongshen.as_deref(), &user_row.region, &user_row.platform, seed).await?;

    // ─── 6. time_label
    let tl = format!("{} · {:02}:{:02}", time_label(hour), hour, minute);

    // ─── 7. 写 naji_record
    let id = format!("nj_{}", Uuid::new_v4().simple());
    let suit_json = serde_json::to_value(&yi)?;
    let avoid_json = serde_json::to_value(&ji)?;
    let t_chart_val: Option<serde_json::Value> = if t_chart_json.is_null() { None } else { Some(t_chart_json.clone()) };
    let rec_id = rec.as_ref().map(|r| r.id.clone());
    let signed_seed = seed as i64;
    let nid_for_log = user_row.active_natal_id.clone();
    let yr = year as i32;
    let mo = month as i32; let d = day as i32;
    let h = hour as i32;   let mi = minute as i32;
    // 清洗 question · trim + 空串归 None
    let question_clean = req.question.as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    sqlx::query!(
        r#"INSERT INTO naji_record
           (id, user_id, natal_id, asked_year, asked_month, asked_day, asked_hour, asked_minute, asked_tz,
            location_lat, location_lon, t_chart, gate, direction, gate_explain,
            suit_words, avoid_words, quote_id, recommended_product_id, seed, question)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)"#,
        id, c.sub, nid_for_log, yr, mo, d, h, mi, tz_offset,
        req.location_lat, req.location_lon, t_chart_val,
        gate, gate_ex.direction, gate_ex.explain,
        suit_json, avoid_json, q.id, rec_id, signed_seed,
        question_clean,
    ).execute(&st.db).await?;

    // ─── 8. 徽章触发(简化:仅在写入后检查 count 类规则)
    check_badges(&st, &c.sub).await.ok();

    Ok(Json(NajiResult {
        id,
        asked_at: now.to_rfc3339(),
        time_label: tl,
        quote: q.out,
        gate,
        direction: gate_ex.direction,
        gate_explain: gate_ex.explain,
        suit: yi,
        avoid: ji,
        question: question_clean,
        recommend: rec,
    }))
}

async fn history(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
) -> Result<Json<serde_json::Value>, ApiError> {
    let rows = sqlx::query!(
        r#"SELECT id, asked_at, gate, direction, suit_words, avoid_words,
                  asked_year, asked_month, asked_day, asked_hour, question
           FROM naji_record WHERE user_id=$1
           ORDER BY asked_at DESC LIMIT 50"#,
        c.sub
    ).fetch_all(&st.db).await?;
    let mut v = Vec::with_capacity(rows.len());
    for r in rows {
        // time_label 已含 "时"(如 "酉时"),这里不再拼尾;历史上曾误产 "酉时时"
        let date = format!("{:02}·{:02} {}",
            r.asked_month, r.asked_day, time_label(r.asked_hour as u32));
        v.push(serde_json::json!({
            "id": r.id,
            "date": date,
            "asked_at": r.asked_at,
            "gate": r.gate,
            "direction": r.direction,
            "question": r.question,
        }));
    }
    Ok(Json(serde_json::json!({"items": v})))
}

async fn detail(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let r = sqlx::query!(
        r#"SELECT id, asked_at, gate, direction, gate_explain, suit_words, avoid_words, quote_id, recommended_product_id, question
           FROM naji_record WHERE id=$1 AND user_id=$2"#,
        id, c.sub
    ).fetch_optional(&st.db).await?;
    let r = r.ok_or_else(|| ApiError(unmei_domain::AppError::NotFound("naji".into())))?;
    let yi: Vec<String> = serde_json::from_value(r.suit_words.clone()).unwrap_or_default();
    let ji: Vec<String> = serde_json::from_value(r.avoid_words.clone()).unwrap_or_default();
    let q = if let Some(qid) = r.quote_id {
        let qr = sqlx::query!("SELECT book, chapter, text FROM quote WHERE id=$1", qid)
            .fetch_optional(&st.db).await?;
        qr.map(|q| QuoteOut { text: q.text, source: format!("{} · {}", q.book, q.chapter.unwrap_or_default()) })
    } else { None };
    Ok(Json(serde_json::json!({
        "id": r.id,
        "asked_at": r.asked_at,
        "gate": r.gate,
        "direction": r.direction,
        "gate_explain": r.gate_explain,
        "suit": yi,
        "avoid": ji,
        "quote": q,
        "question": r.question,
    })))
}

fn compute_time_branch(hour: u32) -> u8 {
    // 子=0, 丑=1, ..., 亥=11
    // 23 子, 1-2 丑, ...
    if hour == 23 { 0 } else { (((hour + 1) / 2) % 12) as u8 }
}

fn make_seed(user_id: &str, y: i32, m: u32, d: u32, h: u32) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    user_id.hash(&mut hasher);
    y.hash(&mut hasher); m.hash(&mut hasher); d.hash(&mut hasher); h.hash(&mut hasher);
    hasher.finish()
}

async fn call_qimen(
    st: &AppState,
    y: i32, m: u32, d: u32, h: u32, mi: u32, tz: f64
) -> Result<serde_json::Value, ApiError> {
    let body = serde_json::json!({
        "year": y, "month": m, "day": d, "hour": h, "minute": mi, "tz": tz
    });
    let client = crate::mingli::MingliClient::new(st);
    let cast = client.cast(&body).await?;
    // 取 qimen 叶 chart
    let q = crate::mingli::leaf(&cast, "qimen").cloned().unwrap_or(serde_json::Value::Null);
    Ok(q)
}

async fn check_badges(st: &AppState, user_id: &str) -> Result<(), ApiError> {
    // 仅检查 count 类徽章(streak 类需更精细日历比对,留 worker)
    let count_row = sqlx::query!(r#"SELECT COUNT(*) as "c!: i64" FROM naji_record WHERE user_id=$1"#, user_id)
        .fetch_one(&st.db).await?;
    let count = count_row.c;
    let badges = sqlx::query!("SELECT id, code, rule_dsl FROM badge WHERE status='active'")
        .fetch_all(&st.db).await?;
    for b in badges {
        let rule: serde_json::Value = serde_json::from_value(b.rule_dsl.clone()).unwrap_or(serde_json::Value::Null);
        let typ = rule.get("type").and_then(|x| x.as_str()).unwrap_or("");
        let action = rule.get("action").and_then(|x| x.as_str()).unwrap_or("");
        let threshold = rule.get("threshold").and_then(|x| x.as_i64()).unwrap_or(0);
        if typ == "count" && action == "naji.spin" && count >= threshold {
            // 已持有则跳过
            let exists = sqlx::query!(
                "SELECT badge_id FROM user_badge WHERE user_id=$1 AND badge_id=$2",
                user_id, b.id
            ).fetch_optional(&st.db).await?;
            if exists.is_none() {
                sqlx::query!("INSERT INTO user_badge (user_id, badge_id) VALUES ($1,$2)", user_id, b.id)
                    .execute(&st.db).await.ok();
            }
        }
    }
    Ok(())
}
