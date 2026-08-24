import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import Drawer from '../components/Drawer';
import { rel, ts, yuan, shortId, statusChip, platformChip } from '../components/util';
import { Eye, X, MessageSquarePlus, RefreshCw } from 'lucide-react';

const ORDER_STATUSES = ['draft','unpaid','paid','fulfilling','done','cancelled','refund_partial','refunded','disputed'];
const CHANNEL_ORIGINS = ['wx_mp','wx_h5','ios','android','web','admin'];
const REGIONS = ['cn','hk','tw','jp','us','eu'];

export default function Orders() {
  const qc = useQueryClient();
  const [filt, setFilt] = useState<Record<string, any>>({ size: 50, page: 0 });
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['orders', filt],
    queryFn: () => commerce.listOrders(filt),
    placeholderData: (p) => p,
  });
  const detail = useQuery({
    queryKey: ['order', detailId],
    queryFn: () => commerce.getOrder(detailId!),
    enabled: !!detailId,
  });

  const reset = () => { setDraft({}); setFilt({ size: 50, page: 0 }); };

  const stats = useMemo(() => {
    const items = list.data?.items ?? [];
    const sumPaid = items.reduce((a: number, o: any) => a + (o.amount_paid_minor ?? 0), 0);
    return [
      { label: '当前页', value: items.length },
      { label: '总数', value: list.data?.total ?? 0 },
      { label: '本页已付 ¥', value: yuan(sumPaid) },
    ];
  }, [list.data]);

  return (
    <div>
      <PageHeader title="订单 · Orders" sub={`commerce v2 · order_record + order_line + order_event + order_meta`} stats={stats} />
      <div className="p-4">
        <FilterBar
          fields={[
            { kind: 'text',   key: 'keyword', label: 'keyword', placeholder: 'id / user_id', width: 220 },
            { kind: 'select', key: 'status',  label: 'status',  options: ORDER_STATUSES.map(v => ({ v, label: v })) },
            { kind: 'select', key: 'channel_origin', label: 'channel', options: CHANNEL_ORIGINS.map(v => ({ v, label: v })) },
            { kind: 'select', key: 'region', label: 'region', options: REGIONS.map(v => ({ v, label: v })), width: 100 },
            { kind: 'number', key: 'amount_min_minor', label: '金额 ≥ 分', placeholder: '9900' },
            { kind: 'number', key: 'amount_max_minor', label: '金额 ≤ 分', placeholder: '50000' },
            { kind: 'date',   key: 'from', label: '从' },
            { kind: 'date',   key: 'to',   label: '到' },
          ]}
          values={draft}
          onChange={setDraft}
          onSearch={() => setFilt({ ...draft, size: 50, page: 0 })}
          onReset={reset}
          right={<button className="btn btn-soft" onClick={() => list.refetch()}><RefreshCw size={13}/> 刷新</button>}
        />

        <div className="panel">
          <table className="wa-table">
            <thead><tr>
              <th>id</th>
              <th>用户</th>
              <th>渠道</th>
              <th>region</th>
              <th>状态</th>
              <th className="r">应付</th>
              <th className="r">已付</th>
              <th className="r">已退</th>
              <th>创建</th>
              <th>更新</th>
              <th className="c">动作</th>
            </tr></thead>
            <tbody>
              {(list.data?.items ?? []).map((o: any) => (
                <tr key={o.id}>
                  <td className="mono">{shortId(o.id)}</td>
                  <td className="mono text-ink-3">{shortId(o.user_id)}</td>
                  <td><span className={platformChip(o.channel_origin)}>{o.channel_origin}</span></td>
                  <td className="mono text-ink-4">{o.region}</td>
                  <td><span className={statusChip(o.status)}>{o.status}</span></td>
                  <td className="r font-semibold">{yuan(o.amount_total_minor, o.currency)}</td>
                  <td className="r text-jade">{yuan(o.amount_paid_minor, o.currency)}</td>
                  <td className="r text-vermilion">{o.amount_refunded_minor > 0 ? yuan(o.amount_refunded_minor, o.currency) : '—'}</td>
                  <td title={ts(o.created_at)}>{rel(o.created_at)}</td>
                  <td title={ts(o.updated_at)}>{rel(o.updated_at)}</td>
                  <td className="c">
                    <button className="btn btn-link" onClick={() => setDetailId(o.id)}><Eye size={13}/></button>
                  </td>
                </tr>
              ))}
              {list.data && list.data.items.length === 0 && (
                <tr><td colSpan={11} className="text-center py-10 text-ink-5">— 无数据 —</td></tr>
              )}
              {list.isLoading && (
                <tr><td colSpan={11} className="text-center py-10 text-ink-4">加载中…</td></tr>
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
        title={detail.data?.order?.id ? `订单 · ${shortId(detail.data.order.id, 8, 6)}` : '订单详情'}
        subtitle={detail.data?.order ? `${detail.data.order.status} · ${detail.data.order.channel_origin} · ${detail.data.order.region}` : '加载中'}
        width={760}
        actions={detail.data?.order && <OrderActions order={detail.data.order} onChanged={() => { qc.invalidateQueries({queryKey:['order', detailId]}); qc.invalidateQueries({queryKey:['orders']}); }} />}
      >
        {detail.data && <OrderDetailBody data={detail.data} />}
      </Drawer>
    </div>
  );
}

function OrderActions({ order, onChanged }: { order: any; onChanged: () => void }) {
  // 与后端状态机对齐:Paid → [Fulfilling, Done, RefundPartial, Refunded, Disputed],
  // 没有 Cancelled。已付订单要走退款,直接取消会留下「钱收了、订单没了、
  // 没有退款记录」的窟窿,后端现在会返回 409。
  //
  // 这里原本抄了一份旧的 ['draft','unpaid','paid','fulfilling'],
  // 结果是按钮照给、点下去后端拒绝 —— 前端手抄后端枚举的老问题。
  const cancellable = ['draft', 'unpaid'].includes(order.status);
  const needsRefundInstead = ['paid', 'fulfilling', 'done'].includes(order.status);
  const cancelMut = useApiMutation({
    mutationFn: (reason: string) => commerce.cancelOrder(order.id, reason),
    onSuccess: onChanged,
  });
  return (
    <>
      <button className="btn btn-warn" disabled={!cancellable}
        onClick={() => {
          const r = prompt('取消理由？'); if (r) cancelMut.mutate(r);
        }}><X size={13}/> 取消订单</button>
      {/* 按钮置灰要说明为什么,否则运营只会以为是坏了 */}
      {needsRefundInstead && (
        <span className="text-[11px] text-ink-5 ml-2">已付订单请走退款</span>
      )}
    </>
  );
}

function OrderDetailBody({ data }: { data: any }) {
  const { order, lines, events, payments, refunds, shipments } = data;
  return (
    <div className="space-y-5">
      <section>
        <SectionTitle title="基本" />
        <KvGrid kv={[
          ['id', <span className="mono">{order.id}</span>],
          ['user_id', <span className="mono">{order.user_id}</span>],
          ['状态', <span className={statusChip(order.status)}>{order.status}</span>],
          ['渠道', order.channel_origin],
          ['region', order.region],
          ['来源', order.source_kind],
          ['货币', order.currency],
          ['应付', <strong>{yuan(order.amount_total_minor, order.currency)}</strong>],
          ['已付', <span className="text-jade">{yuan(order.amount_paid_minor, order.currency)}</span>],
          ['已退', <span className="text-vermilion">{yuan(order.amount_refunded_minor, order.currency)}</span>],
          ['折扣', yuan(order.amount_discount_minor, order.currency)],
          ['运费', yuan(order.amount_shipping_minor, order.currency)],
          ['过期时间', ts(order.expires_at)],
          ['付款时间', ts(order.paid_at)],
          ['完成时间', ts(order.fulfilled_at)],
          ['创建时间', ts(order.created_at)],
        ]} />
        {order.audit_note && (
          <div className="mt-2 px-3 py-2 bg-surface-2 rounded text-[11.5px] text-ink-3 whitespace-pre-wrap mono">{order.audit_note}</div>
        )}
      </section>

      <section>
        <SectionTitle title={`明细行 (${lines?.length ?? 0})`} />
        <table className="wa-table">
          <thead><tr><th>#</th><th>sku_id</th><th className="r">单价</th><th className="r">数量</th><th className="r">小计</th><th className="r">折扣</th><th>履约</th></tr></thead>
          <tbody>
            {(lines ?? []).map((l: any) => (
              <tr key={l.id}>
                <td className="mono">{l.line_no}</td>
                <td className="mono">{shortId(l.sku_id, 10, 6)}</td>
                <td className="r">{yuan(l.unit_price_minor, order.currency)}</td>
                <td className="r mono">×{l.qty}</td>
                <td className="r">{yuan(l.line_subtotal_minor, order.currency)}</td>
                <td className="r text-vermilion">{l.applied_discount_minor ? yuan(l.applied_discount_minor, order.currency) : '—'}</td>
                <td><span className={statusChip(l.fulfillment_status)}>{l.fulfillment_status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {(payments?.length ?? 0) > 0 && (
        <section>
          <SectionTitle title={`关联支付 (${payments.length})`} />
          <table className="wa-table">
            <thead><tr><th>id</th><th>渠道</th><th>状态</th><th className="r">金额</th><th>时间</th></tr></thead>
            <tbody>{payments.map((p: any) => (
              <tr key={p.id}>
                <td className="mono">{shortId(p.id)}</td>
                <td className="mono">{p.channel}</td>
                <td><span className={statusChip(p.status)}>{p.status}</span></td>
                <td className="r">{yuan(p.amount_minor, p.currency)}</td>
                <td>{rel(p.paid_at ?? p.created_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}

      {(refunds?.length ?? 0) > 0 && (
        <section>
          <SectionTitle title={`退款 (${refunds.length})`} />
          <table className="wa-table">
            <thead><tr><th>id</th><th>状态</th><th>原因</th><th className="r">金额</th><th>时间</th></tr></thead>
            <tbody>{refunds.map((r: any) => (
              <tr key={r.id}>
                <td className="mono">{shortId(r.id)}</td>
                <td><span className={statusChip(r.status)}>{r.status}</span></td>
                <td className="mono text-ink-3">{r.reason_code}</td>
                <td className="r">{yuan(r.amount_minor)}</td>
                <td>{rel(r.created_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}

      {(shipments?.length ?? 0) > 0 && (
        <section>
          <SectionTitle title={`物流 (${shipments.length})`} />
          <table className="wa-table">
            <thead><tr><th>id</th><th>承运商</th><th>单号</th><th>状态</th><th>送达</th></tr></thead>
            <tbody>{shipments.map((s: any) => (
              <tr key={s.id}>
                <td className="mono">{shortId(s.id)}</td>
                <td className="mono">{s.carrier_code}</td>
                <td className="mono">{s.tracking_no ?? '—'}</td>
                <td><span className={statusChip(s.status)}>{s.status}</span></td>
                <td>{rel(s.delivered_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}

      <section>
        <SectionTitle title={`事件 (${events?.length ?? 0})`} icon={MessageSquarePlus} />
        <div className="space-y-0.5">
          {(events ?? []).map((e: any) => (
            <div key={e.id} className="flex items-center gap-3 py-1.5 px-2 border-b border-border/50 text-[12px]">
              <span className="mono text-ink-5 w-32">{ts(e.created_at)}</span>
              <span className={`chip ${e.actor_kind === 'admin' ? 'chip-info' : 'chip-mute'}`}>{e.actor_kind}</span>
              <span className="font-medium">{e.kind}</span>
              <span className="mono text-ink-4">{e.before_status} → {e.after_status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, icon: Ic }: { title: string; icon?: any }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {Ic && <Ic size={13} className="text-ink-4" />}
      <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
    </div>
  );
}

function KvGrid({ kv }: { kv: [string, React.ReactNode][] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
      {kv.map(([k, v], i) => (
        <div key={i} className="flex items-center justify-between border-b border-border/50 py-1">
          <span className="uplabel text-ink-5">{k}</span>
          <span className="text-[12.5px] text-ink-2">{v}</span>
        </div>
      ))}
    </div>
  );
}
