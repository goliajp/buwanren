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
use unmei_app::payment as app_payment;
use unmei_domain::commerce::adapters::WebhookEvent;

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
        // 主动轮询查到的「已支付」和渠道推过来的「已支付」是同一件事,
        // 所以走同一条用例。这里原本有自己的一份 SQL —— 与 apply_succeeded
        // 只有细微差别,而那些差别全是 bug:订单金额那条 UPDATE 没有前置条件
        // (重复执行会重复入账),payment 那条连状态守卫都没有。
        PaymentSucceeded { txn_id, paid_at, .. } => {
            app_payment::apply_succeeded(&st.db, &txn_id, paid_at)
                .await
                .map_err(|e| anyhow::anyhow!("apply_succeeded {txn_id}: {e}"))?;
        }
        PaymentFailed { txn_id, code, msg } => {
            app_payment::apply_failed(&st.db, &txn_id, &code, &msg)
                .await
                .map_err(|e| anyhow::anyhow!("apply_failed {txn_id}: {e}"))?;
        }
        _ => {}
    }
    Ok(())
}
