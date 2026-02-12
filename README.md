# AdControl MVP

MVP-сервис учета расклейки наружной рекламы: backend + web admin + Telegram Mini App.

## Почему FastAPI (5 строк)
1. Быстрый старт для MVP: минимум boilerplate и высокая скорость разработки.
2. Встроенный OpenAPI/Swagger без дополнительных плагинов.
3. Удобная валидация через Pydantic DTO.
4. Простая интеграция JWT/RBAC и загрузки файлов.
5. Легко масштабировать на async, workers и S3-адаптер хранения.

## Шаг A — Проектирование

### 1) Архитектура (монорепо)
- `apps/api` — FastAPI + SQLAlchemy + Alembic + seed.
- `apps/admin` — React + Vite + TypeScript + MUI (operator UI).
- `apps/miniapp` — React + Vite + TypeScript (Telegram WebApp flow for promoter).
- `packages/shared` — зарезервировано под общие типы/SDK.
- `docker-compose.yml` — единый запуск всей системы.

### 2) ERD
- `workspaces` 1—N `users`, `addresses`, `work_types`, `orders`, `photos`, `payouts`
- `orders` N—1 `users` (promoter), N—1 `users` (created_by)
- `orders` 1—N `order_items`
- `order_items` N—M `work_types` через `order_item_work_types`
- `photos` N—1 `order_items`, N—1 `work_types`, N—1 `users`(uploader)
- `payouts` N—1 `orders`, N—1 `users`(promoter)

### 3) Минимальный API
- Auth: `POST /auth/login`, `POST /auth/telegram`
- User: `GET /users/me`, `GET /users/promoters`, `PATCH /users/promoters/{id}/ready`
- Types/Pricing: `GET/POST /work-types`
- Addresses: `GET/POST /addresses`, `POST /addresses/import-csv`
- Orders: `GET/POST /orders`, `GET /orders/{id}`, `PATCH /orders/{id}/status`
- Photos: `POST /photos/upload`, `GET /photos/order/{id}`, `PATCH /photos/{id}/review`, `GET /photos/file/{id}`
- Payouts: `GET /payouts`
- Health: `GET /health`

### 4) Навигация UI
**Admin:** Login → Dashboard → Orders → Addresses (CSV) → Employees → Types & Pricing.

**Mini App:** Tabs `Наряды / Оплата / Профиль` → Order list → Order detail/address flow → photo upload → review/payment status.

### 5) Риски и упрощения MVP
- В MVP Telegram `initData` упрощен до login по `telegram_id` (mock flow).
- Карта в UI пока заглушка, но `lat/lng` и API-ready структура есть.
- Переходы статусов не жестко ограничены state-machine (можно усилить).
- Платежи без банковской интеграции (`on_review`/`to_pay`/`paid`).
- Дедупликация фото реализована по SHA256 в рамках workspace.

## Шаг B — Реализация

### Запуск одной командой
```bash
docker compose up --build
```

Сервисы:
- API: http://localhost:8000 (Swagger: `/docs`)
- Admin: http://localhost:5173
- Mini App: http://localhost:5174

### Demo users
- operator: `operator / operator123`
- promoter: `promoter / promoter123`
- telegram login mock: `telegram_id=123456789`

### Что есть в seed
- 1 workspace
- 1 operator
- 1 promoter
- 20 адресов
- 5 типов работ
- 2 наряда

### Локальное хранение фото
Файлы сохраняются в `apps/api/uploads` + метаданные в БД (`photos`).
Под S3 расширяется через замену storage-адаптера (интерфейс уже выделяется логически в upload-сервисе).

## Шаг C — Тесты и качество
- Smoke test API: `apps/api/tests_smoke.py`
- Линт/форматтер: базовый TypeScript strict; для production стоит добавить Ruff+ESLint ruleset.

## ENV
Основные переменные API:
- `DATABASE_URL`
- `SECRET_KEY`
- `UPLOADS_DIR`

## Telegram bot setup (MVP)
1. Создать бота через BotFather.
2. Включить WebApp URL на фронт miniapp.
3. Передавать `initData` в miniapp (в MVP временно mock через telegram_id).
4. В проде: добавить серверную валидацию `initData` по токену бота.
