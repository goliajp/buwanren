/** 格式化:相对时间(< 1d 秒/分/时,否则 yyyy-mm-dd hh:mm)*/
export function rel(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (Math.abs(diff) < 60)      return `${Math.floor(diff)}s ago`;
  if (Math.abs(diff) < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (Math.abs(diff) < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (Math.abs(diff) < 86400*7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toISOString().slice(0, 16).replace('T', ' ');
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
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

/** 平台 chip 配色 */
export function platformChip(p: string): string {
  return {
    mini:    'chip chip-info',
    ios:     'chip chip-info',
    android: 'chip chip-info',
    web:     'chip chip-mute',
    wx_mp:   'chip chip-info',
    wx_h5:   'chip chip-info',
    admin:   'chip chip-mute',
  }[p] ?? 'chip chip-mute';
}

/** 状态 chip 配色(commerce v2 全枚举)*/
export function statusChip(s: string): string {
  return {
    paid:'chip chip-ok', shipped:'chip chip-ok', done:'chip chip-ok',
    success:'chip chip-ok', open:'chip chip-ok', published:'chip chip-ok',
    listed:'chip chip-ok', on_sale:'chip chip-ok', active:'chip chip-ok',
    delivered:'chip chip-ok', approved:'chip chip-ok', matched:'chip chip-ok',
    posted:'chip chip-ok', resolved:'chip chip-ok',
    registered:'chip chip-ok', checked_in:'chip chip-ok',

    unpaid:'chip chip-warn', pending:'chip chip-warn', draft:'chip chip-warn',
    processing:'chip chip-warn', requested:'chip chip-warn', cancelling:'chip chip-warn',
    refunding:'chip chip-warn', refund_partial:'chip chip-warn', refunded_partial:'chip chip-warn',
    fulfilling:'chip chip-warn', scheduled:'chip chip-warn', trialing:'chip chip-warn',
    preparing:'chip chip-warn', picked_up:'chip chip-warn', in_transit:'chip chip-warn',
    out_for_delivery:'chip chip-warn', returning:'chip chip-warn',
    past_due:'chip chip-warn', grace:'chip chip-warn',
    pulled:'chip chip-warn', parsed:'chip chip-warn', investigating:'chip chip-warn',

    cancelled:'chip chip-bad', failed:'chip chip-bad', expired:'chip chip-bad',
    refunded:'chip chip-bad', exception:'chip chip-bad', disputed:'chip chip-bad',
    has_discrepancy:'chip chip-bad', missing_in_channel:'chip chip-bad',
    missing_in_internal:'chip chip-bad', amount_mismatch:'chip chip-bad',
    status_mismatch:'chip chip-bad', false_positive:'chip chip-bad',

    off_sale:'chip chip-mute', archived:'chip chip-mute', closed:'chip chip-mute',
    ended:'chip chip-mute', delisted:'chip chip-mute', discontinued:'chip chip-mute',
    paused:'chip chip-mute', retired:'chip chip-mute', returned:'chip chip-mute',
    revoked:'chip chip-mute', issued:'chip chip-mute', locked:'chip chip-mute',
    redeemed:'chip chip-mute', uncollectible:'chip chip-mute', void:'chip chip-mute',
    reversed:'chip chip-mute', exhausted:'chip chip-mute', inactive:'chip chip-mute',
    sold_out:'chip chip-mute',
  }[s] ?? 'chip chip-mute';
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
