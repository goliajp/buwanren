/* 那一册 —— 买了报告之后手里拿到的东西（设计册 M2「看 ›」的落点）。
 *
 * 这一页不滚动（设计册 10.3）。六页各占一屏，底下一排页名，
 * 想看用神就直接点「用神」—— 比一路滑下去找快。
 *
 * 页序、标题、每页出处都是后端排好的：那是产品文案，改一句不该重新发版。
 * 所以这一侧只有两个模板 —— 四柱那页（这册的门面，专门画）和其余页。
 * 后端加一页，这里不动。
 *
 * 册子还没出的那一半（买家先买后填生辰）不是错误页：它是这一单真实的
 * 状态，所以照样有标题、有说明、有一条「去填生辰」的路（设计册 10.7）。
 */

import { reportApi } from '../../services/report'
import type { Report, ReportPage } from '../../services/report'
import { 轻 } from '../../utils/feel'
import { storage } from '../../services/storage'
import { 一句 } from '../../utils/say'

Page({
  data: {
    id: '',
    loading: true,
    err: '',
    /** awaiting_natal 时这一屏说的是「还差你的生辰」，不是报告 */
    status: '' as '' | 'ready' | 'awaiting_natal',
    whose: '',
    birthLine: '',
    /** 页名那一排 */
    tabs: [] as string[],
    at: 0,
    page: null as ReportPage | null,
    /** 五行条要按最大值折算成百分比 —— 47 跟 8 画一样长的话这一页白画 */
    bars: [] as Array<{ k: string; v: number; pct: number }>,
  },

  onLoad(q: Record<string, string>) {
    this.setData({ id: q.id || '' })
    /* 有 token 才取。匿名登录是 app.ts 异步做的，而这一页 onLoad 立刻就取 ——
       冷启动那一次必然 401，而这一屏会写着「取不到这一册」停在那儿。
       没 token 就先不取，等 `onAuthReady`。 */
    if (storage.getToken()) this.load()
  },

  /** 登录完了再取一次 —— 冷启动时 onLoad 那一次是空跑的 */
  onAuthReady() {
    if (!this.data.status) this.load()
  },

  async load() {
    if (!this.data.id) {
      this.setData({ loading: false, err: '没说是哪一册' })
      return
    }
    this.setData({ loading: true, err: '' })
    try {
      const r: Report = await reportApi.one(this.data.id)
      const tabs = (r.pages || []).map((p) => p.title)
      this.setData({
        loading: false,
        status: r.status,
        whose: r.whose || '',
        birthLine: r.birth_line || '',
        tabs,
        at: 0,
      })
      this.pages = r.pages || []
      this.show(0)
    } catch (e) {
      this.setData({ loading: false, err: 一句(e as { status?: number; message?: string }) })
    }
  },

  /** 后端给的那几页。放在 this 上而不是 data 里：一次只画一页，
   *  整册塞进 data 会让每次翻页都把六页重新过一遍 setData */
  pages: [] as ReportPage[],

  show(i: number) {
    const p = this.pages[i]
    if (!p) return
    // 条按这一页里最大的那根折算。用固定分母（比如 100）的话，
    // 五行都在 20 上下时六根条一样长，等于没画
    const max = Math.max(1, ...(p.bars || []).map((b) => b.v))
    this.setData({
      at: i,
      page: p,
      /* 最高的那一根标出来 —— 它是「这个人偏在哪一行」的答案，
         而五根一样重的话，读的人还得自己比一遍 */
      bars: (p.bars || []).map((b) => ({
        ...b, pct: Math.round((b.v / max) * 100), top: b.v === max,
      })),
    })
  },

  onTab(e: WechatMiniprogram.BaseEvent) {
    轻()
    this.show(Number(e.currentTarget.dataset.i))
  },

  onPrev() { 轻(); if (this.data.at > 0) this.show(this.data.at - 1) },
  onNext() { 轻(); if (this.data.at < this.pages.length - 1) this.show(this.data.at + 1) },

  /** 还差生辰那一屏的出路：去填 */
  onFill() {
    wx.navigateTo({ url: '/pages/natal/index' })
  },

  onBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/me/index' }) })
  },
})
