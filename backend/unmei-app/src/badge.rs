//! 徽章 —— 问过多少件事、连着问了多少天，够了就发。
//!
//! 【为什么从 `naji.rs` 搬到这里】（2026-09-06 五路评审 · §七）。
//! 原先这一段（`check_badges`）住在 `unmei-api/src/routes/naji.rs` 里，
//! 也就是【转盘那一条路由的私产】。后果不是「架构不好看」，是两件具体的事：
//!
//!   · 它只数 `naji_record`。而这个产品里「问一件事」有**两条路**：
//!     转盘起卦（`naji_record`）、去村民屋里问签（`villager_reading`）。
//!     天天去问婆婆的人，「一百次」与「七天没断」永远是 0 ——
//!     而屏上那几枚灰徽章底下还写着「去问一件事」，把人往一条不算数的路上引。
//!   · 问签那一条路（`villager.rs`）压根不触发徽章：它在 app 层，
//!     够不着住在 api 层某个路由文件里的私有函数。
//!
//! 所以判据从「转盘记录」换成【问过的事】——两张表并起来数，
//! 而这一支放在两条路都够得着的地方。
//!
//! 「有表、有规则、有 UI 在显示，唯独没有人把两头接上」——
//! 跟 `activity.rs` 开头记的是同一个形状。

use std::collections::HashMap;

use sqlx::{PgPool, Row};
use unmei_domain::DomainError;

use crate::DbResultExt;

/// 这一次新拿到的那几枚。code 给判据用，name 给屏上那句话用。
#[derive(Debug, Clone)]
pub struct 拿到了 {
    pub code: String,
    pub name: String,
}

/// 一枚徽章离拿到还差多少。`要` 是 0 表示这一枚不是数出来的
/// （买东西、到过场那两枚由别处发），屏上就不画进度。
#[derive(Debug, Clone, Copy)]
pub struct 进度 {
    pub 有: i64,
    pub 要: i64,
}

/// 问过多少件事 · 连着问了多少天。
///
/// **两张表并起来数**。日子按上海时区切 —— 跟村子首页那句「今天说」
/// 同一个口径，不然晚上八点之后两处对不上。
///
/// 连击那一段：`day - 行号` 这一列（`gap`）对连着的日子是同一个值，
/// 一组就是一段连击。只认【还没断的那一段】（最后一天不早于昨天），
/// 否则去年连过三十天的人今天照样拿「一个月」。
/// 那个 UNION 在两条查询里各写一遍，不用 `format!` 拼 ——
/// `scripts/check-sql.py` 拿真 Postgres PREPARE 每一条 SQL 字面量，
/// 而拼出来的它够不着（它自己的输出里就写着「拼出来的那些这里验不了」）。
/// 两处重复十来个字，换这两条被机器核过，划算。
async fn 数一数(pool: &PgPool, user_id: &str) -> Result<(i64, i64), DomainError> {
    let count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM (
             SELECT asked_at FROM naji_record      WHERE user_id = $1
             UNION ALL
             SELECT asked_at FROM villager_reading WHERE user_id = $1
           ) q"#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .db()?;
    let streak: i64 = sqlx::query_scalar(
        r#"WITH q AS (
             SELECT asked_at FROM naji_record      WHERE user_id = $1
             UNION ALL
             SELECT asked_at FROM villager_reading WHERE user_id = $1
           ), d AS (
             SELECT DISTINCT ((asked_at AT TIME ZONE 'Asia/Shanghai')::date) AS day FROM q
           ), g AS (
             SELECT day, day - (ROW_NUMBER() OVER (ORDER BY day))::int AS gap FROM d
           )
           SELECT COALESCE(MAX(n), 0) FROM (
             SELECT COUNT(*) AS n, MAX(day) AS last_day FROM g GROUP BY gap
           ) s
           WHERE s.last_day >= ((NOW() AT TIME ZONE 'Asia/Shanghai')::date - 1)"#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .db()?;
    Ok((count, streak))
}

/// 这一条规则要几次 / 几天。数不出来的（买东西、到过场）回 None。
fn 门槛(rule: &serde_json::Value) -> Option<i64> {
    let typ = rule.get("type").and_then(|x| x.as_str()).unwrap_or("");
    let action = rule.get("action").and_then(|x| x.as_str()).unwrap_or("");
    match (typ, action) {
        ("count", "naji.spin") => rule.get("threshold").and_then(|x| x.as_i64()),
        ("streak", "naji.spin") => rule.get("days").and_then(|x| x.as_i64()),
        _ => None,
    }
}

/// 够了就发，返回这一次【新拿到】的那几枚。
///
/// 发不出来不该让触发它的那件事失败（问一签、起一卦），所以调用方把错误
/// 记一行 warn 就算了 —— 但**要留那一行**：徽章 2026-08-19 接进「我」之后，
/// 「悄悄没发」是用户看得见的缺斤少两。
pub async fn 发该发的(pool: &PgPool, user_id: &str) -> Result<Vec<拿到了>, DomainError> {
    let (count, streak) = 数一数(pool, user_id).await?;
    let badges = sqlx::query("SELECT id, code, name, rule_dsl FROM badge WHERE status='active'")
        .fetch_all(pool)
        .await
        .db()?;
    let mut 新的 = Vec::new();
    for b in badges {
        let rule: serde_json::Value = b.get("rule_dsl");
        let Some(要) = 门槛(&rule) else { continue };
        let 有 = if rule.get("type").and_then(|x| x.as_str()) == Some("streak") { streak } else { count };
        if 要 <= 0 || 有 < 要 {
            continue;
        }
        let badge_id: String = b.get("id");
        // `ON CONFLICT DO NOTHING … RETURNING` —— 已经有的那一枚返回空行，
        // 于是「这一次新拿到的」这句话是真的，不需要先查一遍再插（那中间有缝）。
        let 插上了 = sqlx::query(
            "INSERT INTO user_badge (user_id, badge_id) VALUES ($1,$2) \
             ON CONFLICT DO NOTHING RETURNING badge_id",
        )
        .bind(user_id)
        .bind(&badge_id)
        .fetch_optional(pool)
        .await
        .db()?;
        if 插上了.is_some() {
            新的.push(拿到了 { code: b.get("code"), name: b.get("name") });
        }
    }
    Ok(新的)
}

/// 每一枚离拿到还差多少，按 `code` 索引。
///
/// 【为什么要有】。徽章那一屏原先只有「拿到了 / 没拿到」两态 ——
/// 「连着三十天」这枚，第 29 天看到的跟第 1 天一模一样。
/// 而这两个数后端本来就算着（发的时候就要用），只是没往外给。
pub async fn 进度表(pool: &PgPool, user_id: &str) -> Result<HashMap<String, 进度>, DomainError> {
    let (count, streak) = 数一数(pool, user_id).await?;
    let badges = sqlx::query("SELECT code, rule_dsl FROM badge WHERE status='active'")
        .fetch_all(pool)
        .await
        .db()?;
    let mut 出 = HashMap::new();
    for b in badges {
        let rule: serde_json::Value = b.get("rule_dsl");
        let Some(要) = 门槛(&rule) else { continue };
        let 有 = if rule.get("type").and_then(|x| x.as_str()) == Some("streak") { streak } else { count };
        // 拿到之后不再往上涨 —— 「103 / 100」读起来像还没完
        出.insert(b.get::<String, _>("code"), 进度 { 有: 有.min(要), 要 });
    }
    Ok(出)
}
