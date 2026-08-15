import { natalApi } from '../../services/natal'
import { storage } from '../../services/storage'
import type { Natal, NatalSummary } from '../../types/natal'

const YS_PINYIN: Record<string, string> = {
  木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui',
}

type SummaryView = NatalSummary & { primary_pinyin: string }

interface IData {
  mode: 'form' | 'summary'
  loading: boolean
  submitting: boolean
  natal: Natal | null
  summary: SummaryView | null
  avoidPinyin: string[]
  form: {
    date: string
    time: string
    gender: 'M' | 'F'
    label: string
  }
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    mode: 'form',
    loading: false,
    submitting: false,
    natal: null,
    summary: null,
    avoidPinyin: [],
    form: {
      date: '1995-06-15',
      time: '14:30',
      gender: 'M',
      label: '默认',
    },
  },

  onShow() {
    this.loadDefault()
  },

  onAuthReady() {
    this.loadDefault()
  },

  async loadDefault() {
    if (this.data.loading) return
    this.setData({ loading: true })
    const app = getApp<IAppOption>()
    try {
      const list = await natalApi.list()
      const def = list.find((n) => n.is_default) ?? list[0]
      if (def) {
        try {
          const s = await natalApi.summary(def.id)
          app.globalData.activeNatalId = def.id
          storage.setActiveNatalId(def.id)
          this.setData({
            mode: 'summary',
            natal: def,
            summary: { ...s, primary_pinyin: YS_PINYIN[s.primary_yongshen] ?? 'mu' },
            avoidPinyin: (s.avoid_wuxing ?? []).map((w) => YS_PINYIN[w] ?? 'mu'),
          })
        } catch (_es) {
          // summary 未就绪或异常 · 依然占用这个 natal(is_default),不打回 form
          app.globalData.activeNatalId = def.id
          storage.setActiveNatalId(def.id)
          this.setData({
            mode: 'form',
            natal: def,
            summary: null,
            avoidPinyin: [],
          })
        }
      } else {
        // 用户名下无 natal · 清任何 stale + 显 form
        app.globalData.activeNatalId = null
        storage.clearActiveNatalId()
        this.setData({ mode: 'form', natal: null, summary: null })
      }
    } catch (_e) {
      this.setData({ mode: 'form', natal: null, summary: null })
    } finally {
      this.setData({ loading: false })
    }
  },

  onDate(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ 'form.date': e.detail.value })
  },
  onTime(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ 'form.time': e.detail.value })
  },
  setMale() {
    this.setData({ 'form.gender': 'M' })
  },
  setFemale() {
    this.setData({ 'form.gender': 'F' })
  },
  onLabel(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ 'form.label': e.detail.value })
  },

  async submit() {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    try {
      const { form } = this.data
      const [y, m, d] = form.date.split('-').map((n) => parseInt(n, 10))
      const [hh, mm] = form.time.split(':').map((n) => parseInt(n, 10))
      const natal = await natalApi.create({
        label: form.label.trim() || '默认',
        year: y,
        month: m,
        day: d,
        hour: hh,
        minute: mm,
        tz: 8.0,
        gender: form.gender,
        subject_type: 'person',
      })
      // create 已把新 natal 设为 default,activate 幂等确保 active_natal_id 也刷
      await natalApi.activate(natal.id)
      const s = await natalApi.summary(natal.id)

      const app = getApp<IAppOption>()
      app.globalData.activeNatalId = natal.id
      storage.setActiveNatalId(natal.id)
      app.broadcast('onNatalChanged')

      this.setData({
        mode: 'summary',
        natal,
        summary: { ...s, primary_pinyin: YS_PINYIN[s.primary_yongshen] ?? 'mu' },
        avoidPinyin: (s.avoid_wuxing ?? []).map((w) => YS_PINYIN[w] ?? 'mu'),
      })
      wx.showToast({ title: '已生成', icon: 'success' })
    } catch (_e) {
      wx.showToast({ title: '生成失败', icon: 'error' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  rebuild() {
    this.setData({ mode: 'form' })
  },
})
