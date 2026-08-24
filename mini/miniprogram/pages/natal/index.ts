import { natalApi } from '../../services/natal'
import type { ApiError } from '../../services/api'
import { storage } from '../../services/storage'
import type { Natal, NatalSummary } from '../../types/natal'

const YS_PINYIN: Record<string, string> = {
  木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui',
}

type SummaryView = NatalSummary & { primary_pinyin: string }

interface IData {
  mode: 'form' | 'summary'
  err: string
  loading: boolean
  submitting: boolean
  natal: Natal | null
  summary: SummaryView | null
  avoidPinyin: string[]
  /** 这个人所有的生辰。只有一份时不显示这一段 —— 一份没什么好换的 */
  archive: Natal[]
  /** 换 / 删失败时说一句。成功什么都不说，页面自己会变 */
  archNote: string
  form: {
    date: string
    time: string
    gender: 'M' | 'F'
    label: string
  }
}

Page<IData, WechatMiniprogram.IAnyObject & { pendingReload: boolean; loadDefault(): Promise<void> }>({
  pendingReload: false,

  data: {
    mode: 'form',
    err: '',
    loading: false,
    submitting: false,
    natal: null,
    summary: null,
    avoidPinyin: [],
    archive: [],
    archNote: '',
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
    /* 防重入,但【不丢掉】这一次请求。

       冷启动时两件事几乎同时发生：`onShow` 立刻取一次（那时匿名登录还没回来，
       后端给 401），而登录一回来 `onAuthReady` 会再叫一次。
       第二次撞上的往往是第一次【还没走完 finally】的那一瞬 —— 直接 return
       就等于把重试扔了，页面从此停在「取不到本命」，切一次 tab 才自愈。
       实测时序：78ms 登录 200 → 80ms 那次请求 401 → 81ms onAuthReady 到。

       所以记下来，等这一轮完了再跑一次。 */
    if (this.data.loading) {
      this.pendingReload = true
      return
    }
    this.pendingReload = false
    this.setData({ loading: true })
    const app = getApp<IAppOption>()
    try {
      const list = await natalApi.list()
      this.setData({ archive: list })
      const def = list.find((n) => n.is_default) ?? list[0]
      if (def) {
        try {
          const s = await natalApi.summary(def.id)
          app.globalData.activeNatalId = def.id
          storage.setActiveNatalId(def.id)
          this.setData({
            err: '',
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
        this.setData({ err: '', mode: 'form', natal: null, summary: null })
      }
    } catch (e) {
      /* 取不到不等于没有。

         这里以前是 `mode: 'form'` —— 任何一次请求失败都渲成建本命的表单，
         而用户明明已经建过。照着填下去就**多出一条重复记录**，
         起因只是一次网络抖动。「数据不存在」这个信号被 fallback 吃掉了。

         照村主屏那条已有的做法：说一句取不到，不换屏。 */
      const err = e as ApiError
      this.setData({ err: '取不到本命：' + (err.message || '未知错误') })
    } finally {
      this.setData({ loading: false })
      if (this.pendingReload) {
        this.pendingReload = false
        void this.loadDefault()
      }
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
      /* 档案要跟着刷。这里原先只 setData 了当前这一份 —— 于是刚建的那一条
         在「这些生辰」里看不见，直到切一次 tab 才出现。
         失败不打断：新的这一份已经生效了，档案没刷只是少一行。 */
      natalApi.list().then(
        (all) => this.setData({ archive: all }),
        () => {},
      )
    } catch (_e) {
      wx.showToast({ title: '生成失败', icon: 'error' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  rebuild() {
    this.setData({ mode: 'form' })
  },

  /* 换一份在用的。`activate` 一直有，只在刚建完时被调过一次 ——
     也就是建得了、换不了：有两份生辰的人只能看见其中一份。 */
  onUse(e: WechatMiniprogram.BaseEvent) {
    const id = String((e.currentTarget.dataset as Record<string, unknown>).id || '')
    if (!id) return
    natalApi.activate(id).then(
      () => { this.setData({ archNote: '' }); this.loadDefault() },
      (err: ApiError) => this.setData({ archNote: err.message || '换不过去' }),
    )
  },

  /* 删一份。`natal.remove` 封装了很久没有页面用 —— 建得了、删不掉，
     一个只有入口没有出口的东西（docs/FLOW.md 的判据）。

     在用的那一份不给删：删了之后 `active_natal_id` 会被外键置空
     （20260819_active_natal_fk.sql），起卦就少了用神 —— 那是能做的，
     但**不该由一次误触发生**。先换成别的再删。 */
  onDrop(e: WechatMiniprogram.BaseEvent) {
    const id = String((e.currentTarget.dataset as Record<string, unknown>).id || '')
    if (!id || id === this.data.natal?.id) return
    natalApi.remove(id).then(
      () => { this.setData({ archNote: '' }); this.loadDefault() },
      (err: ApiError) => this.setData({ archNote: err.message || '删不掉' }),
    )
  },
})
