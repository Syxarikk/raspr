# AdControl Rollout Runbook (Single VPS)

This runbook defines the stage-6 operational flow: staging validation, canary rollout, rollback, and backup/restore.

## 1. Preflight

Run from repository root:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod config >/tmp/adcontrol-prod-compose.txt
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
```

Validate that `.env.prod` contains:
- `POSTGRES_*`
- `DATABASE_URL`
- `SECRET_KEY`, `REFRESH_SECRET_KEY`
- `API_HOST`, `ADMIN_HOST`, `MINIAPP_HOST`, `STANDALONE_HOST`
- `BACKUP_INTERVAL_SECONDS`, `BACKUP_RETENTION_DAYS`

Replace example hostnames in commands with your actual domain values.

## 2. Staging Validation

Use an isolated env file (`.env.staging`) with staging hosts and DB.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.staging up -d --build
curl -fsS "https://staging-api.example.com/api/v1/health"
```

Recommended checks:
- Auth login and refresh flow.
- Operator flow: order -> photo review -> payout status.
- Promoter flow: Telegram login -> upload photo -> payout visibility.

## 3. Canary Rollout (Single VPS Safe Sequence)

Deploy gradually on production host:

```bash
# 1) core services first
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d db db-backup api

# 2) health gate
curl -fsS "https://api.example.com/api/v1/health"
curl -fsS "https://api.example.com/api/v1/metrics"

# 3) UI services
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d admin miniapp standalone

# 4) edge routing
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d caddy
```

Or run the scripted flow:

```bash
./docker/ops/canary-rollout.sh
```

Post-check:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

## 4. Daily Backups

`db-backup` service creates dumps in volume `pgbackups` every `BACKUP_INTERVAL_SECONDS` seconds.

List backups:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm db-backup sh -lc 'ls -lah /backups'
```

Check backup logs:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=100 db-backup
```

## 5. Restore Procedure

Stop API before restore:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod stop api
```

Restore selected dump:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T db \
  sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner /backups/<dump-file>.dump'
# or:
./docker/ops/restore-postgres.sh <dump-file>.dump
```

If needed, copy the dump into DB container first:

```bash
docker cp <dump-file>.dump "$(docker compose -f docker-compose.prod.yml --env-file .env.prod ps -q db)":/backups/
```

Start API and verify health:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d api
curl -fsS "https://api.example.com/api/v1/health"
```

## 6. Application Rollback

1. Checkout previous release tag/commit on server.
2. Rebuild and restart services:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
# or:
./docker/ops/rollback-release.sh
```

3. If schema/data incompatibility exists, restore DB from latest good dump.
4. Verify health and critical flows.
