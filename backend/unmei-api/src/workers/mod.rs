//! 后台 worker · 在 unmei-api 进程内常驻。
//!
//! 6 个 worker:
//! - [`shipment_trace`] 每 15min 拉 carrier_adapter 推进物流状态
//! - [`payment_sweep`]  每 30s 扫超时未结算 payment 拉准
//! - [`subscription_billing`] 每 5min 扫 next_billing_attempt_at,dunning 重试
//! - [`outbox`] 每 5s dispatch outbox_event(注:本 MVP 不写 outbox,但 schema 已存,先 stub)
//! - [`recon`] 每日 02:30 (Asia/Shanghai) 拉渠道账单对账
//! - [`housekeeping`] 每小时清过期幂等键
//!
//! 设计:每个 worker 失败不 panic,只 warn;启动用 [`spawn_all`] 一次起齐。

pub mod shipment_trace;
pub mod payment_sweep;
pub mod subscription_billing;
pub mod outbox;
pub mod recon;
pub mod housekeeping;

use crate::state::AppState;

pub fn spawn_all(state: AppState) {
    tokio::spawn(shipment_trace::run(state.clone()));
    tokio::spawn(payment_sweep::run(state.clone()));
    tokio::spawn(subscription_billing::run(state.clone()));
    tokio::spawn(outbox::run(state.clone()));
    tokio::spawn(recon::run(state.clone()));
    tokio::spawn(housekeeping::run(state));
    tracing::info!("✓ workers spawned · shipment_trace / payment_sweep / subscription_billing / outbox / recon / housekeeping");
}
