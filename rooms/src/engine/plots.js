/* 宅基表 —— 40 位不完人各自住在村子的哪一格。
 *
 * 2026-08-25 重排：**八排梯田 × 五格**，全部照这张表画。
 *
 * 为什么重排：原来的村子是一幅 704 × 1920 的手绘连续村落，而屏幕只给得起
 * 518pt 的画布高 —— 于是下面那 20 栋（一半的村民）掉在折线以下，
 * 靠页面滚动才够得到，而「不滚动」是这一屏自己的约束。
 * 一半的村子看不见、也点不到。来龙去脉见 docs/REDESIGN.md「R1 定了」。
 *
 * ── 几何 ───────────────────────────────────────────────────────
 *   世界 704 × 960 · 屏上 375 × 511（缩放 0.5327）
 *   八排：地面线 108 + 120r     → 屏上一排 64pt（触点下限 44）
 *   五列：中心 78 + 137c        → 屏上一格 73pt
 *   奇数排右移 22px —— 梯田的错落
 *
 * ── 八排住谁：按语义梯度排，不是随手摆 ──────────────────────────
 * 老村那十条「一眼就该住那儿的」理由里藏着整个村子的地理：北边是山与林
 * （隐者、武僧靠山），中段是村心（婆婆挨着广场、苏合的铺子），南边是河
 * （老渔夫紧挨水），过了河是外人（陈九离村口远），西头清冷。
 * 重排保的就是这条北→南的坡度 —— 不是重新发明。
 *
 * ── 一格是什么 ────────────────────────────────────────────────
 *   id           后端的 villager.id（与 backend/seed/villagers.sql 同一套）
 *   row, col     第几排第几格 —— 坐标由它们算，不手写
 *   w            房子宽
 *   kind         bld = building / bldL = buildingL / dome = houseDome
 *                tower = towerRound / shop = shopHouse / barn = barn
 *                **加新 kind 要同时改 village.js 的 drawHouse** ——
 *                那条 if/else 末尾的 else 会把不认识的 kind 默默画成平房，
 *                scripts/check-plots.py 就是守这个的
 *   roof         dome / tower 的顶色 [亮, 暗]
 *   seed         bld 的随机种子 —— 同一个种子每次画出同一栋
 *   note         为什么是这一格。写下来是因为「谁住哪儿」是审美判断
 *   x, gy        由 row/col/w 算出来的左边与【地面线】—— 不手写
 *
 * 各画法函数第二个参数含义不一样（houseDome 给墙顶、towerRound 第三参是
 * 半径、barn 给屋顶），换算在 village.js 的 drawHouse 里一处完成。
 */
;(function () {
  const ROW_GY = [108, 228, 348, 468, 588, 708, 828, 948]   // 八排的地面线
  const COL_CX = [78, 215, 352, 489, 626]                   // 五列的中心
  const STAGGER = 22                                        // 奇数排右移

  /* 坐标由 row/col 算，不手写 —— 手写的话，改一次排距要改四十行，
     而改漏一行不会报错，只会让某个人的门牌歪在邻居家墙上。 */
  function place(p) {
    const cx = COL_CX[p.col] + (p.row % 2 ? STAGGER : -STAGGER)
    return Object.assign({}, p, { x: Math.round(cx - p.w / 2), gy: ROW_GY[p.row] })
  }

  const TABLE = [
    // 第一排 —— 林边 · 山脚
    { id: 'xuanming', row: 0, col: 0, w: 88, kind: 'dome', roof: ['#e8a030', '#c07820'], note: '隐者 —— 林子边上那间橙圆顶，再往北就没人了' },
    { id: 'tenz', row: 0, col: 1, w: 80, kind: 'tower', roof: ['#5a9a8a', '#3e7a6a'], note: '雪山寺下山的武僧 —— 靠着山那座塔' },
    { id: 'bailu', row: 0, col: 2, w: 76, kind: 'tower', roof: ['#8a7ab0', '#6a5a90'], note: '观里的女冠 —— 紫白小塔，像一座观' },
    { id: 'leiming', row: 0, col: 3, w: 84, kind: 'bld', seed: 150116, note: '阅读顺序 —— 北头' },
    { id: 'laogui', row: 0, col: 4, w: 88, kind: 'bldL', seed: 556152, note: '阅读顺序 —— 北头，L 形地基' },
    // 第二排 —— 北坡 · 清冷
    { id: 'ayun', row: 1, col: 0, w: 76, kind: 'bld', seed: 20302, note: '小道士 —— 西头一间寻常屋，离热闹远一点好睡' },
    { id: 'shenyan', row: 1, col: 1, w: 80, kind: 'bld', seed: 16476, note: '落第书生 —— 挨着阿云，一样清冷' },
    { id: 'yanniang', row: 1, col: 2, w: 78, kind: 'bld', seed: 252152, note: '阅读顺序' },
    { id: 'muyi', row: 1, col: 3, w: 76, kind: 'bld', seed: 600262, note: '阅读顺序' },
    { id: 'aluo', row: 1, col: 4, w: 88, kind: 'bld', seed: 600316, note: '阅读顺序' },
    // 第三排 —— 入村
    { id: 'tao', row: 2, col: 0, w: 104, kind: 'dome', roof: ['#e88aa0', '#c86a80'], note: '桃花岛弟子 —— 粉圆顶，村里最招摇的一间' },
    { id: 'aying', row: 2, col: 1, w: 80, kind: 'bld', seed: 606448, note: '阅读顺序' },
    { id: 'weila', row: 2, col: 2, w: 92, kind: 'bld', seed: 470604, note: '阅读顺序' },
    { id: 'rune', row: 2, col: 3, w: 80, kind: 'bld', seed: 608560, note: '阅读顺序' },
    { id: 'mago', row: 2, col: 4, w: 84, kind: 'bld', seed: 36856, note: '阅读顺序' },
    // 第四排 —— 村心 · 广场
    { id: 'popo', row: 3, col: 0, w: 76, kind: 'dome', roof: ['#c8a060', '#a07840'], note: '占卜的老太太 —— 圆顶小屋，挨着广场，谁都路过' },
    { id: 'suhe', row: 3, col: 1, w: 92, kind: 'shop', note: '香药娘子 —— 绿门面那间铺子，开在村心' },
    { id: 'orlando', row: 3, col: 2, w: 72, kind: 'dome', roof: ['#6a8cb0', '#4c6a8c'], note: '村心一户' },
    { id: 'mira', row: 3, col: 3, w: 76, kind: 'dome', roof: ['#e88aa0', '#c86a80'], note: '村心一户' },
    { id: 'kdata', row: 3, col: 4, w: 76, kind: 'dome', roof: ['#8a6aaa', '#6a4a8a'], note: '村心一户' },
    // 第五排
    { id: 'yisha', row: 4, col: 0, w: 80, kind: 'bld', seed: 24150, note: '寻常人家' },
    { id: 'lilith', row: 4, col: 1, w: 76, kind: 'bld', seed: 20849, note: '寻常人家' },
    { id: 'thomas', row: 4, col: 2, w: 72, kind: 'bld', seed: 37150, note: '寻常人家' },
    { id: 'kama', row: 4, col: 3, w: 72, kind: 'bld', seed: 55650, note: '寻常人家' },
    { id: 'aman', row: 4, col: 4, w: 68, kind: 'bld', seed: 63250, note: '寻常人家' },
    // 第六排
    { id: 'engo', row: 5, col: 0, w: 72, kind: 'bld', seed: 40166, note: '寻常人家' },
    { id: 'rama', row: 5, col: 1, w: 76, kind: 'dome', roof: ['#5a9a8a', '#3e7a6a'], note: '寻常人家' },
    { id: 'xueyao', row: 5, col: 2, w: 72, kind: 'bld', seed: 22466, note: '寻常人家' },
    { id: 'chizuru', row: 5, col: 3, w: 76, kind: 'bld', seed: 38866, note: '寻常人家' },
    { id: 'set', row: 5, col: 4, w: 72, kind: 'bld', seed: 48066, note: '寻常人家' },
    // 第七排 —— 河这岸
    { id: 'jiangya', row: 6, col: 0, w: 76, kind: 'bld', seed: 301110, note: '老渔夫 —— 紧挨水那间，门口就是渔具' },
    { id: 'sesir', row: 6, col: 1, w: 108, kind: 'barn', note: '大谷仓 —— 河这岸，收的是两岸的粮' },
    { id: 'xiaoman', row: 6, col: 2, w: 72, kind: 'bld', seed: 63266, note: '河这岸' },
    { id: 'laoxu', row: 6, col: 3, w: 72, kind: 'bld', seed: 60182, note: '河这岸' },
    { id: 'cyber', row: 6, col: 4, w: 76, kind: 'bld', seed: 15282, note: '河这岸' },
    // 第八排 —— 河那岸
    { id: 'chenjiu', row: 7, col: 0, w: 76, kind: 'bld', seed: 614112, note: '牌桌上的算手 —— 过了河那边，离村口远' },
    { id: 'ami', row: 7, col: 1, w: 76, kind: 'dome', roof: ['#e8a030', '#c07820'], note: '河那岸' },
    { id: 'barista', row: 7, col: 2, w: 80, kind: 'bld', seed: 40082, note: '河那岸' },
    { id: 'courier', row: 7, col: 3, w: 72, kind: 'bld', seed: 49282, note: '河那岸' },
    { id: 'anonymous', row: 7, col: 4, w: 76, kind: 'dome', roof: ['#9a938a', '#6e6862'], note: '河那岸 —— 最南，谁也不知道他是谁' },
  ]

  const PLOTS = TABLE.map(place)
  globalThis.VILLAGE_PLOTS = PLOTS
  globalThis.VILLAGE_DISTRICT = PLOTS          // 现在只有一张表：全部照表画
  globalThis.VILLAGE_UNSITED = []
})()
