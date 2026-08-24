import { useAtom } from 'jotai';
import { Routes, Route, Navigate } from 'react-router-dom';
import { authAtom } from './store/auth';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Pricing from './pages/Pricing';
import Promotions from './pages/Promotions';
import Subscriptions from './pages/Subscriptions';
import Orders from './pages/Orders';
import Payments from './pages/Payments';
import Refunds from './pages/Refunds';
import Shipments from './pages/Shipments';
import Reconciliation from './pages/Reconciliation';
import Risk from './pages/Risk';
import Finance from './pages/Finance';
import Outbox from './pages/Outbox';
import Master from './pages/Master';
import Users from './pages/Users';
import Naji from './pages/Naji';
import Quotes from './pages/Quotes';
import FeatureFlags from './pages/FeatureFlags';
import Mingli from './pages/Mingli';

export default function App() {
  const [auth] = useAtom(authAtom);
  if (!auth) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/refunds" element={<Refunds />} />
        <Route path="/shipments" element={<Shipments />} />
        <Route path="/reconciliation" element={<Reconciliation />} />
        <Route path="/risk" element={<Risk />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/outbox" element={<Outbox />} />
        <Route path="/master" element={<Master />} />
        <Route path="/users" element={<Users />} />
        <Route path="/naji" element={<Naji />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/feature_flags" element={<FeatureFlags />} />
        <Route path="/mingli" element={<Mingli />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
