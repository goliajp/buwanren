//! PgFinanceService · `FinanceService` trait 的 sqlx 落地。
//!
//! 关键路径:
//! - [`post`] · 写复式分录(借/贷必须平衡)
//! - [`close_period`] · 期末关账
//! - [`monthly_report`] · 计算 KPI(收入/退款/物流毛利/运费/MRR/ARR/试算平衡)

use async_trait::async_trait;
use sqlx::{PgPool, Row};

use crate::commerce::events::DomainEvent;
use crate::commerce::finance::{
    AccountChart, AccountingPeriod, JournalEntry, JournalLine, TrialBalanceRow,
};
use crate::commerce::outbox;
use crate::commerce::services::{
    FinanceService, ListParams, MonthlyReport, Page,
};
use crate::DomainError;

#[derive(Clone)]
pub struct PgFinanceService {
    pub pool: PgPool,
}

impl PgFinanceService {
    pub fn new(pool: PgPool) -> Self { Self { pool } }
}

#[async_trait]
impl FinanceService for PgFinanceService {
    async fn list_periods(&self) -> Result<Vec<AccountingPeriod>, DomainError> {
        let rows: Vec<AccountingPeriod> = sqlx::query_as(
            "SELECT * FROM accounting_period ORDER BY year DESC, sub DESC, kind",
        ).fetch_all(&self.pool).await?;
        Ok(rows)
    }

    async fn list_entries(&self, period_id: &str, p: &ListParams) -> Result<Page<JournalEntry>, DomainError> {
        let off = p.page as i64 * p.page_size as i64;
        let lim = p.page_size.clamp(1, 200) as i64;
        let items: Vec<JournalEntry> = sqlx::query_as(
            r#"SELECT * FROM journal_entry
               WHERE period_id=$1
                 AND ($2::text IS NULL OR business_kind=$2)
               ORDER BY posted_at DESC OFFSET $3 LIMIT $4"#,
        ).bind(period_id).bind(&p.status).bind(off).bind(lim)
         .fetch_all(&self.pool).await?;
        let total: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM journal_entry
               WHERE period_id=$1 AND ($2::text IS NULL OR business_kind=$2)"#,
        ).bind(period_id).bind(&p.status).fetch_one(&self.pool).await?;
        Ok(Page { items, total, page: p.page, page_size: p.page_size })
    }

    async fn get_entry(&self, id: &str) -> Result<(JournalEntry, Vec<JournalLine>), DomainError> {
        let entry: JournalEntry = sqlx::query_as("SELECT * FROM journal_entry WHERE id=$1")
            .bind(id).fetch_optional(&self.pool).await?
            .ok_or_else(|| DomainError::NotFound(format!("entry {id}")))?;
        let lines: Vec<JournalLine> = sqlx::query_as(
            "SELECT * FROM journal_line WHERE entry_id=$1 ORDER BY line_no",
        ).bind(id).fetch_all(&self.pool).await?;
        Ok((entry, lines))
    }

    /// 写复式分录 · 借方合计 = 贷方合计(否则 IllegalStateTransition)。
    async fn post(&self, entry: JournalEntry, lines: Vec<JournalLine>) -> Result<(), DomainError> {
        if lines.is_empty() {
            return Err(DomainError::Validation("journal_line is empty".into()));
        }
        let sum_d: i64 = lines.iter().map(|l| l.debit_minor).sum();
        let sum_c: i64 = lines.iter().map(|l| l.credit_minor).sum();
        if sum_d != sum_c {
            return Err(DomainError::Validation(format!(
                "journal not balanced: debit={sum_d} credit={sum_c}"
            )));
        }

        // 校验期间 state='open'
        let p_state: Option<String> = sqlx::query_scalar(
            "SELECT state FROM accounting_period WHERE id=$1",
        ).bind(&entry.period_id).fetch_optional(&self.pool).await?;
        let p_state = p_state.ok_or_else(|| DomainError::NotFound(format!("period {}", entry.period_id)))?;
        if p_state != "open" {
            return Err(DomainError::Conflict(format!("period {} state={p_state}", entry.period_id)));
        }

        let mut tx = self.pool.begin().await?;
        sqlx::query(
            r#"INSERT INTO journal_entry(id, period_id, description, posted_at, posted_by_kind,
                 posted_by_id, business_kind, business_ref_id, is_reversal_of, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"#,
        ).bind(&entry.id).bind(&entry.period_id).bind(&entry.description)
         .bind(entry.posted_at).bind(entry.posted_by_kind).bind(&entry.posted_by_id)
         .bind(&entry.business_kind).bind(&entry.business_ref_id)
         .bind(&entry.is_reversal_of).bind(entry.status)
         .execute(&mut *tx).await?;
        for l in &lines {
            sqlx::query(
                r#"INSERT INTO journal_line(id, entry_id, line_no, account_code,
                     debit_minor, credit_minor, currency, ref_kind, ref_id, note)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"#,
            ).bind(&l.id).bind(&entry.id).bind(l.line_no).bind(&l.account_code)
             .bind(l.debit_minor).bind(l.credit_minor).bind(&l.currency)
             .bind(&l.ref_kind).bind(&l.ref_id).bind(&l.note)
             .execute(&mut *tx).await?;
        }
        outbox::write(&mut *tx, &DomainEvent::JournalPosted {
            entry_id: entry.id.clone(), occurred_at: chrono::Utc::now(),
        }).await?;
        tx.commit().await?;
        Ok(())
    }

    async fn reverse(&self, entry_id: &str, admin_id: &str) -> Result<(), DomainError> {
        let mut tx = self.pool.begin().await?;
        let orig = sqlx::query("SELECT period_id, description, business_kind, business_ref_id FROM journal_entry WHERE id=$1 FOR UPDATE")
            .bind(entry_id).fetch_optional(&mut *tx).await?
            .ok_or_else(|| DomainError::NotFound(format!("entry {entry_id}")))?;
        let lines: Vec<JournalLine> = sqlx::query_as(
            "SELECT * FROM journal_line WHERE entry_id=$1 ORDER BY line_no",
        ).bind(entry_id).fetch_all(&mut *tx).await?;

        sqlx::query("UPDATE journal_entry SET status='reversed' WHERE id=$1 AND status='posted'")
            .bind(entry_id).execute(&mut *tx).await?;

        let rev_id = format!("je-{}", uuid::Uuid::new_v4());
        let period_id: String = orig.try_get("period_id")?;
        let desc: String = orig.try_get("description")?;
        let bk: String = orig.try_get("business_kind")?;
        let bri: Option<String> = orig.try_get("business_ref_id")?;

        sqlx::query(
            r#"INSERT INTO journal_entry(id, period_id, description, posted_by_kind,
                 posted_by_id, business_kind, business_ref_id, is_reversal_of, status)
               VALUES ($1, $2, $3, 'admin', $4, $5, $6, $7, 'posted')"#,
        ).bind(&rev_id).bind(&period_id).bind(format!("冲销 {entry_id} · {desc}"))
         .bind(admin_id).bind(&bk).bind(&bri).bind(entry_id)
         .execute(&mut *tx).await?;

        for (idx, l) in lines.iter().enumerate() {
            sqlx::query(
                r#"INSERT INTO journal_line(id, entry_id, line_no, account_code,
                     debit_minor, credit_minor, currency, ref_kind, ref_id, note)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"#,
            ).bind(format!("jl-{}", uuid::Uuid::new_v4())).bind(&rev_id).bind((idx + 1) as i32)
             .bind(&l.account_code).bind(l.credit_minor).bind(l.debit_minor)
             .bind(&l.currency).bind(&l.ref_kind).bind(&l.ref_id)
             .bind(format!("(reverse) {}", l.note))
             .execute(&mut *tx).await?;
        }
        tx.commit().await?;
        Ok(())
    }

    async fn close_period(&self, period_id: &str, admin_id: &str) -> Result<(), DomainError> {
        sqlx::query(
            r#"UPDATE accounting_period SET state='closed', closed_at=NOW(),
                 closed_by_admin_id=$1 WHERE id=$2 AND state='open'"#,
        ).bind(admin_id).bind(period_id).execute(&self.pool).await?;
        Ok(())
    }

    async fn monthly_report(&self, period_id: &str) -> Result<MonthlyReport, DomainError> {
        // KPI
        let kpi: (i64, i64, i64, i64, i64) = sqlx::query_as(
            r#"SELECT
                COALESCE(SUM(CASE WHEN ac.code IN ('4001','4003') THEN jl.credit_minor - jl.debit_minor END), 0)::int8,
                COALESCE(SUM(CASE WHEN ac.code IN ('5001','5003') THEN jl.debit_minor - jl.credit_minor END), 0)::int8,
                COALESCE(SUM(CASE WHEN ac.code = '5001'           THEN jl.debit_minor - jl.credit_minor END), 0)::int8,
                COALESCE(SUM(CASE WHEN ac.code = '4002'           THEN jl.credit_minor - jl.debit_minor END), 0)::int8,
                COALESCE(SUM(CASE WHEN ac.code = '5002'           THEN jl.debit_minor - jl.credit_minor END), 0)::int8
              FROM journal_entry je
              JOIN journal_line jl  ON jl.entry_id = je.id
              JOIN account_chart ac ON ac.code = jl.account_code
              WHERE je.period_id=$1 AND je.status='posted'"#,
        ).bind(period_id).fetch_one(&self.pool).await
         .unwrap_or((0, 0, 0, 0, 0));

        // MRR/ARR(简化:取 active 订阅的 plan 期价合计)
        let mrr: i64 = sqlx::query_scalar(
            r#"SELECT COALESCE(SUM(
                 CASE p.billing_period
                   WHEN 'month'   THEN pb.price_minor
                   WHEN 'quarter' THEN pb.price_minor / 3
                   WHEN 'year'    THEN pb.price_minor / 12
                   ELSE 0 END
               ), 0)::int8
               FROM subscription s
               JOIN plan p ON p.id = s.plan_id
               JOIN price_book pb ON pb.sku_id = p.sku_id AND pb.status='active'
               WHERE s.status IN ('active','trialing')"#,
        ).fetch_one(&self.pool).await.unwrap_or(0);
        let arr = mrr * 12;

        // 试算平衡
        let tb_rows = sqlx::query(
            r#"SELECT ac.code, ac.name, ac.kind,
                      COALESCE(SUM(jl.debit_minor), 0)::int8 AS debit,
                      COALESCE(SUM(jl.credit_minor), 0)::int8 AS credit
               FROM account_chart ac
               LEFT JOIN journal_line jl ON jl.account_code = ac.code
               LEFT JOIN journal_entry je ON je.id = jl.entry_id
                 AND je.period_id=$1 AND je.status='posted'
               GROUP BY ac.code, ac.name, ac.kind
               ORDER BY ac.code"#,
        ).bind(period_id).fetch_all(&self.pool).await?;
        let trial_balance: Vec<TrialBalanceRow> = tb_rows.into_iter().map(|r| {
            let debit: i64 = r.try_get("debit").unwrap_or(0);
            let credit: i64 = r.try_get("credit").unwrap_or(0);
            TrialBalanceRow {
                account_code: r.try_get("code").unwrap_or_default(),
                account_name: r.try_get("name").unwrap_or_default(),
                account_kind: r.try_get("kind").unwrap_or(crate::commerce::enums::AccountKind::Asset),
                debit_minor: debit,
                credit_minor: credit,
                net_minor: debit - credit,
            }
        }).collect();

        Ok(MonthlyReport {
            period_id: period_id.to_string(),
            revenue_minor: kpi.0,
            refund_minor: kpi.1,
            channel_fee_minor: kpi.2,
            shipping_revenue_minor: kpi.3,
            shipping_cost_minor: kpi.4,
            mrr_minor: mrr,
            arr_minor: arr,
            trial_balance,
        })
    }
}

/// `AccountChart` 公开读 helper(给 routes / admin 使用 — 已存在 admin_api endpoint)
pub async fn list_accounts(pool: &PgPool) -> Result<Vec<AccountChart>, DomainError> {
    let rows: Vec<AccountChart> = sqlx::query_as(
        "SELECT * FROM account_chart ORDER BY code",
    ).fetch_all(pool).await?;
    Ok(rows)
}
