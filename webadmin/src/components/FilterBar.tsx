import { Search, RotateCcw } from 'lucide-react';

interface FieldText { kind: 'text'; key: string; label: string; placeholder?: string; width?: number; }
interface FieldSelect { kind: 'select'; key: string; label: string; options: { v: string; label: string }[]; width?: number; }
interface FieldDate { kind: 'date'; key: string; label: string; }
interface FieldNumber { kind: 'number'; key: string; label: string; placeholder?: string; width?: number; }
interface FieldBool { kind: 'bool'; key: string; label: string; }

export type FilterField = FieldText | FieldSelect | FieldDate | FieldNumber | FieldBool;

interface Props {
  fields: FilterField[];
  values: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  onSearch?: () => void;
  onReset?: () => void;
  right?: React.ReactNode;
}

export default function FilterBar({ fields, values, onChange, onSearch, onReset, right }: Props) {
  const setOne = (k: string, v: any) => onChange({ ...values, [k]: v });
  return (
    <div className="flex items-end gap-2 flex-wrap mb-3 px-4 py-2 panel">
      {fields.map((f) => {
        if (f.kind === 'text') {
          return (
            <div key={f.key} className="flex flex-col gap-0.5">
              <label className="uplabel text-ink-5">{f.label}</label>
              <input
                className="input"
                style={{ width: f.width ?? 180 }}
                placeholder={f.placeholder}
                value={values[f.key] ?? ''}
                onChange={(e) => setOne(f.key, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSearch?.(); }}
              />
            </div>
          );
        }
        if (f.kind === 'select') {
          return (
            <div key={f.key} className="flex flex-col gap-0.5">
              <label className="uplabel text-ink-5">{f.label}</label>
              <select
                className="select"
                style={{ width: f.width ?? 130 }}
                value={values[f.key] ?? ''}
                onChange={(e) => setOne(f.key, e.target.value || undefined)}
              >
                <option value="">— 全部 —</option>
                {f.options.map((o) => (<option key={o.v} value={o.v}>{o.label}</option>))}
              </select>
            </div>
          );
        }
        if (f.kind === 'date') {
          return (
            <div key={f.key} className="flex flex-col gap-0.5">
              <label className="uplabel text-ink-5">{f.label}</label>
              <input type="datetime-local" className="input"
                value={values[f.key] ?? ''}
                onChange={(e) => setOne(f.key, e.target.value || undefined)}
              />
            </div>
          );
        }
        if (f.kind === 'number') {
          return (
            <div key={f.key} className="flex flex-col gap-0.5">
              <label className="uplabel text-ink-5">{f.label}</label>
              <input
                type="number" className="input"
                style={{ width: f.width ?? 110 }}
                placeholder={f.placeholder}
                value={values[f.key] ?? ''}
                onChange={(e) => setOne(f.key, e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          );
        }
        // bool
        return (
          <label key={f.key} className="flex items-center gap-1.5 px-2 py-1.5 border border-border rounded cursor-pointer">
            <input type="checkbox" checked={!!values[f.key]} onChange={(e) => setOne(f.key, e.target.checked)} />
            <span className="text-[12px]">{f.label}</span>
          </label>
        );
      })}
      <div className="flex gap-1.5 ml-auto items-center">
        {right}
        <button className="btn btn-prim" onClick={onSearch}>
          <Search size={13} /> 查询
        </button>
        {onReset && (
          <button className="btn btn-soft" onClick={onReset}>
            <RotateCcw size={13} /> 重置
          </button>
        )}
      </div>
    </div>
  );
}
