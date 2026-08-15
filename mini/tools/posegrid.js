#!/usr/bin/env bun
/**
 * posegrid —— 把一个角色的【全部】姿态摊成一张表(S6 用眼睛验的那一步)
 *
 * `poselint` 只看名字齐不齐、`walklint` 只比走姿像素动没动 —— 两支都绿,
 * 姿态仍可能画歪(手长在肩膀外、坐姿比站姿还高、脸画反)。那一类只有看得见。
 * 老的 `posesheet.js` 把角色和姿态名都写死在源码里(阿云的三个睡姿),
 * 换个角色就悄悄给你画阿云 —— 本工具从 ACTORS 现取,不写死。
 *
 * 还查一件 poselint / walklint / roomaudit A 三支都看不见的事:
 * **正面与背面逐行同宽** —— 同一个人转个身不该胖一圈。
 *
 * 用法:bun tools/posegrid.js <design.html 绝对路径> <角色 id> [每行几个]
 */
const { chromium } = require('playwright')
const FILE = process.argv[2], ID = process.argv[3], PERROW = +(process.argv[4] || 6)
if (!FILE || !ID) { console.error('用法: bun tools/posegrid.js <design.html 绝对路径> <角色 id> [每行几个]'); process.exit(2) }

;(async () => {
  const b = await chromium.launch(), p = await b.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(String(e)))
  await p.goto('file://' + FILE); await p.waitForTimeout(2800)

  const out = await p.evaluate(({ id, perRow }) => {
    const a = window.ACTORS && window.ACTORS[id]
    if (!a) return { err: '没有这个角色: ' + id + '(有的是 ' + Object.keys(window.ACTORS || {}).join(' ') + ')' }
    const names = Object.keys(a.poses).sort()
    const CW = 150, CH = 200, PAD = 10, HEAD = 26
    const rows = Math.ceil(names.length / perRow)
    const cv = document.createElement('canvas')
    cv.width = PAD + perRow * (CW + PAD)
    cv.height = PAD + rows * (CH + PAD + HEAD)
    const g = cv.getContext('2d')
    g.imageSmoothingEnabled = false
    g.fillStyle = '#8a9ab8'; g.fillRect(0, 0, cv.width, cv.height)
    const info = []
    names.forEach((n, i) => {
      const cx = PAD + (i % perRow) * (CW + PAD)
      const cy = PAD + ((i / perRow) | 0) * (CH + PAD + HEAD)
      g.fillStyle = 'rgba(20,26,40,0.16)'; g.fillRect(cx, cy, CW, CH + HEAD)
      const spr = window.actorSprite(id, n, false)
      // 脚点画一条线 —— 坐姿浮空 / 陷地一眼就看得出来
      const foot = a.foot || [spr.width / 2, spr.height]
      const bx = cx + (CW - spr.width) / 2, by = cy + HEAD + (CH - spr.height) / 2
      g.drawImage(spr, bx, by)
      g.fillStyle = 'rgba(230,80,80,0.85)'
      g.fillRect(cx, by + foot[1], CW, 1)
      g.fillRect(bx + foot[0], cy + HEAD, 1, CH)
      g.fillStyle = '#f2efe6'; g.font = '13px monospace'
      g.fillText(n + '  ' + spr.width + '×' + spr.height, cx + 6, cy + 17)
      info.push({ n, w: spr.width, h: spr.height })
    })
    /* 房间自画的正面,必须与规范给的背面【逐行同宽】——
       同一个人转个身不该胖一圈。规范只给了一部分角色 FRONT,其余由房间自画,
       而自画时很容易照着「看起来对」画:沈砚第一版头部多占一行、躯干宽一格、
       两脚间距也不同,poselint(名字)、walklint(像素)、roomaudit A(引用)三支全绿。
       比的是【每行左右去掉点号后的长度】,不是像素 —— 内容当然不同(正面有脸,
       背面是后脑),但同一行的身体轮廓宽度必须一致。 */
    // 参照取【这个角色自己在用的背面】,不是规范里的那张:
    // 阿云和桃桃根本没声明 codex,背面是房间另画的一套,拿规范去比是比错了对象。
    // 走 codex 的角色(沈砚/丹增/婆婆)这个值本来就等于规范,两边一致。
    const ref = a.poses.standback || a.poses.walkback1
    /* 正面若【直接采用规范图鉴】(codexFront),它的宽度是规范说了算,
       可能比背面窄(图鉴是头像式的正面)——那不是房间画错体型,不该判 error。
       比对 stand 与 codexFront 的宽度轮廓:一致 = 已引入规范,降级成提示。 */
    let frontIsSpec = false
    try {
      const cf = window.codexFront && window.codexFront(id)
      if (cf && a.poses.stand && cf.rows.length === a.poses.stand.length) {
        const wp = rs => rs.map(r => r.replace(/^[.\s]+|[.\s]+$/g, '').length).join(',')
        frontIsSpec = wp(cf.rows) === wp(a.poses.stand)
      }
    } catch (e) {}
    // breath 不查:它【就是】要整体沉一格的(那才叫呼吸),逐行比必然对不上。
    // 查的是静止的正面轮廓 —— stand 是基准,blink 只改眼,walkfront1 是站-迈循环的站姿帧。
    const FRONTISH = /^(stand|blink|walkfront1)$/
    const shape = [], note = []
    if (ref) {
      for (const n of names) {
        if (!FRONTISH.test(n)) continue
        const rows = a.poses[n]
        if (!rows) continue
        if (rows.length !== ref.length) {
          // 行数不等【可能是有意的】—— 婆婆的正面图本来就骑着扫帚(顶上五行是刷毛和杆),
          // 那不是体型不一致。降级成提示,让人看一眼是不是道具占的行。
          note.push({ n, msg: `${rows.length} 行 vs 背面 ${ref.length} 行 —— 是道具占的行吗?` }); continue
        }
        const off = []
        for (let r = 0; r < ref.length; r++) {
          const wf = rows[r].replace(/^\.+|\.+$/g, '').length
          const wb = ref[r].replace(/^\.+|\.+$/g, '').length
          if (wf !== wb) off.push(`第${r + 1}行 正${wf}/背${wb}`)
        }
        if (off.length) (frontIsSpec ? note : shape).push({ n, msg: off.join(' · ') + (frontIsSpec ? '(正面已直接用规范图鉴,宽度以规范为准)' : '') })
      }
    }
    return { png: cv.toDataURL('image/png'), info, shape, note, hasRef: !!ref }
  }, { id: ID, perRow: PERROW })

  if (out.err) { console.log('✗ ' + out.err); await b.close(); process.exit(1) }
  require('fs').mkdirSync('/tmp/rules', { recursive: true })
  const dst = '/tmp/rules/POSEGRID-' + ID + '.png'
  require('fs').writeFileSync(dst, Buffer.from(out.png.split(',')[1], 'base64'))
  console.log('══ ' + ID + ' · ' + out.info.length + ' 个姿态 ══')
  // 尺寸异常:同一个人各姿态的宽高应该同格,差一格就是画的时候数错了行
  const hs = [...new Set(out.info.map(o => o.h))], ws = [...new Set(out.info.map(o => o.w))]
  console.log('   宽 ' + ws.join(' / ') + '   高 ' + hs.join(' / '))
  if (ws.length > 1 || hs.length > 1) {
    console.log('   ~ 尺寸不齐 —— 同一个角色换姿态不该换体型,核对行数/列数:')
    const mw = ws[0], mh = hs[0]
    out.info.filter(o => o.w !== mw || o.h !== mh).forEach(o => console.log(`     ${o.n}  ${o.w}×${o.h}`))
  } else console.log('   ✓ 全部同格')
  if (!out.hasRef) console.log('   · 这个角色没有背面姿态,轮廓一致性查不了')
  else if (out.shape.length) {
    console.log('   ✗ 正面与背面【轮廓对不上】—— 同一个人转身不该换体型:')
    out.shape.forEach(o => console.log(`     ${o.n}  ${o.msg}`))
  } else if (!out.note.length) console.log('   ✓ 正面与背面逐行同宽')
  if (out.note && out.note.length) {
    console.log('   ~ 正面与背面【行数不等】,人工看一眼:')
    out.note.forEach(o => console.log(`     ${o.n}  ${o.msg}`))
  }
  if (errs.length) console.log('   ✗ 页面错误: ' + errs[0])
  console.log('→ ' + dst)
  await b.close()
})()
