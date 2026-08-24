/**
 * 摇卦问事 API 封装 · 对应后端 /v1/naji/*
 */

import { api } from './api'
import type {
  NajiDetail,
  NajiHistoryRow,
  NajiResult,
  NajiSpinReq,
} from '../types/naji'

interface HistoryResponse {
  items: NajiHistoryRow[]
}

export const najiApi = {
  spin: (req: NajiSpinReq = {}): Promise<NajiResult> =>
    api.post<NajiResult>('/v1/naji/spin', req as unknown as Record<string, unknown>),

  history: async (): Promise<NajiHistoryRow[]> => {
    const r = await api.get<HistoryResponse>('/v1/naji/history')
    return r.items ?? []
  },

  detail: (id: string): Promise<NajiDetail> =>
    api.get<NajiDetail>(`/v1/naji/${id}`),
}
