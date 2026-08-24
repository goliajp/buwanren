//! housekeeping · 清过期的幂等键。
//!
//! `idempotency_log` 的每一行只在 24 小时内有意义,过了就是纯占地方。
//! 没人清的话它只进不出 —— 一张只长不消的表最后会让下单这条路慢下来,
//! 而那时候看起来会像是「下单变慢了」,不像「有张表没人清」。
//!
//! 一小时一次。DELETE 走 `idx_idempotency_log_expires`,不扫全表。

use std::time::Duration;

use crate::state::AppState;

const EVERY_SECS: u64 = 3600;

pub async fn run(state: AppState) {
    let mut tick = tokio::time::interval(Duration::from_secs(EVERY_SECS));
    tick.tick().await; // 第一次立刻返回,跳过
    loop {
        tick.tick().await;
        match unmei_app::idempotency::purge_expired(&state.db).await {
            Ok(0) => {}
            Ok(n) => tracing::info!("housekeeping · 清掉 {n} 个过期幂等键"),
            Err(e) => tracing::warn!("housekeeping · 清幂等键失败：{e}"),
        }
    }
}
