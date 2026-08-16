#!/usr/bin/env bun
/**
 * castlint —— 角色开房就绪度(WORKFLOW S1 的门禁)
 *
 * 房间是人的外化:分界线、功能诉求、每一件物、每一句台词、sayDeep 的那句真话,
 * 全是从档案推出来的。档案薄,后面全是编的 —— 桃桃房曾长成一整套古典才女陈设,
 * 撤了九件,根因就是开工时没把人写清。
 *
 * 三层查,分得清清楚楚 ——【机器能判的】判死,【机器判不了的】列成待确认清单,
 * 绝不假装能判(那会变成又一种假绿,见 PLAYBOOK 事故模式 14/20/21)。
 *
 *   ① 总表 B9      机器:十个字段一个都不能空
 *   ② 画得出来吗   机器:codex 四向 / 走路帧二 / palette
 *   ③ 不许撞车     机器:对照 cast-registry.json 打印已用的失败方式·分界线·兴趣
 *   ④ 档案深度     人工:七字段 + 两样,逐条确认后才算过
 *
 * 用法:bun tools/castlint.js <design.html 绝对路径> [角色id]
 *      不给 id = 全部角色概览(谁够开房)
 */
const { chromium } = require('playwright')
const fs = require('fs'), path = require('path')
const FILE = process.argv[2], WHO = process.argv[3]
if (!FILE) { console.error('用法: bun tools/castlint.js <design.html 绝对路径> [角色id]'); process.exit(2) }

const REG_PATH = path.join(path.dirname(FILE), '.roomwork/cast-registry.json')
const REG = fs.existsSync(REG_PATH) ? JSON.parse(fs.readFileSync(REG_PATH, 'utf8')) : { 已开房: {} }

const FIELDS = [
  ['c-id', 'ID'], ['c-nm', '名·号'], ['c-sc', '流派'], ['c-og', '出身'],
  ['c-tr', '性格'], ['c-fl', '缺一个字'], ['c-bio', '背景'],
  ['c-arc', '关键经历'], ['c-vc', '说话风格'],
]

// ④ 人工清单 —— 机器判不了「够不够丰富」,只能逼着人逐条回答
const MANUAL = [
  ['来处给的一句话', '把他推下山的那句。「没有那句话」本身也可以是答案(婆婆没有师门)'],
  ['证明过自己的那次', '每人都有一次做成了的事'],
  ['失败的方式', '不许与已用的重复 —— 见下方登记'],
  ['兴趣能落成哪些物件', '列出【具体物件名】,并且【够撑起房间一块区域】——\n          四房实测:桃桃直播区占半间房 · 丹增鼓组占整个右侧 · 阿云二次元角 · 婆婆毛线贯穿全屋。\n          反差爱好是房间的一极,不是几件小物点缀'],
  ['房间的分界线(物理形态)', '不许与已用的重复。必须看得见,不是概念'],
  ['笑点即痛点', '让人发笑的地方和最疼的地方是同一件事'],
  ['一道裂缝(sayDeep)', '核心物件追问三次他松口说什么。「被逼着才说」本身就是那个缺的形状'],
  ['反差落在同一个伤口上', '桃桃骂观众笨蛋却记得每个常驻 ID —— 反差不是另加的性格,是同一件事的背面'],
]

;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  await p.goto('file://' + FILE); await p.waitForTimeout(2500)

  const cast = await p.evaluate((FIELDS) => {
    const rows = [...document.querySelectorAll('table.cp-cast tbody tr')]
    return rows.map(tr => {
      const o = { _状态: (tr.querySelector('.c-st') || {}).textContent || '' }
      for (const [cls, label] of FIELDS) {
        const td = tr.querySelector('.' + cls)
        o[label] = td ? td.textContent.trim() : ''
      }
      return o
    })
  }, FIELDS)

  const res = await p.evaluate(() => {
    const C = window.CODEX || {}, AC = window.ACTORS || {}
    const out = {}
    const ids = new Set()
    for (const S of [C.FRONT, C.SIDE, C.BACK, C.WALK]) for (const k in (S || {})) ids.add(k)
    const same = (P, a, c) => P[a] && P[c] && JSON.stringify(P[a]) === JSON.stringify(P[c])
    for (const id of ids) {
      const W = (C.WALK || {})[id] || {}
      // 该角色已注册(房间开过)的话,运行层可能被房间自画的帧二救着 ——
      // CODEX 缺但运行层不滑 = 欠账(该收口进 CODEX),不是阻塞
      const P = (AC[id] || {}).poses || null
      out[id] = { front: !!(C.FRONT || {})[id], side: !!(C.SIDE || {})[id], back: !!(C.BACK || {})[id],
                  strideSide: !!W.side, strideBack: !!W.back,
                  registered: !!P,
                  roomSide: !!(P && P.walkside2 && !same(P, 'walkside1', 'walkside2')),
                  roomBack: !!(P && P.walkback2 && !same(P, 'walkback1', 'walkback2')) }
    }
    return out
  })

  const pick = WHO ? cast.filter(c => c.ID === WHO) : cast
  if (WHO && !pick.length) { console.log('✗ B9 总表里没有这个 ID: ' + WHO); await b.close(); process.exit(1) }

  // ── 概览模式 ──
  if (!WHO) {
    console.log('══ 全部角色 · 开房就绪度概览 ══')
    console.log('  (① 总表字段  ② 画得出来  —— 两项机器判;④ 档案深度须逐个跑 castlint <id>)\n')
    let ready = 0
    for (const c of pick) {
      const miss = FIELDS.map(([, l]) => l).filter(l => !c[l])
      const r = res[c.ID] || {}
      const art = [], debt = []
      if (!r.side || !r.back) art.push('缺四向')
      if (r.side && !r.strideSide) (r.roomSide ? debt : art).push('侧走帧二')
      if (r.back && !r.strideBack) (r.roomBack ? debt : art).push('背走帧二')
      const ok = !miss.length && !art.length
      if (ok) ready++
      const note = debt.length ? `  (${debt.join('·')}在房间里,待收口进 CODEX)` : ''
      console.log(`  ${(c.ID || '?').padEnd(11)} ${(c['名·号'] || '').slice(0, 10).padEnd(12)} ${(c._状态 || '').padEnd(5)} ` +
        (ok ? '✓ 可进 S2' : '✗ ' + [...miss.map(m => '缺' + m), ...art.map(a => a + '无')].join(' · ')) + note)
    }
    console.log(`\n${ready}/${pick.length} 个角色的【机器可判部分】就绪`)
    await b.close(); return
  }

  // ── 单角色详查 ──
  const c = pick[0], r = res[c.ID] || {}
  console.log(`══ ${c['名·号']} (${c.ID}) · 开房就绪度 ══  状态: ${c._状态}\n`)

  console.log('① 总表 B9 —— 机器判')
  let bad = 0
  for (const [, l] of FIELDS) {
    const v = c[l]
    if (!v) { bad++; console.log(`   ✗ ${l} 空着`) }
    else console.log(`   ✓ ${l.padEnd(9)} ${v.length > 46 ? v.slice(0, 46) + '…' : v}`)
  }

  console.log('\n② 画得出来吗 —— 机器判')
  /* FRONT 缺【不算失败】,但也【不等于该房间自画】—— 2026-07-22 沈砚打出来的:
     规范的正面有两个来源,`FRONT_OVR` 只覆盖一部分角色,而图鉴卡的正面画在
     CSS 精灵 `.spr-<id>` 的 ::after box-shadow 里,四十个角色全有,
     页面里用 `window.codexFront(id)` 就能取。
     顺序是:① 先 codexFront 取出来看 ② 比例合适就引入 ③ 不合适 → 那是规范缺口,
     报告给设计侧,不要自己往 OVR 表里写(规范对房间只读,见 WORKFLOW 铁律一之二)。
     codexPoses 只覆盖移动姿态,功能姿态(坐/写/读)才是房间的活。
     40 个角色里绝大多数 FRONT_OVR 都没有。判成失败会让这道门禁天天红,人就开始无视它。 */
  const art = [['正面 FRONT', r.front, false, true], ['侧面 SIDE', r.side, false, false],
               ['背面 BACK', r.back, false, false],
               ['侧走帧二', r.strideSide, r.roomSide, false], ['背走帧二', r.strideBack, r.roomBack, false]]
  for (const [l, v, saved, optional] of art) {
    if (!v && !saved && !optional) bad++
    const mark = v ? '✓' : (saved ? '~' : (optional ? '·' : '✗'))
    const note = !v && saved ? '  (CODEX 无,房间自画着 —— 欠账,该收口)'
               : (!v && optional ? '  → 先用 window.codexFront(id) 取图鉴那张(不阻塞)' : '')
    console.log(`   ${mark} ${l}${note}`)
  }
  if (!r.front) {
    console.log('     → FRONT_OVR 里没有他,但【图鉴卡的正面一定有】(CSS 精灵 .spr-' + WHO + ')。')
    console.log('       先在页面里 window.codexFront(\'' + WHO + '\') 取出来看,比例合适就引入;')
    console.log('       不合适 = 规范缺口,报告给设计侧 —— 不要自己往 OVR 表里写。')
  }
  if ((r.side && !r.strideSide) || (r.back && !r.strideBack))
    console.log('     → 帧二缺:补 WALK_OVR(拿帧一躯干、末行两块腿合并居中),否则【必然滑行】')

  console.log('\n③ 不许撞车 —— 已用登记(设计时避开)')
  for (const dim of ['失败方式', '分界线形态', '兴趣', '屋子气质']) {
    const used = Object.entries(REG.已开房 || {}).map(([k, v]) => `${v[dim]}(${k})`)
    console.log(`   ${dim.padEnd(6)} ${used.join(' · ')}`)
  }

  console.log('\n④ 档案深度 —— 机器判不了,逐条确认(全部答得出才算过 S1)')
  MANUAL.forEach(([q, hint], i) => {
    console.log(`   [ ] ${i + 1}. ${q}`)
    console.log(`          ${hint}`)
  })

  console.log('\n' + (bad
    ? `✗ 机器可判部分有 ${bad} 项缺失 —— 补齐再谈 ④`
    : '✓ 机器可判部分全过 —— 逐条答完 ④ 即可进 S2'))
  await b.close()
  if (bad) process.exit(1)
})()
