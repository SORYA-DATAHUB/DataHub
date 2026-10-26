# ADR-0001: Modular monolith with Celery workers

## Document control

| Field | Value |
|---|---|
| ADR | ADR-0001 |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Accepted (2026-10-26) |
| Document status | Baseline |
| Deciders | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Record the decision "Modular monolith with Celery workers" with its context, alternatives and consequences.
- **Scope.** DataHub v1 architecture; applies to all environments unless stated.
- **Assumptions.** A-01, A-03.
- **Decisions.** This ADR (ADR-0001). Related ADRs are listed in [README.md](README.md).
- **Dependencies.** MASTER Part 6 (architectural approach); SAD §2, §5.
- **Acceptance criteria.** Implementation and all architecture documents (SAD, HLD, LLD, SDD, DFD) are consistent with the Decision section; any deviation requires a superseding ADR and a `DECISION_LOG.md` entry.

---

## Status

Accepted — 2026-10-26.

## Context

DataHub v1 serves one operator organisation (A-01) with ≤ 2,000 users and ≤ 200 concurrent sessions (A-03). The domain has strongly coupled invariants — a review finalisation must atomically write file decisions, earning records, ledger journals, wallet balances, notifications and audit rows. The team is small, and MASTER Part 6 asks for a modular monolith without unnecessary distributed-system complexity, while still designing for growth.

## Decision

Build the backend as one Python package `datahub` with nine business modules (`identity`, `datasets`, `processing`, `review`, `finance`, `annotation`, `messaging`, `exports`, `admin`) plus `core`. Deploy it as three process types from one image: `api` (FastAPI), `worker` (Celery), `beat` (Celery beat). Modules communicate only through `service.py` functions inside the caller's DB transaction; they never write another module's tables. Boundaries are enforced in CI with import-linter contracts. Long-running and content-handling work runs in workers, not in the request path.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| Microservices (one per module) | Independent scaling and deploys, but distributed transactions/sagas for every review-to-ledger flow, more infrastructure, network failure modes and an operations load the team cannot carry at A-03 scale. |
| Single unstructured monolith | Fastest to start, but module coupling grows quickly and blocks later extraction; makes ownership of tables unclear. |
| Serverless functions | Cold starts and execution time limits clash with 5 GB file processing and multi-hour exports; vendor lock-in. |

## Tradeoffs

+ Single ACID transaction for cross-module invariants (earnings + ledger + audit).
+ One deployable, one migration stream, simple local dev.
− All modules share a release cadence and a failure domain (mitigated by separating worker processes and queues).
− Discipline needed to keep boundaries; enforced by import-linter and code review.

## Consequences

- `apps/api/src/datahub/modules/*` layout from baseline §4 is mandatory.
- Any read-only cross-module join (admin search/analytics) must be listed in LLD.md.
- Extraction path (SAD §9 S7) stays open because modules already communicate through service interfaces.
