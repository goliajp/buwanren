import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { api } from './lib/api';
import { authAtom, setAuthAtom } from './store/auth';
import Open from './pages/Open';
import Naji from './pages/Naji';
import Activity from './pages/Activity';
import Product from './pages/Product';
import Me from './pages/Me';
import BmSheet from './pages/BmSheet';
import BirthForm from './pages/BirthForm';

export default function App() {
  const [auth] = useAtom(authAtom);
  const [, setAuth] = useAtom(setAuthAtom);

  useEffect(() => {
    if (!auth) {
      api.post<any>('/auth/anonymous', { platform: 'web', region: 'cn', locale: 'zh-CN' })
        .then((r) => setAuth({ token: r.token, user: r.user }))
        .catch(console.error);
    }
  }, [auth, setAuth]);

  return (
    <div className="min-h-screen bg-paper paper-texx mx-auto max-w-md relative shadow-xl">
      <Routes>
        <Route path="/" element={<Open />} />
        <Route path="/birth" element={<BirthForm />} />
        <Route path="/naji" element={<Naji />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/product" element={<Product />} />
        <Route path="/me" element={<Me />} />
        <Route path="/me/bm" element={<BmSheet />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
