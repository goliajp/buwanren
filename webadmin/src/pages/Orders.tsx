import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import { 从网址读筛选 } from '../lib/urlfilter';
import PageHeader from '../components/PageHeader';
import TableError from '../components/TableError';
import CopyId from '../components/CopyId';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import Drawer from '../components/Drawer';
import { rel, ts, yuan, thou, shortId, briefId, statusClass, statusLabel, platformLabel, enumLabel } from '../components/util';
import { X, MessageSquarePlus, RefreshCw } from 'lucide-react';

const ORDER_STATUSES = ['draft','unpaid','paid','fulfilling','done','cancelled','refund_partial','refunded','disputed'];
const CHANNEL_ORIGINS = ['wx_mp','wx_h5','ios','android','web','admin'];

export default function Orders() {
  const qc = useQueryClient();
  /* 【筛选条件从网址上读】（2026-09-03 五路评审 · 后台产品体验）——
     看板与用户页跳过来时带着 `?status=…` / `?keyword=…`，
     而在这之前没有一页读它，那几跳全都落到不带筛选的全量列表上。
     `draft` 也要一起带上，不然筛选栏显示的跟真在用的对不上。 */
  const [filt, setFilt] = useState<Record<string, any>>(从网址读筛选({ size: 50, page: 0 }));
  const [draft, setDraft] = useState<Record<string, any>>(从网址读筛选({}));
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
    /* 【只留有用的两个】。上一版三个:「当前页 50」是分页的副产品，
       跟这一页要判断的事没关系。留「本页收到」与未付笔数 ——
       后者是要处理的，所以给它 debt 那一档。 */
    const 未付 = items.filter((o: any) => o.status === 'unpaid').length;
    return [
      ...(未付 ? [{ label: '本页没付', value: 未付, tone: 'debt' as const }] : []),
      { label: '本页收到', value: yuan(sumPaid) },
    ];
  }, [list.data]);

  return (
    <div>
      <PageHeader
        title="订单"
        sub="从下单到收钱到发货，每一笔的全过程"
        stats={stats}
        lead={list.data ? { label: '一共', value: thou(list.data.total) } : undefined}
      />
      <div className="p-4">
        <FilterBar
          /* 【筛选条说人话，且不重复顶栏已经定了的事】。
             上一版的标签是 `keyword` / `status` / `channel` / `region` ——
             库里的字段名直接上屏;而 `region` 这一条更麻烦:
             顶栏已经选了「看的是哪个区」，这里再给一个区筛选，
             两个都设的时候谁说了算，没有人答得上来。 */
          fields={[
            { kind: 'text',   key: 'keyword', label: '找', placeholder: '单号或用户号', width: 220 },
            { kind: 'select', key: 'status',  label: '状态',  options: ORDER_STATUSES.map(v => ({ v, label: statusLabel(v) })) },
            { kind: 'select', key: 'channel_origin', label: '从哪儿下的', options: CHANNEL_ORIGINS.map(v => ({ v, label: platformLabel(v) })) },
            { kind: 'number', key: 'amount_min_minor', label: '金额不少于（分）', placeholder: '9900' },
            { kind: 'number', key: 'amount_max_minor', label: '金额不多于（分）', placeholder: '50000' },
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
          <table className="tbl">
            {/* 【十一列收到八列】。去掉的两列各有理由:
                `region` 整列都是当前正在看的那个区（顶栏已经写着），
                「更新」跟「创建」在这批数据里差不到一分钟、而且它不驱动任何决定。
                动作列也去掉:整行可点，一个只放着眼睛图标的列是纯开销。 */}
            <thead><tr>
              <th>单号</th>
              <th>谁</th>
              <th>从哪儿下的</th>
              <th>状态</th>
              <th className="r">应付</th>
              <th className="r">已付</th>
              <th className="r">退回</th>
              <th className="r">下单</th>
            </tr></thead>
            <tbody>
              {(list.data?.items ?? []).map((o: any) => (
                <tr key={o.id} onClick={() => setDetailId(o.id)} className="cursor-pointer">
                  {/* 点一下抄走整串（见 CopyId 顶上那段）—— 屏上仍然是短的 */}
                  <td className="id"><CopyId id={o.id}>{briefId(o.id)}</CopyId></td>
                  <td className="id"><CopyId id={o.user_id}>{briefId(o.user_id)}</CopyId></td>
                  <td className="text-ink-2">{platformLabel(o.channel_origin)}</td>
                  <td><span className={statusClass(o.status)}>{statusLabel(o.status)}</span></td>
                  <td className="r">{yuan(o.amount_total_minor, o.currency)}</td>
                  {/* 【已付等于应付时退成灰】。相等是常态，不必每行都用颜色说一遍;
                      少收了才是要看的事 —— 那一格才吃墨。 */}
                  <td className={`r ${o.amount_paid_minor >= o.amount_total_minor ? 'text-ink-3' : 'text-debt font-medium'}`}>
                    {yuan(o.amount_paid_minor, o.currency)}
                  </td>
                  <td className="r text-ink-3">
                    {o.amount_refunded_minor > 0 ? yuan(o.amount_refunded_minor, o.currency) : <span className="text-ink-4">—</span>}
                  </td>
                  <td className="r text-ink-3" title={ts(o.created_at)}>{rel(o.created_at)}</td>
                </tr>
              ))}
              {/* 【取不到跟「一条都没有」不是一回事】（2026-09-03 五路评审 · 后台产品体验）。
                  上一版只有空态那一行，而它的条件是 `X.data && …length === 0` ——
                  查询失败时 `data` 是 undefined，两行都不渲染，
                  屏上剩一张只有表头的空表。带着筛选条件的页面上，
                  运营会以为是自己把条件筛空了。 */}
                <TableError 出错={list.isError} 列数={8} />
                {list.data && list.data.items.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-ink-4">— 无数据 —</td></tr>
              )}
              {list.isLoading && (
                <tr><td colSpan={8} className="text-center py-10 text-ink-4">加载中…</td></tr>
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
      <button className="btn btn-debt" disabled={!cancellable}
        onClick={() => {
          const r = prompt('取消理由？'); if (r) cancelMut.mutate(r);
        }}><X size={13}/> 取消订单</button>
      {/* 按钮置灰要说明为什么,否则运营只会以为是坏了 */}
      {needsRefundInstead && (
        <span className="text-xs text-ink-4 ml-2">已付订单请走退款</span>
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
          ['id', <span className="id">{order.id}</span>],
          ['用户', <span className="id">{order.user_id}</span>],
          ['状态', <span className={statusClass(order.status)}>{statusLabel(order.status)}</span>],
          ['渠道', order.channel_origin],
          ['区域', order.region],
          ['来源', order.source_kind],
          ['货币', order.currency],
          ['应付', <strong>{yuan(order.amount_total_minor, order.currency)}</strong>],
          ['已付', <span className="text-settled">{yuan(order.amount_paid_minor, order.currency)}</span>],
          ['已退', <span className="text-debt">{yuan(order.amount_refunded_minor, order.currency)}</span>],
          ['折扣', yuan(order.amount_discount_minor, order.currency)],
          ['运费', yuan(order.amount_shipping_minor, order.currency)],
          ['过期时间', ts(order.expires_at)],
          ['付款时间', ts(order.paid_at)],
          ['完成时间', ts(order.fulfilled_at)],
          ['创建时间', ts(order.created_at)],
        ]} />
        {order.audit_note && (
          <div className="mt-2 px-3 py-2 bg-sunk rounded text-xs text-ink-3 whitespace-pre-wrap font-mono">{order.audit_note}</div>
        )}
      </section>

      <section>
        <SectionTitle title={`明细行 (${lines?.length ?? 0})`} />
        <table className="tbl">
          <thead><tr><th>#</th><th>规格</th><th className="r">单价</th><th className="r">数量</th><th className="r">小计</th><th className="r">折扣</th><th>履约</th></tr></thead>
          <tbody>
            {(lines ?? []).map((l: any) => (
              <tr key={l.id}>
                <td className="id">{l.line_no}</td>
                {/* 【商品名就在响应里，而这一列渲的是 sku_id】
                    （2026-09-06 三路验证 · 运营那一路）。
                    `sku_snapshot_json.sku_name` 是下单那一刻的快照 ——
                    客户说「那个八字报告」，客服屏上是 `sku-naji-…`,
                    对不上话；判一笔退款该不该批同样卡在这儿。
                    名在上、id 在下 —— id 仍然要看得见（查库要用它）。 */}
                <td>
                  <div className="text-ink">{l.sku_snapshot_json?.sku_name ?? '—'}</div>
                  <div className="id text-[12px]">{shortId(l.sku_id, 10, 6)}</div>
                </td>
                <td className="r">{yuan(l.unit_price_minor, order.currency)}</td>
                <td className="r font-mono">×{l.qty}</td>
                <td className="r">{yuan(l.line_subtotal_minor, order.currency)}</td>
                <td className="r text-debt">{l.applied_discount_minor ? yuan(l.applied_discount_minor, order.currency) : '—'}</td>
                <td><span className={statusClass(l.fulfillment_status)}>{statusLabel(l.fulfillment_status)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {(payments?.length ?? 0) > 0 && (
        <section>
          <SectionTitle title={`关联支付 (${payments.length})`} />
          <table className="tbl">
            <thead><tr><th>编号</th><th>渠道</th><th>状态</th><th className="r">金额</th><th>时间</th></tr></thead>
            <tbody>{payments.map((p: any) => (
              <tr key={p.id}>
                <td className="id">{shortId(p.id)}</td>
                <td className="id">{p.channel}</td>
                <td><span className={statusClass(p.status)}>{statusLabel(p.status)}</span></td>
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
          <table className="tbl">
            <thead><tr><th>编号</th><th>状态</th><th>原因</th><th className="r">金额</th><th>时间</th></tr></thead>
            <tbody>{refunds.map((r: any) => (
              <tr key={r.id}>
                <td className="id">{shortId(r.id)}</td>
                <td><span className={statusClass(r.status)}>{statusLabel(r.status)}</span></td>
                <td className="font-mono text-ink-3">{r.reason_code}</td>
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
          <table className="tbl">
            <thead><tr><th>编号</th><th>承运商</th><th>单号</th><th>状态</th><th>送达</th></tr></thead>
            <tbody>{shipments.map((s: any) => (
              <tr key={s.id}>
                <td className="id">{shortId(s.id)}</td>
                <td className="id">{s.carrier_code}</td>
                <td className="id">{s.tracking_no ?? '—'}</td>
                <td><span className={statusClass(s.status)}>{statusLabel(s.status)}</span></td>
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
            <div key={e.id} className="flex items-center gap-3 py-1.5 px-2 border-b border-rule/50 text-[12px]">
              <span className="font-mono text-ink-4 w-32">{ts(e.created_at)}</span>
              <span className={`${e.actor_kind === 'admin' ? 'text-ink-2' : 'text-ink-3'}`}>{e.actor_kind}</span>
              <span className="font-medium">{enumLabel(e.kind)}</span>
              <span className="font-mono text-ink-4">{e.before_status} → {e.after_status}</span>
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
        <div key={i} className="flex items-center justify-between border-b border-rule/50 py-1">
          <span className="label text-ink-4">{k}</span>
          <span className="text-[12.5px] text-ink-2">{v}</span>
        </div>
      ))}
    </div>
  );
}
