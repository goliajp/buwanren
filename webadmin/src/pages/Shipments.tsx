import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import Drawer from '../components/Drawer';
import { rel, ts, yuan, shortId, statusChip, carrierLabel } from '../components/util';
import { Eye, Edit3, AlertTriangle, RefreshCw, Truck } from 'lucide-react';

const SHIPMENT_STATUSES = ['preparing','picked_up','in_transit','out_for_delivery','delivered','exception','returning','returned','cancelled'];
const CARRIERS = ['sf','jd','zto','yto','yunda','sto','ems','manual'];

export default function Shipments() {
  const qc = useQueryClient();
  const [filt, setFilt] = useState<Record<string, any>>({ size: 50, page: 0 });
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['shipments', filt],
    queryFn: () => commerce.listShipments(filt),
    placeholderData: (p) => p,
  });
  const detail = useQuery({
    queryKey: ['shipment', detailId],
    queryFn: () => commerce.getShipment(detailId!),
    enabled: !!detailId,
  });

  const stats = useMemo(() => {
    const items = list.data?.items ?? [];
    const exc = items.filter((s: any) => s.status === 'exception').length;
    return [
      { label: '当前页', value: items.length },
      { label: '总数', value: list.data?.total ?? 0 },
      { label: '异常', value: exc, tone: exc ? 'bad' as const : undefined },
    ];
  }, [list.data]);

  return (
    <div>
      <PageHeader title="物流 · Shipments" sub="commerce v2 · shipment + shipment_trace_event · 只 trace 不仓储" stats={stats} />
      <div className="p-4">
        <FilterBar
          fields={[
            { kind: 'text',   key: 'keyword', label: 'keyword', placeholder: 'id / 单号 / order_id', width: 240 },
            { kind: 'select', key: 'status', label: 'status', options: SHIPMENT_STATUSES.map(v => ({ v, label: v })) },
            { kind: 'select', key: 'carrier_code', label: 'carrier', options: CARRIERS.map(v => ({ v, label: carrierLabel(v) })), width: 130 },
            { kind: 'text',   key: 'order_id', label: 'order_id', width: 180 },
            { kind: 'bool',   key: 'exception_only', label: '只看异常+退货' },
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
              <th>id</th><th>order</th><th>承运商</th><th>单号</th><th>状态</th><th>方式</th>
              <th className="r">成本</th><th>取件</th><th>送达</th><th>更新</th>
              <th className="c">动作</th>
            </tr></thead>
            <tbody>
              {(list.data?.items ?? []).map((s: any) => (
                <tr key={s.id} className={s.status === 'exception' ? 'bg-vermilion-soft/30' : ''}>
                  <td className="mono">{shortId(s.id)}</td>
                  <td className="mono text-ink-3">{shortId(s.order_id)}</td>
                  <td>{carrierLabel(s.carrier_code)}</td>
                  <td className="mono">{s.tracking_no ?? <span className="text-ink-5">未录入</span>}</td>
                  <td><span className={statusChip(s.status)}>{s.status}</span></td>
                  <td className="text-ink-4">{s.shipping_method}</td>
                  <td className="r">{s.cost_minor ? yuan(s.cost_minor, s.cost_currency || 'CNY') : '—'}</td>
                  <td title={ts(s.picked_up_at)}>{rel(s.picked_up_at)}</td>
                  <td title={ts(s.delivered_at)}>{rel(s.delivered_at)}</td>
                  <td title={ts(s.updated_at)} className="text-ink-4">{rel(s.updated_at)}</td>
                  <td className="c"><button className="btn btn-link" onClick={() => setDetailId(s.id)}><Eye size={13}/></button></td>
                </tr>
              ))}
              {list.data && list.data.items.length === 0 && (
                <tr><td colSpan={11} className="text-center py-10 text-ink-5">— 暂无包裹 —</td></tr>
              )}
            </tbody>
          </table>
          {list.data && (
            <Pagination page={filt.page ?? 0} size={filt.size ?? 50} total={list.data.total} onPage={(p) => setFilt({ ...filt, page: p })} />
          )}
        </div>
      </div>

      <Drawer
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detail.data?.shipment ? `包裹 · ${shortId(detail.data.shipment.id, 10, 6)}` : '包裹详情'}
        subtitle={detail.data?.shipment ? `${detail.data.shipment.status} · ${carrierLabel(detail.data.shipment.carrier_code)}` : '加载中'}
        width={760}
        actions={detail.data?.shipment && <ShipActions s={detail.data.shipment} onChanged={() => { qc.invalidateQueries({queryKey:['shipments']}); qc.invalidateQueries({queryKey:['shipment', detailId]}); }} />}
      >
        {detail.data && <ShipmentBody data={detail.data} />}
      </Drawer>
    </div>
  );
}

function ShipActions({ s, onChanged }: { s: any; onChanged: () => void }) {
  const assign = useApiMutation({
    mutationFn: (b: any) => commerce.assignTracking(s.id, b),
    onSuccess: onChanged,
  });
  const exc = useApiMutation({
    mutationFn: (reason: string) => commerce.markShipmentException(s.id, reason),
    onSuccess: onChanged,
  });
  return (
    <>
      {(s.status === 'preparing' || !s.tracking_no) && (
        <button className="btn btn-prim" onClick={() => {
          const carrier = prompt('承运商 code(sf/jd/zto/...)', s.carrier_code) || s.carrier_code;
          const tn = prompt('运单号'); if (!tn) return;
          const cost = prompt('成本 ¥ （留空=不填）');
          assign.mutate({
            carrier_code: carrier, tracking_no: tn,
            cost_minor: cost ? Number(cost) * 100 : undefined,
            cost_currency: cost ? 'CNY' : undefined,
          });
        }}><Edit3 size={13}/> 录入运单号</button>
      )}
      <button className="btn btn-warn" onClick={() => { const r = prompt('异常原因？'); if (r) exc.mutate(r); }}>
        <AlertTriangle size={13}/> 标异常
      </button>
    </>
  );
}

function ShipmentBody({ data }: { data: any }) {
  const { shipment, trace } = data;
  return (
    <div className="space-y-5 text-[12.5px]">
      <section>
        <h3 className="font-semibold mb-2 flex items-center gap-1.5"><Truck size={13}/> 基本</h3>
        <KvGrid kv={[
          ['id', <span className="mono">{shipment.id}</span>],
          ['order_id', <span className="mono">{shipment.order_id}</span>],
          ['承运商', carrierLabel(shipment.carrier_code)],
          ['运单号', <span className="mono font-semibold">{shipment.tracking_no ?? '—'}</span>],
          ['状态', <span className={statusChip(shipment.status)}>{shipment.status}</span>],
          ['运输方式', shipment.shipping_method],
          ['重量', shipment.weight_g ? `${shipment.weight_g} g` : '—'],
          ['成本', shipment.cost_minor ? yuan(shipment.cost_minor, shipment.cost_currency || 'CNY') : '—'],
          ['取件时间', ts(shipment.picked_up_at)],
          ['送达时间', ts(shipment.delivered_at)],
          ['创建', ts(shipment.created_at)],
          ['更新', ts(shipment.updated_at)],
        ]} />
      </section>

      <section>
        <h3 className="font-semibold mb-2">物流轨迹 ({trace?.length ?? 0})</h3>
        <div className="space-y-0">
          {(trace ?? []).map((e: any, i: number) => (
            <div key={e.id} className="flex gap-3 py-2 border-b border-border/50">
              <div className={`w-1.5 mt-1 h-1.5 rounded-full flex-shrink-0 ${i === 0 ? 'bg-jade' : 'bg-ink-5'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[12px]">{e.event_kind}</span>
                  {e.location && <span className="text-ink-4 text-[11px]">{e.location}</span>}
                  <span className="uplabel text-ink-5 ml-auto">{e.raw_source}</span>
                </div>
                <div className="text-ink-3 text-[12px] mt-0.5">{e.description}</div>
                <div className="text-ink-5 text-[11px] mono mt-0.5">{ts(e.event_at)}</div>
              </div>
            </div>
          ))}
          {(!trace || trace.length === 0) && (
            <div className="py-6 text-center text-ink-5">— 暂无 trace，需录入运单号 + 等 sweeper 拉取 —</div>
          )}
        </div>
      </section>
    </div>
  );
}

function KvGrid({ kv }: { kv: [string, React.ReactNode][] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
      {kv.map(([k, v], i) => (
        <div key={i} className="flex items-center justify-between border-b border-border/50 py-1">
          <span className="uplabel text-ink-5">{k}</span>
          <span className="text-ink-2">{v}</span>
        </div>
      ))}
    </div>
  );
}
