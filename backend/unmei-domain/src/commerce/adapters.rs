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

/// 渠道回调事件。
///
/// ★ 支付类事件带**两个**标识,不是一个:
///   - `our_ref` —— 我方单号(微信的 `out_trade_no`),就是 `payment.id`。**用它定位**。
///   - `channel_txn_id` —— 渠道自己的流水号(微信的 `transaction_id`)。**用它对账**。
///
/// 从前只有一个 `txn_id`,两者混成一个字段,后果是致命的:
/// 真回调里填的是 `transaction_id`,而 `apply_succeeded` 拿它去
/// `WHERE channel_txn_id=$2 OR id=$2` 匹配 —— 那个号既不等于我方 payment id,
/// `channel_txn_id` 那一列此刻又是 NULL,**两个条件都不成立,UPDATE 影响 0 行,
/// 这笔支付永远不会入账**。今天看不出来,是因为 mock 的 `query_payment`
/// 把 txn_id 填成 payment_id 本身,sweeper 于是能 by-id 命中,测试也全绿。
///
/// 连带后果:那一列存的是我们自己的 id 而不是渠道流水号,拿真渠道账单来对账
/// 会把每一笔都判成 `missing_in_internal`。
///
/// 领域事件 `DomainEvent::PaymentSucceeded` 一直是两个字段 —— 是适配器这一层
/// 把它们合并掉了。现在对齐。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebhookEvent {
    PaymentSucceeded {
        /// 我方单号(out_trade_no)= payment.id。定位用这个。
        our_ref: String,
        /// 渠道流水号(transaction_id)。对账用这个;渠道没给就是 None。
        channel_txn_id: Option<String>,
        paid_at: DateTime<Utc>,
        raw_amount_minor: i64,
    },
    PaymentFailed { our_ref: String, code: String, msg: String },
    PaymentExpired { our_ref: String },
    RefundSucceeded { refund_id: String, amount_minor: i64 },
    RefundFailed { refund_id: String, code: String, msg: String },
    SubscriptionRenewed { subscription_ref: String, period_end: DateTime<Utc> },
    SubscriptionCancelled { subscription_ref: String },
    DisputeOpened { our_ref: String, reason: String },
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

/// 回调请求的头部,**不绑定任何 HTTP 库**。
///
/// 原本这里直接收 `&http::HeaderMap`,于是 domain 这一最内层多出一个
/// `http` 依赖,而所有实现方(`unmei-wx` / `unmei-carrier`)其实一个 header
/// 都没读(签名验签还没接)。参数不能删 —— 微信支付 v3 验签要
/// `Wechatpay-Signature` / `-Timestamp` / `-Nonce` / `-Serial` 四个头 ——
/// 所以换成中立类型,等真验签落地时它就位。
///
/// 名字按 HTTP 语义大小写不敏感,内部统一小写存放。
#[derive(Debug, Clone, Default)]
pub struct WebhookHeaders(Vec<(String, String)>);

impl WebhookHeaders {
    pub fn new() -> Self {
        Self(Vec::new())
    }

    pub fn insert(&mut self, name: impl AsRef<str>, value: impl Into<String>) {
        self.0.push((name.as_ref().to_ascii_lowercase(), value.into()));
    }

    pub fn get(&self, name: &str) -> Option<&str> {
        let want = name.to_ascii_lowercase();
        self.0.iter().find(|(k, _)| *k == want).map(|(_, v)| v.as_str())
    }

    pub fn iter(&self) -> impl Iterator<Item = (&str, &str)> {
        self.0.iter().map(|(k, v)| (k.as_str(), v.as_str()))
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl<K: AsRef<str>, V: Into<String>> FromIterator<(K, V)> for WebhookHeaders {
    fn from_iter<I: IntoIterator<Item = (K, V)>>(iter: I) -> Self {
        let mut h = Self::new();
        for (k, v) in iter {
            h.insert(k, v);
        }
        h
    }
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
    async fn verify_webhook(&self, headers: &WebhookHeaders, body: &[u8]) -> Result<WebhookEvent, AdapterError>;
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
        headers: &WebhookHeaders,
        body: &[u8],
    ) -> Result<TraceWebhookEvent, AdapterError>;
}
