import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { rel, ts, shortId, statusChip } from '../components/util';
import { Power, RefreshCw } from 'lucide-react';

export default function Risk() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'rules' | 'events' | 'cases'>('rules');
  const [page, setPage] = useState(0);

  const rules = useQuery({ queryKey: ['risk-rules'], queryFn: () => commerce.listRiskRules(), enabled: tab === 'rules' });
  const events = useQuery({
    queryKey: ['risk-events', page], queryFn: () => commerce.listRiskEvents({ page, size: 50 }), enabled: tab === 'events',
  });
  const cases = useQuery({
    queryKey: ['risk-cases', page], queryFn: () => commerce.listRiskCases({ page, size: 50 }), enabled: tab === 'cases',
  });

  const setState = useApiMutation({
    mutationFn: (v: { id: string; status: string }) => commerce.updateRiskRuleState(v.id, v.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk-rules'] }),
  });

  return (
    <div>
      <PageHeader title="风控 · Risk" sub="commerce v2 · risk_rule + risk_event + risk_case · 简易 DSL 规则引擎" stats={[
        { label: '规则', value: (rules.data ?? []).length },
        { label: '激活', value: (rules.data ?? []).filter((r: any) => r.status === 'active').length, tone: 'ok' as const },
      ]} />
      <div className="p-4">
        <div className="flex items-center gap-1 mb-3">
          {(['rules','events','cases'] as const).map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-prim' : 'btn-soft'}`}
              onClick={() => { setTab(t); setPage(0); }}>
              {t === 'rules' ? '规则' : t === 'events' ? '事件' : '案件'}
            </button>
          ))}
          <button className="btn btn-soft ml-auto" onClick={() => { rules.refetch(); events.refetch(); cases.refetch(); }}>
            <RefreshCw size={13}/> 刷新
          </button>
        </div>

        {tab === 'rules' && (
          <div className="panel">
            <table className="wa-table">
              <thead><tr><th>id</th><th>name</th><th>kind</th><th>expression</th><th>action</th><th className="r">priority</th><th>status</th><th>生效</th><th className="c">动作</th></tr></thead>
              <tbody>
                {(rules.data ?? []).map((r: any) => (
                  <tr key={r.id}>
                    <td className="mono">{r.id}</td>
                    <td className="font-medium">{r.name}</td>
                    <td><span className="chip chip-info">{r.kind}</span></td>
                    <td className="mono text-[11px] text-ink-3">{r.expression}</td>
                    <td><span className={`chip ${r.action === 'review' ? 'chip-warn' : r.action === 'block' ? 'chip-bad' : 'chip-info'}`}>{r.action}</span></td>
                    <td className="r mono">{r.priority}</td>
                    <td><span className={statusChip(r.status)}>{r.status}</span></td>
                    <td title={ts(r.effective_from)}>{rel(r.effective_from)}</td>
                    <td className="c">
                      <button className={`btn ${r.status === 'active' ? 'btn-warn' : 'btn-soft'}`}
                        onClick={() => setState.mutate({ id: r.id, status: r.status === 'active' ? 'paused' : 'active' })}>
                        <Power size={13}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'events' && (
          <div className="panel">
            <table className="wa-table">
              <thead><tr><th>id</th><th>kind</th><th>user</th><th>order</th><th>payment</th><th>action</th><th>命中规则</th><th>时间</th></tr></thead>
              <tbody>
                {(events.data?.items ?? []).map((e: any) => (
                  <tr key={e.id}>
                    <td className="mono">{shortId(e.id)}</td>
                    <td className="mono">{e.kind}</td>
                    <td className="mono text-ink-3">{e.user_id ? shortId(e.user_id) : '—'}</td>
                    <td className="mono text-ink-3">{e.order_id ? shortId(e.order_id) : '—'}</td>
                    <td className="mono text-ink-3">{e.payment_id ? shortId(e.payment_id) : '—'}</td>
                    <td><span className={`chip ${e.decided_action === 'block' ? 'chip-bad' : e.decided_action === 'review' ? 'chip-warn' : 'chip-info'}`}>{e.decided_action}</span></td>
                    <td className="text-[11px]">{(e.matched_rule_ids ?? []).join(', ')}</td>
                    <td>{rel(e.decided_at)}</td>
                  </tr>
                ))}
                {events.data && events.data.items.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-ink-5">— 无风控事件 —</td></tr>
                )}
              </tbody>
            </table>
            {events.data && <Pagination page={page} size={50} total={events.data.total} onPage={setPage} />}
          </div>
        )}

        {tab === 'cases' && (
          <div className="panel">
            <table className="wa-table">
              <thead><tr><th>id</th><th>kind</th><th>severity</th><th>state</th><th>负责</th><th>opened</th><th>closed</th><th>note</th></tr></thead>
              <tbody>
                {(cases.data?.items ?? []).map((c: any) => (
                  <tr key={c.id}>
                    <td className="mono">{shortId(c.id)}</td>
                    <td>{c.kind}</td>
                    <td><span className={`chip ${c.severity === 'critical' ? 'chip-bad' : c.severity === 'high' ? 'chip-warn' : 'chip-info'}`}>{c.severity}</span></td>
                    <td><span className={statusChip(c.state)}>{c.state}</span></td>
                    <td className="mono text-ink-3">{c.assigned_admin_id ?? '—'}</td>
                    <td>{rel(c.opened_at)}</td>
                    <td>{rel(c.closed_at)}</td>
                    <td className="text-[11px] text-ink-4 truncate max-w-[300px]">{c.audit_note}</td>
                  </tr>
                ))}
                {cases.data && cases.data.items.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-ink-5">— 无案件 —</td></tr>
                )}
              </tbody>
            </table>
            {cases.data && <Pagination page={page} size={50} total={cases.data.total} onPage={setPage} />}
          </div>
        )}
      </div>
    </div>
  );
}
