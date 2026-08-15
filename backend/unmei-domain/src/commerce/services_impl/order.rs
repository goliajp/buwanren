//! PgOrderService · `OrderService` trait 的 sqlx 落地。

use async_trait::async_trait;
use chrono::Utc;
use serde_json::json;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::commerce::enums::OrderStatus;
use crate::commerce::events::DomainEvent;
use crate::commerce::order::{Order, OrderDetail, OrderEvent, OrderLine, OrderMeta};
use crate::commerce::outbox;
use crate::commerce::services::{
    CreateOrderRequest, ListParams, OrderListFilter, OrderService, Page,
};
use crate::commerce::state_machine::StateTransition;
use crate::DomainError;

#[derive(Clone)]
pub struct PgOrderService {
    pub pool: PgPool,
}

impl PgOrderService {
    pub fn new(pool: PgPool) -> Self { Self { pool } }
}

#[async_trait]
impl OrderService for PgOrderService {
    async fn create(&self, req: CreateOrderRequest) -> Result<Order, DomainError> {
        if req.lines.is_empty() {
            return Err(DomainError::Validation("lines is empty".into()));
        }
        let mut tx = self.pool.begin().await?;
        let order_id = format!("ord-{}", Uuid::new_v4());

        // 1. 收 SKU + 当前价
        let mut subtotal: i64 = 0;
        let mut snapshots: Vec<(String, i64, i32, i64, serde_json::Value)> = vec![];
        let mut currency = "CNY".to_string();
        for l in &req.lines {
            if l.qty <= 0 { return Err(DomainError::Validation(format!("qty {} ≤ 0", l.qty))); }
            let row = sqlx::query(
                r#"SELECT s.id, s.code, s.name, s.spec_json, s.weight_g,
                          pb.price_minor, pb.currency
                   FROM sku s
                   LEFT JOIN LATERAL (
                     SELECT price_minor, currency FROM price_book
                     WHERE sku_id = s.id AND status='active'
                       AND effective_from <= NOW()
                       AND (effective_to IS NULL OR effective_to > NOW())
                     ORDER BY effective_from DESC LIMIT 1
                   ) pb ON TRUE
                   WHERE s.id=$1 AND s.status='active'"#,
            ).bind(&l.sku_id).fetch_optional(&mut *tx).await?
             .ok_or_else(|| DomainError::NotFound(format!("sku {}", l.sku_id)))?;

            let unit: i64 = row.try_get("price_minor")
                .map_err(|_| DomainError::Validation(format!("sku {} 无激活价", l.sku_id)))?;
            let cur: String = row.try_get("currency").unwrap_or_else(|_| "CNY".into());
            currency = cur;

            let line_sub = unit * l.qty as i64;
            subtotal += line_sub;
            snapshots.push((
                l.sku_id.clone(), unit, l.qty, line_sub,
                json!({
                    "sku_code": row.try_get::<String, _>("code").unwrap_or_default(),
                    "sku_name": row.try_get::<String, _>("name").unwrap_or_default(),
                    "spec":     row.try_get::<serde_json::Value, _>("spec_json").unwrap_or(serde_json::Value::Null),
                    "weight_g": row.try_get::<Option<i32>, _>("weight_g").ok().flatten(),
                }),
            ));
        }

        let total = subtotal;
        let now = Utc::now();

        sqlx::query(
            r#"INSERT INTO order_record(
                 id, user_id, channel_origin, currency,
                 amount_subtotal_minor, amount_total_minor,
                 status, source_kind, region, ip, ua, expires_at, audit_note
               ) VALUES ($1, $2, $3, $4, $5, $6, 'unpaid', 'one_shot', $7, $8, $9,
                         NOW() + INTERVAL '30 minutes', $10)"#,
        ).bind(&order_id).bind(&req.user_id).bind(&req.channel_origin).bind(&currency)
         .bind(subtotal).bind(total).bind(&req.region)
         .bind(&req.ip).bind(&req.ua).bind(req.note.unwrap_or_default())
         .execute(&mut *tx).await?;

        for (idx, (sku_id, unit, qty, line_sub, snap)) in snapshots.iter().enumerate() {
            sqlx::query(
                r#"INSERT INTO order_line(
                     id, order_id, line_no, sku_id, sku_snapshot_json,
                     unit_price_minor, qty, line_subtotal_minor, fulfillment_status
                   ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')"#,
            ).bind(format!("ol-{}", Uuid::new_v4())).bind(&order_id).bind((idx + 1) as i32)
             .bind(sku_id).bind(snap).bind(unit).bind(qty).bind(line_sub)
             .execute(&mut *tx).await?;
        }

        sqlx::query(
            r#"INSERT INTO order_meta(order_id, shipping_address_json, contact_json, extra_json)
               VALUES ($1, $2, $3, '{}'::jsonb)"#,
        ).bind(&order_id).bind(&req.shipping_address).bind(&req.receipt)
         .execute(&mut *tx).await?;

        sqlx::query(
            r#"INSERT INTO order_event(id, order_id, kind, actor_kind, actor_id,
                                       before_status, after_status, meta_json)
               VALUES ($1, $2, 'OrderCreated', 'user', $3, NULL, 'unpaid', '{}'::jsonb)"#,
        ).bind(format!("oe-{}", Uuid::new_v4())).bind(&order_id).bind(&req.user_id)
         .execute(&mut *tx).await?;

        // ─── Outbox: OrderCreated ───────────────────────────────
        outbox::write(&mut *tx, &DomainEvent::OrderCreated {
            order_id: order_id.clone(),
            user_id: req.user_id.clone(),
            amount_total_minor: total,
            currency: currency.clone(),
            occurred_at: now,
        }).await?;

        tx.commit().await?;

        // 简化返回(不重新 SELECT,直接构造 minimum Order)
        Ok(Order {
            id: order_id, user_id: req.user_id, channel_origin: req.channel_origin,
            currency,
            amount_subtotal_minor: subtotal, amount_discount_minor: 0,
            amount_shipping_minor: 0, amount_tax_minor: 0,
            amount_total_minor: total, amount_paid_minor: 0, amount_refunded_minor: 0,
            status: OrderStatus::Unpaid,
            source_kind: crate::commerce::enums::OrderSourceKind::OneShot,
            source_ref_id: None,
            expires_at: now + chrono::Duration::minutes(30),
            paid_at: None, fulfilled_at: None, cancelled_at: None,
            cancel_reason: None, cancel_actor: None,
            receipt_kind: crate::commerce::enums::ReceiptKind::None,
            receipt_meta_json: json!({}),
            region: req.region, ip: req.ip, ua: req.ua, risk_score: None,
            audit_note: String::new(), created_at: now, updated_at: now,
        })
    }

    async fn get(&self, id: &str) -> Result<OrderDetail, DomainError> {
        let order: Order = sqlx::query_as(
            "SELECT * FROM order_record WHERE id=$1",
        ).bind(id).fetch_optional(&self.pool).await?
         .ok_or_else(|| DomainError::NotFound(format!("order {id}")))?;

        let lines: Vec<OrderLine> = sqlx::query_as("SELECT * FROM order_line WHERE order_id=$1 ORDER BY line_no")
            .bind(id).fetch_all(&self.pool).await?;
        let events: Vec<OrderEvent> = sqlx::query_as("SELECT * FROM order_event WHERE order_id=$1 ORDER BY created_at DESC LIMIT 50")
            .bind(id).fetch_all(&self.pool).await?;
        let meta: Option<OrderMeta> = sqlx::query_as("SELECT * FROM order_meta WHERE order_id=$1")
            .bind(id).fetch_optional(&self.pool).await?;
        Ok(OrderDetail { order, lines, events, meta })
    }

    async fn list_admin(&self, f: &OrderListFilter) -> Result<Page<Order>, DomainError> {
        let off = f.page as i64 * f.page_size as i64;
        let lim = f.page_size.clamp(1, 200) as i64;
        let items: Vec<Order> = sqlx::query_as(
            r#"SELECT * FROM order_record
               WHERE ($1::text IS NULL OR status=$1)
                 AND ($2::text IS NULL OR channel_origin=$2)
                 AND ($3::text IS NULL OR user_id=$3)
               ORDER BY created_at DESC OFFSET $4 LIMIT $5"#,
        ).bind(&f.status).bind(&f.channel_origin).bind(&f.user_id)
         .bind(off).bind(lim).fetch_all(&self.pool).await?;
        let total: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM order_record
               WHERE ($1::text IS NULL OR status=$1)
                 AND ($2::text IS NULL OR channel_origin=$2)
                 AND ($3::text IS NULL OR user_id=$3)"#,
        ).bind(&f.status).bind(&f.channel_origin).bind(&f.user_id)
         .fetch_one(&self.pool).await?;
        Ok(Page { items, total, page: f.page, page_size: f.page_size })
    }

    async fn list_user(&self, user_id: &str, p: &ListParams) -> Result<Page<Order>, DomainError> {
        let off = p.page as i64 * p.page_size as i64;
        let lim = p.page_size.clamp(1, 100) as i64;
        let items: Vec<Order> = sqlx::query_as(
            r#"SELECT * FROM order_record
               WHERE user_id=$1 AND ($2::text IS NULL OR status=$2)
               ORDER BY created_at DESC OFFSET $3 LIMIT $4"#,
        ).bind(user_id).bind(&p.status).bind(off).bind(lim)
         .fetch_all(&self.pool).await?;
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM order_record WHERE user_id=$1 AND ($2::text IS NULL OR status=$2)",
        ).bind(user_id).bind(&p.status).fetch_one(&self.pool).await?;
        Ok(Page { items, total, page: p.page, page_size: p.page_size })
    }

    async fn cancel(&self, id: &str, reason: &str, actor: &str) -> Result<(), DomainError> {
        let mut tx = self.pool.begin().await?;
        let cur: Option<String> = sqlx::query_scalar(
            "SELECT status FROM order_record WHERE id=$1 FOR UPDATE",
        ).bind(id).fetch_optional(&mut *tx).await?;
        let cur_str = cur.ok_or_else(|| DomainError::NotFound(format!("order {id}")))?;
        let cur_enum = OrderStatus::from_str_lax(&cur_str)
            .ok_or_else(|| DomainError::Internal(format!("unknown status {cur_str}")))?;
        cur_enum.assert_transition(OrderStatus::Cancelled)?;

        sqlx::query(
            r#"UPDATE order_record SET status='cancelled', cancelled_at=NOW(),
                  cancel_reason=$1, cancel_actor=$2 WHERE id=$3"#,
        ).bind(reason).bind(actor).bind(id).execute(&mut *tx).await?;
        sqlx::query(
            r#"INSERT INTO order_event(id, order_id, kind, actor_kind, actor_id,
                                       before_status, after_status, meta_json)
               VALUES ($1, $2, 'OrderCancelled', $3, $4, $5, 'cancelled', $6)"#,
        ).bind(format!("oe-{}", Uuid::new_v4())).bind(id).bind(actor_kind(actor))
         .bind(actor).bind(&cur_str).bind(json!({ "reason": reason }))
         .execute(&mut *tx).await?;

        outbox::write(&mut *tx, &DomainEvent::OrderCancelled {
            order_id: id.into(), reason: reason.into(),
            actor: actor.into(), occurred_at: Utc::now(),
        }).await?;
        tx.commit().await?;
        Ok(())
    }

    async fn mark_paid(&self, id: &str, payment_id: &str) -> Result<(), DomainError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("UPDATE order_record SET status='paid', paid_at=NOW() WHERE id=$1 AND status='unpaid'")
            .bind(id).execute(&mut *tx).await?;
        sqlx::query(
            r#"INSERT INTO order_event(id, order_id, kind, actor_kind, actor_id,
                                       before_status, after_status, meta_json)
               VALUES ($1, $2, 'OrderPaid', 'webhook', NULL, 'unpaid', 'paid', $3)"#,
        ).bind(format!("oe-{}", Uuid::new_v4())).bind(id)
         .bind(json!({ "payment_id": payment_id }))
         .execute(&mut *tx).await?;
        outbox::write(&mut *tx, &DomainEvent::OrderPaid {
            order_id: id.into(), payment_id: payment_id.into(), occurred_at: Utc::now(),
        }).await?;
        tx.commit().await?;
        Ok(())
    }

    async fn mark_fulfilled(&self, id: &str) -> Result<(), DomainError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("UPDATE order_record SET status='done', fulfilled_at=NOW() WHERE id=$1")
            .bind(id).execute(&mut *tx).await?;
        sqlx::query(
            r#"INSERT INTO order_event(id, order_id, kind, actor_kind, actor_id,
                                       before_status, after_status, meta_json)
               VALUES ($1, $2, 'OrderFulfilled', 'system', NULL, 'fulfilling', 'done', '{}'::jsonb)"#,
        ).bind(format!("oe-{}", Uuid::new_v4())).bind(id).execute(&mut *tx).await?;
        outbox::write(&mut *tx, &DomainEvent::OrderFulfilled {
            order_id: id.into(), occurred_at: Utc::now(),
        }).await?;
        tx.commit().await?;
        Ok(())
    }

    async fn re_fulfill(&self, id: &str, actor_admin_id: &str) -> Result<(), DomainError> {
        sqlx::query(
            r#"UPDATE order_line SET fulfillment_status='pending' WHERE order_id=$1 AND fulfillment_status='failed'"#,
        ).bind(id).execute(&self.pool).await?;
        sqlx::query(
            "UPDATE order_record SET audit_note = audit_note || E'\\n' || $1 WHERE id=$2",
        ).bind(format!("admin {actor_admin_id} re-fulfilled")).bind(id)
         .execute(&self.pool).await?;
        Ok(())
    }

    async fn annotate(&self, id: &str, note: &str, actor_admin_id: &str) -> Result<(), DomainError> {
        sqlx::query(
            "UPDATE order_record SET audit_note = audit_note || E'\\n' || $1 WHERE id=$2",
        ).bind(format!("[{actor_admin_id}] {note}")).bind(id)
         .execute(&self.pool).await?;
        Ok(())
    }

    async fn expire_unpaid(&self) -> Result<u64, DomainError> {
        let res = sqlx::query(
            r#"UPDATE order_record SET status='cancelled', cancelled_at=NOW(),
                 cancel_reason='expired', cancel_actor='system'
               WHERE status='unpaid' AND expires_at < NOW()"#,
        ).execute(&self.pool).await?;
        Ok(res.rows_affected())
    }
}

fn actor_kind(actor: &str) -> &'static str {
    if actor.starts_with("admin") { "admin" }
    else if actor.starts_with("u_") || actor.starts_with("mock_user") { "user" }
    else { "system" }
}
