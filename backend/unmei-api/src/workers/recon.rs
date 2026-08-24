//! recon_scheduler · 每日凌晨 2 点那一小时(Asia/Shanghai)对每个有 settlement_pull
//! 能力的渠道,拉前一天账单 + 对账 + insert recon_batch / recon_record。
//!
//! 十分钟一跳,所以那一小时里会检查六次；每次先问 `already_pulled`,
//! 拉过就不再去打渠道。原先这里写着「每日 02:30」「且当天没跑过」,
//! 而代码只判 `hour == 2` —— 六次全都真去拉了一遍账单,
//! 靠 `ingest_settlement` 里面那道 `already_pulled` 兜住不重复入账。
//! 账是没错，但每晚白拉五趟(微信那边是下载账单文件,不是一次轻查询)。
//!
//! 这里只管【什么时候拉、跟谁拉】。拉回来之后怎么比、怎么落库,
//! 在 `unmei_app::recon` —— 那是业务写操作,只能有一份实现,
//! 而且放在那里才测得到(worker 里的 SQL 没有任何测试够得着)。

use chrono::{Duration as ChronoDuration, Timelike, Utc};
use std::time::Duration;

use unmei_app::recon;

use crate::state::AppState;

const CHECK_INTERVAL_SECS: u64 = 600; // 10 min 检查一次是不是到了凌晨 2 点那一小时

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

/// Asia/Shanghai (UTC+8) 02:00-02:59 之间。
/// 「当天跑没跑过」不在这里判 —— 那要问库，见 `run_recon` 里的 `already_pulled`。
fn should_run_now() -> bool {
    let shanghai = Utc::now() + ChronoDuration::hours(8);
    let hour = shanghai.hour();
    hour == 2
}

async fn run_recon(st: &AppState) -> anyhow::Result<()> {
    // 计算昨日(Shanghai)
    // 同 `routes/village.rs` 的 `today_shanghai()`：写死东八区，
    // 六 cell 里只有 cn / zh_hant 是 +8，而 `RegionMeta.tz` 没人读。
    // 那边的注释写着完整来龙去脉；改的时候两处一起。
    let shanghai_today = (Utc::now() + ChronoDuration::hours(8)).date_naive();
    let yesterday = shanghai_today - ChronoDuration::days(1);

    let channels = [
        ("wechat_jsapi", st.payment_adapters.wechat_jsapi.clone()),
        ("wechat_mp",    st.payment_adapters.wechat_mp.clone()),
    ];

    for (channel, adapter) in channels {
        // 拉之前先问一句。`ingest_settlement` 里面也有同一道判断（那道是真正的
        // 防重，写操作只有一份实现），这里这道是为了**别去打渠道** ——
        // 十分钟一跳，那一小时里本来会白拉五趟账单。
        match recon::already_pulled(&st.db, channel, yesterday).await {
            Ok(true) => continue,
            Ok(false) => {}
            // 问不出来就照拉：宁可多拉一次，也不要因为读不到而整晚不对账。
            Err(e) => tracing::warn!("recon · 查 {channel} {yesterday} 拉过没有：{e}"),
        }
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
                // 一个渠道对不上，不该让另一个渠道整晚不对账 ——
                // 上面 `pull_settlement` 的失败本来就是各算各的，这条原先用 `?`
                // 直接把整轮带走了，两种失败模式不一致。
                let out = match recon::ingest_settlement(&st.db, channel, yesterday, "CNY", &rows).await {
                    Ok(out) => out,
                    Err(e) => {
                        tracing::warn!("recon · {channel} {yesterday} 入库失败：{e}");
                        continue;
                    }
                };
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
