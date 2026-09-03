import { useState } from 'react';
import { useAtom } from 'jotai';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { setAuthAtom } from '../store/auth';

export default function Login() {
  const [email, setEmail] = useState('admin@unmei.local');
  const [password, setPassword] = useState('admin123');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setAuth] = useAtom(setAuthAtom);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const r = await api.post<{ token: string; name: string; roles: string[]; region_scope?: string[] }>('/auth/login', { email, password });
      setAuth({ token: r.token, name: r.name, roles: r.roles, region_scope: r.region_scope ?? [] });
      nav('/');
    } catch (e: any) {
      setErr(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="text-[22px] font-semibold text-ink leading-none">unmei · console</div>
          <div className="label text-ink-4 mt-1">运营 · 内容 · 财务</div>
        </div>
        <form onSubmit={submit} className="panel p-5 space-y-3.5">
          <label className="block">
            <span className="label text-ink-4 block mb-1">邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="label text-ink-4 block mb-1">密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full"
            />
          </label>
          {err && (
            <div className="text-xs text-debt bg-debt-bg px-2.5 py-2 rounded num">
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-prim w-full justify-center h-9 disabled:opacity-50"
          >
            {loading ? '正在登录…' : '登录'}
          </button>
        </form>
        <p className="text-xs text-ink-4 mt-4 num">
          default · admin@unmei.local / admin123
        </p>
      </div>
    </div>
  );
}
