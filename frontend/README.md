# Standalone Client

`frontend/` is the third standalone client in the AdControl stack.

## What it supports
- Password auth (`POST /api/v1/auth/login`)
- Telegram auth (`POST /api/v1/auth/telegram` with `init_data`)
- Session restore with refresh flow (`POST /api/v1/auth/refresh`)
- Role-aware UI for both `operator` and `promoter`
- Operator actions:
  - orders list + status transitions
  - payouts view
  - promoter availability updates
  - photo review (`accepted` / `rejected`)
- Promoter actions:
  - own orders and payouts
  - photo upload to order items

## Local run
```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev up --build standalone
```
Open `http://localhost:41114`.

## Notes
- API base defaults to `/api/v1`.
- Refresh flow uses server cookies (`credentials: include`).
- UI code is split into modules:
  - `frontend/app.js`
  - `frontend/js/api.js`
  - `frontend/js/session.js`
