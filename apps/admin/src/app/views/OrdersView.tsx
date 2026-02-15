import { useCallback, useEffect, useMemo, useState } from 'react';
import AddRounded from '@mui/icons-material/AddRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import SortRounded from '@mui/icons-material/SortRounded';
import SwapVertRounded from '@mui/icons-material/SwapVertRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';

import { ORDER_STATUS_OPTIONS, ORDER_TABS } from '../constants';
import { MapSurface, ModalShell, SearchInput } from '../components/common';
import {
  buildAddressLabel,
  byId,
  formatMoney,
  initials,
  normalizeOrderStatus,
  orderSectionLabel,
  statusClass,
  statusLabel,
} from '../utils';
import type {
  ApiAddress,
  ApiOrder,
  ApiOrderDetail,
  ApiUser,
  ApiWorkType,
  Marker,
  OrderCreatePayload,
  OrderStatus,
  OrderTabKey,
  PhotoPreview,
  PhotoReviewStatus,
} from '../types';

export function OrdersView({
  orders,
  addresses,
  promoters,
  workTypes,
  selectedOrderId,
  onSelectOrder,
  orderDetails,
  orderPhotos,
  detailsLoading,
  photosLoading,
  onCreateOrder,
  onSetStatus,
  onReviewPhoto,
  onDeleteOrder,
  mapMarkers,
}: {
  orders: ApiOrder[];
  addresses: ApiAddress[];
  promoters: ApiUser[];
  workTypes: ApiWorkType[];
  selectedOrderId: number | null;
  onSelectOrder: (orderId: number) => void;
  orderDetails: Record<number, ApiOrderDetail | undefined>;
  orderPhotos: Record<number, PhotoPreview[] | undefined>;
  detailsLoading: boolean;
  photosLoading: boolean;
  onCreateOrder: (payload: OrderCreatePayload) => Promise<number>;
  onSetStatus: (orderId: number, status: OrderStatus) => Promise<void>;
  onReviewPhoto: (photoId: number, status: PhotoReviewStatus, reason?: string) => Promise<void>;
  onDeleteOrder: (orderId: number) => Promise<void>;
  mapMarkers: Marker[];
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<OrderTabKey>('todo');
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createAddressQuery, setCreateAddressQuery] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createComment, setCreateComment] = useState('');
  const [createPromoterId, setCreatePromoterId] = useState<number>(promoters[0]?.id || 0);
  const [createStatus, setCreateStatus] = useState<OrderStatus>('Draft');
  const [selectedAddressIds, setSelectedAddressIds] = useState<number[]>([]);
  const [selectedWorkTypeIds, setSelectedWorkTypeIds] = useState<number[]>([]);

  const promoterMap = useMemo(() => byId(promoters), [promoters]);
  const addressMap = useMemo(() => byId(addresses), [addresses]);
  const workTypeMap = useMemo(() => byId(workTypes), [workTypes]);

  useEffect(() => {
    if (createPromoterId) return;
    if (promoters.length) {
      setCreatePromoterId(promoters[0].id);
    }
  }, [createPromoterId, promoters]);

  useEffect(() => {
    if (selectedWorkTypeIds.length > 0) return;
    if (workTypes.length) {
      setSelectedWorkTypeIds([workTypes[0].id]);
    }
  }, [selectedWorkTypeIds.length, workTypes]);

  const filteredOrders = useMemo(() => {
    const tabStatuses = ORDER_TABS.find((tab) => tab.key === activeTab)?.statuses || [];
    const normalized = query.trim().toLowerCase();

    return orders
      .filter((order) => tabStatuses.includes(normalizeOrderStatus(order.status)))
      .filter((order) => {
        if (!normalized) return true;
        return `${order.id} ${order.title}`.toLowerCase().includes(normalized);
      });
  }, [activeTab, orders, query]);

  const groupedOrders = useMemo(() => {
    const map = new Map<string, ApiOrder[]>();
    filteredOrders.forEach((order) => {
      const section = orderSectionLabel(normalizeOrderStatus(order.status));
      const chunk = map.get(section) || [];
      chunk.push(order);
      map.set(section, chunk);
    });
    return Array.from(map.entries());
  }, [filteredOrders]);

  const selectedOrder = selectedOrderId ? orders.find((order) => order.id === selectedOrderId) || null : null;
  const selectedDetail = selectedOrderId ? orderDetails[selectedOrderId] : undefined;
  const selectedPhotos = selectedOrderId ? orderPhotos[selectedOrderId] : undefined;

  const selectedPromoter = selectedOrder?.promoter_id ? promoterMap.get(selectedOrder.promoter_id) || null : null;

  const detailAddresses = useMemo(() => {
    if (!selectedDetail?.items?.length) {
      return [] as ApiAddress[];
    }
    return selectedDetail.items
      .map((item) => addressMap.get(item.address_id) || null)
      .filter((item): item is ApiAddress => Boolean(item));
  }, [addressMap, selectedDetail]);

  const detailTypes = useMemo(() => {
    if (!selectedDetail?.items?.length) {
      return [] as ApiWorkType[];
    }
    const ids = new Set<number>();
    selectedDetail.items.forEach((item) => item.work_type_ids.forEach((id) => ids.add(id)));
    return Array.from(ids)
      .map((id) => workTypeMap.get(id) || null)
      .filter((item): item is ApiWorkType => Boolean(item));
  }, [selectedDetail, workTypeMap]);

  const selectableAddresses = useMemo(() => {
    const normalized = createAddressQuery.trim().toLowerCase();
    if (!normalized) return addresses;
    return addresses.filter((address) => buildAddressLabel(address).toLowerCase().includes(normalized));
  }, [addresses, createAddressQuery]);

  const openCreateModal = useCallback(() => {
    setCreateTitle(`Наряд #${Date.now().toString().slice(-4)}`);
    setCreateComment('');
    setCreateStatus('Draft');
    setCreatePromoterId(promoters[0]?.id || 0);
    setSelectedAddressIds([]);
    setSelectedWorkTypeIds(workTypes[0] ? [workTypes[0].id] : []);
    setCreateAddressQuery('');
    setCreateOpen(true);
  }, [promoters, workTypes]);

  const toggleAddress = useCallback((addressId: number) => {
    setSelectedAddressIds((prev) => (prev.includes(addressId) ? prev.filter((id) => id !== addressId) : [...prev, addressId]));
  }, []);

  const toggleWorkType = useCallback((workTypeId: number) => {
    setSelectedWorkTypeIds((prev) => (prev.includes(workTypeId) ? prev.filter((id) => id !== workTypeId) : [...prev, workTypeId]));
  }, []);

  const submitCreateOrder = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!createTitle.trim() || !createPromoterId || selectedAddressIds.length === 0 || selectedWorkTypeIds.length === 0) {
        return;
      }

      const payload: OrderCreatePayload = {
        title: createTitle.trim(),
        promoter_id: createPromoterId,
        comment: createComment.trim() || null,
        deadline_at: null,
        status: createStatus,
        items: selectedAddressIds.map((addressId) => ({
          address_id: addressId,
          work_type_ids: selectedWorkTypeIds,
          comment: null,
        })),
      };

      setCreateBusy(true);
      try {
        const createdId = await onCreateOrder(payload);
        onSelectOrder(createdId);
        setCreateOpen(false);
      } finally {
        setCreateBusy(false);
      }
    },
    [createComment, createPromoterId, createStatus, createTitle, onCreateOrder, onSelectOrder, selectedAddressIds, selectedWorkTypeIds],
  );

  return (
    <div className="split-layout triple">
      <section className="panel list-panel">
        <div className="section-header">
          <h2>Наряды</h2>
          <button className="ghost-link" type="button" onClick={openCreateModal}>
            <AddRounded fontSize="small" />
            Создать
          </button>
        </div>

        <SearchInput value={query} onChange={setQuery} placeholder="Поиск по списку" />

        <div className="control-row">
          <span>Ваши наряды</span>
          <div className="control-buttons">
            <button className="icon-btn" type="button"><TuneRounded fontSize="small" /></button>
            <button className="icon-btn" type="button"><SwapVertRounded fontSize="small" /></button>
            <button className="icon-btn" type="button"><SortRounded fontSize="small" /></button>
          </div>
        </div>

        <div className="tabs-row">
          {ORDER_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="scroll-area">
          {groupedOrders.map(([section, sectionOrders]) => (
            <div key={section}>
              <h4>{section.toUpperCase()}</h4>
              {sectionOrders.map((order, index) => {
                const promoter = order.promoter_id ? promoterMap.get(order.promoter_id) || null : null;
                const currentStatus = normalizeOrderStatus(order.status);
                return (
                  <div
                    key={order.id}
                    className={`order-row reveal ${selectedOrderId === order.id ? 'selected' : ''}`}
                    style={{ animationDelay: `${index * 25}ms` }}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectOrder(order.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectOrder(order.id);
                      }
                    }}
                  >
                    <strong>#{order.id}</strong>
                    <div className="avatar xsmall">{initials(promoter?.full_name || order.title)}</div>
                    <span>{promoter?.full_name || order.title}</span>
                    <div className="status-select-wrap" onClick={(event) => event.stopPropagation()} role="presentation">
                      <select
                        className={`status-select ${statusClass(currentStatus)}`}
                        value={currentStatus}
                        onChange={(event) => void onSetStatus(order.id, event.target.value as OrderStatus)}
                      >
                        {ORDER_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <KeyboardArrowDownRounded fontSize="small" />
                  </div>
                );
              })}
            </div>
          ))}

          {!groupedOrders.length ? <div className="empty-text">Нет нарядов по выбранному фильтру</div> : null}
        </div>
      </section>

      <section className="panel detail-panel hide-on-mobile">
        <div className="section-header">
          <h2>{selectedOrder ? `#${selectedOrder.id}` : 'Наряд'}</h2>
          <div className="header-actions">
            <span className={`status-pill ${statusClass(selectedOrder?.status || 'Draft')}`}>{statusLabel(selectedOrder?.status || 'Draft')}</span>
            {selectedOrder && (
              <button
                className="icon-btn"
                type="button"
                onClick={() => void onDeleteOrder(selectedOrder.id)}
                title="Удалить наряд"
              >
                <DeleteOutlineRounded fontSize="small" />
              </button>
            )}
            <button className="icon-btn" type="button"><CloseRounded fontSize="small" /></button>
          </div>
        </div>

        {selectedOrder ? (
          <>
            <div className="person-header">
              <div className="avatar small">{initials(selectedPromoter?.full_name || selectedOrder.title)}</div>
              <div>
                <strong>{selectedPromoter?.full_name || 'Исполнитель не назначен'}</strong>
                <p>@{selectedPromoter?.username || 'no-username'}</p>
              </div>
              <span className={`status-pill ${statusClass(selectedOrder.status)}`}>{statusLabel(selectedOrder.status)}</span>
            </div>

            <div className="subsection-title">Что нужно сделать</div>
            <div className="chip-row">
              {detailTypes.map((workType) => (
                <span key={workType.id} className="mini-chip active">
                  {workType.name}
                </span>
              ))}
              {!detailTypes.length ? <span className="mini-chip">Нет типов работ</span> : null}
            </div>

            <div className="subsection-title">Какие адреса надо посетить</div>
            {detailsLoading ? <div className="small-text">Загрузка деталей...</div> : null}
            <div className="address-edit-list">
              {detailAddresses.map((address) => (
                <div key={address.id} className="address-edit-row">
                  <strong>ул. {address.street}, {address.building}</strong>
                  <span className="small-text">id {address.id}</span>
                </div>
              ))}
              {!detailAddresses.length && !detailsLoading ? <div className="empty-text">У наряда нет адресов</div> : null}
            </div>

            <div className="subsection-title">Фото по наряду</div>
            {photosLoading ? <div className="small-text">Загрузка фото...</div> : null}
            <div className="photo-grid">
              {selectedPhotos?.map((photo) => (
                <article key={photo.id} className="photo-card">
                  {photo.previewUrl ? (
                    <img className="photo-image" src={photo.previewUrl} alt={`Фото ${photo.id}`} />
                  ) : (
                    <div className="placeholder-image">Нет превью</div>
                  )}

                  <div className="photo-meta">
                    <strong>#{photo.id}</strong>
                    <span className={`status-pill ${photo.status === 'accepted' ? 'is-completed' : photo.status === 'rejected' ? 'is-assigned' : 'is-review'}`}>
                      {photo.status === 'accepted' ? 'Принято' : photo.status === 'rejected' ? 'Отклонено' : 'На проверке'}
                    </span>
                  </div>

                  {photo.reject_reason ? <div className="small-text">Причина: {photo.reject_reason}</div> : null}

                  <div className="photo-actions">
                    <button className="success-btn" type="button" onClick={() => void onReviewPhoto(photo.id, 'accepted')}>
                      Принять
                    </button>
                    <button
                      className="danger-btn"
                      type="button"
                      onClick={() => {
                        const reason = window.prompt('Причина отклонения (необязательно):', photo.reject_reason || '');
                        if (reason === null) return;
                        void onReviewPhoto(photo.id, 'rejected', reason || undefined);
                      }}
                    >
                      Отклонить
                    </button>
                  </div>
                </article>
              ))}

              {!selectedPhotos?.length && !photosLoading ? <div className="empty-text">Фото не загружены</div> : null}
            </div>
          </>
        ) : (
          <div className="empty-text">Выберите наряд из списка</div>
        )}
      </section>

      <section className="panel map-panel hide-on-mobile">
        <MapSurface markers={mapMarkers} activeDock="orders" />
      </section>

      <ModalShell open={createOpen} title="Создать наряд" onClose={() => setCreateOpen(false)} wide>
        <form className="stack" onSubmit={submitCreateOrder}>
          <div className="field-row">
            <label className="field">
              <span>Название *</span>
              <input value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} required />
            </label>
            <label className="field">
              <span>Исполнитель *</span>
              <select
                value={createPromoterId}
                onChange={(event) => setCreatePromoterId(Number.parseInt(event.target.value, 10))}
                required
              >
                {promoters.map((promoter) => (
                  <option key={promoter.id} value={promoter.id}>
                    {promoter.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Статус</span>
              <select value={createStatus} onChange={(event) => setCreateStatus(event.target.value as OrderStatus)}>
                {ORDER_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Комментарий</span>
              <input value={createComment} onChange={(event) => setCreateComment(event.target.value)} />
            </label>
          </div>

          <div className="split-two">
            <div>
              <div className="field">
                <span>Адреса *</span>
                <SearchInput value={createAddressQuery} onChange={setCreateAddressQuery} placeholder="Фильтр адресов" />
              </div>
              <div className="list-picker">
                {selectableAddresses.map((address) => (
                  <label key={address.id} className="check-item">
                    <input
                      type="checkbox"
                      checked={selectedAddressIds.includes(address.id)}
                      onChange={() => toggleAddress(address.id)}
                    />
                    <span>{buildAddressLabel(address)}</span>
                  </label>
                ))}
                {!selectableAddresses.length ? <div className="empty-text">Адреса не найдены</div> : null}
              </div>
            </div>

            <div>
              <div className="field">
                <span>Типы работ *</span>
              </div>
              <div className="list-picker">
                {workTypes.map((workType) => (
                  <label key={workType.id} className="check-item">
                    <input
                      type="checkbox"
                      checked={selectedWorkTypeIds.includes(workType.id)}
                      onChange={() => toggleWorkType(workType.id)}
                    />
                    <span>
                      {workType.name} • {formatMoney(Number(workType.price_per_unit))} ₽
                    </span>
                  </label>
                ))}
                {!workTypes.length ? <div className="empty-text">Нет типов работ</div> : null}
              </div>
            </div>
          </div>

          <div className="small-text">
            Выбрано адресов: <b>{selectedAddressIds.length}</b> • типов работ: <b>{selectedWorkTypeIds.length}</b>
          </div>

          <div className="modal-actions">
            <button className="secondary-btn" type="button" onClick={() => setCreateOpen(false)}>
              Отмена
            </button>
            <button
              className="primary-btn"
              type="submit"
              disabled={
                createBusy || !createTitle.trim() || !createPromoterId || selectedAddressIds.length === 0 || selectedWorkTypeIds.length === 0
              }
            >
              {createBusy ? 'Создаем...' : 'Создать наряд'}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
