import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import Drawer from '../components/Drawer';
import { rel, ts, yuan, shortId, statusChip, channelLabel } from '../components/util';
import { Eye, AlertTriangle, RefreshCw } from 'lucide-react';

const PAYMENT_STATUSES = ['pending','processing','success','failed','expired','cancelling','cancelled','refunding','refunded_partial','refunded','disputed'];
const PAYMENT_CHANNELS = ['wechat_jsapi','wechat_mp','wechat_h5','wechat_native','alipay_wap','alipay_pc','alipay_mini','iap','gpb','stripe_card'];

export default function Payments() {
  const qc = useQueryClient();
  const [filt, setFilt] = useState<Record<string, any>>({ size: 50, page: 0 });
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['payments', filt],
    queryFn: () => commerce.listPayments(filt),
    placeholderData: (p) => p,
  });
  const detail = useQuery({
    queryKey: ['payment', detailId],
    queryFn: () => commerce.getPayment(detailId!),
    enabled: !!detailId,
  });

  const stats = useMemo(() => {
    const items = list.data?.items ?? [];
    const succ = items.filter((p: any) => p.status === 'success').reduce((a: number, p: any) => a + p.amount_minor, 0);
    return [
      { label: '当前页', value: items.length, tone: undefined },
      { label: '总数', value: list.data?.total ?? 0 },
      { label: '本页成功 ¥', value: yuan(succ), tone: 'ok' as const },
    ];
  }, [list.data]);

  return (
    <div>
      <PageHeader title="支付流水 · Payments" sub="commerce v2 · payment + payment_attempt + payment_event" stats={stats} />
      <div className="p-4">
        <FilterBar
          fields={[
            { kind: 'text',   key: 'keyword', label: 'keyword', placeholder: 'id / channel_txn / user_id', width: 240 },
            { kind: 'select', key: 'status',  label: 'status',  options: PAYMENT_STATUSES.map(v => ({ v, label: v })) },
            { kind: 'select', key: 'channel', label: 'channel', options: PAYMENT_CHANNELS.map(v => ({ v, label: channelLabel(v) })), width: 160 },
            { kind: 'text',   key: 'order_id', label: 'order_id', width: 180 },
            { kind: 'number', key: 'amount_min_minor', label: '金额 ≥ 分' },
            { kind: 'number', key: 'amount_max_minor', label: '金额 ≤ 分' },
            { kind: 'date',   key: 'from', label: '从' },
            { kind: 'date',   key: 'to',   label: '到' },
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
              <th>id</th><th>order</th><th>渠道</th><th>状态</th>
              <th className="r">金额</th>
              <th>渠道单号</th><th>付款时间</th><th>过期</th>
              <th className="c">动作</th>
            </tr></thead>
            <tbody>
              {(list.data?.items ?? []).map((p: any) => (
                <tr key={p.id}>
                  <td className="mono">{shortId(p.id)}</td>
                  <td className="mono text-ink-3">{shortId(p.order_id)}</td>
                  <td>{channelLabel(p.channel)}</td>
                  <td><span className={statusChip(p.status)}>{p.status}</span></td>
                  <td className="r font-semibold">{yuan(p.amount_minor, p.currency)}</td>
                  <td className="mono text-ink-3">{p.channel_txn_id ? shortId(p.channel_txn_id, 12, 6) : '—'}</td>
                  <td title={ts(p.paid_at)}>{rel(p.paid_at)}</td>
                  <td title={ts(p.expires_at)} className="text-ink-4">{rel(p.expires_at)}</td>
                  <td className="c"><button className="btn btn-link" onClick={() => setDetailId(p.id)}><Eye size={13}/></button></td>
                </tr>
              ))}
              {list.data && list.data.items.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-ink-5">— 无支付流水 —</td></tr>
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
        title={detail.data?.payment?.id ? `支付 · ${shortId(detail.data.payment.id, 10, 6)}` : '支付详情'}
        subtitle={detail.data?.payment ? `${detail.data.payment.status} · ${channelLabel(detail.data.payment.channel)}` : '加载中'}
        width={720}
        actions={detail.data?.payment && <PayActions p={detail.data.payment} onChanged={() => qc.invalidateQueries({queryKey:['payments']})} />}
      >
        {detail.data && <PaymentBody data={detail.data} />}
      </Drawer>
    </div>
  );
}

function PayActions({ p, onChanged }: { p: any; onChanged: () => void }) {
  const can = ['pending','processing','cancelling'].includes(p.status);
  const mut = useApiMutation({
    mutationFn: (b: { code: string; msg: string }) => commerce.markPaymentFailed(p.id, b.code, b.msg),
    onSuccess: onChanged,
  });
  return (
    <button className="btn btn-warn" disabled={!can}
      onClick={() => {
        const code = prompt('failure_code (如 channel_timeout / manual_fail)'); if (!code) return;
        const msg = prompt('failure_msg') ?? '';
        mut.mutate({ code, msg });
      }}><AlertTriangle size={13}/> 标失败</button>
  );
}

function PaymentBody({ data }: { data: any }) {
  const { payment, attempts, events, refunds } = data;
  return (
    <div className="space-y-5 text-[12.5px]">
      <section>
        <h3 className="font-semibold mb-2">基本</h3>
        <KvGrid kv={[
          ['id', <span className="mono">{payment.id}</span>],
          ['order_id', <span className="mono">{payment.order_id}</span>],
          ['user_id', <span className="mono">{payment.user_id}</span>],
          ['渠道', channelLabel(payment.channel)],
          ['状态', <span className={statusChip(payment.status)}>{payment.status}</span>],
          ['金额', <strong>{yuan(payment.amount_minor, payment.currency)}</strong>],
          ['渠道单号', <span className="mono">{payment.channel_txn_id ?? '—'}</span>],
          ['渠道用户', <span className="mono">{payment.channel_user_ref ?? '—'}</span>],
          ['付款时间', ts(payment.paid_at)],
          ['过期时间', ts(payment.expires_at)],
          ['失败码', payment.failure_code ?? '—'],
          ['失败说明', payment.failure_msg ?? '—'],
          ['创建', ts(payment.created_at)],
          ['更新', ts(payment.updated_at)],
        ]} />
      </section>

      {(refunds?.length ?? 0) > 0 && (
        <section>
          <h3 className="font-semibold mb-2">退款 ({refunds.length})</h3>
          <table className="wa-table"><thead><tr><th>id</th><th>状态</th><th>原因</th><th className="r">金额</th><th>时间</th></tr></thead>
            <tbody>{refunds.map((r:any) => (
              <tr key={r.id}>
                <td className="mono">{shortId(r.id)}</td>
                <td><span className={statusChip(r.status)}>{r.status}</span></td>
                <td className="mono">{r.reason_code}</td>
                <td className="r">{yuan(r.amount_minor)}</td>
                <td>{rel(r.created_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}

      <section>
        <h3 className="font-semibold mb-2">回调事件 ({events?.length ?? 0})</h3>
        <table className="wa-table"><thead><tr><th>kind</th><th>channel</th><th>event_id</th><th>received</th><th>processed</th></tr></thead>
          <tbody>{(events ?? []).map((e:any) => (
            <tr key={e.id}>
              <td className="font-medium">{e.kind}</td>
              <td className="mono">{e.channel}</td>
              <td className="mono text-ink-3">{e.channel_event_id ? shortId(e.channel_event_id, 10, 6) : '—'}</td>
              <td>{rel(e.received_at)}</td>
              <td>{rel(e.processed_at)}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>

      <section>
        <h3 className="font-semibold mb-2">调渠道尝试 ({attempts?.length ?? 0})</h3>
        <table className="wa-table"><thead><tr><th>#</th><th>latency</th><th>error</th><th>created</th></tr></thead>
          <tbody>{(attempts ?? []).map((a:any) => (
            <tr key={a.id}>
              <td className="mono">{a.attempt_no}</td>
              <td className="mono">{a.latency_ms ?? '—'} ms</td>
              <td className="mono text-vermilion">{a.error_kind ?? '—'}</td>
              <td>{rel(a.created_at)}</td>
            </tr>
          ))}</tbody>
        </table>
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
