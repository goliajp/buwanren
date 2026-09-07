/* 确认（docs/REDESIGN.md R5 · P2）。
 *
 * 原先「买」是一步到位：商品页点一下就建单，直落订单页。
 * 中间少了一屏 —— 而这一屏要问三件事：**几件、寄到哪、要不要留句话**。
 * 一步到位的代价不是少点一下，是这三件事根本没地方问。
 *
 * 网页版上验得到的：数量、留言、算账、「去付」建单。
 * **只有真机有的**：`wx.chooseAddress`（微信地址簿）—— 垫片会抛，不假装成功。
 */

import { commerceApi } from '../../services/commerce'
import { natalApi } from '../../services/natal'
import { 脸 } from '../../utils/face'
import type { ProductDetail } from '../../types/commerce'
import { money, 券面那句话 } from '../../utils/money'
import { 一句, 照原文 } from '../../utils/say'

interface Contact { name?: string; phone?: string; address?: string }

interface IData {
  id: string
  /** 他在上一屏挑的那一档。空 = 上一屏没让他挑（只有一档的商品） */
  wantSku: string
  loading: boolean
  err: string
  p: ProductDetail | null
  /** 挑出来的那个 sku 与它的价 —— 挑不出价的 sku 不能买 */
  skuId: string
  unit: number
  cur: string
  unitText: string
  totalText: string
  /** 御守封着的那位，脸上那个字（姓名末字）。不是御守就是空 */
  face: string
  /** 头像那一段 style。画好脸的人有，没画好的是空串 */
  脸样: string
  /** 买了会不会住进村里 —— 只有会的那种才叫「谁谁的御守」 */
  住进来: boolean
  /** 这一件【真的要寄】吗。只有 shipping 那一种要 ——
   *  御守付完人就搬进来，说明书是算出来的，两样都没有包裹。
   *  见下面 `go()` 里那段。 */
  要寄: boolean
  /** 这一件是不是「按你缺的那一样配」的（`sku.spec_json.needs_yongshen`） */
  要配: boolean
  /** 缺的是什么（主用神）。空串 = 还没填出生时间，那时按钮换成去填 */
  缺: string
  /** 付完之后会发生什么 —— 按这一件的履约方式说一句实话 */
  付完呢: string
  qty: number
  message: string
  /** 券码。空着就是没用券 —— 不预填、不记住上一次 */
  券码: string
  /** 【他手里能用的那几张】。这一格原先只收码，也就是他得先知道那串码 ——
   *  而运营发的券绑在他账号上，系统一直知道，只是从没说过。
   *  `面` 是「八折 · 最多减 ¥100」那句，跟「手里的券」那一屏同一句 */
  我的券: Array<{ code: string; 面: string }>
  /** 这一格现在摆的是第几张。后端把先到期的排在前面，所以默认那一张
   *  正是该先花掉的。多于一张时给一颗「换一张」 */
  第几张: number
  /** 摆在格子里的那句话。**wxml 里不拿变量下标取数组** ——
   *  垫片那一层认不认这种写法是另一回事，而算在这儿本来就更好读 */
  当前券面: string
  /** 他点了「填码」——要手打一个别处拿到的码。切过去就不切回来:
   *  切回来会把他打了一半的字吃掉 */
  手填: boolean
  /** 这张券试得怎么样。'' = 还没试 */
  券状态: '' | '在算' | '用上了' | '不行'
  /** 试不成时的那一句 —— 说清是为什么，不只说「不行」 */
  券说: string
  减了: number
  减了文本: string
  实付文本: string
  contact: Contact | null
  /** 选地址失败时那一行字。真机独有的能力，在网页上会抛 */
  addrNote: string
  /** 【这是一件订阅】（2026-09-06）。`product.kind` 这个字段一直在
   *  `types/commerce.ts` 里，而这一屏**一处都没读过** —— 于是按月来的
   *  东西跟买一盒香长得一模一样：合计写「一共 ¥78」没有「/ 月」、
   *  底下是一次性买卖的话术、还摆着一个数量加减器。
   *  一个怕被套牢的人在这一屏上找不到一个字告诉他这是自动续费。 */
  订阅: boolean
  /** 挑中的那一档叫什么。一件东西只有一档时是空串 —— 那时明细写商品名 */
  档名: string
  /** 寄到哪填了没 —— 「去付」长什么样看它。
   *  这是【实物】：没有地址的订单寄不出去，而订单那一屏也没有补填的地方。 */
  有地址: boolean
  buying: boolean
  note: string
  buyKey: string
}

/* 付完之后会发生什么 —— 底下那一行。
   原先写死一句「付完之后就等它到 —— 到了会有人告诉你」，
   而三种履约里只有一种真的会「到」:御守付完那位当场搬进村里，
   说明书是算出来的。等一个不会来的包裹是这一版最贵的一句错话。 */
/* 【只说这个 app 真会做的事】（2026-09-03 第四轮评审 · 产品完整性）。
   上一版两句都在承诺【通知】:「算好了这一屏会告诉你」「到了会有人告诉你」。
   而全仓没有一处 `requestSubscribeMessage` —— 微信订阅消息的权限
   从没申请过，`wx_message_log` 没有写入点，三种通知一种也发不出去。
   「这一屏会告诉你」更微妙:它字面上没错（订单屏确实会更新），
   可下单成功那一刻页面就 `redirectTo` 走了，人根本不在这一屏上。

   改成说【他要自己去哪儿看】。等一个不会来的通知，比一开始就知道
   要去哪儿看更让人焦躁 —— 而后者是这个 app 现在真做得到的事。
   哪天订阅消息接上了，这几句再改回来，那时它是真的。 */
function 付完会怎样(kind: string, 订阅: boolean): string {
  /* 【订阅先说，因为它说的是「以后还会扣钱」】（2026-09-06 · 五路体验走查）。
     一味香按月送的 `fulfillment_kind` 是 `shipping`（迁移注释写着
     「这样确认屏问地址那一路一个字都不用改」）—— 于是这一屏此前
     把它当成一盒香，底下写着「付完之后就等它到」。
     那是一次性买卖的话术，而这是按月来的东西。 */
  if (订阅) return '每月一盒 · 每期我们开单你来付 · 到期前随时能停，这一期照走完'
  if (kind === 'residency') return '付完就搬进村里那一格 —— 马上就能去屋里坐坐'
  if (kind === 'async_compute') return '付完就开始算 —— 在「我的 · 我买过的」里看进度'
  if (kind === 'shipping') return '付完之后就等它到 —— 物流在「我的 · 我买过的」里'
  return '付完马上就能用'
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    id: '', wantSku: '', loading: true, err: '', p: null,
    skuId: '', unit: 0, cur: 'CNY', unitText: '', totalText: '', face: '', 脸样: '', 住进来: false,
    /* 券码。空着就是没用券 —— 不预填、不记住上一次:
       券是一次性的东西，替人记住它只会让人以为还能再用一次。 */
    券码: '', 券状态: '' as '' | '在算' | '用上了' | '不行',
    券说: '', 减了: 0, 减了文本: '', 实付文本: '',
    我的券: [], 第几张: 0, 当前券面: '', 手填: false,
    要寄: false, 要配: false, 缺: '', 付完呢: '', 订阅: false, 档名: '',
    qty: 1, message: '',
    contact: null, addrNote: '', buying: false, note: '', buyKey: '',
    /* 寄到哪填了没 —— 「去付」长什么样看它。
       这是【实物】：没有地址的订单寄不出去，而订单那一屏也没有补填的地方。
       满橙的大按钮长得跟能按一样，跟填出生时间那一屏是同一个病。 */
    有地址: false,
  },

  onLoad(q: Record<string, string | undefined>) {
    /* 幂等键在进这一屏时就定下来，不在点「去付」时才生成 ——
       点两下就是两个键，也就是两张单（那正是重复扣款的来路）。 */
    this.setData({
      id: q.id || '',
      /* 【他挑的是哪一档】。香有三档（三支 ¥29 / 十支 ¥128 / 单配 ¥268），
         点进来时带着 `sku=`，而这一屏原先从头到尾没读过它 —— 自己在
         `load()` 里挑「第一个有价的」。于是想买 ¥128 的人落到一屏写着
         「一共 ¥29」的确认页，下单建的是三支那一档。
         哪一档排第一由 `ORDER BY s.created_at` 定，而三档是同一条 INSERT
         种下去的、时间戳相同 —— 也就是说买到哪一档没有定则。 */
      wantSku: q.sku || '',
      buyKey: 'confirm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    })
  },

  onShow() {
    this.load()
    this.取我的券()
  },

  onAuthReady() {
    this.load()
    this.取我的券()
  },

  load() {
    const { id } = this.data
    if (!id) { this.setData({ loading: false, err: '没说是哪一件' }); return }
    this.setData({ loading: true, err: '' })
    commerceApi.product(id).then(
      (p) => {
        const 有价 = (x: { current_price_minor?: number | null }) =>
          x.current_price_minor !== null && x.current_price_minor !== undefined
        /* 他挑过就用他挑的。挑的那一档没了价（下架、改价）就说不出来，
           不悄悄换一档给他 —— 换了他也看不出来，直到收到货。 */
        const 想要 = this.data.wantSku
          ? p.skus.find((x) => x.id === this.data.wantSku)
          : undefined
        if (this.data.wantSku && (!想要 || !有价(想要))) {
          this.setData({ loading: false, err: '这一档现在买不了了 —— 回去挑一档别的' })
          return
        }
        const sku = 想要 || p.skus.find(有价)
        const unit = sku ? (sku.current_price_minor || 0) : 0
        const cur = (sku && sku.current_currency) || 'CNY'
        /* 判据用 `kind`，不用 `fulfillment_kind` —— 后者说的是「怎么交付」
           （按月送的香跟买一盒香都是 shipping），前者才说「是不是订阅」 */
        const 订阅了 = !!(p.product && p.product.kind === 'subscription')
        this.setData({
          loading: false, p,
          skuId: sku ? sku.id : '',
          unit, cur,
          unitText: sku ? money(unit, cur) : '',
          // 脸上那个字取姓名末字 —— 跟别处几处一样（门禁 check-face-color 盯着）
          face: p.villager ? p.villager.name.slice(-1) : '',
          脸样: p.villager ? 脸(p.villager.id) : '',
          /* 买了会不会住进村里 —— 只有会的那种才叫「谁谁的御守」。
             香也挂着苏合，但买香是寄一盒香给你。原先拿「有没有关联村民」
             当判据，于是买香的确认页写着「苏合的御守」，
             底下明细却写「苏合配的那一味」——一屏两个名字。 */
          住进来: p.product ? p.product.fulfillment_kind === 'residency' : false,
          /* 【地址只在真要寄的时候问】。上一版对每一件都要地址 ——
             而 ¥99 的御守付完那位就住进村里，一个包裹都没有;说明书是算出来的。
             于是主推的那一件在成交前多一道跟它无关的坎:按钮上写着
             「先填寄到哪儿」，弹出微信地址簿，而那个地址此后没有任何东西用它
             （2026-09-01 第二轮评审 · 转化路）。
             判据用后端给的 fulfillment_kind，不在这里按品类猜。 */
          要寄: p.product ? p.product.fulfillment_kind === 'shipping' : false,
          订阅: 订阅了,
          /* 有几档就说清是哪一档 —— 判据跟商品页同一个:有价的多于一档 */
          档名: (sku && p.skus.filter(有价).length > 1) ? sku.name : '',
          付完呢: 付完会怎样(p.product ? p.product.fulfillment_kind : '', 订阅了),
          /* 【订阅的合计要带上「/ 月」】。少了这两个字，
             屏上那个数看起来就是这一单的全部代价。 */
          totalText: sku ? money(unit * this.data.qty, cur) + (订阅了 ? ' / 月' : '') : '',
          /* 【「按你缺的那一样配」得在按之前说清】（2026-09-07 三路验证 ·
             准备花钱的那一路）。玉坠、单配香、按月送三件都这么写,
             而下单流程此前从没问过买家缺什么 —— 收到的只能是默认款。
             服务端现在会自己去取用神、没有本命就整单拒（`order.rs`），
             这一屏要做的是**别让那次拒绝成为意外**:
             要配的东西就说「按你缺的那一样配」，还没填生辰就把
             按钮换成那件该做的事。判据是 sku 上那个标记，不写死商品号。 */
          要配: !!(sku && sku.spec_json
                   && (sku.spec_json as { needs_yongshen?: boolean }).needs_yongshen),
        })
        if (sku && sku.spec_json
            && (sku.spec_json as { needs_yongshen?: boolean }).needs_yongshen) {
          this.取用神()
        }
        // 券那一头可能先到 —— 两头哪个后到都在这儿汇一次
        this.也许自动用券()
      },
      (e) => this.setData({ loading: false, err: '取不到：' + (一句(e)) }),
    )
  },

  setQty(n: number) {
    const qty = Math.min(99, Math.max(1, n))
    this.setData({
      qty,
      totalText: this.data.skuId
        ? money(this.data.unit * qty, this.data.cur) + (this.data.订阅 ? ' / 月' : '')
        : '',
    })
    // 数量变了，折扣要重算 —— 按比例减的券，减多少跟买多少有关
    if (this.data.券状态 === '用上了') this.试券()
  },
  minus() { this.setQty(this.data.qty - 1) },
  plus() { this.setQty(this.data.qty + 1) },
  onMessage(e: WechatMiniprogram.Input) { this.setData({ message: e.detail.value }) },

  /* 微信地址簿。浏览器里没有对应的东西 —— 垫片抛，这里如实说，
     不给一个「假装填好了」的分支。 */
  chooseAddr() {
    const anyWx = wx as unknown as { chooseAddress?: (o?: unknown) => Promise<Record<string, string>> }
    if (typeof anyWx.chooseAddress !== 'function') {
      this.setData({ addrNote: '这台设备上没有地址簿' })
      return
    }
    /* 两种失败形状都要接：真机上用户取消是 **rejected promise**，
       网页版的垫片是**同步抛**（`deviceOnly` 直接 throw，不返回 promise）。
       只接后一种的话，网页上这一下会窜成未捕获异常，
       而这一屏该说的是「这台设备上做不到」—— 说不出来就等于假装没这回事。 */
    let pending: Promise<Record<string, string>>
    try {
      pending = anyWx.chooseAddress({})
    } catch (e) {
      const err = e as { message?: string }
      /* 地址簿是【设备能力】，不是后端 —— 它的 errMsg 是给开发看的
         （真机上是 `chooseAddress:fail auth deny` 这种）。
         屏上说人话，原文留给控制台。 */
      console.warn('选地址失败：', err && err.message)
      this.setData({ addrNote: '这台设备上选不了 —— 手机上打开小程序再填' })
      return
    }
    pending.then(
      (a) => this.setData({
        addrNote: '',
        有地址: true,
        contact: {
          name: a.userName,
          phone: a.telNumber,
          address: [a.provinceName, a.cityName, a.countyName, a.detailInfo].filter(Boolean).join(''),
        },
      }),
      (e: { message?: string }) => {
        console.warn('选地址失败：', e && e.message)
        this.setData({ addrNote: '没选成 —— 再点一下那一行试试' })
      },
    )
  },

  /* 【只摆能用的】。摆一张点下去被拒的券，比不摆更糟 ——
     而「能不能用」是后端算的（`usable`），这一侧不另判一遍。
     取不到就当没有:这一格本来就还收得了手打的码，不空屏。 */
  取我的券() {
    commerceApi.coupons().then(
      (券) => {
        const 能用 = 券
          .filter((x) => x.usable && x.code)
          .map((x) => ({ code: x.code as string, 面: 券面那句话(x) }))
        this.setData({
          我的券: 能用,
          第几张: 0,
          当前券面: 能用.length ? 能用[0].面 : '',
        })
        this.也许自动用券()
      },
      () => this.setData({ 我的券: [], 当前券面: '' }),
    )
  },

  /* 【摆出来还不够，得替他用上】（2026-09-06 三路验证 · 第一次打开的人）。
     上一版只是把券【摆出来】，要点一下「用这张」才去试、才减 ——
     而那个 chip 没有边框、没有底色，跟旁边「运费 · 包邮」那种纯展示的值
     同色同形。实测那一屏:券条上写着「八折 · 最多减 ¥100」，而「一共」
     还是 ¥29。人读到的是「我有一张券」加「原价」，唯一看着能点的是旁边
     那个橙色的「填码」—— 于是他以为要有码才用得上，然后原价付了。

     用第一张:那是【先到期的那张】（后端排的），也正是该先花掉的那张。

     【为什么要有这个汇合点】。`onShow` 里 `load()` 与 `取我的券()` 是
     两条并行的请求，而 `试券` 头一句就是 `if (!this.data.skuId) return`
     —— 券先到的时候它一声不响地什么都不做，屏上照旧原价。
     头一版就是这么写的，验证脚本当场报「进来时一分没减」。
     所以两头各自到齐时都来这儿一次，由这儿判「够了没有」。

     只自动用一次:人点过「填码」「换一张」之后不再插手，
     那时屏上的选择是他的，不是我们的。 */
  也许自动用券() {
    if (this.data.手填) return
    if (this.data.券状态) return          // 已经试过（用上了 / 不行 / 在算）
    if (!this.data.skuId) return          // 商品那一头还没回来
    if (!this.data.我的券.length) return  // 他手里没有券
    this.用这张()
  },

  /* 点一下 = 把这张的码填进去并当场试一次。
     只填不试的话，人得再按一下旁边那颗按钮，而他刚刚已经按过一下了。 */
  用这张() {
    const c = this.data.我的券[this.data.第几张]
    if (!c) return
    this.setData({ 券码: c.code, 券状态: '', 券说: '', 减了: 0, 减了文本: '', 实付文本: '' })
    this.试券()
  },

  /* 手里不止一张时给的那颗。【换完就试】——换一张而屏上那个数不动，
     人不知道换过去到底是多少，还得再按一次。 */
  换一张() {
    const n = this.data.我的券.length
    if (n < 2) return
    const i = (this.data.第几张 + 1) % n
    this.setData({ 第几张: i, 当前券面: this.data.我的券[i].面 })
    this.用这张()
  },

  /* 要手打一个别处拿到的码。**切过去就不切回来** ——
     切回来会把他打了一半的字吃掉。 */
  要手填() {
    this.setData({ 手填: true, 券码: '', 券状态: '', 券说: '', 减了: 0, 减了文本: '', 实付文本: '' })
  },

  券码输入(e: { detail: { value: string } }) {
    // 输的时候先把上一次的结论清掉 —— 留着旧的「用上了」，
    // 人会以为改完的这个码也验过了
    this.setData({ 券码: e.detail.value, 券状态: '', 券说: '', 减了: 0, 减了文本: '', 实付文本: '' })
  },

  /* 问一次服务端：这张券在这一单上能减多少。
     【不在客户端算】——封顶、余额、活动有效期都在服务端;
     自己算一遍必然对不上，而人是看着这个数按下付款的。 */
  试券() {
    const 码 = this.data.券码.trim()
    if (!码) {
      this.setData({ 券状态: '', 券说: '', 减了: 0, 减了文本: '', 实付文本: '' })
      return
    }
    if (!this.data.skuId) return
    this.setData({ 券状态: '在算', 券说: '' })
    commerceApi.previewOrder(this.data.skuId, this.data.qty, [码]).then(
      (r) => {
        if (r.amount_discount_minor <= 0) {
          // 服务端认这张券，但这一单上减不出钱（比如封顶算下来是 0）——
          // 说清楚，别让人以为用上了
          this.setData({ 券状态: '不行', 券说: '这张券在这一单上减不出钱', 减了: 0, 减了文本: '', 实付文本: '' })
          return
        }
        this.setData({
          券状态: '用上了',
          券说: '',
          减了: r.amount_discount_minor,
          减了文本: money(r.amount_discount_minor, r.currency),
          实付文本: money(r.amount_total_minor, r.currency),
        })
      },
      /* 【券的失败理由照原文说】。后端那几句本来就是给人看的:
         「没有这张券：ABC」「已经挂在另一张单上」「已经过期」——
         翻成通用的「有个地方填得不对」，对着输入框的人不知道
         是码打错了还是这张券用过了。 */
      (e) => this.setData({ 券状态: '不行', 券说: 照原文(e), 减了: 0, 减了文本: '', 实付文本: '' }),
    )
  },

  go() {
    const { p, qty, buying, buyKey, contact, message } = this.data
    if (buying || !p) return
    /* 【差生辰的先去填生辰】。这一件是「按你缺的那一样配」的，
       而没有本命服务端会整单拒（`order.rs`）—— 让人按下去撞那一句,
       就是把一次可以避免的失败留给他。按钮上写的就是这一步（同下面地址那条）。
       排在地址前面:没有生辰这一单根本建不出来，先解决那个。 */
    if (this.data.要配 && !this.data.缺) { this.goNatal(); return }
    /* 没地址时这颗按钮上写的是「先填寄到哪儿」—— 它就该去做那件事。
       原先它写「去付」、是灰的，按下去只在底下冒一句「还差寄到哪」:
       整屏唯一的成交按钮长得跟禁用一样，人按两下没反应就走了。 */
    if (this.data.要寄 && !(contact && contact.address)) { this.chooseAddr(); return }
    if (!this.data.skuId) { this.setData({ note: '这一件挑不出价，买不了' }); return }
    /* 【寄到哪】只对真要寄的那一件是必须的:没有地址就寄不出去，
       而订单那一屏也没有补填的地方，一单落下去就成了悬案。
       御守 / 说明书没有包裹，这一步对它们是纯粹的坎（见上面 `要寄`）。 */
    if (this.data.要寄 && !(contact && contact.address)) {
      this.setData({ note: '还差【寄到哪】—— 上面点一下选个地址，东西要寄到你手上' })
      return
    }
    this.setData({ buying: true, note: '' })
    const c: Record<string, unknown> = { ...(contact || {}) }
    if (message.trim()) c.message = message.trim()
    /* 【只把验过的那张券带上】。输了码但没验成（或者还在算）就不带 ——
       带上去后端会整单拒（券不合用不许悄悄跳过），
       而人以为自己只是少减了点钱，实际是这一单建不出来。 */
    const 券们 = this.data.券状态 === '用上了' && this.data.券码.trim()
      ? [this.data.券码.trim()]
      : undefined
    commerceApi.createOrder(this.data.skuId, qty, buyKey, Object.keys(c).length ? c : undefined, 券们).then(
      (o) => {
        this.setData({ buying: false })
        wx.redirectTo({ url: '/pages/order/index?id=' + o.order_id })
      },
      (e) => this.setData({ buying: false, note: 一句(e) }),
    )
  },

  /* 这一单要配的话，缺的是什么。
     【走跟首页同一条路】：`globalData.activeNatalId` → `summary(id)`。
     它是「此刻在用的那一份」—— 服务端配货读的也是这一份
     （`order.rs` 走 `app_user.active_natal_id`），两边同一个来源。
     取不到就当没填:那时按钮说「先填出生时间」，
     跟服务端那一侧的拒绝是同一件事，不会出现「屏上说得出、下单被拒」。 */
  取用神() {
    const app = getApp<IAppOption>()
    const nid = app.globalData.activeNatalId
    if (!nid) { this.setData({ 缺: '' }); return }
    natalApi.summary(nid).then(
      (s) => this.setData({ 缺: s.primary_yongshen || '' }),
      () => this.setData({ 缺: '' }),
    )
  },

  goNatal() { wx.navigateTo({ url: '/pages/natal/index' }) },

  /* 协议那两条。写在这一屏而不是共用一个跳转工具 ——
     全仓只有三处要它，抽一层反而多一个要读的文件。 */
  goTerms() { wx.navigateTo({ url: '/pages/policy/index?kind=terms' }) },
  goPrivacy() { wx.navigateTo({ url: '/pages/policy/index?kind=privacy' }) },

  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/village/index' }) } })
  },
})
