import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import TableError from '../components/TableError';
import { ts } from '../components/util';
import { useRegions } from '../lib/regions';

interface FlagRow {
  code: string;
  default_on: boolean;
  by_platform: Record<string, boolean>;
  by_region: Record<string, boolean>;
  description: string | null;
  updated_at: string;
}

const PLATFORMS = ['mini','ios','android','web'];
/* 【区从名册来，不在这儿写死】（2026-09-05）。这一行原先是
   `['cn','hk','tw','jp','us','eu']` —— 而名册（`region_registry`）里的
   六格是 cn / jp / kr / sea / na / zh_hant。两边只有 cn 与 jp 对得上:
   按 `tw` 关掉一个功能，**永远关不到人**，而那一列在屏上跟别的列
   长得一模一样（`by_region.tw = false` 落进库，谁也不读它）。 */

export default function FeatureFlags() {
  const qc = useQueryClient();
  /* 【这一页看的是【全部】区，不按 scope 收窄】——灰度矩阵是一张
     全景表，一位分区管理员也该看得见别的格现在开着没有:
     他关掉自己那一格之前，得知道这个功能在别处是什么状态。
     能不能改由后端那道守卫说了算，不靠这儿藏起来。 */
  const REGIONS = useRegions().map((r) => r.code);
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
                  <th colSpan={REGIONS.length} className="c border-l border-rule">区域</th>
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
                {/* 列数跟着区数走 —— 写死 13 的话，名册多一格就少盖一列，
                    占位行短一截、表格错开（代号/说明/默认 3 + 平台 4 + 区 N + 更新 1） */}
                {isLoading && <tr><td colSpan={8 + REGIONS.length} className="text-center py-8 text-ink-4">正在取…</td></tr>}
                <TableError 出错={isError} 列数={8 + REGIONS.length} />
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
