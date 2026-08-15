//! Outbox 写入工具 · 让 service / route 把领域事件落到 `outbox_event` 表。
//!
//! Outbox 模式:在业务事务内同写 outbox_event,事务提交后由 dispatcher worker
//! 异步分发。失败也只是 outbox 留个 pending 行,业务表已经一致。

use chrono::Utc;
use sqlx::Postgres;
use uuid::Uuid;

use super::events::DomainEvent;
use crate::DomainError;

/// 在事务内写一条 outbox_event。
///
/// 调用方式:
/// ```ignore
/// let mut tx = db.begin().await?;
/// /* … 业务表写入 … */
/// outbox::write(&mut tx, &DomainEvent::OrderPaid { … }).await?;
/// tx.commit().await?;
/// ```
pub async fn write<'c, E>(
    executor: E,
    ev: &DomainEvent,
) -> Result<String, DomainError>
where
    E: sqlx::Executor<'c, Database = Postgres>,
{
    let id = format!("oe-{}", Uuid::new_v4());
    let payload = serde_json::to_value(ev)?;
    sqlx::query(
        r#"INSERT INTO outbox_event(
             id, kind, aggregate_kind, aggregate_id, payload_json, status, next_attempt_at, created_at
           ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), $6)"#,
    )
    .bind(&id)
    .bind(ev.kind_str())
    .bind(ev.aggregate_kind())
    .bind(ev.aggregate_id())
    .bind(payload)
    .bind(Utc::now())
    .execute(executor)
    .await?;
    Ok(id)
}
