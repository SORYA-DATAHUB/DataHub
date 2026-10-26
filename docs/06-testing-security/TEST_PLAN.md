# DataHub — Test Plan

## Document control

| Field | Value |
|---|---|
| Purpose | Define how DataHub is verified from unit level through release acceptance. |
| Scope | Web, API, PostgreSQL constraints, workers, Redis, private object storage, ClamAV, email, exports, deployment and recovery. |
| Assumptions | Canonical assumptions A-01–A-15 in `../ENGINEERING_BASELINE.md`; tests use synthetic, non-sensitive data and never transfer real money. |
| Decisions | Real PostgreSQL and S3-compatible storage are used for integration tests; external SMTP and payment execution are replaced by controlled test adapters. |
| Dependencies | SRS, OpenAPI, Security Requirements, Threat Model, Database Schema, Deployment Plan and `TEST_CASES.md`. |
| Acceptance criteria | Every release gate in §13 has objective evidence; critical failures block release; results are recorded in `PROJECT_STATUS.md` and `RELEASE_READINESS.md`. |
| Status | Documentation baseline v1; execution begins with implementation. |

## 1. Objectives and principles

Testing proves business correctness, isolation of private data, exactly-once financial effects, recoverability, accessibility, and operational fitness. Tests are deterministic, independently repeatable, and mapped to requirement IDs. A passed test means an executed assertion against a named build and environment—not that a test case merely exists.

Risk determines depth: authorization, file safety, ledger integrity, payout reservation, and restore procedures receive negative, concurrency, and fault-injection coverage. Production data is prohibited from development and CI.

## 2. Test levels

| Level | Tooling / environment | Required coverage |
|---|---|---|
| Backend unit | pytest, pure service collaborators | pricing arithmetic, state machines, validators, object-key generation, permissions |
| Frontend unit/component | Vitest, Testing Library, axe | forms, tables, route guards, uploader state, editor conflict UX, keyboard behavior |
| Database integration | pytest + PostgreSQL 17 | constraints, transactions, locks, append-only ledger, migrations, query scoping |
| Service integration | Docker Compose | API, worker, Redis, SeaweedFS, ClamAV, Mailpit; real object round trips |
| Contract/API | pytest/httpx + OpenAPI validator | all operations, schemas, errors, pagination, filters, idempotency |
| End-to-end | Playwright | the eight mandatory workflows in §8 across desktop and mobile where applicable |
| Security | Semgrep/Bandit, pip-audit, npm audit, Trivy, ZAP baseline plus manual abuse cases | SRS-SEC and threat mitigations |
| Performance/reliability | k6 or Locust; Toxiproxy/network interruption | latency, concurrent upload, queues, retries, resumability |
| Recovery | isolated restore environment | database/object recovery, reconciliation and integrity evidence |

## 3. Environments and test data

- CI uses ephemeral PostgreSQL, Redis, S3-compatible storage, ClamAV and Mailpit containers pinned to reviewed versions.
- Staging mirrors production topology and security headers but uses separate credentials, buckets, email domain and synthetic identities.
- Controlled personas: contributor A/B, annotator, reviewer, admin, super administrator. No shared sessions.
- Corpus includes valid supported formats, extension/MIME mismatch, EICAR test file, corrupt documents, duplicate hashes, near-duplicates, ZIP traversal names, nested archives and compression-bomb fixtures capped to safe CI sizes.
- Clocks and UUIDs may be injected in unit tests; concurrency tests use real independent database connections.

## 4. Unit and integration strategy

Backend unit tests cover every state transition, rounding boundary (0, 1 byte, 999,999,999 and 1,000,000,000 bytes), and rejection reason. Integration tests assert rollback on partial failure, deferred zero-sum ledger constraints, unique idempotency keys, `SELECT FOR UPDATE` serialization, resource ownership and outbox atomicity.

Frontend tests cover validation, loading/empty/error/success states, focus restoration, theme contrast, responsive navigation, file progress/retry/cancel, autosave indicators, version-conflict recovery and destructive/financial confirmations.

## 5. API and migration testing

Every OpenAPI operation must have one authorized success case and applicable 400/401/403-or-404/409/422/429 cases. Responses are schema-validated. Pagination must be stable under concurrent inserts. Migration tests create a database from zero, upgrade to head, validate schema, and rehearse the documented downgrade or forward-fix path. CI rejects model/schema drift and invalid OpenAPI.

## 6. Security and accessibility testing

Security tests exercise session fixation, CSRF, origin checks, password reset replay, MFA enforcement, horizontal/vertical access, signed-URL expiry, upload content spoofing, archive traversal, stored XSS, injection, rate limits, audit integrity and log redaction. ClamAV unavailable/error must fail closed.

WCAG 2.2 AA checks combine axe scans with keyboard-only journeys, focus order, visible focus, names/roles, error association, 200% zoom, reduced motion, color contrast, Khmer rendering and screen-reader spot checks. The desktop-optimized annotation editor must expose an accessible alternative for all essential actions.

## 7. Performance and reliability targets

At the A-03 workload, non-file API requests target p95 < 300 ms and p99 < 1,000 ms with error rate < 0.5%, matching the canonical baseline. A file up to the configured maximum (currently 4 GB under AM-01) must resume after interruption without retransmitting confirmed parts or corrupting SHA-256. Worker tests prove bounded retries, idempotent replay and visible dead/final failure. Load scenarios cover 200 sessions, 50 uploads, review queue search, messaging and export submission.

## 8. Mandatory end-to-end scenarios

1. Register → verify email → onboard → upload → process → review → approve → earning journal.
2. Request payout → reserve → dual approval when required → record external reference → contributor sees paid entry.
3. Create project → assign → transcribe/autosave/submit → review/approve → export source plus annotation.
4. Contributor A requests contributor B's dataset/file URL and receives non-disclosing denial.
5. Previously paid hash is uploaded again and cannot automatically earn twice.
6. Multipart upload disconnects, resumes from authoritative part list and verifies final hash.
7. Dataset approval is replayed concurrently and creates one earning journal.
8. Encrypted database backup is restored in isolation; schema, counts, ledger balance and sampled object checksums match.

## 9. Disaster recovery and regression

Quarterly restore drills follow `../07-deployment-operations/BACKUP_DISASTER_RECOVERY.md`. Evidence includes backup identifier, times, operator, target, checksum/count comparison, RPO/RTO result and cleanup. Each defect gets a regression test at the lowest effective layer. Critical workflows run on every release candidate.

## 10. Entry, exit and defect policy

Entry requires versioned build, migrated environment, seeded synthetic fixtures and healthy dependencies. Exit requires all critical and high-priority cases passed, no open severity-1/2 defects, security scans reviewed, accessibility critical/serious findings resolved, performance targets met or explicitly risk-accepted, and recovery evidence current.

Severity 1 is exploitable data/financial loss or unavailable core service; severity 2 is broken critical workflow or authorization weakness; both block release. Flaky tests are failures until quarantined with an owner, issue and expiry—never silently retried into green.

## 11. CI execution

Pull requests run format, lint, type, unit, component, integration, migration, OpenAPI and dependency checks. Main/release builds add containers and security scans. Staging runs smoke, E2E, ZAP and performance smoke tests. Production deployment requires human approval, immutable artifacts, migration preflight, health checks and post-deploy smoke tests.

## 12. Evidence and ownership

QA owns the test matrix; module engineers own unit/integration failures; Security owns security disposition; SRE owns load and recovery evidence; Product accepts business workflows. CI reports, Playwright traces, scan reports and restore records are retained with the release identifier. Secrets, tokens and document contents are redacted.

## 13. Release acceptance gates

- `openapi.yaml` validates and implementation drift is zero.
- Database upgrades from zero and previous release succeed.
- All TC-CRIT cases in `TEST_CASES.md` pass.
- Authorization matrix has automated allow/deny coverage.
- Ledger journals remain zero-sum; replay and concurrent withdrawal tests pass.
- Malware, archive and private-download controls pass.
- No unresolved critical/high exploitable vulnerability.
- Axe has no critical/serious issues on required routes; manual keyboard suite passes.
- Performance, upload reliability, backup restore and rollback smoke meet targets.
- Evidence and residual-risk approvals are linked from release readiness.
