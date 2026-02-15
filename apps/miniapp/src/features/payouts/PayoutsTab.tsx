import { useMemo } from 'react';

import { formatMoney, formatStatus, getStatusClass } from '../../lib/format';
import type { Payout } from '../../types/api';

interface PayoutsTabProps {
  payouts: Payout[];
}

export function PayoutsTab({ payouts }: PayoutsTabProps) {
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
              <span className={`status-badge ${getStatusClass(payout.status)}`}>{formatStatus(payout.status)}</span>
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
