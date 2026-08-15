import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { ts, statusChip, thou } from '../components/util';

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

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', page, search, status],
    queryFn: () => api.get<{ items: Row[]; total: number }>(
      `/quotes?page=${page}&size=${size}&q=${encodeURIComponent(search)}&status=${status}`
    ),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.delete(`/quotes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });

  return (
    <div className="min-w-0">
      <PageHeader
        title="Content · 语料"
        sub="quote · 庄子 / 道德经 / 论语 / 周易"
        stats={[{ label: 'total', value: data ? thou(data.total) : '—' }]}
      />
      <div className="p-4 space-y-3">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">filters</span>
            <span className="panel-sub">WHERE text LIKE %q% AND status</span>
          </div>
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
            <input
              placeholder="正文模糊"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input w-64"
            />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="select w-32">
              <option value="">all status</option>
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
            <div className="flex-1" />
            <button className="btn btn-prim">+ new quote</button>
          </div>
        </div>

        <div className="panel">
          <div className="overflow-x-auto">
            <table className="wa-table">
              <thead>
                <tr>
                  <th className="w-20">id</th>
                  <th className="w-24">book</th>
                  <th className="w-28">chapter</th>
                  <th>text</th>
                  <th className="w-32">wuxing</th>
                  <th className="w-40">gate</th>
                  <th className="c w-16">sens</th>
                  <th className="w-24">status</th>
                  <th className="r w-32">created_at</th>
                  <th className="r w-20">act</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={10} className="text-center py-8 text-ink-5">loading…</td></tr>}
                {data?.items.map(r => (
                  <tr key={r.id}>
                    <td className="mono text-ink-3">{r.id}</td>
                    <td className="text-ink-2">{r.book}</td>
                    <td className="text-ink-3">{r.chapter ?? '—'}</td>
                    <td className="text-ink leading-relaxed">{r.text}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {r.wuxing.map(w => <span key={w} className="chip chip-mute">{w}</span>)}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {r.gate.map(g => <span key={g} className="chip chip-info">{g}</span>)}
                      </div>
                    </td>
                    <td className="c">
                      <span className={`chip ${r.sensitivity >= 3 ? 'chip-bad' : r.sensitivity >= 2 ? 'chip-warn' : 'chip-mute'}`}>{r.sensitivity}</span>
                    </td>
                    <td><span className={statusChip(r.status)}>{r.status}</span></td>
                    <td className="r mono text-[11px] text-ink-3">{ts(r.created_at)}</td>
                    <td className="r">
                      <button onClick={() => archive.mutate(r.id)} className="btn-link text-[11px] hover:text-vermilion">archive</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && data.total > size && (
            <div className="border-t border-border px-4 py-2.5 flex items-center justify-between text-[11.5px] text-ink-4">
              <span className="num">{(page - 1) * size + 1}–{Math.min(page * size, data.total)} of {thou(data.total)}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-soft disabled:opacity-40">prev</button>
                <span className="num px-2">{page} / {Math.ceil(data.total / size)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page * size >= data.total} className="btn btn-soft disabled:opacity-40">next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
