# ADR-0004: Celery with Redis broker over ARQ or RQ

## Document control

| Field | Value |
|---|---|
| ADR | ADR-0004 |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Accepted (2026-10-26) |
| Document status | Baseline |
| Deciders | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Record the decision "Celery with Redis broker over ARQ or RQ" with its context, alternatives and consequences.
- **Scope.** DataHub v1 architecture; applies to all environments unless stated.
- **Assumptions.** A-03, A-10, A-12.
- **Decisions.** This ADR (ADR-0004). Related ADRs are listed in [README.md](README.md).
- **Dependencies.** Baseline §13; HLD §5; SDD §12.
- **Acceptance criteria.** Implementation and all architecture documents (SAD, HLD, LLD, SDD, DFD) are consistent with the Decision section; any deviation requires a superseding ADR and a `DECISION_LOG.md` entry.

---

## Status

Accepted — 2026-10-26.

## Context

DataHub needs background processing for file sniffing/hashing/scanning/previews, ZIP expansion, duplicate detection, exports, email delivery and scheduled jobs (session expiry, earning release, reconciliation, retention). Tasks must survive worker crashes, be routable to separate queues, support retries with backoff, time limits and periodic scheduling. The codebase is synchronous (ADR-0002).

## Decision

Use Celery 5 with Redis 8 as broker, queues `default`, `processing`, `exports`, `email`, and Celery beat (single instance) for schedules. Settings: `task_acks_late=True`, `task_reject_on_worker_lost=True`, `worker_prefetch_multiplier=1`, JSON serializer, per-task soft/hard time limits, `visibility_timeout` greater than the longest hard limit. Every task is idempotent via status guards or unique keys, and records progress in `background_job_records`.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| ARQ | Lightweight and async-native, but async-only (mismatch with sync code), smaller ecosystem, no built-in routing/beat equivalent of Celery's maturity. |
| RQ | Simple and synchronous, but weaker scheduling (needs rq-scheduler), fewer reliability knobs (no acks_late semantics), fewer routing options. |
| Dramatiq | Good reliability model, but smaller ecosystem and no first-party beat; team familiarity lower. |
| Postgres-backed queue (e.g. procrastinate) | Transactional enqueue, but adds DB load from polling large processing workloads; less tooling. |

## Tradeoffs

+ Mature retries, routing, time limits, beat, Flower-compatible monitoring.
+ Same code and image as the API.
− Redis is not durable by default: an un-started task can be lost on Redis restart; mitigated by DB status as source of truth and the stalled-work sweep described in SDD §8.
− Celery configuration surface is large; settings are centralised in `worker.py`.

## Consequences

- Messages contain IDs only, never file content or secrets.
- Queue depth and task failure metrics are exported and alerted on.
