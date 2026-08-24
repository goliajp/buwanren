import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import Drawer from '../components/Drawer';
import { rel, ts, yuan, shortId, statusChip } from '../components/util';
import { Eye, Tag, Boxes, RefreshCw, Power } from 'lucide-react';

const STATUSES = ['draft','listed','delisted','discontinued'];
const KINDS = ['one_shot','subscription','digital_goods','service'];

export default function Products() {
  const qc = useQueryClient();
  const [filt, setFilt] = useState<Record<string, any>>({ size: 50, page: 0 });
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['products', filt],
    queryFn: () => commerce.listProducts(filt),
    placeholderData: (p) => p,
  });
  const detail = useQuery({
    queryKey: ['product', detailId],
    queryFn: () => commerce.getProduct(detailId!),
    enabled: !!detailId,
  });
  const toggle = useApiMutation({
    mutationFn: (v: { id: string; status: string }) => commerce.toggleProductListing(v.id, v.status),
    onSuccess: () => { qc.invalidateQueries({queryKey:['products']}); qc.invalidateQueries({queryKey:['product']}); },
  });

  return (
    <div>
      <PageHeader title="商品 · Catalog" sub="commerce v2 · product + sku（SPU/SKU 分层 · 默认价取自 price_book）" stats={[
        { label: '当前页', value: list.data?.items.length ?? 0 },
        { label: '总数', value: list.data?.total ?? 0 },
      ]} />
      <div className="p-4">
        <FilterBar
          fields={[
            { kind: 'text', key: 'keyword', label: 'keyword', placeholder: 'name / code', width: 220 },
            { kind: 'select', key: 'status', label: 'status', options: STATUSES.map(v => ({ v, label: v })) },
            { kind: 'select', key: 'kind', label: 'kind', options: KINDS.map(v => ({ v, label: v })) },
          ]}
          values={draft}
          onChange={setDraft}
          onSearch={() => setFilt({ ...draft, size: 50, page: 0 })}
          onReset={() => { setDraft({}); setFilt({ size: 50, page: 0 }); }}
          right={<button className="btn btn-soft" onClick={() => list.refetch()}><RefreshCw size={13}/> 刷新</button>}
        />
        <div className="panel">
          <table className="wa-table">
            <thead><tr>
              <th>id</th><th>code</th><th>名称</th><th>类别</th><th>kind</th><th>履约</th><th>状态</th>
              <th>tags</th><th>更新</th><th className="c">动作</th>
            </tr></thead>
            <tbody>
              {(list.data?.items ?? []).map((p: any) => (
                <tr key={p.id}>
                  <td className="mono text-ink-3">{shortId(p.id)}</td>
                  <td className="mono">{p.code}</td>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-ink-4">{p.category}</td>
                  <td><span className="chip chip-info">{p.kind}</span></td>
                  <td className="text-ink-4">{p.fulfillment_kind}</td>
                  <td><span className={statusChip(p.status)}>{p.status}</span></td>
                  <td className="text-[11px]">{(p.tags ?? []).map((t: string) => <span key={t} className="chip chip-mute mr-1">{t}</span>)}</td>
                  <td title={ts(p.updated_at)}>{rel(p.updated_at)}</td>
                  <td className="c flex justify-center gap-1">
                    <button className="btn btn-link" onClick={() => setDetailId(p.id)}><Eye size={13}/></button>
                    <button
                      className={`btn ${p.status === 'listed' ? 'btn-warn' : 'btn-soft'}`}
                      onClick={() => toggle.mutate({ id: p.id, status: p.status === 'listed' ? 'delisted' : 'listed' })}
                      title={p.status === 'listed' ? '下架' : '上架'}
                    ><Power size={13}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.data && (
            <Pagination page={filt.page ?? 0} size={filt.size ?? 50} total={list.data.total} onPage={(p) => setFilt({ ...filt, page: p })} />
          )}
        </div>
      </div>

      <Drawer
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detail.data?.product?.name ?? '商品详情'}
        subtitle={detail.data?.product ? `${detail.data.product.kind} · ${detail.data.product.status}` : '加载中'}
        width={780}
      >
        {detail.data && <ProductBody data={detail.data} />}
      </Drawer>
    </div>
  );
}

function ProductBody({ data }: { data: any }) {
  const { product, skus } = data;
  return (
    <div className="space-y-5 text-[12.5px]">
      <section>
        <h3 className="font-semibold mb-2 flex items-center gap-1.5"><Tag size={13}/> 基本</h3>
        <KvGrid kv={[
          ['code', <span className="mono">{product.code}</span>],
          ['名称', <strong>{product.name}</strong>],
          ['副标题', product.sub_title ?? '—'],
          ['类别', product.category],
          ['类型', product.kind],
          ['履约', product.fulfillment_kind],
          ['状态', <span className={statusChip(product.status)}>{product.status}</span>],
          ['权重', product.sort_weight],
          ['locale', (product.available_locales ?? []).join(', ')],
          ['region', (product.available_regions ?? []).join(', ')],
          ['platform', (product.available_platforms ?? []).join(', ')],
          ['tags', (product.tags ?? []).join(', ') || '—'],
          ['创建', ts(product.created_at)],
          ['更新', ts(product.updated_at)],
        ]} />
        {product.description_md && (
          <div className="mt-3 px-3 py-2 bg-surface-2 rounded text-[12px] whitespace-pre-wrap">{product.description_md}</div>
        )}
      </section>

      <section>
        <h3 className="font-semibold mb-2 flex items-center gap-1.5"><Boxes size={13}/> SKU ({skus.length})</h3>
        <table className="wa-table">
          <thead><tr><th>id</th><th>code</th><th>名称</th><th>库存</th><th className="r">当前价</th><th>状态</th></tr></thead>
          <tbody>{skus.map((s: any) => (
            <tr key={s.id}>
              <td className="mono">{shortId(s.id)}</td>
              <td className="mono">{s.code}</td>
              <td>{s.name}</td>
              <td className="text-ink-4">
                {s.stock_kind === 'limited'
                  ? <>剩 <span className="mono font-semibold">{s.stock_count}</span></>
                  : s.stock_kind === 'per_user_cap'
                  ? <>每用户 <span className="mono">{s.per_user_cap}</span></>
                  : <span className="text-ink-5">无限</span>}
              </td>
              <td className="r font-semibold">{s.current_price_minor ? yuan(s.current_price_minor, s.current_currency || 'CNY') : '—'}</td>
              <td><span className={statusChip(s.status)}>{s.status}</span></td>
            </tr>
          ))}</tbody>
        </table>
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
          <span className="text-ink-2 text-right truncate max-w-[60%]">{v}</span>
        </div>
      ))}
    </div>
  );
}
