import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { commerce } from '../lib/api';
import { useApiMutation } from '../lib/feedback';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import Drawer from '../components/Drawer';
import { rel, ts, yuan, thou, shortId, statusClass, statusLabel, channelLabel, enumLabel } from '../components/util';
import { Eye, RefreshCw } from 'lucide-react';

/** 四种结法的说法。它们不是同义词 —— 混成一个之后，
    下个月同一类差异再来时，没人知道上次是怎么判的 */
const 结法 = {
  channel_wrong: '渠道那边错了',
  ours_missing:  '我们漏记了',
  timing_only:   '只是跨了日切',
  known_fee:     '差的是手续费',
} as const;

function 结法名(a?: string | null): string {
  return 结法[(a ?? '') as keyof typeof 结法] ?? (a ?? '—');
}

/* 结掉一条对不上的账。
 *
 * 【一定要选一种，还要说一句】。只给「标为已处理」的话，
 * 这一列过一个月就只剩一片「已处理」，跟没记一样。 */
function 结掉({ 记录, 结完 }: { 记录: any; 结完: () => void }) {
  const [开着, 设开] = useState(false);
  const [法, 设法] = useState<string>('known_fee');
  const [说, 设说] = useState('');
  const 提交 = useApiMutation({
    mutationFn: () => commerce.resolveReconRecord(记录.id, 法, 说.trim()),
    onSuccess: () => { 设开(false); 设说(''); 结完(); },
  });

  if (!开着) {
    return <button className="btn btn-soft" onClick={() => 设开(true)}>结掉</button>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <select className="select" value={法} onChange={(e) => 设法(e.target.value)}>
        {Object.entries(结法).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input
        className="input w-48"
        placeholder="是怎么查的"
        value={说}
        onChange={(e) => 设说(e.target.value)}
      />
      <button className="btn btn-prim" disabled={!说.trim() || 提交.isPending}
              onClick={() => 提交.mutate()}>
        {提交.isPending ? '…' : '存'}
      </button>
      <button className="btn btn-ghost" onClick={() => 设开(false)}>算了</button>
    </div>
  );
}

export default function Reconciliation() {
  /* 【默认落在对不上的那些上】。这一页的活儿是「看有没有对不上的」，
     而上一版默认按时间列出全部 1466 个批次 —— 第一屏全是「对上了」，
     真要处理的那些得往后翻。跟退款页同一个道理。 */
  const [filt, setFilt] = useState<Record<string, any>>({ status: 'has_discrepancy', size: 50, page: 0 });
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['recon-batches', filt],
    queryFn: () => commerce.listReconBatches(filt),
    placeholderData: (p) => p,
  });
  const 看差异 = filt.status === 'has_discrepancy';

  const detail = useQuery({
    queryKey: ['recon-batch', detailId],
    queryFn: () => commerce.getReconBatch(detailId!),
    enabled: !!detailId,
  });

  return (
    <div>
      <PageHeader
        title="对账"
        sub="每天跟微信、支付宝的账单对一遍，看有没有对不上的"
        lead={看差异 && list.data?.total
          ? { label: '有对不上的', value: thou(list.data.total), tone: 'debt' }
          : undefined}
        stats={list.data && !看差异 ? [{ label: '这次查到', value: thou(list.data.total) }] : undefined}
        right={
          <button
            className="btn btn-soft"
            onClick={() => setFilt(看差异
              ? { size: 50, page: 0 }
              : { status: 'has_discrepancy', size: 50, page: 0 })}
          >
            {看差异 ? '看全部批次' : '只看对不上的'}
          </button>
        }
      />
      <div className="p-4">
        <div className="flex justify-end mb-2">
          <button className="btn btn-soft" onClick={() => list.refetch()}><RefreshCw size={13}/> 刷新</button>
        </div>
        <div className="panel">
          <table className="tbl">
            <thead><tr>
              <th>编号</th><th>渠道</th><th>日期</th><th>来源</th><th>状态</th>
              <th className="r">条数</th><th className="r">渠道总额</th>
              <th>拉取</th><th>匹配</th><th>解决</th>
              <th className="c">动作</th>
            </tr></thead>
            <tbody>
              {/* 【整行可点】。上一版只有末尾那个眼睛图标能点 ——
                  而这一屏的每一行都只有一个去处（打开这一批的明细），
                  把它藏在 14 像素的图标里没有道理。订单页早就是整行了。 */}
              {(list.data?.items ?? []).map((b: any) => (
                <tr key={b.id} onClick={() => setDetailId(b.id)} className="cursor-pointer">
                  <td className="id">{shortId(b.id)}</td>
                  <td>{channelLabel(b.channel)}</td>
                  <td className="id">{b.batch_date}</td>
                  <td className="text-ink-4">{enumLabel(b.source)}</td>
                  <td><span className={statusClass(b.status)}>{statusLabel(b.status)}</span></td>
                  <td className="r font-mono">{b.total_count.toLocaleString()}</td>
                  <td className="r font-semibold">{yuan(b.total_amount_minor, b.currency)}</td>
                  <td title={ts(b.pulled_at)}>{rel(b.pulled_at)}</td>
                  <td title={ts(b.matched_at)}>{rel(b.matched_at)}</td>
                  <td title={ts(b.resolved_at)}>{rel(b.resolved_at)}</td>
                  <td className="c"><button className="btn btn-ghost" onClick={() => setDetailId(b.id)}><Eye size={13}/></button></td>
                </tr>
              ))}
              {list.data && list.data.items.length === 0 && (
                <tr><td colSpan={11} className="text-center py-10 text-ink-4">— 暂无对账批次 — sweeper 02:30 拉取 —</td></tr>
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
                <div><span className="label text-ink-4">渠道</span><div>{channelLabel(detail.data.batch.channel)}</div></div>
                <div><span className="label text-ink-4">日期</span><div className="id">{detail.data.batch.batch_date}</div></div>
                <div><span className="label text-ink-4">状态</span><div><span className={statusClass(detail.data.batch.status)}>{statusLabel(detail.data.batch.status)}</span></div></div>
                <div><span className="label text-ink-4">条数</span><div className="id">{detail.data.batch.total_count}</div></div>
                <div><span className="label text-ink-4">总额</span><div className="font-semibold">{yuan(detail.data.batch.total_amount_minor, detail.data.batch.currency)}</div></div>
                <div><span className="label text-ink-4">异常</span><div className="font-semibold text-debt">{(detail.data.records ?? []).filter((r: any) => r.match_state !== 'matched').length}</div></div>
              </div>
            </section>
            <section>
              <h3 className="font-semibold mb-2">记录 ({(detail.data.records ?? []).length})</h3>
              <table className="tbl">
                <thead><tr><th>渠道单号</th><th className="r">渠道金额</th><th>渠道状态</th><th>命中</th><th>对上的支付</th><th>怎么结的</th></tr></thead>
                <tbody>{(detail.data.records ?? []).map((r: any) => (
                  <tr key={r.id} className={r.match_state !== 'matched' ? 'bg-debt-bg/30' : ''}>
                    <td className="id">{r.channel_txn_id ?? '—'}</td>
                    <td className="r">{r.channel_amount_minor ? yuan(r.channel_amount_minor) : '—'}</td>
                    <td className="id">{r.channel_status ?? '—'}</td>
                    <td><span className={statusClass(r.match_state)}>{statusLabel(r.match_state)}</span></td>
                    <td className="font-mono text-ink-3">{r.matched_payment_id ? shortId(r.matched_payment_id) : '—'}</td>
                    {/* 【找出来之后总得能做点什么】。在这一列之前，
                        对账页只到「这一条对不上」为止 —— 库里 1432 条
                        差异躺着没人处理，不是没人管，是没有路。 */}
                    <td>
                      {r.match_state === 'matched'
                        ? <span className="text-ink-4">—</span>
                        : r.resolved_at
                          ? <span className="text-settled" title={r.resolved_note ?? ''}>
                              {结法名(r.resolved_action)}
                            </span>
                          : <结掉 记录={r} 结完={() => detail.refetch()} />}
                    </td>
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
