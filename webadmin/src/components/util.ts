/** 格式化:相对时间(< 1d 秒/分/时,否则 yyyy-mm-dd hh:mm)*/
export function rel(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  /* 【中文界面里不写 `3h ago`】。整台控制台每一张表的时间列
     都从这里出，一处不说中文就处处不说中文。
     未来时间也要成话:下次扣费在「3 天后」，不是「-3d ago」。 */
  const 秒 = (Date.now() - d.getTime()) / 1000;
  const 过去 = 秒 >= 0;
  const 绝 = Math.abs(秒);
  const 说 = (n: number, 单位: string) =>
    过去 ? `${n} ${单位}前` : `${n} ${单位}后`;
  if (绝 < 60)         return 过去 ? '刚刚' : '就快了';
  if (绝 < 3600)       return 说(Math.floor(绝 / 60), '分钟');
  if (绝 < 86400)      return 说(Math.floor(绝 / 3600), '小时');
  if (绝 < 86400 * 7)  return 说(Math.floor(绝 / 86400), '天');
  // 一周开外就报日期 —— 「37 天前」没有 04-15 有用
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 绝对时间:yyyy-MM-dd HH:mm:ss */
export function ts(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 分 → ¥ (default CNY, decimals=2);可传 currency 切换符号 */
export function yuan(cents: number | null | undefined, currency = 'CNY'): string {
  if (cents == null) return '—';
  const sym: Record<string, string> = {
    CNY: '¥', USD: '$', HKD: 'HK$', JPY: '¥', EUR: '€', GBP: '£', SGD: 'S$', TWD: 'NT$',
  };
  const d = (currency === 'JPY' || currency === 'TWD') ? 0 : 2;
  const pow = Math.pow(10, d);
  const v = cents / pow;
  return (sym[currency] || currency + ' ') + v.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** 千分位 */
export function thou(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US');
}

/** ID 缩写 */
export function shortId(id?: string | null, head = 6, tail = 4): string {
  if (!id) return '—';
  if (id.length <= head + tail + 1) return id;
  /* 【tail 为 0 时不能用 slice(-0)】——它返回的是【整串】，
     于是「只要前十个字符」得到的是「前十个字符 + 整串」。
     2026-09-03 在订单列上真渲出来过一次（Python 与 JS 同一个坑）。 */
  const 尾 = tail > 0 ? id.slice(-tail) : '';
  return `${id.slice(0, head)}…${尾}`;
}

/** 单号 / 用户号在列表里的样子:剥掉前缀，只留能认出这一条的那几位。
 *
 * 前缀（`ord-` / `u_anon_` / `pay-`）每一行都一样，占着最左边最贵的位置
 * 却不提供任何区分度 —— 而剥掉之后剩下的八位十六进制，
 * 在一页五十条里认一条绰绰有余。要全的点进去看。 */
export function briefId(id?: string | null, keep = 8): string {
  if (!id) return '—';
  const 去前缀 = id.replace(/^(ord|pay|rfd|shp|res|rpt|je|inv|sub|prd|sku|u_anon|u)[-_]/, '');
  return 去前缀.length <= keep ? 去前缀 : 去前缀.slice(0, keep);
}

/** 平台 → 说得出口的名字。原先是 `mini` / `wx_mp` 这种工程代号直接上屏 */
export function platformLabel(p: string): string {
  return {
    mini: '小程序', wx_mp: '小程序', wx_h5: '微信 H5',
    ios: 'iOS', android: '安卓', web: '网页', admin: '后台录入',
  }[p] ?? p;
}

/* ── 状态 ────────────────────────────────────────────────────────
   【三档，不是四档;一个点加一个词，不是药丸】。
   上一版给每一种状态都刷了底色 —— 于是【所有】状态都在喊，
   而这台控制台的活儿正是让要处理的那一个跳出来。

   现在:
     debt    要你今天做点什么 —— 全台唯一带底色的一档
     pending 在路上，等着就行
     settled 结了
     mute    收尾了、作废了、跟你没关系了
   颜色只在 debt 那一档，其余靠一个小圆点区分。 */
type 档 = 'debt' | 'pending' | 'settled' | 'mute';

const 状态档: Record<string, 档> = {
  // 要你做点什么
  unpaid: 'debt', requested: 'debt', exception: 'debt', disputed: 'debt',
  failed: 'debt', has_discrepancy: 'debt', missing_in_channel: 'debt',
  missing_in_internal: 'debt', amount_mismatch: 'debt', status_mismatch: 'debt',
  past_due: 'debt', investigating: 'debt', returning: 'debt',

  // 在路上
  pending: 'pending', draft: 'pending', processing: 'pending', cancelling: 'pending',
  refunding: 'pending', refund_partial: 'pending', refunded_partial: 'pending',
  fulfilling: 'pending', scheduled: 'pending', trialing: 'pending',
  preparing: 'pending', picked_up: 'pending', in_transit: 'pending',
  out_for_delivery: 'pending', grace: 'pending', pulled: 'pending', parsed: 'pending',
  approved: 'pending',

  // 结了
  paid: 'settled', shipped: 'settled', done: 'settled', success: 'settled',
  open: 'settled', published: 'settled', listed: 'settled', on_sale: 'settled',
  active: 'settled', delivered: 'settled', matched: 'settled', posted: 'settled',
  resolved: 'settled', registered: 'settled', checked_in: 'settled', refunded: 'settled',
};

const 状态名: Record<string, string> = {
  draft: '草稿', unpaid: '没付', paid: '已付', fulfilling: '正在办', done: '完成',
  cancelled: '取消', refund_partial: '退了一部分', refunded_partial: '退了一部分',
  refunded: '已退', disputed: '有争议',
  pending: '等着', processing: '处理中', success: '成功', failed: '失败',
  expired: '过期', cancelling: '正在取消', refunding: '退款中',
  requested: '等着批', approved: '已批准',
  preparing: '在打包', picked_up: '已揽收', in_transit: '在路上',
  out_for_delivery: '派送中', delivered: '已签收', returning: '正在退回',
  returned: '已退回', exception: '出了状况',
  matched: '对上了', has_discrepancy: '对不上', missing_in_channel: '渠道没有',
  missing_in_internal: '我们这儿没有', amount_mismatch: '金额对不上',
  status_mismatch: '状态对不上',
  posted: '已入账', reversed: '已冲销', void: '作废',
  open: '在办', investigating: '在查', resolved: '结了', false_positive: '误报',
  active: '在用', trialing: '试用中', past_due: '欠费', grace: '宽限期',
  paused: '暂停', ended: '结束', inactive: '停用',
  listed: '在架', on_sale: '在卖', off_sale: '下架', delisted: '下架',
  archived: '归档', discontinued: '不做了', sold_out: '卖光了', exhausted: '用完了',
  published: '已发布', retired: '退役', revoked: '收回', issued: '已发',
  locked: '锁定', redeemed: '已用', uncollectible: '收不回来', closed: '关闭',
  scheduled: '排上了', pulled: '已拉取', parsed: '已解析',
  registered: '已登记', checked_in: '已入住',
};

/** 状态 → class。用法:`<span className={statusClass(s)}>{statusLabel(s)}</span>` */
export function statusClass(s: string): string {
  return 'st st-' + (状态档[s] ?? 'mute');
}

/** 状态 → 中文。没收录的原样显示 —— 不编一个好听的名字出来 */
export function statusLabel(s: string): string {
  return 状态名[s] ?? s;
}


/** 渠道展示名 */
export function channelLabel(ch: string): string {
  return {
    wechat_jsapi:  '微信 JSAPI',
    wechat_mp:     '微信小程序',
    wechat_h5:     '微信 H5',
    wechat_native: '微信扫码',
    alipay_wap:    '支付宝 H5',
    alipay_pc:     '支付宝 PC',
    alipay_mini:   '支付宝小程序',
    iap:           'Apple IAP',
    gpb:           'Google Play',
    stripe_card:   'Stripe 卡',
  }[ch] ?? ch;
}

/** carrier code → 中文 */
export function carrierLabel(c: string): string {
  return { sf:'顺丰', jd:'京东', zto:'中通', yto:'圆通', yunda:'韵达',
           sto:'申通', ems:'EMS', usps:'USPS', dhl:'DHL', fedex:'FedEx',
           ups:'UPS', manual:'人工录入' }[c] ?? c;
}

/* 各处的枚举值 → 中文。
 *
 * 【为什么单独一张表】——这些值原本直接上屏:`pre_pay`、`one_shot`、
 * `end_of_period`。对着屏幕的人不知道 `sens` 是什么，也不该为了看懂
 * 一张表先去读一遍建表语句。收录不到的【原样显示】，不编一个好听的
 * 名字出来 —— 编出来的名字比英文原值更难查。
 */
const 枚举名: Record<string, string> = {
  // 风控:规则在哪一步生效 / 命中之后做什么
  pre_pay: '付款前', post_pay: '付款后', login: '登录时',
  refund: '退款',
  review: '转人工', block: '拦下', challenge: '要验证', allow: '放行',
  // 【`refund` 一个键两个意思】。风控规则里它是「在退款这一步」，
  // 而记账的业务类型里它就是「退款」。上一版共用一张表，
  // 于是财务页的业务栏写着「退款时」。按语境分开。
  //
  // 【`sale` 也是记账的业务类型】（2026-09-04 · 25 计划的后台逐页走）。
  // 库里只有这两种（sale 11,391 条、refund 1,165 条），
  // 而只有 refund 收录了 —— 于是财务页那一列里
  // 「sale」跟「退款」并排站着，一半英文一半中文。
  // 这个产品对这件事的说法是「收款」：订单详情写「收款」,
  // 看板的分录描述写「订单 … 收款」，跟着它。
  sale: '收款',
  // 商品:卖的是什么 / 怎么交付
  one_shot: '单次', subscription: '订阅', bundle: '套装',
  instant: '即时', shipping: '寄实物', residency: '入住',
  report: '报告', charm: '符', omamori: '御守', divination: '问签',
  // 订阅
  end_of_period: '本期结束时', immediate: '立刻',
  month: '按月', year: '按年', week: '按周',
  // 会计科目
  asset: '资产', liability: '负债', revenue: '收入',
  expense: '费用', equity: '权益',
  // 对账里的方向
  debit: '借', credit: '贷',
  // 对账批次从哪儿来
  channel_pulled: '渠道拉的', manual_upload: '手工传的', system_generated: '系统生成',
  // 事件分发
  dispatched: '已发出', dropped: '已丢弃',
  // 促销怎么优惠
  pct_off: '按比例减', amount_off: '直接减钱', free_gift: '送东西',
  bundle_price: '打包价', first_order: '首单优惠',
  // 快递服务档
  standard: '标准', express: '加急', economy: '经济',
  same_day: '当日达', next_day: '次日达',
};

/** 枚举值 → 中文。没收录的原样显示 */
export function enumLabel(v?: string | null): string {
  if (!v) return '—';
  return 枚举名[v] ?? v;
}

/** 管理员角色 → 中文。左栏底下那一行原本显示的是 `super、operator、content` */
export function roleLabel(r: string): string {
  return { super: '超管', operator: '运营', content: '内容',
           support: '客服', finance: '财务', risk: '风控',
           readonly: '只读' }[r] ?? r;
}

/** 风控规则在哪一步生效。`refund` 在这里是「退款这一步」，不是「退款」 */
export function riskStageLabel(v?: string | null): string {
  if (!v) return '—';
  return { pre_pay: '付款前', post_pay: '付款后', login: '登录时',
           refund: '退款时' }[v] ?? v;
}
