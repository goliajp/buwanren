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
        title="排盘服务"
        sub="算盘面的那台服务还活着吗，算得快不快"
        stats={[
          { label: '算子', value: data?.upstream?.leaf_count != null ? thou(data.upstream.leaf_count) : '—' },
          { label: '上次检查', value: dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-US', { hour12: false }) : '—' },
        ]}
      />
      <div className="p-4 space-y-3">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">探测</span>
            <span className="label">{data?.base ?? '—'}</span>
          </div>
          <div className="px-4 py-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${data?.reachable ? 'bg-settled animate-pulse' : 'bg-debt'}`} />
              <span className={`font-semibold ${data?.reachable ? 'text-settled' : 'text-debt'}`}>
                {data ? (data.reachable ? '在线' : '连不上') : '正在探…'}
              </span>
            </div>
            <span className="font-mono text-xs text-ink-3">{data?.base}</span>
            <div className="flex-1" />
            {data?.upstream?.service && (
              <span className="text-settled">{data.upstream.service}</span>
            )}
            {data?.error && (
              <span className="text-xs text-debt">{data.error}</span>
            )}
          </div>
        </div>

        {data?.upstream?.leaves && (
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">它会算哪些盘</span>
              <span className="label">这份清单是问它自己要的</span>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th className="w-24">编号</th>
                    <th>名称</th>
                    <th className="w-40">门类</th>
                    <th className="w-20">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upstream.leaves.map((l, i) => (
                    <tr key={l.id}>
                      <td className="num text-ink-4">{i + 1}</td>
                      <td className="font-mono text-ink-3">{l.id}</td>
                      <td className="text-ink font-medium">{l.name}</td>
                      <td className="text-ink-3">{l.family_label}</td>
                      <td><span className="text-settled">正常</span></td>
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
              <span className="panel-title">起不来怎么办</span>
              <span className="label">排盘服务怎么起</span>
            </div>
            <div className="px-4 py-3 text-[12px] text-ink-3 space-y-1">
              <div>1. 回主项目： <code className="font-mono bg-sunk px-1 rounded">cd ~/workspace/goliajp/mingli</code></div>
              <div>2. 启算力： <code className="font-mono bg-sunk px-1 rounded">cargo run -p mingli-api --release</code></div>
              <div>3. 默认端口 :6027，本控制台 15s 自动重检</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
