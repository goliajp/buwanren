import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import TableError from '../components/TableError';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import Drawer from '../components/Drawer';
import { rel, ts, yuan, shortId, statusClass, statusLabel, enumLabel } from '../components/util';
import { Eye, Tag, Boxes, RefreshCw, Power } from 'lucide-react';

const STATUSES = ['draft','listed','delisted','discontinued'];
const KINDS = ['one_shot','subscription','digital_goods','service'];

export default function Products() {
  const qc = useQueryClient();
  /* 【货架上先摆在卖的】（2026-09-04 · 25 计划的后台逐页走）。
     上一版默认列全部、按更新倒序 —— 库里 13,686 条草稿、202 条下架、
     【12 条在卖】，于是第一屏五十行全是草稿，运营打开这一页
     一个在卖的商品都看不见。看板上写着「在卖的商品 12」,
     点进来却找不到它们。

     跟退款页、对账页同一条:默认落在要做的事上。要看草稿、看下架的，
     把上面那个状态改一下就是了。 */
  const [filt, setFilt] = useState<Record<string, any>>({ status: 'listed', size: 50, page: 0 });
  const [draft, setDraft] = useState<Record<string, any>>({ status: 'listed' });
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
      <PageHeader title="商品" sub="在卖的东西。一个商品下面可以有好几种规格" stats={[
        { label: '当前页', value: list.data?.items.length ?? 0 },
        { label: '总数', value: list.data?.total ?? 0 },
      ]} />
      <div className="p-4">
        <FilterBar
          fields={[
            { kind: 'text', key: 'keyword', label: '找', placeholder: '名称或代号', width: 220 },
            /* 【下拉里也说中文】（2026-09-04 · 25 计划的后台逐页走）。
               这一行原本 `label: v` —— 直接把 `draft` / `listed` 摆上屏,
               而紧挨着的下一行「怎么卖」用的是 `enumLabel(v)`。
               同一个筛选条，一行翻了一行没翻;而表里那一列
               自己写的是「在架」，跟下拉里的 `listed` 对不上。 */
            { kind: 'select', key: 'status', label: '状态', options: STATUSES.map(v => ({ v, label: statusLabel(v) })) },
            { kind: 'select', key: 'kind', label: '怎么卖', options: KINDS.map(v => ({ v, label: enumLabel(v) })) },
          ]}
          values={draft}
          onChange={setDraft}
          onSearch={() => setFilt({ ...draft, size: 50, page: 0 })}
          onReset={() => { setDraft({ status: 'listed' }); setFilt({ status: 'listed', size: 50, page: 0 }); }}
          right={<button className="btn btn-soft" onClick={() => list.refetch()}><RefreshCw size={13}/> 刷新</button>}
        />
        <div className="panel">
          <table className="tbl">
            <thead><tr>
              <th>编号</th><th>代号</th><th>名称</th><th>卖的是什么</th><th>怎么卖</th><th>怎么交付</th><th>状态</th>
              <th>标签</th><th>更新</th><th className="c">动作</th>
            </tr></thead>
            <tbody>
              <TableError 出错={list.isError} 列数={8} />
              {(list.data?.items ?? []).map((p: any) => (
                <tr key={p.id}>
                  <td className="font-mono text-ink-3">{shortId(p.id)}</td>
                  <td className="id">{p.code}</td>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-ink-4">{enumLabel(p.category)}</td>
                  <td><span className="text-ink-2">{enumLabel(p.kind)}</span></td>
                  <td className="text-ink-4">{enumLabel(p.fulfillment_kind)}</td>
                  <td><span className={statusClass(p.status)}>{statusLabel(p.status)}</span></td>
                  <td className="text-xs">{(p.tags ?? []).map((t: string) => <span key={t} className="text-ink-3 mr-1">{t}</span>)}</td>
                  <td title={ts(p.updated_at)}>{rel(p.updated_at)}</td>
                  <td className="c flex justify-center gap-1">
                    <button className="btn btn-ghost" onClick={() => setDetailId(p.id)}><Eye size={13}/></button>
                    <button
                      className={`btn ${p.status === 'listed' ? 'btn-debt' : 'btn-soft'}`}
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
          ['代号', <span className="id">{product.code}</span>],
          ['名称', <strong>{product.name}</strong>],
          ['副标题', product.sub_title ?? '—'],
          ['卖的是什么', enumLabel(product.category)],
          ['类型', product.kind],
          ['履约', product.fulfillment_kind],
          ['状态', <span className={statusClass(product.status)}>{statusLabel(product.status)}</span>],
          ['权重', product.sort_weight],
          ['语言', (product.available_locales ?? []).join(', ')],
          ['区域', (product.available_regions ?? []).join(', ')],
          ['平台', (product.available_platforms ?? []).join(', ')],
          ['标签', (product.tags ?? []).join(', ') || '—'],
          ['创建', ts(product.created_at)],
          ['更新', ts(product.updated_at)],
        ]} />
        {product.description_md && (
          <div className="mt-3 px-3 py-2 bg-sunk rounded text-[12px] whitespace-pre-wrap">{product.description_md}</div>
        )}
      </section>

      <section>
        <h3 className="font-semibold mb-2 flex items-center gap-1.5"><Boxes size={13}/> SKU ({skus.length})</h3>
        <table className="tbl">
          <thead><tr><th>编号</th><th>代号</th><th>名称</th><th>库存</th><th className="r">当前价</th><th>状态</th></tr></thead>
          <tbody>{skus.map((s: any) => (
            <tr key={s.id}>
              <td className="id">{shortId(s.id)}</td>
              <td className="id">{s.code}</td>
              <td>{s.name}</td>
              <td className="text-ink-4">
                {s.stock_kind === 'limited'
                  ? <>剩 <span className="font-mono font-semibold">{s.stock_count}</span></>
                  : s.stock_kind === 'per_user_cap'
                  ? <>每用户 <span className="id">{s.per_user_cap}</span></>
                  : <span className="text-ink-4">无限</span>}
              </td>
              <td className="r font-semibold">{s.current_price_minor ? yuan(s.current_price_minor, s.current_currency || 'CNY') : '—'}</td>
              <td><span className={statusClass(s.status)}>{statusLabel(s.status)}</span></td>
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
        <div key={i} className="flex items-center justify-between border-b border-rule/50 py-1">
          <span className="label text-ink-4">{k}</span>
          <span className="text-ink-2 text-right truncate max-w-[60%]">{v}</span>
        </div>
      ))}
    </div>
  );
}
