//! payment_query_sweeper · 每 30s 扫超时未结算 payment 拉准状态。
//!
//! 触发场景:回调丢失 / 渠道延迟。
//! 流程:
//! 1. `payment::to_ask_channel_about` 挑出还够得着钱的那几笔
//! 2. 调 payment_adapter.query_payment(payment_id)
//! 3. 翻译 outcome → 状态更新 + 事件入库

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
        if let Err(e) = 把批了的退款发给渠道(&state).await {
            tracing::warn!("payment_query_sweeper · 发退款那一段失败：{e}");
        }
        if let Err(e) = 去渠道撤单(&state).await {
            tracing::warn!("payment_query_sweeper · 撤单那一段失败：{e}");
        }
    }
}

/// 向渠道问「这笔到底成没成」。回调丢了 / 渠道延迟时兜底。
async fn query_pending(st: &AppState) -> anyhow::Result<()> {
    /* SQL 在用例层（`payment::to_ask_channel_about`）。挑哪些支付还该问渠道
       是业务判断 —— 哪个状态还够得着钱、窗口怎么算 —— 不是调度细节，
       而 worker 这一层没有测试碰得到它。跟 `expire_overdue` 同一个理由。 */
    let rows = app_payment::to_ask_channel_about(&st.db).await?;
    /* 这里原来是 `if rows.is_empty() { return Ok(()); }` —— 而下面那两个
       过期清扫在它后面。于是「没有待查支付」的时候，两个清扫**一次都不跑**，
       而那正是常态：查询窗口只收**窗口还没关**的那几笔支付。

       2026-08-19 实测：窗口里 0 笔待查，同时躺着 1 笔该过期的支付、
       14 张该取消的过期未付订单，谁也没被动过。日志里之前那几行
       「过期未付订单取消 14 张」是碰巧有别的待查支付把那一轮带起来了。

       也就是说 2026-08-18 修的「1002 张未付订单永远不过期」，接是接上了，
       但只在有别的活儿要干的时候才顺带跑一次。清扫不该搭别人的车。 */
    if !rows.is_empty() {
        tracing::debug!("payment_query_sweeper: scanning {} pending payments", rows.len());
    }

    for (pid, channel) in rows {
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

    /* 【撤到一半的也要有个下场】（2026-09-04）。
       `cancelling` 原先进得去出不来 —— 状态机写着它通向 Cancelled，
       而全仓没有一处写那个状态，实测 20 笔卡在那儿。
       窗口一过渠道就不会再说这笔成了，那时「撤下来了」才成为定论。 */
    let 撤成了 = app_payment::settle_cancelled(&st.db).await?;
    if 撤成了 > 0 {
        tracing::info!("payment_query_sweeper: 撤到一半的支付落成已撤销 {撤成了} 笔");
    }

    /* 【取消了的单上收着钱，要退回去】（2026-09-04 收口）。
       上游两个口子都堵了，但渠道竞态仍然会让钱落在已取消的订单上
       —— 那时钱是真的在渠道那边，必须记上，然后必须退回去。
       放在扫描里而不挂在那条路径上：进程在「记账已提交、退款未发起」
       之间死掉时，回调不会再来第二次，而历史存量本来就不经过钩子。 */
    let 退回 = unmei_app::refund::refund_orphan_money(&st.db).await?;
    if 退回 > 0 {
        tracing::info!("payment_query_sweeper: 取消单上无家可归的钱退回 {退回} 笔");
    }

    /* 【交付不了的那几行，钱也要退回去】（2026-09-06 三路验证）。
       `failed` 是 order_line 的终态，而收尾数的是 `NOT IN ('done','failed')`
       —— 一张全部失败的单照样翻成 `done`，屏上写「已完成」，钱收着。
       放在同一个扫描里，理由跟上面那一支一样：进程死在中间、
       以及历史存量本来就不经过任何钩子。 */
    let 补退 = unmei_app::refund::refund_undelivered_lines(&st.db).await?;
    if 补退 > 0 {
        tracing::info!("payment_query_sweeper: 交付不了的行退回 {补退} 笔");
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

/// 【批了的退款要真的发给渠道】（2026-09-07）。
///
/// 在这之前 `refund::approve` 一步到位:`status='success'`、
/// `channel_refund_id = 'MOCK_' || id`，而**渠道那一侧一个字都没收到**。
/// 买家在屏上看到「已退款」，钱一分没回 —— 今天修的另外两个洞是
/// 「钱在渠道里而系统说没有」，这一处是它的镜像，
/// 而且面向的是已经不高兴的那个人。
///
/// 【为什么是扫描，不是挂在 approve 后面】。跟 `refund_orphan_money`
/// 同一个理由:进程死在「批了、还没发」之间时，没有第二次机会；
/// 而扫描跑几遍是同一个结果。后台按下「批」那一刻的即时性由这里的
/// 三十秒兜住 —— 要更快就把这一支的间隔调小，而不是把 I/O 塞进事务。
async fn 把批了的退款发给渠道(st: &AppState) -> anyhow::Result<()> {
    let 待发 = unmei_app::refund::批了还没发的(&st.db, 20).await?;
    for r in 待发 {
        let Some(adapter) = st.payment_adapters.pick(&r.channel) else {
            // 认不出渠道就别乱发。留在 approved 上，下一轮再看 ——
            // 而「一直发不出去」这件事要有人知道，所以每一轮都 warn
            tracing::warn!(refund_id = %r.refund_id, channel = %r.channel,
                           "这笔退款的渠道认不出来 —— 发不出去");
            continue;
        };
        let 参数 = unmei_domain::commerce::adapters::RefundParam {
            refund_id: r.refund_id.clone(),
            payment_id: r.payment_id.clone(),
            channel_txn_id: String::new(),
            amount_minor: r.amount_minor,
            total_amount_minor: r.payment_total_minor,
            currency: "CNY".into(),
            reason: "用户申请退款".into(),
            notify_url: std::env::var("WX_PAY_NOTIFY_URL").unwrap_or_default(),
        };
        match adapter.refund(参数).await {
            Ok(resp) => {
                unmei_app::refund::发给渠道了(&st.db, &r.refund_id, &resp.channel_refund_id).await?;
                /* 【渠道当场就说退成了的，别等回调】。微信的退款接口在
                   余额充足时同步回 `SUCCESS` —— 等一条可能不来的回调，
                   会让这笔钱在屏上一直停在「退款中」。
                   回调真来了也无妨:`apply_succeeded` 幂等。 */
                if resp.status_hint == "success" {
                    unmei_app::refund::apply_succeeded(&st.db, &resp.channel_refund_id).await?;
                }
                tracing::info!(refund_id = %r.refund_id, channel_refund_id = %resp.channel_refund_id,
                               "退款发给渠道了");
            }
            Err(e) => {
                /* 渠道不收。**不是终态** —— 状态机里 `Failed => [Approved]`，
                   人可以在后台再批一次，而屏上要说得出为什么。 */
                unmei_app::refund::渠道不收(&st.db, &r.refund_id, "channel_rejected", &e.to_string()).await?;
                tracing::warn!(refund_id = %r.refund_id, "渠道不收这笔退款：{e}");
            }
        }
    }
    Ok(())
}

/// 【我们不等了，也要告诉渠道一声】（2026-09-07）。
///
/// `cancel_in_flight` 把在飞的支付转成 `cancelling`、换支付方式时旧那一笔
/// 被顶成 `expired` —— 两处都只动我们自己这一侧，而渠道那边那一单还开着，
/// **用户照样付得出去**。那笔钱回来时我们收（`apply_succeeded` 认这两个
/// 状态），但更该做的是一开始就别让它付得出去。
///
/// 撤不掉不是灾难:`channel_closed_at` 不写，下一轮再来；窗口一过就不再试
/// （那时渠道自己会关，再撤是白撤）。
async fn 去渠道撤单(st: &AppState) -> anyhow::Result<()> {
    for (pid, channel) in app_payment::该去渠道撤的(&st.db, 20).await? {
        let Some(adapter) = st.payment_adapters.pick(&channel) else { continue };
        match adapter.cancel_payment(&pid).await {
            Ok(()) => {
                app_payment::渠道撤了(&st.db, &pid).await?;
                tracing::info!(payment_id = %pid, "去渠道撤了这一单");
            }
            Err(e) => tracing::warn!(payment_id = %pid, "渠道撤单没成：{e}"),
        }
    }
    Ok(())
}
