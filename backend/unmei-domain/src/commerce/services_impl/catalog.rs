//! PgCatalogService · `CatalogService` trait 的 sqlx 落地。
//!
//! 提供:
//! - 公开 / 后台商品列表
//! - 商品详情(含当前价 quote 后的 SKU 列表)
//! - SKU 增删改
//! - [`quote`] · 给上下文返回最终价(简化版 — 不接 PromotionService,只看 PriceBook + PriceRule)

use async_trait::async_trait;
use sqlx::{PgPool, Row};

use crate::commerce::pricing::QuoteResult;
use crate::commerce::product::{Product, ProductWithSkus, Sku, SkuWithPrice};
use crate::commerce::services::{
    CatalogService, Page, ProductListFilter, QuoteContext,
};
use crate::DomainError;

#[derive(Clone)]
pub struct PgCatalogService {
    pub pool: PgPool,
}

impl PgCatalogService {
    pub fn new(pool: PgPool) -> Self { Self { pool } }
}

#[async_trait]
impl CatalogService for PgCatalogService {
    async fn list_admin(&self, f: &ProductListFilter) -> Result<Page<Product>, DomainError> {
        let off = f.page as i64 * f.page_size as i64;
        let lim = f.page_size.clamp(1, 200) as i64;
        let kw_like = f.keyword.as_ref().map(|k| format!("%{k}%"));
        let items: Vec<Product> = sqlx::query_as(
            r#"SELECT * FROM product
               WHERE ($1::text IS NULL OR status=$1)
                 AND ($2::text IS NULL OR kind=$2)
                 AND ($3::text IS NULL OR category=$3)
                 AND ($4::text IS NULL OR name ILIKE $4 OR code ILIKE $4)
               ORDER BY sort_weight DESC, created_at DESC OFFSET $5 LIMIT $6"#,
        ).bind(&f.status).bind(&f.kind).bind(&f.category).bind(&kw_like)
         .bind(off).bind(lim).fetch_all(&self.pool).await?;
        let total: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM product
               WHERE ($1::text IS NULL OR status=$1)
                 AND ($2::text IS NULL OR kind=$2)
                 AND ($3::text IS NULL OR category=$3)
                 AND ($4::text IS NULL OR name ILIKE $4 OR code ILIKE $4)"#,
        ).bind(&f.status).bind(&f.kind).bind(&f.category).bind(&kw_like)
         .fetch_one(&self.pool).await?;
        Ok(Page { items, total, page: f.page, page_size: f.page_size })
    }

    async fn list_public(&self, region: &str, platform: &str) -> Result<Vec<ProductWithSkus>, DomainError> {
        let products: Vec<Product> = sqlx::query_as(
            r#"SELECT * FROM product
               WHERE status='listed'
                 AND $1 = ANY(available_regions)
                 AND ($2 = 'all' OR $2 = ANY(available_platforms))
               ORDER BY sort_weight DESC, created_at DESC"#,
        ).bind(region).bind(platform).fetch_all(&self.pool).await?;
        let mut out = Vec::with_capacity(products.len());
        for product in products {
            let skus: Vec<sqlx::postgres::PgRow> = sqlx::query(
                r#"SELECT s.id, s.product_id, s.code, s.name, s.spec_json, s.stock_kind,
                          s.stock_count, s.per_user_cap, s.default_currency, s.weight_g, s.status,
                          s.created_at, s.updated_at,
                          pb.price_minor, pb.currency
                   FROM sku s
                   LEFT JOIN LATERAL (
                     SELECT price_minor, currency FROM price_book
                     WHERE sku_id = s.id AND status='active'
                       AND (region = $1 OR region = 'global')
                       AND (platform = $2 OR platform = 'all')
                       AND effective_from <= NOW()
                       AND (effective_to IS NULL OR effective_to > NOW())
                     ORDER BY effective_from DESC LIMIT 1
                   ) pb ON TRUE
                   WHERE s.product_id=$3 AND s.status='active'
                   ORDER BY s.created_at"#,
            ).bind(region).bind(platform).bind(&product.id)
             .fetch_all(&self.pool).await?;

            let with_prices: Vec<SkuWithPrice> = skus.into_iter().filter_map(|row| {
                let pm: Option<i64> = row.try_get("price_minor").ok().flatten();
                let cur: String = row.try_get("currency").unwrap_or_else(|_| "CNY".into());
                let pm = pm?;
                let sku = Sku {
                    id: row.try_get("id").ok()?,
                    product_id: row.try_get("product_id").ok()?,
                    code: row.try_get("code").ok()?,
                    name: row.try_get("name").ok()?,
                    spec_json: row.try_get("spec_json").unwrap_or_default(),
                    stock_kind: row.try_get("stock_kind").ok()?,
                    stock_count: row.try_get("stock_count").ok().flatten(),
                    per_user_cap: row.try_get("per_user_cap").ok().flatten(),
                    default_currency: row.try_get("default_currency").unwrap_or_else(|_| "CNY".into()),
                    weight_g: row.try_get("weight_g").ok().flatten(),
                    status: row.try_get("status").ok()?,
                    created_at: row.try_get("created_at").ok()?,
                    updated_at: row.try_get("updated_at").ok()?,
                };
                let price_display = format_price(pm, &cur);
                Some(SkuWithPrice { sku, price_minor: pm, currency: cur, price_display })
            }).collect();
            out.push(ProductWithSkus { product, skus: with_prices });
        }
        Ok(out)
    }

    async fn get(&self, id: &str) -> Result<(Product, Vec<Sku>), DomainError> {
        let product: Product = sqlx::query_as("SELECT * FROM product WHERE id=$1")
            .bind(id).fetch_optional(&self.pool).await?
            .ok_or_else(|| DomainError::NotFound(format!("product {id}")))?;
        let skus: Vec<Sku> = sqlx::query_as(
            "SELECT * FROM sku WHERE product_id=$1 ORDER BY created_at",
        ).bind(id).fetch_all(&self.pool).await?;
        Ok((product, skus))
    }

    async fn upsert_product(&self, p: Product, _admin_id: &str) -> Result<Product, DomainError> {
        sqlx::query(
            r#"INSERT INTO product(id, code, name, sub_title, category, kind, status,
                 description_md, hero_image_url, gallery_json, default_locale,
                 available_locales, available_regions, available_platforms,
                 required_inputs, fulfillment_kind, tags, sort_weight, audit_note)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
               ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 sub_title = EXCLUDED.sub_title,
                 category = EXCLUDED.category,
                 status = EXCLUDED.status,
                 description_md = EXCLUDED.description_md,
                 hero_image_url = EXCLUDED.hero_image_url,
                 gallery_json = EXCLUDED.gallery_json,
                 available_locales = EXCLUDED.available_locales,
                 available_regions = EXCLUDED.available_regions,
                 available_platforms = EXCLUDED.available_platforms,
                 required_inputs = EXCLUDED.required_inputs,
                 fulfillment_kind = EXCLUDED.fulfillment_kind,
                 tags = EXCLUDED.tags,
                 sort_weight = EXCLUDED.sort_weight,
                 audit_note = EXCLUDED.audit_note"#,
        ).bind(&p.id).bind(&p.code).bind(&p.name).bind(&p.sub_title)
         .bind(&p.category).bind(p.kind).bind(p.status).bind(&p.description_md)
         .bind(&p.hero_image_url).bind(&p.gallery_json).bind(&p.default_locale)
         .bind(&p.available_locales).bind(&p.available_regions).bind(&p.available_platforms)
         .bind(&p.required_inputs).bind(p.fulfillment_kind).bind(&p.tags)
         .bind(p.sort_weight).bind(&p.audit_note)
         .execute(&self.pool).await?;
        let out: Product = sqlx::query_as("SELECT * FROM product WHERE id=$1")
            .bind(&p.id).fetch_one(&self.pool).await?;
        Ok(out)
    }

    async fn upsert_sku(&self, sku: Sku, _admin_id: &str) -> Result<Sku, DomainError> {
        sqlx::query(
            r#"INSERT INTO sku(id, product_id, code, name, spec_json, stock_kind,
                 stock_count, per_user_cap, default_currency, weight_g, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 spec_json = EXCLUDED.spec_json,
                 stock_kind = EXCLUDED.stock_kind,
                 stock_count = EXCLUDED.stock_count,
                 per_user_cap = EXCLUDED.per_user_cap,
                 weight_g = EXCLUDED.weight_g,
                 status = EXCLUDED.status"#,
        ).bind(&sku.id).bind(&sku.product_id).bind(&sku.code).bind(&sku.name)
         .bind(&sku.spec_json).bind(sku.stock_kind)
         .bind(sku.stock_count).bind(sku.per_user_cap).bind(&sku.default_currency)
         .bind(sku.weight_g).bind(sku.status)
         .execute(&self.pool).await?;
        let out: Sku = sqlx::query_as("SELECT * FROM sku WHERE id=$1")
            .bind(&sku.id).fetch_one(&self.pool).await?;
        Ok(out)
    }

    async fn delist(&self, id: &str, admin_id: &str) -> Result<(), DomainError> {
        sqlx::query(
            "UPDATE product SET status='delisted', audit_note = audit_note || E'\\n' || $1 WHERE id=$2",
        ).bind(format!("admin {admin_id} delist")).bind(id)
         .execute(&self.pool).await?;
        Ok(())
    }

    /// 简化 quote · 不接 PromotionService(留 v1 接入)。
    /// 流程:
    ///   1. 选当前激活的 price_book(by sku_id × region × platform × NOW)
    ///   2. 扫 price_rule(scope_sku_ids 覆盖 + match_json 简化匹配 user_tier)
    ///      按 priority 倒序应用第一条覆盖 / 折扣
    async fn quote(&self, sku_id: &str, ctx: &QuoteContext) -> Result<QuoteResult, DomainError> {
        let pb = sqlx::query(
            r#"SELECT id, price_minor, currency FROM price_book
               WHERE sku_id=$1 AND status='active'
                 AND (region = $2 OR region = 'global')
                 AND (platform = $3 OR platform = 'all')
                 AND effective_from <= NOW()
                 AND (effective_to IS NULL OR effective_to > NOW())
               ORDER BY (region = $2) DESC, (platform = $3) DESC, effective_from DESC
               LIMIT 1"#,
        ).bind(sku_id).bind(&ctx.region).bind(&ctx.platform)
         .fetch_optional(&self.pool).await?
         .ok_or_else(|| DomainError::Insufficient(format!("sku {sku_id} 无激活定价")))?;
        let pb_id: String = pb.try_get("id")?;
        let base: i64 = pb.try_get("price_minor")?;
        let currency: String = pb.try_get("currency")?;

        let mut final_price = base * ctx.qty as i64;
        let rules = sqlx::query(
            r#"SELECT id, override_price_minor, override_pct_bps, scope_sku_ids
               FROM price_rule
               WHERE status='active'
                 AND effective_from <= NOW()
                 AND (effective_to IS NULL OR effective_to > NOW())
               ORDER BY priority DESC"#,
        ).fetch_all(&self.pool).await?;

        let mut applied_rule_ids: Vec<String> = Vec::new();
        for r in rules {
            let scope: Vec<String> = r.try_get("scope_sku_ids").unwrap_or_default();
            if !scope.is_empty() && !scope.iter().any(|s| s == sku_id) { continue; }
            let id: String = r.try_get("id")?;
            if let Some(price) = r.try_get::<Option<i64>, _>("override_price_minor").ok().flatten() {
                final_price = price * ctx.qty as i64;
                applied_rule_ids.push(id);
                break; // 直接覆盖即停
            }
            if let Some(bps) = r.try_get::<Option<i32>, _>("override_pct_bps").ok().flatten() {
                final_price = (final_price * bps as i64) / 10000;
                applied_rule_ids.push(id);
            }
        }
        Ok(QuoteResult {
            sku_id: sku_id.to_string(),
            base_minor: base * ctx.qty as i64,
            final_minor: final_price,
            currency,
            applied_rule_ids,
            base_price_book_id: pb_id,
        })
    }
}

fn format_price(minor: i64, currency: &str) -> String {
    let decimals = if currency == "JPY" || currency == "TWD" { 0 } else { 2 };
    if decimals == 0 {
        format!("¥{minor}")
    } else {
        let pow = 10_i64.pow(decimals);
        let main = minor / pow;
        let frac = minor.abs() % pow;
        let sym = match currency {
            "CNY" => "¥", "USD" => "$", "HKD" => "HK$", "EUR" => "€",
            "GBP" => "£", "SGD" => "S$", _ => "",
        };
        format!("{sym}{main}.{:0width$}", frac, width = decimals as usize)
    }
}
