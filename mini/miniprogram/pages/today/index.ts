import { natalApi } from '../../services/natal'
import { storage } from '../../services/storage'
import type { NatalSummary } from '../../types/natal'
import type { ApiError } from '../../services/api'

const YS_PINYIN: Record<string, string> = {
  木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui',
}

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']

type SummaryView = NatalSummary & {
  primary_pinyin: string
}

interface IData {
  today: { iso: string; weekday: string; remark: string }
  summary: SummaryView | null
  avoidPinyin: string[]
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    today: { iso: '', weekday: '', remark: '' },
    summary: null,
    avoidPinyin: [],
  },

  onShow() {
    this.setToday()
    this.refreshSummary()
  },

  onAuthReady() {
    this.refreshSummary()
  },

  onNatalChanged() {
    this.refreshSummary()
  },

  setToday() {
    const d = new Date()
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const weekday = `周${WEEK_CN[d.getDay()]}`
    this.setData({
      today: { iso, weekday, remark: '一日之相' },
    })
  },

  async refreshSummary() {
    const app = getApp<IAppOption>()
    const nid = app.globalData.activeNatalId
    if (!nid) {
      this.setData({ summary: null, avoidPinyin: [] })
      return
    }
    try {
      const s = await natalApi.summary(nid)
      this.setData({
        summary: {
          ...s,
          primary_pinyin: YS_PINYIN[s.primary_yongshen] ?? 'mu',
        },
        avoidPinyin: (s.avoid_wuxing ?? []).map((w) => YS_PINYIN[w] ?? 'mu'),
      })
    } catch (e) {
      const err = e as ApiError
      // 404/403 · natal 已删或不属当前 user · 清 stale 让 UI 回到"未建本命"引导
      if (err.status === 404 || err.status === 403) {
        app.globalData.activeNatalId = null
        storage.clearActiveNatalId()
      }
      this.setData({ summary: null, avoidPinyin: [] })
    }
  },

  goNatal() {
    wx.switchTab({ url: '/pages/natal/index' })
  },
})
