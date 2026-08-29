/* 出错时对人说的话（0830 §5.2）。
 *
 * 原先各页都是 `e.message || '未知错误'` —— 而 `e.message` 常常是后端的
 * 技术原文:`not found: report`、`unauthorized`。屏上就那么写着，
 * 用户读到一句英文，既看不懂也不知道下一步该干什么。
 *
 * 判据只有一条:**有汉字就是写给人看的**。
 * 后端有些错确实是写给用户的（「这串字对不上任何一枚御守 —— 再看一眼背面」），
 * 那种原样用;英文的一律换成一句人话 + 一条出路。
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

export function 人话(e: ApiError | { status?: number; message?: string }): 说法 {
  const 原文 = (e && e.message) || ''
  const s = (e && e.status) || 0
  // 后端给中文 = 它本来就是写给用户的
  if (/[一-龥]/.test(原文)) return { 话: 原文, 原文 }

  const 话 =
    s === 0   ? '没连上，再试一下？' :
    s === 401 ? '还没登录好，稍等一下' :
    s === 403 ? '这个不是你的' :
    s === 404 ? '找不到这个了' :
    s === 422 ? '有个地方填得不对' :
    s >= 500  ? '出了点问题，等会儿再来' :
                '没成功，再试一下？'
  return { 话, 原文 }
}

/** 只要那一句话 —— 各页 `setData({ err })` 用它 */
export const 一句 = (e: ApiError | { status?: number; message?: string }): string => 人话(e).话
