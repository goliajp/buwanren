//! subscription_billing · 每 5min 扫到期订阅并续费。
//!
//! 这里只做两件事:**选出到期的**、**逐条交给用例层**。
//! 续费本身(建发票 / 建订单 / 建支付 / 延周期 / 发事件)在
//! [`unmei_app::subscription::renew_due`] —— 它跟客户端、后台看到的是同一份实现,
//! 而且整笔在一个事务里。
//!
//! 扣款失败走 [`unmei_app::subscription::record_renewal_failure`] 的 dunning 阶梯:
//! T+1d / T+3d / T+7d 三次重试 → past_due → grace → expired。
//!
//! 原本这个文件自己拼了一整套 SQL,与用例层重复,且带三个 bug:
//! 不认 `cancel_at_period_end`(到期不续的用户照样被扣钱)、
//! 五步写入没有事务、收不了钱时不清 `next_billing_attempt_at`(每 5 分钟重试到永远)。

use sqlx::Row;
use std::time::Duration as StdDuration;
use unmei_app::subscription::{self as app_subscription, RenewOutcome};

use crate::state::AppState;

const INTERVAL_SECS: u64 = 300; // 5 min
const BATCH: i64 = 50;

pub async fn run(state: AppState) {
    let mut tick = tokio::time::interval(StdDuration::from_secs(INTERVAL_SECS));
    tick.tick().await;
    loop {
        tick.tick().await;
        if let Err(e) = sweep_once(&state).await {
            tracing::warn!("subscription_billing failed: {e}");
        }
    }
}

async fn sweep_once(st: &AppState) -> anyhow::Result<()> {
    // 只取 id。剩下的字段用例层自己在事务里带 FOR UPDATE 读 ——
    // 在这里读出来再传进去,中间那段时间足够别人把订阅改掉。
    let ids: Vec<String> = sqlx::query(
        r#"SELECT id FROM subscription
           WHERE status IN ('active','past_due','trialing')
             AND next_billing_attempt_at IS NOT NULL
             AND next_billing_attempt_at <= NOW()
           ORDER BY next_billing_attempt_at ASC
           LIMIT $1"#,
    )
    .bind(BATCH)
    .fetch_all(&st.db)
    .await?
    .into_iter()
    .map(|r| r.get::<String, _>("id"))
    .collect();

    if ids.is_empty() {
        return Ok(());
    }
    tracing::info!("subscription_billing: {} subs due", ids.len());

    let (mut renewed, mut stopped, mut unpriced, mut failed) = (0, 0, 0, 0);
    for id in &ids {
        // 一条失败不该影响其它条 —— 各自独立事务
        match app_subscription::renew_due(&st.db, id).await {
            Ok(RenewOutcome::Renewed { .. }) => renewed += 1,
            Ok(RenewOutcome::StoppedAtPeriodEnd) => stopped += 1,
            Ok(RenewOutcome::Unpriced) => unpriced += 1,
            Ok(RenewOutcome::NotDue) => {}
            Err(e) => {
                failed += 1;
                tracing::warn!(subscription_id = %id, "renew failed: {e}");
                // 不进 dunning 的话,这条订阅会在 5 分钟后被原样选出来再试一次,
                // 永远 —— 直到有人去库里手改。阶梯把「再试」变成有限次、有间隔、有终点。
                if let Err(e2) = app_subscription::record_renewal_failure(&st.db, id, &e.to_string()).await {
                    tracing::error!(subscription_id = %id, "记 dunning 也失败了: {e2}");
                }
            }
        }
    }
    tracing::info!(
        renewed, stopped_at_period_end = stopped, unpriced, failed,
        "subscription_billing done"
    );
    Ok(())
}
