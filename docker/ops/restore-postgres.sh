#!/bin/sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <backup-file.dump>" >&2
  exit 1
fi

BACKUP_FILE="$1"
case "${BACKUP_FILE}" in
  *[!A-Za-z0-9._-]* | "")
    echo "invalid backup filename: ${BACKUP_FILE}" >&2
    exit 1
    ;;
esac

compose() {
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "$@"
}

echo "[restore] stopping api"
compose stop api

echo "[restore] checking backup file"
compose exec -T db sh -lc "test -f /backups/${BACKUP_FILE}"

echo "[restore] restoring /backups/${BACKUP_FILE}"
compose exec -T db sh -lc "PGPASSWORD=\"\$POSTGRES_PASSWORD\" pg_restore -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" --clean --if-exists --no-owner \"/backups/${BACKUP_FILE}\""

echo "[restore] starting api"
compose up -d api

echo "[restore] completed"
compose ps
