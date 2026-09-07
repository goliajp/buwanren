import type { ReactNode } from 'react';

/* 页头 = 页名 + 这一页最要紧的那个数。
 *
 * 上一版把三四个数并排摆在右边，字号一样、颜色一样 ——
 * 于是「本页 50 条」跟「424 笔待退」长得同样重要，
 * 而后者是要今天处理的，前者只是分页的副产品。
 *
 * 现在分两档:
 *   lead —— 这一页的主数，30px。只能有一个
 *   stats —— 上下文，12px 灰的，跟在后面
 * 主数带 tone='debt' 时吃墨、其余退灰，跟全台一致:缺席要有重量。
 */
interface Stat { label: string; value: ReactNode; tone?: 'debt' | 'settled' | 'pending' }

interface Props {
  title: string;
  /** 一句话说清这一页管什么。给第一次打开的人看，不写表名 */
  sub?: string;
  lead?: Stat;
  stats?: Stat[];
  right?: ReactNode;
}

const 色 = {
  debt: 'text-debt',
  settled: 'text-settled',
  pending: 'text-pending',
} as const;

export default function PageHeader({ title, sub, lead, stats, right }: Props) {
  return (
    <header className="px-5 py-4 border-b border-rule bg-card flex items-end gap-6">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold tracking-tight leading-none">{title}</h1>
        {sub && <p className="label mt-1.5 truncate">{sub}</p>}
      </div>

      {stats && stats.length > 0 && (
        <dl className="flex items-baseline gap-5 shrink-0">
          {stats.map((s, i) => (
            <div key={i} className="flex items-baseline gap-1.5">
              <dt className="label">{s.label}</dt>
              <dd className={`n text-sm font-medium ${s.tone ? 色[s.tone] : 'text-ink-2'}`}>
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {lead && (
        <div className="shrink-0 text-right">
          <div className="label">{lead.label}</div>
          <div
            className={`n text-xl font-semibold tracking-tight leading-none mt-0.5 ${
              lead.tone ? 色[lead.tone] : 'text-ink'
            }`}
          >
            {lead.value}
          </div>
        </div>
      )}

      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}
