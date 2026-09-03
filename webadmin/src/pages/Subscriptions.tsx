import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import { rel, ts, shortId, statusClass, statusLabel, channelLabel, thou } from '../components/util';
import { X, ZapOff, RefreshCw } from 'lucide-react';

const STATUSES = ['trialing','active','past_due','grace','cancelled','expired','paused'];

export default function Subscriptions() {
  const qc = useQueryClient();
  const [filt, setFilt] = useState<Record<string, any>>({ size: 50, page: 0 });
  const [draft, setDraft] = useState<Record<string, any>>({});

  const list = useQuery({
    queryKey: ['subscriptions', filt],
    queryFn: () => commerce.listSubscriptions(filt),
    placeholderData: (p) => p,
  });

  /* 本页里扣款失败的条数。翻页时它只数当前这一页 —— 所以说的是
     「这一页里」，不假装是全量。真要全量得后端给个计数接口。 */
  const 欠费 = (list.data?.items ?? []).filter((x: any) => x.status === 'past_due').length;

  const cancel = useApiMutation({
    mutationFn: (v: { id: string; immediate: boolean; reason: string }) =>
      commerce.cancelSubscription(v.id, v.immediate, v.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  });

  return (
    <div>
      {/* 【主数是要处理的那个，不是总数】。2,425 个订阅里，
          今天该做点什么的是扣款失败的那几个。 */}
      <PageHeader
        title="订阅"
        sub="按月付的那些人：还在订的、要续的、扣款失败的"
        lead={欠费 ? { label: "本页扣款失败", value: thou(欠费), tone: "debt" } : undefined}
        stats={[{ label: '一共', value: thou(list.data?.total ?? 0) }]}
      />
      <div className="p-4 space-y-4">
        <section>
          <FilterBar
            fields={[
              { kind: 'select', key: 'status', label: '状态', options: STATUSES.map(v => ({ v, label: statusLabel(v) })) },
            ]}
            values={draft}
            onChange={setDraft}
            onSearch={() => setFilt({ ...draft, size: 50, page: 0 })}
            onReset={() => { setDraft({}); setFilt({ size: 50, page: 0 }); }}
            right={<button className="btn btn-soft" onClick={() => list.refetch()}><RefreshCw size={13}/></button>}
          />
          <div className="panel">
            <table className="tbl">
              <thead><tr>
                <th>编号</th><th>用户</th><th>套餐</th><th>状态</th><th>渠道</th>
                <th>本期开始</th><th>本期结束</th><th>下次扣费</th><th className="c">期末取消</th>
                <th className="c">动作</th>
              </tr></thead>
              <tbody>
                {(list.data?.items ?? []).map((s: any) => (
                  <tr key={s.id}>
                    <td className="id">{shortId(s.id)}</td>
                    <td className="font-mono text-ink-3">{shortId(s.user_id)}</td>
                    <td>{s.plan_name ?? shortId(s.plan_id)}</td>
                    <td><span className={statusClass(s.status)}>{statusLabel(s.status)}</span></td>
                    <td className="text-ink-4">{channelLabel(s.source_channel)}</td>
                    <td title={ts(s.current_period_start)}>{rel(s.current_period_start)}</td>
                    <td title={ts(s.current_period_end)}>{rel(s.current_period_end)}</td>
                    <td title={ts(s.next_billing_attempt_at)}>{rel(s.next_billing_attempt_at)}</td>
                    <td className="c">{s.cancel_at_period_end ? <span className="text-pending">✓</span> : ''}</td>
                    <td className="c flex gap-1 justify-center">
                      {!s.cancel_at_period_end && ['trialing','active','past_due','grace','paused'].includes(s.status) && (
                        <>
                          <button className="btn btn-soft" title="期末取消"
                            onClick={() => { const r = prompt('取消理由？'); if (r) cancel.mutate({ id: s.id, immediate: false, reason: r }); }}>
                            <X size={13}/>
                          </button>
                          <button className="btn btn-debt" title="立即取消"
                            onClick={() => { if (!confirm('立即取消 + 不退本周期？')) return; const r = prompt('理由？') || ''; cancel.mutate({ id: s.id, immediate: true, reason: r }); }}>
                            <ZapOff size={13}/>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {list.data && list.data.items.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-10 text-ink-4">还没有人订阅</td></tr>
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
