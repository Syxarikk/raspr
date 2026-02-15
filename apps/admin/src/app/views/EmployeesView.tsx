import { useCallback, useEffect, useMemo, useState } from 'react';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import SwapVertRounded from '@mui/icons-material/SwapVertRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';

import { MapSurface, SearchInput } from '../components/common';
import { formatMoney, initials, normalizeOrderStatus, parseAmount, pickFirst, statusClass, statusLabel } from '../utils';
import type { ApiOrder, ApiPayout, ApiUser, Marker } from '../types';

export function EmployeesView({
  promoters,
  orders,
  payouts,
  selectedPromoterId,
  onSelectPromoter,
  onSavePromoter,
  mapMarkers,
}: {
  promoters: ApiUser[];
  orders: ApiOrder[];
  payouts: ApiPayout[];
  selectedPromoterId: number | null;
  onSelectPromoter: (id: number) => void;
  onSavePromoter: (id: number, payload: { is_ready: boolean; suspicious_note: string | null }) => Promise<void>;
  mapMarkers: Marker[];
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [ready, setReady] = useState(true);
  const [note, setNote] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return promoters;
    return promoters.filter((promoter) => promoter.full_name.toLowerCase().includes(normalized));
  }, [promoters, query]);

  const selected = useMemo(() => {
    if (selectedPromoterId) {
      const found = promoters.find((promoter) => promoter.id === selectedPromoterId);
      if (found) return found;
    }
    return pickFirst(promoters);
  }, [promoters, selectedPromoterId]);

  useEffect(() => {
    setReady(Boolean(selected?.is_ready));
    setNote(selected?.suspicious_note || '');
  }, [selected]);

  const selectedOrders = useMemo(
    () => orders.filter((order) => selected && order.promoter_id === selected.id),
    [orders, selected],
  );

  const promoterPayoutTotal = useMemo(() => {
    if (!selected) return 0;
    const orderIds = new Set(selectedOrders.map((order) => order.id));
    return payouts
      .filter((payout) => orderIds.has(payout.order_id))
      .reduce((acc, payout) => acc + parseAmount(payout.amount_final || payout.amount_preliminary), 0);
  }, [payouts, selected, selectedOrders]);

  const save = useCallback(async () => {
    if (!selected) return;
    setSaveBusy(true);
    try {
      await onSavePromoter(selected.id, { is_ready: ready, suspicious_note: note.trim() || null });
    } finally {
      setSaveBusy(false);
    }
  }, [note, onSavePromoter, ready, selected]);

  return (
    <div className="split-layout triple">
      <section className="panel list-panel">
        <div className="section-header">
          <h2>Исполнители</h2>
        </div>

        <SearchInput value={query} onChange={setQuery} placeholder="Поиск по имени" />

        <div className="control-row">
          <span>Список исполнителей</span>
          <div className="control-buttons">
            <button className="icon-btn" type="button"><SwapVertRounded fontSize="small" /></button>
            <button className="icon-btn" type="button"><TuneRounded fontSize="small" /></button>
          </div>
        </div>

        <div className="scroll-area">
          {filtered.map((promoter, index) => {
            const promoterOrders = orders.filter((order) => order.promoter_id === promoter.id);
            const inProgress = promoterOrders.filter((order) => normalizeOrderStatus(order.status) === 'InProgress').length;
            const review = promoterOrders.filter((order) => normalizeOrderStatus(order.status) === 'Review').length;
            const payment = promoterOrders.filter((order) => normalizeOrderStatus(order.status) === 'Payment').length;

            return (
              <button
                key={promoter.id}
                className={`employee-row reveal ${selected?.id === promoter.id ? 'selected' : ''}`}
                style={{ animationDelay: `${index * 20}ms` }}
                type="button"
                onClick={() => onSelectPromoter(promoter.id)}
              >
                <div className="avatar xsmall">{initials(promoter.full_name)}</div>
                <span>{promoter.full_name}</span>
                <div className="load-dots">
                  <i className="dot yellow" title={`Проверка: ${review}`} />
                  <i className="dot blue" title={`В работе: ${inProgress}`} />
                  <i className="dot green" title={`К оплате: ${payment}`} />
                </div>
                <i className={promoter.is_ready ? 'dot-ready' : 'dot-pending'} />
              </button>
            );
          })}

          {!filtered.length ? <div className="empty-text">Исполнители не найдены</div> : null}
        </div>
      </section>

      <section className="panel detail-panel hide-on-mobile">
        {selected ? (
          <>
            <div className="profile-card">
              <div className="avatar huge">{initials(selected.full_name)}</div>
              <h3>{selected.full_name}</h3>
              <p>
                {ready ? 'Готов брать наряды' : 'Временно не берет наряды'}
                <i className={ready ? 'dot-ready' : 'dot-pending'} />
              </p>
            </div>

            <div className="stats-row">
              <div className="stats-box">
                <span>В работе</span>
                <strong>{selectedOrders.filter((order) => normalizeOrderStatus(order.status) === 'InProgress').length}</strong>
              </div>
              <div className="stats-box">
                <span>Назначено</span>
                <strong>{selectedOrders.filter((order) => normalizeOrderStatus(order.status) === 'Assigned').length}</strong>
              </div>
              <div className="stats-box large">
                <span>К оплате</span>
                <strong>{formatMoney(promoterPayoutTotal)} ₽</strong>
              </div>
            </div>

            <div className="contact-grid">
              <div>{selected.phone || '+7 000 000 00 00'}</div>
              <div>@{selected.username || 'bxpmsg'}</div>
              <div className="wide">ID пользователя: {selected.id}</div>
            </div>

            <div className="note-card">
              <div className="note-head">
                Комментарий менеджера
                <KeyboardArrowDownRounded fontSize="small" />
              </div>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} />
            </div>

            <div className="switch-row">
              <label>
                <input type="checkbox" checked={ready} onChange={(event) => setReady(event.target.checked)} />
                Готов брать наряды
              </label>

              <button className="primary-btn" type="button" disabled={saveBusy} onClick={() => void save()}>
                <SaveRounded fontSize="small" />
                {saveBusy ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>

            <div className="control-row compact">
              <span>История нарядов</span>
            </div>

            <div className="history-list">
              {selectedOrders.slice(0, 8).map((order) => (
                <div key={order.id} className="history-row">
                  <strong>#{order.id}</strong>
                  <span>{new Date(order.deadline_at || Date.now()).toLocaleDateString('ru-RU')}</span>
                  <span className={`status-pill ${statusClass(order.status)}`}>{statusLabel(order.status)}</span>
                </div>
              ))}
              {!selectedOrders.length ? <div className="empty-text">У исполнителя нет нарядов</div> : null}
            </div>
          </>
        ) : (
          <div className="empty-text">Нет данных по исполнителю</div>
        )}
      </section>

      <section className="panel map-panel hide-on-mobile">
        <MapSurface markers={mapMarkers} activeDock="employees" />
      </section>
    </div>
  );
}
