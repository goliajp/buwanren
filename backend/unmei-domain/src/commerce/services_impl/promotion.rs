//! PgPromotionService · `PromotionService` trait 的 sqlx 落地。
//!
//! 覆盖:
//! - Promotion CRUD + 状态切换(draft → scheduled → active → paused → exhausted → ended)
//! - 优惠券派发(批量 + 个人持有)
//! - 用户兑换(coupon code → 锁定到 owner_user_id)
//! - 主要 outbox:CouponIssued / CouponRedeemed / CouponExpired

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::commerce::enums::CouponState;
use crate::commerce::events::DomainEvent;
use crate::commerce::outbox;
use crate::commerce::promotion::{Coupon, Promotion};
use crate::commerce::services::{
    ListParams, Page, PromotionListFilter, PromotionService,
};
use crate::DomainError;

#[derive(Clone)]
pub struct PgPromotionService {
    pub pool: PgPool,
}

impl PgPromotionService {
    pub fn new(pool: PgPool) -> Self { Self { pool } }
}

#[async_trait]
impl PromotionService for PgPromotionService {
    async fn list_admin(&self, f: &PromotionListFilter) -> Result<Page<Promotion>, DomainError> {
        let off = f.page as i64 * f.page_size as i64;
        let lim = f.page_size.clamp(1, 200) as i64;
        let kw_like = f.keyword.as_ref().map(|k| format!("%{k}%"));
        let items: Vec<Promotion> = sqlx::query_as(
            r#"SELECT * FROM promotion
               WHERE ($1::text IS NULL OR status=$1)
                 AND ($2::text IS NULL OR name ILIKE $2 OR code ILIKE $2)
               ORDER BY status='active' DESC, priority DESC, created_at DESC
               OFFSET $3 LIMIT $4"#,
        ).bind(&f.status).bind(&kw_like).bind(off).bind(lim)
         .fetch_all(&self.pool).await?;
        let total: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM promotion
               WHERE ($1::text IS NULL OR status=$1)
                 AND ($2::text IS NULL OR name ILIKE $2 OR code ILIKE $2)"#,
        ).bind(&f.status).bind(&kw_like).fetch_one(&self.pool).await?;
        Ok(Page { items, total, page: f.page, page_size: f.page_size })
    }

    async fn get(&self, id: &str) -> Result<Promotion, DomainError> {
        let p: Promotion = sqlx::query_as("SELECT * FROM promotion WHERE id=$1")
            .bind(id).fetch_optional(&self.pool).await?
            .ok_or_else(|| DomainError::NotFound(format!("promotion {id}")))?;
        Ok(p)
    }

    async fn upsert(&self, p: Promotion, _admin_id: &str) -> Result<Promotion, DomainError> {
        let id = if p.id.is_empty() { format!("promo-{}", Uuid::new_v4()) } else { p.id.clone() };
        sqlx::query(
            r#"INSERT INTO promotion(id, code, name, kind, match_json, rule_json, benefit_json,
                 effective_from, effective_to, budget_minor, used_minor, per_user_cap,
                 total_cap, daily_cap, stackable, priority, status, audit_note)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
               ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 match_json = EXCLUDED.match_json,
                 rule_json = EXCLUDED.rule_json,
                 benefit_json = EXCLUDED.benefit_json,
                 effective_to = EXCLUDED.effective_to,
                 budget_minor = EXCLUDED.budget_minor,
                 per_user_cap = EXCLUDED.per_user_cap,
                 total_cap = EXCLUDED.total_cap,
                 daily_cap = EXCLUDED.daily_cap,
                 stackable = EXCLUDED.stackable,
                 priority = EXCLUDED.priority,
                 status = EXCLUDED.status,
                 audit_note = EXCLUDED.audit_note"#,
        ).bind(&id).bind(&p.code).bind(&p.name).bind(p.kind)
         .bind(&p.match_json).bind(&p.rule_json).bind(&p.benefit_json)
         .bind(p.effective_from).bind(p.effective_to)
         .bind(p.budget_minor).bind(p.used_minor)
         .bind(p.per_user_cap).bind(p.total_cap).bind(p.daily_cap)
         .bind(p.stackable).bind(p.priority).bind(p.status).bind(&p.audit_note)
         .execute(&self.pool).await?;
        let out: Promotion = sqlx::query_as("SELECT * FROM promotion WHERE id=$1")
            .bind(&id).fetch_one(&self.pool).await?;
        Ok(out)
    }

    async fn pause(&self, id: &str, _admin_id: &str) -> Result<(), DomainError> {
        sqlx::query("UPDATE promotion SET status='paused' WHERE id=$1 AND status='active'")
            .bind(id).execute(&self.pool).await?;
        Ok(())
    }

    async fn resume(&self, id: &str, _admin_id: &str) -> Result<(), DomainError> {
        sqlx::query("UPDATE promotion SET status='active' WHERE id=$1 AND status='paused'")
            .bind(id).execute(&self.pool).await?;
        Ok(())
    }

    async fn end(&self, id: &str, _admin_id: &str) -> Result<(), DomainError> {
        sqlx::query("UPDATE promotion SET status='ended' WHERE id=$1 AND status IN ('active','paused','scheduled')")
            .bind(id).execute(&self.pool).await?;
        Ok(())
    }

    /// 派发优惠券 · `count` 张
    /// - 若 `owner_user_ids` 提供则一一对应分配,否则全部为 unowned(待领取)
    /// - 同事务写每张 CouponIssued outbox(精简:只写 1 条带 batch_id 的汇总事件)
    async fn issue_coupons(
        &self, promotion_id: &str, count: u32,
        owner_user_ids: Option<Vec<String>>,
        expires_at: DateTime<Utc>,
        admin_id: &str,
    ) -> Result<Vec<String>, DomainError> {
        let promo = sqlx::query("SELECT benefit_json, code FROM promotion WHERE id=$1 AND status IN ('active','scheduled')")
            .bind(promotion_id).fetch_optional(&self.pool).await?
            .ok_or_else(|| DomainError::NotFound(format!("promotion {promotion_id}")))?;
        let benefit: serde_json::Value = promo.try_get("benefit_json").unwrap_or_default();
        let prefix: String = promo.try_get::<Option<String>, _>("code").ok().flatten()
            .unwrap_or_else(|| "C".into());

        let batch_id = format!("batch-{}", Uuid::new_v4());
        let mut ids: Vec<String> = Vec::with_capacity(count as usize);
        let mut tx = self.pool.begin().await?;
        for i in 0..count {
            let cid = format!("cp-{}", Uuid::new_v4());
            let owner = owner_user_ids.as_ref().and_then(|v| v.get(i as usize).cloned());
            let code = format!("{prefix}-{}", Uuid::new_v4().simple().to_string().get(..8).unwrap_or("00000000"));
            sqlx::query(
                r#"INSERT INTO coupon(id, code, batch_id, promotion_id, owner_user_id,
                     benefit_json, state, expires_at)
                   VALUES ($1, $2, $3, $4, $5, $6, 'issued', $7)"#,
            ).bind(&cid).bind(&code).bind(&batch_id).bind(promotion_id)
             .bind(&owner).bind(&benefit).bind(expires_at)
             .execute(&mut *tx).await?;
            ids.push(cid.clone());
            outbox::write(&mut *tx, &DomainEvent::CouponIssued {
                coupon_id: cid, owner_user_id: owner, occurred_at: Utc::now(),
            }).await?;
        }
        let _ = admin_id;
        tx.commit().await?;
        Ok(ids)
    }

    async fn list_coupons_admin(
        &self, promotion_id: Option<&str>, state: Option<&str>, p: &ListParams,
    ) -> Result<Page<Coupon>, DomainError> {
        let off = p.page as i64 * p.page_size as i64;
        let lim = p.page_size.clamp(1, 200) as i64;
        let items: Vec<Coupon> = sqlx::query_as(
            r#"SELECT * FROM coupon
               WHERE ($1::text IS NULL OR promotion_id=$1)
                 AND ($2::text IS NULL OR state=$2)
               ORDER BY issued_at DESC OFFSET $3 LIMIT $4"#,
        ).bind(promotion_id).bind(state).bind(off).bind(lim)
         .fetch_all(&self.pool).await?;
        let total: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM coupon
               WHERE ($1::text IS NULL OR promotion_id=$1)
                 AND ($2::text IS NULL OR state=$2)"#,
        ).bind(promotion_id).bind(state).fetch_one(&self.pool).await?;
        Ok(Page { items, total, page: p.page, page_size: p.page_size })
    }

    /// 用户兑换 · code → 锁定到 user
    async fn redeem_coupon(&self, code: &str, user_id: &str) -> Result<Coupon, DomainError> {
        let mut tx = self.pool.begin().await?;
        let row = sqlx::query(
            r#"SELECT id, owner_user_id, state, expires_at FROM coupon
               WHERE code=$1 FOR UPDATE"#,
        ).bind(code).fetch_optional(&mut *tx).await?
         .ok_or_else(|| DomainError::NotFound(format!("coupon code {code}")))?;
        let coupon_id: String = row.try_get("id")?;
        let cur_str: String = row.try_get("state")?;
        let cur = CouponState::from_str_lax(&cur_str)
            .ok_or_else(|| DomainError::Internal(format!("unknown state {cur_str}")))?;
        if cur != CouponState::Issued {
            return Err(DomainError::Conflict(format!("coupon state={cur_str} 不可兑换")));
        }
        let owner: Option<String> = row.try_get::<Option<String>, _>("owner_user_id").ok().flatten();
        if let Some(o) = &owner {
            if o != user_id {
                return Err(DomainError::Conflict("coupon 已属于他人".into()));
            }
        }
        let expires: DateTime<Utc> = row.try_get("expires_at")?;
        if Utc::now() > expires {
            sqlx::query("UPDATE coupon SET state='expired' WHERE id=$1")
                .bind(&coupon_id).execute(&mut *tx).await?;
            return Err(DomainError::Conflict("coupon 已过期".into()));
        }

        sqlx::query(
            r#"UPDATE coupon SET state='locked', owner_user_id=COALESCE(owner_user_id, $1)
               WHERE id=$2"#,
        ).bind(user_id).bind(&coupon_id).execute(&mut *tx).await?;
        tx.commit().await?;
        let c: Coupon = sqlx::query_as("SELECT * FROM coupon WHERE id=$1")
            .bind(&coupon_id).fetch_one(&self.pool).await?;
        Ok(c)
    }
}

/// 后台 sweeper · 把过期 coupon 标 expired + 写 CouponExpired outbox
pub async fn sweep_expired_coupons(pool: &PgPool) -> Result<u64, DomainError> {
    let rows = sqlx::query(
        r#"UPDATE coupon SET state='expired'
           WHERE state='issued' AND expires_at < NOW()
           RETURNING id"#,
    ).fetch_all(pool).await?;
    let mut tx = pool.begin().await?;
    for r in &rows {
        let id: String = r.try_get("id")?;
        outbox::write(&mut *tx, &DomainEvent::CouponExpired {
            coupon_id: id, occurred_at: Utc::now(),
        }).await?;
    }
    tx.commit().await?;
    Ok(rows.len() as u64)
}
