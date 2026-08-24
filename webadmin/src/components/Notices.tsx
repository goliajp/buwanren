import { X } from 'lucide-react';
import { useNotices } from '../lib/feedback';

/**
 * 右下角的操作反馈条。挂在 Layout 上，全局一份。
 *
 * 刻意不做成会盖住内容的模态 —— 运营多半是在列表上连续点操作，
 * 提示只需要在余光里看得见，并且能被后一条覆盖。
 */
export default function Notices() {
  const { notices, dismiss } = useNotices();
  if (notices.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-[420px]">
      {notices.map((n) => (
        <div
          key={n.id}
          role="status"
          className={
            'flex items-start gap-2 rounded border px-3 py-2 text-[12px] shadow-lg ' +
            (n.tone === 'bad'
              ? 'bg-vermilion-soft border-vermilion/30 text-vermilion'
              : 'bg-jade-soft border-jade/30 text-jade')
          }
        >
          <span className="flex-1 leading-relaxed break-words">{n.text}</span>
          <button
            className="opacity-60 hover:opacity-100 shrink-0 mt-0.5"
            onClick={() => dismiss(n.id)}
            aria-label="关闭"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
