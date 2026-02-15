# AdControl

AdControl is an MVP service for outdoor advertising operations:
- `apps/api`: FastAPI + SQLAlchemy + Alembic
- `apps/admin`: operator web UI (React + Vite)
- `apps/miniapp`: promoter UI (React + Vite, Telegram WebApp flow)
- `frontend`: standalone cross-platform web client shell

## Quick Start (Development)

1. Copy env template if needed and adjust values:
```bash
cp .env.dev .env
```

2. Start all services:
```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev up --build
```

3. Open services:
- API: `http://localhost:41111/api/v1/health`
- Admin: `http://localhost:41112`
- Miniapp: `http://localhost:41113`
- Standalone: `http://localhost:41114`

## Production Compose

Use the production stack with reverse proxy (Caddy) and TLS-ready host routing:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d
```

Configure these host variables in `.env.prod`:
- `API_HOST`
- `ADMIN_HOST`
- `MINIAPP_HOST`
- `STANDALONE_HOST`

Daily PostgreSQL backups are enabled in production (`db-backup` service).
Configure:
- `BACKUP_INTERVAL_SECONDS` (default `86400`)
- `BACKUP_RETENTION_DAYS` (default `7`)

## API v1

Base prefix: `/api/v1`

Main endpoints:
- Auth:
  - `POST /auth/login`
  - `POST /auth/telegram`
  - `POST /auth/refresh`
  - `POST /auth/logout`
- Users:
  - `GET /users/me`
  - `GET /users/promoters`
  - `PATCH /users/promoters/{id}/availability`
- Orders:
  - `GET /orders`
  - `POST /orders`
  - `GET /orders/{id}`
  - `PATCH /orders/{id}/status`
- Photos:
  - `POST /photos`
  - `GET /photos/order/{id}`
  - `PATCH /photos/{id}/review`
  - `GET /photos/file/{id}`
- Payouts:
  - `GET /payouts`
- Health:
  - `GET /health`
  - `GET /metrics`

## Demo Credentials

Seed data (`RUN_SEED=true`) creates:
- operator: `operator / operator123`
- promoter: `promoter / promoter123`
- mock Telegram id for dev mode: `123456789`

## Security Notes

- Secrets must come from environment files (`.env.dev`, `.env.prod`) and are not hardcoded in compose.
- CORS origins are configured via `CORS_ALLOW_ORIGINS`.
- Refresh token is stored as HttpOnly cookie and tracked in DB (`refresh_sessions`).
- Telegram login validates `init_data`; numeric mock input works only when `ALLOW_TELEGRAM_MOCK=true`.
- CSV import is restricted by `MAX_CSV_UPLOAD_SIZE_MB` and `ALLOWED_CSV_UPLOAD_MIME_TYPES`.

## Operations

- Rollout/rollback/restore runbook: `docs/ops/rollout-runbook.md`
- Ops scripts: `docker/ops/canary-rollout.sh`, `docker/ops/rollback-release.sh`, `docker/ops/restore-postgres.sh`
- Regenerate shared OpenAPI types: `npm --prefix packages/api-client run generate`
- Manual e2e hook: `pre-commit run --hook-stage manual standalone-e2e`
- Backfill payouts after payout logic updates:
```bash
cd apps/api
python -m app.scripts.backfill_payouts --dry-run
python -m app.scripts.backfill_payouts --batch-size 200
```

## ADR

Architecture decisions are documented in `docs/adr/`:
- `ADR-001-api-v1.md`
- `ADR-002-auth-session.md`
- `ADR-003-compose-dev-prod.md`
