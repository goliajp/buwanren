//! Service trait · 给 API 层 + worker 共用的服务接口。
//!
//! 实现层在 `unmei-api` / `unmei-admin-api` 内部用 sqlx 落地;
//! 这里 trait 是契约 + 输入输出 DTO。

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::{
    order::*, payment::*, refund::*, shipment::*, subscription::*,
    promotion::*, settlement::*, risk::*, finance::*,
    product::*, pricing::*,
};
use crate::DomainError;

// ═══════════════════════════ 公共类型 ═══════════════════════════

#[derive(Debug, Clone, Deserialize)]
pub struct ListParams {
    #[serde(default)] pub page: u32,
    #[serde(default = "default_page_size")] pub page_size: u32,
    pub keyword: Option<String>,
    pub status: Option<String>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}
fn default_page_size() -> u32 { 50 }

#[derive(Debug, Clone, Serialize)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
}

// ═══════════════════════════ Order ═══════════════════════════
#[derive(Debug, Clone, Deserialize)]
pub struct CreateOrderRequest {
    pub user_id: String,
    pub channel_origin: String,
    pub region: String,
    pub lines: Vec<CreateOrderLine>,
    pub coupon_codes: Vec<String>,
    pub shipping_address: Option<serde_json::Value>,
    pub receipt: Option<serde_json::Value>,
    pub note: Option<String>,
    pub ip: Option<String>,
    pub ua: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateOrderLine {
    pub sku_id: String,
    pub qty: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OrderListFilter {
    pub status: Option<String>,
    pub channel_origin: Option<String>,
    pub user_id: Option<String>,
    pub region: Option<String>,
    pub amount_min_minor: Option<i64>,
    pub amount_max_minor: Option<i64>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub keyword: Option<String>,
    #[serde(default)] pub page: u32,
    #[serde(default = "default_page_size")] pub page_size: u32,
}

#[async_trait]
pub trait OrderService: Send + Sync {
    async fn create(&self, req: CreateOrderRequest) -> Result<Order, DomainError>;
    async fn get(&self, id: &str) -> Result<OrderDetail, DomainError>;
    async fn list_admin(&self, f: &OrderListFilter) -> Result<Page<Order>, DomainError>;
    async fn list_user(&self, user_id: &str, p: &ListParams) -> Result<Page<Order>, DomainError>;
    async fn cancel(&self, id: &str, reason: &str, actor: &str) -> Result<(), DomainError>;
    async fn mark_paid(&self, id: &str, payment_id: &str) -> Result<(), DomainError>;
    async fn mark_fulfilled(&self, id: &str) -> Result<(), DomainError>;
    async fn re_fulfill(&self, id: &str, actor_admin_id: &str) -> Result<(), DomainError>;
    async fn annotate(&self, id: &str, note: &str, actor_admin_id: &str) -> Result<(), DomainError>;
    async fn expire_unpaid(&self) -> Result<u64, DomainError>;
}

// ═══════════════════════════ Payment ═══════════════════════════
#[derive(Debug, Clone, Deserialize)]
pub struct CreatePaymentRequest {
    pub order_id: String,
    pub channel: String,
    pub sub_channel: Option<String>,
    pub channel_user_ref: Option<String>,  // openid / pi_id / receipt-token
    pub return_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind")]
pub enum CreatePaymentOutcome {
    Jsapi { payment_id: String, params: serde_json::Value },
    Redirect { payment_id: String, url: String },
    NativeQr { payment_id: String, code_url: String },
    StripePaymentIntent { payment_id: String, client_secret: String },
    IapVerifiable { payment_id: String, challenge_token: String },
    ImmediateSuccess { payment_id: String },
}

#[derive(Debug, Clone, Deserialize)]
pub struct PaymentListFilter {
    pub channel: Option<String>,
    pub status: Option<String>,
    pub user_id: Option<String>,
    pub order_id: Option<String>,
    pub amount_min_minor: Option<i64>,
    pub amount_max_minor: Option<i64>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub keyword: Option<String>,
    #[serde(default)] pub page: u32,
    #[serde(default = "default_page_size")] pub page_size: u32,
}

#[async_trait]
pub trait PaymentService: Send + Sync {
    async fn create(&self, req: CreatePaymentRequest) -> Result<CreatePaymentOutcome, DomainError>;
    async fn get(&self, id: &str) -> Result<PaymentDetail, DomainError>;
    async fn list_admin(&self, f: &PaymentListFilter) -> Result<Page<Payment>, DomainError>;
    async fn force_query(&self, id: &str) -> Result<Payment, DomainError>;
    async fn mark_failed(&self, id: &str, code: &str, msg: &str, actor_admin_id: &str) -> Result<(), DomainError>;
    async fn apply_webhook_event(&self, channel: &str, channel_event_id: &str, payload: serde_json::Value) -> Result<(), DomainError>;
    async fn sweep_pending(&self) -> Result<u64, DomainError>;
}

// ═══════════════════════════ Refund ═══════════════════════════
#[derive(Debug, Clone, Deserialize)]
pub struct CreateRefundRequest {
    pub order_id: String,
    pub payment_id: String,
    pub amount_minor: i64,
    pub reason_code: String,
    pub reason_text: String,
    pub actor_kind: String,
    pub actor_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RefundListFilter {
    pub status: Option<String>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub keyword: Option<String>,
    #[serde(default)] pub page: u32,
    #[serde(default = "default_page_size")] pub page_size: u32,
}

#[async_trait]
pub trait RefundService: Send + Sync {
    async fn request(&self, req: CreateRefundRequest) -> Result<Refund, DomainError>;
    async fn list_admin(&self, f: &RefundListFilter) -> Result<Page<Refund>, DomainError>;
    async fn approve(&self, id: &str, admin_id: &str) -> Result<(), DomainError>;
    async fn deny(&self, id: &str, admin_id: &str, reason: &str) -> Result<(), DomainError>;
    async fn retry(&self, id: &str, admin_id: &str) -> Result<(), DomainError>;
    async fn apply_webhook_event(&self, channel: &str, channel_event_id: &str, payload: serde_json::Value) -> Result<(), DomainError>;
}

// ═══════════════════════════ Shipment ═══════════════════════════
#[derive(Debug, Clone, Deserialize)]
pub struct ShipmentListFilter {
    pub status: Option<String>,
    pub carrier_code: Option<String>,
    pub order_id: Option<String>,
    pub keyword: Option<String>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub exception_only: Option<bool>,
    #[serde(default)] pub page: u32,
    #[serde(default = "default_page_size")] pub page_size: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssignTrackingRequest {
    pub shipment_id: String,
    pub carrier_code: String,
    pub tracking_no: String,
    pub shipping_method: Option<String>,
    pub cost_minor: Option<i64>,
    pub cost_currency: Option<String>,
}

#[async_trait]
pub trait ShipmentService: Send + Sync {
    async fn create_from_order(&self, order_id: &str) -> Result<Vec<String>, DomainError>;
    async fn list_admin(&self, f: &ShipmentListFilter) -> Result<Page<Shipment>, DomainError>;
    async fn get(&self, id: &str) -> Result<ShipmentDetail, DomainError>;
    async fn assign_tracking(&self, req: AssignTrackingRequest, admin_id: &str) -> Result<(), DomainError>;
    async fn force_query(&self, id: &str) -> Result<u32, DomainError>;
    async fn mark_exception(&self, id: &str, reason: &str, admin_id: &str) -> Result<(), DomainError>;
    async fn mark_returning(&self, id: &str, admin_id: &str) -> Result<(), DomainError>;
    async fn list_user_for_order(&self, user_id: &str, order_id: &str) -> Result<Vec<Shipment>, DomainError>;
    async fn list_trace(&self, shipment_id: &str) -> Result<Vec<ShipmentTraceEvent>, DomainError>;
    async fn sweep_trace(&self) -> Result<u64, DomainError>;
}

// ═══════════════════════════ Subscription ═══════════════════════════
#[derive(Debug, Clone, Deserialize)]
pub struct StartSubscriptionRequest {
    pub user_id: String,
    pub plan_id: String,
    pub channel: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SubscriptionListFilter {
    pub status: Option<String>,
    pub plan_id: Option<String>,
    pub keyword: Option<String>,
    #[serde(default)] pub page: u32,
    #[serde(default = "default_page_size")] pub page_size: u32,
}

#[async_trait]
pub trait SubscriptionService: Send + Sync {
    async fn list_plans(&self) -> Result<Vec<Plan>, DomainError>;
    async fn start(&self, req: StartSubscriptionRequest) -> Result<Subscription, DomainError>;
    async fn list_admin(&self, f: &SubscriptionListFilter) -> Result<Page<Subscription>, DomainError>;
    async fn list_user(&self, user_id: &str) -> Result<Vec<Subscription>, DomainError>;
    async fn cancel(&self, id: &str, immediate: bool, actor: &str) -> Result<(), DomainError>;
    async fn resume(&self, id: &str, actor: &str) -> Result<(), DomainError>;
    async fn refund_full_cycle(&self, id: &str, admin_id: &str) -> Result<(), DomainError>;
    async fn attempt_dunning(&self) -> Result<u64, DomainError>;
}

// ═══════════════════════════ Promotion / Coupon ═══════════════════════════
#[derive(Debug, Clone, Deserialize)]
pub struct PromotionListFilter {
    pub status: Option<String>,
    pub keyword: Option<String>,
    #[serde(default)] pub page: u32,
    #[serde(default = "default_page_size")] pub page_size: u32,
}

#[async_trait]
pub trait PromotionService: Send + Sync {
    async fn list_admin(&self, f: &PromotionListFilter) -> Result<Page<Promotion>, DomainError>;
    async fn get(&self, id: &str) -> Result<Promotion, DomainError>;
    async fn upsert(&self, p: Promotion, admin_id: &str) -> Result<Promotion, DomainError>;
    async fn pause(&self, id: &str, admin_id: &str) -> Result<(), DomainError>;
    async fn resume(&self, id: &str, admin_id: &str) -> Result<(), DomainError>;
    async fn end(&self, id: &str, admin_id: &str) -> Result<(), DomainError>;

    async fn issue_coupons(&self, promotion_id: &str, count: u32, owner_user_ids: Option<Vec<String>>, expires_at: DateTime<Utc>, admin_id: &str) -> Result<Vec<String>, DomainError>;
    async fn list_coupons_admin(&self, promotion_id: Option<&str>, state: Option<&str>, p: &ListParams) -> Result<Page<Coupon>, DomainError>;
    async fn redeem_coupon(&self, code: &str, user_id: &str) -> Result<Coupon, DomainError>;
}

// ═══════════════════════════ Settlement ═══════════════════════════
#[async_trait]
pub trait SettlementService: Send + Sync {
    async fn list_batches(&self, p: &ListParams) -> Result<Page<ReconBatch>, DomainError>;
    async fn get_batch(&self, id: &str) -> Result<(ReconBatch, Vec<ReconRecord>), DomainError>;
    async fn trigger_pull(&self, channel: &str, day: chrono::NaiveDate, admin_id: &str) -> Result<ReconBatch, DomainError>;
    async fn resolve_record(&self, record_id: &str, action: &str, admin_id: &str) -> Result<(), DomainError>;
}

// ═══════════════════════════ Risk ═══════════════════════════
#[derive(Debug, Clone, Deserialize)]
pub struct RiskEvalContext {
    pub kind: String,
    pub user_id: Option<String>,
    pub order_id: Option<String>,
    pub payment_id: Option<String>,
    pub amount_minor: Option<i64>,
    pub user_age_days: Option<i32>,
    pub extras: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct RiskDecision {
    pub action: String,
    pub matched_rule_ids: Vec<String>,
    pub details: serde_json::Value,
}

#[async_trait]
pub trait RiskService: Send + Sync {
    async fn list_rules(&self, kind: Option<&str>) -> Result<Vec<RiskRule>, DomainError>;
    async fn upsert_rule(&self, rule: RiskRule, admin_id: &str) -> Result<RiskRule, DomainError>;
    async fn list_events(&self, p: &ListParams) -> Result<Page<RiskEvent>, DomainError>;
    async fn list_cases(&self, p: &ListParams) -> Result<Page<RiskCase>, DomainError>;
    async fn open_case(&self, case: RiskCase, admin_id: &str) -> Result<RiskCase, DomainError>;
    async fn close_case(&self, id: &str, resolution: &str, admin_id: &str) -> Result<(), DomainError>;
    async fn evaluate(&self, ctx: RiskEvalContext) -> Result<RiskDecision, DomainError>;
}

// ═══════════════════════════ Finance ═══════════════════════════
#[derive(Debug, Clone, Serialize)]
pub struct MonthlyReport {
    pub period_id: String,
    pub revenue_minor: i64,
    pub refund_minor: i64,
    pub channel_fee_minor: i64,
    pub shipping_revenue_minor: i64,
    pub shipping_cost_minor: i64,
    pub mrr_minor: i64,
    pub arr_minor: i64,
    pub trial_balance: Vec<TrialBalanceRow>,
}

#[async_trait]
pub trait FinanceService: Send + Sync {
    async fn list_periods(&self) -> Result<Vec<AccountingPeriod>, DomainError>;
    async fn list_entries(&self, period_id: &str, p: &ListParams) -> Result<Page<JournalEntry>, DomainError>;
    async fn get_entry(&self, id: &str) -> Result<(JournalEntry, Vec<JournalLine>), DomainError>;
    async fn post(&self, entry: JournalEntry, lines: Vec<JournalLine>) -> Result<(), DomainError>;
    async fn reverse(&self, entry_id: &str, admin_id: &str) -> Result<(), DomainError>;
    async fn close_period(&self, period_id: &str, admin_id: &str) -> Result<(), DomainError>;
    async fn monthly_report(&self, period_id: &str) -> Result<MonthlyReport, DomainError>;
}

// ═══════════════════════════ Catalog / Pricing ═══════════════════════════
#[derive(Debug, Clone, Deserialize)]
pub struct ProductListFilter {
    pub status: Option<String>,
    pub kind: Option<String>,
    pub category: Option<String>,
    pub keyword: Option<String>,
    #[serde(default)] pub page: u32,
    #[serde(default = "default_page_size")] pub page_size: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct QuoteContext {
    pub user_id: Option<String>,
    pub region: String,
    pub platform: String,
    pub qty: i32,
    pub at: Option<DateTime<Utc>>,
}

#[async_trait]
pub trait CatalogService: Send + Sync {
    async fn list_admin(&self, f: &ProductListFilter) -> Result<Page<Product>, DomainError>;
    async fn list_public(&self, region: &str, platform: &str) -> Result<Vec<ProductWithSkus>, DomainError>;
    async fn get(&self, id: &str) -> Result<(Product, Vec<Sku>), DomainError>;
    async fn upsert_product(&self, p: Product, admin_id: &str) -> Result<Product, DomainError>;
    async fn upsert_sku(&self, sku: Sku, admin_id: &str) -> Result<Sku, DomainError>;
    async fn delist(&self, id: &str, admin_id: &str) -> Result<(), DomainError>;
    async fn quote(&self, sku_id: &str, ctx: &QuoteContext) -> Result<QuoteResult, DomainError>;
}

#[async_trait]
pub trait PricingService: Send + Sync {
    async fn list_for_sku(&self, sku_id: &str) -> Result<Vec<PriceBook>, DomainError>;
    async fn publish(&self, pb: PriceBook, admin_id: &str) -> Result<PriceBook, DomainError>;
    async fn expire(&self, id: &str, admin_id: &str) -> Result<(), DomainError>;
    async fn list_rules(&self) -> Result<Vec<PriceRule>, DomainError>;
    async fn upsert_rule(&self, r: PriceRule, admin_id: &str) -> Result<PriceRule, DomainError>;
}
