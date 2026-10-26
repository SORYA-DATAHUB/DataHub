# DataHub — Project Status

_Last updated: 2026-10-26 (Phase A acceptance milestone)_

## Current project phase

**PHASE B — Identity and roles (ready to start).** Phase A passed its acceptance gate: locked monorepo dependencies, production-image builds, automatic migrations, infrastructure health checks, API dependency readiness and a real Celery task round-trip are verified. The canonical design remains `ENGINEERING_BASELINE.md`; the original brief is preserved in `_source/MASTER_PROMPT.md`.

## Documentation checklist — 35/35 verified

Verification means the deliverable is substantive, has its required contract sections, is syntactically reviewable, and has no currently identified release-blocking inconsistency. File existence alone is not completion.

### 1. Business & Product — 6/6

- [x] 1 Business Requirements Document
- [x] 2 Product Requirements Document
- [x] 3 Software Requirements Specification
- [x] 4 Product Roadmap
- [x] 5 User Stories & Acceptance Criteria
- [x] 6 Pricing & Payout Policy

### 2. System Architecture — 8/8

- [x] 7 SAD · [x] 8 HLD · [x] 9 LLD · [x] 10 SDD
- [x] 11 ERD · [x] 12 Database Schema · [x] 13 DFD · [x] 14 ADR set (15 ADRs plus index)

### 3. UI/UX Design — 4/4

- [x] 15 UI/UX Design
- [x] 16 Wireframes & Mockups (eight route groups plus index)
- [x] 17 User Flows
- [x] 18 Design System

### 4. Backend & API — 4/4

- [x] 19 API Documentation (151 generated operations)
- [x] 20 OpenAPI Specification (OpenAPI 3.1.0; 135 paths, 222 schemas)
- [x] 21 Authentication & Authorization
- [x] 22 File Upload & Storage

### 5. Data Management & Annotation — 5/5

- [x] 23 Dataset Documentation · [x] 24 Annotation Guidelines · [x] 25 Data Quality & Review
- [x] 26 Privacy, Ownership & Licensing (legal-review clauses explicitly gated)
- [x] 27 Retention & Deletion

### 6. Testing & Security — 4/4

- [x] 28 Test Plan · [x] 29 Test Cases & Acceptance Testing
- [x] 30 Security Requirements · [x] 31 Threat Model

### 7. Deployment & Operations — 3/3

- [x] 32 Deployment Plan · [x] 33 Docker & CI/CD · [x] 34 Backup & Disaster Recovery

### 8. User Documentation — 1/1

- [x] 35 README & Developer Setup Guide (planned commands clearly identified; four role guides exist under `08-user-documentation/`)

## Implementation checklist

- [x] Phase A Foundation
- [ ] Phase B Identity and roles
- [ ] Phase C Dataset upload
- [ ] Phase D Dataset review
- [ ] Phase E Earnings and payments
- [ ] Phase F Annotation
- [ ] Phase G Communication and exports
- [ ] Phase H Production hardening

Phase A is complete and verified locally. Phase B is the next implementation phase; no Phase B identity feature is claimed yet.

## Completed tasks

- Reconstructed the existing repository rather than resetting genuine progress.
- Confirmed all 35 mandatory deliverable paths now contain substantive content.
- Added the missing Test Plan, Test Cases, Threat Model, Backup/DR Plan and root README.
- Added `RELEASE_READINESS.md` with explicit status vocabulary and a current NO-GO verdict.
- Parsed `openapi.yaml` successfully as OpenAPI 3.1.0 (130 paths, 213 schemas).
- Checked Markdown code fences; none are unbalanced. Confirmed 60 Mermaid sources.
- Added and generated admin deletion-decision, background-job inspection/requeue and legal-hold contracts with MFA, separation-of-duties, blocker and idempotency rules.
- Reconciled every active file-size reference to the AM-01 limit of 4,000,000,000 bytes.
- Verified 239 unique SRS requirements and synchronized counts in the PRD and RTM.
- Created `IMPLEMENTATION_TASK_BREAKDOWN.md` with phase dependencies, estimates, evidence and gates.
- Scaffolded the pnpm/uv monorepo, shared package, Next.js application and FastAPI application with locked dependencies.
- Added structured settings/logging, request IDs, security headers, liveness/readiness routes and dependency checks for PostgreSQL, Redis, S3 and ClamAV.
- Added Celery worker and scheduler foundations with late acknowledgement and a verified queue probe.
- Added Alembic configuration and the tracked `0001_foundation` migration; Compose now gates API/worker startup on an idempotent migration service.
- Added production-oriented, non-root API/web container images and a health-checked local stack for PostgreSQL, Redis, SeaweedFS S3, ClamAV and Mailpit.
- Added CI jobs for documentation drift, Python and TypeScript quality gates, tests, builds, migration validation and container builds.

## Remaining tasks

1. Begin Phase B with the identity schema migration and repository/service boundaries.
2. Implement registration, verified-email activation, login, refresh rotation, logout and password reset.
3. Implement RBAC/resource authorization, contributor verification and administrative MFA foundations.
4. Add Phase B API, integration and authorization tests before opening Phase C.

## Blockers

- **Production later:** HA-05 hosting/domain/DNS/SMTP/storage/monitoring access is unavailable.
- **Public launch later:** HA-01–04 and HA-07/08 require legal, finance or owner approval.

## Decisions and risks

- Modular monolith; Next.js/FastAPI/PostgreSQL/Redis/Celery/private S3-compatible storage.
- Integer micro-USD, versioned pricing and append-only balanced ledger.
- Direct multipart uploads; hostile files quarantined and ClamAV fail-closed.
- Initial RPO 24 hours/RTO 4 hours; optional tested WAL archiving targets 15 minutes.
- Legal/licensing/privacy/tax terms remain drafts; admin export/payout insider risk requires MFA, separation of duties and audit.
- Single-VM compute is the accepted initial availability tradeoff; offsite backup and rebuild automation are mandatory.

## Test results

| Check | Result | Scope / limitation |
|---|---|---|
| Documentation completeness/consistency gate | PASS (35/35) | 239 unique requirements; generated contracts synchronized |
| OpenAPI YAML parse and generator check | PASS | 151 operations, 135 paths, 222 schemas; external `openapi-spec-validator` package unavailable locally |
| Markdown fence balance | PASS | Syntax heuristic, not prose correctness |
| Backend lint/type/unit tests | PASS | Ruff; strict mypy across 9 source files; 4 pytest tests passed |
| Frontend lint/type/unit tests | PASS | ESLint; TypeScript; 1 Vitest test passed |
| Production image builds | PASS | API and Next.js standalone images built successfully as non-root users |
| Compose integration smoke test | PASS | All long-running services healthy; one-shot migration/storage setup exited 0 |
| API dependency readiness | PASS | PostgreSQL, Redis, S3 and ClamAV reported `ok` |
| Database migration | PASS | `0001_foundation (head)`; automatic startup gate verified idempotently |
| Background queue | PASS | Celery probe enqueued, executed by worker and returned a task-specific result |
| Security/performance/accessibility/restore | NOT RUN | Planned specifications only |

## Deployment status

The reproducible local development stack is running and verified. No staging or production deployment, credentials, URL or successful production smoke test is claimed.

## Next action

Begin Phase B identity implementation from the approved contracts; keep email verification, administrator MFA and backend/resource-level authorization as release gates.
