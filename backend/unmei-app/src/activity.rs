//! 线下活动的报名、退订、签到。
//!
//! 【这条链从建库起就断着】（2026-09-03 五路评审 · 架构审计）。
//! `activity_registration` 有表、有 `UNIQUE(user_id, activity_id)`、
//! 有 `checked_in_at`，而整个仓里没有一行 Rust 读它或写它，库里零行。
//! 屏上写着「92/180 已报名」——那个 92 是 seed.sql 里的字面量，
//! 而成为其中一员的路根本不存在。徽章「到过场」（`activity.checkin`）
//! 挂在一个永远不会发生的动作上，六枚徽章里有一枚发不出来。
//!
//! 「有表、有种子数据、有前端在显示，唯独没有人接上」——
//! 这一轮评审里第七次遇到同一个形状。
//!
//! **人数不再存**：`activity.current_count` 那一列已经删了（20260903005）。
//! 一个存着的计数放在它数的那些行旁边就是两个真相源，而这两个源今天
//! 差了 92 个人。现在从这张表现算 —— 屏上那个数不可能跟事实对不上，
//! 因为它就是事实本身。
use sqlx::{PgPool, Row};
use unmei_domain::DomainError;

use crate::{new_id, Actor, DbResultExt};

/// 还能坐多少人。满了回 0，活动不存在回 None。
pub async fn 还剩几个位子(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    activity_id: &str,
) -> Result<Option<i64>, DomainError> {
    let row = sqlx::query(
        "SELECT a.max_participants::int8 - COUNT(r.id) FILTER (WHERE r.status='registered') AS 余
           FROM activity a
           LEFT JOIN activity_registration r ON r.activity_id = a.id
          WHERE a.id = $1
          GROUP BY a.max_participants",
    )
    .bind(activity_id)
    .fetch_optional(&mut **tx)
    .await.db()?;
    Ok(row.map(|r| r.get::<i64, _>("余")))
}

/// 报名。
///
/// 判据按发生顺序：活动在不在 → 开着没有 → 这个区能不能报 →
/// 开场了没有 → 还有没有位子 → 是不是已经报过。
///
/// `FOR UPDATE` 锁的是 activity 那一行 —— 「数位子」和「占位子」
/// 之间必须没有缝，不然最后一个位子会被两个人同时数到。
/// 库存那一处（`order::create`）用的是一句带条件的 UPDATE，
/// 这里数的是另一张表的行数，条件写不进同一句里，所以用行锁。
pub async fn register(
    pool: &PgPool,
    activity_id: &str,
    user_id: &str,
    region: &str,
) -> Result<String, DomainError> {
    let mut tx = pool.begin().await.db()?;

    let a = sqlx::query(
        "SELECT status, regions_avail, start_at FROM activity WHERE id=$1 FOR UPDATE",
    )
    .bind(activity_id)
    .fetch_optional(&mut *tx)
    .await.db()?
    .ok_or_else(|| DomainError::NotFound(format!("activity {activity_id}")))?;

    let status: String = a.get("status");
    if status != "open" {
        return Err(DomainError::Validation(format!("这场活动现在是「{status}」，报不了名")));
    }

    let 可报的区: Vec<String> =
        serde_json::from_value(a.get("regions_avail")).unwrap_or_default();
    if !可报的区.iter().any(|r| r == region) {
        // 跟券那一处同一句话：不说「这场不对你开放」，说「没有这一场」——
        // 前者等于告诉他这一场在别的区办着
        return Err(DomainError::NotFound(format!("activity {activity_id}")));
    }

    let start_at: chrono::DateTime<chrono::Utc> = a.get("start_at");
    if start_at <= chrono::Utc::now() {
        return Err(DomainError::Validation("这场已经开始了，报名截止".into()));
    }

    let 余 = 还剩几个位子(&mut tx, activity_id).await?.unwrap_or(0);
    if 余 <= 0 {
        return Err(DomainError::Conflict("这场满了".into()));
    }

    /* 【退过再报要能报回来】。表上是 `UNIQUE(user_id, activity_id)` ——
       一个人一场只有一行，退订是把那一行标成 cancelled 而不是删掉
       （删了就没人说得清他退过）。所以这里不能用 `DO NOTHING`：
       那样退过的人再也报不进来，而屏上只会说「你已经报过了」。

       `WHERE ... status='cancelled'` 让「已经报着的」这一支不返回行 ——
       跟「刚插进去」区分得开。 */
    let id = new_id("areg");
    let 成了: Option<String> = sqlx::query_scalar(
        "INSERT INTO activity_registration (id, user_id, activity_id, status)
              VALUES ($1, $2, $3, 'registered')
         ON CONFLICT (user_id, activity_id) DO UPDATE
              SET status='registered', registered_at=NOW()
            WHERE activity_registration.status='cancelled'
         RETURNING id",
    )
    .bind(&id)
    .bind(user_id)
    .bind(activity_id)
    .fetch_optional(&mut *tx)
    .await.db()?;

    let Some(报名号) = 成了 else {
        return Err(DomainError::Conflict("你已经报过这一场了".into()));
    };

    tx.commit().await.db()?;
    tracing::info!(activity_id, user_id, 报名号, "报上名了");
    Ok(报名号)
}

/// 退订。只有本人退得了 —— 所以按 (user_id, activity_id) 定位，不按报名号。
pub async fn cancel(
    pool: &PgPool,
    activity_id: &str,
    user_id: &str,
) -> Result<(), DomainError> {
    /* 【签到过就退不了】。`checked_in_at IS NULL` 这一条不是防御 ——
       人已经到场了还能把自己从名单上撤掉的话，签到那个时刻就成了一件
       事后可以否认的事，而徽章已经发出去了。 */
    let n = sqlx::query(
        "UPDATE activity_registration SET status='cancelled'
          WHERE activity_id=$1 AND user_id=$2
            AND status='registered' AND checked_in_at IS NULL",
    )
    .bind(activity_id)
    .bind(user_id)
    .execute(pool)
    .await.db()?
    .rows_affected();
    if n == 0 {
        return Err(DomainError::NotFound("你没报这一场，或者已经签到过了".into()));
    }
    Ok(())
}

/// 签到。后台扫码 / 现场核名单时调。
///
/// 顺带把「到过场」那一枚徽章发了 —— 它的规则是
/// `{"action":"activity.checkin","threshold":1}`，
/// 在这之前**全仓没有任何地方触发这个动作**，于是那一枚永远发不出来。
pub async fn check_in(
    pool: &PgPool,
    registration_id: &str,
    actor: &Actor,
) -> Result<(), DomainError> {
    let mut tx = pool.begin().await.db()?;

    let 谁: Option<String> = sqlx::query_scalar(
        "UPDATE activity_registration SET checked_in_at=NOW()
          WHERE id=$1 AND status='registered' AND checked_in_at IS NULL
         RETURNING user_id",
    )
    .bind(registration_id)
    .fetch_optional(&mut *tx)
    .await.db()?;

    /* 【签过了就说签过了，别说成功】。回 Ok 的话，现场的人不知道
       刚才这一下有没有落进去 —— 而重复签到与「这个号根本不在名单上」
       是两件不同的事，得分得开。 */
    let Some(user_id) = 谁 else {
        let 在不在: Option<Option<chrono::DateTime<chrono::Utc>>> = sqlx::query_scalar(
            "SELECT checked_in_at FROM activity_registration WHERE id=$1",
        )
        .bind(registration_id)
        .fetch_optional(&mut *tx)
        .await.db()?;
        return Err(match 在不在 {
            None => DomainError::NotFound(format!("registration {registration_id}")),
            Some(Some(_)) => DomainError::Conflict("这个人已经签到过了".into()),
            Some(None) => DomainError::Conflict("这个报名已经退了".into()),
        });
    };

    发到过场的徽章(&mut tx, &user_id).await?;

    tx.commit().await.db()?;
    tracing::info!(registration_id, user_id, actor = actor.label(), "签到了");
    Ok(())
}

/// `action == "activity.checkin"` 的徽章。
///
/// 跟 `fulfillment::发买东西的徽章` 是同一个写法（`FOR SHARE` 的理由
/// 也一样：读出来的这几枚在提交之前不许被删掉，不然外键会把整笔签到炸回去）。
async fn 发到过场的徽章(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: &str,
) -> Result<(), DomainError> {
    let badges = sqlx::query("SELECT id, rule_dsl FROM badge WHERE status='active' FOR SHARE")
        .fetch_all(&mut **tx).await.db()?;
    for b in badges {
        let rule: serde_json::Value = b.get("rule_dsl");
        if rule.get("action").and_then(|x| x.as_str()) != Some("activity.checkin") { continue }
        if rule.get("type").and_then(|x| x.as_str()) != Some("count") { continue }
        let badge_id: String = b.get("id");
        sqlx::query(
            "INSERT INTO user_badge (user_id, badge_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        ).bind(user_id).bind(&badge_id).execute(&mut **tx).await.db()?;
    }
    Ok(())
}

/// 我报了哪些场。活动页要按这个把按钮从「报名」换成「已报名」。
pub async fn mine(pool: &PgPool, user_id: &str) -> Result<Vec<String>, DomainError> {
    sqlx::query_scalar(
        "SELECT activity_id FROM activity_registration
          WHERE user_id=$1 AND status='registered'",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await.db()
}
