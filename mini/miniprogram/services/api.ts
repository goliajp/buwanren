/**
 * 统一请求层 · Promise 化 wx.request。
 *
 * 语义:
 * - 2xx  → resolve(res.data)
 * - 4xx/5xx → reject(ApiError)
 * - 网络失败 → reject(ApiError{status:0})
 * - 401 → 清本地 token(交给上层决定是否重登;不自动 relaunch)
 *
 * 所有请求自动带 `Authorization: Bearer <token>` 与 `Content-Type: application/json`。
 */

import { CONFIG } from '../config/index'
import { storage } from './storage'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface ApiError {
  status: number
  code?: string
  message: string
}

interface RequestOptions {
  method?: Method
  data?: Record<string, unknown> | undefined
  header?: Record<string, string>
}

function makeError(status: number, body: unknown, fallbackMsg: string): ApiError {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    return {
      status,
      code: typeof b.code === 'string' ? b.code : undefined,
      message:
        typeof b.error === 'string'
          ? b.error
          : typeof b.message === 'string'
            ? b.message
            : fallbackMsg,
    }
  }
  return { status, message: fallbackMsg }
}

export function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method: Method = opts.method ?? 'GET'
  const token = storage.getToken()
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.header ?? {}),
  }
  if (token) {
    header['Authorization'] = `Bearer ${token}`
  }

  return new Promise<T>((resolve, reject) => {
    wx.request({
      url: CONFIG.API_BASE + path,
      method,
      data: opts.data as WechatMiniprogram.RequestOption['data'],
      header,
      success(res) {
        const status = res.statusCode
        if (status >= 200 && status < 300) {
          resolve(res.data as T)
          return
        }
        if (status === 401) {
          storage.clearAll()
        }
        reject(makeError(status, res.data, `HTTP ${status}`))
      },
      fail(res) {
        reject({ status: 0, message: res.errMsg ?? '网络错误' } as ApiError)
      },
    })
  })
}

export const api = {
  get: <T = unknown>(path: string): Promise<T> => request<T>(path, { method: 'GET' }),
  post: <T = unknown>(path: string, data?: Record<string, unknown>): Promise<T> =>
    request<T>(path, { method: 'POST', data }),
  patch: <T = unknown>(path: string, data?: Record<string, unknown>): Promise<T> =>
    request<T>(path, { method: 'PATCH', data }),
  delete: <T = unknown>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
}
