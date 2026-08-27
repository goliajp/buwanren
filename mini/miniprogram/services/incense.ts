/** 同步点香 · 对应 unmei-api /v1/incense（设计册 E1） */
import { api } from './api'

/** 到点时的这一场；**不到点是 null** —— 设计册 10.7：不做「还没开始」的占位。 */
export interface IncenseNow {
  session_key: string
  started_at: string
  burn_seconds: number
  /** 取不到就是 null。**不是 0** —— 那是句假话，而这一行宁可不显示 */
  lit_count: number | null
  i_lit: boolean
}

export const incenseApi = {
  now: (): Promise<IncenseNow | null> => api.get<IncenseNow | null>('/v1/incense'),
  lit: (): Promise<{ ok: boolean; lit_count: number | null }> =>
    api.post<{ ok: boolean; lit_count: number | null }>('/v1/incense/lit', {}),
}
