//! Payment 域

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::enums::PaymentStatus;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Payment {
    pub id: String,
    pub order_id: String,
    pub user_id: String,
    pub channel: String,
    pub amount_minor: i64,
    pub currency: String,
    pub status: PaymentStatus,
    pub channel_txn_id: Option<String>,
    pub channel_user_ref: Option<String>,
    pub paid_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub failure_code: Option<String>,
    pub failure_msg: Option<String>,
    pub metadata_json: serde_json::Value,
    pub audit_note: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PaymentAttempt {
    pub id: String,
    pub payment_id: String,
    pub attempt_no: i32,
    pub request_payload_json: serde_json::Value,
    pub response_payload_json: serde_json::Value,
    pub latency_ms: Option<i32>,
    pub error_kind: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PaymentEvent {
    pub id: String,
    pub payment_id: String,
    pub kind: String,
    pub channel: String,
    pub channel_event_id: Option<String>,
    pub payload_json: serde_json::Value,
    pub received_at: DateTime<Utc>,
    pub processed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PaymentDetail {
    pub payment: Payment,
    pub attempts: Vec<PaymentAttempt>,
    pub events: Vec<PaymentEvent>,
}
