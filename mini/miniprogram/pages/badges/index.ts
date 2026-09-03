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
  /* 【2026-09-03 加回来了】。这一条 2026-09-01 撤过 —— 那时小程序里没有
     任何活动页面，也没有一处调活动接口，而它原先指向的是「谁能来」名册，
     跟线下活动毫无关系。当时写的是「有活动入口那天再把两边一起加回来」。
     今天报名整条链接上了（服务端 + 这一屏 + 后台签到），
     徽章也随之回到在架（20260903006），所以这条路指得出去了。 */
  first_activity: { url: '/pages/activity/index', 说: '看看有什么活动' },
}

/* 同一条路上只给最近的那一枚:按 `去处` 里的 url 分组，
   每条路只留列表里第一枚还没拿到的。 */
/* 【每一枚配一张像素图】（2026-09-01 第二轮评审 · 视觉）。
   屏上原先是印刷体汉字（香 / 月 / 七 / 百 / 头）摆在一圈虚线里 ——
   系统字，而这个产品全身是像素画:四十位村民、六间屋、一整幅村子、
   底栏三对图标、四张空态道具。混一套系统字进来，那一屏立刻读成
   「还没做完」。

   图画的是【真正奖的那件事】，不是名字里的那个字:
   头一回 = 一根刚抽出来的签、一百次 = 一摞签、七天没断 = 七道刻痕、
   一个月 = 一弯月、闻过香 = 一支点着的香。

   按 `code` 索引，不按 `id`:code 是语义的（`first_naji`），
   id 是流水号（`b_first`）。
   图从 `rooms/tools/export-tabicons.mjs` 出，跟底栏图标同一套画法。
   门禁 check-badge-art 盯着「在发的每一枚都有图、图也都真在磁盘上」。 */
const 图名: Record<string, string> = {
  first_naji: 'first',
  hundred_naji: 'hund',
  continous_7: 'streak',
  continous_30: 'moon',
  first_purchase: 'incense',
}

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
          /* 图名带上得没得到那一档:得到的压在琥珀圆牌上（深棕），
             没得到的是灰的空圈。取不到图名就留空 —— wxml 那边会退回
             印刷体那个字，而门禁不许在发的徽章走到那一支。 */
          图: 图名[b.code] ? `${图名[b.code]}${b.earned ? '' : '-off'}` : '',
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
