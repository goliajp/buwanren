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
        if !过了出账时间() { continue; }
        if let Err(e) = run_recon(&state).await {
            tracing::warn!("recon_scheduler failed: {e}");
        }
    }
}

/// 渠道账单最早什么时候拿得到 —— 东八区凌晨两点。
///
/// 【原先这里是 `hour == 2`，也就是「只在那一小时里跑」】（2026-09-04）。
/// 于是服务那一小时不在（部署、重启、机器睡了、崩了），那一天就**永远**
/// 不对账 —— 下一次检查已经是第二天的两点，而它只看昨天。
/// 一整天的钱没跟渠道对过，而没有任何一处会说出来。
///
/// 判据改成「过了两点就该有」：跟「那一天拉过没有」一起用，
/// 拉过的直接跳，所以放宽时间窗不会多打渠道一次。
fn 过了出账时间() -> bool {
    let shanghai = Utc::now() + ChronoDuration::hours(8);
    shanghai.hour() >= 2
}

/// 拉某一天的账并入库。**后台那颗「现在拉一次」按的就是它**。
///
/// 【为什么要能手动拉】。这一整段原先只在凌晨两点那一小时跑 ——
/// 也就是说：拉账单、解 csv、对账入库这条链，在本机一天只有一次机会验，
/// 而那一次没人看着。昨天的账没拉下来时，运营也只能等下一个凌晨。
pub async fn 拉一天(st: &AppState, 那天: chrono::NaiveDate) -> anyhow::Result<Vec<String>> {
    let channels = [
        ("wechat_jsapi", st.payment_adapters.wechat_jsapi.clone()),
        ("wechat_mp",    st.payment_adapters.wechat_mp.clone()),
    ];
    let mut 说 = Vec::new();
    for (channel, adapter) in channels {
        match adapter.pull_settlement(那天, "CNY").await {
            Ok(rows) => {
                let rows: Vec<recon::SettlementRow> = rows.into_iter().map(|r| recon::SettlementRow {
                    channel_txn_id: r.channel_txn_id,
                    amount_minor: r.amount_minor,
                    status: r.status,
                }).collect();
                let n = rows.len();
                match recon::ingest_settlement(&st.db, channel, 那天, "CNY", &rows).await {
                    Ok(out) => 说.push(format!(
                        "{channel}：{n} 笔 · 对上 {} · 金额不符 {} · 内部缺单 {} → {}",
                        out.matched, out.amount_mismatch, out.missing_in_internal, out.status)),
                    Err(e) => 说.push(format!("{channel}：入库失败 {e}")),
                }
            }
            Err(e) => 说.push(format!("{channel}：拉不下来 {e}")),
        }
    }
    Ok(说)
}

async fn run_recon(st: &AppState) -> anyhow::Result<()> {
    // 同 `routes/village.rs` 的 `today_shanghai()`：写死东八区，
    // 六 cell 里只有 cn / zh_hant 是 +8，而 `RegionMeta.tz` 没人读。
    // 那边的注释写着完整来龙去脉；改的时候两处一起。
    let 今天 = (Utc::now() + ChronoDuration::hours(8)).date_naive();

    // 渠道名单在 `拉一天` 里 —— 那儿才是真去拉的地方
    let channels = ["wechat_jsapi", "wechat_mp"];

    /* 【欠哪几天由用例层说】。这里只管「什么时候拉、跟谁拉」——
       「还欠哪几天」是业务判断，而 worker 里的 SQL 没有任何测试够得着
       （这个仓库对此有明写的规矩，见模块注释）。 */
    const 回头看几天: i64 = 7;

    for channel in channels {
        let 欠着 = match recon::days_needing_pull(&st.db, channel, 今天, 回头看几天).await {
            Ok(v) => v,
            // 问不出来就照旧只拉昨天：宁可少补几天，也不要因为读不到而整晚不对账。
            Err(e) => {
                tracing::warn!("recon · 查 {channel} 欠哪几天失败：{e}");
                vec![今天 - ChronoDuration::days(1)]
            }
        };
        if 欠着.len() > 1 {
            /* 【要补的不止昨天，说明服务在那几天的出账时间不在】。
               补上是好事，而「需要补」这件事本身是运维要知道的 ——
               不说的话，一次三天的停机跟一切正常长得一模一样。 */
            tracing::warn!(channel, 欠几天 = 欠着.len(),
                "recon · 欠着不止昨天的账 —— 那几天出账时间服务不在");
        }

        for 那天 in 欠着 {
            /* 拉与入库都在 `拉一天` 里 —— 它跟这一段原先是同一份代码的两抄。
               两抄的下场是可预见的：一处改了另一处没改，而对账这件事
               出错的样子是「数对不上」，没人分得清是渠道的问题还是我们的。 */
            match 拉一天(st, 那天).await {
                Ok(说) => for 一句 in 说 { tracing::info!("recon · {那天} {一句}") },
                Err(e) => tracing::warn!("recon · {那天} 整轮失败：{e}"),
            }
        }
    }
    Ok(())
}
