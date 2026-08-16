//! 退款用例。

use chrono::Utc;
use sqlx::{PgPool, Row};
use unmei_domain::commerce::events::DomainEvent;
use unmei_domain::commerce::outbox;
use unmei_domain::DomainError;

use crate::{new_id, Actor};

/// 用户发起退款申请。
///
/// 可退金额 = `amount_paid_minor - amount_refunded_minor`,由服务端算,
/// 不接受调用方传的余额。`payment_id` 缺省时自动挑最近一笔成功支付。
pub async fn request(
    pool: &PgPool,
    order_id: &str,
    user_id: &str,
    payment_id: Option<String>,
    amount_minor: Option<i64>,
    reason_code: &str,
    reason_text: Option<&str>,
) -> Result<String, DomainError> {
    let order = sqlx::query(
        "SELECT user_id, amount_paid_minor, amount_refunded_minor, currency
         FROM order_record WHERE id=$1",
    )
    .bind(order_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| DomainError::NotFound(format!("order {order_id}")))?;

    let owner: String = order.get("user_id");
    if owner != user_id {
        return Err(DomainError::NotFound(format!("order {order_id}")));
    }

    let paid: i64 = order.get("amount_paid_minor");
    let refunded: i64 = order.get("amount_refunded_minor");
    let remaining = paid - refunded;
    let amount = amount_minor.unwrap_or(remaining);
    if amount <= 0 || amount > remaining {
        return Err(DomainError::Validation(format!(
            "退款金额 {amount} 超出可退余额 {remaining}"
        )));
    }

    let payment_id = match payment_id {
        Some(p) => p,
        None => sqlx::query_scalar(
            "SELECT id FROM payment WHERE order_id=$1 AND status='success'
             ORDER BY paid_at DESC LIMIT 1",
        )
        .bind(order_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| DomainError::Validation("无成功支付可退".into()))?,
    };

    let currency: String = order.get("currency");
    let refund_id = new_id("rfd");

    sqlx::query(
        r#"INSERT INTO refund(id, order_id, payment_id, amount_minor, currency,
                              reason_code, reason_text, actor_kind, actor_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'user', $8, 'requested')"#,
    )
    .bind(&refund_id)
    .bind(order_id)
    .bind(&payment_id)
    .bind(amount)
    .bind(&currency)
    .bind(reason_code)
    .bind(reason_text.unwrap_or_default())
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(refund_id)
}

/// 后台批准退款。
///
/// 目前是 mock 直推 success —— 真接入后这里改成 `adapter.refund()` 发起、
/// 由渠道 webhook 推到 success。`RefundCompleted` 事件照写,
/// dispatcher 据此做财务复式挂账。
pub async fn approve(pool: &PgPool, refund_id: &str, actor: &Actor) -> Result<(), DomainError> {
    let mut tx = pool.begin().await?;

    let row = sqlx::query(
        "SELECT order_id, payment_id, amount_minor FROM refund
         WHERE id=$1 AND status='requested' FOR UPDATE",
    )
    .bind(refund_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| DomainError::NotFound(format!("refund {refund_id} (或状态非 requested)")))?;

    let order_id: String = row.get("order_id");
    let payment_id: String = row.get("payment_id");
    let amount: i64 = row.get("amount_minor");

    sqlx::query(
        r#"UPDATE refund SET status='success', approved_at=NOW(), approved_by_admin_id=$1,
             processed_at=NOW(), completed_at=NOW(),
             channel_refund_id = 'MOCK_' || id
           WHERE id=$2"#,
    )
    .bind(actor.id.as_deref())
    .bind(refund_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"UPDATE payment SET status = CASE
             WHEN $1 >= amount_minor THEN 'refunded' ELSE 'refunded_partial' END
           WHERE id=$2"#,
    )
    .bind(amount)
    .bind(&payment_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"UPDATE order_record SET
             amount_refunded_minor = amount_refunded_minor + $1,
             status = CASE
               WHEN amount_refunded_minor + $1 >= amount_total_minor THEN 'refunded'
               WHEN status IN ('paid','fulfilling','done') THEN 'refund_partial'
               ELSE status END
           WHERE id=$2"#,
    )
    .bind(amount)
    .bind(&order_id)
    .execute(&mut *tx)
    .await?;

    outbox::write(
        &mut *tx,
        &DomainEvent::RefundCompleted {
            refund_id: refund_id.to_string(),
            occurred_at: Utc::now(),
        },
    )
    .await?;

    tx.commit().await?;
    Ok(())
}

/// 后台驳回退款。
pub async fn deny(
    pool: &PgPool,
    refund_id: &str,
    reason: &str,
    actor: &Actor,
) -> Result<(), DomainError> {
    let affected = sqlx::query(
        "UPDATE refund SET status='cancelled', audit_note = audit_note || E'\\n' || $1
         WHERE id=$2 AND status IN ('requested','failed')",
    )
    .bind(format!("{} deny: {reason}", actor.label()))
    .bind(refund_id)
    .execute(pool)
    .await?
    .rows_affected();

    // 旧实现不看影响行数:驳回一个不存在的、或已经成功的退款都会返回 ok:true。
    if affected == 0 {
        return Err(DomainError::NotFound(format!(
            "refund {refund_id} (或状态不是 requested/failed)"
        )));
    }
    Ok(())
}

/// 渠道回调:退款成功 / 失败。
pub async fn apply_succeeded(pool: &PgPool, channel_refund_id: &str) -> Result<(), DomainError> {
    sqlx::query(
        "UPDATE refund SET status='success', completed_at=NOW()
         WHERE channel_refund_id=$1 OR id=$1",
    )
    .bind(channel_refund_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn apply_failed(
    pool: &PgPool,
    channel_refund_id: &str,
    code: &str,
    msg: &str,
) -> Result<(), DomainError> {
    sqlx::query(
        "UPDATE refund SET status='failed', failure_code=$1, failure_msg=$2
         WHERE channel_refund_id=$3 OR id=$3",
    )
    .bind(code)
    .bind(msg)
    .bind(channel_refund_id)
    .execute(pool)
    .await?;
    Ok(())
}
