//! Finance 域 · 复式记账

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::enums::{
    AccountKind, JournalEntryStatus, JournalPostedBy, PeriodKind, PeriodState,
};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AccountChart {
    pub code: String,
    pub name: String,
    pub kind: AccountKind,
    pub parent_code: Option<String>,
    pub currency_constraint: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AccountingPeriod {
    pub id: String,
    pub kind: PeriodKind,
    pub year: i32,
    pub sub: i32,
    pub state: PeriodState,
    pub opened_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
    pub closed_by_admin_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct JournalEntry {
    pub id: String,
    pub period_id: String,
    pub description: String,
    pub posted_at: DateTime<Utc>,
    pub posted_by_kind: JournalPostedBy,
    pub posted_by_id: Option<String>,
    pub business_kind: String,
    pub business_ref_id: Option<String>,
    pub is_reversal_of: Option<String>,
    pub status: JournalEntryStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct JournalLine {
    pub id: String,
    pub entry_id: String,
    pub line_no: i32,
    pub account_code: String,
    pub debit_minor: i64,
    pub credit_minor: i64,
    pub currency: String,
    pub ref_kind: Option<String>,
    pub ref_id: Option<String>,
    pub note: String,
}

/// 试算平衡视图(科目 → 借方 / 贷方 / 净额)。
#[derive(Debug, Clone, Serialize)]
pub struct TrialBalanceRow {
    pub account_code: String,
    pub account_name: String,
    pub account_kind: AccountKind,
    pub debit_minor: i64,
    pub credit_minor: i64,
    pub net_minor: i64,
}
