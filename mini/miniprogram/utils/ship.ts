/* 包裹的说法。
 *
 * 【从订单详情页提上来的】（2026-09-05 · 25 计划的用户逐屏走）。
 * 「我买过的」那一列上，一笔在履约的单子写着「备着」，
 * 而点进去详情写着「在路上了」—— 同一单，两屏两个说法，
 * 而买家点开那一列问的正是「我那件东西到哪儿了」。
 * 列表要说得出包裹走到哪儿，就得跟详情用同一张表:
 * 各写一份的话，它们迟早分头漂。
 */
/** 包裹状态的说法。取值跟后端 `ShipmentStatus` 一一对应，不自创。
 *
 *  【2026-09-01 修】这张表原先写着 `pending`（后端没有这一档），
 *  却【缺了 `preparing`】—— 而建运单时状态是写死的 'preparing'
 *  （unmei-app/src/fulfillment.rs），也就是每一单的第一档。
 *  落点是 `物流说法[s.status] || s.status`，兜底把原始英文原样显示，
 *  于是订单屏上直接印着 `preparing`。库里当时 744 单在这一档
 *  （占三成一），跟盘上那个「南 vs 南方」是同一个形状:
 *  写死的键跟真值差一个词，`||` 兜底，错的跟对的看着一样。
 *  `returning`（退回中）同样缺，一并补上。 */
const 物流说法: Record<string, string> = {
  preparing: '备货中', picked_up: '已揽收', in_transit: '在途',
  out_for_delivery: '派件中', delivered: '已签收', exception: '有异常',
  returning: '退回中', returned: '已退回', cancelled: '已取消',
  // 轨迹里可能出现的那几种（后端认不出的记 unknown，不编成「在途」）
  departed: '离开集散中心', arrived_at_sort_facility: '到达集散中心',
  failed_delivery: '投递失败', unknown: '承运商没说清',
}

/** 屏上那一词。表里没有的原样留着 —— 不编一个好听的名字出来 */
export function 物流那一词(status: string): string {
  return 物流说法[status] || status
}
