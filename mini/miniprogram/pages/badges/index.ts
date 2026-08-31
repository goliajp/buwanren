/* 徽章 —— 得到过什么。
 *
 * 后端一直在发（起卦到次数就发一个，库里已经发出去几百个），
 * 而**没有任何客户端读它**：得了也没人告诉你。这一页是它的出口。
 */

import { mineApi } from '../../services/mine'
import { storage } from '../../services/storage'
import type { ApiError } from '../../services/api'
import type { Badge } from '../../types/mine'
import { 一句 } from '../../utils/say'
import { 那一天 } from '../../utils/day'
import { 轻 } from '../../utils/feel'

/* 还没拿到的那几枚，点一下去【能拿到它的地方】。
   这一屏原先只是一张清单：六枚全灰、一个都点不动，
   唯一能做的事是「回去」（标尺 §1.5.4 第二问「我能干什么」）。
   收集系统里每一枚都该指得出路 —— 而这几条路本来就都在。

   拿到过的那几枚不跳：它们是纪念，不是待办。 */
const 去处: Record<string, { url: string; 说: string }> = {
  first_naji: { url: '/pages/home/index', 说: '去问一件事' },
  continous_7: { url: '/pages/home/index', 说: '去问一件事' },
  continous_30: { url: '/pages/home/index', 说: '去问一件事' },
  hundred_naji: { url: '/pages/home/index', 说: '去问一件事' },
  first_purchase: { url: '/pages/incense/index?id=prod-suhe-incense', 说: '去看看香' },
  first_activity: { url: '/pages/invite/index', 说: '去村里看看' },
}

/* 同一条路上只给最近的那一枚:按 `去处` 里的 url 分组，
   每条路只留列表里第一枚还没拿到的。 */
function 只留最近(list: Array<{ code: string; earned: boolean }>): Set<string> {
  const 给过 = new Set<string>()
  const 已: Set<string> = new Set()
  for (const b of list) {
    if (b.earned) continue
    const 那 = 去处[b.code]
    if (!那) continue
    if (给过.has(那.url)) 已.add(b.code)
    else 给过.add(那.url)
  }
  return 已
}

Page({
  data: {
    loading: true,
    err: '',
    items: [] as Badge[],
    got: 0,
    all: 0,
  },

  onShow() {
    if (storage.getToken()) this.load()
  },

  onAuthReady() {
    this.load()
  },

  /* 点一枚还没拿到的，去能拿到它的地方。
     `switchTab` 与 `navigateTo` 是两条路 —— 我家是 tab 页，
     用错那一个会静静地什么都不发生。 */
  onTap(e: WechatMiniprogram.BaseEvent) {
    const code = String((e.currentTarget.dataset as { code?: string }).code || '')
    const 那 = 去处[code]
    if (!那) return
    const 那位 = this.data.items.find((x: { code: string }) => x.code === code)
    if (那位 && (那位 as { earned?: boolean }).earned) return
    轻()
    if (那.url.startsWith('/pages/home/index')) {
      wx.switchTab({ url: '/pages/home/index' })
      return
    }
    wx.navigateTo({ url: 那.url })
  },

  load() {
    this.setData({ loading: true, err: '' })
    mineApi.badges().then(
      (list) => this.setData({
        loading: false,
        err: '',
        items: (() => { const 后面那些 = 只留最近(list); const 已给过 = (c: string) => 后面那些.has(c); return list.map((b) => ({
          ...b,
          // 只留到日，时分秒对「哪天得的」没有意义
          /* 拿到那天说人话：「2026年8月30日」而不是「2026-08-30」。
             这是一枚纪念，不是台账上的一行 —— 台账（下单、寄出）才用数字。
             `check-day-words` 那一支只盯「页面自己拼日期」，
             而这里是把服务端的串切一刀，它够不着。 */
          earned_at: b.earned_at ? 那一天(b.earned_at) : null,
          /* 没拿到的才给去处 —— 拿到过的是纪念，不是待办。
             而【同一条路上只给最近的那一枚】:头一回 / 七天 / 一个月 /
             一百次这四枚指的是同一件事，四张卡都写「去问一件事」的话，
             屏上就是四行一样的橙字，看不出先做哪个。
             后面那几枚留着解锁条件当目录，本来就够。 */
          去: b.earned || 已给过(b.code) ? '' : (去处[b.code] ? 去处[b.code].说 : ''),
        })) })(),
        got: list.filter((b) => b.earned).length,
        all: list.length,
      }),
      (e: ApiError) => this.setData({ loading: false, err: 一句(e) }),
    )
  },

  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/me/index' }) } })
  },
})
