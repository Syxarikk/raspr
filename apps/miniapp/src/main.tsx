import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './styles.css';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:51555' });

type Tab = 'orders' | 'payouts' | 'profile';

interface Order {
  id: number;
  title: string;
  status: string;
  promoter_id: number | null;
  deadline_at: string | null;
  comment: string | null;
}

interface Payout {
  order_id: number;
  amount_preliminary: number | string;
  amount_final: number | string;
  status: 'on_review' | 'to_pay' | 'paid';
}

interface User {
  id: number;
  full_name: string;
  role: string;
  username: string | null;
  phone: string | null;
  is_ready: boolean;
  suspicious_note: string | null;
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    Draft: 'Черновик',
    Assigned: 'Назначен',
    InProgress: 'В работе',
    Review: 'Проверка',
    Payment: 'К оплате',
    Completed: 'Завершён',
    on_review: 'На проверке',
    to_pay: 'К оплате',
    paid: 'Оплачен',
  };
  return statusMap[status] || status;
}

function getStatusClass(status: string): string {
  const normalized = status.toLowerCase().replace('_', '-');
  return `status-${normalized}`;
}

function formatMoney(value: number | string): string {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function AuthScreen({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/telegram', { telegram_id: 123456789 });
      localStorage.setItem('mini_token', data.access_token);
      onLogin();
    } catch (error) {
      alert('Ошибка входа. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">A</div>
        <h1>AdControl</h1>
        <p>Управление нарядами для промоутеров. Войдите, чтобы начать работу.</p>
        <button className="primary-btn" onClick={handleLogin} disabled={loading}>
          {loading ? 'Входим...' : '🚀 Войти через Telegram'}
        </button>
      </div>
    </div>
  );
}

function OrdersTab({ orders }: { orders: Order[] }) {
  const grouped = useMemo(() => {
    const todo = orders.filter((o) => o.status === 'InProgress' || o.status === 'Review');
    const waiting = orders.filter((o) => o.status === 'Assigned' || o.status === 'Payment');
    const done = orders.filter((o) => o.status === 'Completed');
    return { todo, waiting, done };
  }, [orders]);

  return (
    <div>
      <div className="app-header">
        <h1>📋 Наряды</h1>
        <p>Все ваши задачи и заказы</p>
      </div>

      {grouped.todo.length > 0 && (
        <>
          <h3 style={{ color: 'white', marginBottom: 12, fontWeight: 700 }}>Сделать</h3>
          {grouped.todo.map((order) => (
            <div className="card" key={order.id}>
              <div className="card-header">
                <span className="card-title">{order.title}</span>
                <span className="card-id">#{order.id}</span>
              </div>
              {order.comment && <div className="card-subtitle">{order.comment}</div>}
              <div className="card-meta">
                <span className={`status-badge ${getStatusClass(order.status)}`}>
                  {formatStatus(order.status)}
                </span>
                {order.deadline_at && (
                  <span style={{ fontSize: 12, color: '#a0aec0' }}>
                    📅 {new Date(order.deadline_at).toLocaleDateString('ru-RU')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {grouped.waiting.length > 0 && (
        <>
          <h3 style={{ color: 'white', marginBottom: 12, fontWeight: 700, marginTop: 24 }}>Ожидаем</h3>
          {grouped.waiting.map((order) => (
            <div className="card" key={order.id}>
              <div className="card-header">
                <span className="card-title">{order.title}</span>
                <span className="card-id">#{order.id}</span>
              </div>
              {order.comment && <div className="card-subtitle">{order.comment}</div>}
              <div className="card-meta">
                <span className={`status-badge ${getStatusClass(order.status)}`}>
                  {formatStatus(order.status)}
                </span>
              </div>
            </div>
          ))}
        </>
      )}

      {grouped.done.length > 0 && (
        <>
          <h3 style={{ color: 'white', marginBottom: 12, fontWeight: 700, marginTop: 24 }}>Закрытые</h3>
          {grouped.done.map((order) => (
            <div className="card" key={order.id}>
              <div className="card-header">
                <span className="card-title">{order.title}</span>
                <span className="card-id">#{order.id}</span>
              </div>
              <div className="card-meta">
                <span className={`status-badge ${getStatusClass(order.status)}`}>
                  {formatStatus(order.status)}
                </span>
              </div>
            </div>
          ))}
        </>
      )}

      {orders.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <div className="empty-text">Нарядов пока нет</div>
        </div>
      )}
    </div>
  );
}

function PayoutsTab({ payouts }: { payouts: Payout[] }) {
  const total = useMemo(() => {
    return payouts.reduce((acc, p) => {
      const amount = parseFloat(String(p.amount_final || p.amount_preliminary));
      return acc + (isNaN(amount) ? 0 : amount);
    }, 0);
  }, [payouts]);

  const stats = useMemo(() => {
    return {
      onReview: payouts.filter((p) => p.status === 'on_review').length,
      toPay: payouts.filter((p) => p.status === 'to_pay').length,
      paid: payouts.filter((p) => p.status === 'paid').length,
    };
  }, [payouts]);

  return (
    <div>
      <div className="app-header">
        <h1>💰 Оплата</h1>
        <p>Ваши выплаты и заработок</p>
      </div>

      <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Всего к получению</div>
        <div style={{ fontSize: 36, fontWeight: 700 }}>{formatMoney(total)} ₽</div>
        <div className="stats-grid" style={{ marginTop: 20 }}>
          <div className="stat-box">
            <div className="stat-label">На проверке</div>
            <div className="stat-value">{stats.onReview}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">К оплате</div>
            <div className="stat-value">{stats.toPay}</div>
          </div>
        </div>
      </div>

      {payouts.map((payout) => {
        const preliminary = parseFloat(String(payout.amount_preliminary));
        const final = parseFloat(String(payout.amount_final));
        return (
          <div className="card" key={payout.order_id}>
            <div className="card-header">
              <span className="card-title">Наряд #{payout.order_id}</span>
              <span className={`status-badge ${getStatusClass(payout.status)}`}>
                {formatStatus(payout.status)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <div>
                <div className="amount-label">Предварительно</div>
                <div className="amount">{formatMoney(preliminary)} ₽</div>
              </div>
              {!isNaN(final) && final > 0 && (
                <div>
                  <div className="amount-label">Итого</div>
                  <div className="amount">{formatMoney(final)} ₽</div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {payouts.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">💸</div>
          <div className="empty-text">Выплат пока нет</div>
        </div>
      )}
    </div>
  );
}

function ProfileTab({ me }: { me: User | null }) {
  if (!me) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>Загрузка профиля...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="card profile-card">
        <div className="avatar">{getInitials(me.full_name)}</div>
        <div className="profile-name">{me.full_name}</div>
        <div className="profile-username">@{me.username || 'no-username'}</div>
        <div className="profile-status">
          <span className={`status-dot ${me.is_ready ? '' : 'inactive'}`}></span>
          {me.is_ready ? 'Готов брать наряды' : 'Не берет наряды'}
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>📞 Контакты</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>📱</span>
            <span style={{ color: '#718096' }}>{me.phone || 'Не указан'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>💬</span>
            <span style={{ color: '#718096' }}>@{me.username || 'no-username'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>🆔</span>
            <span style={{ color: '#718096' }}>ID: {me.id}</span>
          </div>
        </div>
      </div>

      {me.suspicious_note && (
        <div className="card" style={{ background: '#fff5f5', borderLeft: '4px solid #fc8181' }}>
          <div className="card-title" style={{ color: '#c53030', marginBottom: 8 }}>⚠️ Примечание</div>
          <div style={{ color: '#742a2a' }}>{me.suspicious_note}</div>
        </div>
      )}

      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>⚙️ Настройки</div>
        <button
          className="primary-btn"
          onClick={() => {
            localStorage.removeItem('mini_token');
            window.location.reload();
          }}
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('mini_token') || '');
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const [ordersRes, payoutsRes, meRes] = await Promise.all([
          api.get<Order[]>('/orders', { headers }),
          api.get<Payout[]>('/payouts', { headers }).catch(() => ({ data: [] })),
          api.get<User>('/users/me', { headers }),
        ]);

        setOrders(ordersRes.data);
        setPayouts(payoutsRes.data);
        setMe(meRes.data);
      } catch (error) {
        console.error('Load error:', error);
        localStorage.removeItem('mini_token');
        setToken('');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [token, headers]);

  if (!token) {
    return <AuthScreen onLogin={() => setToken(localStorage.getItem('mini_token') || '')} />;
  }

  if (loading) {
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
        {tab === 'orders' && <OrdersTab orders={orders} />}
        {tab === 'payouts' && <PayoutsTab payouts={payouts} />}
        {tab === 'profile' && <ProfileTab me={me} />}
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
