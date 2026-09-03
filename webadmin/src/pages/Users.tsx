import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { rel, ts, shortId, platformLabel, thou } from '../components/util';
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
        title="用户"
        sub="用过这个产品的每一个人。多数是没登录的游客"
        stats={[
          { label: '一共', value: data ? thou(data.total) : '—' },
          { label: '本页', value: data ? thou(data.items.length) : '—' },
        ]}
      />
      <div className="p-4 space-y-3">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">筛选</span>
          </div>
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-4" />
              <input
                placeholder="用户号或昵称"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="input pl-7 w-56"
              />
            </div>
            <select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }} className="select w-28">
              <option value="">所有平台</option>
              <option value="web">网页</option>
              <option value="mini">小程序</option>
              <option value="ios">iOS</option>
              <option value="android">安卓</option>
            </select>
            <select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }} className="select w-28">
              <option value="">所有区域</option>
              <option value="cn">cn</option>
              <option value="hk">hk</option>
              <option value="tw">tw</option>
              <option value="jp">jp</option>
              <option value="us">us</option>
            </select>
            <div className="flex-1" />
            <button onClick={() => { setSearch(''); setPlatform(''); setRegion(''); }} className="btn btn-soft">重置</button>
            <button onClick={() => window.location.reload()} className="btn btn-soft">刷新</button>
          </div>
        </div>

        <div className="panel">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-32">编号</th>
                  <th>昵称</th>
                  <th className="w-20">平台</th>
                  <th className="w-16">区域</th>
                  <th className="w-20">语言</th>
                  <th className="w-16 c">匿名</th>
                  <th className="r w-44">创建</th>
                  <th className="r w-40">最后活动</th>
                  <th className="r w-16">动作</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={9} className="text-center py-8 text-ink-4">正在取…</td></tr>
                )}
                {data?.items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-ink-3" title={r.id}>{shortId(r.id, 6, 6)}</td>
                    <td className="text-ink font-medium">{r.nickname}</td>
                    <td className="text-ink-2">{platformLabel(r.platform)}</td>
                    <td className="label text-ink-3">{区域名(r.region)}</td>
                    <td className="font-mono text-xs text-ink-4">{r.locale}</td>
                    <td className="c">
                      {r.is_anonymous
                        ? <span className="text-ink-3">游客</span>
                        : <span className="text-settled">已登录</span>}
                    </td>
                    <td className="r font-mono text-xs text-ink-3">{ts(r.created_at)}</td>
                    <td className="r text-ink-3">{rel(r.last_active_at)}</td>
                    <td className="r"><button className="btn btn-ghost">看</button></td>
                  </tr>
                ))}
                {data && data.items.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-ink-4">没有符合条件的用户</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.total > size && (
            <div className="border-t border-rule px-4 py-2.5 flex items-center justify-between text-xs text-ink-4">
              <span className="num">{(page - 1) * size + 1}–{Math.min(page * size, data.total)} of {thou(data.total)}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1} className="btn btn-soft disabled:opacity-40">«</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-soft disabled:opacity-40">上一页</button>
                <span className="num px-2">page {page} / {Math.ceil(data.total / size)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page * size >= data.total} className="btn btn-soft disabled:opacity-40">下一页</button>
                <button onClick={() => setPage(Math.ceil(data.total / size))} disabled={page * size >= data.total} className="btn btn-soft disabled:opacity-40">»</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
