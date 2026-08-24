//! Refund 域

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::enums::{RefundActor, RefundStatus};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Refund {
    pub id: String,
    pub order_id: String,
    pub payment_id: String,
    pub amount_minor: i64,
    pub currency: String,
    pub reason_code: String,
    pub reason_text: String,
    pub actor_kind: RefundActor,
    pub actor_id: Option<String>,
    pub status: RefundStatus,
    pub channel_refund_id: Option<String>,
    pub approved_at: Option<DateTime<Utc>>,
    pub approved_by_admin_id: Option<String>,
    pub processed_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub failure_code: Option<String>,
    pub failure_msg: Option<String>,
    pub audit_note: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
