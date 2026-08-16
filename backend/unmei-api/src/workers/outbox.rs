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
//! 失败:next_attempt_at 推后 30s × attempt_count,最多 5 次,然后 status='failed'。

use serde_json::Value;
use sqlx::Row;
use std::time::Duration;
use unmei_domain::commerce::events::DomainEvent;
use uuid::Uuid;

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
        Ok(other) => {
            tracing::info!("event · {} (no-op)", other.kind_str());
            Ok(())
        }
        Err(_) => {
            tracing::trace!("event · {kind} (cannot parse)");
            Ok(())
        }
    }
}

/// RefundCompleted → 财务挂账(收入冲销 + 银行存款流出)
///
/// 两条以前没有、但账务上必须有的性质:
///
/// **一个事务**。分录头和分录行原本是两次独立写入,后者失败就留下一条
/// 没有明细的 `journal_entry` —— 一本不平的账,而且没人会发现。
///
/// **幂等**。outbox 事件会重试(`MAX_ATTEMPTS` 次)。原来只要在写分录行时挂掉,
/// 重试就会为同一笔退款再记一整套分录,账上凭空多出一笔冲销。
/// 现在先按 `business_ref_id` 查有没有记过。
async fn handle_refund_completed(st: &AppState, refund_id: &str) -> anyhow::Result<()> {
    let mut tx = st.db.begin().await?;

    let posted: Option<String> = sqlx::query_scalar(
        "SELECT id FROM journal_entry WHERE business_kind='refund' AND business_ref_id=$1 LIMIT 1",
    ).bind(refund_id).fetch_optional(&mut *tx).await?;
    if let Some(existing) = posted {
        tracing::debug!("finance · 退款 {refund_id} 已挂账于 {existing},跳过");
        return Ok(());
    }

    let row = sqlx::query(
        "SELECT order_id, payment_id, amount_minor, currency FROM refund WHERE id=$1",
    ).bind(refund_id).fetch_optional(&mut *tx).await?;
    let Some(r) = row else { return Ok(()); };
    let order_id: String = r.try_get("order_id")?;
    let amount: i64 = r.try_get("amount_minor")?;
    let currency: String = r.try_get("currency")?;

    let period_id: String = sqlx::query_scalar(
        "SELECT id FROM accounting_period WHERE kind='month' AND state='open' ORDER BY year DESC, sub DESC LIMIT 1",
    ).fetch_one(&mut *tx).await?;

    let entry_id = format!("je-{}", Uuid::new_v4());
    sqlx::query(
        r#"INSERT INTO journal_entry(id, period_id, description, posted_by_kind, business_kind, business_ref_id, status)
           VALUES ($1, $2, $3, 'system', 'refund', $4, 'posted')"#,
    ).bind(&entry_id).bind(&period_id)
     .bind(format!("退款 {refund_id} 冲销订单 {order_id}"))
     .bind(refund_id).execute(&mut *tx).await?;

    sqlx::query(
        r#"INSERT INTO journal_line(id, entry_id, line_no, account_code, debit_minor, credit_minor, currency, ref_kind, ref_id, note) VALUES
             ($1, $2, 1, '4001', $3, 0, $4, 'refund', $5, '主营业务收入(冲销)'),
             ($6, $2, 2, '1001', 0, $3, $4, 'refund', $5, '银行存款流出')"#,
    ).bind(format!("jl-{}", Uuid::new_v4())).bind(&entry_id)
     .bind(amount).bind(&currency).bind(refund_id)
     .bind(format!("jl-{}", Uuid::new_v4())).execute(&mut *tx).await?;

    tx.commit().await?;
    tracing::info!("finance · 退款分录 {entry_id} posted: 冲销 ¥{} / 退银行存款", amount as f64 / 100.0);
    Ok(())
}
