//! PgSettlementService · `SettlementService` trait 的 sqlx 落地。
//!
//! 触发对账拉取走 adapter(由 route / worker 调);本 service 负责:
//! - 列出对账批次 / record
//! - 解决异常 record
//! - 关闭批次

use async_trait::async_trait;
use chrono::NaiveDate;
use sqlx::PgPool;

use crate::commerce::services::{
    ListParams, Page, SettlementService,
};
use crate::commerce::settlement::{ReconBatch, ReconRecord};
use crate::DomainError;

#[derive(Clone)]
pub struct PgSettlementService {
    pub pool: PgPool,
}

impl PgSettlementService {
    pub fn new(pool: PgPool) -> Self { Self { pool } }
}

#[async_trait]
impl SettlementService for PgSettlementService {
    async fn list_batches(&self, p: &ListParams) -> Result<Page<ReconBatch>, DomainError> {
        let off = p.page as i64 * p.page_size as i64;
        let lim = p.page_size.clamp(1, 200) as i64;
        let items: Vec<ReconBatch> = sqlx::query_as(
            r#"SELECT * FROM recon_batch
               WHERE ($1::text IS NULL OR status=$1)
               ORDER BY batch_date DESC OFFSET $2 LIMIT $3"#,
        ).bind(&p.status).bind(off).bind(lim)
         .fetch_all(&self.pool).await?;
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM recon_batch WHERE ($1::text IS NULL OR status=$1)",
        ).bind(&p.status).fetch_one(&self.pool).await?;
        Ok(Page { items, total, page: p.page, page_size: p.page_size })
    }

    async fn get_batch(&self, id: &str) -> Result<(ReconBatch, Vec<ReconRecord>), DomainError> {
        let batch: ReconBatch = sqlx::query_as("SELECT * FROM recon_batch WHERE id=$1")
            .bind(id).fetch_optional(&self.pool).await?
            .ok_or_else(|| DomainError::NotFound(format!("batch {id}")))?;
        let records: Vec<ReconRecord> = sqlx::query_as(
            "SELECT * FROM recon_record WHERE batch_id=$1 ORDER BY match_state, channel_txn_id",
        ).bind(id).fetch_all(&self.pool).await?;
        Ok((batch, records))
    }

    /// 触发对账拉取 · 此方法不调 adapter(route / worker 负责调用)
    /// 这里仅创建一个 pulled 状态的空 batch 占位,后续 route 用 adapter 拉到的 row 填 records
    async fn trigger_pull(&self, channel: &str, day: NaiveDate, _admin_id: &str) -> Result<ReconBatch, DomainError> {
        let exists: Option<String> = sqlx::query_scalar(
            "SELECT id FROM recon_batch WHERE channel=$1 AND batch_date=$2 AND source='channel_pulled' LIMIT 1",
        ).bind(channel).bind(day).fetch_optional(&self.pool).await?;
        if let Some(id) = exists {
            return sqlx::query_as::<_, ReconBatch>("SELECT * FROM recon_batch WHERE id=$1")
                .bind(&id).fetch_one(&self.pool).await
                .map_err(DomainError::from);
        }
        let id = format!("rb-{}", uuid::Uuid::new_v4());
        sqlx::query(
            r#"INSERT INTO recon_batch(id, channel, batch_date, source, total_count,
                 total_amount_minor, currency, status, pulled_at)
               VALUES ($1, $2, $3, 'channel_pulled', 0, 0, 'CNY', 'pulled', NOW())"#,
        ).bind(&id).bind(channel).bind(day).execute(&self.pool).await?;
        let batch: ReconBatch = sqlx::query_as("SELECT * FROM recon_batch WHERE id=$1")
            .bind(&id).fetch_one(&self.pool).await?;
        Ok(batch)
    }

    async fn resolve_record(&self, record_id: &str, action: &str, admin_id: &str) -> Result<(), DomainError> {
        sqlx::query(
            r#"UPDATE recon_record SET resolved_by_admin_id=$1, resolved_action=$2, resolved_at=NOW()
               WHERE id=$3"#,
        ).bind(admin_id).bind(action).bind(record_id).execute(&self.pool).await?;

        // 检查 batch 是否还有未解决项;若无 → batch.status=resolved
        let row = sqlx::query_scalar::<_, String>(
            "SELECT batch_id FROM recon_record WHERE id=$1",
        ).bind(record_id).fetch_optional(&self.pool).await?;
        if let Some(batch_id) = row {
            let unresolved: i64 = sqlx::query_scalar(
                r#"SELECT COUNT(*) FROM recon_record
                   WHERE batch_id=$1 AND match_state <> 'matched' AND resolved_at IS NULL"#,
            ).bind(&batch_id).fetch_one(&self.pool).await?;
            if unresolved == 0 {
                sqlx::query(
                    "UPDATE recon_batch SET status='resolved', resolved_at=NOW() WHERE id=$1 AND status='has_discrepancy'",
                ).bind(&batch_id).execute(&self.pool).await?;
            }
        }
        Ok(())
    }
}
