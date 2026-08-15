//! PgRefundService · `RefundService` trait 的 sqlx 落地。
//!
//! 关键:
//! - approve / deny / retry 内部状态机校验
//! - approve 成功 → 同事务推 payment / order 金额 + 写 RefundCompleted outbox
//!   (mock 模式直推 success;真接入会先 approved → adapter.refund → webhook 后 success)

use async_trait::async_trait;
use chrono::Utc;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::commerce::enums::RefundStatus;
use crate::commerce::events::DomainEvent;
use crate::commerce::outbox;
use crate::commerce::refund::Refund;
use crate::commerce::services::{
    CreateRefundRequest, Page, RefundListFilter, RefundService,
};
use crate::commerce::state_machine::StateTransition;
use crate::DomainError;

#[derive(Clone)]
pub struct PgRefundService {
    pub pool: PgPool,
}

impl PgRefundService {
    pub fn new(pool: PgPool) -> Self { Self { pool } }
}

#[async_trait]
impl RefundService for PgRefundService {
    async fn request(&self, req: CreateRefundRequest) -> Result<Refund, DomainError> {
        // 校验:remaining 不能超出
        let order = sqlx::query(
            "SELECT amount_paid_minor, amount_refunded_minor, currency FROM order_record WHERE id=$1",
        ).bind(&req.order_id).fetch_optional(&self.pool).await?
         .ok_or_else(|| DomainError::NotFound(format!("order {}", req.order_id)))?;
        let paid: i64 = order.try_get("amount_paid_minor")?;
        let refunded: i64 = order.try_get("amount_refunded_minor")?;
        let remaining = paid - refunded;
        if req.amount_minor <= 0 || req.amount_minor > remaining {
            return Err(DomainError::Validation(
                format!("amount {} 超出可退余额 {remaining}", req.amount_minor),
            ));
        }
        let currency: String = order.try_get("currency")?;
        let refund_id = format!("rfd-{}", Uuid::new_v4());

        let mut tx = self.pool.begin().await?;
        sqlx::query(
            r#"INSERT INTO refund(id, order_id, payment_id, amount_minor, currency,
                                  reason_code, reason_text, actor_kind, actor_id, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'requested')"#,
        ).bind(&refund_id).bind(&req.order_id).bind(&req.payment_id)
         .bind(req.amount_minor).bind(&currency)
         .bind(&req.reason_code).bind(&req.reason_text)
         .bind(&req.actor_kind).bind(&req.actor_id)
         .execute(&mut *tx).await?;

        outbox::write(&mut *tx, &DomainEvent::RefundInitiated {
            refund_id: refund_id.clone(), payment_id: req.payment_id.clone(),
            amount_minor: req.amount_minor, occurred_at: Utc::now(),
        }).await?;
        tx.commit().await?;

        let r: Refund = sqlx::query_as("SELECT * FROM refund WHERE id=$1")
            .bind(&refund_id).fetch_one(&self.pool).await?;
        Ok(r)
    }

    async fn list_admin(&self, f: &RefundListFilter) -> Result<Page<Refund>, DomainError> {
        let off = f.page as i64 * f.page_size as i64;
        let lim = f.page_size.clamp(1, 200) as i64;
        let items: Vec<Refund> = sqlx::query_as(
            r#"SELECT * FROM refund
               WHERE ($1::text IS NULL OR status=$1)
               ORDER BY created_at DESC OFFSET $2 LIMIT $3"#,
        ).bind(&f.status).bind(off).bind(lim).fetch_all(&self.pool).await?;
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM refund WHERE ($1::text IS NULL OR status=$1)",
        ).bind(&f.status).fetch_one(&self.pool).await?;
        Ok(Page { items, total, page: f.page, page_size: f.page_size })
    }

    /// mock 模式:approve → 直接到 success(真接入会停在 approved 等 adapter.refund)。
    async fn approve(&self, id: &str, admin_id: &str) -> Result<(), DomainError> {
        let mut tx = self.pool.begin().await?;
        let row = sqlx::query(
            "SELECT order_id, payment_id, amount_minor, status FROM refund WHERE id=$1 FOR UPDATE",
        ).bind(id).fetch_optional(&mut *tx).await?
         .ok_or_else(|| DomainError::NotFound(format!("refund {id}")))?;
        let cur_str: String = row.try_get("status")?;
        let cur = RefundStatus::from_str_lax(&cur_str)
            .ok_or_else(|| DomainError::Internal(format!("unknown refund status {cur_str}")))?;
        cur.assert_transition(RefundStatus::Approved)?;

        let order_id: String = row.try_get("order_id")?;
        let payment_id: String = row.try_get("payment_id")?;
        let amount: i64 = row.try_get("amount_minor")?;

        sqlx::query(
            r#"UPDATE refund SET status='success', approved_at=NOW(), approved_by_admin_id=$1,
                 processed_at=NOW(), completed_at=NOW(),
                 channel_refund_id = 'MOCK_' || id
               WHERE id=$2"#,
        ).bind(admin_id).bind(id).execute(&mut *tx).await?;

        sqlx::query(
            r#"UPDATE payment SET status = CASE
                 WHEN $1 >= amount_minor THEN 'refunded' ELSE 'refunded_partial' END
               WHERE id=$2"#,
        ).bind(amount).bind(&payment_id).execute(&mut *tx).await?;

        sqlx::query(
            r#"UPDATE order_record SET
                 amount_refunded_minor = amount_refunded_minor + $1,
                 status = CASE
                   WHEN amount_refunded_minor + $1 >= amount_total_minor THEN 'refunded'
                   WHEN status IN ('paid','fulfilling','done') THEN 'refund_partial'
                   ELSE status END
               WHERE id=$2"#,
        ).bind(amount).bind(&order_id).execute(&mut *tx).await?;

        outbox::write(&mut *tx, &DomainEvent::RefundApproved {
            refund_id: id.into(), approved_by: admin_id.into(), occurred_at: Utc::now(),
        }).await?;
        outbox::write(&mut *tx, &DomainEvent::RefundCompleted {
            refund_id: id.into(), occurred_at: Utc::now(),
        }).await?;
        tx.commit().await?;
        Ok(())
    }

    async fn deny(&self, id: &str, admin_id: &str, reason: &str) -> Result<(), DomainError> {
        sqlx::query(
            r#"UPDATE refund SET status='cancelled', audit_note = audit_note || E'\\n' || $1
               WHERE id=$2 AND status IN ('requested','failed')"#,
        ).bind(format!("admin {admin_id} deny: {reason}")).bind(id)
         .execute(&self.pool).await?;
        Ok(())
    }

    async fn retry(&self, id: &str, admin_id: &str) -> Result<(), DomainError> {
        // 把 failed 重置 approved → 再走一次 adapter.refund(真接入)
        let r = sqlx::query("UPDATE refund SET status='approved', failure_code=NULL, failure_msg=NULL WHERE id=$1 AND status='failed' RETURNING id")
            .bind(id).fetch_optional(&self.pool).await?;
        if r.is_none() {
            return Err(DomainError::Conflict("refund 非 failed 状态,无需 retry".into()));
        }
        sqlx::query("UPDATE refund SET audit_note = audit_note || E'\\n' || $1 WHERE id=$2")
            .bind(format!("admin {admin_id} retry"))
            .bind(id).execute(&self.pool).await?;
        Ok(())
    }

    async fn apply_webhook_event(
        &self, _channel: &str, _channel_event_id: &str, _payload: serde_json::Value,
    ) -> Result<(), DomainError> {
        Err(DomainError::Internal(
            "PgRefundService::apply_webhook_event 由 routes / workers 层走 adapter+outbox 链路".into(),
        ))
    }
}
