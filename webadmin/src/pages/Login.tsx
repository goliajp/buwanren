import { useState } from 'react';
import { useAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen bg-canvas flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="text-[22px] font-semibold text-ink leading-none">unmei · console</div>
          <div className="uplabel text-ink-5 mt-1">OPS / CONTENT / FINANCE</div>
        </div>
        <form onSubmit={submit} className="panel p-5 space-y-3.5">
          <label className="block">
            <span className="uplabel text-ink-4 block mb-1">email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="uplabel text-ink-4 block mb-1">password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full"
            />
          </label>
          {err && (
            <div className="text-[11.5px] text-vermilion bg-vermilion-soft px-2.5 py-2 rounded num">
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-prim w-full justify-center h-9 disabled:opacity-50"
          >
            {loading ? 'signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-[10.5px] text-ink-5 mt-4 num">
          default · admin@unmei.local / admin123
        </p>
      </div>
    </div>
  );
}
