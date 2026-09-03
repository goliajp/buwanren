import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { rel, ts, statusClass, statusLabel, shortId, thou, enumLabel } from '../components/util';
import { Globe2, Package, Repeat as RepeatI, Wallet, ShieldAlert, RefreshCw } from 'lucide-react';

const TABS = [
  { k: 'products',    label: 'SPU 商品',      icon: Package },
  { k: 'plans',       label: '订阅 Plan',     icon: RepeatI },
  { k: 'accounts',    label: '会计科目',      icon: Wallet },
  { k: 'risk',        label: '风控模板',      icon: ShieldAlert },
  { k: 'rates',       label: '汇率',          icon: Globe2 },
] as const;

type Tab = typeof TABS[number]['k'];

export default function Master() {
  const [tab, setTab] = useState<Tab>('products');
  const products = useQuery({ queryKey: ['master-products'],    queryFn: () => commerce.masterProducts(),       enabled: tab === 'products' });
  const plans    = useQuery({ queryKey: ['master-plans'],       queryFn: () => commerce.masterPlans(),          enabled: tab === 'plans' });
  const chart    = useQuery({ queryKey: ['master-accounts'],    queryFn: () => commerce.masterAccountChart(),   enabled: tab === 'accounts' });
  const risk     = useQuery({ queryKey: ['master-risk'],        queryFn: () => commerce.masterRiskTemplates(),  enabled: tab === 'risk' });
  const rates    = useQuery({ queryKey: ['master-rates'],       queryFn: () => commerce.listExchangeRates(),    enabled: tab === 'rates' });
  const 这一档 = { products, plans, accounts: chart, risk, rates }[tab];
  const 全部: any[] = (这一档.data ?? []) as any[];
  const [找, 设找] = useState('');

  /* 【一万四千行不能一次全渲染】。这张表现役 13,898 条（多数是反复跑测试
     留下的「测试商品」），上一版把它们全画到一页上 —— 一百万个字符的 DOM，
     滚不到底，也没有人打算读到第 500 行。
     所以:先过滤，再封顶，并且【把藏起来的条数说出来】——
     悄悄截断跟没截断长得一样，那才是问题。 */
  const 命中 = useMemo(() => {
    const q = 找.trim().toLowerCase();
    if (!q) return 全部;
    return 全部.filter((x) => JSON.stringify(x).toLowerCase().includes(q));
  }, [全部, 找]);
  const 上限 = 200;
  const 显示 = 命中.slice(0, 上限);
  const 当前: number | undefined = 全部.length || undefined;

  return (
    <div>
      <PageHeader
        title="主数据"
        sub="所有区域共用的那份底档。改一处，各区自动跟上 —— 所以这里只看"
        /* 【只报看得见的那个数】。上一版并排摆四个数，
           而三张表要切到对应页签才查 —— 于是永远有三个是破折号，
           读起来像「这三样是空的」。 */
        stats={当前 !== undefined ? [{ label: '一共', value: thou(当前) }] : undefined}
      />
      <div className="p-4">
        <div className="flex items-center gap-1 mb-3">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.k}
                className={`btn ${tab === t.k ? 'btn-prim' : 'btn-soft'}`}
                onClick={() => setTab(t.k)}>
                <Icon size={13}/> {t.label}
              </button>
            );
          })}
          <input
            className="input ml-auto w-56"
            placeholder="在这一份里找"
            value={找}
            onChange={(e) => 设找(e.target.value)}
          />
          <button className="btn btn-soft" onClick={() => {
            products.refetch(); plans.refetch(); chart.refetch(); risk.refetch(); rates.refetch();
          }}><RefreshCw size={13}/></button>
        </div>

        {/* 【说出来还剩多少没显示】。默认只画前 200 行 ——
            悄悄截断跟没有截断长得一模一样，而那是最难发现的一种谎。 */}
        {命中.length > 上限 && (
          <p className="label mb-2">
            {thou(命中.length)} 条里显示前 {上限} 条。用上面的框缩小范围。
          </p>
        )}
        {找 && 命中.length === 0 && (
          <p className="text-sm text-ink-2 mb-2">这一份里没有含「{找}」的。</p>
        )}

        {/* 【取不到跟「这一份是空的」不是一回事】
            （2026-09-03 五路评审 · 后台产品体验）。
            这一页五张表共用 `全部`，而它是 `data ?? []` ——
            取不到时那五张表都渲成空的，跟「这一份底档里什么都没有」
            长得一模一样。而底档【本来就不该是空的】，
            所以这句空白最误导:它看着像数据出了事，其实是网络出了事。
            五张表只显示当前页签那一张，所以这句话摆一处就够。 */}
        {这一档.isError && (
          <p className="text-sm text-debt mb-2">
            取不到这一份 —— 下面的空表不代表底档是空的。
          </p>
        )}

        {tab === 'products' && (
          <div className="panel">
            <table className="tbl">
              <thead><tr>
                <th>编号</th><th>代号</th><th>名称</th><th>分类</th><th>类别</th>
                <th>履约</th><th>状态</th><th>可见 region</th><th>更新</th>
              </tr></thead>
              <tbody>{显示.map((p: any) => (
                <tr key={p.id}>
                  <td className="id">{shortId(p.id)}</td>
                  <td className="id">{p.code}</td>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-ink-4">{enumLabel(p.category)}</td>
                  <td><span className="text-ink-2">{enumLabel(p.kind)}</span></td>
                  <td className="text-ink-4">{enumLabel(p.fulfillment_kind)}</td>
                  <td><span className={statusClass(p.status)}>{statusLabel(p.status)}</span></td>
                  <td className="text-xs">
                    {(p.available_regions ?? []).map((r: string) => (
                      <span key={r} className="text-ink-3 mr-1">{r}</span>
                    ))}
                  </td>
                  <td title={ts(p.updated_at)}>{rel(p.updated_at)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === 'plans' && (
          <div className="panel">
            <table className="tbl">
              <thead><tr>
                <th>编号</th><th>名称</th><th>结算周期</th>
                <th>试用</th><th>宽限</th><th>取消策略</th><th>可用渠道</th><th>状态</th>
              </tr></thead>
              <tbody>{显示.map((p: any) => (
                <tr key={p.id}>
                  <td className="id">{shortId(p.id)}</td>
                  <td className="font-medium">{p.name}</td>
                  <td><span className="text-ink-2">{enumLabel(p.billing_period)}</span></td>
                  <td className="id">{p.trial_days}d</td>
                  <td className="id">{p.grace_days}d</td>
                  <td className="text-ink-4">{enumLabel(p.cancel_policy)}</td>
                  <td className="text-xs">
                    {(p.channel_constraints ?? []).slice(0,4).map((c: string) => (
                      <span key={c} className="text-ink-3 mr-1">{c}</span>
                    ))}
                    {(p.channel_constraints ?? []).length > 4 && <span className="text-ink-4">…</span>}
                  </td>
                  <td><span className={statusClass(p.status)}>{statusLabel(p.status)}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === 'accounts' && (
          <div className="panel">
            <table className="tbl">
              <thead><tr><th>代号</th><th>名称</th><th>类别</th><th>上级</th><th>币种约束</th></tr></thead>
              <tbody>{显示.map((a: any) => (
                <tr key={a.code}>
                  <td className="id">{a.code}</td>
                  <td className="font-medium">{a.name}</td>
                  <td><span className={`${
                    a.kind === 'asset' ? 'text-settled' :
                    a.kind === 'liability' ? 'text-pending' :
                    a.kind === 'revenue' ? 'text-settled' :
                    a.kind === 'expense' ? 'text-debt' : 'text-ink-3'
                  }`}>{enumLabel(a.kind)}</span></td>
                  <td className="font-mono text-ink-4">{a.parent_code ?? '—'}</td>
                  <td className="text-ink-4">{a.currency_constraint ?? '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === 'risk' && (
          <div className="panel">
            <table className="tbl">
              <thead><tr>
                <th>名称</th><th>类别</th><th>条件</th><th>动作</th>
                <th>优先</th><th>已部署 region</th>
              </tr></thead>
              <tbody>{显示.map((r: any, i: number) => (
                <tr key={i}>
                  <td className="font-medium">{r.name}</td>
                  <td><span className="text-ink-2">{enumLabel(r.kind)}</span></td>
                  <td className="font-mono text-xs text-ink-3">{r.expression}</td>
                  <td><span className={`${
                    r.action === 'review' ? 'text-pending' :
                    r.action === 'block' ? 'text-debt' :
                    r.action === 'challenge' ? 'text-pending' : 'text-ink-2'
                  }`}>{enumLabel(r.action)}</span></td>
                  <td className="r font-mono">{r.priority}</td>
                  <td className="text-xs">
                    {(r.deployed_regions ?? []).map((reg: string) => (
                      <span key={reg} className="text-ink-3 mr-1">{reg}</span>
                    ))}
                    <span className="text-ink-4">· {r.deployed_count} cell</span>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === 'rates' && (
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">汇率（基准 USD，用于 global 视图折算）</div>
              <span className="label text-ink-4">mock data · P3 接 ECB/FED API</span>
            </div>
            <table className="tbl">
              <thead><tr><th>币种</th><th className="r">1 单位 → USD</th><th>取数源</th><th>生效</th></tr></thead>
              <tbody>{显示.map((r: any) => (
                <tr key={r.quote_currency}>
                  <td className="font-mono font-semibold">{r.quote_currency}</td>
                  <td className="r font-mono num">{Number(r.rate).toFixed(6)} USD</td>
                  <td className="text-ink-4">汇率视图</td>
                  <td title={ts(r.effective_from)}>{rel(r.effective_from)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
