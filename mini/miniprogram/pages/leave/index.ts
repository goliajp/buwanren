/* 注销账号。
 *
 * 【隐私政策上写了两遍，而在这一屏之前一处都做不到】：
 *
 *   「存多久：账号在，数据就在。你退出并删除账号，出生时间与盘会一起
 *     删掉；订单与支付记录按法律要求保留，那部分只留金额与时间」
 *   「你能做什么 · 删：在「设置」里退出并删除账号」
 *
 * 而「设置」上那颗按钮是 `logout()` —— 它清掉本机那份 token，服务端
 * 一行数据都不动。绑了微信的人下次登录回来东西全在；匿名的人只是再也
 * 够不着自己那个号。**这两句话对谁都不成立**。
 *
 * 这一屏把它变成真的。删什么、留什么写在下面那两张单子里 ——
 * 跟后端 `unmei_app::account` 里那张表一一对上，不是各写一份:
 * 屏上说删了而库里留着，是这一屏唯一不能犯的错。
 */
import { mineApi } from '../../services/mine'
import { ensureLogin, logout } from '../../services/auth'
import { storage } from '../../services/storage'
import { 一句 } from '../../utils/say'
import type { ApiError } from '../../services/api'

interface IData {
  删的: string[]
  留的: string[]
  钱的: string[]
  忙: boolean
  说: string
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    /* 【一条一条说出来，不写「以及相关数据」】。后者是条款的说法，
       而人在这一屏上要做的判断是「我舍不舍得」——他得看见舍的是什么。 */
    删的: [
      '出生时间与排出来的盘',
      '算过的说明书',
      '问过的签、屋里说过的话',
      '村里住着的人',
      '得到的徽章、点过的香',
      '报过名的场次',
    ],
    留的: [
      '买过的单子与付款记录（法律要求）',
    ],
    /* 【钱那一头也要说】（2026-09-07 · 文案对行为那一支门禁抓到的第一条）。
       `account.rs` 注销时真的会把还活着的订阅停掉 —— 这是好消息，
       而这一屏一个字都没提。一个订着按月送的人在这里要判断的
       不只是「我舍不舍得」，还有「我走了钱还扣不扣」，
       而那个问题的答案此前只在后端代码里。

       它不进「删的」也不进「留的」：那两栏说的是数据的去留，
       这一条说的是**钱会停**，混进去会让人以为订阅记录被删了。 */
    钱的: [
      '订着的按月送会停掉 —— 不再扣钱',
      '已经扣过的那一期不退，手里那盒照发',
    ],
    忙: false,
    说: '',
  },

  async onLeave() {
    if (this.data.忙) return
    /* 【危险的那一头放 confirm】——跟「设置」那一屏退出时同一条规矩:
       网页版的垫片用的是浏览器 confirm，显示不出两颗按钮的文字，
       而 Playwright 默认 dismiss（= cancel）。把「注销」放 cancel 的话，
       每跑一轮验证都会真的把账号注销掉。 */
    const 答 = await new Promise<boolean>((给) => {
      wx.showModal({
        title: '真的注销？',
        content: '盘、签、村里的人、说明书都会删掉，这个号也再进不来。买过的单子按法律留着，只留金额与时间',
        confirmText: '注销',
        cancelText: '先不',
        success: (r) => 给(!!r.confirm),
        fail: () => 给(false),
      })
    })
    if (!答) return

    this.setData({ 忙: true, 说: '' })
    try {
      await mineApi.deleteMe()
    } catch (e) {
      /* 【失败要说出来，而且不许清本地】。清了的话人会以为注销成功了，
         实际上他的数据还在，而他再也找不到那个号去注销一次。 */
      this.setData({ 忙: false, 说: 一句(e as ApiError) })
      return
    }

    /* 注销完这台手机上那份 token 已经作废（后端认 `deleted_at`，一律 401）。
       换一个干净的匿名身份，回村口 —— 这正是一个刚走的人该落到的地方。 */
    logout()
    const app = getApp<IAppOption>()
    app.globalData.token = null
    app.globalData.user = null
    app.globalData.authSource = null
    app.globalData.activeNatalId = null
    try {
      const { user, source } = await ensureLogin()
      app.globalData.user = user
      app.globalData.token = storage.getToken()
      app.globalData.authSource = source
      app.globalData.activeNatalId = user.active_natal_id
    } catch (e) {
      /* 换不到新身份也没关系:账号已经注销掉了，这一步只是让他落地。
         下次冷启动 `onLaunch` 会再取一次。 */
      console.warn('注销之后换新身份没成，下次冷启动会再取：', e)
    }
    this.setData({ 忙: false })
    wx.showToast({ title: '已注销', icon: 'none' })
    wx.reLaunch({ url: '/pages/village/index' })
  },

  onBack() { wx.navigateBack({ delta: 1 }) },
})
