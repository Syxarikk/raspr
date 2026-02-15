import { useCallback, useEffect, useState } from 'react';
import ApartmentOutlined from '@mui/icons-material/ApartmentOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import PeopleOutlineRounded from '@mui/icons-material/PeopleOutlineRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import { latLngBounds } from 'leaflet';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';

import { MENU_ITEMS, PODOLSK_CENTER } from '../constants';
import { api } from '../../lib/api';
import { initials, markerToneColor } from '../utils';
import type { ApiUser, Marker, MenuKey } from '../types';

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

export function LoginScreen({ onToken }: { onToken: (token: string) => void }): React.JSX.Element {
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
        const { data } = await api.post<{ tokens: { access_token: string } }>('/auth/login', { username, password });
        localStorage.setItem('token', data.tokens.access_token);
        onToken(data.tokens.access_token);
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

export function Sidebar({
  active,
  onMenu,
  me,
  onLogout,
  collapsed,
  onToggleCollapse,
}: {
  active: MenuKey;
  onMenu: (key: MenuKey) => void;
  me: ApiUser | null;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}): React.JSX.Element {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="side-top">
        {!collapsed ? <div className="brand-mini">AdControl</div> : null}
        <button className="circle-btn" type="button" aria-label="collapse menu" onClick={onToggleCollapse}>
          <ChevronLeftRounded fontSize="small" style={{ transform: collapsed ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }} />
        </button>
      </div>

      <div className="workspace-badge">
        <div className="workspace-logo">M</div>
        {!collapsed ? <div className="workspace-name">Mknet Podolsk</div> : null}
      </div>

      {!collapsed ? <div className="side-caption">MENU</div> : null}
      <nav className="side-menu">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              className={`menu-item ${active === item.key ? 'active' : ''}`}
              type="button"
              onClick={() => onMenu(item.key)}
              title={collapsed ? item.label : undefined}
            >
              <Icon fontSize="small" />
              {!collapsed ? <span>{item.label}</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="side-account">
        {!collapsed ? (
          <div className="user-chip">
            <div className="avatar">{initials(me?.full_name || 'User')}</div>
            <div>
              <div className="user-name">{me?.full_name || 'Operator'}</div>
              <div className="user-role">Marketing Manager</div>
            </div>
          </div>
        ) : (
          <div className="user-chip">
            <div className="avatar">{initials(me?.full_name || 'User')}</div>
          </div>
        )}

        {!collapsed ? <div className="side-caption">YOUR ACCOUNT</div> : null}

        <button className="menu-item" type="button" title={collapsed ? 'Settings' : undefined}>
          <SettingsOutlined fontSize="small" />
          {!collapsed ? <span>Settings</span> : null}
        </button>

        <button className="menu-item" type="button" onClick={onLogout} title={collapsed ? 'Log Out' : undefined}>
          <LogoutRounded fontSize="small" />
          {!collapsed ? <span>Log Out</span> : null}
        </button>
      </div>
    </aside>
  );
}

export function SearchInput({
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

export function MapSurface({
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

export function ModalShell({
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
