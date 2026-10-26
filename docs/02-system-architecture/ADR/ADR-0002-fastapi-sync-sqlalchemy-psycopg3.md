# ADR-0002: FastAPI with synchronous SQLAlchemy 2 and psycopg 3

## Document control

| Field | Value |
|---|---|
| ADR | ADR-0002 |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Accepted (2026-10-26) |
| Document status | Baseline |
| Deciders | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Record the decision "FastAPI with synchronous SQLAlchemy 2 and psycopg 3" with its context, alternatives and consequences.
- **Scope.** DataHub v1 architecture; applies to all environments unless stated.
- **Assumptions.** A-03.
- **Decisions.** This ADR (ADR-0002). Related ADRs are listed in [README.md](README.md).
- **Dependencies.** Baseline §3; HLD §2.
- **Acceptance criteria.** Implementation and all architecture documents (SAD, HLD, LLD, SDD, DFD) are consistent with the Decision section; any deviation requires a superseding ADR and a `DECISION_LOG.md` entry.

---

## Status

Accepted — 2026-10-26.

## Context

The API needs typed request/response validation, generated OpenAPI for the TypeScript client, and a mature ORM with migrations. Most endpoints are short CRUD/transactional operations; file bytes never pass through the API (ADR-0006). The team is more productive with synchronous code, and the financial code relies heavily on explicit transactions and row locks that are easier to reason about synchronously. A WebSocket endpoint is required (ADR-0015).

## Decision

Use Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2.0 ORM in **synchronous** mode with the psycopg 3 driver, Alembic for migrations, uv for dependency management. HTTP handlers are plain `def` functions executed in the AnyIO threadpool; one `Session` per request created by a dependency, with the outermost service owning commit/rollback. The single WebSocket endpoint is `async def` and uses `redis.asyncio` for pub/sub; it touches the DB only through short `run_in_threadpool` calls.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| FastAPI with async SQLAlchemy / asyncpg | Higher theoretical concurrency, but async ORM pitfalls (lazy loading, session sharing), harder debugging, and no benefit at 200 concurrent users where latency is DB-bound. |
| Django + DRF | Batteries included (admin, auth), but weaker typed schemas/OpenAPI, heavier ORM coupling and less natural fit for the explicit service-layer design. |
| Node.js (NestJS) backend | Single language with the frontend, but Python has the needed document tooling (pypdfium2, Pillow, python-magic) shared with workers. |

## Tradeoffs

+ Same synchronous code shared by API and Celery workers.
+ Pydantic v2 schemas generate OpenAPI → openapi-typescript types.
− Threadpool caps concurrency per process (≈ 40 threads); scale by adding Uvicorn workers/replicas.
− Mixed sync/async in one app requires care in the WebSocket handler.

## Consequences

- DB pool sized per process (`pool_size=10`, `max_overflow=10`); Postgres `max_connections` planned accordingly.
- Tests run against a real Postgres (pytest), not SQLite.
