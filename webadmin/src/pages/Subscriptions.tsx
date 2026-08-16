import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import { rel, ts, shortId, statusChip, channelLabel } from '../components/util';
import { X, ZapOff, RefreshCw } from 'lucide-react';

const STATUSES = ['trialing','active','past_due','grace','cancelled','expired','paused'];

export default function Subscriptions() {
  const qc = useQueryClient();
  const [filt, setFilt] = useState<Record<string, any>>({ size: 50, page: 0 });
  const [draft, setDraft] = useState<Record<string, any>>({});

  const plans = useQuery({ queryKey: ['plans'], queryFn: () => commerce.listPlans() });
  const list = useQuery({
    queryKey: ['subscriptions', filt],
    queryFn: () => commerce.listSubscriptions(filt),
    placeholderData: (p) => p,
  });

  const cancel = useApiMutation({
    mutationFn: (v: { id: string; immediate: boolean; reason: string }) =>
      commerce.cancelSubscription(v.id, v.immediate, v.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  });

  return (
    <div>
      <PageHeader title="订阅 · Subscriptions" sub="commerce v2 · plan + subscription + subscription_invoice + dunning" stats={[
        { label: 'plans', value: plans.data?.length ?? 0 },
        { label: '订阅总数', value: list.data?.total ?? 0 },
      ]} />
      <div className="p-4 space-y-4">
        <section>
          <div className="uplabel text-ink-5 mb-1.5 px-1">Plans · 订阅计划</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(plans.data ?? []).map((p: any) => (
              <div key={p.id} className="panel">
                <div className="p-3 border-b border-border">
                  <div className="font-semibold text-[13px]">{p.name}</div>
                  <div className="uplabel text-ink-5 mt-1">{p.billing_period} · 试用 {p.trial_days}d · 宽限 {p.grace_days}d</div>
                </div>
                <div className="p-3 text-[11.5px] text-ink-3 space-y-1">
                  <div>
                    <span className="uplabel text-ink-5 mr-2">cancel</span>
                    <span className={`chip ${p.cancel_policy === 'end_of_period' ? 'chip-info' : 'chip-warn'}`}>{p.cancel_policy}</span>
                  </div>
                  <div>
                    <span className="uplabel text-ink-5 mr-2">渠道</span>
                    <span className="mono">{(p.channel_constraints ?? []).length} 个</span>
                  </div>
                  <div>
                    <span className="uplabel text-ink-5 mr-2">status</span>
                    <span className={statusChip(p.status)}>{p.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="uplabel text-ink-5 mb-1.5 px-1">用户订阅</div>
          <FilterBar
            fields={[
              { kind: 'select', key: 'status', label: 'status', options: STATUSES.map(v => ({ v, label: v })) },
            ]}
            values={draft}
            onChange={setDraft}
            onSearch={() => setFilt({ ...draft, size: 50, page: 0 })}
            onReset={() => { setDraft({}); setFilt({ size: 50, page: 0 }); }}
            right={<button className="btn btn-soft" onClick={() => list.refetch()}><RefreshCw size={13}/></button>}
          />
          <div className="panel">
            <table className="wa-table">
              <thead><tr>
                <th>id</th><th>user</th><th>plan</th><th>状态</th><th>渠道</th>
                <th>本期开始</th><th>本期结束</th><th>下次扣费</th><th>取消@期末</th>
                <th className="c">动作</th>
              </tr></thead>
              <tbody>
                {(list.data?.items ?? []).map((s: any) => (
                  <tr key={s.id}>
                    <td className="mono">{shortId(s.id)}</td>
                    <td className="mono text-ink-3">{shortId(s.user_id)}</td>
                    <td>{s.plan_name ?? shortId(s.plan_id)}</td>
                    <td><span className={statusChip(s.status)}>{s.status}</span></td>
                    <td className="text-ink-4">{channelLabel(s.source_channel)}</td>
                    <td title={ts(s.current_period_start)}>{rel(s.current_period_start)}</td>
                    <td title={ts(s.current_period_end)}>{rel(s.current_period_end)}</td>
                    <td title={ts(s.next_billing_attempt_at)}>{rel(s.next_billing_attempt_at)}</td>
                    <td className="c">{s.cancel_at_period_end ? <span className="chip chip-warn">✓</span> : ''}</td>
                    <td className="c flex gap-1 justify-center">
                      {!s.cancel_at_period_end && ['trialing','active','past_due','grace','paused'].includes(s.status) && (
                        <>
                          <button className="btn btn-soft" title="期末取消"
                            onClick={() => { const r = prompt('取消理由?'); if (r) cancel.mutate({ id: s.id, immediate: false, reason: r }); }}>
                            <X size={13}/>
                          </button>
                          <button className="btn btn-warn" title="立即取消"
                            onClick={() => { if (!confirm('立即取消 + 不退本周期?')) return; const r = prompt('理由?') || ''; cancel.mutate({ id: s.id, immediate: true, reason: r }); }}>
                            <ZapOff size={13}/>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {list.data && list.data.items.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-10 text-ink-5">— 尚无订阅 —</td></tr>
                )}
              </tbody>
            </table>
            {list.data && <Pagination page={filt.page ?? 0} size={filt.size ?? 50} total={list.data.total} onPage={(p) => setFilt({ ...filt, page: p })} />}
          </div>
        </section>
      </div>
    </div>
  );
}
