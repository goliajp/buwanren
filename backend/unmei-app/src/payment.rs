//! 支付用例。
//!
//! 发起支付本身要调 `PaymentAdapter`(渠道 SDK 在 `unmei-wx`),
//! 而 adapter 的挑选依赖各 binary 自己的 registry。所以这里把用例切成两半:
//! 落库的部分在这里,调渠道的部分留给调用方,中间用
//! [`PendingPayment`] / [`record_attempt`] 衔接。这样「写哪些表、幂等怎么做」
//! 仍然只有一份实现。

use chrono::{DateTime, Duration, Utc};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use unmei_domain::DomainError;

use crate::DbResultExt;
use crate::{new_id, Actor};

/// 已在库里占好位、等着送去渠道下单的一笔支付。
#[derive(Debug, Clone)]
pub struct PendingPayment {
    pub payment_id: String,
    pub order_id: String,
    pub user_id: String,
    pub channel: String,
    pub amount_minor: i64,
    pub currency: String,
    pub expires_at: DateTime<Utc>,
}

/// 为订单发起一笔支付,落 `payment` 行。
///
/// 校验:订单存在 → 属主匹配 → 状态为 `unpaid` → 应付余额 > 0。
/// 金额取 `amount_total_minor - amount_paid_minor`,不信任调用方传的数。
pub async fn start(
    pool: &PgPool,
    order_id: &str,
    user_id: &str,
    channel: &str,
    channel_user_ref: Option<&str>,
) -> Result<PendingPayment, DomainError> {
    let order = sqlx::query(
        "SELECT user_id, status, amount_total_minor, amount_paid_minor, currency
         FROM order_record WHERE id=$1",
    )
    .bind(order_id)
    .fetch_optional(pool)
    .await.db()?
    .ok_or_else(|| DomainError::NotFound(format!("order {order_id}")))?;

    let owner: String = order.get("user_id");
    if owner != user_id {
        return Err(DomainError::NotFound(format!("order {order_id}")));
    }
    let status: String = order.get("status");
    if status != "unpaid" {
        return Err(DomainError::Conflict(format!("order status={status},不可再发起支付")));
    }

    let total: i64 = order.get("amount_total_minor");
    let paid: i64 = order.get("amount_paid_minor");
    let due = total - paid;
    if due <= 0 {
        return Err(DomainError::Validation(format!("应付余额 {due} ≤ 0")));
    }
    let currency: String = order.get("currency");

    let payment_id = new_id("pay");
    let expires_at = Utc::now() + Duration::minutes(30);

    sqlx::query(
        r#"INSERT INTO payment(id, order_id, user_id, channel, amount_minor, currency, status,
                               channel_user_ref, expires_at, metadata_json)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, '{}'::jsonb)"#,
    )
    .bind(&payment_id)
    .bind(order_id)
    .bind(user_id)
    .bind(channel)
    .bind(due)
    .bind(&currency)
    .bind(channel_user_ref)
    .bind(expires_at)
    .execute(pool)
    .await.db()?;

    Ok(PendingPayment {
        payment_id,
        order_id: order_id.to_string(),
        user_id: user_id.to_string(),
        channel: channel.to_string(),
        amount_minor: due,
        currency,
        expires_at,
    })
}

/// 记一次渠道下单往返。调用方拿到 adapter 的返回后调。
pub async fn record_attempt(
    pool: &PgPool,
    payment_id: &str,
    request: Value,
    response: Value,
) -> Result<(), DomainError> {
    sqlx::query(
        r#"INSERT INTO payment_attempt(id, payment_id, attempt_no, request_payload_json, response_payload_json)
           VALUES ($1, $2,
                   COALESCE((SELECT MAX(attempt_no) FROM payment_attempt WHERE payment_id=$2), 0) + 1,
                   $3, $4)"#,
    )
    .bind(new_id("pa"))
    .bind(payment_id)
    .bind(request)
    .bind(response)
    .execute(pool)
    .await.db()?;
    Ok(())
}

/// 后台手工置失败。
pub async fn mark_failed(
    pool: &PgPool,
    payment_id: &str,
    code: &str,
    msg: &str,
    actor: &Actor,
) -> Result<(), DomainError> {
    let cur: Option<String> = sqlx::query_scalar("SELECT status FROM payment WHERE id=$1")
        .bind(payment_id)
        .fetch_optional(pool)
        .await.db()?;
    let cur = cur.ok_or_else(|| DomainError::NotFound(format!("payment {payment_id}")))?;
    if !["pending", "processing", "cancelling"].contains(&cur.as_str()) {
        return Err(DomainError::Conflict(format!("payment status={cur},不可置失败")));
    }
    sqlx::query(
        "UPDATE payment SET status='failed', failure_code=$1, failure_msg=$2,
           audit_note = audit_note || E'\\n' || $3 WHERE id=$4",
    )
    .bind(code)
    .bind(msg)
    .bind(format!("{} mark_failed", actor.label()))
    .bind(payment_id)
    .execute(pool)
    .await.db()?;
    Ok(())
}

// ═══════════════════════════ 渠道回调 ═══════════════════════════

/// 渠道回调:支付成功。
///
/// `txn_id` 既可能是渠道流水号也可能是我们自己的 payment_id,
/// 两种都认(旧实现的行为,保留)。
pub async fn apply_succeeded(
    pool: &PgPool,
    txn_id: &str,
    paid_at: DateTime<Utc>,
) -> Result<(), DomainError> {
    let mut tx = pool.begin().await.db()?;

    sqlx::query(
        r#"INSERT INTO payment_event(id, payment_id, kind, channel, channel_event_id, payload_json, received_at)
           SELECT $1, p.id, 'PaymentSucceededByCallback', p.channel, $2, '{}'::jsonb, NOW()
           FROM payment p WHERE p.channel_txn_id = $2 OR p.id = $2
           LIMIT 1"#,
    )
    .bind(new_id("pe"))
    .bind(txn_id)
    .execute(&mut *tx)
    .await.db()?;

    sqlx::query(
        "UPDATE payment SET status='success', paid_at=$1,
           channel_txn_id=COALESCE(channel_txn_id, $2)
         WHERE (channel_txn_id=$2 OR id=$2) AND status IN ('pending','processing')",
    )
    .bind(paid_at)
    .bind(txn_id)
    .execute(&mut *tx)
    .await.db()?;

    sqlx::query(
        r#"UPDATE order_record o SET
             amount_paid_minor = amount_paid_minor + p.amount_minor,
             status = CASE WHEN o.amount_paid_minor + p.amount_minor >= o.amount_total_minor
                           THEN 'paid' ELSE o.status END,
             paid_at = COALESCE(o.paid_at, NOW())
           FROM payment p
           WHERE p.id IN (SELECT id FROM payment WHERE channel_txn_id=$1 OR id=$1)
             AND p.order_id = o.id"#,
    )
    .bind(txn_id)
    .execute(&mut *tx)
    .await.db()?;

    tx.commit().await.db()?;
    tracing::info!(txn_id, "payment.success");
    Ok(())
}

pub async fn apply_failed(pool: &PgPool, txn_id: &str, code: &str, msg: &str) -> Result<(), DomainError> {
    sqlx::query(
        "UPDATE payment SET status='failed', failure_code=$1, failure_msg=$2
         WHERE channel_txn_id=$3 OR id=$3",
    )
    .bind(code)
    .bind(msg)
    .bind(txn_id)
    .execute(pool)
    .await.db()?;
    Ok(())
}

pub async fn apply_expired(pool: &PgPool, txn_id: &str) -> Result<(), DomainError> {
    sqlx::query(
        "UPDATE payment SET status='expired'
         WHERE (channel_txn_id=$1 OR id=$1) AND status IN ('pending','processing')",
    )
    .bind(txn_id)
    .execute(pool)
    .await.db()?;
    Ok(())
}

/// 支付发起后返回给客户端的载荷,原样透传 adapter 的 outcome。
pub fn outcome_payload(payment_id: &str, outcome: &impl serde::Serialize) -> Result<Value, DomainError> {
    Ok(json!({
        "payment_id": payment_id,
        "outcome": serde_json::to_value(outcome)?,
    }))
}
