import { createApiClient } from './js/api.js';
import { clearSession, loadSession, saveSession } from './js/session.js';

const ORDER_STATUS_LABELS = {
  Draft: 'Черновик',
  Assigned: 'Назначен',
  InProgress: 'В работе',
  Review: 'Проверка',
  Payment: 'К оплате',
  Completed: 'Завершен',
};

const STATUS_CLASS = {
  Draft: 'status-draft',
  Assigned: 'status-assigned',
  InProgress: 'status-progress',
  Review: 'status-review',
  Payment: 'status-payment',
  Completed: 'status-completed',
};

const TAB_META = {
  dashboard: { title: 'Дашборд', subtitle: 'Ключевые метрики по рабочему пространству.' },
  orders: { title: 'Наряды', subtitle: 'Статусы, детали, фото и переходы состояния.' },
  payouts: { title: 'Выплаты', subtitle: 'Суммы по нарядам и готовность к оплате.' },
  team: { title: 'Исполнители', subtitle: 'Готовность промоутеров и заметки оператора.' },
  my_orders: { title: 'Мои наряды', subtitle: 'Задачи, которые назначены вам.' },
  my_payouts: { title: 'Мои выплаты', subtitle: 'Текущий прогресс и сумма к выплате.' },
  upload: { title: 'Загрузка фото', subtitle: 'Отчет по наряду с привязкой к типу работ.' },
  profile: { title: 'Профиль', subtitle: 'Текущая сессия и параметры клиента.' },
};

const OPERATOR_TABS = [
  { key: 'dashboard', label: 'Дашборд' },
  { key: 'orders', label: 'Наряды' },
  { key: 'payouts', label: 'Выплаты' },
  { key: 'team', label: 'Исполнители' },
];

const PROMOTER_TABS = [
  { key: 'dashboard', label: 'Дашборд' },
  { key: 'my_orders', label: 'Мои наряды' },
  { key: 'my_payouts', label: 'Мои выплаты' },
  { key: 'upload', label: 'Загрузка фото' },
  { key: 'profile', label: 'Профиль' },
];

const state = {
  session: loadSession(),
  user: null,
  activeTab: 'dashboard',
  loading: false,
  notice: null,

  orders: [],
  payouts: [],
  promoters: [],
  workTypes: [],
  addresses: [],

  selectedOrderId: null,
  selectedPromoterId: null,

  detailsByOrder: new Map(),
  photosByOrder: new Map(),
  previewUrlsByOrder: new Map(),

  auth: {
    mode: 'password',
    username: 'operator',
    password: 'operator123',
    initData: '',
    busy: false,
  },

  teamForm: {
    ready: true,
    note: '',
    busy: false,
  },

  uploadForm: {
    orderId: null,
    itemId: null,
    workTypeId: null,
    file: null,
    geoLat: '',
    geoLng: '',
    busy: false,
  },
};

const app = document.getElementById('app');
let noticeTimer = null;

function currentTabs() {
  return state.user?.role === 'operator' ? OPERATOR_TABS : PROMOTER_TABS;
}

function currentTabMeta() {
  const fallback = { title: 'AdControl', subtitle: 'Standalone client' };
  return TAB_META[state.activeTab] || fallback;
}

function formatMoney(value) {
  const parsed = Number(value);
  const safe = Number.isFinite(parsed) ? parsed : 0;
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(safe);
}

function statusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status;
}

function statusClass(status) {
  return STATUS_CLASS[status] || 'status-draft';
}

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return 'AC';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getAddressLabel(addressId) {
  const address = state.addresses.find((item) => item.id === addressId);
  if (!address) {
    return `Адрес #${addressId}`;
  }
  return `${address.street}, ${address.building}`;
}

function getWorkTypeLabel(workTypeId) {
  const workType = state.workTypes.find((item) => item.id === workTypeId);
  if (!workType) {
    return `Тип #${workTypeId}`;
  }
  return workType.name;
}

function setNotice(type, text) {
  state.notice = { type, text };
  if (noticeTimer) {
    clearTimeout(noticeTimer);
  }
  noticeTimer = setTimeout(() => {
    state.notice = null;
    render();
  }, 3400);
}

function revokeOrderPreviews(orderId) {
  const urls = state.previewUrlsByOrder.get(orderId) || [];
  urls.forEach((url) => URL.revokeObjectURL(url));
  state.previewUrlsByOrder.set(orderId, []);
}

function revokeAllPreviews() {
  state.previewUrlsByOrder.forEach((urls) => urls.forEach((url) => URL.revokeObjectURL(url)));
  state.previewUrlsByOrder.clear();
}

function applySession(accessToken, refreshToken, user) {
  state.session = { accessToken, refreshToken, user };
  state.user = user;
  saveSession(state.session);
}

function localLogout() {
  revokeAllPreviews();
  clearSession();
  state.session = null;
  state.user = null;
  state.orders = [];
  state.payouts = [];
  state.promoters = [];
  state.workTypes = [];
  state.addresses = [];
  state.detailsByOrder = new Map();
  state.photosByOrder = new Map();
  state.selectedOrderId = null;
  state.selectedPromoterId = null;
  state.activeTab = 'dashboard';
}

const api = createApiClient({
  getAccessToken: () => state.session?.accessToken || '',
  getRefreshToken: () => state.session?.refreshToken || null,
  setTokens: (accessToken, refreshToken, user) => {
    applySession(accessToken, refreshToken, user);
  },
  clearAuth: () => {
    localLogout();
    setNotice('error', 'Сессия завершена. Войдите повторно.');
    render();
  },
});

function syncDefaultTab() {
  const allowed = new Set(currentTabs().map((tab) => tab.key));
  if (!allowed.has(state.activeTab)) {
    state.activeTab = currentTabs()[0].key;
  }
}

function syncTeamForm() {
  const selected = state.promoters.find((item) => item.id === state.selectedPromoterId) || null;
  if (!selected) {
    state.teamForm.ready = true;
    state.teamForm.note = '';
    return;
  }

  state.teamForm.ready = Boolean(selected.is_ready);
  state.teamForm.note = selected.suspicious_note || '';
}

function syncUploadForm() {
  if (state.user?.role !== 'promoter') {
    return;
  }

  const myOrders = state.orders;
  if (!myOrders.length) {
    state.uploadForm.orderId = null;
    state.uploadForm.itemId = null;
    state.uploadForm.workTypeId = null;
    return;
  }

  if (!state.uploadForm.orderId || !myOrders.some((item) => item.id === state.uploadForm.orderId)) {
    state.uploadForm.orderId = myOrders[0].id;
  }

  const detail = state.detailsByOrder.get(state.uploadForm.orderId);
  const items = detail?.items || [];

  if (!items.length) {
    state.uploadForm.itemId = null;
    state.uploadForm.workTypeId = null;
    return;
  }

  if (!state.uploadForm.itemId || !items.some((item) => item.id === state.uploadForm.itemId)) {
    state.uploadForm.itemId = items[0].id;
  }

  const selectedItem = items.find((item) => item.id === state.uploadForm.itemId) || null;
  const workTypeIds = selectedItem?.work_type_ids || [];

  if (!workTypeIds.length) {
    state.uploadForm.workTypeId = null;
    return;
  }

  if (!state.uploadForm.workTypeId || !workTypeIds.includes(state.uploadForm.workTypeId)) {
    state.uploadForm.workTypeId = workTypeIds[0];
  }
}

async function loadOrderExtras(orderId, force = false) {
  if (!orderId) {
    return;
  }

  const hasDetail = state.detailsByOrder.has(orderId);
  const hasPhotos = state.photosByOrder.has(orderId);
  if (!force && hasDetail && hasPhotos) {
    return;
  }

  const [detail, photos] = await Promise.all([
    api.getOrder(orderId),
    api.listOrderPhotos(orderId),
  ]);

  state.detailsByOrder.set(orderId, detail);

  revokeOrderPreviews(orderId);

  const photosWithPreview = await Promise.all(
    photos.map(async (photo) => {
      try {
        const blob = await api.fetchPhotoBlob(photo.id);
        const previewUrl = URL.createObjectURL(blob);
        return { ...photo, previewUrl };
      } catch {
        return { ...photo, previewUrl: null };
      }
    }),
  );

  const previewUrls = photosWithPreview
    .map((photo) => photo.previewUrl)
    .filter((value) => typeof value === 'string');

  state.previewUrlsByOrder.set(orderId, previewUrls);
  state.photosByOrder.set(orderId, photosWithPreview);

  syncUploadForm();
}

async function reloadData({ silent = false } = {}) {
  if (!state.user) {
    return;
  }

  if (!silent) {
    state.loading = true;
    render();
  }

  try {
    const commonRequests = [
      api.listOrders(),
      api.listPayouts(),
      api.listWorkTypes(),
      api.listAddresses(),
    ];

    const [orders, payouts, workTypes, addresses, promoters] = await Promise.all([
      ...commonRequests,
      state.user.role === 'operator' ? api.listPromoters() : Promise.resolve([]),
    ]);

    state.orders = orders;
    state.payouts = payouts;
    state.workTypes = workTypes;
    state.addresses = addresses;
    state.promoters = promoters;

    if (!state.selectedOrderId || !orders.some((item) => item.id === state.selectedOrderId)) {
      state.selectedOrderId = orders[0]?.id || null;
    }

    if (state.user.role === 'operator') {
      if (!state.selectedPromoterId || !promoters.some((item) => item.id === state.selectedPromoterId)) {
        state.selectedPromoterId = promoters[0]?.id || null;
      }
      syncTeamForm();
    }

    if (state.selectedOrderId) {
      await loadOrderExtras(state.selectedOrderId, true);
    }

    syncUploadForm();
  } catch (error) {
    setNotice('error', api.handleError(error, 'Не удалось загрузить данные.'));
  } finally {
    if (!silent) {
      state.loading = false;
      render();
    }
  }
}

async function bootFromSession() {
  if (!state.session?.accessToken) {
    render();
    return;
  }

  state.loading = true;
  render();

  try {
    const me = await api.getMe();
    applySession(state.session.accessToken, state.session.refreshToken, me);
    syncDefaultTab();
    await reloadData({ silent: true });
  } catch {
    localLogout();
    setNotice('error', 'Сессия истекла. Войдите снова.');
  } finally {
    state.loading = false;
    render();
  }
}

function renderAuth() {
  const isPassword = state.auth.mode === 'password';

  return `
    <section class="auth-shell">
      <div class="auth-card">
        <div class="auth-brand">M</div>
        <h1>AdControl Standalone</h1>
        <p>Клиент поддерживает роли <b>operator</b> и <b>promoter</b> через единый API <code>/api/v1</code>.</p>

        <div class="auth-modes">
          <button type="button" data-action="set-auth-mode" data-mode="password" class="chip ${isPassword ? 'active' : ''}">Логин/пароль</button>
          <button type="button" data-action="set-auth-mode" data-mode="telegram" class="chip ${!isPassword ? 'active' : ''}">Telegram initData</button>
        </div>

        ${
          isPassword
            ? `
              <form id="login-form" class="auth-form">
                <label>
                  Логин
                  <input name="username" value="${state.auth.username}" autocomplete="username" required />
                </label>
                <label>
                  Пароль
                  <input name="password" type="password" value="${state.auth.password}" autocomplete="current-password" required />
                </label>
                <button class="primary" type="submit" ${state.auth.busy ? 'disabled' : ''}>${state.auth.busy ? 'Входим...' : 'Войти'}</button>
              </form>
            `
            : `
              <form id="telegram-form" class="auth-form">
                <label>
                  initData
                  <textarea name="initData" rows="5" required>${state.auth.initData}</textarea>
                </label>
                <button class="primary" type="submit" ${state.auth.busy ? 'disabled' : ''}>${state.auth.busy ? 'Проверяем...' : 'Войти через Telegram'}</button>
              </form>
            `
        }

        <p class="small muted">API: <code>${api.apiBase}</code></p>
      </div>
    </section>
  `;
}

function renderSidebar(tabs) {
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="logo">M</div>
        <div>
          <div class="brand-title">AdControl</div>
          <div class="brand-subtitle">Standalone Client</div>
        </div>
      </div>

      <div class="user-tile">
        <div class="avatar">${initials(state.user.full_name)}</div>
        <div>
          <strong>${state.user.full_name}</strong>
          <span>${state.user.role}</span>
        </div>
      </div>

      <div class="side-caption">MENU</div>
      <nav class="menu">
        ${tabs
          .map(
            (tab) =>
              `<button type="button" data-action="switch-tab" data-tab="${tab.key}" class="menu-btn ${state.activeTab === tab.key ? 'active' : ''}">${tab.label}</button>`,
          )
          .join('')}
      </nav>

      <div class="sidebar-actions">
        <div class="side-caption">ACCOUNT</div>
        <button type="button" class="secondary" data-action="reload-data">Обновить</button>
        <button type="button" class="danger" data-action="logout">Выйти</button>
      </div>
    </aside>
  `;
}

function renderDashboard() {
  const orders = state.orders;
  const payouts = state.payouts;
  const totalFinal = payouts.reduce((acc, item) => acc + Number(item.amount_final || 0), 0);
  const reviewCount = orders.filter((item) => item.status === 'Review').length;
  const inProgressCount = orders.filter((item) => item.status === 'InProgress').length;
  const assignedCount = orders.filter((item) => item.status === 'Assigned').length;

  return `
    <div class="grid metrics">
      <article class="metric-card">
        <span>Наряды</span>
        <strong>${orders.length}</strong>
      </article>
      <article class="metric-card">
        <span>Проверка</span>
        <strong>${reviewCount}</strong>
      </article>
      <article class="metric-card">
        <span>В работе</span>
        <strong>${inProgressCount}</strong>
      </article>
      <article class="metric-card">
        <span>Назначено</span>
        <strong>${assignedCount}</strong>
      </article>
      <article class="metric-card wide">
        <span>Объем выплат</span>
        <strong>${formatMoney(totalFinal)} ₽</strong>
      </article>
    </div>

    <div class="grid split">
      <article class="panel">
        <h3>Последние наряды</h3>
        <div class="list-stack">
          ${
            orders.length
              ? orders
                  .slice(0, 8)
                  .map(
                    (order) => `
                      <button class="list-row" data-action="select-order" data-order-id="${order.id}">
                        <strong>#${order.id}</strong>
                        <span>${order.title}</span>
                        <em class="badge ${statusClass(order.status)}">${statusLabel(order.status)}</em>
                      </button>
                    `,
                  )
                  .join('')
              : '<div class="empty">Наряды отсутствуют</div>'
          }
        </div>
      </article>

      <article class="panel">
        <h3>Последние выплаты</h3>
        <div class="list-stack">
          ${
            payouts.length
              ? payouts
                  .slice(0, 8)
                  .map(
                    (payout) => `
                      <div class="list-row muted-row">
                        <strong>#${payout.order_id}</strong>
                        <span>${payout.status}</span>
                        <em>${formatMoney(payout.amount_final)} ₽</em>
                      </div>
                    `,
                  )
                  .join('')
              : '<div class="empty">Пока нет выплат</div>'
          }
        </div>
      </article>
    </div>
  `;
}

function renderOrderDetails(order) {
  if (!order) {
    return '<div class="empty">Выберите наряд слева</div>';
  }

  const detail = state.detailsByOrder.get(order.id);
  const photos = state.photosByOrder.get(order.id) || [];

  const addresses = detail?.items?.map((item) => getAddressLabel(item.address_id)) || [];
  const workTypeSet = new Set();
  detail?.items?.forEach((item) => item.work_type_ids.forEach((id) => workTypeSet.add(id)));

  return `
    <div class="detail-head">
      <h3>#${order.id} ${order.title}</h3>
      <span class="badge ${statusClass(order.status)}">${statusLabel(order.status)}</span>
    </div>

    <div class="detail-grid">
      <article class="panel">
        <h4>Адреса</h4>
        <div class="chip-row">
          ${addresses.length ? addresses.map((label) => `<span class="chip">${label}</span>`).join('') : '<span class="empty-inline">Нет адресов</span>'}
        </div>
      </article>

      <article class="panel">
        <h4>Типы работ</h4>
        <div class="chip-row">
          ${
            workTypeSet.size
              ? [...workTypeSet].map((id) => `<span class="chip">${getWorkTypeLabel(id)}</span>`).join('')
              : '<span class="empty-inline">Нет типов работ</span>'
          }
        </div>
      </article>
    </div>

    <article class="panel">
      <h4>Фото отчета</h4>
      <div class="photo-grid">
        ${
          photos.length
            ? photos
                .map(
                  (photo) => `
                    <div class="photo-card">
                      <div class="photo-preview ${photo.previewUrl ? '' : 'placeholder'}">
                        ${photo.previewUrl ? `<img src="${photo.previewUrl}" alt="photo-${photo.id}" />` : '<span>нет превью</span>'}
                      </div>
                      <div class="photo-meta">
                        <strong>#${photo.id}</strong>
                        <span class="badge ${photo.status === 'accepted' ? 'status-completed' : photo.status === 'rejected' ? 'status-assigned' : 'status-review'}">${photo.status}</span>
                      </div>
                      ${photo.reject_reason ? `<p class="small">${photo.reject_reason}</p>` : ''}
                      ${
                        state.user.role === 'operator'
                          ? `
                            <div class="photo-actions">
                              <button type="button" class="accept" data-action="review-photo" data-photo-id="${photo.id}" data-review-status="accepted">Принять</button>
                              <button type="button" class="reject" data-action="review-photo" data-photo-id="${photo.id}" data-review-status="rejected">Отклонить</button>
                            </div>
                          `
                          : ''
                      }
                    </div>
                  `,
                )
                .join('')
            : '<div class="empty">Фото отсутствуют</div>'
        }
      </div>
    </article>
  `;
}

function renderOrders() {
  const selectedOrder = state.orders.find((order) => order.id === state.selectedOrderId) || null;

  return `
    <div class="grid split order-layout">
      <article class="panel order-list">
        <div class="panel-head">
          <h3>${state.user.role === 'operator' ? 'Наряды workspace' : 'Мои наряды'}</h3>
          ${state.user.role === 'operator' ? '<button type="button" class="secondary" data-action="create-order">Быстрый наряд</button>' : ''}
        </div>
        <div class="list-stack">
          ${
            state.orders.length
              ? state.orders
                  .map(
                    (order) => `
                      <div class="list-row ${state.selectedOrderId === order.id ? 'selected' : ''}">
                        <button type="button" class="row-main" data-action="select-order" data-order-id="${order.id}">
                          <strong>#${order.id}</strong>
                          <span>${order.title}</span>
                        </button>
                        <select data-action="set-order-status" data-order-id="${order.id}" value="${order.status}">
                          ${Object.keys(ORDER_STATUS_LABELS)
                            .map(
                              (status) => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${ORDER_STATUS_LABELS[status]}</option>`,
                            )
                            .join('')}
                        </select>
                      </div>
                    `,
                  )
                  .join('')
              : '<div class="empty">Наряды отсутствуют</div>'
          }
        </div>
      </article>

      <div class="order-detail-wrap">
        ${renderOrderDetails(selectedOrder)}
      </div>
    </div>
  `;
}

function renderPayouts() {
  return `
    <article class="panel">
      <h3>${state.user.role === 'operator' ? 'Выплаты по команде' : 'Мои выплаты'}</h3>
      ${
        state.payouts.length
          ? `
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Наряд</th>
                    <th>Предв.</th>
                    <th>Финал</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.payouts
                    .map(
                      (payout) => `
                        <tr>
                          <td>#${payout.order_id}</td>
                          <td>${formatMoney(payout.amount_preliminary)} ₽</td>
                          <td>${formatMoney(payout.amount_final)} ₽</td>
                          <td><span class="badge ${payout.status === 'paid' ? 'status-completed' : payout.status === 'to_pay' ? 'status-payment' : 'status-review'}">${payout.status}</span></td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          : '<div class="empty">Пока нет выплат</div>'
      }
    </article>
  `;
}

function renderTeam() {
  const selected = state.promoters.find((item) => item.id === state.selectedPromoterId) || null;

  return `
    <div class="grid split">
      <article class="panel">
        <h3>Промоутеры</h3>
        <div class="list-stack">
          ${
            state.promoters.length
              ? state.promoters
                  .map(
                    (promoter) => `
                      <button type="button" class="list-row ${selected?.id === promoter.id ? 'selected' : ''}" data-action="select-promoter" data-promoter-id="${promoter.id}">
                        <strong>${promoter.full_name}</strong>
                        <span>${promoter.username ? `@${promoter.username}` : 'без username'}</span>
                        <em class="badge ${promoter.is_ready ? 'status-completed' : 'status-assigned'}">${promoter.is_ready ? 'ready' : 'pause'}</em>
                      </button>
                    `,
                  )
                  .join('')
              : '<div class="empty">Исполнители не найдены</div>'
          }
        </div>
      </article>

      <article class="panel">
        <h3>${selected ? selected.full_name : 'Профиль исполнителя'}</h3>
        ${
          selected
            ? `
              <form id="team-form" class="stack-form">
                <label>
                  <input type="checkbox" data-action="team-ready" ${state.teamForm.ready ? 'checked' : ''} />
                  Готов принимать наряды
                </label>

                <label>
                  Комментарий оператора
                  <textarea data-action="team-note" rows="5">${state.teamForm.note}</textarea>
                </label>

                <button class="primary" type="submit" ${state.teamForm.busy ? 'disabled' : ''}>${state.teamForm.busy ? 'Сохраняем...' : 'Сохранить'}</button>
              </form>
            `
            : '<div class="empty">Выберите исполнителя из списка</div>'
        }
      </article>
    </div>
  `;
}

function renderUpload() {
  const myOrders = state.orders;
  const selectedOrderId = state.uploadForm.orderId;
  const detail = selectedOrderId ? state.detailsByOrder.get(selectedOrderId) : null;
  const items = detail?.items || [];
  const selectedItem = items.find((item) => item.id === state.uploadForm.itemId) || null;
  const workTypeIds = selectedItem?.work_type_ids || [];

  return `
    <div class="grid split">
      <article class="panel">
        <h3>Отправить фото-отчет</h3>
        ${
          myOrders.length
            ? `
              <form id="upload-form" class="stack-form">
                <label>
                  Наряд
                  <select data-action="upload-order">
                    ${myOrders
                      .map(
                        (order) => `<option value="${order.id}" ${Number(order.id) === Number(selectedOrderId) ? 'selected' : ''}>#${order.id} ${order.title}</option>`,
                      )
                      .join('')}
                  </select>
                </label>

                <label>
                  Позиция наряда
                  <select data-action="upload-item" ${items.length ? '' : 'disabled'}>
                    ${
                      items.length
                        ? items
                            .map(
                              (item) => `<option value="${item.id}" ${Number(item.id) === Number(state.uploadForm.itemId) ? 'selected' : ''}>#${item.id} · ${getAddressLabel(item.address_id)}</option>`,
                            )
                            .join('')
                        : '<option value="">Нет позиций</option>'
                    }
                  </select>
                </label>

                <label>
                  Тип работ
                  <select data-action="upload-work-type" ${workTypeIds.length ? '' : 'disabled'}>
                    ${
                      workTypeIds.length
                        ? workTypeIds
                            .map(
                              (id) => `<option value="${id}" ${Number(id) === Number(state.uploadForm.workTypeId) ? 'selected' : ''}>${getWorkTypeLabel(id)}</option>`,
                            )
                            .join('')
                        : '<option value="">Нет типов работ</option>'
                    }
                  </select>
                </label>

                <label>
                  Фото
                  <input type="file" accept="image/jpeg,image/png,image/webp" data-action="upload-file" required />
                </label>

                <div class="inline-fields">
                  <label>
                    geo_lat
                    <input type="number" step="0.000001" data-action="upload-lat" value="${state.uploadForm.geoLat}" />
                  </label>
                  <label>
                    geo_lng
                    <input type="number" step="0.000001" data-action="upload-lng" value="${state.uploadForm.geoLng}" />
                  </label>
                </div>

                <button class="primary" type="submit" ${state.uploadForm.busy ? 'disabled' : ''}>${state.uploadForm.busy ? 'Загружаем...' : 'Загрузить фото'}</button>
              </form>
            `
            : '<div class="empty">У вас нет нарядов для загрузки фото</div>'
        }
      </article>

      <article class="panel">
        <h3>Подсказки по загрузке</h3>
        <ul class="tips">
          <li>Размер файла ограничен сервером и проверяется по MIME-типу.</li>
          <li>Используйте только адреса и типы работ из текущего наряда.</li>
          <li>После загрузки оператор увидит фото в очереди проверки.</li>
        </ul>
      </article>
    </div>
  `;
}

function renderProfile() {
  return `
    <article class="panel">
      <h3>Профиль сессии</h3>
      <div class="kv-grid">
        <div><span>Имя</span><strong>${state.user.full_name}</strong></div>
        <div><span>Роль</span><strong>${state.user.role}</strong></div>
        <div><span>Username</span><strong>${state.user.username || '—'}</strong></div>
        <div><span>Телефон</span><strong>${state.user.phone || '—'}</strong></div>
        <div><span>API base</span><strong>${api.apiBase}</strong></div>
      </div>
    </article>
  `;
}

function renderContentByTab() {
  if (state.activeTab === 'dashboard') return renderDashboard();
  if (state.activeTab === 'orders' || state.activeTab === 'my_orders') return renderOrders();
  if (state.activeTab === 'payouts' || state.activeTab === 'my_payouts') return renderPayouts();
  if (state.activeTab === 'team') return renderTeam();
  if (state.activeTab === 'upload') return renderUpload();
  if (state.activeTab === 'profile') return renderProfile();
  return '<div class="empty">Раздел не найден</div>';
}

function renderWorkspace() {
  const tabs = currentTabs();
  const tabMeta = currentTabMeta();

  return `
    <div class="client-shell">
      ${renderSidebar(tabs)}

      <main class="workspace">
        <header class="toolbar">
          <div>
            <h1>${tabMeta.title}</h1>
            <p>${tabMeta.subtitle}</p>
          </div>
          <div class="toolbar-badges">
            <span class="badge role-badge">${state.user.role}</span>
            ${state.loading ? '<span class="spinner"></span>' : ''}
          </div>
        </header>

        ${state.notice ? `<div class="notice ${state.notice.type}">${state.notice.text}</div>` : ''}

        <section class="content-area">
          ${renderContentByTab()}
        </section>
      </main>
    </div>

    <nav class="mobile-nav">
      ${tabs
        .map(
          (tab) => `<button type="button" data-action="switch-tab" data-tab="${tab.key}" class="${state.activeTab === tab.key ? 'active' : ''}">${tab.label}</button>`,
        )
        .join('')}
    </nav>
  `;
}

function render() {
  syncDefaultTab();
  if (!state.user) {
    app.innerHTML = renderAuth();
    return;
  }

  app.innerHTML = renderWorkspace();
}

async function handlePasswordLogin(form) {
  const formData = new FormData(form);
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '').trim();

  if (!username || !password) {
    setNotice('error', 'Введите логин и пароль.');
    render();
    return;
  }

  state.auth.busy = true;
  render();

  try {
    const auth = await api.login(username, password);
    applySession(auth.tokens.access_token, auth.tokens.refresh_token, auth.user);
    state.auth.username = username;
    state.auth.password = password;
    state.activeTab = 'dashboard';

    await reloadData({ silent: true });
    setNotice('ok', `Вход выполнен: ${auth.user.full_name}`);
  } catch (error) {
    setNotice('error', api.handleError(error, 'Не удалось выполнить вход.'));
  } finally {
    state.auth.busy = false;
    render();
  }
}

async function handleTelegramLogin(form) {
  const formData = new FormData(form);
  const initData = String(formData.get('initData') || '').trim();

  if (!initData) {
    setNotice('error', 'Передайте Telegram initData.');
    render();
    return;
  }

  state.auth.busy = true;
  render();

  try {
    const auth = await api.telegramLogin(initData);
    applySession(auth.tokens.access_token, auth.tokens.refresh_token, auth.user);
    state.auth.initData = initData;
    state.activeTab = 'dashboard';

    await reloadData({ silent: true });
    setNotice('ok', `Вход выполнен: ${auth.user.full_name}`);
  } catch (error) {
    setNotice('error', api.handleError(error, 'Не удалось войти через Telegram.'));
  } finally {
    state.auth.busy = false;
    render();
  }
}

async function handleLogout() {
  try {
    await api.logout();
  } catch {
    // ignore logout network failure, local cleanup is still required
  }

  localLogout();
  setNotice('ok', 'Вы вышли из системы.');
  render();
}

async function handleOrderStatusChange(orderId, nextStatus) {
  if (!orderId || !nextStatus) {
    return;
  }

  try {
    await api.setOrderStatus(orderId, nextStatus);
    setNotice('ok', `Статус наряда #${orderId} обновлен.`);
    await reloadData({ silent: true });
  } catch (error) {
    setNotice('error', api.handleError(error, 'Не удалось изменить статус наряда.'));
  } finally {
    render();
  }
}

async function handleCreateOrder() {
  if (state.user?.role !== 'operator') {
    return;
  }

  const promoterId = state.selectedPromoterId || state.promoters[0]?.id || null;
  const addressId = state.addresses[0]?.id || null;
  const workTypeId = state.workTypes[0]?.id || null;

  if (!promoterId || !addressId || !workTypeId) {
    setNotice('error', 'Недостаточно данных для создания наряда.');
    render();
    return;
  }

  const title = `Наряд ${new Date().toISOString().slice(11, 19)}`;

  try {
    const created = await api.createOrder({
      title,
      promoter_id: promoterId,
      comment: null,
      deadline_at: null,
      status: 'Assigned',
      items: [
        {
          address_id: addressId,
          work_type_ids: [workTypeId],
          comment: null,
        },
      ],
    });

    await reloadData({ silent: true });
    const createdId = Number(created?.id || 0) || null;
    if (createdId) {
      state.selectedOrderId = createdId;
      await loadOrderExtras(createdId, true);
    }
    setNotice('ok', `Наряд #${createdId || '?'} создан.`);
  } catch (error) {
    setNotice('error', api.handleError(error, 'Не удалось создать наряд.'));
  } finally {
    render();
  }
}

async function handlePhotoReview(photoId, reviewStatus) {
  const status = String(reviewStatus || '');
  if (!photoId || !status) {
    return;
  }

  let reason = null;
  if (status === 'rejected') {
    const promptValue = window.prompt('Причина отклонения (необязательно):', '');
    if (promptValue === null) {
      return;
    }
    reason = promptValue.trim() || null;
  }

  try {
    await api.reviewPhoto(photoId, { status, reject_reason: reason });
    await reloadData({ silent: true });
    setNotice('ok', status === 'accepted' ? 'Фото принято.' : 'Фото отклонено.');
    if (state.selectedOrderId) {
      await loadOrderExtras(state.selectedOrderId, true);
    }
  } catch (error) {
    setNotice('error', api.handleError(error, 'Не удалось отправить ревью фото.'));
  } finally {
    render();
  }
}

async function handleTeamSave() {
  const promoterId = state.selectedPromoterId;
  if (!promoterId) {
    return;
  }

  state.teamForm.busy = true;
  render();

  try {
    const updated = await api.updatePromoterAvailability(promoterId, {
      is_ready: state.teamForm.ready,
      suspicious_note: state.teamForm.note.trim() || null,
    });

    state.promoters = state.promoters.map((item) => (item.id === updated.id ? updated : item));
    setNotice('ok', 'Профиль исполнителя обновлен.');
  } catch (error) {
    setNotice('error', api.handleError(error, 'Не удалось обновить исполнителя.'));
  } finally {
    state.teamForm.busy = false;
    render();
  }
}

async function handleUploadSubmit() {
  if (!state.uploadForm.orderId || !state.uploadForm.itemId || !state.uploadForm.workTypeId || !state.uploadForm.file) {
    setNotice('error', 'Выберите наряд, позицию, тип работ и файл.');
    render();
    return;
  }

  state.uploadForm.busy = true;
  render();

  const geoLat = state.uploadForm.geoLat.trim() ? Number.parseFloat(state.uploadForm.geoLat) : null;
  const geoLng = state.uploadForm.geoLng.trim() ? Number.parseFloat(state.uploadForm.geoLng) : null;

  try {
    await api.uploadPhoto({
      order_item_id: state.uploadForm.itemId,
      work_type_id: state.uploadForm.workTypeId,
      file: state.uploadForm.file,
      geo_lat: Number.isFinite(geoLat) ? geoLat : undefined,
      geo_lng: Number.isFinite(geoLng) ? geoLng : undefined,
    });

    state.uploadForm.file = null;
    state.uploadForm.geoLat = '';
    state.uploadForm.geoLng = '';

    if (state.uploadForm.orderId) {
      await loadOrderExtras(state.uploadForm.orderId, true);
    }

    await reloadData({ silent: true });
    setNotice('ok', 'Фото загружено и отправлено на проверку.');
  } catch (error) {
    setNotice('error', api.handleError(error, 'Не удалось загрузить фото.'));
  } finally {
    state.uploadForm.busy = false;
    render();
  }
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) {
    return;
  }

  const { action } = target.dataset;

  if (action === 'set-auth-mode') {
    state.auth.mode = target.dataset.mode === 'telegram' ? 'telegram' : 'password';
    render();
    return;
  }

  if (action === 'switch-tab') {
    state.activeTab = target.dataset.tab || 'dashboard';
    render();
    return;
  }

  if (action === 'reload-data') {
    await reloadData();
    return;
  }

  if (action === 'logout') {
    await handleLogout();
    return;
  }

  if (action === 'create-order') {
    await handleCreateOrder();
    return;
  }

  if (action === 'select-order') {
    state.selectedOrderId = Number.parseInt(target.dataset.orderId || '0', 10) || null;
    if (state.selectedOrderId) {
      try {
        await loadOrderExtras(state.selectedOrderId);
      } catch (error) {
        setNotice('error', api.handleError(error, 'Не удалось загрузить детали наряда.'));
      }
    }
    syncUploadForm();
    render();
    return;
  }

  if (action === 'select-promoter') {
    state.selectedPromoterId = Number.parseInt(target.dataset.promoterId || '0', 10) || null;
    syncTeamForm();
    render();
    return;
  }

  if (action === 'review-photo') {
    const photoId = Number.parseInt(target.dataset.photoId || '0', 10) || null;
    await handlePhotoReview(photoId, target.dataset.reviewStatus);
  }
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.dataset?.action) {
    return;
  }

  const action = target.dataset.action;

  if (action === 'set-order-status' && target instanceof HTMLSelectElement) {
    const orderId = Number.parseInt(target.dataset.orderId || '0', 10) || null;
    void handleOrderStatusChange(orderId, target.value);
    return;
  }

  if (action === 'team-ready' && target instanceof HTMLInputElement) {
    state.teamForm.ready = target.checked;
    return;
  }

  if (action === 'team-note' && target instanceof HTMLTextAreaElement) {
    state.teamForm.note = target.value;
    return;
  }

  if (action === 'upload-order' && target instanceof HTMLSelectElement) {
    state.uploadForm.orderId = Number.parseInt(target.value || '0', 10) || null;
    if (state.uploadForm.orderId) {
      void loadOrderExtras(state.uploadForm.orderId, true)
        .catch((error) => {
          setNotice('error', api.handleError(error, 'Не удалось загрузить детали наряда.'));
        })
        .finally(() => {
          syncUploadForm();
          render();
        });
    } else {
      syncUploadForm();
      render();
    }
    return;
  }

  if (action === 'upload-item' && target instanceof HTMLSelectElement) {
    state.uploadForm.itemId = Number.parseInt(target.value || '0', 10) || null;
    syncUploadForm();
    render();
    return;
  }

  if (action === 'upload-work-type' && target instanceof HTMLSelectElement) {
    state.uploadForm.workTypeId = Number.parseInt(target.value || '0', 10) || null;
    return;
  }

  if (action === 'upload-file' && target instanceof HTMLInputElement) {
    state.uploadForm.file = target.files?.[0] || null;
    return;
  }

  if (action === 'upload-lat' && target instanceof HTMLInputElement) {
    state.uploadForm.geoLat = target.value;
    return;
  }

  if (action === 'upload-lng' && target instanceof HTMLInputElement) {
    state.uploadForm.geoLng = target.value;
  }
});

document.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  if (form.id === 'login-form') {
    event.preventDefault();
    void handlePasswordLogin(form);
    return;
  }

  if (form.id === 'telegram-form') {
    event.preventDefault();
    void handleTelegramLogin(form);
    return;
  }

  if (form.id === 'team-form') {
    event.preventDefault();
    void handleTeamSave();
    return;
  }

  if (form.id === 'upload-form') {
    event.preventDefault();
    void handleUploadSubmit();
  }
});

window.addEventListener('beforeunload', () => {
  revokeAllPreviews();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

if (state.session?.user) {
  state.user = state.session.user;
}

render();
void bootFromSession();
