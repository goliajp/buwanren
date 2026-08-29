/**
 * 村子与不完人 · 对应后端 /v1/village、/v1/villagers、/v1/omamori/*
 *
 * 字段照 `backend/unmei-api/src/routes/village.rs` 的 json! 逐个抄下来,
 * 不多不少。多写的字段在真机上永远是 undefined,而少写的会被静默忽略 ——
 * 两种都要到线上才发现。
 */

/** 一位不完人在【我的村子】里的样子 */
export interface VillagerInVillage {
  id: string
  name: string
  title: string | null
  /** 他修的那门术数 */
  art: string | null
  /** 他缺的那样东西 —— 三层解读的偏向层就是它决定的 */
  lack: string
  rarity: string | null
  /** 请回家了没。**空屋不消失是世界观**,所以没请回来的也在这张表里 */
  at_home: boolean
  /** 他卖着什么（设计册 10.8：东西长在卖它的人身上）。没有就是 null。
   *  **不含御守** —— 那不是「他卖的」，是「里面封着他」，而且它有自己的入口。 */
  sells: { product_id: string; name: string } | null
}

export interface MyVillage {
  /** 请回家的人数 */
  found: number
  /** 设定里的总数 */
  total: number
  villagers: VillagerInVillage[]
  /** 手上有一枚已签收、还没扫开的御守时给出那一单；没有就是 null。
   *  设计册 E2「该扫了」。**不带是谁** —— 还没请回来的人，名字都不该知道。 */
  to_scan: { order_id: string; delivered_at: string } | null
  /** 某位今天说的一句（设计册 V1）。**只从住着的人里选** ——
   *  村里没人、或住着的人都还没写话时是 null，那一块整个不摆。
   *  同一个人同一天看到的是同一句：随机的话刷新一次换一句，
   *  那就不是「今天说的」，是一台老虎机。 */
  today_says: {
    villager_id: string
    /** 头像底色按它分 —— 见 VillagerCard.direction */
    direction: string | null
    name: string
    title: string | null
    art: string | null
    text: string
  } | null
}

/** 图鉴里的样子 —— 不带住没住,未登录也能看 */
export interface VillagerCard {
  id: string
  name: string
  title: string | null
  art: string | null
  rarity: string | null
  /** 他的御守在不在卖。在 → 那件商品的 id；不在 → null，页面写「未上架」。
   *  设计册 10.8：「没上架的也列出来 …… 照实说，不拿别人顶上」。 */
  omamori_product_id: string | null
  /** 他缺什么。名册上写出来 —— 「缺 X 的人反过来劝你 Y」是这套推荐的依据 */
  lack?: string
  /** 他往哪个方向劝你（move / still / wait / keep / let_go / near / ask）。
   *  头像的底色按它分 —— 四十位共用一个颜色时一眼分不出谁是谁，
   *  而这个字段本来就带语义:同一路人同一个色 */
  direction?: string | null
  /** 为什么这一位排在前面。**没按用神排过就是 null** ——
   *  客户端据此决定说不说那句「跟你补得上」，而不是不管怎样都说一遍。 */
  why?: string | null
}

/** 一签 */
export interface Reading {
  villager_id: string
  villager_name: string
  art: string | null
  lack: string
  /** 偏向层给出的结论 */
  verdict: string
  suit: string[]
  avoid: string[]
  /** 声音层说出来的整句 —— 界面上直接显示这一句 */
  say: string
}

/** 扫御守 */
export interface ScanReq extends Record<string, unknown> {
  /** nfc / qr / chain / manual */
  carrier: string
  /** NFC UID、QR 序列号…… 载体不同这里不同,身份记录是同一条 */
  credential: string
}

/** 扫完御守 */
export interface ScanResult {
  villager_id: string
  villager_name: string | null
  /** 重复扫不是错误,但界面要说得不一样:
      第一次是「他住进来了」,第二次是「他早就在了」 */
  moved_in: boolean
}
