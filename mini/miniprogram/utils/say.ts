/* 出错时对人说的话（0830 §5.2）。
 *
 * 原先各页都是 `e.message || '未知错误'` —— 而 `e.message` 常常是后端的
 * 技术原文:`not found: report`、`unauthorized`。屏上就那么写着，
 * 用户读到一句英文，既看不懂也不知道下一步该干什么。
 *
 * 【2026-09-02:判据从「有没有汉字」换成后端给的错误码】。
 *
 * 旧判据是「有汉字就是写给人看的，原样显示」。它在【用户自己输的字
 * 被回显进错误串】的时候当场失效 —— 实测:
 *
 *     POST /v1/orders  {"lines":[{"sku_id":"没这个","qty":1}]}
 *     → {"error":"not found: sku 没这个","code":"not_found"}
 *
 * 「没这个」三个字来自用户，于是那条判据认定「这句是写给用户的」，
 * 把整句内部原文推到屏上。而这个 app 里用户输入的东西 ——
 * 名字、地址、问的那一句、留的那句话 —— 全是中文，
 * 所以这不是边角情况，是常态。
 *
 * 错误码不用猜:它是后端【明确给出】的分类
 * （`unmei-domain/src/error.rs` 的 `code()`），跟着响应体一起来
 * （`services/api.ts` 已经把它收下了）。
 *
 * 后端将来要直接对用户说话的话，该加一个专门的字段（比如 `user_message`），
 * 而不是让前端从技术原文里猜哪一句能给人看。
 *
 * 技术原文不丢，留在 `原文` 里 —— 排查时还要它，只是不摆在脸上。
 */

import type { ApiError } from '../services/api'

export interface 说法 {
  /** 摆在屏上的那一句 */
  话: string
  /** 技术原文。收着，不显示 —— 需要时能打出来 */
  原文: string
}

/* 每一句都要说清【发生了什么】+【接下来能做什么】。
   只说「失败了」的那种话等于没说 —— 人读完还是不知道下一步。 */
const 按码: Record<string, string> = {
  not_found: '找不到这个了 —— 退回去再进来试试',
  unauthorized: '还没登录好，稍等一下',
  forbidden: '这个不是你的',
  validation: '有个地方填得不对 —— 回上一步看看',
  conflict: '这一步刚被别处改过 —— 退回去刷新一下再来',
  illegal_state_transition: '这一单现在做不了这件事了 —— 退回去看看它走到哪儿了',
  idempotency_mismatch: '这一下跟刚才那一下对不上 —— 退回去重来一次',
  risk_blocked: '这一笔被拦下了 —— 设置里找客服，把单号念给我们',
  insufficient: '数目不够 —— 退回去看看还剩多少',
  upstream: '那一头一时没应 —— 等一会儿再来',
  bad_request: '这一下发得不对 —— 退回去重来一次',
  internal: '出了点问题，等会儿再来',
  adapter: '出了点问题，等会儿再来',
  repository: '出了点问题，等会儿再来',
  serde: '出了点问题，等会儿再来',
}

export function 人话(e: ApiError | { status?: number; message?: string; code?: string }): 说法 {
  const 原文 = (e && e.message) || ''
  const 码 = (e && (e as { code?: string }).code) || ''
  const s = (e && e.status) || 0

  if (码 && 按码[码]) return { 话: 按码[码], 原文 }

  /* 码认不出来（老版本后端、或者新加了一种）就按状态码兜底。
     这一层不是摆设:新增一种 code 的时候，屏上仍然是一句人话，
     而不是一句英文原文。 */
  const 话 =
    s === 0   ? '没连上，再试一下？' :
    s === 401 ? '还没登录好，稍等一下' :
    s === 403 ? '这个不是你的' :
    s === 404 ? '找不到这个了 —— 退回去再进来试试' :
    s === 422 ? '有个地方填得不对 —— 回上一步看看' :
    s >= 500  ? '出了点问题，等会儿再来' :
                '没成功，再试一下？'
  return { 话, 原文 }
}

/** 只要那一句话 —— 各页 `setData({ err })` 用它 */
export const 一句 = (e: ApiError | { status?: number; message?: string; code?: string }): string =>
  人话(e).话
