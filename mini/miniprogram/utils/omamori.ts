/* 唤醒一枚御守 —— 扫来的和手输的走同一条路。
 *
 * 为什么单独一支：村子主屏（V1 / E2）与一单那一屏（M3）都要这一下。
 * 页面之间不许互相 import（`scripts/check-page-imports.py` 守着，
 * 理由见 `utils/money.ts` 顶上那段：被 import 的那一页里的 `Page()`
 * 会注册到当前正在注册的那一页名下，整个 app 起不来）。
 *
 * 两份实现会漂，而漂的那天症状是：村子上催你去扫，点进单子却没有出口，
 * 或者两边对「认不出这串字」说的不是同一句话。
 */

import { villageApi } from '../services/village'
import type { ApiError } from '../services/api'

export type 唤醒结果 = { ok: true } | { ok: false; msg: string }

/** 成功时自己开「他住进来了」那一屏（设计 V6：实物变成人，值一屏不是一句 toast）。 */
export function 唤醒(carrier: 'qr' | 'nfc', credential: string): Promise<唤醒结果> {
  return villageApi.scan({ carrier, credential }).then(
    (s) => {
      const q = [
        'name=' + encodeURIComponent(s.villager_name || '他'),
        'n=' + (s.moved_in ? '1' : '0'),
        'id=' + encodeURIComponent(s.villager_id || ''),
      ].join('&')
      wx.navigateTo({ url: '/pages/moved/index?' + q })
      return { ok: true } as 唤醒结果
    },
    (e) => {
      /* 认不出这串字**不是一句「失败」就完事**：他手上确实有一枚御守。
         话要说清是哪一种情况，否则他不知道下一步该干什么。 */
      const err = e as ApiError
      return {
        ok: false,
        msg: err.status === 404
          ? '这串字对不上任何一枚御守 —— 再看一眼背面，别漏字母'
          : (err.message || '一时问不到，待会儿再试'),
      } as 唤醒结果
    },
  )
}

/** 起相机扫。**只有真机有** —— 网页版里垫片会抛，不假装成功。 */
export function 扫一枚(): Promise<唤醒结果 | null> {
  return wx.scanCode({ onlyFromCamera: false }).then(
    (r) => 唤醒('qr', r.result),
    // 用户自己取消扫码，不是错误，什么都不用说
    () => null,
  )
}
