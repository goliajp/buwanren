//! Outbox 写入 · 把领域事件与业务写入落在同一个事务里。
//!
//! Outbox 模式:业务表与 `outbox_event` 同批提交,提交后由 dispatcher worker
//! 异步分发。分发失败只是 outbox 留一行 pending,业务数据已经一致。
//!
//! 原本住在 `unmei-domain/commerce/outbox.rs` —— 一段拼 SQL 的代码待在
//! 最内层,domain 因此必须依赖 sqlx。搬到这里之后 domain 只剩纯类型。
//! 签名对 `Executor` 泛型,所以既能收 `&PgPool` 也能收 `&mut Transaction`,
//! 「事件必须与业务写入同事务」这条约束才立得住。

use chrono::Utc;
use sqlx::Postgres;
use unmei_domain::commerce::events::DomainEvent;
use unmei_domain::DomainError;

use crate::DbResultExt;
use crate::new_id;

/// 在事务内写一条 outbox_event。
///
/// 调用方式:
/// ```ignore
/// let mut tx = db.begin().await.db()?;
/// /* … 业务表写入 … */
/// outbox::write(&mut tx, &DomainEvent::OrderPaid { … }).await?;
/// tx.commit().await.db()?;
/// ```
pub async fn write<'c, E>(
    executor: E,
    ev: &DomainEvent,
) -> Result<String, DomainError>
where
    E: sqlx::Executor<'c, Database = Postgres>,
{
    let id = new_id("oe");
    let payload = serde_json::to_value(ev)
        .map_err(|e| DomainError::Internal(format!("serialize domain event: {e}")))?;
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
    .await.db()?;
    Ok(id)
}
