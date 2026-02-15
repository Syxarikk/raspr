import { useMemo } from 'react';

import { formatStatus, getStatusClass } from '../../lib/format';
import type { Order } from '../../types/api';

interface OrdersTabProps {
  orders: Order[];
}

export function OrdersTab({ orders }: OrdersTabProps) {
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
                <span className={`status-badge ${getStatusClass(order.status)}`}>{formatStatus(order.status)}</span>
                {order.deadline_at && (
                  <span style={{ fontSize: 12, color: '#a0aec0' }}>📅 {new Date(order.deadline_at).toLocaleDateString('ru-RU')}</span>
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
                <span className={`status-badge ${getStatusClass(order.status)}`}>{formatStatus(order.status)}</span>
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
                <span className={`status-badge ${getStatusClass(order.status)}`}>{formatStatus(order.status)}</span>
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
