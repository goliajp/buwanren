/* 主屏 · 村 —— 路线图第 10 步的前端半边。
 *
 * 画面全部来自 rooms/,这一页一笔都不画。它只做宿主那几件事:
 *   ① 取 <canvas type="2d"> 的 node,连同贴图路径交给 mountVillage
 *   ② 把 bindtap 的坐标换算好交给引擎的 VILLAGE_HIT —— 判定在引擎里,
 *      不在这里重写一份(写两份迟早会漂,漂出来的症状是「看得见的点不到」)
 *   ③ 副标题与收集数写进 data
 *
 * 【现在能点到的范围有限,如实写着】4 个房门节点 + 12 位村民。
 * 路线图要的是 40 户、空屋也要能点且会说「这间空着,等人」——
 * 那需要一张 40 格的宅基表,村子里还没有。差的是数据不是这一页。
 */

import { villageApi } from '../../services/village'
import type { ApiError } from '../../services/api'
import { 唤醒, 扫一枚 } from '../../utils/omamori'
import { 轻 } from '../../utils/feel'
import { incenseApi } from '../../services/incense'
import { storage } from '../../services/storage'
import type { VillagerInVillage } from '../../types/village'

// 三支生成物,靠副作用挂到 globalThis 上。顺序不能换。
require('../../engine/engine.js')
require('../../engine/host.js')
require('../../engine/plots.js')
require('../../engine/rooms/index.js')
require('../../engine/village.js')

const TILES = '/engine/assets/tilemap_packed.png'

interface Hit {
  /** villager = 走动的那位村民本人;plot = 一格宅基(房子) */
  kind: 'villager' | 'plot'
  who?: string
  at: string
  home?: boolean
  x: number
  y: number
}
interface Census { 已落位: number; 待落位: number; 住着: number; 村民: number }
interface Plot { id: string; note: string }
declare const mountVillage: (
  node: unknown,
  tilesSrc: string,
  onSub?: (s: string) => void,
) => { stop(): void }
declare const VILLAGE_HIT: (x: number, y: number) => Hit | null
declare const VILLAGE_CENSUS: () => Census
declare const VILLAGE_SET_HOME: (ids: string[]) => void
declare const VILLAGE_PLOTS: Plot[]
declare const VILLAGE_SIZE: { w: number; h: number }

// 走动的那几位在画面上的贴图名 → 中文名。宅基那一路的名字来自服务端,
/* ROOM_INDEX 与 hasRoom 搬到 `pages/villager` 去了 —— 判断「进不进得了屋」
   的地方跟着「进屋」那颗按钮走。 */

// 各页各叫各的名字:这些页面文件没有 import / export,
// tsc 把它们当脚本、作用域是合并的,两处都叫 IData 会互相污染
/* 问候语与日期（设计册 V1 / 10.8）。
   **按你现在几点说话** —— 引擎那句「清晨」说的是画面里的昼夜循环，
   村子的天几分钟转一轮，跟你几点没关系。

   分档按人怎么过一天来切，不按整点均分：五点到十点是早上，
   十点到十三点是上午，晚上九点之后是「夜深了」——
   那句话对着的是还没睡的人。 */
function 问候(h: number): string {
  if (h < 5) return '夜深了'
  if (h < 10) return '早上好'
  if (h < 13) return '上午好'
  if (h < 17) return '下午好'
  if (h < 21) return '傍晚好'
  return '夜深了'
}

/* 「八月二十 · 周四」。中文数字照设计册写 ——
   「8/28」是给系统读的，「八月二十八」是说给人听的。 */
const 汉数 = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
function 汉日(n: number): string {
  if (n <= 10) return 汉数[n]
  if (n < 20) return '十' + 汉数[n - 10]
  if (n === 20) return '二十'
  if (n < 30) return '二十' + 汉数[n - 20]
  if (n === 30) return '三十'
  return '三十' + 汉数[n - 30]
}
function 今天几号(d: Date): string {
  const 周 = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${汉日(d.getMonth() + 1)}月${汉日(d.getDate())} · 周${周}`
}

interface VillageData {
  cssW: number
  cssH: number
  sub: string
  /** 问候语与日期（设计册 V1）。按【你】现在几点说，不按画面里的昼夜 */
  greet: string
  today: string
  /** 今晚那一场开着没有（设计册 E1）。开着，槽里那一句才是入口 */
  tonight: boolean
  lived: number
  total: number
  /** 他刚说的那一句 */
  /** 这一格能不能进屋(房间搬进小程序了没) */
  err: string
  /** 手上有一枚已签收还没扫开的御守（设计册 E2「该扫了」）。
   *  没有就是 false —— 这一条只在该出现时出现，常驻的提示会被无视。 */
  toScan: boolean
  /** 手输的那串编号（E2 的弹性槽）。扫不出来的人走这条路 */
  code: string
  codeErr: string
  codeBusy: boolean
  /** 某位今天说的一句（设计册 V1）。null = 村里还没人，这一块整个不摆。
   *  它会改画布的可用高度 —— 从无到有那天要重算，见 `fitCanvas` */
  says: null | { villager_id: string; name: string; title: string | null; art: string | null; text: string; face: string }
  /** 正在找那一位的御守 —— 找的时候按钮换个字，别让人以为没反应 */
}

Page<VillageData, WechatMiniprogram.IAnyObject>({
  data: { cssW: 0, cssH: 0, sub: '', greet: '', today: '', tonight: false, lived: 0, total: 40, err: '', toScan: false, code: '', codeErr: '', codeBusy: false,
    says: null },

  handle: null as { stop(): void } | null,
  // id → 请回家了没。村子画面里那几位与后端的 id 是同一套(ayun / tao / popo / tenz …),
  // 所以这里不需要另造一张映射表 —— 造了就会跟 seed 漂。
  atHome: {} as Record<string, boolean>,
  nameOf: {} as Record<string, string>,

  /* 匿名登录是 app.ts 在 onLaunch 里【异步】做的,而这一页 onShow 立刻就取村子——
     冷启动时会抢在 token 之前,拿到 401。app.ts 的 broadcast('onAuthReady')
     就是为这件事准备的,今 / 命 / 我三页都接了,这一页漏了。

     症状:第一次打开显示「取不到村子」,而且此后再也不重取。
     本机拿假服务端验不出来 —— 假服务端不认 token,怎么都给 200。
     是把移动网页版接上【真后端】跑那一遍才露出来的。 */
  onAuthReady() {
    this.刷问候()
    this.reload()
  },

  onShow() {
    this.刷问候()
    this.reload()
  },

  /* 每次回到这一屏都重算一次：这一屏是 tab，人会在傍晚离开、夜里回来，
     而问候语说错时间比不说更糟。 */
  刷问候() {
    const now = new Date()
    this.setData({ greet: 问候(now.getHours()), today: 今天几号(now) })
    /* 今晚开着没有。取不到就当没开 —— 猜「开着」的话，
       槽里那一句会把人送进一屏说「还没开始」的东西。 */
    incenseApi.now().then(
      (n) => this.setData({ tonight: !!n }),
      () => this.setData({ tonight: false }),
    )
  },

  goTonight() { wx.navigateTo({ url: '/pages/lighting/index' }) },

  /** 说话那位的那一页。她已经住着，所以点进去是她本人，不是空屋 */
  onSays() {
    const s = this.data.says
    if (!s) return
    轻()
    wx.navigateTo({ url: `/pages/villager/index?id=${s.villager_id}` })
  },

  reload() {
    // 收集数与「谁请回家了」都以服务端为准。引擎那边的 VILLAGE_CENSUS 只报
    // 画面里画了几户,那是另一件事,两个数不该混用。
    villageApi.mine().then(
      (v) => {
        const m: Record<string, boolean> = {}
        v.villagers.forEach((x: VillagerInVillage) => { m[x.id] = x.at_home })
        this.atHome = m
        // 告诉引擎谁住着 —— 门口挂灯还是挂空白门牌,由这一句决定
        VILLAGE_SET_HOME(v.villagers.filter((x) => x.at_home).map((x) => x.id))
        // 名字也从服务端拿,页面不再抄一份
        v.villagers.forEach((x: VillagerInVillage) => { this.nameOf[x.id] = x.name })
        /* 「该扫了」那一条出现或消失，画布的可用高度就变了 —— 得重算一次，
           否则那一条把整屏顶出去（村子这一屏本来就是刚好放得下的）。 */
        const 该扫 = !!v.to_scan
        /* 「今天说的一句」跟「该扫了」一样会改可用高度 —— 村里第一个人
           住进来那天它从无到有，画布得跟着让位。只看 toScan 变没变的话，
           那一天整屏会被顶出去 88px。 */
        /* 头像的占位:姓名末字。没有美术之前不假装有立绘 ——
           但「有人在跟你说话」得一眼成立,纯文字做不到。
           等 40 张头像画好,这一行换成图片地址即可,版式不动。 */
        const 说的 = v.today_says
          ? { ...v.today_says, face: v.today_says.name.slice(-1) }
          : null
        const 变了 = 该扫 !== this.data.toScan || !!说的 !== !!this.data.says
        this.setData({ lived: v.found, total: v.total, err: '', toScan: 该扫, says: 说的 })
        if (变了 && this.data.cssW) { this.fitCanvas(); this.mount() }
      },
      /* 【还没登录完】不等于【取不到】。匿名登录是 app.ts 异步做的，
         而这一页 onShow 立刻就取一次 —— 冷启动那一次必然 401，
         随后 onAuthReady 会重取。把那一次也报出来，用户会看见
         「取不到村子：unauthorized」闪一下，而那句话是假的。
         （2026-08-18 在手机上看镜像时实测到的：每 100ms 采一次 err，
           冷启动全程里它真的出现过。）
         有 token 之后还失败，才是真取不到。 */
      (e) => {
        if (!storage.getToken()) return
        this.setData({ err: '取不到村子：' + ((e as ApiError).message || '未知错误') })
      },
    )
  },

  /* 画布按【可用空间】铺，不是硬按屏宽。
     设计册 10.1 说场景画布 cover、吃掉纵向富余 —— cover 的意思本来就是
     按可用空间铺，而不是按宽度算完就不管高度够不够。

     原先是 `cssH = 屏宽 × 960/704`，与可用高度无关：窄高屏上它顶得出去，
     而「该扫了」那一条一出现（E2）整屏就放不下。
     现在取两者的小者：常规态在 iPhone SE 上宽度仍是瓶颈（0.533 < 0.622），
     所以照样铺满屏宽、两侧没有留白；只有挤不下时画布才缩一点点。 */
  fitCanvas() {
    const win = wx.getWindowInfo()
    // 头部与提示条的高度用常量，不去量。
    // 量完再改、改完再量的收敛循环把版式变成了时序问题 —— 这个仓在我家那一屏
    // 上栽过一次（2026-08-23：慢机器上还没落定就被量走，本机绿、别处红）。
    /* 头部两行（问候语 + 日期）实测 70px。写死是刻意的 ——
       量完再改、改完再量的收敛循环把版式变成了时序问题（我家那一屏栽过）。
       **改头部的版式就要改这个数**：它俩对不上时，画布不会让位，
       症状是「多一条就超出去几十像素」，而那几十像素正好等于差值。 */
    const 头部 = 70
    const 提示条 = this.data.toScan ? 56 : 0
    /* 「某位今天说的一句」那一块，实测 90px。跟头部同一个道理：写死，
       **改那一块的版式就要改这个数**。它是条件出现的（空村时没有），
       所以跟提示条一样要参与重算，否则村里第一个人住进来那天，
       多出来的那一块会把整屏顶出去。 */
    const 说的 = this.data.says ? 90 : 0
    /* 收集进度条常驻,固定 34px。它不是弹性槽 —— 核心反馈不许在矮屏上消失 */
    const 进度条 = 34
    const 可用 = win.windowHeight - 头部 - 提示条 - 说的 - 进度条
    const 等比 = Math.round((win.windowWidth * VILLAGE_SIZE.h) / VILLAGE_SIZE.w)
    const cssH = Math.min(等比, Math.max(120, 可用))
    const cssW = Math.round((cssH * VILLAGE_SIZE.w) / VILLAGE_SIZE.h)
    this.setData({ cssW, cssH })
  },

  onReady() {
    if (typeof VILLAGE_CENSUS !== 'function') {
      this.setData({ err: '村子脚本没加载出来 —— 跑过 npm run build:engine 吗？' })
      return
    }
    // 画布铺满屏宽,按村子自己的宽高比。像素尺寸是村子说了算(mountVillage 里设),
    // 这里只决定它在屏幕上占多大 —— 两者分开,村子才在所有机型上是同一幅画。
    // 宽高比也从 VILLAGE_SIZE 读:村子扩过一次地,写死的比例会把画面压扁。
    this.fitCanvas()
    this.mount()
  },

  /* 拿画布节点、把引擎挂上去。

     **画布的屏上尺寸一变就得重挂一次。** 「该扫了」那一条出现时
     `fitCanvas` 会改 cssW/cssH，而改 canvas 的 style 会让节点被重建 ——
     引擎还握着旧的那个，新画布是空的、像素退回默认的 300×150。
     屏幕上是一整片米色，而【没有任何东西会红】：村子那几条断言跑在
     这一刻之前。这是 2026-08-26 从截图里看见的。 */
  mount() {
    wx.createSelectorQuery()
      .select('#village')
      .fields({ node: true, size: true })
      .exec((res: Array<{ node?: unknown }>) => {
        const node = res && res[0] && res[0].node
        if (!node) {
          this.setData({ err: '取不到画布节点 —— canvas 少了 type="2d"?' })
          return
        }
        try {
          if (this.handle) { this.handle.stop(); this.handle = null }
          this.handle = mountVillage(node, TILES, (s) => this.setData({ sub: s }))
        } catch (e) {
          this.setData({ err: String((e as Error).message || e) })
        }
      })
  },

  /* 选中之后把卡片滚进视野。

     卡片是普通流里的一块，排在村子图后面，而村子图比屏幕高：
     704×1920 的画布在 390 宽的屏幕上是 1064 高，视口只有 844 ——
     **卡片永远在屏幕外**。也就是点一格房子，屏幕上什么都不动。
     (2026-08-18 从移动网页版的截图里看见的：点空宅基那张里没有卡片，
     而问签那张有 —— 那是验证脚本点按钮前自动滚过去的，不是产品自己滚的。)

     只滚一下，不改版式：版式是设计上的事，不该顺手动。 */

  onTap(e: WechatMiniprogram.TouchEvent) {
    // detail.x / y 是相对元素的逻辑像素;画布是 704 宽,差一个比例
    const k = 704 / this.data.cssW
    const hit = VILLAGE_HIT(e.detail.x * k, e.detail.y * k)
    if (!hit) return          // 点在空地上：什么都不做

    /* 点中之后开一屏，不再在村主屏上摊一张卡（docs/REDESIGN.md R2）。
       卡片只放得下一个名字加两颗按钮，而「他缺什么」是这个产品的身份字段 ——
       塞在两行里等于没说。 */
    if (hit.kind === 'villager') {
      const id = hit.who || ''
      if (id) { 轻(); wx.navigateTo({ url: '/pages/villager/index?id=' + id }) }
      return
    }

    // 一格宅基。住着的开他那一屏；空着的开空屋那一屏 ——
    // **空屋不消失是世界观**：它照样在图上、照样点得到、照样说话，
    // 而且【不说是谁的】。还没请回来的人，连名字都还不该知道。
    const id = hit.at
    wx.navigateTo({
      url: this.atHome[id] ? '/pages/villager/index?id=' + id : '/pages/plot/index',
    })
  },




  /** 扫御守 = 请他回家。买御守那条线走的是商品与订单，不在这一页。
   *
   *  扫成功之后开一屏，不再弹 toast（docs/REDESIGN.md R6 / 设计 V6）：
   *  这是整条链上**唯一一次实物变成人**，而 toast 跟「已复制」是同一种语气。
   */
  onScan() {
    扫一枚().then((r) => { if (r && !r.ok) this.setData({ codeErr: r.msg }) })
  },

  /* 手输编号。设计册 E2 的弹性槽：「扫不出来？在这儿手输编号 ›」。
     码磨花了、相机坏了、光线不够 —— 这些人现在一条出路都没有，
     而他们手上真有一枚御守，是这条链上最不该被卡住的人。
     走的是**同一条路**（`utils/omamori` 的 `唤醒`），跟一单那一屏共用。 */
  onCodeInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ code: e.detail.value, codeErr: '' })
  },

  onCodeSubmit() {
    const code = this.data.code.trim()
    if (!code) { this.setData({ codeErr: '把御守背面那串字填进来' }); return }
    this.setData({ codeBusy: true, codeErr: '' })
    唤醒('qr', code).then((r) => {
      this.setData({ codeBusy: false, codeErr: r.ok ? '' : r.msg, code: r.ok ? '' : code })
    })
  },

  onUnload() {
    // 不停的话,这一帧接一帧会一直排下去,离开这一页也还在烧电
    if (this.handle) this.handle.stop()
  },
})
