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
use unmei_domain::commerce::events::DomainEvent;
use unmei_domain::DomainError;

use crate::outbox;
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
    // 风控(台账 D7)。这一处是钱真要动的地方,所以两个接线点里它更要紧。
    crate::risk::gate(pool, &crate::risk::RiskEvalContext {
        kind: "pre_pay".into(),
        user_id: Some(user_id.to_string()),
        order_id: Some(order_id.to_string()),
        payment_id: None,
        amount_minor: None,
        user_age_days: None,
        extras: serde_json::json!({ "channel": channel }),
    }).await?;

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
///
/// **幂等**。渠道重推同一笔回调是常态而不是异常 —— 微信支付在 24 小时内
/// 最多重推 15 次,直到拿到成功响应。两道防线:
///
/// 1. `payment_event` 上的 `uq_payment_event_channel_eid`
///    (`(channel, channel_event_id)` 部分唯一索引)配 `ON CONFLICT DO NOTHING`
/// 2. `payment` 的 UPDATE 带 `status IN ('pending','processing')` 前置条件,
///    已经 success 的不会被再加一次钱
///
/// 第 1 条以前漏了 `ON CONFLICT` —— 索引建了、注释也写着「幂等」,但重推会撞
/// 唯一约束直接报错,于是渠道收到 500、继续重推,循环到重试耗尽。
/// 由 `apply_succeeded_moves_order_to_paid_and_is_idempotent` 这条测试钉住。
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
           LIMIT 1
           ON CONFLICT (channel, channel_event_id) WHERE channel_event_id IS NOT NULL
           DO NOTHING"#,
    )
    .bind(new_id("pe"))
    .bind(txn_id)
    .execute(&mut *tx)
    .await.db()?;

    // 只有**真的**从 pending/processing 翻到 success 的那一次,才动订单金额。
    // RETURNING 把「这次到底改没改到行」变成可判断的值 —— 没有它就只能盲目累加。
    let applied: Option<(String, String, i64)> = sqlx::query_as(
        "UPDATE payment SET status='success', paid_at=$1,
           channel_txn_id=COALESCE(channel_txn_id, $2)
         WHERE (channel_txn_id=$2 OR id=$2) AND status IN ('pending','processing')
         RETURNING id, order_id, amount_minor",
    )
    .bind(paid_at)
    .bind(txn_id)
    .fetch_optional(&mut *tx)
    .await.db()?;

    let Some((payment_id, order_id, amount_minor)) = applied else {
        // 这笔早就入过账了。渠道重推而已,不是错误 —— 提交空事务,回 200 让它别再推。
        tx.commit().await.db()?;
        tracing::debug!(txn_id, "payment.success 重复回调,已忽略");
        return Ok(());
    };

    // 旧实现这条 UPDATE 挂在 `FROM payment p` 上,没有任何前置条件,
    // 每收到一次回调就往订单上加一次钱。微信 24 小时内最多重推 15 次,
    // 于是一笔 199 元的订单能被记成实付 2985 元。
    // 由 `apply_succeeded_moves_order_to_paid_and_is_idempotent` 钉住。
    let order_status: String = sqlx::query_scalar(
        r#"UPDATE order_record SET
             amount_paid_minor = amount_paid_minor + $1,
             status = CASE WHEN amount_paid_minor + $1 >= amount_total_minor
                           THEN 'paid' ELSE status END,
             paid_at = COALESCE(paid_at, NOW())
           WHERE id = $2
           RETURNING status"#,
    )
    .bind(amount_minor)
    .bind(&order_id)
    .fetch_one(&mut *tx)
    .await.db()?;

    // 订单这一刻才付清 → 发 OrderPaid,下游 dispatcher 据此推进履约。
    //
    // 这条事件原先只有 payment_sweep worker 会发,渠道回调这条路径不发 ——
    // 也就是说真接入微信之后,走 webhook 进来的支付**永远不会触发履约**。
    // 两条路径本来就该是同一件事,所以合并到这里。
    if order_status == "paid" {
        outbox::write(
            &mut *tx,
            &DomainEvent::OrderPaid {
                order_id: order_id.clone(),
                payment_id: payment_id.clone(),
                occurred_at: paid_at,
            },
        )
        .await?;
    }

    tx.commit().await.db()?;
    tracing::info!(txn_id, order_id, amount_minor, order_status, "payment.success");
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
