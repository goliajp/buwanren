/* 主屏 · 村 —— 路线图第 10 步的前端半边。
 *
 * 画面全部来自 rooms/，这一页一笔都不画。它只做宿主那几件事：
 *   ① 取 <canvas type="2d"> 的 node，连同贴图路径交给 mountVillage
 *   ② 把 bindtap 的坐标换算好交给引擎的 VILLAGE_HIT —— 判定在引擎里，
 *      不在这里重写一份(写两份迟早会漂，漂出来的症状是「看得见的点不到」)
 *   ③ 副标题与收集数写进 data
 *
 * 【现在能点到的范围有限，如实写着】4 个房门节点 + 12 位村民。
 * 路线图要的是 40 户、空屋也要能点且会说「这间空着，等人」——
 * 那需要一张 40 格的宅基表，村子里还没有。差的是数据不是这一页。
 */

import { villageApi } from '../../services/village'
import { 脸 } from '../../utils/face'
import { 唤醒, 扫一枚 } from '../../utils/omamori'
import { 轻 } from '../../utils/feel'
import { incenseApi } from '../../services/incense'
import { 那一天那一刻, 今天那一刻 } from '../../utils/incense-when'
import { storage } from '../../services/storage'
import type { VillagerInVillage } from '../../types/village'
import { 今天几号 } from '../../utils/day'
import { 一句 } from '../../utils/say'

// 三支生成物，靠副作用挂到 globalThis 上。顺序不能换。
require('../../engine/engine.js')
require('../../engine/host.js')
require('../../engine/plots.js')
require('../../engine/rooms/index.js')
require('../../engine/village.js')

const TILES = '/engine/assets/tilemap_packed.png'

interface Hit {
  /** villager = 走动的那位村民本人；plot = 一格宅基(房子) */
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

// 走动的那几位在画面上的贴图名 → 中文名。宅基那一路的名字来自服务端，
/* ROOM_INDEX 与 hasRoom 搬到 `pages/villager` 去了 —— 判断「进不进得了屋」
   的地方跟着「进屋」那颗按钮走。 */

// 各页各叫各的名字：这些页面文件没有 import / export,
// tsc 把它们当脚本、作用域是合并的，两处都叫 IData 会互相污染
/* 问候语与日期（设计册 V1 / 10.8）。
   **按你现在几点说话** —— 引擎那句「清晨」说的是画面里的昼夜循环，
   村子的天几分钟转一轮，跟你几点没关系。

   分档按人怎么过一天来切，不按整点均分：五点到十点是早上，
   十点到十三点是上午，夜里十一点之后是「夜深了」——
   那句话对着的是还没睡的人。

   【边界要跟村子的天色对齐】。引擎那边日落是 17:30–19:30，之后全黑。
   这里原先「傍晚好」一直说到二十一点 —— 于是晚上八点，屏上写着傍晚好，
   底下的村子已经点起灯、飞着萤火虫。跟「早上好配深夜」是同一种矛盾，
   只是没那么显眼。改后 19.5 这个数两处都用，谁动了都得一起动。 */
const 边界 = [5, 10, 13, 17, 19.5, 23]
const 档 = ['夜深了', '早上好', '上午好', '下午好', '傍晚好', '晚上好', '夜深了']
function 问候(h: number): string {
  const i = 边界.findIndex((b) => h < b)
  return i === -1 ? 档[档.length - 1] : 档[i]
}

interface VillageData {
  cssW: number
  cssH: number
  sub: string
  /** 问候语与日期（设计册 V1）。整点不够用 —— 19:30 那条边界两边分属傍晚与夜 */
  greet: string
  today: string
  /** 今晚那一场开着没有（设计册 E1）。开着，槽里那一句才是入口 */
  tonight: boolean
  /** 点香是几点。**按后端那份排期生成**，不写死 ——
   *  几点点香在后端是配置，挪了时间之后写死的那句就成了假话。
   *  取不到是空串，那一句整条不摆 */
  当口: string
  今口: string
  lived: number
  total: number
  /** 村子那份数据【取到过】吗。没取到时 `lived` 停在 0，
   *  而屏上那张「四十间屋子，还都空着」只看 `!lived` —— 于是断网时
   *  它会把「不知道」说成「空的」。这两件事必须分开。 */
  取到过: boolean
  /** 他刚说的那一句 */
  /** 这一格能不能进屋(房间搬进小程序了没) */
  err: string
  /** 手上有一枚已签收还没扫开的御守（设计册 E2「该扫了」）。
   *  没有就是 false —— 这一条只在该出现时出现，常驻的提示会被无视。 */
  toScan: boolean
  /** 手输的那串编号（E2 的弹性槽）。扫不出来的人走这条路 */
  /** 手输编号那一块展开了没。一行入口，点开才展开 —— 整块常驻会把村子挤出屏 */
  手输开着: boolean
  code: string
  codeErr: string
  codeBusy: boolean
  /** 某位今天说的一句（设计册 V1）。null = 村里还没人，这一块整个不摆。
   *  它会改画布的可用高度 —— 从无到有那天要重算，见 `fitCanvas` */
  says: null | { villager_id: string; name: string; title: string | null; art: string | null; text: string; face: string; direction: string | null; 脸样?: string }
  /** 正在找那一位的御守 —— 找的时候按钮换个字，别让人以为没反应 */
}

Page<VillageData, WechatMiniprogram.IAnyObject>({
  data: { 手输开着: false, cssW: 0, cssH: 0, sub: '', greet: '', today: '', tonight: false, 当口: '', 今口: '', lived: 0, total: 40, err: '', 取到过: false, toScan: false, code: '', codeErr: '', codeBusy: false,
    says: null },

  handle: null as { stop(): void } | null,
  // 下一个分档边界上的一次性闹钟（见 刷问候）
  闹钟: 0,
  // id → 请回家了没。村子画面里那几位与后端的 id 是同一套(ayun / tao / popo / tenz …),
  // 所以这里不需要另造一张映射表 —— 造了就会跟 seed 漂。
  atHome: {} as Record<string, boolean>,
  nameOf: {} as Record<string, string>,

  /* 匿名登录是 app.ts 在 onLaunch 里【异步】做的，而这一页 onShow 立刻就取村子——
     冷启动时会抢在 token 之前，拿到 401。app.ts 的 broadcast('onAuthReady')
     就是为这件事准备的，今 / 命 / 我三页都接了，这一页漏了。

     症状：第一次打开显示「取不到村子」，而且此后再也不重取。
     本机拿假服务端验不出来 —— 假服务端不认 token，怎么都给 200。
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
     而问候语说错时间比不说更糟。

     光回来时算一次还不够 —— 村子的天色是【每一帧】跟着钟走的，
     有人正好开着这一屏跨过 19:30，天会当场黑下去而这行字还写着「傍晚好」。
     所以再挂一个闹钟，只响在下一个分档的边界上：一次会话响不了几回，
     比每分钟醒一次便宜，也比不管它诚实。 */
  刷问候() {
    const now = new Date()
    const h = now.getHours() + now.getMinutes() / 60
    if (this.闹钟) { clearTimeout(this.闹钟); this.闹钟 = 0 }
    const 下一档 = 边界.find((b) => b > h)
    if (下一档 !== undefined) {
      // +1 秒，免得算出来恰好卡在边界上、醒来发现还是同一档
      this.闹钟 = setTimeout(() => this.刷问候(), (下一档 - h) * 3600e3 + 1000) as unknown as number
    }
    this.setData({ greet: 问候(h), today: 今天几号(now) })
    /* 今晚开着没有。取不到就当没开 —— 猜「开着」的话，
       槽里那一句会把人送进一屏说「还没开始」的东西。 */
    incenseApi.now().then(
      (n) => this.setData({ tonight: !!n }),
      () => this.setData({ tonight: false }),
    )
    incenseApi.schedule().then(
      (s) => this.setData({ 当口: 那一天那一刻(s), 今口: 今天那一刻(s) }),
      // 取不到就不说时刻。说错一个钟点比不说更伤 —— 有人会照着它来
      () => this.setData({ 当口: '', 今口: '' }),
    )
  },

  goTonight() { wx.navigateTo({ url: '/pages/lighting/index' }) },

  /* 开场白上的两条路。村里一个人都没有时，这一格是屏上唯一说得出
     「你能干什么」的地方 —— 一条不花钱就能走（翻名册），
     一条把后面所有排序都变准（填生辰）。 */
  goInvite() { 轻(); wx.navigateTo({ url: '/pages/invite/index' }) },
  goNatal() { 轻(); wx.navigateTo({ url: '/pages/natal/index' }) },

  /** 说话那位的那一页。她已经住着，所以点进去是她本人，不是空屋 */
  onSays() {
    const s = this.data.says
    if (!s) return
    轻()
    wx.navigateTo({ url: `/pages/villager/index?id=${s.villager_id}` })
  },

  reload() {
    // 收集数与「谁请回家了」都以服务端为准。引擎那边的 VILLAGE_CENSUS 只报
    // 画面里画了几户，那是另一件事，两个数不该混用。
    villageApi.mine().then(
      (v) => {
        const m: Record<string, boolean> = {}
        v.villagers.forEach((x: VillagerInVillage) => { m[x.id] = x.at_home })
        this.atHome = m
        // 告诉引擎谁住着 —— 门口挂灯还是挂空白门牌，由这一句决定
        VILLAGE_SET_HOME(v.villagers.filter((x) => x.at_home).map((x) => x.id))
        // 名字也从服务端拿，页面不再抄一份
        v.villagers.forEach((x: VillagerInVillage) => { this.nameOf[x.id] = x.name })
        /* 「该扫了」那一条出现或消失，画布的可用高度就变了 —— 得重算一次，
           否则那一条把整屏顶出去（村子这一屏本来就是刚好放得下的）。 */
        const 该扫 = !!v.to_scan
        /* 「今天说的一句」跟「该扫了」一样会改可用高度 —— 村里第一个人
           住进来那天它从无到有，画布得跟着让位。只看 toScan 变没变的话，
           那一天整屏会被顶出去 88px。 */
        /* 头像的占位：姓名末字。没有美术之前不假装有立绘 ——
           但「有人在跟你说话」得一眼成立，纯文字做不到。
           等 40 张头像画好，这一行换成图片地址即可，版式不动。 */
        const 说的 = v.today_says
          ? { ...v.today_says, face: v.today_says.name.slice(-1), 脸样: 脸(v.today_says.villager_id) }
          : null
        /* 「有没有那一格」才是判据 —— 说话卡与开场白二选一，都占 90px。
           只比 `says` 的有无，会漏掉「第一位住进来那天开场白让位给说话卡」
           这一种：两块都在，高度没变，不必重算；而 0→1 那一下 lived 也变了。 */
        /* 【判的是「哪一张卡」，不是「有没有卡」】（2026-09-02）。
           这一格现在有三张卡:说话卡 / 出错卡 / 开场白。
           上一版的判据是「那一格在不在」—— 而换卡时那一格一直在，
           于是 `变了` 为假、画布不重挂。

           这本来就是脆的:换一张卡会让垫片重建那一段节点，
           而画布是它后面的兄弟节点，跟着被替换 —— 引擎还握着旧的那个，
           新画布是空的、像素退回默认的 300×150（跟这个函数上面
           那段 2026-08-26 的注释是同一件事）。开场白 → 说话卡
           这一跳一直靠「垫片恰好复用了节点」侥幸活着;
           我加了出错卡这第三个分支，位置一移，它当场露出来
           （镜像里画布那三条一起红）。

           判据改成比【卡的身份】。顺带它天然覆盖了
           「从取不到回来」那一下 —— 那时引擎从没被喂过数据
           （`VILLAGE_SET_HOME` 在这个 then 里，失败时走不到）。 */
        const 哪张卡 = (x: { says: unknown; lived: number; err: string }) =>
          x.says ? '说话' : (x.err ? '出错' : (x.lived ? '无' : '开场'))
        const 变了 = 该扫 !== this.data.toScan
          || 哪张卡({ says: 说的, lived: v.found, err: '' })
             !== 哪张卡({ says: this.data.says, lived: this.data.lived, err: this.data.err })
        this.setData(
          { lived: v.found, total: v.total, err: '', toScan: 该扫, says: 说的, 取到过: true },
          /* 同上:重挂要等这一次渲染真的落地。`fitCanvas` 会再 setData 一次
             （改 cssW/cssH），所以 mount 排在它后面那一拍。 */
          () => {
            if (!this.data.cssW) return
            // 卡换了就得重算画布的可用高度 —— 那一格的高度变了。
            if (变了) this.fitCanvas()
            /* 【每次都核一下画布，不猜它什么时候会被换掉】（2026-09-04 · 25 计划）。
               上一版是「变了才重挂」。而这一次 `setData` 本身就会让 canvas
               节点被替换掉 —— 换成一块新的、空的、像素退回默认 300×150 的。
               换不换跟 `变了` 无关，`变了` 管的是【高度要不要重算】。

               有住户的人碰巧没事:他们的卡从开场白跳到说话卡，`变了` 为真，
               顺带重挂了一次。而新用户的每一个字段都没变
               （toScan=false、says=null、lived=0、err=''），`变了` 恒为假 ——
               于是他的画布停在那块被换上来的空节点上，一个像素都没画。

               25 计划的逐屏走把这一条量出来了:同一屏、同样的 CSS 尺寸
               292×398，空村那位的画布像素是 300×150、画了 0 个像素;
               住了两位的那位是 704×960、675840 个像素全画。
               屏幕上他看到的是「四十间屋子，还都空着」这句话，
               底下一间屋子也没有 —— 那不是空态，是坏了，
               而它跟空态长得一模一样。

               核一次只是一回 selectorQuery，便宜;画布好好的时候它什么都不做。 */
            this.核一下(0)
          },
        )
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
        /* 【出错卡也会换掉那一格，画布跟着被替换】。
           设计册 10.7 那条写死的规则:**任何一屏都不许整屏换成错误页，
           错误只替换取不到的那一段，其余照常可用** —— 村子那幅画是
           本地的，不该因为一句话没取到就消失。
           而换卡会让垫片重建那一段节点，画布是它后面的兄弟，
           跟着被换成一个空的（成功那一支里的 `哪张卡` 说的是同一件事）。
           所以这一支也要判一次:卡换了就把画重挂上去。 */
        /* 【判的是「这一格从哪一张换成哪一张」】。
           上一版写的是「原本有说话卡、或者有住户」—— 而后端全挂那一趟
           `取到过` 是 false、`lived` 是 0、`says` 是空:
           屏上原本是【开场白】，现在换成【出错卡】，两张都占那一格，
           这个判据却说「没换」，于是画布不重挂、村子那幅画没了
           （设计册 10.7:任何一屏都不许整屏换成错误页 —— 画是本地的）。
           判据跟成功那一支对齐:比【是哪一张卡】。 */
        const 原来那张 = this.data.says ? '说话' : (this.data.err ? '出错' : (this.data.lived ? '无' : '开场'))
        const 换卡 = 原来那张 !== '出错'
        /* 【在 setData 的回调里挂，不是紧跟着挂】。紧跟着调的话
           重渲染还没发生，`createSelectorQuery` 拿到的是【旧节点】——
           挂上去了，然后连节点带画一起被换掉。
           第二个参数是渲染完的回调（真机与垫片都支持）。 */
        this.setData({ err: '取不到村子：' + (一句(e)) }, () => {
          if (换卡 && this.data.cssW) this.mount()
        })
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
    /* 【「该扫了」那一态多出来的是两行，不是一行】。
       上一版这里只有一个 `提示条 = 60`，注释说的是「扫不出来？手输编号」
       那一行（`.manual`，实测 28px）—— 而同一态下【上面】还有一整块
       「你手上那枚，扫开它」（`.nudge`，实测 56px），它一直没进预算。
       两行加起来 84，预算只给 60，差的 24 正好是画布多铺出来、
       把整屏顶出去的那一截（2026-09-02 实测超 21px）。
       写成两个具名的数，各自对着一块 —— 合成一个数就是这么错的:
       注释描述的是其中一块，值却在替两块兜底，谁也说不清它该是多少。

       这两个数是【留给它们的空】，留得越少画布铺得越大 —— 反直觉，
       但版式就是这么算的:我第一版把它从 56 调到 32，想着「那一行只有 28px」，
       结果溢出从 1px 涨到 25px。 */
    const 该扫那一块 = this.data.toScan ? 56 : 0    // `.nudge`
    const 手输那一行 = this.data.toScan ? 32 : 0    // `.manual`(28) + 4px 余量
    const 提示条 = 该扫那一块 + 手输那一行
    /* 「某位今天说的一句」那一块，实测 90px。跟头部同一个道理：写死，
       **改那一块的版式就要改这个数**。它是条件出现的（空村时没有），
       所以跟提示条一样要参与重算，否则村里第一个人住进来那天，
       多出来的那一块会把整屏顶出去。 */
    /* 村里一个人都没有时，这一格装的是【开场白】（见 index.wxml 的 `.intro`）——
       两块占的高度一样，所以这里要一起算。只看 `says` 的话，
       第一次打开的人会被顶掉屏底的收集进度条：那正是这段注释警告的
       「改那一块的版式就要改这个数」，而我加开场白时差点又漏一次。

       数写成【具名常量】而不是塞在三元里 —— 动线那一支要把它从源码里读出来，
       跟实测高度对一遍；写成表达式它就读成了 NaN，而 NaN 的比较永远为假，
       于是那条断言从「钉住这个数」退化成「每次都红」。 */
    /* 按【两行】留。这一格的高度看那句话有多长：一行 90，两行 115 ——
       而写死 90 的时候，长一点的签文会把画布算大 25px，整屏跟着超。
       2026-08-31 撞到一次（实测 115 / 写死 90，村主屏超 22px），
       重跑又是 90 —— 因为那一趟的签文恰好短。这种「看内容而定」的红
       会在不该红的时候绿，所以按最坏情况留：短内容时画布小一点点，无害。 */
    const 说话那格高 = 115
    const 说的 = (this.data.says || !this.data.lived) ? 说话那格高 : 0
    /* 收集进度条常驻，固定 34px。它不是弹性槽 —— 核心反馈不许在矮屏上消失 */
    const 进度条 = 34
    const 可用 = win.windowHeight - 头部 - 提示条 - 说的 - 进度条
    const 等比 = Math.round((win.windowWidth * VILLAGE_SIZE.h) / VILLAGE_SIZE.w)
    const cssH = Math.min(等比, Math.max(120, 可用))
    const cssW = Math.round((cssH * VILLAGE_SIZE.w) / VILLAGE_SIZE.h)
    this.setData({ cssW, cssH })
  },

  onReady() {
    if (typeof VILLAGE_CENSUS !== 'function') {
      console.error('[村子] onReady 时引擎还没加载出来 —— 这一次不挂画布')
      this.setData({ err: '村子脚本没加载出来 —— 跑过 npm run build:engine 吗？' })
      return
    }
    // 画布铺满屏宽，按村子自己的宽高比。像素尺寸是村子说了算(mountVillage 里设),
    // 这里只决定它在屏幕上占多大 —— 两者分开，村子才在所有机型上是同一幅画。
    // 宽高比也从 VILLAGE_SIZE 读：村子扩过一次地，写死的比例会把画面压扁。
    this.fitCanvas()
    /* 【挂排在这一次渲染落地之后】。`fitCanvas` 是用 setData 改画布尺寸的，
       而 setData 在真机上是异步的 —— 紧接着 mount 拿到的是【改之前】
       那个节点。同一个坑在 `变了` 那一支上踩过一次（见 237 行），
       这里跟它对齐。
       （实测这条路径本来也是好的:真链上画布是 704×960，见
       measure.json 的「画布」一栏。这一改是把两条挂载路径写成同一个形状，
       不是修一个正在发生的故障。） */
    this.setData({}, () => this.mount())
  },

  /* 拿画布节点、把引擎挂上去。

     **画布的屏上尺寸一变就得重挂一次。** 「该扫了」那一条出现时
     `fitCanvas` 会改 cssW/cssH，而改 canvas 的 style 会让节点被重建 ——
     引擎还握着旧的那个，新画布是空的、像素退回默认的 300×150。
     屏幕上是一整片米色，而【没有任何东西会红】：村子那几条断言跑在
     这一刻之前。这是 2026-08-26 从截图里看见的。

     【挂完要核一下真挂上了没有】（2026-09-02 第四轮评审 · 追出来的）。
     `onReady` 里的这一次挂载跟首次渲染在抢:实测【同一条路径】
     有时得到 704×960、有时停在 300×150，差别只是多跑了一拍。
     有住户的人看不见它 —— 台词卡一到，`变了` 那一支会重挂一次盖过去;
     而**新用户没有那一次**，他第一眼看到的就是村子该在的地方空着。

     所以不猜时序，看结果:`mountVillage` 一定会把画布像素设成
     村子的真实尺寸，那么挂完之后它还等于默认的 300×150，就是没挂上。
     下一帧重试一次 —— 只一次，反复重试会把一个时序问题变成一个死循环。 */
  mount(第几次 = 0) {
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
          /* 【核的是屏幕上那一个，不是我手里这一个】（2026-09-04 · 25 计划）。
             上一版核的是 `node.width` —— 而 `mountVillage` 上一行刚把它
             设成 704×960，它【必然】是对的。那条核查在验「我设成功了吗」，
             而真问题是「我设的是不是屏上那一个」：`fitCanvas` 改 cssW/cssH
             会让 canvas 节点被替换掉，引擎握着并且正在画的是【旧的那个】，
             屏幕上换成了一块新的、空的、像素退回默认 300×150 的画布。
             于是核查通过、不重挂，而屏幕上村子那一块【一片空白】。

             有住户的人碰不到:`reload` 里「开场白 → 说话卡」那一跳会让
             `变了` 为真，顺带重挂一次盖过去。而**新用户的每一个字段都没变**
             （toScan=false、says=null、lived=0、err=''），`变了` 恒为假 ——
             他第一眼看到的就是村子该在的地方空着。

             25 计划的逐屏走把这一条量了出来:同一屏、同一份 CSS 尺寸
             （292×398），U1 的画布像素是 300×150、画了 0 个像素;
             住了两位的 U3 是 704×960、675840 个像素全画。

             所以重新查一次节点再核。查到的是屏上那一个 —— 它还停在默认
             尺寸就说明我挂错了对象，换新的那个再挂一遍。 */
          if (第几次 < 4) this.核一下(第几次)
        } catch (e) {
          /* 【原文进控制台，屏上说人话】。引擎挂不上时它报的是
             「房间没拆出宿主那一段」「声明了按钮而这一页没给」——
             那两句是写给改代码的人看的，玩家读到只会更困惑，
             而且它是构建出了问题，不是他做错了什么。 */
          console.error('引擎挂不上：', e)
          this.setData({ err: '村子一时打不开 —— 退回去再进来试试' })
        }
      })
  },

  /* 挂完之后，等这一次渲染落地，【重新查一次】屏上的画布节点，
     核它的像素尺寸。

     为什么要重新查：见 `mount` 里那段注释 —— 手里那个是我刚设过的，
     核它等于核我自己。屏上那一个才是用户看见的。

     试满四次仍然不对就【说出来】。留一块空白是最糟的收场:
     文案写着「四十间屋子，还都空着」，而屏幕上一间也没有 ——
     那不是空态，那是坏了，可它长得跟空态一模一样。 */
  核一下(第几次: number) {
    this.setData({}, () => {
      wx.createSelectorQuery()
        .select('#village')
        .fields({ node: true })
        .exec((r: Array<{ node?: unknown }>) => {
          const 屏上那个 = (r && r[0] && r[0].node) as { width?: number } | undefined
          if (!屏上那个) return
          if (屏上那个.width && 屏上那个.width > 300) return
          if (第几次 + 1 < 4) {
            console.warn('村子画布还停在默认尺寸（第 ' + (第几次 + 1) + ' 次），换屏上那个再挂一遍')
            this.mount(第几次 + 1)
            return
          }
          console.error('村子画布挂了四次都还停在默认尺寸')
          this.setData({ err: '村子这一块没画出来 —— 退回去再进来试试' })
        })
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
    // detail.x / y 是相对元素的逻辑像素；画布是 704 宽，差一个比例
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
    if (this.atHome[id]) {
      wx.navigateTo({ url: '/pages/villager/index?id=' + id })
      return
    }
    /* 空屋那一屏带上【这一格在哪儿】—— 不带 id。
       四十格点进去原先长得一模一样（都是「这间空着」），而人是从地图上
       点着某一格进来的：那一屏答不上「我在哪儿」（标尺 §1.5.4 第一问）。
       位置不是新信息（他刚在图上看见那一格），名字才是 ——
       所以传 row/col，不传 at。 */
    const 表 = (globalThis as unknown as { VILLAGE_PLOTS?: Array<{ id: string; row: number; col: number }> }).VILLAGE_PLOTS
    const 那格 = 表 && 表.find((x) => x.id === id)
    wx.navigateTo({
      url: 那格
        ? `/pages/plot/index?row=${那格.row}&col=${那格.col}`
        : '/pages/plot/index',
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

  /* 手输编号那一块:一行入口，点开才展开。
     整块常驻会把村子挤出屏（实测 55px），而它又不能放回弹性槽 ——
     槽在 ≤699px 上整块隐藏，而参照机 iPhone SE 正好在那以下，
     等于把扫码失败之后唯一那条出路，从最需要它的机器上拿掉。 */
  onManualToggle() { this.setData({ 手输开着: !this.data.手输开着 }) },

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
    // 不停的话，这一帧接一帧会一直排下去，离开这一页也还在烧电
    if (this.handle) this.handle.stop()
    if (this.闹钟) { clearTimeout(this.闹钟); this.闹钟 = 0 }
  },
})
