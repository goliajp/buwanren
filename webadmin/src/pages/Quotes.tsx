import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import TableError from '../components/TableError';
import { ts, statusClass, statusLabel, thou } from '../components/util';

interface Row {
  id: string; book: string; chapter?: string; text: string; locale: string;
  wuxing: string[]; gate: string[]; sensitivity: number; status: string; created_at: string;
}

export default function Quotes() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const size = 30;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['quotes', page, search, status],
    queryFn: () => api.get<{ items: Row[]; total: number }>(
      `/quotes?page=${page}&size=${size}&q=${encodeURIComponent(search)}&status=${status}`
    ),
  });

  const archive = useApiMutation({
    mutationFn: (id: string) => api.delete(`/quotes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });

  return (
    <div className="min-w-0">
      <PageHeader
        title="语料"
        sub="村民们说的话是从这些书里来的"
        stats={[{ label: '一共', value: data ? thou(data.total) : '—' }]}
      />
      <div className="p-4 space-y-3">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">筛选</span>
          </div>
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
            <input
              placeholder="正文模糊"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input w-64"
            />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="select w-32">
              <option value="">所有状态</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="archived">已归档</option>
            </select>
            <div className="flex-1" />
            <button className="btn btn-prim">新增一条</button>
          </div>
        </div>

        <div className="panel">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-20">编号</th>
                  <th className="w-24">出处</th>
                  <th className="w-28">篇章</th>
                  <th>内容</th>
                  <th className="w-32">五行</th>
                  <th className="w-40">门槛</th>
                  <th className="c w-16">敏感度</th>
                  <th className="w-24">状态</th>
                  <th className="r w-32">创建</th>
                  <th className="r w-20">动作</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={10} className="text-center py-8 text-ink-4">正在取…</td></tr>}
                <TableError 出错={isError} 列数={10} />
                {data?.items.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-ink-3">{r.id}</td>
                    <td className="text-ink-2">{r.book}</td>
                    <td className="text-ink-3">{r.chapter ?? '—'}</td>
                    <td className="text-ink leading-relaxed">{r.text}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {r.wuxing.map(w => <span key={w} className="text-ink-3">{w}</span>)}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {r.gate.map(g => <span key={g} className="text-ink-2">{g}</span>)}
                      </div>
                    </td>
                    <td className="c">
                      <span className={`${r.sensitivity >= 3 ? 'text-debt' : r.sensitivity >= 2 ? 'text-pending' : 'text-ink-3'}`}>{r.sensitivity}</span>
                    </td>
                    <td><span className={statusClass(r.status)}>{statusLabel(r.status)}</span></td>
                    <td className="r font-mono text-xs text-ink-3">{ts(r.created_at)}</td>
                    <td className="r">
                      <button onClick={() => archive.mutate(r.id)} className="btn btn-ghost text-xs hover:text-debt">归档</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && data.total > size && (
            <div className="border-t border-rule px-4 py-2.5 flex items-center justify-between text-xs text-ink-4">
              <span className="num">{(page - 1) * size + 1}–{Math.min(page * size, data.total)} of {thou(data.total)}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-soft disabled:opacity-40">上一页</button>
                <span className="num px-2">{page} / {Math.ceil(data.total / size)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page * size >= data.total} className="btn btn-soft disabled:opacity-40">下一页</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
