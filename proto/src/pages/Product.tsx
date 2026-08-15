import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import TabNav from '../components/TabNav';

interface Item {
  id: string; name: string; sub_title: string | null;
  category: string; price_display: string;
  image_url: string | null; stock_status: string;
}

const CATS = [['incense', '线香'], ['sachet', '香包'], ['bracelet', '手串'], ['other', '其他']] as const;

export default function Product() {
  const [cat, setCat] = useState<typeof CATS[number][0]>('incense');
  const { data } = useQuery({
    queryKey: ['product', cat],
    queryFn: () => api.get<{ items: Item[] }>(`/product?category=${cat}&region=cn&platform=web`),
  });

  return (
    <div className="min-h-screen bg-paper paper-tex pb-24 px-5 pt-8">
      <div className="mb-4">
        <div className="font-mono text-[10px] tracking-[0.18em] text-stone-400 uppercase">物 · product</div>
        <h1 className="font-serif text-2xl font-medium text-ink-deep mt-1">不完人 · 物</h1>
      </div>
      <div className="flex gap-4 border-b border-stone-200 pb-3 mb-4">
        {CATS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setCat(k)}
            className={`text-sm relative pb-2 ${cat === k ? 'text-ink-deep font-medium' : 'text-stone-500'}`}
          >
            {l}
            {cat === k && <span className="absolute -bottom-3 left-0 right-0 h-0.5 bg-gold" />}
          </button>
        ))}
      </div>

      {!data && <div className="text-stone-400 text-sm mt-8 text-center">加载中…</div>}
      <div className="grid grid-cols-2 gap-3">
        {data?.items.map((p) => (
          <div key={p.id} className="bg-paper-warm border border-stone-200 rounded-xl overflow-hidden">
            {p.image_url ? (
              <img src={p.image_url} className="w-full h-32 object-cover" alt={p.name} />
            ) : (
              <div className="w-full h-32 bg-gradient-to-br from-bronze/40 to-gold/30 flex items-center justify-center text-paper font-serif text-3xl">
                {p.name.slice(0, 1)}
              </div>
            )}
            <div className="p-3">
              <div className="font-serif text-sm font-medium text-ink-deep leading-snug">{p.name}</div>
              <div className="text-[10.5px] text-stone-500 mt-1">{p.sub_title}</div>
              <div className="font-mono text-xs text-ink mt-2 font-medium">{p.price_display}</div>
            </div>
          </div>
        ))}
      </div>

      <TabNav />
    </div>
  );
}
