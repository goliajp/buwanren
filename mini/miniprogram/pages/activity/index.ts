/* 线下活动 —— 村子之外真会发生的那几件事。
 *
 * 【这一页在 2026-09-03 之前不存在】。`/v1/activity` 后端一直在，
 * 三场活动在库里，后台在算报名率，屏上写着「48/100 已报名」——
 * 而【没有任何人能成为其中一个】：报名这条链整条不存在，
 * `activity_registration` 有表、有唯一约束、零行、零处引用。
 * 徽章「到过场」挂在一个永远不会发生的动作上，六枚里有一枚发不出来
 * （所以它 2026-09-01 被下架了，那条注释还留在 badges/index.ts 里）。
 *
 * 服务端那一半这一天接上了（报名 / 退订 / 名单 / 签到 + 徽章），
 * 这一页是它在用户这一侧的出口。
 *
 * 这一屏只做两件事：**哪几场还能去**，以及**报名 / 不去了**。
 * 不做详情页 —— 三场活动，每场三行说得完，多一跳只是多一跳。
 */

import { activityApi } from '../../services/activity'
import type { Activity } from '../../types/activity'
import { 一句, 照原文 } from '../../utils/say'
import { 那天几点 } from '../../utils/day'
import { 轻 } from '../../utils/feel'

/** 屏上那一行的形状 —— 时间与人数都在这里算好，wxml 里不做运算 */
interface 一场 extends Activity {
  什么时候: string
  报了没有: boolean
  满了没有: boolean
  /** 「还差 12 个」/「满了」/「48 人报了」 */
  人数话: string
}

interface IData {
  loading: boolean
  err: string
  场次: 一场[]
  /** 正在报 / 正在退的那一场，按钮上要显示「稍等」*/
  忙着的: string
}

const 类别名: Record<string, string> = {
  market: '市集',
  course: '课程',
  ritual: '法会',
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { loading: true, err: '', 场次: [], 忙着的: '' },

  /* 无条件取，不拿 token 当守卫 —— 跟村主屏、「订着的」一致。
     带守卫的写法在还没登录时什么都不做，页面停在「取着……」，
     而逐页扫只看有没有报错，于是空着也算过。 */
  onShow() {
    this.load()
  },

  onAuthReady() {
    this.load()
  },

  async load() {
    this.setData({ loading: true, err: '' })
    try {
      /* 【两条一起等】。名单与「我报了哪些」缺一不可 ——
         只拿到场次的话，报过名的人看到的还是「报名」那颗按钮，
         点下去得到「你已经报过这一场了」，那是把系统知道的事
         推给用户去撞。 */
      const [场次, 我报的] = await Promise.all([
        activityApi.list(),
        activityApi.mine().catch(() => [] as string[]),
      ])
      this.setData({ loading: false, 场次: 场次.map((a) => 摆一行(a, 我报的)) })
    } catch (e) {
      this.setData({
        loading: false,
        err: '取不到：' + 一句(e as { status?: number; message?: string }),
      })
    }
  },

  async onSignUp(e: WechatMiniprogram.BaseEvent) {
    const id = String(e.currentTarget.dataset.id || '')
    const 这一场 = this.data.场次.find((a) => a.id === id)
    if (!这一场 || this.data.忙着的) return
    轻()
    this.setData({ 忙着的: id })
    try {
      if (这一场.报了没有) {
        await activityApi.cancel(id)
        wx.showToast({ title: '已经取消', icon: 'none' })
      } else {
        await activityApi.register(id)
        wx.showToast({ title: '报上了', icon: 'none' })
      }
      /* 【重取，不在本地改数】。人数是服务端数出来的 ——
         本地 +1 的话，别人同时报满了这一场，屏上仍然显示「还差 1 个」，
         而下一次点会失败。这一屏只有三行，重取一次是便宜的。 */
      await this.load()
    } catch (err) {
      /* 后端这几句是给人看的（「这场满了」「这场已经开始了，报名截止」），
         照原文上屏 —— 翻成通用话术等于把它说了什么丢掉。 */
      wx.showToast({
        title: 照原文(err as { status?: number; message?: string }),
        icon: 'none',
        duration: 2400,
      })
    } finally {
      this.setData({ 忙着的: '' })
    }
  },

  onBack() {
    wx.navigateBack({ delta: 1 })
  },
})

function 摆一行(a: Activity, 我报的: string[]): 一场 {
  const 报了没有 = 我报的.includes(a.id)
  const 还差 = a.max_participants - a.current_count
  const 满了没有 = 还差 <= 0
  return {
    ...a,
    什么时候: 那天几点(a.start_at),
    报了没有,
    满了没有,
    /* 【说还差几个，不说报了几个】。「48 人报了」是给办活动的人看的数；
       对着这一屏的人要判断的是「我还去得了吗」。
       快满的时候这句话本身就是理由。 */
    人数话: 满了没有 ? '满了' : `还差 ${还差} 个`,
    category: 类别名[a.category] || a.category,
  }
}
