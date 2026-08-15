#!/usr/bin/env bun
/**
 * traceback —— 人物贴合度对账(S9 收口,人工逐件回推)
 *
 * 十道门禁全是技术性的:点得到、走得到、不滑行、foot 对得上。
 * 它们查不了唯一真正重要的那件事 —— **这间房像不像这个人**。
 *
 * 机器判不了「能否回推到档案」,所以这支不判对错,它做的是把这间房
 * 摊开成一张【待填的对账表】:每一件物、每一句台词,逐条问它的出处。
 * 桃桃房那次长成一整套古典才女陈设、撤了九件,靠的是人眼偶然发现 ——
 * 这张表让它变成流程里必然会问到的一步。
 *
 * 判据(填不出就是它在这间房里没有理由):
 *   缺一个字 / 失败的方式 / 兴趣 / 三条功能诉求 / 分界线 —— 至少挂上一条
 *
 * 用法:bun tools/traceback.js <design.html 绝对路径> <房间名 ayun|tao|popo|tenz|…>
 */
const { chromium } = require('playwright')
const fs = require('fs'), path = require('path')
const FILE = process.argv[2], WHO = (process.argv[3] || '').toLowerCase()
if (!FILE || !WHO) { console.error('用法: bun tools/traceback.js <design.html 绝对路径> <房间名>'); process.exit(2) }

const REG_PATH = path.join(path.dirname(FILE), '.roomwork/cast-registry.json')
const REG = fs.existsSync(REG_PATH) ? JSON.parse(fs.readFileSync(REG_PATH, 'utf8')) : { 已开房: {} }
const anchor = (REG.已开房 || {})[WHO]

;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  await p.goto('file://' + FILE); await p.waitForTimeout(2500)
  const r = await p.evaluate((who) => {
    const key = who.toUpperCase() + '_ROOM'
    const room = window[key]
    if (!room) return { err: '没有这间房: ' + key }
    const A = window.ASSETS
    const seen = new Set(), items = []
    for (const e of room.plan) {
      if (seen.has(e[0])) continue
      seen.add(e[0])
      const a = A[e[0]] || {}
      items.push({ id: e[0], name: a.name || '', cat: a.cat || '',
                   say: a.say || '', deep: !!a.sayDeep, own: a.fromRoom === who })
    }
    const pf = room.perform || {}
    return { key, items, lines: pf.lines || [], button: (pf.labels || [])[0] || pf.button || '' }
  }, WHO)
  if (r.err) { console.log('✗ ' + r.err); await b.close(); process.exit(1) }

  console.log(`══ ${r.key} · 人物贴合度对账 ══\n`)
  if (anchor) {
    console.log('档案锚点(回推到这几条中的至少一条):')
    for (const k of ['缺', '失败方式', '兴趣', '分界线形态', '屋子气质'])
      if (anchor[k]) console.log(`   ${k.padEnd(5)} ${anchor[k]}`)
  } else {
    console.log(`⚠ cast-registry.json 里没有 ${WHO} —— 开完房要回填,否则这张表没有对照的锚点`)
  }
  console.log('\n逐件填「出处」。填不出的,就是它在这间房里没有理由 —— 撤掉,或改成有理由的那件。\n')

  const own = r.items.filter(i => i.own).length
  console.log(`── 物件 ${r.items.length} 件(自画 ${own} · 借 ${r.items.length - own})──`)
  for (const it of r.items) {
    const tag = it.own ? ' ' : '借'
    const say = it.say ? `「${it.say.slice(0, 22)}${it.say.length > 22 ? '…' : ''}」` : '（无台词）'
    console.log(`  [ ] ${tag} ${it.id.replace(/^\w+?_/, '').padEnd(18)} ${(it.name || it.cat).padEnd(10)} ${say}${it.deep ? '  ★追问层' : ''}`)
  }

  if (r.lines.length) {
    console.log(`\n── 表演台词 ${r.lines.length} 条(按钮:${r.button})──`)
    r.lines.forEach(l => console.log(`  [ ] 「${l}」`))
  }

  console.log(`\n── 三个总问(答不出就是这间房还没长成他的)──`)
  console.log('  [ ] 遮住角色,只看这间房,认得出是谁吗')
  console.log('  [ ] 哪几件物承载「分界线」?玩家扫一眼读得出来吗')
  console.log('  [ ] 借来的那几件,有没有一件是承载身份的(桌案/收纳/职业用具/床卧/墙面主件/光源)')
  await b.close()
})()
