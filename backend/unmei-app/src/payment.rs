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
        return Err(DomainError::Conflict(format!("order status={status}，不可再发起支付")));
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
        return Err(DomainError::Conflict(format!("payment status={cur}，不可置失败")));
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
/// ★ 两个标识各归各位(2026-08-17 修):
/// `our_ref` 是我方单号(= `payment.id`,微信的 `out_trade_no`),**定位用它**;
/// `channel_txn_id` 是渠道流水号(微信的 `transaction_id`),**只用来落档对账**。
///
/// 从前这里只有一个 `txn_id`,匹配写成 `channel_txn_id=$2 OR id=$2`。
/// 真回调传进来的是渠道流水号 —— 它既不等于我方 payment id,
/// `channel_txn_id` 那一列此刻又是 NULL,于是**两个条件都不成立、
/// UPDATE 影响 0 行、这笔支付永远不会入账**。mock 把两者填成同一个值,
/// 所以测试一直全绿,只有真接渠道那天才会暴露。
pub async fn apply_succeeded(
    pool: &PgPool,
    our_ref: &str,
    channel_txn_id: Option<&str>,
    paid_at: DateTime<Utc>,
) -> Result<(), DomainError> {
    let mut tx = pool.begin().await.db()?;

    // 去重键优先用渠道流水号:渠道重推的是同一笔交易,它才是那一笔的身份。
    // 渠道没给就退回我方单号 —— 一笔支付只成功一次,按单号去重同样成立。
    let event_key = channel_txn_id.unwrap_or(our_ref);
    sqlx::query(
        r#"INSERT INTO payment_event(id, payment_id, kind, channel, channel_event_id, payload_json, received_at)
           SELECT $1, p.id, 'PaymentSucceededByCallback', p.channel, $3, '{}'::jsonb, NOW()
           FROM payment p WHERE p.id = $2
           LIMIT 1
           ON CONFLICT (channel, channel_event_id) WHERE channel_event_id IS NOT NULL
           DO NOTHING"#,
    )
    .bind(new_id("pe"))
    .bind(our_ref)
    .bind(event_key)
    .execute(&mut *tx)
    .await.db()?;

    // 只有**真的**从 pending/processing 翻到 success 的那一次,才动订单金额。
    // RETURNING 把「这次到底改没改到行」变成可判断的值 —— 没有它就只能盲目累加。
    let applied: Option<(String, String, i64)> = sqlx::query_as(
        "UPDATE payment SET status='success', paid_at=$1,
           channel_txn_id=COALESCE($3, channel_txn_id)
         WHERE id=$2 AND status IN ('pending','processing')
         RETURNING id, order_id, amount_minor",
    )
    .bind(paid_at)
    .bind(our_ref)
    .bind(channel_txn_id)
    .fetch_optional(&mut *tx)
    .await.db()?;

    let Some((payment_id, order_id, amount_minor)) = applied else {
        // 这笔早就入过账了。渠道重推而已,不是错误 —— 提交空事务,回 200 让它别再推。
        tx.commit().await.db()?;
        tracing::debug!(our_ref, "payment.success 重复回调，已忽略");
        return Ok(());
    };

    // 旧实现这条 UPDATE 挂在 `FROM payment p` 上,没有任何前置条件,
    // 每收到一次回调就往订单上加一次钱。微信 24 小时内最多重推 15 次,
    // 于是一笔 199 元的订单能被记成实付 2985 元。
    // 由 `apply_succeeded_moves_order_to_paid_and_is_idempotent` 钉住。
    /* 金额照加 —— 钱确实到了，那是事实。但**状态只在状态机允许时才动**。
       `OrderStatus::allowed_next` 里 `Cancelled => &[]`：已取消的订单没有
       任何允许的下一个状态。而这条 SQL 原来无条件 `THEN 'paid'`，于是
       「下单 → 发起支付 → 取消 → 迟到的支付成功」会把已取消的订单改写回
       `paid`，接着照常触发履约（2026-08-18 实测：状态 cancelled → paid，
       实付 9900）。

       只有 `Unpaid` 与 `Disputed` 能走到 `Paid`（同一张表里写着），
       所以条件就是这两个。已取消的单会停在 `cancelled` 且实付 > 0 ——
       那正是「钱到了但没有归宿」，该被看见，而不是被一次静默的状态改写抹平
       （台账里那条待拍板说的就是这种钱）。 */
    let order_status: String = sqlx::query_scalar(
        r#"UPDATE order_record SET
             amount_paid_minor = amount_paid_minor + $1,
             status = CASE WHEN amount_paid_minor + $1 >= amount_total_minor
                             AND status IN ('unpaid','disputed')
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
    tracing::info!(our_ref, channel_txn_id, order_id, amount_minor, order_status, "payment.success");
    Ok(())
}

/// 同 [`apply_succeeded`]:按我方单号定位。
pub async fn apply_failed(pool: &PgPool, our_ref: &str, code: &str, msg: &str) -> Result<(), DomainError> {
    // 只翻【还在飞】的那一笔。渠道会乱序、会重推,`payment_sweep` 也可能轮到
    // 一条陈旧的渠道记录 —— 没有这个条件的话,一条迟到的失败回调就能把
    // 已经成功的一笔改成 failed,而订单那边仍然是 paid。对账、退款、后台
    // 看到的都是「付过钱但支付失败」。
    //
    // 这不是新规矩:`apply_succeeded` / `apply_expired` 都带着同样的守卫,
    // 后台手工那条 `mark_failed` 更是直接返回 Conflict。只有这里漏了。
    sqlx::query(
        "UPDATE payment SET status='failed', failure_code=$1, failure_msg=$2
         WHERE id=$3 AND status IN ('pending','processing')",
    )
    .bind(code)
    .bind(msg)
    .bind(our_ref)
    .execute(pool)
    .await.db()?;
    Ok(())
}

/// 到点还没结算的，批量置为过期。返回过期了几笔。
///
/// 这段 SQL 原来长在 `unmei-api/src/workers/payment_sweep.rs` 里 —— 那是
/// 业务写操作，只能有一份实现、且该在用例层（`recon.rs` 的注释就是这么写的）。
/// 单笔那条 [`apply_expired`] 走渠道回调，这条走本地超时，两条是同一件事的
/// 两个来源，放在一起才看得出它们用的是同一个状态守卫。
pub async fn expire_overdue(pool: &PgPool) -> Result<u64, DomainError> {
    let n = sqlx::query(
        "UPDATE payment SET status='expired'
         WHERE status IN ('pending','processing')
           AND expires_at IS NOT NULL AND expires_at < NOW()",
    )
    .execute(pool)
    .await.db()?
    .rows_affected();
    Ok(n)
}

/// 同 [`apply_succeeded`]:按我方单号定位。
pub async fn apply_expired(pool: &PgPool, our_ref: &str) -> Result<(), DomainError> {
    sqlx::query(
        "UPDATE payment SET status='expired'
         WHERE id=$1 AND status IN ('pending','processing')",
    )
    .bind(our_ref)
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
