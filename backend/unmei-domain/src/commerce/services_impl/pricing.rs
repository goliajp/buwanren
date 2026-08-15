//! PgPricingService · `PricingService` trait 的 sqlx 落地。

use async_trait::async_trait;
use sqlx::PgPool;

use crate::commerce::pricing::{PriceBook, PriceRule};
use crate::commerce::services::PricingService;
use crate::DomainError;

#[derive(Clone)]
pub struct PgPricingService {
    pub pool: PgPool,
}

impl PgPricingService {
    pub fn new(pool: PgPool) -> Self { Self { pool } }
}

#[async_trait]
impl PricingService for PgPricingService {
    async fn list_for_sku(&self, sku_id: &str) -> Result<Vec<PriceBook>, DomainError> {
        let rows: Vec<PriceBook> = sqlx::query_as(
            "SELECT * FROM price_book WHERE sku_id=$1 ORDER BY effective_from DESC",
        ).bind(sku_id).fetch_all(&self.pool).await?;
        Ok(rows)
    }

    async fn publish(&self, pb: PriceBook, admin_id: &str) -> Result<PriceBook, DomainError> {
        // 自动把同 (sku, region, platform) 的 active 改 expired
        let mut tx = self.pool.begin().await?;
        sqlx::query(
            r#"UPDATE price_book SET status='expired', effective_to=NOW()
               WHERE sku_id=$1 AND region=$2 AND platform=$3 AND status='active'"#,
        ).bind(&pb.sku_id).bind(&pb.region).bind(&pb.platform).execute(&mut *tx).await?;

        let id = if pb.id.is_empty() { format!("pb-{}", uuid::Uuid::new_v4()) } else { pb.id.clone() };
        sqlx::query(
            r#"INSERT INTO price_book(id, sku_id, currency, price_minor, region, platform,
                 effective_from, effective_to, tier_kind, tier_json, status, audit_note, created_by_admin_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11, $12)"#,
        ).bind(&id).bind(&pb.sku_id).bind(&pb.currency).bind(pb.price_minor)
         .bind(&pb.region).bind(&pb.platform).bind(pb.effective_from).bind(pb.effective_to)
         .bind(pb.tier_kind).bind(&pb.tier_json).bind(&pb.audit_note)
         .bind(admin_id).execute(&mut *tx).await?;
        tx.commit().await?;

        let out: PriceBook = sqlx::query_as("SELECT * FROM price_book WHERE id=$1")
            .bind(&id).fetch_one(&self.pool).await?;
        Ok(out)
    }

    async fn expire(&self, id: &str, _admin_id: &str) -> Result<(), DomainError> {
        sqlx::query(
            "UPDATE price_book SET status='expired', effective_to=NOW() WHERE id=$1",
        ).bind(id).execute(&self.pool).await?;
        Ok(())
    }

    async fn list_rules(&self) -> Result<Vec<PriceRule>, DomainError> {
        let rows: Vec<PriceRule> = sqlx::query_as(
            "SELECT * FROM price_rule ORDER BY status='active' DESC, priority DESC",
        ).fetch_all(&self.pool).await?;
        Ok(rows)
    }

    async fn upsert_rule(&self, r: PriceRule, _admin_id: &str) -> Result<PriceRule, DomainError> {
        let id = if r.id.is_empty() { format!("pr-{}", uuid::Uuid::new_v4()) } else { r.id.clone() };
        sqlx::query(
            r#"INSERT INTO price_rule(id, name, scope_sku_ids, match_json,
                 override_price_minor, override_pct_bps,
                 effective_from, effective_to, priority, status, audit_note)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 scope_sku_ids = EXCLUDED.scope_sku_ids,
                 match_json = EXCLUDED.match_json,
                 override_price_minor = EXCLUDED.override_price_minor,
                 override_pct_bps = EXCLUDED.override_pct_bps,
                 effective_to = EXCLUDED.effective_to,
                 priority = EXCLUDED.priority,
                 status = EXCLUDED.status"#,
        ).bind(&id).bind(&r.name).bind(&r.scope_sku_ids).bind(&r.match_json)
         .bind(r.override_price_minor).bind(r.override_pct_bps)
         .bind(r.effective_from).bind(r.effective_to).bind(r.priority)
         .bind(r.status).bind(&r.audit_note)
         .execute(&self.pool).await?;
        let out: PriceRule = sqlx::query_as("SELECT * FROM price_rule WHERE id=$1")
            .bind(&id).fetch_one(&self.pool).await?;
        Ok(out)
    }
}
