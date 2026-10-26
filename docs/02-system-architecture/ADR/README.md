# Architecture Decision Records — Index

## Document control

| Field | Value |
|---|---|
| Document ID | DH-ARCH-ADR-INDEX |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Baseline |
| Owner | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Index of all Architecture Decision Records for DataHub and the rules for adding or superseding them.
- **Scope.** Significant technology and architecture decisions for v1 (MASTER Part 5 item 14).
- **Assumptions.** A-01 … A-15 as referenced in each ADR.
- **Decisions.** ADR-0001 … ADR-0015 listed below.
- **Dependencies.** `ENGINEERING_BASELINE.md`; [SAD](../SAD.md), [HLD](../HLD.md), [SDD](../SDD.md), [DFD](../DFD.md).
- **Acceptance criteria.** Every ADR has Context, Decision, Alternatives, Tradeoffs, Consequences and Status sections; every ADR is listed here; file names follow `ADR-NNNN-<slug>.md`.

---

## Records

| ADR | Title | Status | Date |
|---|---|---|---|
| [ADR-0001](ADR-0001-modular-monolith.md) | Modular monolith with Celery workers | Accepted | 2026-10-26 |
| [ADR-0002](ADR-0002-fastapi-sync-sqlalchemy-psycopg3.md) | FastAPI with synchronous SQLAlchemy 2 and psycopg 3 | Accepted | 2026-10-26 |
| [ADR-0003](ADR-0003-nextjs-app-router-same-origin-api.md) | Next.js App Router with same-origin /api proxy | Accepted | 2026-10-26 |
| [ADR-0004](ADR-0004-celery-redis-task-queue.md) | Celery with Redis broker over ARQ or RQ | Accepted | 2026-10-26 |
| [ADR-0005](ADR-0005-s3-compatible-storage-seaweedfs-r2.md) | S3-compatible object storage: SeaweedFS in dev, R2 or S3 in prod | Accepted | 2026-10-26 |
| [ADR-0006](ADR-0006-direct-to-s3-multipart-uploads.md) | Direct-to-S3 multipart resumable uploads with presigned part URLs | Accepted | 2026-10-26 |
| [ADR-0007](ADR-0007-server-side-page-rendering.md) | Server-side page rendering with pypdfium2 and Pillow instead of PDF.js | Accepted | 2026-10-26 |
| [ADR-0008](ADR-0008-opaque-db-sessions-csrf.md) | Opaque DB-backed sessions in HttpOnly cookies with double-submit CSRF instead of JWT | Accepted | 2026-10-26 |
| [ADR-0009](ADR-0009-micro-usd-double-entry-ledger.md) | Integer micro-USD amounts and an append-only double-entry ledger | Accepted | 2026-10-26 |
| [ADR-0010](ADR-0010-clamav-fail-closed.md) | ClamAV malware scanning, fail-closed | Accepted | 2026-10-26 |
| [ADR-0011](ADR-0011-optimistic-locking-annotations.md) | Optimistic locking for annotation drafts | Accepted | 2026-10-26 |
| [ADR-0012](ADR-0012-transactional-email-outbox.md) | Transactional outbox for email | Accepted | 2026-10-26 |
| [ADR-0013](ADR-0013-single-vm-compose-caddy.md) | Single-VM Docker Compose with Caddy for production (no Kubernetes) | Accepted | 2026-10-26 |
| [ADR-0014](ADR-0014-postgres-rbac-permission-codes.md) | Postgres-backed RBAC with permission codes | Accepted | 2026-10-26 |
| [ADR-0015](ADR-0015-websocket-redis-pubsub-realtime.md) | WebSocket with Redis pub/sub for realtime events | Accepted | 2026-10-26 |

## Process

1. Copy the structure of an existing ADR; take the next free number; use a lowercase hyphenated slug.
2. Status values: `Proposed`, `Accepted`, `Superseded by ADR-NNNN`, `Deprecated`.
3. Accepted ADRs are immutable except for status changes; a change of decision is a new ADR that supersedes the old one.
4. Any ADR that changes a canonical decision must be accompanied by an amendment entry in `DECISION_LOG.md` and an update of `ENGINEERING_BASELINE.md`.
