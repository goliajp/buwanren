//! payment_query_sweeper · 每 30s 扫超时未结算 payment 拉准状态。
//!
//! 触发场景:回调丢失 / 渠道延迟。
//! 流程:
//! 1. SELECT payment WHERE status IN (pending, processing)
//!    AND (created_at + interval '1 minute') < NOW()
//! 2. 调 payment_adapter.query_payment(payment_id)
//! 3. 翻译 outcome → 状态更新 + 事件入库

use sqlx::Row;
use std::time::Duration;
use unmei_domain::commerce::adapters::WebhookEvent;
use unmei_domain::commerce::events::DomainEvent;
use unmei_app::outbox;

use crate::state::AppState;

const INTERVAL_SECS: u64 = 30;

pub async fn run(state: AppState) {
    let mut tick = tokio::time::interval(Duration::from_secs(INTERVAL_SECS));
    tick.tick().await;
    loop {
        tick.tick().await;
        if let Err(e) = sweep_once(&state).await {
            tracing::warn!("payment_query_sweeper failed: {e}");
        }
    }
}

async fn sweep_once(st: &AppState) -> anyhow::Result<()> {
    let rows = sqlx::query(
        r#"SELECT id, channel
           FROM payment
           WHERE status IN ('pending','processing')
             AND created_at < NOW() - INTERVAL '1 minute'
             AND (expires_at IS NULL OR expires_at > NOW())
           ORDER BY created_at ASC
           LIMIT 50"#,
    ).fetch_all(&st.db).await?;
    if rows.is_empty() { return Ok(()); }
    tracing::debug!("payment_query_sweeper: scanning {} pending payments", rows.len());

    for row in rows {
        let pid: String = row.try_get("id")?;
        let channel: String = row.try_get("channel")?;
        let Some(adapter) = st.payment_adapters.pick(&channel) else {
            tracing::trace!("no adapter for channel {channel} (payment={pid}) — skip");
            continue;
        };

        match adapter.query_payment(&pid).await {
            Ok(ev) => {
                if let Err(e) = apply_event(st, &channel, ev).await {
                    tracing::warn!("apply_event {pid}: {e}");
                }
            }
            Err(e) => tracing::trace!("query_payment {pid}: {e}"),
        }
    }

    // 顺便 expire 那些超期未结算的
    let expired = sqlx::query(
        r#"UPDATE payment SET status='expired'
           WHERE status IN ('pending','processing')
             AND expires_at IS NOT NULL AND expires_at < NOW()
           RETURNING id"#,
    ).fetch_all(&st.db).await?;
    if !expired.is_empty() {
        tracing::info!("payment_query_sweeper: expired {} payments", expired.len());
    }
    Ok(())
}

async fn apply_event(st: &AppState, _channel: &str, ev: WebhookEvent) -> anyhow::Result<()> {
    use WebhookEvent::*;
    match ev {
        PaymentSucceeded { txn_id, paid_at, .. } => {
            // 找出会被更新到 success 的 payment + 关联 order
            let row = sqlx::query(
                "SELECT id, order_id FROM payment WHERE (channel_txn_id=$1 OR id=$1) AND status IN ('pending','processing') LIMIT 1",
            ).bind(&txn_id).fetch_optional(&st.db).await?;
            let Some(row) = row else { return Ok(()); };
            let pay_id: String = row.try_get("id")?;
            let order_id: String = row.try_get("order_id")?;

            let mut tx = st.db.begin().await?;
            sqlx::query(
                "UPDATE payment SET status='success', paid_at=$1, channel_txn_id=COALESCE(channel_txn_id, $2) WHERE id=$3",
            ).bind(paid_at).bind(&txn_id).bind(&pay_id).execute(&mut *tx).await?;
            let order_paid_now: Option<i32> = sqlx::query_scalar(
                r#"UPDATE order_record o SET
                     amount_paid_minor = amount_paid_minor + p.amount_minor,
                     status = CASE WHEN o.amount_paid_minor + p.amount_minor >= o.amount_total_minor
                                   THEN 'paid' ELSE o.status END,
                     paid_at = COALESCE(o.paid_at, NOW())
                   FROM payment p
                   WHERE p.id = $1 AND p.order_id = o.id
                   RETURNING CASE WHEN o.status='paid' THEN 1 ELSE 0 END"#,
            ).bind(&pay_id).fetch_optional(&mut *tx).await?;
            // 写 OrderPaid 事件
            if matches!(order_paid_now, Some(1)) {
                outbox::write(&mut *tx, &DomainEvent::OrderPaid {
                    order_id: order_id.clone(),
                    payment_id: pay_id.clone(),
                    occurred_at: paid_at,
                })
                .await
                .map_err(|e| anyhow::anyhow!("outbox: {e}"))?;
            }
            tx.commit().await?;
        }
        PaymentFailed { txn_id, code, msg } => {
            sqlx::query("UPDATE payment SET status='failed', failure_code=$1, failure_msg=$2 WHERE (channel_txn_id=$3 OR id=$3) AND status IN ('pending','processing')")
                .bind(&code).bind(&msg).bind(&txn_id).execute(&st.db).await?;
        }
        _ => {}
    }
    Ok(())
}
