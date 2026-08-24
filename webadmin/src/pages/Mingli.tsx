import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { thou } from '../components/util';

interface MingliHealth {
  reachable: boolean;
  status?: number;
  upstream?: {
    status?: string;
    service?: string;
    leaf_count?: number;
    leaves?: { id: string; name: string; family_label: string }[];
  };
  base: string;
  error?: string;
}

export default function Mingli() {
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ['mingli.health'],
    queryFn: () => api.get<MingliHealth>('/mingli/health'),
    refetchInterval: 15_000,
  });

  return (
    <div className="min-w-0">
      <PageHeader
        title="Engine · 算力监控"
        sub="mingli-api · 21 叶纯算力 · 15s 自动检测"
        stats={[
          { label: 'leaves', value: data?.upstream?.leaf_count != null ? thou(data.upstream.leaf_count) : '—' },
          { label: 'last_check', value: dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-US', { hour12: false }) : '—' },
        ]}
      />
      <div className="p-4 space-y-3">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">probe</span>
            <span className="panel-sub">GET {data?.base ?? '—'}/api/health</span>
          </div>
          <div className="px-4 py-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${data?.reachable ? 'bg-jade animate-pulse' : 'bg-vermilion'}`} />
              <span className={`font-semibold ${data?.reachable ? 'text-jade' : 'text-vermilion'}`}>
                {data ? (data.reachable ? 'online' : 'offline') : 'probing…'}
              </span>
            </div>
            <span className="mono text-[11.5px] text-ink-3">{data?.base}</span>
            <div className="flex-1" />
            {data?.upstream?.service && (
              <span className="chip chip-ok">{data.upstream.service}</span>
            )}
            {data?.error && (
              <span className="text-[11.5px] text-vermilion">{data.error}</span>
            )}
          </div>
        </div>

        {data?.upstream?.leaves && (
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">leaves · 21 叶清单</span>
              <span className="panel-sub">从 mingli-api /api/health 拉</span>
            </div>
            <div className="overflow-x-auto">
              <table className="wa-table">
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th className="w-24">id</th>
                    <th>name</th>
                    <th className="w-40">family</th>
                    <th className="w-20">status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upstream.leaves.map((l, i) => (
                    <tr key={l.id}>
                      <td className="num text-ink-4">{i + 1}</td>
                      <td className="mono text-ink-3">{l.id}</td>
                      <td className="text-ink font-medium">{l.name}</td>
                      <td className="text-ink-3">{l.family_label}</td>
                      <td><span className="chip chip-ok">healthy</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!data?.reachable && (
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">remediation</span>
              <span className="panel-sub">how to start mingli-api</span>
            </div>
            <div className="px-4 py-3 text-[12px] text-ink-3 space-y-1">
              <div>1. 回主项目： <code className="mono bg-surface-2 px-1 rounded">cd ~/workspace/goliajp/mingli</code></div>
              <div>2. 启算力： <code className="mono bg-surface-2 px-1 rounded">cargo run -p mingli-api --release</code></div>
              <div>3. 默认端口 :6027，本控制台 15s 自动重检</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
