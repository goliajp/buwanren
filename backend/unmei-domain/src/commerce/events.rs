//! 领域事件枚举 — 由 service 写入 `outbox_event`,worker 异步分发到通知 / 财务挂账 / sweeper。

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 全部领域事件的总联合。
/// 序列化为 `{"kind":"OrderPaid","aggregate_id":"...","payload":{...}}`。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "payload")]
pub enum DomainEvent {
    OrderCreated { order_id: String, user_id: String, amount_total_minor: i64, currency: String, occurred_at: DateTime<Utc> },
    OrderPaid    { order_id: String, payment_id: String, occurred_at: DateTime<Utc> },
    OrderFulfilled { order_id: String, occurred_at: DateTime<Utc> },
    OrderCancelled { order_id: String, reason: String, actor: String, occurred_at: DateTime<Utc> },
    OrderRefunded  { order_id: String, refund_id: String, full: bool, occurred_at: DateTime<Utc> },
    OrderDisputed  { order_id: String, payment_id: String, reason: String, occurred_at: DateTime<Utc> },

    PaymentCreated { payment_id: String, order_id: String, channel: String, amount_minor: i64, currency: String, occurred_at: DateTime<Utc> },
    PaymentSucceeded { payment_id: String, channel_txn_id: String, occurred_at: DateTime<Utc> },
    PaymentFailed { payment_id: String, code: String, msg: String, occurred_at: DateTime<Utc> },
    PaymentExpired { payment_id: String, occurred_at: DateTime<Utc> },
    PaymentRefundCompleted { payment_id: String, refund_id: String, amount_minor: i64, occurred_at: DateTime<Utc> },

    RefundInitiated { refund_id: String, payment_id: String, amount_minor: i64, occurred_at: DateTime<Utc> },
    RefundApproved  { refund_id: String, approved_by: String, occurred_at: DateTime<Utc> },
    RefundCompleted { refund_id: String, occurred_at: DateTime<Utc> },
    RefundFailed    { refund_id: String, code: String, msg: String, occurred_at: DateTime<Utc> },

    ShipmentCreated   { shipment_id: String, order_id: String, occurred_at: DateTime<Utc> },
    ShipmentTrackingAssigned { shipment_id: String, carrier_code: String, tracking_no: String, occurred_at: DateTime<Utc> },
    ShipmentDelivered { shipment_id: String, order_id: String, occurred_at: DateTime<Utc> },
    ShipmentException { shipment_id: String, kind: String, occurred_at: DateTime<Utc> },
    ShipmentReturned  { shipment_id: String, occurred_at: DateTime<Utc> },

    SubscriptionStarted   { subscription_id: String, plan_id: String, period_end: DateTime<Utc>, occurred_at: DateTime<Utc> },
    SubscriptionRenewed   { subscription_id: String, period_end: DateTime<Utc>, occurred_at: DateTime<Utc> },
    SubscriptionPastDue   { subscription_id: String, occurred_at: DateTime<Utc> },
    SubscriptionCancelled { subscription_id: String, occurred_at: DateTime<Utc> },
    SubscriptionExpired   { subscription_id: String, occurred_at: DateTime<Utc> },

    CouponIssued   { coupon_id: String, owner_user_id: Option<String>, occurred_at: DateTime<Utc> },
    CouponRedeemed { coupon_id: String, order_id: String, applied_minor: i64, occurred_at: DateTime<Utc> },
    CouponExpired  { coupon_id: String, occurred_at: DateTime<Utc> },

    RiskRuleTriggered { rule_id: String, decided_action: String, target_kind: String, target_id: String, occurred_at: DateTime<Utc> },
    RiskCaseOpened    { case_id: String, severity: String, occurred_at: DateTime<Utc> },

    JournalPosted { entry_id: String, occurred_at: DateTime<Utc> },
}

impl DomainEvent {
    pub fn kind_str(&self) -> &'static str {
        match self {
            Self::OrderCreated { .. } => "OrderCreated",
            Self::OrderPaid { .. } => "OrderPaid",
            Self::OrderFulfilled { .. } => "OrderFulfilled",
            Self::OrderCancelled { .. } => "OrderCancelled",
            Self::OrderRefunded { .. } => "OrderRefunded",
            Self::OrderDisputed { .. } => "OrderDisputed",
            Self::PaymentCreated { .. } => "PaymentCreated",
            Self::PaymentSucceeded { .. } => "PaymentSucceeded",
            Self::PaymentFailed { .. } => "PaymentFailed",
            Self::PaymentExpired { .. } => "PaymentExpired",
            Self::PaymentRefundCompleted { .. } => "PaymentRefundCompleted",
            Self::RefundInitiated { .. } => "RefundInitiated",
            Self::RefundApproved { .. } => "RefundApproved",
            Self::RefundCompleted { .. } => "RefundCompleted",
            Self::RefundFailed { .. } => "RefundFailed",
            Self::ShipmentCreated { .. } => "ShipmentCreated",
            Self::ShipmentTrackingAssigned { .. } => "ShipmentTrackingAssigned",
            Self::ShipmentDelivered { .. } => "ShipmentDelivered",
            Self::ShipmentException { .. } => "ShipmentException",
            Self::ShipmentReturned { .. } => "ShipmentReturned",
            Self::SubscriptionStarted { .. } => "SubscriptionStarted",
            Self::SubscriptionRenewed { .. } => "SubscriptionRenewed",
            Self::SubscriptionPastDue { .. } => "SubscriptionPastDue",
            Self::SubscriptionCancelled { .. } => "SubscriptionCancelled",
            Self::SubscriptionExpired { .. } => "SubscriptionExpired",
            Self::CouponIssued { .. } => "CouponIssued",
            Self::CouponRedeemed { .. } => "CouponRedeemed",
            Self::CouponExpired { .. } => "CouponExpired",
            Self::RiskRuleTriggered { .. } => "RiskRuleTriggered",
            Self::RiskCaseOpened { .. } => "RiskCaseOpened",
            Self::JournalPosted { .. } => "JournalPosted",
        }
    }

    pub fn aggregate_kind(&self) -> &'static str {
        match self {
            Self::OrderCreated { .. } | Self::OrderPaid { .. } | Self::OrderFulfilled { .. }
            | Self::OrderCancelled { .. } | Self::OrderRefunded { .. } | Self::OrderDisputed { .. } => "order",
            Self::PaymentCreated { .. } | Self::PaymentSucceeded { .. } | Self::PaymentFailed { .. }
            | Self::PaymentExpired { .. } | Self::PaymentRefundCompleted { .. } => "payment",
            Self::RefundInitiated { .. } | Self::RefundApproved { .. } | Self::RefundCompleted { .. }
            | Self::RefundFailed { .. } => "refund",
            Self::ShipmentCreated { .. } | Self::ShipmentTrackingAssigned { .. }
            | Self::ShipmentDelivered { .. } | Self::ShipmentException { .. }
            | Self::ShipmentReturned { .. } => "shipment",
            Self::SubscriptionStarted { .. } | Self::SubscriptionRenewed { .. }
            | Self::SubscriptionPastDue { .. } | Self::SubscriptionCancelled { .. }
            | Self::SubscriptionExpired { .. } => "subscription",
            Self::CouponIssued { .. } | Self::CouponRedeemed { .. } | Self::CouponExpired { .. } => "coupon",
            Self::RiskRuleTriggered { .. } | Self::RiskCaseOpened { .. } => "risk",
            Self::JournalPosted { .. } => "journal",
        }
    }

    pub fn aggregate_id(&self) -> &str {
        match self {
            Self::OrderCreated { order_id, .. } | Self::OrderPaid { order_id, .. }
            | Self::OrderFulfilled { order_id, .. } | Self::OrderCancelled { order_id, .. }
            | Self::OrderRefunded { order_id, .. } | Self::OrderDisputed { order_id, .. } => order_id,
            Self::PaymentCreated { payment_id, .. } | Self::PaymentSucceeded { payment_id, .. }
            | Self::PaymentFailed { payment_id, .. } | Self::PaymentExpired { payment_id, .. }
            | Self::PaymentRefundCompleted { payment_id, .. } => payment_id,
            Self::RefundInitiated { refund_id, .. } | Self::RefundApproved { refund_id, .. }
            | Self::RefundCompleted { refund_id, .. } | Self::RefundFailed { refund_id, .. } => refund_id,
            Self::ShipmentCreated { shipment_id, .. } | Self::ShipmentTrackingAssigned { shipment_id, .. }
            | Self::ShipmentDelivered { shipment_id, .. } | Self::ShipmentException { shipment_id, .. }
            | Self::ShipmentReturned { shipment_id, .. } => shipment_id,
            Self::SubscriptionStarted { subscription_id, .. } | Self::SubscriptionRenewed { subscription_id, .. }
            | Self::SubscriptionPastDue { subscription_id, .. } | Self::SubscriptionCancelled { subscription_id, .. }
            | Self::SubscriptionExpired { subscription_id, .. } => subscription_id,
            Self::CouponIssued { coupon_id, .. } | Self::CouponRedeemed { coupon_id, .. }
            | Self::CouponExpired { coupon_id, .. } => coupon_id,
            Self::RiskRuleTriggered { rule_id, .. } => rule_id,
            Self::RiskCaseOpened { case_id, .. } => case_id,
            Self::JournalPosted { entry_id, .. } => entry_id,
        }
    }
}
