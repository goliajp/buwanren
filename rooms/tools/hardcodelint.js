#!/usr/bin/env node
/**
 * hardcodelint —— 房间脚本的硬编码体检
 *
 * 用户的要求是「所有东西都要拆成 assets 然后按规则重新摆放，不能硬编码」。
 * 这条以前靠人眼看，看 36 遍必漏；这个工具把它变成可机械检测的门禁。
 *
 * 查四类，每类都真实发生过：
 *   H1 尺度当参数传   drawPose(..., 5) —— 兔子因此只有 40px，用户「一直没见到」
 *   H2 锚点换算字面量  st.x + 40 / cst.y + 50 —— 曾散在 22 处，改尺寸漏一处就错位
 *   H3 房间里裸绘制    fillRect / arc 等 —— 陈设应当来自素材库，不在房间脚本里画
 *   H4 中文标点        台词里的半角标点与结尾句号（见 .claude/CLAUDE.md）
 *
 * 判读：
 *   H1 / H3 / H4 是硬违规。用户定的口径：**完全不允许裸绘制，所有元素都应该是
 *   调用的** —— 包括气泡、zzz、影子这些角色附属绘制。它们该是引擎能力，不是每
 *   间房各写一遍：那份被复制到四个房间的气泡代码，正是 `af is not defined` 同时
 *   打挂桃桃 / 婆婆 / 丹增三间的原因。复制的绘制代码就是 bug 的传播路径。
 *   H2 仍是提示，会把气泡偏移误判成脚点换算 —— 但气泡本身迁走后，这类误报自然消失。
 *
 * 用法： node tools/hardcodelint.js <design.html> [房间canvas名...]
 */
const fs = require('fs')

const file = process.argv[2]
if (!file) { console.error('用法: node hardcodelint.js <design.html> [canvas名...]'); process.exit(2) }
const src = fs.readFileSync(file, 'utf8')
// 清单自己长出来 —— 从前写死四间,沈砚白鹭的硬编码从来没被这道 lint 看过。
// 约定同 tools/rooms.js:window.<NAME>_ROOM → <name>Canvas
const rooms = process.argv.slice(3).length ? process.argv.slice(3)
  : [...src.matchAll(/(?:window|globalThis)\.([A-Z][A-Z0-9]*)_ROOM\s*=\s*\{/g)]
      .map(m => m[1].toLowerCase() + 'Canvas')
      .filter((v, i, a) => a.indexOf(v) === i)
if (!rooms.length) { console.error('✗ 一间房都没发现 —— 格式变了还是路径给错了?查不到东西的 lint 必须失败'); process.exit(2) }

let total = 0

for (const room of rooms) {
  const i = src.indexOf(`getElementById('${room}')`)
  // 「跳过」不能是免费的:清单是从 window.<NAME>_ROOM 长出来的,找不到对应画布
  // 说明约定断了,那间房的硬编码谁都没在查 —— 记一笔,别静静滑过去。
  if (i < 0) { console.log(`\n— ${room}：未找到画布,那间房这道 lint 没查`); total++; continue }
  // 从取画布那一行【往回】找到整个 <script> 块。房间脚本已经把宿主那一段
  // (取画布、驱动帧)挪到文件末尾,从那一行往后切等于什么都没切到 ——
  // 白鹭拆完后这里一度只看到 7 行(原本 423)还报了「无硬编码」。
  // roomaudit 一直是这么切的,照它。
  const a0 = src.lastIndexOf('<script', i)
  const raw = src.slice(a0, src.indexOf('</script>', i))
  // 注释里的示例代码不是代码。把注释挖空成等长空白 —— 保长度所以行号不变,
  // 否则「不要写 st.x + 40」这句说明本身会被记成一处违规。
  const seg = raw
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length))
  const lineOf = off => seg.slice(0, off).split('\n').length
  const hits = []

  // H1 —— 尺度作为调用参数
  for (const m of seg.matchAll(/\b(drawPose|placeActor|placeAsset)\s*\([^)]*?,\s*(\d+)\s*\)/g)) {
    hits.push(['H1', lineOf(m.index), `尺度当参数传：${m[0].slice(0, 60)}`])
  }

  // H2 —— 锚点→脚点的字面量换算（排除已收进访问器的 af(0) 形式）
  for (const m of seg.matchAll(/\b(st|cst|rst|dst|a|b)\.(x|y)\s*\+\s*(\d{2,})\b/g)) {
    hits.push(['H2', lineOf(m.index), `锚点换算写死：${m[0]}`])
  }

  // H3 —— 房间脚本里的裸绘制（角色状态机允许，陈设不允许）
  const draws = [...seg.matchAll(/\b(fillRect|strokeRect|arc|quadraticCurveTo|createRadialGradient)\s*\(/g)]
  if (draws.length > 0) {
    // 逐处列出前 12 个，其余汇总 —— 要能定位，不能只给个总数
    for (const d of draws.slice(0, 12)) hits.push(['H3', lineOf(d.index), `裸绘制 ${d[1]}(...)`])
    if (draws.length > 12) hits.push(['H3', lineOf(draws[12].index), `……另有 ${draws.length - 12} 处裸绘制`])
  }

  // H4 —— 中文标点
  for (const m of seg.matchAll(/say:\s*'([^']{2,80})'/g)) {
    const t = m[1]
    if (/[一-龥][,?!;:]/.test(t)) hits.push(['H4', lineOf(m.index), `台词半角标点：${t}`])
    if (/[一-龥]。$/.test(t))      hits.push(['H4', lineOf(m.index), `台词结尾句号：${t}`])
  }

  console.log(`\n— ${room}（${seg.split('\n').length} 行）`)
  if (!hits.length) { console.log('  ✓ 无硬编码'); continue }
  for (const [code, ln, msg] of hits.sort((a, b) => a[1] - b[1])) {
    console.log(`  ✗ ${code} L${ln}  ${msg}`)
  }
  total += hits.length
}

console.log(`\n合计 ${total} 处`)
process.exit(total ? 1 : 0)
