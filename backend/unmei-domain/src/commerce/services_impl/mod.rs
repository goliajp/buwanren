//! Service trait 的 sqlx 落地实现。
//!
//! 通用模式:`PgXxxService { pool: PgPool }`,所有方法在事务内做状态机校验 +
//! 业务表写入 + outbox_event。失败回滚整个事务。
//!
//! 当前实现:
//! - [`order::PgOrderService`] — Order 域样板(create / cancel / mark_paid / mark_fulfilled)
//!
//! 未实现的 trait(留给后续轮):PaymentService / RefundService / ShipmentService /
//! SubscriptionService / PromotionService / SettlementService / RiskService /
//! FinanceService / CatalogService / PricingService。
//! 当前 routes 仍直接走 sqlx,迁移到 service 是无侵入式增量改造。

pub mod order;
pub mod payment;
pub mod refund;
pub mod shipment;
pub mod subscription;
pub mod catalog;
pub mod pricing;
pub mod finance;
pub mod promotion;
pub mod risk;
pub mod settlement;

pub use order::PgOrderService;
pub use payment::{PgPaymentService, apply_payment_succeeded};
pub use refund::PgRefundService;
pub use shipment::{PgShipmentService, apply_shipment_delivered};
pub use subscription::PgSubscriptionService;
pub use catalog::PgCatalogService;
pub use pricing::PgPricingService;
pub use finance::{PgFinanceService, list_accounts};
pub use promotion::{PgPromotionService, sweep_expired_coupons};
pub use risk::PgRiskService;
pub use settlement::PgSettlementService;
