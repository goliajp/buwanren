import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, useNavigate } from 'react-router';
import {
  LayoutDashboard, Package, Tags, BadgePercent, Repeat,
  Receipt, CreditCard, Undo2, Truck, Scale, ShieldAlert, Wallet,
  Activity, ToggleLeft, Users as UsersI, Compass, BookOpen,
  Radio, Database, LogOut, ScrollText,
} from 'lucide-react';
import { authAtom, setAuthAtom, activeRegionAtom, setActiveRegionAtom } from '../store/auth';
import { commerce } from '../lib/api';
import { roleLabel } from './util';
import Notices from './Notices';

/* 左栏不是导航，是【盯梢表】。
 *
 * 十九个工作台没有人看得过来。所以让导航本身报数:
 * 需要处理的条数直接长在它旁边，没事的时候什么都不显示。
 * 一屏扫过去，哪儿有事一目了然 —— 这就是「缺席要有重量」在导航上的样子。
 *
 * `watch` 说的是「这一台的待办数从 dashboard 的哪个字段来」。
 * 没有 watch 的工作台不报数（它们没有「待办」这个概念，
 * 硬造一个数出来只会让真正要处理的那几个淹掉）。
 */
interface Item { to: string; cn: string; icon: any; watch?: string }

const groups: { title: string; items: Item[] }[] = [
  {
    title: '生意', items: [
      { to: '/', cn: '看板', icon: LayoutDashboard },
      { to: '/orders', cn: '订单', icon: Receipt, watch: 'unpaid_orders' },
      { to: '/payments', cn: '支付', icon: CreditCard, watch: 'pending_payments' },
      { to: '/refunds', cn: '退款', icon: Undo2, watch: 'pending_refunds' },
      { to: '/shipments', cn: '物流', icon: Truck, watch: 'exception_shipments' },
      { to: '/reconciliation', cn: '对账', icon: Scale },
      { to: '/finance', cn: '财务', icon: Wallet },
      { to: '/risk', cn: '风控', icon: ShieldAlert, watch: 'open_risk_cases' },
      { to: '/outbox', cn: '事件', icon: Radio },
      /* 【记了没人看等于没记】。审计表建库起就是空的，
         而后台有十八个花钱或改账的写操作。 */
      { to: '/audit', cn: '操作记录', icon: ScrollText },
    ],
  },
  {
    title: '货架', items: [
      { to: '/products', cn: '商品', icon: Package },
      { to: '/pricing', cn: '定价', icon: Tags },
      { to: '/promotions', cn: '促销', icon: BadgePercent },
      { to: '/subscriptions', cn: '订阅', icon: Repeat },
    ],
  },
  {
    title: '内容与人', items: [
      { to: '/users', cn: '用户', icon: UsersI },
      { to: '/naji', cn: '问签记录', icon: Compass },
      { to: '/quotes', cn: '语料', icon: BookOpen },
      { to: '/feature_flags', cn: '灰度开关', icon: ToggleLeft },
      { to: '/mingli', cn: '排盘服务', icon: Activity },
      { to: '/master', cn: '主数据', icon: Database },
    ],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [auth] = useAtom(authAtom);
  const [, setAuth] = useAtom(setAuthAtom);
  const [region] = useAtom(activeRegionAtom);
  const nav = useNavigate();

  /* 待办数跟看板同一份数据 —— 两处不许各查各的，
     不然左栏说「12 笔待退」而看板说 14，谁都不敢信。 */
  const 待办 = useQuery({
    queryKey: ['dashboard', region],
    queryFn: () => commerce.dashboard(),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  return (
    <div className="min-h-screen flex bg-paper text-ink">
      <aside className="w-rail bg-card border-r border-rule flex flex-col shrink-0">
        <div className="h-12 px-4 flex items-center border-b border-rule">
          <span className="text-base font-semibold tracking-tight">不完人</span>
          <span className="ml-2 text-xs text-ink-3">运营台</span>
        </div>

        <nav className="flex-1 py-2 px-2 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.title} className="mb-3">
              <div className="label px-2 pb-1.5 pt-1">{g.title}</div>
              {g.items.map(({ to, cn, icon: Ic, watch }) => {
                const n = watch ? (待办.data?.[watch] as number | undefined) : undefined;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `group flex items-center gap-2 h-7 px-2 rounded text-sm transition-colors ${
                        isActive
                          ? 'bg-ink text-paper font-medium'
                          : 'text-ink-2 hover:bg-sunk'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Ic size={14} strokeWidth={1.75} className={isActive ? '' : 'text-ink-3'} />
                        <span className="flex-1 truncate">{cn}</span>
                        {/* 【0 不显示】。要处理的才报数 ——
                            每一项都挂个 0 的话，读到的是「到处都有数」，
                            而那正是把真有事的那一个藏起来的办法。 */}
                        {n ? (
                          <span
                            className={`n text-xs tabular-nums ${
                              isActive ? 'text-paper/80' : 'text-debt font-medium'
                            }`}
                          >
                            {n > 999 ? '999+' : n}
                          </span>
                        ) : null}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-rule px-4 py-3">
          <div className="text-sm font-medium truncate">{auth?.name}</div>
          <div className="label mt-0.5 truncate" title={auth?.roles.join('、')}>
            {(auth?.roles ?? []).map(roleLabel).join('、')}
          </div>
          <button
            onClick={() => { setAuth(null); nav('/login'); }}
            className="mt-2 flex items-center gap-1.5 text-xs text-ink-3 hover:text-debt transition-colors"
          >
            <LogOut size={12} strokeWidth={1.75} /> 退出
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <Notices />
    </div>
  );
}

/* 顶栏只放【会影响你看到什么】的东西:看的是哪个区。
 * 上一版还挂着 `admin-api :6029` / `pg :6032` 两个端口和一句
 * `commerce v2 · 6 cell · 1 region scope` —— 那是给部署的人看的，
 * 而这一栏每一屏都在，占的是最贵的位置。 */
function TopBar() {
  const [auth] = useAtom(authAtom);
  const [, setActiveRegion] = useAtom(setActiveRegionAtom as any);
  const [currentRegion] = useAtom(activeRegionAtom);
  const qc = useQueryClient();
  const regions = useQuery({
    queryKey: ['regions'],
    queryFn: () => commerce.listRegions(),
    staleTime: 5 * 60_000,
  });

  // 换区之后所有 commerce 查询重取 —— 区是全局镜头，不是筛选条件
  useEffect(() => {
    qc.invalidateQueries({
      predicate: (q) => ((q.queryKey?.[0] as string) ?? '') !== 'regions',
    });
  }, [currentRegion, qc]);

  const scope = auth?.region_scope ?? [];
  const allRegions: any[] = (regions.data ?? []).filter(
    (r: any) => scope.length === 0 || scope.includes(r.code) || scope.includes('global'),
  );
  const cur = allRegions.find((r: any) => r.code === currentRegion);

  return (
    <header className="h-12 border-b border-rule bg-card px-5 flex items-center gap-3 shrink-0">
      <label className="label" htmlFor="region">看的是</label>
      <select
        id="region"
        value={currentRegion}
        onChange={(e) => setActiveRegion(e.target.value as any)}
        className="select h-7"
      >
        {allRegions.map((r: any) => (
          <option key={r.code} value={r.code}>
            {r.name}（{r.primary_currency}）
          </option>
        ))}
        {scope.includes('global') && <option value="global">全部区域</option>}
      </select>
      {cur?.status && cur.status !== 'live' && (
        <span className="st st-pending text-xs">
          {cur.status === 'planned' ? '还没开' : '正在开通'}
        </span>
      )}
      <div className="flex-1" />
    </header>
  );
}
