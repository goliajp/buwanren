//! 渠道 adapter trait —— Payment + Carrier。
//!
//! 见 `commerce-architecture.md` §4 + §3.8。
//! 调用方代码**只判断 outcome 类型,不判断 channel/carrier**。

use async_trait::async_trait;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

// ═══════════════════════════ Payment ═══════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterCapabilities {
    pub partial_refund: bool,
    pub subscription: bool,
    pub off_session_charge: bool,
    pub cancel_pending: bool,
    pub three_d_secure: bool,
    pub settlement_pull: bool,
    pub max_amount_minor: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePaymentParam {
    pub payment_id: String,
    pub order_id: String,
    pub user_id: String,
    pub amount_minor: i64,
    pub currency: String,
    pub description: String,
    pub channel_user_ref: Option<String>,
    pub return_url: Option<String>,
    pub notify_url: String,
    pub expires_at: DateTime<Utc>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum CreatePaymentResp {
    Jsapi { params: serde_json::Value },
    Redirect { url: String },
    NativeQr { code_url: String },
    StripePaymentIntent { client_secret: String },
    IapVerifiable { challenge_token: String },
    ImmediateSuccess,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefundParam {
    pub refund_id: String,
    pub payment_id: String,
    pub channel_txn_id: String,
    pub amount_minor: i64,
    pub total_amount_minor: i64,
    pub currency: String,
    pub reason: String,
    pub notify_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefundResp {
    pub channel_refund_id: String,
    pub status_hint: String, // pending/success
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebhookEvent {
    PaymentSucceeded { txn_id: String, paid_at: DateTime<Utc>, raw_amount_minor: i64 },
    PaymentFailed { txn_id: String, code: String, msg: String },
    PaymentExpired { txn_id: String },
    RefundSucceeded { refund_id: String, amount_minor: i64 },
    RefundFailed { refund_id: String, code: String, msg: String },
    SubscriptionRenewed { subscription_ref: String, period_end: DateTime<Utc> },
    SubscriptionCancelled { subscription_ref: String },
    DisputeOpened { txn_id: String, reason: String },
    Unknown { kind: String, raw: serde_json::Value },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelTxnRow {
    pub channel_txn_id: String,
    pub amount_minor: i64,
    pub currency: String,
    pub status: String,
    pub paid_at: Option<DateTime<Utc>>,
}

#[derive(Debug, thiserror::Error)]
pub enum AdapterError {
    #[error("network: {0}")] Network(String),
    #[error("signature: {0}")] Signature(String),
    #[error("channel rejected ({code}): {msg}")] ChannelRejected { code: String, msg: String },
    #[error("not found")] NotFound,
    #[error("unsupported operation")] Unsupported,
    #[error("config: {0}")] Config(String),
    #[error("internal: {0}")] Internal(String),
}

#[async_trait]
pub trait PaymentAdapter: Send + Sync + 'static {
    fn channel(&self) -> &'static str;
    fn capabilities(&self) -> AdapterCapabilities;
    fn supported_currencies(&self) -> &'static [&'static str];

    async fn create_payment(&self, req: CreatePaymentParam) -> Result<CreatePaymentResp, AdapterError>;
    async fn query_payment(&self, payment_id: &str) -> Result<WebhookEvent, AdapterError>;
    async fn cancel_payment(&self, payment_id: &str) -> Result<(), AdapterError>;
    async fn refund(&self, req: RefundParam) -> Result<RefundResp, AdapterError>;
    async fn query_refund(&self, refund_id: &str) -> Result<WebhookEvent, AdapterError>;
    async fn verify_webhook(&self, headers: &http::HeaderMap, body: &[u8]) -> Result<WebhookEvent, AdapterError>;
    async fn pull_settlement(&self, day: NaiveDate, currency: &str) -> Result<Vec<ChannelTxnRow>, AdapterError>;
}

// ═══════════════════════════ Carrier ═══════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CarrierCapabilities {
    pub supports_webhook: bool,
    pub supports_label_purchase: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceEvent {
    pub event_at: DateTime<Utc>,
    pub kind: String,
    pub location: Option<String>,
    pub description: String,
    pub raw_event_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceWebhookEvent {
    pub carrier_code: String,
    pub tracking_no: String,
    pub events: Vec<TraceEvent>,
}

#[async_trait]
pub trait CarrierAdapter: Send + Sync + 'static {
    fn provider(&self) -> &'static str;
    fn supported_carriers(&self) -> &'static [&'static str];
    fn capabilities(&self) -> CarrierCapabilities;

    async fn query_trace(
        &self,
        carrier_code: &str,
        tracking_no: &str,
    ) -> Result<Vec<TraceEvent>, AdapterError>;

    async fn verify_webhook(
        &self,
        headers: &http::HeaderMap,
        body: &[u8],
    ) -> Result<TraceWebhookEvent, AdapterError>;
}
