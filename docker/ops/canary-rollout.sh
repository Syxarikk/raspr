#!/bin/sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"

compose() {
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "$@"
}

echo "[rollout] starting core services"
compose up -d db db-backup api

echo "[rollout] waiting for API health"
compose exec -T api python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')"
compose exec -T api python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/metrics')"

echo "[rollout] starting UI services"
compose up -d admin miniapp standalone

echo "[rollout] enabling edge routing"
compose up -d caddy

echo "[rollout] completed"
compose ps
