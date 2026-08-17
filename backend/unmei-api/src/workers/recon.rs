//! recon_scheduler · 每日 02:30(Asia/Shanghai)对每个有 settlement_pull 能力的渠道,
//! 拉前一天账单 + 对账 + insert recon_batch / recon_record。
//!
//! 这里只管【什么时候拉、跟谁拉】。拉回来之后怎么比、怎么落库,
//! 在 `unmei_app::recon` —— 那是业务写操作,只能有一份实现,
//! 而且放在那里才测得到(worker 里的 SQL 没有任何测试够得着)。

use chrono::{Duration as ChronoDuration, Timelike, Utc};
use std::time::Duration;

use unmei_app::recon;

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
        match adapter.pull_settlement(yesterday, "CNY").await {
            Ok(rows) => {
                let rows: Vec<recon::SettlementRow> = rows
                    .into_iter()
                    .map(|r| recon::SettlementRow {
                        channel_txn_id: r.channel_txn_id,
                        amount_minor: r.amount_minor,
                        status: r.status,
                    })
                    .collect();
                let out = recon::ingest_settlement(&st.db, channel, yesterday, "CNY", &rows).await?;
                if out.skipped { continue; }
                tracing::info!(
                    "recon · {channel} {yesterday}: {} 笔 · 对上 {} · 金额不符 {} · 内部缺单 {} -> {}",
                    out.total_count, out.matched, out.amount_mismatch,
                    out.missing_in_internal, out.status
                );
            }
            Err(e) => tracing::warn!("pull_settlement {channel} {yesterday}: {e}"),
        }
    }
    Ok(())
}
