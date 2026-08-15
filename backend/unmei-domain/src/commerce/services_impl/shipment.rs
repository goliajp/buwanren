//! PgShipmentService · `ShipmentService` trait 的 sqlx 落地。
//!
//! 关键:
//! - `create_from_order` 从 order 的 shipping 类 line 自动创 shipment(preparing)
//! - `assign_tracking` 录入运单号 → 推到 picked_up + 触发 sweeper 首拉
//! - `mark_exception` / `mark_returning` 状态机校验
//! - 物流到 delivered 时写 ShipmentDelivered outbox

use async_trait::async_trait;
use chrono::Utc;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::commerce::enums::ShipmentStatus;
use crate::commerce::events::DomainEvent;
use crate::commerce::outbox;
use crate::commerce::services::{
    AssignTrackingRequest, Page, ShipmentListFilter, ShipmentService,
};
use crate::commerce::shipment::{Shipment, ShipmentDetail, ShipmentTraceEvent};
use crate::commerce::state_machine::StateTransition;
use crate::DomainError;

#[derive(Clone)]
pub struct PgShipmentService {
    pub pool: PgPool,
}

impl PgShipmentService {
    pub fn new(pool: PgPool) -> Self { Self { pool } }
}

#[async_trait]
impl ShipmentService for PgShipmentService {
    /// 扫 order 的 shipping 类 line,合单创建 1 个 shipment(preparing 状态)。
    async fn create_from_order(&self, order_id: &str) -> Result<Vec<String>, DomainError> {
        let lines = sqlx::query(
            r#"SELECT ol.id, ol.sku_id, s.product_id, p.fulfillment_kind
               FROM order_line ol
               JOIN sku s ON s.id = ol.sku_id
               JOIN product p ON p.id = s.product_id
               WHERE ol.order_id=$1 AND p.fulfillment_kind='shipping'
                 AND ol.fulfillment_status IN ('pending','processing')"#,
        ).bind(order_id).fetch_all(&self.pool).await?;
        if lines.is_empty() { return Ok(vec![]); }

        let mut tx = self.pool.begin().await?;
        let sid = format!("shp-{}", Uuid::new_v4());
        let line_ids: Vec<String> = lines.iter()
            .map(|r| r.try_get::<String, _>("id"))
            .collect::<Result<Vec<_>, _>>()?;

        sqlx::query(
            r#"INSERT INTO shipment(
                 id, order_id, order_line_ids, carrier_code, status,
                 recipient_snapshot_json, shipping_method
               )
               SELECT $1, $2, $3::text[], 'manual', 'preparing',
                      COALESCE(om.shipping_address_json, '{}'::jsonb), 'standard'
               FROM order_meta om WHERE om.order_id=$2
               ON CONFLICT DO NOTHING"#,
        ).bind(&sid).bind(order_id).bind(&line_ids).execute(&mut *tx).await?;

        sqlx::query(
            "UPDATE order_line SET fulfillment_status='processing'
             WHERE id = ANY($1::text[])",
        ).bind(&line_ids).execute(&mut *tx).await?;

        outbox::write(&mut *tx, &DomainEvent::ShipmentCreated {
            shipment_id: sid.clone(), order_id: order_id.into(), occurred_at: Utc::now(),
        }).await?;
        tx.commit().await?;
        Ok(vec![sid])
    }

    async fn list_admin(&self, f: &ShipmentListFilter) -> Result<Page<Shipment>, DomainError> {
        let off = f.page as i64 * f.page_size as i64;
        let lim = f.page_size.clamp(1, 200) as i64;
        let exc = f.exception_only.unwrap_or(false);
        let items: Vec<Shipment> = sqlx::query_as(
            r#"SELECT * FROM shipment
               WHERE ($1::text IS NULL OR status=$1)
                 AND ($2::text IS NULL OR carrier_code=$2)
                 AND ($3::text IS NULL OR order_id=$3)
                 AND (NOT $4 OR status IN ('exception','returning'))
               ORDER BY (status='exception') DESC, created_at DESC OFFSET $5 LIMIT $6"#,
        ).bind(&f.status).bind(&f.carrier_code).bind(&f.order_id).bind(exc)
         .bind(off).bind(lim).fetch_all(&self.pool).await?;
        let total: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM shipment
               WHERE ($1::text IS NULL OR status=$1)
                 AND ($2::text IS NULL OR carrier_code=$2)
                 AND ($3::text IS NULL OR order_id=$3)
                 AND (NOT $4 OR status IN ('exception','returning'))"#,
        ).bind(&f.status).bind(&f.carrier_code).bind(&f.order_id).bind(exc)
         .fetch_one(&self.pool).await?;
        Ok(Page { items, total, page: f.page, page_size: f.page_size })
    }

    async fn get(&self, id: &str) -> Result<ShipmentDetail, DomainError> {
        let shipment: Shipment = sqlx::query_as("SELECT * FROM shipment WHERE id=$1")
            .bind(id).fetch_optional(&self.pool).await?
            .ok_or_else(|| DomainError::NotFound(format!("shipment {id}")))?;
        let trace: Vec<ShipmentTraceEvent> = sqlx::query_as(
            "SELECT * FROM shipment_trace_event WHERE shipment_id=$1 ORDER BY event_at DESC",
        ).bind(id).fetch_all(&self.pool).await?;
        Ok(ShipmentDetail { shipment, trace })
    }

    async fn assign_tracking(&self, req: AssignTrackingRequest, admin_id: &str) -> Result<(), DomainError> {
        let mut tx = self.pool.begin().await?;
        let cur_str: Option<String> = sqlx::query_scalar(
            "SELECT status FROM shipment WHERE id=$1 FOR UPDATE",
        ).bind(&req.shipment_id).fetch_optional(&mut *tx).await?;
        let cur_str = cur_str.ok_or_else(|| DomainError::NotFound(format!("shipment {}", req.shipment_id)))?;
        let cur = ShipmentStatus::from_str_lax(&cur_str)
            .ok_or_else(|| DomainError::Internal(format!("unknown status {cur_str}")))?;
        cur.assert_transition(ShipmentStatus::PickedUp)?;

        sqlx::query(
            r#"UPDATE shipment SET
                 carrier_code = $1,
                 tracking_no  = $2,
                 shipping_method = COALESCE($3, shipping_method),
                 cost_minor      = COALESCE($4, cost_minor),
                 cost_currency   = COALESCE($5, cost_currency),
                 status = 'picked_up',
                 picked_up_at = COALESCE(picked_up_at, NOW()),
                 audit_note = audit_note || E'\\n' || $6
               WHERE id=$7"#,
        ).bind(&req.carrier_code).bind(&req.tracking_no)
         .bind(&req.shipping_method).bind(req.cost_minor).bind(&req.cost_currency)
         .bind(format!("admin {admin_id} assign tracking"))
         .bind(&req.shipment_id).execute(&mut *tx).await?;

        outbox::write(&mut *tx, &DomainEvent::ShipmentTrackingAssigned {
            shipment_id: req.shipment_id.clone(),
            carrier_code: req.carrier_code.clone(),
            tracking_no: req.tracking_no.clone(),
            occurred_at: Utc::now(),
        }).await?;
        tx.commit().await?;
        Ok(())
    }

    /// 触发立即拉 trace(由 route 注入 carrier adapter,此处仅返回需要被拉的 shipment 数)
    async fn force_query(&self, id: &str) -> Result<u32, DomainError> {
        let exists: Option<String> = sqlx::query_scalar(
            "SELECT id FROM shipment WHERE id=$1 AND tracking_no IS NOT NULL",
        ).bind(id).fetch_optional(&self.pool).await?;
        Ok(if exists.is_some() { 1 } else { 0 })
    }

    async fn mark_exception(&self, id: &str, reason: &str, admin_id: &str) -> Result<(), DomainError> {
        let cur: Option<String> = sqlx::query_scalar("SELECT status FROM shipment WHERE id=$1")
            .bind(id).fetch_optional(&self.pool).await?;
        let cur_str = cur.ok_or_else(|| DomainError::NotFound(format!("shipment {id}")))?;
        let cur = ShipmentStatus::from_str_lax(&cur_str)
            .ok_or_else(|| DomainError::Internal(format!("unknown status {cur_str}")))?;
        cur.assert_transition(ShipmentStatus::Exception)?;

        let mut tx = self.pool.begin().await?;
        sqlx::query(
            "UPDATE shipment SET status='exception', audit_note = audit_note || E'\\n' || $1 WHERE id=$2",
        ).bind(format!("admin {admin_id} exception: {reason}")).bind(id)
         .execute(&mut *tx).await?;
        outbox::write(&mut *tx, &DomainEvent::ShipmentException {
            shipment_id: id.into(), kind: reason.into(), occurred_at: Utc::now(),
        }).await?;
        tx.commit().await?;
        Ok(())
    }

    async fn mark_returning(&self, id: &str, admin_id: &str) -> Result<(), DomainError> {
        let cur: Option<String> = sqlx::query_scalar("SELECT status FROM shipment WHERE id=$1")
            .bind(id).fetch_optional(&self.pool).await?;
        let cur_str = cur.ok_or_else(|| DomainError::NotFound(format!("shipment {id}")))?;
        let cur = ShipmentStatus::from_str_lax(&cur_str)
            .ok_or_else(|| DomainError::Internal(format!("unknown status {cur_str}")))?;
        cur.assert_transition(ShipmentStatus::Returning)?;
        sqlx::query(
            "UPDATE shipment SET status='returning', audit_note = audit_note || E'\\n' || $1 WHERE id=$2",
        ).bind(format!("admin {admin_id} mark returning")).bind(id)
         .execute(&self.pool).await?;
        Ok(())
    }

    async fn list_user_for_order(&self, user_id: &str, order_id: &str) -> Result<Vec<Shipment>, DomainError> {
        let uid: Option<String> = sqlx::query_scalar(
            "SELECT user_id FROM order_record WHERE id=$1",
        ).bind(order_id).fetch_optional(&self.pool).await?;
        let uid = uid.ok_or_else(|| DomainError::NotFound(format!("order {order_id}")))?;
        if uid != user_id { return Err(DomainError::Conflict("not owner".into())); }
        let rows: Vec<Shipment> = sqlx::query_as(
            "SELECT * FROM shipment WHERE order_id=$1 ORDER BY created_at DESC",
        ).bind(order_id).fetch_all(&self.pool).await?;
        Ok(rows)
    }

    async fn list_trace(&self, shipment_id: &str) -> Result<Vec<ShipmentTraceEvent>, DomainError> {
        let rows: Vec<ShipmentTraceEvent> = sqlx::query_as(
            "SELECT * FROM shipment_trace_event WHERE shipment_id=$1 ORDER BY event_at DESC",
        ).bind(shipment_id).fetch_all(&self.pool).await?;
        Ok(rows)
    }

    async fn sweep_trace(&self) -> Result<u64, DomainError> {
        // 由 worker 调具体 carrier adapter — service 层只标记可被扫的数量
        let n: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM shipment
               WHERE status IN ('picked_up','in_transit','out_for_delivery','exception')
                 AND tracking_no IS NOT NULL
                 AND carrier_code <> 'manual'"#,
        ).fetch_one(&self.pool).await?;
        Ok(n as u64)
    }
}

/// Helper:trace event 推进到 delivered 时写 ShipmentDelivered outbox(由 worker 调用)
pub async fn apply_shipment_delivered(
    pool: &PgPool,
    shipment_id: &str,
) -> Result<(), DomainError> {
    let mut tx = pool.begin().await?;
    let row = sqlx::query("SELECT order_id, status FROM shipment WHERE id=$1 FOR UPDATE")
        .bind(shipment_id).fetch_optional(&mut *tx).await?
        .ok_or_else(|| DomainError::NotFound(format!("shipment {shipment_id}")))?;
    let status: String = row.try_get("status")?;
    if status == "delivered" { return Ok(()); }
    let order_id: String = row.try_get("order_id")?;
    sqlx::query("UPDATE shipment SET status='delivered', delivered_at=NOW() WHERE id=$1")
        .bind(shipment_id).execute(&mut *tx).await?;
    outbox::write(&mut *tx, &DomainEvent::ShipmentDelivered {
        shipment_id: shipment_id.into(), order_id, occurred_at: Utc::now(),
    }).await?;
    tx.commit().await?;
    Ok(())
}
