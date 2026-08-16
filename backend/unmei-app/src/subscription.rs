//! 订阅用例。

use chrono::{DateTime, Duration, Utc};
use sqlx::{PgPool, Row};
use unmei_domain::commerce::events::DomainEvent;
use crate::DbResultExt;
use crate::outbox;
use unmei_domain::DomainError;

use crate::{new_id, Actor};

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

// ═══════════════════════════ 续费 ═══════════════════════════

/// 一次续费尝试的结果。
#[derive(Debug, Clone, PartialEq)]
pub enum RenewOutcome {
    /// 续上了,周期已延长
    Renewed { invoice_id: String, order_id: String, period_end: DateTime<Utc> },
    /// 用户之前点过「到期不续」,到点了 —— 不收钱,置 cancelled
    StoppedAtPeriodEnd,
    /// 套餐没有激活价,收不了 —— 不再重试
    Unpriced,
    /// 已经不在可续费状态(并发下被别的动作改掉了)
    NotDue,
}

/// 给一笔到期的订阅续费。
///
/// 原本这段在 `unmei-api/src/workers/subscription_billing.rs` 里,有三个问题:
///
/// 1. **不看 `cancel_at_period_end`** —— 用户点了「到期不续」,到期照样扣钱。
///    `cancel(immediate=false)` 只是把标打上,真正要在这里被认。
/// 2. **整个流程没有事务** —— 建发票、建订单、建支付、改订阅五步分开做。
///    中间任何一步挂掉,都可能留下「钱收了但周期没延长」这种状态。
/// 3. **收不了钱时不推 `next_billing_attempt_at`** —— 没有激活价的订阅会被
///    每 5 分钟重新选出来一次,永远。
///
/// 这里三条一起解决:全程一个事务,先认取消标记,收不了就把重试时间清掉。
///
/// 目前仍是 mock 收款(直接建一条 success 的 payment)。真接入之后
/// 这里改成 `adapter.create_payment(off_session)`,失败走 dunning ——
/// dunning 的重试阶梯尚未实现,见 README「已知欠账」。
pub async fn renew_due(pool: &PgPool, subscription_id: &str) -> Result<RenewOutcome, DomainError> {
    let mut tx = pool.begin().await.db()?;

    // FOR UPDATE:同一笔订阅不会被两个 tick 同时续
    let row = sqlx::query(
        r#"SELECT s.user_id, s.status, s.current_period_end, s.cancel_at_period_end,
                  p.billing_period, p.sku_id,
                  pb.price_minor, pb.currency
           FROM subscription s
           JOIN plan p ON p.id = s.plan_id
           LEFT JOIN LATERAL (
             SELECT price_minor, currency FROM price_book
             WHERE sku_id = p.sku_id AND status='active'
               AND effective_from <= NOW()
               AND (effective_to IS NULL OR effective_to > NOW())
             ORDER BY effective_from DESC LIMIT 1
           ) pb ON TRUE
           WHERE s.id = $1
           FOR UPDATE OF s"#,
    )
    .bind(subscription_id)
    .fetch_optional(&mut *tx)
    .await.db()?
    .ok_or_else(|| DomainError::NotFound(format!("subscription {subscription_id}")))?;

    let status: String = row.get("status");
    if !["active", "past_due", "trialing"].contains(&status.as_str()) {
        tx.commit().await.db()?;
        return Ok(RenewOutcome::NotDue);
    }

    // ─── 先认取消标记,再谈收钱 ───────────────────────────────
    let cancel_at_period_end: bool = row.get("cancel_at_period_end");
    if cancel_at_period_end {
        // 状态机:Active → Cancelled 允许(Active → Expired 不允许)
        sqlx::query(
            "UPDATE subscription SET status='cancelled', cancelled_at=NOW(),
               next_billing_attempt_at=NULL WHERE id=$1",
        )
        .bind(subscription_id)
        .execute(&mut *tx)
        .await.db()?;

        // `cancel(immediate=false)` 当时刻意不发事件,说好「到期时由 billing worker 发」。
        // 就是这里。
        outbox::write(
            &mut *tx,
            &DomainEvent::SubscriptionCancelled {
                subscription_id: subscription_id.to_string(),
                occurred_at: Utc::now(),
            },
        )
        .await?;

        tx.commit().await.db()?;
        tracing::info!(subscription_id, "订阅到期不续,已停止");
        return Ok(RenewOutcome::StoppedAtPeriodEnd);
    }

    let amount_minor: Option<i64> = row.get("price_minor");
    let Some(amount_minor) = amount_minor.filter(|a| *a > 0) else {
        // 清掉重试时间,否则这条会被每个 tick 重新捞出来
        sqlx::query("UPDATE subscription SET next_billing_attempt_at=NULL WHERE id=$1")
            .bind(subscription_id)
            .execute(&mut *tx)
            .await.db()?;
        tx.commit().await.db()?;
        tracing::warn!(subscription_id, "套餐无激活价,已停止续费尝试");
        return Ok(RenewOutcome::Unpriced);
    };

    let user_id: String = row.get("user_id");
    let currency: String = row.get("currency");
    let billing_period: String = row.get("billing_period");
    let period_start: DateTime<Utc> = row.get("current_period_end");
    let period_end = period_start
        + match billing_period.as_str() {
            "quarter" => Duration::days(90),
            "year" => Duration::days(365),
            "lifetime" => Duration::days(365 * 100),
            _ => Duration::days(30),
        };

    // 复用尚未结清的发票,不重复开
    let invoice_id: String = match sqlx::query_scalar(
        "SELECT id FROM subscription_invoice WHERE subscription_id=$1 AND status='open' LIMIT 1",
    )
    .bind(subscription_id)
    .fetch_optional(&mut *tx)
    .await.db()?
    {
        Some(id) => id,
        None => {
            let id = new_id("inv");
            sqlx::query(
                r#"INSERT INTO subscription_invoice(
                     id, subscription_id, period_start, period_end, amount_minor, currency,
                     status, attempt_count, next_attempt_at
                   ) VALUES ($1, $2, $3, $4, $5, $6, 'open', 0, NOW())"#,
            )
            .bind(&id)
            .bind(subscription_id)
            .bind(period_start)
            .bind(period_end)
            .bind(amount_minor)
            .bind(&currency)
            .execute(&mut *tx)
            .await.db()?;
            id
        }
    };

    let order_id = new_id("ord-renew");
    sqlx::query(
        r#"INSERT INTO order_record(
             id, user_id, channel_origin, currency,
             amount_subtotal_minor, amount_total_minor, amount_paid_minor,
             status, source_kind, source_ref_id, region, expires_at, paid_at
           ) VALUES ($1, $2, 'system', $3, $4, $4, $4, 'paid', 'subscription_renew', $5,
                     'cn', NOW() + INTERVAL '30 minutes', NOW())"#,
    )
    .bind(&order_id)
    .bind(&user_id)
    .bind(&currency)
    .bind(amount_minor)
    .bind(&invoice_id)
    .execute(&mut *tx)
    .await.db()?;

    let payment_id = new_id("pay-renew");
    sqlx::query(
        r#"INSERT INTO payment(id, order_id, user_id, channel, amount_minor, currency,
                               status, paid_at, metadata_json)
           VALUES ($1, $2, $3, 'wechat_mp', $4, $5, 'success', NOW(),
                   '{"subscription":true}'::jsonb)"#,
    )
    .bind(&payment_id)
    .bind(&order_id)
    .bind(&user_id)
    .bind(amount_minor)
    .bind(&currency)
    .execute(&mut *tx)
    .await.db()?;

    sqlx::query(
        r#"UPDATE subscription_invoice SET status='paid', payment_id=$1,
             attempt_count = attempt_count + 1, last_attempt_at=NOW(), next_attempt_at=NULL
           WHERE id=$2"#,
    )
    .bind(&payment_id)
    .bind(&invoice_id)
    .execute(&mut *tx)
    .await.db()?;

    sqlx::query(
        r#"UPDATE subscription SET status='active',
             current_period_start=$1, current_period_end=$2, next_billing_attempt_at=$2
           WHERE id=$3"#,
    )
    .bind(period_start)
    .bind(period_end)
    .bind(subscription_id)
    .execute(&mut *tx)
    .await.db()?;

    // 旧实现完全不发事件,续费对 dispatcher / 财务是隐形的
    outbox::write(
        &mut *tx,
        &DomainEvent::SubscriptionRenewed {
            subscription_id: subscription_id.to_string(),
            period_end,
            occurred_at: Utc::now(),
        },
    )
    .await?;

    tx.commit().await.db()?;
    tracing::info!(subscription_id, %order_id, amount_minor, "订阅已续费");

    Ok(RenewOutcome::Renewed { invoice_id, order_id, period_end })
}
