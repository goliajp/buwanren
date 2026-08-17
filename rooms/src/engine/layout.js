  /* ══════════════════════════════════════════════════════════════
     布局辅助 —— 手写坐标易错,提供吸附与量测(设计期工具,不参与渲染)
     ══════════════════════════════════════════════════════════════ */
  window.layout = {
    // 贴墙:把素材放到墙根,x 给定,y 自动对齐到墙底
    againstWall(id, x, room) {
      const a = A[id], hw = (room && room.wallH) || 450
      return [id, x, hw - (a.base - a.h) - a.h + (a.h - a.base)]
    },
    // 靠齐:把 b 放到 a 的右侧 / 下方,留 gap
    rightOf(planEntry, id, gap) {
      const pa = A[planEntry[0]], a = A[id]
      return [id, planEntry[1] + pa.w + (gap == null ? 24 : gap), planEntry[2] + pa.base - a.base]
    },
    below(planEntry, id, gap) {
      const pa = A[planEntry[0]]
      return [id, planEntry[1], planEntry[2] + pa.base + (gap == null ? 24 : gap)]
    },
    // 量测:两件之间的最小通道宽度(px),供人工判断能否通行
    clearance(e1, e2) {
      const a = A[e1[0]], b = A[e2[0]]
      const A1 = [e1[1] + a.foot[0], e1[2] + a.foot[1], a.foot[2], a.foot[3]]
      const B1 = [e2[1] + b.foot[0], e2[2] + b.foot[1], b.foot[2], b.foot[3]]
      const gx = Math.max(A1[0] - (B1[0] + B1[2]), B1[0] - (A1[0] + A1[2]))
      const gy = Math.max(A1[1] - (B1[1] + B1[3]), B1[1] - (A1[1] + A1[3]))
      return Math.max(gx, gy)
    },
    // 全房通道体检:列出小于 minGap 的相邻家具对
    // 只体检【会挡路的大件】之间的通道:小道具与成组物件(烛剪在灯台下、
    // 屏风三扇相连)本就紧邻,报出来只是噪音。附着物同样豁免。
    tightSpots(room, minGap, minArea) {
      minGap = minGap || 80; minArea = minArea || 20000
      const out = [], p = room.plan.filter(e => {
        const a = A[e[0]]
        if (!a || a.wall || a.cat === '地面') return false
        if (e[3] && e[3].attach) return false
        return a.foot[2] * a.foot[3] >= minArea
      })
      for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
        const d = window.layout.clearance(p[i], p[j])
        if (d >= 0 && d < minGap) out.push({ a: p[i][0], b: p[j][0], gap: Math.round(d) })
      }
      return out.sort((x, y) => x.gap - y.gap)
    },
  }

  /* ══ 房间布局校验:数据也要过门禁,不能只靠肉眼看渲染 ══ */


  /* ══ 实例化:资源 → 可绘制实例(自带 sprite / baseY / footprint)══ */
  const SPRITE_CACHE = {}

