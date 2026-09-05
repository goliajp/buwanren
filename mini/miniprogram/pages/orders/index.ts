/* M2 · 我买过的 —— 花过的钱要能找回来。
 *
 * 在这一页之前，`/v1/orders` 后端一直在、客户端一个人都没有：
 * 下了单就再也看不见（docs/FLOW.md 的 B3）。
 *
 * 2026-08-25 按设计册 10.4 的 M2 排了一遍。原来一行只写得出
 * 状态、金额与**一串订单号** —— 因为列表接口不返回商品名。
 * 名字现在由后端 `my_orders` 的 title 带出来（下单那一刻的 sku 快照），
 * 于是这一列终于写得出「买的是什么」。
 */

import { commerceApi } from '../../services/commerce'
import { storage } from '../../services/storage'
import type { ApiError } from '../../services/api'
import type { OrderCard } from '../../types/commerce'
import { money, 状态那一词, 该做什么 } from '../../utils/money'
import { 物流那一词 } from '../../utils/ship'
import { 一句 } from '../../utils/say'
import { 台账那天 } from '../../utils/day'

/** 一页五笔 —— 设计 10.3：一屏放得下五笔，多了左右翻，不往下滚 */
const 每页 = 5

type Row = OrderCard & { statusText: string; totalText: string; whenText: string; go: string }

interface IData {
  loading: boolean
  err: string
  /** 当前这一页的五笔。**这里不再存「全部」** —— 见 `gotoPage` 的理由 */
  page: Row[]
  pageNo: number
  pageCount: number
  total: number
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    loading: true,
    err: '',
    page: [],
    pageNo: 0,
    pageCount: 0,
    total: 0,
  },

  onShow() {
    if (storage.getToken()) this.load()
  },

  onAuthReady() {
    this.load()
  },

  onTap(e: WechatMiniprogram.BaseEvent) {
    const id = String((e.currentTarget.dataset as Record<string, unknown>).id || '')
    if (id) wx.navigateTo({ url: '/pages/order/index?id=' + id })
  },

  goVillage() {
    wx.switchTab({ url: '/pages/village/index' })
  },

  /* 【翻页翻的是服务端那一页】（2026-09-05）。
     原先是「取一次，本地切片」：`commerceApi.orders()` 不带参数，
     后端默认给 20 条，而这一屏把它按五笔切成四页 ——
     **买过 30 单的人，标题写着「30 笔」，翻到第四页就到头了**，
     剩下十笔他一辈子也够不着，屏上还没有一处说得出为什么。
     `pageCount` 当时是按【拿到几条】算的，所以四页翻得干干净净，
     内部完全自洽 —— 这种缺口不会自己喊。

     现在页码传给后端，`pageCount` 按 `total` 算。代价是翻一页打一次
     接口，跟后台那些列表一样;换来的是「屏上那个数跟够得着的东西对得上」。 */
  gotoPage(no: number) {
    if (no < 0) return
    if (this.data.pageCount && no >= this.data.pageCount) return
    this.load(no)
  },

  onPrev() { this.gotoPage(this.data.pageNo - 1) },
  onNext() { this.gotoPage(this.data.pageNo + 1) },

  load(no = 0) {
    this.setData({ loading: true, err: '' })
    commerceApi.orders(no, 每页).then(
      (page) => {
        const items: Row[] = (page.items || []).map((o) => ({
          ...o,
          /* 名字取下单那一刻的快照。取不到就写单号前八位 ——
             那是我们真知道的东西；编一个「一件商品」出来
             会让人以为系统认得它是什么。 */
          title: o.title
            ? (o.line_count > 1 ? o.title + ' 等 ' + o.line_count + ' 件' : o.title)
            : '单 ' + o.id.slice(0, 8),
          /* 【在履约的那一笔，说包裹走到哪儿了】（2026-09-05 · 逐屏走）。
             `fulfilling` 的中文是「备着」，而包裹可能早就在路上了 ——
             这一列写着「备着」，点进去详情写着「在路上了」，同一单两个说法。
             买家点开「我买过的」问的正是「我那件东西到哪儿了」，
             而这一行给的是错的答案。
             只在 `fulfilling` 这一档换 —— 其余几档（待付、完成、取消、
             已退）说的是这笔【钱】走到哪儿，那不是包裹能替它回答的。 */
          statusText: o.status === 'fulfilling' && o.ship_status
            ? 物流那一词(o.ship_status)
            : 状态那一词(o.status, o.cancel_reason),
          go: 该做什么(o.status),
          totalText: money(o.amount_total_minor, o.currency),
          whenText: 台账那天(String(o.created_at || '')),
        }))
        this.setData({
          loading: false,
          err: '',
          total: page.total,
          page: items,
          pageNo: no,
          /* 【按 total 算，不按拿到几条算】——后者正是上面那段缺口的来源 */
          pageCount: Math.ceil(page.total / 每页),
        })
      },
      (e: ApiError) => this.setData({ loading: false, err: 一句(e) }),
    )
  },
})
