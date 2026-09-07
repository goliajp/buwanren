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
        /* 【没有下次扣款时间的那些，周期一走完就没人再看它一眼】
           （2026-09-04）。上一版的条件里有 `next_billing_attempt_at IS NOT NULL`，
           而全仓【没有任何一处】拿 `current_period_end` 跟现在比来判到期 ——
           于是那一列是 NULL 的活跃订阅是不死的：

             · 194 笔会在周期走完之后【白给服务】，不再扣一分钱
             · 另 201 笔点过「到期不续」，而「停」这件事只发生在
               `renew_due` 里 —— 它只对被这里捞到的行跑，所以它们
               永远不会真的停

           实测这 395 笔的 `current_period_end` 全落在 2026-09-15 到 09-22：
           十一天后【同时】掉到边上，而今天一条也看不出来
           （「周期早过了却仍在服务」现在是 0）。

           `renew_due` 里每一支判断本来都是对的（认取消标记、认周期、
           认无价），缺的只是有人把这些行喂给它。
           排序用 `COALESCE`:两条路的「该轮到它了」是同一个意思。 */
        r#"SELECT id FROM subscription
           WHERE status IN ('active','past_due','trialing')
             AND (
                   (next_billing_attempt_at IS NOT NULL AND next_billing_attempt_at <= NOW())
                OR (next_billing_attempt_at IS NULL     AND current_period_end     <= NOW())
                 )
           ORDER BY COALESCE(next_billing_attempt_at, current_period_end) ASC
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

    let (mut stopped, mut unpriced, mut failed) = (0, 0, 0);
    let (mut 开了单, mut 等生辰) = (0, 0);
    for id in &ids {
        // 一条失败不该影响其它条 —— 各自独立事务
        match app_subscription::renew_due(&st.db, id).await {
            /* 开出了这一期的单。**钱还没到** —— 到账在 OrderPaid 那条事件上。
               开完就给他发一句「这一期该付了」:不告诉他而要他动手，
               等于把订阅悄悄断掉。发不出去是常态（订阅消息要单独授权），
               所以那一层每一处都按「发不出去」写，并把为什么记下来。 */
            Ok(RenewOutcome::AwaitingPayment { ref order_id, amount_minor, .. }) => {
                开了单 += 1;
                if let Ok(Some(uid)) = sqlx::query_scalar::<_, String>(
                    "SELECT user_id FROM subscription WHERE id=$1")
                    .bind(id).fetch_optional(&st.db).await
                {
                    crate::notify::这一期该付了(st, &uid, order_id, amount_minor).await;
                }
            }
            Ok(RenewOutcome::StoppedAtPeriodEnd) => stopped += 1,
            Ok(RenewOutcome::Unpriced) => unpriced += 1,
            // 这一期没扣、也不算失败 —— 等他把出生时间填上，明天再来问一次
            Ok(RenewOutcome::NeedsYongshen) => 等生辰 += 1,
            Ok(RenewOutcome::NotDue) => {}
            Err(e) => {
                failed += 1;
                tracing::warn!(subscription_id = %id, "renew failed: {e}");
                // 不进 dunning 的话,这条订阅会在 5 分钟后被原样选出来再试一次,
                // 永远 —— 直到有人去库里手改。阶梯把「再试」变成有限次、有间隔、有终点。
                if let Err(e2) = app_subscription::record_renewal_failure(&st.db, id, &e.to_string()).await {
                    tracing::error!(subscription_id = %id, "记 dunning 也失败了：{e2}");
                }
            }
        }
    }
    tracing::info!(
        billed = 开了单, stopped_at_period_end = stopped, unpriced, failed,
        waiting_for_birth_time = 等生辰,
        "subscription_billing done"
    );
    Ok(())
}
