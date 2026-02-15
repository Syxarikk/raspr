# ADR-002: Access + Refresh Session Model

## Status
Accepted

## Context
Single JWT without refresh lifecycle did not allow safe logout/rotation.

## Decision
- Access token: short-lived JWT.
- Refresh token: long-lived JWT + DB-backed session (`refresh_sessions`).
- Refresh token rotation on each `/auth/refresh`.
- `/auth/logout` revokes session and clears cookie.

## Consequences
- Better session control and revocation.
- Requires DB migration and cookie configuration.
