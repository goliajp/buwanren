import { useNavigate } from 'react-router-dom';

export default function Open() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-paper paper-tex flex flex-col items-center justify-between px-6 py-16">
      <div />
      <div className="text-center">
        <div className="relative inline-block">
          <span className="font-serif text-[140px] leading-none text-ink-deep tracking-tight">命</span>
          <span className="absolute bottom-4 -right-2 w-2 h-2 rounded-full bg-gold" />
        </div>
        <div className="font-mono text-[22px] tracking-[0.36em] text-ink-light lowercase italic mt-6" style={{ fontFamily: 'EB Garamond, serif' }}>
          unmei
        </div>
        <div className="font-mono text-[10px] tracking-[0.5em] text-stone-400 mt-2">うんめい · 運命</div>
        <div className="font-serif text-sm text-ink-light mt-10 leading-loose tracking-wider">
          知止而后有定<br />
          定而后能静
        </div>
      </div>
      <div className="w-full flex flex-col items-center gap-3">
        <button
          onClick={() => nav('/naji')}
          className="w-full bg-ink-deep text-paper py-3.5 rounded-full font-medium tracking-widest text-sm"
        >
          进  入
        </button>
        <div className="font-mono text-[10px] tracking-[0.16em] text-stone-400 mt-2">EST. 2026 · LAB32 / MINGLI</div>
      </div>
    </div>
  );
}
