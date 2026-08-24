/**
 * 本命档案 API 封装 · 对应后端 unmei-api /v1/user/natals & /v1/natal/:id/summary
 */

import { api } from './api'
import type { Natal, NatalInput, NatalSummary } from '../types/natal'

export const natalApi = {
  list: (): Promise<Natal[]> => api.get<Natal[]>('/v1/user/natals'),

  create: (input: NatalInput): Promise<Natal> =>
    api.post<Natal>('/v1/user/natals', input as unknown as Record<string, unknown>),

  remove: (id: string): Promise<void> => api.delete<void>(`/v1/user/natals/${id}`),

  activate: (id: string): Promise<{ ok: true }> =>
    api.post<{ ok: true }>(`/v1/user/natals/${id}/activate`),

  summary: (id: string): Promise<NatalSummary> =>
    api.get<NatalSummary>(`/v1/natal/${id}/summary`),
}
