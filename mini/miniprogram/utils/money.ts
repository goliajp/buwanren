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

/* 【「已取消」要分清是谁取消的】。超时没付是系统扫掉的
   （payment_sweep + `cancel_reason='expired'`），买家没做过这个动作 ——
   而「不要这一单了」那条文字链就在订单屏上，两件事共用一个词，
   最容易的理解是「我手滑点了它」（2026-09-01 第二轮评审 · 转化路）。
   判据用后端给的 `cancel_reason`，不猜。 */
export function 状态那一词(status: string, cancel_reason?: string | null): string {
  if (status === 'cancelled' && cancel_reason === 'expired') return '超时取消'
  return 状态说法[status] || status
}

/* 卡片右边那个动作词。同一张卡在不同状态下该做的事不一样 ——
   待付的单子最要紧的动作是去付，写「看」等于把它藏起来:
   订单列表上那一笔的唯一动作就是它。 */
export function 该做什么(status: string): string {
  if (status === 'unpaid') return '去付'
  if (status === 'draft') return '接着填'
  return '看'
}

export function money(minor: number, currency: string): string {
  const d = currency === 'JPY' ? 0 : 2
  const sym: Record<string, string> = {
    CNY: '¥', JPY: '¥', USD: '$', EUR: '€', TWD: 'NT$', HKD: 'HK$', GBP: '£', SGD: 'S$',
  }
  const s = sym[currency] || currency + ' '
  if (d === 0) return s + minor
  /* 整数金额【不挂两个零】。`¥99.00` 是记账格式,人不这么说话,
     而那两个零还占着标价上最重的那块地方（商品屏上它跟「99」一样大）。
     有零头才写:¥99 / ¥99.50。 */
  const 元 = Math.floor(minor / 100)
  const 分 = minor % 100
  if (分 === 0) return s + 元
  return s + 元 + '.' + String(分).padStart(2, '0')
}

/* 券面上写的那句话 —— 「八折 · 最多减 ¥100」/「减 ¥20」。
 *
 * 【放在这儿不放页面里】：确认页上的券条、「手里的券」那一屏、
 * 以后订单详情里那一行，说的都得是同一句。分头写的话，
 * 同一张券在两屏上是两种说法，而人会以为那是两张券。
 *
 * 折扣在库里是万分比（`pct_off_bps`，2000 = 减两成）。屏上说「八折」——
 * 那是中文里买东西的说法；「减 20%」是报表的说法。
 * 除不尽的（比如 2345）没有对应的折数，那时才退回百分数，不硬凑。 */
const 折字 = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

export function 券面那句话(c: {
  currency: string
  pct_off_bps: number
  amount_off_minor: number | null
  max_off_minor: number | null
}): string {
  if (c.amount_off_minor && c.amount_off_minor > 0) {
    return '减 ' + money(c.amount_off_minor, c.currency)
  }
  if (!c.pct_off_bps || c.pct_off_bps <= 0) {
    /* 【不编】。券面读不懂的券后端会把 `why` 写满，卡片说的是那一句;
       这里只负责不假装知道它减多少 */
    return ''
  }
  const 主 = 折数(c.pct_off_bps)
  return c.max_off_minor ? 主 + ' · 最多减 ' + money(c.max_off_minor, c.currency) : 主
}

function 折数(bps: number): string {
  const 十分之 = (10000 - bps) / 1000          // 2000 → 8（八折）
  const 一位小数 = Math.round(十分之 * 10) / 10
  if (一位小数 !== 十分之 || 一位小数 <= 0 || 一位小数 >= 10) {
    return '减 ' + (bps / 100) + '%'
  }
  const 整 = Math.floor(一位小数)
  const 零头 = Math.round((一位小数 - 整) * 10)
  if (零头 === 0) return 折字[整] + '折'
  // 八五折:中文里「八五」是 0.85，不读成「八点五」
  return 折字[整] + 折字[零头] + '折'
}


/* 退款单走到哪儿了。取值跟后端 `RefundStatus` 一一对应，不自创。
 *
 * 【为什么要有这一张表】（2026-09-06 · 五路体验走查）。按完「申请退款」,
 * 这一屏此前一个字都不变 —— 提示被随后的 `load()` 清掉，
 * 而订单详情接口那时不返退款单。于是人再按一次，
 * 撞上后端的在途检查，得到一句「有个地方填得不对」。
 * 屏上要说得出「这一笔在哪一步」，才不会有第二次按。 */
const 退款说法: Record<string, string> = {
  requested: '审核中',
  approved: '批了 · 正在退',
  processing: '正在退',
  succeeded: '已退款',
  failed: '退款没成',
  denied: '没批',
  cancelled: '已撤回',
}

export function 退款那一词(status: string): string {
  return 退款说法[status] || status
}
