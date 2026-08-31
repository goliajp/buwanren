/* 谁能来 —— 挑一位不完人请回家。
 *
 * 它替掉了「铺」（docs/REDESIGN.md R3）。差别不在换个名字：
 * 铺是按 category 分栏的目录，谁都能有；这一页只干一件事 ——
 * 把「还能请谁」摆出来。东西长在卖它的人身上，所以入口是人，不是货架。
 *
 * **四十位都在册上**，但不平级：现在能请的摆在前面（大卡、能点），
 * 还没来的收成一行「另外 N 位还在路上」，想看再展开（设计册 10.8）。
 *
 * 原先是四十位平级混排、五位一页翻 —— 而在卖的只有四位，
 * 于是第二页往后整整七页全是灰的「还没来」，翻页翻不出任何东西。
 * 那个结构上先后打了三个补丁（「这一页都请不动」的横幅、「只看在卖的」
 * 筛选、它在矮屏被收起后又补的第二个入口）—— 补丁到第三个就该改结构了。
 * 现在三个补丁一起没了：默认一屏就是全部能请的人，不用翻。
 *
 * 「只列在卖的那几位，读的人会以为世上只有那几位」这条顾虑仍然成立，
 * 所以四十位一个不少 —— 只是没来的那些不占着地方要人翻。
 *
 * 顺带：`/v1/products` 的调用方从铺移到了这里。铺删掉之后它不会变成孤儿。
 */

import { villageApi } from '../../services/village'
import { 一列脸纹, 脸 } from '../../utils/face'
import { natalApi } from '../../services/natal'
import type { ApiError } from '../../services/api'
import type { VillagerCard } from '../../types/village'
import { 轻 } from '../../utils/feel'
import { 一句 } from '../../utils/say'

type 位 = { id: string; name: string; sub: string; onSale: boolean; product: string | null; face: string; lack: string; direction: string;
            /** 同色之内的脸纹 —— 缺「近人」那一路有十一位，不然十一张一模一样。
                在【切段之后】发，所以映射那一步它还没有 */
            纹?: string
            /** 头像那一段 style。画好脸的人有，没画好的是空串 */
            脸样: string }

interface IData {
  loading: boolean
  err: string
  /** 现在能请的。这一屏的主体 —— 大卡、能点 */
  能请: 位[]
  /** 还没上架的。默认收起来，只报个数 */
  没来: 位[]
  /** 收着的时候露三张脸 —— 光一行「另外 36 位」是个数字,
   *  而这一屏卖的是人。三张脸让那 36 位有重量 */
  预告: 位[]
  /** 展开了没。能请的一位都没有时默认就是展开的 —— 收着的话那是一屏空白 */
  展开: boolean
  /** 「你缺的」那一行。取不到就空着 —— 它是理由，不是门槛 */
  lack: string
  /** 取用神失败与「还没建本命」是两件事，分开说 */
  lackErr: string
  /** 为什么是这几位 —— 后端给的那条理由。没按用神排过就是空的 */
  why: string
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { loading: true, err: '', 能请: [], 没来: [], 预告: [], 展开: false, lack: '', lackErr: '', why: '' },

  /* 无条件取，不拿 token 当守卫 —— 跟村主屏一致。
     带守卫的写法在【还没登录】时什么都不做，页面就一直停在「取着……」，
     而逐页扫只看有没有报错，于是空着也算过（2026-08-23 假服务端上抓到）。
     没登录就让它 401，页面照实说取不到；`onAuthReady` 落下来再取一次。 */
  onShow() {
    this.load()
  },

  onAuthReady() {
    this.load()
  },

  /* 先问用神，再取名册。
     两件事并行看着快一点，但那样名册是【没按用神排过】的，而顶上那句
     「你缺 X，下面这几位跟你补得上」照样会说出来 —— 说了一个还没发生的因果。
     慢那一个来回，换这一屏说的话是真的。 */
  async load() {
    this.setData({ loading: true, err: '' })
    const 用神 = await this.loadLack()
    villageApi.all(用神).then(
      (list: VillagerCard[]) => {
        /* 顺序由后端定 —— 按用神排要用 `lack_bias` × `yongshen_bias`
           两张表，那是领域判断，不该在页面里抄一份（抄一份就会漂）。
           不传用神时它退回原来的规矩：在卖的排前面，再按 id。 */
        const 全部: 位[] = list.map((v) => ({
          id: v.id,
          name: v.name,
          sub: [v.title, v.art].filter(Boolean).join(' · '),
          onSale: !!v.omamori_product_id,
          product: v.omamori_product_id,
          // 头像占位:姓名末字。等 40 张画好换成图片地址,版式不动
          face: v.name.slice(-1),
          脸样: 脸(v.id),
          lack: v.lack || '',
          // 头像底色按方向分 —— 四十位一个颜色时分不出谁是谁
          direction: v.direction || '',
        }))
        /* 顺序由后端定 —— 按用神排要用 `lack_bias` × `yongshen_bias`
           两张表，那是领域判断，不该在页面里抄一份（抄一份就会漂）。
           这里只按「能不能请」切两段，段内顺序原样保留。 */
        const 能请 = 全部.filter((x) => x.onSale)
        const 没来 = 全部.filter((x) => !x.onSale)
        /* 脸纹在【切段之后】发。两段各自并排显示，档位要在各自段里均分 ——
           在切段之前发的话，一段里可能连着三个同档。 */
        for (const 段 of [能请, 没来]) {
          const 纹们 = 一列脸纹(段)
          段.forEach((x, i) => { x.纹 = 纹们[i] })
        }
        this.setData({
          loading: false,
          /* 顶上那句的理由，用【头一位的】那条 —— 它是主方向那一条。
             没按用神排过时后端给 null，这一句就不说（设计册 10.8）。 */
          why: (list[0] && list[0].why) || '',
          能请,
          没来: 没来,
          预告: 没来.slice(0, 3),
          // 一位都请不动时直接摊开 —— 收着的话这一屏是空的
          展开: 能请.length === 0,
        })
      },
      (e) => this.setData({ loading: false, err: '取不到：' + (一句(e)) }),
    )
  },

  /* 「另外 N 位还在路上」。展开是这一屏唯一一个纯看的动作，
     所以它得有反应 —— 落下来的那一列用的是 app.wxss 里那支 .enter，
     跟村主屏、问签结果同一套动作语言。 */
  onToggle() {
    轻()
    this.setData({ 展开: !this.data.展开 })
  },

  /* 顶上那句「你缺 X，这几位跟你补得上」。
     没本命就不说这句 —— 不编一个理由出来。 */
  /** 返回用神（五行单字）—— 名册要按它排，所以取回来给调用方 */
  async loadLack(): Promise<string | undefined> {
    const nid = getApp<IAppOption>().globalData.activeNatalId
    if (!nid) {
      this.setData({ lack: '', lackErr: '' })
      return undefined
    }
    try {
      const s = await natalApi.summary(nid)
      this.setData({ lack: s.primary_yongshen, lackErr: '' })
      return s.primary_yongshen || undefined
    } catch (e) {
      const err = e as ApiError
      if (err.status === 404 || err.status === 403) {
        this.setData({ lack: '', lackErr: '' })
      } else {
        // 取不到用神不该让整页失败 —— 挑人这件事不依赖它
        this.setData({ lack: '', lackErr: '一时取不到你缺的那一样' })
      }
      // 取不到用神就不按它排 —— 名册照原来的规矩来，那句话也就不说
      return undefined
    }
  },

  onTap(e: WechatMiniprogram.BaseEvent) {
    轻()
    const id = (e.currentTarget.dataset as { id?: string }).id
    const 那位 = this.data.能请.find((x) => x.id === id)
    /* 没上架的点不动。**不是点了再说「买不了」** —— 那是先答应再反悔；
       行上已经写着「未上架」，它就该按不动。 */
    if (那位 && 那位.onSale && 那位.product) {
      wx.navigateTo({ url: '/pages/product/index?id=' + 那位.product })
    }
  },

  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/village/index' }) } })
  },
})
