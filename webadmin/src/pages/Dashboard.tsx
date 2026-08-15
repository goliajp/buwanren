import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { yuan, thou } from '../components/util';
import {
  TrendingUp, ShoppingCart, Clock, AlertTriangle, Undo2,
  Truck, Repeat, BadgePercent, ShieldAlert, Package,
} from 'lucide-react';

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

export default function Dashboard() {
  const nav = useNavigate();
  const q = useQuery<Kpi>({ queryKey: ['commerce','dashboard'], queryFn: () => commerce.dashboard(), refetchInterval: 30_000 });
  const k = q.data;
  return (
    <div>
      <PageHeader
        title="总览 · Commerce KPI"
        sub="实时 / 30s 自动刷新"
        stats={k ? [
          { label: '今日营收', value: yuan(k.today_revenue_minor) },
          { label: '今日订单', value: thou(k.today_orders) },
          { label: '在售商品', value: thou(k.listed_products) },
        ] : undefined}
      />
      <div className="p-4 space-y-4">
        <section>
          <div className="uplabel text-ink-5 mb-1.5 px-1">核心指标</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="今日营收" sub="支付成功累计" value={yuan(k?.today_revenue_minor)}
                     tone="ok" icon={TrendingUp} onClick={() => nav('/payments?status=success')} />
            <KpiCard label="今日订单" sub="全部订单" value={thou(k?.today_orders)}
                     icon={ShoppingCart} onClick={() => nav('/orders')} />
            <KpiCard label="待支付" sub="unpaid + pending payment" value={thou((k?.unpaid_orders ?? 0) + (k?.pending_payments ?? 0))}
                     tone="warn" icon={Clock} onClick={() => nav('/orders?status=unpaid')} />
            <KpiCard label="待审退款" sub="requested / approved / processing" value={thou(k?.pending_refunds)}
                     tone={k?.pending_refunds ? 'warn' : 'default'} icon={Undo2} onClick={() => nav('/refunds')} />
            <KpiCard label="物流异常" sub="exception / returning" value={thou(k?.exception_shipments)}
                     tone={k?.exception_shipments ? 'bad' : 'default'} icon={AlertTriangle}
                     onClick={() => nav('/shipments?exception_only=true')} />
          </div>
        </section>

        <section>
          <div className="uplabel text-ink-5 mb-1.5 px-1">商业基线</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="在售商品" value={thou(k?.listed_products)} icon={Package} onClick={() => nav('/products')} />
            <KpiCard label="活跃订阅" sub="active + trialing" value={thou(k?.active_subscriptions)} icon={Repeat} onClick={() => nav('/subscriptions?status=active')} />
            <KpiCard label="活跃促销" value={thou(k?.active_promotions)} icon={BadgePercent} onClick={() => nav('/promotions?status=active')} />
            <KpiCard label="物流在途" sub="picked_up + in_transit + out_for_delivery" value="—" icon={Truck} onClick={() => nav('/shipments')} />
            <KpiCard label="风控案件" sub="open + investigating" value={thou(k?.open_risk_cases)} tone={k?.open_risk_cases ? 'warn' : 'default'} icon={ShieldAlert} onClick={() => nav('/risk')} />
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="panel">
            <div className="panel-head"><div className="panel-title">本会话已落地</div></div>
            <div className="p-4 text-[12.5px] text-ink-2 space-y-1.5">
              <div>✓ schema v2 · 47 张表 + 索引 + 触发器 + seed 全量(已 apply)</div>
              <div>✓ unmei-domain commerce 模块 · 16 文件 ~2200 行 · 状态机 + 事件 + service trait + adapter trait</div>
              <div>✓ admin-api · `/admin/commerce/*` 36 个端点(本页所有数据来源)</div>
              <div>✓ webadmin · 10 工作台(本页是总览)</div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><div className="panel-title">下一轮</div></div>
            <div className="p-4 text-[12.5px] text-ink-2 space-y-1.5">
              <div>· Service trait 落地(把 routes 里的 sqlx 抽到 service struct)</div>
              <div>· PaymentAdapter 微信 v3 完整 impl + verify_webhook</div>
              <div>· CarrierAdapter 快递100 + Manual</div>
              <div>· 客户端 BFF `unmei-api` 重写(订单/支付/物流/订阅)</div>
              <div>· 后台 worker(payment_query_sweeper / shipment_trace_sweeper / billing_scheduler / outbox_dispatcher)</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

interface KCardProps { label: string; value: string | number | undefined; sub?: string; tone?: 'default'|'ok'|'warn'|'bad'; icon: any; onClick?: () => void; }
function KpiCard({ label, value, sub, tone = 'default', icon: Icon, onClick }: KCardProps) {
  const valueColor =
    tone === 'ok' ? 'text-jade' :
    tone === 'warn' ? 'text-gold-2' :
    tone === 'bad' ? 'text-vermilion' : 'text-ink';
  return (
    <button
      onClick={onClick}
      className="kpi text-left hover:bg-surface-2 transition cursor-pointer"
      type="button"
    >
      <div className="flex items-center justify-between">
        <div className="kpi-label">{label}</div>
        <Icon size={14} strokeWidth={1.75} className="text-ink-4" />
      </div>
      <div className={`kpi-value ${valueColor}`}>{value ?? '—'}</div>
      {sub && <div className="text-[10.5px] text-ink-5">{sub}</div>}
    </button>
  );
}
