/* wx.* 垫片 —— 让 mini/ 里的页面与 services 原样在浏览器里跑。
 *
 * 只实现 mini/ 里【真的用到】的那些(数出来的,不是照文档抄的)。
 * 没实现的一律【抛】,不给空实现:
 *   空实现会让页面在网页版上跑得顺顺当当,而真机上那一步根本没发生 ——
 *   这套镜像的全部价值就是「网页上验过 = 真机上大概率也对」,
 *   一个假装成功的空实现直接把这句话作废。
 *
 * 每个方法后面注了它在浏览器里【真的做了什么】,以及与真机的差别在哪。
 * 差别本身不是问题,写下来才不会被当成一样。
 */
;(function () {
  const notImpl = (name) => function () {
    throw new Error(
      'wx.' + name + ' 在移动网页版里还没实现。' +
      '不给空实现 —— 空实现会让这一步在网页上「成功」而真机上根本没发生。' +
      '去 web/runtime/wx.js 把它实现掉,或者说明这一步在网页版上不该被走到'
    )
  }

  /* 【只有真机才有】的那几样：扫码、微信登录、选头像。
     它们照样抛（不假装成功），但跟「镜像真的坏了」不是一回事 ——
     打上这个记号，出错屏就知道该整屏红还是底部提示一条。

     为什么要分：这三样在网页上被点到是【预期之内】的。跟真 bug 用同一个
     整屏红，一是页面当场报废（在手机上浏览时点一下就得重载），
     二是把人训练成忽视红屏 —— 那样真出事时也不会有人看。 */
  const deviceOnly = (name, what) => function () {
    const e = new Error('「' + what + '」只有真机有。网页版不假装成功 —— 这一步要在手机小程序里验')
    e.deviceOnly = true
    e.wxApi = name
    throw e
  }

  const store = {}   // 存储:用 localStorage,键加前缀免得跟别的页面撞
  const accel = { on: null, cbs: [] }

  const wx = {
    /* 小程序用它读「这是正式版还是开发版」。浏览器里没有这个概念，
       而镜像**就是**开发版，所以照实说 develop —— 这不是假装成功，
       是把一个真实差别写清楚。

       在这之前垫片根本没有这个方法：`config/index.ts` 调它会抛 TypeError，
       被那边的 try/catch 接住，于是落到 dev 基址。结果是对的，
       但那是【意外】不是设计 —— 哪天有人把那个 try 拿掉，
       镜像会以一句看不懂的 TypeError 挂掉。
       要验正式版的分支就用 `__wxStub('getAccountInfoSync', …)` 顶掉它。 */
    getAccountInfoSync() {
      return { miniProgram: { envVersion: 'develop', appId: 'web-mirror' } }
    },

    // ── 界面反馈。网页版画一个最小的 toast,能被无头驱动读到 ──
    showToast(o) {
      const el = document.getElementById('wx-toast')
      el.textContent = (o && o.title) || ''
      el.dataset.icon = (o && o.icon) || 'success'
      el.style.display = 'block'
      clearTimeout(el.__t)
      el.__t = setTimeout(() => { el.style.display = 'none' }, (o && o.duration) || 1800)
      return Promise.resolve()
    },
    showLoading(o) {
      const el = document.getElementById('wx-loading')
      el.textContent = (o && o.title) || '加载中'
      el.style.display = 'block'
    },
    hideLoading() { document.getElementById('wx-loading').style.display = 'none' },
    showModal(o) {
      // 真机是原生弹窗;这里用 confirm,回调形状照小程序
      const ok = globalThis.confirm(((o && o.title) || '') + '\n' + ((o && o.content) || ''))
      const r = { confirm: ok, cancel: !ok }
      if (o && o.success) o.success(r)
      return Promise.resolve(r)
    },
    setNavigationBarTitle(o) { document.title = (o && o.title) || '' },
    vibrateShort() { if (navigator.vibrate) navigator.vibrate(15) },
    /* scrollTop 或 selector 二选一(真机两种都收)。
       selector 那种在浏览器里用 scrollIntoView 实现 ——
       与真机的差别:真机把目标滚到【视口顶部】,这里用的是 'nearest',
       也就是本来就看得见时不动。两者都能让它露出来,落点不同。 */
    pageScrollTo(o) {
      const sel = o && o.selector
      if (sel) {
        const el = document.querySelector(sel)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      } else {
        globalThis.scrollTo({ top: (o && o.scrollTop) || 0, behavior: 'smooth' })
      }
      if (o && o.success) o.success({})
      if (o && o.complete) o.complete()
    },

    // ── 存储 ──
    setStorageSync(k, v) { store[k] = v; localStorage.setItem('unmei:' + k, JSON.stringify(v)) },
    getStorageSync(k) {
      if (k in store) return store[k]
      const s = localStorage.getItem('unmei:' + k)
      return s === null ? '' : JSON.parse(s)
    },
    removeStorageSync(k) { delete store[k]; localStorage.removeItem('unmei:' + k) },

    // ── 环境 ──
    getWindowInfo() {
      /* `windowHeight` 在真机上是**页面能用的那块**：tabBar 是原生的、在页面之外，
         不算在里面。镜像里 tabBar 是文档内的一个 div，clientHeight 把它也算了 ——
         于是页面按这个数去排版，每一个 tab 页都恰好高出 tabBar 那 50px。
         （跟 page.js 里 `100vh` 那处补偿是同一个差别，同一个理由。）
         2026-08-23：罗盘按剩余空间自校正时撞上这条 —— 它一直算到「正好等于
         windowHeight」就停，而那已经比真能用的高出一个 tabBar。 */
      const bar = document.getElementById('wx-tabbar')
      const 占掉 = bar && getComputedStyle(bar).display !== 'none' ? bar.offsetHeight : 0
      return {
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight - 占掉,
        pixelRatio: devicePixelRatio || 1,
        statusBarHeight: 0,
        safeArea: { top: 0, bottom: innerHeight, left: 0, right: innerWidth },
      }
    },

    // ── 节点查询。页面靠它拿画布节点 ──
    createSelectorQuery() {
      let sel = null
      let want = {}
      const q = {
        /* `.in(this)` 在真机上是「只在这个组件里找」。镜像里一次只渲一页，
           页面就是整个文档，所以它等于不做事 —— 但**必须有**：
           没有的话调用方那一串链式写法当场抛 TypeError，而抛在
           `exec` 的回调之外，页面看着只是「那一块尺寸不对」。
           与真机的差别：这里不做作用域限制，选择器要自己写得够准。 */
        in() { return q },
        select(s) { sel = s; return q },
        selectAll() { throw new Error('selectAll 还没实现') },
        fields(f) { want = f; return q },
        boundingClientRect() { want.size = true; return q },
        exec(cb) {
          const el = document.querySelector(sel)
          if (!el) { cb([null]); return }
          const r = el.getBoundingClientRect()
          const out = {}
          // node:true 时小程序给的是画布节点本身。浏览器里 <canvas> 就是那个节点,
          // getContext / width / height 全都对得上,所以直接给它。
          if (want.node) out.node = el
          if (want.size) { out.width = r.width; out.height = r.height }
          out.left = r.left; out.top = r.top
          cb([out])
        },
      }
      return q
    },

    // ── 路由 ──
    navigateTo(o) {
      const [route, qs] = String(o.url).replace(/^\//, '').split('?')
      globalThis.__router.open(route, parseQuery(qs))
      return Promise.resolve()
    },
    redirectTo(o) {
      const [route, qs] = String(o.url).replace(/^\//, '').split('?')
      globalThis.__router.open(route, parseQuery(qs), 'redirect')
      return Promise.resolve()
    },
    switchTab(o) {
      const route = String(o.url).replace(/^\//, '').split('?')[0]
      globalThis.__router.open(route, {}, 'switchTab')
      return Promise.resolve()
    },
    /* 退不回去时要走 `fail` —— 页面普遍靠它落到某个 tab（「回得来」是判据之一）。
       原先这里不看参数、永远 resolve：那条兜底一次都没被走过，而看着像验过了。
       与真机的差别：真机的 fail 带 errMsg 文案，这里给的是同形状的一个字符串。 */
    navigateBack(o) {
      const ok = globalThis.__router.back()
      const opt = o || {}
      if (ok) {
        if (opt.success) opt.success({ errMsg: 'navigateBack:ok' })
      } else if (opt.fail) {
        opt.fail({ errMsg: 'navigateBack:fail cannot navigate back at first page' })
      }
      if (opt.complete) opt.complete({})
      /* 调用方给了 fail 就是「这件事我自己处理」—— 这时再返回一个
         rejected Promise，没人接，就成了未处理拒绝，逐页扫描把它当成
         「这一页抛错了」。真机上给了回调不会这样。
         点香那一屏正是这么被判红的：它不到点时退出去，退不回去就回村子，
         回得好好的，报出来却是一页抛了错。 */
      if (ok) return Promise.resolve()
      if (opt.fail) return Promise.resolve()
      return Promise.reject(new Error('navigateBack: 退不回去了'))
    },

    /* ── 网络。走 fetch ──────────────────────────────────────
       页面里的基址是 `config/index.ts` 算出来的，开发环境写死
       `http://localhost:6028`。也就是说【页面永远打 6028】，
       跟验证脚本的 `--api` 无关 —— 那个参数从前只影响脚本自己发的请求
       （种数据、取参数）。两者恰好是同一个地址，所以一直没人发现。

       2026-08-27 撞上了：点香那一屏要一个「此刻正在烧」的后端，
       只能另起一个实例（别的端口），而页面照旧问 6028，
       拿到的永远是「不到点」。诊断打出来是 `__API_BASE=undefined`。

       所以 `__API_BASE` 现在会【顶掉绝对地址的 origin】。
       **与真机的差别**：真机上没有这回事，基址就是 config 算出来那个；
       这是镜像多出来的一项能力 —— 把页面指到另一个后端。
       不设它就跟从前一模一样。 */
    request(o) {
      const base = globalThis.__API_BASE || ''
      let url = /^https?:/.test(o.url) ? o.url : base + o.url
      if (base && /^https?:/.test(o.url)) url = o.url.replace(/^https?:\/\/[^/]+/, base)
      /* 头要【不分大小写】地合并。用普通对象 Object.assign 的话,
         默认的 'content-type' 与调用方的 'Content-Type' 是两个键都留下,
         fetch 再把同名头拼成 "application/json, application/json",
         服务端判 415 —— 每一个 POST 都发不出去。
         假服务端不看 content-type,所以这个坑只有打真后端才露出来。 */
      const headers = { 'content-type': 'application/json' }
      for (const k in (o.header || {})) {
        delete headers[k.toLowerCase()]
        headers[k.toLowerCase()] = o.header[k]
      }
      fetch(url, {
        method: o.method || 'GET',
        headers,
        body: o.data === undefined || (o.method || 'GET') === 'GET' ? undefined : JSON.stringify(o.data),
      }).then(
        async (r) => {
          let data
          const t = await r.text()
          try { data = JSON.parse(t) } catch (e) { data = t }
          if (o.success) o.success({ statusCode: r.status, data, header: {} })
          if (o.complete) o.complete()
        },
        (e) => {
          if (o.fail) o.fail({ errMsg: String(e && e.message || e) })
          if (o.complete) o.complete()
        },
      )
    },

    /* ── 只有真机才有的那些 ────────────────────────────────────
       这几个不是「还没写」,是浏览器里【没有对应的东西】。
       抛出来是对的:它们对应的那一步,在网页版上就是验不了的,
       得留到真机。假装成功只会让人以为验过了。 */
    login: deviceOnly('login', '微信登录'),
    scanCode: deviceOnly('scanCode', '扫码'),
    getUserProfile: deviceOnly('getUserProfile', '选头像'),
    /* 支付：浏览器里没有微信收银台。发起支付那一步（打后端拿 prepay 参数）
       在网页版上是真跑的，验得到；**掏钱那一步只有真机有**。
       不给空实现 —— 空实现会让「已支付」在网页上成立而真机上根本没发生。 */
    requestPayment: deviceOnly('requestPayment', '微信支付'),
    /* 收货地址簿：浏览器里没有微信的地址簿。确认页上「寄到」那一行要它，
       其余（数量、留言、算账、去付）在网页版上都真跑得到。 */
    chooseAddress: deviceOnly('chooseAddress', '选收货地址'),

    /* 加速度计 —— 这个浏览器【真有】(devicemotion),而且在手机浏览器上
       是真能摇的。所以不抛:摇卦那一页在移动网页版上可以真验,
       这正是「移动网页版」比「桌面调试」值钱的地方。

       两处与真机不同,写下来免得被当成一样:
         · iOS 上要 https + 用户手势里调 requestPermission,页面没做这一步就收不到
         · 桌面无头浏览器不会有 devicemotion 事件,所以那里摇不动 ——
           不是坏了,是那台机器不会动 */
    startAccelerometer(o) {
      if (!accel.on) {
        accel.on = (ev) => {
          const a = ev.accelerationIncludingGravity || {}
          // 小程序的量纲是「g」,DeviceMotion 给的是 m/s² —— 换算,别直接透传
          const G = 9.80665
          for (const cb of accel.cbs) cb({ x: (a.x || 0) / G, y: (a.y || 0) / G, z: (a.z || 0) / G })
        }
        addEventListener('devicemotion', accel.on)
      }
      const DM = globalThis.DeviceMotionEvent
      if (DM && typeof DM.requestPermission === 'function') DM.requestPermission().catch(() => {})
      if (o && o.success) o.success({})
    },
    stopAccelerometer(o) {
      if (accel.on) { removeEventListener('devicemotion', accel.on); accel.on = null }
      if (o && o.success) o.success({})
    },
    onAccelerometerChange(cb) { accel.cbs.push(cb) },
    offAccelerometerChange(cb) {
      const i = accel.cbs.indexOf(cb)
      if (i >= 0) accel.cbs.splice(i, 1)
    },
  }

  function parseQuery(qs) {
    const out = {}
    for (const kv of String(qs || '').split('&')) {
      if (!kv) continue
      const i = kv.indexOf('=')
      out[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1))
    }
    return out
  }

  /* 有些方法在真机上是「调了会怎样」而不是「能不能调」。给一个可替换的口子,
     让验证脚本能把 login / scanCode 换成确定的返回值 —— 换的时候是【显式】的,
     写在验证脚本里,而不是垫片默默替你成功了。 */
  globalThis.__wxStub = function (name, impl) { wx[name] = impl }

  globalThis.wx = wx
})()
