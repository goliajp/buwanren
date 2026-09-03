import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import TableError from '../components/TableError';
import { rel, ts, yuan, shortId, statusClass, statusLabel, thou } from '../components/util';
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
  const [找, 设找] = useState('');
  const 命中 = 找.trim()
    ? skus.filter((s: any) =>
        `${s.name} ${s.product_name} ${s.code}`.toLowerCase().includes(找.trim().toLowerCase()))
    : skus;

  return (
    <div>
      <PageHeader
        title="定价"
        sub="同一件东西在哪个区、哪个平台、什么时候卖多少钱"
        stats={[{ label: '规格', value: thou(skus.length) }]}
      />
      <div className="p-4 grid grid-cols-12 gap-4">
        <div className="col-span-4 panel">
          {/* 【两百个规格得能搜】。上一版只有一列可以滚的清单，
              而标题旁边写着「选一个 →」—— 一句提示替代不了一个搜索框。 */}
          <div className="panel-head">
            <input
              className="input w-full"
              placeholder="按名字或编号找规格"
              value={找}
              onChange={(e) => 设找(e.target.value)}
            />
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {命中.map((s: any) => (
              <button key={s.id}
                onClick={() => setSkuId(s.id)}
                className={`block w-full text-left px-3 py-2 border-b border-rule/50 hover:bg-sunk transition ${skuId === s.id ? 'bg-sunk' : ''}`}>
                <div className="text-xs font-medium text-ink truncate">{s.name}</div>
                <div className="label text-ink-4">{s.product_name} · {s.code}</div>
              </button>
            ))}
            {skus.length === 0 && <div className="text-center py-10 text-ink-4">正在取…</div>}
            {skus.length > 0 && 命中.length === 0 && (
              <div className="px-3 py-6 text-sm text-ink-2">没有名字或编号含「{找}」的规格。</div>
            )}
          </div>
        </div>

        <div className="col-span-8 panel">
          <div className="panel-head">
            <div>
              <div className="panel-title flex items-center gap-1.5"><Tag size={13}/> {currentSku?.name ?? '定价时间线'}</div>
              {currentSku && <div className="label text-ink-4 mt-0.5">{currentSku.id}</div>}
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
          {!skuId && <div className="p-10 text-center text-ink-4">在左边选一个规格，这里显示它的历次定价。</div>}
          {skuId && (
            <table className="tbl">
              <thead><tr><th>编号</th><th>货币</th><th className="r">价格</th><th>区域</th><th>平台</th><th>档位</th><th>状态</th><th>生效</th><th>失效</th><th>备注</th><th className="c">动作</th></tr></thead>
              <tbody>
                <TableError 出错={prices.isError} 列数={11} />
                {(prices.data ?? []).map((p: any) => (
                  <tr key={p.id}>
                    <td className="id">{shortId(p.id)}</td>
                    <td className="id">{p.currency}</td>
                    <td className="r font-semibold">{yuan(p.price_minor, p.currency)}</td>
                    <td>{p.region}</td>
                    <td>{p.platform}</td>
                    <td className="text-ink-4">{p.tier_kind}</td>
                    <td><span className={statusClass(p.status)}>{statusLabel(p.status)}</span></td>
                    <td title={ts(p.effective_from)}>{rel(p.effective_from)}</td>
                    <td title={ts(p.effective_to)}>{p.effective_to ? rel(p.effective_to) : '—'}</td>
                    <td className="text-xs text-ink-4">{p.audit_note}</td>
                    <td className="c">
                      {p.status === 'active' && (
                        <button className="btn btn-debt" onClick={() => { if (confirm('立即 expire 此价？')) expire.mutate(p.id); }}>
                          <XCircle size={13}/>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {prices.data && prices.data.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-10 text-ink-4">这个规格还没定过价。点右上角「发新价」开始</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
