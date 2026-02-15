import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CloseRounded from '@mui/icons-material/CloseRounded';

import '../styles.css';
import { api } from '../lib/api';
import { MENU_ITEMS, ORDER_STATUS_META } from './constants';
import { LoginScreen, Sidebar } from './components/common';
import {
  fallbackCoords,
  getErrorMessage,
  isAxiosStatus,
  normalizeOrderStatus,
} from './utils';
import { AddressesView } from './views/AddressesView';
import { AnalyticsView } from './views/AnalyticsView';
import { EmployeesView } from './views/EmployeesView';
import { GuidesView } from './views/GuidesView';
import { OrdersView } from './views/OrdersView';
import { TypesView } from './views/TypesView';
import type {
  AddressCreatePayload,
  ApiAddress,
  ApiOrder,
  ApiOrderDetail,
  ApiPhoto,
  ApiPayout,
  ApiUser,
  ApiWorkType,
  Marker,
  MarkerTone,
  MenuKey,
  Notice,
  NoticeType,
  OrderCreatePayload,
  OrderStatus,
  PhotoPreview,
  PhotoReviewStatus,
  WorkTypeCreatePayload,
} from './types';

export function AdminApp(): React.JSX.Element {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [menu, setMenu] = useState<MenuKey>('analytics');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [me, setMe] = useState<ApiUser | null>(null);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [addresses, setAddresses] = useState<ApiAddress[]>([]);
  const [promoters, setPromoters] = useState<ApiUser[]>([]);
  const [workTypes, setWorkTypes] = useState<ApiWorkType[]>([]);
  const [payouts, setPayouts] = useState<ApiPayout[]>([]);

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedPromoterId, setSelectedPromoterId] = useState<number | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState<Record<number, ApiOrderDetail | undefined>>({});
  const [orderPhotos, setOrderPhotos] = useState<Record<number, PhotoPreview[] | undefined>>({});

  const previewUrlsRef = useRef<Record<number, string[]>>({});

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const pushNotice = useCallback((type: NoticeType, text: string) => {
    setNotice({ type, text });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('token');
    setToken('');
  }, []);

  const revokePreviews = useCallback((orderId: number) => {
    const urls = previewUrlsRef.current[orderId] || [];
    urls.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current[orderId] = [];
  }, []);

  const revokeAllPreviews = useCallback(() => {
    Object.values(previewUrlsRef.current)
      .flat()
      .forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = {};
  }, []);

  useEffect(() => {
    return revokeAllPreviews;
  }, [revokeAllPreviews]);

  const loadData = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);

      try {
        const meResponse = await api.get<ApiUser>('/users/me', { headers });

        const [ordersData, addressesData, promotersData, workTypesData, payoutsData] = await Promise.all([
          api.get<ApiOrder[]>('/orders', { headers }).then((response) => response.data),
          api.get<ApiAddress[]>('/addresses', { headers }).then((response) => response.data),
          api
            .get<ApiUser[]>('/users/promoters', { headers })
            .then((response) => response.data)
            .catch((error: unknown) => {
              if (isAxiosStatus(error, [403])) return [] as ApiUser[];
              throw error;
            }),
          api.get<ApiWorkType[]>('/work-types', { headers }).then((response) => response.data),
          api
            .get<ApiPayout[]>('/payouts', { headers })
            .then((response) => response.data)
            .catch((error: unknown) => {
              if (isAxiosStatus(error, [403])) return [] as ApiPayout[];
              throw error;
            }),
        ]);

        setMe(meResponse.data);
        setOrders(ordersData);
        setAddresses(addressesData);
        setPromoters(promotersData);
        setWorkTypes(workTypesData);
        setPayouts(payoutsData);

        setSelectedOrderId((current) => {
          if (current && ordersData.some((order) => order.id === current)) {
            return current;
          }
          return ordersData[0]?.id || null;
        });

        setSelectedPromoterId((current) => {
          if (current && promotersData.some((promoter) => promoter.id === current)) {
            return current;
          }
          return promotersData[0]?.id || null;
        });
      } catch (error: unknown) {
        if (isAxiosStatus(error, [401])) {
          clearAuth();
          return;
        }
        pushNotice('error', getErrorMessage(error, 'Не удалось загрузить данные.'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [clearAuth, headers, pushNotice, token],
  );

  const loadOrderExtras = useCallback(
    async (orderId: number) => {
      if (!token) return;

      setDetailsLoading(true);
      setPhotosLoading(true);
      try {
        const detailPromise = api.get<ApiOrderDetail>(`/orders/${orderId}`, { headers });
        const photosPromise = api.get<ApiPhoto[]>(`/photos/order/${orderId}`, { headers });

        const [detailResponse, photosResponse] = await Promise.all([detailPromise, photosPromise]);

        setOrderDetails((prev) => ({ ...prev, [orderId]: detailResponse.data }));

        revokePreviews(orderId);

        const previews = await Promise.all(
          photosResponse.data.map(async (photo): Promise<PhotoPreview> => {
            try {
              const fileResponse = await api.get<Blob>(photo.url, { headers, responseType: 'blob' });
              const previewUrl = URL.createObjectURL(fileResponse.data);
              return { ...photo, previewUrl };
            } catch {
              return { ...photo, previewUrl: null };
            }
          }),
        );

        previewUrlsRef.current[orderId] = previews.map((photo) => photo.previewUrl).filter((value): value is string => Boolean(value));
        setOrderPhotos((prev) => ({ ...prev, [orderId]: previews }));
      } catch {
        setOrderDetails((prev) => ({ ...prev, [orderId]: undefined }));
        setOrderPhotos((prev) => ({ ...prev, [orderId]: [] }));
      } finally {
        setDetailsLoading(false);
        setPhotosLoading(false);
      }
    },
    [headers, revokePreviews, token],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedOrderId) return;
    void loadOrderExtras(selectedOrderId);
  }, [loadOrderExtras, selectedOrderId]);

  const createAddress = useCallback(
    async (payload: AddressCreatePayload) => {
      try {
        await api.post('/addresses', payload, { headers });
        pushNotice('ok', 'Адрес добавлен.');
        await loadData(true);
      } catch (error: unknown) {
        pushNotice('error', getErrorMessage(error, 'Не удалось создать адрес.'));
        throw error;
      }
    },
    [headers, loadData, pushNotice],
  );

  const importCsv = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const { data } = await api.post<{ imported: number }>('/addresses/import-csv', formData, { headers });
        pushNotice('ok', `Импортировано строк: ${data.imported}`);
        await loadData(true);
        return data.imported;
      } catch (error: unknown) {
        pushNotice('error', getErrorMessage(error, 'Не удалось импортировать CSV.'));
        throw error;
      }
    },
    [headers, loadData, pushNotice],
  );

  const createOrder = useCallback(
    async (payload: OrderCreatePayload) => {
      try {
        const { data } = await api.post<{ id: number }>('/orders', payload, { headers });
        pushNotice('ok', `Наряд #${data.id} создан.`);
        await loadData(true);
        return data.id;
      } catch (error: unknown) {
        pushNotice('error', getErrorMessage(error, 'Не удалось создать наряд.'));
        throw error;
      }
    },
    [headers, loadData, pushNotice],
  );

  const setOrderStatus = useCallback(
    async (orderId: number, status: OrderStatus) => {
      try {
        await api.patch(`/orders/${orderId}/status`, { status }, { headers });
        setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status } : order)));
        pushNotice('ok', `Статус наряда #${orderId} обновлен.`);
        if (selectedOrderId === orderId) {
          await loadOrderExtras(orderId);
        }
        await loadData(true);
      } catch (error: unknown) {
        pushNotice('error', getErrorMessage(error, 'Не удалось обновить статус.'));
      }
    },
    [headers, loadData, loadOrderExtras, pushNotice, selectedOrderId],
  );

  const reviewPhoto = useCallback(
    async (photoId: number, status: PhotoReviewStatus, reason?: string) => {
      try {
        await api.patch(
          `/photos/${photoId}/review`,
          { status, reject_reason: reason || null },
          { headers },
        );
        pushNotice('ok', status === 'accepted' ? 'Фото принято.' : 'Фото отклонено.');
        if (selectedOrderId) {
          await loadOrderExtras(selectedOrderId);
        }
      } catch (error: unknown) {
        pushNotice('error', getErrorMessage(error, 'Не удалось отправить ревью фото.'));
      }
    },
    [headers, loadOrderExtras, pushNotice, selectedOrderId],
  );

  const savePromoter = useCallback(
    async (promoterId: number, payload: { is_ready: boolean; suspicious_note: string | null }) => {
      try {
        const { data } = await api.patch<ApiUser>(`/users/promoters/${promoterId}/availability`, payload, { headers });
        setPromoters((prev) => prev.map((promoter) => (promoter.id === promoterId ? data : promoter)));
        pushNotice('ok', 'Профиль исполнителя обновлен.');
      } catch (error: unknown) {
        pushNotice('error', getErrorMessage(error, 'Не удалось обновить исполнителя.'));
        throw error;
      }
    },
    [headers, pushNotice],
  );

  const createWorkType = useCallback(
    async (payload: WorkTypeCreatePayload) => {
      try {
        await api.post('/work-types', payload, { headers });
        pushNotice('ok', 'Тип работы добавлен.');
        await loadData(true);
      } catch (error: unknown) {
        pushNotice('error', getErrorMessage(error, 'Не удалось добавить тип работы.'));
        throw error;
      }
    },
    [headers, loadData, pushNotice],
  );

  const deleteAddress = useCallback(
    async (addressId: number) => {
      if (!window.confirm('Удалить этот адрес?')) {
        return;
      }
      try {
        await api.delete(`/addresses/${addressId}`, { headers });
        pushNotice('ok', 'Адрес удалён.');
        await loadData(true);
      } catch (error: unknown) {
        pushNotice('error', getErrorMessage(error, 'Не удалось удалить адрес.'));
      }
    },
    [headers, loadData, pushNotice],
  );

  const deleteOrder = useCallback(
    async (orderId: number) => {
      if (!window.confirm('Удалить этот наряд? Это действие необратимо.')) {
        return;
      }
      try {
        await api.delete(`/orders/${orderId}`, { headers });
        pushNotice('ok', 'Наряд удалён.');
        setSelectedOrderId(null);
        await loadData(true);
      } catch (error: unknown) {
        pushNotice('error', getErrorMessage(error, 'Не удалось удалить наряд.'));
      }
    },
    [headers, loadData, pushNotice],
  );

  const deleteWorkType = useCallback(
    async (workTypeId: number) => {
      if (!window.confirm('Удалить этот тип работы?')) {
        return;
      }
      try {
        await api.delete(`/work-types/${workTypeId}`, { headers });
        pushNotice('ok', 'Тип работы удалён.');
        await loadData(true);
      } catch (error: unknown) {
        pushNotice('error', getErrorMessage(error, 'Не удалось удалить тип работы.'));
      }
    },
    [headers, loadData, pushNotice],
  );

  const mapMarkers = useMemo<Marker[]>(() => {
    const addressWithCoords = addresses.filter(
      (address) =>
        typeof address.lat === 'number' &&
        Number.isFinite(address.lat) &&
        typeof address.lng === 'number' &&
        Number.isFinite(address.lng),
    );

    if (!orders.length) {
      return addresses.slice(0, 12).map((address, index) => ({
        id: `a-${address.id}`,
        label: `#${address.id}`,
        tone: (['blue', 'green', 'yellow'] as MarkerTone[])[index % 3],
        ...(addressWithCoords[index]
          ? { lat: addressWithCoords[index].lat as number, lng: addressWithCoords[index].lng as number }
          : fallbackCoords(address.id + index)),
      }));
    }

    return orders.slice(0, 12).map((order, index) => {
      const normalized = normalizeOrderStatus(order.status);
      const address = addressWithCoords[index % (addressWithCoords.length || 1)];
      const coords = address
        ? { lat: address.lat as number, lng: address.lng as number }
        : fallbackCoords(order.id + index);
      return {
        id: `o-${order.id}`,
        label: `#${order.id}`,
        tone: ORDER_STATUS_META[normalized].tone,
        ...coords,
      };
    });
  }, [addresses, orders]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken('');
  }, []);

  if (!token) {
    return <LoginScreen onToken={setToken} />;
  }

  return (
    <div className="admin-root">
      <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar active={menu} onMenu={setMenu} me={me} onLogout={logout} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)} />

        <main className="workspace">
          {loading ? <div className="loading-line" /> : null}

          {menu === 'analytics' ? (
            <AnalyticsView
              me={me}
              orders={orders}
              addresses={addresses}
              promoters={promoters}
              payouts={payouts}
              onCreateOrder={() => setMenu('orders')}
              mapMarkers={mapMarkers}
            />
          ) : null}

          {menu === 'addresses' ? (
            <AddressesView
              addresses={addresses}
              mapMarkers={mapMarkers}
              onCreateAddress={createAddress}
              onImportCsv={importCsv}
              onDeleteAddress={deleteAddress}
            />
          ) : null}

          {menu === 'orders' ? (
            <OrdersView
              orders={orders}
              addresses={addresses}
              promoters={promoters}
              workTypes={workTypes}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
              orderDetails={orderDetails}
              orderPhotos={orderPhotos}
              detailsLoading={detailsLoading}
              photosLoading={photosLoading}
              onCreateOrder={createOrder}
              onSetStatus={setOrderStatus}
              onReviewPhoto={reviewPhoto}
              onDeleteOrder={deleteOrder}
              mapMarkers={mapMarkers}
            />
          ) : null}

          {menu === 'employees' ? (
            <EmployeesView
              promoters={promoters}
              orders={orders}
              payouts={payouts}
              selectedPromoterId={selectedPromoterId}
              onSelectPromoter={setSelectedPromoterId}
              onSavePromoter={savePromoter}
              mapMarkers={mapMarkers}
            />
          ) : null}

          {menu === 'types' ? <TypesView workTypes={workTypes} onCreateWorkType={createWorkType} onDeleteWorkType={deleteWorkType} /> : null}
          {menu === 'guides' ? <GuidesView /> : null}
        </main>
      </div>

      <nav className="mobile-dock">
        {MENU_ITEMS.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.key} type="button" className={menu === item.key ? 'active' : ''} onClick={() => setMenu(item.key)}>
              <Icon fontSize="small" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {notice ? (
        <div className={`notice ${notice.type}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)}>
            <CloseRounded fontSize="small" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
