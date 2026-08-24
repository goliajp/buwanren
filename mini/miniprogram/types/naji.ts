/**
 * 摇卦问事 · 对应后端 unmei_domain::{NajiSpinReq, NajiResult, QuoteOut, RecommendOut}
 * 一事一签 · 服务端按 user + 当日 seed 计算,同用户同日结果稳定
 * question 字段(所有类型)· 用户可选写下问题,只留档,不参与算力
 */

export interface QuoteOut {
  text: string
  source: string
}

export interface RecommendOut {
  id: string
  name: string
  sub_title?: string | null
  price_display?: string
  image_url?: string | null
}

export interface NajiSpinReq {
  /** ISO 8601 · 缺省服务端用当前 */
  time_now?: string
  location_lat?: number
  location_lon?: number
  /** 用户写下的问题(可空)· 只留档 */
  question?: string
}

export interface NajiResult {
  id: string
  asked_at: string
  time_label: string
  quote: QuoteOut
  gate: string
  direction: string
  gate_explain: string
  suit: string[]
  avoid: string[]
  question?: string | null
  recommend: RecommendOut | null
}

/** history list item · 后端 naji.rs 简化投影 */
export interface NajiHistoryRow {
  id: string
  date: string          // "07·11 酉时"(时时 bug 已修)
  asked_at: string
  gate: string
  direction: string
  question?: string | null
}

/**
 * GET /v1/naji/:id · detail
 * 后端不返 time_label 与 recommend,前端从 asked_at 派生 time_label
 */
export interface NajiDetail {
  id: string
  asked_at: string
  gate: string
  direction: string
  gate_explain: string
  suit: string[]
  avoid: string[]
  quote: QuoteOut | null
  question?: string | null
}
