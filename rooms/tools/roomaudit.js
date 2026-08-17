#!/usr/bin/env bun
/**
 * roomaudit —— 四维深度审计(S6/S7/S8 的门禁补齐)
 *
 * 前四间房 polish 时用户一个个亲眼指出来的问题,没有一样是工具查出来的:
 *   「丹增走路任何方向都一样」「指点迷津时走路没加速」「请婆婆看水晶球没用」
 *   「点到的是桌子不是杯子」「角色走进床里」「假人放到空地去」
 * 这支把它们变成机器能查的四个模块 —— 有一件查不出,就说明引擎还欠一块。
 *
 *   A 姿态可用   房间用到的每个 pose 真的存在吗?是不是悄悄回退成 stand?
 *                坐/卧/读/凝视这些功能姿态齐不齐
 *   B 表演态     按钮·状态·台词齐吗?到位那一刻【道具有没有反应】?走路加速了吗?
 *   C 交互       覆盖率·sayDeep·【逐件点一遍看点到的是不是它自己】
 *   D 碰撞体积   foot 声明与 sprite 实际底面对不对得上
 *
 * 用法:bun tools/roomaudit.js <design.html 绝对路径> [模块 A|B|C|D]
 */
const { chromium } = require('playwright')
const fs = require('fs')
const FILE = process.argv[2], ONLY = (process.argv[3] || '').toUpperCase()
if (!FILE) { console.error('用法: bun tools/roomaudit.js <design.html 绝对路径> [A|B|C|D]'); process.exit(2) }
const SRC = fs.readFileSync(FILE, 'utf8')

// ── 源码侧:房间脚本区间(按 canvas 切,一间房一个 <script>) ──
function roomScript(base) {
  const i = SRC.indexOf(`getElementById('${base}Canvas')`)
  if (i < 0) return ''
  const a = SRC.lastIndexOf('<script>', i)
  return SRC.slice(a, SRC.indexOf('</script>', a))
}

;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.goto('file://' + require('path').resolve(FILE)); await p.waitForTimeout(3500)

  const data = await p.evaluate(() => {
    const rooms = Object.keys(window)
      .filter(k => /^[A-Z][A-Z0-9]*_ROOM$/.test(k))
      .filter(k => window[k] && Array.isArray(window[k].plan)).sort()
    const A = window.ASSETS || {}, AC = window.ACTORS || {}
    const out = {}
    for (const key of rooms) {
      const room = window[key], base = key.replace(/_ROOM$/, '').toLowerCase()
      const act = AC[base] || null
      const P = (act && act.poses) || {}
      const same = (x, y) => P[x] && P[y] && JSON.stringify(P[x]) === JSON.stringify(P[y])

      // ── A 姿态 ──
      const poseNames = Object.keys(P)
      /* 幽灵姿态要按【这间房所有角色】的姿态并集来判,不能只看主角 ——
         宠物的行为表跟主角写在同一个 <script> 里,只比主角的话,
         猫的 csleep/csit 会被当成主角的幽灵引用(误报);反过来更糟:
         宠物【真的】引用了不存在的姿态时查不出来,而那正是婆婆 fly 那一类事故。
         阿云房一直没暴露,是因为猫的姿态恰好跟阿云共用一张 AYUN_POSES。 */
      const allPose = new Set(poseNames)
      for (const grp of (room.acts || [])) {
        const pa = AC[grp.actor]
        if (pa && pa.poses) for (const k of Object.keys(pa.poses)) allPose.add(k)
      }
      const FUNC = { 坐: /^(sit|kneel|squat)/, 卧: /^(sleep|lie|rest)/, 读写: /^(read|write|draw)/,
                     凝视: /^(gaze|look|peer)/, 举手: /^(hold|carry|lift)/ }
      const funcHave = {}
      for (const k in FUNC) funcHave[k] = poseNames.filter(n => FUNC[k].test(n))
      // 别名:与 stand 像素相同 = 等于没画。
      // 但【走路循环的站姿帧】除外 —— walkfront1/walkside1 本来就该是站姿(站-迈-站-迈),
      // 那是正确的循环,不是偷懒。只揪功能姿态和微动姿态。
      const CYCLE = /^walk(front|side|back)[13]?$/
      const aliasStand = poseNames.filter(n => n !== 'stand' && !CYCLE.test(n) && same(n, 'stand'))

      // ── B 表演态 ──
      const pf = room.perform || null
      const stateKey = pf && pf.stateKey
      // 表演时道具有没有反应。两种响应方式都算数:
      //   ① 读引擎通用标志 room.performing(阿云的式盘就是这么写的)
      //   ② 读自定义状态 room.state[stateKey](婆婆的水晶球、丹增的坛城)
      let reactive = []
      for (const [id] of room.plan.map(e => [e[0]])) {
        const a = A[id]; if (!a) continue
        const src = ((a.fx && a.fx.toString()) || '') + ((typeof a.light === 'function' && a.light.toString()) || '')
        if (src.includes('performing') || (stateKey && src.includes(stateKey))) reactive.push(id)
      }
      reactive = [...new Set(reactive)]

      // ── C 交互 ──
      const ids = room.plan.map(e => e[0])
      const kinds = [...new Set(ids)]
      const clickable = kinds.filter(id => A[id] && A[id].clickable)
      const deep = kinds.filter(id => A[id] && A[id].sayDeep)
      // 逐件命中:用引擎【真正的】命中函数(挂在画布上),不另写一套 ——
      // 排序规则出现第二份实现,两份就会漂,而这正是当年桌上的杯子点不到的根因。
      //
      // 判据是「这件东西【有没有任何一处】点得到」,不是「质心点不点得到」:
      // 小件被大件压住一角很正常,只要露出来的部分能点中它自己就算可达;
      // 采遍它的实心像素都点不到,才是真的被吃掉了。
      const hit = []
      const cvEl = document.getElementById(base + 'Canvas')
      const hitAt = cvEl && cvEl.__hitAt
      for (const e of (hitAt ? room.plan : [])) {
        const a = A[e[0]]; if (!a || !a.clickable) continue
        const off = document.createElement('canvas'); off.width = a.w; off.height = a.h
        const og = off.getContext('2d'); og.scale(2, 2)
        try { a.draw(og, e[3] || {}) } catch (err) { continue }
        const dd = og.getImageData(0, 0, a.w, a.h).data
        let solid = 0, reachable = 0, sample = 0
        const STEP = Math.max(2, Math.round(Math.min(a.w, a.h) / 14))
        for (let y = 0; y < a.h; y += STEP) for (let x = 0; x < a.w; x += STEP) {
          if (dd[(y * a.w + x) * 4 + 3] <= 24) continue
          solid++
          if (sample++ > 260) continue                    // 超大件采样封顶
          const got = hitAt(e[1] + x, e[2] + y)
          if (got && got.id === e[0]) reachable++
        }
        if (!solid) continue
        if (!reachable) hit.push({ id: e[0], got: '整件被压住' })
      }
      const hitRan = !!hitAt

      // ── D 碰撞体积:foot 声明 vs sprite 实际底面 ──
      const footBad = [], footNote = []
      for (const id of kinds) {
        const a = A[id]; if (!a || !a.foot) continue
        const f = a.foot; if (!(f[2] > 0) || !(f[3] > 0)) continue
        try {
          const cv = document.createElement('canvas'); cv.width = a.w; cv.height = a.h
          const g = cv.getContext('2d'); g.scale(2, 2); a.draw(g, {})
          const d = g.getImageData(0, 0, a.w, a.h).data
          // 只算【实体】像素:alpha > 200。辉光/阴影/光晕是半透明的,
          // 把它们当底部会误报(音箱下的粉色光晕、桌下的柔影都栽过)
          let minX = a.w, maxX = -1, maxY = -1
          for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++)
            if (d[(y * a.w + x) * 4 + 3] > 200) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y > maxY) maxY = y }
          if (maxX < 0) continue
          const realW = maxX - minX + 1
          // foot 比实际宽出很多 = 占地画大了(会误挡路、误报重叠)
          if (f[2] > realW * 1.35 + 12) footBad.push({ id, foot: f[2], real: realW, why: 'foot 比实际宽 ' + Math.round(f[2] / realW * 100) + '%' })
          // 底边贴不贴地,【只对立式家具】有意义:
          //   立式(柜/灯/架/音箱)—— foot 是底边一条,应贴近 sprite 实际底部,
          //                        偏高 = 物件下半截没碰撞,角色走进去
          //   平放(桌/床/垫/盘)—— foot 是【整个顶面投影】,底边本来就在物件中部,
          //                        下面那截是家具的正立面,角色站它前面是对的
          // 底边【已经贴地】的一律不报 —— 不论它算平放还是立式,碰撞都落在该落的地方。
          // (先判这条,否则 foot 高度卡在阈值边缘的件会被另一条误伤)
          // 一个 sprite 画了好几样【离得很远】的东西?
          // 成对/成组是合法的(雪狮一对、食盆两只、传送门两根柱子中间是门洞),
          // 真问题的特征是【间隙远大于物件本身】—— 瑜伽垫和水壶隔着 330px,
          // 那种 foot 单矩形无论如何圈不住,另一件必然没有碰撞、也点不到。
          const spanOf = (arr) => {
            const seg = []; let st = -1
            for (let i = 0; i <= arr.length; i++) {
              if (i < arr.length && arr[i]) { if (st < 0) st = i }
              else if (st >= 0) { seg.push([st, i - 1]); st = -1 }
            }
            return seg
          }
          const colHas = new Array(a.w).fill(false), rowHas = new Array(a.h).fill(false)
          for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++)
            if (d[(y * a.w + x) * 4 + 3] > 200) { colHas[x] = true; rowHas[y] = true }
          for (const [arr, axis] of [[colHas, '横'], [rowHas, '纵']]) {
            const seg = spanOf(arr)
            for (let i = 1; i < seg.length; i++) {
              const gap = seg[i][0] - seg[i - 1][1] - 1
              const wA = seg[i - 1][1] - seg[i - 1][0] + 1, wB = seg[i][1] - seg[i][0] + 1
              if (gap >= 60 && gap > Math.min(wA, wB)) {
                footNote.push({ id, why: axis + '向空隙 ' + gap + 'px(> 其中一件的 ' + Math.min(wA, wB) + 'px)' })
                break
              }
            }
          }

          const grounded = f[1] + f[3] >= maxY - 24
          if (!grounded) {
            const upright = f[3] < a.h * 0.25
            if (upright)
              footBad.push({ id, foot: f[1] + f[3], real: maxY, why: 'foot 底边比实际底部高 ' + (maxY - f[1] - f[3]) + 'px(立式件应贴地)' })
            // 平放件:顶面圈得太小,角色会从它上面走过去
            else if (f[2] * f[3] < realW * maxY * 0.25)
              footBad.push({ id, foot: f[2] + 'x' + f[3], real: realW + 'x' + maxY, why: '平放件 foot 只圈了顶面的一小块,角色会从上面穿过去' })
          }
        } catch (e) { /* draw 抛异常另有 assetprobe 管 */ }
      }

      out[key] = {
        base, hasActor: !!act, poseNames, knownPoses: [...allPose], funcHave, aliasStand,
        perform: pf ? { button: pf.button || null, labels: pf.labels || null,
                        lines: (pf.lines || []).length, stateKey: stateKey || null,
                        props: (pf.props || []).length, reactive,
                        actorSpeed: (pf.actor && pf.actor.speed) || null } : null,
        plan: room.plan.length, kinds: kinds.length,
        clickable: clickable.length, deep: deep.length, hit, hitRan,
        footBad, footNote,
      }
    }
    return out
  })

  // ── 源码侧检查 ──
  for (const key of Object.keys(data)) {
    const R = data[key], s = roomScript(R.base)

    // 表演时赶路要快于平时。两件都成立才算数:
    //   ① loop 的 stepWalk 读【行为自带的速度】(stepPerform 会把 perform.actor 合并进行为对象)
    //   ② perform.actor 声明的 speed 【大于】平时的默认值
    // 只声明不读 = 白声明(婆婆声明了 speed:7 却硬编码 stepWalk(st,7),等于没加速)
    const speeds = [...s.matchAll(/stepWalk\s*\(\s*st\s*,\s*([^)]+)\)/g)].map(m => m[1].trim())
    R.walkSpeed = speeds
    const readsAct = speeds.some(v => /act\.speed/.test(v))
    const fallback = Math.max(...speeds.map(v => { const m2 = v.match(/(\d+)\s*$/); return m2 ? +m2[1] : 0 }), 0)
    const perfSpeed = (R.perform && R.perform.actorSpeed) || 0
    R.hasSpeedUp = readsAct && perfSpeed > fallback
    R.speedNote = !readsAct ? 'loop 没读 st.act.speed(声明了也白搭)'
                : (perfSpeed <= fallback ? `表演速度 ${perfSpeed} 不快于平时 ${fallback}` : '')

    // ★ 行为表引用的姿态是否真的存在 —— 写错名字会【静默回退成 stand】,页面不报错,
    // 于是「他在读书」实际是站着发呆。这是这个项目最贵的一类错,以前没有任何工具在查。
    const used = new Set()
    for (const m of s.matchAll(/poses\s*:\s*\[([^\]]*)\]/g))
      for (const q of m[1].matchAll(/['"]([\w]+)['"]/g)) used.add(q[1])
    for (const m of s.matchAll(/pose\s*=\s*['"]([\w]+)['"]/g)) used.add(m[1])
    for (const m of s.matchAll(/\[\s*((?:['"][\w]+['"]\s*,\s*){2,}['"][\w]+['"])\s*\]\s*\[/g))
      for (const q of m[1].matchAll(/['"]([\w]+)['"]/g)) used.add(q[1])
    R.usedPoses = [...used]
    R.ghostPoses = R.usedPoses.filter(n => !(R.knownPoses || R.poseNames).includes(n))

    // 素材台词标点(hardcodelint 的 H4 只扫房间脚本,够不着素材库)
    R.roomScriptLen = s.length
  }

  const show = (m) => !ONLY || ONLY === m
  let problems = 0

  if (show('A')) {
    console.log('══ A 姿态可用 ══')
    for (const [k, R] of Object.entries(data)) {
      if (!R.hasActor) { console.log(`  ${k} 没有同名角色 ${R.base}`); problems++; continue }
      const fn = Object.entries(R.funcHave).filter(([, v]) => v.length).map(([k2, v]) => `${k2}:${v.length}`)
      console.log(`  ${k.padEnd(11)} 姿态 ${String(R.poseNames.length).padStart(2)}  功能姿态 ${fn.join(' ') || '（无）'}`)
      if (R.ghostPoses.length) { problems += R.ghostPoses.length
        console.log(`     ✗★ 行为里引用了不存在的姿态(会【静默回退成 stand】): ${R.ghostPoses.join(' ')}`) }
      if (R.aliasStand.length) { problems++; console.log(`     ✗ 与 stand 像素相同(等于没画): ${R.aliasStand.join(' ')}`) }
      const noFunc = Object.entries(R.funcHave).filter(([, v]) => !v.length).map(([k2]) => k2)
      if (noFunc.length) console.log(`     ~ 没有这几类功能姿态: ${noFunc.join(' ')}（房间用不到就不算问题,用得到而缺=角色会站着假装）`)
    }
  }

  if (show('B')) {
    console.log('\n══ B 表演态 ══')
    for (const [k, R] of Object.entries(data)) {
      const pf = R.perform
      if (!pf) { problems++; console.log(`  ${k.padEnd(11)} ✗ 没有 perform —— 这间房没有「请他做某事」的按钮`); continue }
      const bad = []
      if (!pf.button) bad.push('无按钮 id')
      if (!pf.stateKey) bad.push('无 stateKey(道具读不到表演状态)')
      if (!pf.lines) bad.push('无台词')
      if (!pf.reactive.length) bad.push('★ 没有任何道具的 fx/light 读 performing 或 ' + (pf.stateKey||'state') + ' —— 表演时画面【没有任何变化】')
      if (!R.hasSpeedUp) bad.push('走路没有加速 —— ' + (R.speedNote || '表演赶路和平时一个速度'))
      if (bad.length) problems += bad.length
      console.log(`  ${k.padEnd(11)} 按钮 ${pf.button || '—'}  台词 ${pf.lines}  道具 ${pf.props}  响应道具 ${pf.reactive.length}  ${bad.length ? '✗ ' + bad.join(' · ') : '✓'}`)
    }
  }

  if (show('C')) {
    console.log('\n══ C 交互 ══')
    for (const [k, R] of Object.entries(data)) {
      const cov = R.kinds ? Math.round(R.clickable / R.kinds * 100) : 0
      const tag = cov < 55 ? '✗ 哑房' : (cov < 65 ? '~ 偏低' : '✓')
      if (cov < 65) problems++
      console.log(`  ${k.padEnd(11)} 可点 ${R.clickable}/${R.kinds} = ${cov}% ${tag}  sayDeep ${R.deep}${R.deep ? '' : ' ✗ 核心物件没有追问层'}`)
      if (!R.deep) problems++
      if (!R.hitRan) console.log('     ~ 命中检查没跑(画布未挂 __hitAt)')
      else if (R.hit.length) { problems += R.hit.length; console.log(`     ✗ ${R.hit.length} 件点不到自己:`); R.hit.slice(0, 8).forEach(h => console.log(`        ${h.id} → 实际命中 ${h.got}`)) }
      else console.log('     ✓ 逐件点过,每件点到的都是自己')
    }
  }

  if (show('D')) {
    console.log('\n══ D 碰撞体积 ══')
    for (const [k, R] of Object.entries(data)) {
      if (!R.footBad.length) console.log(`  ${k.padEnd(11)} ✓ foot 与实际底面相符`)
      else {
        problems += R.footBad.length
        console.log(`  ${k.padEnd(11)} ✗ ${R.footBad.length} 件 foot 与实际对不上:`)
        R.footBad.slice(0, 8).forEach(x => console.log(`     ${x.id.padEnd(24)} ${x.why}`))
      }
      // 提示:一个 sprite 里画了离得远的两坨。成组本身合法(一对雪狮、两根门柱),
      // 只有当它导致【点不到】(C 模块)或【走不到】(可达性)时才是问题 —— 那两项另有直接检查。
      if ((R.footNote || []).length)
        console.log(`     · ${R.footNote.length} 件是「一 sprite 多坨」,人工看一眼是不是该拆: ` +
                    R.footNote.map(x => x.id.replace(/^\w+_/, '')).join(' '))
    }
  }

  if (errs.length) console.log('\n页面错误: ' + [...new Set(errs)].slice(0, 3).join(' | '))
  console.log('\n' + (problems ? `✗ 合计 ${problems} 项` : '✓ 四模块全过'))
  await b.close()
  if (problems) process.exit(1)
})()
