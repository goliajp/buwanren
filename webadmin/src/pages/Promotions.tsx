import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import Drawer from '../components/Drawer';
import { rel, ts, yuan, shortId, statusChip } from '../components/util';
import { Eye, Play, Pause, X, RefreshCw } from 'lucide-react';

const STATUSES = ['draft','scheduled','active','paused','exhausted','ended'];
const KINDS = ['pct_off','amount_off','bxgy','bundle','cap_only'];

export default function Promotions() {
  const qc = useQueryClient();
  const [filt, setFilt] = useState<Record<string, any>>({ size: 50, page: 0 });
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState<'promo' | 'coupons'>('promo');

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

  const setState = useMutation({
    mutationFn: (v: { id: string; status: string }) => commerce.updatePromotionState(v.id, v.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotions'] }),
  });

  return (
    <div>
      <PageHeader title="营销 · Promotions" sub="commerce v2 · promotion + coupon + coupon_redemption" stats={[
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
                { kind: 'text', key: 'keyword', label: 'keyword', placeholder: 'code / name' },
                { kind: 'select', key: 'status', label: 'status', options: STATUSES.map(v => ({ v, label: v })) },
              ]}
              values={draft}
              onChange={setDraft}
              onSearch={() => setFilt({ ...draft, size: 50, page: 0 })}
              onReset={() => { setDraft({}); setFilt({ size: 50, page: 0 }); }}
              right={<button className="btn btn-soft" onClick={() => list.refetch()}><RefreshCw size={13}/></button>}
            />
            <div className="panel">
              <table className="wa-table">
                <thead><tr><th>id</th><th>code</th><th>名称</th><th>kind</th><th>状态</th>
                  <th className="r">预算</th><th className="r">已用</th><th>生效</th><th>失效</th>
                  <th className="c">动作</th></tr></thead>
                <tbody>
                  {(list.data?.items ?? []).map((p: any) => (
                    <tr key={p.id}>
                      <td className="mono">{shortId(p.id)}</td>
                      <td className="mono">{p.code ?? '—'}</td>
                      <td className="font-medium">{p.name}</td>
                      <td><span className="chip chip-info">{p.kind}</span></td>
                      <td><span className={statusChip(p.status)}>{p.status}</span></td>
                      <td className="r">{p.budget_minor ? yuan(p.budget_minor) : <span className="text-ink-5">无限</span>}</td>
                      <td className="r text-jade">{yuan(p.used_minor)}</td>
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
                { kind: 'text', key: 'keyword', label: 'code / owner_user_id', width: 240 },
                { kind: 'select', key: 'status', label: 'state', options: ['issued','locked','redeemed','expired','revoked'].map(v => ({ v, label: v })) },
              ]}
              values={draft}
              onChange={setDraft}
              onSearch={() => setFilt({ ...draft, size: 50, page: 0 })}
              onReset={() => { setDraft({}); setFilt({ size: 50, page: 0 }); }}
            />
            <div className="panel">
              <table className="wa-table">
                <thead><tr><th>id</th><th>code</th><th>promotion</th><th>owner</th><th>state</th><th>领取</th><th>核销</th><th>过期</th></tr></thead>
                <tbody>
                  {(coupons.data?.items ?? []).map((c: any) => (
                    <tr key={c.id}>
                      <td className="mono">{shortId(c.id)}</td>
                      <td className="mono">{c.code ?? '—'}</td>
                      <td className="text-ink-3">{c.promotion_name ?? shortId(c.promotion_id)}</td>
                      <td className="mono text-ink-3">{c.owner_user_id ? shortId(c.owner_user_id) : <span className="text-ink-5">待领</span>}</td>
                      <td><span className={statusChip(c.state)}>{c.state}</span></td>
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
        subtitle={detail.data?.promotion ? `${detail.data.promotion.kind} · ${detail.data.promotion.status}` : '加载中'}
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
          ['code', <span className="mono">{promotion.code ?? '—'}</span>],
          ['名称', <strong>{promotion.name}</strong>],
          ['kind', promotion.kind],
          ['状态', <span className={statusChip(promotion.status)}>{promotion.status}</span>],
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
        <h3 className="font-semibold mb-2">benefit_json</h3>
        <pre className="bg-surface-2 p-3 rounded text-[11px] overflow-x-auto mono">{JSON.stringify(promotion.benefit_json, null, 2)}</pre>
      </section>
      <section>
        <h3 className="font-semibold mb-2">rule_json</h3>
        <pre className="bg-surface-2 p-3 rounded text-[11px] overflow-x-auto mono">{JSON.stringify(promotion.rule_json, null, 2)}</pre>
      </section>
      <section>
        <h3 className="font-semibold mb-2">match_json</h3>
        <pre className="bg-surface-2 p-3 rounded text-[11px] overflow-x-auto mono">{JSON.stringify(promotion.match_json, null, 2)}</pre>
      </section>
    </div>
  );
}

function KvGrid({ kv }: { kv: [string, React.ReactNode][] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
      {kv.map(([k, v], i) => (
        <div key={i} className="flex items-center justify-between border-b border-border/50 py-1">
          <span className="uplabel text-ink-5">{k}</span>
          <span className="text-ink-2 text-right">{v}</span>
        </div>
      ))}
    </div>
  );
}
