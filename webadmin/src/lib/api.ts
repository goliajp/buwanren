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
 * 给 commerce.* 的 GET 自动 append `region=<active>`(已带 region 的不覆盖)。
 * 切到 global → 不加 region param,后端 normalize 后看全部。
 * webadmin 切区域 → 所有 list / dashboard / outbox 自动跟动。
 */
function withActiveRegion(path: string, method: string): string {
  if (method !== 'GET') return path;
  if (!path.startsWith('/commerce')) return path;
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

  listReconBatches: (p: any) => api.get<PageRes<any>>('/commerce/recon/batches' + qs(p)),
  getReconBatch: (id: string) => api.get<any>(`/commerce/recon/batches/${id}`),

  listRiskRules: () => api.get<any[]>('/commerce/risk/rules'),
  updateRiskRuleState: (id: string, status: string) =>
    api.post(`/commerce/risk/rules/${id}/state`, { status }),
  listRiskEvents: (p: any) => api.get<PageRes<any>>('/commerce/risk/events' + qs(p)),
  listRiskCases: (p: any) => api.get<PageRes<any>>('/commerce/risk/cases' + qs(p)),

  listPeriods: () => api.get<any[]>('/commerce/finance/periods'),
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
