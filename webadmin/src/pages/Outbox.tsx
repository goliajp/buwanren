import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import Drawer from '../components/Drawer';
import { rel, ts, shortId, statusChip } from '../components/util';
import { Eye, RefreshCw, Repeat, AlertOctagon, CheckCircle2 } from 'lucide-react';

const STATUSES = ['pending','dispatched','failed','dropped'];
const AGGREGATE_KINDS = ['order','payment','refund','shipment','subscription','coupon','risk','journal'];

export default function Outbox() {
  const qc = useQueryClient();
  const [filt, setFilt] = useState<Record<string, any>>({ size: 50, page: 0 });
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['outbox', filt],
    queryFn: () => commerce.listOutbox(filt),
    placeholderData: (p) => p,
    refetchInterval: 10_000,    // 自动刷新让 user 看自演化
  });
  const detail = useQuery({
    queryKey: ['outbox-detail', detailId],
    queryFn: () => commerce.getOutbox(detailId!),
    enabled: !!detailId,
  });
  const retry = useApiMutation({
    mutationFn: (id: string) => commerce.retryOutbox(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outbox'] }),
  });

  const stats = useMemo(() => {
    const items = list.data?.items ?? [];
    const counts = { pending: 0, dispatched: 0, failed: 0, dropped: 0 };
    for (const e of items) counts[e.status as keyof typeof counts] = (counts[e.status as keyof typeof counts] ?? 0) + 1;
    return [
      { label: '当前页', value: items.length },
      { label: '总数', value: list.data?.total ?? 0 },
      { label: '待处理', value: counts.pending, tone: counts.pending > 0 ? 'warn' as const : undefined },
      { label: '已派发', value: counts.dispatched, tone: 'ok' as const },
      { label: '失败', value: counts.failed, tone: counts.failed > 0 ? 'bad' as const : undefined },
    ];
  }, [list.data]);

  return (
    <div>
      <PageHeader
        title="Outbox 事件 · 自演化驾驶舱"
        sub="commerce v2 · outbox_event · 业务事件源 → dispatcher 异步分发 · 10s 自动刷新"
        stats={stats}
      />
      <div className="p-4">
        <FilterBar
          fields={[
            { kind: 'text',   key: 'keyword', label: 'keyword', placeholder: 'event id / aggregate id / kind', width: 280 },
            { kind: 'select', key: 'status',  label: 'status',  options: STATUSES.map(v => ({ v, label: v })) },
            { kind: 'select', key: 'aggregate_kind', label: 'aggregate', options: AGGREGATE_KINDS.map(v => ({ v, label: v })) },
            { kind: 'text',   key: 'kind', label: 'kind', placeholder: 'OrderPaid / RefundCompleted / …', width: 200 },
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
              <th>id</th>
              <th>kind</th>
              <th>aggregate</th>
              <th>状态</th>
              <th className="r">尝试</th>
              <th>创建</th>
              <th>下次重试</th>
              <th>last error</th>
              <th className="c">动作</th>
            </tr></thead>
            <tbody>
              {(list.data?.items ?? []).map((e: any) => (
                <tr key={e.id} className={
                  e.status === 'failed' ? 'bg-vermilion-soft/30' :
                  e.status === 'dropped' ? 'bg-surface-3' : ''
                }>
                  <td className="mono">{shortId(e.id)}</td>
                  <td><span className="font-medium">{e.kind}</span></td>
                  <td>
                    <span className="chip chip-info">{e.aggregate_kind}</span>
                    <span className="mono text-ink-3 text-[11px] ml-1">{shortId(e.aggregate_id, 8, 6)}</span>
                  </td>
                  <td>
                    {e.status === 'dispatched' && <span className={statusChip(e.status)}><CheckCircle2 size={9} className="inline mr-0.5"/>dispatched</span>}
                    {e.status === 'pending' && <span className={statusChip(e.status)}>pending</span>}
                    {e.status === 'failed' && <span className={statusChip(e.status)}><AlertOctagon size={9} className="inline mr-0.5"/>failed</span>}
                    {e.status === 'dropped' && <span className={statusChip(e.status)}>dropped</span>}
                  </td>
                  <td className="r mono">{e.attempt_count}</td>
                  <td title={ts(e.created_at)}>{rel(e.created_at)}</td>
                  <td title={ts(e.next_attempt_at)} className="text-ink-4">{e.status === 'pending' ? rel(e.next_attempt_at) : '—'}</td>
                  <td className="text-[10.5px] mono text-vermilion truncate max-w-[220px]" title={e.last_error || ''}>{e.last_error ? e.last_error.slice(0, 60) : ''}</td>
                  <td className="c flex justify-center gap-1">
                    <button className="btn btn-link" onClick={() => setDetailId(e.id)}><Eye size={13}/></button>
                    {(e.status === 'failed' || e.status === 'dropped') && (
                      <button className="btn btn-soft" title="重试" onClick={() => retry.mutate(e.id)}>
                        <Repeat size={13}/>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {list.data && list.data.items.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-ink-5">— 暂无 outbox 事件 —</td></tr>
              )}
            </tbody>
          </table>
          {list.data && (
            <Pagination
              page={filt.page ?? 0}
              size={filt.size ?? 50}
              total={list.data.total}
              onPage={(p) => setFilt({ ...filt, page: p })}
            />
          )}
        </div>
      </div>

      <Drawer
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detail.data?.kind ?? '事件详情'}
        subtitle={detail.data ? `${detail.data.aggregate_kind}:${shortId(detail.data.aggregate_id, 8, 6)} · ${detail.data.status}` : '加载中'}
        width={720}
      >
        {detail.data && (
          <div className="space-y-4 text-[12.5px]">
            <section>
              <h3 className="font-semibold mb-2">基本</h3>
              <KvGrid kv={[
                ['id', <span className="mono">{detail.data.id}</span>],
                ['kind', <strong>{detail.data.kind}</strong>],
                ['aggregate_kind', detail.data.aggregate_kind],
                ['aggregate_id', <span className="mono">{detail.data.aggregate_id}</span>],
                ['status', <span className={statusChip(detail.data.status)}>{detail.data.status}</span>],
                ['attempts', detail.data.attempt_count],
                ['next_attempt_at', ts(detail.data.next_attempt_at)],
                ['created_at', ts(detail.data.created_at)],
              ]} />
              {detail.data.last_error && (
                <div className="mt-3 px-3 py-2 bg-vermilion-soft text-vermilion rounded text-[12px] mono">{detail.data.last_error}</div>
              )}
            </section>
            <section>
              <h3 className="font-semibold mb-2">payload</h3>
              <pre className="bg-surface-2 p-3 rounded text-[11px] overflow-x-auto mono">
                {JSON.stringify(detail.data.payload_json, null, 2)}
              </pre>
            </section>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function KvGrid({ kv }: { kv: [string, React.ReactNode][] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
      {kv.map(([k, v], i) => (
        <div key={i} className="flex items-center justify-between border-b border-border/50 py-1">
          <span className="uplabel text-ink-5">{k}</span>
          <span className="text-ink-2 text-right">{v}</span>
        </div>
      ))}
    </div>
  );
}
