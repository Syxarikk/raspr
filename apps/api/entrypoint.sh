#!/usr/bin/env sh
set -euo pipefail

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  alembic upgrade head
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  python -m app.seed
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
