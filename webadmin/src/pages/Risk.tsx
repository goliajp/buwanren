import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import TableError from '../components/TableError';
import Pagination from '../components/Pagination';
import { rel, ts, shortId, statusClass, statusLabel, enumLabel, riskStageLabel } from '../components/util';
import { Power, RefreshCw } from 'lucide-react';

function 严重度名(s?: string | null): string {
  return { low: '轻', med: '中', high: '重', critical: '要命' }[s ?? ''] ?? (s ?? '—');
}

/* 结掉一个风控案子。
 *
 * 【「确实有问题」和「规则报错了」要分得开】。混成一个之后，
 * 规则调不调、调哪一条，就再也无从判断。 */
function 结案({ 案子, 结完 }: { 案子: any; 结完: () => void }) {
  const [开着, 设开] = useState(false);
  const [判, 设判] = useState('resolved');
  const [说, 设说] = useState('');
  const 提交 = useApiMutation({
    mutationFn: () => commerce.closeRiskCase(案子.id, 判, 说.trim()),
    onSuccess: () => { 设开(false); 设说(''); 结完(); },
  });

  if (!开着) return <button className="btn btn-soft" onClick={() => 设开(true)}>结案</button>;
  return (
    <div className="flex items-center gap-1.5">
      <select className="select" value={判} onChange={(e) => 设判(e.target.value)}>
        <option value="resolved">确实有问题，已处理</option>
        <option value="false_positive">规则报错了</option>
        <option value="investigating">还在查</option>
      </select>
      <input className="input w-44" placeholder="是怎么判的"
             value={说} onChange={(e) => 设说(e.target.value)} />
      <button className="btn btn-prim" disabled={!说.trim() || 提交.isPending}
              onClick={() => 提交.mutate()}>{提交.isPending ? '…' : '存'}</button>
      <button className="btn btn-ghost" onClick={() => 设开(false)}>算了</button>
    </div>
  );
}

export default function Risk() {
  const qc = useQueryClient();
  /* 【看板说「2 个案子没结」，点过去要落在案子上】
     （2026-09-04 · 25 计划的后台逐页走）。
     这一页三个 tab，默认是「规则」——两百来条。而看板那条待办
     写的是 `/risk`，于是点「去看」落到两百条规则里，
     那两个真要处理的案子在第三个 tab，得自己找。

     跟 `lib/urlfilter.ts` 里记的那件事是同一种:界面看着通了，路是断的。
     订单、物流那几条待办后来都带上了筛选参数，风控这条没有 ——
     因为它要切的不是筛选，是 tab，而这一页当时不认网址。 */
  const [tab, setTab] = useState<'rules' | 'events' | 'cases'>(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return t === 'events' || t === 'cases' ? t : 'rules';
  });
  const [page, setPage] = useState(0);

  const rules = useQuery({ queryKey: ['risk-rules'], queryFn: () => commerce.listRiskRules(), enabled: tab === 'rules' });
  const events = useQuery({
    queryKey: ['risk-events', page], queryFn: () => commerce.listRiskEvents({ page, size: 50 }), enabled: tab === 'events',
  });
  const cases = useQuery({
    queryKey: ['risk-cases', page], queryFn: () => commerce.listRiskCases({ page, size: 50 }), enabled: tab === 'cases',
  });

  const setState = useApiMutation({
    mutationFn: (v: { id: string; status: string }) => commerce.updateRiskRuleState(v.id, v.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk-rules'] }),
  });

  return (
    <div>
      <PageHeader title="风控" sub="看着不太对劲的单子，和你为它们定的规矩" stats={[
        { label: '规则', value: (rules.data ?? []).length },
        { label: '激活', value: (rules.data ?? []).filter((r: any) => r.status === 'active').length, tone: 'settled' as const },
      ]} />
      <div className="p-4">
        <div className="flex items-center gap-1 mb-3">
          {(['rules','events','cases'] as const).map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-prim' : 'btn-soft'}`}
              onClick={() => { setTab(t); setPage(0); }}>
              {t === 'rules' ? '规则' : t === 'events' ? '事件' : '案件'}
            </button>
          ))}
          <button className="btn btn-soft ml-auto" onClick={() => { rules.refetch(); events.refetch(); cases.refetch(); }}>
            <RefreshCw size={13}/> 刷新
          </button>
        </div>

        {tab === 'rules' && (
          <div className="panel">
            <table className="tbl">
              <thead><tr><th>编号</th><th>名称</th><th>类别</th><th>条件</th><th>动作</th><th className="r">优先</th><th>状态</th><th>生效</th><th className="c">动作</th></tr></thead>
              <tbody>
                <TableError 出错={rules.isError} 列数={9} />
                {(rules.data ?? []).map((r: any) => (
                  <tr key={r.id}>
                    <td className="id">{r.id}</td>
                    <td className="font-medium">{r.name}</td>
                    <td><span className="text-ink-2">{riskStageLabel(r.kind)}</span></td>
                    <td className="font-mono text-xs text-ink-3">{r.expression}</td>
                    <td><span className={`${r.action === 'review' ? 'text-pending' : r.action === 'block' ? 'text-debt' : 'text-ink-2'}`}>{enumLabel(r.action)}</span></td>
                    <td className="r font-mono">{r.priority}</td>
                    <td><span className={statusClass(r.status)}>{statusLabel(r.status)}</span></td>
                    <td title={ts(r.effective_from)}>{rel(r.effective_from)}</td>
                    <td className="c">
                      <button className={`btn ${r.status === 'active' ? 'btn-debt' : 'btn-soft'}`}
                        onClick={() => setState.mutate({ id: r.id, status: r.status === 'active' ? 'paused' : 'active' })}>
                        <Power size={13}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'events' && (
          <div className="panel">
            <table className="tbl">
              <thead><tr><th>编号</th><th>类别</th><th>用户</th><th>订单</th><th>支付</th><th>动作</th><th>命中规则</th><th>时间</th></tr></thead>
              <tbody>
                <TableError 出错={events.isError} 列数={8} />
                {(events.data?.items ?? []).map((e: any) => (
                  <tr key={e.id}>
                    <td className="id">{shortId(e.id)}</td>
                    <td className="id">{riskStageLabel(e.kind)}</td>
                    <td className="font-mono text-ink-3">{e.user_id ? shortId(e.user_id) : '—'}</td>
                    <td className="font-mono text-ink-3">{e.order_id ? shortId(e.order_id) : '—'}</td>
                    <td className="font-mono text-ink-3">{e.payment_id ? shortId(e.payment_id) : '—'}</td>
                    <td><span className={`${e.decided_action === 'block' ? 'text-debt' : e.decided_action === 'review' ? 'text-pending' : 'text-ink-2'}`}>{e.decided_action}</span></td>
                    <td className="text-xs">{(e.matched_rule_ids ?? []).join(', ')}</td>
                    <td>{rel(e.decided_at)}</td>
                  </tr>
                ))}
                {events.data && events.data.items.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-ink-4">— 无风控事件 —</td></tr>
                )}
              </tbody>
            </table>
            {events.data && <Pagination page={page} size={50} total={events.data.total} onPage={setPage} />}
          </div>
        )}

        {tab === 'cases' && (
          <div className="panel">
            <table className="tbl">
              <thead><tr><th>编号</th><th>类别</th><th>严重度</th><th>状态</th><th>负责</th><th>开始</th><th>结束</th><th>备注</th><th>结案</th></tr></thead>
              <tbody>
                <TableError 出错={cases.isError} 列数={9} />
                {(cases.data?.items ?? []).map((c: any) => (
                  <tr key={c.id}>
                    <td className="id">{shortId(c.id)}</td>
                    <td>{enumLabel(c.kind)}</td>
                    <td><span className={c.severity === 'critical' ? 'text-debt' : c.severity === 'high' ? 'text-pending' : 'text-ink-2'}>{严重度名(c.severity)}</span></td>
                    <td><span className={statusClass(c.state)}>{statusLabel(c.state)}</span></td>
                    <td className="font-mono text-ink-3">{c.assigned_admin_id ?? '—'}</td>
                    <td>{rel(c.opened_at)}</td>
                    <td>{rel(c.closed_at)}</td>
                    <td className="text-xs text-ink-4 truncate max-w-[300px]">{c.audit_note}</td>
                    {/* 【看完了总得能判】。在这一列之前风控页只能看:
                        `RiskCaseState` 四个状态定义了，
                        没有一条路走到 resolved 或 false_positive。 */}
                    <td>
                      {['resolved', 'false_positive'].includes(c.state)
                        ? <span className="text-ink-4">已结</span>
                        : <结案 案子={c} 结完={() => cases.refetch()} />}
                    </td>
                  </tr>
                ))}
                {cases.data && cases.data.items.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-10 text-ink-4">没有风控案子</td></tr>
                )}
              </tbody>
            </table>
            {cases.data && <Pagination page={page} size={50} total={cases.data.total} onPage={setPage} />}
          </div>
        )}
      </div>
    </div>
  );
}
