#!/usr/bin/env bun
/**
 * build —— 源码树 → design.html
 *
 * 从 2026-08-17 起 **design.html 是构建产物,不要直接改它**。
 * 改 `rooms/src/` 下的文件,然后跑这个脚本。直接改 design.html 的话,
 * 下一次 build 会把你的改动整个盖掉。
 *
 * 源码树的形状(见 rooms/src/manifest.json):
 *   bible/    设计册正文 + 样式 + 角色表
 *   engine/   引擎:村图 / 角色 / 渲染管线 / 校验 / 布局辅助
 *   assets/   素材库,按房分文件(_head 是 IIFE 开头,_prim 是共享绘制原语)
 *   rooms/    六间房各自的 canvas 脚本
 *
 * ⚠ 这些 .js 文件是【一个大 IIFE 的片段】,单个文件本身不是合法 JS
 *   (括号在别的文件里闭合)。这是切片式拆包的代价,换来的是产物可以
 *   与拆包前逐字节相同 —— 拆 5MB 单文件时,「什么都没变」比「看着没变」值钱得多。
 *   要对单个文件做语法检查,先 build 再查产物。
 *
 * 用法:bun tools/build.js            写出 design.html
 *      bun tools/build.js --check    只比对,不写(CI 用:源码树与产物是否同步)
 *      --out=<路径>                   比对/写到别处(变异测试用,不碰真产物)
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto')

const SRC = path.resolve(process.argv.find(a => a.startsWith('--src=')) ?
  process.argv.find(a => a.startsWith('--src=')).slice(6) : 'rooms/src')
const CHECK = process.argv.includes('--check')
const MAN = path.join(SRC, 'manifest.json')
if (!fs.existsSync(MAN)) { console.error(`✗ 没有 ${MAN} —— 源码树在哪?`); process.exit(2) }

const manifest = JSON.parse(fs.readFileSync(MAN, 'utf8'))
const outArg = process.argv.find(a => a.startsWith('--out='))
const OUT = path.resolve(outArg ? outArg.slice(6)
  : path.join(path.dirname(SRC), manifest.source || 'design.html'))

let missing = 0
const read = (f) => {
  const p = path.join(SRC, f)
  if (!fs.existsSync(p)) { console.error(`✗ 缺文件 ${f}`); missing++; return '' }
  return fs.readFileSync(p, 'utf8')
}
const out = manifest.parts.map(e => e.text !== undefined ? e.text
  : (e.open || '') + (e.files || []).map(read).join('') + (e.close || '')).join('')
if (missing) { console.error(`✗ ${missing} 个文件不在源码树里,不产出`); process.exit(1) }

const h = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16)
const nFiles = manifest.parts.reduce((n, e) => n + (e.files ? e.files.length : 0), 0)

if (CHECK) {
  if (!fs.existsSync(OUT)) { console.error(`✗ ${OUT} 不存在,先跑一次 build`); process.exit(1) }
  const cur = fs.readFileSync(OUT, 'utf8')
  if (cur === out) { console.log(`✓ 产物与源码树一致(${nFiles} 个文件 · sha256 ${h(out)})`); process.exit(0) }
  console.error('✗ 产物与源码树【不一致】—— 有人直接改了 design.html,或改完源码树忘了 build')
  console.error(`   产物 ${cur.length} 字节 ${h(cur)} / 源码树拼出 ${out.length} 字节 ${h(out)}`)
  for (let i = 0; i < Math.min(cur.length, out.length); i++)
    if (cur[i] !== out[i]) {
      console.error(`   第一处不同在偏移 ${i}(第 ${cur.slice(0, i).split('\n').length} 行):`)
      console.error(`     产物 ${JSON.stringify(cur.slice(i - 30, i + 30))}`)
      console.error(`     源码 ${JSON.stringify(out.slice(i - 30, i + 30))}`)
      break
    }
  process.exit(1)
}

const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null
fs.writeFileSync(OUT, out)
console.log(`✓ ${path.relative(process.cwd(), OUT)}  ${out.length} 字节 · ${nFiles} 个源文件 · sha256 ${h(out)}`)
if (before !== null) console.log(before === out ? '  (与原产物逐字节相同)' : `  (产物变了:${h(before)} → ${h(out)})`)
