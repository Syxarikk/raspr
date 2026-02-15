#!/bin/sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
BUILD_IMAGES="${BUILD_IMAGES:-1}"

compose() {
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "$@"
}

echo "[rollback] deploying currently checked out release"
if [ "${BUILD_IMAGES}" = "1" ]; then
  compose up -d --build db db-backup api admin miniapp standalone caddy
else
  compose up -d db db-backup api admin miniapp standalone caddy
fi

echo "[rollback] done"
compose ps
