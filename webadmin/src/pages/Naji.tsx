import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { ts, rel, shortId, platformLabel, thou, enumLabel } from '../components/util';

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
        title="问签记录"
        sub="谁在什么时候问了签，抽到了哪一门、宜什么忌什么"
        stats={[
          { label: '一共', value: data ? thou(data.total) : '—' },
          { label: '本页', value: data ? thou(data.items.length) : '—' },
        ]}
      />
      <div className="p-4 space-y-3">
        <div className="panel">
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
            <input
              placeholder="用户号（要完整）"
              value={userId}
              onChange={(e) => { setUserId(e.target.value); setPage(1); }}
              className="input w-56 font-mono"
            />
            <select value={gate} onChange={(e) => { setGate(e.target.value); setPage(1); }} className="select w-28">
              <option value="">所有门</option>
              {GATES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }} className="select w-28">
              <option value="">所有平台</option>
              <option value="web">网页</option>
              <option value="mini">小程序</option>
              <option value="ios">iOS</option>
              <option value="android">安卓</option>
            </select>
            <div className="flex-1" />
            <button onClick={() => { setUserId(''); setGate(''); setPlatform(''); }} className="btn btn-soft">重置</button>
          </div>
        </div>

        <div className="panel">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-28">编号</th>
                  <th className="w-44">用户</th>
                  <th className="w-20">平台</th>
                  <th className="w-16">门槛</th>
                  <th className="w-20">方向</th>
                  <th>宜 / 忌</th>
                  <th className="r w-40">问于</th>
                  <th className="r w-24">距今</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={8} className="text-center py-8 text-ink-4">正在取…</td></tr>}
                {data?.items.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-ink-3" title={r.id}>{shortId(r.id, 4, 4)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{r.nickname}</span>
                        <span className="font-mono text-xs text-ink-4">{shortId(r.user_id, 4, 4)}</span>
                      </div>
                    </td>
                    <td className="text-ink-2">{platformLabel(r.platform)}</td>
                    <td className="font-semibold text-ink">{r.gate}</td>
                    <td className="text-ink-3">{enumLabel(r.direction)}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1"
                           title={[...(r.suit_words ?? []).map(w => '宜 ' + w),
                                   ...(r.avoid_words ?? []).map(w => '忌 ' + w)].join('　')}>
                        {r.suit_words?.slice(0, 3).map(w => <span key={'s'+w} className="text-settled">宜 {w}</span>)}
                        {r.avoid_words?.slice(0, 2).map(w => <span key={'a'+w} className="text-debt">忌 {w}</span>)}
                        {(r.suit_words?.length ?? 0) + (r.avoid_words?.length ?? 0) > 5 && (
                          <span className="text-ink-4">
                            还有 {(r.suit_words?.length ?? 0) + (r.avoid_words?.length ?? 0) - 5} 条
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="r font-mono text-xs text-ink-3">{ts(r.asked_at)}</td>
                    <td className="r text-ink-4">{rel(r.asked_at)}</td>
                  </tr>
                ))}
                {data && data.items.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-ink-4">没有符合条件的问签</td></tr>
                )}
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
