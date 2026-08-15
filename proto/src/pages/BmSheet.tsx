import { useAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { authAtom } from '../store/auth';

interface Summary {
  day_master: string; strength_level: string;
  primary_yongshen: string; primary_role: string;
  secondary_yongshen: string | null;
  avoid_wuxing: string[];
  friendly_hint: string;
}

export default function BmSheet() {
  const [auth] = useAtom(authAtom);
  const nav = useNavigate();
  const { data: s } = useQuery({
    queryKey: ['summary', auth?.user.active_natal_id],
    queryFn: () => api.get<Summary>(`/natal/${auth!.user.active_natal_id}/summary`),
    enabled: !!auth?.user.active_natal_id,
  });

  return (
    <div className="fixed inset-0 bg-ink/30 z-50 mx-auto max-w-md">
      <div onClick={() => nav(-1)} className="absolute inset-0" />
      <div className="absolute bottom-7 left-0 right-0 bg-paper rounded-t-3xl max-h-[76%] overflow-y-auto px-6 pb-6 animate-slide-up">
        <div className="flex justify-center py-2.5">
          <div className="w-9 h-1 rounded-full bg-stone-300" />
        </div>
        <div className="py-4 border-b border-stone-200">
          <div className="font-mono text-[10px] tracking-[0.18em] text-stone-400 uppercase">
            ◌ 我的 · 本命简介
          </div>
          <div className="font-mono text-[13px] text-ink mt-1.5">1987·09·17 · 15:00 · 长沙</div>
        </div>

        {!s && <div className="py-8 text-center text-stone-400">加载中…</div>}
        {s && (
          <>
            <div className="text-center py-5">
              <div className="font-serif text-[54px] leading-none text-ink-deep font-medium tracking-wider">
                {s.day_master}
              </div>
              <div className="font-mono text-xs text-stone-500 mt-3 tracking-wider">
                气数 · <b className="font-serif text-bronze text-sm">{s.strength_level}</b>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-stone-200">
              <div>
                <div className="font-mono text-[10px] tracking-widest text-stone-500 uppercase mb-1.5">所喜</div>
                <div className="font-serif text-xl text-jade font-medium">
                  {s.primary_yongshen}{s.secondary_yongshen && ` · ${s.secondary_yongshen}`}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] tracking-widest text-stone-500 uppercase mb-1.5">所忌</div>
                <div className="font-serif text-xl text-stone-400 font-medium">
                  {s.avoid_wuxing.join(' · ')}
                </div>
              </div>
            </div>

            <div className="py-4 font-serif text-[13.5px] text-ink leading-loose tracking-wider">
              <p>{s.friendly_hint}</p>
            </div>

            <div className="flex gap-2 pt-4 border-t border-stone-200">
              <button
                onClick={() => nav('/birth')}
                className="flex-1 border border-stone-400 text-ink py-2.5 rounded-full text-xs font-medium"
              >
                编辑生辰
              </button>
              <button
                onClick={() => nav(-1)}
                className="flex-1 bg-ink-deep text-paper py-2.5 rounded-full text-xs font-medium"
              >
                不再显示
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
