# ADR-003: Split Compose for Dev/Prod

## Status
Accepted

## Context
Single compose file mixed local development and public deployment concerns.

## Decision
- `docker-compose.dev.yml` for local development.
- `docker-compose.prod.yml` for VPS deployment with Caddy reverse proxy.

## Consequences
- Clear separation of security/runtime defaults.
- Explicit environment files for each target mode.
