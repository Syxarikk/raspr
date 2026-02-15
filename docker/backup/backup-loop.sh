#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_FORMAT="${BACKUP_FORMAT:-c}"
BACKUP_PREFIX="${BACKUP_PREFIX:-adcontrol}"

mkdir -p "${BACKUP_DIR}"

if [ -z "${POSTGRES_DB:-}" ] || [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_PASSWORD:-}" ]; then
  echo "POSTGRES_DB, POSTGRES_USER and POSTGRES_PASSWORD are required" >&2
  exit 1
fi

export PGPASSWORD="${POSTGRES_PASSWORD}"

backup_once() {
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  filename="${BACKUP_PREFIX}_${POSTGRES_DB}_${timestamp}.dump"
  target="${BACKUP_DIR}/${filename}"

  echo "[backup] starting ${filename}"
  pg_dump \
    --host="${POSTGRES_HOST:-db}" \
    --port="${POSTGRES_PORT:-5432}" \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --format="${BACKUP_FORMAT}" \
    --file="${target}"
  echo "[backup] completed ${filename}"

  find "${BACKUP_DIR}" -type f -name "${BACKUP_PREFIX}_${POSTGRES_DB}_*.dump" -mtime +"${BACKUP_RETENTION_DAYS}" -delete
}

backup_once

while true; do
  sleep "${BACKUP_INTERVAL_SECONDS}"
  backup_once
done
