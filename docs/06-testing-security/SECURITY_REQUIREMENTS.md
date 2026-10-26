# DataHub — Security Requirements

## Document control

| Field | Value |
|---|---|
| Document | Security Requirements Document (mandatory doc #30) |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Baseline |
| Owner | Security lead |
| Approvers | CTO role; Backend lead; DevOps lead |
| Canonical source | [`../ENGINEERING_BASELINE.md`](../ENGINEERING_BASELINE.md) v1.1 including §16 amendments AM-01 … AM-14 (wins on conflict until amended via `DECISION_LOG.md`) |
| Related | [`THREAT_MODEL.md`](THREAT_MODEL.md) · [`../01-business-product/SRS.md`](../01-business-product/SRS.md) §8 (SEC-01 … SEC-22) · [`../04-backend-api/AUTH_AUTHORIZATION.md`](../04-backend-api/AUTH_AUTHORIZATION.md) · [`../04-backend-api/FILE_UPLOAD_STORAGE.md`](../04-backend-api/FILE_UPLOAD_STORAGE.md) · [`../02-system-architecture/SAD.md`](../02-system-architecture/SAD.md) §7 · [`../02-system-architecture/DFD.md`](../02-system-architecture/DFD.md) · [`../01-business-product/PRICING_PAYOUT_POLICY.md`](../01-business-product/PRICING_PAYOUT_POLICY.md) · [`../RISK_REGISTER.md`](../RISK_REGISTER.md) |

## Header block

**Purpose.** This document turns the security requirements of the SRS (SEC-01 … SEC-22) and the security-relevant functional and non-functional requirements into **numbered, testable controls `SC-nn`**. Each control states what must be built or configured, which requirement it satisfies and how it is verified. THREAT_MODEL.md cites these controls as mitigations. TEST_CASES.md implements the referenced test IDs.

**Scope.** All of DataHub v1: the Next.js web app, the FastAPI API, Celery workers and beat, PostgreSQL, Redis, ClamAV, object storage (SeaweedFS in dev, Cloudflare R2 or AWS S3 in prod), Caddy, SMTP, Sentry, backups, the CI/CD pipeline and the production host. It covers authentication, authorization, encryption, secrets, input validation, file safety and malware scanning, web and API security, logging, privacy, abuse prevention, financial integrity, backups, incident response, dependency security and production hardening (MASTER_PROMPT Part 5 item 30, Part 16, Part 24). Out of scope: physical security of provider data centres, the security of external payment rails (DataHub never moves money, FR-PAY-14), and buyer features (v2).

**Assumptions.**
- A-01 single operator; A-03 scale (≤ 2,000 users, ≤ 200 concurrent sessions); A-04 integer micro-USD; A-10 fail-closed scanning; A-12 any SMTP provider; A-15 retention defaults.
- Production runs on one Linux VM with Docker Compose behind Caddy and uses managed object storage (ADR-0013, SAD §8.2).
- Web app and API share one public origin (`WEB_ORIGIN`), with Caddy routing `/api/*` to the API. Object storage has its own, separate origin.
- Only staff with server access operate the host. There is no multi-tenant hosting.
- Legal obligations (HA-01 … HA-04) are not settled yet. Where a control depends on them, this document says so.

**Decisions.** This document fixes the following values. Where an earlier document says otherwise, the baseline amendments and this document apply, and the earlier document must be aligned (§2.3).
1. Argon2id parameters are **m = 64 MiB, t = 3, p = 1**, with a 16-byte salt and a 32-byte hash (SC-01).
2. Session lifetimes follow AM-08: non-admin sessions expire after 7 days idle or 30 days absolute; sessions of users holding `admin` or `super_admin` expire after **30 min idle or 12 h absolute**. Step-up MFA is valid for 15 min. Login lockout: **5 failures in 15 min lock the account for 15 min** (SC-04, SC-07).
3. The per-file limit is **4,000,000,000 bytes** for every upload and every extracted ZIP member. Windowed scanning does not exist (AM-01, SC-38, SC-39).
4. MFA recovery codes are stored as **HMAC-SHA-256 with a server-side pepper** rather than as a plain SHA-256. A database-only leak then gives no offline guessing oracle for the 50-bit codes (SC-09).
5. The CSP is nonce-based with `'strict-dynamic'`, generated per request by Next.js middleware (SC-46).
6. The public firewall allows only 80/443. SSH is key-only and reachable only from the admin allowlist or VPN (SC-85, SC-86).
7. Backups: `pg_dump` is encrypted with **age**. Host configuration and volumes go into an encrypted **restic** repository. The object-storage replica (AM-13) is written through an **rclone crypt** remote, so every backup is encrypted before it leaves the host (SC-26, SC-75).
8. Application logs are kept for 30 days, security events for 1 year, and audit and financial records for 7 years (SC-60).

**Dependencies.** ENGINEERING_BASELINE.md §§3, 5, 6, 7, 8, 9, 12, 13, 14, 16. SRS.md (SEC-01 … SEC-22, FR-AUTH, FR-PAY, FR-PROC, NFR-INT, NFR-OBS, NFR-AVL). AUTH_AUTHORIZATION.md (flows, Appendix A matrix). FILE_UPLOAD_STORAGE.md (pipeline, keys, bucket configuration). DFD.md (classification, boundaries TB0 … TB5). PRICING_PAYOUT_POLICY.md (PP-xx financial controls). Consumers: THREAT_MODEL.md, TEST_PLAN.md, TEST_CASES.md, DEPLOYMENT_PLAN.md, DOCKER_CICD.md, BACKUP_DISASTER_RECOVERY.md, REQUIREMENTS_TRACEABILITY.md.

**Acceptance criteria for this document.**
1. Every control has a unique ID `SC-nn`, a "shall" statement with concrete values, ≥ 1 SRS `SEC-xx` mapping, and ≥ 1 test ID that follows the rule **SEC-nn → TC-SEC-0nn**.
2. Every SRS requirement SEC-01 … SEC-22 is covered by ≥ 1 control (§21.2).
3. All values agree with ENGINEERING_BASELINE.md including AM-01 … AM-14. Deviations found in earlier documents are listed in §2.3.
4. Every section required by MASTER_PROMPT Part 5 item 30 is present (§§4–20).
5. Every mitigation cited in THREAT_MODEL.md resolves to a control in this document.

---

## 1. Conventions

- **Control ID** `SC-nn`. IDs are stable and are never reused.
- **Priority** follows the SRS MoSCoW scheme. Every control in this document is **M** (Must, release blocker) unless marked **S**.
- **Verification**: **T** automated test, **I** inspection (code, configuration or document review), **D** demonstration or drill on staging, **P** penetration test (SEC-22).
- **Test IDs.** A control mapped to `SEC-nn` is verified by `TC-SEC-0nn` (for example SEC-04 → TC-SEC-004). TEST_CASES.md holds one test-case group per SEC requirement, and each control listed under that group adds at least one case to it. Security behaviour that is also a functional requirement is additionally covered by the module's `TC-<MOD>-nnn` cases for that FR.
- "Admin session" means a session of a user holding `admin` or `super_admin` (SRS §1.2).
- Paths are relative to `/api/v1`.

## 2. Security principles and alignment

### 2.1 Principles

1. **Deny by default.** No endpoint, bucket, port or role grants anything that is not explicitly listed.
2. **Defence in depth.** Each critical asset has at least two independent controls, for example authorization in the service layer plus a database constraint.
3. **Fail closed.** Scanning (A-10), auth rate limiting and MFA gates refuse when a dependency is unavailable.
4. **Least privilege.** This applies to roles (BL §6), database and storage credentials, containers and humans.
5. **Untrusted content stays inert.** Uploaded bytes are never executed, never rendered as active content and never fetched from the network (TB3).
6. **Everything financial is append-only, idempotent and reconciled** (BL §8.5).
7. **Secrets never appear in code, logs, URLs or error messages.**

### 2.2 Data classification

The classes Public, Internal, Confidential and Restricted are defined in DFD.md §2 and are normative. Every control below is calibrated to the highest class it protects.

### 2.3 Alignment items (earlier documents superseded by the baseline amendments)

| Item | Earlier text | Binding value | Owner of the alignment edit |
|---|---|---|---|
| Login lockout | AUTH_AUTHORIZATION §5/§13/§18: 10 consecutive failures | **5 failures / 15 min → 15 min lock** (AM-08, FR-AUTH-07) | Backend lead |
| Admin session lifetime | AUTH_AUTHORIZATION §7/§10/§18: 12 h idle, 30 d absolute | **30 min idle / 12 h absolute** (AM-08, FR-AUTH-10) | Backend lead |
| Argon2id parallelism | AUTH_AUTHORIZATION §4/§18: p = 4 | **p = 1** (this document, Decision 1; satisfies SEC-01 "parallelism ≥ 1") | Backend lead |
| Recovery-code storage | AUTH_AUTHORIZATION §9: SHA-256 | **HMAC-SHA-256 with pepper** (Decision 4) | Backend lead |
| Per-file limit and scanning | FILE_UPLOAD_STORAGE §2/§9 and SRS FR-UPL-02: 5 GB, windowed scanning, clamd 2000M | **4,000,000,000 B, whole-stream scan only, clamd `StreamMaxLength/MaxScanSize/MaxFileSize 4000M`** (AM-01) | Backend lead |
| Login rate per IP | AUTH_AUTHORIZATION §13: 20/min per IP | **20 per 15 min per IP** (SRS SEC-06). Where two documents differ, the stricter limit applies. | Backend lead |

---

## 3. Control summary

| Section | Controls | Count |
|---|---|---:|
| §4 Authentication security | SC-01 … SC-13 | 13 |
| §5 Authorization | SC-14 … SC-21 | 8 |
| §6 Encryption | SC-22 … SC-26 | 5 |
| §7 Secrets management | SC-27 … SC-30 | 4 |
| §8 Input validation | SC-31 … SC-36 | 6 |
| §9 File safety and malware scanning | SC-37 … SC-45 | 9 |
| §10 Web security | SC-46 … SC-50 | 5 |
| §11 API security | SC-51 … SC-56 | 6 |
| §12 Logging and monitoring | SC-57 … SC-60 | 4 |
| §13 Privacy | SC-61 … SC-64 | 4 |
| §14 Abuse prevention | SC-65 … SC-68 | 4 |
| §15 Financial integrity | SC-69 … SC-74 | 6 |
| §16 Backups | SC-75 … SC-76 | 2 |
| §17 Incident response | SC-77 … SC-79 | 3 |
| §18 Dependency and supply-chain security | SC-80 … SC-83 | 4 |
| §19 Production hardening | SC-84 … SC-88 | 5 |
| **Total** | | **88** |

---

## 4. Authentication security

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-01 | **Password hashing.** Passwords shall be hashed with Argon2id (`argon2-cffi`) using `memory_cost = 65536 KiB (64 MiB)`, `time_cost = 3`, `parallelism = 1`, `salt_len = 16`, `hash_len = 32`, stored as a PHC string in `users.password_hash`. On successful login, `check_needs_rehash()` shall upgrade hashes whose parameters are below the configured ones. Inputs longer than 128 characters are rejected **before** hashing. Concurrent hashes are bounded by a semaphore of `2 × CPU` so that a login flood cannot exhaust memory (64 MiB each). An unknown email triggers verification against a dummy hash with identical parameters. | SEC-01; FR-AUTH-02, FR-AUTH-06 | T | TC-SEC-001 |
| SC-02 | **Password policy** (NIST SP 800-63B). Length 12–128 after NFKC normalisation; any printable Unicode, including Khmer and spaces; no composition rules; no periodic expiry. Rejected when the password equals or contains the email local-part or display name, appears in the bundled list of the 100,000 most common passwords, or (with `PASSWORD_BREACH_CHECK=true` in production) appears in Have I Been Pwned. The HIBP check uses the k-anonymity range API, sends only the first 5 hex characters of the SHA-1 and is skipped on a timeout > 2 s. Violations return `422` with field-level reasons. | SEC-01; FR-AUTH-02 | T | TC-SEC-001 |
| SC-03 | **Enumeration resistance.** `POST /auth/register` shall always return `202` and never log the user in (AM-14). `POST /auth/forgot-password` shall always return `202`. Both are padded to a constant minimum duration of ≥ 400 ms. Login shall return the same `401 invalid_credentials` for an unknown email and a wrong password, with a timing difference ≤ 50 ms at p95. Account status (suspended, deactivated) is disclosed only after a correct password. | SEC-22; FR-AUTH-01, FR-AUTH-06, FR-AUTH-12 | T, P | TC-SEC-022 |
| SC-04 | **Login throttling and lockout.** 5 failed logins for one account within 15 min shall lock that account for 15 min (`429 login_locked`, `Retry-After`) and write the `account_locked` security event. The user is emailed a sign-in-attempt warning with a reset link. While locked, the password is not verified. A successful password reset clears the lock. Per-IP limits apply as well: 20 per 15 min per IP and 5/min per (IP, email). These per-IP limits stop horizontal credential stuffing, which the per-account lock alone cannot. Any lockout of an admin account raises an alert (SC-59). | SEC-06; FR-AUTH-07; AM-08 | T | TC-SEC-006 |
| SC-05 | **Session tokens.** Session tokens shall be 256-bit CSPRNG values (`secrets.token_urlsafe(32)`). Only their SHA-256 is stored in `user_sessions.token_hash` (unique index). Tokens shall be rotated (new token, old row revoked with reason `rotated`) on login, MFA verification, MFA enable, password change and any role change. This prevents session fixation. Tokens never appear in URLs, logs, error bodies or WebSocket frames. A user has at most 20 active sessions; the 21st revokes the least recently used. | SEC-02 | T | TC-SEC-002 |
| SC-06 | **Session and CSRF cookies.** `dh_session` shall be `HttpOnly; Secure; SameSite=Lax; Path=/` with no `Domain` attribute (host-only). In production its name shall be `__Host-dh_session` (`SESSION_COOKIE_NAME`). `dh_csrf` shall be `Secure; SameSite=Lax; Path=/` and readable by JavaScript. `Secure` may be omitted only when `ENV=development` over `http://localhost`. Logout clears both cookies with `Max-Age=0`. | SEC-03 | T | TC-SEC-003 |
| SC-07 | **Session lifetime and revocation.** Non-admin sessions: 7 days idle, 30 days absolute. Admin sessions: **30 min idle, 12 h absolute**, evaluated on every request, so granting an admin role shortens existing sessions at once. `last_seen_at` is updated at most once per 60 s. Expired sessions return `401 session_expired`. The Redis session cache (TTL 60 s) is deleted on revocation, so revocation takes effect on the next request on every replica, and open WebSockets close within 5 s. Revocation triggers are listed in AUTH_AUTHORIZATION §15. | SEC-21, SEC-02; FR-AUTH-10, FR-AUTH-11; AM-08 | T | TC-SEC-021, TC-SEC-002 |
| SC-08 | **TOTP MFA.** RFC 6238 via `pyotp`: SHA-1, 6 digits, 30 s step, ±1 step tolerance. `users.mfa_last_used_step` rejects reuse of the same or an earlier step. Secrets are 160-bit, encrypted with AES-256-GCM (SC-25), shown once at setup and never logged. Setup requires the current password. MFA verification is limited to 5/min per session and 20/h per user. Five failed MFA attempts on one session revoke that session (FR-AUTH-08) and email the user. | SEC-05, SEC-14; FR-AUTH-08, FR-AUTH-09 | T | TC-SEC-005, TC-SEC-014 |
| SC-09 | **Recovery codes.** Enabling MFA shall generate 10 single-use recovery codes (format `XXXXX-XXXXX`, 50 bits each) and show them once. They are stored as `HMAC-SHA-256(RECOVERY_CODE_PEPPER, code)` in `mfa_recovery_codes(code_hash, used_at)`, never in plaintext. Each use sets `used_at`, writes the security event `mfa_recovery_code_used` and sends a mandatory email. When ≤ 2 codes remain, the UI prompts the user to regenerate them, which requires a password plus a TOTP code and invalidates every old code. | SEC-05; FR-AUTH-09 | T | TC-SEC-005 |
| SC-10 | **Administrative MFA and step-up.** Users holding `admin` or `super_admin` shall enrol TOTP before any admin action. While `ADMIN_MFA_REQUIRED=true`, every endpoint flagged `x-admin-mfa` returns `403 mfa_required` unless `user_sessions.mfa_verified_at` is set. The API refuses to start with `ENV=production` and `ADMIN_MFA_REQUIRED=false`. Admins cannot disable MFA. Endpoints flagged `x-step-up-mfa` additionally require `mfa_verified_at ≥ now − 15 min`; these are payout approve, reject, mark-paid, mark-failed, cancel and reverse, adjustments, pricing rules, suspend/reactivate, role changes, session revocation, takedown, export creation and settings. | SEC-05; FR-AUTH-08; AM-08 | T | TC-SEC-005 |
| SC-11 | **Email-verification and password-reset tokens.** These tokens shall be 256-bit and stored only as SHA-256 in `email_verifications`. Verification tokens are valid for 24 h and reset tokens for 1 h. Both are single-use, and issuing a new token supersedes older unused ones. They are delivered in the URL **fragment** (`/verify-email#token=…`, `/reset-password#token=…`), so they never reach server logs or proxies, and those pages send `Referrer-Policy: no-referrer`. A password reset revokes **all** sessions, never bypasses MFA, writes a security event and sends a mandatory confirmation email. Email links are built from the configured `WEB_ORIGIN`, never from the request `Host` (SC-36). | SEC-02; FR-AUTH-03, FR-AUTH-12, FR-AUTH-13 | T | TC-SEC-002 |
| SC-12 | **Account-security notifications.** Mandatory, non-disableable emails shall be sent on: password changed or reset; MFA enabled, disabled or reset; recovery code used; payout method added or removed (FR-USER-05); account locked; new-device login (first login from a new user-agent family plus /24 network); account suspended or reactivated. They contain no secrets and show payout identifiers only as their last 4 characters. | SEC-22; FR-USER-05, FR-NOTIF-04, FR-NOTIF-05 | T | TC-SEC-022 |
| SC-13 | **Admin provisioning and break-glass.** The first `super_admin` shall be created only by the server-side CLI `scripts/create-admin`, which prompts interactively and never takes secrets as arguments or environment variables. There is no web path to an admin role. Further admins are granted by a super_admin (`role.manage`, step-up), and the grantee must enrol MFA at their next request. An MFA reset for a lost device is done only by CLI after out-of-band identity verification. A super_admin who loses every factor is recovered by a two-person procedure: two named operators are present and both record the action in the incident log. Each such reset is audited and revokes all sessions. The optional `ADMIN_IP_ALLOWLIST` (CIDR) restricts admin-flagged endpoints and is **S** priority. | SEC-05; FR-ADM-03 | T, I | TC-SEC-005 |

## 5. Authorization

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-14 | **Deny-by-default route guard.** Every route shall declare `require(permission…, admin_mfa=…, step_up=…)` or an explicit `public` / `internal` marker. A CI test enumerates the FastAPI routes and fails if any route lacks a marker or if its permission differs from `x-permission` in `openapi.yaml`. Effective permissions are the union over the user's current roles, resolved on every request (cached with the session for ≤ 60 s; role changes invalidate the cache). | SEC-07 | T | TC-SEC-007 |
| SC-15 | **Resource-level checks.** Service functions receive the `Actor` and check ownership, assignment, reviewer assignee or conversation participation **inside the transaction that reads the row**, using `SELECT … FOR UPDATE` for mutations so the check cannot go stale before the write (TOCTOU). A resource the caller may not know exists returns `404 not_found`. A visible resource the caller may not act on returns `403 forbidden`. File access follows FR-DS-13. Quarantined, infected or taken-down files are never served to non-admins. | SEC-08; FR-DS-03, FR-DS-13, FR-ANN-08, FR-MSG-02 | T | TC-SEC-008 |
| SC-16 | **Query scoping.** List queries shall be built from the actor (`WHERE owner_id = :actor`, `WHERE assignee_id = :actor`, conversation participant joins). No code path loads a collection and filters it in Python. Admin cross-module search is read-only and limited to the joins documented in the LLD. | SEC-08; FR-DS-02 | T, I | TC-SEC-008 |
| SC-17 | **Separation of duties.** The service layer shall refuse with `403` and write a `permission_denied` security event when: a user reviews their own dataset (FR-REV-02); any annotator who ever held an assignment on a task reviews it (FR-ANN-15); a recipient approves, rejects, marks paid or failed, or reverses their own payout (FR-PAY-08/10/12); the same admin gives both approvals of a payout ≥ `payout_dual_approval_threshold_micros` (unique `payout_approvals(payout_id, approver_id)`); a super_admin adjusts their own wallet (FR-FIN-12); a user decides their own verification (FR-VER-04); a user changes their own roles or suspends themselves (FR-ADM-02/03). Admin roles do not include `payout.request`. | SEC-08; FR-REV-02, FR-ANN-15, FR-PAY-08, FR-PAY-10, FR-FIN-12, FR-VER-04, FR-ADM-03 | T | TC-SEC-008 |
| SC-18 | **Role management.** `admin` may grant or revoke only `annotator` and `reviewer`. Only `super_admin` (`role.manage`) may grant or revoke `admin` or `super_admin`. The last active super_admin cannot be demoted or suspended (`409 last_super_admin`). A role change rotates the target's sessions, and removing an admin role revokes the target's step-up window and admin sessions immediately. The role → permission mapping changes only through a migration plus a `DECISION_LOG.md` entry. | SEC-21; FR-ADM-03 | T | TC-SEC-021 |
| SC-19 | **State-dependent authorization.** Authorization shall be evaluated together with the baseline §9 state machines after locking the row. Examples: owner edits only in `draft` or `changes_requested`; `mark-paid` only from `approved`; annotation drafts only by the active assignee in `in_progress` or `changes_requested`; finalize only by the claiming reviewer of an `in_progress` review. Violations return `409 invalid_state`. | SEC-08; FR-DS-04, FR-PAY-10, FR-ANN-10, FR-REV-09 | T | TC-SEC-008 |
| SC-20 | **Response data minimisation.** Response schemas are explicit Pydantic projections (no ORM pass-through). Contributors never see reviewer identities or internal comments ("DataHub reviewer", "DataHub finance"). Reviewers and annotators never see contributor legal name, date of birth, phone or ID documents. Payout account identifiers are masked to the last 4 characters except for `payout.approve` holders, and each unmasked view is audited. Exports identify contributors only by a pseudonymous id (FR-EXP-03). Duplicate matches reveal other owners' ids only to reviewers and admins. | SEC-08; FR-DS-11, FR-EXP-03, FR-AUD-05 | T | TC-SEC-008 |
| SC-21 | **Authorization test matrix.** A generated pytest suite on real Postgres shall exercise every operation in `openapi.yaml` against the personas anonymous, contributor, annotator, reviewer, admin, super_admin, multi-role, `pending_email`, MFA-pending, suspended and unverified contributor. It asserts the expected outcome from AUTH_AUTHORIZATION Appendix A. An operation without an expectation fails the suite. IDOR tests request a second same-role user's resource for every path id. The suite runs on every pull request, and a failing or skipped authorization test blocks merge. | SEC-07, SEC-08; NFR-INT-10 | T | TC-SEC-007, TC-SEC-008 |

## 6. Encryption

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-22 | **External TLS.** All external traffic shall use TLS 1.2 or 1.3 (Caddy defaults: TLS 1.3 preferred, TLS 1.0/1.1 disabled, AEAD cipher suites only, OCSP stapling), with automatic certificates from an ACME CA. HTTP on port 80 serves only ACME challenges and `301` redirects to HTTPS. HSTS is `Strict-Transport-Security: max-age=31536000; includeSubDomains`; `preload` is added after 30 days of stable production. Presigned URLs use `https://`, and the API refuses to start in production if `S3_PUBLIC_ENDPOINT` is not HTTPS. External scan target: SSL Labs grade A or better. | SEC-12 | T, I | TC-SEC-012 |
| SC-23 | **Internal transport.** Internal containers talk over the private Docker networks. When PostgreSQL or Redis are managed services, connections shall use `sslmode=verify-full` and `rediss://` with certificate verification. SMTP uses STARTTLS on 587 or TLS on 465 with certificate verification. The API and workers reach R2/S3 over HTTPS. Plain-HTTP SeaweedFS is allowed only in development. | SEC-12 | I | TC-SEC-012 |
| SC-24 | **Encryption at rest.** Object storage: R2 always-on AES-256, or AWS S3 SSE-S3 (SSE-KMS if HA-03 requires customer-managed keys) with a bucket policy that denies `PutObject` without encryption and denies all access when `aws:SecureTransport=false`. The PostgreSQL data volume and the host disk use provider volume encryption or LUKS. Development uses synthetic data only (SC-64). | SEC-13, SEC-09 | I | TC-SEC-013, TC-SEC-009 |
| SC-25 | **Application-layer field encryption.** TOTP secrets and payout-method details (account numbers, wallet ids, emails used for payout) shall be encrypted with AES-256-GCM (96-bit random nonce, ciphertext stored with a `key_id` prefix) using keys from the secret store (`APP_ENCRYPTION_KEY`, `MFA_ENCRYPTION_KEY`, 32 bytes each). Key rotation: add a new key id as primary, run the re-encryption job `scripts/reencrypt-fields`, then retire the old key once it decrypts 0 rows. Payout snapshots on `payout_requests` are encrypted the same way. | SEC-14; FR-PAY-05 | T | TC-SEC-014 |
| SC-26 | **Backup encryption.** Every backup shall be encrypted before it leaves the host. `pg_dump` output is streamed through **age**. Only the recipient public key is on the host; the private key is held offline by two custodians (owner and DevOps lead) and is never on the production VM. Host configuration (`/etc/datahub`, Caddyfile, compose files, Caddy data) goes into a **restic** repository (AES-256 with Poly1305 authentication), whose password is in the secret store and escrowed offline. The AM-13 object-storage replica is written through an **rclone crypt** remote (content and file-name encryption, keys escrowed like the age key). | SEC-13; NFR-AVL-02; AM-13 | I, D | TC-SEC-013 |

## 7. Secrets management

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-27 | **Secret storage.** Production secrets shall live only in (a) env files under `/etc/datahub/` owned by `root:root` with mode **0600** (directory 0700), referenced by `env_file:` in compose, or (b) **Docker secrets** mounted read-only at `/run/secrets/<name>` and read through `*_FILE` variables. Secrets are never baked into images, committed compose files, CLI arguments, build args or frontend bundles: only `NEXT_PUBLIC_*` non-secret values reach the browser. `.env.example` contains placeholder values only, such as `changeme-…`. Inventory: `DATABASE_URL` password, `REDIS_PASSWORD`, S3 key pairs (API, presign, worker, export, backup), `SMTP_PASSWORD`, `APP_ENCRYPTION_KEY`, `MFA_ENCRYPTION_KEY`, `CSRF_SECRET`, `RECOVERY_CODE_PEPPER`, `SENTRY_DSN`, the restic password, rclone crypt keys and the age recipient public key (not secret). | SEC-19 | I, T | TC-SEC-019 |
| SC-28 | **No secrets in the repository.** **gitleaks** shall run as a pre-commit hook and in CI over the full git history on every push and pull request. Findings fail the pipeline. Allow-listing a finding requires review and a comment in `.gitleaks.toml`. A leaked secret is treated as compromised and rotated (SC-29) even if the commit is reverted. Trivy secret scanning of images (SC-81) is a second net. | SEC-19 | T | TC-SEC-019 |
| SC-29 | **Rotation procedure.** Secrets shall be rotated at least on the schedule below, and immediately on suspected compromise or when an operator with access leaves. Procedure: (1) generate the new value; (2) for keys with ids (encryption keys), add as primary while keeping the old one for decryption; (3) update the env file or Docker secret; (4) roll the containers (`docker compose up -d --no-deps <svc>`); (5) verify `/readyz` and a smoke test; (6) revoke the old value at the provider; (7) record the rotation in the operations log. Schedule: DB, Redis, SMTP and S3 credentials every 90 days. `CSRF_SECRET` every 180 days (rotation only invalidates outstanding CSRF tokens). Encryption keys and `RECOVERY_CODE_PEPPER` every 365 days. Rotating the pepper requires users to regenerate recovery codes, so it is done only on compromise. SSH keys are reviewed every 90 days. | SEC-19, SEC-14 | D, I | TC-SEC-019, TC-SEC-014 |
| SC-30 | **Least-privilege credentials.** Separate storage key pairs shall exist for the API (multipart control and presign of `datasets/*`, `attachments/*`, `verifications/*`, `payouts/*`), workers (read originals, write derivatives and members), the export builder (read sources, write `exports/*`) and backups (write-only to the backup bucket; no delete). PostgreSQL roles: `datahub_app` (DML on application tables; no DDL; not owner, so it cannot disable triggers), `datahub_migrator` (DDL, used only by the migration job), `datahub_readonly` (analytics and replica) and `datahub_backup` (`pg_dump`). Redis uses ACL users with passwords. Human console access to providers requires MFA. | SEC-19, SEC-11 | I | TC-SEC-019, TC-SEC-011 |

## 8. Input validation

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-31 | **Strict schema validation.** Every request body, query and path parameter shall be a Pydantic v2 model with `ConfigDict(strict=True, extra="forbid")`, explicit `max_length`, `ge`/`le`, enums and regex where applicable. Unknown fields such as `roles`, `status` or `verification_status` sent to `/me/*` are rejected, which blocks mass assignment. Text is UTF-8 and NFC-normalised except annotation transcription and corrected text (FR-ANN-12). Invalid UTF-8 returns `422 validation_error`. Money fields are integers (`int`, never `float`). The Zod schemas in the web app mirror these rules for UX only. | SEC-17; NFR-INT-04 | T | TC-SEC-017 |
| SC-32 | **Request size limits.** JSON bodies are capped at 1 MB (`413 payload_too_large`), enforced both by Caddy (`request_body max_size`) and by the API. Multipart is accepted only on attachments, verification and payout proof, each ≤ 10 MB + 64 KiB, counted while streaming. Headers are capped at 16 KiB. `page_size` ≤ 100. Bulk operations: ≤ 2,000 files per review bulk, ≤ 500 tasks per bulk-assign, ≤ 100 part URLs per call. WebSocket frames from the client are ≤ 4 KiB. | SEC-17; NFR-PERF-03 | T | TC-SEC-017 |
| SC-33 | **Injection prevention.** (a) Database access uses SQLAlchemy Core/ORM with bound parameters only. String-built SQL is forbidden, enforced by ruff `S608` and code review. Dynamic sort fields are mapped through allow-lists. (b) No `subprocess` call with `shell=True`, and no user input in argument lists. Worker sandboxes call fixed binaries with fixed arguments. (c) Celery uses the `json` serializer only (`accept_content=["json"]`), and messages carry ids only. (d) CSV outputs (`metadata.csv`, ledger CSV export) prefix a cell with `'` when it starts with `=`, `+`, `-`, `@`, TAB or CR, which neutralises formula injection. (e) User filenames never appear in object keys (FR-UPL-08). In `Content-Disposition` they are RFC 6266-encoded with CR, LF and quotes removed. (f) Logs are JSON-encoded by structlog, so CRLF cannot forge log lines. | SEC-17; FR-UPL-08 | T, I | TC-SEC-017 |
| SC-34 | **Parser hardening.** XML-bearing formats (XML, DOCX, ODT, XLSX) shall be parsed only with **defusedxml**: no DTDs, no external entities, no entity expansion. JSON depth ≤ 64 and string ≤ 100 MB. CSV field ≤ 10 MB. Pillow `MAX_IMAGE_PIXELS = 200,000,000`; above that the file fails as `image_too_large`. PDF rendering is limited to 500 pages. OOXML/ODF internal ZIPs use the SC-40 ratio and member limits with ≤ 2 GB uncompressed. Every parser runs inside the SC-41 sandbox. | SEC-17, SEC-11; FR-PROC-08, FR-PROC-09 | T | TC-SEC-017, TC-SEC-011 |
| SC-35 | **SSRF prevention and egress control.** The system shall never fetch a user-supplied URL server-side: no URL import, no link previews, no remote images in rendering. DOCX/ODT/RTF previews extract text only, so remote templates, linked images and OLE links are never resolved. SVG and HTML are denied types. pypdfium2 has no network capability, and PDF actions and JavaScript are never executed. The processing-zone containers' egress is restricted by Docker network design and host firewall rules to PostgreSQL, Redis, clamd and object storage. The only outbound calls are to fixed configured hosts: SMTP, HIBP range API, Sentry, ACME and the object storage endpoint. | SEC-17, SEC-11 | T, I, P | TC-SEC-017, TC-SEC-011 |
| SC-36 | **Trusted URL construction and redirects.** Absolute URLs (email links, presign host) shall be built only from configuration (`WEB_ORIGIN`, `S3_PUBLIC_ENDPOINT`), never from `Host` or `X-Forwarded-Host`. Caddy serves only the configured hostnames and returns `421` otherwise. Post-login `returnTo` values must be same-origin relative paths (start with a single `/`, no `//`, no scheme). Anything else is replaced with `/dashboard`. | SEC-17 | T | TC-SEC-017 |

## 9. File safety and malware scanning

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-37 | **Type verification.** File type shall be decided by libmagic on content, never by the extension or the browser `Content-Type`. The extension must agree with the detected MIME family (BL §7), otherwise the file fails as `type_mismatch`. The deny-list is executables, libraries, scripts, HTML/XHTML, SVG, macro-enabled Office (`docm`, `xlsm`, `pptm`, `dotm`), JAR, APK, disk images and non-ZIP archives (`disallowed_type`). The deny-list overrides `extra_allowed_extensions`. OOXML/ODF main-part content types are confirmed. | SEC-10, SEC-11; FR-PROC-02 | T | TC-SEC-010, TC-SEC-011 |
| SC-38 | **Size limits and quotas.** Per file: **4,000,000,000 B** (AM-01), applied to declared size at init, to `HeadObject` at complete and to each extracted ZIP member. Per dataset: 50 GB and ≤ 2,000 direct files. Unreviewed storage per user: 200 GB. Open upload sessions per user: ≤ 20. Upload sessions expire after 24 h. Quota checks hold `pg_advisory_xact_lock(hash(user_id))`, so parallel inits cannot jointly exceed a quota. Declared size ≠ real size fails completion and aborts the session. | SEC-17; FR-UPL-02, FR-DS-07; AM-01 | T | TC-SEC-017 |
| SC-39 | **Malware scanning, fail-closed.** Every non-container file, ZIP member, message attachment, verification ID document and payout proof shall be scanned by clamd (`zINSTREAM`, internal port 3310 only) in the same streaming pass as hashing. clamd.conf: `StreamMaxLength 4000M`, `MaxScanSize 4000M`, `MaxFileSize 4000M`, `MaxFiles 10000`, `MaxRecursion 16`, `AlertExceedsMax yes`, `AlertEncrypted yes`, `AlertBrokenExecutables yes`, `AlertOLE2Macros yes`. freshclam runs every 2 h, and an alert fires if signatures are older than 24 h. Verdicts: `FOUND` → `quarantined`. `Heuristics.Limits.Exceeded` or `Heuristics.Encrypted.*` → `failed` (not clean). Connection error → retry, then `scan_status=error` and `failed: scan_error`. **No configuration flag can skip scanning.** A file with `scan_status ≠ clean` can never be accepted, previewed to non-admins, exported, annotated or paid. Admin rescan is via `POST /admin/files/{id}/rescan`. A previously accepted file found infected on rescan is quarantined, removed from exports and opened as an admin task. | SEC-11; FR-PROC-03, FR-PROC-04; A-10; AM-01 | T | TC-SEC-011 |
| SC-40 | **Archive safety.** ZIP expansion shall follow FR-PROC-05 … 07 and FILE_UPLOAD_STORAGE §13. Limits are checked from the central directory **before** extraction: ≤ 10,000 members and ≤ 20 GB total uncompressed. Live guards during streaming: abort a member when actual output exceeds its declared size or its ratio exceeds 100:1, and abort the archive when the running total exceeds 20 GB. Member names are rejected for absolute paths, drive letters, `..`, backslash traversal or > 1,024 bytes. Symlinks, devices, FIFOs and sockets are skipped (`unsafe_member_path`). Encrypted members fail as `encrypted`. Only stored and deflate methods are allowed. Nested archives are not expanded (`nested_archive`, depth ≤ 1). Members stream to new server-keyed objects, never to a filesystem path, and are never executed. A limit breach deletes members already created and fails the container (`archive_limits_exceeded`). | SEC-11; FR-PROC-05, FR-PROC-06, FR-PROC-07 | T | TC-SEC-011 |
| SC-41 | **Processing sandbox.** Rendering and extraction shall run in a per-file subprocess with `RLIMIT_AS` 2 GiB, `RLIMIT_CPU` 300 s, `RLIMIT_NOFILE` 256 and a wall-clock timeout of 10 min (20 min for > 100 pages). It runs as a non-root user with an **empty environment**, so no DB, S3 or encryption credentials are present. Input and output pass over pipes. Scratch space is a `tmpfs` mounted `noexec,nosuid,nodev` with mode `0700`. Worker containers follow SC-84: read-only root filesystem, `cap_drop: ALL`, `no-new-privileges`, default seccomp. Uploaded content is never executed, imported or opened with macro-capable software, and LibreOffice is not installed (A-11). Celery limits: soft time limit 2 h, hard limit 2 h 10 min. | SEC-11; FR-PROC-09 | T, I | TC-SEC-011 |
| SC-42 | **Safe preview and download serving.** Previews shall be server-re-encoded WebP rasters with EXIF/GPS stripped, or extracted text returned as JSON and rendered as escaped text. Original bytes are never rendered inline in the app. Downloads use presigned GETs with `response-content-disposition=attachment` (RFC 6266 filename), `response-content-type` set to the detected MIME or `application/octet-stream`, and `X-Content-Type-Options: nosniff`. Objects are created with neutral `ContentType=application/octet-stream` and `ContentDisposition=attachment`. Storage is on a separate origin from the app, so content there cannot read app cookies. | SEC-10; FR-DS-14, FR-PROC-08 | T | TC-SEC-010 |
| SC-43 | **Private bucket and presigned URLs.** `datahub-private` shall block all public access: no public ACLs, no `Principal:*` policies, no website hosting. Objects are reachable only through presigned URLs issued after authorization: `UploadPart` PUT valid 15 min, scoped to bucket, key, `uploadId` and `partNumber`; GET valid 5 min. URLs are generated per request and are never stored, emailed or logged (the log scrubber removes `X-Amz-Signature`). Responses that carry them send `Cache-Control: no-store`. Presign issuance is rate-limited to 120/min per user. Every download-URL issuance for originals, exports, ID documents and payout proofs is audit-logged (FR-AUD-04). `scripts/storage-setup` verifies that anonymous `GET` and `ListObjects` return `403`. | SEC-09; FR-DS-14, FR-AUD-04 | T, I | TC-SEC-009 |
| SC-44 | **Small uploads.** Message attachments (≤ 10 MB, ≤ 5 per message), verification ID documents and payout proofs (≤ 10 MB, PDF/JPEG/PNG) shall be magic-byte checked, hashed, stored under server keys and scanned asynchronously before anyone other than the uploader can see them. ZIP attachments are never expanded. ID documents are visible only to `user.verify` holders, and each view is audited (FR-VER-07). | SEC-11; FR-MSG-05, FR-VER-01, FR-VER-07, FR-PAY-10 | T | TC-SEC-011 |
| SC-45 | **Quarantine and blocked hashes.** Infected objects shall be moved to `quarantine/{file_id}/original` and the original key deleted. They are accessible only to super_admin through audited access and expire after 30 days, while the signature name and hash are kept. SHA-256 values of taken-down content are blocked on future uploads (`blocked_hash`, admin alert). ≥ 3 infected uploads by one user in 30 days raise an alert (NFR-OBS-04). | SEC-09; FR-PROC-03, FR-DS-12 | T | TC-SEC-009 |

## 10. Web security

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-46 | **Content Security Policy.** Next.js `middleware.ts` shall generate a fresh 128-bit base64 nonce per request, pass it to the app via the `x-nonce` request header (Next.js 15 applies it to its own framework and inline scripts) and set the CSP. App pages are rendered dynamically, so HTML containing a nonce is never statically cached. Production policy for HTML responses: `default-src 'self'; script-src 'self' 'nonce-{N}' 'strict-dynamic'; style-src 'self' 'nonce-{N}'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob: https://{STORAGE_HOST}; font-src 'self'; connect-src 'self' https://{STORAGE_HOST} wss://{APP_HOST}; worker-src 'self' blob:; manifest-src 'self'; media-src 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; upgrade-insecure-requests; report-to csp-endpoint`. `style-src-attr 'unsafe-inline'` is accepted because Radix/shadcn set positioning style attributes, and style attributes cannot run script. API JSON responses carry `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`. Violations are reported to `/api/v1/csp-reports`, which is rate-limited and stores samples in logs. A change to the policy is rolled out first as `Content-Security-Policy-Report-Only` on staging for ≥ 7 days. No `'unsafe-eval'` is permitted in production. | SEC-15 | T | TC-SEC-015 |
| SC-47 | **Security headers.** Caddy and Next.js shall set on every response: `X-Frame-Options: DENY` (alongside `frame-ancestors 'none'`); `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin` (`no-referrer` on token pages); `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=(), display-capture=(), fullscreen=(self)`; `Cross-Origin-Opener-Policy: same-origin`; `Cross-Origin-Resource-Policy: same-origin`; HSTS (SC-22). `Server` and `X-Powered-By` are removed (`poweredByHeader: false`, Caddy `-Server`). Production source maps are not served publicly. A header test asserts each value on HTML, API and error responses. | SEC-15, SEC-10 | T | TC-SEC-015, TC-SEC-010 |
| SC-48 | **CORS.** The API shall be same-origin only. Because Caddy serves the web app and `/api/*` under one origin, the API emits **no** `Access-Control-Allow-*` headers, so cross-origin browser calls fail. If a split origin is ever configured, only the single `CORS_ALLOWED_ORIGINS` entry is allowed with credentials, never `*` and never a reflected origin. The storage bucket CORS allows only `WEB_ORIGIN`, methods `PUT`, `GET` and `HEAD`, headers `Content-Type`, `Content-MD5` and `x-amz-checksum-sha256`, exposes `ETag` only, and has `MaxAgeSeconds 3600`. | SEC-16 | T | TC-SEC-016 |
| SC-49 | **XSS prevention.** All user-generated content shall be rendered by React as escaped text: dataset metadata, filenames, messages, annotation text, review comments, notification text and extracted document text. `dangerouslySetInnerHTML` is forbidden for user content (ESLint `react/no-danger` set to error; exceptions need a security review comment). Project instructions in Markdown are rendered with `react-markdown` plus `rehype-sanitize` using an allow-list (headings, lists, emphasis, code, tables, links). Raw HTML is disabled. Links allow only `http:`, `https:` and `mailto:` and are rendered with `rel="noopener noreferrer nofollow"`. Message bodies auto-link only `http(s)` URLs. Emails escape all variables (Jinja2 autoescape). `require-trusted-types-for 'script'` runs in report-only mode (**S**). | SEC-18 | T, I | TC-SEC-018 |
| SC-50 | **Cache control.** Authenticated API responses and HTML pages shall send `Cache-Control: no-store` and `Vary: Cookie`. Only fingerprinted static assets under `/_next/static/` and public pages are cacheable. Preview redirects use `private, max-age=300`. No shared proxy or CDN may cache authenticated content (S6 CDN scaling applies to signed preview derivatives only). | SEC-09, SEC-22 | T | TC-SEC-009, TC-SEC-022 |

## 11. API security

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-51 | **Rate limiting.** Redis sliding-window limiters, with keys hashed as `rl:{class}:{sha256(key)}`, shall apply at least the SRS SEC-06 limits: register 5/h per IP; login 20 per 15 min per IP plus 5/min per (IP, email) plus SC-04; forgot-password 3/h per email and 10/h per IP; `/public/contact` and `/public/takedown-requests` 5/h per IP; upload initiation 120/min per user; messages 30/min per user; presigned URL issuance 120/min per user; exports 10/h per user; WebSocket 10 connects/min and ≤ 5 concurrent per user; other authenticated requests 600/min per user; global safety net 1,200/min per IP. The finer classes in AUTH_AUTHORIZATION §13 also apply, and the stricter value wins. Responses carry `RateLimit` headers and, on `429`, `Retry-After`. Auth-class limiters **fail closed** when Redis is down. The client IP comes from `X-Forwarded-For` only when the peer is in `TRUSTED_PROXIES` (Caddy). Caddy additionally enforces connection limits and request timeouts. | SEC-06 | T | TC-SEC-006 |
| SC-52 | **CSRF protection.** Four layers: (1) `SameSite=Lax` session cookie. (2) Double-submit: every unsafe method needs `X-CSRF-Token` equal to the `dh_csrf` cookie. The token is `nonce.issued_at.HMAC-SHA256(CSRF_SECRET, binding‖nonce‖issued_at)`, bound to the session or the anonymous pre-session id, and is rotated on login and logout. (3) `Origin` (fallback `Referer`) must equal `WEB_ORIGIN` on unsafe methods. (4) Unsafe endpoints accept only `application/json`, except the three multipart endpoints that also need the token. Form-encoded and `text/plain` bodies return `415`. Login, register, forgot, reset and verify-email are covered too, which prevents login-CSRF. Failures return `403 csrf_failed` and write the security event `csrf_rejected`. | SEC-04 | T | TC-SEC-004 |
| SC-53 | **Idempotency.** `Idempotency-Key` (UUID) shall be **required** on `POST /payouts`, `POST /reviews/{id}/finalize` and `POST /admin/adjustments`, and accepted on every admin payout action. The key is stored with a SHA-256 of the canonical request body. A replay with the same body returns the original response. The same key with a different body returns `409 idempotency_key_reused`. Server-side journal keys (BL §8.5, AM-02) make posting idempotent even without a client key. All Celery tasks are idempotent under `acks_late` redelivery. | SEC-22; FR-PAY-03, FR-REV-10, FR-FIN-12, NFR-INT-03 | T | TC-SEC-022 |
| SC-54 | **Error hygiene.** All errors shall use the envelope `{"error":{"code","message","details","request_id"}}`. Stack traces, SQL, internal hostnames, storage keys, presigned URLs and secrets never appear in responses. Unexpected errors return `500 internal_error`. FastAPI debug mode is off outside development. The 404-vs-403 rule of SC-15 applies. Every response carries `X-Request-ID`. | SEC-08; NFR-INT-06, NFR-INT-07 | T | TC-SEC-008 |
| SC-55 | **WebSocket security.** `WS /api/v1/ws` shall authenticate with the session cookie at handshake, reject a handshake whose `Origin` is not `WEB_ORIGIN` (cross-site WebSocket hijacking), and subscribe the socket only to channels derived server-side from the session user (`user:{id}`). The client cannot choose channels. Payloads carry ids and minimal metadata only; clients fetch content over REST with normal authorization. Sockets close with code 4401 within 5 s of session revocation or expiry. Limits: 10 connects/min and ≤ 5 concurrent per user; inbound frames ≤ 4 KiB; idle ping/pong every 30 s. | SEC-04, SEC-21; FR-MSG-07 | T | TC-SEC-004, TC-SEC-021 |
| SC-56 | **Internal surface reduction.** `GET /metrics` shall be bound to the internal network and blocked by Caddy (`404`). In production, FastAPI's `/docs`, `/redoc` and `/openapi.json` are disabled (`docs_url=None`). The spec is published from the repository instead. The Flower and Celery inspect endpoints, the SeaweedFS filer UI and Mailpit exist only in development. Health endpoints `/healthz` and `/readyz` return no version or dependency detail to external callers. | SEC-12 | T, I | TC-SEC-012 |

## 12. Logging and monitoring

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-57 | **Structured logging with redaction.** API and workers shall log JSON via **structlog**: timestamp (UTC), level, `request_id` or `task_id`, user id, route, status, duration. A redaction processor runs before rendering and replaces values with `"[REDACTED]"` for keys matching, case-insensitively, `password`, `new_password`, `current_password`, `token`, `*_token`, `access_token`, `refresh_token`, `cookie`, `set-cookie`, `authorization`, `x-csrf-token`, `dh_session`, `dh_csrf`, `code`, `recovery_code`, `secret`, `*_secret`, `mfa_secret`, `otp`, `api_key`, `private_key`; **payment details** (`account_number`, `iban`, `swift`, `routing_number`, `wallet_id`, `payout_method.details`, `card*`, `phone` within payout methods), masked to the last 4 characters; and **document content** (`text`, `extracted_text`, `transcription`, `corrected_text`, `body`, `content`, `notes`, `annotation.data`). URLs are logged with the query string stripped (removes `X-Amz-Signature`). Emails are logged as a SHA-256 hash for unknown-user events. Request and response bodies are never logged. Sentry: `send_default_pii=False`, `before_send` applies the same scrubber, and request bodies and cookies are excluded. A log-scrubbing test sends every sensitive field through each logger and asserts that none appears. | SEC-22; NFR-OBS-01, NFR-OBS-03, NFR-OBS-05, FR-AUD-05 | T | TC-SEC-022 |
| SC-58 | **Audit trail and security events.** Every baseline §9 state transition and every sensitive action shall write `audit_logs` in the same transaction: role, setting and pricing changes, adjustments, takedowns, exports, verification decisions, payout actions, suspensions, views of unmasked payout details, ID documents and quarantined files. Fields: actor, action, entity, before/after diff, IP, request_id. A trigger makes the table append-only. `security_events` records the AUTH_AUTHORIZATION §16 event list. Neither table contains passwords, hashes, tokens, MFA secrets or recovery codes. Audit logs are readable only via `audit.read` (super_admin). | SEC-22; FR-AUD-01, FR-AUD-02, FR-AUD-03, FR-AUD-04, FR-AUD-05 | T | TC-SEC-022 |
| SC-59 | **Security monitoring and alerting.** Alerts shall be routed to the ops channel and on-call email for: > 50 `login_failed` per 5 min platform-wide; any `account_locked` or `mfa_failed` burst on an admin; > 20 `permission_denied` per min for one user; ≥ 3 infected uploads by one user in 30 days; ClamAV unreachable > 15 min or signatures > 24 h old; reconciliation mismatch; backup failure or no successful backup in 26 h; > 2 exports or > 50 GB exported by one admin in 24 h; > 100 download URLs per hour by one non-admin user; CSP-report spikes (> 100 per 10 min); 5xx > 2 % over 5 min (NFR-OBS-04). Every alert links to an IR runbook (SC-77). | SEC-22; NFR-OBS-04 | T, D | TC-SEC-022 |
| SC-60 | **Log retention and access.** Application logs: 30 days on the host (Docker `json-file` with `max-size`/`max-file` rotation), shipped to the log store when one is configured. Security events: 1 year. Audit logs and financial records: 7 years (A-15). Raw session IPs are kept for 30 days, then truncated to /24 (IPv4) or /48 (IPv6). Only DevOps and the security lead may read host logs, using personal SSH keys. Log access in the admin UI is itself audited. | SEC-22; FR-AUD-02, A-15 | I | TC-SEC-022 |

## 13. Privacy

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-61 | **Data minimisation and classification handling.** Restricted data shall be collected only where a requirement needs it: DOB, legal name, phone and ID documents for verification; payout details for payouts. It is visible only to the holder of the specific permission, with admin MFA, and access is audited. Emails contain no document content, no tokens other than the single-use link, and no payout details beyond the last 4 characters (FR-NOTIF-05). Exports are pseudonymous (FR-EXP-03). Analytics are aggregated. | SEC-08, SEC-22; FR-NOTIF-05, FR-EXP-03, FR-VER-07 | T | TC-SEC-008, TC-SEC-022 |
| SC-62 | **Personal data inside contributions.** Datasets shall declare `contains_personal_data`. When it is true, submission requires a data-subject consent confirmation (FR-DS-08). Reviewers check personal data on the checklist and reject with `personal_data` where appropriate (FR-REV-06/07). Image previews strip EXIF and GPS. Dataset content is never sent to Sentry, logs or third-party services. The lawful basis for processing third-party personal data is subject to **HA-03**. | SEC-22; FR-DS-01, FR-DS-08, FR-REV-06, FR-REV-07 | T, I | TC-SEC-022 |
| SC-63 | **Retention, deletion and legal hold.** Retention follows A-15 and DATA_RETENTION_DELETION.md: abandoned uploads 24 h; withdrawn drafts 30 days; rejected objects 90 days; exports 7 days; quarantined objects 30 days; ID documents 1 year after decision; security events 1 year; audit and financial records 7 years. Deletion requests are refused while a payout is open, and processing them anonymises PII (FR-USER-07). A `legal_hold` on datasets or users (AM-09) suspends purge. Legal deletion removes all object versions and the replica copy. Data in encrypted backups ages out with backup retention (SC-75); restores re-apply pending deletions from the `deletion_requests` log before reuse. | SEC-22; FR-USER-07, FR-ADM-11, FR-DS-05; A-15; AM-09 | T | TC-SEC-022 |
| SC-64 | **Non-production data and processors.** Development and CI shall use synthetic or consented test data only. Real personal data and production dumps must never be loaded outside production, except in the isolated restore-drill environment, which is destroyed after the drill (SC-76). Third-party processors are limited to the SMTP provider, object storage, Sentry (no PII) and the HIBP range API (k-anonymity). Each is listed in the privacy policy pending HA-01/HA-03. | SEC-13; NFR-OBS-03 | I | TC-SEC-013 |

## 14. Abuse prevention

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-65 | **Upload abuse.** Uploads require a verified email plus completed onboarding (A-09). The quotas and limits of SC-38 apply. Abandoned sessions are cleaned after 24 h by job plus bucket lifecycle. Hashes of taken-down content are blocked (SC-45). Repeat infected uploads alert (SC-59). Admins can suspend an account, which aborts its open uploads (AUTH §14). | SEC-06; FR-UPL-02, FR-UPL-07, NFR-OBS-04 | T | TC-SEC-006 |
| SC-66 | **Fraud and multi-account signals.** The verification queue shall show duplicate-identity hints: same phone, or the same legal name plus DOB as another account (FR-VER-03). The same payout account number across ≥ 3 accounts is flagged (compared on a keyed HMAC of the normalised number, so plaintext is not needed). Payout lists carry the flags `new_payout_method`, `first_payout`, `requires_dual_approval` and `recipient_verification_changed` (FR-PAY-07). Admin analytics show per-contributor acceptance rate and duplicate rate, and per-reviewer acceptance rate. Verification is required before withdrawals and annotation work (A-08). | SEC-06; FR-VER-03, FR-PAY-07, FR-ADM-06 | T | TC-SEC-006 |
| SC-67 | **Public forms.** `POST /public/contact` and `POST /public/takedown-requests` (AM-04) shall be rate-limited (5/h per IP), include a honeypot field and a minimum fill time of ≥ 3 s, cap the message at 5,000 characters, and store plain text only. They never take a dataset offline automatically: takedowns are actioned by an admin with a reason (FR-DS-12). No CAPTCHA is used in v1. If spam exceeds 50 submissions per day for 3 consecutive days, a privacy-respecting challenge is added through a DECISION_LOG entry, with the CSP extended accordingly. | SEC-06; FR-ADM-10; AM-04 | T | TC-SEC-006 |
| SC-68 | **Messaging abuse.** Messages are plain text (1–5,000 characters), rate-limited to 30/min and 60/h per user, rendered escaped (SC-49), and attachments are scanned before they are visible (SC-44). Users cannot edit or delete messages in v1, which preserves evidence. Support staff can close conversations and suspend abusive users. | SEC-06, SEC-18; FR-MSG-03, FR-MSG-05 | T | TC-SEC-006, TC-SEC-018 |

## 15. Financial integrity controls

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-69 | **Integer money.** All amounts shall be `BIGINT` micro-USD computed with Python `int`. A lint rule forbids `float` and `Decimal`-to-float conversions in `modules/finance` and in earning code. Property-based tests (Hypothesis) check `floor(bytes × rate / 10⁹)` and that per-file floors sum consistently. | SEC-22; NFR-INT-01; A-04 | T | TC-SEC-022 |
| SC-70 | **Ledger immutability.** The ledger is append-only double-entry (BL §8.5). A deferred constraint trigger enforces Σ lines = 0 per journal. Triggers block UPDATE and DELETE on `ledger_journals`, `wallet_transactions` and `audit_logs`. CHECK constraints keep `available ≥ 0` and `reserved ≥ 0`. The application DB role does not own the tables, so it cannot disable triggers (SC-30). Corrections are made only by new journals (adjustments, reversals). | SEC-22; NFR-INT-02, FR-FIN-10, FR-AUD-02 | T | TC-SEC-022 |
| SC-71 | **Double-payment guards.** Unique journal `idempotency_key`; unique `earning_records(source_type, source_id, file_id)`; AM-03 partial unique index `(content_sha256, pricing_tier) WHERE amount_micros > 0`, with `pg_advisory_xact_lock` per sorted SHA-256 at finalize before rechecking eligibility; `SELECT … FOR UPDATE` on the wallet before every balance check; partial unique index allowing one open payout per user; unique `payout_records.payout_id`; `payment_reference` unique per method type; unique `annotation_rewards.annotation_review_id`. Status guards (`UPDATE … WHERE status = :expected`) on every transition. Covered by parallel-request tests (E2E Scenario 7, FR-PAY-04). | SEC-22; FR-PAY-04, FR-REV-10, FR-FIN-06, FR-FIN-07; AM-03 | T | TC-SEC-022 |
| SC-72 | **Payout authorization controls.** Payout requests require `payout.request`, an approved verification, an `active` account, an owned payout method, whole cents, $10 ≤ amount ≤ $5,000, amount ≤ available and no open payout (FR-PAY-01). Payout-method details are snapshotted (encrypted) at request time. Approve, reject, mark-paid, mark-failed, cancel and reverse need an admin MFA session plus step-up ≤ 15 min (SC-10) and SoD (SC-17). Amounts ≥ $100 need two distinct approvers (HA-07). The `new_payout_method` flag stays for 24 h, and the runbook requires out-of-band confirmation for methods changed within 72 h (PRICING_PAYOUT_POLICY §10). Mark-paid needs a non-empty `payment_reference` and `paid_at` within [approval time, now]. DataHub never calls payment APIs (FR-PAY-14). | SEC-05, SEC-08; FR-PAY-01 … FR-PAY-12, FR-USER-05 | T | TC-SEC-005, TC-SEC-008 |
| SC-73 | **Reconciliation.** Nightly `finance.reconcile` shall recompute every wallet bucket from lines, check Σ all lines = 0, check Σ `earning_records` per review against its journal, and check that no balance is negative. Any mismatch raises an alert and **pauses payout approval and mark-paid** until a super_admin acknowledges (PP-31). The month-end close compares Σ `payout_records` with provider statements (PRICING_PAYOUT_POLICY §14). | SEC-22; FR-FIN-13 | T, D | TC-SEC-022 |
| SC-74 | **Pricing and adjustment governance.** Pricing rules are created only by super_admin with step-up, are never retroactive (`effective_from ≥ now`), cannot overlap (exclusion constraint) and need a mandatory note. Adjustments are super_admin only, with step-up, `Idempotency-Key`, reason code plus text ≥ 20 characters, never on the actor's own wallet, and never larger than available. Every pricing change and adjustment is audited and listed in the weekly super_admin audit review. When ≥ 2 super_admins exist, each adjustment is reviewed by a second one. | SEC-05; FR-FIN-01, FR-FIN-12 | T | TC-SEC-005 |

## 16. Backups

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-75 | **Backup scope, schedule and immutability.** Nightly `pg_dump -Fc` is encrypted with age (SC-26) and uploaded to a backup bucket in a **separate provider account**. Retention: 30 daily and 12 monthly. The backup credential is write-only, and the bucket uses object lock or versioning, so a compromised host cannot delete history. Optional WAL archiving gives a 15-min RPO. Object storage: versioning plus lifecycle on AWS S3, or on R2 a nightly `rclone sync` through an rclone crypt remote to a separate account with 30-day retention of deleted objects (AM-13). Host configuration and Caddy data go to restic nightly (`restic forget --keep-daily 30 --keep-monthly 12`). An alert fires on failure or when no successful backup exists for 26 h. | SEC-13; NFR-AVL-02; AM-13 | D, I | TC-SEC-013 |
| SC-76 | **Restore drills and isolation.** Restores shall be rehearsed before launch and every quarter in an **isolated** environment: separate network, no production credentials, outbound email disabled. Each drill decrypts with the escrowed keys, restores DB and objects, runs `finance.reconcile` (must pass) and checks sample object SHA-256 values, which must match. RTO ≤ 4 h and RPO ≤ 24 h are recorded (NFR-AVL-03, E2E Scenario 8). The drill environment is destroyed afterwards. | SEC-13; NFR-AVL-03 | D | TC-SEC-013 |

## 17. Incident response

### 17.1 Severity levels

| Severity | Definition (examples) | Acknowledge | Update cadence | Leads |
|---|---|---|---|---|
| **SEV-1 Critical** | Confirmed breach of Restricted or Confidential data; compromised admin or super_admin account; fraudulent payouts in progress; ledger tampering; ransomware or host compromise; malware delivered to users at scale | 15 min, 24 × 7 | every 1 h | Incident commander (security lead), owner, DevOps lead |
| **SEV-2 High** | Suspected breach under investigation; single account takeover with financial impact; exploitable vulnerability in production with no evidence of exploitation; infected file reached a reviewer; total outage > 1 h | 1 h | every 4 h | Security lead, on-call engineer |
| **SEV-3 Medium** | Account takeover without financial impact; blocked attack campaign (credential stuffing, scanning); high-severity dependency CVE needing a patch; partial degradation | 4 business hours | daily | On-call engineer |
| **SEV-4 Low** | Policy deviation, low-severity findings, false-positive alerts needing tuning | next business day | at closure | Owning team |

### 17.2 Controls

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-77 | **Incident response process.** IR shall follow the phases detect → triage (assign severity, appoint an incident commander) → contain → eradicate → recover → notify → post-incident review. Evidence is preserved before any destructive action: snapshot of the VM disk, export of logs, `security_events` and `audit_logs`, and a DB dump, each with a SHA-256 recorded in the incident log. The incident log (timeline, decisions, actors) is kept for 7 years. A post-incident review with root cause, actions and owners is completed within 5 business days for SEV-1/2. Runbooks (DEPLOYMENT_PLAN / operations) exist for: security incident, admin account compromise, leaked secret, malware outbreak, payout fraud, reconciliation mismatch, data-leak report and backup restore (MASTER Part 24). A tabletop exercise runs before launch and every 6 months. | SEC-22; NFR-OBS-04 | D, I | TC-SEC-022 |
| SC-78 | **Breach notification.** When an incident involves **personal data**, the security lead shall notify the owner and legal counsel immediately and prepare the regulator and data-subject notifications. The working target is notification **within 72 hours** of becoming aware (GDPR Art. 33 for EU-resident contributors; the Cambodian draft Law on Personal Data Protection). The exact legal triggers, recipients and content require **legal approval (HA-03)** before launch. Affected users are notified in-app and by email with what happened, what data was involved, what we did and what they should do (for example reset password, check payout method). Rights holders are notified when a takedown-relevant leak occurs. Every notification decision, including a decision not to notify, is recorded with its rationale. | SEC-22; HA-03 | D, I | TC-SEC-022 |
| SC-79 | **Containment tooling.** Operators shall have tested commands for: `scripts/revoke-all-sessions` (all users) and `POST /admin/users/{id}/revoke-sessions`; suspending accounts; `maintenance_mode=true` (AM-06), which blocks non-admin API calls; pausing payouts (the reconciliation pause flag); rotating any secret per SC-29; disabling uploads by setting `max_file_bytes` to 0; blocking IPs or CIDRs in Caddy; and taking datasets down (FR-DS-12). Each tool is exercised in the tabletop exercise or a staging drill. | SEC-21; FR-ADM-04, FR-ADM-02; AM-06 | D, T | TC-SEC-021 |

## 18. Dependency and supply-chain security

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-80 | **Software composition analysis.** CI shall run `pip-audit` against `uv.lock`, `npm audit --audit-level=high --omit=dev` plus `osv-scanner` against the web lockfile, on every pull request and nightly on `main`. **Critical** findings block merge and release. **High** findings need a documented exception (SC-83) or a fix within 7 days. Medium findings are fixed within 30 days. | SEC-20 | T | TC-SEC-020 |
| SC-81 | **Container image scanning.** **Trivy** shall scan every built image (`trivy image --severity CRITICAL,HIGH --exit-code 1 --ignore-unfixed`), including OS packages, language packages and secrets, and scan Dockerfiles and compose files (`trivy config`). Critical findings block release. Images are rebuilt weekly to pick up base-image fixes, and the nightly job rescans the deployed image digests. | SEC-20 | T | TC-SEC-020 |
| SC-82 | **Dependency hygiene.** Dependabot (or Renovate with the same scope) opens weekly update PRs for `uv` (Python), npm, Docker base images and GitHub Actions, with security updates daily. Lockfiles are committed and CI installs from them exactly (`uv sync --frozen`, `npm ci`). Base images are pinned by digest. GitHub Actions are pinned by commit SHA. A CycloneDX SBOM is produced per release image and attached to the release. New dependencies require reviewer approval, with a check of maintenance status and licence. | SEC-20 | T, I | TC-SEC-020 |
| SC-83 | **Static analysis and secure review.** CI shall run ruff with the `S` (bandit) rules, ESLint with `react/no-danger`, `no-eval` and `eslint-plugin-security`, mypy and `tsc --noEmit`. Every PR touching auth, finance, processing or permissions needs a second reviewer from the security-reviewer list and the security checklist (authorization matrix updated, inputs validated, no secrets, logging redaction). A vulnerability exception records CVE, affected component, exploitability analysis, compensating control, owner and an expiry ≤ 30 days, in `docs/06-testing-security/exceptions/`. | SEC-18, SEC-17, SEC-19 | T, I | TC-SEC-018, TC-SEC-017, TC-SEC-019 |

## 19. Production hardening

| ID | Control | SRS | Verif | Tests |
|---|---|---|:-:|---|
| SC-84 | **Container hardening.** Every application container (`web`, `api`, `worker`, `beat`) shall run as a non-root `USER` (uid ≥ 10000) with `read_only: true`, `tmpfs` for `/tmp` (and Next.js cache paths) mounted `noexec,nosuid`, `cap_drop: [ALL]`, `security_opt: ["no-new-privileges:true"]`, the default seccomp profile, `mem_limit`, `cpus` and `pids_limit`, a healthcheck and `restart: unless-stopped`. Data services (Postgres, Redis, ClamAV, Caddy) use their official non-root modes where available, `no-new-privileges`, dropped capabilities except those documented (Caddy keeps `NET_BIND_SERVICE`), and writable volumes only for their data paths. No container mounts `/var/run/docker.sock`, and none runs `privileged`. | SEC-11 | I, T | TC-SEC-011 |
| SC-85 | **Network exposure.** The host firewall (nftables or ufw, default deny inbound) shall allow **only TCP 80 and 443** from the internet. SSH (22) is allowed only from the admin IP allowlist or over the VPN, never from `0.0.0.0/0`. In production compose only Caddy publishes ports, because Docker-published ports bypass ufw. PostgreSQL, Redis, clamd, metrics and storage are **not exposed**: no `ports:` entries, and data-tier networks are `internal: true`. Outbound traffic from the processing network is limited per SC-35. An external port scan before launch confirms that only 80/443 answer. | SEC-12 | T, I | TC-SEC-012 |
| SC-86 | **Host hardening.** SSH shall be **key-only**: `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PermitRootLogin no`, `AllowUsers` limited to named operators, ed25519 keys. `unattended-upgrades` applies security updates daily, with automatic reboot in the 03:00–04:00 UTC window when required. Other settings: NTP synchronised (TOTP correctness); minimal packages; disk encryption (SC-24); `auditd` rules for `/etc/datahub`, `docker` and `sudo`; `fail2ban` or `sshguard` on SSH; the Docker daemon with `live-restore` and log rotation; personal operator accounts with sudo (no shared accounts). | SEC-12 | I | TC-SEC-012 |
| SC-87 | **Production configuration checks.** With `ENV=production`, the API and workers shall refuse to start unless: `ADMIN_MFA_REQUIRED=true`; secure cookies are on; `S3_PUBLIC_ENDPOINT` and `WEB_ORIGIN` are `https://`; debug and docs are off; `CSRF_SECRET`, `APP_ENCRYPTION_KEY`, `MFA_ENCRYPTION_KEY` and `RECOVERY_CODE_PEPPER` are present and ≥ 32 bytes; `TRUSTED_PROXIES` is set; the database user is not a superuser; the Celery serializer is `json`. The web app refuses to build for production with `NEXT_PUBLIC_*` values pointing at `localhost`. | SEC-05, SEC-03, SEC-12 | T | TC-SEC-005, TC-SEC-003, TC-SEC-012 |
| SC-88 | **Pre-launch security gate.** Before public launch: an OWASP ASVS 4.0 Level 2 assessment (authentication, session, access control, validation, file handling, business logic, API, configuration) plus a penetration test covering every threat in THREAT_MODEL.md marked "P". All critical and high findings fixed and retested. Medium findings have an owner and a date. The §20 checklist is complete. HA-01 … HA-04 are approved or the release is explicitly gated (`legal_docs_approved`). The gate is repeated yearly and after major changes to authentication, finance or file processing. | SEC-22 | P, I | TC-SEC-022 |

---

## 20. Production hardening checklist

Release readiness (MASTER Part 25) requires every row checked on the production host with evidence linked in the release record.

| # | Check | Control | Evidence |
|---|---|---|---|
| H-01 | All app containers run as non-root; `docker inspect` shows `User` ≠ root | SC-84 | inspect output |
| H-02 | `ReadonlyRootfs=true` for web, api, worker, beat; tmpfs mounted `noexec` | SC-84, SC-41 | inspect output |
| H-03 | `no-new-privileges:true` and `CapDrop=ALL` on all containers (documented exceptions only) | SC-84 | inspect output |
| H-04 | No `privileged`, no docker.sock mounts | SC-84 | compose review |
| H-05 | External port scan shows only 80 and 443 open; 22 filtered from non-allowlisted IPs | SC-85 | nmap report |
| H-06 | Postgres, Redis, clamd, metrics and storage have no published ports; data networks `internal: true` | SC-85, SC-56 | compose review |
| H-07 | SSH: password and keyboard-interactive auth disabled, root login disabled, key-only | SC-86 | `sshd -T` output |
| H-08 | `unattended-upgrades` enabled and last run < 24 h | SC-86 | apt logs |
| H-09 | TLS grade A or better; HSTS present; HTTP → HTTPS redirect | SC-22 | SSL Labs report |
| H-10 | Security headers (CSP with nonce, XFO DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, CORP) on HTML, API and error pages | SC-46, SC-47 | header test output |
| H-11 | No CORS headers on API responses; bucket CORS = single https origin | SC-48 | curl + storage-setup verify |
| H-12 | Bucket anonymous GET/List → 403; public-access block on | SC-43 | storage-setup verify |
| H-13 | Cookies `__Host-dh_session; HttpOnly; Secure; SameSite=Lax` | SC-06 | browser devtools capture |
| H-14 | `ADMIN_MFA_REQUIRED=true`; all admins enrolled in MFA | SC-10, SC-87 | startup log + admin list |
| H-15 | Secrets only in 0600 env files or Docker secrets; gitleaks clean on full history | SC-27, SC-28 | `stat` output, CI log |
| H-16 | pip-audit, npm audit, osv-scanner, Trivy: 0 critical; highs have exceptions | SC-80, SC-81, SC-83 | CI artefacts |
| H-17 | ClamAV signatures < 24 h old; EICAR upload ends `quarantined` | SC-39 | test record |
| H-18 | Backups: last success < 26 h; restore drill passed this quarter; keys escrowed by two custodians | SC-75, SC-76, SC-26 | backup log, drill report |
| H-19 | Log-scrubbing test passes; Sentry `send_default_pii=False` | SC-57 | CI log |
| H-20 | Alerts wired and test-fired (login failures, reconciliation, backup, ClamAV, exports) | SC-59 | alert test record |
| H-21 | Authorization matrix and SoD suites green on release commit | SC-21, SC-17 | CI log |
| H-22 | `/docs`, `/redoc`, `/openapi.json`, `/metrics` unreachable externally | SC-56 | curl output |
| H-23 | ASVS L2 assessment and pen test: no open critical or high findings | SC-88 | report |
| H-24 | IR runbooks published; tabletop exercise done; on-call contacts current | SC-77, SC-79 | IR record |

---

## 21. Traceability

### 21.1 Control → SRS → tests

| Control | SRS SEC | Other requirements | Test IDs |
|---|---|---|---|
| SC-01 | SEC-01 | FR-AUTH-02, FR-AUTH-06 | TC-SEC-001 |
| SC-02 | SEC-01 | FR-AUTH-02 | TC-SEC-001 |
| SC-03 | SEC-22 | FR-AUTH-01, FR-AUTH-06, FR-AUTH-12, AM-14 | TC-SEC-022 |
| SC-04 | SEC-06 | FR-AUTH-07, AM-08 | TC-SEC-006 |
| SC-05 | SEC-02 | — | TC-SEC-002 |
| SC-06 | SEC-03 | — | TC-SEC-003 |
| SC-07 | SEC-21, SEC-02 | FR-AUTH-10, FR-AUTH-11, AM-08 | TC-SEC-021, TC-SEC-002 |
| SC-08 | SEC-05, SEC-14 | FR-AUTH-08, FR-AUTH-09 | TC-SEC-005, TC-SEC-014 |
| SC-09 | SEC-05 | FR-AUTH-09 | TC-SEC-005 |
| SC-10 | SEC-05 | FR-AUTH-08, AM-08 | TC-SEC-005 |
| SC-11 | SEC-02 | FR-AUTH-03, FR-AUTH-12, FR-AUTH-13 | TC-SEC-002 |
| SC-12 | SEC-22 | FR-USER-05, FR-NOTIF-04, FR-NOTIF-05 | TC-SEC-022 |
| SC-13 | SEC-05 | FR-ADM-03 | TC-SEC-005 |
| SC-14 | SEC-07 | — | TC-SEC-007 |
| SC-15 | SEC-08 | FR-DS-03, FR-DS-13, FR-ANN-08, FR-MSG-02 | TC-SEC-008 |
| SC-16 | SEC-08 | FR-DS-02 | TC-SEC-008 |
| SC-17 | SEC-08 | FR-REV-02, FR-ANN-15, FR-PAY-08, FR-PAY-10, FR-FIN-12, FR-VER-04, FR-ADM-03 | TC-SEC-008 |
| SC-18 | SEC-21 | FR-ADM-03 | TC-SEC-021 |
| SC-19 | SEC-08 | FR-DS-04, FR-PAY-10, FR-ANN-10, FR-REV-09 | TC-SEC-008 |
| SC-20 | SEC-08 | FR-DS-11, FR-EXP-03, FR-AUD-05 | TC-SEC-008 |
| SC-21 | SEC-07, SEC-08 | NFR-INT-10 | TC-SEC-007, TC-SEC-008 |
| SC-22 | SEC-12 | — | TC-SEC-012 |
| SC-23 | SEC-12 | — | TC-SEC-012 |
| SC-24 | SEC-13, SEC-09 | — | TC-SEC-013, TC-SEC-009 |
| SC-25 | SEC-14 | FR-PAY-05 | TC-SEC-014 |
| SC-26 | SEC-13 | NFR-AVL-02, AM-13 | TC-SEC-013 |
| SC-27 | SEC-19 | — | TC-SEC-019 |
| SC-28 | SEC-19 | — | TC-SEC-019 |
| SC-29 | SEC-19, SEC-14 | — | TC-SEC-019, TC-SEC-014 |
| SC-30 | SEC-19, SEC-11 | — | TC-SEC-019, TC-SEC-011 |
| SC-31 | SEC-17 | NFR-INT-04 | TC-SEC-017 |
| SC-32 | SEC-17 | NFR-PERF-03 | TC-SEC-017 |
| SC-33 | SEC-17 | FR-UPL-08 | TC-SEC-017 |
| SC-34 | SEC-17, SEC-11 | FR-PROC-08, FR-PROC-09 | TC-SEC-017, TC-SEC-011 |
| SC-35 | SEC-17, SEC-11 | — | TC-SEC-017, TC-SEC-011 |
| SC-36 | SEC-17 | — | TC-SEC-017 |
| SC-37 | SEC-10, SEC-11 | FR-PROC-02 | TC-SEC-010, TC-SEC-011 |
| SC-38 | SEC-17 | FR-UPL-02, FR-DS-07, AM-01 | TC-SEC-017 |
| SC-39 | SEC-11 | FR-PROC-03, FR-PROC-04, A-10, AM-01 | TC-SEC-011 |
| SC-40 | SEC-11 | FR-PROC-05, FR-PROC-06, FR-PROC-07 | TC-SEC-011 |
| SC-41 | SEC-11 | FR-PROC-09 | TC-SEC-011 |
| SC-42 | SEC-10 | FR-DS-14, FR-PROC-08 | TC-SEC-010 |
| SC-43 | SEC-09 | FR-DS-14, FR-AUD-04 | TC-SEC-009 |
| SC-44 | SEC-11 | FR-MSG-05, FR-VER-01, FR-VER-07, FR-PAY-10 | TC-SEC-011 |
| SC-45 | SEC-09 | FR-PROC-03, FR-DS-12 | TC-SEC-009 |
| SC-46 | SEC-15 | — | TC-SEC-015 |
| SC-47 | SEC-15, SEC-10 | — | TC-SEC-015, TC-SEC-010 |
| SC-48 | SEC-16 | — | TC-SEC-016 |
| SC-49 | SEC-18 | — | TC-SEC-018 |
| SC-50 | SEC-09, SEC-22 | — | TC-SEC-009, TC-SEC-022 |
| SC-51 | SEC-06 | — | TC-SEC-006 |
| SC-52 | SEC-04 | — | TC-SEC-004 |
| SC-53 | SEC-22 | FR-PAY-03, FR-REV-10, FR-FIN-12, NFR-INT-03 | TC-SEC-022 |
| SC-54 | SEC-08 | NFR-INT-06, NFR-INT-07 | TC-SEC-008 |
| SC-55 | SEC-04, SEC-21 | FR-MSG-07 | TC-SEC-004, TC-SEC-021 |
| SC-56 | SEC-12 | — | TC-SEC-012 |
| SC-57 | SEC-22 | NFR-OBS-01, NFR-OBS-03, NFR-OBS-05, FR-AUD-05 | TC-SEC-022 |
| SC-58 | SEC-22 | FR-AUD-01 … FR-AUD-05 | TC-SEC-022 |
| SC-59 | SEC-22 | NFR-OBS-04 | TC-SEC-022 |
| SC-60 | SEC-22 | FR-AUD-02, A-15 | TC-SEC-022 |
| SC-61 | SEC-08, SEC-22 | FR-NOTIF-05, FR-EXP-03, FR-VER-07 | TC-SEC-008, TC-SEC-022 |
| SC-62 | SEC-22 | FR-DS-01, FR-DS-08, FR-REV-06, FR-REV-07 | TC-SEC-022 |
| SC-63 | SEC-22 | FR-USER-07, FR-ADM-11, FR-DS-05, A-15, AM-09 | TC-SEC-022 |
| SC-64 | SEC-13 | NFR-OBS-03 | TC-SEC-013 |
| SC-65 | SEC-06 | FR-UPL-02, FR-UPL-07, NFR-OBS-04 | TC-SEC-006 |
| SC-66 | SEC-06 | FR-VER-03, FR-PAY-07, FR-ADM-06 | TC-SEC-006 |
| SC-67 | SEC-06 | FR-ADM-10, AM-04 | TC-SEC-006 |
| SC-68 | SEC-06, SEC-18 | FR-MSG-03, FR-MSG-05 | TC-SEC-006, TC-SEC-018 |
| SC-69 | SEC-22 | NFR-INT-01 | TC-SEC-022 |
| SC-70 | SEC-22 | NFR-INT-02, FR-FIN-10, FR-AUD-02 | TC-SEC-022 |
| SC-71 | SEC-22 | FR-PAY-04, FR-REV-10, FR-FIN-06, FR-FIN-07, AM-03 | TC-SEC-022 |
| SC-72 | SEC-05, SEC-08 | FR-PAY-01 … FR-PAY-12, FR-USER-05 | TC-SEC-005, TC-SEC-008 |
| SC-73 | SEC-22 | FR-FIN-13 | TC-SEC-022 |
| SC-74 | SEC-05 | FR-FIN-01, FR-FIN-12 | TC-SEC-005 |
| SC-75 | SEC-13 | NFR-AVL-02, AM-13 | TC-SEC-013 |
| SC-76 | SEC-13 | NFR-AVL-03 | TC-SEC-013 |
| SC-77 | SEC-22 | NFR-OBS-04 | TC-SEC-022 |
| SC-78 | SEC-22 | HA-03 | TC-SEC-022 |
| SC-79 | SEC-21 | FR-ADM-02, FR-ADM-04, AM-06 | TC-SEC-021 |
| SC-80 | SEC-20 | — | TC-SEC-020 |
| SC-81 | SEC-20 | — | TC-SEC-020 |
| SC-82 | SEC-20 | — | TC-SEC-020 |
| SC-83 | SEC-18, SEC-17, SEC-19 | — | TC-SEC-018, TC-SEC-017, TC-SEC-019 |
| SC-84 | SEC-11 | — | TC-SEC-011 |
| SC-85 | SEC-12 | — | TC-SEC-012 |
| SC-86 | SEC-12 | — | TC-SEC-012 |
| SC-87 | SEC-05, SEC-03, SEC-12 | — | TC-SEC-005, TC-SEC-003, TC-SEC-012 |
| SC-88 | SEC-22 | — | TC-SEC-022 |

### 21.2 SRS SEC requirement → controls (coverage check)

| SEC | Requirement (short) | Controls | Test group |
|---|---|---|---|
| SEC-01 | Argon2id password hashing | SC-01, SC-02 | TC-SEC-001 |
| SEC-02 | Session tokens 256-bit, hashed, rotated | SC-05, SC-07, SC-11 | TC-SEC-002 |
| SEC-03 | Cookie flags | SC-06, SC-87 | TC-SEC-003 |
| SEC-04 | CSRF and WebSocket Origin | SC-52, SC-55 | TC-SEC-004 |
| SEC-05 | Admin MFA | SC-08, SC-09, SC-10, SC-13, SC-72, SC-74, SC-87 | TC-SEC-005 |
| SEC-06 | Rate limits | SC-04, SC-51, SC-65, SC-66, SC-67, SC-68 | TC-SEC-006 |
| SEC-07 | Deny-by-default permission declaration | SC-14, SC-21 | TC-SEC-007 |
| SEC-08 | Resource-level checks, 404/403 | SC-15, SC-16, SC-17, SC-19, SC-20, SC-21, SC-54, SC-61, SC-72 | TC-SEC-008 |
| SEC-09 | Private bucket, presigned URLs | SC-24, SC-43, SC-45, SC-50 | TC-SEC-009 |
| SEC-10 | Safe file serving headers | SC-37, SC-42, SC-47 | TC-SEC-010 |
| SEC-11 | Worker isolation, no execution | SC-30, SC-34, SC-35, SC-37, SC-39, SC-40, SC-41, SC-44, SC-84 | TC-SEC-011 |
| SEC-12 | TLS, HSTS, internal services not exposed | SC-22, SC-23, SC-56, SC-85, SC-86, SC-87 | TC-SEC-012 |
| SEC-13 | Encryption at rest and of backups | SC-24, SC-26, SC-64, SC-75, SC-76 | TC-SEC-013 |
| SEC-14 | App-layer AES-256-GCM, key rotation | SC-08, SC-25, SC-29 | TC-SEC-014 |
| SEC-15 | CSP and headers | SC-46, SC-47 | TC-SEC-015 |
| SEC-16 | CORS | SC-48 | TC-SEC-016 |
| SEC-17 | Input validation, size caps, no SQLi or SSRF | SC-31, SC-32, SC-33, SC-34, SC-35, SC-36, SC-38, SC-83 | TC-SEC-017 |
| SEC-18 | Escaped rendering, sanitised Markdown | SC-49, SC-68, SC-83 | TC-SEC-018 |
| SEC-19 | No committed secrets, gitleaks | SC-27, SC-28, SC-29, SC-30, SC-83 | TC-SEC-019 |
| SEC-20 | Dependency and image scanning | SC-80, SC-81, SC-82 | TC-SEC-020 |
| SEC-21 | Per-request permissions, immediate revocation | SC-07, SC-18, SC-55, SC-79 | TC-SEC-021 |
| SEC-22 | ASVS L2 security test before launch | SC-03, SC-12, SC-50, SC-53, SC-57 … SC-63, SC-69 … SC-71, SC-73, SC-77, SC-78, SC-88 | TC-SEC-022 |

All 22 SEC requirements are covered.

### 21.3 Risk register links

| Risk (RISK_REGISTER.md) | Primary controls |
|---|---|
| R-01 copyrighted or stolen documents | SC-62, SC-45, SC-67, SC-66 |
| R-02 personal data without lawful basis | SC-61, SC-62, SC-63, SC-78 |
| R-03 payment fraud, junk or duplicate farming | SC-66, SC-71, SC-72, SC-73 |
| R-04 double payment | SC-53, SC-70, SC-71, SC-73 |
| R-05 malware via uploads | SC-37, SC-39, SC-41, SC-42 |
| R-06 archive bombs, zip-slip | SC-40, SC-41 |
| R-10 admin account compromise | SC-10, SC-13, SC-17, SC-58, SC-59, SC-72 |
| R-13 single VM point of failure | SC-75, SC-76, SC-85, SC-86 |

New residual risks proposed for the register are listed in THREAT_MODEL.md §9.
