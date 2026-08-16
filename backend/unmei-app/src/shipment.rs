//! 物流用例。

use chrono::Utc;
use sqlx::{PgPool, Row};
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
    let row = sqlx::query("SELECT order_id, status FROM shipment WHERE id=$1 FOR UPDATE")
        .bind(shipment_id)
        .fetch_optional(&mut *tx)
        .await.db()?
        .ok_or_else(|| DomainError::NotFound(format!("shipment {shipment_id}")))?;

    let status: String = row.get("status");
    if status == "delivered" {
        return Ok(());
    }
    let order_id: String = row.get("order_id");

    sqlx::query("UPDATE shipment SET status='delivered', delivered_at=NOW() WHERE id=$1")
        .bind(shipment_id)
        .execute(&mut *tx)
        .await.db()?;

    outbox::write(
        &mut *tx,
        &DomainEvent::ShipmentDelivered {
            shipment_id: shipment_id.to_string(),
            order_id,
            occurred_at: Utc::now(),
        },
    )
    .await?;

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
               ON CONFLICT (id) DO NOTHING"#,
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

        sqlx::query(
            r#"UPDATE shipment SET status = CASE
                 WHEN $1='delivered'        THEN 'delivered'
                 WHEN $1='out_for_delivery' THEN 'out_for_delivery'
                 WHEN $1='picked_up'        THEN 'picked_up'
                 WHEN $1='exception'        THEN 'exception'
                 WHEN $1='returned'         THEN 'returned'
                 ELSE 'in_transit' END,
               delivered_at = CASE WHEN $1='delivered' THEN NOW() ELSE delivered_at END
               WHERE id=$2"#,
        )
        .bind(&e.kind)
        .bind(&shipment_id)
        .execute(&mut *tx)
        .await.db()?;
    }
    tx.commit().await.db()?;
    Ok(())
}
