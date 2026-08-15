// 视觉回归:对每间房做确定性快照(固定 t=0、固定姿态,不含随机/时间抖动),存指纹比对。
//
// 从前只快照 AYUN_ROOM —— 于是「regress 全绿」只证明了阿云没坏,改引擎时
// 桃桃/婆婆/丹增三间房完全没有回归网。房间【自动发现】(见 rooms.js 的约定),
// 加村民房不需要改这个工具。
//
// 场景四个,全房通用,覆盖面各不同:
//   empty  房间本体   —— 素材 / 布局 / 光 / grade / 地面动效
//   stand  主角在中部 —— 角色落地 + 阴影
//   back   主角在上部 —— 【家具遮角色】方向的遮挡
//   low    主角在下部 —— 【角色遮家具】方向的遮挡
//
// 用法:bun tools/regress.js <design.html 绝对路径> [check|save]   ★ 必须从仓库根跑
//      文件在前、模式在后 —— 写反会把 check 当路径 → ERR_INVALID_URL,看着像工具坏了
const { chromium } = require('playwright')
const fs = require('fs'), crypto = require('crypto'), path = require('path')
const FILE = process.argv[2], MODE = process.argv[3] || 'check'
const BASE = process.argv[4] || 'mini/.roomwork/baseline/rooms.json'
if (!FILE) { console.error('用法: bun tools/regress.js <design.html 绝对路径> [check|save]'); process.exit(2) }
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  await p.goto('file://' + FILE); await p.waitForTimeout(3500)
  const shots = await p.evaluate(() => {
    const found = Object.keys(window)
      .filter(k => /^[A-Z][A-Z0-9]*_ROOM$/.test(k))
      .filter(k => window[k] && Array.isArray(window[k].plan))
      .sort()
    const out = {}
    for (const key of found) {
      const room = window[key]
      const W = room.w || 1440, H = room.h || 2560
      const actor = key.replace(/_ROOM$/, '').toLowerCase()
      const A = (window.ACTORS || {})[actor]
      const pose = (n, alt) => (A && A.poses && A.poses[n]) ? n : alt
      const at = (x, y, ps) => A ? [window.placeActor(actor, x, y, ps, false)] : []
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H
      const g = cv.getContext('2d')
      const cases = {
        empty: [],
        stand: at((W * 0.5) | 0, (H * 0.60) | 0, pose('stand', 'stand')),
        back:  at((W * 0.5) | 0, (H * 0.40) | 0, pose('standback', 'stand')),
        low:   at((W * 0.5) | 0, (H * 0.78) | 0, pose('stand', 'stand')),
      }
      out[key] = {}
      for (const k in cases) {
        g.clearRect(0, 0, W, H)
        window.renderRoom(g, room, 0, cases[k])
        out[key][k] = cv.toDataURL('image/png')
      }
    }
    return out
  })
  const fp = {}
  for (const room in shots) {
    fp[room] = {}
    for (const k in shots[room])
      fp[room][k] = crypto.createHash('sha256').update(shots[room][k]).digest('hex').slice(0, 16)
  }
  const nRoom = Object.keys(fp).length
  if (!nRoom) { console.log('✗ 没发现任何房间'); await b.close(); process.exit(1) }

  if (MODE === 'save') {
    fs.mkdirSync(path.dirname(BASE), { recursive: true })
    fs.writeFileSync(BASE, JSON.stringify(fp, null, 2))
    console.log('✓ 基准已保存 ' + nRoom + ' 间房:')
    for (const room in fp) console.log('  ' + room + '  ' + Object.entries(fp[room]).map(([k, v]) => k + ' ' + v).join('  '))
  } else {
    if (!fs.existsSync(BASE)) { console.log('无基准,先跑 save'); await b.close(); process.exit(1) }
    const old = JSON.parse(fs.readFileSync(BASE, 'utf8'))
    let bad = 0, newRoom = 0
    for (const room in fp) {
      if (!old[room]) { console.log('  + ' + room + ' 新房间,无基准(跑 save 收录)'); newRoom++; continue }
      for (const k in fp[room]) {
        const same = old[room][k] === fp[room][k]
        if (!same) bad++
        console.log((same ? '  ✓ ' : '  ✗ ') + (room + ' ' + k).padEnd(20) + (same ? fp[room][k] : old[room][k] + ' → ' + fp[room][k]))
      }
    }
    for (const room in old) if (!fp[room]) { console.log('  ! ' + room + ' 基准里有、页面上没有了'); bad++ }
    console.log(bad ? ('✗ ' + bad + ' 处与基准不符') : ('✓ 视觉回归全部通过(' + nRoom + ' 间房)' + (newRoom ? ' · ' + newRoom + ' 间待收录' : '')))
    if (bad) process.exit(1)
  }
  await b.close()
})()
