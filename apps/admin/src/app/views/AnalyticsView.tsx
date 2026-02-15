import AddRounded from '@mui/icons-material/AddRounded';

import { MapSurface } from '../components/common';
import { formatMoney, initials, normalizeOrderStatus, parseAmount } from '../utils';
import type { ApiAddress, ApiOrder, ApiPayout, ApiUser, Marker } from '../types';

export function AnalyticsView({
  me,
  orders,
  addresses,
  promoters,
  payouts,
  onCreateOrder,
  mapMarkers,
}: {
  me: ApiUser | null;
  orders: ApiOrder[];
  addresses: ApiAddress[];
  promoters: ApiUser[];
  payouts: ApiPayout[];
  onCreateOrder: () => void;
  mapMarkers: Marker[];
}): React.JSX.Element {
  const reviewQueue = orders.filter((order) => normalizeOrderStatus(order.status) === 'Review');
  const paymentQueue = orders.filter((order) => normalizeOrderStatus(order.status) === 'Payment');
  const totalPayout = payouts.reduce((acc, payout) => acc + parseAmount(payout.amount_final || payout.amount_preliminary), 0);
  const novelty = orders.length ? (reviewQueue.length / orders.length) * 100 : 0;

  return (
    <section className="analytics-view">
      <header className="page-header">
        <div>
          <h1>Привет, {me?.full_name.split(' ')[0] || 'Иван'} 👋</h1>
          <p>Вам надо сделать</p>
        </div>
        <button className="primary-btn" type="button" onClick={onCreateOrder}>
          <AddRounded fontSize="small" />
          Создать наряд
        </button>
      </header>

      <div className="analytics-grid">
        <article className="card reveal">
          <div className="card-head">
            <h2>Ждут проверку</h2>
            <button className="ghost-link" type="button" onClick={onCreateOrder}>
              К нарядам
            </button>
          </div>
          <div className="queue-list">
            {reviewQueue.slice(0, 4).map((order) => (
              <div key={order.id} className="queue-row">
                <strong>#{order.id}</strong>
                <span>{order.title}</span>
                <span className="status-pill is-review">Проверка</span>
              </div>
            ))}
            {!reviewQueue.length ? <div className="empty-text">Очередь проверки пуста</div> : null}
          </div>
        </article>

        <article className="card metric reveal">
          <h3>Нарядов</h3>
          <strong>{orders.length}</strong>
          <span>↗ 12%</span>
        </article>

        <article className="card metric reveal">
          <h3>Адресов</h3>
          <strong>{addresses.length}</strong>
          <span>↗ 12%</span>
        </article>

        <article className="card metric wide reveal">
          <h3>Активности</h3>
          <strong>{formatMoney(totalPayout)} ₽</strong>
          <span>↗ 12%</span>
          <div className="bars">
            <div><label>Листовки</label><b style={{ width: '72%' }} /></div>
            <div><label>Наклейки</label><b style={{ width: '41%' }} /></div>
            <div><label>Хенгеры</label><b style={{ width: '26%' }} /></div>
          </div>
        </article>

        <article className="card chart reveal">
          <h3>Новизна</h3>
          <strong>{novelty.toFixed(1)}%</strong>
          <span>↗ 3.2%</span>
          <div className="line-chart" />
        </article>
      </div>

      <div className="analytics-bottom">
        <article className="card reveal">
          <div className="card-head">
            <h2>Ждут оплаты</h2>
            <span className="muted">{paymentQueue.length} нарядов</span>
          </div>
          {paymentQueue.slice(0, 4).map((order) => (
            <div key={order.id} className="queue-row">
              <strong>#{order.id}</strong>
              <span>{order.title}</span>
              <span className="status-pill is-payment">К оплате</span>
            </div>
          ))}
          {!paymentQueue.length ? <div className="empty-text">Нет нарядов в оплате</div> : null}
        </article>

        <article className="card map-card reveal">
          <div className="card-head filters">
            <h2>Активность по карте</h2>
            <div className="chip-row">
              <span className="mini-chip active">Листовки</span>
              <span className="mini-chip">Наклейки</span>
              <span className="mini-chip">Таблички</span>
            </div>
          </div>
          <MapSurface markers={mapMarkers} activeDock="analytics" compact />
        </article>

        <article className="card waiters reveal">
          <div className="card-head">
            <h2>Ждём исполнителей</h2>
            <span className="muted">{promoters.length} в базе</span>
          </div>

          <div className="wait-stats">
            <div><span>В работе</span><strong>{orders.filter((order) => normalizeOrderStatus(order.status) === 'InProgress').length}</strong></div>
            <div><span>Назначено</span><strong>{orders.filter((order) => normalizeOrderStatus(order.status) === 'Assigned').length}</strong></div>
            <div><span>Черновик</span><strong>{orders.filter((order) => normalizeOrderStatus(order.status) === 'Draft').length}</strong></div>
          </div>

          <div className="promoter-stack">
            {promoters.slice(0, 4).map((promoter) => (
              <div key={promoter.id} className="promoter-row">
                <div className="avatar small">{initials(promoter.full_name)}</div>
                <span>{promoter.full_name}</span>
                <i className={promoter.is_ready ? 'dot-ready' : 'dot-pending'} />
              </div>
            ))}
            {!promoters.length ? <div className="empty-text">Список исполнителей пуст</div> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
