//! Order 域 · 订单聚合根 + Line + Event + Meta

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::enums::{
    LineFulfillmentStatus, OrderEventActor, OrderSourceKind, OrderStatus, ReceiptKind,
};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Order {
    pub id: String,
    pub user_id: String,
    pub channel_origin: String,
    pub currency: String,
    pub amount_subtotal_minor: i64,
    pub amount_discount_minor: i64,
    pub amount_shipping_minor: i64,
    pub amount_tax_minor: i64,
    pub amount_total_minor: i64,
    pub amount_paid_minor: i64,
    pub amount_refunded_minor: i64,
    pub status: OrderStatus,
    pub source_kind: OrderSourceKind,
    pub source_ref_id: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub paid_at: Option<DateTime<Utc>>,
    pub fulfilled_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub cancel_reason: Option<String>,
    pub cancel_actor: Option<String>,
    pub receipt_kind: ReceiptKind,
    pub receipt_meta_json: serde_json::Value,
    pub region: String,
    pub ip: Option<String>,
    pub ua: Option<String>,
    pub risk_score: Option<i32>,
    pub audit_note: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OrderLine {
    pub id: String,
    pub order_id: String,
    pub line_no: i32,
    pub sku_id: String,
    pub sku_snapshot_json: serde_json::Value,
    pub unit_price_minor: i64,
    pub qty: i32,
    pub line_subtotal_minor: i64,
    pub applied_promo_ids: Vec<String>,
    pub applied_coupon_ids: Vec<String>,
    pub applied_discount_minor: i64,
    pub fulfillment_status: LineFulfillmentStatus,
    pub fulfillment_ref: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OrderEvent {
    pub id: String,
    pub order_id: String,
    pub kind: String,
    pub actor_kind: OrderEventActor,
    pub actor_id: Option<String>,
    pub before_status: Option<String>,
    pub after_status: Option<String>,
    pub meta_json: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OrderMeta {
    pub order_id: String,
    pub shipping_address_json: Option<serde_json::Value>,
    pub contact_json: Option<serde_json::Value>,
    pub gift_note: Option<String>,
    pub extra_json: serde_json::Value,
}

/// 含 line 的视图(详情接口 / webadmin 抽屉用)。
#[derive(Debug, Clone, Serialize)]
pub struct OrderDetail {
    pub order: Order,
    pub lines: Vec<OrderLine>,
    pub events: Vec<OrderEvent>,
    pub meta: Option<OrderMeta>,
}
