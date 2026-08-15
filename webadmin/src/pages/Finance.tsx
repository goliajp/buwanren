import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import Drawer from '../components/Drawer';
import { rel, ts, yuan, shortId, statusChip } from '../components/util';
import { Eye, FileText, RefreshCw } from 'lucide-react';

export default function Finance() {
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

  const report = useQuery({
    queryKey: ['report', periodId],
    queryFn: () => commerce.monthlyReport(periodId!),
    enabled: !!periodId && tab === 'report',
  });

  return (
    <div>
      <PageHeader title="财务 · Finance" sub="commerce v2 · journal_entry + journal_line + account_chart · 复式记账"
        stats={[{ label: '会计期', value: (periods.data ?? []).length }, { label: '当前期', value: periodId ? periodId : '—' }]} />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <select className="select" style={{ width: 220 }}
            value={periodId ?? ''} onChange={(e) => { setPeriodId(e.target.value); setPage(0); }}>
            {(periods.data ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.kind} · {p.year}{p.sub ? ` Q${p.sub}` : ''} · {p.state}</option>
            ))}
          </select>
          {(['entries','report'] as const).map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-prim' : 'btn-soft'}`} onClick={() => setTab(t)}>
              {t === 'entries' ? '分录浏览' : '月报'}
            </button>
          ))}
          <button className="btn btn-soft ml-auto" onClick={() => { entries.refetch(); report.refetch(); }}>
            <RefreshCw size={13}/>
          </button>
        </div>

        {tab === 'entries' && (
          <div className="panel">
            <table className="wa-table">
              <thead><tr>
                <th>id</th><th>业务</th><th>描述</th><th>posted</th><th>by</th>
                <th className="r">借方合计</th><th className="r">贷方合计</th><th>状态</th><th className="c">动作</th>
              </tr></thead>
              <tbody>
                {(entries.data?.items ?? []).map((e: any) => (
                  <tr key={e.id}>
                    <td className="mono">{shortId(e.id)}</td>
                    <td><span className="chip chip-info">{e.business_kind}</span></td>
                    <td className="text-[12px]">{e.description}</td>
                    <td>{rel(e.posted_at)}</td>
                    <td className="text-ink-4">{e.posted_by_kind}</td>
                    <td className="r font-semibold">{yuan(e.total_debit)}</td>
                    <td className="r font-semibold">{yuan(e.total_credit)}</td>
                    <td><span className={statusChip(e.status)}>{e.status}</span></td>
                    <td className="c"><button className="btn btn-link" onClick={() => setEntryId(e.id)}><Eye size={13}/></button></td>
                  </tr>
                ))}
                {entries.data && entries.data.items.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-10 text-ink-5">— 本期无分录(待业务事件触发挂账)—</td></tr>
                )}
              </tbody>
            </table>
            {entries.data && <Pagination page={page} size={50} total={entries.data.total} onPage={setPage} />}
          </div>
        )}

        {tab === 'report' && report.data && (
          <div className="space-y-4">
            <section>
              <div className="uplabel text-ink-5 mb-1.5 px-1">KPI · {periodId}</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="kpi"><div className="kpi-label">营收</div><div className="kpi-value text-jade">{yuan(report.data.kpi.revenue_minor)}</div></div>
                <div className="kpi"><div className="kpi-label">退款</div><div className="kpi-value text-vermilion">{yuan(report.data.kpi.refund_minor)}</div></div>
                <div className="kpi"><div className="kpi-label">运费收入</div><div className="kpi-value">{yuan(report.data.kpi.shipping_revenue_minor)}</div></div>
                <div className="kpi"><div className="kpi-label">物流成本</div><div className="kpi-value text-vermilion">{yuan(report.data.kpi.shipping_cost_minor)}</div></div>
                <div className="kpi"><div className="kpi-label">物流毛利</div><div className={`kpi-value ${report.data.kpi.shipping_margin_minor >= 0 ? 'text-jade' : 'text-vermilion'}`}>{yuan(report.data.kpi.shipping_margin_minor)}</div></div>
              </div>
            </section>
            <section className="panel">
              <div className="panel-head"><div className="panel-title flex items-center gap-1.5"><FileText size={13}/> 试算平衡表</div></div>
              <table className="wa-table">
                <thead><tr><th>科目</th><th>名称</th><th>类</th><th className="r">借方</th><th className="r">贷方</th><th className="r">净额</th></tr></thead>
                <tbody>
                  {(report.data.trial_balance ?? []).map((r: any) => (
                    <tr key={r.code}>
                      <td className="mono">{r.code}</td>
                      <td>{r.name}</td>
                      <td><span className="chip chip-mute">{r.kind}</span></td>
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
                <div><span className="uplabel text-ink-5">id</span><div className="mono">{entryDetail.data.entry.id}</div></div>
                <div><span className="uplabel text-ink-5">业务</span><div>{entryDetail.data.entry.business_kind}</div></div>
                <div><span className="uplabel text-ink-5">业务 ref</span><div className="mono">{entryDetail.data.entry.business_ref_id ?? '—'}</div></div>
                <div><span className="uplabel text-ink-5">状态</span><div><span className={statusChip(entryDetail.data.entry.status)}>{entryDetail.data.entry.status}</span></div></div>
                <div><span className="uplabel text-ink-5">入账时间</span><div>{ts(entryDetail.data.entry.posted_at)}</div></div>
                <div><span className="uplabel text-ink-5">入账人</span><div>{entryDetail.data.entry.posted_by_kind} {entryDetail.data.entry.posted_by_id ?? ''}</div></div>
              </div>
              <div className="mt-2 px-3 py-2 bg-surface-2 rounded">{entryDetail.data.entry.description}</div>
            </section>
            <section>
              <h3 className="font-semibold mb-2">分录行 ({entryDetail.data.lines.length})</h3>
              <table className="wa-table">
                <thead><tr><th>#</th><th>科目</th><th>名称</th><th>类</th><th className="r">借方</th><th className="r">贷方</th><th>note</th></tr></thead>
                <tbody>
                  {entryDetail.data.lines.map((l: any) => (
                    <tr key={l.id}>
                      <td className="mono">{l.line_no}</td>
                      <td className="mono">{l.account_code}</td>
                      <td>{l.account_name}</td>
                      <td><span className="chip chip-mute">{l.account_kind}</span></td>
                      <td className="r font-semibold">{l.debit_minor > 0 ? yuan(l.debit_minor, l.currency) : '—'}</td>
                      <td className="r font-semibold">{l.credit_minor > 0 ? yuan(l.credit_minor, l.currency) : '—'}</td>
                      <td className="text-[11px] text-ink-4">{l.note}</td>
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
