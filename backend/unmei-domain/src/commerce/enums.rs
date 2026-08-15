//! 所有 status / kind enum 集中定义。
//!
//! 与 PG TEXT + CHECK 约束保持一致,RENAME_ALL = snake_case。

use serde::{Deserialize, Serialize};

macro_rules! str_enum {
    ($(#[$m:meta])* $name:ident { $( $variant:ident => $s:literal ),* $(,)? }) => {
        $(#[$m])*
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
        #[sqlx(type_name = "text", rename_all = "snake_case")]
        #[serde(rename_all = "snake_case")]
        pub enum $name {
            $( $variant, )*
        }
        impl $name {
            pub fn as_str(&self) -> &'static str {
                match self { $( Self::$variant => $s, )* }
            }
            pub fn from_str_lax(s: &str) -> Option<Self> {
                match s { $( $s => Some(Self::$variant), )* _ => None }
            }
        }
        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                f.write_str(self.as_str())
            }
        }
    };
}

// ═══════════════════════════════ Product / SKU ══════════════════════════════
str_enum!(ProductKind {
    OneShot      => "one_shot",
    Subscription => "subscription",
    DigitalGoods => "digital_goods",
    Service      => "service",
});

str_enum!(ProductStatus {
    Draft        => "draft",
    Listed       => "listed",
    Delisted     => "delisted",
    Discontinued => "discontinued",
});

str_enum!(FulfillmentKind {
    Instant       => "instant",
    AsyncCompute  => "async_compute",
    Manual        => "manual",
    Shipping      => "shipping",
});

str_enum!(StockKind {
    Unlimited  => "unlimited",
    Limited    => "limited",
    PerUserCap => "per_user_cap",
});

str_enum!(SkuStatus {
    Draft    => "draft",
    Active   => "active",
    Inactive => "inactive",
    SoldOut  => "sold_out",
});

// ═══════════════════════════════ Pricing ══════════════════════════════
str_enum!(PriceTierKind {
    Flat     => "flat",
    QtyTier  => "qty_tier",
    UserTier => "user_tier",
});

str_enum!(PriceStatus {
    Active    => "active",
    Scheduled => "scheduled",
    Expired   => "expired",
});

// ═══════════════════════════════ Promotion / Coupon ══════════════════════════════
str_enum!(PromotionKind {
    PctOff    => "pct_off",
    AmountOff => "amount_off",
    Bxgy      => "bxgy",
    Bundle    => "bundle",
    CapOnly   => "cap_only",
});

str_enum!(PromotionStatus {
    Draft      => "draft",
    Scheduled  => "scheduled",
    Active     => "active",
    Paused     => "paused",
    Exhausted  => "exhausted",
    Ended      => "ended",
});

str_enum!(CouponState {
    Issued   => "issued",
    Locked   => "locked",
    Redeemed => "redeemed",
    Expired  => "expired",
    Revoked  => "revoked",
});

// ═══════════════════════════════ Subscription ══════════════════════════════
str_enum!(BillingPeriod {
    Month    => "month",
    Quarter  => "quarter",
    Year     => "year",
    Lifetime => "lifetime",
});

str_enum!(SubscriptionStatus {
    Trialing  => "trialing",
    Active    => "active",
    PastDue   => "past_due",
    Grace     => "grace",
    Cancelled => "cancelled",
    Expired   => "expired",
    Paused    => "paused",
});

str_enum!(InvoiceStatus {
    Open          => "open",
    Paid          => "paid",
    Uncollectible => "uncollectible",
    Void          => "void",
});

str_enum!(CancelPolicy {
    Immediate    => "immediate",
    EndOfPeriod  => "end_of_period",
});

str_enum!(PlanStatus {
    Active  => "active",
    Paused  => "paused",
    Retired => "retired",
});

// ═══════════════════════════════ Order ══════════════════════════════
str_enum!(OrderStatus {
    Draft         => "draft",
    Unpaid        => "unpaid",
    Paid          => "paid",
    Fulfilling    => "fulfilling",
    Done          => "done",
    Cancelled     => "cancelled",
    RefundPartial => "refund_partial",
    Refunded      => "refunded",
    Disputed      => "disputed",
});

str_enum!(OrderSourceKind {
    OneShot              => "one_shot",
    SubscriptionInitial  => "subscription_initial",
    SubscriptionRenew    => "subscription_renew",
});

str_enum!(ChannelOrigin {
    WxMp  => "wx_mp",
    WxH5  => "wx_h5",
    Ios   => "ios",
    Android => "android",
    Web   => "web",
    Admin => "admin",
});

str_enum!(CancelActor {
    User   => "user",
    Admin  => "admin",
    System => "system",
});

str_enum!(ReceiptKind {
    None       => "none",
    Receipt    => "receipt",
    VatNormal  => "vat_normal",
    VatSpecial => "vat_special",
});

str_enum!(OrderEventActor {
    User    => "user",
    System  => "system",
    Admin   => "admin",
    Webhook => "webhook",
});

str_enum!(LineFulfillmentStatus {
    Pending    => "pending",
    Processing => "processing",
    Done       => "done",
    Failed     => "failed",
});

// ═══════════════════════════════ Payment ══════════════════════════════
str_enum!(PaymentChannel {
    WechatJsapi  => "wechat_jsapi",
    WechatMp     => "wechat_mp",
    WechatH5     => "wechat_h5",
    WechatNative => "wechat_native",
    AlipayWap    => "alipay_wap",
    AlipayPc     => "alipay_pc",
    AlipayMini   => "alipay_mini",
    Iap          => "iap",
    Gpb          => "gpb",
    StripeCard   => "stripe_card",
});

str_enum!(PaymentStatus {
    Pending         => "pending",
    Processing      => "processing",
    Success         => "success",
    Failed          => "failed",
    Expired         => "expired",
    Cancelling      => "cancelling",
    Cancelled       => "cancelled",
    Refunding       => "refunding",
    RefundedPartial => "refunded_partial",
    Refunded        => "refunded",
    Disputed        => "disputed",
});

// ═══════════════════════════════ Refund ══════════════════════════════
str_enum!(RefundStatus {
    Requested  => "requested",
    Approved   => "approved",
    Processing => "processing",
    Success    => "success",
    Failed     => "failed",
    Cancelled  => "cancelled",
});

str_enum!(RefundActor {
    User   => "user",
    Admin  => "admin",
    System => "system",
});

// ═══════════════════════════════ Shipment ══════════════════════════════
str_enum!(ShipmentStatus {
    Preparing       => "preparing",
    PickedUp        => "picked_up",
    InTransit       => "in_transit",
    OutForDelivery  => "out_for_delivery",
    Delivered       => "delivered",
    Exception       => "exception",
    Returning       => "returning",
    Returned        => "returned",
    Cancelled       => "cancelled",
});

str_enum!(ShippingMethod {
    Standard  => "standard",
    Express   => "express",
    Overnight => "overnight",
    Pickup    => "pickup",
});

// ═══════════════════════════════ Settlement ══════════════════════════════
str_enum!(ReconBatchStatus {
    Pulled         => "pulled",
    Parsed         => "parsed",
    Matched        => "matched",
    HasDiscrepancy => "has_discrepancy",
    Resolved       => "resolved",
    Closed         => "closed",
});

str_enum!(ReconRecordState {
    Matched           => "matched",
    MissingInChannel  => "missing_in_channel",
    MissingInInternal => "missing_in_internal",
    AmountMismatch    => "amount_mismatch",
    StatusMismatch    => "status_mismatch",
});

str_enum!(ReconSource {
    ChannelPulled    => "channel_pulled",
    InternalSnapshot => "internal_snapshot",
});

// ═══════════════════════════════ Risk ══════════════════════════════
str_enum!(RiskKind {
    PreOrder => "pre_order",
    PrePay   => "pre_pay",
    PostPay  => "post_pay",
    Refund   => "refund",
    Login    => "login",
});

str_enum!(RiskAction {
    Allow     => "allow",
    Challenge => "challenge",
    Block     => "block",
    Review    => "review",
    LogOnly   => "log_only",
});

str_enum!(RiskRuleStatus {
    Active  => "active",
    Paused  => "paused",
    Retired => "retired",
});

str_enum!(RiskCaseSeverity {
    Low      => "low",
    Med      => "med",
    High     => "high",
    Critical => "critical",
});

str_enum!(RiskCaseState {
    Open          => "open",
    Investigating => "investigating",
    Resolved      => "resolved",
    FalsePositive => "false_positive",
});

// ═══════════════════════════════ Finance ══════════════════════════════
str_enum!(AccountKind {
    Asset     => "asset",
    Liability => "liability",
    Equity    => "equity",
    Revenue   => "revenue",
    Expense   => "expense",
});

str_enum!(PeriodKind {
    Day     => "day",
    Month   => "month",
    Quarter => "quarter",
    Year    => "year",
});

str_enum!(PeriodState {
    Open    => "open",
    Closing => "closing",
    Closed  => "closed",
});

str_enum!(JournalEntryStatus {
    Draft    => "draft",
    Posted   => "posted",
    Reversed => "reversed",
});

str_enum!(JournalPostedBy {
    System => "system",
    Admin  => "admin",
});

// ═══════════════════════════════ Outbox ══════════════════════════════
str_enum!(OutboxStatus {
    Pending    => "pending",
    Dispatched => "dispatched",
    Failed     => "failed",
    Dropped    => "dropped",
});
