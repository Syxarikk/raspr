import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { fetchDashboard, TOKEN_STORAGE_KEY } from '../../lib/api';
import type { Tab } from '../../types/api';
import { AuthScreen } from '../auth/AuthScreen';
import { OrdersTab } from '../orders/OrdersTab';
import { PayoutsTab } from '../payouts/PayoutsTab';
import { ProfileTab } from '../profile/ProfileTab';

export function MiniApp() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_STORAGE_KEY) || '');
  const [tab, setTab] = useState<Tab>('orders');

  const dashboardQuery = useQuery({
    queryKey: ['mini-dashboard', token],
    queryFn: () => fetchDashboard(token),
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (!dashboardQuery.error) return;
    if (!axios.isAxiosError(dashboardQuery.error) || dashboardQuery.error.response?.status !== 401) return;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
  }, [dashboardQuery.error]);

  const handleLogin = (nextToken: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    setToken(nextToken);
  };

  const data = dashboardQuery.data;

  const loading = useMemo(() => {
    if (!token) return false;
    return dashboardQuery.isLoading || dashboardQuery.isFetching;
  }, [dashboardQuery.isFetching, dashboardQuery.isLoading, token]);

  if (!token) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  if (loading || !data) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>Загружаем данные...</div>
      </div>
    );
  }

  return (
    <>
      <div className="app-container">
        {tab === 'orders' && <OrdersTab orders={data.orders} />}
        {tab === 'payouts' && <PayoutsTab payouts={data.payouts} />}
        {tab === 'profile' && <ProfileTab me={data.me} />}
      </div>

      <nav className="bottom-nav">
        <button className={`nav-btn ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          <div className="nav-icon">📋</div>
          <span>Наряды</span>
        </button>
        <button className={`nav-btn ${tab === 'payouts' ? 'active' : ''}`} onClick={() => setTab('payouts')}>
          <div className="nav-icon">💰</div>
          <span>Оплата</span>
        </button>
        <button className={`nav-btn ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>
          <div className="nav-icon">👤</div>
          <span>Профиль</span>
        </button>
      </nav>
    </>
  );
}
