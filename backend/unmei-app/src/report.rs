//! 那一册 —— 买了报告之后手里拿到的东西。
//!
//! 在这之前 `async_compute` 的行付完钱直接标 done，`fulfillment_ref` 写
//! `{"mocked": true}`：订单显示「已完成」，而买家没有任何一条路读到它。
//!
//! 内容不用现编。`natal_summary.raw_chart` 里已经是 mingli 排好的整盘，
//! 每一项都带出处（格局写着「月令本气透干 月柱」、用神带 method 与
//! reasoning 原文）。这一册做的是把那份盘**冻住**：报告是买断的，
//! 买家后来改了生辰、或者排盘换了版本，已经出的那一册不许跟着变。
//!
//! 一半的买家在下单时还没填生辰（量过：`async_compute` 的行里只有 46%
//! 的买家已经有本命）。所以「还差你的生辰」不是异常分支，是主路径的一半，
//! 要跟正常那条做得一样完整：册子先立起来记成 `awaiting_natal`，
//! 买家把生辰补上时由 [`fill_awaiting`] 接着出。

use sqlx::{PgPool, Postgres, Row, Transaction};
use unmei_domain::DomainError;

use crate::new_id;
use crate::DbResultExt;

/// 这个仓库现在**真出得了**的册子种类。
///
/// 商品上的 `report_kind` 要落在这张表里,履约才给出册子。不在的话
/// 那件商品还没做完 —— 上架它的时候库里那道 CHECK 会拦住
/// (`product_listed_report_kind`),而这里是第二道:直属数据改到了、
/// 代码还没跟上时,不让它悄悄出一册不对的。
///
/// 加一种的顺序是【先这里、再上架】,不是反过来。
pub const 出得了的册子: &[&str] = &["bazi_deep"];

pub fn 出得了(kind: &str) -> bool {
    出得了的册子.contains(&kind)
}

#[derive(Debug, Clone, PartialEq)]
pub enum ReportOutcome {
    /// 盘已快照，能读了
    Ready { report_id: String },
    /// 买家还没填生辰 —— 册子立着，等他补
    AwaitingNatal { report_id: String },
    /// 这条行早就有册子了（履约重试）。不再动它
    Already { report_id: String, status: String },
}

impl ReportOutcome {
    pub fn report_id(&self) -> &str {
        match self {
            ReportOutcome::Ready { report_id }
            | ReportOutcome::AwaitingNatal { report_id }
            | ReportOutcome::Already { report_id, .. } => report_id,
        }
    }
    pub fn is_ready(&self) -> bool {
        matches!(self, ReportOutcome::Ready { .. })
            || matches!(self, ReportOutcome::Already { status, .. } if status == "ready")
    }
}

/// 履约时给这条行出一册。**重试安全**：`order_line_id` 唯一，
/// 已经有了就原样返回，不覆盖 —— 覆盖等于把买家读过的那一册换掉。
pub async fn ensure_for_line(
    tx: &mut Transaction<'_, Postgres>,
    user_id: &str,
    order_line_id: &str,
    kind: &str,
) -> Result<ReportOutcome, DomainError> {
    let existing = sqlx::query("SELECT id, status FROM report WHERE order_line_id=$1")
        .bind(order_line_id)
        .fetch_optional(&mut **tx)
        .await
        .db()?;
    if let Some(r) = existing {
        return Ok(ReportOutcome::Already { report_id: r.get("id"), status: r.get("status") });
    }

    // 用他现在的默认本命。没有默认的就拿最近建的那个 —— 只有一个本命
    // 却没标默认时，说「还差你的生辰」是错的。
    let natal = sqlx::query(
        r#"SELECT n.id, n.label, n.year, n.month, n.day, n.hour, n.minute, n.tz,
                  n.gender, n.birth_city, n.true_solar_time,
                  s.raw_chart, s.mingli_version
           FROM natal n
           LEFT JOIN natal_summary s ON s.natal_id = n.id
           WHERE n.user_id = $1
           ORDER BY n.is_default DESC, n.created_at DESC
           LIMIT 1"#,
    )
    .bind(user_id)
    .fetch_optional(&mut **tx)
    .await
    .db()?;

    let id = new_id("rpt");
    // 盘算过了才算 ready。有本命但盘是空的（排盘服务当时没起）也要等 ——
    // 拿一册空盘当「已完成」交出去，比说「还在算」糟得多。
    let chart: Option<serde_json::Value> = natal.as_ref().and_then(|n| n.get("raw_chart"));
    match (natal.as_ref(), chart) {
        (Some(n), Some(chart)) => {
            let natal_id: String = n.get("id");
            let snap = natal_snapshot(n);
            let version: Option<String> = n.get("mingli_version");
            sqlx::query(
                r#"INSERT INTO report
                     (id, user_id, order_line_id, kind, status, natal_id,
                      natal_snapshot_json, chart_json, mingli_version, ready_at)
                   VALUES ($1,$2,$3,$4,'ready',$5,$6,$7,$8,NOW())"#,
            )
            .bind(&id).bind(user_id).bind(order_line_id).bind(kind)
            .bind(&natal_id).bind(snap).bind(chart).bind(version)
            .execute(&mut **tx)
            .await
            .db()?;
            Ok(ReportOutcome::Ready { report_id: id })
        }
        _ => {
            sqlx::query(
                r#"INSERT INTO report (id, user_id, order_line_id, kind, status)
                   VALUES ($1,$2,$3,$4,'awaiting_natal')"#,
            )
            .bind(&id).bind(user_id).bind(order_line_id).bind(kind)
            .execute(&mut **tx)
            .await
            .db()?;
            Ok(ReportOutcome::AwaitingNatal { report_id: id })
        }
    }
}

/// 买家把生辰补上了 —— 把等着的那些册子接着出完。
///
/// 建本命之后调。返回补出的册子挂在哪几条订单行上（0 条是常态：
/// 多数人没在等册子）。**订单状态不在这里推** —— 那是履约的事，
/// 调用方拿着这些行去调 [`crate::fulfillment::apply_report_ready`]。
/// 册子出了而订单永远停在 fulfilling，跟没出一样难看。
pub async fn fill_awaiting(pool: &PgPool, user_id: &str, natal_id: &str) -> Result<Vec<String>, DomainError> {
    let n = sqlx::query(
        r#"SELECT n.id, n.label, n.year, n.month, n.day, n.hour, n.minute, n.tz,
                  n.gender, n.birth_city, n.true_solar_time,
                  s.raw_chart, s.mingli_version
           FROM natal n
           LEFT JOIN natal_summary s ON s.natal_id = n.id
           WHERE n.id = $1 AND n.user_id = $2"#,
    )
    .bind(natal_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .db()?;

    let Some(n) = n else { return Ok(vec![]) };
    // 盘还没算出来就先不补 —— 空盘不是一册报告
    let Some(chart) = n.get::<Option<serde_json::Value>, _>("raw_chart") else { return Ok(vec![]) };
    let snap = natal_snapshot(&n);
    let version: Option<String> = n.get("mingli_version");

    // RETURNING:补到了哪几条才回哪几条。先 SELECT 再 UPDATE 的话，
    // 中间那道缝里同一册可能被另一次请求补掉，于是这里报了一条
    // 其实不是自己补的行。
    let rows = sqlx::query(
        r#"UPDATE report SET status='ready', natal_id=$1, natal_snapshot_json=$2,
                             chart_json=$3, mingli_version=$4, ready_at=NOW()
           WHERE user_id=$5 AND status='awaiting_natal'
           RETURNING order_line_id"#,
    )
    .bind(natal_id).bind(snap).bind(chart).bind(version).bind(user_id)
    .fetch_all(pool)
    .await
    .db()?;
    Ok(rows.iter().map(|r| r.get("order_line_id")).collect())
}

/// 生辰本身也冻一份：本命被删了，这一册照样读得出它算的是谁。
fn natal_snapshot(n: &sqlx::postgres::PgRow) -> serde_json::Value {
    serde_json::json!({
        "label": n.get::<String, _>("label"),
        "year": n.get::<i32, _>("year"),
        "month": n.get::<i32, _>("month"),
        "day": n.get::<i32, _>("day"),
        "hour": n.get::<i32, _>("hour"),
        "minute": n.get::<i32, _>("minute"),
        "tz": n.get::<f64, _>("tz"),
        "gender": n.get::<Option<String>, _>("gender"),
        "birth_city": n.get::<Option<String>, _>("birth_city"),
        "true_solar_time": n.get::<bool, _>("true_solar_time"),
    })
}
