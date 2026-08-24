//! Subscription 域 · Plan / Subscription / SubscriptionInvoice

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::enums::{
    BillingPeriod, CancelPolicy, InvoiceStatus, PlanStatus, SubscriptionStatus,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plan {
    pub id: String,
    pub sku_id: String,
    pub name: String,
    pub billing_period: BillingPeriod,
    pub trial_days: i32,
    pub grace_days: i32,
    pub entitlements_json: serde_json::Value,
    pub cancel_policy: CancelPolicy,
    pub prorate_on_upgrade: bool,
    pub channel_constraints: Vec<String>,
    pub status: PlanStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub id: String,
    pub user_id: String,
    pub plan_id: String,
    pub status: SubscriptionStatus,
    pub source_channel: String,
    pub source_payment_id: Option<String>,
    pub current_period_start: DateTime<Utc>,
    pub current_period_end: DateTime<Utc>,
    pub next_billing_attempt_at: Option<DateTime<Utc>>,
    pub cancel_at_period_end: bool,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub upgrade_from_subscription_id: Option<String>,
    pub prorate_credit_minor: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionInvoice {
    pub id: String,
    pub subscription_id: String,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub amount_minor: i64,
    pub currency: String,
    pub status: InvoiceStatus,
    pub payment_id: Option<String>,
    pub attempt_count: i32,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub next_attempt_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}
