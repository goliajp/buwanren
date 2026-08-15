import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function BirthForm() {
  const nav = useNavigate();
  const [year, setYear] = useState(1987);
  const [month, setMonth] = useState(9);
  const [day, setDay] = useState(17);
  const [hour, setHour] = useState(15);
  const [minute, setMinute] = useState(0);
  const [gender, setGender] = useState('male');
  const [city, setCity] = useState('长沙');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await api.post('/user/natals', {
        year, month, day, hour, minute, tz: 8.0, gender,
        birth_city: city, birth_lat: 28.23, birth_lon: 112.94,
        subject_type: 'person',
      });
      nav('/naji');
    } catch (e: any) {
      alert(e.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper px-5 py-8 flex flex-col">
      <button onClick={() => nav(-1)} className="font-mono text-xs text-stone-500 mb-6">← 返回</button>
      <div className="mb-6">
        <div className="font-mono text-[10px] tracking-[0.18em] text-stone-400 uppercase mb-1">step 01 / 01</div>
        <h1 className="font-serif text-2xl font-medium text-ink-deep">你的生辰</h1>
        <p className="text-sm text-stone-500 mt-1 leading-relaxed">推算本命八字 · 后续可随时编辑</p>
      </div>

      <div className="space-y-0 mb-auto">
        <Row label="出生年月日">
          <span className="font-mono text-sm">{year}·{String(month).padStart(2, '0')}·{String(day).padStart(2, '0')}</span>
        </Row>
        <Row label="时分">
          <span className="font-mono text-sm">{String(hour).padStart(2, '0')} : {String(minute).padStart(2, '0')}</span>
        </Row>
        <Row label="性别">
          <Seg value={gender} onChange={setGender} options={[['male', '男'], ['female', '女']]} />
        </Row>
        <Row label="出生地">
          <span className="font-mono text-sm">{city} · 112.94°E</span>
        </Row>
      </div>

      <div className="space-y-3 pt-4">
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-gold text-ink-deep py-3 rounded-full text-sm font-medium tracking-widest disabled:opacity-50"
        >
          {submitting ? '排盘中…' : '排  盘'}
        </button>
        <p className="text-[11px] text-stone-400 text-center leading-relaxed">生辰留在你的设备 · 不上传 · 可随时清除</p>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-3.5 border-b border-stone-200 first:border-t first:border-stone-200">
      <span className="text-sm text-ink-light">{label}</span>
      <div className="text-ink">{children}</div>
    </div>
  );
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="inline-flex p-0.5 bg-stone-100 border border-stone-200 rounded-full">
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1 text-xs rounded-full font-mono tracking-wider ${
            value === v ? 'bg-ink-deep text-paper' : 'text-stone-500'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
