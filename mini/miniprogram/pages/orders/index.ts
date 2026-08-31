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
import { money, 状态说法, 该做什么 } from '../../utils/money'
import { 一句 } from '../../utils/say'

/** 一页五笔 —— 设计 10.3：一屏放得下五笔，多了左右翻，不往下滚 */
const 每页 = 5

type Row = OrderCard & { statusText: string; totalText: string; whenText: string; go: string }

interface IData {
  loading: boolean
  err: string
  items: Row[]
  page: Row[]
  pageNo: number
  pageCount: number
  total: number
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    loading: true,
    err: '',
    items: [],
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

  gotoPage(no: number) {
    const { items } = this.data
    const count = Math.ceil(items.length / 每页)
    if (no < 0 || no >= count) return
    this.setData({
      pageNo: no,
      pageCount: items.length ? count : 0,
      page: items.slice(no * 每页, no * 每页 + 每页),
    })
  },

  onPrev() { this.gotoPage(this.data.pageNo - 1) },
  onNext() { this.gotoPage(this.data.pageNo + 1) },

  load() {
    this.setData({ loading: true, err: '' })
    commerceApi.orders().then(
      (page) => {
        const items: Row[] = (page.items || []).map((o) => ({
          ...o,
          /* 名字取下单那一刻的快照。取不到就写单号前八位 ——
             那是我们真知道的东西；编一个「一件商品」出来
             会让人以为系统认得它是什么。 */
          title: o.title
            ? (o.line_count > 1 ? o.title + ' 等 ' + o.line_count + ' 件' : o.title)
            : '单 ' + o.id.slice(0, 8),
          statusText: 状态说法[o.status] || o.status,
          go: 该做什么(o.status),
          totalText: money(o.amount_total_minor, o.currency),
          whenText: (o.created_at || '').slice(5, 10).replace('-', '/'),
        }))
        this.setData({ loading: false, err: '', total: page.total, items })
        this.gotoPage(0)
      },
      (e: ApiError) => this.setData({ loading: false, err: 一句(e) }),
    )
  },
})
