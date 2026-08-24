import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { rel, ts, yuan, shortId, statusChip } from '../components/util';
import { Plus, XCircle, RefreshCw, Tag } from 'lucide-react';

const CURRENCIES = ['CNY','USD','HKD','JPY','EUR'];
const REGIONS = ['cn','hk','tw','jp','us','eu','global'];
const PLATFORMS = ['all','wx_mp','wx_h5','ios','android','web'];

export default function Pricing() {
  const qc = useQueryClient();
  const prods = useQuery({
    queryKey: ['products', { size: 200, page: 0 }],
    queryFn: () => commerce.listProducts({ size: 200, page: 0 }),
  });
  const [skuId, setSkuId] = useState<string | null>(null);

  // 选商品默认展开 SKU
  const all = prods.data?.items ?? [];
  const productDetail = useQuery({
    queryKey: ['product-skus', all.map((p: any) => p.id)],
    queryFn: async () => {
      const rs = await Promise.all(all.map((p: any) => commerce.getProduct(p.id)));
      return rs.flatMap((r: any) => r.skus.map((s: any) => ({ ...s, product_name: r.product.name })));
    },
    enabled: all.length > 0,
  });

  const prices = useQuery({
    queryKey: ['prices', skuId],
    queryFn: () => commerce.listPrices(skuId!),
    enabled: !!skuId,
  });

  const publish = useApiMutation({
    mutationFn: (b: any) => commerce.publishPrice(skuId!, b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prices', skuId] }),
  });
  const expire = useApiMutation({
    mutationFn: (id: string) => commerce.expirePrice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prices', skuId] }),
  });

  const skus = productDetail.data ?? [];
  const currentSku = skus.find((s: any) => s.id === skuId);

  return (
    <div>
      <PageHeader title="定价 · Pricing" sub="commerce v2 · price_book · 多区域 × 多平台 × 时段 × 阶梯" stats={[
        { label: '商品', value: prods.data?.total ?? 0 },
        { label: 'SKU', value: skus.length },
      ]} />
      <div className="p-4 grid grid-cols-12 gap-4">
        <div className="col-span-4 panel">
          <div className="panel-head">
            <div className="panel-title">SKU 列表</div>
            <span className="uplabel text-ink-5">选一个 →</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {skus.map((s: any) => (
              <button key={s.id}
                onClick={() => setSkuId(s.id)}
                className={`block w-full text-left px-3 py-2 border-b border-border/50 hover:bg-surface-2 transition ${skuId === s.id ? 'bg-surface-3' : ''}`}>
                <div className="text-[12.5px] font-medium text-ink truncate">{s.name}</div>
                <div className="uplabel text-ink-5">{s.product_name} · {s.code}</div>
              </button>
            ))}
            {skus.length === 0 && <div className="text-center py-10 text-ink-5">— 加载中 —</div>}
          </div>
        </div>

        <div className="col-span-8 panel">
          <div className="panel-head">
            <div>
              <div className="panel-title flex items-center gap-1.5"><Tag size={13}/> {currentSku?.name ?? '请先选 SKU'}</div>
              {currentSku && <div className="uplabel text-ink-5 mt-0.5">{currentSku.id}</div>}
            </div>
            <div className="flex items-center gap-1.5">
              <button className="btn btn-soft" onClick={() => prices.refetch()} disabled={!skuId}>
                <RefreshCw size={13}/> 刷新
              </button>
              <button className="btn btn-prim" disabled={!skuId}
                onClick={() => {
                  const cur = prompt('货币 (CNY/USD/HKD/JPY/EUR)', currentSku?.default_currency ?? 'CNY')?.toUpperCase();
                  if (!cur || !CURRENCIES.includes(cur)) return alert('无效货币');
                  const yuanIn = prompt(`价格（${cur === 'JPY' || cur === 'TWD' ? '元' : '元'}，不带符号）`);
                  if (!yuanIn) return;
                  const minor = cur === 'JPY' || cur === 'TWD' ? Number(yuanIn) : Math.round(Number(yuanIn) * 100);
                  if (!Number.isFinite(minor) || minor <= 0) return alert('无效价格');
                  const region = prompt('region (cn/hk/global/...)', 'cn') ?? 'cn';
                  const platform = prompt('platform (all/wx_mp/ios/...)', 'all') ?? 'all';
                  const note = prompt('audit_note 备注', '') ?? '';
                  publish.mutate({ currency: cur, price_minor: minor, region, platform, audit_note: note });
                }}>
                <Plus size={13}/> 发新价
              </button>
            </div>
          </div>
          {!skuId && <div className="p-10 text-center text-ink-5">从左侧选一个 SKU 查看 / 维护定价时间线</div>}
          {skuId && (
            <table className="wa-table">
              <thead><tr><th>id</th><th>货币</th><th className="r">价格</th><th>region</th><th>platform</th><th>tier</th><th>状态</th><th>生效</th><th>失效</th><th>note</th><th className="c">动作</th></tr></thead>
              <tbody>
                {(prices.data ?? []).map((p: any) => (
                  <tr key={p.id}>
                    <td className="mono">{shortId(p.id)}</td>
                    <td className="mono">{p.currency}</td>
                    <td className="r font-semibold">{yuan(p.price_minor, p.currency)}</td>
                    <td>{p.region}</td>
                    <td>{p.platform}</td>
                    <td className="text-ink-4">{p.tier_kind}</td>
                    <td><span className={statusChip(p.status)}>{p.status}</span></td>
                    <td title={ts(p.effective_from)}>{rel(p.effective_from)}</td>
                    <td title={ts(p.effective_to)}>{p.effective_to ? rel(p.effective_to) : '—'}</td>
                    <td className="text-[11px] text-ink-4">{p.audit_note}</td>
                    <td className="c">
                      {p.status === 'active' && (
                        <button className="btn btn-warn" onClick={() => { if (confirm('立即 expire 此价？')) expire.mutate(p.id); }}>
                          <XCircle size={13}/>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {prices.data && prices.data.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-10 text-ink-5">— 暂无价格，「发新价」起步 —</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
