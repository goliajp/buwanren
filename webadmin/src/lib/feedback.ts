import { atom, useAtom, useSetAtom } from 'jotai';
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { ApiError } from './api';

/**
 * 操作反馈 · 让写操作的失败被看见。
 *
 * 在此之前，14 个 mutation 全都只写了 `mutationFn` + `onSuccess`，
 * 一个 `onError` 都没有。react-query 会把错误收进 `mutation.error`，
 * 但没有任何地方渲染它 —— 运营点了按钮，界面一动不动，
 * 既不知道成了还是没成，也不知道为什么。
 *
 * 后端这一轮把「对不存在的 ID 返回 ok:true」改成了 404，把
 * 「已付订单直接取消」改成了 409。这些都是有话要说的失败，
 * 说出来才有意义。
 */

export type ToneKind = 'ok' | 'bad';

export interface Notice {
  id: number;
  tone: ToneKind;
  text: string;
}

let seq = 0;

export const noticesAtom = atom<Notice[]>([]);

export const pushNoticeAtom = atom(
  null,
  (get, set, n: { tone: ToneKind; text: string }) => {
    const notice: Notice = { id: ++seq, ...n };
    set(noticesAtom, [...get(noticesAtom), notice]);
    // 成功一闪而过，失败留久一点 —— 失败往往要照着文案去查
    const ttl = n.tone === 'ok' ? 2500 : 8000;
    setTimeout(() => {
      set(noticesAtom, (cur) => cur.filter((x) => x.id !== notice.id));
    }, ttl);
  },
);

export const dismissNoticeAtom = atom(null, (get, set, id: number) => {
  set(noticesAtom, get(noticesAtom).filter((x) => x.id !== id));
});

export function useNotices() {
  const [notices] = useAtom(noticesAtom);
  const dismiss = useSetAtom(dismissNoticeAtom);
  return { notices, dismiss };
}

export function useNotify() {
  return useSetAtom(pushNoticeAtom);
}

/**
 * 后端的 `code` → 给运营看的说法。
 *
 * 原始文案是给工程师看的（`illegal state transition: paid → cancelled`），
 * 直接甩给运营既看不懂也不知道下一步做什么。这里按 code 给一句人话，
 * 原文附在后面 —— 排查时还得靠它。
 *
 * code 的取值见后端 `DomainError::code()` / `AppError::code()`。
 * 认不出的 code 直接显示原文，不吞。
 */
const CODE_TEXT: Record<string, string> = {
  not_found: '对象不存在',
  conflict: '当前状态不允许这个操作',
  illegal_state_transition: '状态流转不允许',
  validation: '参数不合法',
  idempotency_mismatch: '重复提交，参数与上次不一致',
  risk_blocked: '被风控规则拦下',
  insufficient: '余额或库存不足',
  adapter: '渠道侧失败',
  repository: '数据库错误',
  forbidden: '没有权限',
  upstream: '上游服务失败',
  internal: '服务端错误',
};

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    const zh = err.code ? CODE_TEXT[err.code] : undefined;
    return zh ? `${zh} · ${err.message}` : err.message;
  }
  if (err instanceof Error) return err.message;
  return '操作失败';
}

/**
 * `useMutation` 的替代品：默认把失败弹出来。
 *
 * 只是加了一条默认 `onError`；`onSuccess` / `onError` 传了就照传的走
 * （传自己的 `onError` 时，弹窗仍然会弹，两者不互斥）。
 * 成功文案要不要弹由调用方决定 —— 大部分动作会紧接着刷新列表，
 * 列表自己就是反馈，再弹一次是噪音。
 */
export function useApiMutation<TData = unknown, TVars = void>(
  options: UseMutationOptions<TData, Error, TVars>,
) {
  const notify = useNotify();
  return useMutation<TData, Error, TVars>({
    ...options,
    // 用 rest 转发：react-query 的回调签名在小版本间加过参数，
    // 写死形参会在升级时静默丢掉最后一个。
    onError: (...args: Parameters<NonNullable<typeof options.onError>>) => {
      notify({ tone: 'bad', text: describeError(args[0]) });
      options.onError?.(...args);
    },
  });
}
