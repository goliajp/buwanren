import { useQuery } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { commerce } from './api';
import { authAtom } from '../store/auth';

export interface RegionRow {
  code: string;
  name: string;
  primary_currency: string;
  supported_currencies: string[];
  status: string;
}

/**
 * 名册（`region_registry`）里的区 —— `GET /admin/regions` 那一条。
 *
 * 【页面里不许再写死一份】（2026-09-05）。写死那几份是这么长的：
 *
 *   Pricing.tsx      `['cn','hk','tw','jp','us','eu','global']`
 *   FeatureFlags.tsx `['cn','hk','tw','jp','us','eu']`
 *   Users.tsx        `cn / hk / tw / jp / us`
 *
 * 而名册里的六格是 `cn / jp / kr / sea / na / zh_hant` —— 两边**只有
 * cn 与 jp 对得上**。也就是说：定价页上那五个选项里有三个不是区，
 * 挑中它们发出去的价落进一个谁也查不到的 region；开关页按 `tw` 关一个
 * 功能，永远关不到人；用户页按 `us` 筛，恒定 0 条。
 * 三处各写一份，三处都跟真名册对不上 —— 而名册就在一条接口后面。
 *
 * 缓存五分钟:这张表是部署期的东西，不会在一次会话里变。
 */
export function useRegions(): RegionRow[] {
  const q = useQuery({
    queryKey: ['regions'],
    queryFn: () => commerce.listRegions(),
    staleTime: 5 * 60_000,
  });
  return (q.data ?? []) as RegionRow[];
}

/**
 * 这个管理员管得着的那几格。
 *
 * 【挑得到的区，只能是他管得着的】。挑一个他管不着的，后端一律 403，
 * 而屏上只剩一句 forbidden —— 那时人不知道是自己挑错了还是后台坏了。
 */
export function useMyRegions(): RegionRow[] {
  const [auth] = useAtom(authAtom);
  const scope = auth?.region_scope ?? [];
  const 不限 = scope.length === 0 || scope.includes('global');
  return useRegions().filter((r) => 不限 || scope.includes(r.code));
}
