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

// 注意没有 PATCH:wx.request 不支持它(平台硬限制)。
// 语义上的「部分更新」走 POST,后端在同一路径上把 POST 与 PATCH 挂了同一个 handler。
type Method = 'GET' | 'POST' | 'DELETE'

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
        /* 401 只在【这一条请求确实带了 token】时才清。
           没带 token 的 401 意思是「还没登录」，不是「token 失效」——
           而冷启动时这种请求一定有：匿名登录是异步的，页面 onShow
           抢在它前面就发了一轮，那一轮必然 401。

           无条件清的后果是**把刚刚登录写进去的 token 一并清掉**：
             ① 页面发 /v1/village（这时还没 token）
             ② 登录回来，写下 token
             ③ ①那一条回 401 → clearAll → 刚写的 token 没了
           成不成看②③谁先回来，所以它是个飘的 bug。
           2026-08-29 在镜像上量到过：连开两页，二十五次里有十二次
           登录完还是没 token。 */
        if (status === 401 && token) {
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
  post: <T = unknown>(
    path: string,
    data?: Record<string, unknown>,
    header?: Record<string, string>,
  ): Promise<T> => request<T>(path, { method: 'POST', data, header }),
  /** 部分更新。实际发 POST —— wx.request 不支持 PATCH,后端两个方法等价 */
  patch: <T = unknown>(path: string, data?: Record<string, unknown>): Promise<T> =>
    request<T>(path, { method: 'POST', data }),
  delete: <T = unknown>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
}
