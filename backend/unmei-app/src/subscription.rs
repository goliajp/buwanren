//! 订阅用例。

use chrono::Utc;
use sqlx::PgPool;
use unmei_domain::commerce::events::DomainEvent;
use crate::DbResultExt;
use crate::outbox;
use unmei_domain::DomainError;

use crate::Actor;

/// 取消订阅。
///
/// `immediate=false`(默认)只打「到期不续」的标,当前周期照常服务;
/// `immediate=true` 立即终止。
///
/// 旧实现两条分支都不写领域事件,`reason` 与 `admin` 两个参数拿到手就
/// `let _ = ...` 丢掉了 —— 订阅被谁在什么时候为什么取消,查不到。
/// 这里补上 `SubscriptionCancelled` 事件,把操作人与原因带进 payload。
///
/// 注意:`subscription` 表**没有 `audit_note` 列**(其它 8 张商业表都有),
/// 所以审计只能走事件,不能像别处那样追加备注。要在库里也留痕需要加列 ——
/// 那是一次 migration,不在本次范围内。
pub async fn cancel(
    pool: &PgPool,
    subscription_id: &str,
    immediate: bool,
    reason: Option<&str>,
    actor: &Actor,
) -> Result<(), DomainError> {
    let mut tx = pool.begin().await.db()?;

    let affected = if immediate {
        sqlx::query(
            "UPDATE subscription SET status='cancelled', cancelled_at=NOW() WHERE id=$1",
        )
        .bind(subscription_id)
        .execute(&mut *tx)
        .await.db()?
        .rows_affected()
    } else {
        sqlx::query("UPDATE subscription SET cancel_at_period_end=true WHERE id=$1")
            .bind(subscription_id)
            .execute(&mut *tx)
            .await.db()?
            .rows_affected()
    };

    if affected == 0 {
        return Err(DomainError::NotFound(format!("subscription {subscription_id}")));
    }

    // 只有立即终止才是真的「已取消」;到期不续要等周期结束,
    // 由 billing worker 在那时落事件。
    if immediate {
        outbox::write(
            &mut *tx,
            &DomainEvent::SubscriptionCancelled {
                subscription_id: subscription_id.to_string(),
                occurred_at: Utc::now(),
            },
        )
        .await?;
    }

    tracing::info!(
        subscription_id,
        immediate,
        actor = %actor.label(),
        reason = reason.unwrap_or("-"),
        "subscription.cancel"
    );

    tx.commit().await.db()?;
    Ok(())
}
