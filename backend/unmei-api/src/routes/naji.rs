//! /v1/naji/spin — 核心:罗盘一抽
//! 输入:可选 time_now(默认服务器现在) + 位置
//! 流程:取 user.active_natal_id → 若有 → 用 natal_summary 反算个性化 quote/gate/yi/ji
//!                                  → 若无 → 池中随机抽
//! 输出:NajiResult(完全契合 design.html v0.3)
//! 写表:naji_record(留快照)

use axum::{routing::{get, post}, Router, Json, extract::{State, Path}};
use chrono::{Datelike, Timelike, Local, DateTime, Utc};
use sqlx::Row;
use uuid::Uuid;
use unmei_app::badge as app_badge;
use unmei_domain::{NajiResult, NajiSpinReq, QuoteOut, 拿到的徽章};

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
    let user_row = sqlx::query(
        "SELECT active_natal_id, platform, region, locale FROM app_user WHERE id=$1"
    ).bind(&c.sub).fetch_one(&st.db).await?;
    let active_natal_id: Option<String> = user_row.get("active_natal_id");
    let user_platform: String = user_row.get("platform");
    let user_region: String = user_row.get("region");
    let user_locale: String = user_row.get("locale");

    let (primary_yongshen, avoid_wuxing) = if let Some(nid) = active_natal_id.as_ref() {
        let s = sqlx::query(
            "SELECT primary_yongshen, avoid_wuxing FROM natal_summary WHERE natal_id=$1"
        ).bind(nid).fetch_optional(&st.db).await?;
        if let Some(s) = s {
            let av: Vec<String> = serde_json::from_value(s.get("avoid_wuxing")).unwrap_or_default();
            (Some(s.get::<String, _>("primary_yongshen")), av)
        } else { (None, vec![]) }
    } else { (None, vec![]) };

    /* ─── 3. seed: 用户 + 当日 + **问的那件事**
       【问题必须进种子】（2026-09-02 第四轮评审 · 产品完整性）。
       原先只有「谁 + 哪一天 + 哪一小时」，于是同一小时里问
       「我该结婚吗」「明天会下雨吗」「这只股票能买吗」，
       返回的是【逐字相同】的一签 —— 而这个产品卖的正是「替你看一件事」。
       起卦没有日限，所以用户问第二件事就看得见，不需要任何特殊条件。

       放进去之后两头都成立:
       · 同一件事同一天再问，还是同一句 —— 不能反复摇到满意为止
       · 不同的事给不同的答案 —— 因为那本来就是两件事
       没写问题的（直接摇一摇）走空串，行为跟以前一样。 */
    let question_clean = req.question.as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let seed = make_seed(&c.sub, year, month, day, hour,
                         question_clean.as_deref().unwrap_or(""));

    // ─── 4. 真奇门时盘(用现有 mingli /api/cast → qimen 叶取 time_ganzhi)
    //         算力虽不暴露,但能让 record.t_chart 留真盘审计
    let t_chart_json = call_qimen(&st, year, month, day, hour, minute, tz_offset).await
        .unwrap_or(serde_json::Value::Null);

    // ─── 5. 组合
    let gate = pick_gate_by_yongshen(primary_yongshen.as_deref(), time_branch_u, seed).to_string();
    let gate_ex = pick_gate_explain(&st.db, &gate, &user_locale).await?;
    let q = pick_quote(&st.db, primary_yongshen.as_deref(), Some(&gate), &user_locale, seed).await?;
    let (yi, ji) = pick_yiji(&st.db, primary_yongshen.as_deref(), &avoid_wuxing, &user_locale, seed).await?;
    let rec = pick_recommend(&st.db, &c.sub, &user_region, &user_platform, seed).await?;

    // ─── 6. time_label
    // 「下午 1 点 · 13:53」—— 前一半说给人听，后一半是准确时刻
    let tl = format!("{} · {:02}:{:02}", time_label(hour), hour, minute);

    // ─── 7. 写 naji_record
    let id = format!("nj_{}", Uuid::new_v4().simple());
    let suit_json = serde_json::to_value(&yi)?;
    let avoid_json = serde_json::to_value(&ji)?;
    let t_chart_val: Option<serde_json::Value> = if t_chart_json.is_null() { None } else { Some(t_chart_json.clone()) };
    let rec_id = rec.as_ref().map(|r| r.id.clone());
    let signed_seed = seed as i64;
    // 清洗 question · trim + 空串归 None
    sqlx::query(
        r#"INSERT INTO naji_record
           (id, user_id, natal_id, asked_year, asked_month, asked_day, asked_hour, asked_minute, asked_tz,
            location_lat, location_lon, t_chart, gate, direction, gate_explain,
            suit_words, avoid_words, quote_id, recommended_product_id, seed, question)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)"#,
    ).bind(&id).bind(&c.sub).bind(&active_natal_id)
     .bind(year).bind(month as i32).bind(day as i32).bind(hour as i32).bind(minute as i32).bind(tz_offset)
     .bind(req.location_lat).bind(req.location_lon).bind(&t_chart_val)
     .bind(&gate).bind(&gate_ex.direction).bind(&gate_ex.explain)
     .bind(&suit_json).bind(&avoid_json).bind(&q.id).bind(&rec_id).bind(signed_seed)
     .bind(&question_clean)
     .execute(&st.db).await?;

    /* ─── 8. 徽章触发

       徽章发不出来不该让这一签失败,所以错误不往上抛;但**每一处都留一行 warn**。
       2026-08-19 之前这里是两个 `.ok()`,当时的注释写着「今天不要紧,因为没有任何
       客户端读徽章」,并说好接 UI 的时候改掉。徽章那天接进了「我」,所以改了 ——
       从此「悄悄没发」是用户看得见的缺斤少两。

       【2026-09-06 搬走了】。这一段原先是本文件里的 `check_badges` ——
       转盘这条路由的私产，只数 `naji_record`。而问签（`villager_reading`）
       是同一件事的另一条路，它够不着这个私有函数，于是天天问村民的人
       徽章永远不动。判据与实现搬去 `unmei_app::badge`，两条路都调它。 */
    let 拿到 = match app_badge::发该发的(&st.db, &c.sub).await {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!(user = %c.sub, error = ?e, "徽章那一遍没跑完");
            Vec::new()
        }
    };

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
        earned: 拿到.into_iter()
            .map(|x| 拿到的徽章 { code: x.code, name: x.name }).collect(),
    }))
}

async fn history(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
) -> Result<Json<serde_json::Value>, ApiError> {
    /* 【那天问到了什么，按现在这一版的说法讲】。
       原先这一列返回 `gate`（休门 / 生门），客户端原样印在「近几次」上 ——
       而结果那一屏明令「门名与方位一个都不留」，同一个词一屏禁一屏留。

       改成取 `gate_word.benefit_text`（现在这一版的人话）而不是记录上
       存的 `gate_explain` 快照:库里 1600 多条记录里一千多条的快照还是
       旧文言加半角标点（「休则养正,正则气盈;……」），
       文案改了、已发出的快照不会跟着改，印出来就是把旧文言又请回来一次。
       门是同一个门，说法用现在这一版的，才跟结果屏对得上。 */
    let rows = sqlx::query(
        r#"SELECT r.id, r.asked_at, r.gate, r.direction, r.suit_words, r.avoid_words,
                  r.asked_year, r.asked_month, r.asked_day, r.asked_hour, r.question,
                  gw.benefit_text
           FROM naji_record r
           LEFT JOIN gate_word gw ON gw.gate = r.gate
           WHERE r.user_id=$1
           ORDER BY r.asked_at DESC LIMIT 50"#,
    ).bind(&c.sub).fetch_all(&st.db).await?;
    let mut v = Vec::with_capacity(rows.len());
    for r in rows {
        // 「8月30日 下午 1 点」。原先是「08·30 未时」——
        // 时辰是屏上不许出现的那一类词，而这一栏每天都有人读
        let date = format!("{}月{}日 {}",
            r.get::<i32, _>("asked_month"), r.get::<i32, _>("asked_day"),
            time_label(r.get::<i32, _>("asked_hour") as u32));
        v.push(serde_json::json!({
            "id": r.get::<String, _>("id"),
            "date": date,
            "asked_at": r.get::<DateTime<Utc>, _>("asked_at"),
            "gate": r.get::<String, _>("gate"),
            "direction": r.get::<String, _>("direction"),
            /* 列表上那一行:结论的头半句（「适合开个头」）。
               整句带着冒号后面的展开，一行放不下;取不到就是 null，
               客户端据此少摆一列，不编。 */
            "说": r.get::<Option<String>, _>("benefit_text")
                   .and_then(|t| t.split('：').next().map(|x| x.to_string())),
            "question": r.get::<Option<String>, _>("question"),
        }));
    }
    Ok(Json(serde_json::json!({"items": v})))
}

async fn detail(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let r = sqlx::query(
        r#"SELECT id, asked_at, gate, direction, gate_explain, suit_words, avoid_words, quote_id, recommended_product_id, question
           FROM naji_record WHERE id=$1 AND user_id=$2"#,
    ).bind(&id).bind(&c.sub).fetch_optional(&st.db).await?;
    let r = r.ok_or_else(|| ApiError(unmei_domain::AppError::NotFound("naji".into())))?;
    let yi: Vec<String> = serde_json::from_value(r.get("suit_words")).unwrap_or_default();
    let ji: Vec<String> = serde_json::from_value(r.get("avoid_words")).unwrap_or_default();
    let q = if let Some(qid) = r.get::<Option<String>, _>("quote_id") {
        // 落款只留出处，不带篇名 —— 理由见 ai_compose.rs 里那一段。
        // 两处必须一致:同一句话在结果屏和历史详情里落款不同，比都错更糟。
        let qr = sqlx::query("SELECT book, text FROM quote WHERE id=$1")
            .bind(&qid).fetch_optional(&st.db).await?;
        qr.map(|q| QuoteOut {
            text: q.get("text"),
            source: q.get::<String, _>("book"),
        })
    } else { None };

    /* 【推荐也要回】（2026-09-02 第三轮评审 · 第一次打开的人）。
       上面那条 SELECT 一直在取 `recommended_product_id`，但它从来没进过
       响应体 —— 而结果屏（pages/ask）拿到 id 之后会用 `detail(id)`
       把整条记录【重取一遍】（ask/index.ts 的 `showWanted`）。
       于是转完卦那一瞬间有推荐、页面一渲染就没了:
       `ask/index.wxml` 的 `wx:if="{{result.recommend}}"` 永远不成立。

       后果是 ¥199 的「你的说明书」【全 app 没有一条路能走到】——
       另外三个入口分别指向护身符与订阅，而订阅那屏说「村里现在没有
       可以订的东西」。直接敲地址进得去，页面也写得好，只是没人到得了。

       这里按 id 现取一次商品与价 —— 不存 name/价 的快照:
       商品改了名、调了价、下了架，历史详情该显示的是【现在的那件】，
       而不是当时那份会过期的抄件。取不到（下架了）就回 null，
       跟「本来就没推荐」同一个形状，前端不必分两种。 */
    let rec = match r.get::<Option<String>, _>("recommended_product_id") {
        Some(pid) => {
            // 区域与平台决定看哪一份价目表 —— 跟起卦那一侧同一个来源
            let u = sqlx::query("SELECT platform, region FROM app_user WHERE id=$1")
                .bind(&c.sub).fetch_one(&st.db).await?;
            crate::ai_compose::product_brief(
                &st.db, &pid,
                &u.get::<String, _>("region"), &u.get::<String, _>("platform"),
            ).await?
        }
        None => None,
    };

    Ok(Json(serde_json::json!({
        "id": r.get::<String, _>("id"),
        "asked_at": r.get::<DateTime<Utc>, _>("asked_at"),
        "gate": r.get::<String, _>("gate"),
        "direction": r.get::<String, _>("direction"),
        "gate_explain": r.get::<String, _>("gate_explain"),
        "suit": yi,
        "avoid": ji,
        "quote": q,
        "question": r.get::<Option<String>, _>("question"),
        "recommend": rec,
    })))
}

fn compute_time_branch(hour: u32) -> u8 {
    // 子=0, 丑=1, ..., 亥=11
    // 23 子, 1-2 丑, ...
    if hour == 23 { 0 } else { (((hour + 1) / 2) % 12) as u8 }
}

fn make_seed(user_id: &str, y: i32, m: u32, d: u32, h: u32, question: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    user_id.hash(&mut hasher);
    y.hash(&mut hasher); m.hash(&mut hasher); d.hash(&mut hasher); h.hash(&mut hasher);
    // 问的那件事也算一份 —— 没有它，同一小时里问什么都得到同一句
    question.hash(&mut hasher);
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
