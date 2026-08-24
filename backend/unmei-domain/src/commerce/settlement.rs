//! Settlement 域

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use super::enums::{ReconBatchStatus, ReconRecordState, ReconSource};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconBatch {
    pub id: String,
    pub channel: String,
    pub batch_date: NaiveDate,
    pub source: ReconSource,
    pub total_count: i32,
    pub total_amount_minor: i64,
    pub currency: String,
    pub status: ReconBatchStatus,
    pub pulled_at: DateTime<Utc>,
    pub matched_at: Option<DateTime<Utc>>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub raw_file_uri: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconRecord {
    pub id: String,
    pub batch_id: String,
    pub channel_txn_id: Option<String>,
    pub channel_amount_minor: Option<i64>,
    pub channel_status: Option<String>,
    pub matched_payment_id: Option<String>,
    pub match_state: ReconRecordState,
    pub resolved_by_admin_id: Option<String>,
    pub resolved_action: Option<String>,
    pub resolved_at: Option<DateTime<Utc>>,
}
