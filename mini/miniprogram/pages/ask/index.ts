import { najiApi } from '../../services/naji'
import type { NajiDetail, NajiResult } from '../../types/naji'
import { 今天几号 } from '../../utils/day'
import { 那天几点 } from '../../utils/day'
import { 一句 } from '../../utils/say'




/** 历史列表默认可见条数 */




type Mode = 'idle' | 'spinning' | 'result' | 'history-detail'

interface IData {
  /** 从别处进来时带的签 id */
  wantId: string
  /** 是不是刚转完的那一卦（决定要不要出「← 近签」回退片） */
  fresh: boolean
  /** 这一签刚才就问过了 —— 同一小时同一件事是同一签（后端说了算） */
  又问了: boolean
  today: string
  clockLabel: string
  mode: Mode
  question: string
  /* 【问一件具体的事】（2026-09-07 三路验证 · 第一次打开的人）。
     三屏都在说「心里装着一件事」，而 `spin({})` 与 `reading({})`
     都不带问题 —— 后端那条能力（问题进种子、不同的事给不同的答案）
     做好了，前端一个入口都没有。这个产品卖的正是「替你看一件事」。

     入口放在这儿而不是主屏:主屏 2026-08-25 定过「转一下就是转一下」
     （还有断言钉着），那是想清楚的决定;而问签那一条是
     `UNIQUE(user_id, villager_id, asked_on)`，「同一天他已经说过了」
     是设定，加问题会跟它打架。
     起卦没有日限、种子本来就收问题 —— 而人刚看过一签，
     这时他知道自己想问的是哪一件。 */
  /** 输入框开着没。点「问一件具体的事」才开 —— 常驻会把这一屏变成表单 */
  问着: boolean
  /** 正在问 —— 按钮换个字，别让人以为没反应 */
  问中: boolean
  /** 输入框里那几个字 */
  想问: string
  result: NajiResult | null
  /** 取不到近签时那一行字。空串 = 取到了（哪怕是零条） */
  /** 罗盘 face 累计旋转度数 · setData 后触发 CSS transition */
  rot: number
}

/** detail → 展示态 · 前端派生 time_label,recommend 后端不返置 null */
function detailToResult(d: NajiDetail): NajiResult {
  return {
    id: d.id,
    asked_at: d.asked_at,
    /* 这一屏自己拼过一版「08·30 13:53」—— 跟别处的说法又不一样。
       后端那个 `time_label` 更不能用:它写的是「未时 · 13:53」，
       时辰是屏上不许出现的那一类词。统一走 utils/day。 */
    time_label: 那天几点(d.asked_at),
    quote: d.quote ?? { text: '', source: '' },
    gate: d.gate,
    direction: d.direction,
    gate_explain: d.gate_explain,
    suit: d.suit,
    avoid: d.avoid,
    question: d.question ?? null,
    /* 【2026-09-02:接住后端给的推荐】。这里原先写死 `null`，
       而当时后端的 detail 确实不回它 —— 写死是诚实的。
       但这一屏拿到 id 之后会用 `detail(id)` 把整条记录【重取一遍】，
       于是起卦那一瞬间的推荐一渲染就没了:
       `wx:if="{{result.recommend}}"` 永远不成立，
       而那是 ¥199「你的说明书」全 app 唯一一条路
       （第三轮评审 · 第一次打开的人实跑到的）。
       后端补上了 `recommend`（routes/naji.rs 的 detail），这里跟上。 */
    recommend: d.recommend ?? null,
  }
}


Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    fresh: false,
    又问了: false,
    wantId: '',
    today: '',
    clockLabel: '',
    mode: 'idle',
    question: '',
    问着: false,
    问中: false,
    想问: '',
    result: null,
    rot: 0,
  },

  /* 带 id 进来 = 直接看那一签（我家的「近几次」点进来就是这条路）。
     这一页原先只有 `onShow`，收不了参数 —— 于是那条链点进来看到的是起卦页，
     而不是点的那一签。镜像当时没走过它，所以一路绿着
     （2026-08-23 加「近几次」时留下的洞，同一轮补上）。 */
  onLoad(q: Record<string, string | undefined>) {
    /* `new=1` = 刚从我家转完跳过来的那一卦。
       跟「翻回去看某一签」是两种来路：前者不该出「← 近签」那个回退片，
       它不是从列表点进来的。 */
    /* `again=1` = 后端认出这就是刚才那一签（同一小时同一件事）。
       不说的话，屏上看起来像是刚算出来的一件新东西，而它一个字都没变。 */
    this.setData({
      wantId: q.id || '',
      fresh: q.n === '1' || q.new === '1',
      又问了: q.again === '1',
    })
  },

  onShow() {
    this.setToday()
    this.showWanted()
  },

  onHide() {
  },

  onUnload() {
  },

  /* 有 id 就把它取回来摊开。跟 `openHist` 走同一条路 —— 那是同一件事，
     不为「从别处进来」另写一份。 */
  async showWanted() {
    const id = this.data.wantId
    if (!id) return
    this.setData({ wantId: '' })
    try {
      const d = await najiApi.detail(id)
      this.setData({ mode: this.data.fresh ? 'result' : 'history-detail', result: detailToResult(d) })
    } catch (_e) {
      /* 跟 `openHist` 用同一个说法 —— 这一页没有 err 那一栏，
         往 setData 里塞一个没人渲染的字段，等于把话说给自己听。 */
      /* 【这一屏没有「签」】。同文件 wxml 第 112 行的注释已经写过这件事，
         空态那句照着改了，这个 toast 漏了（2026-09-02 第四轮评审 · 文案）。 */
      wx.showToast({ title: '这一次取不回来了', icon: 'none' })
    }
  },

  onAuthReady() {
  },

  /* 跟村主屏说同一句话。这里原先是 `2026-08-30` ——
     同一个产品对同一天两种写法，而 ISO 那种是给系统读的。 */
  setToday() {
    this.setData({ today: 今天几号(new Date()) })
  },



















  /* 没带签进来时的出口。卦在我家转 —— 这一页只负责看。 */
  goHome() {
    wx.switchTab({ url: '/pages/home/index' })
  },

  开问() { this.setData({ 问着: true }) },
  想问输入(e: { detail: { value: string } }) { this.setData({ 想问: e.detail.value }) },

  /* 带着那件事再问一次。
     【同一件事同一小时还是同一签】—— 种子收问题，所以换一件事
     才换一个答案，而同一件事反复问得到的是同一句
     （`naji.rs` 那段注释:「不能反复摇到满意为止」）。
     那正是这个功能的诚实之处，不是限制。 */
  问() {
    const q = this.data.想问.trim()
    if (!q || this.data.问中) return
    this.setData({ 问中: true })
    najiApi.spin({ question: q }).then(
      (r) => {
        this.setData({
          问中: false, 问着: false, 想问: '',
          mode: 'result',
          wantId: r.id,
          又问了: !!r.again,
          result: { ...r, time_label: 那天几点(r.asked_at) },
        })
      },
      (e) => {
        this.setData({ 问中: false })
        wx.showToast({ title: 一句(e as { status?: number; message?: string }), icon: 'none' })
      },
    )
  },

  closeHist() {
    this.setData({ mode: 'idle', result: null })
  },

  onRecommend() {
    /* 「另荐 ›」以前弹一个 modal 就没了 —— 看着像链接，走不通。
       现在真的走过去：一卦之后能做的那件事，得能点进去看。 */
    const r = this.data.result?.recommend
    if (!r) return
    wx.navigateTo({ url: '/pages/product/index?id=' + r.id })
  }
,


})
