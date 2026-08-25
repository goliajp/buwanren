/**
 * 商品 · 对应后端 /v1/products 与 /v1/products/:id
 *
 * 两件调用方必须知道的事：
 *
 * ① **价格不在 product 上，在 sku 上**，而且是按区域分行的 ——
 *    同一个 sku 在 cn 是 CNY 4900、在 jp 是 JPY 1200。所以取价一定要带
 *    `region` 与 `platform`，后端按 `region IN (那个区, 'global')` 挑。
 *    不带的话拿到的是另一个区的价（2026-08-19 后端那边就这么错过一次）。
 * ② **列表接口不返回价格**，只有详情接口的 `skus` 里有。列表想显示价格，
 *    要么后端加，要么逐个取详情 —— 别在前端瞎凑一个。
 */

export interface ProductCard {
  id: string
  code: string
  name: string
  sub_title?: string | null
  category: string
  kind: string
  fulfillment_kind: string
  hero_image_url?: string | null
  tags: string[]
  description_md?: string
}

export interface Sku {
  id: string
  code: string
  name: string
  /** 当前区域 / 当前端下的价格。挑不出价的 sku 这两个字段是 null */
  current_price_minor?: number | null
  current_currency?: string | null
  default_currency: string
  stock_kind: string
  stock_count?: number | null
  per_user_cap?: number | null
  spec_json?: Record<string, unknown>
  weight_g?: number | null
  price_book_id?: string | null
}

export interface ProductDetail {
  product: ProductCard & {
    available_regions: string[]
    available_platforms: string[]
    required_inputs: Record<string, unknown>
    gallery_json: unknown[]
  }
  skus: Sku[]
}

// ─── 订单 ────────────────────────────────────────────────────
/**
 * 状态取值跟后端 `OrderStatus` 一字不差（`enums.rs`，库里还有 CHECK 约束着）：
 * draft / unpaid / paid / fulfilling / done / cancelled /
 * refund_partial / refunded / disputed
 */
export interface OrderCard {
  id: string
  /** 下单那一刻的商品名（第一行的 sku 快照）。没有明细的单子是 null ——
   *  **别在这时候编一个名字出来**：显示单号前八位是我们真知道的东西，
   *  「一件商品」会让人以为系统认得它是什么。 */
  title: string | null
  /** 这单几行。> 1 时显示「第一件 等 N 件」 */
  line_count: number
  status: string
  currency: string
  amount_total_minor: number
  amount_paid_minor: number
  amount_refunded_minor: number
  created_at: string
  paid_at?: string | null
  expires_at?: string | null
  fulfilled_at?: string | null
}

export interface OrderLine {
  id: string
  line_no: number
  sku_id: string
  sku_name?: string | null
  qty: number
  unit_price_minor: number
  line_subtotal_minor: number
  fulfillment_status: string
}

export interface OrderPage {
  items: OrderCard[]
  page: number
  size: number
  total: number
}

export interface OrderDetail {
  order: OrderCard & Record<string, unknown>
  lines: OrderLine[]
  payments: Array<Record<string, unknown>>
  shipments: Array<Record<string, unknown>>
}

export interface CreatedOrder {
  order_id: string
  amount_total_minor: number
  currency: string
  status: string
}

/** 发起支付的返回。`outcome.kind` 按渠道分：Jsapi / Redirect / NativeQr */
export interface PayStarted {
  payment_id: string
  outcome: { kind: string; params?: Record<string, unknown>; url?: string; code_url?: string }
}

// ─── 物流与退款 ──────────────────────────────────────────────
export interface Shipment {
  id: string
  carrier_code?: string | null
  tracking_no?: string | null
  status: string
  shipping_method?: string | null
  picked_up_at?: string | null
  delivered_at?: string | null
  created_at: string
}

export interface TraceEvent {
  id: string
  event_at: string
  event_kind: string
  location?: string | null
  description?: string | null
}

export interface ShipmentTrace {
  shipment: Shipment
  trace: TraceEvent[]
}
