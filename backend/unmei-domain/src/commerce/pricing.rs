//! Pricing 域 · PriceBook / PriceRule

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::enums::{PriceStatus, PriceTierKind};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PriceBook {
    pub id: String,
    pub sku_id: String,
    pub currency: String,
    pub price_minor: i64,
    pub region: String,
    pub platform: String,
    pub effective_from: DateTime<Utc>,
    pub effective_to: Option<DateTime<Utc>>,
    pub tier_kind: PriceTierKind,
    pub tier_json: serde_json::Value,
    pub status: PriceStatus,
    pub audit_note: String,
    pub created_by_admin_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PriceRule {
    pub id: String,
    pub name: String,
    pub scope_sku_ids: Vec<String>,
    pub match_json: serde_json::Value,
    pub override_price_minor: Option<i64>,
    pub override_pct_bps: Option<i32>,
    pub effective_from: DateTime<Utc>,
    pub effective_to: Option<DateTime<Utc>>,
    pub priority: i32,
    pub status: PriceStatus,
    pub audit_note: String,
    pub created_at: DateTime<Utc>,
}

/// 给一个上下文,返回应用的最终价格 + 命中的 rule chain(审计 / 调试用)。
#[derive(Debug, Clone, Serialize)]
pub struct QuoteResult {
    pub sku_id: String,
    pub base_minor: i64,
    pub final_minor: i64,
    pub currency: String,
    pub applied_rule_ids: Vec<String>,
    pub base_price_book_id: String,
}
