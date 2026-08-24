//! /v1/village/* · 村子与不完人
//!
//! 第 10 步「四条动线」里后端要出的三条:
//!   - `GET  /v1/village`                    我的村子:住着谁、n/40、空屋
//!   - `POST /v1/villagers/:id/reading`      问签(三层)
//!   - `POST /v1/omamori/scan`               扫御守入住
//!
//! ## 算力层在这一层取,不在用例层取
//!
//! `unmei_app::villager::reading` 不认识 HTTP,也不该认识 —— 同 `payment::start`
//! 的分工。所以「他这门术数对应 mingli 的哪片叶、去要一盘」发生在这里,
//! 取到的盘原样传进用例层落档。
//!
//! 取不到盘就传 `None`,用例层如实落一个空盘。**不伪造成算过的样子** ——
//! 事后翻档案的人要能一眼看出这一签背后有没有真盘。

use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use chrono::{Duration as ChronoDuration, Utc};
use serde::Deserialize;
use serde_json::{json, Value as J};
use sqlx::Row;
use unmei_app::{residency, villager};

use crate::auth::{ApiError, AuthedUser};
use crate::mingli::MingliClient;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/village", get(my_village))
        .route("/v1/villagers", get(all_villagers))
        .route("/v1/villagers/:id/reading", post(ask_reading))
        .route("/v1/omamori/scan", post(scan))
}

/// 按 Asia/Shanghai 切日。问签一天一签,那个「一天」得跟用户看到的日历一致。
/// 「今天」——**写死东八区**。
///
/// 中国无夏令时，所以对 `cn` 恒成立。但这个产品是六 cell 的
/// （`cn / jp / kr / sea / na / zh_hant`），而 `RegionMeta` 里
/// **每个 cell 的 `tz` 都写着**（`Asia/Shanghai` / `Asia/Tokyo` / …）
/// —— **没有任何一处读它**（2026-08-18 查过）。
///
/// 后果是具体的：`jp` / `kr` 差 1 小时，`na` 差 13–16 小时 ——
/// 美洲用户的「今天」会在他【上午】翻页，于是「同一天问同一位、逐字相同」
/// 那条设定在他那里每天早上断一次。
///
/// 今天够不着：内容只有 `zh-CN`，小程序只发 `region=cn`。
/// 真开第二个 cell 时，这里要改成按用户 region 取 `meta().tz` 算本地日期
/// （后端还没有时区库，chrono-tz 之类要一起加）。
/// `workers/recon.rs` 里有同样一行 `+8`，改的时候两处一起。
fn today_shanghai() -> chrono::NaiveDate {
    (Utc::now() + ChronoDuration::hours(8)).date_naive()
}

// ─── 我的村子 ────────────────────────────────────────────────────

async fn my_village(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
) -> Result<Json<J>, ApiError> {
    let home = residency::village_of(&st.db, &c.sub).await?;

    // 连没找回的一起返回。**空屋不消失是世界观,不是待办** ——
    // 前端要能把空屋画出来、点得到、让它说「这间空着,等人」。
    let rows = sqlx::query(
        "SELECT v.id, v.name, v.title, v.art_key, a.name AS art_name, v.lack, v.rarity \
         FROM villager v LEFT JOIN art a ON a.key = v.art_key ORDER BY v.id",
    )
    .fetch_all(&st.db)
    .await?;

    let all: Vec<J> = rows
        .iter()
        .map(|r| {
            let id: String = r.get("id");
            let at_home = home.iter().any(|h| *h == id);
            json!({
                "id": id,
                "name": r.get::<String, _>("name"),
                "title": r.get::<Option<String>, _>("title"),
                "art": r.get::<Option<String>, _>("art_name"),
                "lack": r.get::<String, _>("lack"),
                "rarity": r.get::<Option<String>, _>("rarity"),
                "at_home": at_home,
            })
        })
        .collect();

    Ok(Json(json!({
        "found": home.len(),
        "total": all.len(),
        "villagers": all,
    })))
}

/// 图鉴:不带住没住,给未登录的人看。
async fn all_villagers(State(st): State<AppState>) -> Result<Json<J>, ApiError> {
    let rows = sqlx::query(
        "SELECT v.id, v.name, v.title, a.name AS art_name, v.rarity \
         FROM villager v LEFT JOIN art a ON a.key = v.art_key ORDER BY v.id",
    )
    .fetch_all(&st.db)
    .await?;
    Ok(Json(json!(rows
        .iter()
        .map(|r| json!({
            "id": r.get::<String, _>("id"),
            "name": r.get::<String, _>("name"),
            "title": r.get::<Option<String>, _>("title"),
            "art": r.get::<Option<String>, _>("art_name"),
            "rarity": r.get::<Option<String>, _>("rarity"),
        }))
        .collect::<Vec<_>>())))
}

// ─── 问签 ────────────────────────────────────────────────────────

async fn ask_reading(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Path(villager_id): Path<String>,
) -> Result<Json<J>, ApiError> {
    // 没请回家的不完人不给你看命。这不是权限检查,是设定:
    // 御守是入住凭证,他得先住进你的村子。
    if !residency::is_home(&st.db, &c.sub, &villager_id).await? {
        return Err(ApiError::not_found(format!(
            "{villager_id} 还没住进你的村子"
        )));
    }

    let chart = fetch_chart(&st, &c.sub, &villager_id).await;
    let r = villager::reading(&st.db, &c.sub, &villager_id, today_shanghai(), chart).await?;

    Ok(Json(json!({
        "villager_id": r.villager_id,
        "villager_name": r.villager_name,
        "art": r.art_key,
        "lack": r.lack,
        "verdict": r.verdict,
        "suit": r.suit,
        "avoid": r.avoid,
        "say": r.say,
    })))
}

/// 算力层:他这门术数有对应的 mingli 叶就去要一盘。
///
/// 拿不到就返回 `None` —— 上游挂了不该让问签整条挂掉(他还是会说话,
/// 只是这一签背后没有真盘),但也**不能假装算过**:落档时空盘就是空盘。
async fn fetch_chart(st: &AppState, user_id: &str, villager_id: &str) -> Option<J> {
    let leaf: Option<String> = sqlx::query_scalar(
        "SELECT a.mingli_leaf FROM villager v JOIN art a ON a.key = v.art_key WHERE v.id = $1",
    )
    .bind(villager_id)
    .fetch_optional(&st.db)
    .await
    .ok()
    .flatten()?;
    // 这一列可空。没配叶就没得算 —— 旧代码把 None 直接序列化成 null 发上去了
    let leaf = leaf?;

    /* 用户的本命盘参数。没建过本命就没得算 —— 同样如实返回 None。

       取的是【生辰本身】,不是 natal_id:mingli 的 /api/cast 要 year/month/day/
       hour/minute/tz(+gender),不认 natal_id。以前发的是 natal_id,
       于是它每次都 422,而这边把 422 当成「上游不可用」记一行 warn 就过去了 ——
       日志写着「取不到盘」,读起来像是运维问题,所以这条一直没人查。
       实际后果是【每一签都是空盘】,而那是产品的核心那一件事。 */
    let row: Option<(i32, i32, i32, i32, i32, f64, Option<String>)> = sqlx::query_as(
        r#"SELECT n.year, n.month, n.day, n.hour, n.minute, n.tz, n.gender
             FROM app_user u JOIN natal n ON n.id = u.active_natal_id
            WHERE u.id = $1"#,
    )
    .bind(user_id)
    .fetch_optional(&st.db)
    .await
    .ok()
    .flatten();
    let (y, mo, d, h, mi, tz, gender) = row?;

    match MingliClient::new(st)
        .cast(&crate::mingli::cast_body(&leaf, y, mo, d, h, mi, tz, gender.as_deref()))
        .await
    {
        Ok(v) => Some(v),
        Err(e) => {
            // 上游不可用是运维问题,不该表现成「这位不完人今天不说话」。
            // 记一行,继续出签,档案里那一栏是空的 —— 一眼看得出。
            tracing::warn!(villager_id, leaf, "取不到盘，这一签落空盘：{}", e.0);
            None
        }
    }
}

// ─── 扫御守 ──────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ScanBody {
    /// nfc / qr / chain / manual
    carrier: String,
    /// NFC UID、QR 序列号……载体不同,这里的东西不同,身份记录是同一条
    credential: String,
}

async fn scan(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Json(b): Json<ScanBody>,
) -> Result<Json<J>, ApiError> {
    let out = residency::move_in_from_credential(&st.db, &c.sub, &b.carrier, &b.credential).await?;
    let vid = out.villager_id().to_string();

    let name: Option<String> = sqlx::query_scalar("SELECT name FROM villager WHERE id = $1")
        .bind(&vid)
        .fetch_optional(&st.db)
        .await?;

    Ok(Json(json!({
        "villager_id": vid,
        "villager_name": name,
        // 重复扫不是错误,但界面要说得不一样:
        // 第一次是「他住进来了」,第二次是「他早就在了」
        "moved_in": out.is_new(),
    })))
}
