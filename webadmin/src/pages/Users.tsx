import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../lib/feedback';
import { commerce } from '../lib/api';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import TableError from '../components/TableError';
import { rel, ts, shortId, platformLabel, thou, regionLabel } from '../components/util';
import { useAtom } from 'jotai';
import { activeRegionAtom } from '../store/auth';
import { Search } from 'lucide-react';

interface UserRow {
  id: string; nickname: string; platform: string; region: string; locale: string;
  is_anonymous: boolean; created_at: string; last_active_at: string;
  is_banned?: boolean;
  /** 注销过的人。有值就是他自己走了 —— 数据删了，单子按法律留着 */
  deleted_at?: string | null;
}

export default function Users() {
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const size = 30;
  /* 【区跟顶栏那个「看的是」走，这一页不再自己开一个下拉框】（2026-09-05）。
     两件事一起修:

     一、那个下拉框列的是 `cn / hk / tw / jp / us`，而名册里的六格是
        cn / jp / kr / sea / na / zh_hant —— 五个选项里三个不是区，
        挑中它们恒定 0 条，屏上跟「这个区真没人」长得一模一样。
     二、它默认「所有区域」，也就是不带 region 去问。而后端的规矩是
        「scope 有多个区、请求又不带 region → 当场拒」——
        于是**一位管两个区的运营打开用户页只看得到一句 forbidden**。
        种子里一个多区管理员都没有，所以这条路径一次都没被走过
        （docs/ACCEPTANCE-25.md 先决条件四）。

     顶栏那个镜头本来就是「区是全局镜头，不是筛选条件」（Layout.tsx
     那一段注释），别的十八页都跟着它走，只有这一页另开了一套。 */
  const [region] = useAtom(activeRegionAtom);
  /* 「全部区域」（super 才有）就是不带 region —— 后端认这个语义 */
  const 区参数 = region === 'global' ? '' : region;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['users', page, search, platform, region],
    queryFn: () => api.get<{ items: UserRow[]; total: number; size: number }>(
      `/users?page=${page}&size=${size}&q=${encodeURIComponent(search)}&platform=${platform}&region=${区参数}`
    ),
  });

  return (
    <div className="min-w-0">
      <PageHeader
        title="用户"
        sub="用过这个产品的每一个人。多数是没登录的游客"
        stats={[
          { label: '一共', value: data ? thou(data.total) : '—' },
          { label: '本页', value: data ? thou(data.items.length) : '—' },
        ]}
      />
      <div className="p-4 space-y-3">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">筛选</span>
          </div>
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-4" />
              <input
                placeholder="用户号或昵称"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="input pl-7 w-56"
              />
            </div>
            <select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }} className="select w-28">
              <option value="">所有平台</option>
              <option value="web">网页</option>
              <option value="mini">小程序</option>
              <option value="ios">iOS</option>
              <option value="android">安卓</option>
            </select>
            {/* 区在顶栏那个「看的是」上 —— 这里说一句它现在看的是哪儿，
                免得人以为这一页列的是所有区的人 */}
            <span className="label text-ink-4">
              看的是 {region === 'global' ? '全部区域' : regionLabel(region)}
            </span>
            <div className="flex-1" />
            <button onClick={() => { setSearch(''); setPlatform(''); }} className="btn btn-soft">重置</button>
            <button onClick={() => window.location.reload()} className="btn btn-soft">刷新</button>
          </div>
        </div>

        <div className="panel">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-32">编号</th>
                  <th>昵称</th>
                  <th className="w-20">平台</th>
                  <th className="w-16">区域</th>
                  <th className="w-20">语言</th>
                  <th className="w-16 c">匿名</th>
                  <th className="r w-44">创建</th>
                  <th className="r w-40">最后活动</th>
                  <th className="r w-28">进不进得来</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={9} className="text-center py-8 text-ink-4">正在取…</td></tr>
                )}
                {data?.items.map((r) => (
                  /* 【那个「看」按钮没有 onClick】。点了什么都不发生 ——
                     一个在那儿却不做事的按钮比没有更糟：它让人以为
                     这里有个详情页，试过一次之后就不再信这一屏别的按钮。
                     这一页本身没有详情抽屉，而客服真正要的是
                     「这个人买过什么」——整行点开就跳到他的订单。 */
                  <tr key={r.id}
                      className="cursor-pointer"
                      onClick={() => nav(`/orders?keyword=${r.id}`)}>
                    <td className="font-mono text-ink-3" title={r.id}>{shortId(r.id, 6, 6)}</td>
                    <td className="text-ink font-medium">{r.nickname}</td>
                    <td className="text-ink-2">{platformLabel(r.platform)}</td>
                    <td className="label text-ink-3">{regionLabel(r.region)}</td>
                    <td className="font-mono text-xs text-ink-4">{r.locale}</td>
                    <td className="c">
                      {/* 【注销过的人先说这件事】。他既不是游客也不是已登录 ——
                          那个号已经没有主人了，而客服最需要先知道的正是这个:
                          联系不上，也不必再对他做什么 */}
                      {r.deleted_at
                        ? <span className="text-debt">已注销</span>
                        : r.is_anonymous
                          ? <span className="text-ink-3">游客</span>
                          : <span className="text-settled">已登录</span>}
                    </td>
                    <td className="r font-mono text-xs text-ink-3">{ts(r.created_at)}</td>
                    <td className="r text-ink-3">{rel(r.last_active_at)}</td>
                    {/* 【`is_banned` 这一列建库起就在，两头都没接】——
                        后台看着能封、封完那个人照常下单。现在两头都通了。
                        这一格挡住行点击，不然点「封」会顺带跳到订单页。 */}
                    <td className="r" onClick={(e) => e.stopPropagation()}>
                      {/* 注销过的号封不封没有意义 —— 它已经进不来了。
                          摆一颗按得动的「封」等于给运营一个假动作 */}
                      {r.deleted_at
                        ? <span className="label text-ink-4">已经进不来了</span>
                        : <封禁 用户={r} 变了={() => refetch()} />}
                    </td>
                  </tr>
                ))}
                {/* 【取不到跟「一条都没有」不是一回事】（2026-09-03 五路评审 · 后台产品体验）。
                  上一版只有空态那一行，而它的条件是 `X.data && …length === 0` ——
                  查询失败时 `data` 是 undefined，两行都不渲染，
                  屏上剩一张只有表头的空表。带着筛选条件的页面上，
                  运营会以为是自己把条件筛空了。 */}
                <TableError 出错={isError} 列数={9} />
                {data && data.items.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-ink-4">没有符合条件的用户</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 【用共用的那一个】（2026-09-04 · 25 计划的后台逐页走）。
              这一页原先手写了一份，写出来的是「1–30 of 26,631」
              和「page 1 / 888」——别的十八页都是「1-50 / 19,153」「1 / 384」。
              整台控制台说中文，只有这一角落说英文,
              而它是同一件事的两种说法，读的人得认两遍。
              共用组件的 `page` 从 0 起，这一页从 1 起，差值在这儿转。 */}
          {data && data.total > size && (
            <Pagination
              page={page - 1}
              size={size}
              total={data.total}
              onPage={(p) => setPage(p + 1)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* 封一个人 / 放一个人。
 *
 * 【要说一句为什么】。只有一个开关的话，三个月后没人说得出
 * 当初为什么封了这个人 —— 而那正是要翻这条记录的时候。
 * 理由落进操作记录（中间件把请求体记进 diff）。
 */
function 封禁({ 用户, 变了 }: { 用户: any; 变了: () => void }) {
  const [开着, 设开] = useState(false);
  const [说, 设说] = useState('');
  const 提交 = useApiMutation({
    mutationFn: () => commerce.setUserBan(用户.id, !用户.is_banned, 说.trim()),
    onSuccess: () => { 设开(false); 设说(''); 变了(); },
  });

  if (!开着) {
    return 用户.is_banned ? (
      <button className="btn btn-soft" onClick={() => 设开(true)}>
        <span className="st st-debt">进不来</span>
      </button>
    ) : (
      <button className="btn btn-ghost" onClick={() => 设开(true)}>封掉</button>
    );
  }
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <input className="input w-40" autoFocus
             placeholder={用户.is_banned ? '为什么放他进来' : '为什么封'}
             value={说} onChange={(e) => 设说(e.target.value)} />
      <button className={`btn ${用户.is_banned ? 'btn-prim' : 'btn-debt'}`}
              disabled={!说.trim() || 提交.isPending}
              onClick={() => 提交.mutate()}>
        {提交.isPending ? '…' : 用户.is_banned ? '放他进来' : '封'}
      </button>
      <button className="btn btn-ghost" onClick={() => 设开(false)}>算了</button>
    </div>
  );
}
