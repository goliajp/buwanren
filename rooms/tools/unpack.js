#!/usr/bin/env bun
/**
 * unpack —— 把 design.html 切成源码树(一次性;之后改源码树,用 build.js 拼回去)
 *
 * 拆 5MB 单文件的唯一安全办法是【切片再原样拼回】,不是「重写成模块」。
 * 判据也因此是最硬的一种:拼回来的文件与原文件 **逐字节相同**(sha256 一致),
 * 比「regress 哈希一致」更强 —— 后者只证明渲染没变,前者证明什么都没变。
 *
 * 切法:
 *   顶层按 <script> / <style> 标签切成若干 part,标签之间的 HTML 原样留作 glue。
 *   开闭标签的原文单独记进 manifest —— 有四处 `})()</script>` 是标签与代码同行,
 *   靠记原文才能拼得回去。
 *   素材库那个 14,184 行的大 script 再按分节切成 assets/ 与 engine/ 多个文件,
 *   它们首尾相接就是原内容,不多不少一个字节。
 *
 * 用法:bun tools/unpack.js [design.html] [输出目录]
 *      默认 rooms/design.html → rooms/src/
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto')

const SRC = path.resolve(process.argv[2] || 'rooms/design.html')
const OUT = path.resolve(process.argv[3] || 'rooms/src')

// 顶层 part 的取名:按出现顺序给 <script>/<style> 命名,glue 自动编号。
// 名字里的目录就是工序单要的 engine/ assets/ rooms/ bible/ 四分。
const NAMES = [
  'bible/page.css',          // 主样式
  'bible/charsheet.css',     // 角色表内嵌样式
  'bible/charsheet.js',      // 角色表:CHARS + 重画 override
  'engine/village.js',       // 村子俯瞰图(vilCanvas)
  'rooms/ayun.js',
  'rooms/tao.js',
  'rooms/popo.js',
  'rooms/tenz.js',
  'rooms/bailu.js',
  'rooms/shenyan.js',
  'LIBRARY',                 // 大块:下面按 SPLITS 再分
  'engine/asset-table.js',   // 素材总表渲染
  'rooms/ayun-plan.js',      // 阿云房 plan(其余五房的 plan 在各自 room 文件里)
  'engine/pose-sheet.js',    // 姿态表渲染
]

// 大 script 的内部分界(绝对行号 = design.html 里的行号,该行是这一段的第一行)
const SPLITS = [
  // 边界取【分节横幅的第一行】。取横幅的下一行会让上一个文件结尾挂着半个注释、
  // 下一个文件从注释中间开始 —— 字节仍拼得回去,但每个文件都不再读得通。
  [13076, 'assets/_head.js'],       // 库说明 + IIFE 开头 + const A = {}
  [13087, 'assets/tao.js'],         //  79 件
  [15725, 'assets/popo.js'],        //  72 件
  [17860, 'assets/tenz.js'],        //  21 件
  [18605, 'assets/shenyan.js'],     //   4 件
  [18901, 'assets/bailu.js'],       //  66 件
  [20830, 'assets/shenyan-2.js'],   //  63 件(第二批;不与上面合并 —— 合并要挪动顺序,
  [22599, 'assets/tenz-2.js'],      //  37 件 拼回来就不是同一个字节流了)
  [23408, 'assets/_prim.js'],       // window.ASSETS = A + 共享绘制原语 + def()
  [23455, 'assets/ayun.js'],        //  59 件
  [25268, 'engine/actors.js'],      // 角色资源 ACTORS
  [25574, 'engine/actor-fx.js'],    // 气泡 / 情绪符号
  [25704, 'engine/asset-lint.js'],  // 规范校验 + 交互热区 + 库合规
  [25930, 'engine/layout.js'],      // 布局辅助
  [25982, 'assets/glyphs.js'],      // 书法字
  [26181, 'assets/surfaces.js'],    // 地板 / 墙面
  [26569, 'engine/render.js'],      // 渲染管线 + 房间状态 + IIFE 收尾
]

const src = fs.readFileSync(SRC, 'utf8')

// 行首偏移表:把绝对行号换算成字节偏移
const lineStart = [0]
for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStart.push(i + 1)
const offsetOfLine = (n) => lineStart[n - 1]   // 1-based

// ── 顶层切片 ────────────────────────────────────────────────
const parts = []
let pos = 0, tagIdx = 0, glueIdx = 0
// 标签之间的 HTML。多数只是两个换行 —— 为两个字节开一个文件是噪音,
// 短的直接写进 manifest,长的(设计册正文)才落盘。
const glue = (body) => body.length <= 64
  ? { kind: 'html', text: body }
  : { kind: 'html', file: `bible/glue-${String(++glueIdx).padStart(2, '0')}.html`, body }
const TAG = /<(script|style)\b[^>]*>/g
let m
while ((m = TAG.exec(src)) !== null) {
  const tagStart = m.index, openEnd = m.index + m[0].length
  const closeTag = '</' + m[1] + '>'
  const closeStart = src.indexOf(closeTag, openEnd)
  if (closeStart < 0) throw new Error(`${m[0]} 没有配对的 ${closeTag}(偏移 ${tagStart})`)

  if (tagStart > pos) parts.push(glue(src.slice(pos, tagStart)))

  const name = NAMES[tagIdx++] || `bible/unnamed-${tagIdx}.js`
  parts.push({ kind: m[1], open: m[0], close: closeTag, name,
               body: src.slice(openEnd, closeStart),
               bodyStart: openEnd })
  pos = closeStart + closeTag.length
  TAG.lastIndex = pos
}
if (pos < src.length) parts.push(glue(src.slice(pos)))

if (tagIdx !== NAMES.length)
  throw new Error(`标签数 ${tagIdx} 与 NAMES 的 ${NAMES.length} 对不上 —— 结构变了,先更新 NAMES`)

// ── 大 script 再分 ──────────────────────────────────────────
const manifest = { source: path.basename(SRC), parts: [] }
for (const p of parts) {
  if (p.kind === 'html') {
    if (p.text !== undefined) { manifest.parts.push({ kind: 'html', text: p.text }); continue }
    fs.mkdirSync(path.join(OUT, path.dirname(p.file)), { recursive: true })
    fs.writeFileSync(path.join(OUT, p.file), p.body)
    manifest.parts.push({ kind: 'html', files: [p.file] })
    continue
  }
  const entry = { kind: p.kind, open: p.open, close: p.close, files: [] }
  if (p.name === 'LIBRARY') {
    // 按绝对行号切:每段的起点偏移减去 body 起点,就是段在 body 里的位置
    const bounds = SPLITS.map(([ln, f]) => ({ off: offsetOfLine(ln) - p.bodyStart, f }))
    if (bounds[0].off < 0) throw new Error('第一个分界落在 body 之前')
    // body 开头到第一个分界之间那截(通常只是个换行)并进第一个文件
    bounds[0].off = 0
    for (let i = 0; i < bounds.length; i++) {
      const end = i + 1 < bounds.length ? bounds[i + 1].off : p.body.length
      const chunk = p.body.slice(bounds[i].off, end)
      fs.mkdirSync(path.join(OUT, path.dirname(bounds[i].f)), { recursive: true })
      fs.writeFileSync(path.join(OUT, bounds[i].f), chunk)
      entry.files.push(bounds[i].f)
    }
  } else {
    fs.mkdirSync(path.join(OUT, path.dirname(p.name)), { recursive: true })
    fs.writeFileSync(path.join(OUT, p.name), p.body)
    entry.files.push(p.name)
  }
  manifest.parts.push(entry)
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

// ── 自检:立刻拼回来比一遍,不通过就不算拆成功 ──────────────────
const rebuilt = manifest.parts.map(e => e.text !== undefined ? e.text :
  (e.open || '') + e.files.map(f => fs.readFileSync(path.join(OUT, f), 'utf8')).join('') + (e.close || '')
).join('')
const h = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16)
const nFiles = manifest.parts.reduce((n, e) => n + (e.files ? e.files.length : 0), 0)
console.log(`拆出 ${manifest.parts.length} 个 part · ${nFiles} 个文件 → ${path.relative(process.cwd(), OUT)}/`)
if (rebuilt === src) {
  console.log(`✓ 拼回来与原文件逐字节相同(sha256 ${h(src)})`)
} else {
  console.log(`✗ 拼回来跟原文件不一样 —— 拆包不成立`)
  console.log(`   原 ${src.length} 字节 ${h(src)} / 拼 ${rebuilt.length} 字节 ${h(rebuilt)}`)
  for (let i = 0; i < Math.min(src.length, rebuilt.length); i++)
    if (src[i] !== rebuilt[i]) { console.log(`   第一处不同在偏移 ${i}:\n     原 ${JSON.stringify(src.slice(i-40,i+40))}\n     拼 ${JSON.stringify(rebuilt.slice(i-40,i+40))}`); break }
  process.exit(1)
}
