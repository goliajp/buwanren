import type { ReactNode } from 'react';

interface Stat { label: string; value: ReactNode; tone?: 'ok' | 'warn' | 'bad' | undefined; }

interface Props {
  title: string;
  sub?: string;
  right?: ReactNode;
  stats?: Stat[];
}

export default function PageHeader({ title, sub, right, stats }: Props) {
  return (
    <div className="border-b border-border bg-surface px-5 py-3 flex items-center gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[16px] font-semibold text-ink leading-tight">{title}</h1>
          {sub && <span className="uplabel text-ink-5">{sub}</span>}
        </div>
      </div>
      {stats && (
        <div className="flex items-center gap-5">
          {stats.map((s, i) => {
            const color =
              s.tone === 'ok' ? 'text-jade' :
              s.tone === 'warn' ? 'text-gold-2' :
              s.tone === 'bad' ? 'text-vermilion' : 'text-ink';
            return (
              <div key={i} className="flex items-baseline gap-1.5">
                <span className="uplabel text-ink-5">{s.label}</span>
                <span className={`text-[14px] font-semibold num ${color}`}>{s.value}</span>
              </div>
            );
          })}
        </div>
      )}
      {right}
    </div>
  );
}
