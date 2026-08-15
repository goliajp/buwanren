//! Shipment 域 · 物流 trace

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::enums::{ShipmentStatus, ShippingMethod};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Shipment {
    pub id: String,
    pub order_id: String,
    pub order_line_ids: Vec<String>,
    pub carrier_code: String,
    pub tracking_no: Option<String>,
    pub recipient_snapshot_json: serde_json::Value,
    pub shipping_method: ShippingMethod,
    pub weight_g: Option<i32>,
    pub dim_cm_json: serde_json::Value,
    pub status: ShipmentStatus,
    pub picked_up_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub cost_minor: Option<i64>,
    pub cost_currency: Option<String>,
    pub carrier_meta_json: serde_json::Value,
    pub audit_note: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ShipmentTraceEvent {
    pub id: String,
    pub shipment_id: String,
    pub event_at: DateTime<Utc>,
    pub event_kind: String,
    pub location: Option<String>,
    pub description: String,
    pub raw_source: String,
    pub raw_event_id: Option<String>,
    pub raw_payload_json: serde_json::Value,
    pub received_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ShipmentDetail {
    pub shipment: Shipment,
    pub trace: Vec<ShipmentTraceEvent>,
}
