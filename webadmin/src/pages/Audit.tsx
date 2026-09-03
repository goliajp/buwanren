import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import TableError from '../components/TableError';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import { rel, ts, thou, briefId } from '../components/util';

/* 后台做过的事。
 *
 * 【`audit_log` 从建库起是空的，也没有地方看】——十八个写操作各自往
 * 业务表的 `audit_note` 里拼一句话，那能回答「这条记录被谁动过」，
 * 回答不了「今天这个人做了什么」，更回答不了「谁批的那笔退款」。
 *
 * 这一页不给筛选状态、不给日期区间:审计要的是【按时间倒着读】，
 * 加一堆条件只会让人以为漏掉了什么。要找具体某一条就搜。
 */

/** `域.动作` → 人话。收录不到的原样显示 —— 不编一个好听的名字 */
const 动作名: Record<string, string> = {
  'refund.approve': '批了退款', 'refund.deny': '拒了退款',
  'order.cancel': '取消订单', 'order.annotate': '给订单加备注',
  'payment.mark-failed': '把支付标成失败',
  'shipment.assign-tracking': '录了运单号', 'shipment.mark-exception': '标了物流异常',
  'product.listing': '上下架商品', 'pricing.publish': '发了新价', 'pricing.expire': '让价格失效',
  'promotion.state': '改了促销开关', 'coupon.create': '发了券',
  'subscription.cancel': '取消订阅', 'outbox.retry': '重试事件',
  'risk.state': '改了风控规则', 'case.state': '结了风控案子',
  'period.close': '关了账', 'record.resolve': '结了对账差异',
  'quote.update': '改了语料', 'flag.update': '改了灰度开关',
  'user.update': '改了用户',
};

function 说人话(a?: string | null): string {
  return 动作名[a ?? ''] ?? (a ?? '—');
}

/** 动的是哪一类东西。【这一列上一版显示的是 `record` / `coupon` 这种表名】——
    正是这一轮花了大半天在别处清掉的那个毛病，写这一页时自己又犯了一次 */
const 对象名: Record<string, string> = {
  order: '订单', payment: '支付', refund: '退款', shipment: '运单',
  coupon: '优惠券', promotion: '促销', product: '商品', pricing: '定价',
  subscription: '订阅', period: '会计期', record: '对账差异', case: '风控案子',
  risk: '风控规则', outbox: '事件', quote: '语料', flag: '灰度开关',
  feature_flag: '灰度开关', user: '用户', activitie: '活动',
};

function 对象说人话(t?: string | null): string {
  return 对象名[t ?? ''] ?? (t ?? '—');
}

export default function Audit() {
  const [filt, setFilt] = useState<Record<string, any>>({ size: 50, page: 0 });
  const [draft, setDraft] = useState<Record<string, any>>({});
  const list = useQuery({
    queryKey: ['audit', filt],
    queryFn: () => commerce.listAudit(filt),
    placeholderData: (p) => p,
  });

  return (
    <div>
      <PageHeader
        title="操作记录"
        sub="谁在什么时候动了什么。只记成功的写操作"
        stats={list.data ? [{ label: '一共', value: thou(list.data.total) }] : undefined}
      />
      <div className="p-4">
        <FilterBar
          fields={[{ kind: 'text', key: 'keyword', label: '找', placeholder: '动作、对象号或管理员', width: 260 }]}
          values={draft}
          onChange={setDraft}
          onSearch={() => setFilt({ ...draft, size: 50, page: 0 })}
          onReset={() => { setDraft({}); setFilt({ size: 50, page: 0 }); }}
        />
        <div className="panel">
          <table className="tbl">
            <thead><tr>
              <th>谁</th><th>做了什么</th><th>动的是</th><th>对象号</th><th>从哪儿</th><th className="r">什么时候</th>
            </tr></thead>
            <tbody>
              {(list.data?.items ?? []).map((a: any) => (
                <tr key={a.id}>
                  <td className="font-medium">{a.admin_name ?? a.admin_id}</td>
                  <td className="text-ink" title={a.action}>{说人话(a.action)}</td>
                  <td className="text-ink-3" title={a.target_type ?? ''}>{对象说人话(a.target_type)}</td>
                  <td className="id">{a.target_id ? briefId(a.target_id) : '—'}</td>
                  <td className="label">{a.ip ?? '—'}</td>
                  <td className="r text-ink-3" title={ts(a.created_at)}>{rel(a.created_at)}</td>
                </tr>
              ))}
              {/* 【取不到跟「一条都没有」不是一回事】（2026-09-03 五路评审 · 后台产品体验）。
                  上一版只有空态那一行，而它的条件是 `X.data && …length === 0` ——
                  查询失败时 `data` 是 undefined，两行都不渲染，
                  屏上剩一张只有表头的空表。带着筛选条件的页面上，
                  运营会以为是自己把条件筛空了。 */}
                <TableError 出错={list.isError} 列数={6} />
                {list.data && list.data.items.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-ink-4">
                  还没有人在后台做过写操作
                </td></tr>
              )}
            </tbody>
          </table>
          {list.data && (
            <Pagination page={filt.page ?? 0} size={filt.size ?? 50}
                        total={list.data.total} onPage={(p) => setFilt({ ...filt, page: p })} />
          )}
        </div>
      </div>
    </div>
  );
}
