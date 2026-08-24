import { atom } from 'jotai';

export interface AdminAuth {
  token: string;
  name: string;
  roles: string[];
  region_scope?: string[];
}

const STORAGE_KEY = 'unmei_admin_auth';
const REGION_KEY = 'unmei_admin_active_region';

function load(): AdminAuth | null {
  const v = localStorage.getItem(STORAGE_KEY);
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}

export const authAtom = atom<AdminAuth | null>(load());

export const setAuthAtom = atom(null, (_get, set, v: AdminAuth | null) => {
  if (v) localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  else { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(REGION_KEY); }
  set(authAtom, v);
});

// 当前 admin 选择中的 region · 默认本 cell(P1 是 cn)· super 可在 sidebar 顶部切换
export const activeRegionAtom = atom<string>(
  localStorage.getItem(REGION_KEY) ?? 'cn',
);

export const setActiveRegionAtom = atom(null, (_get, set, code: string) => {
  localStorage.setItem(REGION_KEY, code);
  set(activeRegionAtom, code);
});
