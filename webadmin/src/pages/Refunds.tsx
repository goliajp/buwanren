import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import { rel, ts, yuan, shortId, statusChip } from '../components/util';
import { Check, X, RefreshCw } from 'lucide-react';

const REFUND_STATUSES = ['requested','approved','processing','success','failed','cancelled'];

export default function Refunds() {
  const qc = useQueryClient();
  const [filt, setFilt] = useState<Record<string, any>>({ size: 50, page: 0 });
  const [draft, setDraft] = useState<Record<string, any>>({});

  const list = useQuery({
    queryKey: ['refunds', filt],
    queryFn: () => commerce.listRefunds(filt),
    placeholderData: (p) => p,
  });

  const stats = useMemo(() => {
    const items = list.data?.items ?? [];
    const sum = items.reduce((a: number, r: any) => a + (r.amount_minor ?? 0), 0);
    const pending = items.filter((r: any) => ['requested','approved','processing'].includes(r.status)).length;
    return [
      { label: '当前页', value: items.length },
      { label: '总数', value: list.data?.total ?? 0 },
      { label: '待处理', value: pending, tone: pending ? 'warn' as const : undefined },
      { label: '本页 ¥', value: yuan(sum) },
    ];
  }, [list.data]);

  const approve = useApiMutation({
    mutationFn: (id: string) => commerce.approveRefund(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['refunds'] }),
  });
  const deny = useApiMutation({
    mutationFn: (v: { id: string; reason: string }) => commerce.denyRefund(v.id, v.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['refunds'] }),
  });

  return (
    <div>
      <PageHeader title="退款 · Refunds" sub="commerce v2 · refund + 审核 + 状态机" stats={stats} />
      <div className="p-4">
        <FilterBar
          fields={[
            { kind: 'select', key: 'status', label: 'status', options: REFUND_STATUSES.map(v => ({ v, label: v })) },
            { kind: 'date', key: 'from', label: '从' },
            { kind: 'date', key: 'to', label: '到' },
          ]}
          values={draft}
          onChange={setDraft}
          onSearch={() => setFilt({ ...draft, size: 50, page: 0 })}
          onReset={() => { setDraft({}); setFilt({ size: 50, page: 0 }); }}
          right={<button className="btn btn-soft" onClick={() => list.refetch()}><RefreshCw size={13}/> 刷新</button>}
        />
        <div className="panel">
          <table className="wa-table">
            <thead><tr>
              <th>id</th><th>order</th><th>payment</th><th>状态</th><th>来源</th><th>原因</th>
              <th className="r">金额</th><th>创建</th><th>审核</th><th>完成</th><th className="c">动作</th>
            </tr></thead>
            <tbody>
              {(list.data?.items ?? []).map((r: any) => (
                <tr key={r.id}>
                  <td className="mono">{shortId(r.id)}</td>
                  <td className="mono text-ink-3">{shortId(r.order_id)}</td>
                  <td className="mono text-ink-3">{shortId(r.payment_id)}</td>
                  <td><span className={statusChip(r.status)}>{r.status}</span></td>
                  <td><span className={`chip ${r.actor_kind === 'user' ? 'chip-info' : 'chip-mute'}`}>{r.actor_kind}</span></td>
                  <td className="mono text-[11px]">{r.reason_code}</td>
                  <td className="r font-semibold">{yuan(r.amount_minor, r.currency)}</td>
                  <td title={ts(r.created_at)}>{rel(r.created_at)}</td>
                  <td title={ts(r.approved_at)}>{rel(r.approved_at)}</td>
                  <td title={ts(r.completed_at)}>{rel(r.completed_at)}</td>
                  <td className="c">
                    {r.status === 'requested' && (
                      <div className="flex gap-1 justify-center">
                        <button className="btn btn-soft" onClick={() => approve.mutate(r.id)} title="批准"><Check size={13}/></button>
                        <button className="btn btn-warn" onClick={() => { const why = prompt('拒绝理由?'); if (why) deny.mutate({ id: r.id, reason: why }); }} title="拒绝"><X size={13}/></button>
                      </div>
                    )}
                    {r.status === 'failed' && (
                      <button className="btn btn-soft" onClick={() => approve.mutate(r.id)} title="重试"><RefreshCw size={13}/></button>
                    )}
                  </td>
                </tr>
              ))}
              {list.data && list.data.items.length === 0 && (
                <tr><td colSpan={11} className="text-center py-10 text-ink-5">— 暂无退款 —</td></tr>
              )}
            </tbody>
          </table>
          {list.data && (
            <Pagination page={filt.page ?? 0} size={filt.size ?? 50} total={list.data.total} onPage={(p) => setFilt({ ...filt, page: p })} />
          )}
        </div>
      </div>
    </div>
  );
}
