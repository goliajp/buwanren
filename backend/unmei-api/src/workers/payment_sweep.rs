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
use unmei_app::order as app_order;
use unmei_app::payment as app_payment;
use unmei_domain::commerce::adapters::WebhookEvent;

use crate::state::AppState;

const INTERVAL_SECS: u64 = 30;

pub async fn run(state: AppState) {
    let mut tick = tokio::time::interval(Duration::from_secs(INTERVAL_SECS));
    tick.tick().await;
    loop {
        tick.tick().await;
        /* 两件事分开跑，各自记各自的错。
           它们原来在同一个函数里，查询在前、清扫在后 —— 于是查询那段任何一个
           `?` 出错（或者干脆没有待查支付而提前 return），清扫就跟着不跑。
           清扫不该搭别人的车：它扫的是「时间到了」，跟渠道答不答话无关。 */
        if let Err(e) = query_pending(&state).await {
            tracing::warn!("payment_query_sweeper · 查渠道那一段失败：{e}");
        }
        if let Err(e) = expire_stale(&state).await {
            tracing::warn!("payment_query_sweeper · 过期清扫那一段失败：{e}");
        }
    }
}

/// 向渠道问「这笔到底成没成」。回调丢了 / 渠道延迟时兜底。
async fn query_pending(st: &AppState) -> anyhow::Result<()> {
    let rows = sqlx::query(
        r#"SELECT id, channel
           FROM payment
           WHERE status IN ('pending','processing')
             AND created_at < NOW() - INTERVAL '1 minute'
             AND (expires_at IS NULL OR expires_at > NOW())
           ORDER BY created_at ASC
           LIMIT 50"#,
    ).fetch_all(&st.db).await?;
    /* 这里原来是 `if rows.is_empty() { return Ok(()); }` —— 而下面那两个
       过期清扫在它后面。于是「没有待查支付」的时候，两个清扫**一次都不跑**，
       而那正是常态：查询窗口只收 pending/processing 且**还没到期**的支付。

       2026-08-19 实测：窗口里 0 笔待查，同时躺着 1 笔该过期的支付、
       14 张该取消的过期未付订单，谁也没被动过。日志里之前那几行
       「过期未付订单取消 14 张」是碰巧有别的待查支付把那一轮带起来了。

       也就是说 2026-08-18 修的「1002 张未付订单永远不过期」，接是接上了，
       但只在有别的活儿要干的时候才顺带跑一次。清扫不该搭别人的车。 */
    if !rows.is_empty() {
        tracing::debug!("payment_query_sweeper: scanning {} pending payments", rows.len());
    }

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

    Ok(())
}

/// 时间到了就该翻状态 —— 跟渠道答不答话没关系，所以单独一段。
async fn expire_stale(st: &AppState) -> anyhow::Result<()> {
    // SQL 在用例层（业务写只留一份实现）
    let expired = app_payment::expire_overdue(&st.db).await?;
    if expired > 0 {
        tracing::info!("payment_query_sweeper: expired {expired} payments");
    }

    /* 订单那一侧同理。`order::expire_unpaid` 的文档注释写着「sweeper 调用」，
       而在 2026-08-18 之前**没有任何人调它** —— 于是支付会过期、订单不会：
       开发库里 1005 张未付订单有 1002 张早过了 `expires_at` 还挂着 unpaid，
       用户看到的是一张永远付不了的单。

       条件就是 `status='unpaid'`，而订单只有在没有任何一笔支付成功时才是这个状态
       （`apply_succeeded` 一成功就把它推到 paid）。剩下的边角是「渠道已成功、
       回调迟到」：那种情况下这一单会先被取消，随后迟到的成功【记金额、不改状态】
       （见 `payment::apply_succeeded` 里状态机那段），也就是变成一笔看得见的
       「钱到了但没有归宿」，而不是被悄悄复活。 */
    let cancelled = app_order::expire_unpaid(&st.db).await?;
    if cancelled > 0 {
        tracing::info!("payment_query_sweeper: 过期未付订单取消 {cancelled} 张");
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
        PaymentSucceeded { our_ref, channel_txn_id, paid_at, .. } => {
            app_payment::apply_succeeded(&st.db, &our_ref, channel_txn_id.as_deref(), paid_at)
                .await
                .map_err(|e| anyhow::anyhow!("apply_succeeded {our_ref}: {e}"))?;
        }
        PaymentFailed { our_ref, code, msg } => {
            app_payment::apply_failed(&st.db, &our_ref, &code, &msg)
                .await
                .map_err(|e| anyhow::anyhow!("apply_failed {our_ref}: {e}"))?;
        }
        // 渠道说「这笔过期了」也要落下去。下面那段 SQL 只按【本地】
        // `expires_at` 过期，而那一列可空 —— 渠道侧的过期不经过它。
        // 回调那条路（`apply_payment_webhook`）本来就处理这一种，
        // 轮询这条却在丢，两条路对同一件事给出不同结果。
        PaymentExpired { our_ref } => {
            app_payment::apply_expired(&st.db, &our_ref)
                .await
                .map_err(|e| anyhow::anyhow!("apply_expired {our_ref}: {e}"))?;
        }
        // 其余的照回调那条路的做法记一笔，不静默丢。轮询能查出争议
        // （`DisputeOpened`）和认不出的事件（`Unknown`），而丢掉它们
        // 跟「渠道什么都没说」长得一模一样。
        other => tracing::warn!(event = ?other, "轮询到的事件没人处理"),
    }
    Ok(())
}
