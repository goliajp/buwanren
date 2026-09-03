import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import Drawer from '../components/Drawer';
import { rel, ts, yuan, shortId, statusClass, statusLabel, enumLabel } from '../components/util';
import { Eye, Play, Pause, X, RefreshCw } from 'lucide-react';

const STATUSES = ['draft','scheduled','active','paused','exhausted','ended'];
const KINDS = ['pct_off','amount_off','bxgy','bundle','cap_only'];

export default function Promotions() {
  const qc = useQueryClient();
  const [filt, setFilt] = useState<Record<string, any>>({ size: 50, page: 0 });
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState<'promo' | 'coupons'>('promo');
  const [发券中, 设发券] = useState(false);

  const list = useQuery({
    queryKey: ['promotions', filt],
    queryFn: () => commerce.listPromotions(filt),
    placeholderData: (p) => p,
    enabled: tab === 'promo',
  });
  const coupons = useQuery({
    queryKey: ['coupons', filt],
    queryFn: () => commerce.listCoupons(filt),
    placeholderData: (p) => p,
    enabled: tab === 'coupons',
  });
  const detail = useQuery({
    queryKey: ['promotion', detailId],
    queryFn: () => commerce.getPromotion(detailId!),
    enabled: !!detailId,
  });

  const setState = useApiMutation({
    mutationFn: (v: { id: string; status: string }) => commerce.updatePromotionState(v.id, v.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotions'] }),
  });

  return (
    <div>
      <PageHeader title="促销" sub="在做的活动和发出去的券，以及谁用了" stats={[
        { label: '活动总数', value: list.data?.total ?? 0 },
      ]} />
      <div className="p-4">
        <div className="flex items-center gap-1 mb-3">
          {(['promo','coupons'] as const).map(t => (
            <button key={t}
              className={`btn ${tab === t ? 'btn-prim' : 'btn-soft'}`}
              onClick={() => { setTab(t); setFilt({ size: 50, page: 0 }); setDraft({}); }}>
              {t === 'promo' ? '促销活动' : '优惠券'}
            </button>
          ))}
        </div>

        {tab === 'promo' ? (
          <>
            <FilterBar
              fields={[
                { kind: 'text', key: 'keyword', label: '找', placeholder: 'code / name' },
                { kind: 'select', key: 'status', label: '状态', options: STATUSES.map(v => ({ v, label: v })) },
              ]}
              values={draft}
              onChange={setDraft}
              onSearch={() => setFilt({ ...draft, size: 50, page: 0 })}
              onReset={() => { setDraft({}); setFilt({ size: 50, page: 0 }); }}
              right={<button className="btn btn-soft" onClick={() => list.refetch()}><RefreshCw size={13}/></button>}
            />
            <div className="panel">
              <table className="tbl">
                <thead><tr><th>编号</th><th>代号</th><th>名称</th><th>类别</th><th>状态</th>
                  <th className="r">预算</th><th className="r">已用</th><th>生效</th><th>失效</th>
                  <th className="c">动作</th></tr></thead>
                <tbody>
                  {(list.data?.items ?? []).map((p: any) => (
                    <tr key={p.id}>
                      <td className="id">{shortId(p.id)}</td>
                      <td className="id">{p.code ?? '—'}</td>
                      <td className="font-medium">{p.name}</td>
                      <td><span className="text-ink-2">{enumLabel(p.kind)}</span></td>
                      <td><span className={statusClass(p.status)}>{statusLabel(p.status)}</span></td>
                      <td className="r">{p.budget_minor ? yuan(p.budget_minor) : <span className="text-ink-4">无限</span>}</td>
                      <td className="r text-settled">{yuan(p.used_minor)}</td>
                      <td title={ts(p.effective_from)}>{rel(p.effective_from)}</td>
                      <td title={ts(p.effective_to)}>{p.effective_to ? rel(p.effective_to) : '—'}</td>
                      <td className="c flex justify-center gap-1">
                        <button className="btn btn-link" onClick={() => setDetailId(p.id)}><Eye size={13}/></button>
                        {p.status === 'active' && <button className="btn btn-soft" title="暂停" onClick={() => setState.mutate({ id: p.id, status: 'paused' })}><Pause size={13}/></button>}
                        {p.status === 'paused' && <button className="btn btn-soft" title="恢复" onClick={() => setState.mutate({ id: p.id, status: 'active' })}><Play size={13}/></button>}
                        {['active','paused','scheduled'].includes(p.status) && <button className="btn btn-warn" title="结束" onClick={() => setState.mutate({ id: p.id, status: 'ended' })}><X size={13}/></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {list.data && <Pagination page={filt.page ?? 0} size={filt.size ?? 50} total={list.data.total} onPage={(p) => setFilt({ ...filt, page: p })} />}
            </div>
          </>
        ) : (
          <>
            <FilterBar
              fields={[
                { kind: 'text', key: 'keyword', label: '券码或用户号', width: 240 },
                { kind: 'select', key: 'status', label: '状态', options: ['issued','locked','redeemed','expired','revoked'].map(v => ({ v, label: statusLabel(v) })) },
              ]}
              values={draft}
              onChange={setDraft}
              onSearch={() => setFilt({ ...draft, size: 50, page: 0 })}
              onReset={() => { setDraft({}); setFilt({ size: 50, page: 0 }); }}
              right={<button className="btn btn-prim" onClick={() => 设发券(true)}>发一张券</button>}
            />
            {发券中 && <发券框 关闭={() => 设发券(false)} />}
            <div className="panel">
              <table className="tbl">
                <thead><tr><th>编号</th><th>代号</th><th>活动</th><th>归属</th><th>状态</th><th>领取</th><th>核销</th><th>过期</th></tr></thead>
                <tbody>
                  {(coupons.data?.items ?? []).map((c: any) => (
                    <tr key={c.id}>
                      <td className="id">{shortId(c.id)}</td>
                      <td className="id">{c.code ?? '—'}</td>
                      <td className="text-ink-3">{c.promotion_name ?? shortId(c.promotion_id)}</td>
                      <td className="font-mono text-ink-3">{c.owner_user_id ? shortId(c.owner_user_id) : <span className="text-ink-4">待领</span>}</td>
                      <td><span className={statusClass(c.state)}>{statusLabel(c.state)}</span></td>
                      <td>{rel(c.issued_at)}</td>
                      <td>{rel(c.redeemed_at)}</td>
                      <td title={ts(c.expires_at)}>{rel(c.expires_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {coupons.data && <Pagination page={filt.page ?? 0} size={filt.size ?? 50} total={coupons.data.total} onPage={(p) => setFilt({ ...filt, page: p })} />}
            </div>
          </>
        )}
      </div>

      <Drawer
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detail.data?.promotion?.name ?? '促销详情'}
        subtitle={detail.data?.promotion ? `${enumLabel(detail.data.promotion.kind)}　${statusLabel(detail.data.promotion.status)}` : '正在取…'}
        width={720}
      >
        {detail.data && <PromoBody data={detail.data} />}
      </Drawer>
    </div>
  );
}

function PromoBody({ data }: { data: any }) {
  const { promotion, redemption_count, redemption_amount_minor } = data;
  return (
    <div className="space-y-5 text-[12.5px]">
      <section>
        <h3 className="font-semibold mb-2">基本</h3>
        <KvGrid kv={[
          ['代号', <span className="id">{promotion.code ?? '—'}</span>],
          ['名称', <strong>{promotion.name}</strong>],
          ['类别', promotion.kind],
          ['状态', <span className={statusClass(promotion.status)}>{statusLabel(promotion.status)}</span>],
          ['优先级', promotion.priority],
          ['可叠加', promotion.stackable ? '是' : '否'],
          ['预算', promotion.budget_minor ? yuan(promotion.budget_minor) : '无限'],
          ['已用', yuan(promotion.used_minor)],
          ['每用户上限', promotion.per_user_cap ?? '—'],
          ['总核销上限', promotion.total_cap ?? '—'],
          ['每日上限', promotion.daily_cap ?? '—'],
          ['核销次数', <strong>{redemption_count}</strong>],
          ['核销总额', <strong>{yuan(redemption_amount_minor)}</strong>],
          ['生效', ts(promotion.effective_from)],
          ['失效', ts(promotion.effective_to)],
        ]} />
      </section>
      <section>
        <h3 className="font-semibold mb-2">给什么优惠</h3>
        <pre className="bg-sunk p-3 rounded text-xs overflow-x-auto font-mono">{JSON.stringify(promotion.benefit_json, null, 2)}</pre>
      </section>
      <section>
        <h3 className="font-semibold mb-2">什么条件下给</h3>
        <pre className="bg-sunk p-3 rounded text-xs overflow-x-auto font-mono">{JSON.stringify(promotion.rule_json, null, 2)}</pre>
      </section>
      <section>
        <h3 className="font-semibold mb-2">命中了什么</h3>
        <pre className="bg-sunk p-3 rounded text-xs overflow-x-auto font-mono">{JSON.stringify(promotion.match_json, null, 2)}</pre>
      </section>
    </div>
  );
}

function KvGrid({ kv }: { kv: [string, React.ReactNode][] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
      {kv.map(([k, v], i) => (
        <div key={i} className="flex items-center justify-between border-b border-rule/50 py-1">
          <span className="label text-ink-4">{k}</span>
          <span className="text-ink-2 text-right">{v}</span>
        </div>
      ))}
    </div>
  );
}

/* 发一张券。
 *
 * 【后端有了端点，界面上一直没有入口】——于是 `coupon` 表从建起来
 * 就是空的，而下单那一侧的核销代码从没被真数据走过。
 *
 * 只收四样东西:券码、优惠、有效期、给谁。多的字段（批次、活动）
 * 等真的要批量发的时候再说 —— 现在把它们摆上来，
 * 只会让「发一张券」这件本来一句话的事看起来像要填表。
 */
function 发券框({ 关闭 }: { 关闭: () => void }) {
  const qc = useQueryClient();
  const [码, 设码] = useState('');
  const [折, 设折] = useState('20');
  const [封顶, 设封顶] = useState('');
  const [天数, 设天数] = useState('30');
  const [归属, 设归属] = useState('');

  const 发 = useApiMutation({
    mutationFn: () => {
      const benefit: Record<string, number> = { pct_off_bps: Math.round(Number(折) * 100) };
      if (封顶.trim()) benefit.max_off_minor = Math.round(Number(封顶) * 100);
      return commerce.issueCoupon({
        code: 码.trim(),
        benefit_json: benefit,
        expires_at: new Date(Date.now() + Number(天数) * 86400_000).toISOString(),
        owner_user_id: 归属.trim() || null,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); 关闭(); },
  });

  const 能发 = 码.trim().length >= 4 && Number(折) > 0 && Number(折) <= 100 && Number(天数) > 0;

  return (
    <div className="panel p-4 mb-3 max-w-2xl">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="label">券码</span>
          <input className="input w-44" value={码} onChange={(e) => 设码(e.target.value)}
                 placeholder="至少 4 位，要唯一" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">减几成</span>
          <input className="input w-20" value={折} onChange={(e) => 设折(e.target.value)}
                 placeholder="20" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">最多减（元，可空）</span>
          <input className="input w-28" value={封顶} onChange={(e) => 设封顶(e.target.value)}
                 placeholder="不限" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">几天后过期</span>
          <input className="input w-20" value={天数} onChange={(e) => 设天数(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">给谁（用户号，可空）</span>
          <input className="input w-44" value={归属} onChange={(e) => 设归属(e.target.value)}
                 placeholder="留空＝谁都能用" />
        </label>
        <button className="btn btn-prim" disabled={!能发 || 发.isPending} onClick={() => 发.mutate()}>
          {发.isPending ? '正在发…' : '发出去'}
        </button>
        <button className="btn btn-ghost" onClick={关闭}>算了</button>
      </div>
      {/* 【把这张券实际长什么样说出来】。「减两成、最多减 100 元」
          比 `{"pct_off_bps":2000,"max_off_minor":10000}` 好核对，
          而发错一张券是真花钱的事。 */}
      <p className="label mt-3">
        发出去的是：{Number(折) > 0 ? `减 ${折} 成` : '（折扣还没填）'}
        {封顶.trim() ? `，最多减 ${封顶} 元` : '，不封顶'}
        ，{天数} 天后过期
        {归属.trim() ? '，只有这一个人能用' : '，谁拿到都能用'}
      </p>
    </div>
  );
}
