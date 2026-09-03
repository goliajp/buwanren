import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { commerce } from '../lib/api';
import { useApiMutation } from '../lib/feedback';
import PageHeader from '../components/PageHeader';
import Drawer from '../components/Drawer';
import { ts, rel, thou, shortId } from '../components/util';
import { CheckCircle2 } from 'lucide-react';

/* 线下活动。
 *
 * 【`/admin/activities` 这条接口一直在，而控制台里没有页面】
 * （2026-09-03 五路评审 · 架构审计）——运营在后台看不到活动，
 * 而小程序那一屏正列着三场。
 *
 * 报名这条链原先整个不存在：`activity_registration` 有表、零行、
 * 零处引用，屏上却写着「48/100 已报名」，那个数是种子数据里的字面量。
 * 现在报名、退订、名单、签到都通了，所以这一页给的是【今天要用的两件事】：
 * 哪一场还差多少人，以及现场核名单。
 */

interface Row {
  id: string; title: string; category: string; city: string | null;
  start_at: string; max_participants: number;
  current_count: number; checked_in_count: number;
  registration_rate: number; status: string;
}

interface Reg {
  id: string; user_id: string; nickname: string; region: string;
  status: string; registered_at: string; checked_in_at: string | null;
}

const 类别 = (c: string) => ({ market: '市集', course: '课程', ritual: '法会' }[c] ?? c);
const 场次状态 = (s: string) => ({ open: '开着', closed: '已截止', draft: '草稿' }[s] ?? s);

export default function Activities() {
  const [看名单, 设看名单] = useState<Row | null>(null);
  const list = useQuery({ queryKey: ['activities'], queryFn: () => commerce.listActivities() });
  const 场次 = list.data?.items ?? [];

  const 总位子 = 场次.reduce((n, r) => n + r.max_participants, 0);
  const 已报 = 场次.reduce((n, r) => n + r.current_count, 0);

  return (
    <div className="min-w-0">
      <PageHeader
        title="线下活动"
        sub="市集、课程、法会。这一页管报名与现场核名单"
        lead={{ label: '还空着', value: thou(总位子 - 已报) }}
        stats={[
          { label: '场次', value: thou(场次.length) },
          { label: '已报名', value: `${thou(已报)} / ${thou(总位子)}` },
        ]}
      />
      <div className="p-4 space-y-3">
        <div className="panel">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>活动</th>
                  <th className="w-20">类别</th>
                  <th className="w-24">城市</th>
                  <th className="r w-44">开场</th>
                  <th className="r w-28">报名</th>
                  <th className="r w-24">到场</th>
                  <th className="w-20">状态</th>
                </tr>
              </thead>
              <tbody>
                {list.isLoading && (
                  <tr><td colSpan={7} className="text-center py-8 text-ink-4">正在取…</td></tr>
                )}
                {场次.map((r) => (
                  /* 整行点开名单 —— 运营在现场要的是名单，不是详情 */
                  <tr key={r.id} className="cursor-pointer" onClick={() => 设看名单(r)}>
                    <td className="text-ink font-medium">{r.title}</td>
                    <td className="label text-ink-3">{类别(r.category)}</td>
                    <td className="text-ink-2">{r.city ?? '—'}</td>
                    <td className="r font-mono text-xs text-ink-3">{ts(r.start_at)}</td>
                    <td className="r num">
                      {r.current_count} / {r.max_participants}
                      {/* 满了要一眼看见 —— 满场之后还在发的宣传是白发的 */}
                      {r.current_count >= r.max_participants && (
                        <span className="st st-debt ml-1.5">满</span>
                      )}
                    </td>
                    <td className="r num text-ink-3">{r.checked_in_count}</td>
                    <td><span className="label text-ink-3">{场次状态(r.status)}</span></td>
                  </tr>
                ))}
                {list.data && 场次.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-ink-4">还没有活动</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Drawer
        open={!!看名单}
        onClose={() => 设看名单(null)}
        title={看名单 ? `名单 · ${看名单.title}` : '名单'}
        subtitle={看名单 ? `${看名单.city ?? '—'} · ${ts(看名单.start_at)} · ${看名单.current_count}/${看名单.max_participants}` : ''}
        width={680}
      >
        {看名单 && <名单 场次={看名单} />}
      </Drawer>
    </div>
  );
}

function 名单({ 场次 }: { 场次: Row }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['registrations', 场次.id],
    queryFn: () => commerce.listRegistrations(场次.id),
  });
  const 报名们: Reg[] = q.data?.items ?? [];

  const 签到 = useApiMutation({
    mutationFn: (id: string) => commerce.checkInRegistration(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrations', 场次.id] });
      // 列表那一页的「到场」数也跟着变 —— 不刷的话两屏说的不是一件事
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  if (q.isLoading) return <div className="p-4 text-ink-4">正在取…</div>;
  if (报名们.length === 0) {
    return <div className="p-8 text-center text-ink-4">还没有人报名</div>;
  }

  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>报名人</th>
          <th className="w-16">区域</th>
          <th className="r w-40">报名时间</th>
          <th className="r w-32">到场</th>
        </tr>
      </thead>
      <tbody>
        {报名们.map((r) => (
          <tr key={r.id} className={r.status === 'cancelled' ? 'opacity-50' : ''}>
            <td>
              <div className="text-ink font-medium">{r.nickname || '（没填昵称）'}</div>
              <div className="font-mono text-xs text-ink-4" title={r.user_id}>{shortId(r.user_id, 6, 6)}</div>
            </td>
            <td className="label text-ink-3">{r.region}</td>
            <td className="r text-ink-3">{rel(r.registered_at)}</td>
            <td className="r">
              {r.status === 'cancelled' ? (
                <span className="label text-ink-4">退了</span>
              ) : r.checked_in_at ? (
                <span className="text-settled" title={ts(r.checked_in_at)}>
                  <CheckCircle2 size={12} className="inline -mt-0.5 mr-1" />
                  {rel(r.checked_in_at)}
                </span>
              ) : (
                /* 签到是当场按的，所以按钮就摆在名字旁边 ——
                   跳一层详情页的话，现场排队的人要多等那一跳 */
                <button
                  className="btn btn-soft"
                  disabled={签到.isPending}
                  onClick={() => 签到.mutate(r.id)}
                >
                  签到
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
