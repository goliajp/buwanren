//! Promotion 域 · Promotion / Coupon

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::enums::{CouponState, PromotionKind, PromotionStatus};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Promotion {
    pub id: String,
    pub code: Option<String>,
    pub name: String,
    pub kind: PromotionKind,
    pub match_json: serde_json::Value,
    pub rule_json: serde_json::Value,
    pub benefit_json: serde_json::Value,
    pub effective_from: DateTime<Utc>,
    pub effective_to: Option<DateTime<Utc>>,
    pub budget_minor: Option<i64>,
    pub used_minor: i64,
    pub per_user_cap: Option<i32>,
    pub total_cap: Option<i32>,
    pub daily_cap: Option<i32>,
    pub stackable: bool,
    pub priority: i32,
    pub status: PromotionStatus,
    pub audit_note: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Coupon {
    pub id: String,
    pub code: Option<String>,
    pub batch_id: Option<String>,
    pub promotion_id: Option<String>,
    pub owner_user_id: Option<String>,
    pub benefit_json: serde_json::Value,
    pub state: CouponState,
    pub locked_for_order_id: Option<String>,
    pub issued_at: DateTime<Utc>,
    pub redeemed_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
    pub audit_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CouponRedemption {
    pub id: String,
    pub coupon_id: String,
    pub order_id: String,
    pub applied_amount_minor: i64,
    pub applied_at: DateTime<Utc>,
}
