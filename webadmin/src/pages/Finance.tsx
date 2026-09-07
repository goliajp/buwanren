import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import TableError from '../components/TableError';
import Pagination from '../components/Pagination';
import Drawer from '../components/Drawer';
import { rel, ts, yuan, shortId, briefId, thou, statusClass, statusLabel, enumLabel } from '../components/util';
import { Eye, FileText, RefreshCw } from 'lucide-react';

/* 会计期怎么念。
   【上一版所有会计期都写成 `Q<sub>`】—— 而按月的会计期里 sub 是月份，
   于是 2026 年 9 月显示成「2026 Q9」，一个不存在的季度。 */
/* 一段话里的 uuid 缩成前八位。整串留在 title 里，鼠标停一下能看到全的。 */
function 缩短uuid(文?: string | null): string {
  if (!文) return '—';
  return 文.replace(/\b([a-z]{2,4})-([0-9a-f]{8})-[0-9a-f-]{20,}/g, '$1-$2…');
}

function 会计期名(p: any): string {
  const 期 = p.kind === 'month' ? `${p.year} 年 ${p.sub} 月`
           : p.kind === 'quarter' ? `${p.year} 年第 ${p.sub} 季度`
           : `${p.year} 年`;
  const 状 = p.state === 'open' ? '未结' : p.state === 'closed' ? '已结' : p.state;
  return `${期} · ${状}`;
}

export default function Finance() {
  const qc = useQueryClient();
  const [periodId, setPeriodId] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<'entries' | 'report'>('entries');
  const [entryId, setEntryId] = useState<string | null>(null);

  const periods = useQuery({ queryKey: ['periods'], queryFn: () => commerce.listPeriods() });

  // 默认选最近的 month period
  useMemo(() => {
    if (!periodId && periods.data && periods.data.length > 0) {
      const m = periods.data.find((p: any) => p.kind === 'month') ?? periods.data[0];
      setPeriodId(m.id);
    }
  }, [periodId, periods.data]);

  const entries = useQuery({
    queryKey: ['entries', periodId, page],
    queryFn: () => commerce.listJournalEntries({ period_id: periodId, page, size: 50 }),
    enabled: !!periodId,
  });

  const entryDetail = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => commerce.getJournalEntry(entryId!),
    enabled: !!entryId,
  });

  const 当前期 = (periods.data ?? []).find((p: any) => p.id === periodId);
  const 关账 = useApiMutation({
    mutationFn: (id: string) => commerce.closePeriod(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['periods'] }); },
  });

  const report = useQuery({
    queryKey: ['report', periodId],
    queryFn: () => commerce.monthlyReport(periodId!),
    enabled: !!periodId && tab === 'report',
  });

  return (
    <div>
      {/* 上一版右上角写的是「当前期 period-2026-09」—— 那是库里的主键。
          会计期在下拉框里已经选着了，页头再报一遍主键没有意义。 */}
      <PageHeader
        title="财务"
        sub="每一笔钱记两处，借贷要相等 —— 不等就是有账没落地"
        stats={entries.data ? [{ label: '本期分录', value: thou(entries.data.total) }] : undefined}
      />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <select className="select" style={{ width: 220 }}
            value={periodId ?? ''} onChange={(e) => { setPeriodId(e.target.value); setPage(0); }}>
            {(periods.data ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>{会计期名(p)}</option>
            ))}
          </select>
          {(['entries','report'] as const).map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-prim' : 'btn-soft'}`} onClick={() => setTab(t)}>
              {t === 'entries' ? '分录浏览' : '月报'}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {/* 【关账是这一页真正的动作】。在它之前财务页只能看 ——
                而一本随时还能往里记的账，不能拿来对外说话。
                已经关了的期间不显示这个按钮:它已经做完了。 */}
            {当前期?.state === 'open' && (
              <button
                className="btn btn-soft"
                disabled={关账.isPending}
                onClick={() => {
                  if (!periodId) return;
                  if (!confirm(`把「${会计期名(当前期)}」封住？封了之后这一期不能再记账。`)) return;
                  关账.mutate(periodId);
                }}
              >
                {关账.isPending ? '正在关…' : '关账'}
              </button>
            )}
            <button className="btn btn-soft" onClick={() => { entries.refetch(); report.refetch(); }}>
              <RefreshCw size={13}/>
            </button>
          </div>
        </div>

        {tab === 'entries' && (
          <div className="panel">
            <table className="tbl">
              <thead><tr>
                <th>编号</th><th>业务</th><th>描述</th><th>入账</th><th>经手</th>
                <th className="r">借方合计</th><th className="r">贷方合计</th><th>状态</th><th className="c">动作</th>
              </tr></thead>
              <tbody>
                {(entries.data?.items ?? []).map((e: any) => (
                  <tr key={e.id}>
                    <td className="id">{briefId(e.id)}</td>
                    <td><span className="text-ink-2">{enumLabel(e.business_kind)}</span></td>
                    {/* 【描述里的 uuid 缩到能认的长度】。后端拼的原文是
                        「退款 rfd-9108430b-1ae4-436b-84d1-18152d2bd1f2 冲销订单
                        ord-6e7dfcc3-2d9d-4045-a213-0be5deacaa2c」——
                        九十个字符里八十个是没人读的十六进制，
                        把整张表的其余列都挤到看不见。 */}
                    <td className="text-xs text-ink-2" title={e.description}>
                      {缩短uuid(e.description)}
                    </td>
                    <td title={ts(e.posted_at)}>{rel(e.posted_at)}</td>
                    <td className="text-ink-4">{e.posted_by_kind === 'system' ? '系统' : e.posted_by_kind}</td>
                    <td className="r font-semibold">{yuan(e.total_debit)}</td>
                    <td className="r font-semibold">{yuan(e.total_credit)}</td>
                    <td><span className={statusClass(e.status)}>{statusLabel(e.status)}</span></td>
                    <td className="c"><button className="btn btn-ghost" onClick={() => setEntryId(e.id)}><Eye size={13}/></button></td>
                  </tr>
                ))}
                {/* 【取不到跟「一条都没有」不是一回事】（2026-09-03 五路评审 · 后台产品体验）。
                  上一版只有空态那一行，而它的条件是 `X.data && …length === 0` ——
                  查询失败时 `data` 是 undefined，两行都不渲染，
                  屏上剩一张只有表头的空表。带着筛选条件的页面上，
                  运营会以为是自己把条件筛空了。 */}
                <TableError 出错={entries.isError} 列数={9} />
                {entries.data && entries.data.items.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-10 text-ink-4">— 本期无分录（待业务事件触发挂账）—</td></tr>
                )}
              </tbody>
            </table>
            {entries.data && <Pagination page={page} size={50} total={entries.data.total} onPage={setPage} />}
          </div>
        )}

        {tab === 'report' && report.data && (
          <div className="space-y-4">
            <section>
              <div className="label text-ink-4 mb-1.5 px-1">KPI · {periodId}</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="kpi"><div className="kpi-label">营收</div><div className="kpi-value text-settled">{yuan(report.data.kpi.revenue_minor)}</div></div>
                <div className="kpi"><div className="kpi-label">退款</div><div className="kpi-value text-debt">{yuan(report.data.kpi.refund_minor)}</div></div>
                <div className="kpi"><div className="kpi-label">运费收入</div><div className="kpi-value">{yuan(report.data.kpi.shipping_revenue_minor)}</div></div>
                <div className="kpi"><div className="kpi-label">物流成本</div><div className="kpi-value text-debt">{yuan(report.data.kpi.shipping_cost_minor)}</div></div>
                <div className="kpi"><div className="kpi-label">物流毛利</div><div className={`kpi-value ${report.data.kpi.shipping_margin_minor >= 0 ? 'text-settled' : 'text-debt'}`}>{yuan(report.data.kpi.shipping_margin_minor)}</div></div>
              </div>
            </section>
            <section className="panel">
              <div className="panel-head"><div className="panel-title flex items-center gap-1.5"><FileText size={13}/> 试算平衡表</div></div>
              <table className="tbl">
                <thead><tr><th>科目</th><th>名称</th><th>类</th><th className="r">借方</th><th className="r">贷方</th><th className="r">净额</th></tr></thead>
                <tbody>
                  {(report.data.trial_balance ?? []).map((r: any) => (
                    <tr key={r.code}>
                      <td className="id">{r.code}</td>
                      <td>{r.name}</td>
                      <td><span className="text-ink-3">{enumLabel(r.kind)}</span></td>
                      <td className="r font-semibold">{yuan(r.debit)}</td>
                      <td className="r font-semibold">{yuan(r.credit)}</td>
                      <td className="r font-semibold">{yuan(r.debit - r.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </div>

      <Drawer
        open={!!entryId}
        onClose={() => setEntryId(null)}
        title={entryDetail.data?.entry ? `分录 · ${shortId(entryDetail.data.entry.id, 10, 6)}` : '分录详情'}
        subtitle={entryDetail.data?.entry?.business_kind}
        width={780}
      >
        {entryDetail.data && (
          <div className="space-y-4 text-[12.5px]">
            <section>
              <h3 className="font-semibold mb-2">基本</h3>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div><span className="label text-ink-4">id</span><div className="id">{entryDetail.data.entry.id}</div></div>
                <div><span className="label text-ink-4">业务</span><div>{entryDetail.data.entry.business_kind}</div></div>
                <div><span className="label text-ink-4">业务 ref</span><div className="id">{entryDetail.data.entry.business_ref_id ?? '—'}</div></div>
                <div><span className="label text-ink-4">状态</span><div><span className={statusClass(entryDetail.data.entry.status)}>{statusLabel(entryDetail.data.entry.status)}</span></div></div>
                <div><span className="label text-ink-4">入账时间</span><div>{ts(entryDetail.data.entry.posted_at)}</div></div>
                <div><span className="label text-ink-4">入账人</span><div>{entryDetail.data.entry.posted_by_kind} {entryDetail.data.entry.posted_by_id ?? ''}</div></div>
              </div>
              <div className="mt-2 px-3 py-2 bg-sunk rounded">{entryDetail.data.entry.description}</div>
            </section>
            <section>
              <h3 className="font-semibold mb-2">分录行 ({entryDetail.data.lines.length})</h3>
              <table className="tbl">
                <thead><tr><th>#</th><th>科目</th><th>名称</th><th>类</th><th className="r">借方</th><th className="r">贷方</th><th>备注</th></tr></thead>
                <tbody>
                  {entryDetail.data.lines.map((l: any) => (
                    <tr key={l.id}>
                      <td className="id">{l.line_no}</td>
                      <td className="id">{l.account_code}</td>
                      <td>{l.account_name}</td>
                      <td><span className="text-ink-3">{enumLabel(l.account_kind)}</span></td>
                      <td className="r font-semibold">{l.debit_minor > 0 ? yuan(l.debit_minor, l.currency) : '—'}</td>
                      <td className="r font-semibold">{l.credit_minor > 0 ? yuan(l.credit_minor, l.currency) : '—'}</td>
                      <td className="text-xs text-ink-4">{l.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </Drawer>
    </div>
  );
}
