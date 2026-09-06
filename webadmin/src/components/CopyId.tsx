import { useState } from 'react';

/* 一串 id，点一下把【整串】抄走。
 *
 * 【全台没有一个复制按钮，而 id 全是截断的】（2026-09-06 三路验证 ·
 * 运营那一路）。`grep -rn "clipboard|复制" webadmin/src` 零命中，
 * 而列表里 `briefId` 砍到八位十六进制、`shortId` 砍成 `ord-8f…3a2b`。
 * 退款页又没有抽屉，所以**在那一页上拿不到任何一个完整订单号**。
 * 每次跨页查单都得手抄或者肉眼比对，念给客户听更不可能 ——
 * 单次几十秒，一天几十次。
 *
 * 屏上仍然显示短的（那是为了让一页五十行里认得出一条），
 * 抄走的是全的。点完那一下有回执 —— 没有回执的复制跟没复制一样，
 * 人会再点两下确认，然后开始不信它。
 */
export default function CopyId(
  { id, children, className }: { id?: string | null; children: React.ReactNode; className?: string },
) {
  const [抄了, set抄了] = useState(false);
  if (!id) return <span className={className}>{children}</span>;
  return (
    <span
      className={`${className ?? ''} cursor-pointer hover:text-ink relative`}
      title={`${id}（点一下复制）`}
      onClick={(e) => {
        e.stopPropagation();       // 行本身可能可点 —— 复制不该顺带开抽屉
        /* `navigator.clipboard` 要 https 或 localhost。后台跑在 localhost 上,
           而万一取不到就退回一个隐藏的 textarea —— 那条路老，但到处都能用。
           两条都失败就什么都不说:谎报「已复制」比不报更糟。 */
        const 回执 = () => { set抄了(true); setTimeout(() => set抄了(false), 1200); };
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(id).then(回执, () => {});
          return;
        }
        try {
          const t = document.createElement('textarea');
          t.value = id;
          t.style.position = 'fixed';
          t.style.opacity = '0';
          document.body.appendChild(t);
          t.select();
          document.execCommand('copy');
          document.body.removeChild(t);
          回执();
        } catch { /* 抄不走就不说话 */ }
      }}
    >
      {children}
      {抄了 && (
        <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[12px] text-paper">
          已复制
        </span>
      )}
    </span>
  );
}
