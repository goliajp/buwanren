//! recon_scheduler · 每日 02:30(Asia/Shanghai)对每个有 settlement_pull 能力的渠道,
//! 拉前一天账单 + 对账 + insert recon_batch / recon_record。
//!
//! 实现路径:
//! 1. 计算上次拉取的日期(以 Shanghai 时区切日)
//! 2. for each channel: adapter.pull_settlement(yesterday)
//! 3. INSERT batch + records (match by channel_txn_id)
//! 4. 异常项标 has_discrepancy

use chrono::{Duration as ChronoDuration, Timelike, Utc};
use std::time::Duration;
use uuid::Uuid;

use crate::state::AppState;

const CHECK_INTERVAL_SECS: u64 = 600; // 10 min 检查一次是否到了 02:30

pub async fn run(state: AppState) {
    let mut tick = tokio::time::interval(Duration::from_secs(CHECK_INTERVAL_SECS));
    tick.tick().await;
    loop {
        tick.tick().await;
        if !should_run_now() { continue; }
        if let Err(e) = run_recon(&state).await {
            tracing::warn!("recon_scheduler failed: {e}");
        }
    }
}

/// Asia/Shanghai (UTC+8) 02:00-02:59 之间且当天没跑过
fn should_run_now() -> bool {
    let shanghai = Utc::now() + ChronoDuration::hours(8);
    let hour = shanghai.hour();
    hour == 2
}

async fn run_recon(st: &AppState) -> anyhow::Result<()> {
    // 计算昨日(Shanghai)
    let shanghai_today = (Utc::now() + ChronoDuration::hours(8)).date_naive();
    let yesterday = shanghai_today - ChronoDuration::days(1);

    let channels = [
        ("wechat_jsapi", st.payment_adapters.wechat_jsapi.clone()),
        ("wechat_mp",    st.payment_adapters.wechat_mp.clone()),
    ];

    for (channel, adapter) in channels {
        // 检查今天有没有跑过
        let exists: Option<String> = sqlx::query_scalar(
            "SELECT id FROM recon_batch WHERE channel=$1 AND batch_date=$2 AND source='channel_pulled' LIMIT 1",
        ).bind(channel).bind(yesterday).fetch_optional(&st.db).await?;
        if exists.is_some() { continue; }

        match adapter.pull_settlement(yesterday, "CNY").await {
            Ok(rows) => {
                let bid = format!("rb-{}", Uuid::new_v4());
                let total_count = rows.len() as i32;
                let total_amount: i64 = rows.iter().map(|r| r.amount_minor).sum();

                sqlx::query(
                    r#"INSERT INTO recon_batch(id, channel, batch_date, source, total_count, total_amount_minor, currency, status, pulled_at)
                       VALUES ($1, $2, $3, 'channel_pulled', $4, $5, 'CNY', 'pulled', NOW())"#,
                ).bind(&bid).bind(channel).bind(yesterday).bind(total_count).bind(total_amount)
                 .execute(&st.db).await?;

                let mut mismatches = 0;
                for r in rows {
                    let matched: Option<String> = sqlx::query_scalar(
                        "SELECT id FROM payment WHERE channel_txn_id=$1 LIMIT 1",
                    ).bind(&r.channel_txn_id).fetch_optional(&st.db).await?;
                    let state = if matched.is_some() { "matched" } else { mismatches += 1; "missing_in_internal" };
                    sqlx::query(
                        r#"INSERT INTO recon_record(id, batch_id, channel_txn_id, channel_amount_minor, channel_status, matched_payment_id, match_state)
                           VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
                    ).bind(format!("rr-{}", Uuid::new_v4())).bind(&bid)
                     .bind(&r.channel_txn_id).bind(r.amount_minor).bind(&r.status)
                     .bind(matched).bind(state).execute(&st.db).await?;
                }

                let final_status = if mismatches > 0 { "has_discrepancy" } else { "matched" };
                sqlx::query("UPDATE recon_batch SET status=$1, matched_at=NOW() WHERE id=$2")
                    .bind(final_status).bind(&bid).execute(&st.db).await?;
                tracing::info!("recon · {channel} {yesterday}: {total_count} txns, {mismatches} mismatch -> {final_status}");
            }
            Err(e) => tracing::warn!("pull_settlement {channel} {yesterday}: {e}"),
        }
    }
    Ok(())
}
