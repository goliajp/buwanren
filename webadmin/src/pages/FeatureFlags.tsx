import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
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
  const { data, isLoading } = useQuery({
    queryKey: ['feature_flags'],
    queryFn: () => api.get<{ items: FlagRow[] }>('/feature_flags'),
  });

  const update = useMutation({
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
        title="Flags · 差异化"
        sub="feature_flag · platform × region × user_segment"
      />
      <div className="p-4 space-y-3">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">matrix</span>
            <span className="panel-sub">默认值 · platform override · region override</span>
          </div>
          <div className="overflow-x-auto">
            <table className="wa-table">
              <thead>
                <tr>
                  <th>code</th>
                  <th>description</th>
                  <th className="c w-20">default</th>
                  <th colSpan={4} className="c border-l border-border">platforms</th>
                  <th colSpan={6} className="c border-l border-border">regions</th>
                  <th className="r w-32 border-l border-border">updated</th>
                </tr>
                <tr>
                  <th></th>
                  <th></th>
                  <th></th>
                  {PLATFORMS.map(p => <th key={p} className="c uplabel">{p}</th>)}
                  {REGIONS.map(r => <th key={r} className="c uplabel">{r}</th>)}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={13} className="text-center py-8 text-ink-5">loading…</td></tr>}
                {data?.items.map(f => (
                  <tr key={f.code}>
                    <td className="mono text-[11px] text-ink">{f.code}</td>
                    <td className="text-ink-3 leading-relaxed">{f.description ?? '—'}</td>
                    <td className="c">
                      <button
                        onClick={() => update.mutate({ code: f.code, body: { default_on: !f.default_on } })}
                        className={`chip ${f.default_on ? 'chip-ok' : 'chip-mute'}`}
                      >{f.default_on ? 'on' : 'off'}</button>
                    </td>
                    {PLATFORMS.map(p => (
                      <td key={p} className="c">
                        <button
                          onClick={() => togglePlatform(f, p)}
                          className={`w-5 h-5 rounded text-[10px] font-medium ${
                            f.by_platform?.[p] === false ? 'bg-vermilion text-canvas' : 'bg-surface-2 text-ink-5 hover:bg-surface-3'
                          }`}
                          title={f.by_platform?.[p] === false ? `${p} OFF override` : `${p} 跟随默认`}
                        >{f.by_platform?.[p] === false ? '×' : '•'}</button>
                      </td>
                    ))}
                    {REGIONS.map(r => (
                      <td key={r} className="c">
                        <button
                          onClick={() => toggleRegion(f, r)}
                          className={`w-5 h-5 rounded text-[10px] font-medium ${
                            f.by_region?.[r] === false ? 'bg-vermilion text-canvas' : 'bg-surface-2 text-ink-5 hover:bg-surface-3'
                          }`}
                          title={f.by_region?.[r] === false ? `${r} OFF override` : `${r} 跟随默认`}
                        >{f.by_region?.[r] === false ? '×' : '•'}</button>
                      </td>
                    ))}
                    <td className="r mono text-[11px] text-ink-3">{ts(f.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-4 py-2 text-[10.5px] text-ink-5">
            <span className="mono">•</span> = follow default · <span className="mono text-vermilion">×</span> = OFF override
          </div>
        </div>
      </div>
    </div>
  );
}
