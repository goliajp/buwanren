import { useAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { authAtom } from '../store/auth';
import TabNav from '../components/TabNav';

interface NajiHist { id: string; date: string; gate: string; direction: string; }
interface Badge { id: string; code: string; name: string; description: string | null; earned: boolean; }

export default function Me() {
  const [auth] = useAtom(authAtom);
  const nav = useNavigate();
  const { data: hist } = useQuery({
    queryKey: ['naji.history'],
    queryFn: () => api.get<{ items: NajiHist[] }>('/naji/history'),
  });
  const { data: badges } = useQuery({
    queryKey: ['my.badges'],
    queryFn: () => api.get<Badge[]>('/user/me/badges'),
  });
  const hasNatal = !!auth?.user.active_natal_id;
  const { data: summary } = useQuery({
    queryKey: ['summary', auth?.user.active_natal_id],
    queryFn: () => api.get<{ day_master: string; primary_yongshen: string; friendly_hint: string }>(
      `/natal/${auth!.user.active_natal_id}/summary`
    ),
    enabled: hasNatal,
  });

  return (
    <div className="min-h-screen bg-paper paper-tex pb-24 px-5 pt-8">
      <div className="flex items-center gap-3 pb-4 border-b border-stone-200">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold/30 to-paper-warm border border-gold/40 flex items-center justify-center font-serif text-xl text-bronze">
          {summary?.day_master?.slice(0, 1) || auth?.user.nickname?.slice(0, 1) || 'U'}
        </div>
        <div className="flex-1">
          <div className="font-serif text-base font-medium text-ink-deep">{auth?.user.nickname}</div>
          <div className="font-mono text-[10.5px] text-stone-500 mt-0.5">
            {auth?.user.platform} · {auth?.user.region}
          </div>
        </div>
        <ChevronRight size={14} className="text-stone-400" strokeWidth={1.5} />
      </div>

      {/* 唯一八字痕迹 */}
      {hasNatal && summary && (
        <button
          onClick={() => nav('/me/bm')}
          className="w-full text-left my-4 p-4 rounded-2xl bg-gradient-to-br from-gold/10 to-bronze/5 border border-gold/25"
        >
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-mono text-[10px] tracking-[0.16em] text-bronze uppercase">我的 · 本命</span>
            <span className="font-mono text-[10px] text-stone-400">tap 展开 →</span>
          </div>
          <div className="font-serif text-[17px] text-ink-deep font-medium tracking-wider">
            {summary.day_master} · 喜 {summary.primary_yongshen}
          </div>
          <div className="text-[11.5px] text-stone-500 mt-2 leading-relaxed">{summary.friendly_hint}</div>
        </button>
      )}
      {!hasNatal && (
        <button
          onClick={() => nav('/birth')}
          className="w-full text-left my-4 p-4 rounded-2xl bg-paper-warm border border-stone-200"
        >
          <div className="font-mono text-[10px] tracking-[0.16em] text-stone-500 uppercase">未设生辰</div>
          <div className="font-serif text-sm text-ink-deep mt-2">设置生辰 → 让今日吉门只属于你</div>
        </button>
      )}

      <Sec title="纳吉历史" extra={`${hist?.items.length || 0} 次`}>
        {hist?.items.slice(0, 5).map((h) => (
          <div key={h.id} className="flex items-center gap-3 py-2 border-b border-dashed border-stone-200 last:border-0">
            <span className="font-mono text-[10.5px] text-stone-500 w-20">{h.date}</span>
            <span className="font-serif text-[13.5px] text-gold font-medium min-w-[64px]">{h.gate} · {h.direction.slice(0, 1)}</span>
          </div>
        ))}
        {hist?.items.length === 0 && <div className="text-stone-400 text-sm py-3">尚无记录</div>}
      </Sec>

      <Sec title="修行徽章" extra={`${badges?.filter((b) => b.earned).length || 0} / ${badges?.length || 0}`}>
        <div className="grid grid-cols-3 gap-2">
          {badges?.slice(0, 6).map((b) => (
            <div
              key={b.id}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg ${
                b.earned ? 'bg-gold/15 border border-gold/40' : 'bg-paper-warm border border-stone-200'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                b.earned ? 'bg-gold/20 text-bronze' : 'bg-stone-100 text-stone-400'
              }`}>
                <span className="font-serif text-xs">{b.name.slice(0, 1)}</span>
              </div>
              <div className={`font-serif text-[10.5px] text-center ${b.earned ? 'text-ink' : 'text-stone-400'}`}>
                {b.name}
              </div>
            </div>
          ))}
        </div>
      </Sec>

      <TabNav />
    </div>
  );
}

function Sec({ title, extra, children }: { title: string; extra?: string; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b border-stone-200 last:border-0">
      <div className="flex justify-between items-baseline mb-2.5">
        <span className="font-serif text-sm text-ink font-medium">{title}</span>
        {extra && <span className="font-mono text-[10.5px] text-stone-400">{extra}</span>}
      </div>
      {children}
    </div>
  );
}
