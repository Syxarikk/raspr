#!/usr/bin/env sh
set -eu

# `pipefail` is not supported by all /bin/sh implementations (e.g. dash).
if (set -o pipefail 2>/dev/null); then
  set -o pipefail
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  alembic upgrade head
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  python -m app.seed
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
