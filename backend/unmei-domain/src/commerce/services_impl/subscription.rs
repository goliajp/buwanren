//! PgSubscriptionService · `SubscriptionService` trait 的 sqlx 落地。
//!
//! 关键路径:
//! - [`start`] 创建 subscription · 试用期 / 立即激活按 plan.trial_days 决定
//! - [`cancel`] 期末取消 / 立即取消(状态机校验 + outbox)
//! - [`attempt_dunning`] 给到期 invoice 调用 adapter (mock 模式直接续费成功)+ 写 SubscriptionRenewed outbox

use async_trait::async_trait;
use chrono::{Duration as ChronoDuration, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::commerce::enums::{BillingPeriod, SubscriptionStatus};
use crate::commerce::events::DomainEvent;
use crate::commerce::outbox;
use crate::commerce::services::{
    Page, StartSubscriptionRequest, SubscriptionListFilter, SubscriptionService,
};
use crate::commerce::state_machine::StateTransition;
use crate::commerce::subscription::{Plan, Subscription};
use crate::DomainError;

#[derive(Clone)]
pub struct PgSubscriptionService {
    pub pool: PgPool,
}

impl PgSubscriptionService {
    pub fn new(pool: PgPool) -> Self { Self { pool } }
}

#[async_trait]
impl SubscriptionService for PgSubscriptionService {
    async fn list_plans(&self) -> Result<Vec<Plan>, DomainError> {
        let plans = sqlx::query_as::<_, Plan>(
            "SELECT * FROM plan WHERE status='active' ORDER BY created_at",
        ).fetch_all(&self.pool).await?;
        Ok(plans)
    }

    async fn start(&self, req: StartSubscriptionRequest) -> Result<Subscription, DomainError> {
        let plan: Plan = sqlx::query_as("SELECT * FROM plan WHERE id=$1 AND status='active'")
            .bind(&req.plan_id).fetch_optional(&self.pool).await?
            .ok_or_else(|| DomainError::NotFound(format!("plan {}", req.plan_id)))?;

        // 渠道约束
        if !plan.channel_constraints.is_empty()
            && !plan.channel_constraints.iter().any(|c| c == &req.channel) {
            return Err(DomainError::Validation(
                format!("plan {} 不支持渠道 {}", req.plan_id, req.channel),
            ));
        }

        let now = Utc::now();
        let initial_status = if plan.trial_days > 0 { "trialing" } else { "active" };
        let period_end = now + period_duration(plan.billing_period, plan.trial_days);

        let sub_id = format!("sub-{}", Uuid::new_v4());
        let mut tx = self.pool.begin().await?;
        sqlx::query(
            r#"INSERT INTO subscription(id, user_id, plan_id, status, source_channel,
                 current_period_start, current_period_end, next_billing_attempt_at,
                 cancel_at_period_end, prorate_credit_minor)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $7, FALSE, 0)"#,
        ).bind(&sub_id).bind(&req.user_id).bind(&req.plan_id).bind(initial_status)
         .bind(&req.channel).bind(now).bind(period_end)
         .execute(&mut *tx).await?;

        outbox::write(&mut *tx, &DomainEvent::SubscriptionStarted {
            subscription_id: sub_id.clone(),
            plan_id: req.plan_id.clone(),
            period_end,
            occurred_at: now,
        }).await?;
        tx.commit().await?;

        let sub: Subscription = sqlx::query_as("SELECT * FROM subscription WHERE id=$1")
            .bind(&sub_id).fetch_one(&self.pool).await?;
        Ok(sub)
    }

    async fn list_admin(&self, f: &SubscriptionListFilter) -> Result<Page<Subscription>, DomainError> {
        let off = f.page as i64 * f.page_size as i64;
        let lim = f.page_size.clamp(1, 200) as i64;
        let items: Vec<Subscription> = sqlx::query_as(
            r#"SELECT * FROM subscription
               WHERE ($1::text IS NULL OR status=$1)
                 AND ($2::text IS NULL OR plan_id=$2)
               ORDER BY created_at DESC OFFSET $3 LIMIT $4"#,
        ).bind(&f.status).bind(&f.plan_id).bind(off).bind(lim)
         .fetch_all(&self.pool).await?;
        let total: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM subscription
               WHERE ($1::text IS NULL OR status=$1) AND ($2::text IS NULL OR plan_id=$2)"#,
        ).bind(&f.status).bind(&f.plan_id).fetch_one(&self.pool).await?;
        Ok(Page { items, total, page: f.page, page_size: f.page_size })
    }

    async fn list_user(&self, user_id: &str) -> Result<Vec<Subscription>, DomainError> {
        let subs: Vec<Subscription> = sqlx::query_as(
            "SELECT * FROM subscription WHERE user_id=$1 ORDER BY created_at DESC",
        ).bind(user_id).fetch_all(&self.pool).await?;
        Ok(subs)
    }

    async fn cancel(&self, id: &str, immediate: bool, actor: &str) -> Result<(), DomainError> {
        let mut tx = self.pool.begin().await?;
        let cur_str: Option<String> = sqlx::query_scalar(
            "SELECT status FROM subscription WHERE id=$1 FOR UPDATE",
        ).bind(id).fetch_optional(&mut *tx).await?;
        let cur_str = cur_str.ok_or_else(|| DomainError::NotFound(format!("subscription {id}")))?;
        let cur = SubscriptionStatus::from_str_lax(&cur_str)
            .ok_or_else(|| DomainError::Internal(format!("unknown status {cur_str}")))?;
        cur.assert_transition(SubscriptionStatus::Cancelled)?;

        if immediate {
            sqlx::query(
                "UPDATE subscription SET status='cancelled', cancelled_at=NOW(),
                 next_billing_attempt_at=NULL WHERE id=$1",
            ).bind(id).execute(&mut *tx).await?;
            outbox::write(&mut *tx, &DomainEvent::SubscriptionCancelled {
                subscription_id: id.into(), occurred_at: Utc::now(),
            }).await?;
        } else {
            sqlx::query(
                "UPDATE subscription SET cancel_at_period_end=TRUE WHERE id=$1",
            ).bind(id).execute(&mut *tx).await?;
        }
        let _ = actor;
        tx.commit().await?;
        Ok(())
    }

    async fn resume(&self, id: &str, _actor: &str) -> Result<(), DomainError> {
        sqlx::query("UPDATE subscription SET cancel_at_period_end=FALSE WHERE id=$1")
            .bind(id).execute(&self.pool).await?;
        Ok(())
    }

    async fn refund_full_cycle(&self, id: &str, admin_id: &str) -> Result<(), DomainError> {
        // 标记本期 invoice = uncollectible + 写 audit_note
        sqlx::query(
            "UPDATE subscription_invoice SET status='uncollectible' WHERE subscription_id=$1 AND status='paid'",
        ).bind(id).execute(&self.pool).await?;
        sqlx::query(
            "UPDATE subscription SET status='cancelled', cancelled_at=NOW() WHERE id=$1",
        ).bind(id).execute(&self.pool).await?;
        let _ = (admin_id, id); // 调用方负责 audit_log
        Ok(())
    }

    /// dunning sweeper · 由 worker 调用,扫到期 subscription 走续费(mock 模式直接成功)。
    async fn attempt_dunning(&self) -> Result<u64, DomainError> {
        let rows = sqlx::query(
            r#"SELECT s.id, p.billing_period
               FROM subscription s JOIN plan p ON p.id = s.plan_id
               WHERE s.status IN ('active','past_due','trialing')
                 AND s.next_billing_attempt_at IS NOT NULL
                 AND s.next_billing_attempt_at <= NOW()
               LIMIT 50"#,
        ).fetch_all(&self.pool).await?;
        let mut processed = 0u64;
        for r in rows {
            let sid: String = r.try_get("id")?;
            let bp_str: String = r.try_get("billing_period")?;
            let bp = BillingPeriod::from_str_lax(&bp_str)
                .ok_or_else(|| DomainError::Internal(format!("unknown billing_period {bp_str}")))?;
            let now = Utc::now();
            let next_end = now + period_duration(bp, 0);

            let mut tx = self.pool.begin().await?;
            sqlx::query(
                r#"UPDATE subscription SET status='active',
                     current_period_start=$1, current_period_end=$2,
                     next_billing_attempt_at=$2 WHERE id=$3"#,
            ).bind(now).bind(next_end).bind(&sid).execute(&mut *tx).await?;
            outbox::write(&mut *tx, &DomainEvent::SubscriptionRenewed {
                subscription_id: sid.clone(), period_end: next_end, occurred_at: now,
            }).await?;
            tx.commit().await?;
            processed += 1;
        }
        Ok(processed)
    }
}

fn period_duration(period: BillingPeriod, trial_days: i32) -> ChronoDuration {
    let base = match period {
        BillingPeriod::Month    => ChronoDuration::days(30),
        BillingPeriod::Quarter  => ChronoDuration::days(90),
        BillingPeriod::Year     => ChronoDuration::days(365),
        BillingPeriod::Lifetime => ChronoDuration::days(365 * 100),
    };
    base + ChronoDuration::days(trial_days as i64)
}
