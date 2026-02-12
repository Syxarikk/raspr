const screens = {
  analytics: {
    title: 'Аналитика',
    render: () => `
      <div class="stats-grid">
        <article class="stat"><h3>Нарядов</h3><p>14</p></article>
        <article class="stat"><h3>Адресов</h3><p>162</p></article>
        <article class="stat"><h3>Активности</h3><p>7658</p></article>
      </div>
      <div class="two-col">
        <article class="card">
          <h3>Ждут проверки</h3>
          ${row('#1245', 'Иван М.', 'Проверка', 'orange')}
          ${row('#1154', 'Сергей В.', 'Проверка', 'orange')}
          ${row('#95', 'Алексей О.', 'Проверка', 'orange')}
          ${row('#478', 'Анна Б.', 'Проверка', 'orange')}
        </article>
        <article class="map"></article>
      </div>
    `,
  },
  addresses: {
    title: 'Адреса',
    render: () => `
      <article class="card">
        <h3>Ленинградское ш. 12</h3>
        <p class="muted">Листовки / Хенгеры / Наклейки</p>
        <div class="photo-grid">${Array.from({ length: 28 }).map(() => '<div class="photo"></div>').join('')}</div>
      </article>
      <div class="two-col">
        <article class="card"><h3>В работе</h3>${row('#6322', 'ул. Пушкина', 'В работе', 'blue')}${row('#6323', 'ул. Кирова', 'Назначен', 'orange')}</article>
        <article class="map"></article>
      </div>
    `,
  },
  orders: {
    title: 'Наряды',
    render: () => `
      <article class="card">
        <h3>Наряд #2327</h3>
        <div class="tasks">
          ${task('Листовки')}
          ${task('Хенгеры')}
          ${task('Наклейки')}
          ${task('Демонтаж')}
        </div>
      </article>
      <div class="two-col">
        <article class="card">
          <h3>История изменений</h3>
          ${row('22 апр 2025', 'Иван создал наряд', 'Черновик', 'blue')}
          ${row('22 апр 2025', 'Иван начал делать', 'В работе', 'blue')}
          ${row('22 апр 2025', 'Иван проверил', 'К оплате', 'green')}
        </article>
        <article class="card">
          <h3>Заработано</h3>
          <p style="font-size:48px;margin:0;font-weight:700">1434 ₽</p>
          <p class="muted">Листовки: 27 × 9 ₽ • Хенгеры: 27 × 9 ₽ • Наклейки: 27 × 9 ₽</p>
        </article>
      </div>
    `,
  },
  workers: {
    title: 'Исполнители',
    render: () => `
      <div class="two-col" style="margin-top:0">
        <article class="card">
          <h3>Список исполнителей</h3>
          ${row('Иван Петров', 'готов брать наряды', 'В работе', 'blue')}
          ${row('Ivan Martyanov', '987 123 45 67', 'Назначен', 'orange')}
          ${row('Анна Б.', '@bpxmsg', 'К оплате', 'green')}
        </article>
        <article class="card">
          <h3>Контакты менеджера</h3>
          <div class="list-row"><strong>Иван Панченко</strong><span class="muted">Маркетинг менеджер</span><a href="#">Позвонить</a></div>
          <div class="list-row"><span>+7 985 123 45 67</span><span></span><a href="#">Написать</a></div>
          <div class="photo-grid">${Array.from({ length: 8 }).map(() => '<div class="photo"></div>').join('')}</div>
        </article>
      </div>
    `,
  },
  guides: {
    title: 'Гайды',
    render: () => `
      <article class="card">
        <h3>Листовки</h3>
        <p>Выбор места для синей наклейки. Для досок объявлений снаружи или внутри подъездов.</p>
      </article>
      <div class="two-col">
        <article class="card">
          <h3>Общие правила</h3>
          <div class="list-row">Листовки <span></span>›</div>
          <div class="list-row">Наклейки <span></span>›</div>
          <div class="list-row">Таблички <span></span>›</div>
          <div class="list-row">Хенгеры <span></span>›</div>
        </article>
        <article class="card">
          <h3>Пример фото</h3>
          <div class="map" style="min-height:260px"></div>
        </article>
      </div>
    `,
  },
};

const menu = [
  ['analytics', 'Аналитика'],
  ['addresses', 'Адреса'],
  ['orders', 'Наряды'],
  ['workers', 'Исполнители'],
  ['guides', 'Гайды'],
];

function row(left, mid, badgeText, badgeClass) {
  return `<div class="list-row"><strong>${left}</strong><span>${mid}</span><span class="badge ${badgeClass}">${badgeText}</span></div>`;
}

function task(name) {
  return `<div class="task"><strong>${name}</strong><div class="camera">📷</div></div>`;
}

function renderMenu(container, active, compact = false) {
  container.innerHTML = menu
    .map(
      ([key, label]) =>
        `<button data-screen="${key}" class="menu-item ${active === key ? 'active' : ''}">${compact ? label.split(' ')[0] : label}</button>`,
    )
    .join('');
}

function setScreen(key) {
  const current = screens[key] ?? screens.orders;
  document.querySelector('#title').textContent = current.title;
  document.querySelector('#screen').innerHTML = current.render();
  renderMenu(document.querySelector('#desktopMenu'), key);
  renderMenu(document.querySelector('#mobileMenu'), key, true);
  location.hash = key;
}

const initial = location.hash.replace('#', '') || 'orders';
setScreen(initial);

document.body.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-screen]');
  if (btn) setScreen(btn.dataset.screen);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
