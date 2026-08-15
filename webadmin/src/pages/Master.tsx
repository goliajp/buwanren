import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { rel, ts, statusChip, shortId } from '../components/util';
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

  return (
    <div>
      <PageHeader
        title="Master Data · 集团主数据(control plane)"
        sub="global · 集中维护 + push 到 6 cell · read-only 视图"
        stats={[
          { label: 'SPU 商品', value: products.data?.length ?? '—' },
          { label: 'Plans', value: plans.data?.length ?? '—' },
          { label: '科目', value: chart.data?.length ?? '—' },
          { label: '风控模板', value: risk.data?.length ?? '—' },
        ]}
      />
      <div className="p-4">
        <div className="mb-3 p-3 panel bg-jade-soft border-jade">
          <div className="flex items-start gap-2 text-[12px] text-jade">
            <Globe2 size={13} className="mt-0.5"/>
            <div>
              <div className="font-semibold mb-0.5">这是集团主数据视图(control plane)</div>
              <div className="text-ink-3 leading-relaxed">
                本工作台数据**与 6 cell 解耦**:SPU / Plan 模板 / 会计科目 / 风控规则模板 集中存放,
                改一处自动 push 到所有 cell 副本。各 cell 不允许直接造主数据 —— 各 cell 看到的是 push 后的快照。
                P2 落地后会加 「同步状态 / version skew / push 失败」可视化;P1 阶段先用「集中读」证明可行。
              </div>
            </div>
          </div>
        </div>

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
          <button className="btn btn-soft ml-auto" onClick={() => {
            products.refetch(); plans.refetch(); chart.refetch(); risk.refetch(); rates.refetch();
          }}><RefreshCw size={13}/></button>
        </div>

        {tab === 'products' && (
          <div className="panel">
            <table className="wa-table">
              <thead><tr>
                <th>id</th><th>code</th><th>名称</th><th>category</th><th>kind</th>
                <th>履约</th><th>状态</th><th>可见 region</th><th>更新</th>
              </tr></thead>
              <tbody>{(products.data ?? []).map((p: any) => (
                <tr key={p.id}>
                  <td className="mono">{shortId(p.id)}</td>
                  <td className="mono">{p.code}</td>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-ink-4">{p.category}</td>
                  <td><span className="chip chip-info">{p.kind}</span></td>
                  <td className="text-ink-4">{p.fulfillment_kind}</td>
                  <td><span className={statusChip(p.status)}>{p.status}</span></td>
                  <td className="text-[11px]">
                    {(p.available_regions ?? []).map((r: string) => (
                      <span key={r} className="chip chip-mute mr-1">{r}</span>
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
            <table className="wa-table">
              <thead><tr>
                <th>id</th><th>name</th><th>billing</th>
                <th>试用</th><th>宽限</th><th>取消策略</th><th>可用渠道</th><th>状态</th>
              </tr></thead>
              <tbody>{(plans.data ?? []).map((p: any) => (
                <tr key={p.id}>
                  <td className="mono">{shortId(p.id)}</td>
                  <td className="font-medium">{p.name}</td>
                  <td><span className="chip chip-info">{p.billing_period}</span></td>
                  <td className="mono">{p.trial_days}d</td>
                  <td className="mono">{p.grace_days}d</td>
                  <td className="text-ink-4">{p.cancel_policy}</td>
                  <td className="text-[11px]">
                    {(p.channel_constraints ?? []).slice(0,4).map((c: string) => (
                      <span key={c} className="chip chip-mute mr-1">{c}</span>
                    ))}
                    {(p.channel_constraints ?? []).length > 4 && <span className="text-ink-5">…</span>}
                  </td>
                  <td><span className={statusChip(p.status)}>{p.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === 'accounts' && (
          <div className="panel">
            <table className="wa-table">
              <thead><tr><th>code</th><th>名称</th><th>kind</th><th>parent</th><th>币种约束</th></tr></thead>
              <tbody>{(chart.data ?? []).map((a: any) => (
                <tr key={a.code}>
                  <td className="mono">{a.code}</td>
                  <td className="font-medium">{a.name}</td>
                  <td><span className={`chip ${
                    a.kind === 'asset' ? 'chip-ok' :
                    a.kind === 'liability' ? 'chip-warn' :
                    a.kind === 'revenue' ? 'chip-ok' :
                    a.kind === 'expense' ? 'chip-bad' : 'chip-mute'
                  }`}>{a.kind}</span></td>
                  <td className="mono text-ink-4">{a.parent_code ?? '—'}</td>
                  <td className="text-ink-4">{a.currency_constraint ?? '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === 'risk' && (
          <div className="panel">
            <table className="wa-table">
              <thead><tr>
                <th>name</th><th>kind</th><th>expression</th><th>action</th>
                <th>priority</th><th>已部署 region</th>
              </tr></thead>
              <tbody>{(risk.data ?? []).map((r: any, i: number) => (
                <tr key={i}>
                  <td className="font-medium">{r.name}</td>
                  <td><span className="chip chip-info">{r.kind}</span></td>
                  <td className="mono text-[11px] text-ink-3">{r.expression}</td>
                  <td><span className={`chip ${
                    r.action === 'review' ? 'chip-warn' :
                    r.action === 'block' ? 'chip-bad' :
                    r.action === 'challenge' ? 'chip-warn' : 'chip-info'
                  }`}>{r.action}</span></td>
                  <td className="r mono">{r.priority}</td>
                  <td className="text-[11px]">
                    {(r.deployed_regions ?? []).map((reg: string) => (
                      <span key={reg} className="chip chip-mute mr-1">{reg}</span>
                    ))}
                    <span className="text-ink-5">· {r.deployed_count} cell</span>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === 'rates' && (
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">汇率(基准 USD,用于 global 视图折算)</div>
              <span className="uplabel text-ink-5">mock data · P3 接 ECB/FED API</span>
            </div>
            <table className="wa-table">
              <thead><tr><th>币种</th><th className="r">1 单位 → USD</th><th>取数源</th><th>生效</th></tr></thead>
              <tbody>{(rates.data ?? []).map((r: any) => (
                <tr key={r.quote_currency}>
                  <td className="mono font-semibold">{r.quote_currency}</td>
                  <td className="r mono num">{Number(r.rate).toFixed(6)} USD</td>
                  <td className="text-ink-4">v_exchange_latest</td>
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
