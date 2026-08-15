import { useState } from 'react';

interface Props { spinning: boolean; onClick: () => void; }

export default function Compass({ spinning, onClick }: Props) {
  const [rot, setRot] = useState(0);
  function handle() {
    if (spinning) return;
    setRot((r) => r + 360 * 3 + Math.random() * 360);
    onClick();
  }
  return (
    <div className="relative flex flex-col items-center justify-center py-4">
      {/* 指针 */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
        <svg width="20" height="28" viewBox="0 0 20 28">
          <polygon points="10,0 0,28 20,28" fill="#c9a962" opacity="0.9" />
        </svg>
      </div>
      <div
        className="relative w-72 h-72 transition-transform duration-[3000ms] ease-out"
        style={{ transform: `rotate(${rot}deg)` }}
      >
        <svg viewBox="0 0 400 400" className="w-full h-full">
          <defs>
            <radialGradient id="rg" cx="50%" cy="50%" r="50%">
              <stop offset="80%" stopColor="rgba(201,169,98,0)" />
              <stop offset="100%" stopColor="rgba(201,169,98,0.16)" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="195" fill="url(#rg)" />
          <circle cx="200" cy="200" r="195" fill="none" stroke="#c9a962" strokeWidth="1.5" opacity="0.5" />
          <circle cx="200" cy="200" r="155" fill="none" stroke="#2c2c2c" strokeWidth="1" opacity="0.4" />
          <circle cx="200" cy="200" r="152" fill="none" stroke="#c9a962" strokeWidth="0.5" strokeDasharray="2 3" />
          <circle cx="200" cy="200" r="120" fill="none" stroke="#2c2c2c" strokeWidth="0.5" opacity="0.3" />
          <g fontFamily="Noto Serif SC, serif" fontSize="32" fill="#2c2c2c">
            <text x="200" y="60" textAnchor="middle">☲</text>
            <text x="312" y="115" textAnchor="middle">☷</text>
            <text x="350" y="210" textAnchor="middle">☱</text>
            <text x="312" y="305" textAnchor="middle">☰</text>
            <text x="200" y="355" textAnchor="middle">☵</text>
            <text x="88" y="305" textAnchor="middle">☶</text>
            <text x="50" y="210" textAnchor="middle">☳</text>
            <text x="88" y="115" textAnchor="middle">☴</text>
          </g>
          <g fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#78716c">
            <text x="200" y="80" textAnchor="middle">南</text>
            <text x="312" y="135" textAnchor="middle">西南</text>
            <text x="350" y="225" textAnchor="middle">西</text>
            <text x="312" y="325" textAnchor="middle">西北</text>
            <text x="200" y="375" textAnchor="middle">北</text>
            <text x="88" y="325" textAnchor="middle">东北</text>
            <text x="50" y="225" textAnchor="middle">东</text>
            <text x="88" y="135" textAnchor="middle">东南</text>
          </g>
        </svg>
      </div>
      <button
        onClick={handle}
        disabled={spinning}
        className="absolute w-24 h-24 rounded-full shadow-lg disabled:opacity-70 active:scale-95 transition-transform"
        style={{
          background: 'radial-gradient(circle at 50% 30%, #5a5a5a 0%, #2a2a2a 100%)',
          border: '3px solid rgba(201,169,98,0.4)',
        }}
      >
        <span className="font-serif text-white text-2xl tracking-widest">纳吉</span>
      </button>
    </div>
  );
}
