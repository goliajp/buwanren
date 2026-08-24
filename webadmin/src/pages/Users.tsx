import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { rel, ts, shortId, platformChip, thou } from '../components/util';
import { Search } from 'lucide-react';

interface UserRow {
  id: string; nickname: string; platform: string; region: string; locale: string;
  is_anonymous: boolean; created_at: string; last_active_at: string;
}

export default function Users() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [region, setRegion] = useState('');
  const size = 30;

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, platform, region],
    queryFn: () => api.get<{ items: UserRow[]; total: number; size: number }>(
      `/users?page=${page}&size=${size}&q=${encodeURIComponent(search)}&platform=${platform}&region=${region}`
    ),
  });

  return (
    <div className="min-w-0">
      <PageHeader
        title="Users · 用户"
        sub={`page ${page} · size ${size}`}
        stats={[
          { label: 'total', value: data ? thou(data.total) : '—' },
          { label: 'showing', value: data ? thou(data.items.length) : '—' },
        ]}
      />
      <div className="p-4 space-y-3">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">filters</span>
            <span className="panel-sub">SQL · WHERE platform / region / q (LIKE id|nickname)</span>
          </div>
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-5" />
              <input
                placeholder="id / 昵称"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="input pl-7 w-56"
              />
            </div>
            <select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }} className="select w-28">
              <option value="">all platform</option>
              <option value="web">web</option>
              <option value="mini">mini</option>
              <option value="ios">ios</option>
              <option value="android">android</option>
            </select>
            <select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }} className="select w-28">
              <option value="">all region</option>
              <option value="cn">cn</option>
              <option value="hk">hk</option>
              <option value="tw">tw</option>
              <option value="jp">jp</option>
              <option value="us">us</option>
            </select>
            <div className="flex-1" />
            <button onClick={() => { setSearch(''); setPlatform(''); setRegion(''); }} className="btn btn-soft">reset</button>
            <button onClick={() => window.location.reload()} className="btn btn-soft">↻ refresh</button>
          </div>
        </div>

        <div className="panel">
          <div className="overflow-x-auto">
            <table className="wa-table">
              <thead>
                <tr>
                  <th className="w-8 c"><input type="checkbox" disabled /></th>
                  <th className="w-32">id</th>
                  <th>nickname</th>
                  <th className="w-20">platform</th>
                  <th className="w-16">region</th>
                  <th className="w-20">locale</th>
                  <th className="w-16 c">anon</th>
                  <th className="r w-44">created_at</th>
                  <th className="r w-40">last_active</th>
                  <th className="r w-16">act</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={10} className="text-center py-8 text-ink-5">loading…</td></tr>
                )}
                {data?.items.map((r) => (
                  <tr key={r.id}>
                    <td className="c"><input type="checkbox" /></td>
                    <td className="mono text-ink-3" title={r.id}>{shortId(r.id, 6, 6)}</td>
                    <td className="text-ink font-medium">{r.nickname}</td>
                    <td><span className={platformChip(r.platform)}>{r.platform}</span></td>
                    <td className="uplabel text-ink-3">{r.region}</td>
                    <td className="mono text-[11px] text-ink-4">{r.locale}</td>
                    <td className="c">
                      {r.is_anonymous
                        ? <span className="chip chip-mute">anon</span>
                        : <span className="chip chip-ok">user</span>}
                    </td>
                    <td className="r mono text-[11px] text-ink-3">{ts(r.created_at)}</td>
                    <td className="r text-ink-3">{rel(r.last_active_at)}</td>
                    <td className="r"><button className="btn-link text-[11px]">view →</button></td>
                  </tr>
                ))}
                {data && data.items.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-8 text-ink-5">no rows</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.total > size && (
            <div className="border-t border-border px-4 py-2.5 flex items-center justify-between text-[11.5px] text-ink-4">
              <span className="num">{(page - 1) * size + 1}–{Math.min(page * size, data.total)} of {thou(data.total)}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1} className="btn btn-soft disabled:opacity-40">«</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-soft disabled:opacity-40">prev</button>
                <span className="num px-2">page {page} / {Math.ceil(data.total / size)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page * size >= data.total} className="btn btn-soft disabled:opacity-40">next</button>
                <button onClick={() => setPage(Math.ceil(data.total / size))} disabled={page * size >= data.total} className="btn btn-soft disabled:opacity-40">»</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
