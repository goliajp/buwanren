import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import TabNav from '../components/TabNav';

interface ActItem {
  id: string; title: string; sub_title: string | null; category: string;
  banner_url: string | null; city: string | null; start_at: string;
  max_participants: number; current_count: number; price_display: string;
}

export default function Activity() {
  const [cat, setCat] = useState<'market' | 'course' | 'energy'>('market');
  const { data } = useQuery({
    queryKey: ['activity', cat],
    queryFn: () => api.get<{ items: ActItem[] }>(`/activity?category=${cat}&region=cn`),
  });

  return (
    <div className="min-h-screen bg-paper paper-tex pb-24 px-5 pt-8">
      <div className="mb-4">
        <div className="font-mono text-[10px] tracking-[0.18em] text-stone-400 uppercase">行 · activity</div>
        <h1 className="font-serif text-2xl font-medium text-ink-deep mt-1">线下相聚</h1>
      </div>
      <div className="flex gap-4 border-b border-stone-200 pb-3 mb-4">
        {[['market', '愈市集'], ['course', '课程'], ['energy', '能量']].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setCat(k as any)}
            className={`text-sm relative pb-2 ${cat === k ? 'text-ink-deep font-medium' : 'text-stone-500'}`}
          >
            {l}
            {cat === k && <span className="absolute -bottom-3 left-0 right-0 h-0.5 bg-gold" />}
          </button>
        ))}
      </div>

      {!data && <div className="text-stone-400 text-sm mt-8 text-center">加载中…</div>}
      {data?.items.length === 0 && <div className="text-stone-400 text-sm mt-8 text-center">暂无活动</div>}

      <div className="space-y-3">
        {data?.items.map((a) => (
          <div key={a.id} className="bg-paper-warm border border-stone-200 rounded-xl p-3 flex gap-3">
            {a.banner_url ? (
              <img src={a.banner_url} className="w-20 h-20 rounded-lg object-cover" alt="" />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-gold/40 to-bronze/30 flex items-center justify-center text-paper font-serif text-2xl">
                {a.title.slice(0, 1)}
              </div>
            )}
            <div className="flex-1">
              <div className="font-serif text-sm font-medium text-ink-deep">{a.title}</div>
              <div className="font-mono text-[11px] text-stone-500 mt-0.5">
                {a.start_at.slice(5, 16)} · {a.city}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="font-mono text-[10px] text-bronze">{a.current_count} / {a.max_participants}</span>
                <div className="flex-1 h-0.5 bg-stone-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gold" style={{ width: `${(a.current_count / a.max_participants) * 100}%` }} />
                </div>
              </div>
              <div className="font-mono text-xs text-bronze mt-2">{a.price_display}</div>
            </div>
          </div>
        ))}
      </div>

      <TabNav />
    </div>
  );
}
