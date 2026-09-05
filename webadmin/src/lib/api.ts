const BASE = '/admin';
const REGION_KEY = 'unmei_admin_active_region';

function getToken(): string | null {
  const v = localStorage.getItem('unmei_admin_auth');
  if (!v) return null;
  try { return JSON.parse(v).token; } catch { return null; }
}

function getActiveRegion(): string {
  return localStorage.getItem(REGION_KEY) ?? 'cn';
}

/**
 * 取浏览器/设备 IANA tz(如 'Asia/Shanghai' / 'America/New_York')。
 * 用于 dashboard 等带「今日」语义的端点 —— 让后端按用户当地零点算 today,
 * 而不是 sqlx UTC session 算的 UTC 当日。
 */
function getClientTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
  catch { return 'UTC'; }
}

function withTz(path: string): string {
  if (path.includes('tz=')) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}tz=${encodeURIComponent(getClientTz())}`;
}

/**
 * 给按区过滤的 GET 自动 append `region=<active>`(已带 region 的不覆盖)。
 * 切到 global → 不加 region param,后端 normalize 后看全部。
 * webadmin 切区域 → 所有 list / dashboard / outbox 自动跟动。
 *
 * 【`/users` 也在里面】（2026-09-05）。这一行原先只认 `/commerce` 开头，
 * 而 `GET /admin/users` 后端同样过 `normalize_region_scoped` ——
 * 于是它带着一个空 region 去问，而后端的规矩是「scope 有多个区、
 * 请求又不带 region → 当场拒」：**一位管两个区的运营打开用户页
 * 只看得到一句 forbidden**（docs/ACCEPTANCE-25.md 先决条件四）。
 * 【`/naji` 是 2026-09-06 加的】。那一条当天才按区过滤 —— 它此前对
 * 任何管理员都给全库的问签记录（用户问的私事，不是台账）。
 * 后端一守，前端不带区去问就 403 —— 阿双（管两格）那一轮逐页走当场红。
 * **后端加守卫的同一批里必须把这张名单一起改**:两处各改一半的样子，
 * 就是「安全修好了，而那一页对某个人打不开了」。
 *
 * 名单在这儿而不是「所有 GET 都加」：加到一条不按区过滤的接口上，
 * 那个参数会被 serde 静静丢掉，读代码的人却以为它起了作用。
 */
const 按区过滤的 = ['/commerce', '/users', '/naji'];

function withActiveRegion(path: string, method: string): string {
  if (method !== 'GET') return path;
  if (!按区过滤的.some((p) => path.startsWith(p))) return path;
  if (path.includes('region=')) return path;
  const region = getActiveRegion();
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}region=${encodeURIComponent(region)}`;
}

async function request(path: string, opts: RequestInit = {}): Promise<any> {
  const tok = getToken();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (tok) headers['authorization'] = `Bearer ${tok}`;
  const finalPath = withActiveRegion(path, (opts.method ?? 'GET').toUpperCase());
  const res = await fetch(BASE + finalPath, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 401) {
      localStorage.removeItem('unmei_admin_auth');
      window.location.href = '/login';
    }
    throw new ApiError(res.status, err.code, err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * 后端错误响应体是 `{ error, code }`。
 *
 * `code` 原本被整个丢掉,只留下给人读的 `error` 文本 —— 于是调用方想按错误
 * 类型分支处理时,只能去 match 字符串。现在把它带出来。
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  get:    <T = any>(path: string)            => request(path) as Promise<T>,
  post:   <T = any>(path: string, body?: any) => request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }) as Promise<T>,
  patch:  <T = any>(path: string, body?: any) => request(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }) as Promise<T>,
  delete: <T = any>(path: string)            => request(path, { method: 'DELETE' }) as Promise<T>,
};

// ─── commerce v2 端点封装 ──────────────────────────────────────────
export interface PageRes<T> { items: T[]; total: number; page: number; size: number }

function qs(p: Record<string, any>): string {
  const u = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  });
  const s = u.toString();
  return s ? '?' + s : '';
}

export const commerce = {
  dashboard: () => api.get<any>(withTz('/commerce/dashboard')),

  listProducts: (p: any) => api.get<PageRes<any>>('/commerce/products' + qs(p)),
  getProduct: (id: string) => api.get<any>(`/commerce/products/${id}`),
  toggleProductListing: (id: string, status: string) =>
    api.post(`/commerce/products/${id}/listing`, { status }),
  getSku: (id: string) => api.get<any>(`/commerce/skus/${id}`),

  listPrices: (skuId: string) => api.get<any[]>(`/commerce/pricing/${skuId}`),
  publishPrice: (skuId: string, body: any) => api.post(`/commerce/pricing/${skuId}/publish`, body),
  expirePrice: (id: string) => api.post(`/commerce/pricing/expire/${id}`),

  listPromotions: (p: any) => api.get<PageRes<any>>('/commerce/promotions' + qs(p)),
  getPromotion: (id: string) => api.get<any>(`/commerce/promotions/${id}`),
  updatePromotionState: (id: string, status: string) =>
    api.post(`/commerce/promotions/${id}/state`, { status }),
  listCoupons: (p: any) => api.get<PageRes<any>>('/commerce/coupons' + qs(p)),
  /* 【发券得说清是哪个区】（2026-09-05）。这两条原先什么区都不带，
     后端就 `.unwrap_or("cn")` —— 于是一位 super 在顶栏切到日本、
     发一张券，券落在大陆：他手上的界面从头到尾说的是日本，
     而这张券只有大陆的人用得上，两边都不报错。
     区是全局镜头，掏钱的动作跟着它走。 */
  /* 【字段一个个写出来，不用 `...b`】。`check-bodies` 那一支读的是
     这里的对象字面量 —— 展开之后它读到的字段名是 `...b`，报「后端不认」。
     写全了还多一层好处:这两条路由此前【压根没被那支门禁比对过】
     （只传一个 `b`，看不出发的是什么）。 */
  issueCoupon: (b: any) => api.post('/commerce/coupons', {
    region: getActiveRegion(), code: b.code, benefit_json: b.benefit_json,
    expires_at: b.expires_at, owner_user_id: b.owner_user_id, promotion_id: b.promotion_id,
  }),
  issueCouponBatch: (b: any) => api.post('/commerce/coupons/batch', {
    region: getActiveRegion(), count: b.count, prefix: b.prefix,
    benefit_json: b.benefit_json, expires_at: b.expires_at, promotion_id: b.promotion_id,
  }),

  listPlans: () => api.get<any[]>('/commerce/plans'),
  listSubscriptions: (p: any) => api.get<PageRes<any>>('/commerce/subscriptions' + qs(p)),
  cancelSubscription: (id: string, immediate: boolean, reason: string) =>
    api.post(`/commerce/subscriptions/${id}/cancel`, { immediate, reason }),

  listOrders: (p: any) => api.get<PageRes<any>>('/commerce/orders' + qs(p)),
  getOrder: (id: string) => api.get<any>(`/commerce/orders/${id}`),
  cancelOrder: (id: string, reason: string) => api.post(`/commerce/orders/${id}/cancel`, { reason }),
  annotateOrder: (id: string, note: string) => api.post(`/commerce/orders/${id}/annotate`, { note }),

  listPayments: (p: any) => api.get<PageRes<any>>('/commerce/payments' + qs(p)),
  getPayment: (id: string) => api.get<any>(`/commerce/payments/${id}`),
  markPaymentFailed: (id: string, code: string, msg: string) =>
    api.post(`/commerce/payments/${id}/mark-failed`, { code, msg }),

  listRefunds: (p: any) => api.get<PageRes<any>>('/commerce/refunds' + qs(p)),
  approveRefund: (id: string) => api.post(`/commerce/refunds/${id}/approve`),
  denyRefund: (id: string, reason: string) => api.post(`/commerce/refunds/${id}/deny`, { reason }),

  listShipments: (p: any) => api.get<PageRes<any>>('/commerce/shipments' + qs(p)),
  getShipment: (id: string) => api.get<any>(`/commerce/shipments/${id}`),
  assignTracking: (id: string, body: any) =>
    api.post(`/commerce/shipments/${id}/assign-tracking`, body),
  markShipmentException: (id: string, reason: string) =>
    api.post(`/commerce/shipments/${id}/mark-exception`, { reason }),

  resolveReconRecord: (id: string, action: string, note: string) =>
    api.post(`/commerce/recon/records/${id}/resolve`, { action, note }),
  closeRiskCase: (id: string, state: string, note: string) =>
    api.post(`/commerce/risk/cases/${id}/state`, { state, note }),
  setUserBan: (id: string, banned: boolean, reason: string) =>
    api.post(`/users/${id}/ban`, { banned, reason }),
  listAudit: (p: any) => api.get<PageRes<any>>('/commerce/audit' + qs(p)),

  /* 线下活动。【`/admin/activities` 这条接口一直在，而控制台里没有页面】
     （2026-09-03 五路评审 · 架构审计）——一条服务不了任何人的路由。
     名单与签到那两条是这一次新加的：报名这条链原先整个不存在。 */
  listActivities: () => api.get<{ items: any[] }>('/activities'),
  listRegistrations: (id: string) =>
    api.get<{ items: any[] }>(`/activities/${id}/registrations`),
  checkInRegistration: (id: string) =>
    api.post(`/activity-registrations/${id}/checkin`, {}),
  listReconBatches: (p: any) => api.get<PageRes<any>>('/commerce/recon/batches' + qs(p)),
  getReconBatch: (id: string) => api.get<any>(`/commerce/recon/batches/${id}`),

  listRiskRules: () => api.get<any[]>('/commerce/risk/rules'),
  updateRiskRuleState: (id: string, status: string) =>
    api.post(`/commerce/risk/rules/${id}/state`, { status }),
  listRiskEvents: (p: any) => api.get<PageRes<any>>('/commerce/risk/events' + qs(p)),
  listRiskCases: (p: any) => api.get<PageRes<any>>('/commerce/risk/cases' + qs(p)),

  listPeriods: () => api.get<any[]>('/commerce/finance/periods'),
  closePeriod: (id: string) => api.post(`/commerce/finance/periods/${id}/close`),
  listJournalEntries: (p: any) =>
    api.get<PageRes<any>>('/commerce/finance/entries' + qs(p)),
  getJournalEntry: (id: string) => api.get<any>(`/commerce/finance/entries/${id}`),
  monthlyReport: (periodId: string) => api.get<any>(`/commerce/finance/report/${periodId}`),

  listOutbox: (p: any) => api.get<PageRes<any>>('/commerce/outbox' + qs(p)),
  getOutbox: (id: string) => api.get<any>(`/commerce/outbox/${id}`),
  retryOutbox: (id: string) => api.post(`/commerce/outbox/${id}/retry`),

  listRegions: () => api.get<any[]>('/regions'),
  listExchangeRates: () => api.get<any[]>('/exchange-rates'),

  // Master Data (control plane · global · push 到 6 cell)
  masterProducts:       () => api.get<any[]>('/master/products'),
  masterPlans:          () => api.get<any[]>('/master/plans'),
  masterAccountChart:   () => api.get<any[]>('/master/account-chart'),
  masterRiskTemplates:  () => api.get<any[]>('/master/risk-templates'),
};
