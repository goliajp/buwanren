/**
 * 后端契约 · 对应 unmei_domain::{NatalInput, Natal, NatalSummary}
 * 字段与 Rust struct 一一对齐;后端加字段时同步这里(TS 严格模式会 catch 缺失)
 */

/** POST /v1/user/natals body */
export interface NatalInput {
  label?: string
  year: number
  month: number
  day: number
  hour: number
  minute?: number
  tz?: number
  gender?: 'M' | 'F' | null
  birth_lat?: number | null
  birth_lon?: number | null
  birth_city?: string | null
  true_solar_time?: boolean
  subject_type?: string
}

/** GET /v1/user/natals 每项 · POST /v1/user/natals 返回 */
export interface Natal {
  id: string
  user_id: string
  label: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
  tz: number
  gender: string | null
  birth_lat: number | null
  birth_lon: number | null
  birth_city: string | null
  true_solar_time: boolean
  subject_type: string
  is_default: boolean
}

/**
 * GET /v1/natal/:id/summary · 命局简介
 *
 * 五行世界观直接映射:
 *   缺 = primary_yongshen (主用神,该补的)
 *   过 = avoid_wuxing[] (忌神,该避的)
 *   身势 = strength_level (偏强/偏弱/中和)
 *   日主 = day_master (甲/乙/丙…)
 */
export interface NatalSummary {
  day_master: string
  strength_level: string
  primary_yongshen: string
  primary_role: string
  secondary_yongshen: string | null
  avoid_wuxing: string[]
  friendly_hint: string
}
