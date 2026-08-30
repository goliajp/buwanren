import { natalApi } from '../../services/natal'
import type { ApiError } from '../../services/api'
import { storage } from '../../services/storage'
import type { Natal, NatalSummary } from '../../types/natal'
import { 一句 } from '../../utils/say'

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
  /** 谁是【用户真的选过的】。picker 的初始值不算答案，见 data 里的注释 */
  填了: { date: boolean; time: boolean; gender: boolean }
  /** 三样齐了没 —— 按钮长什么样看它。空表时一颗满橙的大按钮
   *  长得跟能按一样，而此刻它按不出任何东西 */
  齐了: boolean
  /** 还差哪几样。**这跟 `err` 是两件事**：`err` 是「取不到」，
   *  屏上就不该有表单了；差几样是「你回去填」，表单必须还在 */
  缺提示: string
  缺了: { date: boolean; time: boolean; gender: boolean }
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
    /* picker 需要一个初始值才知道该翻到哪儿，但那个值【不是用户的答案】。
       原先它直接显示成 1995-06-15 / 14:30 / 男 —— 谁不改就直接按「算一算」，
       算出来的是别人的命，而且一路无错可报。
       所以分开两件事：`form` 给 picker 用，`填了` 记谁真的选过。 */
    form: {
      date: '1995-06-15',
      time: '14:30',
      gender: 'M',
      label: '默认',
    },
    填了: { date: false, time: false, gender: false },
    齐了: false,
    缺提示: '',
    缺了: { date: false, time: false, gender: false },
  },

  onShow() {
    this.loadDefault()
  },

  onAuthReady() {
    this.loadDefault()
  },

  async loadDefault() {
    /* 防重入，但【不丢掉】这一次请求。

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
          // summary 未就绪或异常 · 依然占用这个 natal(is_default)，不打回 form
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
      this.setData({ err: '取不到本命：' + (一句(err)) })
    } finally {
      this.setData({ loading: false })
      if (this.pendingReload) {
        this.pendingReload = false
        void this.loadDefault()
      }
    }
  },

  /* 算完之后的下一步。这一屏原先只有「再填一份」——
     最贵的那一步做完了却没有出口，而这个结果的用处正是「照它挑人」。 */
  goInvite() { wx.navigateTo({ url: '/pages/invite/index' }) },

  onDate(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ 'form.date': e.detail.value, '填了.date': true, '缺了.date': false })
    this.重算齐了()
  },
  onTime(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ 'form.time': e.detail.value, '填了.time': true, '缺了.time': false })
    this.重算齐了()
  },
  setMale() {
    this.setData({ '填了.gender': true, '缺了.gender': false })
    this.重算齐了()
    this.setData({ 'form.gender': 'M' })
  },
  setFemale() {
    this.setData({ '填了.gender': true, '缺了.gender': false })
    this.重算齐了()
    this.setData({ 'form.gender': 'F' })
  },
  onLabel(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ 'form.label': e.detail.value })
  },

  /** 三样齐了没。按钮的样子跟着它 —— 空表时一颗满橙的大按钮
   *  长得跟能按一样，而按下去只会得到一句「还差……」 */
  重算齐了() {
    const f = this.data.填了
    this.setData({ 齐了: f.date && f.time && f.gender })
  },

  async submit() {
    if (this.data.submitting) return
    /* 三样都得是【他自己选的】。picker 的初始值只是它翻到哪儿，不是答案 ——
       不拦的话，谁没改就直接按下来，算出的是别人的命，而且一路都不报错。
       后面所有的排序、用神、每天那一句都压在这三个数上。 */
    // 名字跟屏上的字段名一字不差 —— 报错里说「出生日」而屏上写「哪一天」，
    // 人得先在两个词之间对一次才知道说的是哪一栏
    const 缺 = ([['date', '哪一天'], ['time', '几点'], ['gender', '性别']] as const)
      .filter(([k]) => !this.data.填了[k]).map(([, n]) => n)
    if (缺.length) {
      /* **不写进 `err`**。表单整块挂在 `wx:elif="{{!err}}"` 上 ——
         写进去的话，按一下「算一算」整个表单就消失了，屏上只剩一行粉字，
         连回去填的地方都没有（逐帧拍才看见：那一帧是空白页加一句话）。
         `err` 是「取不到」，这是「你回去填」，两件事。 */
      this.setData({
        缺提示: `还差${缺.join('、')} —— 点一下填上，这三样决定后面所有的话`,
        缺了: {
          date: !this.data.填了.date,
          time: !this.data.填了.time,
          gender: !this.data.填了.gender,
        },
      })
      return
    }
    this.setData({ submitting: true, err: '', 缺提示: '' })
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
      /* 【不弹 toast】。屏幕已经从一张表单变成了结果 —— 那本身就是回执。
         再用一个黑框宣布一次「已生成」是同一件事说两遍，而且它正好
         盖在结果中间（逐帧拍看见的：400ms 那一帧，黑框压着那句人话）。 */
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
      (err: ApiError) => this.setData({ archNote: 一句(err) }),
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
      (err: ApiError) => this.setData({ archNote: 一句(err) }),
    )
  },
})
