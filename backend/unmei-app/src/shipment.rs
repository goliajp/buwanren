//! 物流用例。

use chrono::Utc;
use sqlx::{PgPool, Postgres, Row, Transaction};
use unmei_domain::commerce::adapters::TraceWebhookEvent;
use unmei_domain::commerce::events::DomainEvent;
use crate::DbResultExt;
use crate::outbox;
use unmei_domain::DomainError;

use crate::{new_id, Actor};

#[derive(Debug, Clone, Default)]
pub struct TrackingAssignment {
    pub carrier_code: String,
    pub tracking_no: String,
    pub shipping_method: Option<String>,
    pub cost_minor: Option<i64>,
    pub cost_currency: Option<String>,
}

/// 后台录入运单号,顺带把运单推进到「已揽收」。
pub async fn assign_tracking(
    pool: &PgPool,
    shipment_id: &str,
    a: TrackingAssignment,
) -> Result<(), DomainError> {
    let affected = sqlx::query(
        r#"UPDATE shipment SET carrier_code=$1, tracking_no=$2,
             shipping_method=COALESCE($3, shipping_method),
             cost_minor=COALESCE($4, cost_minor),
             cost_currency=COALESCE($5, cost_currency),
             status='picked_up', picked_up_at=COALESCE(picked_up_at, NOW())
           WHERE id=$6"#,
    )
    .bind(&a.carrier_code)
    .bind(&a.tracking_no)
    .bind(&a.shipping_method)
    .bind(a.cost_minor)
    .bind(&a.cost_currency)
    .bind(shipment_id)
    .execute(pool)
    .await.db()?
    .rows_affected();

    if affected == 0 {
        return Err(DomainError::NotFound(format!("shipment {shipment_id}")));
    }
    Ok(())
}

/// 后台标记异常。
pub async fn mark_exception(
    pool: &PgPool,
    shipment_id: &str,
    reason: &str,
    actor: &Actor,
) -> Result<(), DomainError> {
    let affected = sqlx::query(
        "UPDATE shipment SET status='exception', audit_note = audit_note || E'\\n' || $1
         WHERE id=$2",
    )
    .bind(format!("{} exception: {reason}", actor.label()))
    .bind(shipment_id)
    .execute(pool)
    .await.db()?
    .rows_affected();

    if affected == 0 {
        return Err(DomainError::NotFound(format!("shipment {shipment_id}")));
    }
    Ok(())
}

/// 确认送达并落 `ShipmentDelivered` 事件,让 dispatcher 去推进订单履约。
///
/// 幂等:已经是 `delivered` 就直接返回,不重复发事件。
/// 这是旧 `services_impl` 里**唯一**真被调用过的函数(`workers/shipment_trace.rs`),
/// 所以删那个目录之前先把它搬到这里。
pub async fn mark_delivered(pool: &PgPool, shipment_id: &str) -> Result<(), DomainError> {
    let mut tx = pool.begin().await.db()?;
    deliver(&mut tx, shipment_id).await?;
    tx.commit().await.db()?;
    Ok(())
}

/// 签收这件事只有这一份实现。
///
/// 以前有两份：轮询那条走 `mark_delivered`（发 `ShipmentDelivered`），
/// 回调那条在 `apply_trace_webhook` 里自己 `UPDATE status='delivered'` ——
/// **一个事件都不发**。履约那一侧是靠这个事件推进的，也就是承运商
/// 用回调告诉我们「签收了」时，履约永远不知道。
/// README 里记着支付那条一模一样的病（OrderPaid 只有轮询那条发）。
///
/// 在调用方的事务里跑：回调那条要把「落轨迹」和「推状态」同批提交。
async fn deliver(
    tx: &mut Transaction<'_, Postgres>,
    shipment_id: &str,
) -> Result<(), DomainError> {
    let row = sqlx::query("SELECT order_id, status FROM shipment WHERE id=$1 FOR UPDATE")
        .bind(shipment_id)
        .fetch_optional(&mut **tx)
        .await.db()?
        .ok_or_else(|| DomainError::NotFound(format!("shipment {shipment_id}")))?;

    let status: String = row.get("status");
    if status == "delivered" {
        return Ok(());
    }
    let order_id: String = row.get("order_id");

    sqlx::query("UPDATE shipment SET status='delivered', delivered_at=NOW() WHERE id=$1")
        .bind(shipment_id)
        .execute(&mut **tx)
        .await.db()?;

    outbox::write(
        &mut **tx,
        &DomainEvent::ShipmentDelivered {
            shipment_id: shipment_id.to_string(),
            order_id,
            occurred_at: Utc::now(),
        },
    )
    .await?;

    Ok(())
}

/// 一条轨迹事件把运单推到哪个状态 —— **只有这一份**。
///
/// 以前有两份：这里一份 CASE，`workers/shipment_trace.rs` 一份
/// `derive_status` + 自己的 UPDATE。两份的差别全是 bug：
/// 那一份带着单调守卫、签收走 `mark_delivered`（会发 `ShipmentDelivered`），
/// 这一份两样都没有 —— 于是回调报的签收，履约那一侧永远收不到。
///
/// 签收走 [`deliver`]（同批写事件）；其余状态带守卫，
/// 已签收／已退回／已取消的运单不被一条迟到的事件推回去。
pub async fn advance_status(
    tx: &mut Transaction<'_, Postgres>,
    shipment_id: &str,
    kind: &str,
) -> Result<(), DomainError> {
    if kind == "delivered" {
        return deliver(tx, shipment_id).await;
    }
    /* 原先这里是 `ELSE 'in_transit'` —— 一条**认不出**的轨迹会把包裹说成「在途」。
       两处后果：
         · 迁移里写着这张表的词表含 `failed_delivery`（投递失败），而它不在上面
           五项里，于是投递失败被显示成「在途」；
         · 已经 `out_for_delivery` 的包裹收到一条不认识的轨迹会**退回**「在途」。
       认不出就别改状态：那一条轨迹照样入库（上面那条 INSERT 已经写了），
       用户看得到这一步，只是我们不拿它去断言包裹在哪。

       词表以 `20260627_commerce_v2.sql` 里 `event_kind` 那行注释为准：
       picked_up / arrived_at_sort_facility / departed / out_for_delivery /
       delivered / failed_delivery / returned / exception，另加各家适配器
       实际会发的 in_transit。`failed_delivery` 归 `exception` —— 投递失败
       说成「在途」或停在「派件中」都是假话，而 exception 本来就收着
       疑难 / 退回 / 退签。 */
    let updated = sqlx::query(
        r#"UPDATE shipment SET status = CASE
             WHEN $1='out_for_delivery' THEN 'out_for_delivery'
             WHEN $1='picked_up'        THEN 'picked_up'
             WHEN $1='exception'        THEN 'exception'
             WHEN $1='failed_delivery'  THEN 'exception'
             WHEN $1='returned'         THEN 'returned'
             WHEN $1 IN ('in_transit','departed','arrived_at_sort_facility')
                                        THEN 'in_transit'
             ELSE status END
           WHERE id=$2 AND status NOT IN ('delivered','returned','cancelled')"#,
    )
    .bind(kind)
    .bind(shipment_id)
    .execute(&mut **tx)
    .await.db()?
    .rows_affected();
    const KNOWN: &[&str] = &[
        "out_for_delivery", "picked_up", "exception", "failed_delivery", "returned",
        "in_transit", "departed", "arrived_at_sort_facility", "delivered",
    ];
    if !KNOWN.contains(&kind) {
        // 说出来。不说的话「状态没动」跟「这条轨迹不认识」长得一模一样。
        tracing::warn!(shipment_id, kind, updated, "承运商发来不认识的轨迹类型，状态不动");
    }
    Ok(())
}

/// 自己开事务的版本，给轮询那条路用（它一条一条地推）。
pub async fn advance_status_now(
    pool: &PgPool,
    shipment_id: &str,
    kind: &str,
) -> Result<(), DomainError> {
    let mut tx = pool.begin().await.db()?;
    advance_status(&mut tx, shipment_id, kind).await?;
    tx.commit().await.db()?;
    Ok(())
}

/// 物流商回调:落轨迹并推进运单状态。
///
/// 按 (carrier_code, tracking_no) 定位运单。整批轨迹在一个事务里落,
/// 避免「落了一半、状态推进了一半」。
pub async fn apply_trace_webhook(pool: &PgPool, ev: TraceWebhookEvent) -> Result<(), DomainError> {
    let shipment_id: Option<String> = sqlx::query_scalar(
        "SELECT id FROM shipment WHERE carrier_code=$1 AND tracking_no=$2",
    )
    .bind(&ev.carrier_code)
    .bind(&ev.tracking_no)
    .fetch_optional(pool)
    .await.db()?;
    let shipment_id = shipment_id.ok_or_else(|| {
        DomainError::NotFound(format!(
            "shipment {} / {}",
            ev.carrier_code, ev.tracking_no
        ))
    })?;

    let mut tx = pool.begin().await.db()?;
    for e in &ev.events {
        sqlx::query(
            r#"INSERT INTO shipment_trace_event(
                 id, shipment_id, event_at, event_kind, location, description,
                 raw_source, raw_event_id, raw_payload_json
               ) VALUES ($1, $2, $3, $4, $5, $6, 'webhook', $7, '{}'::jsonb)
               -- 去重键是 `uq_trace_dedup (raw_source, raw_event_id)`,那个唯一索引
               -- 本来就是为这件事建的。之前写的是 `ON CONFLICT (id)` —— id 每次
               -- 现生成,这个冲突永远不会发生,撞上的是唯一索引:事务回滚、回调 500、
               -- 承运商继续重推,而重推是常态不是异常。
               -- 索引是【部分索引】,所以 WHERE 子句要原样带上,否则匹配不到它。
               ON CONFLICT (raw_source, raw_event_id) WHERE raw_event_id IS NOT NULL
               DO NOTHING"#,
        )
        .bind(new_id("ste"))
        .bind(&shipment_id)
        .bind(e.event_at)
        .bind(&e.kind)
        .bind(&e.location)
        .bind(&e.description)
        .bind(&e.raw_event_id)
        .execute(&mut *tx)
        .await.db()?;

        advance_status(&mut tx, &shipment_id, &e.kind).await?;
    }
    tx.commit().await.db()?;
    Ok(())
}
