import { najiApi } from '../../services/naji'
import { natalApi } from '../../services/natal'
import { storage } from '../../services/storage'
import type { NatalSummary } from '../../types/natal'
import type { ApiError } from '../../services/api'
import { 一句 } from '../../utils/say'
import { 今天几号 } from '../../utils/day'

/* ── 以下从 `pages/ask` 搬来（REDESIGN.md：起卦归我家）───────── */
/** 摇手机检测阈值 · |x|+|y|+|z| */
const ACC_THRESHOLD = 3.6

/** 摇手机冷却期(ms) · 防重复触发 */
const ACC_COOLDOWN_MS = 1500

// 模块级 · 稳定 handler 引用
let accHandler: ((res: WechatMiniprogram.OnAccelerometerChangeListenerResult) => void) | null = null

let accLastTs = 0
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


const YS_PINYIN: Record<string, string> = {
  木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui',
}


type SummaryView = NatalSummary & {
  primary_pinyin: string
}

/** 弹性槽里那几行。矮屏看不见，长屏才出现（设计 10.1） */
interface RecentRow { id: string; day: string; gate: string; dir: string }

type Mode = 'idle' | 'spinning'

interface IData {
  /** 罗盘的状态。转完就跳去「今天」那一页看结果，所以这里没有 result */
  mode: Mode
  rot: number
  /** 「八月三十 · 周日」—— 说给人听的写法，见 utils/day */
  today: string
  summary: SummaryView | null
  avoidPinyin: string[]
  err: string
  recent: RecentRow[]
  /** 取不到近几次，跟「一次都没转过」是两件事 —— 后者是空数组，不是这一行 */
  recentErr: string
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    today: '',
    summary: null,
    avoidPinyin: [],
    err: '',
    recent: [],
    recentErr: '',
    mode: 'idle',
    rot: 0,
  },

  onShow() {
    this.setToday()
    this.refreshSummary()
    this.loadRecent()
    this.enableAccel()
  },

  onHide() {
    this.disableAccel()
  },

  onUnload() {
    this.disableAccel()
  },

  /* 罗盘多大，看这一屏还剩多少地方 —— 它是吃掉纵向富余的那一块（设计 10.1）。
     写死 560rpx 的话：最矮的机器放不下，最长的机器留一片白。
     减掉的是这一屏上罗盘之外那些**高度固定**的东西（页眉、你缺的、
     今天那一行、时辰、问题框、提示、tabBar），余下的才是它的。 */
  /* 罗盘多大，看这一屏还剩多少地方 —— 它是吃掉纵向富余的那一块（设计 10.1）。
     写死 560rpx 的话：最矮的机器放不下，最长的机器留一片白。

     不猜常数。前两版都栽在这上面：先是「固定 300」，
     后是「底部预留 96」—— 拍出来的数不跟着版式走，改一行文案它就不对了。
     这一版**自校正**：量整页比一屏高出多少，就从罗盘上减掉多少，
     反过来有富余就还回去。量的是真渲染出来的东西。 */

  onAuthReady() {
    this.refreshSummary()
    this.loadRecent()
  },

  onNatalChanged() {
    this.refreshSummary()
  },

  /* 跟村主屏说同一句话：「八月三十 · 周日」。
     这里原先拼的是 `2026-08-30`，而它跟村子是并排的两个 tab ——
     同一天，切过去是一种写法，切回来是另一种。 */
  setToday() {
    this.setData({ today: 今天几号(new Date()) })
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
        err: '',
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
        // 本命真的没了(删了/不属于这个用户)——回到「还没建」的引导是对的
        app.globalData.activeNatalId = null
        storage.clearActiveNatalId()
        this.setData({ err: '', summary: null, avoidPinyin: [] })
      } else {
        /* 别的错(500、断网)不等于「你还没建本命」。

           这里以前不分:两种都渲成「先输入生辰，再看每日」——
           叫一个已经建过本命的人再去建一次,而真正发生的是后端不响应。
           照村主屏那条已有的做法:说一句取不到,不改口。 */
        this.setData({ err: '取不到今天的对照：' + (一句(err)) })
      }
    }
  },

  async doSpin() {
    if (this.data.mode === 'spinning') return
    // Phase 1 · tap 立即触发预转 · 给用户 feedback(不等 backend)
    // 累计前值上 +2 圈 + 随机 · face CSS 会从当前值 3s ease-out 到这个 preSpin
    const prev = this.data.rot
    const preSpin = prev + 720 + Math.floor(Math.random() * 360)
    this.setData({ mode: 'spinning', rot: preSpin })

    const t0 = Date.now()
    try {
      /* 不带 question：那一栏 2026-08-25 从 H1 上拿掉了（见 wxml 里那段）。
         接口仍然收它 —— H4「问问她」做出来时接得上。 */
      const result = await najiApi.spin({})

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
      /* 转完不在这一页出结果 —— 跳去「今天」那一页（设计 H3「转完之后」）。
         **等落位动画走完再跳**：修正角度让罗盘精确停在那个方位，
         是这个交互最值钱的一下，跳早了就把它切掉了。
         上面 MIN_SPIN_MS 那段等待就是为这个。 */
      wx.vibrateShort({ type: 'medium', success() {}, fail() {}, complete() {} })
      this.setData({ mode: 'idle' })
      wx.navigateTo({ url: '/pages/ask/index?id=' + result.id + '&new=1' })
      this.loadRecent()
    } catch (_e) {
      this.setData({ mode: 'idle' })
      wx.showToast({ title: '起卦失败，再试一次', icon: 'none' })
    }
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


  /* 近几次落在哪儿。放在弹性槽里 —— 删掉它这一屏仍然成立，
     那正是「能放进槽里」的判据（设计 10.1）。
     取不到就说取不到：跟「一次都没转过」不是一回事。 */
  async loadRecent() {
    /* try 只裹**取数**这一件事。裹上会改版式的调用的话，它抛出来的错
       会被这里的 catch 接住，然后渲成「近几次取不到」—— 明明 200，
       页面却说取不到，而真正的错一声不响地没了。 */
    let list
    try {
      list = await najiApi.history()
    } catch (_e) {
      this.setData({ recent: [], recentErr: '近几次取不到' })
      return
    }
    this.setData({
      recentErr: '',
      recent: list.slice(0, 3).map((r) => ({
        id: r.id, day: r.date, gate: r.gate, dir: r.direction,
      })),
    })
  },

  onRecent(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id?: string }).id
    if (id) wx.navigateTo({ url: '/pages/ask/index?id=' + id })
  },

  /* 「命」不再是 tab —— 一次性建档不该占常驻导航，它现在是我家的二级页。 */
  goNatal() {
    wx.navigateTo({ url: '/pages/natal/index' })
  },

  /* 「问」也不再是 tab。起卦从我家进去，问签从村民卡进去（见 docs/REDESIGN.md）。 */
  goSpin() {
    wx.navigateTo({ url: '/pages/ask/index' })
  },
})
