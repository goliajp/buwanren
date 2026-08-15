const BASE = '/v1';

function getToken(): string | null {
  const v = localStorage.getItem('unmei_auth');
  if (!v) return null;
  try { return JSON.parse(v).token; } catch { return null; }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const tok = getToken();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (tok) headers['authorization'] = `Bearer ${tok}`;
  const res = await fetch(BASE + path, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get:   <T = any>(p: string) => request<T>(p),
  post:  <T = any>(p: string, b?: any) => request<T>(p, { method: 'POST', body: b ? JSON.stringify(b) : undefined }),
  patch: <T = any>(p: string, b?: any) => request<T>(p, { method: 'PATCH', body: b ? JSON.stringify(b) : undefined }),
};

export interface NajiResult {
  id: string; asked_at: string; time_label: string;
  quote: { text: string; source: string };
  gate: string; direction: string; gate_explain: string;
  suit: string[]; avoid: string[];
  recommend: { kind: string; id: string; name: string; sub_title: string | null; price_display: string; image_url: string | null } | null;
}
