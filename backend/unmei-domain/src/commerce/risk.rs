//! Risk 域 · 规则引擎 + 案件

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::enums::{RiskAction, RiskCaseSeverity, RiskCaseState, RiskKind, RiskRuleStatus};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RiskRule {
    pub id: String,
    pub name: String,
    pub kind: RiskKind,
    pub expression: String,
    pub action: RiskAction,
    pub priority: i32,
    pub status: RiskRuleStatus,
    pub effective_from: DateTime<Utc>,
    pub effective_to: Option<DateTime<Utc>>,
    pub audit_note: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RiskEvent {
    pub id: String,
    pub kind: String,
    pub user_id: Option<String>,
    pub order_id: Option<String>,
    pub payment_id: Option<String>,
    pub matched_rule_ids: Vec<String>,
    pub decided_action: String,
    pub details_json: serde_json::Value,
    pub decided_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RiskCase {
    pub id: String,
    pub kind: String,
    pub severity: RiskCaseSeverity,
    pub involved_user_ids: Vec<String>,
    pub involved_order_ids: Vec<String>,
    pub state: RiskCaseState,
    pub assigned_admin_id: Option<String>,
    pub opened_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
    pub audit_note: String,
}
