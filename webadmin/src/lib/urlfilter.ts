/**
 * 从网址上把筛选条件读进来。
 *
 * 【看板上每一条待办都带着筛选参数，而没有一页读得懂它们】
 * （2026-09-03 五路评审 · 后台产品体验）。
 *
 * 看板写的是 `/orders?status=unpaid`、`/shipments?exception_only=true`、
 * `/subscriptions?status=active`、`/promotions?status=active`，
 * 用户页整行点开写的是 `/orders?keyword=<用户号>` ——
 * 而整个 `webadmin/src` 里【没有一处】读 `location.search`
 * （唯一用到 URLSearchParams 的地方是 api.ts，那是往外发请求用的）。
 *
 * 于是「12 笔订单还没付 · 看看是卡在哪一步」点下去，落到的是全部订单；
 * 用户页那一行的注释写着「整行点开就跳到他的订单」，
 * 而它跳到的是所有人的订单。两处都是【承诺了一件没发生的事】——
 * 界面看着通了，路是断的。
 *
 * 值按字面读进来，只把 `true` / `false` 还原成布尔 ——
 * 页面的筛选状态是 `Record<string, any>`，数字那几项（page / size）
 * 由页面自己给默认值，不从网址上认。
 */
export function 从网址读筛选<T extends Record<string, unknown>>(默认: T): T {
  const out: Record<string, unknown> = { ...默认 };
  const p = new URLSearchParams(window.location.search);
  for (const [k, v] of p) {
    out[k] = v === 'true' ? true : v === 'false' ? false : v;
  }
  return out as T;
}
