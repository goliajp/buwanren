/* Page() 与页面栈 —— 让 mini/ 里的页面文件【原样】在浏览器里跑起来。
 *
 * 页面代码一个字都不改,这是镜像的前提:改过的那部分就不在验证范围内了。
 *
 * 覆盖到:data / setData / onLoad(query) / onReady / onShow / onHide / onUnload,
 * 以及页面对象上自定义的字段与方法(小程序里 this 上什么都能挂,这里也一样)。
 * 不覆盖:组件、behaviors、页面间事件通道 —— 用到了会抛,不会装作支持。
 */
;(function () {
  const PAGES = {}          // 路由 → { def, tpl }
  let registering = null
  const stack = []          // 页面栈,navigateTo 压,navigateBack 弹

  globalThis.__beginPage = function (route, wxml, wxss) {
    registering = { route, wxml, wxss }
  }

  globalThis.Page = function (def) {
    if (!registering) {
      /* 十有八九是【一个页面 import 了另一个页面】：被 import 的那一页里的
         `Page()` 会注册到当前正在注册的那一页名下，把注册位清空，
         轮到当前页自己调 `Page()` 时就没主了。
         2026-08-23 加 `pages/confirm` 时撞上过 —— 它 import 了
         `pages/orders` 里的 money()。症状是整个 app 起不来（__READY 超时），
         而那跟这里的原因看不出关系，所以把话说全。 */
      throw new Error(
        'Page() 是在 __beginPage 之外调的 —— 不知道这是哪一页。\n'
        + '  常见原因：某个页面 import 了另一个页面（拿它导出的工具函数）。\n'
        + '  公共函数请放 miniprogram/utils/，别放在页面文件里导出。',
      )
    }
    PAGES[registering.route] = {
      def,
      tree: globalThis.WXML.parse(registering.wxml),
      wxss: registering.wxss,
      route: registering.route,
    }
    registering = null
  }

  /* 哪些处理器真被点过。写进 localStorage 是因为验证脚本是一页一页 goto 的，
     每次都是新文档；累加在浏览器这边，最后一次读走。
     只记不拦：它回答的是「这一轮验证到底碰了多少」，而这个数以前没人知道。 */
  const FIRED_KEY = '__unmei_fired'
  function markFired(route, name) {
    try {
      const s = new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]'))
      s.add(route + '#' + name)
      localStorage.setItem(FIRED_KEY, JSON.stringify([...s]))
    } catch { /* localStorage 不可用就不记 —— 记账失败不该让被测的东西挂掉 */ }
  }

  function instantiate(entry, query) {
    // 复制一份:同一页面开两次是两个实例,data 不能共用
    const inst = Object.create(null)
    for (const k in entry.def) {
      const v = entry.def[k]
      inst[k] = typeof v === 'function'
        ? function (...a) { markFired(entry.route, k); return v.apply(this, a) }
        : v
    }
    inst.data = JSON.parse(JSON.stringify(entry.def.data || {}))
    inst.__route = entry.route
    inst.__entry = entry
    /* setData 的键可以是【路径】:'form.date'、'list[0].x'。
       直接 Object.assign 的话会造出一个名字里带点的键,而 WXML 里
       {{form.date}} 读的是嵌套值 —— 于是表单看着没反应,不报错也不告警。
       本命页与我页一共七处用的是这种写法,建本命是核心动线,
       镜像在这一点上骗人的话,那一页的验证就完全不作数。 */
    /* 第二个参数是【渲染完的回调】。真机上有，镜像里原先没有 ——
       页面照真机写法传了回调，这里静静丢掉：那一步永远不发生，
       而页面看着只是「某处尺寸没调对」，跟坏了长得不一样。
       与真机的差别：这里 paint() 是同步的，所以回调也同步调；
       真机上它在下一帧。依赖「回调里能读到新布局」的代码两边都成立。 */
    inst.setData = function (patch, cb) {
      for (const k in patch) setPath(inst.data, k, patch[k])
      if (inst === current()) paint()
      if (typeof cb === 'function') cb()
    }
    inst.selectComponent = function () {
      throw new Error('selectComponent 还没实现 —— 页面用到了组件')
    }
    if (inst.onLoad) inst.onLoad(query || {})
    return inst
  }

  function current() { return stack.length ? stack[stack.length - 1] : null }

  /** 按路径写值:'a.b'、'a[0].b' 都认。中间缺的一层就地补出来,
      补数组还是对象看下一段是不是数字 —— 与小程序一致。 */
  function setPath(obj, path, value) {
    if (path.indexOf('.') < 0 && path.indexOf('[') < 0) { obj[path] = value; return }
    const keys = []
    for (const seg of String(path).split('.')) {
      const m = seg.match(/^([^\[]*)((?:\[\d+\])*)$/)
      if (!m) { keys.push(seg); continue }
      if (m[1]) keys.push(m[1])
      for (const idx of (m[2].match(/\d+/g) || [])) keys.push(Number(idx))
    }
    let cur = obj
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]
      if (cur[k] === undefined || cur[k] === null) cur[k] = typeof keys[i + 1] === 'number' ? [] : {}
      cur = cur[k]
    }
    cur[keys[keys.length - 1]] = value
  }

  /* rpx → 浏览器认识的长度。
     小程序的 rpx 是「屏宽的 1/750」,浏览器不认这个单位 —— 不换算的话
     带 rpx 的整条声明会被丢弃,而不是渲成别的样子。症状很隐蔽:
     页面还在、内容还对,只是 padding / gap / font-size 全没了,
     顶栏挤成一行。第一版就是这样,截图出来才看见。
     换成 calc(N * 100vw / 750),与真机同一条公式。 */
  function rpx(css) {
    return css.replace(/(-?[\d.]+)rpx/g, (_, n) => 'calc(' + n + ' * 100vw / 750)')
  }

  /* `page` 是小程序的【根元素】,浏览器里没有这个标签。
     app.wxss 把整套颜色变量和底色都定义在它上面 ——
     不映射的话 var(--ink) 之类【全部落空】,而落空的 var() 不报错:
     按钮的底色没了、文字掉回默认黑,页面看着只是「素了点」,
     没有任何一处说它错了。

     映到 body:同为元素选择器,权重不变,变量照样往下继承。 */
  function pageSelector(css) {
    // 前面允许是:文件开头 / } / , / 注释结束 —— app.wxss 第一条 page 规则
    // 前面正好是块注释,漏了它就等于整套变量都没映上(踩过一次)
    return css.replace(/(^|[},]|\*\/)(\s*)page(?=[\s,{.:#\[])/g, '$1$2body')
  }

  /* 底部 tab 条。app.json 里声明了它,而垫片以前【整个忽略】——
     真机上它一直占着底下那一条,镜像里既不显示也没人能点,
     页面却看着是完整的。那是第 1 条铁律禁止的「跳过」。

     与真机的差别:图标这一版本来就只有文字(app.json 里没配 iconPath),
     所以这里画出来的跟真机是一回事;安全区那一条边浏览器给不了,
     用的是 env(safe-area-inset-bottom),桌面上就是 0。 */
  function paintTabBar() {
    const cfg = globalThis.__TABBAR
    const inst = current()
    if (!cfg || !inst) return
    let bar = document.getElementById('wx-tabbar')
    if (!bar) {
      bar = document.createElement('div')
      bar.id = 'wx-tabbar'
      bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;display:flex;' +
        'height:calc(50px + env(safe-area-inset-bottom));' +
        'padding-bottom:env(safe-area-inset-bottom);z-index:50;' +
        'background:' + (cfg.backgroundColor || '#fff') + ';' +
        'border-top:1px solid ' + (cfg.borderStyle === 'white' ? '#fff' : '#c8c7cc')
      document.body.appendChild(bar)
      for (const it of cfg.list) {
        const b = document.createElement('div')
        b.dataset.tab = it.pagePath
        b.textContent = it.text
        b.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;' +
          'font-size:15px;cursor:pointer;user-select:none'
        b.addEventListener('click', () => globalThis.__router.open(it.pagePath, {}, 'switchTab'))
        bar.appendChild(b)
      }
    }
    // tab 页才有这条;村主屏与屋里不是 tab 页,真机上那里也没有它
    const on = cfg.list.some((it) => it.pagePath === inst.__route)
    bar.style.display = on ? 'flex' : 'none'
    document.body.style.paddingBottom = on ? 'calc(50px + env(safe-area-inset-bottom))' : '0'

    /* ── 与真机的一处差别，补偿在这里 ─────────────────────────
       真机上 tabBar 是**原生的、在页面之外**，所以页面里的 `100vh`
       就是内容区。镜像里 tabBar 是文档里的一个 div，`100vh` 是整个窗口 ——
       于是 `app.wxss` 里 `.page { min-height: 100vh }` 让**每一个 tab 页**
       都恰好高出 tabBar 那 50px，与内容无关。
       量出来是「这一屏放不下」，而真机上它放得下 —— 假账。
       （2026-08-23 逐块量 home 时发现：子块加起来 313px，整页却报 667。）

       所以在 tab 页上把 100vh 换算成「窗口减去 tabBar」。
       非 tab 页不动 —— 那里 100vh 本来就对。 */
    let fix = document.getElementById('wx-vh-fix')
    if (!fix) {
      fix = document.createElement('style')
      fix.id = 'wx-vh-fix'
      document.head.appendChild(fix)
    }
    /* `#app` 也要换算，不只是 `.page`。它外面还有一层 `min-height:100vh`，
       而 body 又为固定的 tabBar 让出了 50px 的 padding —— 两处各让一次，
       于是每个 tab 页的文档都比窗口高 50px，跟内容无关。
       只修 `.page` 时这笔账从 `.page` 挪到了 `#app`，没有消掉。 */
    /* 第二条同理:`app.wxss` 里「弹性槽矮屏收起」写的是 `max-height: 699px`，
       那是真机语义(100vh = 内容区)。镜像里 100vh 含着 tabBar，
       所以同一条规则在这里是 699 + 50。两个数字的关系就是这 50px，
       跟上面那处补偿是同一件事。 */
    fix.textContent = on
/* 按【页面根】补偿，不按类名 —— 类名会漏：村子那一屏的根是 .wrap 不是 .page，
         于是它自己那条 min-height:100vh 又把 tabBar 那 50px 让了第二遍。
         `#app > *` 才是「不管这一页叫什么，它就是那一页」。 */
      ? '#app,#app>*{min-height:calc(100vh - 50px - env(safe-area-inset-bottom))}'
        + '@media (max-height:749px){#app .flexslot{display:none}}'
      : ''
    for (const b of bar.children) {
      b.style.color = b.dataset.tab === inst.__route
        ? (cfg.selectedColor || '#000') : (cfg.color || '#888')
    }
  }

  function paint() {
    const inst = current()
    if (!inst) return
    const root = document.getElementById('app')
    globalThis.WXML.mount(inst.__entry.tree, inst.data, root, (name, ev, el) => {
      const fn = inst[name]
      if (typeof fn !== 'function') {
        throw new Error(inst.__route + ' 上没有事件处理函数 ' + name + '()')
      }
      fn.call(inst, toWxEvent(ev, el))
    })
    paintTabBar()
    const app = document.getElementById('app-style')
    if (!app.__done) { app.__done = true; app.textContent = pageSelector(rpx(globalThis.__APPWXSS || '')) }
    const style = document.getElementById('page-style')
    const css = inst.__entry.wxss || ''
    if (style.__src !== css) {
      style.__src = css
      style.textContent = pageSelector(rpx(css))
    }
  }

  /* 把 DOM 事件转成小程序那种形状。页面读的是 e.detail.x / e.detail.value,
     这里就得给出同样的形状 —— 形状不一样的话,页面代码就得改,而改了就不是镜像了。 */
  function toWxEvent(ev, el) {
    const r = el.getBoundingClientRect()
    return {
      type: ev.type,
      detail: {
        // bindtap 的 detail.x/y 是【相对元素】的逻辑像素
        x: (ev.clientX !== undefined ? ev.clientX - r.left : 0),
        y: (ev.clientY !== undefined ? ev.clientY - r.top : 0),
        value: el.value,
      },
      currentTarget: { dataset: Object.assign({}, el.dataset) },
      target: { dataset: Object.assign({}, el.dataset) },
    }
  }

  /* App() / getApp() / getCurrentPages() —— app.ts 与几个页面靠它们。
     实现照小程序的语义:App() 存下那个对象、onLaunch 立刻跑、
     getCurrentPages() 给出【当前页面栈】(app.ts 的 broadcast 要遍历它,
     把异步登录完成的消息推给已挂载的页面)。 */
  let APP = null
  globalThis.App = function (def) {
    APP = def
    if (def.onLaunch) def.onLaunch.call(def, {})
  }
  globalThis.getApp = function () {
    if (!APP) throw new Error('还没 App() —— 入口里 app.ts 没被 import?')
    return APP
  }
  globalThis.getCurrentPages = function () { return stack.slice() }

  globalThis.__router = {
    /** route 形如 'pages/village/index',query 形如 { room: 'ayun' } */
    open(route, query, mode) {
      const entry = PAGES[route]
      if (!entry) throw new Error('没有这一页:' + route + '(注册了的有 ' + Object.keys(PAGES).join(' ') + ')')
      if (mode === 'switchTab' || mode === 'redirect') {
        while (stack.length) {
          const gone = stack.pop()
          if (gone.onUnload) gone.onUnload()
        }
      } else {
        const from = current()
        if (from && from.onHide) from.onHide()
      }
      const inst = instantiate(entry, query)
      stack.push(inst)
      paint()
      if (inst.onShow) inst.onShow()
      // onReady 的语义是「首次渲染完成」,所以排在这一帧之后
      requestAnimationFrame(() => { if (inst.onReady) inst.onReady() })
      /* 标题统一是「不完人」（2026-08-18 用户定）。这里以前写的是路由名，
         那既不是产品里的标题（真机读 `index.json` 的
         `navigationBarTitleText`，那六份现在都是「不完人」），
         也不是给人看的字 —— 手机上浏览器标签页显示的就是它。
         页面自己调 `wx.setNavigationBarTitle` 仍然能改，跟真机一致。 */
      document.title = '不完人'
      return inst
    },
    /** 退得回去就退，退不回去返回 false —— 调用方要能分辨。
        真机上没得退时走的是 `wx.navigateBack` 的 `fail`，
        而页面普遍靠那个 fail 落到某个 tab 上（「回得来」是 docs/FLOW.md 的判据之一）。
        原先这里退不回去时直接 `return`，垫片那边永远 resolve ——
        于是全 app 的那条兜底在镜像里一次都没被走过，而看起来像验过了。 */
    back() {
      if (stack.length < 2) return false
      const gone = stack.pop()
      if (gone.onUnload) gone.onUnload()
      paint()
      const now = current()
      if (now && now.onShow) now.onShow()
      return true
    },
    current,
    routes: () => Object.keys(PAGES),
    repaint: paint,
  }
})()
