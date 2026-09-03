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

// 当前 admin 选择中的 region · super 可在 sidebar 顶部切换。
// 【默认不写死 cn】——分区管理员管不着 cn，写死等于让他一进来就全站 403。
// 真正的默认在登录时按 region_scope 定（见下面 `认得的区`）。
export const activeRegionAtom = atom<string>(
  localStorage.getItem(REGION_KEY) ?? 'cn',
);

export const setActiveRegionAtom = atom(null, (_get, set, code: string) => {
  localStorage.setItem(REGION_KEY, code);
  set(activeRegionAtom, code);
});

export const setAuthAtom = atom(null, (_get, set, v: AdminAuth | null) => {
  if (v) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    /* 【记着的那个区要按这个人管得着的校正】（2026-09-04 · 25 计划）。
       这一行以前不存在，于是「上一个人选的区」原样留给了下一个人 ——
       而分区管理员管不着那个区:侧栏每一页都带着 `region=cn` 去问，
       后端一律 403，**十四页全红**，从看板到主数据一页都打不开。

       只有一个管理员的时候这件事永远看不见（他管全部，选哪个区都 200）——
       25 计划的第二个管理员就是为这种东西存在的。 */
    set(setActiveRegionAtom, 认得的区(v));
  } else {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REGION_KEY);
  }
  set(authAtom, v);
});

/** 这个人现在该看哪个区。记着的那个他管得着就用，管不着就换成他的头一个。 */
function 认得的区(v: AdminAuth): string {
  const scope = v.region_scope ?? [];
  // 管全部（scope 为空或含 global）的，记着什么用什么
  const 不限 = scope.length === 0 || scope.includes('global');
  const 记着的 = localStorage.getItem(REGION_KEY);
  if (不限) return 记着的 ?? 'cn';
  if (记着的 && scope.includes(记着的)) return 记着的;
  return scope[0];
}


