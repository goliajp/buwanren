import { atom } from 'jotai';

export interface UserPublic {
  id: string; nickname: string; avatar_url: string | null;
  platform: string; region: string; locale: string;
  active_natal_id: string | null;
  is_anonymous: boolean;
}
export interface Auth { token: string; user: UserPublic }

const KEY = 'unmei_auth';
function load(): Auth | null {
  const v = localStorage.getItem(KEY);
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}
export const authAtom = atom<Auth | null>(load());
export const setAuthAtom = atom(null, (_g, set, v: Auth | null) => {
  if (v) localStorage.setItem(KEY, JSON.stringify(v));
  else localStorage.removeItem(KEY);
  set(authAtom, v);
});
