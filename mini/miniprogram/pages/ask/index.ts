import { najiApi } from '../../services/naji'
import type { NajiDetail, NajiHistoryRow, NajiResult } from '../../types/naji'

/**
 * 罗盘旋转最短显示时长(ms) · 与 wxss 的 `.compass-face { transition: transform 3s ... }` 相配
 * 3200ms = CSS 3s + 200ms buffer · 让 face 慢停到位再切结果面,避免 flick
 */
const MIN_SPIN_MS = 3200

/**
 * 8 方位 → face 上默认角度(以正南=0°、顺时针递增)
 * face rotate(θ) 时: 让某方位从原位置转到「指针指向」(正上=0°) 需要 rotate = -angle
 */
const DIRECTION_ANGLE: Record<string, number> = {
  南:   0,
  西南: 45,
  西:   90,
  西北: 135,
  北:   180,
  东北: 225,
  东:   270,
  东南: 315,
}

/** 摇手机检测阈值 · |x|+|y|+|z| */
const ACC_THRESHOLD = 3.6
/** 摇手机冷却期(ms) · 防重复触发 */
const ACC_COOLDOWN_MS = 1500

/** 历史列表默认可见条数 */
const HIST_DEFAULT_LIMIT = 8

/** 时辰名 · 23-01 子 · 01-03 丑 · ... · 21-23 亥 */
const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const

function timeBranchIndex(hour: number): number {
  // 23 归子 · 其它 (hour+1)/2 mod 12
  if (hour === 23) return 0
  return Math.floor((hour + 1) / 2) % 12
}

function fmtClock(d: Date): string {
  const idx = timeBranchIndex(d.getHours())
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${SHICHEN[idx]}时 · ${hh}:${mm}`
}

type Mode = 'idle' | 'spinning' | 'result' | 'history-detail'

interface IData {
  today: string
  clockLabel: string
  mode: Mode
  question: string
  result: NajiResult | null
  history: NajiHistoryRow[]
  historyExpanded: boolean
  historyLimit: number
  /** 罗盘 face 累计旋转度数 · setData 后触发 CSS transition */
  rot: number
}

/** detail → 展示态 · 前端派生 time_label,recommend 后端不返置 null */
function detailToResult(d: NajiDetail): NajiResult {
  const dt = new Date(d.asked_at)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  const hh = String(dt.getHours()).padStart(2, '0')
  const mi = String(dt.getMinutes()).padStart(2, '0')
  return {
    id: d.id,
    asked_at: d.asked_at,
    time_label: `${mm}·${dd} ${hh}:${mi}`,
    quote: d.quote ?? { text: '', source: '' },
    gate: d.gate,
    direction: d.direction,
    gate_explain: d.gate_explain,
    suit: d.suit,
    avoid: d.avoid,
    question: d.question ?? null,
    recommend: null,
  }
}

// 模块级 · 稳定 handler 引用
let accHandler: ((res: WechatMiniprogram.OnAccelerometerChangeListenerResult) => void) | null = null
let accLastTs = 0
let clockTimer: ReturnType<typeof setInterval> | null = null

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    today: '',
    clockLabel: '',
    mode: 'idle',
    question: '',
    result: null,
    history: [],
    historyExpanded: false,
    historyLimit: HIST_DEFAULT_LIMIT,
    rot: 0,
  },

  onShow() {
    this.setToday()
    this.tickClock()
    this.startClock()
    this.loadHistory()
    this.enableAccel()
  },

  onHide() {
    this.disableAccel()
    this.stopClock()
  },

  onUnload() {
    this.disableAccel()
    this.stopClock()
  },

  onAuthReady() {
    this.loadHistory()
  },

  setToday() {
    const d = new Date()
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    this.setData({ today: iso })
  },

  tickClock() {
    this.setData({ clockLabel: fmtClock(new Date()) })
  },

  startClock() {
    if (clockTimer) return
    clockTimer = setInterval(() => this.tickClock(), 30_000)
  },

  stopClock() {
    if (clockTimer) {
      clearInterval(clockTimer)
      clockTimer = null
    }
  },

  onQuestion(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ question: e.detail.value })
  },

  async doSpin() {
    if (this.data.mode === 'spinning') return
    const question = this.data.question.trim()

    // Phase 1 · tap 立即触发预转 · 给用户 feedback(不等 backend)
    // 累计前值上 +2 圈 + 随机 · face CSS 会从当前值 3s ease-out 到这个 preSpin
    const prev = this.data.rot
    const preSpin = prev + 720 + Math.floor(Math.random() * 360)
    this.setData({ mode: 'spinning', rot: preSpin })

    const t0 = Date.now()
    try {
      const result = await najiApi.spin(question ? { question } : {})

      // Phase 2 · backend 返 direction · 修正 rot 让 face 精确停在方位
      // 目标:face 最终旋转值 mod 360 == (360 - directionAngle) % 360
      //       即让 result.direction 对应的 bagua/dir 转到正上方(指针位置)
      // 保证从 preSpin 继续再转至少 2 圈,才落到定位
      const dirAngle = DIRECTION_ANGLE[result.direction] ?? 0
      const base = preSpin + 720                       // 至少再走 2 圈
      const targetMod = (360 - dirAngle) % 360         // 目标 rot mod 360
      const currMod = ((base % 360) + 360) % 360
      let delta = targetMod - currMod
      if (delta < 0) delta += 360
      const finalRot = base + delta
      this.setData({ rot: finalRot })

      const elapsed = Date.now() - t0
      if (elapsed < MIN_SPIN_MS) {
        await new Promise<void>((r) => setTimeout(r, MIN_SPIN_MS - elapsed))
      }
      this.setData({ mode: 'result', result, question: '' })
      wx.vibrateShort({ type: 'medium', success() {}, fail() {}, complete() {} })
      this.loadHistory()
    } catch (_e) {
      this.setData({ mode: 'idle' })
      wx.showToast({ title: '起卦失败,再试一次', icon: 'none' })
    }
  },

  reset() {
    this.setData({ mode: 'idle', result: null })
  },

  async loadHistory() {
    try {
      const list = await najiApi.history()
      this.setData({ history: list })
    } catch (_e) {}
  },

  expandHist() {
    this.setData({
      historyExpanded: true,
      historyLimit: this.data.history.length,
    })
  },

  async openHist(e: WechatMiniprogram.CustomEvent<Record<string, never>>) {
    const id = (e.currentTarget as WechatMiniprogram.CustomEvent['currentTarget'] & {
      dataset: { id?: string }
    }).dataset.id
    if (!id) return
    wx.showLoading({ title: '取回签…', mask: true })
    try {
      const d = await najiApi.detail(id)
      wx.hideLoading()
      this.setData({ mode: 'history-detail', result: detailToResult(d) })
      wx.pageScrollTo({ scrollTop: 0, duration: 200 })
    } catch (_e) {
      wx.hideLoading()
      wx.showToast({ title: '取回失败', icon: 'error' })
    }
  },

  closeHist() {
    this.setData({ mode: 'idle', result: null })
  },

  onRecommend() {
    const r = this.data.result?.recommend
    if (!r) return
    const lines: string[] = []
    if (r.sub_title) lines.push(r.sub_title)
    if (r.price_display) lines.push(r.price_display)
    wx.showModal({
      title: r.name,
      content: lines.join('\n') || '暂无更多信息',
      showCancel: false,
      confirmText: '好',
      success() {},
      fail() {},
      complete() {},
    })
  },

  // ─── 摇手机 · wx.onAccelerometerChange ────────────────────────────
  enableAccel() {
    if (accHandler) return
    accLastTs = Date.now()
    const self = this
    const handler: (res: WechatMiniprogram.OnAccelerometerChangeListenerResult) => void = (res) => {
      const now = Date.now()
      if (now - accLastTs < ACC_COOLDOWN_MS) return
      const mag = Math.abs(res.x) + Math.abs(res.y) + Math.abs(res.z)
      if (mag > ACC_THRESHOLD && self.data.mode === 'idle') {
        accLastTs = now
        self.doSpin()
      }
    }
    accHandler = handler
    wx.startAccelerometer({ interval: 'normal', success() {}, fail() {}, complete() {} })
    wx.onAccelerometerChange(handler)
  },

  disableAccel() {
    if (accHandler) {
      // typings 的 on/off 类型不对称:on 侧回调收 ListenerResult(x/y/z),
      // off 侧却声明成 GeneralCallbackResult。解绑必须传同一个函数引用,cast 掉
      wx.offAccelerometerChange(accHandler as unknown as WechatMiniprogram.OffAccelerometerChangeCallback)
      accHandler = null
    }
    wx.stopAccelerometer({ success() {}, fail() {}, complete() {} })
  },
})
