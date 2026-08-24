//! Catalog 域 · Product / Sku

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::enums::{FulfillmentKind, ProductKind, ProductStatus, SkuStatus, StockKind};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: String,
    pub code: String,
    pub name: String,
    pub sub_title: Option<String>,
    pub category: String,
    pub kind: ProductKind,
    pub status: ProductStatus,
    pub description_md: String,
    pub hero_image_url: Option<String>,
    pub gallery_json: serde_json::Value,
    pub default_locale: String,
    pub available_locales: Vec<String>,
    pub available_regions: Vec<String>,
    pub available_platforms: Vec<String>,
    pub required_inputs: serde_json::Value,
    pub fulfillment_kind: FulfillmentKind,
    pub tags: Vec<String>,
    pub sort_weight: i32,
    pub audit_note: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sku {
    pub id: String,
    pub product_id: String,
    pub code: String,
    pub name: String,
    pub spec_json: serde_json::Value,
    pub stock_kind: StockKind,
    pub stock_count: Option<i32>,
    pub per_user_cap: Option<i32>,
    pub default_currency: String,
    pub weight_g: Option<i32>,
    pub status: SkuStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 用于列表 / 客户端展示的轻量视图(joined product + sku + 当前价)。
#[derive(Debug, Clone, Serialize)]
pub struct ProductWithSkus {
    pub product: Product,
    pub skus: Vec<SkuWithPrice>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkuWithPrice {
    pub sku: Sku,
    pub price_minor: i64,
    pub currency: String,
    pub price_display: String,
}
