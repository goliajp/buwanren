import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import PageHeader from '../components/PageHeader';
import TableError from '../components/TableError';
import CopyId from '../components/CopyId';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import { rel, ts, yuan, shortId, thou, statusClass, statusLabel } from '../components/util';
import { Check, X, RefreshCw } from 'lucide-react';

const REFUND_STATUSES = ['requested','approved','processing','success','failed','cancelled'];

/* 一笔退款从申请到完成走了多久。同一秒完成的就说「当场」——
   写成「0 秒」既不像话，也让人以为是缺数据。 */
/** 谁提的这笔退款 */
function 谁提的(v?: string | null): string {
  return { user: '用户自己', admin: '客服代提', system: '系统自动' }[v ?? ''] ?? (v ?? '—');
}

/** 退款理由码 → 人话。收录不到的原样显示 */
function 退款原因(v?: string | null): string {
  return {
    user_request: '用户要求', duplicate: '重复下单', not_delivered: '没收到货',
    quality: '质量问题', wrong_item: '发错了', out_of_stock: '没货了',
    risk_block: '风控拦下', chargeback: '银行拒付', goodwill: '客情补偿',
    order_cancelled: '订单取消',
  }[v ?? ''] ?? (v ?? '—');
}

function 走到哪(r: any): string {
  /* 【还没批的，这一列没有可说的】（2026-09-04 · 25 计划的后台逐页走）。
     上一版这里返回「等着批」—— 跟状态列一个字不差，
     而这一页【默认就筛 requested】,于是默认视图下两列永远完全相同,
     其中一列白占着表宽。截图上四百三十行，每行都重复一次。

     这一列问的是「办完花了多久」，那件事对还没批的还没发生 ——
     用 `—`，跟下面「没有终点时间」那一支同一个说法。
     想看它有值，把状态筛成已完成。 */
  if (r.status === 'requested') return '—';
  const 终 = r.completed_at ?? r.approved_at;
  if (!终) return '—';
  const 隔 = (new Date(终).getTime() - new Date(r.created_at).getTime()) / 1000;
  if (!isFinite(隔)) return '—';
  if (隔 < 60) return '当场办完';
  if (隔 < 3600) return `${Math.round(隔 / 60)} 分钟后办完`;
  if (隔 < 86400) return `${Math.round(隔 / 3600)} 小时后办完`;
  return `${Math.round(隔 / 86400)} 天后办完`;
}

export default function Refunds() {
  const qc = useQueryClient();
  /* 【默认落在要做的事上】。这一页的活儿是「等你批」，
     而上一版默认按时间列出全部 1838 条 —— 424 条待批的埋在里面，
     第一屏一条都看不见。要看全部，把状态改成「全部」就是了。 */
  const [filt, setFilt] = useState<Record<string, any>>({ status: 'requested', size: 50, page: 0 });
  const [draft, setDraft] = useState<Record<string, any>>({ status: 'requested' });

  const list = useQuery({
    queryKey: ['refunds', filt],
    queryFn: () => commerce.listRefunds(filt),
    placeholderData: (p) => p,
  });

  /* 【左栏说 424，这一页说「待处理 0」—— 那是两个数在打架】。
     上一版的「待处理」只数当前这一页，而左栏数的是全量。
     同一件事有两个数，两个都不敢信。
     现在页头报的是【这次查询命中多少条】，跟下面的表说的是同一件事。 */
  const 本页金额 = useMemo(
    () => (list.data?.items ?? []).reduce((a: number, r: any) => a + (r.amount_minor ?? 0), 0),
    [list.data],
  );
  const 等着批 = filt.status === 'requested';

  const approve = useApiMutation({
    mutationFn: (id: string) => commerce.approveRefund(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['refunds'] }),
  });
  const deny = useApiMutation({
    mutationFn: (v: { id: string; reason: string }) => commerce.denyRefund(v.id, v.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['refunds'] }),
  });

  return (
    <div>
      <PageHeader
        title="退款"
        sub="要退钱的人排在这儿，等你批"
        lead={等着批 && list.data?.total
          ? { label: '等着批', value: thou(list.data.total), tone: 'debt' }
          : undefined}
        stats={list.data ? [
          ...(等着批 ? [] : [{ label: '这次查到', value: thou(list.data.total) }]),
          { label: '本页金额', value: yuan(本页金额) },
        ] : undefined}
      />
      <div className="p-4">
        <FilterBar
          fields={[
            /* 【按单号找】（2026-09-06 · 五路体验走查）。这一栏此前不存在,
               而客服在这一页最常做的一件事就是「他说的是哪一单」——
               四百多条待批只能靠日期缩窄再肉眼翻。
               后端其实一直收着 `keyword`（`Pg` 结构体里就有），
               只是 SQL 里一次没用 —— 实测带不带它都返回 2,538 条。 */
            { kind: 'text', key: 'keyword', label: '找', placeholder: '订单号 / 退款号 / 支付号', width: 220 },
            { kind: 'select', key: 'status', label: '状态', options: REFUND_STATUSES.map(v => ({ v, label: statusLabel(v) })) },
            { kind: 'date', key: 'from', label: '从' },
            { kind: 'date', key: 'to', label: '到' },
          ]}
          values={draft}
          onChange={setDraft}
          onSearch={() => setFilt({ ...draft, size: 50, page: 0 })}
          onReset={() => { setDraft({ status: 'requested' }); setFilt({ status: 'requested', size: 50, page: 0 }); }}
          right={<button className="btn btn-soft" onClick={() => list.refetch()}><RefreshCw size={13}/> 刷新</button>}
        />
        <div className="panel">
          <table className="tbl">
            <thead><tr>
              <th>编号</th><th>订单</th><th>支付</th><th>状态</th><th>来源</th><th>原因</th>
              <th className="r">金额</th><th>申请于</th><th>走到哪一步</th><th className="c">动作</th>
            </tr></thead>
            <tbody>
              {(list.data?.items ?? []).map((r: any) => (
                <tr key={r.id}>
                  {/* 点一下抄走整串 —— 这一页没有抽屉，不给这条路的话
                      屏上根本拿不到一个完整单号（见 CopyId 顶上那段）。 */}
                  <td className="id"><CopyId id={r.id}>{shortId(r.id)}</CopyId></td>
                  <td className="font-mono text-ink-3"><CopyId id={r.order_id}>{shortId(r.order_id)}</CopyId></td>
                  <td className="font-mono text-ink-3"><CopyId id={r.payment_id}>{shortId(r.payment_id)}</CopyId></td>
                  <td><span className={statusClass(r.status)}>{statusLabel(r.status)}</span></td>
                  <td><span className={r.actor_kind === 'user' ? 'text-ink-2' : 'text-ink-3'}>{谁提的(r.actor_kind)}</span></td>
                  {/* 【客户的原话就在响应里，而屏上只渲那个码】
                      （2026-09-06 三路验证 · 运营那一路）。
                      `list_refunds` 的 SELECT 一直取着 `reason_text` ——
                      库里 813/2568 笔写着客户自己打的字（「不想要了」这种）。
                      取到了，扔掉了。而判一笔退款该不该批，那句话
                      比一个枚举码有用得多。
                      码留着当分类，原话跟在下面一行、轻一档。 */}
                  <td className="text-ink-2">
                    <div>{退款原因(r.reason_code)}</div>
                    {r.reason_text && (
                      <div className="text-[12px] text-ink-3 mt-0.5 max-w-[16rem] truncate"
                           title={r.reason_text}>「{r.reason_text}」</div>
                    )}
                    {/* 【失败了要说为什么失败】。132 笔写着 `CHANNEL_REJECTED
                        | 渠道拒绝`，而屏上只有一颗「重试」——
                        渠道拒绝的重试必然再失败，客服只能一笔笔试。 */}
                    {r.status === 'failed' && (r.failure_code || r.failure_msg) && (
                      <div className="text-[12px] text-debt mt-0.5 max-w-[16rem] truncate"
                           title={[r.failure_code, r.failure_msg].filter(Boolean).join(' · ')}>
                        {[r.failure_code, r.failure_msg].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="r font-semibold">{yuan(r.amount_minor, r.currency)}</td>
                  <td title={ts(r.created_at)}>{rel(r.created_at)}</td>
                  {/* 【三列时间说的是同一件事】。审核、完成跟创建
                      在自动结算的库里是同一秒，三列并排读起来像三个独立事实。
                      合成一列「走到哪一步」，只在真的隔开时才显示间隔。 */}
                  <td className="text-ink-3" title={`审核 ${ts(r.approved_at)}／完成 ${ts(r.completed_at)}`}>
                    {走到哪(r)}
                  </td>
                  <td className="c">
                    {r.status === 'requested' && (
                      <div className="flex gap-1 justify-center">
                        {/* 【真出钱的那一颗要问一句，而且要把金额念出来】
                            （2026-09-03 五路评审 · 后台产品体验）。

                            上一版：批准是一个 13px 的对勾，点下去钱当场退出去，
                            没有确认、没有金额复述；而**不花钱**的「拒绝」
                            反倒有一个 prompt 要理由。摩擦加在了错的那一侧。
                            列表里相邻两行的对勾长得一模一样，手滑一行
                            就是退错一笔钱，而退款是不可撤销的。

                            念的是金额与订单号 —— 那正是「点错了行」时
                            唯一看得出来的两样东西。 */}
                        <button className="btn btn-soft" title="批准"
                                onClick={() => {
                                  if (!confirm(`把 ${yuan(r.amount_minor, r.currency)} 退给订单 ${shortId(r.order_id)}？钱退出去就收不回来了。`)) return;
                                  approve.mutate(r.id);
                                }}><Check size={13}/></button>
                        <button className="btn btn-debt" onClick={() => { const why = prompt('拒绝理由？'); if (why) deny.mutate({ id: r.id, reason: why }); }} title="拒绝"><X size={13}/></button>
                      </div>
                    )}
                    {/* 重试同理 —— 它走的是同一个接口，也一样出钱 */}
                    {r.status === 'failed' && (
                      <button className="btn btn-soft" title="重试"
                              onClick={() => {
                                if (!confirm(`再退一次 ${yuan(r.amount_minor, r.currency)}（订单 ${shortId(r.order_id)}）？`)) return;
                                approve.mutate(r.id);
                              }}><RefreshCw size={13}/></button>
                    )}
                  </td>
                </tr>
              ))}
              {/* 【取不到跟「一条都没有」不是一回事】（2026-09-03 五路评审 · 后台产品体验）。
                  上一版只有空态那一行，而它的条件是 `X.data && …length === 0` ——
                  查询失败时 `data` 是 undefined，两行都不渲染，
                  屏上剩一张只有表头的空表。带着筛选条件的页面上，
                  运营会以为是自己把条件筛空了。 */}
                <TableError 出错={list.isError} 列数={10} />
                {list.data && list.data.items.length === 0 && (
                <tr><td colSpan={10} className="text-center py-10 text-ink-4">等着批的退款一个都没有。要看全部，把上面的状态改成「全部」</td></tr>
              )}
            </tbody>
          </table>
          {list.data && (
            <Pagination page={filt.page ?? 0} size={filt.size ?? 50} total={list.data.total} onPage={(p) => setFilt({ ...filt, page: p })} />
          )}
        </div>
      </div>
    </div>
  );
}
