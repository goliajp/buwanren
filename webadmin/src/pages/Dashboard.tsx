import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { yuan, thou, rel, briefId, statusClass, statusLabel } from '../components/util';
import { ArrowRight } from 'lucide-react';

interface Kpi {
  today_revenue_minor: number;
  today_orders: number;
  pending_payments: number;
  unpaid_orders: number;
  pending_refunds: number;
  exception_shipments: number;
  active_subscriptions: number;
  active_promotions: number;
  open_risk_cases: number;
  listed_products: number;
}

/* 看板的活儿只有一件:现在有没有事，有的话是什么事。
 *
 * 上一版是十张一模一样的卡摆成两行 —— 「今日营收」跟「活跃促销」
 * 同样大、同样重，于是没有一个是重点;下面还挂着两张开发者备忘录
 * （「本会话已落地 / 下一轮」），那是写给自己看的，占的是首屏。
 *
 * 现在分四层，一层比一层轻:
 *   ① 今天进了多少钱 —— 一个数，44px，别的都不跟它抢
 *   ② 要处理的 —— 只列真有数的那几项。都没有就说都没有
 *   ③ 刚下的单 —— 「有没有事」之后，第二眼想看的是「在动吗」
 *   ④ 在跑着的 —— 一条摘要线，灰的，知道它还在就够了
 */
export default function Dashboard() {
  const nav = useNavigate();
  const q = useQuery<Kpi>({
    queryKey: ['dashboard'],
    queryFn: () => commerce.dashboard(),
    refetchInterval: 30_000,
  });
  const k = q.data;

  /* 要处理的那几项。`n` 为 0 的不进来 —— 一个「0 笔待退款」
     占着跟「424 笔待退款」一样大的位置，等于把后者藏起来。 */
  const 待办 = [
    { n: (k?.unpaid_orders ?? 0) + (k?.pending_payments ?? 0), 是: '笔订单还没付', 去: '/orders?status=unpaid', 做: '看看是卡在哪一步' },
    { n: k?.pending_refunds ?? 0, 是: '笔退款等着批', 去: '/refunds', 做: '批一批' },
    { n: k?.exception_shipments ?? 0, 是: '件包裹出了状况', 去: '/shipments?exception_only=true', 做: '查物流' },
    { n: k?.open_risk_cases ?? 0, 是: '个风控案子没结', 去: '/risk', 做: '去看' },
  ].filter((x) => x.n > 0);

  return (
    <div>
      <PageHeader
        title="今天"
        sub="每 30 秒自己刷新一次"
        stats={k ? [{ label: '订单', value: thou(k.today_orders) }] : undefined}
      />

      <div className="p-5 space-y-6 max-w-5xl">
        {/* ① 今天进了多少钱 */}
        <section>
          <div className="label">今天收到的钱</div>
          <div className="n text-2xl font-semibold tracking-tight mt-1">
            {k ? yuan(k.today_revenue_minor) : <span className="text-ink-4">—</span>}
          </div>
        </section>

        {/* ② 要处理的 */}
        <section>
          <h2 className="text-base font-semibold mb-2">要处理的</h2>
          {q.isLoading ? (
            <p className="label">正在取…</p>
          ) : q.isError ? (
            /* 【取不到就说取不到，不许说「都清完了」】
               （2026-09-03 五路评审 · 后台产品体验）。

               上一版这里只有两支：正在取 / 待办为空。而查询【失败】时
               `k` 是 undefined、`待办` 是空数组、`isLoading` 是 false ——
               于是这一屏落到「都清完了」那一支，
               **在后端连不上的时候，用肯定句告诉运营今天没有事**。

               这一屏的活儿只有一件：现在有没有事。它答错的那一次，
               恰恰是最该有人去看的那一次。 */
            <p className="text-sm text-debt">
              取不到 —— 这一屏说不了今天有没有事。先看后端还在不在，别当成「没事」。
            </p>
          ) : 待办.length === 0 ? (
            /* 【没事的时候就说没事】。空状态是这一版的主张最直白的地方:
               健康的一屏应该看起来近乎空白。 */
            <p className="text-sm text-ink-2">
              都清完了 —— 没有待付的订单、没有等着批的退款、物流也没出状况。
            </p>
          ) : (
            <ul className="border border-rule rounded divide-y divide-rule bg-card">
              {待办.map((x) => (
                <li key={x.去}>
                  <button
                    type="button"
                    onClick={() => nav(x.去)}
                    className="group w-full flex items-baseline gap-3 px-4 py-3 text-left hover:bg-sunk transition-colors"
                  >
                    <span className="n text-lg font-semibold text-debt tabular-nums w-16 shrink-0 text-right">
                      {thou(x.n)}
                    </span>
                    <span className="text-sm text-ink flex-1">{x.是}</span>
                    <span className="text-xs text-ink-3 group-hover:text-ink-2 flex items-center gap-1">
                      {x.做}
                      <ArrowRight size={12} strokeWidth={2} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ③ 刚过去这一阵 —— 「有没有事」之后，第二眼想看的是「在动吗」。
            上一版这块是两张开发者备忘录（本会话已落地 / 下一轮），
            占着首屏最好的位置说的是写给自己看的话。 */}
        <section>
          <h2 className="text-base font-semibold mb-2">刚下的单</h2>
          <RecentOrders />
        </section>

        {/* ④ 在跑着的 —— 一条摘要线。这些数不需要你做什么，
            所以它们不占卡片、不上颜色，知道它还在就够了。 */}
        <section>
          <h2 className="text-base font-semibold mb-2">在跑着的</h2>
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            {[
              { k: '在卖的商品', v: k?.listed_products, to: '/products' },
              { k: '订着的人', v: k?.active_subscriptions, to: '/subscriptions?status=active' },
              { k: '在做的促销', v: k?.active_promotions, to: '/promotions?status=active' },
            ].map((x) => (
              <button
                key={x.k}
                type="button"
                onClick={() => nav(x.to)}
                className="flex items-baseline gap-2 hover:text-ink text-ink-2 transition-colors"
              >
                <dt className="label">{x.k}</dt>
                <dd className="n text-sm font-medium tabular-nums">{thou(x.v)}</dd>
              </button>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

/* 最近十笔。不做成表 —— 表要表头、要列宽，而这里只有三样东西:
   谁、多少钱、什么状态。三样东西排一行就够了，摆成表反而更难扫。 */
function RecentOrders() {
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ['orders', { size: 10, page: 0 }],
    queryFn: () => commerce.listOrders({ size: 10, page: 0 }),
    refetchInterval: 30_000,
  });
  const items: any[] = q.data?.items ?? [];

  if (q.isLoading) return <p className="label">正在取…</p>;
  /* 同上：`items` 在失败时也是空数组，而「今天还没有单」是一句肯定句。
     两块都在这一屏上，一起说了两遍不真的话。 */
  if (q.isError) return <p className="text-sm text-debt">取不到最近的单。</p>;
  if (!items.length) return <p className="text-sm text-ink-2">今天还没有单。</p>;

  return (
    <ul className="border border-rule rounded divide-y divide-rule bg-card">
      {items.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            onClick={() => nav(`/orders?keyword=${o.id}`)}
            className="w-full flex items-center gap-4 px-4 h-9 text-left hover:bg-sunk transition-colors whitespace-nowrap"
          >
            {/* 【一行一行，不许折】。uuid 有四十个字符，`w-24` 装不下就折成
                五行，一条记录占了五行高 —— 而这一块要的是十行能一眼扫完。
                `truncate` + 定宽:短号够认，要全的去订单屏。 */}
            <span className="text-xs font-mono text-ink-3 w-20 shrink-0 truncate">
              {briefId(o.id)}
            </span>
            {/* 【定宽在外，底色在内】（2026-09-04 · 25 计划的后台逐页走）。
                这两件事挂在同一个 span 上的时候，`st-debt` 那层底色
                （全台唯一带底色的状态，见 index.css）会铺满整整 96px ——
                「没付」两个字后面拖着一大条空的红，看着不像强调，
                像哪儿渲坏了。列还是要对齐的，所以宽度留在外层，
                底色跟着词走。 */}
            <span className="text-xs w-24 shrink-0">
              <span className={statusClass(o.status)}>{statusLabel(o.status)}</span>
            </span>
            <span className="n text-sm tabular-nums text-ink flex-1 text-right">
              {yuan(o.amount_total_minor, o.currency)}
            </span>
            <span className="label w-16 text-right shrink-0">{rel(o.created_at)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
