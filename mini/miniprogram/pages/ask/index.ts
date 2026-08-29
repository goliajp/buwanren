import { najiApi } from '../../services/naji'
import type { NajiDetail, NajiResult } from '../../types/naji'
import { 今天几号 } from '../../utils/day'




/** 历史列表默认可见条数 */




type Mode = 'idle' | 'spinning' | 'result' | 'history-detail'

interface IData {
  /** 从别处进来时带的签 id */
  wantId: string
  /** 是不是刚转完的那一卦（决定要不要出「← 近签」回退片） */
  fresh: boolean
  today: string
  clockLabel: string
  mode: Mode
  question: string
  result: NajiResult | null
  /** 取不到近签时那一行字。空串 = 取到了（哪怕是零条） */
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


Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    fresh: false,
    wantId: '',
    today: '',
    clockLabel: '',
    mode: 'idle',
    question: '',
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
    this.setData({ wantId: q.id || '', fresh: q.n === '1' || q.new === '1' })
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
      wx.showToast({ title: '这一签取不回来了', icon: 'none' })
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
