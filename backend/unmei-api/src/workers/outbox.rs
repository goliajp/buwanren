//! outbox_dispatcher · 每 5s 扫 outbox_event,按 event kind 派发副作用。
//!
//! 当前处理的 kind:
//! - `OrderCreated`        — log + notification(未来)
//! - `OrderPaid`           — 触发 fulfillment(async_compute 类 line 调 mingli-api 排盘)
//! - `OrderFulfilled`      — 通知 + finance(可选)
//! - `OrderCancelled`      — log
//! - `RefundCompleted`     — finance 反向分录(收入冲销)
//! - `ShipmentDelivered`   — 若 order 所有 line 都 done → order.mark_done(等下游接通)
//! - 其它                  — log + mark dispatched
//!
//! **规模对照**（2026-08-18 数过）：`DomainEvent` 一共 **31 种**。
//! 真去做事的只有 3 种（`OrderPaid` → 履约、`RefundCompleted` → 财务分录、
//! `ShipmentDelivered` → 履约收尾）；3 种只打日志；**其余 25 种是有意的空转**
//! —— 它们照样落进 `outbox_event` 表、照样打一行 info，所以不是丢了，是还没接。
//! 记在这里是因为「事件已经发出去了」很容易被读成「下游已经在动」。
//!
//! 那 25 种在 `handle_event` 里是**逐个列出来**的，不是一个 `_` 兜底 ——
//! 加一个新变体，这个 match 就不再穷尽，编译当场不过，于是「要不要给它接
//! 副作用」必须当场答一次。原先兜底那版，新事件会静静落进 no-op，
//! 日志上还写着「(no-op)」，像是有意为之。
//!
//! 失败:next_attempt_at 推后 30s × attempt_count,最多 5 次,然后 status='failed'。

use serde_json::Value;
use sqlx::Row;
use std::time::Duration;
use unmei_domain::commerce::events::DomainEvent;

use unmei_app::fulfillment as app_fulfillment;

use crate::state::AppState;

const INTERVAL_SECS: u64 = 5;
const MAX_ATTEMPTS: i32 = 5;

pub async fn run(state: AppState) {
    let mut tick = tokio::time::interval(Duration::from_secs(INTERVAL_SECS));
    tick.tick().await;
    loop {
        tick.tick().await;
        if let Err(e) = dispatch_once(&state).await {
            tracing::warn!("outbox_dispatcher failed: {e}");
        }
    }
}

async fn dispatch_once(st: &AppState) -> anyhow::Result<()> {
    let rows = sqlx::query(
        r#"SELECT id, kind, aggregate_kind, aggregate_id, payload_json, attempt_count
           FROM outbox_event
           WHERE status='pending' AND next_attempt_at <= NOW()
           ORDER BY created_at ASC
           LIMIT 50
           FOR UPDATE SKIP LOCKED"#,
    ).fetch_all(&st.db).await?;
    if rows.is_empty() { return Ok(()); }
    tracing::debug!("outbox_dispatcher: dispatching {} events", rows.len());

    for r in rows {
        let id: String = r.try_get("id")?;
        let kind: String = r.try_get("kind")?;
        let payload: Value = r.try_get("payload_json").unwrap_or(Value::Null);
        let attempt: i32 = r.try_get("attempt_count")?;

        let outcome: Result<(), String> = handle_event(st, &kind, &payload).await
            .map_err(|e| e.to_string());

        match outcome {
            Ok(()) => {
                sqlx::query(
                    "UPDATE outbox_event SET status='dispatched', attempt_count = attempt_count + 1 WHERE id=$1",
                ).bind(&id).execute(&st.db).await?;
                tracing::debug!("outbox · {kind} OK");
            }
            Err(e) => {
                let next_attempt = attempt + 1;
                if next_attempt >= MAX_ATTEMPTS {
                    sqlx::query(
                        "UPDATE outbox_event SET status='failed', attempt_count=$1, last_error=$2 WHERE id=$3",
                    ).bind(next_attempt).bind(&e).bind(&id).execute(&st.db).await?;
                    tracing::warn!("outbox · {kind} permanently failed after {next_attempt} attempts: {e}");
                } else {
                    let delay_secs = (30 * next_attempt as i64).min(600);
                    sqlx::query(
                        r#"UPDATE outbox_event SET attempt_count=$1, last_error=$2,
                             next_attempt_at = NOW() + ($3 || ' seconds')::interval
                           WHERE id=$4"#,
                    ).bind(next_attempt).bind(&e).bind(delay_secs.to_string()).bind(&id)
                     .execute(&st.db).await?;
                    tracing::warn!("outbox · {kind} retry {next_attempt}/{MAX_ATTEMPTS} in {delay_secs}s: {e}");
                }
            }
        }
    }
    Ok(())
}

async fn handle_event(st: &AppState, kind: &str, payload: &Value) -> anyhow::Result<()> {
    // outbox::write 把整个 DomainEvent (含 kind+payload) 序列化进 payload_json,
    // 直接 from_value 即可
    let ev: Result<DomainEvent, _> = serde_json::from_value(payload.clone());
    match ev {
        Ok(DomainEvent::OrderCreated { order_id, .. }) => {
            tracing::info!("event · OrderCreated {order_id}");
            Ok(())
        }
        Ok(DomainEvent::OrderPaid { order_id, .. }) => {
            // 履约推进在用例层:一个事务、shipment 防重、重试不重复发 OrderFulfilled。
            // 这里原有一份自己的实现,四处幂等漏洞,见 unmei_app::fulfillment 模块注释。
            app_fulfillment::apply_order_paid(&st.db, &order_id)
                .await
                .map(|_| ())
                .map_err(|e| anyhow::anyhow!("apply_order_paid {order_id}: {e}"))
        }
        Ok(DomainEvent::OrderFulfilled { order_id, .. }) => {
            tracing::info!("event · OrderFulfilled {order_id} · 用户应已被通知");
            Ok(())
        }
        Ok(DomainEvent::OrderCancelled { order_id, reason, .. }) => {
            tracing::info!("event · OrderCancelled {order_id} reason={reason}");
            Ok(())
        }
        Ok(DomainEvent::RefundCompleted { refund_id, .. }) => {
            handle_refund_completed(st, &refund_id).await
        }
        Ok(DomainEvent::ShipmentDelivered { shipment_id, order_id, .. }) => {
            app_fulfillment::apply_shipment_delivered(&st.db, &shipment_id, &order_id)
                .await
                .map(|_| ())
                .map_err(|e| anyhow::anyhow!("apply_shipment_delivered {shipment_id}: {e}"))
        }
        /* 剩下 25 种都是**特意**不做事的：它们记的是已经发生过的事实，
           副作用在写入那一侧就做完了。

           这里原先是一个 `Ok(other)` 兜底 —— 于是将来加一个需要副作用的事件，
           会静静落进 no-op 里，日志上还写着「(no-op)」像是有意为之。
           改成逐个列出来：加一个变体，这个 match 就不再穷尽，**编译当场不过**。
           仓库里已经用过这一手（`Currency::decimals` 那次，加一个币种要在
           三处交代清楚）。 */
        Ok(other @ (
            DomainEvent::OrderRefunded { .. }
            | DomainEvent::OrderDisputed { .. }
            | DomainEvent::PaymentCreated { .. }
            | DomainEvent::PaymentSucceeded { .. }
            | DomainEvent::PaymentFailed { .. }
            | DomainEvent::PaymentExpired { .. }
            | DomainEvent::PaymentRefundCompleted { .. }
            | DomainEvent::RefundInitiated { .. }
            | DomainEvent::RefundApproved { .. }
            | DomainEvent::RefundFailed { .. }
            | DomainEvent::ShipmentCreated { .. }
            | DomainEvent::ShipmentTrackingAssigned { .. }
            | DomainEvent::ShipmentException { .. }
            | DomainEvent::ShipmentReturned { .. }
            | DomainEvent::SubscriptionStarted { .. }
            | DomainEvent::SubscriptionRenewed { .. }
            | DomainEvent::SubscriptionPastDue { .. }
            | DomainEvent::SubscriptionCancelled { .. }
            | DomainEvent::SubscriptionExpired { .. }
            | DomainEvent::CouponIssued { .. }
            | DomainEvent::CouponRedeemed { .. }
            | DomainEvent::CouponExpired { .. }
            | DomainEvent::RiskRuleTriggered { .. }
            | DomainEvent::RiskCaseOpened { .. }
            | DomainEvent::JournalPosted { .. }
        )) => {
            tracing::info!("event · {} (no-op)", other.kind_str());
            Ok(())
        }
        Err(e) => {
            /* 解析不出来意味着**事件形状变了**（改了字段名／删了变体），
               而库里还躺着按旧形状写下的行。原来这里按 `trace` 记一行就当成功 ——
               `trace` 在默认级别下根本不打印，于是那些行被静静标记为已处理，
               再也找不回来。
               同一个仓库对「不认识的事件」本来就有做法：`apply_payment_webhook`
               用的是 `warn` + 事件内容。这里照它来。
               仍然返回 Ok：让它无限重试只会把队列堵死，而这不是重试能解决的事。 */
            tracing::warn!(kind, error = %e, "outbox · 事件解析不出来，按已处理丢弃 —— 事件形状可能变了");
            Ok(())
        }
    }
}

/// RefundCompleted → 财务挂账(收入冲销 + 银行存款流出)
///
/// 退款记账。**业务写操作在 `unmei_app::finance`**，这里只负责把事件接过去 ——
/// worker 里的 SQL 没有任何测试够得着，而这一段管的是账平不平、会不会重复记。
/// 搬走的理由与 `subscription::renew_due` 当初一样（2026-08-24）。
async fn handle_refund_completed(st: &AppState, refund_id: &str) -> anyhow::Result<()> {
    unmei_app::finance::post_refund_journal(&st.db, refund_id).await?;
    Ok(())
}
