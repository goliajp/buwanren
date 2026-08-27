/** 那一册 · 对应 unmei-api /v1/reports（设计册 M2「八字深度报告 ¥199 · 看 ›」） */
import { api } from './api'

/** 一页里的一行。`now` 只有大运那页用得上：标着的那格是现在 */
export interface ReportRow {
  k: string
  v: string | number | null
  now?: boolean
}

/** 四柱那页的一根柱子 */
export interface ReportPillar {
  pos: string
  ganzhi: string
  ten_god: string
  wuxing: string
  nayin: string
  twelve: string
  hidden: string[]
}

/**
 * 一页。
 *
 * 页序、标题、每页出处都在后端排 —— 那是产品文案，改一句不该重新发一版。
 * 所以这一侧只有两个模板：`pillars` 在的那页（四柱，专门画），
 * 和其余页（`rows` + 可选 `bars` + 可选 `quote`）。加页不动这里。
 */
export interface ReportPage {
  key: string
  title: string
  /** 副题，写在标题旁 */
  lead?: string
  /** 说明这一页怎么读 */
  note?: string
  pillars?: ReportPillar[]
  rows?: ReportRow[]
  /** 五行分布那种：画成条 */
  bars?: Array<{ k: string; v: number }>
  /** 排盘自己写的推理，原样引 —— 不改写、不润色 */
  quote?: string
  /** 这一页的数出自哪儿 */
  source: string
}

export interface Report {
  id: string
  kind: string
  /** ready 能读了；awaiting_natal 还差买家的生辰 —— 一半的买家是这样 */
  status: 'ready' | 'awaiting_natal'
  /** 这一册算的是谁（本命的 label） */
  whose: string | null
  /** 「1998年3月5日 14:30 · 成都」 */
  birth_line: string | null
  mingli_version: string | null
  created_at: string
  /** 还没出的册子是空数组 —— 那不是「取不到」，是「还差你一步」 */
  pages: ReportPage[]
}

export const reportApi = {
  one: (id: string): Promise<Report> => api.get<Report>(`/v1/reports/${id}`),
}
