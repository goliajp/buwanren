import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Compass from '../components/Compass';
import TabNav from '../components/TabNav';
import { api, NajiResult } from '../lib/api';

export default function Naji() {
  const nav = useNavigate();
  const [spinning, setSpinning] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [result, setResult] = useState<NajiResult | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  function timeStr() {
    const h = now.getHours();
    const m = now.getMinutes();
    const period = h === 23 || h === 0 ? '子时' : h <= 2 ? '丑时' : h <= 4 ? '寅时' : h <= 6 ? '卯时' : h <= 8 ? '辰时' : h <= 10 ? '巳时' : h <= 12 ? '午时' : h <= 14 ? '未时' : h <= 16 ? '申时' : h <= 18 ? '酉时' : h <= 20 ? '戌时' : '亥时';
    return { period, hm: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
  }
  const { period, hm } = timeStr();

  async function handleSpin() {
    setSpinning(true);
    setShowSheet(false);
    try {
      const r = await api.post<NajiResult>('/naji/spin', { time_now: now.toISOString() });
      setTimeout(() => {
        setResult(r);
        setSpinning(false);
        setShowSheet(true);
      }, 3000);
    } catch (e) {
      console.error(e);
      setSpinning(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper paper-tex pb-24 flex flex-col">
      <div className="text-center pt-12 pb-6">
        <div className="font-serif text-[22px] tracking-[0.22em] font-medium text-ink-deep">unmei · 纳吉</div>
        <div className="text-[11px] text-stone-400 mt-1 tracking-wider">知止而后有定</div>
        <div className="inline-flex items-baseline gap-2 mt-3 px-3.5 py-1 bg-gold/10 border border-gold/30 rounded-full">
          <span className="font-mono text-[11px] text-bronze">{period}</span>
          <span className="font-serif text-[13px] text-ink-deep tracking-wider">{hm}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <Compass spinning={spinning} onClick={handleSpin} />
        <div className="mt-6 font-mono text-[10.5px] tracking-[0.16em] uppercase text-stone-400">
          {spinning ? '气运将启…' : '点击中心 · 转出今日吉门'}
        </div>
      </div>

      <div className="text-center font-mono text-[10px] tracking-wider text-stone-400 pb-4">
        <button onClick={() => nav('/birth')} className="underline underline-offset-4 text-bronze">
          设置生辰 → 让今日吉门只属于你
        </button>
      </div>

      {showSheet && result && (
        <ResultSheet result={result} onClose={() => setShowSheet(false)} />
      )}

      <TabNav />
    </div>
  );
}

function ResultSheet({ result, onClose }: { result: NajiResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-ink/20 z-50 animate-fade-in mx-auto max-w-md" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-paper rounded-t-3xl max-h-[75vh] overflow-y-auto animate-slide-up shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center py-2">
          <div className="w-9 h-1 rounded-full bg-stone-300" />
        </div>
        <div className="px-6 pb-10">
          <div className="text-center py-5 border-b border-stone-200">
            <p className="font-serif text-base text-ink leading-relaxed tracking-wide">"{result.quote.text}"</p>
            <p className="text-xs text-stone-400 mt-2 font-mono">— {result.quote.source}</p>
          </div>

          <div className="py-5 border-b border-stone-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-stone-500">今日吉门</span>
              <span className="font-serif text-[28px] text-gold tracking-wider font-medium">{result.gate}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-stone-500">方位</span>
              <b className="font-serif text-base text-ink">{result.direction}</b>
            </div>
            <div className="bg-gold/10 rounded-xl px-4 py-3 mt-3 text-center">
              <p className="font-serif text-sm text-ink-deep leading-relaxed">{result.gate_explain}</p>
            </div>
          </div>

          <div className="py-5 border-b border-stone-200">
            <div className="flex gap-6 mb-3">
              <span className="font-serif text-lg text-jade">宜</span>
              <span className="font-serif text-lg text-stone-400">忌</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {result.suit.map((w) => (
                <span key={w} className="px-3 py-1 bg-jade/10 text-jade text-sm rounded-full border border-jade/30">
                  {w}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {result.avoid.map((w) => (
                <span key={w} className="px-3 py-1 bg-stone-100 text-stone-400 text-sm rounded-full line-through">
                  {w}
                </span>
              ))}
            </div>
          </div>

          {result.recommend && (
            <div className="py-5">
              <p className="text-sm text-stone-400 mb-3 tracking-wider">今日推荐</p>
              <div className="flex gap-3 p-3 bg-paper-warm rounded-xl">
                {result.recommend.image_url ? (
                  <img src={result.recommend.image_url} className="w-16 h-16 rounded-lg object-cover" alt="" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-bronze to-stone-700 flex items-center justify-center text-paper font-serif text-lg">
                    {result.recommend.name.slice(0, 1)}
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-center">
                  <div className="font-serif text-sm text-ink-deep font-medium">{result.recommend.name}</div>
                  {result.recommend.sub_title && (
                    <div className="text-[11px] text-stone-500 mt-0.5">{result.recommend.sub_title}</div>
                  )}
                  <div className="font-mono text-sm text-ink mt-1">{result.recommend.price_display}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
