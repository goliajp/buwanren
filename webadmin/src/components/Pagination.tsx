import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props { page: number; size: number; total: number; onPage: (p: number) => void; }

export default function Pagination({ page, size, total, onPage }: Props) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : page * size + 1;
  const to = Math.min(total, (page + 1) * size);
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-surface-2/60 text-[12px] text-ink-3">
      <div className="num">
        {from.toLocaleString()}-{to.toLocaleString()} / {total.toLocaleString()}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          className="btn btn-soft disabled:opacity-40"
          disabled={page <= 0}
          onClick={() => onPage(page - 1)}
        ><ChevronLeft size={13} /> 上一页</button>
        <span className="num text-ink-4 px-2">{page + 1} / {pages}</span>
        <button
          className="btn btn-soft disabled:opacity-40"
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
        >下一页 <ChevronRight size={13} /></button>
      </div>
    </div>
  );
}
