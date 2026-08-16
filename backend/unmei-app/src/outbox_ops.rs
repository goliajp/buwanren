//! Outbox 运维用例。
//!
//! 事件的**写入**在 `unmei-domain::commerce::outbox`(要跟业务事务同批提交,
//! 所以必须能接受一个 `&mut Transaction`);这里只放后台的运维动作。

use sqlx::PgPool;
use unmei_domain::DomainError;

/// 把一条失败 / 丢弃的事件重新排进待发队列。
pub async fn retry(pool: &PgPool, event_id: &str) -> Result<(), DomainError> {
    let affected = sqlx::query(
        r#"UPDATE outbox_event SET status='pending', next_attempt_at=NOW(), last_error=NULL
           WHERE id=$1 AND status IN ('failed','dropped')"#,
    )
    .bind(event_id)
    .execute(pool)
    .await?
    .rows_affected();

    if affected == 0 {
        return Err(DomainError::Conflict(format!(
            "outbox_event {event_id} 不存在或状态不是 failed/dropped"
        )));
    }
    Ok(())
}
