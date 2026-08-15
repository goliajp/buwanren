# unmei · 商业 / 订单 / 支付 · 系统设计 RFC (v2.0)

> 状态:**待审 (Draft)**;作者:claude + doracawl;锚定 2026-06-27。
> 适用:`unmei-api` (:6028) · `unmei-admin-api` (:6029) · `unmei-webadmin` (:6030) · `unmei-wx` crate · PG 18 + kevy。
> 取代:v0.1 单 migration / routes 平铺逻辑 / 单一微信支付硬编码。

---

## §0 文档定位与阅读路径

本文是 unmei 商业子系统的 **架构基线 (architecture baseline)**,不是排期。读完应能回答:

1. 商业子系统由哪些 **业务域 (bounded context)** 组成,各自的边界与责任。
2. **订单系统 (Order)** 与 **支付系统 (Payment)** 的解耦点在哪、各自的状态机。
3. **PaymentAdapter** 抽象层是什么形状,新接一个渠道需要实现什么、不需要做什么。
4. 数据模型(schema v2)长什么样,从 v0.1 怎么演进。
5. 客户端 API、运营后台 API、Webhook 入口、内部 RPC 各自的契约范围。
6. webadmin 11 个商业工作台的信息架构。
7. 合规、对账、退款、风控、财务月报的设计深度。
8. 落地分期 M0–M7 各阶段的「完成 = 什么」。

**阅读路径**:
- 业务 / 产品视角:§1 → §3 域速读 → §7 webadmin → §11 里程碑。
- 后端工程视角:§2 设计原则 → §3 各域聚合根 → §4 PaymentAdapter → §5 schema → §6 API → §8 时序。
- 法务 / 财务视角:§3.13 Finance → §9 合规 → §11 M6/M7。

---

## §1 总览

### 1.1 业务范围

unmei 商业子系统支持以下四类**变现形态**,全部建立在同一套订单 / 支付内核之上:

| 形态 | 典型 SKU | 周期 | 计费触发 |
|---|---|---|---|
| 单次付费 (One-shot) | 「八字深度报告」「合婚双盘」「问事一卦」 | 一次性 | 下单即付 |
| 订阅会员 (Subscription) | 「白银 / 黄金 / 命主」月卡 / 年卡 | 周期 | 周期续费 |
| 实物 / 数字商品 (Catalog Goods) | 手册 / 摆件 / 字画 / PDF / 视频课 | 一次性 | 下单即付 |

> 不做「充值钱包 / 虚拟币 / 储值」形态:无证经营资金 + 用户预付款负债复杂 + 与单次付费市场重合 — 砍掉省 3 张表 + 1 个工作台 + 1 个 adapter,见 §13。

**首批接入支付渠道**:

| 渠道 | 子模式 | 优先级 | 备注 |
|---|---|---|---|
| 微信支付 | JSAPI / 小程序 / H5 / Native | P0 | 国内核心,已有 `unmei-wx/pay.rs` 骨架 |
| 支付宝 | PC / WAP / 小程序 / App | P1 | 国内并列 |
| Apple IAP | 自动续期 / 非自动续期 / 消耗型 / 非消耗型 | P0(iOS) | iOS 上架硬要求 |
| Google Play Billing | One-time / Subscription | P1(Android) | 同上 |
| Stripe | Card / Apple Pay / Google Pay | P2 | 海外卡,Customer Portal 直用 |

**合规档**:**完整合规**(财务月报 + 风控规则引擎 + 数据出境)。详见 §9。

### 1.2 域全景图

```
┌───────────────────────── unmei 商业子系统 (Commerce) ──────────────────────┐
│                                                                            │
│  ┌── 业务域 (9) ──────────────────────────────────────────────────────┐    │
│  │                                                                    │    │
│  │  ┌─ Catalog ─┐  ┌─ Pricing ──┐  ┌─ Promotion ─┐  ┌─ Subscription ┐│    │
│  │  │ 商品/SKU/  │  │ 多区域多平 │  │ 优惠券/促销 │  │ Plan/Cycle/  ││    │
│  │  │ Variant   │  │ 台/分梯度   │  │ /Bundle/Cap │  │ Trial/Grace  ││    │
│  │  └─────┬─────┘  └──────┬─────┘  └──────┬──────┘  └──────┬───────┘│    │
│  │        ▼               ▼               ▼                ▼         │    │
│  │  ┌────────────────────────────────────────────────────────────┐  │    │
│  │  │           Order (订单聚合根) — 业务意图层                 │  │    │
│  │  │  状态机:draft → unpaid → paid → fulfilling → done       │  │    │
│  │  │           → cancelled / refunded / disputed              │  │    │
│  │  └─────────┬───────────────────────────────────┬─────────────┘  │    │
│  │            ▼                                   ▼                │    │
│  │  ┌────────────────────────┐    ┌─────────────────────────────┐ │    │
│  │  │ Payment (支付聚合)     │    │ Shipment (物流履约 · 实物)  │ │    │
│  │  │ pending → success      │    │ preparing → in_transit →    │ │    │
│  │  │  → refunding → refund. │    │ delivered / exception       │ │    │
│  │  └───────┬─────────┬──────┘    └──────────┬──────────────────┘ │    │
│  │          ▼         ▼                      ▼                    │    │
│  │  ┌─ Refund ───┐ ┌─ Settlement ────┐  ┌── CarrierAdapter ──┐   │    │
│  │  │ 全额/部分  │ │ 渠道/内部对账   │  │ 快递100/SF直连/手填 │   │    │
│  │  │ /Trace     │ │ /日切/月切      │  │ poll + webhook       │   │    │
│  │  └────────────┘ └─────────────────┘  └─────────────────────┘   │    │
│  │                                                                  │    │
│  │           ┌── Risk (风控) ──┐                                 │    │
│  │           │ 规则引擎/速率/  │                                 │    │
│  │           │ 黑名单/反欺诈   │                                 │    │
│  │           └─────────────────┘                                 │    │
│  │                                                                  │    │
│  │  ┌── Finance (财务) ──────────────────────────────────────────┐  │    │
│  │  │ 复式账 (Journal) / 试算 / 月报 / MRR/ARR/LTV/Churn / 发票 │  │    │
│  │  └────────────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌── 横切 (3) ──────────────────────────────────────────────────────┐    │
│  │  Audit (审计日志)  · Notification (通知)  · Reporting (报表)    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘
```

**域边界**:每个域有独立的聚合根、状态、不变量,跨域通过 **领域事件 (domain event)** 解耦,不直接读对方表(同 DB 内,但表关系受控)。

### 1.3 现状 vs 目标 · gap 表

| 维度 | v0.1 现状 | v2.0 目标 | gap 量级 |
|---|---|---|---|
| 域边界 | API routes 平铺,`services/` `models/` 空目录 | `unmei-domain` crate 内 10 个 mod,有 trait + Aggregate | 重写 |
| migration | 单文件 `20260626_000_initial.sql` | 版本化 `2026XXXX_NNN_*.sql` 链 + sqlx prepare 校验 | 重组 |
| Order schema | `order_record` 单表 1NF,字段平铺 | order + order_line + order_event + order_meta 4 表;状态机驱动 | 重画 |
| Payment | `payment_order` 单表,渠道字段是 string | payment + payment_attempt + payment_event + 渠道无关字段 | 重画 |
| 适配器 | 微信硬编码在 routes 里 | `PaymentAdapter` trait + 5 个 impl crate(wechat/alipay/stripe/iap/gpb) | 新建 |
| 退款 | 字段 `refunded_at` 但无流程 | Refund 聚合 + 状态机 + 三方回查 + 财务挂账 | 新建 |
| 物流 | 无 | shipment + trace_event + `CarrierAdapter` trait(快递100/Manual P0)+ sweeper 轮询 + 异常处置 | 新建 |
| 订阅 | 无 | subscription + plan + cycle + invoice + dunning | 新建 |
| 营销 | 无 | coupon + promotion + bundle + cap + redemption | 新建 |
| 对账 | 无 | channel_recon + internal_recon + 日切 + 月切 | 新建 |
| 风控 | 无 | risk_rule + risk_event + velocity counter + blacklist | 新建 |
| 财务 | 无 | journal + trial_balance + monthly_report + KPI(MRR/ARR/LTV/Churn) | 新建 |
| 合规 | 无 | 实名 / 发票 / 数据出境 / cancel-anytime / 未成年人 / KYC | 新建 |
| webadmin | 3 页面(Orders/Payments/Products) | 10 工作台(下文 §7) | 大扩 |

**核心判断**:v0.1 是「最小可演示」,v2.0 是「专业商业系统标杆」。两者 schema 不兼容,需要一次性切版(本系统暂无生产数据,直接 reset 优于双写迁移)。

---

## §2 核心设计原则

### 2.1 双域分离 · 订单 ⊥ 支付

**Order 域** 回答的是「**用户要买什么、多少钱、什么状态**」;
**Payment 域** 回答的是「**这笔钱怎么收到、什么时候到、用哪个渠道**」。

二者**不互相依赖实现细节**,只通过领域事件耦合:

```
Order.created       → 创建一个未支付订单
Order.requested_pay → 触发 Payment.create(intent)
Payment.succeeded   → 触发 Order.mark_paid()
Payment.failed      → Order 维持 unpaid,可重发起新 Payment
Order.cancelled     → 触发 Payment.cancel(if pending) 或 Refund.initiate(if paid)
Refund.completed    → 触发 Order.mark_refunded()
```

**一个 Order 可以有 N 个 Payment**(用户支付失败重试 / 切换渠道 / 部分付款等场景)。这是 v0.1 已经在 schema 注释里写过的设计(`payment_order 跟 order_record 1:N`),v2.0 把它做实。

### 2.2 PaymentAdapter 模式

所有支付渠道实现统一 trait:

```rust
#[async_trait]
pub trait PaymentAdapter: Send + Sync {
    fn channel(&self) -> Channel;                 // wechat_jsapi / alipay_wap / iap / stripe_card …
    fn currency_support(&self) -> &[Currency];    // 该渠道支持的币种
    fn capabilities(&self) -> AdapterCapabilities; // 是否支持订阅、是否支持部分退款、回调风格等

    async fn create_payment(&self, req: CreatePaymentRequest) -> Result<CreatePaymentOutcome>;
    async fn query_payment(&self, txn_id: &str) -> Result<PaymentStatus>;
    async fn cancel_payment(&self, txn_id: &str) -> Result<()>;
    async fn refund(&self, req: RefundRequest) -> Result<RefundOutcome>;
    async fn query_refund(&self, refund_id: &str) -> Result<RefundStatus>;

    async fn verify_webhook(&self, headers: &HeaderMap, body: &[u8]) -> Result<WebhookEvent>;
    async fn pull_settlement(&self, day: NaiveDate) -> Result<Vec<ChannelTxn>>; // 拉日切对账文件
}
```

**关键设计**:
- `CreatePaymentOutcome` 是一个 enum,含 `Redirect{url}` / `Jsapi{params}` / `Native{qr}` / `Immediate{success}`/ `Pending{poll_after}` 等所有渠道形态。**调用方代码只判断 outcome 类型,不判断 channel**。
- `verify_webhook` 是渠道无关接口 — 微信/支付宝/Stripe 各自的签名验证、IAP/GPB 的收据校验,统一翻译为同一种 `WebhookEvent` enum(`PaidSucceeded / PaidFailed / RefundSucceeded / SubscriptionRenewed / SubscriptionExpired / Disputed`)。
- 同一 trait 也方便日后接「钱包」「积分」等内部账号 adapter — 本 v2.0 范围内不做(见 §13),只留接口口子。

详见 §4。

### 2.3 聚合根 + 领域事件

| 域 | 聚合根 | 关键事件 |
|---|---|---|
| Catalog | `Product` | ProductCreated / Updated / Discontinued |
| Pricing | `PriceBook` | PriceUpdated / PromotionStarted |
| Promotion | `Coupon` / `Promotion` | CouponIssued / Redeemed / Expired |
| Subscription | `Subscription` | SubscriptionStarted / Renewed / PastDue / Cancelled / Expired |
| Order | `Order` | OrderCreated / Paid / Fulfilled / Cancelled / Refunded / Disputed |
| Payment | `Payment` | PaymentCreated / Succeeded / Failed / Expired / Refunded |
| Refund | `Refund` | RefundInitiated / Succeeded / Failed |
| Shipment | `Shipment` | ShipmentCreated / TrackingNoAssigned / InTransit / Delivered / Exception / Returning / Returned |
| Settlement | `ReconBatch` | BatchPulled / BatchMatched / DiscrepancyFound / Resolved |
| Finance | `JournalEntry` | EntryPosted / PeriodClosed |
| Risk | `RiskCase` | RuleTriggered / CaseOpened / Decision / Closed |

事件实现:**Outbox 模式** — 写业务表的事务里同写 `outbox_event`,后台 dispatcher 异步分发(同进程 channel 即可,无 MQ 依赖,kevy 当 dedup 锁)。

### 2.4 状态机 — 强约束流转

每个聚合根有一张表的 `status` 字段,**所有写操作必须走 service 方法**(不允许 SQL 直接 UPDATE status)。
service 方法内部:**检查 from_status ∈ allowed_set → 写新 status → 同事务写 event**。

状态机定义集中在 `unmei-domain` 的 `state_machine.rs`,用常量表表达,跟代码同语言:

```rust
pub const ORDER_TRANSITIONS: &[(OrderStatus, OrderStatus, OrderEvent)] = &[
    (Draft,        Unpaid,     OrderCreated),
    (Unpaid,       Paid,       OrderPaid),
    (Unpaid,       Cancelled,  OrderCancelled),
    (Paid,         Fulfilling, OrderFulfillStarted),
    (Fulfilling,   Done,       OrderFulfilled),
    (Paid,         Refunding,  RefundInitiated),
    (Fulfilling,   Refunding,  RefundInitiated),
    (Done,         Refunding,  RefundInitiated),
    (Refunding,    Refunded,   RefundCompleted),
    (Paid,         Disputed,   DisputeOpened),
    // ...
];
```

详细状态机见 §3 各域。

### 2.5 幂等 + 补偿 + 最终一致

- **幂等键**:所有写接口必带 `Idempotency-Key`(客户端 UUID v4),服务端 `kevy` 存 24h,命中即返回缓存的旧 response。
- **回调幂等**:`payment_event` 表唯一索引 `(channel, channel_event_id)`,重复回调直接 ignore-and-200。
- **补偿**:回调丢失 → 后台 `payment_query_sweeper` 每 30s 扫 pending payment,直接查渠道 `query_payment` 拉准状态;Refund 同样有 sweeper。
- **最终一致**:订单的 fulfillment(发货/解锁内容/生成排盘报告)是异步的,事件驱动;客户端 poll order.status 或订 SSE。

### 2.6 钱(Money)类型 + 多币种

```rust
pub struct Money {
    pub amount_minor: i64,   // 最小货币单位(分 / cent / satoshi),i64 避免浮点
    pub currency: Currency,  // ISO 4217:CNY/USD/EUR/HKD/JPY,iso<3-byte>
}
```

**所有金额字段**(DB + API + 前端)都用 minor unit,前端展示时按 `currency` 的小数位除转。**绝不在内部用 yuan/dollar 单位**。
**禁止 float**:DB 用 `BIGINT`,Rust 用 `i64`,JSON 用 string(避免 JS Number 精度损失)。

### 2.7 时间 / 时区 / 审计

- 所有时间字段 PG `TIMESTAMPTZ`(已是 v0.1 选型,延续)。
- 业务时间(订单时间、支付时间、续费时间)**永远存 UTC**,展示时按用户/管理员时区(`profile.tz`)折算。
- 财务结账按**指定结算时区**(默认 `Asia/Shanghai`)统一切日 / 切月,不跟用户时区耦合。
- 所有写接口产 `audit_log`:`(actor, actor_type, action, resource, before, after, ip, ua, ts)`。

---

## §3 域设计 · 逐章

各域章节模板:**聚合根 / 字段要点 / 状态机 / 不变量 / 关键接口 / 关键事件 / 注意点**。

### 3.1 Catalog · 商品域

#### 聚合根:`Product` + `Sku`

一个 `Product` 是用户可见的「商品」(如「八字深度报告」);其下挂 N 个 `Sku` (Stock Keeping Unit,如「报告 + 1 次 AI 解读」「报告 + 5 次解读」「报告 + 名字」)。Sku 是定价 / 库存 / 发货 / 订阅计费的最小单位。

#### 关键字段(摘)

```
product:
  id, code, name, category, kind (one_shot/subscription/digital_goods/service)
  status (draft/listed/delisted/discontinued)
  description_md, hero_image_url, gallery_json
  default_locale, available_locales (text[]), available_regions (text[])
  available_platforms (text[]),     -- wx_mp, wx_h5, ios, android, web
  required_inputs (jsonb),          -- 排盘需哪些输入(年月日时地/姓名/性别)
  fulfillment_kind (instant/async_compute/manual/shipping)
  tags (text[]), created_at, updated_at

sku:
  id, product_id, code, name
  spec_json,                        -- 规格(如解读次数、报告页数、订阅天数)
  stock_kind (unlimited/limited/per_user_cap)
  stock_count (nullable), per_user_cap (nullable)
  default_currency, status
```

#### 关键接口

- 管理:`admin: create_product / update / list / discontinue / list_skus / add_sku / update_sku`
- 客户端:`bff: list_products(filter) / get_product(id) / get_skus(product_id)`

#### 注意点

- 「商品」与「定价」**分表**:`sku` 不存价格,价格在 `price_book`(§3.2)。这样多区域多平台多币种不污染主表。
- 排盘类商品 `fulfillment_kind=async_compute`,下单后由 Order Fulfillment Worker 调 `mingli-api:6027` 算盘,结果落 `natal` / `naji_record` 表关联 order_line。

### 3.2 Pricing · 定价域

#### 聚合根:`PriceBook` + `PriceRule`

支持「**同 SKU,不同区域 + 平台 + 时段 + 用户分群 + 数量梯度,不同价**」。

#### 关键字段

```
price_book:
  id, sku_id, currency, price_minor (i64)
  region (cn/us/hk/global), platform (wx_mp/wx_h5/ios/android/web/all)
  effective_from, effective_to (nullable)
  tier_kind (flat/qty_tier/user_tier), tier_json
  status (active/scheduled/expired)
  created_at, created_by_admin_id, audit_note

price_rule (复合规则):
  id, name, scope (sku_id list), match_json (用户标签/会员等级/平台/region)
  override_price_minor (nullable), override_pct (nullable)  -- 二选一
  effective_from, effective_to, priority
```

#### 不变量

- 任一 `(sku, region, platform, time)` **有且仅有一条** active `price_book`;后台规则:新版本 effective 时,旧版本必须 effective_to ≤ 新版 from(保证时序无重叠)。
- 历史价格不可删,只能 `status=expired`(对账与审计追溯需要)。

#### 关键接口

- 管理:`admin: list_prices(sku) / publish_price / expire_price / preview_effective_price(sku, ctx)`
- 内部:`pricing::quote(sku, ctx) -> Money` — 给一个上下文(用户、区域、平台、数量)返回当前应用价(经过 PriceRule 覆盖)。
- 客户端:走 `bff: get_skus`,价格由 BFF 内部 quote 后返回。

### 3.3 Promotion · 营销域

#### 聚合根:`Promotion` / `Coupon`

- `Promotion`:**店铺侧促销**,自动触发(如「全场 9 折」「双 11 满 100 减 20」「新人首单 8 折」)。
- `Coupon`:**用户侧凭证**,由 promo 发放或运营手动发放,需要兑换码或主动选用。

#### 关键字段

```
promotion:
  id, code, name, kind (pct_off/amount_off/bxgy/bundle/cap_only)
  match_json,                                -- 适用 SKU / 类别 / 用户分群 / 渠道
  rule_json,                                 -- 触发条件(最低金额、最低件数、组合规则)
  benefit_json,                              -- 优惠金额、百分比、赠送 SKU
  effective_from, effective_to
  budget_minor (nullable),                   -- 预算总额(分),用完即停
  per_user_cap, total_cap, daily_cap
  stackable (bool), priority
  status (draft/scheduled/active/paused/exhausted/ended)

coupon:
  id, code (unique nullable), batch_id, promotion_id (nullable)
  owner_user_id (nullable; null = 待领取)
  benefit_json,
  state (issued/locked/redeemed/expired/revoked)
  issued_at, redeemed_at, expires_at

coupon_redemption:
  id, coupon_id, order_id, applied_amount_minor, applied_at
```

#### 不变量

- `coupon.state` 严格状态机:issued → locked(下单锁定)→ redeemed(订单完成)或 → issued(订单取消释放) → expired。
- `budget_minor` 扣减用乐观锁 + 重试,防超发。
- 同一订单可叠加多 promo / coupon,**叠加优先级**显式声明在 promo.priority,等价于规则引擎里的「策略组合」。

#### 关键事件

`CouponIssued / CouponLocked / CouponRedeemed / CouponReleased / CouponExpired / PromotionExhausted`。

### 3.4 Subscription · 订阅域

#### 聚合根:`Plan` + `Subscription`

- `Plan`:订阅计划(白银 / 黄金 / 命主月卡 / 年卡 / 终身)— 是一种特殊 SKU,但有续费周期、试用期、宽限期、降级升级规则。
- `Subscription`:用户与 Plan 的一笔订阅关系,有完整状态机。

#### 关键字段

```
plan:
  id, sku_id (linked), name, billing_period (month/quarter/year/lifetime)
  trial_days, grace_days,                    -- 试用与宽限
  entitlements_json,                         -- 解锁了什么(每天排盘 N 次 / 高阶分析 / AI 解读次数 / 等)
  cancel_policy (immediate/end_of_period),
  prorate_on_upgrade (bool),
  channel_constraints,                       -- IAP 必须走 IAP,Stripe 必须走 Stripe(各渠道订阅互不通用)

subscription:
  id, user_id, plan_id
  status (trialing/active/past_due/grace/cancelled/expired/paused)
  source_channel,                            -- 哪个支付渠道开通的(决定 renew/cancel API 入口)
  source_payment_id,                         -- 首次支付的 payment.id
  current_period_start, current_period_end
  next_billing_attempt_at (nullable),
  cancel_at_period_end (bool), cancelled_at (nullable)
  upgrade_from_subscription_id (nullable), prorate_credit_minor (nullable)
  created_at, updated_at

subscription_invoice:
  id, subscription_id, period_start, period_end
  amount_minor, currency, status (open/paid/uncollectible/void)
  payment_id (nullable),
  attempt_count, last_attempt_at, next_attempt_at
```

#### 状态机

```
                ┌──── upgrade ────────┐
                │                     ▼
new ─create→ trialing ── trial_end ─→ active ── period_end_renew_ok ─→ active
                │            │            │
                │ cancel     │ cancel     │ renew_fail
                ▼            ▼            ▼
            cancelled ←─ cancelled    past_due ── retries_ok ─→ active
                                          │
                                          │ retries_exhausted
                                          ▼
                                       grace ── grace_end_no_pay ─→ expired
                                          │
                                          └─ pay_during_grace ─→ active
```

#### 关键流程

- **续费**(dunning):period_end 前 1 天起 `next_billing_attempt_at` 调度,失败重试 3 次(0/1d/3d/7d),全失败进入 grace_days,grace 末仍未付则 expired。
- **升级**:从 `month` 升 `year`,按 prorate 计算余额 credit,折抵新订单;`upgrade_from_subscription_id` 串联追溯。
- **跨渠道**:Apple IAP / Google Play / 微信支付 / Stripe 的订阅互相**不通用**(IAP 续费走 Apple,不能切微信)。允许同一用户在不同渠道开多份(运营层去重)。

### 3.5 Order · 订单域 ⭐

订单是商业子系统的核心聚合根。一笔订单聚合:**N 个商品行 + 0–M 个优惠 + 0–1 个收货地址 + N 个状态事件 + 1–N 个支付**。

#### 聚合根:`Order` + `OrderLine` + `OrderEvent` + `OrderMeta`

```
order:
  id (uuid),
  user_id,
  channel_origin (wx_mp/wx_h5/ios/android/web/admin),      -- 下单时的端
  currency,
  amount_subtotal_minor,                                    -- 商品行小计
  amount_discount_minor,                                    -- 优惠抵扣
  amount_shipping_minor,                                    -- 运费
  amount_tax_minor,                                         -- 税(海外版)
  amount_total_minor,                                       -- 应付
  amount_paid_minor,                                        -- 已付(部分支付场景)
  amount_refunded_minor,                                    -- 已退
  status (draft/unpaid/paid/fulfilling/done/cancelled/refunded/refund_partial/disputed),
  source_kind (one_shot/subscription_initial/subscription_renew),
  source_ref_id (nullable),                                 -- 订阅订单关联 subscription.id
  expires_at,                                               -- 待支付超时(默认 30 min)
  paid_at, fulfilled_at, cancelled_at,
  cancel_reason, cancel_actor,
  receipt_kind,                                             -- 不开 / 收据 / 普通发票 / 增值税专票
  receipt_meta_json,                                        -- 抬头、税号、邮箱、收据 url
  region,                                                   -- 下单时确定的销售地(影响税法、合规)
  ip, ua, risk_score,                                       -- 下单时风控快照
  audit_note,
  created_at, updated_at

order_line:
  id, order_id, line_no,
  sku_id, sku_snapshot_json,                                -- 下单时刻 SKU 快照(防后续改名/改价错乱)
  unit_price_minor, qty, line_subtotal_minor,
  applied_promo_ids (text[]), applied_coupon_ids (text[]),
  applied_discount_minor,
  fulfillment_status (pending/processing/done/failed),
  fulfillment_ref (jsonb)                                   -- {natal_id, report_url, …}

order_event:
  id, order_id, kind (OrderCreated / Paid / Fulfilled / …),
  actor_kind (user/system/admin/webhook), actor_id,
  before_status, after_status,
  meta_json,
  created_at

order_meta:
  order_id (PK), shipping_address_json, contact_json, gift_note, ...
  -- 1:1 拆分热字段,避免 order 主表过宽
```

#### 状态机

```
draft ──confirm──→ unpaid ──pay_ok──→ paid ──fulfill_start──→ fulfilling ──done──→ done
   │                  │ │                                          │              │
   │ abandon          │ │ timeout                                  │              │
   ▼                  │ ▼                                          │              │
cancelled             │ cancelled                                  │              │
                      │                                            │              │
                      └─ cancel(user/admin)──→ cancelled           │              │
                                                                    │              │
                       refund(partial/full) ←─────────────── refunding ←──────────┘
                                                                    │
                                                          refund_partial / refunded

dispute(any from paid+) ──→ disputed ──resolve──→ paid / refunded
```

#### 不变量

- `amount_total_minor = subtotal - discount + shipping + tax`(下单瞬间冻结,后续不可改)。
- `amount_paid_minor + 待结 - amount_refunded_minor = 实际净收入`,任一时刻 = sum(payment.amount where status=success) - sum(refund.amount where status=success);后台对账 sweeper 会校验。
- `status=paid` 当且仅当 `amount_paid_minor ≥ amount_total_minor`(支持部分付款时是 ≥ ; 普通场景就是 =)。
- 价格、SKU、用户、地址,**一律在下单时刻 snapshot 进 line.sku_snapshot_json / order_meta**;后续 SKU 改名 / 改价不污染历史订单。

#### 关键接口

- 客户端:`POST /v1/orders`(下单)`/ POST /v1/orders/{id}/pay`(发起支付)`/ POST /v1/orders/{id}/cancel`(取消)`/ GET /v1/orders/{id}` / `GET /v1/orders` 列表
- 管理:`admin: list_orders(filter) / get_order / refund / cancel / annotate / export / re-fulfill`
- 内部:`order::fulfill_async(order_id)` — 异步发货 worker。

### 3.6 Payment · 支付域 ⭐

#### 聚合根:`Payment` + `PaymentAttempt` + `PaymentEvent`

```
payment:
  id (uuid; 我方流水号 = out_trade_no),
  order_id,                                  -- 不指订阅 invoice 直接;invoice 通过 order 串
  user_id,
  channel,                                   -- wechat_jsapi / wechat_mp / wechat_h5 / wechat_native / alipay_wap / iap / gpb / stripe_card
  amount_minor, currency,
  status (pending/processing/success/failed/expired/cancelling/cancelled/refunding/refunded/refunded_partial/disputed),
  channel_txn_id (nullable),                 -- 渠道返回的交易号
  channel_user_ref,                          -- openid / apple_account_token / stripe_pi_id
  paid_at (nullable),
  expires_at,                                -- pending 过期时刻(渠道侧)
  failure_code, failure_msg,
  metadata_json,                             -- 渠道私有字段透传
  created_at, updated_at

payment_attempt:
  id, payment_id, attempt_no,
  request_payload_json,                      -- 调渠道的入参
  response_payload_json,                     -- 渠道返回
  latency_ms, error_kind, created_at

payment_event:
  id, payment_id, kind (Created/SucceededByCallback/SucceededByQuery/Failed/Refunded…),
  channel, channel_event_id,                 -- 渠道事件唯一 id;UNIQUE INDEX(channel, channel_event_id)
  payload_json, received_at, processed_at
```

#### 状态机

```
pending ──submit→ processing ──ok──→ success ──refund→ refunding ──ok──→ refunded
   │                  │ │                                  │             │
   │ expire           │ │ fail                             │ partial     │
   ▼                  │ ▼                                  ▼             ▼
expired               │ failed                       refunded_partial    refunded
                      │
                      └─cancel→ cancelling → cancelled
```

#### 关键流程

- **创建**:Order.requested_pay 触发 → 选 channel → adapter.create_payment → 返回 `CreatePaymentOutcome`(JSAPI 参数 / 跳转 URL / 二维码 / 立即成功)→ Order 不动,Payment 进入 pending。
- **回调闭环**:渠道 webhook → /v1/webhooks/{channel} → adapter.verify_webhook → WebhookEvent → PaymentService.apply_event(幂等 by (channel, channel_event_id)) → 状态推进 → 发 OrderPaid 领域事件 → Order.mark_paid → 通知 / 入账。
- **拉准 (query sweep)**:每 30s 扫 pending 超过 1 min 的 payment → adapter.query_payment → 拉准状态。容忍丢失 webhook。
- **手动核账**(运营):后台有「拉单核对」按钮(传日期 → adapter.pull_settlement → 与我方对比 → 标记 discrepancy)。

#### 不变量

- 一个 payment 状态只能单向推进(refunded 是终态,不能回 success)。
- channel_event_id 跨表唯一,保证回调幂等。
- payment.amount_minor 与 order.amount_total_minor 关系:
  - 单 payment 完整支付:相等。
  - 多笔重试:同一 order 上一笔 payment 失败、换渠道重发,success 时累加 ≥ total。
  - 部分退款:有效金额 = sum(success) - sum(refund.success)。

### 3.7 Refund · 退款域

#### 聚合根:`Refund`

```
refund:
  id, order_id, payment_id (退到哪笔支付),
  amount_minor, currency,
  reason_code, reason_text, actor_kind (user/admin/system), actor_id,
  status (requested/approved/processing/success/failed/cancelled),
  channel_refund_id,
  approved_at, approved_by_admin_id,
  processed_at, completed_at,
  failure_code, failure_msg,
  audit_note
```

#### 流程

```
requested ──admin_approve──→ approved ──adapter.refund──→ processing ──webhook_ok──→ success
    │           │                                            │
    │ deny      │                                            │ fail
    ▼           ▼                                            ▼
cancelled    cancelled                                     failed → admin retry
```

#### 规则

- **审核**:金额 < 阈值(配置)可自动批,> 阈值需管理员审。
- **来源**:用户主动申请 / 运营主动 / 争议(dispute)裁决。
- **多次退**:同 order 可发起 N 个 refund,累计金额 ≤ 已付金额。
- **联动**:成功后:
  1. 写 finance journal(收入冲销)
  2. 触发 Order.mark_refunded 或 refund_partial
  3. 释放已用 coupon(如可逆)
  4. 订阅 → 联动 cancel_at_period_end
  5. 如订单已发货(实物):触发 Shipment.mark_returning(等待退货签收 / 或直接核销看政策)

### 3.8 Shipment · 物流履约域(实物商品)

**范围与边界**:本域**只做物流追踪**,不做仓储 / 多仓 / 自动分仓 / 库存预占。适用场景:unmei 团队自营单仓发货实物(命理手册、定制摆件、字画卷轴、纸质报告等);用户自付邮费或包邮(在 Pricing 域已计税)。

> 「物流」≠「仓储」:仓储是把货物存哪、谁来拣货、何时补货;物流是货已经在路上、追踪它走到哪。前者牵涉 WMS、库位、波次、人力,我们不做;后者只需「单号 + 承运商 + trace 流水」,我们做。

#### 聚合根:`Shipment` + `ShipmentTraceEvent`

```
shipment:
  id (uuid),
  order_id,
  order_line_ids (text[]),                       -- 该包裹覆盖哪些 order_line(实物行)
  carrier_code,                                  -- sf / jd / zto / yto / yunda / ems / usps / dhl / fedex / ups / manual / other
  tracking_no,                                   -- 物流单号;manual 时为空
  recipient_snapshot_json,                       -- 收件人快照(姓名/电话/地址/zipcode)
  shipping_method,                               -- standard / express / overnight / pickup
  weight_g, dim_cm_json,                         -- 重量与尺寸(选填,有助报关 / 索赔)
  status,                                        -- preparing / picked_up / in_transit / out_for_delivery / delivered / exception / returning / returned
  picked_up_at, delivered_at,
  cost_minor, cost_currency,                     -- 邮费成本(财务用),与下单时显示给用户的运费 (order.amount_shipping_minor) 解耦
  carrier_meta_json,                             -- 承运商私有字段透传
  audit_note, created_at, updated_at

shipment_trace_event:
  id, shipment_id,
  event_at,                                      -- 物流公司侧的事件时间
  event_kind,                                    -- picked_up / arrived_at_sort_facility / departed / out_for_delivery / delivered / failed_delivery / returned / exception
  location, description,
  raw_source,                                    -- kuaidi100 / kdniao / sf_direct / manual
  raw_payload_json,                              -- 原始返回(审计 + 重放)
  received_at                                    -- 我方收到 / 拉到这条事件的时间
```

#### 状态机

```
preparing ──pickup_label──→ picked_up ──departs──→ in_transit ──last_mile──→ out_for_delivery ──→ delivered
    │                              │                   │                            │                 │
    │ cancel                       │ exception         │ exception                  │ failed_delivery │
    ▼                              ▼                   ▼                            ▼                 │
cancelled                     exception ←─────────────┴────────────────────────────┘                  │
                                  │                                                                   │
                                  │ resolved(继续)                                                  │
                                  ▼                                                                   │
                              in_transit                                                              │
                                                                                                       │
                              returning ←─── 用户退货 / 拒签 / 我方主动召回 ────────────────────────┘
                                  │
                                  ▼
                              returned
```

#### 触发与流程

1. **创建**:Order.paid 后,fulfillment_worker 扫 order_line,凡是 `sku.fulfillment_kind=shipping` 的 line 聚合到一个 shipment(默认合单;运营可拆单)。初始 status=preparing,tracking_no 留空。
2. **录入运单号**(运营):webadmin 选择承运商 + 录入运单号 → status→picked_up + 立即触发首次 trace 拉取。
3. **轮询拉 trace**:`shipment_trace_sweeper`(每 15min)扫 status ∈ {picked_up, in_transit, out_for_delivery, exception} 的 shipment → 调 `CarrierAdapter.query_trace` → 新事件 insert + status 自动推进。
4. **Webhook**(顺丰 / 京东 / 部分平台支持):POST /v1/webhooks/carrier/{provider} → 验签 → translate → 同步 status / 写 trace event。
5. **送达**:status=delivered → 触发 `OrderFulfilled` 域事件(对该 line)→ 全部 line done → Order.mark_done。
6. **异常**:any → exception(物流停滞 48h、揽收失败、地址错误、转运失败等)→ webadmin 红点 → 运营处置(改地址 / 联系客服 / 重发 / 退款)。
7. **退货 / 拒签**:status→returning → 物流到件 → returned → 触发 Refund(若策略允许)+ 财务调整。

#### CarrierAdapter trait

```rust
#[async_trait]
pub trait CarrierAdapter: Send + Sync + 'static {
    fn provider(&self) -> CarrierProvider;        // Kuaidi100 / Kdniao / SfDirect / Manual / AfterShip
    fn supported_carriers(&self) -> &[CarrierCode];

    async fn query_trace(
        &self,
        carrier: CarrierCode,
        tracking_no: &str,
    ) -> Result<Vec<TraceEvent>, AdapterError>;

    async fn verify_webhook(
        &self,
        headers: &HeaderMap,
        body: Bytes,
    ) -> Result<TraceWebhookEvent, AdapterError>;

    fn capabilities(&self) -> CarrierCapabilities;  // supports_webhook / supports_label_purchase / cost_per_query
}
```

#### 适配器选型

| Provider | 实现层 | 覆盖范围 | 风格 |
|---|---|---|---|
| **Kuaidi100** | unmei-carrier-kuaidi100 (新) | 国内 200+ 快递 | 聚合 API · poll 为主,提供 webhook |
| Kdniao (快递鸟) | unmei-carrier-kdniao (备选) | 国内 + 部分跨境 | 同上 |
| AfterShip | unmei-carrier-aftership (新) | 国际通用,1000+ 承运商 | 标准化 webhook |
| SfDirect (顺丰) | unmei-carrier-sf (可选) | 仅顺丰 | 官方直连,精度更高 |
| Manual | (内置 noop) | n/a | 运营手填 trace,适用偏远地区 / 平邮 |

**首批**:Kuaidi100(P0,覆盖国内绝大多数自营场景)+ Manual(P0,兜底);AfterShip / SfDirect 海外或下沉时再上。

#### 关键不变量

- 一个 order 可以有 N 个 shipment(分批发货 / 拆单);每个 shipment 覆盖的 order_line_ids 互不重叠。
- shipment.status=delivered ⟺ 该 shipment 所有 line 的 fulfillment_status 推为 done(数字商品已在 §3.5 流程内独立 done,实物走本域 done)。
- 一条 trace event 用 `(shipment_id, raw_source, raw_event_id)` 去重(同事件不重复入库)。
- shipment.cost_minor 是**承运商账单价格**,与用户付的 `order.amount_shipping_minor` 分离(后者是定价策略);二者 P&L 差额是「物流毛利 / 亏损」财务报表项。

#### 关键事件

`ShipmentCreated / TrackingNoAssigned / ShipmentInTransit / ShipmentDelivered / ShipmentException / ShipmentReturning / ShipmentReturned`。

#### 关键接口

- 客户端:`GET /v1/orders/{id}/shipments`(订单下所有包裹) / `GET /v1/orders/{id}/shipments/{sid}/trace`(单包裹 trace 流水)
- 管理:`admin: list_shipments(filter) / detail / set_tracking_no(sid, carrier, no) / force_query / mark_exception / mark_returning / annotate / export`
- 内部:`shipment::create_from_order(order_id)` 由 fulfillment_worker 调用;`shipment_trace_sweeper` 后台 worker。
- Webhook:`POST /v1/webhooks/carrier/{provider}`(顺丰直连 / AfterShip)。

#### 与 Refund 的协作

- 已 delivered 后用户退货 → admin 在 webadmin 一键「退货退款」→ 创建 returning shipment(逆向)+ Refund(状态 pending,待收货)→ returned 收到货 → Refund 转 approved。
- 已 in_transit 用户撤单 → 看承运商:支持「拒收 + 原路退回」就走 returning;不支持就只能等签收后退货。
- 已发货又申请退款的财务挂账:物流费默认不退(运费已实际产生),退款金额 = order.total - actual_shipping_cost_consumed(可配置)。

#### 🟡 待定项(M2 落地前需对齐运营)

- 合单 vs 拆单的默认规则(按 SKU 类目 / 重量 / 总额 阈值)
- 偏远地区 / 海外 / 离岛的运费规则与承运商可达性
- 退货收件地址(自营仓 vs 第三方代收)
- 跨境实物(海外用户买中国摆件)的报关 / 关税承担方

### 3.11 Settlement · 对账域

#### 聚合根:`ReconBatch` + `ReconRecord`

```
recon_batch:
  id, channel, batch_date,
  source (channel_pulled/internal_snapshot),
  total_count, total_amount_minor,
  status (pulled/parsed/matched/has_discrepancy/resolved/closed),
  pulled_at, matched_at, resolved_at

recon_record:
  id, batch_id, channel_txn_id, channel_amount_minor,
  matched_payment_id (nullable),
  match_state (matched/missing_in_channel/missing_in_internal/amount_mismatch/status_mismatch),
  resolved_by_admin_id, resolved_action, resolved_at
```

#### 流程

- **每日 02:30**(可调度,各渠道结算时间不同)启动 channel-recon job:
  1. 调 `adapter.pull_settlement(yesterday)` 拉账单(微信支付有专门 API,Stripe 有 reports,IAP/GPB 有 Apps/Play Console reports)。
  2. 解析→ insert recon_record。
  3. 对账:左连接 payment 表按 `channel_txn_id`,标 match_state。
  4. 异常项进 webadmin「对账异常」面板,运营手动核对处理。
- **每月 1 号**(自然月切)启动 internal-recon job:
  1. 物化我方账(payment.success + refund.success + journal_entry)。
  2. 交叉校验三个口径数字一致(理论上恒成立,不一致是 bug)。

### 3.12 Risk · 风控域

#### 聚合根:`RiskRule` + `RiskCase` + 速率计数 `RiskCounter`

```
risk_rule:
  id, name, kind (pre_order/pre_pay/post_pay/refund/login),
  expression,                            -- 简易 DSL: amount > 1000 AND user.age_days < 1
  action (allow/challenge/block/review/log_only),
  priority, status, effective_from/to

risk_event:
  id, kind, user_id, order_id (nullable), payment_id (nullable),
  matched_rule_ids (uuid[]),
  decided_action,
  details_json, decided_at

risk_case:
  id, kind, severity (low/med/high/critical),
  involved_user_ids (uuid[]), involved_order_ids,
  state (open/investigating/resolved/false_positive),
  assigned_admin_id, opened_at, closed_at, audit_note
```

#### DSL(MVP)

简易表达式:`field op value [AND ...]`,支持字段 `amount / count_in_window(24h) / user.is_new / user.country / ip.country / device.fp_seen_count`。

后续可换 CEL / wasm 沙箱。MVP 用 Rust 内手写 parser + evaluator。

#### 实际规则示例

- pre_pay:`amount > 100000 AND user.age_days < 7` → action=review
- pre_pay:`count_in_window(payment, user_id, 1h) > 5` → action=challenge
- refund:`refund_count_in_30d(user_id) > 5` → action=review
- post_pay:`ip.country != user.country` → action=log_only

#### 速率限制(velocity)

`risk_counter`:`(user_id, event_kind, window)` → count。kevy 当 store(原子 INCR + TTL),持久回流 PG 留审计。

### 3.13 Finance · 财务域

#### 聚合根:`JournalEntry`(分录) + `Period`(会计期间)

**核心理念**:用复式记账 (double-entry bookkeeping) 给所有钱流落一份不可改的账,与业务表平行存在。账目永远配平 (debits = credits)。

```
account_chart:                              -- 科目表
  code (PK), name, kind (asset/liability/equity/revenue/expense),
  parent_code, currency_constraint

journal_entry:
  id, period_id, description,
  posted_at, posted_by_kind (system/admin), posted_by_id,
  business_kind, business_ref_id,           -- 关联 order/payment/refund
  is_reversal_of (nullable),                -- 冲销分录指向被冲销分录
  status (draft/posted/reversed)

journal_line:
  id, entry_id, line_no,
  account_code, debit_minor, credit_minor, currency,
  ref_kind, ref_id, note
  -- 每笔 entry 的 sum(debit)=sum(credit) 内部必校

period:
  id, kind (day/month/quarter/year), year, sub,
  state (open/closing/closed),
  opened_at, closed_at, closed_by_admin_id
```

#### 典型分录

| 业务 | Debit | Credit | 备注 |
|---|---|---|---|
| 微信支付报告 ¥30 | 第三方在途款 ¥30 | 主营业务收入 ¥30 | 渠道未到账 |
| 渠道结算到账 | 银行存款 ¥30 | 第三方在途款 ¥30 | 在途清账 |
| 退款 ¥30 | 主营业务收入(冲销)¥30 | 银行存款 ¥30 | 收入冲减 |
| 用户付运费 ¥10 | 应收(随订单)¥10 | 运费收入 ¥10 | 与商品收入分账,便于物流毛利分析 |
| 物流账单(承运商月结)¥8 | 物流费用 ¥8 | 应付承运商 ¥8 | 实际发生 cost,计提 |
| 实际付承运商 ¥8 | 应付承运商 ¥8 | 银行存款 ¥8 | 清账 |

#### 财务报表(月报)

- 收入 (revenue):分 SKU 类别 / 分区域 / 分渠道
- 退款率 (refund rate):退款 / 应收
- 渠道手续费 (channel fee):各渠道
- 现金到账 (cash in / out)
- **MRR / ARR**(订阅):月经常性收入 / 年化经常性收入
- **Churn**(订阅流失):cancel + expire,按 cohort
- **LTV**(用户终生价值):按 cohort
- **物流毛利**(实物):sum(运费收入) − sum(物流费用),细分到承运商
- 试算平衡表 (trial balance):每月期末

### 3.14 横切:Audit / Notification / Reporting

- **audit_log**:每个写动作必产一条,带 actor/action/resource/before/after/ip/ua。
- **notification**:`outbox_event → dispatcher → 渠道`(短信 / 邮件 / 微信模板 / 推送 / Slack)。商业事件订阅:`OrderPaid → 用户感谢 + 运营 Slack;PaymentFailed → 用户提示;RefundCompleted → 用户致歉;Dispute → 运营群`。
- **reporting**:日 / 周 / 月报表预生成,落 `report_snapshot` 表,webadmin 直接读快照。

---

## §4 PaymentAdapter trait 规范

### 4.1 trait 定义(冻结)

```rust
#[async_trait]
pub trait PaymentAdapter: Send + Sync + 'static {
    fn channel(&self) -> Channel;
    fn capabilities(&self) -> AdapterCapabilities;
    fn supported_currencies(&self) -> &[Currency];

    async fn create_payment(
        &self,
        req: CreatePaymentRequest,
    ) -> Result<CreatePaymentOutcome, AdapterError>;

    async fn query_payment(
        &self,
        ctx: QueryContext,
    ) -> Result<RemotePaymentStatus, AdapterError>;

    async fn cancel_payment(
        &self,
        ctx: QueryContext,
    ) -> Result<(), AdapterError>;

    async fn refund(
        &self,
        req: RefundRequest,
    ) -> Result<RefundOutcome, AdapterError>;

    async fn query_refund(
        &self,
        ctx: QueryContext,
    ) -> Result<RemoteRefundStatus, AdapterError>;

    async fn verify_webhook(
        &self,
        headers: &HeaderMap,
        body: Bytes,
    ) -> Result<WebhookEvent, AdapterError>;

    async fn pull_settlement(
        &self,
        day: NaiveDate,
        currency: Currency,
    ) -> Result<Vec<ChannelTxnRow>, AdapterError>;
}

pub struct AdapterCapabilities {
    pub partial_refund: bool,
    pub subscription: bool,
    pub off_session_charge: bool,        // Stripe SetupIntent 类型
    pub cancel_pending: bool,
    pub three_d_secure: bool,
    pub settlement_pull: bool,
    pub max_amount_minor: Option<i64>,
}

pub enum CreatePaymentOutcome {
    Jsapi { params: JsonValue },                   // 微信 JSAPI / 小程序
    Redirect { url: Url },                         // 微信 H5 / 支付宝 WAP
    NativeQr { code_url: Url },                    // 微信 Native
    StripePaymentIntent { client_secret: String }, // Stripe Elements
    IapVerifiable { challenge_token: String },     // IAP/GPB:客户端拿这个 token + 收据回调
}

pub enum WebhookEvent {
    PaymentSucceeded { txn_id: String, paid_at: DateTime<Utc>, raw_amount_minor: i64 },
    PaymentFailed    { txn_id: String, code: String, msg: String },
    PaymentExpired   { txn_id: String },
    RefundSucceeded  { refund_id: String, amount_minor: i64 },
    RefundFailed     { refund_id: String, code: String, msg: String },
    SubscriptionRenewed   { subscription_ref: String, period_end: DateTime<Utc> },
    SubscriptionCancelled { subscription_ref: String },
    DisputeOpened    { txn_id: String, reason: String },
    Unknown          { kind: String, raw: JsonValue },
}
```

### 4.2 各 adapter 实现差异表

| 渠道 | crate | create_payment outcome | 回调风格 | 退款 | 订阅 | 对账拉单 |
|---|---|---|---|---|---|---|
| wechat_jsapi | unmei-wx | Jsapi(prepay_id, paySign,...) | POST + XML 签名 → v3 JSON + RSA | ✅ 部分支持 | 通过 contracted_pay,复杂 | 微信账单 csv API |
| wechat_h5 | unmei-wx | Redirect(mweb_url) | 同上 | 同上 | ❌ | 同上 |
| wechat_native | unmei-wx | NativeQr(code_url) | 同上 | 同上 | ❌ | 同上 |
| wechat_mp | unmei-wx | Jsapi | 同上 | 同上 | ✅ (合约扣款) | 同上 |
| alipay_wap | unmei-alipay (新) | Redirect(form url) | POST + RSA2 | ✅ | 周期扣款协议 | 账单 API |
| alipay_pc | unmei-alipay | Redirect(qr) | 同上 | 同上 | 同上 | 同上 |
| stripe_card | unmei-stripe (新) | StripePaymentIntent | webhook event v2 + svix sig | ✅ 完美 | ✅ Subscription | reports api |
| iap | unmei-iap (新) | IapVerifiable | client→ verify_receipt → 我方查 Apple | ⚠ 需用户找 Apple 退 | ✅ auto-renewable | 销售报告 + S2S notification v2 |
| gpb | unmei-gpb (新) | IapVerifiable | client→ verify with Play Developer API | ⚠ Google Play 控制 | ✅ | sales reports |

### 4.3 Webhook 路由统一

所有渠道 webhook 走同一前缀,后面是 channel:

```
POST /v1/webhooks/wechat
POST /v1/webhooks/alipay
POST /v1/webhooks/stripe
POST /v1/webhooks/iap/s2s              -- Apple Server-to-Server Notifications V2
POST /v1/webhooks/gpb/rtdn             -- Google Real-time Developer Notifications
```

**统一处理流程**:
1. middleware 抽 raw body(注意:**禁止** body extractor 提前 parse,Stripe 签名要 raw bytes)。
2. 路由到对应 adapter.verify_webhook。
3. 拿到统一 WebhookEvent。
4. 进入 PaymentService.apply_webhook_event(event)(幂等 by `(channel, channel_event_id)`)。
5. 响应渠道要求的成功体(Stripe 要 2xx,微信要 `{code:"SUCCESS"}`,IAP 直接 200)。

---

## §5 schema v2 · 总览 DDL(示意,不是最终 sqlx-prepare)

> 完整 SQL 落到 `backend/migrations/2026MMDD_NNN_commerce_v2.sql` 系列;此处给**清单 + 关键约束**,不重复粘 600 行 DDL。

### 5.1 表清单 + 行数估计

| 域 | 表 | 主键 | 关键索引 | 行数估计(到 100k 用户) |
|---|---|---|---|---|
| Catalog | product | id | (status,category), (kind,status) | 1k |
| Catalog | sku | id | (product_id), (code) UNIQUE | 5k |
| Pricing | price_book | id | (sku_id, region, platform, effective_from) | 20k |
| Pricing | price_rule | id | (status, priority) | 2k |
| Promotion | promotion | id | (code) UNIQUE, (status, effective_from) | 1k |
| Promotion | coupon | id | (owner_user_id), (code) UNIQUE WHERE code IS NOT NULL, (state, expires_at) | 200k |
| Promotion | coupon_redemption | id | (coupon_id), (order_id) | 50k |
| Subscription | plan | id | (status) | 50 |
| Subscription | subscription | id | (user_id, status), (next_billing_attempt_at) WHERE status IN (...) | 30k |
| Subscription | subscription_invoice | id | (subscription_id, period_start) | 200k |
| Order | order | id | (user_id, created_at DESC), (status, created_at), (expires_at) WHERE status='unpaid' | 500k |
| Order | order_line | id | (order_id) | 1M |
| Order | order_event | id | (order_id, created_at) | 5M |
| Order | order_meta | order_id | — | 500k |
| Payment | payment | id | (order_id), (user_id, created_at DESC), (status, created_at), (channel_txn_id) WHERE NOT NULL | 800k |
| Payment | payment_attempt | id | (payment_id, attempt_no) | 1.5M |
| Payment | payment_event | id | **(channel, channel_event_id) UNIQUE**, (payment_id, received_at) | 3M |
| Refund | refund | id | (order_id), (payment_id), (status, created_at) | 50k |
| Shipment | shipment | id | (order_id), (status, created_at), (tracking_no, carrier_code) | 200k |
| Shipment | shipment_trace_event | id | (shipment_id, event_at), (raw_source, raw_event_id) UNIQUE WHERE raw_event_id IS NOT NULL | 3M |
| Settlement | recon_batch | id | (channel, batch_date) UNIQUE | 5k |
| Settlement | recon_record | id | (batch_id), (channel_txn_id), (match_state) | 800k |
| Risk | risk_rule | id | (status, priority) | 100 |
| Risk | risk_event | id | (user_id, decided_at), (decided_action) | 1M |
| Risk | risk_case | id | (state, severity) | 5k |
| Finance | account_chart | code | — | 100 |
| Finance | journal_entry | id | (period_id), (business_kind, business_ref_id) | 5M |
| Finance | journal_line | id | (entry_id), (account_code) | 15M |
| Finance | period | id | (year, sub) UNIQUE | 100 |
| 横切 | audit_log | id | (resource_kind, resource_id, created_at), (actor_id) | 10M |
| 横切 | outbox_event | id | (status, created_at) | 5M |
| 横切 | wx_message_log | (v0.1 已有,保留) | | | 1M |

### 5.2 全局约束

- 所有金额:`BIGINT NOT NULL` minor unit。
- 所有时间:`TIMESTAMPTZ NOT NULL DEFAULT now()`。
- 所有 id:`TEXT`(UUID v4 字符串)或 `BIGINT GENERATED AS IDENTITY`(高频热点);**初版统一 UUID 字符串**,简化分布式与 idempotency-key 复用。
- 所有 jsonb:`jsonb NOT NULL DEFAULT '{}'::jsonb`(避免 null check)。
- 所有写表带 `updated_at` 由 trigger 维护。
- 所有「枚举」字段:**TEXT + CHECK constraint** 而不是 PG enum(enum 改值要 migration,text 在域代码 union 同步即可)。

### 5.3 关键索引策略

- 列表查询(订单 / 支付 / 退款 webadmin)永远用 `(user_id, created_at DESC)` 或 `(status, created_at DESC)` 复合。
- 状态扫描的(`expires_at WHERE status='unpaid'` / `next_billing_attempt_at WHERE status IN (...)`)用 **partial index**,避免索引全表。
- 渠道交易号查重:**partial unique index** WHERE NOT NULL。
- 金额聚合统计:**物化视图** `order_daily_summary` / `payment_channel_daily` 每日刷新,webadmin 直接读。

### 5.4 migration 链(规划)

| 编号 | 内容 |
|---|---|
| 2026MMDD_001_drop_v01.sql | DROP v0.1 商业表(无生产数据) |
| 2026MMDD_002_money_helpers.sql | 通用辅助:updated_at trigger fn / 货币 enum / region enum |
| 2026MMDD_010_catalog.sql | product / sku |
| 2026MMDD_020_pricing.sql | price_book / price_rule |
| 2026MMDD_030_promotion.sql | promotion / coupon / coupon_redemption |
| 2026MMDD_040_subscription.sql | plan / subscription / subscription_invoice |
| 2026MMDD_050_order.sql | order / order_line / order_event / order_meta |
| 2026MMDD_060_payment.sql | payment / payment_attempt / payment_event |
| 2026MMDD_070_refund.sql | refund |
| 2026MMDD_075_shipment.sql | shipment / shipment_trace_event |
| 2026MMDD_100_settlement.sql | recon_batch / recon_record |
| 2026MMDD_110_risk.sql | risk_rule / risk_event / risk_case + counter |
| 2026MMDD_120_finance.sql | account_chart / journal_entry / journal_line / period |
| 2026MMDD_130_crosscutting.sql | outbox_event / audit_log 扩展 |
| 2026MMDD_140_views.sql | 物化视图 + report 视图 |
| 2026MMDD_150_seeds.sql | 科目表 / 默认 plan / 风控基础规则 |

按 §11 里程碑分批落,不必一次性 apply 全 16 份。

---

## §6 API 合约总览

### 6.1 客户端 BFF (`unmei-api` :6028)

| Method | Path | 描述 | 鉴权 |
|---|---|---|---|
| GET | /v1/products | 商品列表(按 region/platform 自动筛) | 可匿名 |
| GET | /v1/products/{id} | 商品详情 + skus + 当前定价 | 可匿名 |
| GET | /v1/plans | 订阅 plan 列表 | 可匿名 |
| POST | /v1/orders | 下单(返回 order_id + 待支付金额) | 必须登录 |
| GET | /v1/orders | 我的订单列表 | 登录 |
| GET | /v1/orders/{id} | 订单详情 | 登录 + owner |
| POST | /v1/orders/{id}/cancel | 取消订单 | 登录 + owner |
| POST | /v1/orders/{id}/pay | 发起支付(body: channel + sub_channel) | 登录 + owner |
| POST | /v1/orders/{id}/refund | 申请退款 | 登录 + owner |
| GET | /v1/payments/{id} | 支付状态查询 | 登录 + owner |
| GET | /v1/orders/{id}/shipments | 订单下所有包裹 | 登录 + owner |
| GET | /v1/orders/{id}/shipments/{sid}/trace | 单包裹物流 trace 流水 | 登录 + owner |
| GET | /v1/coupons | 我的优惠券 | 登录 |
| POST | /v1/coupons/redeem | 兑换码兑换 | 登录 |
| GET | /v1/subscriptions | 我的订阅 | 登录 |
| POST | /v1/subscriptions/{id}/cancel | 取消订阅(end_of_period) | 登录 |
| POST | /v1/subscriptions/{id}/resume | 恢复订阅 | 登录 |
| POST | /v1/webhooks/{channel} | 支付渠道回调 | 渠道签名 |
| POST | /v1/webhooks/carrier/{provider} | 物流承运商回调 | 承运商签名 |

**统一**:所有写接口要求 `Idempotency-Key` header;响应封装 `{ data | error: { code, message, fields? } }`;错误码集中 `unmei-domain/src/error.rs`。

### 6.2 运营后台 (`unmei-admin-api` :6029)

10 个工作台对应 10 组 routes:

| 模块 | 关键 endpoint |
|---|---|
| 商品 | products: list/detail/create/update/delist + skus 子表 + 价格快照 |
| 定价 | prices: list_by_sku / publish / expire / preview(sku, ctx) |
| 营销 | promotions / coupons:CRUD + 发券 batch + 兑换历史 + 预算监控 |
| 订阅 | plans + subscriptions: list/detail/force_cancel/refund_full_cycle |
| 订单 | orders: list (高密度筛 status/channel/region/amount/keyword) / detail / refund / cancel / re-fulfill / export csv |
| 支付 | payments: list / detail (含 attempts + events) / force_query / mark_failed |
| 退款 | refunds: list / approve / deny / retry |
| 物流 | shipments: list (按 status/carrier/异常) / detail (含 trace) / set_tracking_no / force_query / mark_exception / mark_returning / annotate / export |
| 对账 | reconciliation: list_batches / detail / mark_resolved / trigger_manual_pull |
| 风控 | risk: rules CRUD / events / cases(open/assign/resolve) |
| 财务 | finance: journal browse / monthly_report / period close / trial_balance / KPI dashboard |
| 审计 | audit: query by (actor, resource, time) |
| 配置 | feature_flags + system_config(运营级) |

### 6.3 Webhook 入口

详见 §4.3。

### 6.4 内部 RPC / Service trait

`unmei-domain` 暴露 service trait:

```rust
pub trait OrderService { ... }
pub trait PaymentService { ... }
pub trait RefundService { ... }
pub trait ShipmentService { ... }
pub trait SubscriptionService { ... }
pub trait PromotionService { ... }
pub trait SettlementService { ... }
pub trait RiskService { ... }
pub trait FinanceService { ... }
```

API 层(`unmei-api`、`unmei-admin-api`)只依赖 trait;实现层 `unmei-domain` 持有 sqlx pool + kevy + adapter registry。

---

## §7 webadmin 信息架构 · 10 工作台

| 路由 | 名称 | 主要视图 | 关键动作 |
|---|---|---|---|
| /products | 商品 | 表 + 详情抽屉 + sku 子表 | 上下架 / 编辑 / sku 增删 |
| /pricing | 定价 | sku × (region×platform×time) 矩阵 + 历史时间线 | 发新价 / 预览生效 / expire |
| /promotions | 营销 | 促销活动表 + 优惠券批次 + 兑换分析 | 新建 / 发券 / 暂停 |
| /subscriptions | 订阅 | plan 总览 + 订阅 list + cohort 留存图 | force cancel / 退款整周期 |
| /orders | 订单 | 高密度多筛表 + 时间线详情 | 退款 / 取消 / 重发货 / export |
| /payments | 支付 | 支付列表(横向 channel)+ attempts + events | 强制查渠道 / 标 failed |
| /refunds | 退款 | 待审 + 处理中 + 已完成,带争议入口 | 批准 / 拒绝 / 重试 |
| /shipments | 物流 | 包裹列表(按 status 分 tab)+ 异常红点 + 单包裹 trace 时间线 | 录入运单号 / 强制拉 trace / 标异常 / 标退货 / 导出 |
| /reconciliation | 对账 | 按日各渠道账单 batch + 异常项面板 | 标解决 / 手动拉单 |
| /risk | 风控 | 规则编辑 + 事件 list + 案件 board | 规则上下线 / 案件分配 |
| /finance | 财务 | 分录浏览 + 月报 + KPI 大盘 + 期末关账 | 关账 / 反关 / 导出 |
| /audit | 审计 | 全 actor 查询 | (只读) |
| /settings | 系统 | feature flag + 系统配置 | 切配置 |

**密度**:沿用 v0.2 的 `.wa-table`(密集表)+ sidebar 200px + 顶 bar 10px。每个工作台默认 24h / 7d / 30d / 90d 时间筛 + 自定义。

**钻取**:订单/支付/退款/物流之间一键互跳(例:订单详情→关联支付→关联回调事件→关联对账记录→关联分录;订单详情→关联包裹→trace 时间线;包裹异常→订单→退款)。

---

## §8 关键工作流时序图

### 8.1 下单 + 微信小程序支付

```
client            unmei-api          order_svc        payment_svc       wechat_adapter        wechat
  │  POST /v1/orders                  │                  │                  │                  │
  ├──────────────►│                   │                  │                  │                  │
  │               │ idempotency check + auth             │                  │                  │
  │               │ → order_svc.create(req)              │                  │                  │
  │               │                   │ 校验 sku/库存/promo,quote 价格      │                  │
  │               │                   │ ─writes─ order, order_line, lock coupon                │
  │               │                   │ ─emit─ OrderCreated event                              │
  │               │ ◄─ Order ─        │                  │                  │                  │
  │ ◄ 201 {order_id, total_minor}     │                  │                  │                  │
  │                                    │                  │                  │                  │
  │  POST /v1/orders/{id}/pay {channel:wechat_jsapi}     │                  │                  │
  ├──────────────►│                   │                  │                  │                  │
  │               │ → payment_svc.create(order, channel) │                  │                  │
  │               │                   │ ──writes── payment(pending)         │                  │
  │               │                   │ ──adapter.create_payment──→         │                  │
  │               │                   │                  │ 调微信 v3 下单 ──→ │
  │               │                   │                  │ ◄─── prepay_id  ──┤
  │               │                   │                  │ 计算 paySign     │
  │               │                   │ ◄─ Jsapi params ─┤                  │
  │               │ ◄─ CreatePaymentOutcome ─            │                  │
  │ ◄ 200 {jsapi_params, payment_id}                     │                  │
  │ wx.requestPayment(jsapi_params)                                       │                  │
  │ ... 用户支付 ...                                                          │
  │                                                              ┌────────── 用户付款 ───┐
  │                                                              │                       │
  │                              微信 webhook → /v1/webhooks/wechat                       │
  │                                    │ wechat_adapter.verify_webhook                    │
  │                                    │ → WebhookEvent::PaymentSucceeded                 │
  │                                    │ → payment_svc.apply_event (幂等 by event_id)     │
  │                                    │   ──writes── payment(success) + payment_event    │
  │                                    │   ──emit──   OrderPaid                           │
  │                                    │ → order_svc.mark_paid                            │
  │                                    │   ──writes── order(paid) + order_event           │
  │                                    │ → finance_svc.post(收入 + 在途分录)              │
  │                                    │ → notification.send(用户感谢 + 运营 ping)        │
  │                                    │ → fulfillment_worker.dispatch(order_id) (async)  │
  │                                    │ ── 200 {code:"SUCCESS"} → 微信                   │
```

### 8.2 排盘类订单异步发货

```
fulfillment_worker          order_svc          mingli-api (:6027)
   │ dequeue order_id           │                   │
   │ load order + lines         │                   │
   │ for each line if sku.fulfillment_kind=async_compute:
   │   ├── POST /api/cast (input from order_meta)─→ │
   │   │ ◄── chart JSON ──────────────────────────  │
   │   ├── store natal + naji_record                 │
   │   └── line.fulfillment_status=done             │
   │ if all lines done:                              │
   │   └── order_svc.mark_fulfilled(order_id)        │
   │       ──writes── order(done) + order_event      │
   │       ──emit──   OrderFulfilled                 │
   │ notification.send(用户结果可看)                 │
```

### 8.3 退款全流程

```
client                    unmei-api             order_svc           refund_svc           wechat_adapter
  │ POST /orders/{id}/refund {amount, reason}    │                   │                   │
  ├──────────────►│                              │                   │                   │
  │               │ → refund_svc.request(order, amount, reason)      │                   │
  │               │      ──writes── refund(requested)                │                   │
  │               │      ──emit──   RefundInitiated                  │                   │
  │ ◄ 202 {refund_id, status:"requested"}                            │                   │
  │                                                                  │                   │
  │ ... 运营或自动审 ...                                              │                   │
  │ admin: POST /admin/refunds/{id}/approve                          │                   │
  │      ──updates── refund(approved)                                │                   │
  │      → adapter.refund(req)                                       │                   │
  │                                                                  │ 调微信 v3 退款 ──→ │
  │                                                                  │ ◄── refund_id ────┤
  │      ──updates── refund(processing)                              │                   │
  │                                                                  │                   │
  │ 微信 webhook → /v1/webhooks/wechat (refund event)                                    │
  │      → adapter.verify_webhook → WebhookEvent::RefundSucceeded                       │
  │      → refund_svc.apply_event                                                       │
  │           ──updates── refund(success)                                               │
  │           ──updates── payment(refunded / refunded_partial)                          │
  │           ──updates── order(refunded / refund_partial)                              │
  │           ──emit──   RefundCompleted                                                │
  │           → finance_svc.post(冲销收入 + 出账)                                       │
  │           → coupon_svc.release_if_reversible                                        │
  │           → notification.send(用户已退款)                                           │
```

### 8.4 订阅续费(dunning)

```
billing_scheduler (cron 每 5min)            subscription_svc            payment_svc           adapter
  │ select subscriptions where status in (active,past_due) and next_billing_attempt_at <= now()
  │  for each:
  │   subscription_svc.attempt_renew(sub_id)
  │      → invoice_svc.open_invoice(sub, period)
  │      → payment_svc.create_off_session(invoice, sub.source_channel) ─→ adapter ─→ 渠道
  │           ┌── ok  → mark invoice paid + extend period + send notif
  │           ├── soft_fail (insufficient_funds) → schedule retry T+1d / T+3d / T+7d, status=past_due
  │           └── hard_fail (revoked card) → state=grace; warn user; if grace_end pass → expired
```

### 8.5 实物订单履约 + 物流 trace

```
order paid (含实物 line) → fulfillment_worker
  │ shipment_svc.create_from_order(order_id)
  │   ──writes── shipment(preparing) + 关联 order_line_ids
  │   ──emit──   ShipmentCreated
  │
admin 在 webadmin /shipments 录入 (carrier_code, tracking_no)
  → shipment_svc.assign_tracking(sid, carrier, no)
       ──writes── shipment(picked_up) + emit TrackingNoAssigned
       → carrier_adapter.query_trace(carrier, no)  -- 立即一次首拉
       → write trace_events + status 自动推进

shipment_trace_sweeper (cron 15min)
  │ select shipment where status in (picked_up, in_transit, out_for_delivery, exception)
  │   for each:
  │     events_new = carrier_adapter.query_trace(carrier, tracking_no)
  │     dedup vs existing(by raw_event_id) → insert delta
  │     translate latest event → derive next status
  │     if status changed:
  │        ──emit── ShipmentInTransit / Delivered / Exception
  │        if Delivered:
  │           order_line.fulfillment_status = done(实物 line)
  │           若 order 所有 line 都 done → order_svc.mark_done
  │        if Exception > 48h:
  │           ──emit── ShipmentException → webadmin 红点 + 通知运营

承运商主动 webhook(SF / AfterShip 支持):
  POST /v1/webhooks/carrier/{provider}
  → carrier_adapter.verify_webhook → TraceWebhookEvent
  → 同上路径(trace_events 写入 + status 推进 + 事件)
```

### 8.6 日终对账

```
recon_scheduler (cron 02:30 Shanghai)
  │ for each channel where capabilities.settlement_pull:
  │   ├── adapter.pull_settlement(yesterday)
  │   ├── insert recon_batch + recon_record × N
  │   └── match:
  │         left join payment on channel_txn_id
  │           ├── matched → mark matched
  │           ├── missing_in_internal → 标 missing_in_internal,推 alert
  │           ├── missing_in_channel → 标 missing_in_channel,推 alert
  │           └── amount mismatch → 标 amount_mismatch,推 alert
  │ 异常项进 /admin/reconciliation 待处理面板
  │ webadmin 显示「N 笔异常待处理」红点
```

---

## §9 合规与法务

### 9.1 实名 / KYC

- 用户实名:**默认不要**(隐私优先;C 端命理产品索取身份证号的转化损失远大于风控收益)。仅在以下边界场景做轻度核验,不强制留档:① 单笔订单 ≥ ¥5000(走风控人工补审,而非前置必填);② 微信 / 支付宝 / IAP / GPB 各渠道对未成年人识别自动接入,平台不重复实名。
- 如确实需要存身份证号(运营手动场景,如争议处理):PG 列加密(pgcrypto + 应用层 KMS),前台只显尾 4。

### 9.2 发票 / 收据

- 普通发票 / 增值税专票:接入第三方电子发票服务(诺诺/百望/航天信息),走异步开票流程 → 写 `invoice` 表 → 邮件 / 微信通知用户。
- 收据(非税务):自家生成 PDF(已支付订单皆可申请)。
- **抬头修改**:开票后不可改,只能红冲重开。

### 9.3 数据出境(海外版)

- region=cn 的用户数据 **不出境**:DB 实例分 cn / global 双套;数据严格按 region 写入对应 DB(应用层 router)。
- 公开记录:发布隐私政策 + 数据出境清单,过个保法 (PIPL) 评估。

### 9.4 退款政策

- **默认政策**:已生成 / 已发货的虚拟商品(排盘报告 / AI 解读),不支持无理由退款;有理由(质量问题 / 系统故障)走人工。可下载 / 已观看的视频课程,7 天内未消费可退。
- 订阅:cancel-anytime(随时取消,本周期结束停止续费,本周期不退),符合主流平台政策(微信/支付宝/Apple/Google)。

### 9.5 未成年人保护

- 微信 / 支付宝 / Apple / Google 都有未成年人识别能力,加权重到风控规则(年龄 < 18 → 单笔 ≤ ¥200,日累计 ≤ ¥600,月累计 ≤ ¥1500;参照《未成年人保护法》游戏行业实践)。
- 命理类内容对未成年人有引导风险:服务条款明示「16 岁以下需家长同意」,产品端在订阅 / 高价订单流程做家长确认。

### 9.6 反洗钱 / 反欺诈

- 单笔 > ¥50000 自动 review;月累计 > ¥200000 触发 STR(可疑交易报告)审核流程。
- IP × 设备 × 卡 BIN 关联图谱(后续);MVP 用速率规则兜底。

### 9.7 订阅相关法务(欧盟 GDPR / 加州 CCPA / 中国《消法》)

- 续费前 24h:必须邮件 / push / 站内信通知。
- 取消入口:**与开通入口同等显眼**(legal hard requirement)。
- 价格变化:必须提前通知,用户可选择 cancel。
- 自动续费默认关:**国内有要求**(《电子商务法》),开通时显式勾选 + 在订阅管理页常显「续费状态」开关。

---

## §10 容量与性能

按 100k 月活、订单 10k/天、支付 12k/天(含失败)、webhook 30k/天 估算:

- DB:PG 18 单实例 + standby 即可(到 1M 活跃用户前),归档表(`*_event`/`audit_log`)定时迁出至冷库。
- API:`unmei-api` 单实例 + nginx 上游 4 个 worker(异步 Rust),回调入口 P99 < 200ms。
- Webhook:**不阻塞渠道** — 接到立即写 raw_event 表 + 200 返回,后台 worker 异步处理事件;渠道侧 timeout 看不到我方 idle。
- 缓存:kevy 用于热商品 / 热价格 / idempotency / 速率计数,DB 不直查;失效用 pub/sub 推。
- 定时任务:`payment_query_sweeper`(30s)/ `billing_scheduler`(5min)/ `recon_scheduler`(daily 02:30)/ `monthly_close`(每月 1 号 02:00)/ `outbox_dispatcher`(常驻 5s tick)。
- 报表:物化视图 + 报表快照 + nightly job(不要让 webadmin 临时跑大聚合)。

性能 SLO:
- 客户端 GET API P99 ≤ 200ms,POST P99 ≤ 500ms(不含支付往返渠道时间)。
- webhook 入口 → 200 返回 P99 ≤ 100ms(纯落表)。
- 回调到 order.paid P99 ≤ 2s(异步处理 + outbox dispatch)。

---

## §11 落地里程碑 · M0 → M7

| 阶段 | 范围 | 完成 = | 周期估 |
|---|---|---|---|
| **M0**(本文档审定) | 设计文档 / DDL 草案 / API 草案冻结 | 用户在本文档签字 | 现在 |
| **M1** 订单与支付内核 | unmei-domain crate / order + payment + refund schema / OrderService + PaymentService / Wechat adapter / 客户端 + admin 基础接口 / webadmin 重写 Orders+Payments+Refunds | 用 wechat_jsapi 完整闭环 + 退款闭环 + 对账抽样手动可校 | 高优 |
| **M2** Catalog + Pricing + Promotion + Shipment | product / sku / price_book / coupon / promotion 全套 + shipment / trace_event + CarrierAdapter(快递100 + Manual)+ shipment_trace_sweeper;quote 引擎;coupon 兑换;webadmin Products / Pricing / Promotions / Shipments | 上架商品后用户可见、价格 / 折扣完整走通;实物订单可录单号、自动拉 trace、状态推进到 delivered | 紧随 M1 |
| **M3** 订阅 | plan / subscription / subscription_invoice / dunning;首付走单次 payment,续费走 off-session payment | 月卡 / 年卡可订;续费 + 失败重试有完整 dunning(0/1/3/7 天)+ grace | M2 后 |
| **M4** 多渠道扩展 | Alipay / Stripe / IAP / GPB 四 adapter;支付方式选择 UI;多渠道对账 | iOS / 海外用户可付费 | M3 后(可分两批:先 Alipay,后 IAP/Stripe/GPB) |
| **M5** 对账 + 风控 + 财务 | recon / risk / finance 三大域全套;月报 / KPI / 期末关账;风控规则编辑器 | 财务可独立出月报;风控规则可热改;对账 0 异常 | M4 后 |
| **M6** 数据出境 / 海外版 | region split DB / Stripe Customer Portal / 财税出口 | 海外用户独立 region,合规审计通过 | M5 后 |

**每个 M 完成前**:写一份「M{X}-handoff.md」更新 schema 实际版本、已上 adapter 清单、未尽事项。

---

## §12 决策日志(Decision Records)

记录已决策的关键技术 / 业务选项 + 备选 + 原因。

| # | 决策 | 备选 | 原因 |
|---|---|---|---|
| D-001 | **订单 / 支付双域分离** | 单聚合根(订单内嵌支付) | 一笔订单 N 笔支付是事实;不解耦后续接多渠道分账或部分支付场景会重构 |
| D-002 | **金额一律 i64 minor unit** | numeric / float | 跨语言一致、无浮点误差;前端 string 传输 |
| D-003 | **PaymentAdapter trait** | 渠道在 service 里 if/else | 渠道差异是稳定知识,trait 化后新增渠道零侵入 |
| D-004 | **状态机集中常量表** | 散落 service 里 if 推进 | 易于一处审计 / 测试 / 图示化 |
| D-005 | **Outbox 事件** | 直接发 MQ | 同 DB 事务原子写,无 MQ 依赖,后续可换出去 |
| D-006 | **TEXT + CHECK 替代 PG enum** | PG enum | 改值不用 migration |
| D-007 | **UUID 字符串主键** | bigint serial | 分布式无冲突;调试可读;idempotency-key 复用 |
| D-008 | **复式记账 finance 域** | 仅业务表统计 | 真实财务对账只能用 journal;否则口径永远对不齐 |
| D-009 | **kevy 做幂等 / 速率 / 缓存** | Redis 单独部署 | 已有自研依赖;in-process 减运维 |
| D-010 | **v0.1 商业表 drop 不双写** | 双写迁移 | 无生产数据,迁移成本是负的 |
| D-011 | **migration 链按域分文件** | 单一大 migration | 落地里程碑可按表分批 apply |
| D-012 | **物化视图做报表** | 临时聚合查询 | 100k 用户后聚合就慢;materialize + nightly refresh 简单 |
| D-013 | **fulfillment async** | 同步生成排盘报告 | mingli-api 算力同步会拖支付链路 P99 |
| D-014 | **退款审批阈值** | 一律自动 / 一律人工 | 小额自动减运营 toil,大额人工保安全 |
| D-015 | **数据出境 region 双 DB** | 单 DB 应用层标 region | 个保法硬要求,逻辑分离不够 |

---

## §13 不做清单(Out of Scope · v2.0)

明确**不**在 v2.0 范围内,避免范围漂移:

- **充值钱包 / 储值卡 / 虚拟币 / 灵签币**:不做。理由:① 预付款是用户负债,需要资金存管 / 牌照(各地金融监管口径不一);② 与「单次付费 + 订阅」市场重合,价值边际低;③ 双账核对 + 防止跑路 + 退余额政策都是独立工程量。若日后做,接 PaymentAdapter trait 即可加(已留口子,见 §2.2)。
- **仓储 / WMS / 多仓发货 / 自动分仓 / 库存预占 / 拣货波次**:不做。unmei 实物只做单仓自营,SKU 数有限(手册 / 摆件 / 字画 / 报告),手工管理库存,不上 WMS。**物流 trace 是做的**(单包裹追踪 + 异常处置 + 退货,见 §3.8 Shipment),分仓与库存管理不在范围。
- 跨境实物物流(报关 / 关税 / 国际承运商集成):暂不做,M6 海外版再评估。AfterShip 等聚合接口已留 adapter 口子。
- 法币 ↔ 加密货币:不做。
- 商家自营平台(开放 SaaS / 多租户):不做,unmei 是单租户(unmei 团队自营内容,不接外部命理师入驻)。
- **B2B / 服务师入驻 / 分销 / 抽佣**:不做。理由:① 砍掉外部命理师入驻,unmei 只做自营内容;② 资金分账 + 实名 KYC + 跨境收款 (Stripe Connect / 1099 / W-8BEN) 是一整套独立监管栈,工程量与本系统核心(自营变现)对等却价值不同向;③ 若日后做,在 OrderService 上加 splitting + 在 PaymentService 上加 transfer 即可,**不必在 v2.0 留 schema 口子**(预留废表比补表代价更高)。
- 复杂税务(美国各州销售税 / 欧盟 VAT MOSS):M7 海外版再评估,M2.0 内不做。
- 商品评论 / 评分系统:产品域,不在商业子系统范围。
- 直播 / IM 售前咨询:不做。

---

## §14 附录

### 14.1 状态名词约定表

| 域 | 状态值 |
|---|---|
| order.status | draft / unpaid / paid / fulfilling / done / cancelled / refund_partial / refunded / disputed |
| payment.status | pending / processing / success / failed / expired / cancelling / cancelled / refunding / refunded_partial / refunded / disputed |
| refund.status | requested / approved / processing / success / failed / cancelled |
| subscription.status | trialing / active / past_due / grace / cancelled / expired / paused |
| coupon.state | issued / locked / redeemed / expired / revoked |
| shipment.status | preparing / picked_up / in_transit / out_for_delivery / delivered / exception / returning / returned / cancelled |
| shipment_trace_event.event_kind | picked_up / arrived_at_sort_facility / departed / out_for_delivery / delivered / failed_delivery / returned / exception |
| recon_record.match_state | matched / missing_in_channel / missing_in_internal / amount_mismatch / status_mismatch |
| risk_case.state | open / investigating / resolved / false_positive |
| journal_entry.status | draft / posted / reversed |
| period.state | open / closing / closed |

### 14.2 错误码命名约定

- 域前缀 + 短 kebab:`order/not-found`、`payment/idempotency-mismatch`、`coupon/already-redeemed`、`subscription/channel-mismatch`、`risk/blocked-by-rule:R042`、`refund/exceed-paid-amount`。
- HTTP 状态:4xx for client / 409 for state conflict / 422 for validation / 423 for risk-blocked / 5xx for ours.

### 14.3 命名 cheatsheet(避免歧义)

- 「订单 (Order)」= 商业意图 / 价款冻结。
- 「支付 (Payment)」= 一次收钱动作。
- 「交易 (Transaction)」= 三方系统的术语,我方一律说 payment;只在 schema `channel_txn_id` 字段名带 txn(对齐渠道命名)。
- 「订阅 (Subscription)」= 持续关系;subscription 的每个周期产一张 invoice(发票/账单)+ 一笔 order(订单内核) + 一笔 payment(支付)。
- 「分录 (Journal)」= finance journal — 专指复式记账,与业务表如 `payment` 不混用。
- 「对账 (Reconciliation)」专指与外部渠道账单核对;内部数据对齐叫「校核 (sweep / cross-check)」。

---

## §15 待你拍板的 9 个开放问题

(本文档默认了一套合理的选项,但以下点你最好显式签字 — 否则后续容易回炉。)

| # | 问题 | 我的默认 | 待你定 |
|---|---|---|---|
| Q2 | 订阅取消是「立即」还是「期末」? | **期末**(主流且法务安全) | immediate / end_of_period |
| Q4 | 退款无理由窗口? | 虚拟:**0**;实物:**7 天** | 数字 |
| Q5 | 单笔订单上限? | ¥10,000(超额走线下) | 数字 |
| Q6 | 单用户日累计支付上限? | ¥30,000 | 数字 |
| Q7 | 试用期 0 元收款是否落 payment 记录? | **是**(假 0 元 payment,保审计完整) | yes/no |
| Q8 | 多币种是否一期就上? | **否** — M1-M3 单 CNY;M4 起加 USD/HKD/JPY | yes/no |
| Q9 | 财务月报口径默认时区? | Asia/Shanghai | tz |
| Q10 | 运费策略默认? | **阶梯包邮**:订单 ≥ ¥99 包邮,< ¥99 收 ¥12 平邮 | 数字 / 包邮 / 实重 |
| Q11 | 默认承运商? | **顺丰**(精度高、可控)+ 偏远地区降 EMS;海外用 EMS / DHL | 列承运商 |
| Q12 | 一单可拆几个包裹? | 默认 1(合单);运营可手动拆为 N | 数字 |
| Q13 | 物流 trace 拉取频率? | in_transit 段 15min / out_for_delivery 段 5min / 其它 1h | 分钟数 |

---

## §17 多区域(6 cell + Control Plane)

> 状态:**P1 已落地**(代码层 region-aware + 6 region mock 数据全栈贯通);P2/P3 计划期。

### 17.1 6 Cell Scope(锁定)

| code | 名称 | 主货币 | locale | 渠道(P0) | 物流(P0) | 时区 | 数据驻留 |
|---|---|---|---|---|---|---|---|
| `cn` | 中国大陆 | CNY | zh-CN | 微信支付 / 支付宝 | 顺丰 / 京东 / 中通 | UTC+8 | ✅ PIPL |
| `jp` | 日本 | JPY | ja-JP | LINE Pay / PayPay / Stripe / IAP / GPB | 日本邮便 / Yamato | UTC+9 | ✅ APPI |
| `kr` | 韩国 | KRW | ko-KR | Toss / KakaoPay / NaverPay / Stripe | CJ대한통운 | UTC+9 | ✅ PIPA |
| `sea` | 东南亚 | SGD 基准 (+MYR/THB/IDR/VND/PHP) | en + 各国本地 | GrabPay / Stripe / ShopeePay / IAP / GPB | DHL / J&T / Ninja Van | UTC+7~+8 | 多国 |
| `na` | 北美 | USD (+CAD) | en-US / en-CA | Stripe / Apple Pay / GPay / PayPal | USPS / FedEx / UPS | UTC-5~-8 | 无强制 |
| `zh_hant` | 中文繁体 | TWD (+HKD/MOP) | zh-TW / zh-HK | LINE Pay / Apple Pay / 信用卡 | 中華郵政 / 順豐 | UTC+8 | 无强制 |

虚拟 `global` = 集团聚合视图(admin JWT region_scope 含此值才能看)。

### 17.2 三层 scope · 谁住哪 · 怎么联

| 层 | 所属 | 数据 | 示例 |
|---|---|---|---|
| **Region-local**(每 cell 独立) | cell | order / payment / refund / shipment / settlement / coupon / subscription / risk_event / risk_case / journal_entry / outbox_event / audit_log | jp-ord-001 永远只属于 jp cell |
| **Cross-region 视图**(读时聚合) | control plane 临时算 | dashboard KPI / 财务月报 / MRR/ARR / 库存全景 / 营销 ROI | global view 按汇率折 USD |
| **Global Master Data**(集中 + push) | control plane | SPU(product table)/ Plan 模板 / Account Chart / Risk Rule 模板 / Admin 用户 / Region Registry / Exchange Rate | webadmin `/master` 工作台 |

### 17.3 三条硬规则

1. **PII 不出 cell**(姓名/手机/地址/身份证)— aggregator 调 cell 时 cell 端强制脱敏
2. **Payment / 渠道凭据严格绑死 region** — 微信支付凭据放 CN cell,Stripe 凭据放 NA cell,法务硬需求,绝不 cross
3. **ID 一律 `{region}-{kind}-{uuid}` 前缀** — 集团合并报表不冲突,一眼识别 cell 归属

### 17.4 数据层落地(P1.5)

- **schema**: 19 张主表加 `region TEXT NOT NULL DEFAULT 'cn'` + `BTree index on (region)`
- **product** 用 `available_regions TEXT[] + GIN index` 控制 SPU 可见性(SPU 是 global master,各 cell 看不同子集)
- **price_book**: `region` 字段决定本币定价(CNY/JPY/KRW/SGD/USD/TWD)
- **exchange_rate** 表 + `v_exchange_latest` view:6 币种到 USD 汇率,global 视图自动折算
- **物理布局演化**:
  - **P1**(当前): 单 PG instance + 逻辑 region 列
  - **P2**: `PARTITION BY LIST(region)` 物理分区表(SQL 0 改动,DBA 操作)
  - **P3**: 各 region 独立 PG instance + Control Plane 持 region_registry 路由

### 17.5 API 层落地(全 endpoint region-aware)

```
GET /admin/commerce/*?region=cn|jp|kr|sea|na|zh_hant|global
  - global / 缺省 / 空 → 看全部(跨 cell)
  - 单 region → 只看该 cell
```

`normalize_region()` helper:`"global"` / `""` / 缺省 → `None`(不加 WHERE 子句)。

所有 16 个 list/dashboard endpoint 已 region-aware:
**orders / payments / refunds / shipments / outbox / subscriptions / promotions / coupons / recon_batches / risk_events / risk_cases / risk_rules / journal_entries / monthly_report / products / dashboard_kpi**

### 17.6 集团折算(global 视图)

**dashboard_kpi** + **monthly_report** 在 region=global 时,通过 `v_exchange_latest` view 把各币种营收/退款/物流毛利折成 USD 等值。

公式:
```
today_revenue_usd_cent = SUM(
    payment.amount_minor
    × exchange_rate(payment.currency → USD)
    × (CASE WHEN currency IN ('JPY','KRW','TWD') THEN 100 ELSE 1 END)
)
```
JPY/KRW/TWD 是 0-decimal 货币,本币 `amount_minor` 已是整数,折算到 USD cent(2-decimal)时 ×100。

**响应字段**:
```json
{
  "today_revenue_minor":     202329,   // 跨币种混合 sum,单 region 时是该币种
  "today_revenue_usd_cent":  43886,    // ≈ $438.86,global 视图主指标
  ...
}
```

### 17.7 客户端 BFF region-aware

`unmei-api` `/v1/auth/anonymous` 接 `{region}` body:
- 写入 `app_user.region`
- JWT 含 `region` claim(后续所有调用绑死)
- 后续 `/v1/products?region={user.region}` 按 `available_regions[]` 过滤
- 下单时 `order.region` 取 user.region

实测 6 region 各起 anon → token / products / orders 全跑通(¥/₩/S$/$/NT$ 本币正确)。

### 17.8 Admin JWT scope

```json
{
  "sub":          "admin_root",
  "roles":        ["super","operator","content","support","finance"],
  "region_scope": ["cn","jp","kr","sea","na","zh_hant","global"]
}
```

`region_scope`:
- `super` = 全 6 cell + global
- 区域 admin(e.g. `cn_ops`)= 仅 `["cn"]`,UI 自动隐藏不可访问 cell
- `global` 单独控制是否能看聚合视图(财务岗位)

webadmin 顶部 region 切换器读 `region_scope` 决定可选项;切换 → tanstack-query `invalidateQueries`,所有列表自动 refetch 新 region 数据。

### 17.9 Master Data Service(control plane)

webadmin `/master` 工作台 · 5 tabs:
- **SPU 商品**(product table,含 available_regions[])
- **订阅 Plan**(plan + sku 字段)
- **会计科目**(account_chart,统一科目代码)
- **风控模板**(各 region risk_rule 聚合去重 + deployed_regions[])
- **汇率**(v_exchange_latest)

read-only 视图(P1)+ P2 加同步状态 / version skew / push 失败可视化。

主数据修改规则:
- **Push from control plane,never pull**:console 改 SPU → master DB → 推送各 cell(version 防回滚)
- 各 cell 本地 SKU/Pricing/Coupon 仍 cell 自造,不 push
- 风控规则**先写 template,各 cell 决定是否启用**(本地化语境差异)

### 17.10 Aggregator(集团视图,P2 加固)

P1:read 时 SQL 跨 region partition,单 instance 直接 GROUP BY region 即可。
P2(物理多 cell):
- **Real-time fan-out**:dashboard / 库存全景 → 后台并发调各 cell 的 admin-api,3-5s 等待可接受
- **Nightly ETL**:财务月报 / KPI 周报 → 各 cell 推 metrics 到 control plane,凌晨结算

财务月报必须 ETL(月末关账后数据冻结,real-time 会引入不一致)。

### 17.11 ID 命名约定

```
{region}-{kind}-{uuid}

示例:
cn-ord-d3b98042-...        ord = order_record
jp-pay-001                 pay = payment
kr-rfd-001                 rfd = refund
sea-sub-01                 sub = subscription
na-rc-01                   rc  = risk_case
zht-je-001                 je  = journal_entry
```

global 资源(SPU / Plan / Account Chart)无 region 前缀:`prod-naji-deep` / `plan-mg-month` / `4001`(科目)。

### 17.12 跨域用户

主体跨域 = **新账号**(法务最干净)。少数高价值用户走「集团账号 ID + 区域 profile」federation,P2/P3 再做,不要默认全员化。

退款永远在 payment 同区域(渠道牌照绑死)。跨区域争议(发卡国 vs 商户国)走 control plane 仲裁池(P3)。

### 17.13 落地分期

| Phase | 状态 | 内容 |
|---|---|---|
| **P0** | ✅ 完成 | 单 cell(CN)v2.0 完整商业子系统 |
| **P1** | ✅ 完成 | 代码层 region-aware:Region enum + JWT scope + 19 表 region 列 + 16 endpoint filter + 6 region mock + Master Data 视图 + 汇率折算 |
| **P2** | 计划 | PARTITION BY LIST 物理分区;Master Data push 同步状态;aggregator 跨进程 fan-out;客户端 federation |
| **P3** | 计划 | 各 region 独立 PG instance + cell registry endpoint + geo-routing + 跨境合规(真实凭据接入)|

---

## §18 P1 实测对账(commit-ready)

12 工作台 × 7 region 对账(每行 cn + 5 新 region = global,完美对齐):

| 工作台 | cn | jp | kr | sea | na | zh_hant | global | 校验 |
|---|---|---|---|---|---|---|---|---|
| 订单 | 11 | 3 | 3 | 3 | 3 | 3 | 26 | 11+15=26 ✓ |
| 支付 | 10 | 3 | 3 | 3 | 3 | 3 | 25 | 10+15=25 ✓ |
| 退款 | 2 | 1 | 1 | 0 | 1 | 1 | 6 | 2+4=6 ✓ |
| 物流 | 2 | 0 | 0 | 0 | 0 | 0 | 2 | 实物只 cn ✓ |
| 事件 | 9 | 2 | 2 | 1 | 1 | 1 | 16 | 9+7=16 ✓ |
| 促销 | 5 | 1 | 1 | 1 | 1 | 1 | 10 | 5+5=10 ✓ |
| 优惠券 | 11 | 2 | 2 | 3 | 3 | 2 | 23 | 11+12=23 ✓ |
| 订阅 | 3 | 1 | 1 | 1 | 1 | 1 | 8 | 3+5=8 ✓ |
| 风控事件 | 8 | 2 | 2 | 1 | 2 | 1 | 16 | 8+8=16 ✓ |
| 风控案件 | 5 | 1 | 1 | 1 | 1 | 1 | 10 | 5+5=10 ✓ |
| 对账批次 | 5 | 2 | 2 | 1 | 1 | 1 | 12 | 5+7=12 ✓ |
| 财务分录 | 5 | 2 | 2 | 2 | 2 | 2 | 15 | 5+10=15 ✓ |

集团 USD 折算(global dashboard):**$438.86**(各币种按 v_exchange_latest 实时折算)。

---

**本文档总长 ~1700 行 / ~24 节。**
