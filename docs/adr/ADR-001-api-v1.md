# ADR-001: Versioned API (`/api/v1`)

## Status
Accepted

## Context
Previous API routes were unversioned and hard to evolve safely.

## Decision
All public endpoints are exposed under `/api/v1`.

## Consequences
- Breaking changes are isolated to version boundaries.
- Clients must call `/api/v1/...`.
