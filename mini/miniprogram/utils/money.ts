/* 金额与订单状态的说法。
 *
 * 为什么单独一支：这两个原先长在 `pages/orders/index.ts` 上，别的页去 import 它。
 * 而构建是「__beginPage(某页) → import 那一页」顺着 app.json 走的 ——
 * 一个页面 import 另一个页面时，被 import 的那一页里的 `Page()`
 * 会注册到**当前正在注册的那一页**名下，然后把注册位清空，
 * 于是当前页自己的 `Page()` 就没主了，整个 app 起不来。
 *
 * 早先 `order` import `orders` 没出事，只是因为它排在后面 ——
 * 那时 `orders` 已经在模块缓存里，import 是空操作。
 * 也就是说那条依赖一直靠 app.json 里的先后顺序活着，
 * 而顺序是会被改的（2026-08-23 加 `confirm` 时就撞上了）。
 * 搬到这里之后，谁 import 都一样。
 */

/** 状态的中文说法。取值跟后端 `OrderStatus` 一一对应，不自创 */
export const 状态说法: Record<string, string> = {
  draft: '草稿',
  unpaid: '待付',
  paid: '已付',
  fulfilling: '备着',
  done: '完成',
  cancelled: '已取消',
  refund_partial: '部分退款',
  refunded: '已退款',
  disputed: '有争议',
}

export function money(minor: number, currency: string): string {
  const d = currency === 'JPY' ? 0 : 2
  const sym: Record<string, string> = {
    CNY: '¥', JPY: '¥', USD: '$', EUR: '€', TWD: 'NT$', HKD: 'HK$', GBP: '£', SGD: 'S$',
  }
  const s = sym[currency] || currency + ' '
  if (d === 0) return s + minor
  return s + Math.floor(minor / 100) + '.' + String(minor % 100).padStart(2, '0')
}
