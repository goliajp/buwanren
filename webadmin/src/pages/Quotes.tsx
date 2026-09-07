import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import TableError from '../components/TableError';
import { ts, statusClass, statusLabel, thou } from '../components/util';

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

  const { data, isLoading, isError } = useQuery({
    queryKey: ['quotes', page, search, status],
    queryFn: () => api.get<{ items: Row[]; total: number }>(
      `/quotes?page=${page}&size=${size}&q=${encodeURIComponent(search)}&status=${status}`
    ),
  });

  const archive = useApiMutation({
    mutationFn: (id: string) => api.delete(`/quotes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });

  /* 【全台唯一一颗没接线的按钮】（2026-09-06 三路验证 · 运营那一路）。
     「新增一条」此前**没有 onClick** —— 而后端 `POST /admin/quotes` 是通的。
     想加一条语料只能找工程师。

     不做一整张表单:这一屏的活儿是「翻、筛、归档」，加一条是偶尔的事。
     用三句 `prompt` 问最少的三样（出处、篇名、正文）—— 其余字段后端有默认值
     （locale zh-CN、敏感度 1、两组 affinity 空数组）。
     哪天加语料成了日常再做表单，那时它值得一屏。 */
  const 新增 = useApiMutation({
    mutationFn: (b: { book: string; chapter?: string; text: string }) =>
      api.post('/quotes', b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });
  const 问一条 = () => {
    const text = prompt('这一句是什么？');
    if (!text || !text.trim()) return;
    const book = prompt('出自哪本书？（如「庄子」）');
    if (!book || !book.trim()) return;
    const chapter = prompt('哪一篇？不写也行') ?? '';
    新增.mutate({ book: book.trim(), chapter: chapter.trim() || undefined, text: text.trim() });
  };

  return (
    <div className="min-w-0">
      <PageHeader
        title="语料"
        sub="村民们说的话是从这些书里来的"
        stats={[{ label: '一共', value: data ? thou(data.total) : '—' }]}
      />
      <div className="p-4 space-y-3">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">筛选</span>
          </div>
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
            <input
              placeholder="正文模糊"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input w-64"
            />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="select w-32">
              <option value="">所有状态</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="archived">已归档</option>
            </select>
            <div className="flex-1" />
            <button className="btn btn-prim" onClick={问一条} disabled={新增.isPending}>
              {新增.isPending ? '存着…' : '新增一条'}
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-20">编号</th>
                  <th className="w-24">出处</th>
                  <th className="w-28">篇章</th>
                  <th>内容</th>
                  <th className="w-32">五行</th>
                  <th className="w-40">门槛</th>
                  <th className="c w-16">敏感度</th>
                  <th className="w-24">状态</th>
                  <th className="r w-32">创建</th>
                  <th className="r w-20">动作</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={10} className="text-center py-8 text-ink-4">正在取…</td></tr>}
                <TableError 出错={isError} 列数={10} />
                {data?.items.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-ink-3">{r.id}</td>
                    <td className="text-ink-2">{r.book}</td>
                    <td className="text-ink-3">{r.chapter ?? '—'}</td>
                    <td className="text-ink leading-relaxed">{r.text}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {r.wuxing.map(w => <span key={w} className="text-ink-3">{w}</span>)}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {r.gate.map(g => <span key={g} className="text-ink-2">{g}</span>)}
                      </div>
                    </td>
                    <td className="c">
                      <span className={`${r.sensitivity >= 3 ? 'text-debt' : r.sensitivity >= 2 ? 'text-pending' : 'text-ink-3'}`}>{r.sensitivity}</span>
                    </td>
                    <td><span className={statusClass(r.status)}>{statusLabel(r.status)}</span></td>
                    <td className="r font-mono text-xs text-ink-3">{ts(r.created_at)}</td>
                    <td className="r">
                      {/* 归档一点就生效 —— 念一句它是哪一条（2026-09-06） */}
                      <button
                        onClick={() => {
                          if (!confirm(`把这一条归档？\n\n「${String(r.text ?? '').slice(0, 40)}」`)) return;
                          archive.mutate(r.id);
                        }}
                        className="btn btn-ghost text-xs hover:text-debt">归档</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* 用共用的分页 —— 手写那一版印的是「1–30 of 26,631」,
              而别的页是「1-50 / 19,153」。同一件事两种说法，
              其中一种还是英文（2026-09-04 · 25 计划的后台逐页走）。
              共用组件的 `page` 从 0 起，这一页从 1 起，差值在这儿转。 */}
          {data && data.total > size && (
            <Pagination page={page - 1} size={size} total={data.total} onPage={(p) => setPage(p + 1)} />
          )}
        </div>
      </div>
    </div>
  );
}
