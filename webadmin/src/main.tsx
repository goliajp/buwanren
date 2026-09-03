import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { pushNotice } from './lib/feedback';

/* 【读失败也要被看见】（2026-09-03 五路评审 · 后台产品体验）。
 *
 * `lib/feedback.ts` 开头写着「让写操作的失败被看见」——那一半修好了。
 * 而**读**这一半原样留着:21 个页面、78 个 useQuery，
 * 一个 `isError` 分支都没有。查询失败时 `data` 是 undefined，
 * 表体的 map 什么都不渲染、空态那一行的条件也不成立，
 * 屏上剩一张只有表头的空表。
 *
 * 每张表现在自己有一行「取不到」；这里再兜一层 ——
 * 表之外还有下拉框、抽屉、月报那一块，它们没有一行可写。
 * 一处失败在右下角说一句，跟写操作同一个去处。
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  queryCache: new QueryCache({
    onError: (err, query) => {
      // 键的头一段就是这块数据叫什么（'orders' / 'refunds' / …）
      const 谁 = String((query.queryKey as unknown[])[0] ?? '数据');
      pushNotice({ tone: 'bad', text: `取不到「${谁}」：${(err as Error).message}` });
    },
  }),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
