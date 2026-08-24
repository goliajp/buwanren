import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { ts, rel, shortId, platformChip, thou } from '../components/util';

interface Row {
  id: string; user_id: string; nickname: string; platform: string; region: string;
  asked_at: string; gate: string; direction: string; gate_explain: string;
  suit_words: string[]; avoid_words: string[];
}

const GATES = ['休门','生门','伤门','杜门','景门','死门','惊门','开门'];

export default function Naji() {
  const [page, setPage] = useState(1);
  const [gate, setGate] = useState('');
  const [platform, setPlatform] = useState('');
  const [userId, setUserId] = useState('');
  const size = 30;

  const { data, isLoading } = useQuery({
    queryKey: ['naji', page, gate, platform, userId],
    queryFn: () => api.get<{ items: Row[]; total: number }>(
      `/naji?page=${page}&size=${size}&gate=${gate}&platform=${platform}&user_id=${userId}`
    ),
    refetchInterval: 15_000,
  });

  return (
    <div className="min-w-0">
      <PageHeader
        title="Naji log · 纳吉记录"
        sub="auto-refresh 15s"
        stats={[
          { label: 'total', value: data ? thou(data.total) : '—' },
          { label: 'shown', value: data ? thou(data.items.length) : '—' },
        ]}
      />
      <div className="p-4 space-y-3">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">filters</span>
            <span className="panel-sub">naji_record · JOIN app_user</span>
          </div>
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
            <input
              placeholder="user_id 精确"
              value={userId}
              onChange={(e) => { setUserId(e.target.value); setPage(1); }}
              className="input w-56 mono"
            />
            <select value={gate} onChange={(e) => { setGate(e.target.value); setPage(1); }} className="select w-28">
              <option value="">all gate</option>
              {GATES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }} className="select w-28">
              <option value="">all platform</option>
              <option value="web">web</option>
              <option value="mini">mini</option>
              <option value="ios">ios</option>
              <option value="android">android</option>
            </select>
            <div className="flex-1" />
            <button onClick={() => { setUserId(''); setGate(''); setPlatform(''); }} className="btn btn-soft">reset</button>
          </div>
        </div>

        <div className="panel">
          <div className="overflow-x-auto">
            <table className="wa-table">
              <thead>
                <tr>
                  <th className="w-28">id</th>
                  <th className="w-44">user</th>
                  <th className="w-20">platform</th>
                  <th className="w-16">gate</th>
                  <th className="w-20">dir</th>
                  <th>suit / avoid</th>
                  <th className="r w-40">asked_at</th>
                  <th className="r w-24">delta</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={8} className="text-center py-8 text-ink-5">loading…</td></tr>}
                {data?.items.map(r => (
                  <tr key={r.id}>
                    <td className="mono text-ink-3" title={r.id}>{shortId(r.id, 4, 4)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{r.nickname}</span>
                        <span className="mono text-[10px] text-ink-5">{shortId(r.user_id, 4, 4)}</span>
                      </div>
                    </td>
                    <td><span className={platformChip(r.platform)}>{r.platform}</span></td>
                    <td className="font-semibold text-ink">{r.gate}</td>
                    <td className="text-ink-3">{r.direction}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1">
                        {r.suit_words?.map(w => <span key={'s'+w} className="chip chip-ok">宜 {w}</span>)}
                        {r.avoid_words?.map(w => <span key={'a'+w} className="chip chip-bad">忌 {w}</span>)}
                      </div>
                    </td>
                    <td className="r mono text-[11px] text-ink-3">{ts(r.asked_at)}</td>
                    <td className="r text-ink-4">{rel(r.asked_at)}</td>
                  </tr>
                ))}
                {data && data.items.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-ink-5">no rows</td></tr>
                )}
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
