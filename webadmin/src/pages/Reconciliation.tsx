import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import Drawer from '../components/Drawer';
import { rel, ts, yuan, shortId, statusChip, channelLabel } from '../components/util';
import { Eye, RefreshCw } from 'lucide-react';

export default function Reconciliation() {
  const [filt, setFilt] = useState<Record<string, any>>({ size: 50, page: 0 });
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['recon-batches', filt],
    queryFn: () => commerce.listReconBatches(filt),
    placeholderData: (p) => p,
  });
  const detail = useQuery({
    queryKey: ['recon-batch', detailId],
    queryFn: () => commerce.getReconBatch(detailId!),
    enabled: !!detailId,
  });

  return (
    <div>
      <PageHeader title="对账 · Reconciliation" sub="commerce v2 · recon_batch + recon_record · 日切渠道账单核对" stats={[
        { label: '批次', value: list.data?.total ?? 0 },
      ]} />
      <div className="p-4">
        <div className="flex justify-end mb-2">
          <button className="btn btn-soft" onClick={() => list.refetch()}><RefreshCw size={13}/> 刷新</button>
        </div>
        <div className="panel">
          <table className="wa-table">
            <thead><tr>
              <th>id</th><th>渠道</th><th>日期</th><th>source</th><th>状态</th>
              <th className="r">条数</th><th className="r">渠道总额</th>
              <th>拉取</th><th>匹配</th><th>解决</th>
              <th className="c">动作</th>
            </tr></thead>
            <tbody>
              {(list.data?.items ?? []).map((b: any) => (
                <tr key={b.id}>
                  <td className="mono">{shortId(b.id)}</td>
                  <td>{channelLabel(b.channel)}</td>
                  <td className="mono">{b.batch_date}</td>
                  <td className="text-ink-4">{b.source}</td>
                  <td><span className={statusChip(b.status)}>{b.status}</span></td>
                  <td className="r mono">{b.total_count.toLocaleString()}</td>
                  <td className="r font-semibold">{yuan(b.total_amount_minor, b.currency)}</td>
                  <td title={ts(b.pulled_at)}>{rel(b.pulled_at)}</td>
                  <td title={ts(b.matched_at)}>{rel(b.matched_at)}</td>
                  <td title={ts(b.resolved_at)}>{rel(b.resolved_at)}</td>
                  <td className="c"><button className="btn btn-link" onClick={() => setDetailId(b.id)}><Eye size={13}/></button></td>
                </tr>
              ))}
              {list.data && list.data.items.length === 0 && (
                <tr><td colSpan={11} className="text-center py-10 text-ink-5">— 暂无对账批次 — sweeper 02:30 拉取 —</td></tr>
              )}
            </tbody>
          </table>
          {list.data && <Pagination page={filt.page ?? 0} size={filt.size ?? 50} total={list.data.total} onPage={(p) => setFilt({ ...filt, page: p })} />}
        </div>
      </div>

      <Drawer
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detail.data?.batch ? `批次 · ${shortId(detail.data.batch.id, 10, 6)}` : '批次详情'}
        subtitle={detail.data?.batch ? `${channelLabel(detail.data.batch.channel)} · ${detail.data.batch.batch_date}` : '加载中'}
        width={920}
      >
        {detail.data && (
          <div className="space-y-4 text-[12.5px]">
            <section>
              <h3 className="font-semibold mb-2">基本</h3>
              <div className="grid grid-cols-3 gap-2 text-[12px]">
                <div><span className="uplabel text-ink-5">渠道</span><div>{channelLabel(detail.data.batch.channel)}</div></div>
                <div><span className="uplabel text-ink-5">日期</span><div className="mono">{detail.data.batch.batch_date}</div></div>
                <div><span className="uplabel text-ink-5">状态</span><div><span className={statusChip(detail.data.batch.status)}>{detail.data.batch.status}</span></div></div>
                <div><span className="uplabel text-ink-5">条数</span><div className="mono">{detail.data.batch.total_count}</div></div>
                <div><span className="uplabel text-ink-5">总额</span><div className="font-semibold">{yuan(detail.data.batch.total_amount_minor, detail.data.batch.currency)}</div></div>
                <div><span className="uplabel text-ink-5">异常</span><div className="font-semibold text-vermilion">{(detail.data.records ?? []).filter((r: any) => r.match_state !== 'matched').length}</div></div>
              </div>
            </section>
            <section>
              <h3 className="font-semibold mb-2">记录 ({(detail.data.records ?? []).length})</h3>
              <table className="wa-table">
                <thead><tr><th>渠道单号</th><th className="r">渠道金额</th><th>渠道状态</th><th>match</th><th>关联 payment</th></tr></thead>
                <tbody>{(detail.data.records ?? []).map((r: any) => (
                  <tr key={r.id} className={r.match_state !== 'matched' ? 'bg-vermilion-soft/30' : ''}>
                    <td className="mono">{r.channel_txn_id ?? '—'}</td>
                    <td className="r">{r.channel_amount_minor ? yuan(r.channel_amount_minor) : '—'}</td>
                    <td className="mono">{r.channel_status ?? '—'}</td>
                    <td><span className={statusChip(r.match_state)}>{r.match_state}</span></td>
                    <td className="mono text-ink-3">{r.matched_payment_id ? shortId(r.matched_payment_id) : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </section>
          </div>
        )}
      </Drawer>
    </div>
  );
}
