/* WXML → DOM。移动网页版是小程序的【镜像】,所以这里不重写模板,
 * 直接吃 `mini/miniprogram/pages/**\/*.wxml` 那些文件本身。
 *
 * ── 唯一的设计铁律 ──────────────────────────────────────────────
 * 【遇到不认识的东西必须抛,绝不跳过】。
 *
 * 一个「不认识就当没看见」的垫片会渲出一个少了几块的页面,而人看着它是完整的,
 * 于是「在网页版上验过」变成一句空话 —— 那比没有镜像更糟,因为它给的是错的信心。
 * 所以:不认识的标签抛、不认识的 wx: 指令抛、不认识的 bind 抛。
 * 抛出来就去把它实现掉,清单只会越来越短。
 *
 * 支持到什么程度,是照着 mini/ 里【实际用到的】定的,不是照文档抄的:
 *   标签   view / text / block / button / input / picker / image / canvas
 *   指令   wx:if / wx:elif / wx:else / wx:for / wx:key
 *   事件   bindtap / bindinput / bindchange
 *   插值   {{ 表达式 }},文本与属性里都认
 */
;(function () {
  const TAGS = {
    view: 'div', text: 'span', block: null, button: 'button',
    input: 'input', picker: 'div', image: 'img', canvas: 'canvas',
  }
  // picker 的 mode 与浏览器原生输入的对应。不在表里的 mode 抛 ——
  // 「不认识就抛」比渲成一个点不动的方块强,后者看着是完整的一页
  const PICKER = { date: 'date', time: 'time' }
  const EVENTS = { bindtap: 'click', bindinput: 'input', bindchange: 'change' }
  // 解析过程中遇到的「只有真机才有」的事件,记下来,渲染时接一个会抛的处理器
  const NATIVE_ONLY = {}
  const DIRECTIVES = ['wx:if', 'wx:elif', 'wx:else', 'wx:for', 'wx:key', 'wx:for-item', 'wx:for-index']

  // ── 解析:标签树 ────────────────────────────────────────────────
  function parse(src) {
    src = src.replace(/<!--[\s\S]*?-->/g, '')
    const root = { tag: null, attrs: {}, kids: [] }
    const stack = [root]
    let i = 0
    while (i < src.length) {
      const lt = src.indexOf('<', i)
      if (lt < 0) { text(src.slice(i)); break }
      if (lt > i) text(src.slice(i, lt))
      /* 找标签的收尾 `>`,但要跳过 `{{ … }}` 里面的。
         `wx:if="{{a.length > 0}}"` 里那个 `>` 是【比较】,不是标签结束 ——
         直接 indexOf 会把标签从那儿切断,剩下的 `0}}">` 就变成了页面上的文字。
         不抛、不报,只是屏幕上多出一截乱码,而属性里写比较是常见写法。
         (2026-08-18 从截图上看见的:本命页「过 · 应避」上面那行。) */
      let gt = -1
      for (let k = lt + 1; k < src.length; k++) {
        if (src[k] === '{' && src[k + 1] === '{') {
          const end = src.indexOf('}}', k + 2)
          if (end < 0) throw new Error('WXML: {{ 没有配对的 }}')
          k = end + 1
          continue
        }
        if (src[k] === '>') { gt = k; break }
      }
      if (gt < 0) throw new Error('WXML: 有个 < 没有配对的 >')
      const raw = src.slice(lt + 1, gt).trim()
      i = gt + 1
      if (raw[0] === '/') {
        if (stack.length < 2) throw new Error('WXML: 多了一个 </' + raw.slice(1) + '>')
        stack.pop()
        continue
      }
      const selfClose = raw.endsWith('/')
      const body = selfClose ? raw.slice(0, -1).trim() : raw
      const sp = body.search(/\s/)
      const tag = (sp < 0 ? body : body.slice(0, sp)).toLowerCase()
      if (!(tag in TAGS)) {
        throw new Error(
          'WXML: 不认识的标签 <' + tag + '>。' +
          '不是「跳过它」—— 跳过会渲出一个少了东西却看着完整的页面。去 web/runtime/wxml.js 把它实现掉'
        )
      }
      const node = { tag, attrs: attrs(sp < 0 ? '' : body.slice(sp)), kids: [] }
      stack[stack.length - 1].kids.push(node)
      if (!selfClose) stack.push(node)
    }
    if (stack.length !== 1) throw new Error('WXML: 有标签没闭合')
    return root

    function text(t) {
      if (t.trim()) stack[stack.length - 1].kids.push({ text: t })
    }
  }

  function attrs(s) {
    const out = {}
    /* 【无值属性也要收】。`wx:else` 是不带值的,而下面那条正则只匹配 `k="v"` ——
       于是它被**静默丢掉**,那个元素变成无条件渲出来,`wx:if` / `wx:else`
       两支同时显示。2026-08-19 撞见:命页的档案里,当前那一份同时写着
       「在用」和「换成它」,而所有检查照样绿 —— 页面看着是完整的,只是多了一块。
       全仓 8 个页面 14 处 `wx:else` 当时都是这样。

       这正是铁律第 1 条要挡的那种坏法(「跳过会渲出一个少了东西却看着完整的
       页面」),而这里是**多了**一块,一样糟。
       所以:先把无值的收进来,不认识的指令照样抛。 */
    for (const m of s.matchAll(/(?:^|\s)(wx:[a-zA-Z-]+)(?=\s|$)/g)) {
      const k = m[1]
      if (DIRECTIVES.indexOf(k) < 0) {
        throw new Error('WXML: 不认识的指令 ' + k + ' —— 去 web/runtime/wxml.js 把它实现掉')
      }
      out[k] = ''
    }
    for (const m of s.matchAll(/([a-zA-Z:_-]+)\s*=\s*"([^"]*)"/g)) {
      const k = m[1]
      if (k.startsWith('wx:') && DIRECTIVES.indexOf(k) < 0) {
        throw new Error('WXML: 不认识的指令 ' + k + ' —— 去 web/runtime/wxml.js 把它实现掉')
      }
      // bind* 分两类:
      //   浏览器里有对应事件的 —— 接上(EVENTS 那张表)
      //   只有真机才有的(bindchooseavatar 之类)—— 【照样解析】,但点下去时抛。
      // 不解析的话整页渲不出来,而那一页的别的部分本来是可以验的;
      // 悄悄接成空操作又会让人以为这一步验过了。所以:渲得出来,点了明说。
      if (k.startsWith('bind') && !(k in EVENTS)) NATIVE_ONLY[k] = true
      // `catch*` 跟 `bind*` 是同一批事件,差别只有一条:处理完【不再往上冒泡】。
      // 真机上它用来把内层按钮的点击从外层卡片手里截住 ——
      // 不接的话，点内层按钮会连外层一起触发,那是两条动线同时跑。
      if (k.startsWith('catch') && !(('bind' + k.slice(5)) in EVENTS)) {
        throw new Error('WXML: catch 系里这一个还没实现(' + k + ') —— '
          + '去 web/runtime/wxml.js 的 EVENTS 把它加上')
      }
      out[k] = m[2]
    }
    return out
  }

  // ── 表达式:{{ }} 里那一段 ──────────────────────────────────────
  // 用 new Function 求值。这是本机验证用的驾具,不上线,不接外部输入 ——
  // 输入是仓库里自己的 wxml。
  const cache = {}
  function evaluate(expr, scope) {
    const fn = cache[expr] || (cache[expr] = new Function('$', 'with ($) { return (' + expr + ') }'))
    try {
      return fn(scope)
    } catch (e) {
      // 未定义的字段在小程序里渲成空,不是错 —— 这一条要跟它一致
      if (e instanceof ReferenceError) return undefined
      /* 【与真机的差别，记在这里】TypeError 这里【抛】，而真机是渲成空:
         `{{user.nickname}}` 在 user 还是 null 时，微信不报错，这边整页起不来。
         没有跟着放宽，是因为放宽之后「字段路径写错」就再也没人说了 ——
         那种错在真机上表现为「这一块永远空着」，比整页不亮更难查。
         代价是：模板里别写会踩空的路径，用 `wx:if` 挡住或在 JS 里算好再传。
         2026-08-19 我自己在「我」页踩过一次，改法是在 data 里算好 nickname。 */
      throw new Error('WXML: 表达式出错 {{' + expr + '}} —— ' + e.message)
    }
  }

  function interp(s, scope) {
    if (s.indexOf('{{') < 0) return s
    // 整个属性就是【一个】表达式时,保留原始类型(布尔、数字、对象)。
    // 里面不能再有 }} —— 否则 `{{a}} · {{b}}` 会被当成一个表达式 `a}} · {{b`,
    // 编译时直接 SyntaxError。第一版就是贪心匹配,六页里有五页开不起来。
    const whole = s.match(/^\{\{((?:(?!\}\})[\s\S])*)\}\}$/)
    if (whole) return evaluate(whole[1], scope)
    return s.replace(/\{\{([\s\S]*?)\}\}/g, (_, e) => {
      const v = evaluate(e, scope)
      return v === undefined || v === null ? '' : String(v)
    })
  }

  /* ── 渲染:先出一棵轻树,再【按位置比对】更新到 DOM ────────────
     不能每次 setData 都把 #app 清空重建 —— 第一版就是那么写的,症状是:
     村子的副标题在更新(说明引擎在跑),画布却是 300x150 的默认尺寸、一个像素没有。
     因为 mountVillage 抓着的那个 <canvas> 已经被换掉了,引擎在往一个
     脱离文档的节点上画。小程序的 setData 是局部更新、节点不换,
     镜像在这一点上撒谎,验出来的东西就没有意义。

     比对按【位置 + 标签】:同位置同标签就复用那个元素,只改变了的属性与文本。
     这样画布活着,输入框的焦点也活着。 */

  function build(nodes, scope, out) {
    let lastIf = null
    for (const n of nodes) {
      if (n.text !== undefined) {
        const t = interp(n.text, scope)
        if (String(t).trim()) out.push({ text: String(t) })
        continue
      }
      const a = n.attrs
      if ('wx:if' in a) {
        lastIf = !!interp(a['wx:if'], scope)
        if (!lastIf) continue
      } else if ('wx:elif' in a) {
        if (lastIf === null) throw new Error('WXML: wx:elif 前面没有 wx:if')
        if (lastIf) continue
        lastIf = !!interp(a['wx:elif'], scope)
        if (!lastIf) continue
      } else if ('wx:else' in a) {
        if (lastIf === null) throw new Error('WXML: wx:else 前面没有 wx:if')
        if (lastIf) continue
        lastIf = true
      } else {
        lastIf = null
      }

      if ('wx:for' in a) {
        const list = interp(a['wx:for'], scope) || []
        const iv = a['wx:for-item'] || 'item'
        const ii = a['wx:for-index'] || 'index'
        let k = 0
        for (const it of list) {
          const sub = Object.create(scope)
          sub[iv] = it
          sub[ii] = k++
          one(n, sub, out)
        }
        continue
      }
      one(n, scope, out)
    }
  }

  function one(n, scope, out) {
    const a = n.attrs
    if (n.tag === 'block') { build(n.kids, scope, out); return }
    const v = { tag: n.tag, dom: TAGS[n.tag], attrs: {}, events: {}, kids: [] }
    for (const k in a) {
      if (k.startsWith('wx:')) continue
      if (k in EVENTS) { v.events[EVENTS[k]] = a[k]; continue }
      // catchtap → click，并记下「这一个要截住冒泡」
      if (k.startsWith('catch') && ('bind' + k.slice(5)) in EVENTS) {
        const type = EVENTS['bind' + k.slice(5)]
        v.events[type] = a[k]
        v.catches = v.catches || {}
        v.catches[type] = true
        continue
      }
      if (k in NATIVE_ONLY) { v.attrs['data-native-only'] = k; continue }
      const val = interp(a[k], scope)
      v.attrs[k] = val === true ? '' : (val === false || val == null ? null : String(val))
    }
    build(n.kids, scope, v.kids)
    out.push(v)
  }

  function patch(parent, vnodes, on) {
    const cur = Array.from(parent.childNodes)
    for (let i = 0; i < vnodes.length; i++) {
      const v = vnodes[i]
      let el = cur[i]
      if (v.text !== undefined) {
        if (el && el.nodeType === 3) { if (el.data !== v.text) el.data = v.text }
        else {
          const t = document.createTextNode(v.text)
          el ? parent.replaceChild(t, el) : parent.appendChild(t)
        }
        continue
      }
      const want = v.dom
      if (!el || el.nodeType !== 1 || el.dataset.wx !== v.tag) {
        const fresh = document.createElement(want)
        fresh.dataset.wx = v.tag
        el ? parent.replaceChild(fresh, el) : parent.appendChild(fresh)
        el = fresh
      }
      // 属性:只动变了的。全量重设会让 <canvas> 的 width/height 复位、清空画面
      for (const k in v.attrs) {
        const val = v.attrs[k]
        if (val === null) { el.removeAttribute(k); continue }
        if (k === 'class') { const c = (v.tag === 'canvas' ? 'wx-canvas ' : '') + val; if (el.className !== c) el.className = c; continue }
        if (el.getAttribute(k) !== val) el.setAttribute(k, val)
      }
      /* 清理:只清【这个运行时上次设过】的属性。
         不能照 el.attributes 全扫一遍 —— 宿主代码设的 node.width / node.height
         会反映成属性,而模板里没有它们,于是会被当成「该删的」删掉,
         画布随即复位成 300x150 并清空。第一版就是这样:像素画上去了,
         尺寸却是默认的,下一次 setData 一到就白屏。 */
      const keys = Object.keys(v.attrs)
      for (const old of el.__keys || []) {
        if (keys.indexOf(old) < 0) el.removeAttribute(old)
      }
      el.__keys = keys
      /* 孩子先渲。picker 的原生输入必须是【最后】一个孩子 ——
         挂在前面的话,渲孩子那步会拿它跟第一个模板孩子对,对不上就顶掉它。 */
      patch(el, v.kids, on)
      /* picker —— 小程序里点它会弹原生选择器,选完发 bindchange。
         浏览器【真有】这东西(<input type=date|time>),所以按第 2 条铁律
         它不属于「只有真机才有、该抛」的那类,得真接上。

         第一版把 picker 渲成一个普通 div:点下去什么也不发生,不抛也不报 ——
         于是建本命页选日子这一步在镜像里根本走不到,页面却看着是完整的。
         那正是第 1 条铁律说的「渲出一个少了几块、看着却完整的页面」。

         做法:原生输入铺满这一格、透明,点下去弹的是浏览器自己的选择器;
         选完按小程序的形状发 { detail: { value } } 给 bindchange。
         与真机的差别:弹出来的样子是浏览器的,不是微信的滚轮。 */
      if (v.tag === 'picker') {
        const mode = v.attrs.mode || 'selector'
        if (!PICKER[mode]) {
          throw new Error(
            'WXML: picker mode="' + mode + '" 还没实现 —— 去 web/runtime/wxml.js 把它实现掉。' +
            '渲成一个点不动的方块的话,这一步会看着能用而其实走不到'
          )
        }
        if (el.style.position !== 'relative') el.style.position = 'relative'
        let inp = el.__picker
        if (!inp) {
          inp = document.createElement('input')
          inp.type = PICKER[mode]
          inp.setAttribute('data-picker', mode)
          inp.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0;border:0;padding:0'
          inp.__runtime = true   // 不是模板的孩子,渲染时别当多余的删掉
          el.appendChild(inp)
          el.__picker = inp
        }
        if (v.attrs.start) inp.min = v.attrs.start
        if (v.attrs.end) inp.max = v.attrs.end
        if (v.attrs.value !== undefined && inp.value !== v.attrs.value) inp.value = v.attrs.value
        const h = v.events.change
        if (inp.__h !== h) {
          if (inp.__off) inp.__off()
          /* change 会冒泡。不止住的话它会冲到外层 picker,
             那里挂着同一个 bindchange 的通用处理器,拿【原生事件】再调一遍 ——
             原生 change 的 detail 是数字 0,e.detail.value 于是是 undefined,
             把刚写对的值覆盖掉。不报错,只是值没了。 */
          const fn = (ev) => { ev.stopPropagation(); on(h, { detail: { value: inp.value } }, inp) }
          inp.addEventListener('change', fn)
          inp.__off = () => inp.removeEventListener('change', fn)
          inp.__h = h
        }
      }
      // 事件:处理函数名没变就不重新挂
      const sig = JSON.stringify(v.events)
      if (el.__sig !== sig) {
        if (el.__off) el.__off.forEach((f) => f())
        el.__off = []
        for (const type in v.events) {
          const name = v.events[type]
          const 截住 = v.catches && v.catches[type]
          const fn = (ev) => {
            // catch* 的语义:自己处理完就不再往上传。
            // 少这一句的话，点开场白里的按钮会连外层那张卡的 bindtap 一起走。
            if (截住) ev.stopPropagation()
            on(name, ev, el)
          }
          el.addEventListener(type, fn)
          el.__off.push(() => el.removeEventListener(type, fn))
        }
        if (v.attrs['data-native-only']) {
          const k = v.attrs['data-native-only']
          const fn = () => {
            throw new Error(
              k + ' 只有真机才有(微信原生能力),移动网页版走不到这一步。' +
              '这不是镜像坏了 —— 是这条动线的这一段本来就得上真机验'
            )
          }
          el.addEventListener('click', fn)
          el.__off.push(() => el.removeEventListener('click', fn))
        }
        el.__sig = sig
      }
    }
    /* 尾部多出来的删掉 —— 但【运行时自己挂上去的】不算多余。
       picker 的原生输入就是这种:它不在模板里,却必须留着。
       第一版没有这道判断,输入框刚挂上就被这里砍掉,
       于是 picker 又变回一个点不动的方块。 */
    while (parent.childNodes.length > vnodes.length) {
      if (parent.lastChild.__runtime) break
      parent.removeChild(parent.lastChild)
    }
  }

  globalThis.WXML = {
    parse,
    /** tree, data, root, onEvent(handlerName, event, el) */
    mount(tree, data, root, on) {
      const v = []
      build(tree.kids, data, v)
      patch(root, v, on)
    },
  }
})()
