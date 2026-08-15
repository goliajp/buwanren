#!/usr/bin/env bun
/**
 * roomlint —— 房间立项文档体检(WORKFLOW S2 的门禁)
 *
 * 认三种状态,不是「有/无」两档:
 *   合格         五节齐全、各节有实质内容、分界线不撞车
 *   写了没写好 ★ 节在但内容是模板占位/一两句话/分界线是概念不是东西 —— 返工重灾区
 *   没写         节缺失 → 给模板路径,照着填
 *
 * 机器只判「结构与撞车」;「立意利不利」判不了,列成清单让人逐条答
 * (假装能判就是第五种假绿,见 PLAYBOOK 事故模式 14/20/21)。
 *
 * 用法:bun tools/roomlint.js <ROOM-xxx-S1.md 路径>
 */
const fs = require('fs'), path = require('path')
const FILE = process.argv[2]
if (!FILE) { console.error('用法: bun tools/roomlint.js <ROOM-xxx-S1.md 路径>'); process.exit(2) }

const ROOT = path.dirname(path.resolve(FILE))
const TPL = path.join(ROOT, 'templates/ROOM-S1.md')
const REG_PATH = path.join(ROOT, 'cast-registry.json')
const REG = fs.existsSync(REG_PATH) ? JSON.parse(fs.readFileSync(REG_PATH, 'utf8')) : { 已开房: {} }

if (!fs.existsSync(FILE)) {
  console.log('✗ 立项文档不存在:' + FILE)
  console.log('  → 没写。复制模板照着填:' + TPL)
  process.exit(1)
}
const src = fs.readFileSync(FILE, 'utf8')

// 必需的五节 —— 标题关键词 → 这一节承担什么
const SECTIONS = [
  // ⚠ 标题里的人称随角色变(他/她/它),按字面匹配「他」会把女性角色的立意判成「没写」——
  // 白鹭房打出来的:文档写的是「说明【她】的什么」,门禁报「立意没写」,是假红不是假绿,
  // 但同样会让人去改文档迁就工具。关键词只取不变的那一段。
  ['这间房要说明', '立意', 60,
   '一句话要能拆成「缺一个字」+「失败的方式」两半。拆不出 = 立意没落到人身上'],
  ['分界线', '分界线形态', 120,
   '必须是【东西】不是概念;不与已用的重复;玩家扫一眼全屋能读出来'],
  ['功能诉求', '三条功能＋起居', 200,
   '功能每条要列得出【具体物件名】;另外【起居四问】要答:睡在哪·吃什么·喝什么·洗漱在哪'],
  ['分野', '与已有房的分野', 100,
   '缺/失败方式/屋子气质/光 四行都要与前四间都不同。有一行雷同 = 立意漂了'],
  ['数据指标', '指标预期', 100,
   '先定落点,S9 对账。数量是参考不是目标'],
]

// 切出各节内容
function sectionBody(kw) {
  const re = new RegExp('^##+\\s.*' + kw + '.*$', 'm')
  const m = src.match(re)
  if (!m) return null
  const start = src.indexOf(m[0]) + m[0].length
  const rest = src.slice(start)
  const next = rest.search(/^##\s/m)
  return (next < 0 ? rest : rest.slice(0, next)).trim()
}

// 模板占位残留:尖括号占位、判据段照抄
const PLACEHOLDER = /<[^>\n]{0,24}>/g
// 起居关键词 —— 功能那一节里必须提到,否则「他住在这儿」这块会被整个漏掉
const LIVING = ['起居', '睡', '床', '榻', '铺盖', '吃', '喝', '茶', '碗', '灶']

console.log('══ ' + path.basename(FILE) + ' · 立项体检 ══\n')
let miss = 0, thin = 0
for (const [kw, label, minLen, judge] of SECTIONS) {
  const body = sectionBody(kw)
  if (body === null) {
    miss++
    console.log(`✗ ${label.padEnd(12)} 没写`)
    console.log(`    → 模板里有这一节,照着填:${TPL}`)
    console.log(`    → 判据:${judge}`)
    continue
  }
  // 去掉判据行(那是模板自带的说明,不算内容)
  const real = body.split('\n').filter(l => !/^\*\*(判据|反例|正例)/.test(l.trim())).join('\n').trim()
  const holes = (real.match(PLACEHOLDER) || []).length
  if (real.length < minLen || holes >= 3) {
    thin++
    console.log(`~ ${label.padEnd(12)} 写了但没写好  (${real.length} 字` + (holes ? `,${holes} 处占位没填` : '') + ')')
    console.log(`    → 判据:${judge}`)
  } else {
    console.log(`✓ ${label.padEnd(12)} (${real.length} 字)`)
    if (kw === '功能诉求' && !LIVING.some(k => real.includes(k))) {
      thin++
      console.log('    ~ 这一节没提到【起居】(睡/吃/喝/洗漱) —— 他住在这儿,漏了房间就不完整')
    }
  }
}

// 分界线撞车 —— 只比【本房自己声明的那一行】,不比整节
// (整节常引用已用形态做对照,整节字面比会全中;本房自己也在登记表里,要排除)
console.log('\n── 分界线撞车检查 ──')
const SELF = (path.basename(FILE).match(/ROOM-([a-z0-9]+)-/i) || [])[1] || ''
const dl = sectionBody('分界线') || ''
const decl = (dl.match(/^\*\*形态\*\*\s*[:：]\s*(.+)$/m) || [])[1]
const used = Object.entries(REG.已开房 || {}).filter(([k]) => k !== SELF).map(([k, v]) => [v.分界线形态, k])
let clash = 0
if (!decl) {
  thin++
  console.log('   ~ 没有 `**形态**: <名词短语>` 那一行 —— 机器查不了重,按模板补上')
  console.log('     (本房是 ' + (SELF || '?') + ',登记表里的它自己已排除)')
} else {
  console.log('   本房形态:' + decl.trim())
  for (const [form, who] of used) {
    const core = String(form).replace(/\(.*?\)|（.*?）/g, '').trim()
    if (core && decl.includes(core)) { clash++; console.log(`   ✗ 与 ${who} 的「${form}」撞了`) }
  }
  if (!clash) console.log('   ✓ 未与已开房的形态字面撞车(仍需人工确认不是换皮)')
}
console.log('   已用:' + (used.map(([f, w]) => `${f}(${w})`).join(' · ') || '(无)'))

console.log('\n── 机器判不了,逐条答 ──')
;[
  '立意那句话,遮住角色名还认得出是谁吗?认不出 = 太泛',
  '分界线是【看得见的东西】还是一个概念?说得出两侧各是哪几件物吗',
  '三条功能各自列出的物件,画出来会不会和已有房间的物件雷同',
  '屋子气质用一个词说,那个词前四间用过没有',
  '指标预期的依据写了吗(为什么是这个数,不是「差不多」)',
  '★ 起居写了吗?睡在哪、吃什么、喝什么 —— 他住在这儿。漏了这块,房间画到一半才会发现',
].forEach((q, i) => console.log(`   [ ] ${i + 1}. ${q}`))

const bad = miss + thin + clash
console.log('\n' + (bad
  ? `✗ ${miss} 节没写 · ${thin} 节写了没写好 · ${clash} 处撞车 —— 补齐再进 S3`
  : '✓ 结构与撞车全过 —— 逐条答完上面五问即可进 S3'))
if (bad) process.exit(1)
