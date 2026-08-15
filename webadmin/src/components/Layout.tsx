import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Tags, BadgePercent, Repeat,
  Receipt, CreditCard, Undo2, Truck, Scale, ShieldAlert, Wallet,
  Activity, ToggleLeft, Users as UsersI, Compass, BookOpen,
  Radio, Globe, Database, LogOut,
} from 'lucide-react';
import { authAtom, setAuthAtom, activeRegionAtom, setActiveRegionAtom } from '../store/auth';
import { commerce } from '../lib/api';

interface Item { to: string; label: string; cn: string; icon: any; }
const groups: { title: string; items: Item[] }[] = [
  { title: 'commerce', items: [
    { to: '/',              label: 'KPI',          cn: '总览',   icon: LayoutDashboard },
    { to: '/products',      label: 'Catalog',      cn: '商品',   icon: Package },
    { to: '/pricing',       label: 'Pricing',      cn: '定价',   icon: Tags },
    { to: '/promotions',    label: 'Promotions',   cn: '营销',   icon: BadgePercent },
    { to: '/subscriptions', label: 'Subs',         cn: '订阅',   icon: Repeat },
    { to: '/orders',        label: 'Orders',       cn: '订单',   icon: Receipt },
    { to: '/payments',      label: 'Payments',     cn: '支付',   icon: CreditCard },
    { to: '/refunds',       label: 'Refunds',      cn: '退款',   icon: Undo2 },
    { to: '/shipments',     label: 'Shipments',    cn: '物流',   icon: Truck },
    { to: '/reconciliation',label: 'Reconcile',    cn: '对账',   icon: Scale },
    { to: '/risk',          label: 'Risk',         cn: '风控',   icon: ShieldAlert },
    { to: '/finance',       label: 'Finance',      cn: '财务',   icon: Wallet },
    { to: '/outbox',        label: 'Outbox',       cn: '事件',   icon: Radio },
  ]},
  { title: 'control plane', items: [
    { to: '/master',        label: 'Master',       cn: '主数据', icon: Database },
  ]},
  { title: 'content & ops', items: [
    { to: '/users',         label: 'Users',     cn: '用户',   icon: UsersI },
    { to: '/naji',          label: 'Naji log',  cn: '纳吉',   icon: Compass },
    { to: '/quotes',        label: 'Content',   cn: '语料',   icon: BookOpen },
    { to: '/feature_flags', label: 'Flags',     cn: '差异化', icon: ToggleLeft },
    { to: '/mingli',        label: 'Engine',    cn: '算力',   icon: Activity },
  ]},
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [auth] = useAtom(authAtom);
  const [, setAuth] = useAtom(setAuthAtom);
  const nav = useNavigate();
  return (
    <div className="min-h-screen flex bg-canvas text-ink">
      <aside className="w-[200px] bg-surface border-r border-border flex flex-col flex-shrink-0">
        <div className="px-3.5 py-3 border-b border-border">
          <div className="font-semibold text-[15px] text-ink leading-tight">unmei · console</div>
          <div className="uplabel text-ink-5 mt-0.5">COMMERCE V2 / OPS</div>
        </div>
        <nav className="flex-1 py-2 px-1.5 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.title} className="mb-2">
              <div className="uplabel text-ink-5 px-2.5 pb-1 pt-2">{g.title}</div>
              <div className="space-y-0.5">
                {g.items.map(({ to, label, cn, icon: Ic }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-2.5 py-1.5 rounded text-[12.5px] transition ${
                        isActive ? 'bg-ink text-canvas font-medium'
                                 : 'text-ink-2 hover:bg-surface-2'
                      }`
                    }
                  >
                    <Ic size={14} strokeWidth={1.75} />
                    <span className="flex-1">{cn}</span>
                    <span className="uplabel opacity-50">{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-border px-3.5 py-3">
          <div className="text-[12px] font-medium text-ink truncate">{auth?.name}</div>
          <div className="uplabel text-ink-5 mt-0.5 truncate">{auth?.roles.join(' · ')}</div>
          <button
            onClick={() => { setAuth(null); nav('/login'); }}
            className="mt-2 flex items-center gap-1.5 text-ink-4 hover:text-vermilion text-[11px]"
          >
            <LogOut size={12} strokeWidth={1.75} /> 登出
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function TopBar() {
  const [auth] = useAtom(authAtom);
  const [, setActiveRegion] = useAtom(setActiveRegionAtom as any);
  const currentRegion = useAtom(activeRegionAtom)[0];
  const qc = useQueryClient();
  const regions = useQuery({
    queryKey: ['regions'],
    queryFn: () => commerce.listRegions(),
    staleTime: 5 * 60_000,
  });

  // region 一变,所有 commerce query 自动 invalidate → 触发后端按新 region 重新 fetch
  useEffect(() => {
    qc.invalidateQueries({
      predicate: (q) => {
        const k = (q.queryKey?.[0] as string) ?? '';
        return !['regions'].includes(k);
      },
    });
  }, [currentRegion, qc]);

  const scope = auth?.region_scope ?? [];
  const allRegions: any[] = (regions.data ?? []).filter((r: any) =>
    scope.length === 0 || scope.includes(r.code) || scope.includes('global'));
  const cur = (regions.data ?? []).find((r: any) => r.code === currentRegion) ?? { code: currentRegion, name: '', primary_currency: '', tz: '', status: '' };

  return (
    <header className="h-10 border-b border-border bg-surface px-4 flex items-center gap-3 text-[11.5px] text-ink-3 flex-shrink-0">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-jade animate-pulse" />
        <span className="num">admin-api :6029</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-jade" />
        <span className="num">pg :6032</span>
      </div>

      {/* Region selector · 6 cell + global */}
      <div className="ml-2 flex items-center gap-1 border border-border rounded px-1.5 py-0.5 bg-surface-2">
        <Globe size={12} className="text-ink-4" />
        <select
          value={currentRegion}
          onChange={(e) => { setActiveRegion(e.target.value as any); }}
          className="bg-transparent text-[11.5px] font-medium num focus:outline-none cursor-pointer"
        >
          {allRegions.map((r: any) => (
            <option key={r.code} value={r.code}>{r.code} · {r.name} · {r.primary_currency}</option>
          ))}
          {scope.includes('global') && (
            <option value="global">global · 集团视图</option>
          )}
        </select>
        {cur.status && (
          <span className={`chip text-[9px] ml-1 ${
            cur.status === 'live' ? 'chip-ok' :
            cur.status === 'planned' ? 'chip-mute' :
            cur.status === 'provisioning' ? 'chip-warn' : 'chip-mute'
          }`}>{cur.status}</span>
        )}
      </div>

      <div className="flex-1" />
      <div className="uplabel text-ink-5">commerce v2 · 6 cell · {auth?.region_scope?.length ?? 0} region scope</div>
    </header>
  );
}
