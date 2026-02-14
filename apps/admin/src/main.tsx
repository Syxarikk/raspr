import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import AddRounded from '@mui/icons-material/AddRounded';
import ApartmentOutlined from '@mui/icons-material/ApartmentOutlined';
import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded';
import CampaignOutlined from '@mui/icons-material/CampaignOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DashboardRounded from '@mui/icons-material/DashboardRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import FileUploadOutlined from '@mui/icons-material/FileUploadOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import PeopleOutlineRounded from '@mui/icons-material/PeopleOutlineRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import SortRounded from '@mui/icons-material/SortRounded';
import SwapVertRounded from '@mui/icons-material/SwapVertRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import { latLngBounds } from 'leaflet';
import type { SvgIconProps } from '@mui/material';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:51555' });

type MenuKey = 'analytics' | 'addresses' | 'orders' | 'employees' | 'types' | 'guides';
type MarkerTone = 'blue' | 'green' | 'yellow';
type OrderStatus = 'Draft' | 'Assigned' | 'InProgress' | 'Review' | 'Payment' | 'Completed';
type OrderTabKey = 'todo' | 'waiting' | 'draft' | 'archive';
type NoticeType = 'ok' | 'error';
type PhotoReviewStatus = 'accepted' | 'rejected';

type IconComponent = React.ComponentType<SvgIconProps>;

interface ApiOrder {
  id: number;
  title: string;
  status: string;
  promoter_id: number | null;
  deadline_at: string | null;
  comment: string | null;
}

interface ApiOrderDetail {
  id: number;
  title: string;
  status: string;
  promoter_id: number | null;
  items: Array<{
    id: number;
    address_id: number;
    work_type_ids: number[];
    comment: string | null;
  }>;
}

interface ApiAddress {
  id: number;
  district: string | null;
  street: string;
  building: string;
  lat: number | null;
  lng: number | null;
  comment: string | null;
}

interface ApiUser {
  id: number;
  full_name: string;
  role: 'operator' | 'promoter';
  username: string | null;
  phone: string | null;
  is_ready: boolean;
  suspicious_note: string | null;
}

interface ApiWorkType {
  id: number;
  name: string;
  price_per_unit: number;
  is_active: boolean;
}

interface ApiPayout {
  order_id: number;
  amount_preliminary: number | string;
  amount_final: number | string;
  status: 'on_review' | 'to_pay' | 'paid';
}

interface ApiPhoto {
  id: number;
  order_item_id: number;
  work_type_id: number;
  status: 'pending' | 'accepted' | 'rejected';
  reject_reason: string | null;
  url: string;
}

interface PhotoPreview extends ApiPhoto {
  previewUrl: string | null;
}

interface Marker {
  id: string;
  label: string;
  tone: MarkerTone;
  lat: number;
  lng: number;
}

interface StreetGroup {
  district: string;
  street: string;
  addresses: ApiAddress[];
}

interface MenuItem {
  key: MenuKey;
  label: string;
  icon: IconComponent;
}

interface Notice {
  type: NoticeType;
  text: string;
}

interface AddressCreatePayload {
  district?: string | null;
  street: string;
  building: string;
  lat?: number | null;
  lng?: number | null;
  comment?: string | null;
}

interface OrderCreatePayload {
  title: string;
  promoter_id: number;
  comment: string | null;
  deadline_at: string | null;
  status: OrderStatus;
  items: Array<{
    address_id: number;
    work_type_ids: number[];
    comment: string | null;
  }>;
}

interface WorkTypeCreatePayload {
  name: string;
  price_per_unit: number;
  is_active: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'analytics', label: 'Аналитика', icon: DashboardRounded },
  { key: 'addresses', label: 'Адреса', icon: LocationOnOutlined },
  { key: 'orders', label: 'Наряды', icon: DescriptionOutlined },
  { key: 'employees', label: 'Исполнители', icon: GroupsOutlined },
  { key: 'types', label: 'Типы рекламы', icon: CampaignOutlined },
  { key: 'guides', label: 'Гайды', icon: MenuBookOutlined },
];

const ORDER_STATUS_META: Record<OrderStatus, { label: string; className: string; tone: MarkerTone }> = {
  Draft: { label: 'Черновик', className: 'is-draft', tone: 'blue' },
  Assigned: { label: 'Назначен', className: 'is-assigned', tone: 'yellow' },
  InProgress: { label: 'В работе', className: 'is-progress', tone: 'blue' },
  Review: { label: 'Проверка', className: 'is-review', tone: 'yellow' },
  Payment: { label: 'К оплате', className: 'is-payment', tone: 'green' },
  Completed: { label: 'Архив', className: 'is-completed', tone: 'green' },
};

const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'Draft', label: 'Черновик' },
  { value: 'Assigned', label: 'Назначен' },
  { value: 'InProgress', label: 'В работе' },
  { value: 'Review', label: 'Проверка' },
  { value: 'Payment', label: 'К оплате' },
  { value: 'Completed', label: 'Архив' },
];

const ORDER_TABS: Array<{ key: OrderTabKey; label: string; statuses: OrderStatus[] }> = [
  { key: 'todo', label: 'Сделать', statuses: ['InProgress', 'Review'] },
  { key: 'waiting', label: 'Ожидаем', statuses: ['Assigned', 'Payment'] },
  { key: 'draft', label: 'Черновик', statuses: ['Draft'] },
  { key: 'archive', label: 'Архив', statuses: ['Completed'] },
];

function normalizeOrderStatus(status: string): OrderStatus {
  if (status in ORDER_STATUS_META) {
    return status as OrderStatus;
  }
  return 'Draft';
}

function parseAmount(value: number | string): number {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
}

function initials(name: string): string {
  const chunks = name.trim().split(/\s+/).filter(Boolean);
  if (!chunks.length) {
    return 'U';
  }
  if (chunks.length === 1) {
    return chunks[0].slice(0, 1).toUpperCase();
  }
  return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
}

function byId<T extends { id: number }>(items: T[]): Map<number, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function randomSpread(seed: number): number {
  const raw = Math.sin(seed * 12.9898) * 43758.5453;
  return raw - Math.floor(raw);
}

const PODOLSK_CENTER: [number, number] = [55.4297, 37.5443];

function fallbackCoords(seed: number): { lat: number; lng: number } {
  const lat = PODOLSK_CENTER[0] + (randomSpread(seed + 1.7) - 0.5) * 0.08;
  const lng = PODOLSK_CENTER[1] + (randomSpread(seed + 5.9) - 0.5) * 0.16;
  return { lat, lng };
}

function statusClass(status: string): string {
  const normalized = normalizeOrderStatus(status);
  return ORDER_STATUS_META[normalized].className;
}

function statusLabel(status: string): string {
  const normalized = normalizeOrderStatus(status);
  return ORDER_STATUS_META[normalized].label;
}

function orderSectionLabel(status: OrderStatus): string {
  if (status === 'InProgress') return 'В работе';
  if (status === 'Review') return 'Ждут проверки';
  if (status === 'Payment') return 'Ждут оплаты';
  if (status === 'Assigned') return 'Назначено';
  if (status === 'Completed') return 'Закрытые';
  return 'Черновики';
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
  }
  return fallback;
}

function isAxiosStatus(error: unknown, statuses: number[]): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }
  const status = error.response?.status;
  return typeof status === 'number' && statuses.includes(status);
}

function buildAddressLabel(address: ApiAddress): string {
  return `${address.street}, ${address.building}`;
}

function pickFirst<T>(items: T[]): T | null {
  return items.length ? items[0] : null;
}

function markerToneColor(tone: MarkerTone): string {
  if (tone === 'green') return '#43bc78';
  if (tone === 'yellow') return '#e5b637';
  return '#4c9cff';
}

function MapAutoFocus({ markers }: { markers: Marker[] }): null {
  const map = useMap();

  useEffect(() => {
    if (!markers.length) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 14);
      return;
    }

    const bounds = latLngBounds(markers.map((marker) => [marker.lat, marker.lng]));
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
  }, [map, markers]);

  return null;
}

function LoginScreen({ onToken }: { onToken: (token: string) => void }): React.JSX.Element {
  const [username, setUsername] = useState('operator');
  const [password, setPassword] = useState('operator123');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const { data } = await api.post<{ access_token: string }>('/auth/login', { username, password });
        localStorage.setItem('token', data.access_token);
        onToken(data.access_token);
      } catch {
        setError('Неверный логин или пароль');
      } finally {
        setSubmitting(false);
      }
    },
    [onToken, password, username],
  );

  return (
    <div className="auth-root">
      <div className="auth-shell">
        <div className="auth-brand">M</div>
        <h1>AdControl Admin</h1>
        <p>Войдите в систему оператора для управления нарядами и адресами.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Логин</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label>
            <span>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error ? <div className="auth-error">{error}</div> : null}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Sidebar({
  active,
  onMenu,
  me,
  onLogout,
}: {
  active: MenuKey;
  onMenu: (key: MenuKey) => void;
  me: ApiUser | null;
  onLogout: () => void;
}): React.JSX.Element {
  return (
    <aside className="sidebar">
      <div className="side-top">
        <div className="brand-mini">AdControl</div>
        <button className="circle-btn" type="button" aria-label="collapse menu">
          <ChevronLeftRounded fontSize="small" />
        </button>
      </div>

      <div className="workspace-badge">
        <div className="workspace-logo">M</div>
        <div className="workspace-name">Mknet Podolsk</div>
      </div>

      <div className="side-caption">MENU</div>
      <nav className="side-menu">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              className={`menu-item ${active === item.key ? 'active' : ''}`}
              type="button"
              onClick={() => onMenu(item.key)}
            >
              <Icon fontSize="small" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="side-account">
        <div className="user-chip">
          <div className="avatar">{initials(me?.full_name || 'User')}</div>
          <div>
            <div className="user-name">{me?.full_name || 'Operator'}</div>
            <div className="user-role">Marketing Manager</div>
          </div>
        </div>

        <div className="side-caption">YOUR ACCOUNT</div>

        <button className="menu-item" type="button">
          <SettingsOutlined fontSize="small" />
          <span>Settings</span>
        </button>

        <button className="menu-item" type="button" onClick={onLogout}>
          <LogoutRounded fontSize="small" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}): React.JSX.Element {
  return (
    <label className="search-input">
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <SearchRounded fontSize="small" />
    </label>
  );
}

function MapSurface({
  markers,
  activeDock,
  compact,
}: {
  markers: Marker[];
  activeDock: MenuKey;
  compact?: boolean;
}): React.JSX.Element {
  return (
    <div className={`map-surface ${compact ? 'compact' : ''}`}>
      <MapContainer center={PODOLSK_CENTER} zoom={12} className="map-canvas" zoomControl={!compact}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapAutoFocus markers={markers} />
        {markers.map((marker) => (
          <CircleMarker
            key={marker.id}
            center={[marker.lat, marker.lng]}
            radius={8}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: markerToneColor(marker.tone),
              fillOpacity: 1,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -10]} className={`map-tip tone-${marker.tone}`}>
              <span>{marker.label}</span>
              <i />
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="map-search">
        <span>Поиск по карте</span>
        <SearchRounded fontSize="small" />
      </div>

      <div className="map-user-dot">IP</div>
      <div className="map-point" />

      <div className="map-dock">
        <button className={`dock-btn ${activeDock === 'analytics' ? 'active' : ''}`} type="button">
          <CalendarMonthOutlined fontSize="small" />
        </button>
        <button className={`dock-btn ${activeDock === 'addresses' ? 'active' : ''}`} type="button">
          <ApartmentOutlined fontSize="small" />
        </button>
        <button className={`dock-btn ${activeDock === 'orders' ? 'active' : ''}`} type="button">
          <ChatBubbleOutlineRounded fontSize="small" />
        </button>
        <button className={`dock-btn ${activeDock === 'employees' ? 'active' : ''}`} type="button">
          <PeopleOutlineRounded fontSize="small" />
        </button>
      </div>
    </div>
  );
}

function ModalShell({
  open,
  title,
  onClose,
  wide,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}): React.JSX.Element | null {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className={`modal-card ${wide ? 'wide' : ''}`} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" type="button" onClick={onClose}>
            <CloseRounded fontSize="small" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function AnalyticsView({
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

function AddressesView({
  addresses,
  mapMarkers,
  onCreateAddress,
  onImportCsv,
  onDeleteAddress,
}: {
  addresses: ApiAddress[];
  mapMarkers: Marker[];
  onCreateAddress: (payload: AddressCreatePayload) => Promise<void>;
  onImportCsv: (file: File) => Promise<number>;
  onDeleteAddress: (addressId: number) => Promise<void>;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [draft, setDraft] = useState({
    district: '',
    street: '',
    building: '',
    lat: '',
    lng: '',
    comment: '',
  });

  const groups = useMemo<StreetGroup[]>(() => {
    const map = new Map<string, StreetGroup>();

    addresses.forEach((address) => {
      const district = address.district || 'Без района';
      const key = `${district}::${address.street}`;
      const existing = map.get(key);
      if (existing) {
        existing.addresses.push(address);
      } else {
        map.set(key, { district, street: address.street, addresses: [address] });
      }
    });

    const prepared = Array.from(map.values());
    prepared.forEach((group) => group.addresses.sort((left, right) => left.building.localeCompare(right.building, 'ru')));
    prepared.sort((left, right) => {
      const districtDiff = left.district.localeCompare(right.district, 'ru');
      if (districtDiff !== 0) return districtDiff;
      return left.street.localeCompare(right.street, 'ru');
    });

    if (!query.trim()) {
      return prepared;
    }

    const normalized = query.trim().toLowerCase();
    return prepared
      .map((group) => ({
        ...group,
        addresses: group.addresses.filter(
          (address) =>
            address.street.toLowerCase().includes(normalized) ||
            address.building.toLowerCase().includes(normalized) ||
            (address.district || '').toLowerCase().includes(normalized),
        ),
      }))
      .filter((group) => group.addresses.length > 0);
  }, [addresses, query]);

  const submitAddress = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!draft.street.trim() || !draft.building.trim()) {
        return;
      }

      const lat = draft.lat.trim() ? Number.parseFloat(draft.lat) : null;
      const lng = draft.lng.trim() ? Number.parseFloat(draft.lng) : null;

      const payload: AddressCreatePayload = {
        district: draft.district.trim() || null,
        street: draft.street.trim(),
        building: draft.building.trim(),
        lat: Number.isFinite(lat ?? Number.NaN) ? lat : null,
        lng: Number.isFinite(lng ?? Number.NaN) ? lng : null,
        comment: draft.comment.trim() || null,
      };

      setCreateBusy(true);
      try {
        await onCreateAddress(payload);
        setCreateOpen(false);
        setDraft({ district: '', street: '', building: '', lat: '', lng: '', comment: '' });
      } finally {
        setCreateBusy(false);
      }
    },
    [draft, onCreateAddress],
  );

  const submitCsv = useCallback(async () => {
    if (!csvFile) {
      return;
    }
    setImportBusy(true);
    try {
      await onImportCsv(csvFile);
      setCsvFile(null);
    } finally {
      setImportBusy(false);
    }
  }, [csvFile, onImportCsv]);

  let lastDistrict = '';

  return (
    <div className="split-layout double">
      <section className="panel list-panel">
        <div className="section-header">
          <h2>Адреса</h2>
          <div className="inline-actions">
            <button className="ghost-link" type="button" onClick={() => setCreateOpen(true)}>
              <AddRounded fontSize="small" />
              Добавить
            </button>
          </div>
        </div>

        <SearchInput value={query} onChange={setQuery} placeholder="Поиск адреса по списку" />

        <div className="control-row">
          <span>Адреса в базе</span>
          <div className="control-buttons">
            <button className="icon-btn" type="button"><TuneRounded fontSize="small" /></button>
            <button className="icon-btn" type="button"><SwapVertRounded fontSize="small" /></button>
          </div>
        </div>

        <div className="upload-box">
          <label className="file-btn">
            <FileUploadOutlined fontSize="small" />
            Импорт CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
            />
          </label>
          <button className="secondary-btn" type="button" disabled={!csvFile || importBusy} onClick={() => void submitCsv()}>
            {importBusy ? 'Загрузка...' : 'Импортировать'}
          </button>
          {csvFile ? <span className="small-text">{csvFile.name}</span> : <span className="small-text">Файл не выбран</span>}
        </div>

        <div className="scroll-area">
          {groups.map((group) => {
            const districtHeader = lastDistrict !== group.district;
            lastDistrict = group.district;

            return (
              <div key={`${group.district}-${group.street}`} className="address-group reveal">
                {districtHeader ? <h4>{group.district.toUpperCase()}</h4> : null}

                <div className="address-line">
                  <strong>ул. {group.street}</strong>
                  <KeyboardArrowDownRounded fontSize="small" />
                </div>

                <div className="chip-row">
                  {group.addresses.slice(0, 16).map((address) => (
                    <span key={address.id} className="mini-chip" style={{position: 'relative', paddingRight: 28}}>
                      {address.building}
                      <button
                        className="icon-btn"
                        type="button"
                        style={{position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', padding: 2, minWidth: 20, height: 20}}
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDeleteAddress(address.id);
                        }}
                        title="Удалить адрес"
                      >
                        <DeleteOutlineRounded fontSize="inherit" style={{fontSize: 14}} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          {!groups.length ? <div className="empty-text">Адреса не найдены</div> : null}
        </div>
      </section>

      <section className="panel map-panel">
        <MapSurface markers={mapMarkers} activeDock="addresses" />
      </section>

      <ModalShell open={createOpen} title="Добавить адрес" onClose={() => setCreateOpen(false)}>
        <form onSubmit={submitAddress} className="stack">
          <div className="field-row">
            <label className="field">
              <span>Район</span>
              <input value={draft.district} onChange={(event) => setDraft((prev) => ({ ...prev, district: event.target.value }))} />
            </label>
            <label className="field">
              <span>Улица *</span>
              <input
                value={draft.street}
                onChange={(event) => setDraft((prev) => ({ ...prev, street: event.target.value }))}
                required
              />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Дом *</span>
              <input
                value={draft.building}
                onChange={(event) => setDraft((prev) => ({ ...prev, building: event.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>Комментарий</span>
              <input value={draft.comment} onChange={(event) => setDraft((prev) => ({ ...prev, comment: event.target.value }))} />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>lat</span>
              <input value={draft.lat} onChange={(event) => setDraft((prev) => ({ ...prev, lat: event.target.value }))} />
            </label>
            <label className="field">
              <span>lng</span>
              <input value={draft.lng} onChange={(event) => setDraft((prev) => ({ ...prev, lng: event.target.value }))} />
            </label>
          </div>

          <div className="modal-actions">
            <button className="secondary-btn" type="button" onClick={() => setCreateOpen(false)}>
              Отмена
            </button>
            <button className="primary-btn" type="submit" disabled={createBusy}>
              {createBusy ? 'Сохраняем...' : 'Создать адрес'}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}

function OrdersView({
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

function EmployeesView({
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

function TypesView({
  workTypes,
  onCreateWorkType,
  onDeleteWorkType,
}: {
  workTypes: ApiWorkType[];
  onCreateWorkType: (payload: WorkTypeCreatePayload) => Promise<void>;
  onDeleteWorkType: (workTypeId: number) => Promise<void>;
}): React.JSX.Element {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('10');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const parsed = Number.parseFloat(price);
      if (!name.trim() || !Number.isFinite(parsed)) {
        return;
      }
      setBusy(true);
      try {
        await onCreateWorkType({ name: name.trim(), price_per_unit: parsed, is_active: active });
        setName('');
        setPrice('10');
        setActive(true);
      } finally {
        setBusy(false);
      }
    },
    [active, name, onCreateWorkType, price],
  );

  return (
    <section className="types-view">
      <header className="page-header compact">
        <div>
          <h1>Типы рекламы</h1>
          <p>Управление стоимостью и активностью работ.</p>
        </div>
      </header>

      <form className="card inline-form" onSubmit={submit}>
        <label className="field">
          <span>Название *</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>

        <label className="field">
          <span>Цена за единицу *</span>
          <input value={price} onChange={(event) => setPrice(event.target.value)} required />
        </label>

        <label className="check-item">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          <span>Активный тип</span>
        </label>

        <button className="primary-btn" type="submit" disabled={busy}>
          <AddRounded fontSize="small" />
          {busy ? 'Создаем...' : 'Добавить'}
        </button>
      </form>

      <div className="types-grid">
        {workTypes.map((workType, index) => (
          <article key={workType.id} className="card type-card reveal" style={{ animationDelay: `${index * 40}ms`, position: 'relative' }}>
            <button
              className="icon-btn"
              type="button"
              style={{ position: 'absolute', top: 8, right: 8 }}
              onClick={() => void onDeleteWorkType(workType.id)}
              title="Удалить тип работы"
            >
              <DeleteOutlineRounded fontSize="small" />
            </button>
            <h3>{workType.name}</h3>
            <strong>{formatMoney(Number(workType.price_per_unit))} ₽</strong>
            <span className={`status-pill ${workType.is_active ? 'is-progress' : 'is-draft'}`}>
              {workType.is_active ? 'Активен' : 'Отключен'}
            </span>
          </article>
        ))}

        {!workTypes.length ? <div className="empty-text">Типы работ отсутствуют</div> : null}
      </div>
    </section>
  );
}

function GuidesView(): React.JSX.Element {
  return (
    <section className="guides-view">
      <h1>Гайды</h1>
      <p>Скоро здесь появятся инструкции для команды.</p>

      <div className="guide-cards">
        <article className="card reveal">
          <h3>Проверка фото</h3>
          <p>Как быстро ревьюить отчет исполнителя и отклонять неверные точки.</p>
          <button className="ghost-link" type="button">
            Открыть
            <ArrowOutwardRounded fontSize="small" />
          </button>
        </article>

        <article className="card reveal">
          <h3>Работа с адресами</h3>
          <p>Правила импорта CSV и структуры районов для чистой базы.</p>
          <button className="ghost-link" type="button">
            Открыть
            <ArrowOutwardRounded fontSize="small" />
          </button>
        </article>
      </div>
    </section>
  );
}

function AdminApp(): React.JSX.Element {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [menu, setMenu] = useState<MenuKey>('analytics');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

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

  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current)
        .flat()
        .forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

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
        const { data } = await api.patch<ApiUser>(`/users/promoters/${promoterId}/ready`, payload, { headers });
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
      <div className="app-shell">
        <Sidebar active={menu} onMenu={setMenu} me={me} onLogout={logout} />

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>,
);
