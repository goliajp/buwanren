import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import TableError from '../components/TableError';
import { ts } from '../components/util';

interface FlagRow {
  code: string;
  default_on: boolean;
  by_platform: Record<string, boolean>;
  by_region: Record<string, boolean>;
  description: string | null;
  updated_at: string;
}

const PLATFORMS = ['mini','ios','android','web'];
const REGIONS   = ['cn','hk','tw','jp','us','eu'];

export default function FeatureFlags() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['feature_flags'],
    queryFn: () => api.get<{ items: FlagRow[] }>('/feature_flags'),
  });

  const update = useApiMutation({
    mutationFn: ({ code, body }: { code: string; body: any }) => api.patch(`/feature_flags/${code}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feature_flags'] }),
  });

  const togglePlatform = (f: FlagRow, p: string) => {
    const next = { ...f.by_platform };
    if (next[p] === false) delete next[p]; else next[p] = false;
    update.mutate({ code: f.code, body: { by_platform: next } });
  };
  const toggleRegion = (f: FlagRow, r: string) => {
    const next = { ...f.by_region };
    if (next[r] === false) delete next[r]; else next[r] = false;
    update.mutate({ code: f.code, body: { by_region: next } });
  };

  return (
    <div className="min-w-0">
      <PageHeader
        title="灰度开关"
        sub="哪些人能先用上新功能"
      />
      <div className="p-4 space-y-3">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">开关矩阵</span>
            <span className="label">默认开不开，以及哪些平台、哪些区域另说</span>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>代号</th>
                  <th>说明</th>
                  <th className="c w-20">默认</th>
                  <th colSpan={4} className="c border-l border-rule">平台</th>
                  <th colSpan={6} className="c border-l border-rule">区域</th>
                  <th className="r w-32 border-l border-rule">更新</th>
                </tr>
                <tr>
                  <th></th>
                  <th></th>
                  <th></th>
                  {PLATFORMS.map(p => <th key={p} className="c label">{p}</th>)}
                  {REGIONS.map(r => <th key={r} className="c label">{r}</th>)}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={13} className="text-center py-8 text-ink-4">正在取…</td></tr>}
                <TableError 出错={isError} 列数={13} />
                {data?.items.map(f => (
                  <tr key={f.code}>
                    <td className="font-mono text-xs text-ink">{f.code}</td>
                    <td className="text-ink-3 leading-relaxed">{f.description ?? '—'}</td>
                    <td className="c">
                      <button
                        onClick={() => update.mutate({ code: f.code, body: { default_on: !f.default_on } })}
                        className={`${f.default_on ? 'text-settled' : 'text-ink-3'}`}
                      >{f.default_on ? '开' : '关'}</button>
                    </td>
                    {PLATFORMS.map(p => (
                      <td key={p} className="c">
                        <button
                          onClick={() => togglePlatform(f, p)}
                          className={`w-5 h-5 rounded text-xs font-medium ${
                            f.by_platform?.[p] === false ? 'bg-debt text-paper' : 'bg-sunk text-ink-4 hover:bg-sunk'
                          }`}
                          title={f.by_platform?.[p] === false ? `${p} 上单独关掉了` : `${p} 跟随默认`}
                        >{f.by_platform?.[p] === false ? '×' : '•'}</button>
                      </td>
                    ))}
                    {REGIONS.map(r => (
                      <td key={r} className="c">
                        <button
                          onClick={() => toggleRegion(f, r)}
                          className={`w-5 h-5 rounded text-xs font-medium ${
                            f.by_region?.[r] === false ? 'bg-debt text-paper' : 'bg-sunk text-ink-4 hover:bg-sunk'
                          }`}
                          title={f.by_region?.[r] === false ? `${r} 上单独关掉了` : `${r} 跟随默认`}
                        >{f.by_region?.[r] === false ? '×' : '•'}</button>
                      </td>
                    ))}
                    <td className="r font-mono text-xs text-ink-3">{ts(f.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-rule px-4 py-2 text-xs text-ink-4">
            <span className="id">•</span> 跟随默认　<span className="font-mono text-debt">×</span> 在这里单独关掉
          </div>
        </div>
      </div>
    </div>
  );
}
