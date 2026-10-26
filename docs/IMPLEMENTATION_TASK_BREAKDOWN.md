# DataHub — Implementation Task Breakdown

## Purpose and rules

This is the execution backlog derived from the verified 35-document baseline. Scope is the modular monolith described by the SAD/LLD and the production API in `04-backend-api/openapi.yaml`. Each task ends with committed code/configuration, automated evidence, and a `PROJECT_STATUS.md` update. No task may weaken authorization, file safety, financial integrity, retention or audit controls to accelerate delivery.

Dependencies use task IDs below. `P0` blocks its phase gate; `P1` is required for v1 but may proceed after the phase's P0 path. Estimates are engineering days for one experienced engineer and are planning values, not commitments.

## Phase A — Foundation

| ID | Pri | Task | Dependencies | Estimate | Done evidence |
|---|---|---|---:|---:|---|
| A-01 | P0 | Create pnpm/uv monorepo manifests, editor/lint/type/test configuration and generated shared API types | docs gate | 1.0 | locked installs; lint/type smoke |
| A-02 | P0 | Scaffold FastAPI app factory, config validation, request IDs, structured redacted logging and error envelope | A-01 | 1.5 | health/error/log tests |
| A-03 | P0 | Scaffold Next.js App Router, Tailwind, shadcn primitives, themes, fonts, public/app shells and API client | A-01 | 2.0 | build + component smoke |
| A-04 | P0 | Compose PostgreSQL, Redis, SeaweedFS S3, ClamAV, Mailpit, API, worker, beat and web with health checks | A-01–03 | 2.0 | all services healthy |
| A-05 | P0 | SQLAlchemy/Alembic foundation; PostgreSQL extensions, DB roles and first migration conventions | A-02/A-04 | 2.0 | zero-to-head migration test |
| A-06 | P0 | Storage, Redis, ClamAV, Celery and SMTP adapters with startup/readiness checks | A-02/A-04 | 2.0 | real-container integration tests |
| A-07 | P1 | CI workflow: format, lint, type, unit/integration, OpenAPI generator drift, migration and container build | A-01–06 | 1.5 | clean CI-equivalent local run |
| A-08 | P0 | Environment reference, safe admin bootstrap CLI skeleton and local developer verification | A-01–07 | 1.0 | README commands executed |

**Phase A gate:** clean checkout reaches healthy web/API/dependencies; migrations reach head; worker executes an idempotent probe job; API reaches PostgreSQL/Redis/S3/ClamAV; CI-equivalent checks pass; no default production identity or secret exists.

## Phase B — Identity and roles

| ID | Pri | Task | Dependencies | Estimate | Done evidence |
|---|---|---|---:|---:|---|
| B-01 | P0 | Identity schema, seed roles/permissions and migration constraints | A gate | 2.0 | DB constraint tests |
| B-02 | P0 | Registration, verification, login/logout, Argon2id, reset/change password and enumeration-safe mail | B-01 | 3.0 | API/integration tests |
| B-03 | P0 | Opaque sessions, CSRF, expiry/revocation, lockout/rate limiting and security events | B-01/02 | 3.0 | negative security suite |
| B-04 | P0 | TOTP MFA, recovery codes, admin enrollment and step-up | B-03 | 2.5 | replay/step-up tests |
| B-05 | P0 | Permission dependency, resource-scope patterns, SoD and authorization matrix tests | B-01/03 | 3.0 | all 151 operations classified |
| B-06 | P1 | Profiles, onboarding/agreement acceptance, payout methods and contributor verification | B-02–05 | 3.0 | contributor workflow E2E slice |
| B-07 | P1 | Identity/admin/profile web routes, forms, accessibility and responsive states | B-02–06 | 4.0 | component + Playwright tests |

**Phase B gate:** registration through verified onboarding works; API—not UI—enforces role/resource rules; admin MFA is mandatory; suspension and revocation take effect immediately.

## Phase C — Dataset upload and processing

| ID | Pri | Task | Dependencies | Estimate | Done evidence |
|---|---|---|---:|---:|---|
| C-01 | P0 | Dataset/file/version/licence/upload schema and lifecycle services | B gate | 3.0 | transition/constraint tests |
| C-02 | P0 | Direct multipart init/part-list/complete/abort/resume with quota locks and safe keys | C-01 | 4.0 | interrupted real-S3 test |
| C-03 | P0 | Magic validation, SHA-256, fail-closed ClamAV and processing job records | C-01/02 | 4.0 | spoof/EICAR/outage tests |
| C-04 | P0 | ZIP safety, streaming member expansion and abandoned-session cleanup | C-03 | 3.0 | traversal/bomb/nesting tests |
| C-05 | P1 | Preview/text/metadata extraction under limits and private presigned access | C-03 | 4.0 | format corpus tests |
| C-06 | P0 | Exact duplicate and near-duplicate flags with global eligibility context | C-03 | 2.5 | duplicate race tests |
| C-07 | P1 | Dataset creation/upload/progress/details frontend with retry/cancel/resume | C-01–06 | 5.0 | large-upload E2E |

**Phase C gate:** controlled real files upload directly, resume, process, scan, hash, preview and remain private; unsafe content never becomes ready or payable.

## Phase D — Dataset review

| ID | Pri | Task | Dependencies | Estimate | Done evidence |
|---|---|---|---:|---:|---|
| D-01 | P0 | Review assignment/claim/release, per-file decisions, scores and history | C gate | 3.0 | concurrency/state tests |
| D-02 | P0 | Finalization transaction, partial approval, eligible-byte summary and correction/resubmit versions | D-01 | 4.0 | replay/rollback tests |
| D-03 | P1 | Queue, preview workspace, bulk decisions, duplicate warnings and feedback UI | D-01/02 | 5.0 | reviewer Playwright suite |

**Phase D gate:** accepted/rejected/duplicate bytes are exact, history immutable, and finalization is idempotent.

## Phase E — Earnings and payments

| ID | Pri | Task | Dependencies | Estimate | Done evidence |
|---|---|---|---:|---:|---|
| E-01 | P0 | Pricing rules, system/user wallets, balanced append-only journals and DB triggers | A/B gates | 4.0 | trigger/invariant tests |
| E-02 | P0 | Dataset earning calculation, content-tier uniqueness, holds/releases and replay safety | D-02/E-01 | 4.0 | boundary/race tests |
| E-03 | P0 | Withdrawal reservation, cancellation, dual approval, paid/failed/reversed lifecycle and proof scanning | E-01/02 | 5.0 | concurrent withdrawal/SoD tests |
| E-04 | P0 | Reconciliation, adjustments, financial audit/alerts | E-01–03 | 3.0 | induced mismatch tests |
| E-05 | P1 | Contributor wallet/withdrawal and admin finance/payment UI | E-01–04 | 5.0 | payout E2E without real transfer |

**Phase E gate:** every journal balances, retry cannot double-credit/pay, concurrent requests cannot overspend, and only explicit authorized confirmation marks a manual payment paid.

## Phase F — Annotation

| ID | Pri | Task | Dependencies | Estimate | Done evidence |
|---|---|---|---:|---:|---|
| F-01 | P0 | Projects, task generation, assignment/reassignment and lifecycle | D/E gates | 4.0 | transition/authorization tests |
| F-02 | P0 | Annotation data/version model, optimistic conflict handling and draft autosave | F-01 | 4.0 | concurrent editor tests |
| F-03 | P1 | Three-panel editor, preview navigation, transcription/correction/labels, Khmer exact round trip | C-05/F-02 | 6.0 | keyboard/Khmer/recovery tests |
| F-04 | P0 | Review/changes/version comparison and exactly-once separate annotation rewards | E-01/F-02 | 4.0 | review/reward replay tests |

**Phase F gate:** a real controlled document is assigned, edited with recovery/conflict safety, reviewed, rewarded once and export-ready.

## Phase G — Communication, administration and exports

| ID | Pri | Task | Dependencies | Estimate | Done evidence |
|---|---|---|---:|---:|---|
| G-01 | P0 | Persistent conversations/messages, scanned attachments, read state and support ACL | B/C gates | 4.0 | participant isolation tests |
| G-02 | P0 | Durable notification/email outbox and authenticated WebSocket hints | G-01 | 3.0 | provider-failure/replay tests |
| G-03 | P0 | Background exports, manifests, expiring private parts and audit | D/F gates | 4.0 | package/hash/ACL tests |
| G-04 | P1 | Admin analytics/search/settings/audit/deletion/jobs/legal-hold tools | B–G03 | 5.0 | admin contract tests |
| G-05 | P1 | Messaging, notifications, export and remaining admin UI | G-01–04 | 5.0 | role E2E workflows |

**Phase G gate:** durable communication works, important mail survives browser closure/provider faults, and authorized admins can create traceable expiring exports without blocking the API.

## Phase H — Production hardening and handover

| ID | Pri | Task | Dependencies | Estimate | Done evidence |
|---|---|---|---:|---:|---|
| H-01 | P0 | Complete unit/integration/API/Playwright critical matrix and regression coverage | A–G | 5.0 | TC-CRIT pass report |
| H-02 | P0 | SAST/dependency/container/DAST and manual threat-control verification | A–G | 3.0 | no blocking findings |
| H-03 | P0 | WCAG/keyboard/zoom/Khmer/responsive verification | web complete | 3.0 | accessibility report |
| H-04 | P0 | Load, multipart interruption, worker kill/replay and soak tests | system complete | 3.0 | targets met |
| H-05 | P0 | Production Compose/Caddy/monitoring/alerts/backups, isolated restore and rollback drill | HA-05 access | 4.0 | RPO/RTO/rollback evidence |
| H-06 | P0 | Staging deploy, smoke/E2E, operations runbooks and handover | H-01–05 | 3.0 | signed readiness record |
| H-07 | P0 | Production approval/deploy/health observation | HA-01–05, HA-07/08 | external | verified URL or explicit blocker |

## Cross-cutting definition of done

- Requirement, API operation and test IDs remain traceable; generated artifacts have no drift.
- Migration is forward-safe and tested from zero plus the prior revision.
- Backend permission and resource checks have positive and negative tests.
- State transition, audit/outbox and money/file side effects share the documented transaction boundary.
- Logs contain correlation IDs and no password, cookie, token, private content, presigned URL or payment secret.
- UI includes loading, empty, error, success, keyboard and responsive behavior.
- Relevant docs, risk register, release readiness and project status reflect executed evidence rather than intention.

## External decision gates

HA-01–04 (legal/privacy/licence/tax), HA-05 (production accounts and credentials), HA-07 (dual-payout threshold) and HA-08 (labeled upgrade) remain owner/legal/finance actions. Engineering can implement configurable defaults and staging behavior but cannot approve these decisions or claim production readiness without recorded authorization.
