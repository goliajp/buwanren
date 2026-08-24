import { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export default function Drawer({ open, onClose, title, subtitle, width = 720, children, actions }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />
      <aside
        className={`fixed top-0 right-0 bottom-0 bg-surface border-l border-border z-50 flex flex-col shadow-2xl transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width }}
      >
        <header className="px-5 py-3 border-b border-border bg-surface-2 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-[14px] font-semibold text-ink leading-tight">{title}</div>
            {subtitle && <div className="uplabel text-ink-4 mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="text-ink-4 hover:text-ink p-1 rounded hover:bg-surface-3">
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {actions && (
          <footer className="px-5 py-3 border-t border-border bg-surface-2 flex items-center justify-end gap-2 flex-shrink-0">
            {actions}
          </footer>
        )}
      </aside>
    </>
  );
}
