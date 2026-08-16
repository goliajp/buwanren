//! 商品与定价用例。

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use unmei_domain::commerce::enums::ProductStatus;
use unmei_domain::DomainError;

use crate::{new_id, Actor};

/// 上下架。状态取值由 domain 的 [`ProductStatus`] 判定 ——
/// 旧实现在路由里手抄了一份字符串白名单,枚举加一个值就漏。
pub async fn set_product_status(
    pool: &PgPool,
    product_id: &str,
    status: &str,
    actor: &Actor,
) -> Result<ProductStatus, DomainError> {
    let status = ProductStatus::from_str_lax(status)
        .ok_or_else(|| DomainError::Validation(format!("unknown product status {status}")))?;

    let affected = sqlx::query(
        "UPDATE product SET status=$1, audit_note = audit_note || E'\\n' || $2 WHERE id=$3",
    )
    .bind(status.as_str())
    .bind(format!("{} → {}", actor.label(), status.as_str()))
    .bind(product_id)
    .execute(pool)
    .await?
    .rows_affected();

    if affected == 0 {
        return Err(DomainError::NotFound(format!("product {product_id}")));
    }
    Ok(status)
}

#[derive(Debug, Clone)]
pub struct NewPrice {
    pub currency: String,
    pub price_minor: i64,
    pub region: String,
    pub platform: String,
    pub effective_from: Option<DateTime<Utc>>,
    pub audit_note: Option<String>,
}

/// 发布一条新价。
pub async fn publish_price(
    pool: &PgPool,
    sku_id: &str,
    p: NewPrice,
    actor: &Actor,
) -> Result<String, DomainError> {
    if p.price_minor < 0 {
        return Err(DomainError::Validation(format!("price_minor {} < 0", p.price_minor)));
    }
    // 旧实现不校验 SKU 是否存在,能给不存在的 SKU 发价 —— 挂在外键上才发现,
    // 报出来的是一条 db error 而不是 404。
    let exists: Option<String> = sqlx::query_scalar("SELECT id FROM sku WHERE id=$1")
        .bind(sku_id)
        .fetch_optional(pool)
        .await?;
    if exists.is_none() {
        return Err(DomainError::NotFound(format!("sku {sku_id}")));
    }

    let id = new_id("pb");
    sqlx::query(
        r#"INSERT INTO price_book(id, sku_id, currency, price_minor, region, platform,
                                  effective_from, status, audit_note, created_by_admin_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9)"#,
    )
    .bind(&id)
    .bind(sku_id)
    .bind(&p.currency)
    .bind(p.price_minor)
    .bind(&p.region)
    .bind(&p.platform)
    .bind(p.effective_from.unwrap_or_else(Utc::now))
    .bind(p.audit_note.unwrap_or_default())
    .bind(actor.id.as_deref())
    .execute(pool)
    .await?;
    Ok(id)
}

/// 让一条价立即失效。
pub async fn expire_price(pool: &PgPool, price_id: &str) -> Result<(), DomainError> {
    let affected = sqlx::query(
        "UPDATE price_book SET status='expired', effective_to=NOW() WHERE id=$1",
    )
    .bind(price_id)
    .execute(pool)
    .await?
    .rows_affected();

    if affected == 0 {
        return Err(DomainError::NotFound(format!("price_book {price_id}")));
    }
    Ok(())
}
