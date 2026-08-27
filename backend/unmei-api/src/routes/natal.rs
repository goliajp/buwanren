use axum::{routing::{get, post, delete}, Router, Json, extract::{State, Path}};
use serde_json::json;
use sqlx::Row;
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
    let rows = sqlx::query(
        r#"SELECT id, user_id, label, year, month, day, hour, minute, tz, gender,
                  birth_lat, birth_lon, birth_city, true_solar_time, subject_type, is_default
           FROM natal WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC"#,
    ).bind(&c.sub).fetch_all(&st.db).await?;
    let v: Vec<Natal> = rows.into_iter().map(|r| Natal {
        id: r.get("id"), user_id: r.get("user_id"), label: r.get("label"),
        year: r.get("year"),
        month: r.get::<i32, _>("month") as u32,
        day: r.get::<i32, _>("day") as u32,
        hour: r.get::<i32, _>("hour") as u32,
        minute: r.get::<i32, _>("minute") as u32,
        tz: r.get("tz"),
        gender: r.get("gender"), birth_lat: r.get("birth_lat"), birth_lon: r.get("birth_lon"),
        birth_city: r.get("birth_city"), true_solar_time: r.get("true_solar_time"),
        subject_type: r.get("subject_type"), is_default: r.get("is_default"),
    }).collect();
    Ok(Json(v))
}

async fn create(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Json(req): Json<NatalInput>,
) -> Result<Json<Natal>, ApiError> {
    // 不可能成立的生辰当场挡住 —— 收下来只会变成一条永远算不出盘的记录
    req.validate()
        .map_err(|e| ApiError(unmei_domain::AppError::BadRequest(e)))?;

    let id = format!("n_{}", Uuid::new_v4().simple());
    let label = req.label.clone().unwrap_or_else(|| "默认".into());
    // 设为 default,旧 default 取消
    sqlx::query("UPDATE natal SET is_default=FALSE WHERE user_id=$1")
        .bind(&c.sub).execute(&st.db).await?;
    sqlx::query(
        r#"INSERT INTO natal (id, user_id, label, year, month, day, hour, minute, tz, gender,
                             birth_lat, birth_lon, birth_city, true_solar_time, subject_type, is_default)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,TRUE)"#,
    ).bind(&id).bind(&c.sub).bind(&label)
     .bind(req.year).bind(req.month as i32).bind(req.day as i32)
     .bind(req.hour as i32).bind(req.minute as i32).bind(req.tz).bind(&req.gender)
     .bind(req.birth_lat).bind(req.birth_lon).bind(&req.birth_city)
     .bind(req.true_solar_time).bind(&req.subject_type)
     .execute(&st.db).await?;
    sqlx::query("UPDATE app_user SET active_natal_id=$1 WHERE id=$2")
        .bind(&id).bind(&c.sub).execute(&st.db).await?;

    /* 同步预算 natal_summary(简化:同步 — 真实生产应入 worker queue)

       算不出来【不挡下创建】,但必须留声。以前这里是 `.ok()`:错被整个吞掉,
       于是本命照样落库、照样设成默认,而前端下一步取 summary 拿 404、
       显示「生成失败」—— 用户按一次留一条记录,却以为什么都没发生。
       性别取值对不上排盘服务那个 bug(M vs male)就是这么藏了这么久的。 */
    if let Err(e) = compute_summary_now(&st, &id, &req).await {
        tracing::warn!(natal_id = %id, "本命建了但盘没算出来：{}", e.0);
    }

    /* 有人买了报告却还没填生辰 —— 一半的买家是这样（量过：async_compute
       的行里只有 46% 下单时已有本命）。生辰刚补上，那些等着的册子就该出。

       在这里做，而不是等买家下次进订单页时懒加载：那样「什么时候能读」
       取决于他走没走到那一屏，而他多半是从这里直接退出去的。

       补不出来【不挡下创建】—— 本命是他刚做的事，册子是上一笔生意。 */
    match unmei_app::report::fill_awaiting(&st.db, &c.sub, &id).await {
        Ok(lines) => {
            for line_id in &lines {
                // 册子出了，订单也得跟着走完 —— 否则它永远停在 fulfilling，
                // 买家看到的还是「进行中」
                if let Err(e) = unmei_app::fulfillment::apply_report_ready(&st.db, line_id).await {
                    tracing::warn!(line_id, "报告出了但订单没推动：{e}");
                }
            }
            if !lines.is_empty() {
                tracing::info!(natal_id = %id, "生辰补上了，接着出了 {} 册报告", lines.len());
            }
        }
        Err(e) => tracing::warn!(natal_id = %id, "等着的报告没补上：{e}"),
    }

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
    /* 影响行数为 0 就报 404 —— 不存在的 id、别人的 id，原先都回 200 ok:true。
       仓库为订单修过同一件事（verify-semantics 的 I 段「幽灵 ID 不再返回
       ok:true」），本命这条漏了。 */
    let n = sqlx::query("DELETE FROM natal WHERE id=$1 AND user_id=$2")
        .bind(&id).bind(&c.sub).execute(&st.db).await?.rows_affected();
    if n == 0 {
        return Err(ApiError(unmei_domain::AppError::NotFound("natal".into())));
    }
    /* active_natal_id 的清空交给外键（20260819_active_natal_fk.sql，ON DELETE
       SET NULL）—— 那样不管从哪条路删都成立。这里不再重复写一遍。 */
    Ok(Json(json!({"ok": true})))
}

async fn activate(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    /* 先确认这份本命是不是他的。

       原先三条 UPDATE 里，前两条带 `user_id`、第三条没有 —— 于是拿着别人的
       natal_id 调一次，自己的 `active_natal_id` 就指到了别人那份上。
       实测：乙调甲的 id，返回 200，乙的 active_natal_id 变成了甲那份。

       后果不止于此：村里取盘那条 SQL 是
       `app_user u JOIN natal n ON n.id = u.active_natal_id`，**不校验归属** ——
       乙此后的签会用甲的生辰算，甲的盘会落进乙的档里。

       另外，清 `is_default` 那一条原先跑在最前面：id 是假的时候，
       他自己的默认也一起没了。所以整段挪到确认之后。 */
    let owner: Option<String> = sqlx::query_scalar("SELECT user_id FROM natal WHERE id=$1")
        .bind(&id).fetch_optional(&st.db).await?;
    let owner = owner.ok_or_else(|| ApiError(unmei_domain::AppError::NotFound("natal".into())))?;
    if owner != c.sub {
        return Err(ApiError(unmei_domain::AppError::Forbidden));
    }

    sqlx::query("UPDATE natal SET is_default=FALSE WHERE user_id=$1")
        .bind(&c.sub).execute(&st.db).await?;
    sqlx::query("UPDATE natal SET is_default=TRUE WHERE id=$1 AND user_id=$2")
        .bind(&id).bind(&c.sub).execute(&st.db).await?;
    sqlx::query("UPDATE app_user SET active_natal_id=$1 WHERE id=$2")
        .bind(&id).bind(&c.sub).execute(&st.db).await?;
    Ok(Json(json!({"ok": true})))
}

async fn summary(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Path(id): Path<String>,
) -> Result<Json<NatalSummary>, ApiError> {
    // 验证归属
    let owner: Option<String> = sqlx::query_scalar("SELECT user_id FROM natal WHERE id=$1")
        .bind(&id).fetch_optional(&st.db).await?;
    let owner = owner.ok_or_else(|| ApiError(unmei_domain::AppError::NotFound("natal".into())))?;
    if owner != c.sub {
        return Err(ApiError(unmei_domain::AppError::Forbidden));
    }
    let s = sqlx::query(
        r#"SELECT day_master, strength_level, primary_yongshen, primary_role,
                  secondary_yongshen, avoid_wuxing, friendly_hint
           FROM natal_summary WHERE natal_id = $1"#,
    ).bind(&id).fetch_optional(&st.db).await?;
    let s = s.ok_or_else(|| ApiError(unmei_domain::AppError::NotFound("summary not computed".into())))?;
    let avoid: Vec<String> = serde_json::from_value(s.get::<serde_json::Value, _>("avoid_wuxing"))
        .unwrap_or_default();
    Ok(Json(NatalSummary {
        day_master: s.get("day_master"),
        strength_level: s.get("strength_level"),
        primary_yongshen: s.get("primary_yongshen"),
        primary_role: s.get("primary_role"),
        secondary_yongshen: s.get("secondary_yongshen"),
        avoid_wuxing: avoid,
        friendly_hint: s.get("friendly_hint"),
        strength_score: None,  // 客户端不见
        pattern_name: None,    // 客户端不见
    }))
}

async fn compute_summary_now(st: &AppState, natal_id: &str, n: &NatalInput) -> Result<(), ApiError> {
    let client = MingliClient::new(st);
    let body = serde_json::json!({
        "year": n.year, "month": n.month, "day": n.day,
        "hour": n.hour, "minute": n.minute, "tz": n.tz,
        "gender": crate::mingli::gender_for_mingli(n.gender.as_deref().unwrap_or("M")),
        "latitude": n.birth_lat, "longitude": n.birth_lon,
        "true_solar_time": n.true_solar_time,
    });
    let chart = client.bazi(&body).await?;
    let lite: BaziLite = serde_json::from_value(chart.clone())
        .map_err(|e| ApiError(unmei_domain::AppError::Infra(format!("bazi parse: {e}"))))?;
    let avoid_json = serde_json::to_value(&lite.yongshen.avoid_wuxing)?;
    let friendly_hint = build_friendly_hint(&lite);
    let raw = serde_json::to_value(&chart)?;
    let strength_score_i32 = lite.strength.score as i32;
    sqlx::query(
        r#"INSERT INTO natal_summary
           (natal_id, day_master, strength_level, strength_score, primary_yongshen,
            primary_role, secondary_yongshen, avoid_wuxing, pattern_name, friendly_hint,
            raw_chart, mingli_version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (natal_id) DO UPDATE SET
               day_master = EXCLUDED.day_master,
               strength_level = EXCLUDED.strength_level,
               strength_score = EXCLUDED.strength_score,
               primary_yongshen = EXCLUDED.primary_yongshen,
               primary_role = EXCLUDED.primary_role,
               secondary_yongshen = EXCLUDED.secondary_yongshen,
               avoid_wuxing = EXCLUDED.avoid_wuxing,
               pattern_name = EXCLUDED.pattern_name,
               friendly_hint = EXCLUDED.friendly_hint,
               raw_chart = EXCLUDED.raw_chart,
               mingli_version = EXCLUDED.mingli_version,
               computed_at = NOW()"#,
    ).bind(natal_id)
     .bind(format!("{}{}", lite.day_master, lite.day_master_wuxing))
     .bind(&lite.strength.level).bind(strength_score_i32).bind(&lite.yongshen.primary_wuxing)
     .bind(&lite.yongshen.primary_role).bind(&lite.yongshen.secondary_wuxing).bind(avoid_json)
     .bind(&lite.pattern.name).bind(friendly_hint).bind(raw)
     .bind("mingli-v0.1")
     .execute(&st.db).await?;
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
