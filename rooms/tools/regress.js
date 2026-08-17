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
// ★ 基准只存哈希,不存图 —— 但存了【存基准时的 commit】。
//   哈希只能告诉你「变了」,回答不了「变成什么样」。旧像素不另存一份:
//   design.html 本身就在 git 里,`diff` 模式把那个 commit 的 design.html 取出来重渲,
//   旧图新图差异图当场生成。代价是 save 必须在 design.html 已提交的状态下跑
//   —— 否则那次基准对应的源码不存在于任何地方,漂移就永远只是一串对不上的哈希。
//   (2026-08-17 血的教训:上一版基准存于 2026-07-23,只有哈希;12 处漂移无从判断
//    是改进还是回退,只能作废重来。)
//
// ★ 基准哈希是【绑机器的】。同一份 design.html 在 macOS Chrome 与 Linux Chrome 上
//   24 个场景全部渲出不同的哈希(2026-08-17 CI 首跑实测)。所以 check/save/diff
//   这三个模式只在【存基准的那台机器】上说得通,拿去 CI 一定全红。
//   CI 要问的不是「像不像那台笔记本」,而是「这次改动改变渲染了吗」——
//   后者在同一台机器上比两个版本就行,与平台无关。那是 compare / selfcheck。
//
// 用法:bun tools/regress.js <design.html> [check|save|diff]   本机:与存下的基准比
//      bun tools/regress.js <design.html> selfcheck           渲两遍,断言逐帧一致(查不确定性)
//      bun tools/regress.js <design.html> compare --against=<文件|git ref>
//                                                             同机比两个版本(CI 用,不绑平台)
//      文件在前、模式在后 —— 写反会把 check 当路径 → ERR_INVALID_URL,看着像工具坏了
//      save 在 design.html 未提交时会拒绝;确实要存加 --allow-dirty(diff 能力随之降级)
const { chromium } = require('playwright')
const fs = require('fs'), crypto = require('crypto'), path = require('path')
const { execSync } = require('child_process')

const FILE = process.argv[2], MODE = process.argv[3] || 'check'
// 基准路径跟着 design.html 走,不跟着 CWD 走。从前默认写的是相对 CWD 的
// 'rooms/.roomwork/baseline/rooms.json',在子目录里跑就报「无基准」而基准好好的
// —— PLAYBOOK 把这条记作「工具报零先怀疑工具」的实例。CI 里 CWD 是 rooms/,
// 正好会踩上。
const BASE = process.argv.find(a => a.endsWith('.json'))
  || (FILE ? path.join(path.dirname(path.resolve(FILE)), '.roomwork/baseline/rooms.json')
           : 'rooms/.roomwork/baseline/rooms.json')
const ALLOW_DIRTY = process.argv.includes('--allow-dirty')
const DIFFDIR = path.join(path.dirname(BASE), 'diff')
if (!FILE) { console.error('用法: bun tools/regress.js <design.html 绝对路径> [check|save|diff]'); process.exit(2) }

const git = (cmd, fallback = null) => {
  try { return execSync('git ' + cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
  catch { return fallback }
}

// 页内渲染:四场景 × 全房,返回 dataURL。check/save/diff 三个模式共用同一份。
const SHOOT = () => {
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
}

const shoot = async (browser, file) => {
  const p = await browser.newPage()
  await p.goto('file://' + require('path').resolve(file)); await p.waitForTimeout(3500)
  const shots = await p.evaluate(SHOOT)
  await p.close()
  return shots
}

const hashOf = shots => {
  const fp = {}
  for (const room in shots) {
    fp[room] = {}
    for (const k in shots[room])
      fp[room][k] = crypto.createHash('sha256').update(shots[room][k]).digest('hex').slice(0, 16)
  }
  return fp
}

const rooms = obj => Object.keys(obj).filter(k => k[0] !== '_')

// 出「旧 / 新 / 差异」三图。diff 与 compare 共用 —— 两者只是【拿谁当旧的】不同。
const emitDiffs = async (b, pairs) => {
  const p = await b.newPage()
  const results = await p.evaluate(async (items) => {
    const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src })
    const out = []
    for (const [room, scene, aSrc, bSrc] of items) {
      const [ia, ib] = [await load(aSrc), await load(bSrc)]
      const W = Math.max(ia.width, ib.width), H = Math.max(ia.height, ib.height)
      const mk = img => { const c = document.createElement('canvas'); c.width = W; c.height = H
                          c.getContext('2d').drawImage(img, 0, 0); return c }
      const [ca, cb] = [mk(ia), mk(ib)]
      const da = ca.getContext('2d').getImageData(0, 0, W, H).data
      const db = cb.getContext('2d').getImageData(0, 0, W, H).data
      const cd = document.createElement('canvas'); cd.width = W; cd.height = H
      const gd = cd.getContext('2d'); const dd = gd.createImageData(W, H)
      let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
      for (let i = 0, px = 0; i < da.length; i += 4, px++) {
        const same = da[i] === db[i] && da[i+1] === db[i+1] && da[i+2] === db[i+2] && da[i+3] === db[i+3]
        if (same) {   // 未变的压成淡灰底,保留形状好定位(留 50 级灰,太窄了整屋糊成一片白)
          const v = 200 + ((db[i] * 0.3 + db[i+1] * 0.6 + db[i+2] * 0.1) / 255) * 48
          dd.data[i] = dd.data[i+1] = dd.data[i+2] = v; dd.data[i+3] = 255
        } else {      // 变了的涂洋红
          dd.data[i] = 255; dd.data[i+1] = 0; dd.data[i+2] = 170; dd.data[i+3] = 255
          const cx = px % W, cy = (px / W) | 0
          if (cx < x0) x0 = cx; if (cx > x1) x1 = cx
          if (cy < y0) y0 = cy; if (cy > y1) y1 = cy; n++
        }
      }
      gd.putImageData(dd, 0, 0)
      out.push({ room, scene, n, pct: +(n / (W * H) * 100).toFixed(3),
                 box: n ? { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null,
                 diff: cd.toDataURL('image/png') })
    }
    return out
  }, pairs)
  await p.close()

  fs.mkdirSync(DIFFDIR, { recursive: true })
  const write = (name, dataURL) => fs.writeFileSync(path.join(DIFFDIR, name),
    Buffer.from(dataURL.split(',')[1], 'base64'))
  for (const [i, r] of results.entries()) {
    write(`${r.room}-${r.scene}-1旧.png`, pairs[i][2])
    write(`${r.room}-${r.scene}-2新.png`, pairs[i][3])
    write(`${r.room}-${r.scene}-3差异.png`, r.diff)
    const box = r.box ? `  区域 x ${r.box.x0}–${r.box.x1} y ${r.box.y0}–${r.box.y1}(${r.box.w}×${r.box.h})` : ''
    console.log(`  ${(r.room + ' ' + r.scene).padEnd(20)} 变了 ${String(r.n).padStart(8)} px  ${String(r.pct).padStart(6)}%${box}`)
  }
  console.log(`\n三图一组(旧 / 新 / 差异)已写到 ${DIFFDIR}/`)
}


;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })

  // ── selfcheck:同一份文件渲两遍,断言逐帧一致。
  //    这是唯一【不绑平台】的硬门禁:它查的是渲染有没有不确定性 ——
  //    t=0 的画面里混进了真实时间、未播种的随机、遍历顺序不稳的容器,
  //    都会在这里现形,而在单次渲染里完全看不出来。
  if (MODE === 'selfcheck') {
    const [a1, a2] = [hashOf(await shoot(b, FILE)), hashOf(await shoot(b, FILE))]
    let bad = 0
    for (const room of rooms(a1)) for (const k in a1[room]) {
      const same = a1[room][k] === a2[room][k]
      if (!same) { bad++; console.log(`  ✗ ${(room + ' ' + k).padEnd(20)} 两遍不一样 ${a1[room][k]} / ${a2[room][k]}`) }
    }
    const n = rooms(a1).reduce((t, r) => t + Object.keys(a1[r]).length, 0)
    console.log(bad ? `✗ ${bad}/${n} 个场景渲两遍结果不同 —— 渲染有不确定性`
                    : `✓ ${n} 个场景渲两遍逐帧一致(${rooms(a1).length} 间房)`)
    await b.close(); process.exit(bad ? 1 : 0)
  }

  // ── compare:同机渲两个版本并比对。不读基准,所以跨平台成立。
  if (MODE === 'compare') {
    const arg = process.argv.find(a => a.startsWith('--against='))
    if (!arg) { console.log('✗ compare 要 --against=<文件|git ref>'); await b.close(); process.exit(2) }
    const against = arg.slice(10)
    const reportOnly = process.argv.includes('--report-only')
    let other = against
    if (!fs.existsSync(other)) {          // 不是文件就当 git ref
      const rel = path.relative(git('rev-parse --show-toplevel', process.cwd()), path.resolve(FILE))
      // 「这个 ref 不存在」和「这个 ref 上没有这个文件」是两回事,不能混成一句错。
      // 前者是参数敲错了,该红;后者是文件在这条分支上还是新增的(或刚改过名),
      // 没有旧版本可比是事实,不是缺陷 —— 报清楚然后放行。
      if (git(`rev-parse --verify --quiet ${against}^{commit}`) === null) {
        console.log(`✗ ref 不存在:${against}`); await b.close(); process.exit(1)
      }
      if (git(`cat-file -e ${against}:${rel} 2>/dev/null && echo ok`) === null) {
        console.log(`· ${against} 上没有 ${rel} —— 这个文件在那时还不存在(新增或改名),无从比对`)
        console.log(`  等它落到目标分支之后,后续的 PR 才比得了`)
        await b.close(); process.exit(0)
      }
      other = path.join(require('os').tmpdir(), `regress-against-${against.replace(/[^\w.-]/g, '_')}.html`)
      try { fs.writeFileSync(other, execSync(`git show ${against}:${rel}`, { encoding: 'utf8', maxBuffer: 1 << 28 })) }
      catch (e) { console.log(`✗ 取不到 ${against}:${rel} —— ${e.message.split('\n')[0]}`); await b.close(); process.exit(1) }
    }
    console.log(`同机比对:${against}  vs  当前`)
    const [oldShots, newShots] = [await shoot(b, other), await shoot(b, FILE)]
    const [oldFp, newFp] = [hashOf(oldShots), hashOf(newShots)]
    const pairs = []
    for (const room of rooms(newFp)) for (const k in newFp[room])
      if (!oldFp[room]) { console.log(`  + ${room} 是新房间`) }
      else if (oldFp[room][k] !== newFp[room][k]) pairs.push([room, k, oldShots[room][k], newShots[room][k]])
    for (const room of rooms(oldFp)) if (!newFp[room]) console.log(`  ! ${room} 没有了`)

    if (!pairs.length) {
      const n = rooms(newFp).reduce((t, r) => t + Object.keys(newFp[r]).length, 0)
      console.log(`✓ ${n} 个场景渲染完全相同 —— 这次改动不影响画面`)
      await b.close(); process.exit(0)
    }
    await emitDiffs(b, pairs)
    console.log(`\n${pairs.length} 个场景的画面变了。改动是有意的就没问题,` +
                `三图已写到 ${DIFFDIR}/ 供人判断。`)
    await b.close(); process.exit(reportOnly ? 0 : 1)
  }

  // ── diff:把基准那次的 design.html 从 git 取出来重渲,逐张出「旧 / 新 / 差异」三图
  if (MODE === 'diff') {
    if (!fs.existsSync(BASE)) { console.log('无基准,先跑 save'); await b.close(); process.exit(1) }
    const old = JSON.parse(fs.readFileSync(BASE, 'utf8'))
    const meta = old._meta
    if (!meta || !meta.gitRev) {
      console.log('✗ 这份基准没记 commit,旧像素无法重建 —— 只能作废重存(见本文件顶部注释)')
      await b.close(); process.exit(1)
    }
    if (meta.dirty) console.log('⚠ 存基准时 design.html 未提交,重建的是当时【最后一次提交】的样子,可能对不上')

    const rel = path.relative(git('rev-parse --show-toplevel', process.cwd()), path.resolve(FILE))
    const tmp = path.join(require('os').tmpdir(), `regress-base-${meta.gitRev.slice(0, 8)}.html`)
    try { fs.writeFileSync(tmp, execSync(`git show ${meta.gitRev}:${rel}`, { encoding: 'utf8', maxBuffer: 1 << 28 })) }
    catch (e) { console.log(`✗ 取不到 ${meta.gitRev}:${rel} —— ${e.message.split('\n')[0]}`); await b.close(); process.exit(1) }

    console.log(`基准 commit ${meta.gitRev.slice(0, 8)}(${meta.savedAt})  重渲中……`)
    const [oldShots, newShots] = [await shoot(b, tmp), await shoot(b, FILE)]
    const newFp = hashOf(newShots)

    const pairs = []
    for (const room of rooms(newFp))
      for (const k in newFp[room])
        if (old[room] && old[room][k] !== newFp[room][k] && oldShots[room] && oldShots[room][k])
          pairs.push([room, k, oldShots[room][k], newShots[room][k]])

    if (!pairs.length) { console.log('✓ 与基准一致,没有可 diff 的场景'); await b.close(); process.exit(0) }

    await emitDiffs(b, pairs)
    await b.close(); process.exit(0)
  }

  // ── save / check
  const shots = await shoot(b, FILE)
  const fp = hashOf(shots)
  if (!rooms(fp).length) { console.log('✗ 没发现任何房间'); await b.close(); process.exit(1) }

  if (MODE === 'save') {
    const dirty = !!git(`status --porcelain -- "${FILE}"`, '')
    if (dirty && !ALLOW_DIRTY) {
      console.log('✗ design.html 有未提交改动 —— 拒绝存基准。')
      console.log('  基准要能反查,必须对应一个 commit;否则以后漂移了旧像素无处可取。')
      console.log('  先提交 design.html,再跑 save;确实要存不可反查的基准就加 --allow-dirty')
      await b.close(); process.exit(2)
    }
    const meta = {
      savedAt: new Date().toISOString().slice(0, 10),
      gitRev: git('rev-parse HEAD'),
      dirty,
      note: 'diff 模式靠 gitRev 取回当时的 design.html 重渲旧图;这两个字段没了基准就只是一串哈希',
    }
    fs.mkdirSync(path.dirname(BASE), { recursive: true })
    fs.writeFileSync(BASE, JSON.stringify({ _meta: meta, ...fp }, null, 2))
    console.log(`✓ 基准已保存 ${rooms(fp).length} 间房 @ ${(meta.gitRev || '?').slice(0, 8)}${dirty ? ' (dirty)' : ''}:`)
    for (const room of rooms(fp))
      console.log('  ' + room + '  ' + Object.entries(fp[room]).map(([k, v]) => k + ' ' + v).join('  '))
  } else {
    if (!fs.existsSync(BASE)) { console.log('无基准,先跑 save'); await b.close(); process.exit(1) }
    const old = JSON.parse(fs.readFileSync(BASE, 'utf8'))
    let bad = 0, newRoom = 0
    for (const room of rooms(fp)) {
      if (!old[room]) { console.log('  + ' + room + ' 新房间,无基准(跑 save 收录)'); newRoom++; continue }
      for (const k in fp[room]) {
        const same = old[room][k] === fp[room][k]
        if (!same) bad++
        console.log((same ? '  ✓ ' : '  ✗ ') + (room + ' ' + k).padEnd(20) + (same ? fp[room][k] : old[room][k] + ' → ' + fp[room][k]))
      }
    }
    for (const room of rooms(old)) if (!fp[room]) { console.log('  ! ' + room + ' 基准里有、页面上没有了'); bad++ }
    if (bad) {
      console.log(`✗ ${bad} 处与基准不符`)
      console.log(old._meta && old._meta.gitRev
        ? '  跑 `bun tools/regress.js <design.html> diff` 出「旧 / 新 / 差异」三图,再判是改进还是回退'
        : '  ⚠ 这份基准没记 commit,旧像素无从重建 —— 只能凭当前渲染自身对错判断')
      process.exit(1)
    }
    console.log(`✓ 视觉回归全部通过(${rooms(fp).length} 间房)${newRoom ? ' · ' + newRoom + ' 间待收录' : ''}`)
  }
  await b.close()
})()
